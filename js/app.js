const STORAGE_KEY = 'osobne-financije';

const CATEGORIES = {
  income: ['Plaća', 'Freelance', 'Investicije', 'Poklon', 'Ostalo'],
  expense: ['Namirnice', 'Stanovanje', 'Režije', 'Transport', 'Zdravlje', 'Zabava', 'Odjeća', 'Obrazovanje', 'Ostalo'],
};

const MONTHS = [
  'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac',
];

const DAYS = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

let state = {
  period: 'day',
  currentDate: new Date(),
  transactions: [],
};

function loadTransactions() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    state.transactions = data ? JSON.parse(data) : [];
  } catch {
    state.transactions = [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function parseAmount(value) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  return parseFloat(normalized);
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isSameYear(a, b) {
  return a.getFullYear() === b.getFullYear();
}

function filterTransactions() {
  const ref = state.currentDate;
  return state.transactions.filter((t) => {
    const date = parseDate(t.date);
    if (state.period === 'day') return isSameDay(date, ref);
    if (state.period === 'month') return isSameMonth(date, ref);
    return isSameYear(date, ref);
  });
}

function getPeriodLabel() {
  const d = state.currentDate;
  if (state.period === 'day') {
    const dayName = DAYS[d.getDay()];
    return `${dayName}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
  }
  if (state.period === 'month') {
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
  }
  return `${d.getFullYear()}.`;
}

function navigatePeriod(direction) {
  const d = new Date(state.currentDate);
  if (state.period === 'day') {
    d.setDate(d.getDate() + direction);
  } else if (state.period === 'month') {
    d.setMonth(d.getMonth() + direction);
  } else {
    d.setFullYear(d.getFullYear() + direction);
  }
  state.currentDate = d;
  render();
}

function updateCategories(type) {
  const select = document.getElementById('category');
  select.innerHTML = CATEGORIES[type]
    .map((cat) => `<option value="${cat}">${cat}</option>`)
    .join('');
}

function addTransaction(e) {
  e.preventDefault();

  const amountInput = document.getElementById('amount');
  const amount = parseAmount(amountInput.value);

  if (!Number.isFinite(amount) || amount <= 0) {
    amountInput.setCustomValidity('Unesite valjan iznos veći od 0.');
    amountInput.reportValidity();
    return;
  }

  amountInput.setCustomValidity('');

  const transaction = {
    id: crypto.randomUUID(),
    type: document.getElementById('type').value,
    amount,
    category: document.getElementById('category').value,
    date: document.getElementById('date').value,
    description: document.getElementById('description').value.trim(),
  };

  state.transactions.push(transaction);
  saveTransactions();

  document.getElementById('transactionForm').reset();
  document.getElementById('date').value = formatDateISO(state.currentDate);
  updateCategories(document.getElementById('type').value);

  render();
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter((t) => t.id !== id);
  saveTransactions();
  render();
}

function renderSummary(filtered) {
  const income = filtered
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = filtered
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  document.getElementById('totalIncome').textContent = formatCurrency(income);
  document.getElementById('totalExpense').textContent = formatCurrency(expense);
  document.getElementById('totalBalance').textContent = formatCurrency(income - expense);
}

function renderChart(filtered) {
  const container = document.getElementById('categoryChart');
  const expenses = filtered.filter((t) => t.type === 'expense');

  if (expenses.length === 0) {
    container.innerHTML = '<p class="chart-empty">Nema rashoda za prikaz.</p>';
    return;
  }

  const byCategory = {};
  expenses.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const max = Math.max(...Object.values(byCategory));

  container.innerHTML = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => {
      const pct = max > 0 ? (amount / max) * 100 : 0;
      return `
        <div class="chart-bar-row">
          <span class="chart-bar-label">${cat}</span>
          <div class="chart-bar-track">
            <div class="chart-bar-fill expense" style="width: ${pct}%"></div>
          </div>
          <span class="chart-bar-amount">${formatCurrency(amount)}</span>
        </div>
      `;
    })
    .join('');
}

function renderTransactions(filtered) {
  const list = document.getElementById('transactionList');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('transactionCount');

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  count.textContent = sorted.length;

  if (sorted.length === 0) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  list.classList.remove('hidden');
  empty.classList.add('hidden');

  list.innerHTML = sorted.map((t) => {
    const date = parseDate(t.date);
    const dateStr = state.period === 'day'
      ? ''
      : `<span class="transaction-date">${date.getDate()}. ${MONTHS[date.getMonth()]}</span>`;

    const sign = t.type === 'income' ? '+' : '-';

    return `
      <li class="transaction-item">
        <div class="transaction-info">
          <div class="transaction-category">${t.category}</div>
          ${t.description ? `<div class="transaction-desc">${t.description}</div>` : ''}
          ${dateStr}
        </div>
        <div class="transaction-right">
          <span class="transaction-amount ${t.type}">${sign}${formatCurrency(t.amount)}</span>
          <button class="btn-delete" data-id="${t.id}" aria-label="Obriši">×</button>
        </div>
      </li>
    `;
  }).join('');

  list.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });
}

function render() {
  document.getElementById('periodLabel').textContent = getPeriodLabel();

  const filtered = filterTransactions();
  renderSummary(filtered);
  renderChart(filtered);
  renderTransactions(filtered);
}

function init() {
  loadTransactions();

  document.getElementById('date').value = formatDateISO(new Date());
  updateCategories('expense');

  document.querySelectorAll('.period-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      state.period = btn.dataset.period;
      render();
    });
  });

  document.getElementById('prevBtn').addEventListener('click', () => navigatePeriod(-1));
  document.getElementById('nextBtn').addEventListener('click', () => navigatePeriod(1));

  document.getElementById('type').addEventListener('change', (e) => {
    updateCategories(e.target.value);
  });

  document.getElementById('transactionForm').addEventListener('submit', addTransaction);

  document.getElementById('amount').addEventListener('input', (e) => {
    e.target.setCustomValidity('');
  });

  render();
}

init();
