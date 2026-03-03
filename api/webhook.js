const { waitUntil } = require('@vercel/functions');
const DatabaseService = require('../services/db');
const ChatbotAgent = require('../agents/chatbot');

// Ultramsg sends Webhook POST requests 
module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const payload = request.body;

        // Ultramsg specific structure
        // {"event_type":"message_received","instanceId":"...","data":{"id":"...","from":"...","to":"...","body":"..."}}
        if (payload?.event_type === 'message_received' && payload?.data) {

            // Only respond to text 'chat' messages (ignore images, audios for now)
            if (payload.data.type === 'chat') {
                const incomingPhone = payload.data.from;
                const messageText = payload.data.body;

                // Do not reply to messages sent from the bot itself (echoes)
                if (incomingPhone !== payload.data.to) {
                    // Process async to avoid timing out the webhook acknowledgment
                    waitUntil(processIncomingChat(incomingPhone, messageText).catch(console.error));
                }
            }
        }

        return response.status(200).send('Webhook Received');
    } catch (error) {
        console.error('[Webhook Error]', error.message);
        return response.status(500).json({ success: false, error: error.message });
    }
}

async function processIncomingChat(incomingPhone, messageText) {
    const db = new DatabaseService();

    // Find if this number belongs to a lead
    const lead = await db.getLeadByPhone(incomingPhone);
    if (!lead) {
        console.log(`[Webhook] Unrecognized number ${incomingPhone}. Ignoring message.`);
        return;
    }

    console.log(`[Webhook] Message from mapped lead ${lead.name} (${incomingPhone}): ${messageText}`);

    // Call the Chatbot Agent to generate and send a reply
    const chatbot = new ChatbotAgent();
    await chatbot.handleMessage(lead, incomingPhone, messageText, db);
}
