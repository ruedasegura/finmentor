// ============================================
// FINMENTOR AI - CONFIGURACIÓN DE FIREBASE
// ============================================

// ⚠️ REEMPLAZA ESTOS VALORES con los de tu proyecto en Firebase Console
// Ve a: https://console.firebase.google.com -> Configuración del proyecto -> Tus aplicaciones

const firebaseConfig = {
    apiKey: "AIzaSyAMd90lC10EUX11l8KM1qNRChnIczehT2s",
    authDomain: "finmentor-saas.firebaseapp.com",
    projectId: "finmentor-saas",
    storageBucket: "finmentor-saas.firebasestorage.app",
    messagingSenderId: "428449665776",
    appId: "1:428449665776:web:d1a96cb85796938eace835"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Servicios
const auth = firebase.auth();
const db = firebase.firestore();

// Configurar persistencia
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Variables globales
let currentUserPlan = 'basic';
let currentUserId = null;

async function getUserPlan(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            currentUserPlan = userDoc.data().plan || 'basic';
            return currentUserPlan;
        }
        return 'basic';
    } catch (error) {
        console.error('Error obteniendo plan:', error);
        return 'basic';
    }
}

function hasAIAccess() {
    return currentUserPlan === 'pro' || currentUserPlan === 'cfo';
}