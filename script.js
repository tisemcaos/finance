// ============================================
// CONFIGURAÇÃO - GOOGLE SHEETS
// ============================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzhwTDdgsOdlyQF7DbQGXDzKgKieSASwaeTYNyinif4hkrZsBKjtU5fvESY3-c0aORF/exec';
const SHEETS_LINK = 'https://docs.google.com/spreadsheets/d/1DdiyEwLlik9OvBA36xP9NYaTG_kTiDpQyDnXthCYqew/edit?usp=sharing';

// PIN e autenticação
let USER_PIN = localStorage.getItem('app_pin') || '3458';

// ============================================
// ESTADO DA APLICAÇÃO
// ============================================
let transactions = [];
let cards = [];
let budgets = [];
let debtors = [];
let charts = {};

let settings = {
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

let currentDashboard = 'overview';
let dashboardDateStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
let dashboardDateEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

// Flag para evitar loops de sincronização
let isSyncing = false;

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Carregando Finance Dashboard...');
    
    // Carregar dados locais primeiro
    loadLocalData();
    
    // Configurar listeners do PIN
    const pinBtn = document.getElementById('pinSubmitBtn');
    if (pinBtn) pinBtn.addEventListener('click', verifyPin);
    
    const pinInput = document.getElementById('pinInput');
    if (pinInput) {
        pinInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') verifyPin();
        });
    }
    
    // Verificar autenticação
    if (sessionStorage.getItem('authenticated') === 'true') {
        document.getElementById('pinModal').style.display = 'none';
        document.getElementById('pinOverlay').style.display = 'none';
        await initializeAppAfterAuth();
        await fullSync(); // Sincronizar ao iniciar
    } else {
        document.getElementById('pinModal').style.display = 'flex';
        document.getElementById('pinOverlay').style.display = 'flex';
        setTimeout(() => document.getElementById('pinInput')?.focus(), 300);
    }
});

function loadLocalData() {
    const savedTransactions = localStorage.getItem('transactions');
    if (savedTransactions) transactions = JSON.parse(savedTransactions);
    
    const savedCards = localStorage.getItem('cards');
    if (savedCards) cards = JSON.parse(savedCards);
    
    const savedBudgets = localStorage.getItem('budgets');
    if (savedBudgets) budgets = JSON.parse(savedBudgets);
    
    const savedDebtors = localStorage.getItem('debtors');
    if (savedDebtors) debtors = JSON.parse(savedDebtors);
    
    const savedSettings = localStorage.getItem('financeSettings');
    if (savedSettings) settings = JSON.parse(savedSettings);
}

// ============================================
// VERIFICAÇÃO DE PIN
// ============================================
function verifyPin() {
    const input = document.getElementById('pinInput');
    const error = document.getElementById('pinError');
    const pinValue = input.value.trim();
    
    if (pinValue === USER_PIN) {
        sessionStorage.setItem('authenticated', 'true');
        document.getElementById('pinModal').style.display = 'none';
        document.getElementById('pinOverlay').style.display = 'none';
        initializeAppAfterAuth();
        showNotification('✅ Bem-vindo! Dashboard carregado.', 'success');
    } else {
        if (error) error.style.display = 'block';
        input.value = '';
        input.focus();
    }
}

async function initializeAppAfterAuth() {
    initializeApp();
    setupEventListeners();
    updateDashboard();
    initializeCharts();
    applyTheme(settings.theme || 'dark');
    updateMonthProgress();
    await fullSync(); // Sincronizar dados da planilha
    console.log('✅ Dashboard iniciado!');
}

function logout() {
    sessionStorage.removeItem('authenticated');
    location.reload();
}

// ============================================
// SINCRONIZAÇÃO COMPLETA COM GOOGLE SHEETS
// ============================================
async function fullSync() {
    if (isSyncing) return;
    isSyncing = true;
    
    const btns = document.querySelectorAll('.btn-sync');
    btns.forEach(b => { if(b) { b.disabled = true; b.style.opacity = '0.7'; } });
    
    try {
        showNotification('🔄 Sincronizando com a planilha...', 'success');
        
        // Primeiro: enviar todos os dados locais para a planilha
        await uploadAllToSheets();
        
        // Segundo: baixar os dados atualizados da planilha
        await downloadAllFromSheets();
        
        // Terceiro: atualizar a interface
        updateAllUI();
        showNotification('✅ Sincronização concluída!', 'success');
        
    } catch (error) {
        console.error('Erro na sincronização:', error);
        showNotification('❌ Erro na sincronização: ' + error.message, 'error');
    } finally {
        btns.forEach(b => { if(b) { b.disabled = false; b.style.opacity = '1'; } });
        isSyncing = false;
    }
}

async function uploadAllToSheets() {
    try {
        // Preparar dados para envio
        const transactionsData = transactions.map(t => ({
            date: t.date || '',
            type: t.type || 'saida',
            category: t.category || 'Outros',
            description: t.description || '',
            value: parseFloat(t.value) || 0,
            card: t.card || '',
            debtor: t.debtor || '',
            installments: t.installments || ''
        }));
        
        const cardsData = cards.map(c => ({
            name: c.name || '',
            brand: c.brand || '',
            limit: parseFloat(c.limit) || 0,
            spent: parseFloat(c.spent) || 0,
            closingDay: c.closingDay || '',
            dueDay: c.dueDay || '',
            color: c.color || '#6C63FF'
        }));
        
        const debtorsData = debtors.map(d => ({
            name: d.name || '',
            phone: d.phone || '',
            email: d.email || '',
            notes: d.notes || '',
            totalOwed: calculateDebtorTotal(d.name)
        }));
        
        // Enviar via POST
        const payload = {
            action: 'syncAll',
            transactions: transactionsData,
            cards: cardsData,
            debtors: debtorsData
        };
        
        console.log('📤 Enviando dados para planilha...');
        
        // Tentativa 1: POST com JSON
        try {
            const response = await fetch(GOOGLE_SHEETS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log('✅ Dados enviados via POST');
        } catch(e) {
            console.log('POST falhou, tentando GET...');
            // Tentativa 2: GET com parâmetro URL encoded
            const encodedData = encodeURIComponent(JSON.stringify(payload));
            await fetch(`${GOOGLE_SHEETS_URL}?action=syncAll&data=${encodedData}`, { mode: 'no-cors' });
            console.log('✅ Dados enviados via GET');
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao enviar dados:', error);
        throw error;
    }
}

async function downloadAllFromSheets() {
    try {
        console.log('📥 Baixando dados da planilha...');
        
        // Baixar transações
        const transResp = await fetch(`${GOOGLE_SHEETS_URL}?action=getTransactions`);
        const transResult = await transResp.json();
        
        if (transResult.success && transResult.transactions && transResult.transactions.length > 0) {
            const newTransactions = transResult.transactions.map((t, i) => {
                let dateValue = t.data || t.date || '';
                if (dateValue && dateValue.includes('T')) dateValue = dateValue.split('T')[0];
                
                return {
                    id: Date.now() + i + Math.random(),
                    type: (t.tipo || t.type || 'saida').toString().toLowerCase().trim(),
                    value: parseFloat(t.valor || t.value) || 0,
                    category: (t.categoria || t.category || 'Outros').toString().trim(),
                    description: (t.descrição || t.description || '').toString().trim(),
                    date: dateValue || new Date().toISOString().split('T')[0],
                    card: (t.cartão || t.card || '').toString().trim(),
                    debtor: (t.devedor || t.debtor || '').toString().trim()
                };
            }).filter(t => t.date && t.category);
            
            if (newTransactions.length > 0) {
                transactions = newTransactions;
                saveTransactionsLocal();
                console.log('✅ Transações carregadas:', transactions.length);
            }
        }
        
        // Baixar cartões
        const cardsResp = await fetch(`${GOOGLE_SHEETS_URL}?action=getCards`);
        const cardsResult = await cardsResp.json();
        
        if (cardsResult.success && cardsResult.cards && cardsResult.cards.length > 0) {
            const newCards = cardsResult.cards.map((c, i) => ({
                id: Date.now() + i + Math.random(),
                name: (c.nome || c.name || '').toString().trim(),
                brand: (c.bandeira || c.brand || '').toString().trim(),
                limit: parseFloat(c.limite || c.limit) || 0,
                spent: parseFloat(c.gasto || c.spent) || 0,
                closingDay: parseInt(c['dia fechamento'] || c.closingDay) || null,
                dueDay: parseInt(c['dia vencimento'] || c.dueDay) || null,
                color: (c.cor || c.color || '#6C63FF').toString()
            })).filter(c => c.name);
            
            if (newCards.length > 0) {
                cards = newCards;
                saveCardsLocal();
                console.log('✅ Cartões carregados:', cards.length);
            }
        }
        
        // Baixar devedores
        const debtorsResp = await fetch(`${GOOGLE_SHEETS_URL}?action=getDebtors`);
        const debtorsResult = await debtorsResp.json();
        
        if (debtorsResult.success && debtorsResult.debtors && debtorsResult.debtors.length > 0) {
            const newDebtors = debtorsResult.debtors.map((d, i) => ({
                id: Date.now() + i + Math.random(),
                name: (d.nome || d.name || '').toString().trim(),
                phone: (d.telefone || d.phone || '').toString(),
                email: (d.email || '').toString(),
                notes: (d.observações || d.observacoes || d.notes || '').toString(),
                totalOwed: parseFloat(d['total devido'] || d.totalOwed) || 0
            })).filter(d => d.name);
            
            if (newDebtors.length > 0) {
                debtors = newDebtors;
                saveDebtorsLocal();
                console.log('✅ Devedores carregados:', debtors.length);
            }
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao baixar dados:', error);
        throw error;
    }
}

// ============================================
// STORAGE FUNCTIONS
// ============================================
function saveTransactionsLocal() { 
    localStorage.setItem('transactions', JSON.stringify(transactions)); 
    updateCardSpending();
}

function saveCardsLocal() { 
    localStorage.setItem('cards', JSON.stringify(cards)); 
}

function saveBudgetsLocal() { 
    localStorage.setItem('budgets', JSON.stringify(budgets)); 
}

function saveDebtorsLocal() { 
    localStorage.setItem('debtors', JSON.stringify(debtors)); 
}

function saveSettingsLocal() { 
    localStorage.setItem('financeSettings', JSON.stringify(settings)); 
}

async function saveTransactions() { 
    saveTransactionsLocal(); 
    await autoSaveToSheets();
}

async function saveCards() { 
    saveCardsLocal(); 
    await autoSaveToSheets();
}

async function saveBudgets() { 
    saveBudgetsLocal(); 
    await autoSaveToSheets();
}

async function saveDebtors() { 
    saveDebtorsLocal(); 
    await autoSaveToSheets();
}

async function saveSettings() { 
    saveSettingsLocal(); 
    await autoSaveToSheets();
}

// Auto-save com debounce
let _saveTimeout;
async function autoSaveToSheets() {
    clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(async () => {
        if (!isSyncing) {
            console.log('💾 Auto-save para planilha...');
            await uploadAllToSheets();
        }
    }, 3000);
}

// ============================================
// APP INIT
// ============================================
function initializeApp() {
    const sheetsLink = document.getElementById('sheetsLink');
    if (sheetsLink) sheetsLink.href = SHEETS_LINK;
    
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) monthFilter.value = new Date().toISOString().slice(0, 7);
    
    updateCardSelect();
    updateTransactionTypeSelect();
    updateCategorySelects();
    updateDebtorSelect();
}

function setupEventListeners() {
    document.querySelectorAll('.nav-item:not(.nav-parent)').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page) navigateTo(page);
        });
    });
    
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) monthFilter.addEventListener('change', () => { updateDashboard(); updateMonthProgress(); });
    
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) transactionForm.addEventListener('submit', handleTransactionSubmit);
    
    const typeForm = document.getElementById('typeForm');
    if (typeForm) typeForm.addEventListener('submit', handleTypeSubmit);
    
    const categoryForm = document.getElementById('categoryForm');
    if (categoryForm) categoryForm.addEventListener('submit', handleCategorySubmit);
    
    const cardSettingsForm = document.getElementById('cardSettingsForm');
    if (cardSettingsForm) cardSettingsForm.addEventListener('submit', handleCardSettingsSubmit);
    
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

// ============================================
// NAVEGAÇÃO
// ============================================
function navigateTo(page) {
    console.log('Navegando para:', page);
    
    document.querySelectorAll('.nav-item').forEach(item => {
        if(item.dataset && item.dataset.page === page) {
            item.classList.add('active');
        } else if(item.classList && !item.classList.contains('nav-parent')) {
            item.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`${page}-page`);
    if (targetPage) targetPage.classList.add('active');
    
    setTimeout(() => {
        switch(page) {
            case 'home': updateDashboard(); initializeCharts(); updateMonthProgress(); break;
            case 'dashboard': loadDashboard(currentDashboard); break;
            case 'transactions': renderTransactions(); break;
            case 'cards': renderCards(); break;
            case 'budget': renderBudgets(); break;
            case 'settings':
                renderTypes(); 
                renderCategories(); 
                renderCardsSettings(); 
                renderDebtors(); 
                renderDebtorsSummary();
                const cs = document.getElementById('currencySetting'); 
                if (cs) cs.value = settings.currency || 'BRL';
                const ts = document.getElementById('themeSetting'); 
                if (ts) ts.value = settings.theme || 'dark';
                break;
        }
    }, 100);
}

function toggleSubmenu(event, submenuId) {
    event.preventDefault();
    const parent = event.currentTarget;
    const submenu = document.getElementById(submenuId);
    if (parent && submenu) { 
        parent.classList.toggle('active'); 
        submenu.classList.toggle('active'); 
    }
}

document.addEventListener('click', function(e) {
    const submenuItem = e.target.closest('.submenu-item');
    if (submenuItem) {
        e.preventDefault();
        document.querySelectorAll('.submenu-item').forEach(item => item.classList.remove('active'));
        submenuItem.classList.add('active');
        navigateTo('dashboard');
        const dashboardType = submenuItem.dataset.dashboard;
        if (dashboardType) { currentDashboard = dashboardType; loadDashboard(dashboardType); }
    }
});

// ============================================
// DASHBOARD PRINCIPAL
// ============================================
function updateDashboard() {
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter) return;
    
    const selectedMonth = monthFilter.value;
    const monthTransactions = transactions.filter(t => t.date && t.date.startsWith(selectedMonth));
    
    const income = monthTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const expense = monthTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const balance = income - expense;
    
    generateSmartAnalysis(monthTransactions, income, expense, balance);
    
    const el = (id) => document.getElementById(id);
    if (el('totalIncome')) el('totalIncome').textContent = formatCurrency(income);
    if (el('totalExpense')) el('totalExpense').textContent = formatCurrency(expense);
    if (el('totalBalance')) el('totalBalance').textContent = formatCurrency(balance);
    if (el('savingsRate')) el('savingsRate').textContent = `${income > 0 ? ((balance/income)*100).toFixed(1) : 0}%`;
    if (el('balanceTrend')) {
        el('balanceTrend').textContent = balance >= 0 ? 'Saldo positivo' : 'Saldo negativo';
        el('balanceTrend').className = `card-trend ${balance >= 0 ? 'positive' : 'negative'}`;
    }
    
    updateCharts(monthTransactions);
}

function updateMonthProgress() {
    const now = new Date();
    const currentDay = now.getDate();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const progress = (currentDay / lastDay) * 100;
    if (document.getElementById('daysProgress')) document.getElementById('daysProgress').textContent = `${progress.toFixed(1)}%`;
    if (document.getElementById('monthProgressBar')) document.getElementById('monthProgressBar').style.width = `${progress}%`;
}

function updateCharts(monthTransactions) {
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter) return;
    const selectedMonth = monthFilter.value;
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const dailyData = Array.from({length: daysInMonth}, (_, i) => {
        const dayStr = `${selectedMonth}-${String(i + 1).padStart(2, '0')}`;
        const dayTransactions = monthTransactions.filter(t => t.date === dayStr);
        return {
            income: dayTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value || 0), 0),
            expense: dayTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value || 0), 0)
        };
    });
    
    // Atualizar gráfico de fluxo de caixa
    const cashflowCanvas = document.getElementById('cashflowChart');
    if (cashflowCanvas && charts['cashflowChart']) {
        charts['cashflowChart'].data.labels = Array.from({length: daysInMonth}, (_, i) => `Dia ${i + 1}`);
        charts['cashflowChart'].data.datasets[0].data = dailyData.map(d => d.income);
        charts['cashflowChart'].data.datasets[1].data = dailyData.map(d => d.expense);
        charts['cashflowChart'].update();
    }
    
    // Atualizar gráfico de categorias
    const categoryExpense = {};
    monthTransactions.filter(t => t.type === 'saida').forEach(t => {
        categoryExpense[t.category] = (categoryExpense[t.category] || 0) + parseFloat(t.value || 0);
    });
    const sortedCategories = Object.entries(categoryExpense).sort(([,a], [,b]) => b - a).slice(0, 6);
    
    const categoryCanvas = document.getElementById('categoryChart');
    if (categoryCanvas && charts['categoryChart']) {
        charts['categoryChart'].data.labels = sortedCategories.map(([name]) => name);
        charts['categoryChart'].data.datasets[0].data = sortedCategories.map(([,value]) => value);
        charts['categoryChart'].update();
    }
    
    // Atualizar gráfico de cartões
    const cardExpense = {};
    monthTransactions.filter(t => t.type === 'saida' && t.card).forEach(t => {
        cardExpense[t.card] = (cardExpense[t.card] || 0) + parseFloat(t.value || 0);
    });
    
    const cardCanvas = document.getElementById('cardChart');
    if (cardCanvas && charts['cardChart']) {
        charts['cardChart'].data.labels = Object.keys(cardExpense);
        charts['cardChart'].data.datasets[0].data = Object.values(cardExpense);
        charts['cardChart'].update();
    }
}

function generateSmartAnalysis(monthTransactions, income, expense, balance) {
    const el = document.getElementById('smartAnalysis');
    if (!el) return;
    let analysis = '';
    if (balance >= 0) {
        analysis += `✅ <strong style="color:#4CAF50;">Parabéns!</strong> Saldo positivo de <strong>${formatCurrency(balance)}</strong>.<br><br>`;
    } else {
        analysis += `⚠️ <strong style="color:#F44336;">Atenção!</strong> Gastos superaram a renda em <strong>${formatCurrency(Math.abs(balance))}</strong>.<br><br>`;
    }
    const daysPassed = new Date().getDate();
    const dailyAvg = expense / Math.max(1, daysPassed);
    const projectedExpense = dailyAvg * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    analysis += `🔮 Projeção de gastos: <strong>${formatCurrency(projectedExpense)}</strong>`;
    el.innerHTML = analysis;
}

// ============================================
// CHARTS
// ============================================
function initializeCharts() {
    Chart.defaults.color = '#b3b3b3';
    
    // Gráfico de fluxo de caixa (linha)
    const cashflowCanvas = document.getElementById('cashflowChart');
    if (cashflowCanvas) {
        if (charts['cashflowChart']) charts['cashflowChart'].destroy();
        charts['cashflowChart'] = new Chart(cashflowCanvas.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [
                { label: 'Entradas', data: [], borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)', fill: true, tension: 0.4, borderWidth: 2 },
                { label: 'Saídas', data: [], borderColor: '#F44336', backgroundColor: 'rgba(244, 67, 54, 0.1)', fill: true, tension: 0.4, borderWidth: 2 }
            ] },
            options: getChartOptions()
        });
    }
    
    // Gráfico de categorias (doughnut)
    const categoryCanvas = document.getElementById('categoryChart');
    if (categoryCanvas) {
        if (charts['categoryChart']) charts['categoryChart'].destroy();
        charts['categoryChart'] = new Chart(categoryCanvas.getContext('2d'), {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'] }] },
            options: getChartOptions()
        });
    }
    
    // Gráfico de cartões (doughnut)
    const cardCanvas = document.getElementById('cardChart');
    if (cardCanvas) {
        if (charts['cardChart']) charts['cardChart'].destroy();
        charts['cardChart'] = new Chart(cardCanvas.getContext('2d'), {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#6C63FF', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'] }] },
            options: getChartOptions()
        });
    }
}

function getChartOptions() {
    return {
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { 
            legend: { 
                position: 'bottom', 
                labels: { color: '#b3b3b3', padding: 15, font: { size: 12 }, usePointStyle: true } 
            } 
        },
        scales: { 
            y: { beginAtZero: true, grid: { color: 'rgba(42, 42, 74, 0.5)' }, ticks: { color: '#b3b3b3' } }, 
            x: { grid: { display: false }, ticks: { color: '#b3b3b3' } } 
        }
    };
}

// ============================================
// TRANSAÇÕES
// ============================================
async function handleTransactionSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('transType')?.value || 'saida';
    const valueInput = document.getElementById('transValue')?.value;
    const category = document.getElementById('transCategory')?.value;
    const description = document.getElementById('transDescription')?.value;
    const date = document.getElementById('transDate')?.value;
    const card = document.getElementById('transCard')?.value || '';
    const installments = parseInt(document.getElementById('transInstallments')?.value) || 1;
    const debtor = document.getElementById('transDebtor')?.value || '';
    
    if (!valueInput || parseFloat(valueInput) <= 0) { showNotification('Valor inválido!', 'error'); return; }
    if (!category) { showNotification('Selecione uma categoria!', 'error'); return; }
    if (!description?.trim()) { showNotification('Insira uma descrição!', 'error'); return; }
    if (!date) { showNotification('Selecione uma data!', 'error'); return; }
    
    const base = { 
        type, 
        value: parseFloat(valueInput), 
        category, 
        description: description.trim(), 
        date, 
        card, 
        debtor,
        installments: installments > 1 ? installments.toString() : ''
    };
    
    if (card && installments > 1) {
        const installmentsArr = createInstallmentTransactions(base, installments);
        transactions.unshift(...installmentsArr);
        showNotification(`${installments} parcelas criadas!`, 'success');
    } else {
        base.id = Date.now();
        transactions.unshift(base);
        showNotification('Transação adicionada!', 'success');
    }
    
    await saveTransactions();
    closeModal();
    updateDashboard();
    renderTransactions();
    updateCardSpending();
    if (debtor) renderDebtorsSummary();
}

function createInstallmentTransactions(base, installments) {
    const result = [];
    const per = base.value / installments;
    const [y, m, d] = base.date.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    for (let i = 0; i < installments; i++) {
        const dt = new Date(start);
        dt.setMonth(start.getMonth() + i);
        const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
        dt.setDate(Math.min(d, lastDay));
        result.push({
            id: Date.now() + i,
            type: base.type, 
            value: per, 
            category: base.category,
            description: `${base.description} (${i + 1}/${installments})`, 
            date: dt.toISOString().split('T')[0],
            card: base.card, 
            debtor: base.debtor || '',
            installments: installments.toString()
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
            <td>${t.debtor ? `<span class="debtor-badge"><i class="fas fa-user"></i> ${t.debtor}</span>` : '-'}</td>
            <td class="transaction-value ${t.type === 'entrada' ? 'positive' : 'negative'}">${t.type === 'entrada' ? '+' : '-'} ${formatCurrency(t.value)}</td>
            <td><button onclick="editTransaction(${t.id})" class="btn-icon"><i class="fas fa-edit"></i></button><button onclick="deleteTransaction(${t.id})" class="btn-icon btn-delete"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

async function editTransaction(id) {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    openAddModal();
    document.getElementById('transType').value = t.type;
    document.getElementById('transValue').value = t.value;
    document.getElementById('transCategory').value = t.category;
    document.getElementById('transDescription').value = t.description;
    document.getElementById('transDate').value = t.date;
    document.getElementById('transCard').value = t.card || '';
    if (t.card) {
        document.getElementById('installmentsGroup').style.display = 'block';
        document.getElementById('debtorGroup').style.display = 'block';
        document.getElementById('transDebtor').value = t.debtor || '';
    }
    transactions = transactions.filter(x => x.id !== id);
    await saveTransactions();
    showNotification('Pronto para editar a transação', 'success');
}

async function deleteTransaction(id) {
    if (confirm('Excluir esta transação?')) {
        transactions = transactions.filter(t => t.id !== id);
        await saveTransactions();
        updateDashboard();
        renderTransactions();
        showNotification('Transação excluída!', 'success');
    }
}

function filterTransactions() {
    const search = document.querySelector('.search-input')?.value.toLowerCase() || '';
    const filter = document.querySelector('.filter-select')?.value.toLowerCase() || 'todas';
    let filtered = transactions;
    if (filter === 'entradas') filtered = filtered.filter(t => t.type === 'entrada');
    if (filter === 'saídas') filtered = filtered.filter(t => t.type === 'saida');
    if (search) filtered = filtered.filter(t => t.description?.toLowerCase().includes(search) || t.category?.toLowerCase().includes(search) || t.debtor?.toLowerCase().includes(search));
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;
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
            <td>${t.debtor ? `<span class="debtor-badge"><i class="fas fa-user"></i> ${t.debtor}</span>` : '-'}</td>
            <td class="transaction-value ${t.type === 'entrada' ? 'positive' : 'negative'}">${t.type === 'entrada' ? '+' : '-'} ${formatCurrency(t.value)}</td>
            <td><button onclick="editTransaction(${t.id})" class="btn-icon"><i class="fas fa-edit"></i></button><button onclick="deleteTransaction(${t.id})" class="btn-icon btn-delete"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

// ============================================
// CARTÕES
// ============================================
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
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0,2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2,2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4,2), 16) + amount));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function updateCardSelect() {
    const select = document.getElementById('transCard');
    if (!select) return;
    select.innerHTML = '<option value="">Nenhum (Débito/Dinheiro)</option>' + cards.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function updateCardSpending() {
    cards.forEach(card => {
        card.spent = transactions.filter(t => t.type === 'saida' && t.card === card.name).reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    });
    saveCardsLocal();
}

// ============================================
// CONFIGURAÇÕES - TIPOS
// ============================================
function renderTypes() {
    const list = document.getElementById('typesList');
    if (!list) return;
    list.innerHTML = settings.types.map(t => `
        <div class="settings-item">
            <div class="settings-item-info"><div class="settings-item-icon" style="background:${t.color}"><i class="fas fa-${t.icon}"></i></div><div class="settings-item-details"><span class="settings-item-name">${t.name}</span></div></div>
            <div class="settings-item-actions"><button class="settings-btn-icon" onclick="editType(${t.id})"><i class="fas fa-edit"></i></button><button class="settings-btn-icon btn-delete" onclick="deleteType(${t.id})"><i class="fas fa-trash"></i></button></div>
        </div>
    `).join('');
    updateTransactionTypeSelect();
}

function openAddTypeModal() { 
    document.getElementById('typeModal').classList.add('active'); 
    document.getElementById('typeEditId').value = '';
    document.getElementById('typeName').value = '';
    document.getElementById('typeIcon').value = '';
    document.getElementById('typeColor').value = '#4CAF50';
    document.getElementById('typeFlow').value = 'entrada';
}
function closeTypeModal() { document.getElementById('typeModal').classList.remove('active'); }

async function deleteType(id) { 
    if (confirm('Excluir este tipo?')) { 
        settings.types = settings.types.filter(t => t.id !== id); 
        await saveSettings(); 
        renderTypes(); 
    } 
}

async function handleTypeSubmit(e) {
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
    await saveSettings(); 
    closeTypeModal(); 
    renderTypes();
}

function editType(id) {
    const t = settings.types.find(x => x.id === id); 
    if (!t) return;
    document.getElementById('typeEditId').value = t.id; 
    document.getElementById('typeName').value = t.name;
    document.getElementById('typeIcon').value = t.icon; 
    document.getElementById('typeColor').value = t.color;
    document.getElementById('typeFlow').value = t.flow; 
    document.getElementById('typeModal').classList.add('active');
}

function updateTransactionTypeSelect() {
    const select = document.getElementById('transType'); 
    if (!select) return;
    select.innerHTML = '<option value="saida">Saída</option><option value="entrada">Entrada</option>';
    select.value = 'saida';
}

// ============================================
// CONFIGURAÇÕES - CATEGORIAS
// ============================================
function renderCategories() {
    const list = document.getElementById('categoriesList'); 
    if (!list) return;
    const entrada = settings.categories.filter(c => c.type === 'entrada' || c.type === 'ambos');
    const saida = settings.categories.filter(c => c.type === 'saida' || c.type === 'ambos');
    list.innerHTML = `<h4 style="color:#4CAF50;margin-bottom:8px;"><i class="fas fa-arrow-up"></i> Entradas</h4>${entrada.map(c => createCategoryItem(c)).join('')}<h4 style="color:#F44336;margin:16px 0 8px;"><i class="fas fa-arrow-down"></i> Saídas</h4>${saida.map(c => createCategoryItem(c)).join('')}`;
    updateCategorySelects();
}

function createCategoryItem(c) {
    return `<div class="settings-item"><div class="settings-item-info"><div class="settings-item-icon" style="background:${c.color}"><i class="fas fa-${c.icon}"></i></div><div class="settings-item-details"><span class="settings-item-name">${c.name}</span></div></div><div class="settings-item-actions"><button class="settings-btn-icon" onclick="editCategory(${c.id})"><i class="fas fa-edit"></i></button><button class="settings-btn-icon btn-delete" onclick="deleteCategory(${c.id})"><i class="fas fa-trash"></i></button></div></div>`;
}

function openAddCategoryModal() { 
    document.getElementById('categoryModal').classList.add('active');
    document.getElementById('categoryEditId').value = '';
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryType').value = 'saida';
    document.getElementById('categoryIcon').value = 'tag';
    document.getElementById('categoryColor').value = '#6C63FF';
    document.getElementById('categoryBudget').value = '';
}
function closeCategoryModal() { document.getElementById('categoryModal').classList.remove('active'); }

async function deleteCategory(id) { 
    if (confirm('Excluir esta categoria?')) { 
        settings.categories = settings.categories.filter(c => c.id !== id); 
        await saveSettings(); 
        renderCategories(); 
    } 
}

async function handleCategorySubmit(e) {
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
    await saveSettings(); 
    closeCategoryModal(); 
    renderCategories();
}

function editCategory(id) {
    const c = settings.categories.find(x => x.id === id); 
    if (!c) return;
    document.getElementById('categoryEditId').value = c.id; 
    document.getElementById('categoryName').value = c.name;
    document.getElementById('categoryType').value = c.type; 
    document.getElementById('categoryIcon').value = c.icon;
    document.getElementById('categoryColor').value = c.color; 
    document.getElementById('categoryBudget').value = c.budget || '';
    document.getElementById('categoryModal').classList.add('active');
}

function updateCategorySelects() {
    [document.getElementById('transCategory'), document.getElementById('budgetCategory')].forEach(select => {
        if (!select) return;
        const entrada = settings.categories.filter(c => c.type === 'entrada' || c.type === 'ambos');
        const saida = settings.categories.filter(c => c.type === 'saida' || c.type === 'ambos');
        select.innerHTML = `<option value="">Selecione...</option><optgroup label="Entradas">${entrada.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</optgroup><optgroup label="Saídas">${saida.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</optgroup>`;
    });
}

// ============================================
// CONFIGURAÇÕES - CARTÕES
// ============================================
function renderCardsSettings() {
    const list = document.getElementById('cardsSettingsList'); 
    if (!list) return;
    if (cards.length === 0) { 
        list.innerHTML = `<div class="empty-state"><p>Nenhum cartão</p><button class="btn-add-small" onclick="openAddCardSettingsModal()">Adicionar</button></div>`; 
        return; 
    }
    list.innerHTML = cards.map(card => `<div class="settings-item"><div class="settings-item-info"><div class="settings-item-icon" style="background:${card.color}"><i class="fas fa-credit-card"></i></div><div class="settings-item-details"><span class="settings-item-name">${card.name}</span></div></div><div class="settings-item-actions"><button class="settings-btn-icon" onclick="editCardSettings(${card.id})"><i class="fas fa-edit"></i></button><button class="settings-btn-icon btn-delete" onclick="deleteCardSettings(${card.id})"><i class="fas fa-trash"></i></button></div></div>`).join('');
}

function openAddCardSettingsModal() { 
    document.getElementById('cardSettingsModal').classList.add('active');
    document.getElementById('cardSettingsEditId').value = '';
    document.getElementById('cardSettingsName').value = '';
    document.getElementById('cardSettingsBrand').value = 'Visa';
    document.getElementById('cardSettingsLimit').value = '';
    document.getElementById('cardSettingsClosingDay').value = '';
    document.getElementById('cardSettingsDueDay').value = '';
    document.getElementById('cardSettingsColor').value = '#6C63FF';
}
function closeCardSettingsModal() { document.getElementById('cardSettingsModal').classList.remove('active'); }

async function deleteCardSettings(id) { 
    if (confirm('Excluir este cartão?')) { 
        cards = cards.filter(c => c.id !== id); 
        await saveCards(); 
        renderCardsSettings(); 
        renderCards(); 
        updateCardSelect();
    } 
}

async function handleCardSettingsSubmit(e) {
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
    if (!data.name) return;
    const editId = document.getElementById('cardSettingsEditId').value;
    if (editId) { 
        const idx = cards.findIndex(c => c.id === parseInt(editId)); 
        if (idx !== -1) { 
            data.spent = cards[idx].spent; 
            cards[idx] = { ...cards[idx], ...data }; 
        } 
    } else { 
        cards.push({ id: Date.now(), ...data }); 
    }
    await saveCards(); 
    closeCardSettingsModal(); 
    renderCardsSettings(); 
    renderCards();
    updateCardSelect();
}

function editCardSettings(id) {
    const card = cards.find(c => c.id === id); 
    if (!card) return;
    document.getElementById('cardSettingsEditId').value = card.id; 
    document.getElementById('cardSettingsName').value = card.name;
    document.getElementById('cardSettingsBrand').value = card.brand || ''; 
    document.getElementById('cardSettingsLimit').value = card.limit;
    document.getElementById('cardSettingsClosingDay').value = card.closingDay || ''; 
    document.getElementById('cardSettingsDueDay').value = card.dueDay || '';
    document.getElementById('cardSettingsColor').value = card.color; 
    document.getElementById('cardSettingsModal').classList.add('active');
}

// ============================================
// DEVEDORES
// ============================================
function renderDebtors() {
    const list = document.getElementById('debtorsList'); 
    if (!list) return;
    if (debtors.length === 0) { 
        list.innerHTML = `<div class="empty-state"><p>Nenhum devedor</p><button class="btn-add-small" onclick="openAddDebtorModal()">Adicionar</button></div>`; 
        return; 
    }
    list.innerHTML = debtors.map(d => {
        const totalOwed = calculateDebtorTotal(d.name);
        return `<div class="settings-item"><div class="settings-item-info"><div class="settings-item-icon" style="background:#FF9800"><i class="fas fa-user"></i></div><div class="settings-item-details"><span class="settings-item-name">${d.name}</span><span style="color:#F44336;font-weight:600;">${formatCurrency(totalOwed)}</span></div></div><div class="settings-item-actions"><button class="settings-btn-icon" onclick="editDebtor(${d.id})"><i class="fas fa-edit"></i></button><button class="settings-btn-icon btn-delete" onclick="deleteDebtor(${d.id})"><i class="fas fa-trash"></i></button></div></div>`;
    }).join('');
    updateDebtorSelect(); 
    renderDebtorsSummary();
}

function renderDebtorsSummary() {
    const tbody = document.getElementById('debtorsSummaryBody'); 
    if (!tbody) return;
    const summary = {};
    transactions.forEach(t => { 
        if (t.debtor && t.type === 'saida') { 
            if (!summary[t.debtor]) summary[t.debtor] = { total: 0, count: 0, lastDate: null }; 
            summary[t.debtor].total += parseFloat(t.value || 0); 
            summary[t.debtor].count++; 
            if (!summary[t.debtor].lastDate || t.date > summary[t.debtor].lastDate) summary[t.debtor].lastDate = t.date; 
        } 
    });
    if (Object.keys(summary).length === 0) { 
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;">Nenhuma dívida</td></tr>`; 
        return; 
    }
    const sorted = Object.entries(summary).sort(([,a], [,b]) => b.total - a.total);
    tbody.innerHTML = sorted.map(([name, data]) => `<tr><td>${name}</td><td style="color:#F44336;font-weight:600;">${formatCurrency(data.total)}</td><td>${data.count}</td><td>${data.lastDate ? formatDate(data.lastDate) : '-'}</td><td>${Math.floor((new Date() - new Date(data.lastDate)) / (1000 * 60 * 60 * 24)) > 30 ? 'Atrasado' : 'Pendente'}</td></tr>`).join('');
}

function calculateDebtorTotal(name) { 
    return transactions.filter(t => t.debtor === name && t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value || 0), 0); 
}

function openAddDebtorModal() { 
    document.getElementById('debtorModal').classList.add('active');
    document.getElementById('debtorEditId').value = '';
    document.getElementById('debtorName').value = '';
    document.getElementById('debtorPhone').value = '';
    document.getElementById('debtorEmail').value = '';
    document.getElementById('debtorNotes').value = '';
}
function closeDebtorModal() { document.getElementById('debtorModal').classList.remove('active'); }

async function deleteDebtor(id) { 
    if (confirm('Excluir este devedor?')) { 
        debtors = debtors.filter(d => d.id !== id); 
        await saveDebtors(); 
        renderDebtors(); 
    } 
}

function editDebtor(id) {
    const debtor = debtors.find(d => d.id === id); 
    if (!debtor) return;
    document.getElementById('debtorEditId').value = debtor.id; 
    document.getElementById('debtorName').value = debtor.name;
    document.getElementById('debtorPhone').value = debtor.phone || ''; 
    document.getElementById('debtorEmail').value = debtor.email || '';
    document.getElementById('debtorNotes').value = debtor.notes || ''; 
    document.getElementById('debtorModal').classList.add('active');
}

document.addEventListener('submit', async function(e) {
    if (e.target.id === 'debtorForm') {
        e.preventDefault();
        const editId = document.getElementById('debtorEditId').value;
        const data = { 
            name: document.getElementById('debtorName').value.trim(), 
            phone: document.getElementById('debtorPhone').value.trim(), 
            email: document.getElementById('debtorEmail').value.trim(), 
            notes: document.getElementById('debtorNotes').value.trim() 
        };
        if (!data.name) return;
        if (editId) { 
            const idx = debtors.findIndex(d => d.id === parseInt(editId)); 
            if (idx !== -1) { 
                const oldName = debtors[idx].name; 
                debtors[idx] = { ...debtors[idx], ...data }; 
                if (oldName !== data.name) transactions.forEach(t => { if (t.debtor === oldName) t.debtor = data.name; }); 
                await saveTransactions();
            } 
        } else { 
            debtors.push({ id: Date.now(), ...data }); 
        }
        await saveDebtors(); 
        closeDebtorModal(); 
        renderDebtors();
    }
});

function updateDebtorSelect() {
    const select = document.getElementById('transDebtor'); 
    if (!select) return;
    select.innerHTML = '<option value="">Nenhum</option>' + debtors.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
}

// ============================================
// CAMPOS DO CARTÃO
// ============================================
function toggleCardFields() {
    const card = document.getElementById('transCard')?.value;
    const installmentsGroup = document.getElementById('installmentsGroup');
    const debtorGroup = document.getElementById('debtorGroup');
    if (installmentsGroup) installmentsGroup.style.display = card ? 'block' : 'none';
    if (debtorGroup) debtorGroup.style.display = card ? 'block' : 'none';
    if (!card) { 
        const installmentsSelect = document.getElementById('transInstallments');
        if (installmentsSelect) installmentsSelect.value = '1';
        const debtorSelect = document.getElementById('transDebtor');
        if (debtorSelect) debtorSelect.value = '';
        const preview = document.getElementById('installmentPreview');
        if (preview) preview.style.display = 'none';
    }
    updateInstallmentPreview();
}

function updateInstallmentPreview() {
    const card = document.getElementById('transCard')?.value;
    const installments = parseInt(document.getElementById('transInstallments')?.value) || 1;
    const value = parseFloat(document.getElementById('transValue')?.value) || 0;
    const date = document.getElementById('transDate')?.value;
    const preview = document.getElementById('installmentPreview');
    if (!card || installments <= 1) { 
        if (preview) preview.style.display = 'none'; 
        return; 
    }
    if (!date || value <= 0) { 
        if (preview) preview.style.display = 'none'; 
        return; 
    }
    const per = value / installments;
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    let html = '';
    for (let i = 0; i < installments; i++) {
        const dt = new Date(start); 
        dt.setMonth(start.getMonth() + i);
        dt.setDate(Math.min(d, new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()));
        html += `<div style="display:flex;justify-content:space-between;padding:6px 0;">${i+1}ª - ${dt.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})} <span style="color:#F44336;">${formatCurrency(per)}</span></div>`;
    }
    const listEl = document.getElementById('installmentList');
    if (listEl) listEl.innerHTML = html;
    if (preview) preview.style.display = 'block';
}

// ============================================
// DASHBOARD MODULAR
// ============================================
function loadDashboard(type) {
    const container = document.getElementById('dashboardContainer'); 
    if (!container) return;
    
    const startDate = document.getElementById('dashboardDateStart')?.value || dashboardDateStart;
    const endDate = document.getElementById('dashboardDateEnd')?.value || dashboardDateEnd;
    
    const filtered = transactions.filter(t => t.date >= startDate && t.date <= endDate);
    const titles = { overview: 'Visão Geral', debtors: 'Devedores', cards: 'Cartões', income: 'Entradas', expense: 'Saídas', categories: 'Categorias', monthly: 'Comparativo Mensal' };
    
    container.innerHTML = `<div class="dashboard-container"><div class="dashboard-header"><h2 class="dashboard-title">${titles[type] || 'Dashboard'}</h2><div class="dashboard-filters"><input type="date" id="dashboardDateStart" value="${startDate}" onchange="updateDashboardDates()"><span>até</span><input type="date" id="dashboardDateEnd" value="${endDate}" onchange="updateDashboardDates()"></div></div><div id="dashboardSummaryCards" class="dashboard-summary-cards"></div><div class="chart-card full-width"><canvas id="mainDashboardChart"></canvas></div></div>`;
    
    const income = filtered.filter(t => t.type === 'entrada').reduce((s, t) => s + parseFloat(t.value || 0), 0);
    const expense = filtered.filter(t => t.type === 'saida').reduce((s, t) => s + parseFloat(t.value || 0), 0);
    
    const summaryCards = document.getElementById('dashboardSummaryCards');
    if (summaryCards) summaryCards.innerHTML = `<div class="summary-mini-card"><div class="mini-icon" style="background:rgba(76,175,80,0.1);color:#4CAF50;"><i class="fas fa-arrow-up"></i></div><div class="mini-label">Entradas</div><div class="mini-value" style="color:#4CAF50;">${formatCurrency(income)}</div></div><div class="summary-mini-card"><div class="mini-icon" style="background:rgba(244,67,54,0.1);color:#F44336;"><i class="fas fa-arrow-down"></i></div><div class="mini-label">Saídas</div><div class="mini-value" style="color:#F44336;">${formatCurrency(expense)}</div></div><div class="summary-mini-card"><div class="mini-icon" style="background:rgba(108,99,255,0.1);color:#6C63FF;"><i class="fas fa-balance-scale"></i></div><div class="mini-label">Saldo</div><div class="mini-value" style="color:#6C63FF;">${formatCurrency(income - expense)}</div></div></div>`;
    
    const canvas = document.getElementById('mainDashboardChart');
    if (canvas) {
        const catSummary = {}; 
        filtered.filter(t => t.type === 'saida').forEach(t => { 
            catSummary[t.category] = (catSummary[t.category] || 0) + parseFloat(t.value || 0); 
        });
        const sorted = Object.entries(catSummary).sort(([,a], [,b]) => b - a);
        new Chart(canvas.getContext('2d'), { 
            type: 'doughnut', 
            data: { 
                labels: sorted.map(([n]) => n), 
                datasets: [{ 
                    data: sorted.map(([,v]) => v), 
                    backgroundColor: ['#F44336','#E91E63','#9C27B0','#673AB7','#3F51B5','#2196F3','#00BCD4','#4CAF50','#FF9800','#FFC107']
                }] 
            }, 
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#b3b3b3' } } } } 
        });
    }
}

function updateDashboardDates() { 
    dashboardDateStart = document.getElementById('dashboardDateStart')?.value || dashboardDateStart;
    dashboardDateEnd = document.getElementById('dashboardDateEnd')?.value || dashboardDateEnd;
    loadDashboard(currentDashboard); 
}

// ============================================
// BUDGET
// ============================================
function openBudgetModal() {
    const monthValue = document.getElementById('monthFilter')?.value || new Date().toISOString().slice(0, 7);
    const html = `<div class="modal active" id="budgetModal" style="display:flex;"><div class="modal-content"><div class="modal-header"><h2>Novo Orçamento</h2><button class="close-modal" onclick="document.getElementById('budgetModal').remove()"><i class="fas fa-times"></i></button></div><form id="budgetForm"><div class="form-group"><label>Categoria</label><select id="budgetCategory" required>${settings.categories.filter(c=>c.type==='saida'||c.type==='ambos').map(c=>`<option value="${c.name}">${c.name}</option>`).join('')}</select></div><div class="form-group"><label>Valor</label><input type="number" id="budgetAmount" step="0.01" required></div><div class="form-group"><label>Mês</label><input type="month" id="budgetMonth" required value="${monthValue}"></div><button type="submit" class="btn-submit">Salvar</button></form></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('budgetForm').addEventListener('submit', async function(e) { 
        e.preventDefault(); 
        budgets.push({ 
            id: Date.now(), 
            category: document.getElementById('budgetCategory').value, 
            amount: parseFloat(document.getElementById('budgetAmount').value), 
            month: document.getElementById('budgetMonth').value 
        }); 
        await saveBudgets(); 
        renderBudgets(); 
        document.getElementById('budgetModal').remove(); 
    });
}

function renderBudgets() {
    const grid = document.getElementById('budgetGrid'); 
    if (!grid) return;
    const month = document.getElementById('monthFilter')?.value || new Date().toISOString().slice(0, 7);
    const monthBudgets = budgets.filter(b => b.month === month);
    if (monthBudgets.length === 0) { 
        grid.innerHTML = `<div style="text-align:center;padding:60px;"><h3>Nenhum orçamento para ${month}</h3><button class="btn-add" onclick="openBudgetModal()">Criar Orçamento</button></div>`; 
        return; 
    }
    grid.innerHTML = monthBudgets.map(b => {
        const spent = transactions.filter(t => t.type==='saida' && t.category===b.category && t.date?.startsWith(month)).reduce((s,t) => s+parseFloat(t.value||0), 0);
        const pct = b.amount > 0 ? (spent/b.amount)*100 : 0;
        const color = pct > 100 ? '#F44336' : pct > 80 ? '#FF9800' : '#4CAF50';
        return `<div class="budget-item"><div class="budget-header"><h3>${b.category}</h3><span style="color:${color};">${pct.toFixed(1)}%</span></div><div class="budget-progress"><div class="progress-bar"><div class="progress-fill" style="width:${Math.min(pct,100)}%;background:${color}"></div></div><div class="budget-values"><span>Gasto: ${formatCurrency(spent)}</span><span>Orçamento: ${formatCurrency(b.amount)}</span></div></div></div>`;
    }).join('');
}

// ============================================
// UTILITÁRIOS
// ============================================
function formatCurrency(value) { 
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: settings.currency || 'BRL' }).format(Math.abs(value || 0)); 
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

function openAddModal() {
    const modal = document.getElementById('transactionModal');
    if (modal) modal.classList.add('active');
    const dateInput = document.getElementById('transDate');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    const installmentsGroup = document.getElementById('installmentsGroup');
    const debtorGroup = document.getElementById('debtorGroup');
    const preview = document.getElementById('installmentPreview');
    if (installmentsGroup) installmentsGroup.style.display = 'none';
    if (debtorGroup) debtorGroup.style.display = 'none';
    if (preview) preview.style.display = 'none';
    updateCardSelect(); 
    updateCategorySelects(); 
    updateTransactionTypeSelect(); 
    updateDebtorSelect();
    const typeSelect = document.getElementById('transType');
    if (typeSelect) typeSelect.value = 'saida';
}

function closeModal() { 
    const modal = document.getElementById('transactionModal');
    if (modal) modal.classList.remove('active');
}

function closeAllModals() { 
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active')); 
}

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

async function updateCurrencySetting() { 
    settings.currency = document.getElementById('currencySetting')?.value || 'BRL'; 
    await saveSettings(); 
    updateDashboard(); 
    renderTransactions();
    renderCards();
    renderBudgets();
}

async function updateThemeSetting() { 
    settings.theme = document.getElementById('themeSetting')?.value || 'dark'; 
    await saveSettings(); 
    applyTheme(settings.theme); 
}

function exportData() {
    const data = { 
        transactions, 
        cards, 
        budgets, 
        debtors, 
        settings, 
        exportDate: new Date().toISOString() 
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob); 
    a.download = `finance-backup-${new Date().toISOString().slice(0,10)}.json`; 
    a.click();
    URL.revokeObjectURL(a.href);
    showNotification('Dados exportados com sucesso!', 'success');
}

function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.transactions) { transactions = data.transactions; await saveTransactions(); }
            if (data.cards) { cards = data.cards; await saveCards(); }
            if (data.debtors) { debtors = data.debtors; await saveDebtors(); }
            if (data.budgets) { budgets = data.budgets; await saveBudgets(); }
            if (data.settings) { settings = data.settings; await saveSettings(); }
            updateAllUI();
            showNotification('Dados importados com sucesso!', 'success');
        } catch(err) { 
            alert('Arquivo inválido!'); 
        }
    };
    reader.readAsText(file);
}

function updateAllUI() {
    updateDashboard();
    renderTransactions();
    renderCards();
    renderDebtors();
    renderDebtorsSummary();
    renderBudgets();
    updateCardSelect();
    updateDebtorSelect();
    updateCategorySelects();
    updateTransactionTypeSelect();
    updateCardSpending();
    applyTheme(settings.theme || 'dark');
    updateMonthProgress();
}

window.onclick = function(event) { 
    if (event.target.classList && event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

console.log('✅ Script.js carregado com sucesso!');
