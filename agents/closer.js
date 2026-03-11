const axios = require('axios');

/**
 * Closer Agent
 * Uses the custom local/cloud-run WhatsApp microservice to send messages.
 * Enhanced to support Marketing Image + Client Dashboard access details.
 */
class CloserAgent {
    constructor() {
        // Local WhatsApp service endpoint (Custom microservice)
        this.baseURL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:8081';

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
        if (!rawPhone) return null;

        // If it's already a full WhatsApp ID (e.g. 966...@c.us or ...@lid), return as-is
        if (rawPhone.includes('@c.us') || rawPhone.includes('@lid')) {
            return rawPhone;
        }

        let cleaned = rawPhone.replace(/\D/g, '');

        // If it starts with 05 and is 10 digits, it's a local KSA mobile number
        if (cleaned.startsWith('05') && cleaned.length === 10) {
            cleaned = '966' + cleaned.substring(1);
        } else if (cleaned.length === 9 && (cleaned.startsWith('5'))) {
            // If it's 9 digits starting with 5, prepend 966
            cleaned = '966' + cleaned;
        }

        // Final check: Saudi mobile numbers must start with 9665 and have 12 digits
        if (cleaned.startsWith('9665') && cleaned.length === 12) {
            return cleaned;
        }

        console.warn(`[Closer] Skipping invalid or landline number: ${rawPhone}`);
        return null;
    }

    /**
     * Sends the pitch message via the local WhatsApp service
     */
    async pitchLead(businessName, phone, vercelUrl, db) {
        const formattedPhone = this.formatPhoneNumber(phone);
        if (!formattedPhone) return 'skipped_invalid';

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

            // 3. Log to history
            await db.saveOutboundChatLog(registrationData.place_id || null, formattedPhone, messageBody);

            console.log(`[Closer] Enhanced Pitch successfully delivered to ${formattedPhone}`);
            return 'local_sent';
        } catch (err) {
            console.error(`[Closer] Enhanced outreach failed for ${formattedPhone}: ${err.message}`);
            throw new Error(`Enhanced Outreach Failed: ${err.message}`);
        }
    }

    /**
     * Sends a "Lead Warming" text to confirm interest before expensive generation.
     */
    async warmLead(businessName, phone) {
        const formattedPhone = this.formatPhoneNumber(phone);
        if (!formattedPhone) return 'skipped_invalid';
        const message = `Hello ${businessName}! 💎 We are ALATLAS Intelligence. We're currently designing a premium AI-powered website for businesses in your area. 

Would you like to see a custom preview for your business completely for free? Just reply 'YES' and we'll send it over!

---

مرحباً ${businessName}! 💎 نحن ALATLAS Intelligence. نقوم حالياً بتصميم موقع إلكتروني متميز مدعوم بالذكاء الاصطناعي للشركات في منطقتك.

هل تود رؤية معاينة مخصصة لعملك مجاناً تماماً؟ فقط رد بـ "نعم" وسنرسلها لك!`;

        console.log(`[Closer] Warming lead ${formattedPhone}...`);
        const sent = await this.sendMessage(formattedPhone, message);
        if (sent) {
            // Log to chat_logs for dashboard visibility
            try {
                const db = new (require('../services/db'))();
                const lead = await db.getLeadByPhone(formattedPhone);
                await db.saveOutboundChatLog(lead?.place_id || null, formattedPhone, message);
            } catch (e) {
                console.warn(`[Closer] Failed to log warming message history: ${e.message}`);
            }
        }
        return sent;
    }

    /**
     * Sends the "1 Week Free + 19 SAR" promotion to existing leads.
     */
    async sendPromotion(businessName, phone, vercelUrl) {
        const formattedPhone = this.formatPhoneNumber(phone);
        if (!formattedPhone) return 'skipped_invalid';
        const promoImageUrl = 'https://drop-servicing-pipeline.vercel.app/marketing/promo_19sar.png';
        const portalUrl = 'https://drop-servicing-pipeline.vercel.app/client-dashboard';

        const message = `Special Offer for ${businessName}! 🚀 

We are launching a new promotion: Get 1 Week FREE to test your site, then pay only 19 SAR for the first month! (Normal price 99 SAR).

Check your site here: ${vercelUrl}
Manage everything in your portal: ${portalUrl}

Reply 'INTERESTED' to activate this offer!

---

عرض خاص لـ ${businessName}! 🚀

نحن نطلق عرضاً جديداً: احصل على أسبوع مجاني لاختبار موقعك، ثم ادفع 19 ريالاً فقط للشهر الأول! (السعر العادي 99 ريال).

تحقق من موقعك هنا: ${vercelUrl}
إدارة كل شيء في البوابة الخاصة بك: ${portalUrl}

رد بـ "مهتم" لتفعيل هذا العرض!`;

        console.log(`[Closer] Sending 19 SAR Promo to ${formattedPhone}...`);
        try {
            await this.sendMedia(formattedPhone, promoImageUrl, "Flash Sale: 1 Week FREE + 19 SAR 🚀");
            await this.sendMessage(formattedPhone, message);

            // Log to history
            const db = new (require('../services/db'))();
            const lead = await db.getLeadByPhone(formattedPhone);
            await db.saveOutboundChatLog(lead?.place_id || null, formattedPhone, message);

            return true;
        } catch (err) {
            console.error(`[Closer] Promo send failed: ${err.message}`);
            throw err;
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
            const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`Text send failed: ${errorDetails}`);
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
            const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`Media send failed: ${errorDetails}`);
        }
    }
}

module.exports = CloserAgent;
