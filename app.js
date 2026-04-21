// ============================================
// FINMENTOR AI - VERSIÓN FINAL (PRODUCTO VENDIBLE)
// ============================================

// Variables globales
let currentUser = null;
let currentPlan = 'basic';
let financialData = {
    ingresos: 0,
    gastos: 0,
    utilidad: 0,
    margen: 0,
    history: [],
    saldoActual: 5000000
};
let previousData = null;
let financialChart = null;
let historyChart = null;
let consultasHoy = 0;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    firebase.auth().onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            currentPlan = await getUserPlan(user.uid);
            await loadConsultasHoy();
            
            // Actualizar UI del sidebar
            document.getElementById('userEmail').textContent = user.email;
            document.getElementById('userPlan').textContent = `Plan: ${currentPlan === 'basic' ? 'Básico' : currentPlan === 'pro' ? 'Pro' : 'CFO'}`;
            
            // Mostrar/ocultar límite de consultas
            const iaLimitInfo = document.getElementById('iaLimitInfo');
            if (iaLimitInfo) {
                if (currentPlan === 'basic') {
                    iaLimitInfo.style.display = 'block';
                    document.getElementById('consultasRestantes').textContent = `${3 - consultasHoy} consultas restantes hoy`;
                } else {
                    iaLimitInfo.style.display = 'none';
                }
            }
            
            if (window.location.pathname.includes('dashboard.html')) {
                await loadFinancialData();
                await loadPreviousData();
                await loadHistoryData();
                setupDashboardEvents();
                updateAll();
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

async function loadConsultasHoy() {
    const hoy = new Date().toDateString();
    const doc = await firebase.firestore().collection('consultas_ia').doc(currentUser?.uid).get();
    if (doc.exists && doc.data().fecha === hoy) {
        consultasHoy = doc.data().consultas;
    } else {
        consultasHoy = 0;
    }
}

async function saveConsultasHoy() {
    if (!currentUser) return;
    const hoy = new Date().toDateString();
    await firebase.firestore().collection('consultas_ia').doc(currentUser.uid).set({
        fecha: hoy,
        consultas: consultasHoy
    });
}

function puedeUsarIA() {
    if (currentPlan === 'pro' || currentPlan === 'cfo') return true;
    if (consultasHoy >= 3) return false;
    return true;
}

// ============================================
// CARGA DE DATOS
// ============================================
async function loadFinancialData() {
    const doc = await firebase.firestore().collection('financial_data').doc(currentUser.uid).get();
    if (doc.exists) {
        financialData = doc.data();
        if (!financialData.saldoActual) financialData.saldoActual = 5000000;
        updateDashboardUI();
    } else {
        // Intentar cargar desde onboarding
        const onboarding = await firebase.firestore().collection('onboarding').doc(currentUser.uid).get();
        if (onboarding.exists) {
            const data = onboarding.data();
            financialData.ingresos = data.monthlyIncome || 0;
            financialData.gastos = data.monthlyExpenses || 0;
            financialData.utilidad = financialData.ingresos - financialData.gastos;
            financialData.margen = financialData.ingresos > 0 ? (financialData.utilidad / financialData.ingresos * 100).toFixed(1) : 0;
            await saveFinancialData();
            updateDashboardUI();
        }
    }
}

async function saveFinancialData() {
    await firebase.firestore().collection('financial_data').doc(currentUser.uid).set({
        ...financialData,
        updatedAt: new Date()
    });
}

async function loadPreviousData() {
    const history = await loadHistoryData();
    if (history.length >= 2) {
        previousData = history[history.length - 2];
    }
}

async function saveHistorySnapshot() {
    const historyRef = firebase.firestore().collection('financial_history').doc(currentUser.uid);
    const doc = await historyRef.get();
    const history = doc.exists ? doc.data().snapshots || [] : [];
    
    // Evitar duplicados en el mismo día
    const hoy = new Date().toDateString();
    const yaExisteHoy = history.some(h => new Date(h.date).toDateString() === hoy);
    
    if (!yaExisteHoy) {
        history.push({
            date: new Date(),
            ingresos: financialData.ingresos,
            gastos: financialData.gastos,
            utilidad: financialData.utilidad,
            margen: parseFloat(financialData.margen)
        });
    }
    
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
    updateAll();
}

function updateAll() {
    updateDashboardUI();
    updateMainInsight();
    updateRecommendations();
    updateSubScores();
    updateProgressComparison();
    updateCashFlowProjection();
}

function updateDashboardUI() {
    document.getElementById('ingresosValue').textContent = formatCurrency(financialData.ingresos);
    document.getElementById('gastosValue').textContent = formatCurrency(financialData.gastos);
    document.getElementById('utilidadValue').textContent = formatCurrency(financialData.utilidad);
    document.getElementById('margenValue').textContent = `${financialData.margen}%`;
    
    document.getElementById('ingresosInput').value = financialData.ingresos;
    document.getElementById('gastosInput').value = financialData.gastos;
    
    const saldoInput = document.getElementById('saldoActual');
    if (saldoInput) saldoInput.value = financialData.saldoActual;
    
    updateScore();
    updateChart();
    updateReportContent();
}

function formatCurrency(value) {
    return `$${Math.round(value).toLocaleString()}`;
}

// ============================================
// 1. INSIGHT PRINCIPAL ECONÓMICO Y CONTUNDENTE
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
    
    // Caso 1: Utilidad negativa - pérdida diaria
    if (utilidad < 0) {
        const perdidaDiaria = Math.abs(utilidad) / 30;
        const saldo = financialData.saldoActual || 5000000;
        const diasQuiebra = Math.floor(saldo / perdidaDiaria);
        
        iconEl.textContent = '🚨';
        titleEl.textContent = '¡ALERTA CRÍTICA!';
        messageEl.innerHTML = `
            <strong>💰 Estás perdiendo $${perdidaDiaria.toLocaleString()} DIARIOS.</strong><br>
            Tu negocio pierde $${Math.abs(utilidad).toLocaleString()} al mes.<br>
            ⚠️ A este ritmo, en <strong>${diasQuiebra} días</strong> podrías quedarte sin liquidez.<br>
            <span style="font-size:0.9rem; opacity:0.9;">🔴 Tu negocio NO es sostenible actualmente.</span>
        `;
        actionBtn.style.display = 'block';
        actionBtn.textContent = 'Ver plan de recuperación →';
        actionBtn.onclick = () => showRecoveryPlan();
    } 
    // Caso 2: Margen bajo (<20%) - "Estás dejando de ganar"
    else if (margen < 20 && margen > 0) {
        const aumentoRecomendado = 12;
        const nuevosIngresos = ingresos * (1 + aumentoRecomendado / 100);
        const nuevaUtilidad = nuevosIngresos - gastos;
        const perdida = nuevaUtilidad - utilidad;
        const porcentajeMejora = ((nuevaUtilidad / utilidad) - 1) * 100;
        
        iconEl.textContent = '⚠️';
        titleEl.textContent = 'Estás dejando de ganar dinero';
        messageEl.innerHTML = `
            <strong>💰 Estás dejando de ganar $${perdida.toLocaleString()} al mes.</strong><br>
            Si subes precios <strong>${aumentoRecomendado}%</strong>, tu utilidad pasaría de <strong>$${utilidad.toLocaleString()}</strong> a <strong>$${nuevaUtilidad.toLocaleString()}</strong>.<br>
            📈 Esto representa un aumento del <strong>${porcentajeMejora.toFixed(0)}%</strong> en tu ganancia mensual.
        `;
        actionBtn.style.display = 'block';
        actionBtn.textContent = 'Simular aumento de precios →';
        actionBtn.onclick = () => simulatePriceIncrease();
    }
    // Caso 3: Margen saludable (>30%)
    else if (margen > 30) {
        const inversionRecomendada = Math.round(utilidad * 0.3);
        const crecimientoPotencial = Math.round(inversionRecomendada * 0.5);
        
        iconEl.textContent = '✅';
        titleEl.textContent = '¡Negocio saludable!';
        messageEl.innerHTML = `
            <strong>💰 Tienes un negocio saludable con ${margen}% de margen.</strong><br>
            Puedes reinvertir hasta <strong>$${inversionRecomendada.toLocaleString()}</strong> mensuales para crecer.<br>
            📈 Potencial de crecimiento: <strong>+$${crecimientoPotencial.toLocaleString()}</strong> adicionales en 3 meses.
        `;
        actionBtn.style.display = 'block';
        actionBtn.textContent = 'Ver oportunidades de crecimiento →';
        actionBtn.onclick = () => showGrowthOpportunities();
    }
    // Caso 4: Margen aceptable (20-30%)
    else {
        const mejoraPotencial = Math.round(utilidad * 0.15);
        iconEl.textContent = '📊';
        titleEl.textContent = 'Negocio estable, pero mejorable';
        messageEl.innerHTML = `
            Tu margen actual es <strong>${margen}%</strong>. Optimizando costos, podrías aumentar tu utilidad en <strong>$${mejoraPotencial.toLocaleString()}</strong> mensuales.
        `;
        actionBtn.style.display = 'block';
        actionBtn.textContent = 'Ver cómo mejorar →';
        actionBtn.onclick = () => showImprovementTips();
    }
}

function showRecoveryPlan() {
    const gastos = financialData.gastos;
    const reduccionNecesaria = Math.abs(financialData.utilidad) + 500;
    alert(`📋 PLAN DE RECUPERACIÓN:\n\nPara salir de pérdidas, debes reducir gastos en $${reduccionNecesaria.toLocaleString()} mensuales.\n\nAcciones recomendadas:\n1. Cancela suscripciones que no usas\n2. Negocia con proveedores\n3. Aumenta precios temporalmente`);
}

function showImprovementTips() {
    alert(`📈 CÓMO MEJORAR TU MARGEN:\n\n1. Sube precios entre 5-10%\n2. Reduce gastos variables un 10%\n3. Automatiza procesos repetitivos\n4. Cobra anticipos a clientes`);
}

function simulatePriceIncrease() {
    const aumento = prompt('¿Qué porcentaje de aumento deseas simular?', '12');
    if (aumento) {
        const nuevosIngresos = financialData.ingresos * (1 + parseFloat(aumento) / 100);
        const nuevaUtilidad = nuevosIngresos - financialData.gastos;
        const mejora = nuevaUtilidad - financialData.utilidad;
        alert(`📊 SIMULACIÓN DE PRECIOS:\n\n📈 DIAGNÓSTICO ACTUAL:\n• Ingresos: $${financialData.ingresos.toLocaleString()}\n• Utilidad: $${financialData.utilidad.toLocaleString()}\n• Margen: ${financialData.margen}%\n\n📈 CON AUMENTO DEL ${aumento}%:\n• Nuevos ingresos: $${nuevosIngresos.toLocaleString()}\n• Nueva utilidad: $${nuevaUtilidad.toLocaleString()}\n\n💰 IMPACTO ECONÓMICO:\n• Ganancia adicional: +$${mejora.toLocaleString()}\n• Aumento del ${((nuevaUtilidad / financialData.utilidad) * 100 - 100).toFixed(0)}% en utilidad\n\n✅ ACCIÓN CONCRETA:\nSube precios entre ${Math.max(10, parseFloat(aumento)-2)}% y ${parseFloat(aumento)}% en los próximos 15 días.`);
    }
}

function showGrowthOpportunities() {
    alert(`📈 OPORTUNIDADES DE CRECIMIENTO:\n\n1. Invierte $${Math.round(financialData.utilidad * 0.3).toLocaleString()} en marketing\n2. Contrata un asistente part-time\n3. Expande a nuevos mercados\n4. Crea un programa de referidos`);
}

// ============================================
// 2. PROYECCIÓN DE FLUJO DE CAJA (DÍAS DE QUIEBRA)
// ============================================
function updateCashFlowProjection() {
    const utilidad = financialData.utilidad;
    const flujoMensual = utilidad;
    const cashFlowCard = document.getElementById('cashFlowInsight');
    if (!cashFlowCard) return;
    
    if (flujoMensual < 0) {
        const deficitDiario = Math.abs(flujoMensual) / 30;
        const saldo = financialData.saldoActual || 5000000;
        const diasQuiebra = Math.floor(saldo / deficitDiario);
        cashFlowCard.innerHTML = `
            <div class="cashflow-warning">
                <span class="cashflow-icon">⚠️</span>
                <div class="cashflow-text">
                    <strong>Riesgo de liquidez</strong>
                    Con este ritmo, tendrás problemas de liquidez en <strong>${diasQuiebra} días</strong>.
                </div>
            </div>
        `;
    } else {
        const saldo = financialData.saldoActual || 5000000;
        const mesesSeguro = Math.floor(saldo / flujoMensual);
        cashFlowCard.innerHTML = `
            <div class="cashflow-success">
                <span class="cashflow-icon">✅</span>
                <div class="cashflow-text">
                    <strong>Flujo de caja positivo</strong>
                    Tu negocio es sostenible. Sin cambios, aguantarías <strong>${mesesSeguro} meses</strong> con tu saldo actual.
                </div>
            </div>
        `;
    }
}

// ============================================
// 3. COMPARACIÓN AUTOMÁTICA (PROGRESO)
// ============================================
async function updateProgressComparison() {
    const history = await loadHistoryData();
    if (history.length < 2) {
        const comparisonDiv = document.getElementById('progressComparison');
        if (comparisonDiv) {
            comparisonDiv.innerHTML = `<div class="progress-neutral">📊 Completa al menos 2 semanas de datos para ver tu progreso.</div>`;
        }
        return;
    }
    
    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    const diferenciaMargen = (current.margen - previous.margen).toFixed(1);
    const diferenciaUtilidad = current.utilidad - previous.utilidad;
    
    const comparisonDiv = document.getElementById('progressComparison');
    if (!comparisonDiv) return;
    
    if (diferenciaMargen > 0) {
        comparisonDiv.innerHTML = `
            <div class="progress-positive">
                📈 <strong>¡Mejoraste tu margen en +${diferenciaMargen} puntos!</strong><br>
                Tu utilidad aumentó $${diferenciaUtilidad.toLocaleString()} respecto a la semana pasada. Vas en la dirección correcta.
            </div>
        `;
    } else if (diferenciaMargen < 0) {
        comparisonDiv.innerHTML = `
            <div class="progress-negative">
                📉 <strong>Tu margen bajó ${diferenciaMargen} puntos</strong><br>
                Tu utilidad disminuyó $${Math.abs(diferenciaUtilidad).toLocaleString()} respecto a la semana pasada. Revisa tus gastos o considera aumentar precios.
            </div>
        `;
    } else {
        comparisonDiv.innerHTML = `
            <div class="progress-neutral">
                📊 Tu margen se mantiene estable respecto a la semana pasada.<br>
                Busca oportunidades de mejora para crecer.
            </div>
        `;
    }
}

// ============================================
// 4. SCORE FINANCIERO CON EXPLICACIÓN
// ============================================
function updateScore() {
    const margen = parseFloat(financialData.margen);
    const utilidad = financialData.utilidad;
    
    let score = 0;
    score += Math.min(margen / 30, 1) * 40;
    score += Math.min(utilidad / 5000, 1) * 30;
    score += utilidad > 0 ? 30 : 0;
    score = Math.min(Math.round(score), 100);
    
    let rating = '', color = '', explicacion = '';
    if (score >= 80) { 
        rating = 'Excelente'; 
        color = '#48bb78'; 
        explicacion = 'Tu negocio está en excelente estado. Sigue así y considera reinvertir.'; 
    }
    else if (score >= 60) { 
        rating = 'Bueno'; 
        color = '#ed8936'; 
        explicacion = 'Vas por buen camino, pero hay áreas de mejora. Enfócate en optimizar costos.'; 
    }
    else if (score >= 40) { 
        rating = 'Riesgo moderado'; 
        color = '#f56565'; 
        explicacion = 'Tu negocio necesita atención. Prioriza aumentar ingresos o reducir gastos.'; 
    }
    else { 
        rating = 'Riesgo crítico'; 
        color = '#e53e3e'; 
        explicacion = '¡Toma acción inmediata! Estás en riesgo financiero. Sigue el plan de recuperación.'; 
    }
    
    document.getElementById('scoreValue').textContent = score;
    document.getElementById('scoreRating').textContent = rating;
    document.getElementById('scoreMessage').textContent = explicacion;
    
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
// 5. RECOMENDACIONES PROACTIVAS (CHECKLIST)
// ============================================
function updateRecommendations() {
    const container = document.getElementById('recommendationsList');
    const margen = parseFloat(financialData.margen);
    const utilidad = financialData.utilidad;
    const ingresos = financialData.ingresos;
    const gastos = financialData.gastos;
    
    let recommendations = [];
    
    if (utilidad < 0) {
        recommendations = [
            { icon: '✂️', title: 'Reduce gastos URGENTE', description: `Necesitas reducir $${Math.abs(utilidad).toLocaleString()} para salir de pérdidas.`, action: 'Ver cómo' },
            { icon: '💰', title: 'Aumenta ingresos', description: 'Sube precios o busca nuevos clientes.', action: 'Simular' },
            { icon: '📊', title: 'Revisa suscripciones', description: 'Cancela herramientas que no usas.', action: 'Calcular' }
        ];
    } else if (margen < 20) {
        const aumentoRecomendado = 12;
        const nuevosIngresos = ingresos * (1 + aumentoRecomendado / 100);
        const nuevaUtilidad = nuevosIngresos - gastos;
        recommendations = [
            { icon: '📈', title: 'Sube precios', description: `Sube precios ${aumentoRecomendado}% → Utilidad +$${(nuevaUtilidad - utilidad).toLocaleString()}`, action: 'Simular' },
            { icon: '📉', title: 'Reduce gastos un 10%', description: `Ahorro potencial: $${Math.round(gastos * 0.1).toLocaleString()}`, action: 'Calcular' },
            { icon: '👥', title: 'Evita contratar', description: 'No es momento de aumentar personal fijo.', action: 'Ver por qué' }
        ];
    } else if (margen > 30) {
        recommendations = [
            { icon: '🚀', title: 'Invierte en crecimiento', description: `Puedes invertir $${Math.round(utilidad * 0.3).toLocaleString()} en marketing.`, action: 'Ver opciones' },
            { icon: '🤖', title: 'Automatiza procesos', description: 'Ahorra tiempo y reduce errores.', action: 'Explorar' },
            { icon: '👥', title: 'Evalúa contratar', description: 'Tu margen permite contratar asistente.', action: 'Simular' }
        ];
    } else {
        recommendations = [
            { icon: '⚡', title: 'Optimiza costos', description: 'Revisa gastos variables mensuales.', action: 'Analizar' },
            { icon: '📈', title: 'Mejora pricing', description: 'Ajusta precios en productos estrella.', action: 'Simular' },
            { icon: '💡', title: 'Busca eficiencias', description: 'Automatiza tareas repetitivas.', action: 'Ver ideas' }
        ];
    }
    
    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item">
            <div class="rec-icon">${rec.icon}</div>
            <div class="rec-content">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
            </div>
            <button class="rec-action-btn" onclick="alert('Implementa: ${rec.title}')">${rec.action}</button>
        </div>
    `).join('');
}

// ============================================
// 6. IA MEJORADA (ESTRUCTURA OBLIGATORIA)
// ============================================
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const question = input.value.trim();
    if (!question) return;
    
    // Verificar límite de consultas para plan básico
    if (currentPlan === 'basic') {
        if (consultasHoy >= 3) {
            alert('⚠️ Has alcanzado el límite de 3 consultas hoy. Actualiza al plan Pro para consultas ilimitadas.');
            document.getElementById('iaAccessWarning').style.display = 'block';
            return;
        }
        consultasHoy++;
        await saveConsultasHoy();
        document.getElementById('consultasRestantes').textContent = `${3 - consultasHoy} consultas restantes hoy`;
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
        
        if (response.ok) {
            const data = await response.json();
            removeTypingIndicator(typingMsg);
            addMessageToChat(data.answer, false);
        } else {
            throw new Error('Function not available');
        }
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
    
    // PRECIOS - estructura obligatoria
    if (q.includes('precio') || q.includes('subir')) {
        const aumento = 12;
        const nuevosIngresos = ingresos * (1 + aumento / 100);
        const nuevaUtilidad = nuevosIngresos - gastos;
        const mejora = nuevaUtilidad - utilidad;
        const porcentajeMejora = ((nuevaUtilidad / utilidad) - 1) * 100;
        
        return `📊 DIAGNÓSTICO ACTUAL:\n• Ingresos: $${ingresos.toLocaleString()}\n• Gastos: $${gastos.toLocaleString()}\n• Utilidad: $${utilidad.toLocaleString()}\n• Margen: ${margen}%\n\n📈 SIMULACIÓN (subir precios ${aumento}%):\n• Nuevos ingresos: $${nuevosIngresos.toLocaleString()}\n• Nueva utilidad: $${nuevaUtilidad.toLocaleString()}\n\n💰 IMPACTO ECONÓMICO:\n• Ganancia adicional: +$${mejora.toLocaleString()}\n• Aumento del ${porcentajeMejora.toFixed(0)}% en utilidad\n\n✅ ACCIÓN CONCRETA:\nSube precios entre 10% y 12% en los próximos 15 días.`;
    }
    
    // GASTOS
    if (q.includes('gasto') || q.includes('reducir') || q.includes('ahorrar')) {
        const ahorroPorcentaje = 20;
        const nuevosGastos = gastos * (1 - ahorroPorcentaje / 100);
        const nuevaUtilidad = ingresos - nuevosGastos;
        const ahorro = gastos - nuevosGastos;
        
        return `📊 DIAGNÓSTICO ACTUAL:\n• Gastos mensuales: $${gastos.toLocaleString()}\n• Utilidad actual: $${utilidad.toLocaleString()}\n\n📉 SIMULACIÓN (reducir gastos ${ahorroPorcentaje}%):\n• Nuevos gastos: $${nuevosGastos.toLocaleString()}\n• Nueva utilidad: $${nuevaUtilidad.toLocaleString()}\n\n💰 IMPACTO ECONÓMICO:\n• Ahorro mensual: $${ahorro.toLocaleString()}\n• Aumento de ${((nuevaUtilidad / utilidad) * 100 - 100).toFixed(0)}% en utilidad\n\n✅ ACCIÓN CONCRETA:\nCancela suscripciones innecesarias y negocia con proveedores esta semana.`;
    }
    
    // CONTRATACIÓN
    if (q.includes('contratar')) {
        const costoEmpleado = 1500;
        const utilidadConEmpleado = utilidad - costoEmpleado;
        
        return `📊 DIAGNÓSTICO ACTUAL:\n• Utilidad mensual: $${utilidad.toLocaleString()}\n• Margen: ${margen}%\n\n👥 SIMULACIÓN (contratar empleado $${costoEmpleado}):\n• Nueva utilidad: $${utilidadConEmpleado.toLocaleString()}\n\n💰 IMPACTO ECONÓMICO:\n${utilidadConEmpleado > 0 ? '✅ Tu negocio SÍ puede contratar. La utilidad seguiría siendo positiva.' : '❌ NO es recomendable contratar aún. Primero aumenta tu utilidad.'}\n\n✅ ACCIÓN CONCRETA:\n${utilidadConEmpleado > 0 ? 'Considera un contrato a prueba por 3 meses.' : 'Optimiza procesos antes de contratar.'}`;
    }
    
    // RESPUESTA GENERAL
    return `📊 DIAGNÓSTICO ACTUAL:\n• Ingresos: $${ingresos.toLocaleString()}\n• Gastos: $${gastos.toLocaleString()}\n• Utilidad: $${utilidad.toLocaleString()}\n• Margen: ${margen}%\n\n⚠️ PRINCIPAL RIESGO:\n${margen < 20 ? 'Margen bajo - vulnerabilidad financiera' : 'Dependencia de pocos clientes'}\n\n🎯 3 ACCIONES CONCRETAS:\n1. ${margen < 20 ? 'Sube precios 15%' : 'Incrementa inversión en marketing'}\n2. Reduce gastos variables un 10%\n3. Diversifica fuentes de ingreso\n\n🔑 RECOMENDACIÓN CLAVE:\n${margen < 20 ? 'Reduce gastos un 15% este mes' : 'Reinvierte el 30% de utilidades en crecimiento'}`;
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
    typing.textContent = '✍️ Calculando impacto financiero...';
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
    
    const saldoInput = document.getElementById('saldoActual');
    if (saldoInput) {
        saldoInput.onchange = (e) => {
            financialData.saldoActual = parseFloat(e.target.value) || 5000000;
            saveFinancialData();
            updateCashFlowProjection();
        };
    }
    
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
    document.getElementById('upgradeBtn').onclick = () => alert('🚀 Actualiza a Pro por $29/mes para:\n✅ IA ilimitada\n✅ Proyecciones avanzadas\n✅ Simulaciones completas\n✅ Soporte prioritario');
    document.getElementById('logoutBtn').onclick = async () => { await firebase.auth().signOut(); window.location.href = 'index.html'; };
    
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.onclick = async () => {
            const currency = document.getElementById('currencySelect').value;
            const emailNotifications = document.getElementById('emailNotifications').checked;
            await firebase.firestore().collection('users').doc(currentUser.uid).update({
                currency: currency,
                emailNotifications: emailNotifications
            });
            alert('✅ Configuración guardada');
        };
    }
}