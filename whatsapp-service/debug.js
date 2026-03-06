const { Client, LocalAuth } = require('whatsapp-web.js');

console.log('[Debug] Starting...');

const client = new Client({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 0,
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    },
    puppeteer: {
        headless: true,
        timeout: 0,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--remote-debugging-port=9222'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('[Debug] QR Code Received!', qr.substring(0, 20) + '...');
    process.exit(0);
});

client.on('ready', () => {
    console.log('[Debug] Ready!');
    process.exit(0);
});

client.on('auth_failure', (msg) => {
    console.error('[Debug] Auth failure:', msg);
    process.exit(1);
});

console.log('[Debug] Calling initialize...');
client.initialize().catch(err => {
    console.error('[Debug] Fatal Error:', err);
});
