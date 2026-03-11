require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const RetoucherAgent = require('./agents/retoucher');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testSingle() {
    const place_id = 'ChIJAxhceSEDLz4RF7ribj5-dyU';
    console.log(`Fetching data for place_id: ${place_id}...`);
    
    const { data: lead, error } = await supabase
        .from('leads')
        .select('place_id, name, website_html, photos')
        .eq('place_id', place_id)
        .single();
        
    if (error) {
        console.error("Error fetching lead:", error);
        return;
    }
    
    if (!lead || !lead.website_html) {
        console.error("No website_html found for this lead.");
        return;
    }
    
    console.log(`Found lead: ${lead.name}`);
    console.log("Original HTML length:", lead.website_html.length);
    
    const business = {
        name: lead.name,
        types: ["local business"]
    };
    
    const retoucher = new RetoucherAgent();
    console.log("Retouching...");
    
    try {
        const retouchedHtml = await retoucher.retouchWebsite(lead.website_html, business, lead.photos || []);
        
        const fileName = `test_${place_id}.html`;
        fs.writeFileSync(fileName, retouchedHtml);
        console.log(`\nSuccess! Retouched HTML saved to ${fileName}`);
        
        // Let's also save the original for comparison
        fs.writeFileSync(`original_${place_id}.html`, lead.website_html);
        console.log(`Original HTML saved to original_${place_id}.html`);
        
        // Update Supabase so the user can see it live!
        const { error: updateError } = await supabase
            .from('leads')
            .update({ website_html: retouchedHtml })
            .eq('place_id', place_id);
            
        if (updateError) {
            console.error("Failed to update Supabase:", updateError);
        } else {
            console.log("Successfully updated Supabase! The live link should now show the retouched version.");
        }
        
    } catch (e) {
        console.error("Retouching failed:", e);
    }
}

testSingle();
