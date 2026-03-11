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
        2. USER_INTERESTED: Positive responses like "YES", "I am interested", "show me", "نعم", "مهتم", "ارسل", or any variation expressing interest in the free trial or preview.
        3. USER_QUESTION: A real person asking a specific question about price, features, or the website link.
        4. USER_GREETING: Just saying hi, hello, or sending emojis like 🙏 or 👍.
        5. USER_NEGATIVE: Stop, don't message me, annoy, block, etc.
        6. OTHER: Anything else.

        Message: "${messageText}"

        Return ONLY the category name.
        `;

        try {
            const result = await this.ai.models.generateContent({
                model: 'gemini-2.5-flash',
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

            // 3. Handle Explicit Interest (Automated Trial Activation)
            if (intent === 'USER_INTERESTED' && (lead.status === 'scouted' || lead.status === 'warming_sent')) {
                console.log(`[Chatbot] Interest Confirmed for ${lead.name}. Activating Trial...`);
                await db.updateLeadStatus(lead.place_id, 'interest_confirmed', { 
                    updated_at: new Date().toISOString() 
                });
                
                const activationMsg = `Great choice, ${lead.name}! 💎 Your 1-week FREE trial is now being activated. 

We are finalizing your custom AI-powered website now. You will receive a link to your preview within the next 15-20 minutes!

---

خيار رائع، ${lead.name}! 💎 تجربة الأسبوع المجاني الخاصة بك قيد التفعيل الآن.

نحن نضع اللمسات الأخيرة على موقعك المخصص المدعوم بالذكاء الاصطناعي الآن. ستصلك رسالة تحتوي على رابط المعاينة خلال 15-20 دقيقة القادمة!`;

                const closer = new CloserAgent();
                await closer.sendMessage(incomingPhone, activationMsg);
                await db.saveOutboundChatLog(lead.place_id, incomingPhone, activationMsg);
                return; // Stop here, the Orchestrator will pick it up
            }

            // 4. For real user interactions, generate a contextual response
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

NEW PROMOTION: 
- 1 Week FREE Trial: They can test the site for 7 days without paying.
- Promotion Price: Only 19 SAR for the first month (Normal price is 99 SAR).
- Annual Discount: 990 SAR per year (2 months free).

Payment Detail: Payment via STC Pay to +966 50 791 3514. 
Verification: Once paid, they must send a screenshot of the receipt here.
Dashboard: Manage site at https://drop-servicing-pipeline.vercel.app/client-dashboard (Login with WhatsApp number).

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
                model: 'gemini-2.5-flash',
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
