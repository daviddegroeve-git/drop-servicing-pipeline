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
        this.model = process.env.OPENROUTER_MODEL || 'google/gemini-pro-1.5';
        
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
        
        // Select images based on business types and name to enforce correct theming
        const businessTypesStr = ((business.types || []).join(' ') + ' ' + (business.name || '')).toLowerCase();
        let businessImages = [];

        if (businessTypesStr.includes('hair') || businessTypesStr.includes('barber') || businessTypesStr.includes('salon') || businessTypesStr.includes('saloon') || businessTypesStr.includes('grooming') || businessTypesStr.includes('حلاقة')) {
            businessImages = [
                "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=1000&auto=format&fit=crop", // Barbershop
                "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=1000&auto=format&fit=crop", // Hair styling
                "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=1000&auto=format&fit=crop", // Barber chair
                "https://images.unsplash.com/photo-1562004760-aceed7bb0fe3?q=80&w=1000&auto=format&fit=crop", // Haircut
                "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1000&auto=format&fit=crop", // Salon interior
                "https://images.unsplash.com/photo-1593702275687-f8b402bf1fb5?q=80&w=1000&auto=format&fit=crop", // Hair stylist
                "https://images.unsplash.com/photo-1605497788044-5a32c7078486?q=80&w=1000&auto=format&fit=crop", // Barber tools
                "https://images.unsplash.com/photo-1512496015851-a1c84877bc99?q=80&w=1000&auto=format&fit=crop"  // Beauty salon
            ];
        } else if (businessTypesStr.includes('repair') || businessTypesStr.includes('electronics') || businessTypesStr.includes('computer')) {
            businessImages = [
                "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?q=80&w=1000&auto=format&fit=crop", // Repair bench
                "https://images.unsplash.com/photo-1581092921461-eab62e97a780?q=80&w=1000&auto=format&fit=crop", // Circuit board
                "https://images.unsplash.com/photo-1563203369-26f2e4a5ccf7?q=80&w=1000&auto=format&fit=crop", // Micro soldering
                "https://images.unsplash.com/photo-1588508065123-287b28e013da?q=80&w=1000&auto=format&fit=crop", // Screen repair
                "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?q=80&w=1000&auto=format&fit=crop", // Tech tools
                "https://images.unsplash.com/photo-1629131726692-1accd0c53ce0?q=80&w=1000&auto=format&fit=crop", // Motherboard
                "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1000&auto=format&fit=crop", // Phone repair person
                "https://images.unsplash.com/photo-1574824874457-3fb2d887be17?q=80&w=1000&auto=format&fit=crop"  // Broken screen
            ];
        } else if (businessTypesStr.includes('restaurant') || businessTypesStr.includes('cafe') || businessTypesStr.includes('food')) {
            businessImages = [
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000&auto=format&fit=crop", // Restaurant interior
                "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1000&auto=format&fit=crop", // Fine dining
                "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?q=80&w=1000&auto=format&fit=crop", // Cafe seating
                "https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1000&auto=format&fit=crop", // Coffee
                "https://images.unsplash.com/photo-1466978913421-bac2e5e427a5?q=80&w=1000&auto=format&fit=crop", // Plated food
                "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000&auto=format&fit=crop", // Food flatlay
                "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1000&auto=format&fit=crop", // Chef
                "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop"  // Cafe ambiance
            ];
        } else {
             // Fallback to high-quality abstract / corporate / local business
             businessImages = [
                "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1000&auto=format&fit=crop", // Office
                "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1000&auto=format&fit=crop", // Team collaboration
                "https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=1000&auto=format&fit=crop", // Customer service
                "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1000&auto=format&fit=crop", // Business planning
                "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1000&auto=format&fit=crop", // Office meeting
                "https://images.unsplash.com/photo-1556761175-5973dc0f32b7?q=80&w=1000&auto=format&fit=crop", // Handshake
                "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1000&auto=format&fit=crop", // Business building
                "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1000&auto=format&fit=crop"  // People working
            ];
        }

        let imgIndex = 0;
        const getNextImage = () => businessImages[imgIndex++ % businessImages.length];

        // 0. Inject Mobile Logic Styles & Scripts
        const mobileStyles = `
        /* Mobile-only language toggle: show only the other language */
        @media (max-width: 768px) {
            html[lang="en"] .lang-en-btn { display: none !important; }
            html[lang="ar"] .lang-ar-btn { display: none !important; }
        }
        .mobile-menu-active { 
            display: flex !important; 
            flex-direction: column !important; 
            align-items: center !important; 
            justify-content: center !important; 
            position: fixed !important; 
            inset: 0 !important; 
            width: 100% !important; 
            height: 100vh !important; 
            background: rgba(17, 24, 39, 0.98) !important; 
            z-index: 100 !important; 
        }
        .mobile-menu-active li, .mobile-menu-active a {
            margin: 1.5rem 0 !important;
            font-size: 2.25rem !important; /* text-4xl */
            font-weight: 700 !important;
            text-align: center !important;
            display: block !important;
        }
        #mobile-menu-btn { z-index: 101; position: relative; }
        `;

        const mobileScript = `
        <script>
            document.addEventListener('DOMContentLoaded', () => {
                const menuBtn = document.getElementById('mobile-menu-btn');
                const menu = document.getElementById('mobile-menu');
                if (menuBtn && menu) {
                    const toggleMenu = () => {
                        menu.classList.toggle('hidden');
                        menu.classList.toggle('mobile-menu-active');
                        document.body.style.overflow = menu.classList.contains('mobile-menu-active') ? 'hidden' : '';
                    };
                    menuBtn.addEventListener('click', toggleMenu);
                    // Close menu when a link is clicked
                    menu.querySelectorAll('a').forEach(link => {
                        link.addEventListener('click', () => {
                            if (menu.classList.contains('mobile-menu-active')) {
                                toggleMenu();
                            }
                        });
                    });
                }
            });
        </script>
        `;

        // Inject CSS (Cleanup old versions first to allow updates)
        // Match both the new multi-line version and the old single-line version
        cleanedHtml = cleanedHtml.replace(/\/\* Mobile-only language toggle [\s\S]*?#mobile-menu-btn \{[^\}]*\}[\s\S]*?\n/g, '');
        cleanedHtml = cleanedHtml.replace(/\.mobile-menu-active \{ display: flex !important; flex-direction: column;[\s\S]*? \}\s*\n/g, '');
        cleanedHtml = cleanedHtml.replace('</style>', `${mobileStyles}\n    </style>`);

        // Inject JS (Cleanup old versions first)
        // Match various versions of the mobile menu script
        cleanedHtml = cleanedHtml.replace(/<script>\s*document\.addEventListener\('DOMContentLoaded', \(\) => \{\s*const menuBtn = document\.getElementById\('mobile-menu-btn'\);[\s\S]*?<\/script>\s*\n/g, '');
        cleanedHtml = cleanedHtml.replace('</body>', `${mobileScript}\n</body>`);

        // 1. Purge all Google Maps photos (they render as Red X due to billing)
        cleanedHtml = cleanedHtml.replace(/https:\/\/maps\.googleapis\.com\/maps\/api\/place\/photo\?[^"'\s)]+/g, () => getNextImage());
        
        // 2. Purge all loremflickr placeholders (often fetch irrelevant cats/statues)
        cleanedHtml = cleanedHtml.replace(/https:\/\/loremflickr\.com\/[^"'\s)]+/g, () => getNextImage());

        // 3. Purge all existing Unsplash images to guarantee a completely fresh, unbroken, and unique set.
        // This solves the missing hero image bug and the duplicate image bugs.
        cleanedHtml = cleanedHtml.replace(/https:\/\/images\.unsplash\.com\/photo-[^"'\s)]+/g, () => getNextImage());

        // 4. Programmatic Structural Cleanup & Header Enforcement
        // Identify the brand name and remove image logos
        let brandNameEn = business.name || 'Brand';
        let brandNameAr = business.name || 'العلامة التجارية';

        // Enforce solid black premium header
        const premiumHeader = `
    <!-- Header -->
    <header class="sticky top-0 w-full z-50 bg-black text-white shadow-2xl flex justify-between items-center px-6 py-4">
        <!-- Logo/Brand -->
        <a href="#home" class="flex items-center space-x-2 rtl:space-x-reverse">
            <span class="text-3xl font-extrabold tracking-tight text-white hover:text-primary-light transition-colors">
                <span data-lang="en">${brandNameEn}</span>
                <span data-lang="ar">${brandNameAr}</span>
            </span>
        </a>

        <!-- Desktop Navigation -->
        <nav id="desktop-nav" class="hidden md:flex space-x-6 lg:space-x-8 text-lg ml-auto mr-8">
            <a href="#home" class="hover:text-primary-light transition-colors duration-200"><span data-lang="en">Home</span><span data-lang="ar">الرئيسية</span></a>
            <a href="#about" class="hover:text-primary-light transition-colors duration-200"><span data-lang="en">About</span><span data-lang="ar">من نحن</span></a>
            <a href="#services" class="hover:text-primary-light transition-colors duration-200"><span data-lang="en">Services</span><span data-lang="ar">الخدمات</span></a>
            <a href="#contact" class="hover:text-primary-light transition-colors duration-200"><span data-lang="en">Contact</span><span data-lang="ar">اتصل بنا</span></a>
        </nav>

        <!-- Dynamic Controls -->
        <div class="flex items-center space-x-4 md:space-x-6 rtl:space-x-reverse">
            <button onclick="toggleLanguage()" class="lang-en-btn text-white hover:text-primary-light font-bold hidden md:block">EN</button>
            <button onclick="toggleLanguage()" class="lang-ar-btn text-white hover:text-primary-light font-bold hidden md:block">عربي</button>
            
            <div class="md:hidden flex items-center">
                <input type="checkbox" id="mobile-menu-toggle" class="hidden peer">
                <label for="mobile-menu-toggle" class="cursor-pointer text-white text-3xl peer-checked:text-primary-light transition-colors duration-200">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path class="hidden peer-checked:block" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        <path class="block peer-checked:hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                </label>
            </div>
        </div>
    </header>
        `;

        // Strip ALL existing headers and mobile nav controls robustly
        cleanedHtml = cleanedHtml.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
        cleanedHtml = cleanedHtml.replace(/<div class="mobile-nav-menu[\s\S]*?<\/div>\s*<\/div>/gi, '');
        cleanedHtml = cleanedHtml.replace(/<button id="mobile-menu-btn"[\s\S]*?<\/button>/gi, '');
        cleanedHtml = cleanedHtml.replace(/<label for="mobile-menu-toggle"[^>]*>[\s\S]*?<\/label>/gi, '');
        cleanedHtml = cleanedHtml.replace(/<div class="overlay[^>]*>[\s\S]*?<\/div>/gi, '');
        
        // Remove orphand residuals like "s=overlay"
        cleanedHtml = cleanedHtml.replace(/s="overlay"[^>]*><\/label>/gi, '');
        cleanedHtml = cleanedHtml.replace(/<button[^>]*mobile-menu-btn[^>]*>[\s\S]*?<\/button>/gi, '');

        // Inject our new consolidated header after <body> starts
        cleanedHtml = cleanedHtml.replace(/<body[^>]*>/, (match) => match + '\n' + premiumHeader);

        // Cleanup double header tags just in case
        cleanedHtml = cleanedHtml.replace(/<\/header>\s*<\/header>/g, '</header>');


        // Removed redundant injections as they are now consolidated in the premiumHeader above.


        // PHASE 2: AI Aesthetic Polish
        const systemPrompt = `You are a world-class UI/UX Designer.
Your job is to audit HTML/Tailwind code to ensure high aesthetic quality.

CRITICAL RULES:
1. **SIDEBAR LANGUAGE SWITCHER**: We have moved the language buttons (EN / عربي) INSIDE the mobile navigation menu (the '#mobile-menu' sidebar) and next to it for desktop. DO NOT delete them, and DO NOT move them back out. They are configured correctly.
2. **HAMBURGER POSITION**: The header MUST stay 'flex justify-between' so the brand is on one side and the hamburger is on the other. Do not use 'absolute' positioning.
3. **DO NOT MODIFY** the '#mobile-menu' structure or styling.
4. **Header Style & Contrast**: The header MUST be solid 'bg-black' and text MUST be 'text-white'. DO NOT change the background color of the header or its height/padding. DO NOT use transparency or backdrop-blur on the header. Ensure the Brand Name and Menu Links remain white. Do NOT delete or move the language switcher buttons.
5. **Glassmorphism**: Use 'backdrop-blur-lg' and 'bg-white/70' or 'bg-gray-900/70' appropriately for card backgrounds.

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
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
            const edits = Array.isArray(parsed) ? parsed : (parsed.edits || Object.values(parsed)[0]);

            console.log(`[Retoucher] Received ${Array.isArray(edits) ? edits.length : 'invalid'} AI edits.`);

            if (!Array.isArray(edits)) {
                console.warn("[Retoucher] Model didn't return an array. Skipping aesthetic enhancements.");
                return cleanedHtml; // Return the regex-cleaned version if AI edits are invalid
            }

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
