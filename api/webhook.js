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
            // Only respond to text 'chat' messages
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

        // Handle outbound messages (sent from phone manually, or by code pitches)
        if (payload?.event_type === 'message_create' && payload?.data) {
            if (payload.data.type === 'chat') {
                const outgoingPhone = payload.data.to;
                const messageText = payload.data.body;

                // Process async
                waitUntil(processOutboundChat(outgoingPhone, messageText).catch(console.error));
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
        console.log(`[Webhook] Unrecognized incoming number ${incomingPhone}. Ignoring message.`);
        return;
    }

    console.log(`[Webhook] Message from mapped lead ${lead.name} (${incomingPhone}): ${messageText}`);

    // Call the Chatbot Agent to generate and send a reply
    const chatbot = new ChatbotAgent();
    await chatbot.handleMessage(lead, incomingPhone, messageText, db);
}

async function processOutboundChat(outgoingPhone, messageText) {
    const db = new DatabaseService();

    // Find if we are sending this to a known lead
    const lead = await db.getLeadByPhone(outgoingPhone);
    if (!lead) {
        // Not a lead we track, skip logging
        return;
    }

    // Deduplication check: Was this message already logged by the Chatbot or Biller?
    // The chatbot inserts { message_in: X, message_out: Y } automatically.
    // If we just sent Y, Ultramsg fires this webhook. We don't want to log Y twice.
    const latestLog = await db.getLatestChatLog(outgoingPhone);

    if (latestLog && latestLog.message_out && latestLog.message_out.trim() === messageText.trim()) {
        console.log(`[Webhook] Ignoring duplicate outbound message to ${lead.name} (Already logged by AI)`);
        return;
    }

    console.log(`[Webhook] Logging new outbound message to ${lead.name} (${outgoingPhone}): ${messageText.substring(0, 50)}...`);

    // Save it as a standalone outbound message (approved so it shows in Inbox)
    await db.saveOutboundChatLog(lead.place_id, outgoingPhone, messageText);
}
