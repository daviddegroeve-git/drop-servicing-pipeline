const { GoogleGenAI } = require('@google/genai');

/**
 * Creator Agent
 * Generates a complete, single-file HTML website for a given business using Gemini 3.1 Pro.
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
     * @returns {Promise<string>} HTML string of the generated website
     */
    async createWebsite(business) {
        console.log(`[Creator] Generating website for: ${business.name}...`);

        const prompt = `
      You are an expert web developer and copywriter.
      I need you to generate a modern, beautiful, complete, single-file HTML landing page for a business.
      
      Business Details:
      - Name: ${business.name}
      - Phone: ${business.phone}
      - Address: ${business.address}
      
      Requirements:
      1. Use Tailwind CSS via CDN (<script src="https://cdn.tailwindcss.com"></script>).
      2. The design MUST be premium, vibrant, and use micro-animations or hover effects to look highly professional. Add glassmorphism or smooth gradients where appropriate. No generic plain designs!
      3. Include the following sections:
         - A Hero section featuring a compelling headline, subheadline, and call to action.
         - An About section explaining their expertise.
         - A Services section highlighting typical services for this type of business.
      4. Bilingual Content: The content MUST be inside a split layout or clear bilingual sections (English and Arabic). 
         - English text should be left-to-right (ltr).
         - Arabic text MUST have dir="rtl" applied correctly to its containers or text blocks.
      5. Output ONLY the raw HTML string. No markdown formatting like \`\`\`html at the top or bottom. Just the pure HTML source code starting with <!DOCTYPE html>.
    `;

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3.1-pro',
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
