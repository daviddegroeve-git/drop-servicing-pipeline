require('dotenv').config();
const ScoutAgent = require('../agents/scout.js');
const dbService = require('../services/db.js');

async function testPhotos() {
    const scout = new ScoutAgent();
    // Search specifically for wash plus
    console.log("Starting scout for Wash Plus...");
    try {
        const leads = await scout.findLeads("مغسلة واش بلس");
        if (leads.length > 0) {
            console.log("\nFound Wash Plus!");
            const washPlus = leads.find(l => l.name.toLowerCase().includes("wash plus") || l.name.includes("واش بلس"));
            if (washPlus) {
                console.log("Photos Extracted:");
                washPlus.photos.forEach(p => console.log(p));
            } else {
                console.log("Found leads but not wash plus exact match:");
                console.log(leads.map(l => l.name));
            }
        } else {
            console.log("No leads found.");
        }
    } catch (e) {
        console.error("Test error:", e);
    }
}

testPhotos();
