'use strict';

const EventOrder = (() => {
  const key = date => 'event_order_' + date;
  let drag = null;
  let scrollFrame = 0;
  let refreshPending = false;

  function sorted(events, saved) {
    if (!saved) return events;
    let ids;
    try { ids = JSON.parse(saved); } catch { return events; }
    if (!Array.isArray(ids)) return events;
    const remaining = new Map(events.map(event => [event.id, event]));
    const ordered = [];
    for (const id of ids) {
      if (!remaining.has(id)) continue;
      ordered.push(remaining.get(id));
      remaining.delete(id);
    }
    return ordered.concat([...remaining.values()]);
  }

  function move(ids, from, target, after) {
    if (from === target || !ids.includes(from) || !ids.includes(target)) return ids;
    const next = ids.filter(id => id !== from);
    next.splice(next.indexOf(target) + Number(after), 0, from);
    return next;
  }

  function commit(ids, focus) {
    const next = {...state, settings: {...state.settings, [key(selected)]: ids.length ? JSON.stringify(ids) : ''}};
    if (!CloudMerge.validTrip(next)) { toast('這天的自訂順序已超過儲存上限'); return; }
    state = next;
    save();
    render();
    if (focus) {
      const row = Array.from(document.querySelectorAll('[data-order-id]')).find(e => e.dataset.orderId === focus);
      row?.querySelector('[data-order-handle]')?.focus({preventScroll:true});
    }
    toast(ids.length ? '已儲存顯示順序，原訂時間保留' : '已恢復按時間排序');
  }

  function toolbar(events) {
    if (events.length < 2) return '';
    return `<div class="order-toolbar"><span>拖曳握把調整順序，時間維持原設定。</span>
      ${state.settings[key(selected)] ? '<button class="btn" data-order-reset>按時間排序</button>' : ''}</div>`;
  }

  function controls(e, index, count) {
    if (count < 2) return '';
    return `<div class="order-controls">
      <button type="button" class="order-handle" data-order-handle aria-label="拖曳 ${esc(e.title)}（也可用上下方向鍵）" title="拖曳排序">⠿</button>
      <button type="button" data-order-step="-1" aria-label="上移 ${esc(e.title)}" ${index === 0 ? 'disabled' : ''}>↑</button>
      <button type="button" data-order-step="1" aria-label="下移 ${esc(e.title)}" ${index === count - 1 ? 'disabled' : ''}>↓</button>
    </div>`;
  }

  function step(id, direction) {
    const ids = eventsOn(selected).map(e => e.id);
    const target = ids[ids.indexOf(id) + direction];
    if (ids.includes(id) && target) commit(move(ids, id, target, direction > 0), id);
  }

  function clearMarker() {
    drag?.target?.classList.remove('order-before','order-after');
  }

  function mark() {
    clearMarker();
    const rows = drag.row.parentElement?.querySelectorAll('[data-order-id]');
    const row = Array.from(rows || []).find(candidate => {
      const rect = candidate.getBoundingClientRect();
      return drag.y >= rect.top && drag.y <= rect.bottom;
    });
    drag.target = row && row !== drag.row ? row : null;
    if (drag.target) {
      const rect = drag.target.getBoundingClientRect();
      drag.after = drag.y > (rect.top + rect.bottom) / 2;
      drag.target.classList.add(drag.after ? 'order-after' : 'order-before');
    }
  }

  function scrollWhileDragging() {
    if (!drag?.moved) return;
    const edge = 95;
    if (drag.y < edge) window.scrollBy(0, -12);
    if (drag.y > window.innerHeight - edge) window.scrollBy(0, 12);
    mark();
    scrollFrame = requestAnimationFrame(scrollWhileDragging);
  }

  function finish(event, drop) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    clearMarker();
    cancelAnimationFrame(scrollFrame);
    const {row, target, after, date} = drag;
    row.classList.remove('order-dragging');
    drag = null;
    const refresh = refreshPending;
    refreshPending = false;
    if (!drop || !target || selected !== date || !row.isConnected) { if (refresh) render(); return; }
    const ids = eventsOn(date).map(e => e.id);
    const next = move(ids, row.dataset.orderId, target.dataset.orderId, after);
    if (next.some((id,index) => id !== ids[index])) commit(next);
    else if (refresh) render();
  }

  document.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-order-handle]');
    if (!button || drag || event.button !== 0) return;
    drag = {pointerId:event.pointerId, row:button.closest('[data-order-id]'),
      date:selected, startY:event.clientY, y:event.clientY, moved:false};
    button.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.y = event.clientY;
    if (!drag.moved && Math.abs(drag.y - drag.startY) >= 6) {
      drag.moved = true;
      drag.row.classList.add('order-dragging');
      scrollWhileDragging();
    }
  });
  document.addEventListener('pointerup', event => {
    if (drag?.moved && drag.pointerId === event.pointerId) {
      drag.y = event.clientY;
      mark();
    }
    finish(event, true);
  });
  document.addEventListener('pointercancel', event => finish(event, false));
  document.addEventListener('lostpointercapture', event => finish(event, false));
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.hasAttribute('data-order-reset')) commit([]);
    if (button?.dataset.orderStep) step(button.closest('[data-order-id]').dataset.orderId, Number(button.dataset.orderStep));
  });
  document.addEventListener('keydown', event => {
    if (!event.target.matches('[data-order-handle]') || !['ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    step(event.target.closest('[data-order-id]').dataset.orderId, event.key === 'ArrowUp' ? -1 : 1);
  });

  return {key, sorted, move, controls, toolbar, active: () => !!drag, refreshAfterDrag: () => { refreshPending = true; }};
})();
