// Configuração -Substitua pela URL do seu Google Sheets
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyuo2R6qdZZ9ylyLHuZah6VBNiBybCJ8gIfQ8lPWzv_kQx9GRk8mIkDtBWQbqY4dUkv/exec';
const SHEETS_LINK = 'https://docs.google.com/spreadsheets/d/1DdiyEwLlik9OvBA36xP9NYaTG_kTiDpQyDnXthCYqew/edit?usp=sharing';

// ============================================
// ESTADO DA APLICAÇÃO
// ============================================
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let cards = JSON.parse(localStorage.getItem('cards')) || [];
let budgets = JSON.parse(localStorage.getItem('budgets')) || [];
let charts = {};

// Configurações padrão
let settings = JSON.parse(localStorage.getItem('financeSettings')) || {
    types: [
        { id: 1, name: 'Entrada', icon: 'arrow-up', color: '#4CAF50', flow: 'entrada' },
        { id: 2, name: 'Saída', icon: 'arrow-down', color: '#F44336', flow: 'saida' },
        { id: 3, name: 'Investimento', icon: 'chart-line', color: '#2196F3', flow: 'entrada' },
        { id: 4, name: 'Transferência', icon: 'exchange-alt', color: '#FF9800', flow: 'ambos' }
    ],
    categories: [
        { id: 1, name: 'Salário', type: 'entrada', icon: 'money-bill-wave', color: '#4CAF50', budget: 0 },
        { id: 2, name: 'Freelance', type: 'entrada', icon: 'laptop-code', color: '#2196F3', budget: 0 },
        { id: 3, name: 'Investimentos', type: 'entrada', icon: 'chart-line', color: '#9C27B0', budget: 0 },
        { id: 4, name: 'Alimentação', type: 'saida', icon: 'utensils', color: '#FF6384', budget: 800 },
        { id: 5, name: 'Transporte', type: 'saida', icon: 'car', color: '#FF9F40', budget: 500 },
        { id: 6, name: 'Moradia', type: 'saida', icon: 'home', color: '#36A2EB', budget: 1500 },
        { id: 7, name: 'Lazer', type: 'saida', icon: 'gamepad', color: '#FFCE56', budget: 600 },
        { id: 8, name: 'Saúde', type: 'saida', icon: 'heartbeat', color: '#F44336', budget: 400 },
        { id: 9, name: 'Educação', type: 'saida', icon: 'book', color: '#4BC0C0', budget: 300 },
        { id: 10, name: 'Outros', type: 'ambos', icon: 'ellipsis-h', color: '#9966FF', budget: 200 }
    ],
    currency: 'BRL',
    theme: 'dark',
    weekStart: 1
};

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeSettings();
    initializeApp();
    loadSampleData();
    updateDashboard();
    setupEventListeners();
    initializeCharts();
    applyTheme(settings.theme || 'dark');
    
    console.log('🚀 Finance Dashboard iniciado com sucesso!');
    console.log('💡 Dicas:');
    console.log('  - Pressione Ctrl+N para nova transação');
    console.log('  - Pressione Ctrl+S para sincronizar');
    console.log('  - Pressione Ctrl+E para exportar dados');
});

function initializeApp() {
    document.getElementById('sheetsLink').href = SHEETS_LINK;
    document.getElementById('monthFilter').value = new Date().toISOString().slice(0, 7);
    updateCardSelect();
    updateTransactionTypeSelect();
    updateCategorySelects();
    
    // Sincronizar automaticamente ao carregar (buscar dados da planilha)
    autoSyncFromSheets();
}

// ============================================
// SINCRONIZAÇÃO AUTOMÁTICA AO INICIAR
// ============================================
async function autoSyncFromSheets() {
    try {
        console.log('🔄 Sincronizando automaticamente ao iniciar...');
        
        const response = await fetch(`${GOOGLE_SHEETS_URL}?action=get`);
        
        if (!response.ok) {
            console.log('⚠️ Não foi possível conectar à planilha, usando dados locais');
            return;
        }
        
        const result = await response.json();
        
        if (result.success && result.transactions && result.transactions.length > 0) {
            const sheetTransactions = result.transactions
                .filter(t => {
                    const hasData = t.data || t.date;
                    const hasDescription = t.descrição || t.description;
                    return hasData && hasDescription;
                })
                .map((t, index) => {
                    let dateValue = t.data || t.date || '';
                    if (dateValue && dateValue.includes('T')) {
                        dateValue = dateValue.split('T')[0];
                    }
                    
                    if (dateValue && !dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        try {
                            const d = new Date(dateValue);
                            dateValue = d.toISOString().split('T')[0];
                        } catch(e) {
                            dateValue = new Date().toISOString().split('T')[0];
                        }
                    }
                    
                    return {
                        id: Date.now() + index,
                        type: (t.tipo || t.type || 'saida').toLowerCase().trim(),
                        value: parseFloat(t.valor || t.value) || 0,
                        category: (t.categoria || t.category || 'Outros').trim(),
                        description: (t.descrição || t.description || '').trim(),
                        date: dateValue || new Date().toISOString().split('T')[0],
                        card: (t.cartão || t.card || '').trim()
                    };
                })
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            
            transactions = sheetTransactions;
            saveTransactions();
            
            console.log('✅ Dados carregados da planilha:', transactions.length, 'transações');
        } else {
            // Se a planilha estiver vazia, enviar dados locais
            if (transactions.length > 0) {
                console.log('📤 Planilha vazia, enviando dados locais...');
                await sendToSheets();
            }
        }
        
        // Atualizar interface
        updateDashboard();
        renderTransactions();
        
    } catch (error) {
        console.log('ℹ️ Usando dados locais (sem conexão com planilha)');
    }
}

function initializeSettings() {
    if (!localStorage.getItem('financeSettings')) {
        saveSettings();
    }
    settings = JSON.parse(localStorage.getItem('financeSettings'));
}

function loadSampleData() {
    // Não carregar dados de exemplo se já existirem dados
    // Os dados virão exclusivamente da planilha
    if (transactions.length === 0) {
        // Dados iniciais mínimos apenas para primeira execução
        console.log('📝 Nenhum dado encontrado. O sistema está pronto para uso.');
        console.log('💡 Dica: Sincronize com a planilha ou adicione transações manualmente.');
    }
    
    // Atualizar cartões se não existirem
    if (cards.length === 0) {
        cards = [
            { id: 1, name: 'Visa', limit: 5000, spent: 0, color: '#667eea', brand: 'Visa', closingDay: 15, dueDay: 25 },
            { id: 2, name: 'MasterCard', limit: 3000, spent: 0, color: '#f093fb', brand: 'MasterCard', closingDay: 10, dueDay: 20 },
            { id: 3, name: 'Nubank', limit: 4000, spent: 0, color: '#8A05BE', brand: 'Nubank', closingDay: 1, dueDay: 7 },
        ];
        saveCards();
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
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
    
    // Type form
    document.getElementById('typeForm').addEventListener('submit', handleTypeSubmit);
    
    // Category form
    document.getElementById('categoryForm').addEventListener('submit', handleCategorySubmit);
    
    // Card settings form
    document.getElementById('cardSettingsForm').addEventListener('submit', handleCardSettingsSubmit);
    
    // Search and filters
    const searchInput = document.querySelector('.search-input');
    const filterSelect = document.querySelector('.filter-select');
    
    if (searchInput) searchInput.addEventListener('input', filterTransactions);
    if (filterSelect) filterSelect.addEventListener('change', filterTransactions);
    
    // Import file
    const importFile = document.getElementById('importFile');
    if (importFile) {
        importFile.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                importData(e.target.files[0]);
            }
        });
    }
    
    // ESC to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
        // Ctrl+N = Nova transação
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            openAddModal();
        }
        // Ctrl+S = Sincronizar
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            syncWithSheets();
        }
        // Ctrl+E = Exportar
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            exportData();
        }
    });
}

// ============================================
// NAVEGAÇÃO
// ============================================
function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === `${page}-page`);
    });
    
    setTimeout(() => {
        switch(page) {
            case 'dashboard':
                updateDashboard();
                initializeCharts();
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
            case 'settings':
                renderTypes();
                renderCategories();
                renderCardsSettings();
                document.getElementById('currencySetting').value = settings.currency || 'BRL';
                document.getElementById('themeSetting').value = settings.theme || 'dark';
                document.getElementById('weekStartSetting').value = settings.weekStart || 1;
                break;
        }
    }, 100);
}

// ============================================
// DASHBOARD FUNCTIONS
// ============================================
function updateDashboard() {
    const selectedMonth = document.getElementById('monthFilter').value;
    const monthTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));
    
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
    const previousIncome = previousTransactions
        .filter(t => t.type === 'entrada')
        .reduce((sum, t) => sum + parseFloat(t.value), 0);
    
    const expenseChange = previousExpense > 0 ? ((expense - previousExpense) / previousExpense) * 100 : 0;
    const incomeChange = previousIncome > 0 ? ((income - previousIncome) / previousIncome) * 100 : 0;
    
    // Update cards
    animateValue('totalIncome', formatCurrency(income));
    animateValue('totalExpense', formatCurrency(expense));
    animateValue('totalBalance', formatCurrency(balance));
    document.getElementById('savingsRate').textContent = `${savingsRate.toFixed(1)}%`;
    
    // Update trends
    updateTrendElement('incomeTrend', incomeChange, 'entrada');
    updateTrendElement('expenseTrend', expenseChange, 'saida');
    
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
                backgroundColor: Object.keys(categories).map(cat => getCategoryColor(cat)),
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

// ============================================
// CHART FUNCTIONS
// ============================================
function initializeCharts() {
    Chart.defaults.color = '#b3b3b3';
    Chart.defaults.borderColor = 'rgba(42, 42, 74, 0.5)';
    
    const canvases = {
        'cashflowChart': 'line',
        'categoryChart': 'doughnut',
        'cardChart': 'pie'
    };
    
    Object.entries(canvases).forEach(([id, type]) => {
        const canvas = document.getElementById(id);
        if (canvas && !charts[id]) {
            const ctx = canvas.getContext('2d');
            charts[id] = new Chart(ctx, {
                type: type,
                data: { labels: [], datasets: [] },
                options: getChartOptions(type)
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
        animation: { duration: 1000, easing: 'easeInOutQuart' },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#b3b3b3',
                    padding: 15,
                    font: { size: 12, family: "'Segoe UI', sans-serif" },
                    usePointStyle: true,
                    pointStyleWidth: 10
                }
            },
            tooltip: {
                backgroundColor: 'rgba(22, 33, 62, 0.95)',
                padding: 12,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 },
                borderColor: '#6C63FF',
                borderWidth: 1
            }
        }
    };
    
    if (type === 'line' || type === 'bar') {
        options.scales = {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(42, 42, 74, 0.5)', drawBorder: false },
                ticks: { 
                    color: '#b3b3b3',
                    callback: function(value) {
                        return 'R$ ' + value.toLocaleString('pt-BR');
                    }
                }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#b3b3b3', maxTicksLimit: 10 }
            }
        };
    }
    
    return options;
}

// ============================================
// TRANSACTION FUNCTIONS
// ============================================
function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const type = document.getElementById('transType').value;
    const valueInput = document.getElementById('transValue').value;
    const category = document.getElementById('transCategory').value;
    const description = document.getElementById('transDescription').value;
    const date = document.getElementById('transDate').value;
    const card = document.getElementById('transCard').value;
    
    if (!valueInput || parseFloat(valueInput) <= 0) {
        showNotification('Por favor, insira um valor válido maior que zero.', 'error');
        return;
    }
    
    if (!category) {
        showNotification('Por favor, selecione uma categoria.', 'error');
        return;
    }
    
    if (!description.trim()) {
        showNotification('Por favor, insira uma descrição.', 'error');
        return;
    }
    
    if (!date) {
        showNotification('Por favor, selecione uma data.', 'error');
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
    
    showNotification('Transação adicionada com sucesso!', 'success');
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
                    ${t.type === 'entrada' ? 'Entrada' : 'Saída'}
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

function editTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;
    
    openAddModal();
    
    document.getElementById('transType').value = transaction.type;
    document.getElementById('transValue').value = transaction.value;
    document.getElementById('transCategory').value = transaction.category;
    document.getElementById('transDescription').value = transaction.description;
    document.getElementById('transDate').value = transaction.date;
    document.getElementById('transCard').value = transaction.card;
    
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
    
    if (filterType === 'entradas') {
        filtered = filtered.filter(t => t.type === 'entrada');
    } else if (filterType === 'saídas') {
        filtered = filtered.filter(t => t.type === 'saida');
    }
    
    if (searchTerm) {
        filtered = filtered.filter(t => 
            t.description.toLowerCase().includes(searchTerm) ||
            t.category.toLowerCase().includes(searchTerm) ||
            (t.card && t.card.toLowerCase().includes(searchTerm)) ||
            formatCurrency(t.value).includes(searchTerm) ||
            formatDate(t.date).includes(searchTerm)
        );
    }
    
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
                    ${t.type === 'entrada' ? 'Entrada' : 'Saída'}
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

// ============================================
// CARD FUNCTIONS
// ============================================
function openCardModal() {
    openAddCardSettingsModal();
}

function renderCards() {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    
    if (cards.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <i class="fas fa-credit-card" style="font-size: 64px; color: #6C63FF; margin-bottom: 20px; display: block;"></i>
                <h3 style="color: #b3b3b3; margin-bottom: 16px;">Nenhum cartão cadastrado</h3>
                <button class="btn-add" onclick="openAddCardSettingsModal()">
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
                    <button onclick="editCardSettings(${card.id})" class="btn-card-action" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteCardSettings(${card.id})" class="btn-card-action" title="Remover" style="margin-top: 8px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add card button
    grid.insertAdjacentHTML('beforeend', `
        <div class="credit-card add-card" onclick="openAddCardSettingsModal()" style="
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
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) + amount);
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) + amount);
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function updateCardSelect() {
    const select = document.getElementById('transCard');
    if (!select) return;
    
    select.innerHTML = '<option value="">Nenhum cartão</option>' +
        cards.map(card => `<option value="${card.name}">${card.name}</option>`).join('');
}

function updateCardSpending() {
    cards.forEach(card => {
        card.spent = transactions
            .filter(t => t.type === 'saida' && t.card === card.name)
            .reduce((sum, t) => sum + parseFloat(t.value), 0);
    });
    saveCards();
}

// ============================================
// FORÇAR ENVIO PARA PLANILHA
// ============================================
async function forceUploadToSheets() {
    const buttons = document.querySelectorAll('.btn-sync');
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.7';
    });
    
    try {
        showNotification('📤 Enviando dados para a planilha...', 'success');
        
        const sent = await sendToSheets();
        
        if (sent) {
            showNotification('✅ Dados enviados para a planilha com sucesso!', 'success');
        } else {
            showNotification('❌ Erro ao enviar dados para a planilha', 'error');
        }
    } catch (error) {
        console.error('Erro:', error);
        showNotification('❌ Erro ao enviar dados', 'error');
    } finally {
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
    }
}


// ============================================
// ANALYTICS FUNCTIONS
// ============================================
function updateAnalytics() {
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
    
    // Spending distribution
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

// ============================================
// BUDGET FUNCTIONS
// ============================================
function openBudgetModal() {
    const currentMonth = document.getElementById('monthFilter').value;
    
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
                            ${settings.categories.filter(c => c.type === 'saida' || c.type === 'ambos').map(c => 
                                `<option value="${c.name}">${c.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Valor Planejado</label>
                        <input type="number" id="budgetAmount" step="0.01" required placeholder="0,00">
                    </div>
                    <div class="form-group">
                        <label>Mês</label>
                        <input type="month" id="budgetMonth" required value="${currentMonth}">
                    </div>
                    <button type="submit" class="btn-submit">Salvar Orçamento</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
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
                            <p class="${percentUsed > 100 ? 'negative' : ''}">${formatCurrency(spent)}</p>
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

// ============================================
// SETTINGS - TYPES MANAGEMENT
// ============================================
function renderTypes() {
    const list = document.getElementById('typesList');
    if (!list) return;
    
    if (settings.types.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exchange-alt"></i>
                <p>Nenhum tipo cadastrado</p>
                <button class="btn-add-small" onclick="openAddTypeModal()">
                    <i class="fas fa-plus"></i> Adicionar Tipo
                </button>
            </div>
        `;
        return;
    }
    
    list.innerHTML = settings.types.map(type => `
        <div class="settings-item">
            <div class="settings-item-info">
                <div class="settings-item-icon" style="background: ${type.color}">
                    <i class="fas fa-${type.icon}"></i>
                </div>
                <div class="settings-item-details">
                    <span class="settings-item-name">${type.name}</span>
                    <span class="settings-item-meta">
                        <span class="settings-item-badge badge-${type.flow}">
                            ${type.flow.charAt(0).toUpperCase() + type.flow.slice(1)}
                        </span>
                        <span>Ícone: ${type.icon}</span>
                    </span>
                </div>
            </div>
            <div class="settings-item-actions">
                <button class="settings-btn-icon" onclick="editType(${type.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="settings-btn-icon btn-delete" onclick="deleteType(${type.id})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
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
    const type = settings.types.find(t => t.id === id);
    if (!type) return;
    
    document.getElementById('typeModalTitle').textContent = 'Editar Tipo';
    document.getElementById('typeEditId').value = type.id;
    document.getElementById('typeName').value = type.name;
    document.getElementById('typeIcon').value = type.icon;
    document.getElementById('typeColor').value = type.color;
    document.getElementById('typeFlow').value = type.flow;
    document.getElementById('typeModal').classList.add('active');
}

function closeTypeModal() {
    document.getElementById('typeModal').classList.remove('active');
    document.getElementById('typeForm').reset();
}

function deleteType(id) {
    const type = settings.types.find(t => t.id === id);
    if (!type) return;
    
    if (confirm(`Tem certeza que deseja excluir o tipo "${type.name}"?`)) {
        settings.types = settings.types.filter(t => t.id !== id);
        saveSettings();
        renderTypes();
        showNotification('Tipo excluído com sucesso!', 'success');
    }
}

function handleTypeSubmit(e) {
    e.preventDefault();
    
    const editId = document.getElementById('typeEditId').value;
    const typeData = {
        name: document.getElementById('typeName').value.trim(),
        icon: document.getElementById('typeIcon').value.trim() || 'circle',
        color: document.getElementById('typeColor').value,
        flow: document.getElementById('typeFlow').value
    };
    
    if (!typeData.name) {
        showNotification('Nome do tipo é obrigatório!', 'error');
        return;
    }
    
    if (editId) {
        const index = settings.types.findIndex(t => t.id === parseInt(editId));
        if (index !== -1) {
            settings.types[index] = { ...settings.types[index], ...typeData };
            showNotification('Tipo atualizado com sucesso!', 'success');
        }
    } else {
        settings.types.push({
            id: Date.now(),
            ...typeData
        });
        showNotification('Tipo adicionado com sucesso!', 'success');
    }
    
    saveSettings();
    closeTypeModal();
    renderTypes();
}

function updateTransactionTypeSelect() {
    const select = document.getElementById('transType');
    if (!select) return;
    
    select.innerHTML = settings.types
        .filter(t => t.flow === 'entrada' || t.flow === 'saida')
        .map(t => `<option value="${t.flow}">${t.name}</option>`)
        .join('');
}

// ============================================
// SETTINGS - CATEGORIES MANAGEMENT
// ============================================
function renderCategories() {
    const list = document.getElementById('categoriesList');
    if (!list) return;
    
    if (settings.categories.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tags"></i>
                <p>Nenhuma categoria cadastrada</p>
                <button class="btn-add-small" onclick="openAddCategoryModal()">
                    <i class="fas fa-plus"></i> Adicionar Categoria
                </button>
            </div>
        `;
        return;
    }
    
    const entradaCategories = settings.categories.filter(c => c.type === 'entrada' || c.type === 'ambos');
    const saidaCategories = settings.categories.filter(c => c.type === 'saida' || c.type === 'ambos');
    
    list.innerHTML = `
        ${entradaCategories.length > 0 ? `
            <div style="margin-bottom: 16px;">
                <h4 style="color: #4CAF50; margin-bottom: 8px; font-size: 14px;">
                    <i class="fas fa-arrow-up"></i> Entradas
                </h4>
                ${entradaCategories.map(cat => createCategoryItemHTML(cat)).join('')}
            </div>
        ` : ''}
        
        ${saidaCategories.length > 0 ? `
            <div>
                <h4 style="color: #F44336; margin-bottom: 8px; font-size: 14px;">
                    <i class="fas fa-arrow-down"></i> Saídas
                </h4>
                ${saidaCategories.map(cat => createCategoryItemHTML(cat)).join('')}
            </div>
        ` : ''}
    `;
    
    updateCategorySelects();
}

function createCategoryItemHTML(cat) {
    const budgetInfo = cat.budget > 0 ? `Orçamento: ${formatCurrency(cat.budget)}` : 'Sem orçamento';
    
    return `
        <div class="settings-item">
            <div class="settings-item-info">
                <div class="settings-item-icon" style="background: ${cat.color}">
                    <i class="fas fa-${cat.icon}"></i>
                </div>
                <div class="settings-item-details">
                    <span class="settings-item-name">${cat.name}</span>
                    <span class="settings-item-meta">
                        <span class="settings-item-badge badge-${cat.type}">
                            ${cat.type.charAt(0).toUpperCase() + cat.type.slice(1)}
                        </span>
                        <span>${budgetInfo}</span>
                    </span>
                </div>
            </div>
            <div class="settings-item-actions">
                <button class="settings-btn-icon" onclick="editCategory(${cat.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="settings-btn-icon btn-delete" onclick="deleteCategory(${cat.id})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
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
    const cat = settings.categories.find(c => c.id === id);
    if (!cat) return;
    
    document.getElementById('categoryModalTitle').textContent = 'Editar Categoria';
    document.getElementById('categoryEditId').value = cat.id;
    document.getElementById('categoryName').value = cat.name;
    document.getElementById('categoryType').value = cat.type;
    document.getElementById('categoryIcon').value = cat.icon;
    document.getElementById('categoryColor').value = cat.color;
    document.getElementById('categoryBudget').value = cat.budget || '';
    document.getElementById('categoryModal').classList.add('active');
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
    document.getElementById('categoryForm').reset();
}

function deleteCategory(id) {
    const cat = settings.categories.find(c => c.id === id);
    if (!cat) return;
    
    if (confirm(`Tem certeza que deseja excluir a categoria "${cat.name}"?`)) {
        settings.categories = settings.categories.filter(c => c.id !== id);
        saveSettings();
        renderCategories();
        showNotification('Categoria excluída com sucesso!', 'success');
    }
}

function handleCategorySubmit(e) {
    e.preventDefault();
    
    const editId = document.getElementById('categoryEditId').value;
    const catData = {
        name: document.getElementById('categoryName').value.trim(),
        type: document.getElementById('categoryType').value,
        icon: document.getElementById('categoryIcon').value.trim() || 'tag',
        color: document.getElementById('categoryColor').value,
        budget: parseFloat(document.getElementById('categoryBudget').value) || 0
    };
    
    if (!catData.name) {
        showNotification('Nome da categoria é obrigatório!', 'error');
        return;
    }
    
    if (editId) {
        const index = settings.categories.findIndex(c => c.id === parseInt(editId));
        if (index !== -1) {
            settings.categories[index] = { ...settings.categories[index], ...catData };
            showNotification('Categoria atualizada com sucesso!', 'success');
        }
    } else {
        settings.categories.push({
            id: Date.now(),
            ...catData
        });
        showNotification('Categoria adicionada com sucesso!', 'success');
    }
    
    saveSettings();
    closeCategoryModal();
    renderCategories();
}

function updateCategorySelects() {
    const categorySelects = [
        document.getElementById('transCategory'),
        document.getElementById('budgetCategory')
    ];
    
    categorySelects.forEach(select => {
        if (!select) return;
        
        const entradaCategories = settings.categories.filter(c => c.type === 'entrada' || c.type === 'ambos');
        const saidaCategories = settings.categories.filter(c => c.type === 'saida' || c.type === 'ambos');
        
        select.innerHTML = `
            <option value="">Selecione...</option>
            <optgroup label="Entradas">
                ${entradaCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
            </optgroup>
            <optgroup label="Saídas">
                ${saidaCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
            </optgroup>
        `;
    });
}

// ============================================
// SETTINGS - CARDS MANAGEMENT
// ============================================
function renderCardsSettings() {
    const list = document.getElementById('cardsSettingsList');
    if (!list) return;
    
    if (cards.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-credit-card"></i>
                <p>Nenhum cartão cadastrado</p>
                <button class="btn-add-small" onclick="openAddCardSettingsModal()">
                    <i class="fas fa-plus"></i> Adicionar Cartão
                </button>
            </div>
        `;
        return;
    }
    
    list.innerHTML = cards.map(card => {
        const usagePercent = card.limit > 0 ? (card.spent / card.limit) * 100 : 0;
        const status = usagePercent > 80 ? 'badge-saida' : usagePercent > 50 ? 'badge-ambos' : 'badge-entrada';
        
        return `
            <div class="settings-item">
                <div class="settings-item-info">
                    <div class="settings-item-icon" style="background: ${card.color}">
                        <i class="fas fa-credit-card"></i>
                    </div>
                    <div class="settings-item-details">
                        <span class="settings-item-name">${card.name}</span>
                        <span class="settings-item-meta">
                            <span class="settings-item-badge ${status}">
                                ${usagePercent.toFixed(0)}% utilizado
                            </span>
                            <span>Limite: ${formatCurrency(card.limit)}</span>
                            ${card.closingDay ? `<span>Fecha: dia ${card.closingDay}</span>` : ''}
                            ${card.dueDay ? `<span>Vence: dia ${card.dueDay}</span>` : ''}
                        </span>
                    </div>
                </div>
                <div class="settings-item-actions">
                    <button class="settings-btn-icon" onclick="editCardSettings(${card.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="settings-btn-icon btn-delete" onclick="deleteCardSettings(${card.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
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

function closeCardSettingsModal() {
    document.getElementById('cardSettingsModal').classList.remove('active');
    document.getElementById('cardSettingsForm').reset();
}

function deleteCardSettings(id) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    
    if (confirm(`Tem certeza que deseja excluir o cartão "${card.name}"?`)) {
        cards = cards.filter(c => c.id !== id);
        saveCards();
        renderCardsSettings();
        renderCards();
        showNotification('Cartão excluído com sucesso!', 'success');
    }
}

function handleCardSettingsSubmit(e) {
    e.preventDefault();
    
    const editId = document.getElementById('cardSettingsEditId').value;
    const cardData = {
        name: document.getElementById('cardSettingsName').value.trim(),
        brand: document.getElementById('cardSettingsBrand').value,
        limit: parseFloat(document.getElementById('cardSettingsLimit').value) || 0,
        closingDay: parseInt(document.getElementById('cardSettingsClosingDay').value) || null,
        dueDay: parseInt(document.getElementById('cardSettingsDueDay').value) || null,
        color: document.getElementById('cardSettingsColor').value,
        spent: 0
    };
    
    if (!cardData.name) {
        showNotification('Nome do cartão é obrigatório!', 'error');
        return;
    }
    
    if (editId) {
        const index = cards.findIndex(c => c.id === parseInt(editId));
        if (index !== -1) {
            cardData.spent = cards[index].spent;
            cards[index] = { ...cards[index], ...cardData };
            showNotification('Cartão atualizado com sucesso!', 'success');
        }
    } else {
        cards.push({
            id: Date.now(),
            ...cardData
        });
        showNotification('Cartão adicionado com sucesso!', 'success');
    }
    
    saveCards();
    closeCardSettingsModal();
    renderCardsSettings();
    renderCards();
}

// ============================================
// SETTINGS - GENERAL
// ============================================
function updateCurrencySetting() {
    settings.currency = document.getElementById('currencySetting').value;
    saveSettings();
    updateDashboard();
    if (document.getElementById('transactions-page').classList.contains('active')) {
        renderTransactions();
    }
    showNotification('Moeda alterada com sucesso!', 'success');
}

function updateThemeSetting() {
    settings.theme = document.getElementById('themeSetting').value;
    saveSettings();
    applyTheme(settings.theme);
    showNotification('Tema alterado com sucesso!', 'success');
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.style.setProperty('--bg-dark', '#f5f5f5');
        document.documentElement.style.setProperty('--bg-card', '#ffffff');
        document.documentElement.style.setProperty('--bg-main', '#ffffff');
        document.documentElement.style.setProperty('--text-primary', '#333333');
        document.documentElement.style.setProperty('--text-secondary', '#666666');
        document.documentElement.style.setProperty('--border-color', '#e0e0e0');
    } else {
        document.documentElement.style.setProperty('--bg-dark', '#1a1a2e');
        document.documentElement.style.setProperty('--bg-card', '#16213e');
        document.documentElement.style.setProperty('--bg-main', '#0f3460');
        document.documentElement.style.setProperty('--text-primary', '#ffffff');
        document.documentElement.style.setProperty('--text-secondary', '#b3b3b3');
        document.documentElement.style.setProperty('--border-color', '#2a2a4a');
    }
}

// ============================================
// GOOGLE SHEETS INTEGRATION
// ============================================

// ============================================
// GOOGLE SHEETS INTEGRATION - SINCRONIZAÇÃO BIDIRECIONAL
// ============================================
async function syncWithSheets() {
    const syncButton = document.querySelector('.btn-sync');
    if (!syncButton) return;
    
    const originalHTML = syncButton.innerHTML;
    syncButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    syncButton.disabled = true;
    
    try {
        console.log('🔄 Iniciando sincronização com Google Sheets...');
        
        // 1. BAIXAR dados da planilha (fonte principal)
        console.log('📥 Baixando dados da planilha...');
        const response = await fetch(`${GOOGLE_SHEETS_URL}?action=get`);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('💾 Dados recebidos:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Erro ao baixar dados');
        }
        
        // 2. CONVERTER dados da planilha para o formato local
        if (result.transactions && result.transactions.length > 0) {
            const oldCount = transactions.length;
            
            transactions = result.transactions
                .filter(t => {
                    // Filtrar linhas vazias
                    const hasData = t.data || t.date;
                    const hasDescription = t.descrição || t.description;
                    return hasData && hasDescription;
                })
                .map((t, index) => {
                    // Tratar a data
                    let dateValue = t.data || t.date || '';
                    if (dateValue && dateValue.includes('T')) {
                        dateValue = dateValue.split('T')[0];
                    }
                    
                    // Verificar se a data é válida
                    if (dateValue && !dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        try {
                            const d = new Date(dateValue);
                            dateValue = d.toISOString().split('T')[0];
                        } catch(e) {
                            dateValue = new Date().toISOString().split('T')[0];
                        }
                    }
                    
                    return {
                        id: Date.now() + index,
                        type: (t.tipo || t.type || 'saida').toLowerCase().trim(),
                        value: parseFloat(t.valor || t.value) || 0,
                        category: (t.categoria || t.category || 'Outros').trim(),
                        description: (t.descrição || t.description || '').trim(),
                        date: dateValue || new Date().toISOString().split('T')[0],
                        card: (t.cartão || t.card || '').trim()
                    };
                })
                // Ordenar por data (mais recente primeiro)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Salvar no localStorage
            saveTransactions();
            
            console.log(`✅ Dados sincronizados: ${oldCount} → ${transactions.length} transações`);
        } else {
            // Planilha vazia
            transactions = [];
            saveTransactions();
            console.log('📭 Planilha vazia, dados locais limpos');
        }
        
        // 3. ATUALIZAR interface
        updateDashboard();
        renderTransactions();
        updateCardSpending();
        
        // 4. Feedback
        const currentPage = document.querySelector('.page.active');
        if (currentPage) {
            const pageId = currentPage.id;
            if (pageId === 'transactions-page') renderTransactions();
            if (pageId === 'cards-page') renderCards();
            if (pageId === 'analytics-page') updateAnalytics();
            if (pageId === 'budget-page') renderBudgets();
            if (pageId === 'settings-page') {
                renderTypes();
                renderCategories();
                renderCardsSettings();
            }
        }
        
        showNotification(
            `✅ Sincronizado com sucesso!\n${transactions.length} transações carregadas da planilha`,
            'success'
        );
        
        console.log('✨ Sincronização concluída!');
        console.log('📊 Total de transações:', transactions.length);
        
    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        
        let mensagem = '❌ Erro ao sincronizar\n\n';
        mensagem += `Erro: ${error.message}\n\n`;
        mensagem += 'Verifique:\n';
        mensagem += '• Se a planilha "Transações" existe\n';
        mensagem += '• Se os cabeçalhos estão corretos\n';
        mensagem += '• Se o Apps Script está funcionando\n';
        mensagem += '• Sua conexão com internet\n\n';
        mensagem += `URL de teste: ${GOOGLE_SHEETS_URL}?action=get`;
        
        alert(mensagem);
    } finally {
        syncButton.innerHTML = originalHTML;
        syncButton.disabled = false;
    }
}

// ============================================
// ENVIAR ALTERAÇÕES PARA A PLANILHA
// ============================================
async function sendToSheets() {
    try {
        const dataToSend = {
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
        
        console.log('📤 Enviando dados para a planilha...', dataToSend.data.length, 'transações');
        
        // Tentar POST primeiro
        let success = false;
        
        try {
            const response = await fetch(GOOGLE_SHEETS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
            });
            
            if (response.ok) {
                const result = await response.json();
                success = result.success;
                console.log('✅ POST:', result);
            }
        } catch (postError) {
            console.log('⚠️ POST falhou, tentando GET...');
        }
        
        // Fallback para GET
        if (!success) {
            const dataParam = encodeURIComponent(JSON.stringify(dataToSend.data));
            const url = `${GOOGLE_SHEETS_URL}?action=sync&data=${dataParam}`;
            const response = await fetch(url);
            const result = await response.json();
            success = result.success;
            console.log('✅ GET:', result);
        }
        
        return success;
        
    } catch (error) {
        console.error('❌ Erro ao enviar para planilha:', error);
        return false;
    }
}

// ============================================
// MODIFICAR FUNÇÕES DE CRUD PARA SINCRONIZAR
// ============================================

// Sobrescrever handleTransactionSubmit para enviar à planilha
const originalHandleTransactionSubmit = handleTransactionSubmit;
handleTransactionSubmit = async function(e) {
    e.preventDefault();
    
    const type = document.getElementById('transType').value;
    const valueInput = document.getElementById('transValue').value;
    const category = document.getElementById('transCategory').value;
    const description = document.getElementById('transDescription').value;
    const date = document.getElementById('transDate').value;
    const card = document.getElementById('transCard').value;
    
    if (!valueInput || parseFloat(valueInput) <= 0) {
        showNotification('Por favor, insira um valor válido maior que zero.', 'error');
        return;
    }
    
    if (!category) {
        showNotification('Por favor, selecione uma categoria.', 'error');
        return;
    }
    
    if (!description.trim()) {
        showNotification('Por favor, insira uma descrição.', 'error');
        return;
    }
    
    if (!date) {
        showNotification('Por favor, selecione uma data.', 'error');
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
    renderTransactions();
    
    // Enviar para planilha
    showNotification('Salvando transação na planilha...', 'success');
    const sent = await sendToSheets();
    
    if (sent) {
        showNotification('✅ Transação salva na planilha com sucesso!', 'success');
    } else {
        showNotification('⚠️ Transação salva localmente, mas houve erro ao enviar para planilha', 'error');
    }
};

// Sobrescrever deleteTransaction para sincronizar
const originalDeleteTransaction = deleteTransaction;
deleteTransaction = async function(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;
    
    if (confirm(`Tem certeza que deseja excluir esta transação?\n\n${transaction.description}\nValor: ${formatCurrency(transaction.value)}`)) {
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions();
        updateDashboard();
        renderTransactions();
        
        // Enviar alteração para planilha
        const sent = await sendToSheets();
        
        if (sent) {
            showNotification('✅ Transação excluída da planilha com sucesso!', 'success');
        } else {
            showNotification('⚠️ Transação excluída localmente, mas houve erro ao atualizar planilha', 'error');
        }
    }
};

// Sobrescrever editTransaction para sincronizar
const originalEditTransaction = editTransaction;
editTransaction = async function(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;
    
    // Preencher formulário com dados da transação
    document.getElementById('transType').value = transaction.type;
    document.getElementById('transValue').value = transaction.value;
    document.getElementById('transCategory').value = transaction.category;
    document.getElementById('transDescription').value = transaction.description;
    document.getElementById('transDate').value = transaction.date;
    document.getElementById('transCard').value = transaction.card;
    
    // Remover transação antiga
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    
    // Abrir modal
    openAddModal();
    
    // Enviar alteração para planilha
    const sent = await sendToSheets();
    if (!sent) {
        showNotification('⚠️ Alteração será enviada ao salvar a nova transação', 'error');
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatCurrency(value) {
    const currency = settings.currency || 'BRL';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency
    }).format(Math.abs(value));
}

function formatDate(dateString) {
    if (!dateString) return '-';
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

function getCategoryIcon(category) {
    const cat = settings.categories.find(c => c.name === category);
    return cat ? cat.icon : 'tag';
}

function getCategoryColor(category) {
    const cat = settings.categories.find(c => c.name === category);
    return cat ? cat.color : '#6C63FF';
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// ============================================
// MODAL FUNCTIONS
// ============================================
function openAddModal() {
    document.getElementById('transactionModal').classList.add('active');
    document.getElementById('transDate').value = new Date().toISOString().slice(0, 10);
    updateCardSelect();
    updateCategorySelects();
    updateTransactionTypeSelect();
    
    setTimeout(() => {
        const typeSelect = document.getElementById('transType');
        if (typeSelect) typeSelect.focus();
    }, 100);
}

function closeModal() {
    document.getElementById('transactionModal').classList.remove('active');
    document.getElementById('transactionForm').reset();
    document.getElementById('transDate').value = new Date().toISOString().slice(0, 10);
}

function closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ============================================
// STORAGE FUNCTIONS
// ============================================
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

function saveSettings() {
    localStorage.setItem('financeSettings', JSON.stringify(settings));
}

// ============================================
// EXPORT/IMPORT FUNCTIONS
// ============================================
function exportData() {
    const data = {
        transactions,
        cards,
        budgets,
        settings,
        exportDate: new Date().toISOString(),
        version: '2.1'
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

// ============================================
// SISTEMA DE PARCELAS
// ============================================

// Mostrar/esconder campo de parcelas baseado no cartão selecionado
function toggleInstallments() {
    const cardSelect = document.getElementById('transCard');
    const installmentsGroup = document.getElementById('installmentsGroup');
    const installmentPreview = document.getElementById('installmentPreview');
    const valuePerInstallment = document.getElementById('valuePerInstallment');
    
    if (cardSelect.value) {
        // Cartão selecionado - mostrar parcelas
        installmentsGroup.style.display = 'block';
        document.getElementById('transInstallments').value = '1';
        installmentPreview.style.display = 'none';
        valuePerInstallment.style.display = 'none';
    } else {
        // Sem cartão - esconder parcelas
        installmentsGroup.style.display = 'none';
        document.getElementById('transInstallments').value = '1';
        installmentPreview.style.display = 'none';
        valuePerInstallment.style.display = 'none';
    }
    
    updateInstallmentPreview();
}

// Atualizar preview das parcelas
function updateInstallmentPreview() {
    const cardSelect = document.getElementById('transCard');
    const installmentsSelect = document.getElementById('transInstallments');
    const valueInput = document.getElementById('transValue');
    const dateInput = document.getElementById('transDate');
    const preview = document.getElementById('installmentPreview');
    const list = document.getElementById('installmentList');
    const valuePerInstallment = document.getElementById('valuePerInstallment');
    
    if (!cardSelect.value || !installmentsSelect) {
        preview.style.display = 'none';
        valuePerInstallment.style.display = 'none';
        return;
    }
    
    const installments = parseInt(installmentsSelect.value) || 1;
    const totalValue = parseFloat(valueInput.value) || 0;
    const startDate = dateInput.value;
    
    // Mostrar valor por parcela
    if (totalValue > 0 && installments > 1) {
        const perInstallment = totalValue / installments;
        valuePerInstallment.style.display = 'block';
        valuePerInstallment.innerHTML = `Valor por parcela: <strong>${formatCurrency(perInstallment)}</strong>`;
    } else {
        valuePerInstallment.style.display = 'none';
    }
    
    if (installments <= 1 || !startDate || totalValue <= 0) {
        preview.style.display = 'none';
        return;
    }
    
    // Gerar lista de parcelas
    const perInstallment = totalValue / installments;
    const dates = [];
    const [year, month, day] = startDate.split('-').map(Number);
    const startDateObj = new Date(year, month - 1, day);
    
    let html = '';
    for (let i = 0; i < installments; i++) {
        const installmentDate = new Date(startDateObj);
        installmentDate.setMonth(startDateObj.getMonth() + i);
        
        // Ajustar se o dia não existe no mês (ex: 31 de fevereiro)
        const lastDayOfMonth = new Date(installmentDate.getFullYear(), installmentDate.getMonth() + 1, 0).getDate();
        const adjustedDay = Math.min(day, lastDayOfMonth);
        installmentDate.setDate(adjustedDay);
        
        const dateStr = installmentDate.toISOString().split('T')[0];
        const monthName = installmentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        
        html += `
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span>📅 ${i + 1}ª Parcela - ${monthName}</span>
                <span style="color: #F44336; font-weight: 600;">${formatCurrency(perInstallment)}</span>
            </div>
        `;
    }
    
    list.innerHTML = html;
    preview.style.display = 'block';
}

// Criar transações parceladas
function createInstallmentTransactions(baseTransaction, installments) {
    const transactions = [];
    const perInstallment = baseTransaction.value / installments;
    const [year, month, day] = baseTransaction.date.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);
    
    for (let i = 0; i < installments; i++) {
        const installmentDate = new Date(startDate);
        installmentDate.setMonth(startDate.getMonth() + i);
        
        // Ajustar último dia do mês se necessário
        const lastDayOfMonth = new Date(installmentDate.getFullYear(), installmentDate.getMonth() + 1, 0).getDate();
        const adjustedDay = Math.min(day, lastDayOfMonth);
        installmentDate.setDate(adjustedDay);
        
        const dateStr = installmentDate.toISOString().split('T')[0];
        
        transactions.push({
            id: Date.now() + i, // IDs únicos para cada parcela
            type: baseTransaction.type,
            value: perInstallment,
            category: baseTransaction.category,
            description: `${baseTransaction.description} (${i + 1}/${installments})`,
            date: dateStr,
            card: baseTransaction.card
        });
    }
    
    return transactions;
}

// Sobrescrever a função handleTransactionSubmit para suportar parcelas
const oldHandleTransactionSubmit = handleTransactionSubmit;
handleTransactionSubmit = async function(e) {
    e.preventDefault();
    
    const type = document.getElementById('transType').value;
    const valueInput = document.getElementById('transValue').value;
    const category = document.getElementById('transCategory').value;
    const description = document.getElementById('transDescription').value;
    const date = document.getElementById('transDate').value;
    const card = document.getElementById('transCard').value;
    const installmentsSelect = document.getElementById('transInstallments');
    const installments = installmentsSelect ? parseInt(installmentsSelect.value) || 1 : 1;
    
    // Validações
    if (!valueInput || parseFloat(valueInput) <= 0) {
        showNotification('Por favor, insira um valor válido maior que zero.', 'error');
        return;
    }
    
    if (!category) {
        showNotification('Por favor, selecione uma categoria.', 'error');
        return;
    }
    
    if (!description.trim()) {
        showNotification('Por favor, insira uma descrição.', 'error');
        return;
    }
    
    if (!date) {
        showNotification('Por favor, selecione uma data.', 'error');
        return;
    }
    
    const baseTransaction = {
        id: Date.now(),
        type: type,
        value: parseFloat(valueInput),
        category: category,
        description: description.trim(),
        date: date,
        card: card
    };
    
    if (card && installments > 1) {
        // Criar parcelas
        const installmentTransactions = createInstallmentTransactions(baseTransaction, installments);
        transactions.unshift(...installmentTransactions);
        
        showNotification(
            `✅ ${installments} parcelas de ${formatCurrency(baseTransaction.value / installments)} criadas com sucesso!`,
            'success'
        );
    } else {
        // Transação única
        transactions.unshift(baseTransaction);
        showNotification('✅ Transação adicionada com sucesso!', 'success');
    }
    
    saveTransactions();
    closeModal();
    updateDashboard();
    renderTransactions();
    
    // Enviar para planilha
    const sent = await sendToSheets();
    if (!sent) {
        showNotification('⚠️ Dados salvos localmente, mas houve erro ao sincronizar com planilha', 'error');
    }
};

// Atualizar a função closeModal para limpar campos de parcelas
const oldCloseModal = closeModal;
closeModal = function() {
    document.getElementById('transactionModal').classList.remove('active');
    document.getElementById('transactionForm').reset();
    document.getElementById('transDate').value = new Date().toISOString().slice(0, 10);
    
    // Limpar parcelas
    const installmentsGroup = document.getElementById('installmentsGroup');
    const installmentPreview = document.getElementById('installmentPreview');
    const valuePerInstallment = document.getElementById('valuePerInstallment');
    
    if (installmentsGroup) installmentsGroup.style.display = 'none';
    if (installmentPreview) installmentPreview.style.display = 'none';
    if (valuePerInstallment) valuePerInstallment.style.display = 'none';
    
    const installmentsSelect = document.getElementById('transInstallments');
    if (installmentsSelect) installmentsSelect.value = '1';
};

// Atualizar openAddModal para garantir estado limpo
const oldOpenAddModal = openAddModal;
openAddModal = function() {
    document.getElementById('transactionModal').classList.add('active');
    document.getElementById('transDate').value = new Date().toISOString().slice(0, 10);
    updateCardSelect();
    updateCategorySelects();
    updateTransactionTypeSelect();
    
    // Resetar parcelas
    const installmentsGroup = document.getElementById('installmentsGroup');
    const installmentPreview = document.getElementById('installmentPreview');
    const valuePerInstallment = document.getElementById('valuePerInstallment');
    
    if (installmentsGroup) installmentsGroup.style.display = 'none';
    if (installmentPreview) installmentPreview.style.display = 'none';
    if (valuePerInstallment) valuePerInstallment.style.display = 'none';
    
    const installmentsSelect = document.getElementById('transInstallments');
    if (installmentsSelect) installmentsSelect.value = '1';
};


function importData(file) {
    if (!file) {
        document.getElementById('importFile').click();
        return;
    }
    
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
            
            if (data.settings) {
                settings = data.settings;
                saveSettings();
            }
            
            updateDashboard();
            renderTransactions();
            renderCards();
            renderCardsSettings();
            renderTypes();
            renderCategories();
            updateCardSelect();
            applyTheme(settings.theme || 'dark');
            
            showNotification('Dados importados com sucesso!', 'success');
        } catch (error) {
            alert('Erro ao importar dados. Verifique se o arquivo é válido.');
            console.error('Erro na importação:', error);
        }
    };
    reader.readAsText(file);
}

// ============================================
// CLOSE MODALS ON OUTSIDE CLICK
// ============================================
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

// ============================================
// INICIALIZAÇÃO FINAL
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const currencySetting = document.getElementById('currencySetting');
    const themeSetting = document.getElementById('themeSetting');
    const weekStartSetting = document.getElementById('weekStartSetting');
    
    if (currencySetting) currencySetting.value = settings.currency || 'BRL';
    if (themeSetting) themeSetting.value = settings.theme || 'dark';
    if (weekStartSetting) weekStartSetting.value = settings.weekStart || 1;
});
