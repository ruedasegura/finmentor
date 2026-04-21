const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

admin.initializeApp();

const genAI = new GoogleGenerativeAI(functions.config().gemini.key);
const MODEL_NAME = 'gemini-2.5-flash';

exports.chatWithCFO = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }
    
    const userId = context.auth.uid;
    const { question, financialData } = data;
    
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const plan = userDoc.data()?.plan || 'basic';
    
    if (plan === 'basic') {
        throw new functions.https.HttpsError('permission-denied', 'Actualiza al plan Pro para usar IA');
    }
    
    const systemPrompt = `Actúa como un CFO senior especializado en solopreneurs, freelancers y negocios digitales en Latinoamérica.
Tu objetivo es dar recomendaciones financieras CLARAS, ACCIONABLES y DIRECTAS.`;

    const userPrompt = `
Datos actuales del negocio:
- Ingresos: $${financialData.ingresos}
- Gastos: $${financialData.gastos}
- Utilidad: $${financialData.utilidad}
- Margen: ${financialData.margen}%

Pregunta del usuario: "${question}"

Responde como un CFO senior. Sé directo, accionable y específico.`;
    
    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
        const result = await model.generateContent(fullPrompt);
        const answer = result.response.text();
        
        await admin.firestore().collection('conversations').add({
            userId,
            question,
            answer,
            financialData,
            model: MODEL_NAME,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return { answer };
        
    } catch (error) {
        console.error('Error en Gemini:', error);
        throw new functions.https.HttpsError('internal', 'Error procesando la pregunta');
    }
});