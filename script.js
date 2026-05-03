// Configuração - Substitua pela URL do seu Google Sheets
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzCHMBLoHL468Gakq_JLQuPM65uWDIwwFTe1j7B7rLheki1kOrx227elT5HNy7a6a-6/exec';
const SHEETS_LINK = 'https://docs.google.com/spreadsheets/d/1DdiyEwLlik9OvBA36xP9NYaTG_kTiDpQyDnXthCYqew/edit?gid=0#gid=0';

// Estado da aplicação
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let cards = JSON.parse(localStorage.getItem('cards')) || [];
let budgets = JSON.parse(localStorage.getItem('budgets')) || [];
let charts = {};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadSampleData();
    updateDashboard();
    setupEventListeners();
    initializeCharts();
});

function initializeApp() {
    document.getElementById('sheetsLink').href = SHEETS_LINK;
    document.getElementById('monthFilter').value = new Date().toISOString().slice(0, 7);
    
    // Load cards into select
    updateCardSelect();
}

function loadSampleData() {
    if (transactions.length === 0) {
        transactions = [
            { id: 1, type: 'entrada', value: 5000, category: 'Salário', description: 'Salário Janeiro', date: '2024-01-05', card: '' },
            { id: 2, type: 'saida', value: 1500, category: 'Alimentação', description: 'Supermercado', date: '2024-01-10', card: 'Visa' },
            { id: 3, type: 'saida', value: 800, category: 'Transporte', description: 'Combustível', date: '2024-01-15', card: 'MasterCard' },
            { id: 4, type: 'entrada', value: 2000, category: 'Freelance', description: 'Projeto Web', date: '2024-01-20', card: '' },
            { id: 5, type: 'saida', value: 1200, category: 'Moradia', description: 'Aluguel', date: '2024-01-05', card: '' },
        ];
        saveTransactions();
    }
    
    if (cards.length === 0) {
        cards = [
            { id: 1, name: 'Visa', limit: 5000, spent: 1500, color: '#667eea' },
            { id: 2, name: 'MasterCard', limit: 3000, spent: 800, color: '#f093fb' },
        ];
        saveCards();
    }
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });
    
    // Month filter
    document.getElementById('monthFilter').addEventListener('change', updateDashboard);
    
    // Transaction form
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
    
    // Search and filters
    document.querySelector('.search-input')?.addEventListener('input', filterTransactions);
    document.querySelector('.filter-select')?.addEventListener('change', filterTransactions);
}

function navigateTo(page) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === `${page}-page`);
    });
    
    // Update specific pages
    if (page === 'transactions') renderTransactions();
    if (page === 'cards') renderCards();
    if (page === 'analytics') updateAnalytics();
    if (page === 'budget') renderBudgets();
}

// Dashboard Functions
function updateDashboard() {
    const selectedMonth = document.getElementById('monthFilter').value;
    const monthTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));
    
    const income = monthTransactions
        .filter(t => t.type === 'entrada')
        .reduce((sum, t) => sum + t.value, 0);
    
    const expense = monthTransactions
        .filter(t => t.type === 'saida')
        .reduce((sum, t) => sum + t.value, 0);
    
    const balance = income - expense;
    const savingsRate = income > 0 ? ((balance / income) * 100) : 0;
    
    // Update summary cards
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpense').textContent = formatCurrency(expense);
    document.getElementById('totalBalance').textContent = formatCurrency(balance);
    document.getElementById('savingsRate').textContent = `${savingsRate.toFixed(1)}%`;
    
    // Update balance trend
    const trendElement = document.getElementById('balanceTrend');
    if (balance >= 0) {
        trendElement.textContent = '+Saldo positivo';
        trendElement.className = 'card-trend positive';
    } else {
        trendElement.textContent = '-Saldo negativo';
        trendElement.className = 'card-trend negative';
    }
    
    updateCharts(monthTransactions);
}

function updateCharts(monthTransactions) {
    // Cashflow Chart
    const daysInMonth = new Date(
        document.getElementById('monthFilter').value.split('-')[0],
        document.getElementById('monthFilter').value.split('-')[1],
        0
    ).getDate();
    
    const dailyData = Array.from({length: daysInMonth}, (_, i) => {
        const day = i + 1;
        const dayStr = `${document.getElementById('monthFilter').value}-${String(day).padStart(2, '0')}`;
        const dayTransactions = monthTransactions.filter(t => t.date === dayStr);
        return {
            income: dayTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + t.value, 0),
            expense: dayTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + t.value, 0)
        };
    });
    
    updateChart('cashflowChart', {
        labels: Array.from({length: daysInMonth}, (_, i) => i + 1),
        datasets: [
            {
                label: 'Entradas',
                data: dailyData.map(d => d.income),
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Saídas',
                data: dailyData.map(d => d.expense),
                borderColor: '#F44336',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                fill: true,
                tension: 0.4
            }
        ]
    });
    
    // Category Chart
    const categories = {};
    monthTransactions
        .filter(t => t.type === 'saida')
        .forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + t.value;
        });
    
    updateChart('categoryChart', {
        labels: Object.keys(categories),
        datasets: [{
            data: Object.values(categories),
            backgroundColor: [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                '#FF9F40', '#FF6384', '#C9CBCF', '#7BC8A4', '#E8C3B9'
            ]
        }]
    }, 'doughnut');
    
    // Cards Chart
    const cardSpending = {};
    monthTransactions
        .filter(t => t.type === 'saida' && t.card)
        .forEach(t => {
            cardSpending[t.card] = (cardSpending[t.card] || 0) + t.value;
        });
    
    updateChart('cardChart', {
        labels: Object.keys(cardSpending),
        datasets: [{
            data: Object.values(cardSpending),
            backgroundColor: ['#667eea', '#f093fb', '#4facfe', '#43e97b']
        }]
    }, 'pie');
}

// Chart Functions
function initializeCharts() {
    const chartConfigs = {
        cashflow: { type: 'line' },
        category: { type: 'doughnut' },
        card: { type: 'pie' },
        balance: { type: 'line' },
        monthlyComparison: { type: 'bar' },
        topCategories: { type: 'bar' },
        spendingDistribution: { type: 'radar' }
    };
    
    Object.entries(chartConfigs).forEach(([key, config]) => {
        const canvas = document.getElementById(`${key}Chart`);
        if (canvas && !charts[key]) {
            charts[key] = new Chart(canvas, {
                type: config.type,
                data: { labels: [], datasets: [] },
                options: getChartOptions()
            });
        }
    });
}

function updateChart(chartId, data, type = 'line') {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;
    
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    
    charts[chartId] = new Chart(canvas, {
        type: type,
        data: data,
        options: getChartOptions()
    });
}

function getChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: '#b3b3b3',
                    padding: 15,
                    font: { size: 12 }
                }
            }
        },
        scales: {
            y: {
                grid: { color: 'rgba(42, 42, 74, 0.5)' },
                ticks: { color: '#b3b3b3' }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#b3b3b3' }
            }
        }
    };
}

// Transaction Functions
function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const transaction = {
        id: Date.now(),
        type: document.getElementById('transType').value,
        value: parseFloat(document.getElementById('transValue').value),
        category: document.getElementById('transCategory').value,
        description: document.getElementById('transDescription').value,
        date: document.getElementById('transDate').value,
        card: document.getElementById('transCard').value
    };
    
    transactions.unshift(transaction);
    saveTransactions();
    closeModal();
    updateDashboard();
    renderTransactions();
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;
    
    tbody.innerHTML = transactions.map(t => `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td><span class="transaction-type ${t.type}">${t.type}</span></td>
            <td>${t.category}</td>
            <td>${t.description}</td>
            <td>${t.card || '-'}</td>
            <td class="${t.type === 'entrada' ? 'positive' : 'negative'}">
                ${formatCurrency(t.value)}
            </td>
            <td>
                <button onclick="deleteTransaction(${t.id})" class="btn-icon">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function deleteTransaction(id) {
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions();
        updateDashboard();
        renderTransactions();
    }
}

function filterTransactions() {
    const searchTerm = document.querySelector('.search-input').value.toLowerCase();
    const filterType = document.querySelector('.filter-select').value.toLowerCase();
    
    const filtered = transactions.filter(t => {
        const matchSearch = !searchTerm || 
            t.description.toLowerCase().includes(searchTerm) ||
            t.category.toLowerCase().includes(searchTerm);
        const matchType = filterType === 'todas' || 
            (filterType === 'entradas' && t.type === 'entrada') ||
            (filterType === 'saídas' && t.type === 'saida');
        
        return matchSearch && matchType;
    });
    
    const tbody = document.getElementById('transactionsBody');
    tbody.innerHTML = filtered.map(t => `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td><span class="transaction-type ${t.type}">${t.type}</span></td>
            <td>${t.category}</td>
            <td>${t.description}</td>
            <td>${t.card || '-'}</td>
            <td class="${t.type === 'entrada' ? 'positive' : 'negative'}">
                ${formatCurrency(t.value)}
            </td>
            <td>
                <button onclick="deleteTransaction(${t.id})" class="btn-icon">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Card Functions
function openCardModal() {
    // Implement card modal
    alert('Funcionalidade de adicionar cartão em desenvolvimento!');
}

function renderCards() {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    
    grid.innerHTML = cards.map(card => `
        <div class="credit-card">
            <div class="card-header">
                <h3>${card.name}</h3>
                <i class="fas fa-credit-card"></i>
            </div>
            <div class="card-body">
                <p class="card-number">**** **** **** 4532</p>
                <div class="card-info">
                    <div>
                        <small>Limite</small>
                        <p>${formatCurrency(card.limit)}</p>
                    </div>
                    <div>
                        <small>Gasto</small>
                        <p>${formatCurrency(card.spent)}</p>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(card.spent / card.limit) * 100}%; background: ${card.color}"></div>
                </div>
            </div>
        </div>
    `).join('');
}

function updateCardSelect() {
    const select = document.getElementById('transCard');
    if (!select) return;
    
    select.innerHTML = '<option value="">Nenhum</option>' +
        cards.map(card => `<option value="${card.name}">${card.name}</option>`).join('');
}

// Analytics Functions
function updateAnalytics() {
    // Monthly comparison chart
    const months = getLastMonths(6);
    const monthlyData = months.map(month => {
        const monthTransactions = transactions.filter(t => t.date.startsWith(month));
        return {
            income: monthTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + t.value, 0),
            expense: monthTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + t.value, 0)
        };
    });
    
    updateChart('monthlyComparison', {
        labels: months.map(m => {
            const [year, month] = m.split('-');
            return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'short' });
        }),
        datasets: [
            {
                label: 'Entradas',
                data: monthlyData.map(d => d.income),
                backgroundColor: 'rgba(76, 175, 80, 0.8)',
                borderColor: '#4CAF50',
                borderWidth: 2
            },
            {
                label: 'Saídas',
                data: monthlyData.map(d => d.expense),
                backgroundColor: 'rgba(244, 67, 54, 0.8)',
                borderColor: '#F44336',
                borderWidth: 2
            }
        ]
    }, 'bar');
    
    // Top categories
    const categories = {};
    transactions
        .filter(t => t.type === 'saida')
        .forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + t.value;
        });
    
    const sortedCategories = Object.entries(categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    
    updateChart('topCategories', {
        labels: sortedCategories.map(([name]) => name),
        datasets: [{
            label: 'Total Gasto',
            data: sortedCategories.map(([,value]) => value),
            backgroundColor: 'rgba(108, 99, 255, 0.8)',
            borderColor: '#6C63FF',
            borderWidth: 2
        }]
    }, 'bar');
    
    // Spending distribution
    updateChart('spendingDistribution', {
        labels: sortedCategories.map(([name]) => name),
        datasets: [{
            label: 'Distribuição de Gastos',
            data: sortedCategories.map(([,value]) => value),
            backgroundColor: 'rgba(255, 152, 0, 0.2)',
            borderColor: '#FF9800',
            borderWidth: 2,
            pointBackgroundColor: '#FF9800'
        }]
    }, 'radar');
}

// Budget Functions
function openBudgetModal() {
    alert('Funcionalidade de orçamento em desenvolvimento!');
}

function renderBudgets() {
    // Implement budget rendering
}

// Google Sheets Integration
async function syncWithSheets() {
    try {
        // Upload to Google Sheets
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'sync',
                data: transactions
            })
        });
        
        // Download from Google Sheets
        const downloadResponse = await fetch(`${GOOGLE_SHEETS_URL}?action=get`);
        const data = await downloadResponse.json();
        
        if (data && data.transactions) {
            transactions = data.transactions;
            saveTransactions();
            updateDashboard();
            renderTransactions();
            alert('Sincronização realizada com sucesso!');
        }
    } catch (error) {
        console.error('Erro na sincronização:', error);
        alert('Erro ao sincronizar com Google Sheets. Verifique a configuração.');
    }
}

// Utility Functions
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');
}

function getLastMonths(count) {
    const months = [];
    const today = new Date();
    
    for (let i = count - 1; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(date.toISOString().slice(0, 7));
    }
    
    return months;
}

// Modal Functions
function openAddModal() {
    document.getElementById('transactionModal').classList.add('active');
    document.getElementById('transDate').value = new Date().toISOString().slice(0, 10);
    updateCardSelect();
}

function closeModal() {
    document.getElementById('transactionModal').classList.remove('active');
    document.getElementById('transactionForm').reset();
}

function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

function saveCards() {
    localStorage.setItem('cards', JSON.stringify(cards));
}

function saveBudgets() {
    localStorage.setItem('budgets', JSON.stringify(budgets));
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('transactionModal');
    if (event.target === modal) {
        closeModal();
    }
}
