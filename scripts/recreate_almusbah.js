require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const DatabaseService = require('../services/db');
const CreatorAgent = require('../agents/creator');

async function recreateSpecificLead() {
    console.log('Starting website regeneration for Almusbah...');

    const db = new DatabaseService();
    const creator = new CreatorAgent();
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    // Fetch the specific lead
    const { data: leads, error } = await db.supabase
        .from('leads')
        .select('*')
        .ilike('name', '%Almusbah%');

    if (error || !leads || leads.length === 0) {
        console.error('Error fetching lead:', error);
        return;
    }

    const lead = leads[0];
    console.log(`Found lead: ${lead.name}`);

    try {
        console.log(`Fetching rich details...`);
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
        }

        const business = {
            name: lead.name,
            phone: lead.phone,
            address: lead.address,
            types: types,
            reviews: topReviews
        };

        console.log(`Generating new AI website for ${lead.name}...`);
        const newHtml = await creator.createWebsite(business, db);

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
        console.error(`Error processing:`, e.message);
    }
}

recreateSpecificLead();
