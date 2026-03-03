const DatabaseService = require('../services/db');
const { sendMessage } = require('../services/ultramsg');

class BillerAgent {
    constructor() {
        this.db = new DatabaseService();
        this.subscriptionDays = 30; // 1 month subscription
    }

    async checkSubscriptions() {
        console.log('[Biller] Checking for expiring subscriptions...');

        try {
            // Fetch all completed leads with a payment date
            const { data: leads, error } = await this.db.supabase
                .from('leads')
                .select('*')
                .eq('status', 'completed')
                .not('payment_date', 'is', null)
                // Also we need to make sure they have a phone number to send to
                .not('phone', 'is', null);

            if (error) {
                console.error('[Biller] Error fetching leads', error);
                return;
            }

            for (const lead of leads) {
                await this.processLeadSubscription(lead);
            }
        } catch (error) {
            console.error('[Biller] Unexpected error during check', error);
        }
    }

    async processLeadSubscription(lead) {
        const paymentDate = new Date(lead.payment_date);
        const today = new Date();

        // Determine subscription duration
        const durationDays = lead.subscription_tier === 'yearly' ? 365 : 30;

        // Calculate the expiration date
        const expirationDate = new Date(paymentDate);
        expirationDate.setDate(expirationDate.getDate() + durationDays);

        // Calculate difference in time
        const timeDiff = expirationDate.getTime() - today.getTime();
        // Calculate difference in days (ceiling to handle partial days accurately for reminders)
        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

        console.log(`[Biller] Lead: ${lead.name} | Days Remaining: ${daysRemaining}`);

        if (daysRemaining <= 0) {
            // Subscription expired. Optional: We could downgrade their status here or suspend the site
            console.log(`[Biller] Subscription expired for ${lead.name}.`);
            return;
        }

        if (daysRemaining === 5 && !lead.reminded_5d) {
            await this.sendReminder(lead, 5, 'reminded_5d');
        } else if (daysRemaining === 3 && !lead.reminded_3d) {
            await this.sendReminder(lead, 3, 'reminded_3d');
        } else if (daysRemaining === 1 && !lead.reminded_1d) {
            await this.sendReminder(lead, 1, 'reminded_1d');
        }
    }

    async sendReminder(lead, days, flagName) {
        // Format the message
        let dayWord = days === 1 ? 'day' : 'days';
        const subType = lead.subscription_tier === 'yearly' ? 'yearly' : 'monthly';
        const price = lead.subscription_tier === 'yearly' ? '990' : '99';

        const message = `
Hello from Almusbah Agency 👋

This is a friendly automated reminder that the ${subType} subscription for your website (${lead.name}) will expire in exactly *${days} ${dayWord}*.

To keep your website online without interruption, please renew your subscription by transferring ${price} SAR to our STC Pay account: 054 606 6363.

If you have already transferred the payment, please ignore this message. Let us know if you need any assistance!
`.trim();

        // Ensure phone is formatted correctly for Ultramsg (e.g., must contain country code)
        let formattedPhone = lead.phone.replace(/\+/g, '').replace(/ /g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '966' + formattedPhone.substring(1);
        }

        console.log(`[Biller] Sending ${days}-day reminder to ${lead.name} (${formattedPhone})`);

        try {
            // Send the actual WhatsApp message
            await sendMessage(formattedPhone, message);

            // Log the reminder
            await this.db.addLog('billing', 'reminder_sent', lead.place_id, { days_remaining: days, phone: formattedPhone }, 'success');

            // Update the lead to mark this reminder as sent so we don't spam them tomorrow if hours shift slightly
            await this.db.supabase
                .from('leads')
                .update({ [flagName]: true })
                .eq('place_id', lead.place_id);

            console.log(`[Biller] Successfully sent and logged ${days}-day reminder for ${lead.name}.`);

        } catch (error) {
            console.error(`[Biller] Failed to send ${days}-day reminder to ${lead.name}:`, error);
            await this.db.addLog('billing', 'reminder_failed', lead.place_id, { error: error.message }, 'error');
        }
    }
}

module.exports = BillerAgent;
