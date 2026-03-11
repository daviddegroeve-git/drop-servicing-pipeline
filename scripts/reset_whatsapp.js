const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const BUCKET_NAME = 'whatsapp_sessions';
const SESSION_FILE = 'wwebjs_auth.zip';
const AUTH_DIR = path.join(__dirname, '../whatsapp-service/.wwebjs_auth');

async function resetSession() {
    console.log('[Reset] Starting session wipe...');

    // 1. Clear Local Auth Dir
    if (fs.existsSync(AUTH_DIR)) {
        console.log('[Reset] Removing local .wwebjs_auth folder...');
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        console.log('[Reset] Local folder removed.');
    } else {
        console.log('[Reset] No local folder found.');
    }

    // 2. Clear Local ZIP if exists
    const localZip = path.join(__dirname, '../whatsapp-service/', SESSION_FILE);
    if (fs.existsSync(localZip)) {
        fs.unlinkSync(localZip);
        console.log('[Reset] Local zip removed.');
    }

    // 3. Clear Supabase Storage
    try {
        console.log('[Reset] Deleting session backup from Supabase...');
        const { error } = await supabase.storage.from(BUCKET_NAME).remove([SESSION_FILE]);
        if (error) {
            console.log('[Reset] Note: No cloud session found to delete (or error):', error.message);
        } else {
            console.log('[Reset] Cloud session backup deleted successfully.');
        }
    } catch (e) {
        console.error('[Reset] Error clearing Supabase:', e.message);
    }

    console.log('\n[Reset] Done! You can now start the WhatsApp service and scan the new QR code.');
}

resetSession();
