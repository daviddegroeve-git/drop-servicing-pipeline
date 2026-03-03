require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const DatabaseService = require('../services/db');
const CreatorAgent = require('../agents/creator');
const PublisherAgent = require('../agents/publisher'); // We might need to reinject the modal!

async function recreateWebsites() {
    console.log('Starting website regeneration for existing leads...');

    const db = new DatabaseService();
    const creator = new CreatorAgent();
    // const publisher = new PublisherAgent();

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        console.error('No GOOGLE_PLACES_API_KEY found.');
        return;
    }

    // Fetch leads where website_html is not null
    const { data: leads, error } = await db.supabase
        .from('leads')
        .select('*')
        .not('website_html', 'is', null);

    if (error) {
        console.error('Error fetching leads:', error);
        return;
    }

    console.log(`Found ${leads.length} leads with existing websites to regenerate.`);

    for (const lead of leads) {
        try {
            console.log(`Fetching rich details for place_id: ${lead.place_id}...`);
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${lead.place_id}&fields=reviews,types&key=${apiKey}`;
            const response = await axios.get(detailsUrl);

            let topReviews = [];
            let types = [];

            if (response.data.status === 'OK') {
                const details = response.data.result;
                if (details.reviews) {
                    topReviews = details.reviews.filter(r => r.rating >= 4).slice(0, 3).map(r => r.text);
                }
                if (details.types) {
                    types = details.types;
                }
            } else {
                console.log(`⚠️ Could not fetch extra details for ${lead.name}, proceeding with basic info.`);
            }

            // Construct business object for Creator Agent
            const business = {
                name: lead.name,
                phone: lead.phone,
                address: lead.address,
                types: types,
                reviews: topReviews
            };

            console.log(`Generating new AI website for ${lead.name}...`);
            const newHtml = await creator.createWebsite(business, db);

            // Update in DB. We dont need to re-inject the modal here because api/preview.js does it dynamically!
            // BUT wait, in the old architecture we saved it raw. Let's make sure we save the raw HTML.

            const { error: updateError } = await db.supabase
                .from('leads')
                .update({
                    website_html: newHtml,
                    updated_at: new Date().toISOString()
                })
                .eq('place_id', lead.place_id);

            if (updateError) {
                console.error(`Failed to update DB for ${lead.name}:`, updateError);
            } else {
                console.log(`✅ Successfully regenerated website for ${lead.name}`);
            }

        } catch (e) {
            console.error(`Error processing ${lead.name}:`, e.message);
        }

        // Slight delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Website regeneration complete!');
}

recreateWebsites();
