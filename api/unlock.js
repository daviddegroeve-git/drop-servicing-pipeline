const DatabaseService = require('../services/db');

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = request.body;

    if (!id) {
        return response.status(400).json({ error: 'Missing Lead ID' });
    }

    try {
        const db = new DatabaseService();

        // Log the unlock action
        await db.addLog('admin', 'site_unlocked', id, { action: 'Manual Verification' }, 'success');

        // Update lead status to completed
        await db.updateLeadStatus(id, 'completed');

        return response.status(200).json({ success: true, message: 'Site successfully unlocked!' });
    } catch (error) {
        console.error('[Unlock API Error]', error);
        return response.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}
