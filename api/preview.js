const DatabaseService = require('../services/db');
const PublisherAgent = require('../agents/publisher');

module.exports = async function handler(request, response) {
    const { id } = request.query;

    if (!id) {
        return response.status(400).send('Missing Lead ID');
    }

    try {
        const db = new DatabaseService();
        const lead = await db.getLead(id);

        if (!lead || !lead.website_html) {
            return response.status(404).send('<h1>404 - Preview Not Found</h1><p>This website has not been generated yet or the lead ID is invalid.</p>');
        }

        // Only inject the PayTabs/STC Pay modal if the site has not been paid for and unlocked
        let finalHtml = lead.website_html;
        if (lead.status !== 'completed') {
            const publisher = new PublisherAgent();
            finalHtml = publisher.injectModal(lead.website_html);
        }

        // Serve raw HTML
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        return response.status(200).send(finalHtml);

    } catch (error) {
        console.error('[Preview API Error]', error);
        return response.status(500).send('Internal Server Error');
    }
}
