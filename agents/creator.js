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
      
      Real Customer Reviews (Incorporate these into a Testimonials section to build trust):
      ${(business.reviews && business.reviews.length > 0) ? business.reviews.map(r => `"${r}"`).join('\n      ') : 'No recent reviews available.'}
      
      Requirements:
      ${promptConfig.instructions}
      
      *CRITICAL INSTRUCTION FOR SERVICES/SUBPAGES*: 
      1. DO NOT use placeholders like "Service 1", "Lorem Ipsum", or empty sections.
      2. Analyze the business name, industry, and customer reviews to deduce their exact services.
      3. Fully populate the "Services" or secondary sections with real, compelling, and localized descriptions fitting this specific business in Saudi Arabia. Create comprehensive content.
      
      *CRITICAL INSTRUCTION FOR VISUALS*:
      1. The website MUST be visually stunning. The Hero section MUST include a large, beautiful background image or a looping background video.
      2. Strongly use relevant placeholder images for the Hero and Service sections. You can use services like \`https://loremflickr.com/1920/1080/\${keyword}\` (e.g., if it's a restaurant, use \`https://loremflickr.com/1920/1080/restaurant,food\`).
      3. Do not just leave blank colored boxes. Use rich imagery throughout the design to make it feel premium.
      
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
                    model: 'gemini-2.5-pro',
                    contents: prompt,
                }),
                timeoutPromise
            ]);

            clearTimeout(timeoutId);

            let htmlContent = response.text;

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
