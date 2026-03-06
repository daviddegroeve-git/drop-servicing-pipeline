const { createClient } = require('@supabase/supabase-js');
const archiver = require('archiver');
const extract = require('extract-zip');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const BUCKET_NAME = 'whatsapp_sessions';
const SESSION_FILE = 'wwebjs_auth.zip';
const AUTH_DIR = '/tmp/.wwebjs_auth';

async function ensureBucket() {
    try {
        const { data: buckets } = await supabase.storage.listBuckets();
        if (buckets && !buckets.find(b => b.name === BUCKET_NAME)) {
            await supabase.storage.createBucket(BUCKET_NAME, { public: false });
            console.log('[Storage] Created new secure backup bucket:', BUCKET_NAME);
        }
    } catch (e) {
        console.error('[Storage] Error ensuring bucket:', e);
    }
}

async function downloadSession() {
    console.log('[Storage] Checking for existing session in Supabase...');
    await ensureBucket();

    try {
        const { data, error } = await supabase.storage.from(BUCKET_NAME).download(SESSION_FILE);
        if (error) {
            console.log('[Storage] No existing session found on Supabase. Starting fresh.');
            return false;
        }

        const zipPath = path.join('/tmp', SESSION_FILE);
        const buffer = Buffer.from(await data.arrayBuffer());
        fs.writeFileSync(zipPath, buffer);

        console.log('[Storage] Downloaded session zip. Extracting...');
        await extract(zipPath, { dir: AUTH_DIR });
        console.log('[Storage] Session extracted successfully.');
        return true;
    } catch (err) {
        console.error('[Storage] Error downloading session:', err);
        return false;
    }
}

async function uploadSession() {
    console.log('[Storage] Zipping current session for backup...');
    if (!fs.existsSync(AUTH_DIR)) {
        console.log('[Storage] No session dir found to backup.');
        return;
    }

    const zipPath = path.join('/tmp', SESSION_FILE);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
        output.on('close', async () => {
            try {
                console.log(`[Storage] Zipped session (${archive.pointer()} total bytes). Uploading to Supabase...`);
                const fileBuffer = fs.readFileSync(zipPath);

                const { error } = await supabase.storage.from(BUCKET_NAME).upload(SESSION_FILE, fileBuffer, {
                    contentType: 'application/zip',
                    upsert: true
                });

                if (error) throw error;
                console.log('[Storage] Session safely backed up to Supabase Cloud!');
                resolve();
            } catch (err) {
                console.error('[Storage] Upload failed:', err);
                reject(err);
            }
        });

        archive.on('error', (err) => reject(err));
        archive.pipe(output);
        archive.directory(AUTH_DIR, false);
        archive.finalize();
    });
}

module.exports = { downloadSession, uploadSession };
