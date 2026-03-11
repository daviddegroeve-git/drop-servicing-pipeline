require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const RetoucherAgent = require('./agents/retoucher');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function batchRetouchAll() {
    console.log("Starting batch retouch job for all generated pages...");
    const retoucher = new RetoucherAgent();

    if (!retoucher.apiKey) {
        console.error("No OpenRouter API key found.");
        return;
    }

    try {
        // We will process pages in batches
        let hasMore = true;
        let processedCount = 0;
        const limit = 10;
        // Since we update the updated_at timestamp, the oldest records will always be the ones we haven't retouched recently.
        // So we can just repeatedly fetch the oldest 10.

        while (hasMore) {
            console.log(`\nFetching batch of ${limit} oldest pages...`);
            const { data: leads, error: fetchError } = await supabase
                .from('leads')
                .select('place_id, name, website_html, photos')
                .not('website_html', 'is', null)
                .order('updated_at', { ascending: true })
                .limit(limit);

            if (fetchError) {
                console.error("Error fetching leads:", fetchError.message);
                return;
            }

            if (!leads || leads.length === 0) {
                console.log(`\nFinished! All pages processed. Processed total: ${processedCount}`);
                hasMore = false;
                break;
            }

            console.log(`Found a batch of ${leads.length} pages to retouch.`);

            for (const lead of leads) {
                console.log(`\nRetouching website for: ${lead.name} (${lead.place_id})`);

                let polishedHtml = null;
                let retryCount = 0;
                let success = false;

                const business = {
                    name: lead.name,
                    types: ["local business"]
                };

                while (!success && retryCount < 3) {
                    try {
                        polishedHtml = await retoucher.retouchWebsite(lead.website_html, business, lead.photos || []);
                        if (polishedHtml) {
                            success = true;
                        } else {
                            throw new Error("Returned HTML was empty.");
                        }
                    } catch (err) {
                        retryCount++;
                        console.error(`Retouching failed (Attempt ${retryCount}/3):`, err.message);
                        if (err.message.includes('429')) {
                            console.log("Rate limited. Waiting 10 seconds before retrying...");
                            await delay(10000);
                        } else {
                            await delay(3000);
                        }
                    }
                }

                if (!success) {
                    console.log(`Failed to retouch ${lead.place_id} after 3 attempts. Skipping for now.`);
                } else {
                    // Update the record with the retouched HTML
                    const { error: updateError } = await supabase
                        .from('leads')
                        .update({ 
                            website_html: polishedHtml,
                            updated_at: new Date().toISOString()
                        })
                        .eq('place_id', lead.place_id);

                    if (updateError) {
                        console.error(`Failed to save retouched HTML for ${lead.place_id}:`, updateError.message);
                    } else {
                        console.log(`✅ Successfully saved retouched HTML for ${lead.name}`);
                        processedCount++;
                    }
                }

                // Add a small delay between requests to be gentle on CPU/API Limits
                console.log("Waiting 2 seconds before next page...");
                await delay(2000);
            }
        }

    } catch (e) {
        console.error("Batch retouch script failed:", e);
    }
}

batchRetouchAll();
