const axios = require('axios');

/**
 * Closer Agent
 * Uses the custom local/cloud-run WhatsApp microservice to send messages.
 * Enhanced to support Marketing Image + Client Dashboard access details.
 */
class CloserAgent {
    constructor() {
        // Local WhatsApp service endpoint (Custom microservice)
        this.baseURL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:8080';

        // Set up axios instance for local service
        this.api = axios.create({
            baseURL: this.baseURL,
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000 // 60 second timeout for messaging (media can be slow)
        });

        console.log(`[Closer] Using Local WhatsApp service at ${this.baseURL}`);
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

        // 1. Ensure lead exists and generate/retrieve PIN
        let registrationData = { pin: '000000' };
        try {
            const authService = require('../services/auth');
            registrationData = await authService.registerLead({ name: businessName, phone: formattedPhone });
            console.log(`[Closer] Lead ${formattedPhone} ready with PIN: ${registrationData.pin}`);
        } catch (dbErr) {
            console.warn(`[Closer] Registration failed: ${dbErr.message}.`);
        }

        console.log(`[Closer] Sending Enhanced Pitch for ${businessName}...`);

        // Image and Portal details
        const marketingImageUrl = 'https://drop-servicing-pipeline.vercel.app/marketing/offer.png';
        const portalUrl = 'https://drop-servicing-pipeline.vercel.app/client-dashboard';

        let templates;
        try {
            templates = await db.getSetting('whatsapp_template');
        } catch (e) {
            templates = {
                en: "Hello {businessName}! 💎 We built a premium preview for your new website: {previewUrl}\n\nManage your site at your ALATLAS Portal: {portalUrl}\n\nYour Login Credentials:\nPhone: {phone}\nTemporary Password: *{password}*",
                ar: "مرحباً {businessName}! 💎 لقد قمنا بإنشاء معاينة متميزة لموقعك الإلكتروني الجديد: {previewUrl}\n\nأدر موقعك من خلال بوابة ALATLAS: {portalUrl}\n\nبيانات تسجيل الدخول الخاصة بك:\nرقم الجوال: {phone}\nكلمة المرور المؤقتة: *{password}*"
            };
        }

        const buildMessage = (template, name, url, portal, phoneNum, pass) => {
            if (!template) return '';
            return template
                .replace(/{businessName}/g, name)
                .replace(/{previewUrl}/g, url)
                .replace(/{portalUrl}/g, portal)
                .replace(/{phone}/g, phoneNum)
                .replace(/{password}/g, pass);
        };

        const msgEn = buildMessage(
            registrationData.isNew ? templates.en : (templates.en_returning || "Welcome back {businessName}! 💎 We've updated your premium preview: {previewUrl}\n\nAccess your portal with your new temporary password.\n\nPortal: {portalUrl}\nPhone: {phone}\nNew Password: *{password}*"),
            businessName, vercelUrl, portalUrl, formattedPhone, registrationData.pin
        );
        const msgAr = buildMessage(
            registrationData.isNew ? templates.ar : (templates.ar_returning || "مرحباً بعودتك {businessName}! 💎 لقد قمنا بتحديث المعاينة المتميزة الخاصة بك: {previewUrl}\n\nيمكنك الوصول إلى البوابة الخاصة بك باستخدام كلمة المرور المؤقتة الجديدة.\n\nالبوابة: {portalUrl}\nرقم الجوال: {phone}\nكلمة المرور الجديدة: *{password}*"),
            businessName, vercelUrl, portalUrl, formattedPhone, registrationData.pin
        );
        const messageBody = `${msgEn}\n\n---\n\n${msgAr}`;

        try {
            // 1. Send Marketing Image FIRST
            console.log(`[Closer] Step 1: Sending marketing image to ${formattedPhone}...`);
            await this.sendMedia(formattedPhone, marketingImageUrl, "ALATLAS Intelligence 💎");

            // 2. Send the Access Details message SECOND
            console.log(`[Closer] Step 2: Sending dashboard details to ${formattedPhone}...`);
            await this.sendMessage(formattedPhone, messageBody);

            console.log(`[Closer] Enhanced Pitch successfully delivered to ${formattedPhone}`);
            return 'local_sent';
        } catch (err) {
            console.error(`[Closer] Enhanced outreach failed for ${formattedPhone}: ${err.message}`);
            throw new Error(`Enhanced Outreach Failed: ${err.message}`);
        }
    }

    /**
     * Generic method to send a message via the local WhatsApp service
     */
    async sendMessage(to, message) {
        try {
            const response = await this.api.post('/send', { to, message });
            if (response.data && response.data.success) return true;
            throw new Error(response.data?.error || 'Unknown error');
        } catch (error) {
            throw new Error(`Text send failed: ${error.message}`);
        }
    }

    /**
     * Generic method to send media via the local WhatsApp service
     */
    async sendMedia(to, mediaUrl, caption) {
        try {
            const response = await this.api.post('/send-media', { to, mediaUrl, caption });
            if (response.data && response.data.success) return true;
            throw new Error(response.data?.error || 'Unknown error');
        } catch (error) {
            throw new Error(`Media send failed: ${error.message}`);
        }
    }
}

module.exports = CloserAgent;
