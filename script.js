// Configuração - Substitua pela URL do seu Google Sheets
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/library/d/1chkzlgzb_3rplo5LXaJgQ0Rixt7DLfctsxkOkUlhasbwygyAAsYApZdF/1';
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
        const today = new Date();
        const currentMonth = today.toISOString().slice(0, 7);
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 7);
        
        transactions = [
            { 
                id: 1, 
                type: 'entrada', 
                value: 5000, 
                category: 'Salário', 
                description: 'Salário do mês', 
                date: `${currentMonth}-05`, 
                card: '' 
            },
            { 
                id: 2, 
                type: 'saida', 
                value: 1500, 
                category: 'Alimentação', 
                description: 'Supermercado mensal', 
                date: `${currentMonth}-10`, 
                card: 'Visa' 
            },
            { 
                id: 3, 
                type: 'saida', 
                value: 800, 
                category: 'Transporte', 
                description: 'Combustível', 
                date: `${currentMonth}-15`, 
                card: 'MasterCard' 
            },
            { 
                id: 4, 
                type: 'entrada', 
                value: 2000, 
                category: 'Freelance', 
                description: 'Projeto Web Design', 
                date: `${currentMonth}-20`, 
                card: '' 
            },
            { 
                id: 5, 
                type: 'saida', 
                value: 1200, 
                category: 'Moradia', 
                description: 'Aluguel', 
                date: `${currentMonth}-05`, 
                card: '' 
            },
            { 
                id: 6, 
                type: 'saida', 
                value: 300, 
                category: 'Lazer', 
                description: 'Cinema e jantar', 
                date: `${currentMonth}-12`, 
                card: 'Visa' 
            },
            { 
                id: 7, 
                type: 'entrada', 
                value: 3000, 
                category: 'Salário', 
                description: 'Salário mês anterior', 
                date: `${lastMonth}-05`, 
                card: '' 
            },
        ];
        saveTransactions();
    }
    
    if (cards.length === 0) {
        cards = [
            { id: 1, name: 'Visa', limit: 5000, spent: 1800, color: '#667eea' },
            { id: 2, name: 'MasterCard', limit: 3000, spent: 800, color: '#f093fb' },
            { id: 3, name: 'Nubank', limit: 4000, spent: 0, color: '#8A05BE' },
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
    const searchInput = document.querySelector('.search-input');
    const filterSelect = document.querySelector('.filter-select');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterTransactions);
    }
    
    if (filterSelect) {
        filterSelect.addEventListener('change', filterTransactions);
    }
    
    // Fechar modal com tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
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
    
    // Update specific pages with animations
    setTimeout(() => {
        switch(page) {
            case 'dashboard':
                updateDashboard();
                break;
            case 'transactions':
                renderTransactions();
                break;
            case 'cards':
                renderCards();
                break;
            case 'analytics':
                updateAnalytics();
                break;
            case 'budget':
                renderBudgets();
                break;
        }
    }, 100);
}

// Dashboard Functions
function updateDashboard() {
    const selectedMonth = document.getElementById('monthFilter').value;
    const monthTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));
    
    // Calculate totals
    const income = monthTransactions
        .filter(t => t.type === 'entrada')
        .reduce((sum, t) => sum + parseFloat(t.value), 0);
    
    const expense = monthTransactions
        .filter(t => t.type === 'saida')
        .reduce((sum, t) => sum + parseFloat(t.value), 0);
    
    const balance = income - expense;
    const savingsRate = income > 0 ? ((balance / income) * 100) : 0;
    
    // Previous month comparison
    const previousMonth = getPreviousMonth(selectedMonth);
    const previousTransactions = transactions.filter(t => t.date.startsWith(previousMonth));
    const previousExpense = previousTransactions
        .filter(t => t.type === 'saida')
        .reduce((sum, t) => sum + parseFloat(t.value), 0);
    
    const expenseChange = previousExpense > 0 ? ((expense - previousExpense) / previousExpense) * 100 : 0;
    const previousIncome = previousTransactions
        .filter(t => t.type === 'entrada')
        .reduce((sum, t) => sum + parseFloat(t.value), 0);
    
    const incomeChange = previousIncome > 0 ? ((income - previousIncome) / previousIncome) * 100 : 0;
    
    // Update summary cards with animations
    animateValue('totalIncome', formatCurrency(income));
    animateValue('totalExpense', formatCurrency(expense));
    animateValue('totalBalance', formatCurrency(balance));
    document.getElementById('savingsRate').textContent = `${savingsRate.toFixed(1)}%`;
    
    // Update trends
    updateTrendElement('incomeTrend', incomeChange, 'entrada');
    updateTrendElement('expenseTrend', expenseChange, 'saida');
    
    // Update balance trend
    const trendElement = document.getElementById('balanceTrend');
    if (balance >= 0) {
        trendElement.textContent = 'Saldo positivo';
        trendElement.className = 'card-trend positive';
    } else {
        trendElement.textContent = 'Saldo negativo';
        trendElement.className = 'card-trend negative';
    }
    
    updateCharts(monthTransactions);
}

function updateTrendElement(elementId, change, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const isPositive = (type === 'entrada') ? change >= 0 : change <= 0;
    const icon = change >= 0 ? '↑' : '↓';
    
    element.textContent = `${icon} ${Math.abs(change).toFixed(1)}% vs mês anterior`;
    element.className = `card-trend ${isPositive ? 'positive' : 'negative'}`;
}

function getPreviousMonth(selectedMonth) {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    return date.toISOString().slice(0, 7);
}

function animateValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Simple animation
    element.style.transform = 'scale(1.1)';
    element.style.transition = 'transform 0.2s ease';
    element.textContent = value;
    
    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 200);
}

function updateCharts(monthTransactions) {
    const selectedMonth = document.getElementById('monthFilter').value;
    
    // Cashflow Chart
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const dailyData = Array.from({length: daysInMonth}, (_, i) => {
        const day = i + 1;
        const dayStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
        const dayTransactions = monthTransactions.filter(t => t.date === dayStr);
        return {
            income: dayTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value), 0),
            expense: dayTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value), 0)
        };
    });
    
    updateChart('cashflowChart', {
        labels: Array.from({length: daysInMonth}, (_, i) => `Dia ${i + 1}`),
        datasets: [
            {
                label: 'Entradas',
                data: dailyData.map(d => d.income),
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6
            },
            {
                label: 'Saídas',
                data: dailyData.map(d => d.expense),
                borderColor: '#F44336',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6
            }
        ]
    });
    
    // Category Chart
    const categories = {};
    monthTransactions
        .filter(t => t.type === 'saida')
        .forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + parseFloat(t.value);
        });
    
    if (Object.keys(categories).length > 0) {
        updateChart('categoryChart', {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                    '#FF9F40', '#FF6384', '#C9CBCF', '#7BC8A4', '#E8C3B9'
                ],
                borderWidth: 2,
                borderColor: '#16213e'
            }]
        }, 'doughnut');
    }
    
    // Cards Chart
    const cardSpending = {};
    monthTransactions
        .filter(t => t.type === 'saida' && t.card)
        .forEach(t => {
            cardSpending[t.card] = (cardSpending[t.card] || 0) + parseFloat(t.value);
        });
    
    if (Object.keys(cardSpending).length > 0) {
        updateChart('cardChart', {
            labels: Object.keys(cardSpending),
            datasets: [{
                data: Object.values(cardSpending),
                backgroundColor: ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'],
                borderWidth: 2,
                borderColor: '#16213e'
            }]
        }, 'pie');
    }
}

// Chart Functions
function initializeCharts() {
    // Configuração global do Chart.js
    Chart.defaults.color = '#b3b3b3';
    Chart.defaults.borderColor = 'rgba(42, 42, 74, 0.5)';
    
    const activePage = document.querySelector('.page.active');
    if (!activePage || activePage.id !== 'dashboard-page') return;
    
    const chartConfigs = {
        cashflow: { canvas: 'cashflowChart', type: 'line' },
        category: { canvas: 'categoryChart', type: 'doughnut' },
        card: { canvas: 'cardChart', type: 'pie' }
    };
    
    Object.entries(chartConfigs).forEach(([key, config]) => {
        const canvas = document.getElementById(config.canvas);
        if (canvas && !charts[key]) {
            const ctx = canvas.getContext('2d');
            charts[key] = new Chart(ctx, {
                type: config.type,
                data: { labels: [], datasets: [] },
                options: getChartOptions(config.type)
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
    
    const ctx = canvas.getContext('2d');
    charts[chartId] = new Chart(ctx, {
        type: type,
        data: data,
        options: getChartOptions(type)
    });
}

function getChartOptions(type = 'line') {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#b3b3b3',
                    padding: 15,
                    font: { 
                        size: 12,
                        family: "'Segoe UI', sans-serif"
                    },
                    usePointStyle: true,
                    pointStyleWidth: 10
                }
            },
            tooltip: {
                backgroundColor: 'rgba(22, 33, 62, 0.95)',
                padding: 12,
                titleFont: {
                    size: 14,
                    weight: 'bold'
                },
                bodyFont: {
                    size: 13
                },
                borderColor: '#6C63FF',
                borderWidth: 1
            }
        }
    };
    
    if (type === 'line' || type === 'bar') {
        options.scales = {
            y: {
                beginAtZero: true,
                grid: { 
                    color: 'rgba(42, 42, 74, 0.5)',
                    drawBorder: false
                },
                ticks: { 
                    color: '#b3b3b3',
                    callback: function(value) {
                        return 'R$ ' + value.toLocaleString('pt-BR');
                    }
                }
            },
            x: {
                grid: { display: false },
                ticks: { 
                    color: '#b3b3b3',
                    maxTicksLimit: 10
                }
            }
        };
    }
    
    return options;
}

// Transaction Functions
function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const type = document.getElementById('transType').value;
    const valueInput = document.getElementById('transValue').value;
    const category = document.getElementById('transCategory').value;
    const description = document.getElementById('transDescription').value;
    const date = document.getElementById('transDate').value;
    const card = document.getElementById('transCard').value;
    
    // Validações
    if (!valueInput || parseFloat(valueInput) <= 0) {
        alert('Por favor, insira um valor válido maior que zero.');
        return;
    }
    
    if (!category) {
        alert('Por favor, selecione uma categoria.');
        return;
    }
    
    if (!description.trim()) {
        alert('Por favor, insira uma descrição.');
        return;
    }
    
    if (!date) {
        alert('Por favor, selecione uma data.');
        return;
    }
    
    const transaction = {
        id: Date.now(),
        type: type,
        value: parseFloat(valueInput),
        category: category,
        description: description.trim(),
        date: date,
        card: card
    };
    
    transactions.unshift(transaction);
    saveTransactions();
    closeModal();
    updateDashboard();
    
    if (document.getElementById('transactions-page').classList.contains('active')) {
        renderTransactions();
    }
    
    // Feedback visual
    showNotification('Transação adicionada com sucesso!', 'success');
}

function showNotification(message, type = 'success') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;
    
    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <i class="fas fa-receipt" style="font-size: 48px; color: #6C63FF; margin-bottom: 16px; display: block;"></i>
                    <p style="color: #b3b3b3;">Nenhuma transação encontrada</p>
                    <button class="btn-add" onclick="openAddModal()" style="margin-top: 16px;">
                        <i class="fas fa-plus"></i> Adicionar Primeira Transação
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = transactions.map(t => `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td>
                <span class="transaction-type ${t.type}">
                    <i class="fas fa-arrow-${t.type === 'entrada' ? 'up' : 'down'}"></i>
                    ${t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                </span>
            </td>
            <td>
                <span class="category-badge">
                    <i class="fas fa-${getCategoryIcon(t.category)}"></i>
                    ${t.category}
                </span>
            </td>
            <td>${t.description}</td>
            <td>${t.card ? `<span class="card-badge">💳 ${t.card}</span>` : '<span class="no-card">-</span>'}</td>
            <td class="transaction-value ${t.type === 'entrada' ? 'positive' : 'negative'}">
                ${t.type === 'entrada' ? '+' : '-'} ${formatCurrency(t.value)}
            </td>
            <td>
                <div class="action-buttons">
                    <button onclick="editTransaction(${t.id})" class="btn-icon" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTransaction(${t.id})" class="btn-icon btn-delete" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getCategoryIcon(category) {
    const icons = {
        'Salário': 'money-bill-wave',
        'Freelance': 'laptop-code',
        'Investimentos': 'chart-line',
        'Alimentação': 'utensils',
        'Transporte': 'car',
        'Moradia': 'home',
        'Lazer': 'gamepad',
        'Saúde': 'heartbeat',
        'Educação': 'book',
        'Outros': 'ellipsis-h'
    };
    return icons[category] || 'tag';
}

function editTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;
    
    openAddModal();
    
    // Preencher formulário
    document.getElementById('transType').value = transaction.type;
    document.getElementById('transValue').value = transaction.value;
    document.getElementById('transCategory').value = transaction.category;
    document.getElementById('transDescription').value = transaction.description;
    document.getElementById('transDate').value = transaction.date;
    document.getElementById('transCard').value = transaction.card;
    
    // Remover transação antiga
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
}

function deleteTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;
    
    if (confirm(`Tem certeza que deseja excluir esta transação?\n\n${transaction.description}\nValor: ${formatCurrency(transaction.value)}`)) {
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions();
        updateDashboard();
        renderTransactions();
        showNotification('Transação excluída com sucesso!', 'success');
    }
}

function filterTransactions() {
    const searchTerm = document.querySelector('.search-input')?.value.toLowerCase() || '';
    const filterType = document.querySelector('.filter-select')?.value.toLowerCase() || 'todas';
    
    let filtered = transactions;
    
    // Aplicar filtro de tipo
    if (filterType === 'entradas') {
        filtered = filtered.filter(t => t.type === 'entrada');
    } else if (filterType === 'saídas') {
        filtered = filtered.filter(t => t.type === 'saida');
    }
    
    // Aplicar busca
    if (searchTerm) {
        filtered = filtered.filter(t => 
            t.description.toLowerCase().includes(searchTerm) ||
            t.category.toLowerCase().includes(searchTerm) ||
            (t.card && t.card.toLowerCase().includes(searchTerm)) ||
            formatCurrency(t.value).includes(searchTerm) ||
            formatDate(t.date).includes(searchTerm)
        );
    }
    
    // Ordenar por data (mais recente primeiro)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;
    
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <i class="fas fa-search" style="font-size: 48px; color: #6C63FF; margin-bottom: 16px; display: block;"></i>
                    <p style="color: #b3b3b3;">Nenhuma transação encontrada</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filtered.map(t => `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td>
                <span class="transaction-type ${t.type}">
                    <i class="fas fa-arrow-${t.type === 'entrada' ? 'up' : 'down'}"></i>
                    ${t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                </span>
            </td>
            <td>
                <span class="category-badge">
                    <i class="fas fa-${getCategoryIcon(t.category)}"></i>
                    ${t.category}
                </span>
            </td>
            <td>${t.description}</td>
            <td>${t.card ? `<span class="card-badge">💳 ${t.card}</span>` : '<span class="no-card">-</span>'}</td>
            <td class="transaction-value ${t.type === 'entrada' ? 'positive' : 'negative'}">
                ${t.type === 'entrada' ? '+' : '-'} ${formatCurrency(t.value)}
            </td>
            <td>
                <div class="action-buttons">
                    <button onclick="editTransaction(${t.id})" class="btn-icon" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTransaction(${t.id})" class="btn-icon btn-delete" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Card Functions
function openCardModal() {
    const modalHTML = `
        <div class="modal active" id="cardModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Novo Cartão</h2>
                    <button class="close-modal" onclick="document.getElementById('cardModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="cardForm">
                    <div class="form-group">
                        <label>Nome do Cartão</label>
                        <input type="text" id="cardName" required placeholder="Ex: Visa, MasterCard, Nubank">
                    </div>
                    <div class="form-group">
                        <label>Limite</label>
                        <input type="number" id="cardLimit" step="0.01" required placeholder="0,00">
                    </div>
                    <div class="form-group">
                        <label>Cor (opcional)</label>
                        <input type="color" id="cardColor" value="#6C63FF">
                    </div>
                    <button type="submit" class="btn-submit">Salvar Cartão</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.getElementById('cardForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const card = {
            id: Date.now(),
            name: document.getElementById('cardName').value,
            limit: parseFloat(document.getElementById('cardLimit').value),
            spent: 0,
            color: document.getElementById('cardColor').value
        };
        
        cards.push(card);
        saveCards();
        updateCardSelect();
        renderCards();
        document.getElementById('cardModal').remove();
        showNotification('Cartão adicionado com sucesso!', 'success');
    });
}

function renderCards() {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    
    if (cards.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <i class="fas fa-credit-card" style="font-size: 64px; color: #6C63FF; margin-bottom: 20px; display: block;"></i>
                <h3 style="color: #b3b3b3; margin-bottom: 16px;">Nenhum cartão cadastrado</h3>
                <button class="btn-add" onclick="openCardModal()">
                    <i class="fas fa-plus"></i> Adicionar Cartão
                </button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = cards.map(card => {
        const usagePercent = card.limit > 0 ? (card.spent / card.limit) * 100 : 0;
        const available = card.limit - card.spent;
        
        return `
            <div class="credit-card" style="background: linear-gradient(135deg, ${card.color} 0%, ${adjustColor(card.color, -30)} 100%);">
                <div class="card-chip">
                    <i class="fas fa-sim-card"></i>
                </div>
                <div class="card-details">
                    <h3 class="card-name">${card.name}</h3>
                    <p class="card-number">•••• •••• •••• ${Math.floor(Math.random() * 9000) + 1000}</p>
                    <div class="card-info-grid">
                        <div class="card-info-item">
                            <small>Limite</small>
                            <p>${formatCurrency(card.limit)}</p>
                        </div>
                        <div class="card-info-item">
                            <small>Disponível</small>
                            <p>${formatCurrency(available)}</p>
                        </div>
                        <div class="card-info-item">
                            <small>Gasto</small>
                            <p>${formatCurrency(card.spent)}</p>
                        </div>
                    </div>
                    <div class="card-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${usagePercent}%; background: white;"></div>
                        </div>
                        <span class="progress-text">${usagePercent.toFixed(1)}% utilizado</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button onclick="deleteCard(${card.id})" class="btn-card-action" title="Remover cartão">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Adicionar card de "Adicionar novo"
    grid.insertAdjacentHTML('beforeend', `
        <div class="credit-card add-card" onclick="openCardModal()" style="
            background: linear-gradient(135deg, rgba(108, 99, 255, 0.1) 0%, rgba(108, 99, 255, 0.05) 100%);
            border: 2px dashed #6C63FF;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 200px;
        ">
            <div style="text-align: center;">
                <i class="fas fa-plus-circle" style="font-size: 48px; color: #6C63FF; margin-bottom: 12px;"></i>
                <p style="color: #6C63FF; font-weight: 600;">Adicionar Cartão</p>
            </div>
        </div>
    `);
}

function adjustColor(color, amount) {
    // Função simples para escurecer uma cor hex
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) + amount);
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) + amount);
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function deleteCard(id) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    
    if (confirm(`Tem certeza que deseja remover o cartão ${card.name}?`)) {
        cards = cards.filter(c => c.id !== id);
        saveCards();
        updateCardSelect();
        renderCards();
        showNotification('Cartão removido com sucesso!', 'success');
    }
}

function updateCardSelect() {
    const select = document.getElementById('transCard');
    if (!select) return;
    
    select.innerHTML = '<option value="">Nenhum cartão</option>' +
        cards.map(card => `<option value="${card.name}">${card.name}</option>`).join('');
}

function updateCardSpending() {
    // Atualizar gastos dos cartões baseado nas transações
    cards.forEach(card => {
        card.spent = transactions
            .filter(t => t.type === 'saida' && t.card === card.name)
            .reduce((sum, t) => sum + parseFloat(t.value), 0);
    });
    saveCards();
}

// Analytics Functions
function updateAnalytics() {
    initializeAnalyticsCharts();
    
    // Monthly comparison chart
    const months = getLastMonths(6);
    const monthlyData = months.map(month => {
        const monthTransactions = transactions.filter(t => t.date.startsWith(month));
        return {
            income: monthTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value), 0),
            expense: monthTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value), 0)
        };
    });
    
    updateChart('monthlyComparison', {
        labels: months.map(m => {
            const [year, month] = m.split('-');
            return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        }),
        datasets: [
            {
                label: 'Entradas',
                data: monthlyData.map(d => d.income),
                backgroundColor: 'rgba(76, 175, 80, 0.6)',
                borderColor: '#4CAF50',
                borderWidth: 2,
                borderRadius: 8
            },
            {
                label: 'Saídas',
                data: monthlyData.map(d => d.expense),
                backgroundColor: 'rgba(244, 67, 54, 0.6)',
                borderColor: '#F44336',
                borderWidth: 2,
                borderRadius: 8
            }
        ]
    }, 'bar');
    
    // Top categories
    const categories = {};
    transactions
        .filter(t => t.type === 'saida')
        .forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + parseFloat(t.value);
        });
    
    const sortedCategories = Object.entries(categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);
    
    updateChart('topCategories', {
        labels: sortedCategories.map(([name]) => name),
        datasets: [{
            label: 'Total Gasto',
            data: sortedCategories.map(([,value]) => value),
            backgroundColor: sortedCategories.map((_, i) => {
                const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC8A4'];
                return colors[i];
            }),
            borderWidth: 0,
            borderRadius: 8
        }]
    }, 'bar');
    
    // Spending distribution (radar chart)
    const top5Categories = sortedCategories.slice(0, 5);
    
    updateChart('spendingDistribution', {
        labels: top5Categories.map(([name]) => name),
        datasets: [{
            label: 'Gastos',
            data: top5Categories.map(([,value]) => value),
            backgroundColor: 'rgba(108, 99, 255, 0.2)',
            borderColor: '#6C63FF',
            borderWidth: 2,
            pointBackgroundColor: '#6C63FF',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#6C63FF'
        }]
    }, 'radar');
}

function initializeAnalyticsCharts() {
    const chartConfigs = {
        monthlyComparison: { canvas: 'monthlyComparison', type: 'bar' },
        topCategories: { canvas: 'topCategories', type: 'bar' },
        spendingDistribution: { canvas: 'spendingDistribution', type: 'radar' }
    };
    
    Object.entries(chartConfigs).forEach(([key, config]) => {
        const canvas = document.getElementById(config.canvas);
        if (canvas && !charts[key]) {
            const ctx = canvas.getContext('2d');
            charts[key] = new Chart(ctx, {
                type: config.type,
                data: { labels: [], datasets: [] },
                options: getChartOptions(config.type)
            });
        }
    });
}

// Budget Functions
function openBudgetModal() {
    const modalHTML = `
        <div class="modal active" id="budgetModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Novo Orçamento</h2>
                    <button class="close-modal" onclick="document.getElementById('budgetModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="budgetForm">
                    <div class="form-group">
                        <label>Categoria</label>
                        <select id="budgetCategory" required>
                            <option value="">Selecione...</option>
                            <option>Alimentação</option>
                            <option>Transporte</option>
                            <option>Moradia</option>
                            <option>Lazer</option>
                            <option>Saúde</option>
                            <option>Educação</option>
                            <option>Outros</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Valor Planejado</label>
                        <input type="number" id="budgetAmount" step="0.01" required placeholder="0,00">
                    </div>
                    <div class="form-group">
                        <label>Mês</label>
                        <input type="month" id="budgetMonth" required>
                    </div>
                    <button type="submit" class="btn-submit">Salvar Orçamento</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.getElementById('budgetMonth').value = document.getElementById('monthFilter').value;
    
    document.getElementById('budgetForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const budget = {
            id: Date.now(),
            category: document.getElementById('budgetCategory').value,
            amount: parseFloat(document.getElementById('budgetAmount').value),
            month: document.getElementById('budgetMonth').value
        };
        
        budgets.push(budget);
        saveBudgets();
        renderBudgets();
        document.getElementById('budgetModal').remove();
        showNotification('Orçamento criado com sucesso!', 'success');
    });
}

function renderBudgets() {
    const grid = document.getElementById('budgetGrid');
    if (!grid) return;
    
    const currentMonth = document.getElementById('monthFilter').value;
    const monthBudgets = budgets.filter(b => b.month === currentMonth);
    
    if (monthBudgets.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <i class="fas fa-wallet" style="font-size: 64px; color: #6C63FF; margin-bottom: 20px; display: block;"></i>
                <h3 style="color: #b3b3b3; margin-bottom: 16px;">Nenhum orçamento definido</h3>
                <button class="btn-add" onclick="openBudgetModal()">
                    <i class="fas fa-plus"></i> Criar Orçamento
                </button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = monthBudgets.map(budget => {
        const spent = transactions
            .filter(t => t.type === 'saida' && 
                        t.category === budget.category && 
                        t.date.startsWith(currentMonth))
            .reduce((sum, t) => sum + parseFloat(t.value), 0);
        
        const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
        const remaining = budget.amount - spent;
        const status = percentUsed > 100 ? 'exceeded' : percentUsed > 80 ? 'warning' : 'good';
        
        return `
            <div class="budget-item">
                <div class="budget-header">
                    <h3>
                        <i class="fas fa-${getCategoryIcon(budget.category)}"></i>
                        ${budget.category}
                    </h3>
                    <span class="budget-status status-${status}">
                        ${status === 'exceeded' ? 'Estourado' : status === 'warning' ? 'Atenção' : 'No prazo'}
                    </span>
                </div>
                <div class="budget-details">
                    <div class="budget-info">
                        <div>
                            <small>Planejado</small>
                            <p>${formatCurrency(budget.amount)}</p>
                        </div>
                        <div>
                            <small>Gasto</small>
                            <p class="${status === 'exceeded' ? 'negative' : ''}">${formatCurrency(spent)}</p>
                        </div>
                        <div>
                            <small>Restante</small>
                            <p class="${remaining < 0 ? 'negative' : 'positive'}">${formatCurrency(Math.abs(remaining))}</p>
                        </div>
                    </div>
                    <div class="budget-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="
                                width: ${Math.min(percentUsed, 100)}%;
                                background: ${status === 'exceeded' ? '#F44336' : status === 'warning' ? '#FF9800' : '#4CAF50'}
                            "></div>
                        </div>
                        <span class="progress-percent">${percentUsed.toFixed(1)}%</span>
                    </div>
                </div>
                <button onclick="deleteBudget(${budget.id})" class="btn-icon btn-delete" style="position: absolute; top: 16px; right: 16px;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

function deleteBudget(id) {
    if (confirm('Tem certeza que deseja excluir este orçamento?')) {
        budgets = budgets.filter(b => b.id !== id);
        saveBudgets();
        renderBudgets();
        showNotification('Orçamento excluído com sucesso!', 'success');
    }
}

// Google Sheets Integration - Versão Corrigida
async function syncWithSheets() {
    const syncButton = document.querySelector('.btn-sync');
    const originalText = syncButton.innerHTML;
    
    try {
        // Atualizar interface
        syncButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        syncButton.disabled = true;
        
        console.log('🔄 Iniciando sincronização...');
        console.log('📡 URL:', GOOGLE_SHEETS_URL);
        
        // Primeiro, vamos testar a conexão fazendo um GET
        console.log('🔍 Testando conexão...');
        const testResponse = await fetch(`${GOOGLE_SHEETS_URL}?action=get`);
        
        if (!testResponse.ok) {
            throw new Error(`Erro HTTP: ${testResponse.status} - ${testResponse.statusText}`);
        }
        
        const testData = await testResponse.json();
        console.log('✅ Resposta do teste:', testData);
        
        if (!testData.success && testData.error) {
            throw new Error(`Erro do servidor: ${testData.error}`);
        }
        
        // Preparar dados para envio
        const syncData = {
            action: 'sync',
            data: transactions.map(t => ({
                date: t.date,
                type: t.type,
                category: t.category,
                description: t.description,
                value: t.value,
                card: t.card || ''
            }))
        };
        
        console.log('📤 Enviando dados:', syncData.data.length, 'transações');
        
        // Enviar dados via POST
        const uploadResponse = await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(syncData)
        });
        
        if (!uploadResponse.ok) {
            throw new Error(`Erro HTTP no upload: ${uploadResponse.status}`);
        }
        
        const uploadResult = await uploadResponse.json();
        console.log('📥 Resultado do upload:', uploadResult);
        
        if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Erro ao enviar dados');
        }
        
        // Agora baixar os dados atualizados
        console.log('📥 Baixando dados atualizados...');
        const downloadResponse = await fetch(`${GOOGLE_SHEETS_URL}?action=get`);
        const downloadData = await downloadResponse.json();
        
        console.log('💾 Dados baixados:', downloadData);
        
        if (downloadData.success && downloadData.transactions) {
            // Converter dados do sheets para o formato local
            const oldCount = transactions.length;
            
            transactions = downloadData.transactions
                .filter(t => t.date || t.data) // Filtrar transações com data
                .map((t, index) => ({
                    id: Date.now() + index,
                    type: (t.tipo || t.type || 'saida').toLowerCase(),
                    value: parseFloat(t.valor || t.value) || 0,
                    category: t.categoria || t.category || 'Outros',
                    description: t.descrição || t.description || '',
                    date: t.data || t.date || new Date().toISOString().split('T')[0],
                    card: t.cartão || t.card || ''
                }));
            
            saveTransactions();
            updateDashboard();
            renderTransactions();
            updateCardSpending();
            
            const newCount = transactions.length;
            showNotification(
                `✅ Sincronização realizada!\n${uploadResult.count || newCount} transações sincronizadas.`,
                'success'
            );
            
            console.log('✨ Sincronização concluída com sucesso!');
            console.log(`📊 Transações: ${oldCount} → ${newCount}`);
        } else {
            throw new Error('Erro ao baixar dados atualizados');
        }
        
    } catch (error) {
        console.error('❌ Erro detalhado na sincronização:', error);
        
        // Tentar método alternativo (GET com dados na URL)
        try {
            console.log('🔄 Tentando método alternativo (GET)...');
            
            const dataParam = encodeURIComponent(JSON.stringify(transactions.map(t => ({
                date: t.date,
                type: t.type,
                category: t.category,
                description: t.description,
                value: t.value,
                card: t.card || ''
            }))));
            
            const altUrl = `${GOOGLE_SHEETS_URL}?action=sync&data=${dataParam}`;
            console.log('📡 URL alternativa:', altUrl.substring(0, 100) + '...');
            
            const altResponse = await fetch(altUrl);
            const altResult = await altResponse.json();
            
            console.log('📥 Resultado alternativo:', altResult);
            
            if (altResult.success) {
                showNotification('✅ Sincronização realizada com método alternativo!', 'success');
                
                // Atualizar dados locais
                const downloadResponse = await fetch(`${GOOGLE_SHEETS_URL}?action=get`);
                const downloadData = await downloadResponse.json();
                
                if (downloadData.success && downloadData.transactions) {
                    transactions = downloadData.transactions.map((t, index) => ({
                        id: Date.now() + index,
                        type: (t.tipo || t.type || 'saida').toLowerCase(),
                        value: parseFloat(t.valor || t.value) || 0,
                        category: t.categoria || t.category || 'Outros',
                        description: t.descrição || t.description || '',
                        date: t.data || t.date || new Date().toISOString().split('T')[0],
                        card: t.cartão || t.card || ''
                    }));
                    
                    saveTransactions();
                    updateDashboard();
                    renderTransactions();
                    updateCardSpending();
                }
                return;
            }
        } catch (altError) {
            console.error('❌ Erro no método alternativo:', altError);
        }
        
        alert(
            '❌ Erro ao sincronizar com Google Sheets\n\n' +
            `Erro: ${error.message}\n\n` +
            'Verifique:\n' +
            '1. Se a planilha "Transações" existe na planilha\n' +
            '2. Se o Apps Script foi implantado como "Aplicativo da Web"\n' +
            '3. Se as permissões estão configuradas (acesso: "Qualquer pessoa")\n' +
            '4. Se a URL do script está correta no código\n\n' +
            'Dicas:\n' +
            '- Abra o console (F12) para ver logs detalhados\n' +
            '- Teste a URL do script diretamente no navegador\n' +
            '- Verifique se a planilha tem os cabeçalhos corretos'
        );
    } finally {
        // Restaurar botão
        syncButton.innerHTML = originalText;
        syncButton.disabled = false;
    }
}

// Utility Functions
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Math.abs(value));
}

function formatDate(dateString) {
    if (!dateString) return '-';
    
    // Ajustar para o fuso horário local
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
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
    
    // Focar no primeiro campo
    setTimeout(() => {
        document.getElementById('transType').focus();
    }, 100);
}

function closeModal() {
    document.getElementById('transactionModal').classList.remove('active');
    document.getElementById('transactionForm').reset();
    document.getElementById('transDate').value = new Date().toISOString().slice(0, 10);
}

// Storage Functions
function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    updateCardSpending();
}

function saveCards() {
    localStorage.setItem('cards', JSON.stringify(cards));
}

function saveBudgets() {
    localStorage.setItem('budgets', JSON.stringify(budgets));
}

// Export/Import Functions
function exportData() {
    const data = {
        transactions,
        cards,
        budgets,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Dados exportados com sucesso!', 'success');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.transactions) {
                transactions = data.transactions;
                saveTransactions();
            }
            
            if (data.cards) {
                cards = data.cards;
                saveCards();
            }
            
            if (data.budgets) {
                budgets = data.budgets;
                saveBudgets();
            }
            
            updateDashboard();
            renderTransactions();
            renderCards();
            updateCardSelect();
            
            showNotification('Dados importados com sucesso!', 'success');
        } catch (error) {
            alert('Erro ao importar dados. Verifique se o arquivo é válido.');
            console.error('Erro na importação:', error);
        }
    };
    reader.readAsText(file);
}

// Atalhos de teclado
document.addEventListener('keydown', function(e) {
    // Ctrl + N = Nova transação
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openAddModal();
    }
    
    // Ctrl + S = Sincronizar
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        syncWithSheets();
    }
    
    // Ctrl + E = Exportar
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        exportData();
    }
});

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('transactionModal');
    if (event.target === modal) {
        closeModal();
    }
    
    // Fechar outros modais
    if (event.target.classList.contains('modal')) {
        event.target.remove();
    }
}

// Adicionar estilos para notificações e novos elementos
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        color: var(--text-primary);
        font-size: 14px;
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 400px;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification-success {
        border-left: 4px solid #4CAF50;
    }
    
    .notification-success i {
        color: #4CAF50;
        font-size: 20px;
    }
    
    .notification-error {
        border-left: 4px solid #F44336;
    }
    
    .notification-error i {
        color: #F44336;
        font-size: 20px;
    }
    
    .category-badge {
        background: rgba(108, 99, 255, 0.1);
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    
    .card-badge {
        background: rgba(255, 152, 0, 0.1);
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        color: #FF9800;
    }
    
    .no-card {
        color: #666;
        font-size: 14px;
    }
    
    .transaction-value.positive {
        color: #4CAF50;
        font-weight: 600;
    }
    
    .transaction-value.negative {
        color: #F44336;
        font-weight: 600;
    }
    
    .action-buttons {
        display: flex;
        gap: 8px;
    }
    
    .btn-icon {
        background: rgba(255, 255, 255, 0.05);
        border: none;
        color: var(--text-secondary);
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
    }
    
    .btn-icon:hover {
        background: rgba(108, 99, 255, 0.2);
        color: var(--primary);
    }
    
    .btn-delete:hover {
        background: rgba(244, 67, 54, 0.2);
        color: #F44336;
    }
    
    .credit-card {
        position: relative;
        padding: 32px;
        border-radius: 20px;
        color: white;
        min-height: 250px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    
    .card-chip {
        font-size: 32px;
        margin-bottom: 20px;
    }
    
    .card-name {
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 12px;
    }
    
    .card-number {
        font-size: 16px;
        letter-spacing: 4px;
        margin-bottom: 20px;
        opacity: 0.9;
    }
    
    .card-info-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 16px;
    }
    
    .card-info-item small {
        font-size: 11px;
        opacity: 0.7;
        display: block;
        margin-bottom: 4px;
    }
    
    .card-info-item p {
        font-size: 14px;
        font-weight: 600;
    }
    
    .card-progress {
        margin-top: 8px;
    }
    
    .progress-text {
        font-size: 11px;
        opacity: 0.8;
        margin-top: 4px;
        display: block;
    }
    
    .card-actions {
        position: absolute;
        top: 16px;
        right: 16px;
    }
    
    .btn-card-action {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
    }
    
    .btn-card-action:hover {
        background: rgba(255, 255, 255, 0.4);
    }
    
    .add-card {
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .add-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 12px 40px rgba(108, 99, 255, 0.2);
    }
    
    .budget-item {
        position: relative;
    }
    
    .budget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    
    .budget-header h3 {
        font-size: 18px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .budget-status {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
    }
    
    .status-good {
        background: rgba(76, 175, 80, 0.1);
        color: #4CAF50;
    }
    
    .status-warning {
        background: rgba(255, 152, 0, 0.1);
        color: #FF9800;
    }
    
    .status-exceeded {
        background: rgba(244, 67, 54, 0.1);
        color: #F44336;
    }
    
    .budget-info {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 20px;
    }
    
    .budget-info small {
        color: var(--text-secondary);
        font-size: 11px;
        display: block;
        margin-bottom: 4px;
    }
    
    .budget-info p {
        font-size: 16px;
        font-weight: 600;
    }
    
    .budget-progress {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .progress-percent {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-secondary);
        min-width: 50px;
    }
    
    .positive {
        color: #4CAF50 !important;
    }
    
    .negative {
        color: #F44336 !important;
    }
`;

document.head.appendChild(additionalStyles);

// Log de inicialização
console.log('🚀 Finance Dashboard iniciado com sucesso!');
console.log('💡 Dicas:');
console.log('  - Pressione Ctrl+N para nova transação');
console.log('  - Pressione Ctrl+S para sincronizar');
console.log('  - Pressione Ctrl+E para exportar dados');
console.log('  - Clique no botão "Sincronizar" para salvar no Google Sheets');
