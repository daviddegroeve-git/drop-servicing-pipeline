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
You are the ALATLAS AI Sales Assistant, representing a premium, automated web development and business intelligence agency. 
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

            const [response, translationResponse] = await Promise.all([
                this.ai.models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: prompt,
                }),
                this.ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `Translate the following text to English for admin review. If it's already in English or just an emoji/symbol, just return the exact same text. Do not add any conversational filler, just output the translation:\n\n"${messageText}"`,
                })
            ]);

            const replyText = response.text.trim();
            const translatedMessage = translationResponse.text.trim();
            console.log(`[Chatbot] AI generated reply: ${replyText}`);
            console.log(`[Chatbot] Translated incoming: ${translatedMessage}`);

            // Send via CloserAgent (now using local service)
            const closer = new CloserAgent();
            await closer.sendMessage(incomingPhone, replyText);
            console.log(`[Chatbot] Reply sent to ${incomingPhone}`);

        } catch (error) {
            console.error(`[Chatbot] Error handling message: ${error.message}`);
        }
    }
}

module.exports = ChatbotAgent;
