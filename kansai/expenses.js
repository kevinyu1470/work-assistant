'use strict';

const TripExpenses = (() => {
  const people = {kevin: 'Kevin', luna: 'Luna'};
  const methods = {cash: '現金', card: '刷卡'};
  const currencies = {JPY: '日圓', TWD: '台幣'};
  const prefix = 'expense_';
  const validKey = /^expense_[0-9a-f-]{36}$/;
  const amountPattern = /^\d{1,9}$/;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const roleKey = () => 'kansai-expense-person-' + Cloud.key.slice(0, 16);

  function parseExpense(input) {
    const {person, method, currency, date} = input;
    const title = String(input.title ?? '').trim();
    const amount = Number(input.amount);
    if (!own(people, person) || !own(methods, method) || !own(currencies, currency)
        || !amountPattern.test(String(input.amount)) || amount <= 0
        || !title || title.length > 100 || !datePattern.test(date)) return null;
    const parsedDate = new Date(date + 'T00:00:00Z');
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return null;
    return {person, method, currency, date, title, amount};
  }

  function list(settings) {
    const result = [];
    for (const [id, raw] of Object.entries(settings)) {
      if (!validKey.test(id) || !raw) continue;
      try {
        const expense = parseExpense(JSON.parse(raw));
        if (expense) result.push({...expense, id});
      } catch {}
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }

  function summarize(entries) {
    const totals = Object.fromEntries(['all', ...Object.keys(people)].map(person => [
      person, Object.fromEntries(Object.keys(currencies).map(currency => [currency, {cash: 0, card: 0}]))
    ]));
    for (const {person, method, currency, amount} of entries) {
      totals[person][currency][method] += amount;
      totals.all[currency][method] += amount;
    }
    return totals;
  }

  const format = (currency, amount) => new Intl.NumberFormat('zh-TW', {
    style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 0
  }).format(amount);
  const options = (values, value) => Object.entries(values).map(([key, label]) =>
    `<option value="${key}" ${key === value ? 'selected' : ''}>${label}</option>`).join('');
  let localPerson;
  function selectedPerson() {
    try {
      const stored = localStorage.getItem(roleKey());
      if (!localPerson && own(people, stored)) localPerson = stored;
    } catch {}
    return localPerson || 'kevin';
  }

  function panel() {
    const entries = list(state.settings);
    const totals = summarize(entries);
    const visibleCurrencies = Object.keys(currencies).filter(c => c === 'JPY' || entries.some(e => e.currency === c));
    return `<section class="panel expense-panel" aria-label="共同旅費">
      <div class="expense-summary">
        ${['all', ...Object.keys(people)].map(person => `<article class="expense-total">
          <h2>${person === 'all' ? '兩人合計' : people[person]}</h2>
          ${visibleCurrencies.map(currency => {
            const {cash, card} = totals[person][currency];
            return `<div class="expense-amount"><strong>${format(currency, cash + card)}</strong>
              <small>現金 ${cash.toLocaleString('zh-TW')} · 刷卡 ${card.toLocaleString('zh-TW')}</small></div>`;
          }).join('')}
        </article>`).join('')}
      </div>
      <form id="expense-quick" class="expense-quick">
        <div class="section-head"><h2>記一筆</h2></div>
        <div class="expense-fields">
          <label class="field">誰付款<select name="person">${options(people, selectedPerson())}</select></label>
          <label class="field">付款方式<select name="method">${options(methods, 'cash')}</select></label>
          <label class="field">幣別<select name="currency">${options(currencies, 'JPY')}</select></label>
          <label class="field">金額<input name="amount" inputmode="numeric" pattern="[0-9]{1,9}" maxlength="9" placeholder="0" required></label>
        </div>
        <label class="field">支出項目<input name="title" maxlength="100" placeholder="例如 拉麵、車資" required></label>
        <div class="expense-submit"><p class="form-help">日圓、台幣分開合計。刷卡與現金各記一次。</p><button class="btn primary" type="submit">${icon('plus')}新增支出</button></div>
        <p class="form-help danger" data-expense-error role="alert"></p>
      </form>
      <div class="expense-ledger"><h2>支出紀錄 <small>${entries.length} 筆</small></h2>
        ${entries.length ? entries.map(e => `<article class="expense-entry">
          <div><strong>${esc(e.title)}</strong><small>${md(e.date)} · ${people[e.person]} · ${methods[e.method]}</small></div>
          <b>${format(e.currency, e.amount)}</b><button type="button" class="icon-btn" data-expense-edit="${e.id}" aria-label="編輯 ${esc(e.title)}">${icon('edit')}</button>
        </article>`).join('') : '<p class="form-help">還沒有支出紀錄。</p>'}
      </div>
    </section>`;
  }

  // Update totals and nearby records without interrupting the active quick-entry field.
  function refresh(main, page) {
    const panel = main.querySelector('.expense-panel');
    if (!panel) return false;
    const template = document.createElement('template');
    template.innerHTML = page;
    for (const selector of ['.expense-summary', '.expense-ledger']) {
      panel.querySelector(selector).replaceWith(template.content.querySelector(selector));
    }
    while (panel.nextSibling) panel.nextSibling.remove();
    const nextPanel = template.content.querySelector('.expense-panel');
    while (nextPanel.nextSibling) main.append(nextPanel.nextSibling);
    return true;
  }

  function edit(id) {
    const expense = list(state.settings).find(entry => entry.id === id);
    if (!expense) return;
    openSheet('編輯支出', `<form id="expense-edit" data-expense-id="${id}">
      <label class="field">支出項目<input name="title" value="${esc(expense.title)}" maxlength="100" required></label>
      <div class="expense-fields">
        <label class="field">誰付款<select name="person">${options(people, expense.person)}</select></label>
        <label class="field">付款方式<select name="method">${options(methods, expense.method)}</select></label>
        <label class="field">幣別<select name="currency">${options(currencies, expense.currency)}</select></label>
        <label class="field">金額<input name="amount" value="${expense.amount}" inputmode="numeric" pattern="[0-9]{1,9}" maxlength="9" required></label>
      </div>
      <label class="field">日期<input type="date" name="date" value="${expense.date}" required></label>
      <p class="form-help danger" data-expense-error role="alert"></p>
      <div class="sheet-actions"><button class="btn danger" type="button" data-expense-delete="${id}">刪除</button><button class="btn primary" type="submit">儲存</button></div>
    </form>`);
    $('#expense-edit').expenseBase = state.settings[id];
  }

  function persist(id, value, quickForm) {
    const next = {...state, settings: {...state.settings, [id]: value}};
    if (!CloudMerge.validTrip(next)) return false;
    if (quickForm) {
      quickForm.elements.title.value = '';
      quickForm.elements.amount.value = '';
      quickForm.querySelector('[data-expense-error]').textContent = '';
    }
    state = next;
    save();
    render();
    return true;
  }

  function remove(id, baseline) {
    openSheet('刪除這筆支出？', `<p class="form-help">刪除會更新兩人的合計並同步給旅伴。</p>
      <div class="sheet-actions"><button class="btn" data-expense-edit="${id}">返回</button><button class="btn danger" id="expense-confirm-delete">確認刪除</button></div>`);
    $('#expense-confirm-delete').onclick = () => {
      if (state.settings[id] !== baseline) { closeSheet(); toast('支出已變更，請重新查看'); return; }
      if (!persist(id, '')) { toast('目前無法刪除支出'); return; }
      closeSheet();
      toast('已刪除支出');
    };
  }

  function rememberPerson(person) {
    if (!own(people, person)) return;
    localPerson = person;
    try { localStorage.setItem(roleKey(), person); } catch {}
  }

  document.addEventListener('change', event => {
    if (event.target.matches('#expense-quick [name="person"]')) rememberPerson(event.target.value);
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.expenseEdit) edit(button.dataset.expenseEdit);
    if (button?.dataset.expenseDelete) remove(button.dataset.expenseDelete, $('#expense-edit').expenseBase);
  });
  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.id !== 'expense-quick' && form.id !== 'expense-edit') return;
    event.preventDefault();
    const input = Object.fromEntries(new FormData(form));
    const record = parseExpense({...input, date: input.date || todayJapan()});
    const error = form.querySelector('[data-expense-error]');
    if (!record) { error.textContent = '請填寫項目、有效日期與大於零的整數金額。'; return; }
    const id = form.dataset.expenseId;
    if (id && form.expenseBase !== state.settings[id]) {
      error.textContent = '旅伴已修改這筆支出，請關閉後重新開啟。';
      return;
    }
    if (!id) rememberPerson(record.person);
    if (!persist(id || prefix + crypto.randomUUID(), JSON.stringify(record), id ? null : form)) {
      error.textContent = '行程資料已達儲存上限。請先匯出備份，再整理舊紀錄。';
      return;
    }
    if (id) closeSheet();
    toast('支出已加入合計');
  });

  function hasDraft() {
    const form = document.getElementById('expense-quick');
    return !!(form && (form.elements.title.value || form.elements.amount.value));
  }

  return {panel, refresh, hasDraft, list, summarize, parseExpense};
})();
