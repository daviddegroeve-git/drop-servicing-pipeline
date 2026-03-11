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
        
        // Select images based on business types to enforce correct theming
        const businessTypesStr = (business.types || []).join(' ').toLowerCase();
        let businessImages = [];

        if (businessTypesStr.includes('hair') || businessTypesStr.includes('barber') || businessTypesStr.includes('salon')) {
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

        // 4. Programmatic Structural Cleanup
        // Remove ANY empty or near-empty divs in the header that break flex-flipping
        cleanedHtml = cleanedHtml.replace(/<header[^>]*>[\s\S]*?<div class="flex items-center space-x-2">[\s\S]*?<\/div>/, (match) => {
            return match.replace(/<div class="flex items-center space-x-2">[\s\S]*?<\/div>/, '');
        });

        // Aggressive header layout enforcement
        cleanedHtml = cleanedHtml.replace(/<header class="([^"]*)">/g, (match, classes) => {
            let cleanClasses = classes.replace(/pr-24|relative/g, '').trim();
            if (!cleanClasses.includes('flex')) cleanClasses += ' flex';
            if (!cleanClasses.includes('justify-between')) cleanClasses += ' justify-between';
            if (!cleanClasses.includes('items-center')) cleanClasses += ' items-center';
            return `<header class="${cleanClasses} w-full px-4">`;
        });

        // Refined Language Switcher Style & Injection
        const enBtn = `<button class="lang-en-btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg text-lg w-full text-center" onclick="document.documentElement.setAttribute('lang', 'en')">English</button>`;
        const arBtn = `<button class="lang-ar-btn bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg text-lg w-full text-center" onclick="document.documentElement.setAttribute('lang', 'ar')">عربي</button>`;
        
        const desktopEnBtn = `<button class="lang-en-btn hidden md:inline-block border border-current text-current hover:bg-gray-800 hover:text-white dark:hover:bg-white dark:hover:text-black font-semibold py-2 px-4 rounded-lg transition-all ml-4" onclick="document.documentElement.setAttribute('lang', 'en')">English</button>`;
        const desktopArBtn = `<button class="lang-ar-btn hidden md:inline-block border border-current text-current hover:bg-gray-800 hover:text-white dark:hover:bg-white dark:hover:text-black font-semibold py-2 px-4 rounded-lg transition-all ml-4" onclick="document.documentElement.setAttribute('lang', 'ar')">عربي</button>`;
        
        // Remove ALL existing switcher instances
        cleanedHtml = cleanedHtml.replace(/<div class="(?:absolute|fixed) top-4 (?:left|right)-4">[\s\S]*?<\/div>/g, '');
        cleanedHtml = cleanedHtml.replace(/<button[^>]*class="[^"]*lang-(?:en|ar)-btn[^"]*"[^>]*>[\s\S]*?<\/button>/g, '');
        cleanedHtml = cleanedHtml.replace(/<div class="flex items-center space-x-2">\s*<button class="lang-en-btn[\s\S]*?<\/div>/g, '');
        cleanedHtml = cleanedHtml.replace(/<!-- Language Switcher -->[\s\S]*?<div class="z-50 flex space-x-2">[\s\S]*?<\/div>/g, '');
        cleanedHtml = cleanedHtml.replace(/<li>\s*<button class="lang-(?:en|ar)-btn[\s\S]*?<\/li>/g, '');
        cleanedHtml = cleanedHtml.replace(/<button id="lang-toggle"[^>]*>[\s\S]*?<\/button>/g, '');
        cleanedHtml = cleanedHtml.replace(/<button id="lang-switcher"[^>]*>[\s\S]*?<\/button>/g, '');

        // Deduplicate style blocks for language logic
        cleanedHtml = cleanedHtml.replace(/\/\* Mobile-only language toggle: show only the other language \*\/[\s\S]*?}\s*\/\* Mobile-only language toggle: show only the other language \*\/[\s\S]*?}/g, (match) => {
             return match.split('/* Mobile-only language toggle: show only the other language */')[1];
        });

        // Cleanup double 'class=' attributes
        cleanedHtml = cleanedHtml.replace(/class="([^"]*)"\s*alt="([^"]*)"\s*class="([^"]*)"/g, 'alt="$2" class="$1 $3"');
        
        // Enforce uniform image heights
        cleanedHtml = cleanedHtml.replace(/<img([^>]*)src="https:\/\/images\.unsplash\.com([^>]*)class="([^"]*)"([^>]*)>/g, (match, p1, p2, classStr, p4) => {
            let cleanClasses = classStr.replace(/h-auto|w-full|h-56|object-cover/g, '').trim();
            return `<img${p1}src="https://images.unsplash.com${p2}class="${cleanClasses} w-full h-56 object-cover"${p4}>`;
        });

        // Inject Mobile Menu & Sidebar Switcher
        if (!cleanedHtml.includes('id="mobile-menu-btn"')) {
            const sidebarLangItemNav = `<div class="md:hidden mt-12 py-6 border-t border-white/10 flex flex-col gap-4 w-full px-8">${enBtn}${arBtn}</div>`;
            const sidebarLangItemUl = `<li class="md:hidden mt-12 py-6 border-t border-white/10 flex flex-col gap-4 w-full px-8">${enBtn}${arBtn}</li>`;
            
            const desktopLangSwitcher = `<div class="hidden md:flex items-center space-x-2 rtl:space-x-reverse ml-auto mr-4">${desktopEnBtn}${desktopArBtn}</div>`;
            
            if (cleanedHtml.includes('<nav')) {
                cleanedHtml = cleanedHtml.replace(/<nav([^>]*)>/, `<nav id="mobile-menu"$1>`);
                cleanedHtml = cleanedHtml.replace(/<\/nav>/, `${sidebarLangItemNav}\n            </nav>\n            ${desktopLangSwitcher}`);
            } else {
                cleanedHtml = cleanedHtml.replace(/<ul class="([^"]*)">/g, `<ul id="mobile-menu" class="hidden md:flex $1">`);
                cleanedHtml = cleanedHtml.replace(/<\/ul>/, `${sidebarLangItemUl}\n            </ul>\n            ${desktopLangSwitcher}`);
            }
            
            cleanedHtml = cleanedHtml.replace(/<\/header>/, `
            <button id="mobile-menu-btn" class="block md:hidden text-white focus:outline-none transition-transform active:scale-95">
                <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
        </header>`);
        }

        // PHASE 2: AI Aesthetic Polish
        const systemPrompt = `You are a world-class UI/UX Designer.
Your job is to audit HTML/Tailwind code to ensure high aesthetic quality.

CRITICAL RULES:
1. **SIDEBAR LANGUAGE SWITCHER**: We have moved the language buttons (EN / عربي) INSIDE the mobile navigation menu (the '#mobile-menu' sidebar) and next to it for desktop. DO NOT delete them, and DO NOT move them back out. They are configured correctly.
2. **HAMBURGER POSITION**: The header MUST stay 'flex justify-between' so the brand is on one side and the hamburger is on the other. Do not use 'absolute' positioning.
3. **DO NOT MODIFY** the '#mobile-menu' structure or styling.
4. **Header Style & Contrast**: Ensure the header is 'sticky', uses 'backdrop-blur-md', and has a background that provides HIGH CONTRAST for the text. If the header text is white, use 'bg-gray-900/80' or a very dark transparent background. If the header text is dark, use 'bg-white/90'. Do NOT leave text unreadable or invisible against the background image. Make sure the Brand Name and Menu Links are clearly visible. Add 'text-white' to the header text if the background is dark.
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
