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
      
      Requirements:
      ${promptConfig.instructions}
      
      Output ONLY the raw HTML string. No markdown formatting like \`\`\`html at the top or bottom. Just the pure HTML source code starting with <!DOCTYPE html>.
    `;

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
            });

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
