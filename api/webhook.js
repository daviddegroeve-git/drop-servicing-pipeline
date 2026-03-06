const { waitUntil } = require('@vercel/functions');
const DatabaseService = require('../services/db');
const ChatbotAgent = require('../agents/chatbot');

// Webhook handles both legacy Ultramsg and the new local WhatsApp microservice
module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const payload = request.body;
        console.log(`[Webhook] Received event from: ${payload?.instanceId || 'unknown'}`);

        // 1. Handle "Message Received" (Inbound)
        if (payload?.event_type === 'message_received' && payload?.data) {
            if (payload.data.type === 'chat') {
                const incomingPhone = payload.data.from;
                const messageText = payload.data.body;
                const isFromMe = payload.data.fromMe === true;

                // Support both Ultramsg (which doesn't usually echo) and local-docker
                if (!isFromMe) {
                    // Safety: Only trigger AI responses for messages from the last 30 minutes
                    // Historic sync messages will have an older timestamp
                    const msgTimestamp = payload.data.timestamp * 1000; // Convert to ms
                    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
                    const isRecent = msgTimestamp > thirtyMinutesAgo;

                    if (isRecent) {
                        waitUntil(processIncomingChat(incomingPhone, messageText).catch(console.error));
                    } else {
                        // Just log old messages, don't trigger AI
                        waitUntil(logOnlyIncoming(incomingPhone, messageText).catch(console.error));
                    }
                }
            }
        }

        // 2. Handle "Message Create" (Outbound from phone or API)
        if (payload?.event_type === 'message_create' && payload?.data) {
            if (payload.data.type === 'chat') {
                const outgoingPhone = payload.data.to;
                const messageText = payload.data.body;
                const isFromMe = payload.data.fromMe === true;

                // For local-docker, we only want to log messages that actually originated from the phone/API
                if (isFromMe || payload.instanceId !== 'local-docker') {
                    waitUntil(processOutboundChat(outgoingPhone, messageText).catch(console.error));
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
    const chatbot = new ChatbotAgent();

    // 1. First, always translate for admin review (especially if it's Arabic)
    let translatedMsg = null;
    try {
        const translationPrompt = `Translate the following text to English for admin review. If it's already in English or just an emoji/symbol, just return the exact same text. Do not add any conversational filler, just output the translation:\n\n"${messageText}"`;
        const translationResponse = await chatbot.ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: translationPrompt,
        });
        translatedMsg = translationResponse.text.trim();
    } catch (err) {
        console.error('[Webhook] Translation failed:', err.message);
    }

    // 2. Find if this number belongs to a lead
    const lead = await db.getLeadByPhone(incomingPhone);
    const placeId = lead ? lead.place_id : null;

    // 3. Always log the inbound message
    await db.saveInboundChatLog(placeId, incomingPhone, messageText, translatedMsg);
    console.log(`[Webhook] Inbound logged from ${incomingPhone} (Lead: ${lead?.name || 'Unknown'})`);

    // 4. Trigger the Chatbot Agent to generate and send a reply ONLY if it's a known lead
    if (lead) {
        await chatbot.handleMessage(lead, incomingPhone, messageText, db);
    }
}

async function processOutboundChat(outgoingPhone, messageText) {
    const db = new DatabaseService();

    // Find if we are sending this to a known lead
    const lead = await db.getLeadByPhone(outgoingPhone);
    const placeId = lead ? lead.place_id : null;

    // Save it as a standalone outbound message (approved so it shows in Inbox)
    await db.saveOutboundChatLog(placeId, outgoingPhone, messageText);
    console.log(`[Webhook] Outbound logged to ${outgoingPhone} (Lead: ${lead?.name || 'Unknown'})`);
}

async function logOnlyIncoming(incomingPhone, messageText) {
    const db = new DatabaseService();
    // Find if this number belongs to a lead
    const lead = await db.getLeadByPhone(incomingPhone);
    const placeId = lead ? lead.place_id : null;

    // Just log it, no translation or AI reply
    await db.saveInboundChatLog(placeId, incomingPhone, messageText, null);
    console.log(`[Webhook] Old message logged (sync only) from ${incomingPhone}`);
}
