const { GoogleGenAI } = require('@google/genai');

/**
 * Creator Agent
 * Generates a complete, single-file HTML website for a given business using Gemini 2.5 Pro.
 */
class CreatorAgent {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            throw new Error('GEMINI_API_KEY is not defined in environment variables.');
        }
        this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }

    /**
     * Generates a landing page for the business
     * @param {Object} business - The business details (name, phone, address, etc.)
     * @param {Object} db - The DatabaseService instance
     * @returns {Promise<string>} HTML string of the generated website
     */
    async createWebsite(business, db) {
        console.log(`[Creator] Generating website for: ${business.name}...`);

        let promptConfig;
        try {
            promptConfig = await db.getSetting('website_prompt');
        } catch (e) {
            promptConfig = {
                system: "You are an expert web developer and copywriter.",
                instructions: "Generate a modern, beautiful, complete, single-file HTML landing page... Use Tailwind CSS via CDN. Make it bilingual (English and Arabic) with RTL."
            };
        }

        const prompt = `
      ${promptConfig.system}
      
      Business Details:
      - Name: ${business.name}
      - Phone: ${business.phone}
      - Address: ${business.address}
      - Industry/Types: ${(business.types || []).join(', ')}
      
      Real Business Photos (USE THESE EXACT URLS IN YOUR IMG SRC ATTRIBUTES OR BACKGROUND URLS):
      ${(business.photos && business.photos.length > 0) ? business.photos.map(p => `- ${p}`).join('\n      ') : 'No real photos available.'}
      
      Real Customer Reviews (Incorporate these into a Testimonials section to build trust):
      ${(business.reviews && business.reviews.length > 0) ? business.reviews.map(r => `"${r}"`).join('\n      ') : 'No recent reviews available.'}
      
      Requirements:
      ${promptConfig.instructions}
      
      *CRITICAL INSTRUCTION FOR SERVICES/SUBPAGES & NAVIGATION*: 
      1. DO NOT use placeholders like "Service 1", "Lorem Ipsum", or empty sections.
      2. Analyze the business name, industry, and customer reviews to deduce their exact services.
      3. Fully populate the "Services" or secondary sections with real, compelling, and localized descriptions fitting this specific business in Saudi Arabia. Create comprehensive content.
      4. Since this is a strict SINGLE-PAGE website, all navigation links in the header/footer MUST use anchor tags (e.g., \`href="#services"\`) that smoothly scroll to corresponding sections on the same page. 
      5. DO NOT create fake links to external pages like \`services.html\` or \`about.html\`. All content MUST exist and be fully written out on this one single page. Ensure every section linked in the navigation menu actually exists in the HTML body with the correct \`id\` attribute.
      
      *CRITICAL INSTRUCTION FOR VISUALS*:
      1. The website MUST be visually stunning. The Hero section MUST include a large, beautiful background image or a looping background video.
      2. CRITICAL: You MUST use the "Real Business Photos" URLs provided above for the images on the site. DO NOT use generic placeholders unless no real photos are available. These photos are already fully-qualified URLs and are ready to be used inside your \`<img src="...">\` tags or CSS \`url(...)\`.
      3. Distribute the real business photos throughout the Hero and Service sections to make the website feel authentic and built specifically for them. 
      4. If real photos run out or are missing, you may use \`https://loremflickr.com/w/h/keyword?random=X\` as a fallback. If using the fallback, use simple 1-word generic keywords and append a unique random number to prevent duplicate cats from appearing.
      5. Do not just leave blank colored boxes. Use rich imagery throughout the design to make it feel premium.
      
      *CRITICAL INSTRUCTION FOR BILINGUAL SUPPORT*:
      1. DO NOT write complex custom Javascript to rearrange navigation nodes or toggle individual element's \`.active\` classes. That takes up too many tokens and truncates the generation.
      2. Keep it simple: use CSS logic. Example: Hide \`[data-lang="ar"]\` when \`html[lang="en"]\` is active, and vice versa using CSS. The Javascript switcher button should literally just toggle \`document.documentElement.lang\`.
      
      Output ONLY the raw HTML string. No markdown formatting like \`\`\`html at the top or bottom. Just the pure HTML source code starting with <!DOCTYPE html>.
    `;

        try {
            // Implement a 2-minute timeout to prevent the orchestrator from hanging indefinitely
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('Gemini API request timed out after 2 minutes')), 120000);
            });

            const response = await Promise.race([
                this.ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                }),
                timeoutPromise
            ]);

            clearTimeout(timeoutId);

            let htmlContent = response.text || '';

            if (!htmlContent) {
                throw new Error("Gemini returned an empty response. This may be due to safety filters or a model failure.");
            }

            // Clean up markdown block if the model included it despite the instruction
            if (htmlContent.startsWith('```html')) {
                htmlContent = htmlContent.replace(/^```html\n/, '').replace(/\n```$/, '');
            } else if (htmlContent.startsWith('```')) {
                htmlContent = htmlContent.replace(/^```\n/, '').replace(/\n```$/, '');
            }

            console.log(`[Creator] Website successfully generated for ${business.name}.`);
            return htmlContent.trim();
        } catch (error) {
            console.error(`[Creator] Error generating website: ${error.message}`);
            throw error;
        }
    }
}

module.exports = CreatorAgent;
