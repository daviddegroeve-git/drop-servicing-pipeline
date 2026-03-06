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
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000 // 30 second timeout for messaging
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

        // 1. Ensure lead exists in database (Required for dashboard login)
        // AND Create/Update Supabase Auth User
        let registrationData = { pin: '000000' };
        try {
            const authService = require('../services/auth');
            registrationData = await authService.registerLead({ name: businessName, phone: formattedPhone });
            console.log(`[Closer] Lead ${formattedPhone} registered with PIN: ${registrationData.pin}`);

            const existingLead = await db.getLeadByPhone(formattedPhone);
            if (!existingLead) {
                console.log(`[Closer] Database entry missing. Creating manual entry...`);
                await db.upsertLead({
                    placeId: `manual-${formattedPhone}`,
                    name: businessName,
                    phone: phone,
                    address: 'Direct Outreach'
                });
            }
        } catch (dbErr) {
            console.warn(`[Closer] Registration or DB check failed: ${dbErr.message}. Proceeding with pitch anyway.`);
        }

        console.log(`[Closer] Routing pitch for ${businessName} to cloud service...`);

        // Image URL hosted on Vercel
        const marketingImageUrl = 'https://drop-servicing-pipeline.vercel.app/marketing/offer.png';

        let templates;
        try {
            templates = await db.getSetting('whatsapp_template');
        } catch (e) {
            templates = {
                en: "Hello {businessName}! 💎 We built a premium preview for your new website: {previewUrl}\n\nManage your site at your ALATLAS Portal: https://drop-servicing-pipeline.vercel.app/client-dashboard\n\nYour temporary password: *{password}*\n(Log in with your phone number)",
                ar: "مرحباً {businessName}! 💎 لقد قمنا بإنشاء معاينة متميزة لموقعك الإلكتروني الجديد: {previewUrl}\n\nأدر موقعك من خلال بوابة ALATLAS: https://drop-servicing-pipeline.vercel.app/client-dashboard\n\nكلمة المرور المؤقتة الخاصة بك: *{password}*\n(سجل الدخول برقم جوالك)"
            };
        }

        const buildMessage = (template, name, url, pass) => {
            if (!template) return '';
            return template
                .replace(/{businessName}/g, name)
                .replace(/{previewUrl}/g, url)
                .replace(/{password}/g, pass);
        };

        const msgEn = buildMessage(templates.en, businessName, vercelUrl, registrationData.pin);
        const msgAr = buildMessage(templates.ar, businessName, vercelUrl, registrationData.pin);
        const messageBody = `${msgEn}\n\n---\n\n${msgAr}`;

        // Send marketing image first (using Ultramsg for cloud reliability)
        let lastError = null;
        try {
            const { sendMessage: sendUltramsg, sendImage } = require('../services/ultramsg');
            console.log(`[Closer] Attempting Ultramsg for ${formattedPhone}...`);
            await sendImage(formattedPhone, marketingImageUrl, "ALATLAS Intelligence 💎");
            await sendUltramsg(formattedPhone, messageBody);
            console.log(`[Closer] Pitch successfully sent via Ultramsg.`);
            return 'ultramsg_sent';
        } catch (err) {
            console.warn(`[Closer] Ultramsg failed: ${err.message}. Falling back to local/cloud-run service...`);
            lastError = err;
        }

        // Fallback to local service (which might be Cloud Run)
        try {
            await this.sendMessage(formattedPhone, messageBody);
            console.log(`[Closer] Pitch successfully sent via local/cloud-run service.`);
            return 'local_sent';
        } catch (err) {
            console.error(`[Closer] ALL outreach channels failed for ${formattedPhone}. Reporting hard failure.`);
            throw new Error(`Outreach Failed. Primary Err: ${lastError?.message || 'Unknown'}. Secondary Err: ${err.message}`);
        }
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
                return true;
            } else {
                const errMsg = response.data?.error || 'Unknown error from local service';
                console.error(`[Closer] Local service failed: ${errMsg}`);
                throw new Error(errMsg);
            }
        } catch (error) {
            console.error(`[Closer] Error sending via local service: ${error.message}`);
            throw error;
        }
    }
}

module.exports = CloserAgent;
