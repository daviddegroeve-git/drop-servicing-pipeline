const fs = require('fs');
const path = require('path');

try {
    const content = fs.readFileSync('screenshot.txt', 'utf16le');
    // The log might contain the prefix "[WhatsApp] Diagnostic Screenshot (base64): "
    const marker = '(base64): ';
    const index = content.indexOf(marker);
    if (index !== -1) {
        let base64 = content.substring(index + marker.length).trim();
        // Remove any trailing dots or log artifacts if necessary
        base64 = base64.split(' ')[0].replace(/\.+$/, '');

        fs.writeFileSync('diagnostic_screenshot.png', Buffer.from(base64, 'base64'));
        console.log('Successfully saved diagnostic_screenshot.png');
    } else {
        console.log('Marker not found. File content snippet:', content.substring(0, 100));
    }
} catch (err) {
    console.error('Error processing screenshot:', err);
}
