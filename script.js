// Configurações
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyRn-gr6CCOtZCuvItFn8M8dP6Xdvie4hTj42szKv5qodCgNdb72m7sprVGZVEUHsh-/exec';
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



//  Progresso do Mês 

function updateMonthProgress() {
    const now = new Date();
    const currentDay = now.getDate();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const progress = (currentDay / lastDay) * 100;
    
    document.getElementById('daysProgress').textContent = `${progress.toFixed(1)}%`;
    document.getElementById('monthProgressBar').style.width = `${progress}%`;
    document.getElementById('currentDay').textContent = `Dia ${currentDay}`;
    document.getElementById('lastDay').textContent = `Dia ${lastDay}`;
}

// Dashboard
function updateDashboard() {
    const selectedMonth = document.getElementById('monthFilter').value;
    const monthTransactions = transactions.filter(t => t.date && t.date.startsWith(selectedMonth));
    
    const income = monthTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value), 0);
    const expense = monthTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value), 0);
    const balance = income - expense;
    const savingsRate = income > 0 ? ((balance / income) * 100) : 0;
	generateSmartAnalysis(); // Adicione esta linha
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
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;"><p style="color:#b3b3b3;">Nenhuma transação</p></td></tr>`;
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
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;"><p style="color:#b3b3b3;">Nenhum resultado</p></td></tr>`;
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
    
    // Pegar tipos das configurações
    const saidaTypes = settings.types.filter(t => t.flow === 'saida');
    const entradaTypes = settings.types.filter(t => t.flow === 'entrada');
    
    // Construir HTML com Saída primeiro (selecionado por padrão)
    let html = '';
    
    // Opções de Saída primeiro
    if (saidaTypes.length > 0) {
        html += saidaTypes.map(t => 
            `<option value="${t.flow}">${t.name}</option>`
        ).join('');
    } else {
        html += '<option value="saida">Saída</option>';
    }
    
    // Depois opções de Entrada
    if (entradaTypes.length > 0) {
        html += entradaTypes.map(t => 
            `<option value="${t.flow}">${t.name}</option>`
        ).join('');
    } else {
        html += '<option value="entrada">Entrada</option>';
    }
    
    select.innerHTML = html;
    
    // Garantir que "Saída" esteja selecionado por padrão
    select.value = 'saida';
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
                card: t.card || '',
                debtor: t.debtor || ''  // ADICIONE ESTA LINHA
            }))
        };
        
        let success = false;
        try {
            const resp = await fetch(GOOGLE_SHEETS_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(data) 
            });
            if (resp.ok) { 
                const r = await resp.json(); 
                success = r.success; 
                console.log('✅ POST sync:', r);
            }
        } catch(e) {
            console.log('⚠️ POST falhou, tentando GET...');
        }
        
        if (!success) {
            const param = encodeURIComponent(JSON.stringify(data.data));
            const resp = await fetch(`${GOOGLE_SHEETS_URL}?action=sync&data=${param}`);
            const r = await resp.json();
            success = r.success;
            console.log('✅ GET sync:', r);
        }
        return success;
    } catch(e) { 
        console.error('❌ Erro ao enviar:', e);
        return false; 
    }
}

// Sincronizar devedores
async function syncDebtorsFromSheets() {
    try {
        console.log('📥 Baixando devedores...');
        const resp = await fetch(`${GOOGLE_SHEETS_URL}?action=getDebtors`);
        const result = await resp.json();
        
        if (result.success && result.debtors && result.debtors.length > 0) {
            debtors = result.debtors.map((d, i) => ({
                id: Date.now() + i,
                name: d.nome || d.name || '',
                phone: d.telefone || d.phone || '',
                email: d.email || '',
                notes: d.observações || d.observacoes || d.notes || '',
                totalOwed: parseFloat(d['total devido'] || d.totalOwed) || 0
            }));
            saveDebtors();
            renderDebtors();
            updateDebtorSelect();
        }
        console.log('✅ Devedores carregados:', debtors.length);
        return true;
    } catch(e) {
        console.error('❌ Erro ao baixar devedores:', e);
        return false;
    }
}

async function sendDebtorsToSheets() {
    try {
        const data = {
            action: 'syncDebtors',
            data: debtors.map(d => ({
                name: d.name || '',
                phone: d.phone || '',
                email: d.email || '',
                notes: d.notes || '',
                totalOwed: calculateDebtorTotal(d.name)
            }))
        };
        
        let success = false;
        try {
            const resp = await fetch(GOOGLE_SHEETS_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(data) 
            });
            if (resp.ok) { const r = await resp.json(); success = r.success; }
        } catch(e) {}
        
        if (!success) {
            const param = encodeURIComponent(JSON.stringify(data.data));
            const resp = await fetch(`${GOOGLE_SHEETS_URL}?action=syncDebtors&data=${param}`);
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
        await syncDebtorsFromSheets();
        await syncCardsFromSheets();
        await syncWithSheets();
        updateDashboard();
        renderTransactions();
        renderCards();
        renderDebtors();
        renderDebtorsSummary();
        showNotification('✅ Sincronização completa!', 'success');
    } catch(e) {
        showNotification('❌ Erro na sincronização', 'error');
    } finally {
        btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
    }
}

async function autoSyncAll() {
    try {
        // Sincronizar devedores
        await syncDebtorsFromSheets();
        
        // Sincronizar cartões
        await syncCardsFromSheets();
        
        // Sincronizar transações
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
                        card: (t.cartão || t.card || '').trim(),
                        debtor: (t.devedor || t.debtor || '').trim() // ADICIONE ESTA LINHA
                    };
                })
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            saveTransactions();
            updateCardSpending();
        }
        
        updateDashboard();
        renderTransactions();
        renderCards();
        renderDebtors();
        renderDebtorsSummary();
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

// ============================================
// SISTEMA DE DASHBOARD MODULAR
// ============================================

let currentDashboard = 'overview';
let dashboardChartType = 'bar';
let dashboardDateStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
let dashboardDateEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

// Toggle Submenu
function toggleSubmenu(event, submenuId) {
    event.preventDefault();
    const parent = event.currentTarget;
    const submenu = document.getElementById(submenuId);
    
    parent.classList.toggle('active');
    submenu.classList.toggle('active');
}

// Navegação do Dashboard
document.addEventListener('click', function(e) {
    const submenuItem = e.target.closest('.submenu-item');
    if (submenuItem) {
        e.preventDefault();
        
        // Atualizar ativo
        document.querySelectorAll('.submenu-item').forEach(item => item.classList.remove('active'));
        submenuItem.classList.add('active');
        
        // Ativar página dashboard
        navigateTo('dashboard');
        
        // Carregar dashboard específico
        const dashboardType = submenuItem.dataset.dashboard;
        currentDashboard = dashboardType;
        loadDashboard(dashboardType);
    }
});

// Atualizar navigateTo para incluir home
const oldNavigateTo = navigateTo;
navigateTo = function(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
        if (!item.classList.contains('nav-parent')) {
            item.classList.toggle('active', item.dataset.page === page);
        }
    });
    
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === `${page}-page`);
    });
    
    setTimeout(() => {
        switch(page) {
            case 'home':
                updateDashboard();
                initializeCharts();
                break;
            case 'dashboard':
                loadDashboard(currentDashboard);
                break;
            case 'transactions':
                renderTransactions();
                break;
            case 'cards':
                renderCards();
                break;
            case 'budget':
                renderBudgets();
                break;
            case 'settings':
                renderTypes();
                renderCategories();
                renderCardsSettings();
                document.getElementById('currencySetting').value = settings.currency || 'BRL';
                document.getElementById('themeSetting').value = settings.theme || 'dark';
                break;
        }
    }, 100);
};

// Carregar Dashboard Específico
function loadDashboard(type) {
    const container = document.getElementById('dashboardContainer');
    if (!container) return;
    
    // Filtrar transações pelo período
    const filteredTransactions = transactions.filter(t => 
        t.date >= dashboardDateStart && t.date <= dashboardDateEnd
    );
    
    const titles = {
        'overview': 'Visão Geral',
        'debtors': 'Análise de Devedores',
        'cards': 'Análise de Cartões',
        'income': 'Análise de Entradas',
        'expense': 'Análise de Saídas',
        'categories': 'Análise por Categorias',
        'monthly': 'Comparativo Mensal'
    };
    
    const icons = {
        'overview': 'chart-line',
        'debtors': 'users',
        'cards': 'credit-card',
        'income': 'arrow-up',
        'expense': 'arrow-down',
        'categories': 'tags',
        'monthly': 'calendar-alt'
    };
    
    let html = `
        <div class="dashboard-container">
            <div class="dashboard-header">
                <h2 class="dashboard-title">
                    <i class="fas fa-${icons[type]}"></i> ${titles[type]}
                </h2>
                <div class="dashboard-filters">
                    <div class="date-range">
                        <input type="date" id="dashboardDateStart" value="${dashboardDateStart}" onchange="updateDashboardDates()">
                        <span>até</span>
                        <input type="date" id="dashboardDateEnd" value="${dashboardDateEnd}" onchange="updateDashboardDates()">
                    </div>
                    <div class="chart-type-selector">
                        <button class="chart-type-btn ${dashboardChartType === 'bar' ? 'active' : ''}" onclick="changeChartType('bar')">
                            <i class="fas fa-chart-bar"></i>
                        </button>
                        <button class="chart-type-btn ${dashboardChartType === 'pie' ? 'active' : ''}" onclick="changeChartType('pie')">
                            <i class="fas fa-chart-pie"></i>
                        </button>
                        <button class="chart-type-btn ${dashboardChartType === 'line' ? 'active' : ''}" onclick="changeChartType('line')">
                            <i class="fas fa-chart-line"></i>
                        </button>
                        <button class="chart-type-btn ${dashboardChartType === 'doughnut' ? 'active' : ''}" onclick="changeChartType('doughnut')">
                            <i class="fas fa-circle"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div id="dashboardSummaryCards" class="dashboard-summary-cards"></div>
            <div class="dashboard-grid">
                <div class="chart-card full-width">
                    <h3 id="mainChartTitle">Gráfico Principal</h3>
                    <canvas id="mainDashboardChart"></canvas>
                </div>
            </div>
            <div class="chart-card full-width" style="margin-top: 20px;">
                <h3>Detalhamento</h3>
                <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                    <table class="detail-table">
                        <thead id="detailTableHead"></thead>
                        <tbody id="detailTableBody"></tbody>
                    </table>
                </div>
            </div>
            <div class="chart-card full-width" style="margin-top: 20px;">
                <h3><i class="fas fa-robot"></i> Análise Inteligente</h3>
                <div id="smartDashboardAnalysis" style="padding: 16px; color: var(--text-secondary); line-height: 1.8;"></div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Carregar dados específicos
    switch(type) {
        case 'debtors':
            loadDebtorsDashboard(filteredTransactions);
            break;
        case 'cards':
            loadCardsDashboard(filteredTransactions);
            break;
        case 'income':
            loadIncomeDashboard(filteredTransactions);
            break;
        case 'expense':
            loadExpenseDashboard(filteredTransactions);
            break;
        case 'categories':
            loadCategoriesDashboard(filteredTransactions);
            break;
        case 'monthly':
            loadMonthlyDashboard(filteredTransactions);
            break;
        default:
            loadOverviewDashboard(filteredTransactions);
    }
}

function updateDashboardDates() {
    dashboardDateStart = document.getElementById('dashboardDateStart').value;
    dashboardDateEnd = document.getElementById('dashboardDateEnd').value;
    loadDashboard(currentDashboard);
}

function changeChartType(type) {
    dashboardChartType = type;
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(type === 'bar' ? 'bar' : type === 'pie' ? 'pie' : type === 'line' ? 'line' : 'circle'));
    });
    loadDashboard(currentDashboard);
}

// ============================================
// DASHBOARD DE DEVEDORES
// ============================================
function loadDebtorsDashboard(transactions) {
    const debtorTransactions = transactions.filter(t => t.debtor && t.type === 'saida');
    
    // Resumo
    const debtorSummary = {};
    debtorTransactions.forEach(t => {
        if (!debtorSummary[t.debtor]) {
            debtorSummary[t.debtor] = { total: 0, count: 0, lastDate: null };
        }
        debtorSummary[t.debtor].total += parseFloat(t.value);
        debtorSummary[t.debtor].count++;
        if (!debtorSummary[t.debtor].lastDate || t.date > debtorSummary[t.debtor].lastDate) {
            debtorSummary[t.debtor].lastDate = t.date;
        }
    });
    
    const totalOwed = Object.values(debtorSummary).reduce((s, d) => s + d.total, 0);
    const uniqueDebtors = Object.keys(debtorSummary).length;
    const avgPerDebtor = uniqueDebtors > 0 ? totalOwed / uniqueDebtors : 0;
    
    // Cards de resumo
    document.getElementById('dashboardSummaryCards').innerHTML = `
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(244, 67, 54, 0.1); color: #F44336;"><i class="fas fa-hand-holding-usd"></i></div>
            <div class="mini-label">Total Devido</div>
            <div class="mini-value" style="color: #F44336;">${formatCurrency(totalOwed)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(255, 152, 0, 0.1); color: #FF9800;"><i class="fas fa-users"></i></div>
            <div class="mini-label">Devedores</div>
            <div class="mini-value">${uniqueDebtors}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(33, 150, 243, 0.1); color: #2196F3;"><i class="fas fa-calculator"></i></div>
            <div class="mini-label">Média por Devedor</div>
            <div class="mini-value">${formatCurrency(avgPerDebtor)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(76, 175, 80, 0.1); color: #4CAF50;"><i class="fas fa-receipt"></i></div>
            <div class="mini-label">Transações</div>
            <div class="mini-value">${debtorTransactions.length}</div>
        </div>
    `;
    
    // Gráfico
    const sorted = Object.entries(debtorSummary).sort(([,a], [,b]) => b.total - a.total);
    const labels = sorted.map(([name]) => name);
    const data = sorted.map(([,d]) => d.total);
    
    const canvas = document.getElementById('mainDashboardChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        new Chart(ctx, {
            type: dashboardChartType,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Valor Devido',
                    data: data,
                    backgroundColor: ['#F44336', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63', '#00BCD4'],
                    borderWidth: 2,
                    borderColor: '#16213e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#b3b3b3' } }
                }
            }
        });
    }
    
    // Tabela de detalhes
    document.getElementById('detailTableHead').innerHTML = `
        <tr><th>Devedor</th><th>Total Devido</th><th>Qtd. Transações</th><th>Última Transação</th><th>% do Total</th></tr>
    `;
    
    document.getElementById('detailTableBody').innerHTML = sorted.map(([name, d]) => `
        <tr>
            <td><span class="debtor-badge"><i class="fas fa-user"></i> ${name}</span></td>
            <td style="color: #F44336; font-weight: 600;">${formatCurrency(d.total)}</td>
            <td>${d.count}</td>
            <td>${d.lastDate ? formatDate(d.lastDate) : '-'}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="progress-bar" style="flex: 1; height: 6px;">
                        <div class="progress-fill" style="width: ${totalOwed > 0 ? (d.total/totalOwed)*100 : 0}%; background: #F44336;"></div>
                    </div>
                    <span>${totalOwed > 0 ? ((d.total/totalOwed)*100).toFixed(1) : 0}%</span>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Análise inteligente
    document.getElementById('smartDashboardAnalysis').innerHTML = `
        <p>📊 <strong>${uniqueDebtors} pessoa(s)</strong> estão te devendo um total de <strong style="color:#F44336;">${formatCurrency(totalOwed)}</strong> no período selecionado.</p>
        <p>🔝 O maior devedor é <strong>${sorted[0] ? sorted[0][0] : 'N/A'}</strong> com <strong style="color:#F44336;">${sorted[0] ? formatCurrency(sorted[0][1].total) : 'R$ 0,00'}</strong>.</p>
        <p>📅 A média por devedor é de <strong>${formatCurrency(avgPerDebtor)}</strong>.</p>
        ${totalOwed > 1000 ? '<p>⚠️ <strong style="color:#FF9800;">Atenção:</strong> O valor total devido é significativo. Considere cobrar os devedores.</p>' : ''}
    `;
}

// ============================================
// DASHBOARD DE CARTÕES
// ============================================
function loadCardsDashboard(transactions) {
    const cardTransactions = transactions.filter(t => t.card && t.type === 'saida');
    
    const cardSummary = {};
    cardTransactions.forEach(t => {
        if (!cardSummary[t.card]) {
            cardSummary[t.card] = { total: 0, count: 0 };
        }
        cardSummary[t.card].total += parseFloat(t.value);
        cardSummary[t.card].count++;
    });
    
    const totalSpent = Object.values(cardSummary).reduce((s, c) => s + c.total, 0);
    
    // Resumo
    document.getElementById('dashboardSummaryCards').innerHTML = `
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(244, 67, 54, 0.1); color: #F44336;"><i class="fas fa-credit-card"></i></div>
            <div class="mini-label">Total Gasto</div>
            <div class="mini-value" style="color: #F44336;">${formatCurrency(totalSpent)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(33, 150, 243, 0.1); color: #2196F3;"><i class="fas fa-shopping-cart"></i></div>
            <div class="mini-label">Transações</div>
            <div class="mini-value">${cardTransactions.length}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(76, 175, 80, 0.1); color: #4CAF50;"><i class="fas fa-percent"></i></div>
            <div class="mini-label">Cartão mais usado</div>
            <div class="mini-value" style="font-size: 16px;">${Object.entries(cardSummary).sort(([,a],[,b]) => b.total - a.total)[0]?.[0] || 'N/A'}</div>
        </div>
    `;
    
    // Gráfico
    const sorted = Object.entries(cardSummary).sort(([,a], [,b]) => b.total - a.total);
    const canvas = document.getElementById('mainDashboardChart');
    if (canvas) {
        new Chart(canvas.getContext('2d'), {
            type: dashboardChartType,
            data: {
                labels: sorted.map(([name]) => name),
                datasets: [{
                    label: 'Gastos por Cartão',
                    data: sorted.map(([,d]) => d.total),
                    backgroundColor: cards.map(c => c.color || '#6C63FF'),
                    borderWidth: 2,
                    borderColor: '#16213e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#b3b3b3' } } }
            }
        });
    }
    
    // Tabela
    document.getElementById('detailTableHead').innerHTML = `
        <tr><th>Cartão</th><th>Total Gasto</th><th>Transações</th><th>Limite</th><th>% Utilizado</th></tr>
    `;
    
    document.getElementById('detailTableBody').innerHTML = sorted.map(([name, d]) => {
        const card = cards.find(c => c.name === name);
        const limit = card ? card.limit : 0;
        const pct = limit > 0 ? (d.total / limit) * 100 : 0;
        return `
            <tr>
                <td><span class="card-badge">💳 ${name}</span></td>
                <td style="color: #F44336; font-weight: 600;">${formatCurrency(d.total)}</td>
                <td>${d.count}</td>
                <td>${formatCurrency(limit)}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="progress-bar" style="flex: 1; height: 6px;">
                            <div class="progress-fill" style="width: ${Math.min(pct, 100)}%; background: ${pct > 80 ? '#F44336' : pct > 50 ? '#FF9800' : '#4CAF50'};"></div>
                        </div>
                        <span>${pct.toFixed(1)}%</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Análise
    document.getElementById('smartDashboardAnalysis').innerHTML = `
        <p>💳 Foram realizadas <strong>${cardTransactions.length} transações</strong> com cartão no período.</p>
        <p>💰 O gasto total com cartões foi de <strong style="color:#F44336;">${formatCurrency(totalSpent)}</strong>.</p>
        ${sorted[0] ? `<p>🔝 O cartão mais utilizado foi <strong>${sorted[0][0]}</strong> com ${formatCurrency(sorted[0][1].total)}.</p>` : ''}
    `;
}

// ============================================
// DASHBOARD DE ENTRADAS
// ============================================
function loadIncomeDashboard(transactions) {
    const incomeTransactions = transactions.filter(t => t.type === 'entrada');
    
    const categorySummary = {};
    incomeTransactions.forEach(t => {
        if (!categorySummary[t.category]) {
            categorySummary[t.category] = { total: 0, count: 0 };
        }
        categorySummary[t.category].total += parseFloat(t.value);
        categorySummary[t.category].count++;
    });
    
    const totalIncome = Object.values(categorySummary).reduce((s, c) => s + c.total, 0);
    
    document.getElementById('dashboardSummaryCards').innerHTML = `
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(76, 175, 80, 0.1); color: #4CAF50;"><i class="fas fa-arrow-up"></i></div>
            <div class="mini-label">Total de Entradas</div>
            <div class="mini-value" style="color: #4CAF50;">${formatCurrency(totalIncome)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(33, 150, 243, 0.1); color: #2196F3;"><i class="fas fa-receipt"></i></div>
            <div class="mini-label">Transações</div>
            <div class="mini-value">${incomeTransactions.length}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(156, 39, 176, 0.1); color: #9C27B0;"><i class="fas fa-trophy"></i></div>
            <div class="mini-label">Maior Fonte</div>
            <div class="mini-value" style="font-size: 14px;">${Object.entries(categorySummary).sort(([,a],[,b]) => b.total - a.total)[0]?.[0] || 'N/A'}</div>
        </div>
    `;
    
    const sorted = Object.entries(categorySummary).sort(([,a], [,b]) => b.total - a.total);
    
    const canvas = document.getElementById('mainDashboardChart');
    if (canvas) {
        new Chart(canvas.getContext('2d'), {
            type: dashboardChartType,
            data: {
                labels: sorted.map(([name]) => name),
                datasets: [{
                    label: 'Entradas',
                    data: sorted.map(([,d]) => d.total),
                    backgroundColor: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'],
                    borderWidth: 2,
                    borderColor: '#16213e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#b3b3b3' } } }
            }
        });
    }
    
    document.getElementById('detailTableHead').innerHTML = `
        <tr><th>Categoria</th><th>Total</th><th>Transações</th><th>% do Total</th></tr>
    `;
    
    document.getElementById('detailTableBody').innerHTML = sorted.map(([name, d]) => `
        <tr>
            <td><span class="category-badge"><i class="fas fa-${getCategoryIcon(name)}"></i> ${name}</span></td>
            <td style="color: #4CAF50; font-weight: 600;">${formatCurrency(d.total)}</td>
            <td>${d.count}</td>
            <td>${((d.total/totalIncome)*100).toFixed(1)}%</td>
        </tr>
    `).join('');
    
    document.getElementById('smartDashboardAnalysis').innerHTML = `
        <p>✅ Total de entradas no período: <strong style="color:#4CAF50;">${formatCurrency(totalIncome)}</strong></p>
        <p>📊 Foram registradas <strong>${incomeTransactions.length} transações</strong> de entrada.</p>
        <p>💰 Média por transação: <strong>${incomeTransactions.length > 0 ? formatCurrency(totalIncome/incomeTransactions.length) : 'R$ 0,00'}</strong></p>
    `;
}

// ============================================
// DASHBOARD DE SAÍDAS
// ============================================
function loadExpenseDashboard(transactions) {
    const expenseTransactions = transactions.filter(t => t.type === 'saida');
    
    const categorySummary = {};
    expenseTransactions.forEach(t => {
        if (!categorySummary[t.category]) {
            categorySummary[t.category] = { total: 0, count: 0 };
        }
        categorySummary[t.category].total += parseFloat(t.value);
        categorySummary[t.category].count++;
    });
    
    const totalExpense = Object.values(categorySummary).reduce((s, c) => s + c.total, 0);
    
    document.getElementById('dashboardSummaryCards').innerHTML = `
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(244, 67, 54, 0.1); color: #F44336;"><i class="fas fa-arrow-down"></i></div>
            <div class="mini-label">Total de Saídas</div>
            <div class="mini-value" style="color: #F44336;">${formatCurrency(totalExpense)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(33, 150, 243, 0.1); color: #2196F3;"><i class="fas fa-receipt"></i></div>
            <div class="mini-label">Transações</div>
            <div class="mini-value">${expenseTransactions.length}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(255, 152, 0, 0.1); color: #FF9800;"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="mini-label">Maior Gasto</div>
            <div class="mini-value" style="font-size: 14px;">${Object.entries(categorySummary).sort(([,a],[,b]) => b.total - a.total)[0]?.[0] || 'N/A'}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(156, 39, 176, 0.1); color: #9C27B0;"><i class="fas fa-calculator"></i></div>
            <div class="mini-label">Média por Dia</div>
            <div class="mini-value">${formatCurrency(totalExpense / Math.max(1, getDaysInPeriod()))}</div>
        </div>
    `;
    
    const sorted = Object.entries(categorySummary).sort(([,a], [,b]) => b.total - a.total);
    
    const canvas = document.getElementById('mainDashboardChart');
    if (canvas) {
        new Chart(canvas.getContext('2d'), {
            type: dashboardChartType,
            data: {
                labels: sorted.map(([name]) => name),
                datasets: [{
                    label: 'Saídas',
                    data: sorted.map(([,d]) => d.total),
                    backgroundColor: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#00BCD4', '#009688'],
                    borderWidth: 2,
                    borderColor: '#16213e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#b3b3b3' } } }
            }
        });
    }
    
    document.getElementById('detailTableHead').innerHTML = `
        <tr><th>Categoria</th><th>Total Gasto</th><th>Transações</th><th>% do Total</th></tr>
    `;
    
    document.getElementById('detailTableBody').innerHTML = sorted.map(([name, d]) => `
        <tr>
            <td><span class="category-badge"><i class="fas fa-${getCategoryIcon(name)}"></i> ${name}</span></td>
            <td style="color: #F44336; font-weight: 600;">${formatCurrency(d.total)}</td>
            <td>${d.count}</td>
            <td>${((d.total/totalExpense)*100).toFixed(1)}%</td>
        </tr>
    `).join('');
    
    document.getElementById('smartDashboardAnalysis').innerHTML = `
        <p>📉 Total de saídas no período: <strong style="color:#F44336;">${formatCurrency(totalExpense)}</strong></p>
        <p>📊 Média diária de gastos: <strong>${formatCurrency(totalExpense / Math.max(1, getDaysInPeriod()))}</strong></p>
        <p>🔝 Maior categoria de gasto: <strong>${sorted[0]?.[0] || 'N/A'}</strong> (${sorted[0] ? ((sorted[0][1].total/totalExpense)*100).toFixed(1) : 0}%)</p>
        <p>💡 Foram realizadas <strong>${expenseTransactions.length} transações</strong> no período.</p>
    `;
}

// ============================================
// DASHBOARD DE VISÃO GERAL
// ============================================
function loadOverviewDashboard(transactions) {
    const income = transactions.filter(t => t.type === 'entrada').reduce((s, t) => s + parseFloat(t.value), 0);
    const expense = transactions.filter(t => t.type === 'saida').reduce((s, t) => s + parseFloat(t.value), 0);
    const balance = income - expense;
    const savingsRate = income > 0 ? ((balance / income) * 100) : 0;
    
    // Cards de resumo
    document.getElementById('dashboardSummaryCards').innerHTML = `
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(76, 175, 80, 0.1); color: #4CAF50;"><i class="fas fa-arrow-up"></i></div>
            <div class="mini-label">Total de Entradas</div>
            <div class="mini-value" style="color: #4CAF50;">${formatCurrency(income)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(244, 67, 54, 0.1); color: #F44336;"><i class="fas fa-arrow-down"></i></div>
            <div class="mini-label">Total de Saídas</div>
            <div class="mini-value" style="color: #F44336;">${formatCurrency(expense)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(33, 150, 243, 0.1); color: #2196F3;"><i class="fas fa-balance-scale"></i></div>
            <div class="mini-label">Saldo</div>
            <div class="mini-value" style="color: ${balance >= 0 ? '#4CAF50' : '#F44336'};">${formatCurrency(balance)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(156, 39, 176, 0.1); color: #9C27B0;"><i class="fas fa-piggy-bank"></i></div>
            <div class="mini-label">Taxa de Economia</div>
            <div class="mini-value">${savingsRate.toFixed(1)}%</div>
        </div>
    `;
    
    // Categorias de saída
    const catSummary = {};
    transactions.filter(t => t.type === 'saida').forEach(t => {
        if (!catSummary[t.category]) catSummary[t.category] = 0;
        catSummary[t.category] += parseFloat(t.value);
    });
    
    const sorted = Object.entries(catSummary).sort(([,a], [,b]) => b - a);
    
    // Gráfico
    const canvas = document.getElementById('mainDashboardChart');
    if (canvas && sorted.length > 0) {
        new Chart(canvas.getContext('2d'), {
            type: dashboardChartType,
            data: {
                labels: sorted.map(([name]) => name),
                datasets: [{
                    label: 'Gastos por Categoria',
                    data: sorted.map(([,v]) => v),
                    backgroundColor: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#FF9800'],
                    borderWidth: 2,
                    borderColor: '#16213e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#b3b3b3' } } }
            }
        });
    }
    
    // Tabela
    document.getElementById('detailTableHead').innerHTML = `
        <tr><th>Categoria</th><th>Total Gasto</th><th>% do Total</th></tr>
    `;
    
    document.getElementById('detailTableBody').innerHTML = sorted.map(([name, v]) => `
        <tr>
            <td><span class="category-badge"><i class="fas fa-${getCategoryIcon(name)}"></i> ${name}</span></td>
            <td style="color: #F44336; font-weight: 600;">${formatCurrency(v)}</td>
            <td>${((v/expense)*100).toFixed(1)}%</td>
        </tr>
    `).join('');
    
    // Análise
    document.getElementById('smartDashboardAnalysis').innerHTML = `
        <p>📊 Período: <strong>${formatDate(dashboardDateStart)}</strong> até <strong>${formatDate(dashboardDateEnd)}</strong></p>
        <p>✅ Entradas totais: <strong style="color:#4CAF50;">${formatCurrency(income)}</strong></p>
        <p>📉 Saídas totais: <strong style="color:#F44336;">${formatCurrency(expense)}</strong></p>
        <p>💰 Saldo: <strong style="color:${balance >= 0 ? '#4CAF50' : '#F44336'};">${formatCurrency(balance)}</strong></p>
        <p>📈 Taxa de economia: <strong>${savingsRate.toFixed(1)}%</strong></p>
        ${sorted.length > 0 ? `<p>🔝 Maior gasto: <strong>${sorted[0][0]}</strong> (${((sorted[0][1]/expense)*100).toFixed(1)}% do total)</p>` : ''}
        <p>📅 Total de <strong>${transactions.length} transações</strong> no período.</p>
    `;
}

// ============================================
// DASHBOARD DE CATEGORIAS
// ============================================
function loadCategoriesDashboard(transactions) {
    const catSummary = {};
    transactions.forEach(t => {
        if (!catSummary[t.category]) {
            catSummary[t.category] = { entrada: 0, saida: 0, count: 0 };
        }
        if (t.type === 'entrada') {
            catSummary[t.category].entrada += parseFloat(t.value);
        } else {
            catSummary[t.category].saida += parseFloat(t.value);
        }
        catSummary[t.category].count++;
    });
    
    const totalEntrada = Object.values(catSummary).reduce((s, c) => s + c.entrada, 0);
    const totalSaida = Object.values(catSummary).reduce((s, c) => s + c.saida, 0);
    
    document.getElementById('dashboardSummaryCards').innerHTML = `
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(76, 175, 80, 0.1); color: #4CAF50;"><i class="fas fa-arrow-up"></i></div>
            <div class="mini-label">Total Entradas</div>
            <div class="mini-value" style="color: #4CAF50;">${formatCurrency(totalEntrada)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(244, 67, 54, 0.1); color: #F44336;"><i class="fas fa-arrow-down"></i></div>
            <div class="mini-label">Total Saídas</div>
            <div class="mini-value" style="color: #F44336;">${formatCurrency(totalSaida)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(33, 150, 243, 0.1); color: #2196F3;"><i class="fas fa-tags"></i></div>
            <div class="mini-label">Categorias</div>
            <div class="mini-value">${Object.keys(catSummary).length}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(255, 152, 0, 0.1); color: #FF9800;"><i class="fas fa-star"></i></div>
            <div class="mini-label">Mais usada</div>
            <div class="mini-value" style="font-size: 14px;">${Object.entries(catSummary).sort(([,a],[,b]) => (b.entrada + b.saida) - (a.entrada + a.saida))[0]?.[0] || 'N/A'}</div>
        </div>
    `;
    
    const sorted = Object.entries(catSummary).sort(([,a], [,b]) => (b.entrada + b.saida) - (a.entrada + a.saida));
    
    const canvas = document.getElementById('mainDashboardChart');
    if (canvas && sorted.length > 0) {
        new Chart(canvas.getContext('2d'), {
            type: dashboardChartType,
            data: {
                labels: sorted.map(([name]) => name),
                datasets: [
                    {
                        label: 'Entradas',
                        data: sorted.map(([,d]) => d.entrada),
                        backgroundColor: 'rgba(76, 175, 80, 0.6)',
                        borderColor: '#4CAF50',
                        borderWidth: 2
                    },
                    {
                        label: 'Saídas',
                        data: sorted.map(([,d]) => d.saida),
                        backgroundColor: 'rgba(244, 67, 54, 0.6)',
                        borderColor: '#F44336',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#b3b3b3' } } }
            }
        });
    }
    
    document.getElementById('detailTableHead').innerHTML = `
        <tr><th>Categoria</th><th>Entradas</th><th>Saídas</th><th>Saldo</th><th>Transações</th></tr>
    `;
    
    document.getElementById('detailTableBody').innerHTML = sorted.map(([name, d]) => {
        const saldo = d.entrada - d.saida;
        return `
            <tr>
                <td><span class="category-badge"><i class="fas fa-${getCategoryIcon(name)}"></i> ${name}</span></td>
                <td style="color: #4CAF50;">${d.entrada > 0 ? formatCurrency(d.entrada) : '-'}</td>
                <td style="color: #F44336;">${d.saida > 0 ? formatCurrency(d.saida) : '-'}</td>
                <td style="color: ${saldo >= 0 ? '#4CAF50' : '#F44336'}; font-weight: 600;">${formatCurrency(saldo)}</td>
                <td>${d.count}</td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('smartDashboardAnalysis').innerHTML = `
        <p>📊 Foram encontradas <strong>${Object.keys(catSummary).length} categorias</strong> com transações no período.</p>
        <p>✅ Total de entradas: <strong style="color:#4CAF50;">${formatCurrency(totalEntrada)}</strong></p>
        <p>📉 Total de saídas: <strong style="color:#F44336;">${formatCurrency(totalSaida)}</strong></p>
        <p>💰 Saldo total: <strong style="color:${totalEntrada - totalSaida >= 0 ? '#4CAF50' : '#F44336'};">${formatCurrency(totalEntrada - totalSaida)}</strong></p>
        ${sorted[0] ? `<p>🔝 Categoria mais movimentada: <strong>${sorted[0][0]}</strong> com ${formatCurrency(sorted[0][1].entrada + sorted[0][1].saida)}</p>` : ''}
    `;
}

// ============================================
// DASHBOARD COMPARATIVO MENSAL
// ============================================
function loadMonthlyDashboard(transactions) {
    const monthlySummary = {};
    
    transactions.forEach(t => {
        if (!t.date) return;
        const month = t.date.substring(0, 7); // YYYY-MM
        if (!monthlySummary[month]) {
            monthlySummary[month] = { entrada: 0, saida: 0, count: 0 };
        }
        if (t.type === 'entrada') {
            monthlySummary[month].entrada += parseFloat(t.value);
        } else {
            monthlySummary[month].saida += parseFloat(t.value);
        }
        monthlySummary[month].count++;
    });
    
    const sorted = Object.entries(monthlySummary).sort(([a], [b]) => a.localeCompare(b));
    
    const totalEntrada = Object.values(monthlySummary).reduce((s, m) => s + m.entrada, 0);
    const totalSaida = Object.values(monthlySummary).reduce((s, m) => s + m.saida, 0);
    
    document.getElementById('dashboardSummaryCards').innerHTML = `
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(76, 175, 80, 0.1); color: #4CAF50;"><i class="fas fa-arrow-up"></i></div>
            <div class="mini-label">Total Entradas</div>
            <div class="mini-value" style="color: #4CAF50;">${formatCurrency(totalEntrada)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(244, 67, 54, 0.1); color: #F44336;"><i class="fas fa-arrow-down"></i></div>
            <div class="mini-label">Total Saídas</div>
            <div class="mini-value" style="color: #F44336;">${formatCurrency(totalSaida)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(33, 150, 243, 0.1); color: #2196F3;"><i class="fas fa-calendar-alt"></i></div>
            <div class="mini-label">Meses</div>
            <div class="mini-value">${Object.keys(monthlySummary).length}</div>
        </div>
        <div class="summary-mini-card">
            <div class="mini-icon" style="background: rgba(156, 39, 176, 0.1); color: #9C27B0;"><i class="fas fa-chart-line"></i></div>
            <div class="mini-label">Média Mensal (Saída)</div>
            <div class="mini-value">${Object.keys(monthlySummary).length > 0 ? formatCurrency(totalSaida / Object.keys(monthlySummary).length) : 'R$ 0,00'}</div>
        </div>
    `;
    
    const canvas = document.getElementById('mainDashboardChart');
    if (canvas && sorted.length > 0) {
        new Chart(canvas.getContext('2d'), {
            type: dashboardChartType === 'pie' || dashboardChartType === 'doughnut' ? 'bar' : dashboardChartType,
            data: {
                labels: sorted.map(([month]) => {
                    const [y, m] = month.split('-');
                    return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                }),
                datasets: [
                    {
                        label: 'Entradas',
                        data: sorted.map(([,d]) => d.entrada),
                        backgroundColor: 'rgba(76, 175, 80, 0.6)',
                        borderColor: '#4CAF50',
                        borderWidth: 2,
                        borderRadius: 4
                    },
                    {
                        label: 'Saídas',
                        data: sorted.map(([,d]) => d.saida),
                        backgroundColor: 'rgba(244, 67, 54, 0.6)',
                        borderColor: '#F44336',
                        borderWidth: 2,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#b3b3b3' } } }
            }
        });
    }
    
    document.getElementById('detailTableHead').innerHTML = `
        <tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th><th>Economia</th></tr>
    `;
    
    document.getElementById('detailTableBody').innerHTML = sorted.map(([month, d]) => {
        const saldo = d.entrada - d.saida;
        const economia = d.entrada > 0 ? ((saldo / d.entrada) * 100) : 0;
        const [y, m] = month.split('-');
        const monthName = new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        
        return `
            <tr>
                <td><strong>${monthName}</strong></td>
                <td style="color: #4CAF50;">${formatCurrency(d.entrada)}</td>
                <td style="color: #F44336;">${formatCurrency(d.saida)}</td>
                <td style="color: ${saldo >= 0 ? '#4CAF50' : '#F44336'}; font-weight: 600;">${formatCurrency(saldo)}</td>
                <td>
                    <span style="color: ${economia >= 0 ? '#4CAF50' : '#F44336'};">
                        ${economia.toFixed(1)}%
                    </span>
                </td>
            </tr>
        `;
    }).join('');
    
    // Pegar melhor e pior mês
    const bestMonth = sorted.reduce((best, curr) => {
        const currSaldo = curr[1].entrada - curr[1].saida;
        const bestSaldo = best ? best[1].entrada - best[1].saida : -Infinity;
        return currSaldo > bestSaldo ? curr : best;
    }, null);
    
    const worstMonth = sorted.reduce((worst, curr) => {
        const currSaldo = curr[1].entrada - curr[1].saida;
        const worstSaldo = worst ? worst[1].entrada - worst[1].saida : Infinity;
        return currSaldo < worstSaldo ? curr : worst;
    }, null);
    
    document.getElementById('smartDashboardAnalysis').innerHTML = `
        <p>📊 Análise de <strong>${sorted.length} meses</strong> (${formatDate(dashboardDateStart)} até ${formatDate(dashboardDateEnd)})</p>
        <p>📈 Média de entradas mensais: <strong style="color:#4CAF50;">${sorted.length > 0 ? formatCurrency(totalEntrada / sorted.length) : 'R$ 0,00'}</strong></p>
        <p>📉 Média de saídas mensais: <strong style="color:#F44336;">${sorted.length > 0 ? formatCurrency(totalSaida / sorted.length) : 'R$ 0,00'}</strong></p>
        ${bestMonth ? `<p>🏆 Melhor mês: <strong>${new Date(bestMonth[0] + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong> com saldo de <strong style="color:#4CAF50;">${formatCurrency(bestMonth[1].entrada - bestMonth[1].saida)}</strong></p>` : ''}
        ${worstMonth ? `<p>⚠️ Pior mês: <strong>${new Date(worstMonth[0] + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong> com saldo de <strong style="color:#F44336;">${formatCurrency(worstMonth[1].entrada - worstMonth[1].saida)}</strong></p>` : ''}
    `;
}

// Função auxiliar
function getDaysInPeriod() {
    const start = new Date(dashboardDateStart);
    const end = new Date(dashboardDateEnd);
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
}

// ============================================
// ESTADO DOS DEVEDORES
// ============================================
let debtors = JSON.parse(localStorage.getItem('debtors')) || [];

// ============================================
// GERENCIAMENTO DE DEVEDORES
// ============================================

function renderDebtors() {
    const list = document.getElementById('debtorsList');
    if (!list) return;
    
    if (debtors.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Nenhum devedor cadastrado</p>
                <button class="btn-add-small" onclick="openAddDebtorModal()">
                    <i class="fas fa-plus"></i> Adicionar Devedor
                </button>
            </div>
        `;
        return;
    }
    
    list.innerHTML = debtors.map(d => {
        const totalOwed = calculateDebtorTotal(d.name);
        return `
            <div class="settings-item">
                <div class="settings-item-info">
                    <div class="settings-item-icon" style="background: #FF9800">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="settings-item-details">
                        <span class="settings-item-name">${d.name}</span>
                        <span class="settings-item-meta">
                            <span style="color: #F44336; font-weight: 600;">${formatCurrency(totalOwed)}</span>
                            ${d.phone ? `<span>📱 ${d.phone}</span>` : ''}
                        </span>
                    </div>
                </div>
                <div class="settings-item-actions">
                    <button class="settings-btn-icon" onclick="editDebtor(${d.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="settings-btn-icon btn-delete" onclick="deleteDebtor(${d.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    updateDebtorSelect();
    renderDebtorsSummary();
}

function renderDebtorsSummary() {
    const tbody = document.getElementById('debtorsSummaryBody');
    if (!tbody) return;
    
    // Calcular totais por devedor
    const summary = {};
    
    transactions.forEach(t => {
        if (t.debtor && t.type === 'saida') {
            if (!summary[t.debtor]) {
                summary[t.debtor] = {
                    total: 0,
                    count: 0,
                    lastDate: null
                };
            }
            summary[t.debtor].total += parseFloat(t.value);
            summary[t.debtor].count++;
            
            if (!summary[t.debtor].lastDate || t.date > summary[t.debtor].lastDate) {
                summary[t.debtor].lastDate = t.date;
            }
        }
    });
    
    if (Object.keys(summary).length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px;">
                    <i class="fas fa-hand-holding-usd" style="font-size: 48px; color: #6C63FF; margin-bottom: 16px; display: block;"></i>
                    <p style="color: #b3b3b3;">Nenhuma dívida registrada</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Ordenar por maior valor
    const sorted = Object.entries(summary).sort(([,a], [,b]) => b.total - a.total);
    
    tbody.innerHTML = sorted.map(([name, data]) => {
        const daysSinceLast = data.lastDate ? 
            Math.floor((new Date() - new Date(data.lastDate)) / (1000 * 60 * 60 * 24)) : 
            0;
        
        const status = daysSinceLast > 30 ? 'overdue' : 'pending';
        const statusText = daysSinceLast > 30 ? 'Atrasado' : 'Pendente';
        
        return `
            <tr>
                <td>
                    <span class="debtor-badge">
                        <i class="fas fa-user"></i>
                        ${name}
                    </span>
                </td>
                <td style="color: #F44336; font-weight: 600;">${formatCurrency(data.total)}</td>
                <td>${data.count} transações</td>
                <td>${data.lastDate ? formatDate(data.lastDate) : '-'}</td>
                <td><span class="debtor-status ${status}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

function calculateDebtorTotal(name) {
    return transactions
        .filter(t => t.debtor === name && t.type === 'saida')
        .reduce((sum, t) => sum + parseFloat(t.value), 0);
}

// Modal Devedor
function openAddDebtorModal() {
    document.getElementById('debtorModalTitle').textContent = 'Novo Devedor';
    document.getElementById('debtorEditId').value = '';
    document.getElementById('debtorForm').reset();
    document.getElementById('debtorModal').classList.add('active');
}

function editDebtor(id) {
    const debtor = debtors.find(d => d.id === id);
    if (!debtor) return;
    
    document.getElementById('debtorModalTitle').textContent = 'Editar Devedor';
    document.getElementById('debtorEditId').value = debtor.id;
    document.getElementById('debtorName').value = debtor.name;
    document.getElementById('debtorPhone').value = debtor.phone || '';
    document.getElementById('debtorEmail').value = debtor.email || '';
    document.getElementById('debtorNotes').value = debtor.notes || '';
    document.getElementById('debtorModal').classList.add('active');
}

function closeDebtorModal() {
    document.getElementById('debtorModal').classList.remove('active');
    document.getElementById('debtorForm').reset();
}

function deleteDebtor(id) {
    const debtor = debtors.find(d => d.id === id);
    if (!debtor) return;
    
    const hasTransactions = transactions.some(t => t.debtor === debtor.name);
    
    if (hasTransactions) {
        if (!confirm(`"${debtor.name}" possui transações registradas. Deseja realmente excluir?`)) {
            return;
        }
    }
    
    if (confirm(`Excluir "${debtor.name}"?`)) {
        debtors = debtors.filter(d => d.id !== id);
        saveDebtors();
        renderDebtors();
        showNotification('Devedor excluído!', 'success');
    }
}

// Form Devedor
// No evento de submit do formulário de devedor
document.addEventListener('submit', function(e) {
    if (e.target.id === 'debtorForm') {
        e.preventDefault();
        
        const editId = document.getElementById('debtorEditId').value;
        const data = {
            name: document.getElementById('debtorName').value.trim(),
            phone: document.getElementById('debtorPhone').value.trim(),
            email: document.getElementById('debtorEmail').value.trim(),
            notes: document.getElementById('debtorNotes').value.trim()
        };
        
        if (!data.name) {
            showNotification('Nome é obrigatório!', 'error');
            return;
        }
        
        if (editId) {
            const idx = debtors.findIndex(d => d.id === parseInt(editId));
            if (idx !== -1) {
                const oldName = debtors[idx].name;
                debtors[idx] = { ...debtors[idx], ...data };
                
                if (oldName !== data.name) {
                    transactions.forEach(t => {
                        if (t.debtor === oldName) t.debtor = data.name;
                    });
                    saveTransactions();
                    sendToSheets(); // Sincronizar transações também
                }
            }
        } else {
            debtors.push({ id: Date.now(), ...data });
        }
        
        saveDebtors();
        closeDebtorModal();
        renderDebtors();
        updateDebtorSelect();
        
        // ENVIAR PARA PLANILHA
        sendDebtorsToSheets().then(success => {
            if (success) {
                showNotification('✅ Devedor salvo na planilha!', 'success');
            } else {
                showNotification('⚠️ Salvo localmente, mas erro ao enviar para planilha', 'error');
            }
        });
    }
});

// Atualizar select de devedores
function updateDebtorSelect() {
    const select = document.getElementById('transDebtor');
    if (!select) return;
    
    select.innerHTML = '<option value="">Nenhum (Compra própria)</option>' +
        debtors.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
}

// Mostrar/esconder campos relacionados ao cartão
function toggleCardFields() {
    const card = document.getElementById('transCard').value;
    const installmentsGroup = document.getElementById('installmentsGroup');
    const debtorGroup = document.getElementById('debtorGroup');
    const installmentPreview = document.getElementById('installmentPreview');
    
    if (card) {
        // Cartão selecionado
        if (installmentsGroup) installmentsGroup.style.display = 'block';
        if (debtorGroup) debtorGroup.style.display = 'block';
    } else {
        // Sem cartão
        if (installmentsGroup) installmentsGroup.style.display = 'none';
        if (debtorGroup) debtorGroup.style.display = 'none';
        if (installmentPreview) installmentPreview.style.display = 'none';
        document.getElementById('transInstallments').value = '1';
        if (document.getElementById('transDebtor')) {
            document.getElementById('transDebtor').value = '';
        }
    }
    
    updateInstallmentPreview();
}

// Atualizar handleTransactionSubmit para incluir devedor
const superHandleTransactionSubmit = handleTransactionSubmit;
handleTransactionSubmit = function(e) {
    e.preventDefault();
    
    const type = document.getElementById('transType').value;
    const valueInput = document.getElementById('transValue').value;
    const category = document.getElementById('transCategory').value;
    const description = document.getElementById('transDescription').value;
    const date = document.getElementById('transDate').value;
    const card = document.getElementById('transCard').value;
    const installments = parseInt(document.getElementById('transInstallments')?.value) || 1;
    const debtor = document.getElementById('transDebtor')?.value || '';
    
    if (!valueInput || parseFloat(valueInput) <= 0) { showNotification('Valor inválido!', 'error'); return; }
    if (!category) { showNotification('Selecione uma categoria!', 'error'); return; }
    if (!description.trim()) { showNotification('Insira uma descrição!', 'error'); return; }
    if (!date) { showNotification('Selecione uma data!', 'error'); return; }
    
    const baseTransaction = { 
        type, 
        value: parseFloat(valueInput), 
        category, 
        description: description.trim(), 
        date, 
        card,
        debtor: debtor || ''
    };
    
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
    updateCardSpending();
    sendToSheets();
    
    if (debtor) {
        renderDebtorsSummary();
    }
};

// Atualizar createInstallmentTransactions para incluir devedor
const superCreateInstallments = createInstallmentTransactions;
createInstallmentTransactions = function(base, installments) {
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
            card: base.card,
            debtor: base.debtor || ''
        });
    }
    return result;
};

// Atualizar renderTransactions para mostrar devedor
const superRenderTransactions = renderTransactions;
renderTransactions = function() {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;
    
    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;"><p style="color:#b3b3b3;">Nenhuma transação</p></td></tr>`;
        return;
    }
    
    tbody.innerHTML = transactions.map(t => `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td><span class="transaction-type ${t.type}">${t.type === 'entrada' ? 'Entrada' : 'Saída'}</span></td>
            <td><span class="category-badge"><i class="fas fa-${getCategoryIcon(t.category)}"></i> ${t.category}</span></td>
            <td>${t.description}</td>
            <td>${t.card ? `<span class="card-badge">💳 ${t.card}</span>` : '-'}</td>
            <td>${t.debtor ? `<span class="debtor-badge"><i class="fas fa-user"></i> ${t.debtor}</span>` : '<span class="no-card">-</span>'}</td>
            <td class="transaction-value ${t.type === 'entrada' ? 'positive' : 'negative'}">${t.type === 'entrada' ? '+' : '-'} ${formatCurrency(t.value)}</td>
            <td>
                <div class="action-buttons">
                    <button onclick="editTransaction(${t.id})" class="btn-icon"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteTransaction(${t.id})" class="btn-icon btn-delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
};

// Atualizar tabela de transações para incluir coluna Devedor
// No HTML, atualize o thead da tabela de transações:
// <th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Cartão</th><th>Devedor</th><th>Valor</th><th>Ações</th>

// Atualizar openAddModal
const megaOpenAddModal = openAddModal;
openAddModal = function() {
    document.getElementById('transactionModal').classList.add('active');
    document.getElementById('transDate').value = new Date().toISOString().slice(0, 10);
    
    document.getElementById('installmentsGroup').style.display = 'none';
    document.getElementById('installmentPreview').style.display = 'none';
    const debtorGroup = document.getElementById('debtorGroup');
    if (debtorGroup) debtorGroup.style.display = 'none';
    
    const perValue = document.getElementById('valuePerInstallment');
    if (perValue) perValue.style.display = 'none';
    
    updateCardSelect();
    updateCategorySelects();
    updateTransactionTypeSelect();
    updateDebtorSelect();
    
    const transType = document.getElementById('transType');
    if (transType) transType.value = 'saida';
    
    setTimeout(() => {
        const valueInput = document.getElementById('transValue');
        if (valueInput) valueInput.focus();
    }, 100);
};

// Storage
function saveDebtors() {
    localStorage.setItem('debtors', JSON.stringify(debtors));
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Carregar devedores
    const saved = localStorage.getItem('debtors');
    if (saved) debtors = JSON.parse(saved);
      const now = new Date();
    dashboardDateStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    dashboardDateEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    // ... resto da inicialização existente ...
});

// Atualizar tabela de transações (adicionar coluna Devedor)
// No HTML da tabela de transações, adicione <th>Devedor</th> após <th>Cartão</th>
// E atualize o colspan para 8 nos estados vazios

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
    
    // Garantir que o tipo seja "Saída" por padrão
    const transType = document.getElementById('transType');
    if (transType) {
        transType.value = 'saida';
    }
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

function generateSmartAnalysis() {
    const selectedMonth = document.getElementById('monthFilter').value;
    const monthTransactions = transactions.filter(t => t.date && t.date.startsWith(selectedMonth));
    
    const income = monthTransactions.filter(t => t.type === 'entrada').reduce((s, t) => s + parseFloat(t.value), 0);
    const expense = monthTransactions.filter(t => t.type === 'saida').reduce((s, t) => s + parseFloat(t.value), 0);
    const balance = income - expense;
    
    // Categoria que mais gastou
    const catSpending = {};
    monthTransactions.filter(t => t.type === 'saida').forEach(t => {
        catSpending[t.category] = (catSpending[t.category] || 0) + parseFloat(t.value);
    });
    
    const topCategory = Object.entries(catSpending).sort(([,a], [,b]) => b - a)[0];
    
    // Cartão mais usado
    const cardSpending = {};
    monthTransactions.filter(t => t.type === 'saida' && t.card).forEach(t => {
        cardSpending[t.card] = (cardSpending[t.card] || 0) + parseFloat(t.value);
    });
    
    const topCard = Object.entries(cardSpending).sort(([,a], [,b]) => b - a)[0];
    
    let analysis = '';
    
    if (balance >= 0) {
        analysis += `✅ <strong style="color:#4CAF50;">Parabéns!</strong> Você está com saldo positivo de <strong>${formatCurrency(balance)}</strong> este mês.<br><br>`;
        analysis += `💰 Sua taxa de economia está em <strong>${income > 0 ? ((balance/income)*100).toFixed(1) : 0}%</strong> da renda total.<br><br>`;
    } else {
        analysis += `⚠️ <strong style="color:#F44336;">Atenção!</strong> Seus gastos superaram a renda em <strong>${formatCurrency(Math.abs(balance))}</strong>.<br><br>`;
        analysis += `📉 Considere reduzir gastos para equilibrar o orçamento.<br><br>`;
    }
    
    if (topCategory) {
        const pct = ((topCategory[1] / expense) * 100).toFixed(1);
        analysis += `📊 Sua maior despesa foi com <strong>${topCategory[0]}</strong> (${pct}% dos gastos).<br><br>`;
    }
    
    if (topCard) {
        analysis += `💳 O cartão mais utilizado foi <strong>${topCard[0]}</strong> com ${formatCurrency(topCard[1])} em gastos.<br><br>`;
    }
    
    // Previsão
    const daysPassed = new Date().getDate();
    const dailyAvg = expense / daysPassed;
    const projectedExpense = dailyAvg * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    
    analysis += `🔮 Projeção de gastos para o mês: <strong>${formatCurrency(projectedExpense)}</strong>`;
    
    const el = document.getElementById('smartAnalysis');
    if (el) el.innerHTML = analysis;
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
