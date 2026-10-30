'use strict';
const Checklist=(()=>{
 let editing=null;
 function panel(){const done=state.checklist.filter(c=>c.done).length,total=state.checklist.length;return `<section class="panel checklist-panel"><div class="section-head"><div><h2>行前待辦</h2><p class="day-subtitle">${done} / ${total} 已完成 · 和朋友一起準備</p></div><button class="btn green checklist-add" data-checklist-new>${icon('plus')}新增</button></div><div class="progress" style="margin:0 0 10px"><i style="width:${total?done/total*100:0}%"></i></div>${state.checklist.map(c=>`<div class="check-row"><label class="check-item"><input type="checkbox" data-check="${esc(c.id)}" ${c.done?'checked':''}><span><strong>${esc(c.title)}</strong>${c.note?`<small>${esc(c.note)}</small>`:''}</span></label><button class="icon-btn check-edit" data-checklist-edit="${esc(c.id)}" aria-label="編輯或刪除 ${esc(c.title)}">${icon('edit')}</button></div>`).join('')||'<div class="checklist-empty">清單目前是空的。<br>新增護照、網卡或想記住的小事吧。</div>'}<button class="add-dashed checklist-more" data-checklist-new>${icon('plus')}新增一項行前待辦</button></section>`;}
 function edit(id){const current=id?state.checklist.find(c=>c.id===id):null;if(id&&!current){toast('這項待辦已被朋友刪除');return;}editing={id:id||'check-'+crypto.randomUUID(),base:current?clone(current):null};openSheet(current?'編輯行前待辦':'新增行前待辦',`<form id="checklist-form"><label class="field">待辦名稱<input name="title" value="${esc(current?.title||'')}" maxlength="120" placeholder="例如：購買日本網卡" required></label><label class="field">備註（選填）<textarea name="note" maxlength="2000" placeholder="準備方式、數量，或交給誰處理…">${esc(current?.note||'')}</textarea></label><p class="form-help">儲存後會同步給同行朋友，完成狀態會保留。</p><div id="checklist-error" class="booking-error" role="alert"></div><div class="sheet-actions">${current?'<button type="button" class="btn booking-delete" data-checklist-delete>刪除此項</button>':'<button type="button" class="btn" data-close>取消</button>'}<button class="btn primary" type="submit">儲存待辦</button></div></form>`);}
 function error(msg){document.getElementById('checklist-error').textContent=msg;}
 function submit(form,overwrite=false){
  if(!editing)return;const values=Object.fromEntries(new FormData(form)),title=String(values.title||'').trim(),note=String(values.note||'').trim();
  if(!title||title.length>120||note.length>2000){error('請填寫待辦名稱（最多 120 字），備註最多 2000 字');return;}
  if(!editing.base){if(state.checklist.length>=100){error('最多可新增 100 項待辦，請先刪除不需要的項目');return;}state.checklist.push({id:editing.id,title,note,done:false});}
  else{
   const current=state.checklist.find(c=>c.id===editing.id);if(!current){error('這項待辦已被朋友刪除，請關閉後重新新增');return;}
   const draft={...editing.base,title,note},merged=CloudMerge.mergeTrip(editing.base,draft,current);
   if(merged.conflicts.length&&!overwrite){document.getElementById('checklist-error').innerHTML='朋友也修改了這項待辦。<button type="button" class="text-btn" data-checklist-reload>載入朋友版本</button><button type="button" class="text-btn" data-checklist-overwrite>保留我的文字並儲存</button>';return;}
   const result=overwrite?{...current,title,note}:merged.state;
   state.checklist=state.checklist.map(c=>c.id===editing.id?result:c);
  }
  save();closeSheet();render();toast('行前待辦已儲存');
 }
 function remove(){if(!editing?.base)return;const current=state.checklist.find(c=>c.id===editing.id);if(!current){closeSheet();render();toast('這項待辦已被刪除');return;}if(JSON.stringify(current)!==JSON.stringify(editing.base)){error('朋友剛更新這項待辦，請關閉後重新開啟再刪除');return;}state.checklist=state.checklist.filter(c=>c.id!==editing.id);save();closeSheet();render();toast('已刪除行前待辦');}
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-checklist-new'))edit();if(b.dataset.checklistEdit)edit(b.dataset.checklistEdit);if(b.hasAttribute('data-checklist-reload'))edit(editing.id);if(b.hasAttribute('data-checklist-overwrite'))submit(document.getElementById('checklist-form'),true);if(b.hasAttribute('data-checklist-delete'))document.getElementById('checklist-error').innerHTML='刪除也會同步給同行朋友。<button type="button" class="text-btn" data-checklist-confirm-delete>確認刪除</button>';if(b.hasAttribute('data-checklist-confirm-delete'))remove();});
 document.addEventListener('submit',e=>{if(e.target.id==='checklist-form'){e.preventDefault();submit(e.target);}});
 return {panel,edit};
})();
