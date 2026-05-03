// Configuração
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxNRw4UzB6uV8WE_80VrISmarpiUbNE8mqvv2AMv10wU--azvMmkhqRqlofLm6XRLfH/exec';
const SHEETS_LINK = 'https://docs.google.com/spreadsheets/d/1DdiyEwLlik9OvBA36xP9NYaTG_kTiDpQyDnXthCYqew/edit?usp=sharing';

// Estado
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let cards = JSON.parse(localStorage.getItem('cards')) || [];
let budgets = JSON.parse(localStorage.getItem('budgets')) || [];
let charts = {};

let settings = JSON.parse(localStorage.getItem('financeSettings')) || {
    types: [
        { id: 1, name: 'Entrada', icon: 'arrow-up', color: '#4CAF50', flow: 'entrada' },
        { id: 2, name: 'Saída', icon: 'arrow-down', color: '#F44336', flow: 'saida' }
    ],
    categories: [
        { id: 1, name: 'Salário', type: 'entrada', icon: 'money-bill-wave', color: '#4CAF50', budget: 0 },
        { id: 2, name: 'Freelance', type: 'entrada', icon: 'laptop-code', color: '#2196F3', budget: 0 },
        { id: 3, name: 'Alimentação', type: 'saida', icon: 'utensils', color: '#FF6384', budget: 800 },
        { id: 4, name: 'Transporte', type: 'saida', icon: 'car', color: '#FF9F40', budget: 500 },
        { id: 5, name: 'Moradia', type: 'saida', icon: 'home', color: '#36A2EB', budget: 1500 },
        { id: 6, name: 'Lazer', type: 'saida', icon: 'gamepad', color: '#FFCE56', budget: 600 },
        { id: 7, name: 'Saúde', type: 'saida', icon: 'heartbeat', color: '#F44336', budget: 400 },
        { id: 8, name: 'Educação', type: 'saida', icon: 'book', color: '#4BC0C0', budget: 300 },
        { id: 9, name: 'Outros', type: 'ambos', icon: 'ellipsis-h', color: '#9966FF', budget: 200 }
    ],
    currency: 'BRL',
    theme: 'dark'
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    updateDashboard();
    initializeCharts();
    applyTheme(settings.theme || 'dark');
    autoSyncAll();
});

function initializeApp() {
    document.getElementById('sheetsLink').href = SHEETS_LINK;
    document.getElementById('monthFilter').value = new Date().toISOString().slice(0, 7);
    updateCardSelect();
    updateTransactionTypeSelect();
    updateCategorySelects();
}

function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });
    
    document.getElementById('monthFilter').addEventListener('change', updateDashboard);
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
    document.getElementById('typeForm').addEventListener('submit', handleTypeSubmit);
    document.getElementById('categoryForm').addEventListener('submit', handleCategorySubmit);
    document.getElementById('cardSettingsForm').addEventListener('submit', handleCardSettingsSubmit);
    
    const searchInput = document.querySelector('.search-input');
    const filterSelect = document.querySelector('.filter-select');
    if (searchInput) searchInput.addEventListener('input', filterTransactions);
    if (filterSelect) filterSelect.addEventListener('change', filterTransactions);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllModals();
        if (e.ctrlKey && e.key === 'n') { e.preventDefault(); openAddModal(); }
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); fullSync(); }
    });
}

function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === `${page}-page`);
    });
    
    setTimeout(() => {
        switch(page) {
            case 'dashboard': updateDashboard(); initializeCharts(); break;
            case 'transactions': renderTransactions(); break;
            case 'cards': renderCards(); break;
            case 'analytics': updateAnalytics(); break;
            case 'budget': renderBudgets(); break;
            case 'settings':
                renderTypes();
                renderCategories();
                renderCardsSettings();
                document.getElementById('currencySetting').value = settings.currency || 'BRL';
                document.getElementById('themeSetting').value = settings.theme || 'dark';
                break;
        }
    }, 100);
}

// Dashboard
function updateDashboard() {
    const selectedMonth = document.getElementById('monthFilter').value;
    const monthTransactions = transactions.filter(t => t.date && t.date.startsWith(selectedMonth));
    
    const income = monthTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value), 0);
    const expense = monthTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value), 0);
    const balance = income - expense;
    const savingsRate = income > 0 ? ((balance / income) * 100) : 0;
    
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpense').textContent = formatCurrency(expense);
    document.getElementById('totalBalance').textContent = formatCurrency(balance);
    document.getElementById('savingsRate').textContent = `${savingsRate.toFixed(1)}%`;
    
    document.getElementById('balanceTrend').textContent = balance >= 0 ? 'Saldo positivo' : 'Saldo negativo';
    document.getElementById('balanceTrend').className = `card-trend ${balance >= 0 ? 'positive' : 'negative'}`;
    
    updateCharts(monthTransactions);
}

function updateCharts(monthTransactions) {
    const selectedMonth = document.getElementById('monthFilter').value;
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const dailyData = Array.from({length: daysInMonth}, (_, i) => {
        const dayStr = `${selectedMonth}-${String(i + 1).padStart(2, '0')}`;
        const dayTransactions = monthTransactions.filter(t => t.date === dayStr);
        return {
            income: dayTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value), 0),
            expense: dayTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value), 0)
        };
    });
    
    updateChart('cashflowChart', {
        labels: Array.from({length: daysInMonth}, (_, i) => `Dia ${i + 1}`),
        datasets: [
            { label: 'Entradas', data: dailyData.map(d => d.income), borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)', fill: true, tension: 0.4, borderWidth: 2 },
            { label: 'Saídas', data: dailyData.map(d => d.expense), borderColor: '#F44336', backgroundColor: 'rgba(244, 67, 54, 0.1)', fill: true, tension: 0.4, borderWidth: 2 }
        ]
    });
    
    const categories = {};
    monthTransactions.filter(t => t.type === 'saida').forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + parseFloat(t.value);
    });
    
    if (Object.keys(categories).length > 0) {
        updateChart('categoryChart', {
            labels: Object.keys(categories),
            datasets: [{ data: Object.values(categories), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'], borderWidth: 2, borderColor: '#16213e' }]
        }, 'doughnut');
    }
    
    const cardSpending = {};
    monthTransactions.filter(t => t.type === 'saida' && t.card).forEach(t => {
        cardSpending[t.card] = (cardSpending[t.card] || 0) + parseFloat(t.value);
    });
    
    if (Object.keys(cardSpending).length > 0) {
        updateChart('cardChart', {
            labels: Object.keys(cardSpending),
            datasets: [{ data: Object.values(cardSpending), backgroundColor: ['#667eea', '#f093fb', '#4facfe', '#43e97b'], borderWidth: 2, borderColor: '#16213e' }]
        }, 'pie');
    }
}

// Charts
function initializeCharts() {
    Chart.defaults.color = '#b3b3b3';
    ['cashflowChart', 'categoryChart', 'cardChart'].forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas && !charts[id]) {
            charts[id] = new Chart(canvas.getContext('2d'), {
                type: id === 'cashflowChart' ? 'line' : id === 'categoryChart' ? 'doughnut' : 'pie',
                data: { labels: [], datasets: [] },
                options: getChartOptions()
            });
        }
    });
}

function updateChart(chartId, data, type = 'line') {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;
    if (charts[chartId]) charts[chartId].destroy();
    charts[chartId] = new Chart(canvas.getContext('2d'), { type, data, options: getChartOptions() });
}

function getChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#b3b3b3', padding: 15, font: { size: 12 }, usePointStyle: true } }
        },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(42, 42, 74, 0.5)' }, ticks: { color: '#b3b3b3' } },
            x: { grid: { display: false }, ticks: { color: '#b3b3b3' } }
        }
    };
}

// Transactions
function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const type = document.getElementById('transType').value;
    const valueInput = document.getElementById('transValue').value;
    const category = document.getElementById('transCategory').value;
    const description = document.getElementById('transDescription').value;
    const date = document.getElementById('transDate').value;
    const card = document.getElementById('transCard').value;
    const installments = parseInt(document.getElementById('transInstallments')?.value) || 1;
    
    if (!valueInput || parseFloat(valueInput) <= 0) { showNotification('Valor inválido!', 'error'); return; }
    if (!category) { showNotification('Selecione uma categoria!', 'error'); return; }
    if (!description.trim()) { showNotification('Insira uma descrição!', 'error'); return; }
    if (!date) { showNotification('Selecione uma data!', 'error'); return; }
    
    const baseTransaction = { type, value: parseFloat(valueInput), category, description: description.trim(), date, card };
    
    if (card && installments > 1) {
        const installmentTransactions = createInstallmentTransactions(baseTransaction, installments);
        transactions.unshift(...installmentTransactions);
        showNotification(`${installments} parcelas criadas!`, 'success');
    } else {
        baseTransaction.id = Date.now();
        transactions.unshift(baseTransaction);
        showNotification('Transação adicionada!', 'success');
    }
    
    saveTransactions();
    closeModal();
    updateDashboard();
    renderTransactions();
    sendToSheets();
}

function createInstallmentTransactions(base, installments) {
    const result = [];
    const perInstallment = base.value / installments;
    const [year, month, day] = base.date.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);
    
    for (let i = 0; i < installments; i++) {
        const d = new Date(startDate);
        d.setMonth(startDate.getMonth() + i);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(day, lastDay));
        
        result.push({
            id: Date.now() + i,
            type: base.type,
            value: perInstallment,
            category: base.category,
            description: `${base.description} (${i + 1}/${installments})`,
            date: d.toISOString().split('T')[0],
            card: base.card
        });
    }
    return result;
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;
    
    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;"><p style="color:#b3b3b3;">Nenhuma transação</p></td></tr>`;
        return;
    }
    
    tbody.innerHTML = transactions.map(t => `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td><span class="transaction-type ${t.type}">${t.type === 'entrada' ? 'Entrada' : 'Saída'}</span></td>
            <td><span class="category-badge"><i class="fas fa-${getCategoryIcon(t.category)}"></i> ${t.category}</span></td>
            <td>${t.description}</td>
            <td>${t.card ? `<span class="card-badge">💳 ${t.card}</span>` : '-'}</td>
            <td class="transaction-value ${t.type === 'entrada' ? 'positive' : 'negative'}">${t.type === 'entrada' ? '+' : '-'} ${formatCurrency(t.value)}</td>
            <td>
                <div class="action-buttons">
                    <button onclick="editTransaction(${t.id})" class="btn-icon"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteTransaction(${t.id})" class="btn-icon btn-delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function editTransaction(id) {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    openAddModal();
    document.getElementById('transType').value = t.type;
    document.getElementById('transValue').value = t.value;
    document.getElementById('transCategory').value = t.category;
    document.getElementById('transDescription').value = t.description;
    document.getElementById('transDate').value = t.date;
    document.getElementById('transCard').value = t.card;
    transactions = transactions.filter(x => x.id !== id);
    saveTransactions();
    sendToSheets();
}

function deleteTransaction(id) {
    if (confirm('Excluir esta transação?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions();
        updateDashboard();
        renderTransactions();
        sendToSheets();
        showNotification('Transação excluída!', 'success');
    }
}

function filterTransactions() {
    const search = document.querySelector('.search-input')?.value.toLowerCase() || '';
    const filter = document.querySelector('.filter-select')?.value.toLowerCase() || 'todas';
    let filtered = transactions;
    if (filter === 'entradas') filtered = filtered.filter(t => t.type === 'entrada');
    if (filter === 'saídas') filtered = filtered.filter(t => t.type === 'saida');
    if (search) filtered = filtered.filter(t => t.description.toLowerCase().includes(search) || t.category.toLowerCase().includes(search));
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const tbody = document.getElementById('transactionsBody');
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;"><p style="color:#b3b3b3;">Nenhum resultado</p></td></tr>`;
        return;
    }
    tbody.innerHTML = filtered.map(t => `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td><span class="transaction-type ${t.type}">${t.type === 'entrada' ? 'Entrada' : 'Saída'}</span></td>
            <td><span class="category-badge"><i class="fas fa-${getCategoryIcon(t.category)}"></i> ${t.category}</span></td>
            <td>${t.description}</td>
            <td>${t.card ? `<span class="card-badge">💳 ${t.card}</span>` : '-'}</td>
            <td class="transaction-value ${t.type === 'entrada' ? 'positive' : 'negative'}">${t.type === 'entrada' ? '+' : '-'} ${formatCurrency(t.value)}</td>
            <td>
                <button onclick="editTransaction(${t.id})" class="btn-icon"><i class="fas fa-edit"></i></button>
                <button onclick="deleteTransaction(${t.id})" class="btn-icon btn-delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// Cards
function renderCards() {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    if (cards.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;"><i class="fas fa-credit-card" style="font-size:64px;color:#6C63FF;margin-bottom:20px;display:block;"></i><h3 style="color:#b3b3b3;">Nenhum cartão</h3><button class="btn-add" onclick="openAddCardSettingsModal()"><i class="fas fa-plus"></i> Adicionar</button></div>`;
        return;
    }
    
    grid.innerHTML = cards.map(card => {
        const pct = card.limit > 0 ? (card.spent / card.limit) * 100 : 0;
        return `
            <div class="credit-card" style="background:linear-gradient(135deg, ${card.color} 0%, ${adjustColor(card.color, -30)} 100%);">
                <div class="card-chip"><i class="fas fa-sim-card"></i></div>
                <h3 class="card-name">${card.name}</h3>
                <p class="card-number">•••• •••• •••• ${Math.floor(Math.random()*9000)+1000}</p>
                <div class="card-info-grid">
                    <div class="card-info-item"><small>Limite</small><p>${formatCurrency(card.limit)}</p></div>
                    <div class="card-info-item"><small>Disponível</small><p>${formatCurrency(card.limit - card.spent)}</p></div>
                    <div class="card-info-item"><small>Gasto</small><p>${formatCurrency(card.spent)}</p></div>
                </div>
                <div class="card-progress"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:white;"></div></div><span class="progress-text">${pct.toFixed(1)}% utilizado</span></div>
                <div class="card-actions">
                    <button onclick="editCardSettings(${card.id})" class="btn-card-action"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteCardSettings(${card.id})" class="btn-card-action" style="margin-top:8px;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('') + `
        <div class="credit-card add-card" onclick="openAddCardSettingsModal()" style="background:linear-gradient(135deg,rgba(108,99,255,0.1),rgba(108,99,255,0.05));border:2px dashed #6C63FF;cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:200px;">
            <div style="text-align:center;"><i class="fas fa-plus-circle" style="font-size:48px;color:#6C63FF;margin-bottom:12px;"></i><p style="color:#6C63FF;font-weight:600;">Adicionar Cartão</p></div>
        </div>
    `;
}

function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0,2), 16) + amount);
    const g = Math.max(0, parseInt(hex.substr(2,2), 16) + amount);
    const b = Math.max(0, parseInt(hex.substr(4,2), 16) + amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function updateCardSelect() {
    const select = document.getElementById('transCard');
    if (!select) return;
    select.innerHTML = '<option value="">Nenhum (Débito/Dinheiro)</option>' + cards.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function updateCardSpending() {
    cards.forEach(card => {
        card.spent = transactions.filter(t => t.type === 'saida' && t.card === card.name).reduce((sum, t) => sum + parseFloat(t.value), 0);
    });
    saveCards();
}

// Settings Types
function renderTypes() {
    const list = document.getElementById('typesList');
    if (!list) return;
    list.innerHTML = settings.types.map(t => `
        <div class="settings-item">
            <div class="settings-item-info">
                <div class="settings-item-icon" style="background:${t.color}"><i class="fas fa-${t.icon}"></i></div>
                <div class="settings-item-details">
                    <span class="settings-item-name">${t.name}</span>
                    <span class="settings-item-meta"><span class="settings-item-badge badge-${t.flow}">${t.flow}</span></span>
                </div>
            </div>
            <div class="settings-item-actions">
                <button class="settings-btn-icon" onclick="editType(${t.id})"><i class="fas fa-edit"></i></button>
                <button class="settings-btn-icon btn-delete" onclick="deleteType(${t.id})"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
    updateTransactionTypeSelect();
}

function openAddTypeModal() {
    document.getElementById('typeModalTitle').textContent = 'Novo Tipo';
    document.getElementById('typeEditId').value = '';
    document.getElementById('typeForm').reset();
    document.getElementById('typeModal').classList.add('active');
}

function editType(id) {
    const t = settings.types.find(x => x.id === id);
    if (!t) return;
    document.getElementById('typeModalTitle').textContent = 'Editar Tipo';
    document.getElementById('typeEditId').value = t.id;
    document.getElementById('typeName').value = t.name;
    document.getElementById('typeIcon').value = t.icon;
    document.getElementById('typeColor').value = t.color;
    document.getElementById('typeFlow').value = t.flow;
    document.getElementById('typeModal').classList.add('active');
}

function closeTypeModal() { document.getElementById('typeModal').classList.remove('active'); }
function deleteType(id) {
    if (confirm('Excluir tipo?')) {
        settings.types = settings.types.filter(t => t.id !== id);
        saveSettings();
        renderTypes();
    }
}

function handleTypeSubmit(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('typeName').value.trim(),
        icon: document.getElementById('typeIcon').value.trim() || 'circle',
        color: document.getElementById('typeColor').value,
        flow: document.getElementById('typeFlow').value
    };
    if (!data.name) return;
    const editId = document.getElementById('typeEditId').value;
    if (editId) {
        const idx = settings.types.findIndex(t => t.id === parseInt(editId));
        if (idx !== -1) settings.types[idx] = { ...settings.types[idx], ...data };
    } else {
        settings.types.push({ id: Date.now(), ...data });
    }
    saveSettings();
    closeTypeModal();
    renderTypes();
}

function updateTransactionTypeSelect() {
    const select = document.getElementById('transType');
    if (!select) return;
    select.innerHTML = settings.types.filter(t => t.flow !== 'ambos').map(t => `<option value="${t.flow}">${t.name}</option>`).join('');
}

// Settings Categories
function renderCategories() {
    const list = document.getElementById('categoriesList');
    if (!list) return;
    const entrada = settings.categories.filter(c => c.type === 'entrada' || c.type === 'ambos');
    const saida = settings.categories.filter(c => c.type === 'saida' || c.type === 'ambos');
    list.innerHTML = `
        <h4 style="color:#4CAF50;margin-bottom:8px;"><i class="fas fa-arrow-up"></i> Entradas</h4>
        ${entrada.map(c => createCategoryItem(c)).join('')}
        <h4 style="color:#F44336;margin:16px 0 8px;"><i class="fas fa-arrow-down"></i> Saídas</h4>
        ${saida.map(c => createCategoryItem(c)).join('')}
    `;
    updateCategorySelects();
}

function createCategoryItem(c) {
    return `
        <div class="settings-item">
            <div class="settings-item-info">
                <div class="settings-item-icon" style="background:${c.color}"><i class="fas fa-${c.icon}"></i></div>
                <div class="settings-item-details">
                    <span class="settings-item-name">${c.name}</span>
                    <span class="settings-item-meta"><span class="settings-item-badge badge-${c.type}">${c.type}</span> ${c.budget > 0 ? 'Orçamento: ' + formatCurrency(c.budget) : ''}</span>
                </div>
            </div>
            <div class="settings-item-actions">
                <button class="settings-btn-icon" onclick="editCategory(${c.id})"><i class="fas fa-edit"></i></button>
                <button class="settings-btn-icon btn-delete" onclick="deleteCategory(${c.id})"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
}

function openAddCategoryModal() {
    document.getElementById('categoryModalTitle').textContent = 'Nova Categoria';
    document.getElementById('categoryEditId').value = '';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryModal').classList.add('active');
}

function editCategory(id) {
    const c = settings.categories.find(x => x.id === id);
    if (!c) return;
    document.getElementById('categoryModalTitle').textContent = 'Editar Categoria';
    document.getElementById('categoryEditId').value = c.id;
    document.getElementById('categoryName').value = c.name;
    document.getElementById('categoryType').value = c.type;
    document.getElementById('categoryIcon').value = c.icon;
    document.getElementById('categoryColor').value = c.color;
    document.getElementById('categoryBudget').value = c.budget || '';
    document.getElementById('categoryModal').classList.add('active');
}

function closeCategoryModal() { document.getElementById('categoryModal').classList.remove('active'); }

function deleteCategory(id) {
    if (confirm('Excluir categoria?')) {
        settings.categories = settings.categories.filter(c => c.id !== id);
        saveSettings();
        renderCategories();
    }
}

function handleCategorySubmit(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('categoryName').value.trim(),
        type: document.getElementById('categoryType').value,
        icon: document.getElementById('categoryIcon').value.trim() || 'tag',
        color: document.getElementById('categoryColor').value,
        budget: parseFloat(document.getElementById('categoryBudget').value) || 0
    };
    if (!data.name) return;
    const editId = document.getElementById('categoryEditId').value;
    if (editId) {
        const idx = settings.categories.findIndex(c => c.id === parseInt(editId));
        if (idx !== -1) settings.categories[idx] = { ...settings.categories[idx], ...data };
    } else {
        settings.categories.push({ id: Date.now(), ...data });
    }
    saveSettings();
    closeCategoryModal();
    renderCategories();
}

function updateCategorySelects() {
    const selects = [document.getElementById('transCategory'), document.getElementById('budgetCategory')];
    selects.forEach(select => {
        if (!select) return;
        const entrada = settings.categories.filter(c => c.type === 'entrada' || c.type === 'ambos');
        const saida = settings.categories.filter(c => c.type === 'saida' || c.type === 'ambos');
        select.innerHTML = `
            <option value="">Selecione...</option>
            <optgroup label="Entradas">${entrada.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</optgroup>
            <optgroup label="Saídas">${saida.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</optgroup>
        `;
    });
}

// Settings Cards
function renderCardsSettings() {
    const list = document.getElementById('cardsSettingsList');
    if (!list) return;
    if (cards.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-credit-card"></i><p>Nenhum cartão</p><button class="btn-add-small" onclick="openAddCardSettingsModal()"><i class="fas fa-plus"></i> Adicionar</button></div>`;
        return;
    }
    list.innerHTML = cards.map(card => {
        const pct = card.limit > 0 ? (card.spent / card.limit) * 100 : 0;
        return `
            <div class="settings-item">
                <div class="settings-item-info">
                    <div class="settings-item-icon" style="background:${card.color}"><i class="fas fa-credit-card"></i></div>
                    <div class="settings-item-details">
                        <span class="settings-item-name">${card.name}</span>
                        <span class="settings-item-meta">Limite: ${formatCurrency(card.limit)} | ${pct.toFixed(0)}% usado</span>
                    </div>
                </div>
                <div class="settings-item-actions">
                    <button class="settings-btn-icon" onclick="editCardSettings(${card.id})"><i class="fas fa-edit"></i></button>
                    <button class="settings-btn-icon btn-delete" onclick="deleteCardSettings(${card.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
    updateCardSelect();
}

function openAddCardSettingsModal() {
    document.getElementById('cardSettingsModalTitle').textContent = 'Novo Cartão';
    document.getElementById('cardSettingsEditId').value = '';
    document.getElementById('cardSettingsForm').reset();
    document.getElementById('cardSettingsModal').classList.add('active');
}

function editCardSettings(id) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    document.getElementById('cardSettingsModalTitle').textContent = 'Editar Cartão';
    document.getElementById('cardSettingsEditId').value = card.id;
    document.getElementById('cardSettingsName').value = card.name;
    document.getElementById('cardSettingsBrand').value = card.brand || card.name;
    document.getElementById('cardSettingsLimit').value = card.limit;
    document.getElementById('cardSettingsClosingDay').value = card.closingDay || '';
    document.getElementById('cardSettingsDueDay').value = card.dueDay || '';
    document.getElementById('cardSettingsColor').value = card.color;
    document.getElementById('cardSettingsModal').classList.add('active');
}

function closeCardSettingsModal() { document.getElementById('cardSettingsModal').classList.remove('active'); }

function deleteCardSettings(id) {
    if (confirm('Excluir cartão?')) {
        cards = cards.filter(c => c.id !== id);
        saveCards();
        renderCardsSettings();
        renderCards();
        sendCardsToSheets();
        showNotification('Cartão excluído!', 'success');
    }
}

function handleCardSettingsSubmit(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('cardSettingsName').value.trim(),
        brand: document.getElementById('cardSettingsBrand').value,
        limit: parseFloat(document.getElementById('cardSettingsLimit').value) || 0,
        closingDay: parseInt(document.getElementById('cardSettingsClosingDay').value) || null,
        dueDay: parseInt(document.getElementById('cardSettingsDueDay').value) || null,
        color: document.getElementById('cardSettingsColor').value,
        spent: 0
    };
    if (!data.name) { showNotification('Nome obrigatório!', 'error'); return; }
    
    const editId = document.getElementById('cardSettingsEditId').value;
    if (editId) {
        const idx = cards.findIndex(c => c.id === parseInt(editId));
        if (idx !== -1) { data.spent = cards[idx].spent; cards[idx] = { ...cards[idx], ...data }; }
    } else {
        cards.push({ id: Date.now(), ...data });
    }
    saveCards();
    closeCardSettingsModal();
    renderCardsSettings();
    renderCards();
    sendCardsToSheets();
    showNotification('Cartão salvo!', 'success');
}

// Sync Functions
async function syncWithSheets() {
    const btn = document.querySelector('.btn-sync');
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
    btn.disabled = true;
    
    try {
        console.log('📥 Baixando transações...');
        const resp = await fetch(`${GOOGLE_SHEETS_URL}?action=get`);
        const result = await resp.json();
        
        if (result.success && result.transactions && result.transactions.length > 0) {
            transactions = result.transactions
                .filter(t => (t.data || t.date) && (t.descrição || t.description))
                .map((t, i) => {
                    let dateValue = t.data || t.date || '';
                    if (dateValue.includes('T')) dateValue = dateValue.split('T')[0];
                    return {
                        id: Date.now() + i,
                        type: (t.tipo || t.type || 'saida').toLowerCase().trim(),
                        value: parseFloat(t.valor || t.value) || 0,
                        category: (t.categoria || t.category || 'Outros').trim(),
                        description: (t.descrição || t.description || '').trim(),
                        date: dateValue || new Date().toISOString().split('T')[0],
                        card: (t.cartão || t.card || '').trim()
                    };
                })
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            saveTransactions();
            updateDashboard();
            renderTransactions();
            updateCardSpending();
        }
        showNotification(`✅ ${transactions.length} transações carregadas!`, 'success');
    } catch (err) {
        console.error(err);
        showNotification('❌ Erro ao carregar', 'error');
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
}

async function sendToSheets() {
    try {
        const data = {
            action: 'sync',
            data: transactions.map(t => ({
                date: t.date || '',
                type: t.type || 'saida',
                category: t.category || 'Outros',
                description: t.description || '',
                value: parseFloat(t.value) || 0,
                card: t.card || ''
            }))
        };
        
        let success = false;
        try {
            const resp = await fetch(GOOGLE_SHEETS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (resp.ok) { const r = await resp.json(); success = r.success; }
        } catch(e) {}
        
        if (!success) {
            const param = encodeURIComponent(JSON.stringify(data.data));
            const resp = await fetch(`${GOOGLE_SHEETS_URL}?action=sync&data=${param}`);
            const r = await resp.json();
            success = r.success;
        }
        return success;
    } catch(e) { return false; }
}

async function syncCardsFromSheets() {
    try {
        console.log('📥 Baixando cartões...');
        const resp = await fetch(`${GOOGLE_SHEETS_URL}?action=getCards`);
        const result = await resp.json();
        
        if (result.success && result.cards && result.cards.length > 0) {
            cards = result.cards.map((c, i) => ({
                id: Date.now() + i,
                name: c.nome || c.name || '',
                brand: c.bandeira || c.brand || '',
                limit: parseFloat(c.limite || c.limit) || 0,
                spent: parseFloat(c.gasto || c.spent) || 0,
                closingDay: parseInt(c['dia fechamento'] || c.closingDay) || null,
                dueDay: parseInt(c['dia vencimento'] || c.dueDay) || null,
                color: c.cor || c.color || '#6C63FF'
            }));
            saveCards();
            renderCards();
            renderCardsSettings();
        }
        showNotification(`✅ ${cards.length} cartões carregados!`, 'success');
    } catch(e) {
        console.error(e);
        showNotification('❌ Erro ao carregar cartões', 'error');
    }
}

async function sendCardsToSheets() {
    try {
        const data = {
            action: 'syncCards',
            data: cards.map(c => ({
                name: c.name || '',
                brand: c.brand || '',
                limit: parseFloat(c.limit) || 0,
                spent: parseFloat(c.spent) || 0,
                closingDay: c.closingDay || '',
                dueDay: c.dueDay || '',
                color: c.color || '#6C63FF'
            }))
        };
        
        let success = false;
        try {
            const resp = await fetch(GOOGLE_SHEETS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (resp.ok) { const r = await resp.json(); success = r.success; }
        } catch(e) {}
        
        if (!success) {
            const param = encodeURIComponent(JSON.stringify(data.data));
            const resp = await fetch(`${GOOGLE_SHEETS_URL}?action=syncCards&data=${param}`);
            const r = await resp.json();
            success = r.success;
        }
        return success;
    } catch(e) { return false; }
}

async function fullSync() {
    const btns = document.querySelectorAll('.btn-sync');
    btns.forEach(b => { b.disabled = true; b.style.opacity = '0.7'; });
    
    try {
        await syncCardsFromSheets();
        await syncWithSheets();
        updateDashboard();
        renderTransactions();
        renderCards();
        showNotification('✅ Sincronização completa!', 'success');
    } catch(e) {
        showNotification('❌ Erro na sincronização', 'error');
    } finally {
        btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
    }
}

async function autoSyncAll() {
    try {
        await syncCardsFromSheets();
        const resp = await fetch(`${GOOGLE_SHEETS_URL}?action=get`);
        const result = await resp.json();
        
        if (result.success && result.transactions && result.transactions.length > 0) {
            transactions = result.transactions
                .filter(t => (t.data || t.date) && (t.descrição || t.description))
                .map((t, i) => {
                    let dateValue = t.data || t.date || '';
                    if (dateValue.includes('T')) dateValue = dateValue.split('T')[0];
                    return {
                        id: Date.now() + i,
                        type: (t.tipo || t.type || 'saida').toLowerCase().trim(),
                        value: parseFloat(t.valor || t.value) || 0,
                        category: (t.categoria || t.category || 'Outros').trim(),
                        description: (t.descrição || t.description || '').trim(),
                        date: dateValue || new Date().toISOString().split('T')[0],
                        card: (t.cartão || t.card || '').trim()
                    };
                })
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            saveTransactions();
            updateCardSpending();
        }
        updateDashboard();
        renderTransactions();
        renderCards();
        console.log('✅ Auto sync concluído');
    } catch(e) {
        console.log('ℹ️ Usando dados locais');
    }
}

// Installments
function toggleInstallments() {
    const card = document.getElementById('transCard').value;
    document.getElementById('installmentsGroup').style.display = card ? 'block' : 'none';
    if (!card) document.getElementById('transInstallments').value = '1';
    updateInstallmentPreview();
}

function updateInstallmentPreview() {
    const card = document.getElementById('transCard').value;
    const installments = parseInt(document.getElementById('transInstallments')?.value) || 1;
    const value = parseFloat(document.getElementById('transValue').value) || 0;
    const date = document.getElementById('transDate').value;
    const preview = document.getElementById('installmentPreview');
    const list = document.getElementById('installmentList');
    const perValue = document.getElementById('valuePerInstallment');
    
    if (!card || installments <= 1) {
        preview.style.display = 'none';
        if (perValue) perValue.style.display = 'none';
        return;
    }
    
    const per = value / installments;
    if (perValue && value > 0) {
        perValue.style.display = 'block';
        perValue.innerHTML = `Valor por parcela: <strong>${formatCurrency(per)}</strong>`;
    }
    
    if (!date || value <= 0) { preview.style.display = 'none'; return; }
    
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    let html = '';
    
    for (let i = 0; i < installments; i++) {
        const dt = new Date(start);
        dt.setMonth(start.getMonth() + i);
        const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
        dt.setDate(Math.min(d, lastDay));
        html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);"><span>📅 ${i+1}ª - ${dt.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</span><span style="color:#F44336;font-weight:600;">${formatCurrency(per)}</span></div>`;
    }
    
    list.innerHTML = html;
    preview.style.display = 'block';
}

// Budget
function openBudgetModal() {
    const html = `
        <div class="modal active" id="budgetModal">
            <div class="modal-content">
                <div class="modal-header"><h2>Novo Orçamento</h2><button class="close-modal" onclick="document.getElementById('budgetModal').remove()"><i class="fas fa-times"></i></button></div>
                <form id="budgetForm">
                    <div class="form-group"><label>Categoria</label><select id="budgetCategory" required>${settings.categories.filter(c=>c.type==='saida'||c.type==='ambos').map(c=>`<option value="${c.name}">${c.name}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Valor</label><input type="number" id="budgetAmount" step="0.01" required></div>
                    <div class="form-group"><label>Mês</label><input type="month" id="budgetMonth" required value="${document.getElementById('monthFilter').value}"></div>
                    <button type="submit" class="btn-submit">Salvar</button>
                </form>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('budgetForm').addEventListener('submit', function(e) {
        e.preventDefault();
        budgets.push({ id: Date.now(), category: document.getElementById('budgetCategory').value, amount: parseFloat(document.getElementById('budgetAmount').value), month: document.getElementById('budgetMonth').value });
        saveBudgets();
        renderBudgets();
        document.getElementById('budgetModal').remove();
    });
}

function renderBudgets() {
    const grid = document.getElementById('budgetGrid');
    if (!grid) return;
    const month = document.getElementById('monthFilter').value;
    const monthBudgets = budgets.filter(b => b.month === month);
    if (monthBudgets.length === 0) {
        grid.innerHTML = `<div style="text-align:center;padding:60px;"><i class="fas fa-wallet" style="font-size:64px;color:#6C63FF;margin-bottom:20px;display:block;"></i><h3 style="color:#b3b3b3;">Nenhum orçamento</h3><button class="btn-add" onclick="openBudgetModal()">Criar Orçamento</button></div>`;
        return;
    }
    grid.innerHTML = monthBudgets.map(b => {
        const spent = transactions.filter(t => t.type==='saida' && t.category===b.category && t.date.startsWith(month)).reduce((s,t) => s+parseFloat(t.value), 0);
        const pct = b.amount > 0 ? (spent/b.amount)*100 : 0;
        const status = pct > 100 ? 'exceeded' : pct > 80 ? 'warning' : 'good';
        return `<div class="budget-item">
            <div class="budget-header"><h3><i class="fas fa-${getCategoryIcon(b.category)}"></i> ${b.category}</h3><span class="budget-status status-${status}">${status==='exceeded'?'Estourado':status==='warning'?'Atenção':'OK'}</span></div>
            <div class="budget-info"><div><small>Planejado</small><p>${formatCurrency(b.amount)}</p></div><div><small>Gasto</small><p>${formatCurrency(spent)}</p></div><div><small>Restante</small><p class="${b.amount-spent<0?'negative':'positive'}">${formatCurrency(Math.abs(b.amount-spent))}</p></div></div>
            <div class="budget-progress"><div class="progress-bar"><div class="progress-fill" style="width:${Math.min(pct,100)}%;background:${status==='exceeded'?'#F44336':status==='warning'?'#FF9800':'#4CAF50'}"></div></div><span class="progress-percent">${pct.toFixed(1)}%</span></div>
        </div>`;
    }).join('');
}

// Analytics
function updateAnalytics() {
    const months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(d.toISOString().slice(0, 7));
    }
    const monthlyData = months.map(m => {
        const mt = transactions.filter(t => t.date && t.date.startsWith(m));
        return { income: mt.filter(t => t.type==='entrada').reduce((s,t) => s+parseFloat(t.value),0), expense: mt.filter(t => t.type==='saida').reduce((s,t) => s+parseFloat(t.value),0) };
    });
    
    updateChart('monthlyComparison', {
        labels: months.map(m => new Date(m+'-01').toLocaleDateString('pt-BR',{month:'short',year:'2-digit'})),
        datasets: [
            { label: 'Entradas', data: monthlyData.map(d=>d.income), backgroundColor: 'rgba(76,175,80,0.6)', borderColor: '#4CAF50', borderWidth: 2, borderRadius: 8 },
            { label: 'Saídas', data: monthlyData.map(d=>d.expense), backgroundColor: 'rgba(244,67,54,0.6)', borderColor: '#F44336', borderWidth: 2, borderRadius: 8 }
        ]
    }, 'bar');
    
    const cats = {};
    transactions.filter(t => t.type==='saida').forEach(t => { cats[t.category] = (cats[t.category]||0) + parseFloat(t.value); });
    const sorted = Object.entries(cats).sort(([,a],[,b]) => b-a).slice(0, 8);
    
    updateChart('topCategories', {
        labels: sorted.map(([n]) => n),
        datasets: [{ data: sorted.map(([,v]) => v), backgroundColor: ['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF','#FF9F40','#C9CBCF','#7BC8A4'], borderWidth: 0, borderRadius: 8 }]
    }, 'bar');
}

// Utility
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: settings.currency || 'BRL' }).format(Math.abs(value));
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const [y, m, d] = dateString.split('-');
    return new Date(y, m-1, d).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
}

function getCategoryIcon(cat) {
    const c = settings.categories.find(x => x.name === cat);
    return c ? c.icon : 'tag';
}

function showNotification(msg, type='success') {
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    n.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> ${msg}`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 100);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3000);
}

// Modal
function openAddModal() {
    document.getElementById('transactionModal').classList.add('active');
    document.getElementById('transDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('installmentsGroup').style.display = 'none';
    document.getElementById('installmentPreview').style.display = 'none';
    const perValue = document.getElementById('valuePerInstallment');
    if (perValue) perValue.style.display = 'none';
    updateCardSelect();
    updateCategorySelects();
    updateTransactionTypeSelect();
}

function closeModal() {
    document.getElementById('transactionModal').classList.remove('active');
    document.getElementById('transactionForm').reset();
}

function closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
}

// Theme
function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.style.setProperty('--bg-dark', '#f5f5f5');
        document.documentElement.style.setProperty('--bg-card', '#ffffff');
        document.documentElement.style.setProperty('--text-primary', '#333333');
        document.documentElement.style.setProperty('--text-secondary', '#666666');
        document.documentElement.style.setProperty('--border-color', '#e0e0e0');
    } else {
        document.documentElement.style.setProperty('--bg-dark', '#1a1a2e');
        document.documentElement.style.setProperty('--bg-card', '#16213e');
        document.documentElement.style.setProperty('--text-primary', '#ffffff');
        document.documentElement.style.setProperty('--text-secondary', '#b3b3b3');
        document.documentElement.style.setProperty('--border-color', '#2a2a4a');
    }
}

function updateCurrencySetting() {
    settings.currency = document.getElementById('currencySetting').value;
    saveSettings();
    updateDashboard();
}

function updateThemeSetting() {
    settings.theme = document.getElementById('themeSetting').value;
    saveSettings();
    applyTheme(settings.theme);
}

// Storage
function saveTransactions() { localStorage.setItem('transactions', JSON.stringify(transactions)); updateCardSpending(); }
function saveCards() { localStorage.setItem('cards', JSON.stringify(cards)); }
function saveBudgets() { localStorage.setItem('budgets', JSON.stringify(budgets)); }
function saveSettings() { localStorage.setItem('financeSettings', JSON.stringify(settings)); }

// Export/Import
function exportData() {
    const data = { transactions, cards, budgets, settings, exportDate: new Date().toISOString(), version: '3.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Dados exportados!', 'success');
}

function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.transactions) { transactions = data.transactions; saveTransactions(); }
            if (data.cards) { cards = data.cards; saveCards(); }
            if (data.budgets) { budgets = data.budgets; saveBudgets(); }
            if (data.settings) { settings = data.settings; saveSettings(); }
            updateDashboard();
            renderTransactions();
            renderCards();
            renderTypes();
            renderCategories();
            renderCardsSettings();
            applyTheme(settings.theme || 'dark');
            showNotification('Dados importados!', 'success');
        } catch(err) { alert('Arquivo inválido!'); }
    };
    reader.readAsText(file);
}

// Close modals on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

// Delete Budget
function deleteBudget(id) {
    if (confirm('Excluir orçamento?')) {
        budgets = budgets.filter(b => b.id !== id);
        saveBudgets();
        renderBudgets();
    }
}
