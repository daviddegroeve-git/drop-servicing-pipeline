const ChatbotAgent = require('../agents/chatbot');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function verifyAI() {
    console.log('[Verify] Testing OpenRouter Integration...');
    const chatbot = new ChatbotAgent();
    
    if (!chatbot.apiKey) {
        console.error('[Verify] Error: OPENROUTER_API_KEY is missing in .env');
        process.exit(1);
    }

    try {
        // 1. Test Intent Classification
        console.log('[Verify] 1. Testing Intent Classification...');
        const intent = await chatbot.classifyIntent('Hello, how much does the website cost?');
        console.log(`[Verify] Intent: ${intent}`);

        // 2. Test Translation
        console.log('[Verify] 2. Testing Translation...');
        const translation = await chatbot.translateText('مرحباً، كيف حالك؟');
        console.log(`[Verify] Translation: ${translation}`);

        console.log('[Verify] Integration verified successfully! OpenRouter is responding.');
    } catch (error) {
        console.error('[Verify] AI Test failed:', error.message);
    }
}

verifyAI();
