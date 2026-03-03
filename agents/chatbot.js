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

    async handleMessage(lead, incomingPhone, messageText, db) {
        if (!this.ai) return;

        try {
            // Fetch past chat logs (approved or corrected) to train the model dynamically
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
You are an AI sales assistant for an automated web development agency. 
Your goal is to answer questions from local business owners (like ${lead.name}) who received a cold WhatsApp message with a link to a preview website we built for them.
The preview website we built for them is currently live at: ${lead.vercel_url}
The website costs 99 SAR per month, or they can save 198 SAR by paying 990 SAR per year (2 months free). Payment is made via STC Pay to +966 54 606 6363. 
Once paid, they need to send a screenshot of the receipt here, and we will unlock the site and attach their domain.
If you need to send them the subscription link again, send them their preview link over again: ${lead.vercel_url}
Be polite, professional, very concise, and speak in the language they used. If they speak Arabic, reply in Arabic.

${trainingContext}

Current Lead Context:
- Business Name: ${lead.name}
- Preview Link: ${lead.vercel_url}
- Pipeline Status: ${lead.status}

User's New Message to you:
"${messageText}"

Write the response you will send back exactly as it should appear in WhatsApp. Do not include quotes or meta-commentary.
            `;

            const response = await this.ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
            });

            const replyText = response.text.trim();
            console.log(`[Chatbot] AI generated reply: ${replyText}`);

            // Send via CloserAgent (it contains the Ultramsg logic)
            const closer = new CloserAgent();

            if (closer.isConfigured) {
                const params = new URLSearchParams();
                params.append('token', closer.token);
                params.append('to', incomingPhone);
                params.append('body', replyText);

                await closer.api.post('/chat', params);
                console.log(`[Chatbot] Reply sent to ${incomingPhone}`);

                // Log it to the database for future training
                await db.saveChatLog(lead.place_id, incomingPhone, messageText, replyText, 'pending');
            } else {
                console.warn('[Chatbot] Closer Agent not configured, cannot send WhatsApp reply.');
            }

        } catch (error) {
            console.error(`[Chatbot] Error handling message: ${error.message}`);
        }
    }
}

module.exports = ChatbotAgent;
