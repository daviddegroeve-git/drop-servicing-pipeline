require('dotenv').config();
const DatabaseService = require('../services/db');
const ChatbotAgent = require('../agents/chatbot');

async function testWebhook() {
    const db = new DatabaseService();
    const chatbot = new ChatbotAgent();

    const simulatedLeadPhone = "050 012 3519";
    const simulatedUltramsgPhone = "966500123519@c.us";
    const simulatedMessage = "Hi, I received the link. Do you have a discount for 1 year?";

    console.log(`[Test] Simulating incoming WhatsApp message from ${simulatedLeadPhone}: "${simulatedMessage}"`);

    const lead = await db.getLeadByPhone(simulatedUltramsgPhone);

    if (!lead) {
        console.error(`[Test Error] Lead not found for phone ${simulatedUltramsgPhone}. Make sure they are in 'pitched' or 'completed' status.`);
        return;
    }

    console.log(`[Test] Found lead: ${lead.name}`);

    // MOCK the UltramsgService so we don't spam a real business during the test!
    const UltramsgService = require('../services/ultramsg');
    UltramsgService.sendMessage = async function (to, body) {
        console.log(`\n\n--- MOCKED WHATSAPP SEND ---`);
        console.log(`To: ${to}`);
        console.log(`Body:\n${body}`);
        console.log(`----------------------------\n\n`);
        return 'mock_message_id';
    };

    console.log(`[Test] Sending to ChatbotAgent...`);

    try {
        await chatbot.handleMessage(lead, simulatedUltramsgPhone, simulatedMessage, db);
        console.log(`\n[Test] Success! The message was processed.`);
        console.log(`[Test] Please check the 'Answers' tab in your Admin Dashboard to Review, Approve, or Correct the AI's reply.`);
    } catch (e) {
        console.error(`[Test Error]`, e);
    }
}

testWebhook();
