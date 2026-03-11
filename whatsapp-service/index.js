const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const qrImage = require('qr-image');
const { downloadSession, uploadSession } = require('./supabaseStorage');
const path = require('path');
require('dotenv').config();

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

    // 2. Incoming and Outgoing Message Listeners (Webhook Forwarding)
    const forwardToWebhook = async (event_type, msg) => {
        const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
        if (!webhookUrl) return;

        try {
            // Resolve real phone number if it's a LID (Critical for Chatbot identifying leads)
            let fromPhone = msg.from;
            let toPhone = msg.to;

            if (fromPhone.endsWith('@lid')) {
                try {
                    const contact = await msg.getContact();
                    if (contact && contact.number) {
                        fromPhone = `${contact.number}@c.us`;
                        console.log(`[WhatsApp] Resolved sender LID ${msg.from} to ${fromPhone}`);
                    }
                } catch (e) {
                    console.warn(`[WhatsApp] Could not resolve from LID ${msg.from}: ${e.message}`);
                }
            }

            if (toPhone && toPhone.endsWith('@lid')) {
                try {
                    const contact = await msg.getContact();
                    if (contact && contact.number) {
                        toPhone = `${contact.number}@c.us`;
                        console.log(`[WhatsApp] Resolved recipient LID ${msg.to} to ${toPhone}`);
                    }
                } catch (e) {
                    console.warn(`[WhatsApp] Could not resolve to LID ${msg.to}: ${e.message}`);
                }
            }

            const payload = {
                event_type,
                instanceId: 'local-docker',
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

            await axios.post(webhookUrl, payload);
            console.log(`[Webhook] Forwarded ${event_type} (From: ${fromPhone})`);
        } catch (err) {
            console.error(`[Webhook] Failed to forward ${event_type}:`, err.message);
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

            // Robust number formatting
            let finalId = null;
            if (to.includes('@c.us') || to.includes('@lid')) {
                finalId = to;
                console.log(`[WhatsApp] Using direct ID: ${finalId}`);
            } else {
                let cleaned = to.replace(/\D/g, '');
                if (cleaned.startsWith('05') && cleaned.length === 10) {
                    cleaned = '966' + cleaned.substring(1);
                } else if (cleaned.length === 9 && cleaned.startsWith('5')) {
                    cleaned = '966' + cleaned;
                }

                console.log(`[WhatsApp] Resolving & Warming: ${cleaned}`);

                // Step 1: Resolve Number ID
                const resolved = await client.getNumberId(cleaned);
                if (!resolved) {
                    console.warn(`[WhatsApp] Number ${cleaned} is not on WhatsApp. Skipping.`);
                    return res.status(404).json({ error: 'Number not on WhatsApp' });
                }
                finalId = resolved._serialized;
            }

            // Step 2: Warm up Contact and Chat state (Crucial for "No LID" error)
            try {
                await client.getContactById(finalId);
                await client.getChatById(finalId);
            } catch (warmErr) {
                console.warn(`[WhatsApp] Warming skipped for ${finalId}: ${warmErr.message}`);
            }

            // Step 3: Send Media
            await client.sendMessage(finalId, media, { caption: caption });
            console.log(`[WhatsApp] Media sent successfully to ${finalId}`);
            res.json({ success: true, message: 'Media sent!' });
        } catch (error) {
            console.error('[WhatsApp] Media send error:', error);

            // Detailed internal log
            console.log(`[WhatsApp] Diagnostic: to=${to}, mediaUrl=${mediaUrl}, isReady=${isReady}`);

            res.status(500).json({
                error: 'Failed to send media',
                details: error.message,
                isReady: isReady,
                hasPupPage: !!(client && client.pupPage)
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
            // Robust number formatting
            let finalId = null;
            if (to.includes('@c.us') || to.includes('@lid')) {
                finalId = to;
                console.log(`[WhatsApp] Using direct ID: ${finalId}`);
            } else {
                let cleaned = to.replace(/\D/g, '');
                if (cleaned.startsWith('05') && cleaned.length === 10) {
                    cleaned = '966' + cleaned.substring(1);
                } else if (cleaned.length === 9 && cleaned.startsWith('5')) {
                    cleaned = '966' + cleaned;
                }

                console.log(`[WhatsApp] Resolving & Warming: ${cleaned}`);

                // Step 1: Resolve Number ID
                const resolved = await client.getNumberId(cleaned);
                if (!resolved) {
                    console.warn(`[WhatsApp] Number ${cleaned} is not on WhatsApp. Skipping.`);
                    return res.status(404).json({ error: 'Number not on WhatsApp' });
                }

                finalId = resolved._serialized;
            }

            // Step 2: Warm up Contact and Chat state
            try {
                await client.getContactById(finalId);
                await client.getChatById(finalId);
            } catch (warmErr) {
                console.warn(`[WhatsApp] Warming skipped for ${finalId}: ${warmErr.message}`);
            }

            // Step 3: Send Message
            await client.sendMessage(finalId, message);
            console.log(`[WhatsApp] Message sent successfully to ${finalId}`);
            res.json({ success: true, message: 'Message sent!' });
        } catch (error) {
            console.error('[WhatsApp] Send error:', error);

            // Detailed internal log
            console.log(`[WhatsApp] Diagnostic: to=${to}, messageSnippet=${message.substring(0, 50)}, isReady=${isReady}`);

            res.status(500).json({
                error: 'Failed to send message',
                details: error.message,
                isReady: isReady,
                hasPupPage: !!(client && client.pupPage)
            });
        }
    });

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`[Express] WhatsApp Microservice listening on port ${PORT}`);
    });
}

startWhatsApp();
