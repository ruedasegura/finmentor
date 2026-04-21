// ============================================
// FINMENTOR AI - APP PRINCIPAL (VERSIÓN MEJORADA)
// ============================================

// Variables globales
let currentUser = null;
let currentPlan = 'basic';
let financialData = {
    ingresos: 0,
    gastos: 0,
    utilidad: 0,
    margen: 0,
    history: []
};
let financialChart = null;
let historyChart = null;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    firebase.auth().onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            currentPlan = await getUserPlan(user.uid);
            document.getElementById('userEmail').textContent = user.email;
            document.getElementById('userPlan').textContent = `Plan: ${currentPlan === 'basic' ? 'Básico' : currentPlan === 'pro' ? 'Pro' : 'CFO'}`;
            
            if (window.location.pathname.includes('dashboard.html')) {
                await loadFinancialData();
                await loadHistoryData();
                setupDashboardEvents();
                updateMainInsight();
                updateRecommendations();
                updateSubScores();
            }
        } else if (!window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
        }
    });
});

async function getUserPlan(userId) {
    const doc = await firebase.firestore().collection('users').doc(userId).get();
    return doc.exists ? doc.data().plan || 'basic' : 'basic';
}

// ============================================
// CARGA DE DATOS
// ============================================
async function loadFinancialData() {
    const doc = await firebase.firestore().collection('financial_data').doc(currentUser.uid).get();
    if (doc.exists) {
        financialData = doc.data();
        updateDashboardUI();
    }
}

async function saveFinancialData() {
    await firebase.firestore().collection('financial_data').doc(currentUser.uid).set({
        ...financialData,
        updatedAt: new Date()
    });
}

async function saveHistorySnapshot() {
    const historyRef = firebase.firestore().collection('financial_history').doc(currentUser.uid);
    const doc = await historyRef.get();
    const history = doc.exists ? doc.data().snapshots || [] : [];
    
    history.push({
        date: new Date(),
        ingresos: financialData.ingresos,
        gastos: financialData.gastos,
        utilidad: financialData.utilidad,
        margen: financialData.margen
    });
    
    // Mantener solo últimos 12 meses
    while (history.length > 12) history.shift();
    
    await historyRef.set({ snapshots: history });
}

async function loadHistoryData() {
    const doc = await firebase.firestore().collection('financial_history').doc(currentUser.uid).get();
    if (doc.exists) {
        return doc.data().snapshots || [];
    }
    return [];
}

// ============================================
// CÁLCULOS Y ACTUALIZACIONES
// ============================================
function calculateMetrics() {
    financialData.utilidad = financialData.ingresos - financialData.gastos;
    financialData.margen = financialData.ingresos > 0 
        ? ((financialData.utilidad / financialData.ingresos) * 100).toFixed(1)
        : 0;
    
    saveFinancialData();
    saveHistorySnapshot();
    updateDashboardUI();
    updateMainInsight();
    updateRecommendations();
    updateSubScores();
}

function updateDashboardUI() {
    document.getElementById('ingresosValue').textContent = formatCurrency(financialData.ingresos);
    document.getElementById('gastosValue').textContent = formatCurrency(financialData.gastos);
    document.getElementById('utilidadValue').textContent = formatCurrency(financialData.utilidad);
    document.getElementById('margenValue').textContent = `${financialData.margen}%`;
    
    document.getElementById('ingresosInput').value = financialData.ingresos;
    document.getElementById('gastosInput').value = financialData.gastos;
    
    updateScore();
    updateChart();
    updateReportContent();
}

function formatCurrency(value) {
    return `$${value.toLocaleString()}`;
}

// ============================================
// SCORE FINANCIERO Y SUBINDICADORES
// ============================================
function updateScore() {
    const margen = parseFloat(financialData.margen);
    const utilidad = financialData.utilidad;
    
    let score = 0;
    score += Math.min(margen / 30, 1) * 40;
    score += Math.min(utilidad / 5000, 1) * 30;
    score += utilidad > 0 ? 30 : 0;
    score = Math.min(Math.round(score), 100);
    
    let rating = '', color = '', message = '';
    if (score >= 80) { rating = 'Excelente'; color = '#48bb78'; message = 'Tu negocio está en excelente estado.'; }
    else if (score >= 60) { rating = 'Bueno'; color = '#ed8936'; message = 'Vas por buen camino, hay áreas de mejora.'; }
    else if (score >= 40) { rating = 'Riesgo moderado'; color = '#f56565'; message = 'Tu negocio necesita atención.'; }
    else { rating = 'Riesgo crítico'; color = '#e53e3e'; message = '¡Toma acción inmediata!'; }
    
    document.getElementById('scoreValue').textContent = score;
    document.getElementById('scoreRating').textContent = rating;
    document.getElementById('scoreMessage').textContent = message;
    
    const circle = document.getElementById('scoreCircle');
    const circumference = 283;
    const offset = circumference - (score / 100) * circumference;
    circle.style.stroke = color;
    circle.style.strokeDashoffset = offset;
}

function updateSubScores() {
    const margen = parseFloat(financialData.margen);
    const utilidad = financialData.utilidad;
    const ingresos = financialData.ingresos;
    
    // Rentabilidad (basada en margen)
    const rentabilidad = Math.min(Math.max(margen, 0), 100);
    document.getElementById('subRentabilidad').textContent = `${rentabilidad}%`;
    
    // Liquidez (capacidad de cubrir gastos)
    const liquidez = ingresos > 0 ? Math.min((financialData.utilidad / ingresos) * 100 + 50, 100) : 0;
    document.getElementById('subLiquidez').textContent = `${Math.round(liquidez)}%`;
    
    // Riesgo (inverso a la rentabilidad)
    const riesgo = 100 - rentabilidad;
    document.getElementById('subRiesgo').textContent = `${Math.round(riesgo)}%`;
}

// ============================================
// INSIGHT PRINCIPAL DOMINANTE (NUEVO)
// ============================================
function updateMainInsight() {
    const iconEl = document.getElementById('mainInsightIcon');
    const titleEl = document.getElementById('mainInsightTitle');
    const messageEl = document.getElementById('mainInsightMessage');
    const actionBtn = document.getElementById('mainInsightAction');
    
    const utilidad = financialData.utilidad;
    const margen = parseFloat(financialData.margen);
    const ingresos = financialData.ingresos;
    const gastos = financialData.gastos;
    
    if (utilidad < 0) {
        iconEl.textContent = '🚨';
        titleEl.textContent = '¡ALERTA CRÍTICA!';
        messageEl.textContent = `Estás perdiendo $${Math.abs(utilidad).toLocaleString()} mensuales. Tus gastos ($${gastos.toLocaleString()}) superan tus ingresos ($${ingresos.toLocaleString()}).`;
        actionBtn.style.display = 'block';
        actionBtn.textContent = 'Ver recomendaciones para reducir gastos →';
        actionBtn.onclick = () => scrollToRecommendations();
    } 
    else if (margen < 20) {
        const aumentoRecomendado = Math.round((gastos * 1.2 - ingresos) / ingresos * 100);
        const nuevoIngreso = ingresos * (1 + aumentoRecomendado / 100);
        iconEl.textContent = '⚠️';
        titleEl.textContent = 'Margen bajo detectado';
        messageEl.textContent = `Tu margen actual es ${margen}%. Subiendo precios un ${aumentoRecomendado}%, alcanzarías $${nuevoIngreso.toLocaleString()} de ingresos.`;
        actionBtn.style.display = 'block';
        actionBtn.textContent = 'Simular aumento de precios →';
        actionBtn.onclick = () => simulatePriceIncrease();
    }
    else if (margen > 30) {
        const inversionRecomendada = Math.round(utilidad * 0.3);
        iconEl.textContent = '✅';
        titleEl.textContent = '¡Negocio saludable!';
        messageEl.textContent = `Tu margen del ${margen}% es excelente. Puedes reinvertir $${inversionRecomendada.toLocaleString()} en crecimiento.`;
        actionBtn.style.display = 'block';
        actionBtn.textContent = 'Ver oportunidades de crecimiento →';
        actionBtn.onclick = () => showGrowthOpportunities();
    }
    else {
        iconEl.textContent = '📊';
        titleEl.textContent = 'Negocio estable';
        messageEl.textContent = `Tu margen del ${margen}% es aceptable. Sigue monitoreando tus finanzas.`;
        actionBtn.style.display = 'none';
    }
}

function scrollToRecommendations() {
    document.querySelector('.recommendations-card').scrollIntoView({ behavior: 'smooth' });
}

function simulatePriceIncrease() {
    const aumento = prompt('¿Qué porcentaje de aumento deseas simular?', '15');
    if (aumento) {
        const nuevosIngresos = financialData.ingresos * (1 + parseFloat(aumento) / 100);
        const nuevaUtilidad = nuevosIngresos - financialData.gastos;
        alert(`📊 SIMULACIÓN:\n\nIngresos actuales: $${financialData.ingresos.toLocaleString()}\nNuevos ingresos: $${nuevosIngresos.toLocaleString()}\nUtilidad actual: $${financialData.utilidad.toLocaleString()}\nNueva utilidad: $${nuevaUtilidad.toLocaleString()}\n\nDiferencia: +$${(nuevaUtilidad - financialData.utilidad).toLocaleString()}`);
    }
}

function showGrowthOpportunities() {
    alert('📈 Oportunidades de crecimiento:\n\n1. Invierte en marketing digital\n2. Contrata un asistente\n3. Automatiza procesos\n4. Expande a nuevos mercados');
}

// ============================================
// RECOMENDACIONES PROACTIVAS (NUEVO)
// ============================================
function updateRecommendations() {
    const container = document.getElementById('recommendationsList');
    const margen = parseFloat(financialData.margen);
    const utilidad = financialData.utilidad;
    const ingresos = financialData.ingresos;
    const gastos = financialData.gastos;
    
    let recommendations = [];
    
    if (utilidad < 0) {
        recommendations.push({
            icon: '✂️',
            title: 'Reducir gastos URGENTE',
            description: `Tus gastos superan tus ingresos por $${Math.abs(utilidad).toLocaleString()}. Reduce costos fijos.`,
            action: 'Ver cómo'
        });
        recommendations.push({
            icon: '💰',
            title: 'Aumentar ingresos',
            description: 'Busca ingresos adicionales o sube precios.',
            action: 'Simular'
        });
    }
    
    if (margen < 20 && margen > 0) {
        const aumentoRecomendado = Math.ceil((gastos * 1.2 - ingresos) / ingresos * 100);
        recommendations.push({
            icon: '📈',
            title: 'Subir precios',
            description: `Sube precios un ${Math.max(aumentoRecomendado, 10)}% para alcanzar margen saludable.`,
            action: 'Simular'
        });
        recommendations.push({
            icon: '📉',
            title: 'Revisar suscripciones',
            description: 'Cancela herramientas que no usas. Ahorro potencial: $200-500/mes.',
            action: 'Calcular'
        });
    }
    
    if (margen > 30) {
        recommendations.push({
            icon: '🚀',
            title: 'Reinvertir utilidades',
            description: `Reinvierte $${Math.round(utilidad * 0.3).toLocaleString()} en crecimiento.`,
            action: 'Ver opciones'
        });
        recommendations.push({
            icon: '🤖',
            title: 'Automatizar procesos',
            description: 'Reduce tiempo en tareas repetitivas.',
            action: 'Explorar'
        });
    }
    
    if (recommendations.length === 0) {
        recommendations.push({
            icon: '✅',
            title: 'Todo en orden',
            description: 'Sigue monitoreando tus finanzas mensualmente.',
            action: 'Ver consejos'
        });
    }
    
    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item">
            <div class="rec-icon">${rec.icon}</div>
            <div class="rec-content">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
            </div>
            <button class="rec-action-btn" onclick="alert('Implementa esta recomendación para mejorar tus finanzas')">${rec.action}</button>
        </div>
    `).join('');
}

// ============================================
// EVOLUCIÓN HISTÓRICA
// ============================================
async function compareHistory() {
    const period = document.getElementById('historyPeriod').value;
    const history = await loadHistoryData();
    
    if (history.length < 2) {
        alert('Necesitas al menos 2 meses de datos para comparar');
        return;
    }
    
    const current = history[history.length - 1];
    let previous;
    
    if (period === 'month') previous = history[history.length - 2];
    else if (period === 'quarter') previous = history[Math.max(0, history.length - 4)];
    else previous = history[Math.max(0, history.length - 13)];
    
    document.getElementById('currentMargin').textContent = `${current.margen}%`;
    document.getElementById('previousMargin').textContent = `${previous.margen}%`;
    document.getElementById('currentProfit').textContent = formatCurrency(current.utilidad);
    document.getElementById('previousProfit').textContent = formatCurrency(previous.utilidad);
    
    const marginTrend = document.getElementById('marginTrend');
    const profitTrend = document.getElementById('profitTrend');
    
    if (current.margen > previous.margen) {
        marginTrend.innerHTML = '📈 Mejoró +' + (current.margen - previous.margen).toFixed(1) + '%';
        marginTrend.className = 'trend-up';
    } else {
        marginTrend.innerHTML = '📉 Empeoró ' + (current.margen - previous.margen).toFixed(1) + '%';
        marginTrend.className = 'trend-down';
    }
    
    if (current.utilidad > previous.utilidad) {
        profitTrend.innerHTML = '📈 Mejoró +' + formatCurrency(current.utilidad - previous.utilidad);
        profitTrend.className = 'trend-up';
    } else {
        profitTrend.innerHTML = '📉 Empeoró ' + formatCurrency(current.utilidad - previous.utilidad);
        profitTrend.className = 'trend-down';
    }
    
    updateHistoryChart(history);
}

function updateHistoryChart(history) {
    const ctx = document.getElementById('historyChart')?.getContext('2d');
    if (!ctx) return;
    
    if (historyChart) historyChart.destroy();
    
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.date).toLocaleDateString()),
            datasets: [
                { label: 'Margen (%)', data: history.map(h => h.margen), borderColor: '#667eea', fill: false },
                { label: 'Utilidad ($)', data: history.map(h => h.utilidad), borderColor: '#48bb78', fill: false }
            ]
        },
        options: { responsive: true }
    });
}

// ============================================
// IA MEJORADA CON SIMULACIONES (NUEVO)
// ============================================
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const question = input.value.trim();
    if (!question) return;
    
    if (currentPlan === 'basic') {
        document.getElementById('iaAccessWarning').style.display = 'block';
        return;
    }
    
    addMessageToChat(question, true);
    input.value = '';
    
    const typingMsg = addTypingIndicator();
    
    try {
        const response = await fetch(`https://us-central1-finmentor-saas.cloudfunctions.net/chatWithCFO`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question, 
                financialData,
                plan: currentPlan
            })
        });
        
        const data = await response.json();
        removeTypingIndicator(typingMsg);
        addMessageToChat(data.answer, false);
    } catch (error) {
        removeTypingIndicator(typingMsg);
        addMessageToChat(getLocalAIResponse(question), false);
    }
}

function getLocalAIResponse(question) {
    const q = question.toLowerCase();
    const ingresos = financialData.ingresos;
    const gastos = financialData.gastos;
    const margen = parseFloat(financialData.margen);
    const utilidad = financialData.utilidad;
    
    if (q.includes('precio') || q.includes('subir')) {
        const aumento = 15;
        const nuevosIngresos = ingresos * (1 + aumento / 100);
        const nuevaUtilidad = nuevosIngresos - gastos;
        return `📊 SIMULACIÓN DE PRECIOS:\n\nSi subes precios un ${aumento}%:\n• Ingresos actuales: $${ingresos.toLocaleString()}\n• Nuevos ingresos: $${nuevosIngresos.toLocaleString()}\n• Utilidad actual: $${utilidad.toLocaleString()}\n• Nueva utilidad: $${nuevaUtilidad.toLocaleString()}\n\n✅ Impacto: +$${(nuevaUtilidad - utilidad).toLocaleString()} mensuales.`;
    }
    
    if (q.includes('gasto') || q.includes('reducir') || q.includes('ahorrar')) {
        const ahorroPorcentaje = 20;
        const nuevosGastos = gastos * (1 - ahorroPorcentaje / 100);
        const nuevaUtilidad = ingresos - nuevosGastos;
        const nuevoMargen = (nuevaUtilidad / ingresos * 100).toFixed(1);
        return `💰 SIMULACIÓN DE AHORRO:\n\nSi reduces gastos un ${ahorroPorcentaje}%:\n• Gastos actuales: $${gastos.toLocaleString()}\n• Nuevos gastos: $${nuevosGastos.toLocaleString()}\n• Utilidad actual: $${utilidad.toLocaleString()}\n• Nueva utilidad: $${nuevaUtilidad.toLocaleString()}\n• Margen actual: ${margen}%\n• Nuevo margen: ${nuevoMargen}%\n\n✅ Ahorro mensual: $${(gastos - nuevosGastos).toLocaleString()}`;
    }
    
    if (q.includes('contratar')) {
        const costoEmpleado = 1500;
        const utilidadConEmpleado = utilidad - costoEmpleado;
        return `👥 ANÁLISIS DE CONTRATACIÓN:\n\nUtilidad actual: $${utilidad.toLocaleString()}\nCosto estimado empleado: $${costoEmpleado}\nUtilidad después de contratar: $${utilidadConEmpleado.toLocaleString()}\n\n${utilidadConEmpleado > 0 ? '✅ SÍ puedes contratar. Tu negocio lo soporta.' : '❌ NO es recomendable contratar aún. Primero aumenta tu utilidad.'}`;
    }
    
    return `📊 ANÁLISIS GENERAL:\n\nIngresos: $${ingresos.toLocaleString()}\nGastos: $${gastos.toLocaleString()}\nUtilidad: $${utilidad.toLocaleString()}\nMargen: ${margen}%\n\n${margen < 20 ? '⚠️ Tu margen es bajo. Considera subir precios o reducir gastos.' : '✅ Tu negocio está en buen camino. Sigue así.'}`;
}

function addMessageToChat(text, isUser) {
    const chatDiv = document.getElementById('chatMessages');
    const msg = document.createElement('div');
    msg.className = `message ${isUser ? 'user' : 'bot'}`;
    msg.textContent = text;
    chatDiv.appendChild(msg);
    chatDiv.scrollTop = chatDiv.scrollHeight;
    return msg;
}

function addTypingIndicator() {
    const chatDiv = document.getElementById('chatMessages');
    const typing = document.createElement('div');
    typing.className = 'message bot';
    typing.textContent = '✍️ Escribiendo...';
    chatDiv.appendChild(typing);
    chatDiv.scrollTop = chatDiv.scrollHeight;
    return typing;
}

function removeTypingIndicator(typingMsg) {
    if (typingMsg) typingMsg.remove();
}

// ============================================
// GRÁFICOS Y REPORTES
// ============================================
function updateChart() {
    const ctx = document.getElementById('financialChart')?.getContext('2d');
    if (!ctx) return;
    if (financialChart) financialChart.destroy();
    
    financialChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Gastos', 'Utilidad'],
            datasets: [{
                label: 'Monto',
                data: [financialData.ingresos, financialData.gastos, financialData.utilidad],
                backgroundColor: ['#48bb78', '#f56565', '#667eea'],
                borderRadius: 10
            }]
        },
        options: { responsive: true }
    });
}

function updateReportContent() {
    const reportEl = document.getElementById('reportContent');
    if (reportEl) {
        reportEl.innerHTML = `
            <p><strong>Ingresos:</strong> ${formatCurrency(financialData.ingresos)}</p>
            <p><strong>Gastos:</strong> ${formatCurrency(financialData.gastos)}</p>
            <p><strong>Utilidad:</strong> ${formatCurrency(financialData.utilidad)}</p>
            <p><strong>Margen:</strong> ${financialData.margen}%</p>
            <p><strong>Estado:</strong> ${financialData.margen > 20 ? 'Saludable ✅' : 'En riesgo ⚠️'}</p>
        `;
    }
}

function exportToCSV() {
    const headers = ['Fecha', 'Ingresos', 'Gastos', 'Utilidad', 'Margen (%)'];
    const data = [[new Date().toLocaleDateString(), financialData.ingresos, financialData.gastos, financialData.utilidad, financialData.margen]];
    const csv = [headers, ...data].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finmentor_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alert('✅ Reporte exportado');
}

// ============================================
// EVENTOS DEL DASHBOARD
// ============================================
function setupDashboardEvents() {
    document.getElementById('ingresosInput').onchange = (e) => {
        financialData.ingresos = parseFloat(e.target.value) || 0;
        calculateMetrics();
    };
    document.getElementById('gastosInput').onchange = (e) => {
        financialData.gastos = parseFloat(e.target.value) || 0;
        calculateMetrics();
    };
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const section = btn.dataset.section;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(`${section}Section`).classList.add('active');
            if (section === 'history') compareHistory();
        };
    });
    
    document.getElementById('sendMessageBtn').onclick = sendMessage;
    document.getElementById('chatInput').onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    document.getElementById('exportCSVBtn').onclick = exportToCSV;
    document.getElementById('compareHistoryBtn').onclick = compareHistory;
    document.getElementById('upgradeBtn').onclick = () => alert('Próximamente: paga con Stripe para actualizar');
    document.getElementById('logoutBtn').onclick = async () => { await firebase.auth().signOut(); window.location.href = 'index.html'; };
}