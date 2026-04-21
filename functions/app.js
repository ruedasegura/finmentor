// ============================================
// FINMENTOR AI - APP PRINCIPAL (VERSIÓN ESTABLE)
// ============================================

// Esperar a que Firebase cargue completamente
document.addEventListener('DOMContentLoaded', function() {
    console.log("FinMentor AI iniciado");
    
    // Verificar si estamos en dashboard o landing
    const isDashboard = window.location.pathname.includes('dashboard.html');
    const isOnboarding = window.location.pathname.includes('onboarding.html');
    
    // Configurar listeners de autenticación
    firebase.auth().onAuthStateChanged(function(user) {
        console.log("Auth state changed:", user ? "Usuario conectado" : "No usuario");
        
        if (user && !isDashboard && !isOnboarding) {
            // Usuario logueado pero en landing, ir a onboarding/dashboard
            checkUserOnboarding(user.uid);
        } else if (!user && (isDashboard || isOnboarding)) {
            // Usuario no logueado pero en dashboard, ir a login
            window.location.href = 'index.html';
        } else if (user && isDashboard) {
            // Usuario en dashboard, cargar datos
            loadUserData(user.uid);
            setupDashboardEvents();
        }
    });
    
    // Configurar login si estamos en index.html
    if (!isDashboard && !isOnboarding) {
        setupLogin();
    }
});

// Verificar si el usuario completó onboarding
async function checkUserOnboarding(userId) {
    try {
        const doc = await firebase.firestore().collection('onboarding').doc(userId).get();
        if (doc.exists) {
            window.location.href = 'dashboard.html';
        } else {
            window.location.href = 'onboarding.html';
        }
    } catch (error) {
        console.error("Error verificando onboarding:", error);
        window.location.href = 'onboarding.html';
    }
}

// Configurar login
function setupLogin() {
    const modal = document.getElementById('loginModal');
    const showBtns = document.querySelectorAll('#showLoginBtn, #heroLoginBtn');
    const googleBtn = document.getElementById('googleLoginBtn');
    const emailBtn = document.getElementById('emailLoginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const closeBtn = document.querySelector('.close');
    
    let isSignup = false;
    
    showBtns.forEach(btn => {
        if (btn) btn.onclick = () => modal.style.display = 'flex';
    });
    
    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
    
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
    
    // Login con Google
    if (googleBtn) {
        googleBtn.onclick = async () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                const result = await firebase.auth().signInWithPopup(provider);
                await ensureUserExists(result.user);
                modal.style.display = 'none';
            } catch (error) {
                alert('Error: ' + error.message);
            }
        };
    }
    
    // Login con email
    if (emailBtn) {
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
                    userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                } else {
                    userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
                }
                await ensureUserExists(userCredential.user);
                modal.style.display = 'none';
            } catch (error) {
                alert('Error: ' + error.message);
            }
        };
    }
    
    if (signupBtn) {
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
}

// Asegurar que el usuario existe en Firestore
async function ensureUserExists(user) {
    const userRef = firebase.firestore().collection('users').doc(user.uid);
    const doc = await userRef.get();
    
    if (!doc.exists) {
        await userRef.set({
            email: user.email,
            plan: 'basic',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

// Cargar datos del usuario en dashboard
async function loadUserData(userId) {
    try {
        const doc = await firebase.firestore().collection('financial_data').doc(userId).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('ingresosValue').textContent = `$${data.ingresos || 0}`;
            document.getElementById('gastosValue').textContent = `$${data.gastos || 0}`;
            document.getElementById('utilidadValue').textContent = `$${data.utilidad || 0}`;
            document.getElementById('margenValue').textContent = `${data.margen || 0}%`;
            
            document.getElementById('ingresosInput').value = data.ingresos || 0;
            document.getElementById('gastosInput').value = data.gastos || 0;
        }
    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

// Configurar eventos del dashboard
function setupDashboardEvents() {
    const ingresosInput = document.getElementById('ingresosInput');
    const gastosInput = document.getElementById('gastosInput');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (ingresosInput) {
        ingresosInput.onchange = async () => {
            const ingresos = parseFloat(ingresosInput.value) || 0;
            const gastos = parseFloat(gastosInput.value) || 0;
            const utilidad = ingresos - gastos;
            const margen = ingresos > 0 ? (utilidad / ingresos * 100).toFixed(1) : 0;
            
            const user = firebase.auth().currentUser;
            if (user) {
                await firebase.firestore().collection('financial_data').doc(user.uid).set({
                    ingresos, gastos, utilidad, margen,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        };
    }
    
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await firebase.auth().signOut();
            window.location.href = 'index.html';
        };
    }
}

// Onboarding
if (window.location.pathname.includes('onboarding.html')) {
    const form = document.getElementById('onboardingForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const user = firebase.auth().currentUser;
            if (!user) {
                alert('Debes iniciar sesión');
                return;
            }
            
            const onboardingData = {
                businessName: document.getElementById('businessName').value,
                businessType: document.getElementById('businessType').value,
                monthlyIncome: parseFloat(document.getElementById('monthlyIncome').value),
                monthlyExpenses: parseFloat(document.getElementById('monthlyExpenses').value),
                currency: document.getElementById('currency').value,
                mainGoal: document.getElementById('mainGoal').value,
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await firebase.firestore().collection('onboarding').doc(user.uid).set(onboardingData);
            
            // Crear datos financieros iniciales
            const utilidad = onboardingData.monthlyIncome - onboardingData.monthlyExpenses;
            const margen = onboardingData.monthlyIncome > 0 ? (utilidad / onboardingData.monthlyIncome * 100).toFixed(1) : 0;
            
            await firebase.firestore().collection('financial_data').doc(user.uid).set({
                ingresos: onboardingData.monthlyIncome,
                gastos: onboardingData.monthlyExpenses,
                utilidad: utilidad,
                margen: margen,
                history: [],
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            window.location.href = 'dashboard.html';
        });
    }
}

// Selección de planes
function selectPlan(plan) {
    let message = '';
    switch(plan) {
        case 'basic':
            message = '✅ Plan Básico seleccionado. Regístrate para empezar.';
            break;
        case 'pro':
            message = '🚀 Plan Pro: $29/mes. Próximamente disponible.';
            break;
        case 'cfo':
            message = '💎 Plan CFO: $99/mes. Próximamente disponible.';
            break;
    }
    alert(message);
    const loginBtn = document.getElementById('showLoginBtn');
    if (loginBtn) loginBtn.click();
}