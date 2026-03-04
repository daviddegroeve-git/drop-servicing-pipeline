require('dotenv').config();
const DatabaseService = require('../services/db');

async function resetStuckLeads() {
    const db = new DatabaseService();

    console.log('Finding leads stuck in "scouted" with no recent activity or known problematic names...');

    const stuckNames = ['Saudi World Furniture', 'Jilya Resturant', 'Flower and gift shop Riyadh'];

    try {
        const { data: leads, error } = await db.supabase
            .from('leads')
            .select('*')
            .eq('status', 'scouted');

        if (error) throw error;

        const toReset = leads.filter(l => stuckNames.includes(l.name));

        if (toReset.length === 0) {
            console.log('No specific stuck leads found.');
            return;
        }

        console.log(`Resetting ${toReset.length} stuck leads to "error" status...`);

        for (const lead of toReset) {
            await db.updateLeadStatus(lead.place_id, 'error', {
                last_error: 'Stuck in processing (Manual Reset)',
                retry_count: 3 // Set to 3 to prevent immediate re-pickup
            });
            console.log(`Reset: ${lead.name}`);
        }

        console.log('Reset operation completed.');

    } catch (err) {
        console.error('Error during reset:', err.message);
    }
}

resetStuckLeads();
