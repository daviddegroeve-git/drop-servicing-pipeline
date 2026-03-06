const fs = require('fs');
const path = require('path');

try {
    const rawContent = fs.readFileSync('logs_dump.txt', 'utf8');
    const marker = '(base64): ';
    const index = rawContent.indexOf(marker);
    if (index !== -1) {
        let base64 = rawContent.substring(index + marker.length).trim();
        // The log might be truncated or have a "..." at the end if it was a table format previously, 
        // but since I used "value(textPayload)" it should be the full string.
        // Let's clean up any potential trailing noise just in case.
        base64 = base64.split(' ')[0].replace(/\.+$/, '');

        fs.writeFileSync('diagnostic_screenshot.png', Buffer.from(base64, 'base64'));
        console.log('Successfully saved diagnostic_screenshot.png');
    } else {
        console.log('Marker not found.');
    }
} catch (err) {
    console.error('Error processing screenshot:', err);
}
