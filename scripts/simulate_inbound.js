const DatabaseService = require('../services/db');
const ChatbotAgent = require('../agents/chatbot');
require('dotenv').config();

async function simulateTest() {
    const db = new DatabaseService();
    const chatbot = new ChatbotAgent();
    
    const testPhone = '966000000000@c.us';
    const testMessage = 'Hello, how much is the service?';
    
    console.log(`[Test] Simulating inbound from ${testPhone}: "${testMessage}"`);
    
    try {
        // 1. Check if lead exists (it shouldn't for this test number)
        const lead = await db.getLeadByPhone(testPhone);
        
        // 2. Trigger AI response locally
        console.log('[Test] Triggering AI response...');
        await chatbot.handleMessage(null, testPhone, testMessage, db);
        
        console.log('[Test] Simulation complete. Check your logs or Supabase for a new entry for 966000000000.');
    } catch (error) {
        console.error('[Test] Simulation failed!');
        console.error('Error Message:', error.message);
        if (error.stack) console.error('Stack Trace:', error.stack);
    }
}

simulateTest();
