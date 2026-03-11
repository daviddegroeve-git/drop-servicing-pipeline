require('dotenv').config();
const DatabaseService = require('../services/db');
const ChatbotAgent = require('../agents/chatbot');

async function testInterestDetection() {
    const db = new DatabaseService();
    const chatbot = new ChatbotAgent();
    
    // 1. Get a scouted lead
    const leads = await db.getScoutedLeads(1);
    if (leads.length === 0) {
        console.log('No scouted leads to test with.');
        return;
    }
    const lead = leads[0];
    console.log(`Testing with lead: ${lead.name} (${lead.phone})`);
    
    // 2. Mock a "YES" message
    const incomingPhone = lead.phone;
    const messageText = "YES, I am interested!";
    
    console.log(`[Test] Mocking inbound message: "${messageText}"`);
    
    // Simulate what the webhook does
    await chatbot.handleMessage(lead, incomingPhone, messageText, db);
    
    // 3. Verify status update
    const updatedLead = await db.getLead(lead.place_id);
    console.log('=========================================');
    console.log(`Final Status: ${updatedLead.status}`);
    if (updatedLead.status === 'interest_confirmed') {
        console.log('SUCCESS: Lead status updated to interest_confirmed!');
    } else {
        console.log('FAILURE: Lead status did not update correctly.');
    }
    console.log('=========================================');
}

testInterestDetection().catch(err => console.error(err));
