require('dotenv').config();
const DatabaseService = require('../services/db');
const CloserAgent = require('../agents/closer');

async function cleanup() {
    const db = new DatabaseService();
    const closer = new CloserAgent();
    
    console.log('[Cleanup] Starting landline purge...');
    
    // 1. Fetch leads that are in queues likely to contain landlines
    const { data: leads, error } = await db.supabase
        .from('leads')
        .select('place_id, name, phone, status')
        .in('status', ['scouted', 'published', 'created', 'retouched', 'warmed']);
        
    if (error) {
        console.error('[Cleanup] Error fetching leads:', error.message);
        return;
    }
    
    console.log(`[Cleanup] Scanning ${leads.length} leads across active queues...`);
    
    let invalidCount = 0;
    for (const lead of leads) {
        const formatted = closer.formatPhoneNumber(lead.phone);
        if (!formatted) {
            console.log(`[Cleanup] Marking invalid: ${lead.name} (${lead.phone})`);
            await db.updateLeadStatus(lead.place_id, 'invalid', { 
                last_error: 'Cleaned up by landline purge script' 
            });
            invalidCount++;
        }
    }
    
    console.log('=========================================');
    console.log(`[Cleanup] Completed!`);
    console.log(`[Cleanup] Total leads scanned: ${leads.length}`);
    console.log(`[Cleanup] Total landlines marked invalid: ${invalidCount}`);
    console.log('=========================================');
}

cleanup().catch(err => console.error('[Cleanup] Fatal error:', err));
