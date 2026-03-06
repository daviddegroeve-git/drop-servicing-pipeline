const axios = require('axios');

/**
 * Closer Agent
 * Uses Ultramsg WhatsApp API to send the deployed website to the business owner.
 */
class CloserAgent {
    constructor() {
        // Local WhatsApp service endpoint
        this.baseURL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:8080';

        // Set up axios instance for local service
        this.api = axios.create({
            baseURL: this.baseURL,
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`[Closer] Initialized with local WhatsApp service at ${this.baseURL}`);
    }

    /**
     * Cleans and formats phone numbers to international format (e.g., 966...)
     */
    formatPhoneNumber(rawPhone) {
        let cleaned = rawPhone.replace(/\D/g, '');

        // If it starts with 05 and is 10 digits, it's a local KSA number
        if (cleaned.startsWith('05') && cleaned.length === 10) {
            cleaned = '966' + cleaned.substring(1);
        } else if (cleaned.length === 9 && !cleaned.startsWith('966')) {
            // If it's 9 digits (e.g. 5...), prepend 966
            cleaned = '966' + cleaned;
        }

        return cleaned;
    }

    /**
     * Sends the pitch message via the local WhatsApp service
     */
    async pitchLead(businessName, phone, vercelUrl, db) {
        const formattedPhone = this.formatPhoneNumber(phone);
        console.log(`[Closer] Routing pitch for ${businessName} to local service...`);

        let templates;
        try {
            templates = await db.getSetting('whatsapp_template');
        } catch (e) {
            templates = {
                en: "Hello {businessName}! We built a website for you: {previewUrl}",
                ar: "مرحباً {businessName}! لقد قمنا بإنشاء موقع إلكتروني لك: {previewUrl}"
            };
        }

        const buildMessage = (template, name, url) => {
            if (!template) return '';
            return template.replace(/{businessName}/g, name).replace(/{previewUrl}/g, url);
        };

        const msgEn = buildMessage(templates.en, businessName, vercelUrl);
        const msgAr = buildMessage(templates.ar, businessName, vercelUrl);
        const messageBody = `${msgEn}\n\n---\n\n${msgAr}`;

        return this.sendMessage(formattedPhone, messageBody);
    }

    /**
     * Generic method to send a message via the local WhatsApp service
     * @param {string} to - The formatted phone number (e.g. 966...)
     * @param {string} message - The message body
     */
    async sendMessage(to, message) {
        try {
            const response = await this.api.post('/send', {
                to: to,
                message: message
            });

            if (response.data && response.data.success) {
                console.log(`[Closer] Local service confirmed message sent to ${to}`);
                return 'local_sent';
            } else {
                console.warn(`[Closer] Local service accepted request but didn't confirm success:`, response.data);
                return 'unknown';
            }
        } catch (error) {
            console.error(`[Closer] Error sending via local service: ${error.message}`);
            throw error;
        }
    }
}

module.exports = CloserAgent;
