/* ===========================================================
   SpendWise — app logic
   Phase 1: everything lives in localStorage. No backend yet.
   =========================================================== */

const STORAGE_KEYS = {
  transactions: 'spendwise:transactions',
  budgets: 'spendwise:budgets',
};

const CATEGORIES = ['Food', 'Travel', 'Shopping', 'Education', 'Entertainment', 'Other'];

const CATEGORY_COLORS = {
  Food: '#1f6f5c',
  Travel: '#2f5a8a',
  Shopping: '#a9760f',
  Education: '#5b4b8a',
  Entertainment: '#9c3b2e',
  Other: '#6b7280',
};

/* ---------- storage helpers ---------- */

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.transactions);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Could not read transactions from storage', err);
    return [];
  }
}

function saveTransactions(list) {
  try {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(list));
  } catch (err) {
    console.error('Could not save transactions', err);
  }
}

function loadBudgets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.budgets);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('Could not read budgets from storage', err);
    return {};
  }
}

function saveBudgets(obj) {
  try {
    localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(obj));
  } catch (err) {
    console.error('Could not save budgets', err);
  }
}

let transactions = loadTransactions();
let budgets = loadBudgets();
let selectedType = 'expense'; // 'expense' | 'income'
let categoryChart = null;

/* ---------- DOM refs ---------- */

const monthSelect = document.getElementById('month-select');
const budgetInput = document.getElementById('budget-input');
const budgetBarFill = document.getElementById('budget-bar-fill');
const budgetNote = document.getElementById('budget-note');

const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const runningBalanceEl = document.getElementById('running-balance');

const entryForm = document.getElementById('entry-form');
const toggleButtons = document.querySelectorAll('.entry__toggle-btn');
const categoryField = document.getElementById('category-field');
const amountInput = document.getElementById('amount-input');
const categoryInput = document.getElementById('category-input');
const dateInput = document.getElementById('date-input');
const noteInput = document.getElementById('note-input');

const filterCategory = document.getElementById('filter-category');
const ledgerBody = document.getElementById('ledger-body');
const ledgerEmpty = document.getElementById('ledger-empty');

const categoryListEl = document.getElementById('category-list');
const chartCanvas = document.getElementById('category-chart');
const chartEmpty = document.getElementById('chart-empty');

/* ---------- utilities ---------- */

function uid() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKeyOf(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function formatRupees(amount) {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(Math.round(amount));
  return sign + '\u20B9' + abs.toLocaleString('en-IN');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/* ---------- core calculations ---------- */

// Running balance is computed across ALL transactions, in chronological
// order — exactly like a real passbook, where a line's balance never
// changes even if you filter or scroll away from it.
function computeRunningBalances(list) {
  const sorted = [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.id.localeCompare(b.id);
  });
  let balance = 0;
  const balances = {};
  for (const t of sorted) {
    balance += t.type === 'income' ? t.amount : -t.amount;
    balances[t.id] = balance;
  }
  return balances;
}

function overallBalance(balances) {
  const values = Object.values(balances);
  return values.length ? values[values.length - 1] : 0;
  // Note: relies on insertion order of computeRunningBalances' chronological pass.
}

/* ---------- rendering ---------- */

function render() {
  const monthKey = monthSelect.value;
  const balances = computeRunningBalances(transactions);

  const monthTx = transactions
    .filter((t) => monthKeyOf(t.date) === monthKey)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)); // newest first for display

  const selectedCategory = filterCategory.value;
  const visibleTx = selectedCategory === 'all'
    ? monthTx
    : monthTx.filter((t) => t.category === selectedCategory);

  const totalIncome = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  totalIncomeEl.textContent = formatRupees(totalIncome);
  totalExpenseEl.textContent = formatRupees(totalExpense);
  runningBalanceEl.textContent = formatRupees(overallBalance(balances));

  renderBudget(monthKey, totalExpense);
  renderLedger(visibleTx, balances);
  renderBreakdown(monthTx, totalExpense);
}

function renderBudget(monthKey, totalExpense) {
  const budget = budgets[monthKey] || 0;
  budgetInput.value = budget || '';

  budgetBarFill.classList.remove('is-warning', 'is-over');

  if (!budget) {
    budgetBarFill.style.width = '0%';
    budgetNote.textContent = "Set a budget to track how much of it you've used.";
    return;
  }

  const pct = Math.min((totalExpense / budget) * 100, 100);
  budgetBarFill.style.width = pct + '%';

  if (totalExpense > budget) {
    budgetBarFill.classList.add('is-over');
    budgetNote.textContent = `Over budget by ${formatRupees(totalExpense - budget)}.`;
  } else if (pct >= 80) {
    budgetBarFill.classList.add('is-warning');
    budgetNote.textContent = `${formatRupees(budget - totalExpense)} left — you've used ${Math.round(pct)}% of this month's budget.`;
  } else {
    budgetNote.textContent = `${formatRupees(budget - totalExpense)} left of your ${formatRupees(budget)} budget.`;
  }
}

function renderLedger(list, balances) {
  ledgerBody.innerHTML = '';

  if (list.length === 0) {
    ledgerEmpty.hidden = false;
    return;
  }
  ledgerEmpty.hidden = true;

  for (const t of list) {
    const tr = document.createElement('tr');

    const catClass = 'cat-' + t.category.replace(/\s+/g, '');

    tr.innerHTML = `
      <td class="ledger__date">${formatDate(t.date)}</td>
      <td>${escapeHtml(t.note) || '<span style="color:var(--ink-faint)">—</span>'}</td>
      <td><span class="category-badge ${catClass}">${escapeHtml(t.category)}</span></td>
      <td class="num">${t.type === 'expense' ? formatRupees(t.amount) : ''}</td>
      <td class="num">${t.type === 'income' ? formatRupees(t.amount) : ''}</td>
      <td class="num">${formatRupees(balances[t.id] ?? 0)}</td>
      <td><button class="ledger__delete" aria-label="Delete entry" data-id="${t.id}">&times;</button></td>
    `;
    ledgerBody.appendChild(tr);
  }
}

function renderBreakdown(monthTx, totalExpense) {
  const totals = {};
  CATEGORIES.forEach((c) => (totals[c] = 0));
  monthTx.filter((t) => t.type === 'expense').forEach((t) => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  // list with mini bars
  categoryListEl.innerHTML = '';
  const activeCats = CATEGORIES.filter((c) => totals[c] > 0);

  if (activeCats.length === 0) {
    const li = document.createElement('li');
    li.style.fontSize = '13px';
    li.style.color = 'var(--ink-soft)';
    li.style.fontStyle = 'italic';
    li.textContent = 'Nothing spent this month yet.';
    categoryListEl.appendChild(li);
  } else {
    activeCats
      .sort((a, b) => totals[b] - totals[a])
      .forEach((cat) => {
        const pct = totalExpense > 0 ? Math.round((totals[cat] / totalExpense) * 100) : 0;
        const li = document.createElement('li');
        li.className = 'breakdown__row';
        li.innerHTML = `
          <span class="category-badge cat-${cat}">${cat}</span>
          <span class="breakdown__bar-track">
            <span class="breakdown__bar-fill" style="width:${pct}%; background:${CATEGORY_COLORS[cat]}"></span>
          </span>
          <span class="breakdown__amount">${formatRupees(totals[cat])}</span>
        `;
        categoryListEl.appendChild(li);
      });
  }

  renderChart(totals);
}

function renderChart(totals) {
  const labels = CATEGORIES.filter((c) => totals[c] > 0);
  const data = labels.map((c) => totals[c]);

  if (labels.length === 0) {
    chartCanvas.hidden = true;
    chartEmpty.hidden = false;
    if (categoryChart) {
      categoryChart.destroy();
      categoryChart = null;
    }
    return;
  }

  chartCanvas.hidden = false;
  chartEmpty.hidden = true;

  const config = {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map((c) => CATEGORY_COLORS[c]),
        borderColor: '#f6f5ec',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${formatRupees(ctx.parsed)}`,
          },
        },
      },
      cutout: '62%',
    },
  };

  if (categoryChart) {
    categoryChart.data = config.data;
    categoryChart.update();
  } else {
    categoryChart = new Chart(chartCanvas, config);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ---------- event handlers ---------- */

toggleButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedType = btn.dataset.type;
    toggleButtons.forEach((b) => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-checked', String(active));
    });
    categoryField.style.display = selectedType === 'income' ? 'none' : '';
  });
});

entryForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const amount = Number(amountInput.value);
  if (!amount || amount <= 0) {
    amountInput.focus();
    return;
  }
  const date = dateInput.value || todayISO();

  const entry = {
    id: uid(),
    type: selectedType,
    amount,
    category: selectedType === 'income' ? 'Income' : categoryInput.value,
    note: noteInput.value.trim(),
    date,
  };

  transactions.push(entry);
  saveTransactions(transactions);

  // Jump the statement month to match the new entry so it's visible immediately.
  monthSelect.value = monthKeyOf(date);

  amountInput.value = '';
  noteInput.value = '';
  dateInput.value = todayISO();
  amountInput.focus();

  render();
});

ledgerBody.addEventListener('click', (e) => {
  const btn = e.target.closest('.ledger__delete');
  if (!btn) return;
  const id = btn.dataset.id;
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions(transactions);
  render();
});

monthSelect.addEventListener('change', render);
filterCategory.addEventListener('change', render);

budgetInput.addEventListener('input', () => {
  const monthKey = monthSelect.value;
  const value = Number(budgetInput.value) || 0;
  budgets[monthKey] = value;
  saveBudgets(budgets);
  render();
});

/* ---------- init ---------- */

(function init() {
  const today = todayISO();
  monthSelect.value = monthKeyOf(today);
  dateInput.value = today;
  categoryField.style.display = selectedType === 'income' ? 'none' : '';
  render();
})();


/* ===========================================================
   Shared Ledgers — Splitwise-style group expense splitting
   Same page, same storage pattern, separate dataset.
   =========================================================== */

const GROUP_KEYS = {
  groups: 'spendwise:groups',
  expenses: 'spendwise:groupExpenses',
};

function loadGroups() {
  try {
    const raw = localStorage.getItem(GROUP_KEYS.groups);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Could not read groups', err);
    return [];
  }
}
function saveGroups(list) {
  try { localStorage.setItem(GROUP_KEYS.groups, JSON.stringify(list)); }
  catch (err) { console.error('Could not save groups', err); }
}
function loadGroupExpenses() {
  try {
    const raw = localStorage.getItem(GROUP_KEYS.expenses);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Could not read group expenses', err);
    return [];
  }
}
function saveGroupExpenses(list) {
  try { localStorage.setItem(GROUP_KEYS.expenses, JSON.stringify(list)); }
  catch (err) { console.error('Could not save group expenses', err); }
}

let groups = loadGroups();
let groupExpenses = loadGroupExpenses();
let activeGroupId = null;
let activeSplitType = 'equal';

const MEMBER_COLORS = ['#1f6f5c', '#2f5a8a', '#a9760f', '#5b4b8a', '#9c3b2e', '#6b7280', '#0e7490', '#7c3aed'];

function colorForMember(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return MEMBER_COLORS[hash % MEMBER_COLORS.length];
}

/* ---------- DOM refs ---------- */

const viewTabs = document.querySelectorAll('.view-tab');
const personalView = document.getElementById('personal-view');
const groupsView = document.getElementById('groups-view');

const groupSelect = document.getElementById('group-select');
const newGroupBtn = document.getElementById('new-group-btn');
const newGroupForm = document.getElementById('new-group-form');
const newGroupNameInput = document.getElementById('new-group-name');
const newGroupMembersInput = document.getElementById('new-group-members');
const createGroupBtn = document.getElementById('create-group-btn');

const groupDetail = document.getElementById('group-detail');
const noGroupsEmpty = document.getElementById('no-groups-empty');
const memberChipsEl = document.getElementById('member-chips');
const perspectiveSelect = document.getElementById('perspective-select');

const geForm = document.getElementById('group-expense-form');
const geAmount = document.getElementById('ge-amount');
const gePaidBy = document.getElementById('ge-paid-by');
const geDate = document.getElementById('ge-date');
const geDescription = document.getElementById('ge-description');
const splitTypeButtons = document.querySelectorAll('.split-type .entry__toggle-btn');
const splitMembersEl = document.getElementById('split-members');
const splitHintEl = document.getElementById('split-hint');

const groupLedgerBody = document.getElementById('group-ledger-body');
const groupLedgerEmpty = document.getElementById('group-ledger-empty');

const balanceListEl = document.getElementById('balance-list');
const settleListEl = document.getElementById('settle-list');
const settleEmptyEl = document.getElementById('settle-empty');

/* ---------- tab switching ---------- */

viewTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    viewTabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    });
    personalView.hidden = view !== 'personal';
    groupsView.hidden = view !== 'groups';
    if (view === 'groups') renderGroupsView();
  });
});

/* ---------- creating a group ---------- */

newGroupBtn.addEventListener('click', () => {
  newGroupForm.hidden = !newGroupForm.hidden;
  if (!newGroupForm.hidden) newGroupNameInput.focus();
});

createGroupBtn.addEventListener('click', () => {
  const name = newGroupNameInput.value.trim();
  const membersRaw = newGroupMembersInput.value.trim();

  if (!name) { newGroupNameInput.focus(); return; }

  const members = [...new Set(membersRaw.split(',').map((m) => m.trim()).filter(Boolean))];
  if (members.length < 2) { newGroupMembersInput.focus(); return; }

  const group = {
    id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    members,
  };
  groups.push(group);
  saveGroups(groups);

  activeGroupId = group.id;
  newGroupNameInput.value = '';
  newGroupMembersInput.value = '';
  newGroupForm.hidden = true;

  renderGroupsView();
});

groupSelect.addEventListener('change', () => {
  activeGroupId = groupSelect.value || null;
  renderGroupDetail();
});

/* ---------- split type toggle ---------- */

splitTypeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    activeSplitType = btn.dataset.split;
    splitTypeButtons.forEach((b) => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-checked', String(active));
    });
    renderSplitInputs();
  });
});

geAmount.addEventListener('input', renderSplitInputs);

function currentGroup() {
  return groups.find((g) => g.id === activeGroupId) || null;
}

function renderSplitInputs() {
  const group = currentGroup();
  if (!group) return;
  const amount = Number(geAmount.value) || 0;

  splitMembersEl.innerHTML = '';

  group.members.forEach((member) => {
    const row = document.createElement('div');
    row.className = 'split-row';

    if (activeSplitType === 'equal') {
      row.innerHTML = `
        <label class="split-row__check">
          <input type="checkbox" data-member="${escapeHtml(member)}" checked />
          <span>${escapeHtml(member)}</span>
        </label>
        <span class="split-row__value" data-equal-value></span>
      `;
    } else if (activeSplitType === 'exact') {
      row.innerHTML = `
        <label class="split-row__check">
          <span>${escapeHtml(member)}</span>
        </label>
        <input type="number" class="split-row__input" data-member="${escapeHtml(member)}" min="0" step="1" placeholder="0" />
      `;
    } else {
      row.innerHTML = `
        <label class="split-row__check">
          <span>${escapeHtml(member)}</span>
        </label>
        <input type="number" class="split-row__input" data-member="${escapeHtml(member)}" min="0" max="100" step="1" placeholder="0" />
        <span class="split-row__pct">%</span>
      `;
    }
    splitMembersEl.appendChild(row);
  });

  splitMembersEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => refreshEqualShares(amount));
  });
  splitMembersEl.querySelectorAll('.split-row__input').forEach((input) => {
    input.addEventListener('input', () => updateSplitHint(Number(geAmount.value) || 0));
  });

  refreshEqualShares(amount);
  updateSplitHint(amount);
}

function refreshEqualShares(amount) {
  if (activeSplitType !== 'equal') return;
  const checked = [...splitMembersEl.querySelectorAll('input[type="checkbox"]:checked')];
  const share = checked.length ? amount / checked.length : 0;
  splitMembersEl.querySelectorAll('.split-row').forEach((row) => {
    const cb = row.querySelector('input[type="checkbox"]');
    const valueEl = row.querySelector('[data-equal-value]');
    if (!valueEl) return;
    valueEl.textContent = cb.checked ? formatRupees(share) : '—';
  });
  updateSplitHint(amount);
}

function updateSplitHint(amount) {
  if (activeSplitType === 'equal') {
    const checked = splitMembersEl.querySelectorAll('input[type="checkbox"]:checked').length;
    splitHintEl.textContent = checked > 0
      ? `Split equally among ${checked} member${checked > 1 ? 's' : ''}: ${formatRupees(checked ? amount / checked : 0)} each.`
      : 'Select at least one member.';
  } else if (activeSplitType === 'exact') {
    const values = [...splitMembersEl.querySelectorAll('.split-row__input')].map((i) => Number(i.value) || 0);
    const sum = values.reduce((s, v) => s + v, 0);
    const diff = amount - sum;
    splitHintEl.textContent = Math.abs(diff) < 0.5
      ? 'Amounts add up correctly.'
      : `${formatRupees(Math.abs(diff))} ${diff > 0 ? 'unassigned' : 'over the total'} — adjust before adding.`;
  } else {
    const values = [...splitMembersEl.querySelectorAll('.split-row__input')].map((i) => Number(i.value) || 0);
    const sum = values.reduce((s, v) => s + v, 0);
    splitHintEl.textContent = Math.abs(sum - 100) < 0.5
      ? 'Percentages add up to 100%.'
      : `Percentages add up to ${sum}% — should be 100%.`;
  }
}

/* ---------- adding a shared expense ---------- */

geForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const group = currentGroup();
  if (!group) return;

  const amount = Number(geAmount.value);
  if (!amount || amount <= 0) { geAmount.focus(); return; }

  const paidBy = gePaidBy.value;
  const date = geDate.value || todayISO();
  const description = geDescription.value.trim();

  const shares = {};

  if (activeSplitType === 'equal') {
    const checked = [...splitMembersEl.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.dataset.member);
    if (checked.length === 0) return;
    const share = amount / checked.length;
    checked.forEach((m) => { shares[m] = share; });
  } else if (activeSplitType === 'exact') {
    const inputs = [...splitMembersEl.querySelectorAll('.split-row__input')];
    const sum = inputs.reduce((s, i) => s + (Number(i.value) || 0), 0);
    if (Math.abs(sum - amount) > 0.5) return; // hint already flags the mismatch
    inputs.forEach((i) => {
      const v = Number(i.value) || 0;
      if (v > 0) shares[i.dataset.member] = v;
    });
  } else {
    const inputs = [...splitMembersEl.querySelectorAll('.split-row__input')];
    const sum = inputs.reduce((s, i) => s + (Number(i.value) || 0), 0);
    if (Math.abs(sum - 100) > 0.5) return;
    inputs.forEach((i) => {
      const pct = Number(i.value) || 0;
      if (pct > 0) shares[i.dataset.member] = (pct / 100) * amount;
    });
  }

  groupExpenses.push({
    id: 'ge' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    groupId: group.id,
    description,
    amount,
    paidBy,
    date,
    splitType: activeSplitType,
    shares,
  });
  saveGroupExpenses(groupExpenses);

  geAmount.value = '';
  geDescription.value = '';
  geDate.value = todayISO();
  activeSplitType = 'equal';
  splitTypeButtons.forEach((b) => {
    const active = b.dataset.split === 'equal';
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-checked', String(active));
  });

  renderGroupDetail();
});

groupLedgerBody.addEventListener('click', (e) => {
  const btn = e.target.closest('.ledger__delete');
  if (!btn) return;
  groupExpenses = groupExpenses.filter((ex) => ex.id !== btn.dataset.id);
  saveGroupExpenses(groupExpenses);
  renderGroupDetail();
});

perspectiveSelect.addEventListener('change', renderGroupDetail);

/* ---------- rendering ---------- */

function renderGroupsView() {
  groupSelect.innerHTML = '<option value="">Select a group…</option>' +
    groups.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

  if (activeGroupId && groups.some((g) => g.id === activeGroupId)) {
    groupSelect.value = activeGroupId;
  } else {
    activeGroupId = null;
  }

  noGroupsEmpty.hidden = groups.length > 0;
  groupDetail.hidden = !activeGroupId;
  if (activeGroupId) renderGroupDetail();
}

function renderGroupDetail() {
  const group = currentGroup();
  if (!group) { groupDetail.hidden = true; return; }
  groupDetail.hidden = false;

  memberChipsEl.innerHTML = group.members.map((m) =>
    `<li class="chip" style="--chip-color:${colorForMember(m)}">${escapeHtml(m)}</li>`
  ).join('');

  const prevPerspective = perspectiveSelect.value;
  perspectiveSelect.innerHTML = group.members.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  perspectiveSelect.value = group.members.includes(prevPerspective) ? prevPerspective : group.members[0];
  const youAre = perspectiveSelect.value;

  gePaidBy.innerHTML = group.members.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  if (!geDate.value) geDate.value = todayISO();

  renderSplitInputs();

  const expenses = groupExpenses
    .filter((ex) => ex.groupId === group.id)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));

  renderGroupLedger(expenses, youAre);
  renderBalances(group, expenses, youAre);
}

function renderGroupLedger(expenses, youAre) {
  groupLedgerBody.innerHTML = '';
  if (expenses.length === 0) {
    groupLedgerEmpty.hidden = false;
    return;
  }
  groupLedgerEmpty.hidden = true;

  expenses.forEach((ex) => {
    const yourShare = ex.shares[youAre] || 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="ledger__date">${formatDate(ex.date)}</td>
      <td>${escapeHtml(ex.description) || '<span style="color:var(--ink-faint)">—</span>'}</td>
      <td><span class="category-badge" style="color:${colorForMember(ex.paidBy)}">${escapeHtml(ex.paidBy)}</span></td>
      <td class="num">${formatRupees(ex.amount)}</td>
      <td class="num">${yourShare > 0 ? formatRupees(yourShare) : '—'}</td>
      <td><button class="ledger__delete" aria-label="Delete expense" data-id="${ex.id}">&times;</button></td>
    `;
    groupLedgerBody.appendChild(tr);
  });
}

// Net balance per member: what they paid, minus what they owe across every
// expense in the group. Positive = the group owes them; negative = they owe.
function computeBalances(group, expenses) {
  const balances = {};
  group.members.forEach((m) => { balances[m] = 0; });

  expenses.forEach((ex) => {
    if (balances[ex.paidBy] === undefined) balances[ex.paidBy] = 0;
    balances[ex.paidBy] += ex.amount;
    Object.entries(ex.shares).forEach(([member, share]) => {
      if (balances[member] === undefined) balances[member] = 0;
      balances[member] -= share;
    });
  });

  return balances;
}

// Debt simplification: instead of settling every pairwise IOU, match the
// biggest creditor with the biggest debtor repeatedly, so the group needs
// the fewest possible payments to reach zero. Same idea Splitwise uses.
function simplifyDebts(balances) {
  const creditors = [];
  const debtors = [];
  Object.entries(balances).forEach(([name, amt]) => {
    if (amt > 0.5) creditors.push({ name, amt });
    else if (amt < -0.5) debtors.push({ name, amt: -amt });
  });
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transactions = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    transactions.push({ from: debtors[i].name, to: creditors[j].name, amount: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.5) i++;
    if (creditors[j].amt < 0.5) j++;
  }
  return transactions;
}

function renderBalances(group, expenses, youAre) {
  const balances = computeBalances(group, expenses);

  balanceListEl.innerHTML = group.members.map((m) => {
    const amt = balances[m] || 0;
    const cls = amt > 0.5 ? 'summary__value--credit' : amt < -0.5 ? 'summary__value--debit' : '';
    const label = amt > 0.5 ? 'gets back' : amt < -0.5 ? 'owes' : 'settled up';
    return `
      <li class="balance-row">
        <span class="chip" style="--chip-color:${colorForMember(m)}">${escapeHtml(m)}${m === youAre ? ' (you)' : ''}</span>
        <span class="balance-row__label">${label}</span>
        <span class="balance-row__amount ${cls}">${formatRupees(Math.abs(amt))}</span>
      </li>
    `;
  }).join('');

  const settlements = simplifyDebts(balances);
  if (settlements.length === 0) {
    settleListEl.innerHTML = '';
    settleEmptyEl.hidden = false;
  } else {
    settleEmptyEl.hidden = true;
    settleListEl.innerHTML = settlements.map((t) => `
      <li class="settle-row">
        <span class="chip" style="--chip-color:${colorForMember(t.from)}">${escapeHtml(t.from)}</span>
        <span class="settle-row__arrow">pays</span>
        <span class="chip" style="--chip-color:${colorForMember(t.to)}">${escapeHtml(t.to)}</span>
        <span class="settle-row__amount">${formatRupees(t.amount)}</span>
      </li>
    `).join('');
  }
}

/* ---------- init (groups) ---------- */

(function initGroups() {
  geDate.value = todayISO();
  renderGroupsView();
})();

