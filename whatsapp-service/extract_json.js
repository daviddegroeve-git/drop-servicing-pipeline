const fs = require('fs');

try {
    let rawData = fs.readFileSync('logs_debug.json', 'utf8');
    if (rawData.charCodeAt(0) === 0xFEFF) {
        rawData = rawData.slice(1);
    }

    // Fallback to manual parsing if JSON.parse fails due to trailing comma or truncation
    let logs;
    try {
        logs = JSON.parse(rawData);
    } catch (e) {
        console.log('JSON.parse failed, trying line-by-line recovery...');
        // Rough recovery: match individual objects { ... } in the array
        const objects = rawData.match(/\{[\s\S]*?\}(?=,\n  \{|\])/g) || [];
        logs = objects.map(obj => {
            try { return JSON.parse(obj); } catch (err) { return null; }
        }).filter(l => l !== null);
    }

    console.log(`Processing ${logs.length} log entries...`);
    for (const log of logs) {
        const text = log.textPayload || (log.jsonPayload && log.jsonPayload.message);
        if (text && text.includes('Diagnostic Screenshot')) {
            console.log('Found Diagnostic Screenshot entry.');
            if (text.includes('(base64):')) {
                const marker = '(base64): ';
                let base64 = text.substring(text.indexOf(marker) + marker.length).trim();
                base64 = base64.split(' ')[0].replace(/\.+$/, '');
                fs.writeFileSync('diagnostic_screenshot.png', Buffer.from(base64, 'base64'));
                console.log('Successfully saved diagnostic_screenshot.png');
                process.exit(0);
            } else {
                console.log('Entry found but no base64 marker. Text snippet:', text.substring(0, 100));
            }
        }
    }
    console.log('Diagnostic string with base64 not found in JSON logs.');
} catch (err) {
    console.error('Error:', err);
}
