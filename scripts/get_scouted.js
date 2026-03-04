require('dotenv').config();
const DatabaseService = require('../services/db');

async function check() {
    const db = new DatabaseService();
    const { data, error } = await db.supabase
        .from('leads')
        .select('place_id, name, status, retry_count, updated_at')
        .eq('status', 'scouted')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }
    console.log(`Found ${data.length} leads in scouted status.`);
    if (data.length > 0) {
        console.log("Sample of 10:");
        console.table(data.slice(0, 10));
    }
}
check();
