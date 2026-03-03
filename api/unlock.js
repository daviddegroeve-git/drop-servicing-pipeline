const DatabaseService = require('../services/db');

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const { id, payment_date, tier = 'monthly' } = request.body;

    if (!id || !payment_date) {
        return response.status(400).json({ error: 'Missing Lead ID or payment_date' });
    }

    try {
        const db = new DatabaseService();

        // Log the unlock action
        await db.addLog('admin', 'site_unlocked', id, { action: 'Manual Verification', payment_date, tier }, 'success');

        // Update lead status to completed, save payment_date, tier, and reset reminders
        await db.supabase
            .from('leads')
            .update({
                status: 'completed',
                payment_date: new Date(payment_date).toISOString(),
                subscription_tier: tier,
                reminded_5d: false,
                reminded_3d: false,
                reminded_1d: false
            })
            .eq('place_id', id);

        return response.status(200).json({ success: true, message: 'Site successfully unlocked!' });
    } catch (error) {
        console.error('[Unlock API Error]', error);
        return response.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}
