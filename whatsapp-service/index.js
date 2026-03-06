const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const qrImage = require('qr-image');
const { downloadSession, uploadSession } = require('./supabaseStorage');
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
            dataPath: '/tmp/.wwebjs_auth'
        }),
        authTimeoutMs: 180000,
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
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
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
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
            const payload = {
                event_type,
                instanceId: 'local-docker',
                data: {
                    id: msg.id._serialized,
                    from: msg.from,
                    to: msg.to,
                    body: msg.body,
                    type: 'chat', // whatsapp-web.js 'chat' is standard text
                    fromMe: msg.fromMe,
                    timestamp: msg.timestamp
                }
            };

            await axios.post(webhookUrl, payload);
            console.log(`[Webhook] Forwarded ${event_type} for message ${msg.id.id}`);
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

    app.post('/send', async (req, res) => {
        if (!isReady) {
            return res.status(503).json({ error: 'WhatsApp client is not ready' });
        }

        const { to, message } = req.body;
        if (!to || !message) {
            return res.status(400).json({ error: 'Missing to or message parameters' });
        }

        try {
            // Format phone number required by wwebjs: e.g. "1234567890@c.us"
            let formattedNumber = to.replace(/[^0-9]/g, '');
            if (!formattedNumber.endsWith('@c.us')) {
                formattedNumber += '@c.us';
            }

            await client.sendMessage(formattedNumber, message);
            console.log(`[WhatsApp] Message sent successfully to ${to}`);
            res.json({ success: true, message: 'Message sent!' });
        } catch (error) {
            console.error('[WhatsApp] Send error:', error);
            res.status(500).json({ error: 'Failed to send message', details: error.message });
        }
    });

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`[Express] WhatsApp Microservice listening on port ${PORT}`);
    });
}

startWhatsApp();
