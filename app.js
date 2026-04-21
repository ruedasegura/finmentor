// ============================================
// FINMENTOR AI - LÓGICA PRINCIPAL
// ============================================

// Variables globales
let currentUser = null;
let financialData = {
    ingresos: 0,
    gastos: 0,
    utilidad: 0,
    margen: 0,
    history: []
};
let financialChart = null;
let projectionChart = null;
let currentPlan = 'basic';

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Escuchar cambios de autenticación
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            currentUserId = user.uid;
            
            // Obtener plan del usuario
            currentPlan = await getUserPlan(user.uid);
            currentUserPlan = currentPlan;
            
            // Verificar si ya completó onboarding
            const onboardingDoc = await db.collection('onboarding').doc(user.uid).get();
            
            if (!onboardingDoc.exists) {
                // Redirigir a onboarding
                window.location.href = 'onboarding.html';
            } else {
                // Cargar dashboard
                if (window.location.pathname.includes('dashboard.html')) {
                    loadFinancialData();
                    setupDashboard();
                    updateScore();
                } else {
                    window.location.href = 'dashboard.html';
                }
            }
        } else {
            if (!window.location.pathname.includes('index.html')) {
                window.location.href = 'index.html';
            }
        }
    });
    
    // Configurar login si estamos en index.html
    if (window.location.pathname.includes('index.html')) {
        setupLogin();
    }
});

// ============================================
// LOGIN
// ============================================
function setupLogin() {
    const modal = document.getElementById('loginModal');
    const showBtns = document.querySelectorAll('#showLoginBtn, #heroLoginBtn');
    const googleBtn = document.getElementById('googleLoginBtn');
    const emailBtn = document.getElementById('emailLoginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const closeBtn = document.querySelector('.close');
    
    let isSignup = false;
    
    showBtns.forEach(btn => {
        btn.onclick = () => modal.style.display = 'flex';
    });
    
    closeBtn.onclick = () => modal.style.display = 'none';
    
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
    
    // Login con Google
    googleBtn.onclick = async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await auth.signInWithPopup(provider);
            await createUserIfNeeded(result.user);
            modal.style.display = 'none';
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };
    
    // Login/Registro con email
    emailBtn.onclick = async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            alert('Completa todos los campos');
            return;
        }
        
        try {
            let userCredential;
            if (isSignup) {
                userCredential = await auth.createUserWithEmailAndPassword(email, password);
            } else {
                userCredential = await auth.signInWithEmailAndPassword(email, password);
            }
            await createUserIfNeeded(userCredential.user);
            modal.style.display = 'none';
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };
    
    signupBtn.onclick = () => {
        isSignup = true;
        emailBtn.textContent = 'Registrarse';
        signupBtn.style.display = 'none';
        setTimeout(() => {
            isSignup = false;
            emailBtn.textContent = 'Iniciar sesión';
            signupBtn.style.display = 'block';
        }, 3000);
    };
}

async function createUserIfNeeded(user) {
    const userRef = db.collection('users').doc(user.uid);
    const doc = await userRef.get();
    
    if (!doc.exists) {
        await userRef.set({
            email: user.email,
            plan: 'basic',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            subscriptionActive: false
        });
    }
}

// ============================================
// DASHBOARD
// ============================================
async function loadFinancialData() {
    try {
        const doc = await db.collection('financial_data').doc(currentUser.uid).get();
        if (doc.exists) {
            financialData = doc.data();
        } else {
            // Intentar cargar desde onboarding
            const onboarding = await db.collection('onboarding').doc(currentUser.uid).get();
            if (onboarding.exists) {
                const data = onboarding.data();
                financialData.ingresos = data.monthlyIncome || 0;
                financialData.gastos = data.monthlyExpenses || 0;
                financialData.utilidad = financialData.ingresos - financialData.gastos;
                financialData.margen = financialData.ingresos > 0 ? (financialData.utilidad / financialData.ingresos * 100).toFixed(1) : 0;
                await saveFinancialData();
            }
        }
        updateDashboardUI();
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

async function saveFinancialData() {
    if (!currentUser) return;
    
    try {
        await db.collection('financial_data').doc(currentUser.uid).set({
            ...financialData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error guardando:', error);
    }
}

function calculateMetrics() {
    financialData.utilidad = financialData.ingresos - financialData.gastos;
    financialData.margen = financialData.ingresos > 0 
        ? ((financialData.utilidad / financialData.ingresos) * 100).toFixed(1)
        : 0;
    
    saveFinancialData();
    updateDashboardUI();
    updateScore();
}

function updateDashboardUI() {
    const ingresosEl = document.getElementById('ingresosValue');
    const gastosEl = document.getElementById('gastosValue');
    const utilidadEl = document.getElementById('utilidadValue');
    const margenEl = document.getElementById('margenValue');
    const insightsEl = document.getElementById('insightsContent');
    const reportEl = document.getElementById('reportContent');
    const userPlanEl = document.getElementById('userPlan');
    const userEmailEl = document.getElementById('userEmail');
    
    if (ingresosEl) ingresosEl.textContent = `$${financialData.ingresos.toLocaleString()}`;
    if (gastosEl) gastosEl.textContent = `$${financialData.gastos.toLocaleString()}`;
    if (utilidadEl) utilidadEl.textContent = `$${financialData.utilidad.toLocaleString()}`;
    if (margenEl) margenEl.textContent = `${financialData.margen}%`;
    if (userPlanEl) userPlanEl.textContent = `Plan: ${currentPlan === 'basic' ? 'Básico' : currentPlan === 'pro' ? 'Pro' : 'CFO'}`;
    if (userEmailEl) userEmailEl.textContent = currentUser?.email || '';
    
    // Insights
    if (insightsEl) {
        let message = '';
        
        if (financialData.margen < 10) {
            message = '⚠️ <strong>ALERTA CRÍTICA:</strong> Tu margen es muy bajo (<10%). Debes subir precios o reducir costos URGENTEMENTE.';
        } else if (financialData.margen < 20) {
            message = '⚠️ <strong>ATENCIÓN:</strong> Tu margen es aceptable pero mejorable. Revisa tus gastos variables.';
        } else if (financialData.margen > 30) {
            message = '✅ <strong>EXCELENTE:</strong> Tu margen es saludable. Considera reinvertir en crecimiento.';
        }
        
        if (financialData.gastos > financialData.ingresos) {
            message += '<br>🚨 <strong>CRÍTICO:</strong> Estás perdiendo dinero. Reduce gastos inmediatamente.';
        }
        
        insightsEl.innerHTML = message || '✅ Todo en orden. Sigue monitoreando tus finanzas.';
    }
    
    // Reporte
    if (reportEl) {
        reportEl.innerHTML = `
            <p><strong>Ingresos:</strong> $${financialData.ingresos.toLocaleString()}</p>
            <p><strong>Gastos:</strong> $${financialData.gastos.toLocaleString()}</p>
            <p><strong>Utilidad:</strong> $${financialData.utilidad.toLocaleString()}</p>
            <p><strong>Margen:</strong> ${financialData.margen}%</p>
            <p><strong>Estado:</strong> ${financialData.margen > 20 ? 'Saludable ✅' : 'En riesgo ⚠️'}</p>
        `;
    }
    
    // Actualizar gráfico
    updateChart();
}

// Score financiero
async function updateScore() {
    const ingresos = financialData.ingresos;
    const gastos = financialData.gastos;
    const utilidad = financialData.utilidad;
    const margen = parseFloat(financialData.margen);
    
    let score = 0;
    score += Math.min(margen / 30, 1) * 40;
    score += Math.min(utilidad / 5000, 1) * 30;
    score += utilidad > 0 ? 30 : 0;
    score = Math.min(Math.round(score), 100);
    
    let rating = '';
    let color = '';
    let message = '';
    
    if (score >= 80) {
        rating = 'Excelente';
        color = '#48bb78';
        message = 'Tu negocio está en excelente estado financiero. Sigue así.';
    } else if (score >= 60) {
        rating = 'Bueno';
        color = '#ed8936';
        message = 'Vas por buen camino, pero hay áreas de mejora.';
    } else if (score >= 40) {
        rating = 'Riesgo moderado';
        color = '#f56565';
        message = 'Tu negocio necesita atención. Revisa tus gastos.';
    } else {
        rating = 'Riesgo crítico';
        color = '#e53e3e';
        message = '¡Alerta! Toma acción inmediata para salvar tu negocio.';
    }
    
    const scoreEl = document.getElementById('scoreValue');
    const ratingEl = document.getElementById('scoreRating');
    const messageEl = document.getElementById('scoreMessage');
    const circleEl = document.getElementById('scoreCircle');
    
    if (scoreEl) scoreEl.textContent = score;
    if (ratingEl) ratingEl.textContent = rating;
    if (messageEl) messageEl.textContent = message;
    
    if (circleEl) {
        const circumference = 283;
        const offset = circumference - (score / 100) * circumference;
        circleEl.style.stroke = color;
        circleEl.style.strokeDashoffset = offset;
    }
}

// Gráfico
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
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

// Proyecciones
async function calculateProjections() {
    const months = parseInt(document.getElementById('projectionMonths')?.value || 3);
    const avgIncome = financialData.ingresos;
    const avgExpenses = financialData.gastos;
    const monthlyCashFlow = avgIncome - avgExpenses;
    
    const projections = [];
    let accumulated = 0;
    let riskMonth = null;
    
    for (let i = 1; i <= months; i++) {
        accumulated += monthlyCashFlow;
        projections.push({
            month: i,
            ingresos: avgIncome,
            gastos: avgExpenses,
            flujoNeto: monthlyCashFlow,
            acumulado: accumulated
        });
        
        if (riskMonth === null && accumulated < 0) {
            riskMonth = i;
        }
    }
    
    const resultsDiv = document.getElementById('projectionResults');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <div class="projection-summary">
                <h3>Resumen de proyección a ${months} meses</h3>
                <p>📈 Flujo de caja mensual: $${monthlyCashFlow.toLocaleString()}</p>
                <p>💰 Proyección acumulada: $${accumulated.toLocaleString()}</p>
                ${riskMonth ? `<p>⚠️ Riesgo de liquidez en mes ${riskMonth}</p>` : '<p>✅ Sostenible - sin riesgo de liquidez</p>'}
            </div>
        `;
    }
    
    // Gráfico de proyección
    const ctx = document.getElementById('projectionChart')?.getContext('2d');
    if (ctx) {
        if (projectionChart) projectionChart.destroy();
        
        projectionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: projections.map(p => `Mes ${p.month}`),
                datasets: [
                    {
                        label: 'Ingresos',
                        data: projections.map(p => p.ingresos),
                        borderColor: '#48bb78',
                        fill: false
                    },
                    {
                        label: 'Gastos',
                        data: projections.map(p => p.gastos),
                        borderColor: '#f56565',
                        fill: false
                    },
                    {
                        label: 'Flujo acumulado',
                        data: projections.map(p => p.acumulado),
                        borderColor: '#667eea',
                        borderWidth: 2,
                        fill: false
                    }
                ]
            },
            options: { responsive: true }
        });
    }
}

// ============================================
// COPILOTO IA (con OpenAI real)
// ============================================
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const question = input.value.trim();
    if (!question) return;
    
    // Verificar acceso a IA
    if (currentPlan === 'basic') {
        document.getElementById('iaAccessWarning').style.display = 'block';
        return;
    }
    
    // Agregar mensaje del usuario
    const chatDiv = document.getElementById('chatMessages');
    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.textContent = question;
    chatDiv.appendChild(userMsg);
    
    input.value = '';
    chatDiv.scrollTop = chatDiv.scrollHeight;
    
    // Mostrar indicador de escritura
    const typingMsg = document.createElement('div');
    typingMsg.className = 'message bot';
    typingMsg.textContent = '✍️ Escribiendo...';
    chatDiv.appendChild(typingMsg);
    chatDiv.scrollTop = chatDiv.scrollHeight;
    
    try {
        // Llamar a Firebase Function (IA)
        const callIA = firebase.functions().httpsCallable('chatWithCFO');
        const result = await callIA({
            question: question,
            financialData: financialData
        });
        
        // Remover mensaje de escritura
        typingMsg.remove();
        
        // Agregar respuesta
        const botMsg = document.createElement('div');
        botMsg.className = 'message bot';
        botMsg.innerHTML = result.data.answer;
        chatDiv.appendChild(botMsg);
        
    } catch (error) {
        typingMsg.remove();
        
        // Fallback: respuesta local si la IA falla
        const botMsg = document.createElement('div');
        botMsg.className = 'message bot';
        botMsg.innerHTML = getLocalAIResponse(question);
        chatDiv.appendChild(botMsg);
    }
    
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

// Respuesta local de respaldo (sin API)
function getLocalAIResponse(question) {
    const q = question.toLowerCase();
    const ingresos = financialData.ingresos;
    const gastos = financialData.gastos;
    const margen = financialData.margen;
    
    if (q.includes('precio')) {
        return `📊 Basado en tu margen del ${margen}%, te recomiendo subir precios un ${margen < 20 ? 20 : 15}%. Impacto: +$${Math.round(ingresos * 0.15)} en ingresos.`;
    }
    if (q.includes('gasto')) {
        return `💰 Tus gastos son $${gastos.toLocaleString()}. Reduce: 1) Software no usado, 2) Marketing ineficiente, 3) Outsourcing barato. Ahorro potencial: $${Math.round(gastos * 0.2)}.`;
    }
    if (q.includes('contratar')) {
        return `👥 Con margen ${margen}%, ${margen > 25 ? 'SÍ puedes contratar un asistente part-time' : 'NO es recomendable contratar aún. Primero aumenta tu margen.'}`;
    }
    
    return `🤖 Análisis: Ingresos: $${ingresos} | Gastos: $${gastos} | Margen: ${margen}%. ${margen < 20 ? '⚠️ Necesitas mejorar tu rentabilidad.' : '✅ Vas por buen camino.'}`;
}

// ============================================
// REPORTES
// ============================================
function exportToCSV() {
    const headers = ['Fecha', 'Ingresos', 'Gastos', 'Utilidad', 'Margen (%)'];
    const data = [[
        new Date().toLocaleDateString(),
        financialData.ingresos,
        financialData.gastos,
        financialData.utilidad,
        financialData.margen
    ]];
    
    const csvContent = [headers, ...data].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finmentor_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alert('✅ Reporte exportado');
}

// ============================================
// CONFIGURACIÓN DEL DASHBOARD
// ============================================
function setupDashboard() {
    // Inputs financieros
    const ingresosInput = document.getElementById('ingresosInput');
    const gastosInput = document.getElementById('gastosInput');
    
    if (ingresosInput) {
        ingresosInput.value = financialData.ingresos;
        ingresosInput.onchange = (e) => {
            financialData.ingresos = parseFloat(e.target.value) || 0;
            calculateMetrics();
        };
    }
    
    if (gastosInput) {
        gastosInput.value = financialData.gastos;
        gastosInput.onchange = (e) => {
            financialData.gastos = parseFloat(e.target.value) || 0;
            calculateMetrics();
        };
    }
    
    // Navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const section = btn.dataset.section;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(`${section}Section`).classList.add('active');
            
            if (section === 'projections') calculateProjections();
        };
    });
    
    // Copiloto
    const sendBtn = document.getElementById('sendMessageBtn');
    const chatInput = document.getElementById('chatInput');
    if (sendBtn) sendBtn.onclick = sendMessage;
    if (chatInput) chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    
    // Reportes
    const exportBtn = document.getElementById('exportCSVBtn');
    if (exportBtn) exportBtn.onclick = exportToCSV;
    
    // Proyecciones
    const calcBtn = document.getElementById('calculateProjectionBtn');
    if (calcBtn) calcBtn.onclick = calculateProjections;
    
    // Upgrade
    const upgradeBtn = document.getElementById('upgradeBtn');
    if (upgradeBtn) upgradeBtn.onclick = () => alert('Próximamente: paga con Stripe para actualizar tu plan');
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = async () => {
        await auth.signOut();
        window.location.href = 'index.html';
    };
}

// ============================================
// ONBOARDING
// ============================================
if (window.location.pathname.includes('onboarding.html')) {
    document.getElementById('onboardingForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const onboardingData = {
            businessName: document.getElementById('businessName').value,
            businessType: document.getElementById('businessType').value,
            monthlyIncome: parseFloat(document.getElementById('monthlyIncome').value),
            monthlyExpenses: parseFloat(document.getElementById('monthlyExpenses').value),
            currency: document.getElementById('currency').value,
            mainGoal: document.getElementById('mainGoal').value,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('onboarding').doc(currentUser.uid).set(onboardingData);
        
        // Crear datos financieros iniciales
        await db.collection('financial_data').doc(currentUser.uid).set({
            ingresos: onboardingData.monthlyIncome,
            gastos: onboardingData.monthlyExpenses,
            utilidad: onboardingData.monthlyIncome - onboardingData.monthlyExpenses,
            margen: onboardingData.monthlyIncome > 0 
                ? ((onboardingData.monthlyIncome - onboardingData.monthlyExpenses) / onboardingData.monthlyIncome * 100).toFixed(1)
                : 0,
            history: [],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        window.location.href = 'dashboard.html';
    });
}

// Selección de planes
function selectPlan(plan) {
    let message = '';
    switch(plan) {
        case 'basic':
            message = '✅ Plan Básico seleccionado. Regístrate para empezar.';
            break;
        case 'pro':
            message = '🚀 Plan Pro: $29/mes. Próximamente integración con pagos.';
            break;
        case 'cfo':
            message = '💎 Plan CFO: $99/mes. Próximamente integración con pagos.';
            break;
    }
    alert(message);
    document.getElementById('showLoginBtn')?.click();
}