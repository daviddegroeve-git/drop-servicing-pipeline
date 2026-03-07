const { GoogleGenAI } = require('@google/genai');
const CloserAgent = require('./closer');

/**
 * Chatbot Agent
 * Handles inbound WhatsApp messages, reads training data from Supabase, 
 * generates a contextual reply using Gemini, and sends it via Ultramsg.
 */
class ChatbotAgent {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            console.warn('[Chatbot] GEMINI_API_KEY missing. Chatbot disabled.');
        } else {
            this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        }
    }

    async classifyIntent(messageText) {
        if (!this.ai) return 'UNKNOWN';

        const prompt = `
        Analyze the following WhatsApp message from a local business and classify it into EXACTLY one of these categories:
        1. BUSINESS_AUTO_REPLY: Detailed business info, mission statements, "how can we help you", or "we are unavailable" messages that look like automatic responders.
        2. USER_QUESTION: A real person asking a specific question about price, features, or the website link.
        3. USER_GREETING: Just saying hi, hello, or sending emojis like 🙏 or 👍.
        4. USER_NEGATIVE: Stop, don't message me, annoy, block, etc.
        5. OTHER: Anything else.

        Message: "${messageText}"

        Return ONLY the category name.
        `;

        try {
            const result = await this.ai.models.generateContent({
                model: 'models/gemini-2.5-flash',
                contents: prompt
            });
            const intent = (result.text || result.response?.text || '').trim().toUpperCase();
            console.log(`[Chatbot] Classified intent: ${intent}`);
            return intent;
        } catch (err) {
            console.error('[Chatbot] Intent classification failed:', err.message);
            return 'UNKNOWN';
        }
    }

    async handleMessage(lead, incomingPhone, messageText, db) {
        if (!this.ai) return;

        try {
            // 1. Classify Intent first
            const intent = await this.classifyIntent(messageText);
            await db.addLog('chatbot', 'intent_classified', lead.place_id, { intent, message: messageText }, 'info');

            // 2. Filter out Auto-Replies
            if (intent === 'BUSINESS_AUTO_REPLY') {
                console.log(`[Chatbot] Ignoring detected auto-reply from ${lead.name}`);
                return;
            }

            // 3. For real user interactions, generate a contextual response
            const trainingLogs = await db.getTrainingLogs();

            let trainingContext = "Here are past examples of how you answered questions from leads. Mimic this style and factual information:\n";
            if (trainingLogs && trainingLogs.length > 0) {
                trainingLogs.forEach(log => {
                    const finalReply = log.status === 'corrected' && log.corrected_text
                        ? log.corrected_text
                        : log.message_out;

                    trainingContext += `User Asked: "${log.message_in}"\nYou Replied: "${finalReply}"\n\n`;
                });
            } else {
                trainingContext += "No past examples available. Use your best judgment.\n";
            }

            const prompt = `
System Prompt:
You are the ALATLAS AI Sales Assistant, representing ALATLAS Intelligence—a premium, automated web development and business intelligence agency. 

Your goal is to answer questions from local business owners (like ${lead.name}) who received a cold WhatsApp message with a link to a preview website we built for them.
The preview website we built for them is currently live at: ${lead.vercel_url}
The website costs 99 SAR per month, or they can save 198 SAR by paying 990 SAR per year (2 months free). Payment is made via STC Pay to +966 50 791 3514. 
Once paid, they need to send a screenshot of the receipt here. They can also manage their subscription and site at the ALATLAS Client Dashboard: https://drop-servicing-pipeline.vercel.app/client-dashboard (They login with their WhatsApp number).

Be polite, professional, very concise, and speak in the language they used. If they speak Arabic, reply in Arabic.

Detected Intent: ${intent}

${trainingContext}

Current Lead Context:
- Business Name: ${lead.name}
- Preview Link: ${lead.vercel_url}
- Pipeline Status: ${lead.status}

User's New Message to you:
"${messageText}"

Write the response you will send back exactly as it should appear in WhatsApp. Do not include quotes or meta-commentary.
            `;

            await db.addLog('chatbot', 'response_generation_started', lead.place_id, { intent }, 'info');

            const response = await this.ai.models.generateContent({
                model: 'models/gemini-2.5-pro',
                contents: prompt
            });

            const replyText = (response.text || response.response?.text || '').trim();
            console.log(`[Chatbot] AI generated reply: ${replyText}`);

            // Send via CloserAgent
            const closer = new CloserAgent();
            await closer.sendMessage(incomingPhone, replyText);

            await db.addLog('chatbot', 'response_sent', lead.place_id, { reply: replyText }, 'success');
            console.log(`[Chatbot] Reply sent to ${incomingPhone}`);

        } catch (error) {
            console.error(`[Chatbot] Error handling message: ${error.message}`);
            await db.addLog('chatbot', 'error', lead.place_id || null, { message: error.message }, 'error');
        }
    }
}

module.exports = ChatbotAgent;
