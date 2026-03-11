const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const qrImage = require('qr-image');
const { downloadSession, uploadSession } = require('./supabaseStorage');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(express.json());

let qrCodeData = null;
let isReady = false;

// 1. Download session from Supabase (if exists) before building client
async function startWhatsApp() {
    await downloadSession();

    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.join(__dirname, '.wwebjs_auth')
        }),
        authTimeoutMs: 180000,
        // Let whatsapp-web.js handle the version automatically for maximum stability
        // webVersionCache: { ... }
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === 'win32' ? null : '/usr/bin/chromium'),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--no-default-browser-check',
                '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                '--disable-blink-features=AutomationControlled'
            ]
        }
    });

    client.on('loading_screen', (percent, message) => {
        console.log('[WhatsApp] Loading Screen:', percent, message);
    });

    client.on('qr', (qr) => {
        console.log('[WhatsApp] QR Code Received. (Check /qr endpoint)');
        qrCodeData = qr;
    });

    client.on('ready', async () => {
        console.log('[WhatsApp] Client is READY!');
        isReady = true;
        qrCodeData = null;

        // Skip cloud backup on Windows to avoid EBUSY locking issues
        if (process.platform === 'win32') {
            console.log('[WhatsApp] Skipping Cloud backup on Windows (Session persistent in .wwebjs_auth)');
            return;
        }

        try {
            await uploadSession();
            console.log('[WhatsApp] Session backed up to Supabase.');
        } catch (err) {
            console.error('[WhatsApp] Initial backup failed:', err);
        }
    });

    client.on('authenticated', () => {
        console.log('[WhatsApp] AUTHENTICATED!');
    });

    client.on('auth_failure', msg => {
        console.error('[WhatsApp] AUTHENTICATION FAILURE:', msg);
    });

    client.on('change_state', state => {
        console.log('[WhatsApp] State Change:', state);
    });

    client.on('disconnected', (reason) => {
        console.log('[WhatsApp] Client was disconnected:', reason);
        isReady = false;
        process.exit(1);
    });

    // 2. Incoming and Outgoing Message Listeners (Webhook Forwarding & Local Processing)
    const DatabaseService = require('../services/db');
    const ChatbotAgent = require('../agents/chatbot');
    const db = new DatabaseService();
    const chatbot = new ChatbotAgent();

    const forwardToWebhook = async (event_type, msg) => {
        const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
        
        let fromPhone = msg.from;
        let toPhone = msg.to;

        // Resolve real phone number if it's a LID
        if (fromPhone.endsWith('@lid')) {
            try {
                const contact = await msg.getContact();
                if (contact && contact.number) {
                    fromPhone = `${contact.number}@c.us`;
                }
            } catch (e) {}
        }

        if (toPhone && toPhone.endsWith('@lid')) {
            try {
                const contact = await msg.getContact();
                if (contact && contact.number) {
                    toPhone = `${contact.number}@c.us`;
                }
            } catch (e) {}
        }

        const payload = {
            event_type,
            instanceId: 'local-direct',
            data: {
                id: msg.id._serialized,
                from: fromPhone,
                to: toPhone,
                body: msg.body,
                type: 'chat',
                fromMe: msg.fromMe,
                timestamp: msg.timestamp
            }
        };

        // --- LOCAL PROCESSING (The "Brains" now live here too) ---
        if (event_type === 'message_received' && !msg.fromMe && msg.type === 'chat') {
            const msgTimestamp = msg.timestamp * 1000;
            const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
            const isRecent = msgTimestamp > thirtyMinutesAgo;

            if (isRecent) {
                console.log(`[Local-Bot] Processing inbound from ${fromPhone}...`);
                
                // 1. Translate locally (for dashboard view)
                let translatedMsg = null;
                try {
                    translatedMsg = await chatbot.translateText(msg.body);
                } catch (err) {
                    console.error('[Local-Bot] Translation failed:', err.message);
                }

                // 2. Identify lead and log
                const lead = await db.getLeadByPhone(fromPhone);
                const placeId = lead ? lead.place_id : null;
                await db.saveInboundChatLog(placeId, fromPhone, msg.body, translatedMsg);

                // 3. Handle via ChatbotAgent (REPLIES HAPPEN LOCALLY NOW)
                chatbot.handleMessage(lead, fromPhone, msg.body, db).catch(e => {
                    console.error('[Local-Bot] Handle message error:', e.message);
                });
            } else {
                const lead = await db.getLeadByPhone(fromPhone);
                const placeId = lead ? lead.place_id : null;
                await db.saveInboundChatLog(placeId, fromPhone, msg.body, null);
                console.log(`[Local-Bot] Old message logged (sync only) from ${fromPhone}`);
            }
        }

        if (event_type === 'message_create' && msg.fromMe && msg.type === 'chat') {
            const lead = await db.getLeadByPhone(toPhone);
            const placeId = lead ? lead.place_id : null;
            await db.saveOutboundChatLog(placeId, toPhone, msg.body);
            console.log(`[Local-Bot] Outbound logged to ${toPhone}`);
        }

        // --- MIRROR TO WEBHOOK (Optional fallback/dashboard sync) ---
        if (webhookUrl) {
            try {
                await axios.post(webhookUrl, payload, { timeout: 3000 });
                console.log(`[Webhook] Mirror sent to Vercel (From: ${fromPhone})`);
            } catch (err) {
                // If ngrok is down, this fails, BUT the bot still worked above!
                console.warn(`[Webhook] Mirror failed (Ngrok likely offline):`, err.message);
            }
        }
    };

    client.on('message', async (msg) => {
        if (msg.type === 'chat') {
            await forwardToWebhook('message_received', msg);
        }
    });

    client.on('message_create', async (msg) => {
        // Only forward messages I sent myself that aren't echoes of received ones
        if (msg.fromMe && msg.type === 'chat') {
            await forwardToWebhook('message_create', msg);
        }
    });

    console.log('[WhatsApp] Calling client.initialize()...');
    client.initialize().then(() => {
        console.log('[WhatsApp] client.initialize() promise resolved.');
    }).catch(err => {
        console.error('[WhatsApp] client.initialize() error:', err);
    });

    // Diagnostic screenshot if it takes too long
    setTimeout(async () => {
        if (!isReady && !qrCodeData) {
            console.log('[WhatsApp] Diagnostic: Initialization taking more than 120s. Attempting screenshot...');
            try {
                if (client.pupPage) {
                    const screenshot = await client.pupPage.screenshot({ encoding: 'base64' });
                    console.log('[WhatsApp] Diagnostic Screenshot (base64):', screenshot.substring(0, 100) + '...');
                } else {
                    console.log('[WhatsApp] Diagnostic: client.pupPage is not available yet.');
                }
            } catch (err) {
                console.error('[WhatsApp] Diagnostic Screenshot failed:', err);
            }
        }
    }, 120000);

    // Express API Endpoints

    app.get('/', (req, res) => {
        res.send('Atlas Digital WhatsApp API Service Running.');
    });

    app.get('/qr', (req, res) => {
        if (isReady) {
            return res.send('<h1>WhatsApp is already connected!</h1>');
        }
        if (!qrCodeData) {
            return res.send(`
                <html>
                    <head><meta http-equiv="refresh" content="15"></head>
                    <body>
                        <h1>QR Code not generated yet.</h1>
                        <p>Loading WhatsApp Web... This can take up to 2 minutes on first start.</p>
                        <p>Page will auto-refresh every 15 seconds.</p>
                    </body>
                </html>
            `);
        }

        const img = qrImage.image(qrCodeData, { type: 'png', size: 10 });
        res.writeHead(200, { 'Content-Type': 'image/png' });
        img.pipe(res);
    });

    app.get('/status', (req, res) => {
        res.json({ ready: isReady });
    });

    app.get('/sync', async (req, res) => {
        if (!isReady) {
            return res.status(503).json({ error: 'WhatsApp client is not ready' });
        }

        try {
            console.log('[WhatsApp] Starting FULL history sync...');
            const chats = await client.getChats();
            let syncCount = 0;

            // Filter for individual chats (no groups)
            const activeChats = chats.filter(c => !c.isGroup);
            console.log(`[WhatsApp] Found ${activeChats.length} individual chats to sync.`);

            for (const chat of activeChats) {
                // Fetch more messages per chat for "complete" history (e.g., last 50)
                const messages = await chat.fetchMessages({ limit: 50 });
                for (const msg of messages) {
                    if (msg.type === 'chat') {
                        const eventType = msg.fromMe ? 'message_create' : 'message_received';
                        await forwardToWebhook(eventType, msg);
                        syncCount++;
                    }
                }
                // Small delay to avoid hammering the webhook/Supabase
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            console.log(`[WhatsApp] Full history sync complete. Processed ${syncCount} messages.`);
            res.json({ success: true, messages_synced: syncCount });
        } catch (error) {
            console.error('[WhatsApp] Sync error:', error);
            res.status(500).json({ error: 'Failed to sync history', details: error.message });
        }
    });

    app.get('/health', (req, res) => {
        const health = {
            ready: isReady,
            hasClient: !!client,
            hasPupPage: !!(client && client.pupPage),
            qrCodeGenerated: !!qrCodeData
        };
        const allOk = isReady && !!(client && client.pupPage);
        res.status(allOk ? 200 : 503).send(health);
    });

    app.post('/send-media', async (req, res) => {
        if (!isReady) {
            return res.status(503).json({ error: 'WhatsApp client is not ready' });
        }

        const { to, mediaUrl, caption } = req.body;
        if (!to || !mediaUrl) {
            return res.status(400).json({ error: 'Missing to or mediaUrl parameters' });
        }

        try {
            console.log(`[WhatsApp] Fetching media from URL: ${mediaUrl}`);
            const media = await MessageMedia.fromUrl(mediaUrl);

            // 1. Resolve Number ID
            let finalId = to;
            if (!to.includes('@')) {
                let cleaned = to.replace(/\D/g, '');
                if (cleaned.startsWith('05') && cleaned.length === 10) cleaned = '966' + cleaned.substring(1);
                else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '966' + cleaned;
                
                const resolved = await client.getNumberId(cleaned);
                if (!resolved) {
                    console.warn(`[WhatsApp] Number ${cleaned} is not on WhatsApp. Skipping.`);
                    return res.status(404).json({ error: 'Number not on WhatsApp' });
                }
                finalId = resolved._serialized;
            }

            console.log(`[WhatsApp] Sending Media to: ${finalId} (Attempting resilient flow)`);

            // 2. Resilient Send Loop
            let lastError = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    // Force contact fetch to populate browser-side cache (Fixes "No LID")
                    await client.getContactById(finalId).catch(() => null);
                    await new Promise(r => setTimeout(r, 1000)); // Sync delay

                    await client.sendMessage(finalId, media, { caption: caption });
                    console.log(`[WhatsApp] Media sent successfully on attempt ${attempt} to ${finalId}`);
                    return res.json({ success: true, message: 'Media sent!' });
                } catch (err) {
                    lastError = err;
                    console.warn(`[WhatsApp] Media send attempt ${attempt} failed: ${err.message}`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            throw lastError;
        } catch (error) {
            console.error('[WhatsApp] Media send ultimate failure:', error);
            res.status(500).json({
                error: 'Failed to send media after retries',
                details: error.message,
                isReady: isReady
            });
        }
    });

    app.post('/send', async (req, res) => {
        if (!isReady) {
            return res.status(503).json({ error: 'WhatsApp client is not ready' });
        }

        const { to, message } = req.body;
        if (!to || !message) {
            return res.status(400).json({ error: 'Missing to or message parameters' });
        }

        try {
            // 1. Resolve Number ID
            let finalId = to;
            if (!to.includes('@')) {
                let cleaned = to.replace(/\D/g, '');
                if (cleaned.startsWith('05') && cleaned.length === 10) cleaned = '966' + cleaned.substring(1);
                else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '966' + cleaned;

                const resolved = await client.getNumberId(cleaned);
                if (!resolved) {
                    console.warn(`[WhatsApp] Number ${cleaned} is not on WhatsApp. Skipping.`);
                    return res.status(404).json({ error: 'Number not on WhatsApp' });
                }
                finalId = resolved._serialized;
            }

            console.log(`[WhatsApp] Sending Text to: ${finalId} (Attempting resilient flow)`);

            // 2. Resilient Send Loop
            let lastError = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    // Force contact fetch to populate browser-side cache (Fixes "No LID")
                    // If this fails, we still try the send
                    await client.getContactById(finalId).catch(() => null);
                    await new Promise(r => setTimeout(r, 1000)); // Sync delay

                    // Sending via client is usually more robust than chat object
                    await client.sendMessage(finalId, message);
                    console.log(`[WhatsApp] Message sent successfully on attempt ${attempt} to ${finalId}`);
                    return res.json({ success: true, message: 'Message sent!' });
                } catch (err) {
                    lastError = err;
                    console.warn(`[WhatsApp] Send attempt ${attempt} failed: ${err.message}`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            throw lastError;
        } catch (error) {
            console.error('[WhatsApp] Send ultimate failure:', error);
            res.status(500).json({
                error: 'Failed to send message after retries',
                details: error.message,
                isReady: isReady
            });
        }
    });

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`[Express] WhatsApp Microservice listening on port ${PORT}`);
    });
}

startWhatsApp();
