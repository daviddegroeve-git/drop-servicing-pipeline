const axios = require('axios');
require('dotenv').config();

/**
 * Retoucher Agent
 * Acts as an aesthetic auditor and quality controller.
 * Migrated to OpenRouter to support advanced Vision models for UI/UX audits.
 */
class RetoucherAgent {
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY;
        this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
        
        if (!this.apiKey) {
            throw new Error('OPENROUTER_API_KEY is not defined in environment variables.');
        }
    }

    /**
     * Refines and polishes the raw HTML using targeted edits.
     * @param {string} rawHtml - The HTML string
     * @param {Object} business - The business details
     * @param {string[]} [photos] - Real photos from Google Maps
     * @returns {Promise<string>} Polished HTML string
     */
    async retouchWebsite(rawHtml, business, photos = []) {
        console.log(`[Retoucher] Auditing website for: ${business.name} with ${photos.length} real photos...`);

        // PHASE 1: Programmatic Purge (Deterministic)
        // LLMs struggle with exact string replacement of 800-character URLs. We do it via Regex first.
        let cleanedHtml = rawHtml;
        
        const premiumTechImages = [
            "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?q=80&w=1000&auto=format&fit=crop", // Repair bench
            "https://images.unsplash.com/photo-1581092921461-eab62e97a780?q=80&w=1000&auto=format&fit=crop", // Circuit board
            "https://images.unsplash.com/photo-1563203369-26f2e4a5ccf7?q=80&w=1000&auto=format&fit=crop", // Micro soldering
            "https://images.unsplash.com/photo-1588508065123-287b28e013da?q=80&w=1000&auto=format&fit=crop", // Screen repair
            "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?q=80&w=1000&auto=format&fit=crop", // Tech tools
            "https://images.unsplash.com/photo-1629131726692-1accd0c53ce0?q=80&w=1000&auto=format&fit=crop", // Motherboard
            "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1000&auto=format&fit=crop", // Phone repair person
            "https://images.unsplash.com/photo-1574824874457-3fb2d887be17?q=80&w=1000&auto=format&fit=crop", // Broken screen
            "https://images.unsplash.com/photo-1526406915894-7bcd65f60845?q=80&w=1000&auto=format&fit=crop", // Electronics flatlay
            "https://images.unsplash.com/photo-1585247226801-bc613c441316?q=80&w=1000&auto=format&fit=crop"  // Mobile repair
        ];

        let imgIndex = 0;
        const getNextImage = () => premiumTechImages[imgIndex++ % premiumTechImages.length];

        // 1. Purge all Google Maps photos (they render as Red X due to billing)
        cleanedHtml = cleanedHtml.replace(/https:\/\/maps\.googleapis\.com\/maps\/api\/place\/photo\?[^"'\s)]+/g, () => getNextImage());
        
        // 2. Purge all loremflickr placeholders (often fetch irrelevant cats/statues)
        cleanedHtml = cleanedHtml.replace(/https:\/\/loremflickr\.com\/[^"'\s)]+/g, () => getNextImage());

        // 3. Purge all existing Unsplash images to guarantee a completely fresh, unbroken, and unique set.
        // This solves the missing hero image bug and the duplicate image bugs.
        cleanedHtml = cleanedHtml.replace(/https:\/\/images\.unsplash\.com\/photo-[^"'\s)]+/g, () => getNextImage());

        // PHASE 2: AI Aesthetic Polish
        const systemPrompt = `You are a world-class UI/UX Designer and Visual Context Specialist.
Your job is to audit HTML/Tailwind code to ensure high aesthetic quality and premium feel.

ASSET RULES:
1. **Premium glassmorphism**: Use 'backdrop-blur-lg' and 'bg-white/70' for container cards to make the text pop against backgrounds. Add 'shadow-xl' to main elements.
2. **Text Readability**: Ensure headings over hero images have strong 'drop-shadow-xl' or text-shadow so they don't blend in.
3. **No Duplicate Media**: Each section must have a unique, relevant image.
4. **Layout**: Ensure grid layouts use 'gap-8' and cards have 'rounded-xl'.
5. **Hero Image**: Ensure the hero section has a valid, high-quality background image URL.
6. **Navigation & Overlap**: To prevent the top-right language switcher from overlapping the main navigation links, simply inject 'pr-24' or similar padding to the right side of the main header's '<nav>' element. DO NOT attempt to move or duplicate the language switcher DOM elements.

BUSINESS CONTEXT:
${business.name} operates in: ${(business.types || []).join(', ')}.

OUTPUT FORMAT:
Return ONLY a valid JSON array of edits. No markdown.
[
  { "old": "exact_html_string_to_find", "new": "improved_html_string_to_replace_it" }
]`;

        const userPrompt = `
HTML to Audit:
${cleanedHtml.substring(0, 15000)}
`;

        try {
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 50000 
            });

            const content = response.data.choices[0].message.content;
            
            // Extract the array from the JSON object if the model wrapped it
            let edits = [];
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
            edits = Array.isArray(parsed) ? parsed : (parsed.edits || Object.values(parsed)[0]);

            if (!Array.isArray(edits)) {
                console.warn("[Retoucher] Model didn't return an array. Skipping.");
                return rawHtml;
            }

            console.log(`[Retoucher] Applying ${edits.length} aesthetic enhancements...`);

            let finalHtml = cleanedHtml;
            for (const edit of edits) {
                if (edit.old && edit.new) {
                    // Using split/join for global replace of exact strings safely
                    finalHtml = finalHtml.split(edit.old).join(edit.new);
                }
            }

            return finalHtml;
        } catch (error) {
            console.error(`[Retoucher] Audit failed: ${error.message}`);
            return cleanedHtml; // Return at least the regex-cleaned version
        }
    }
}

module.exports = RetoucherAgent;
