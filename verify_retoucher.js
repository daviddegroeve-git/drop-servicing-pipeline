const RetoucherAgent = require('./agents/retoucher');
require('dotenv').config();

async function testRetoucher() {
    console.log("[Test] Initializing Retoucher Agent...");
    const retoucher = new RetoucherAgent();

    const dummyHtml = `
<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body class="bg-white p-10">
    <h1 class="text-3xl font-bold">Welcome to My Boutique</h1>
    <p class="text-gray-600">Premium fashion in Riyadh.</p>
    
    <!-- Broken Map Placeholder -->
    <div class="map-placeholder">
        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!..." width="600" height="450"></iframe>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <div class="bg-white p-6 shadow-md rounded-lg">
            <h3 class="font-bold">Collection A</h3>
            <img src="https://loremflickr.com/600/400/fashion" alt="fashion">
        </div>
        <div class="bg-white p-6 shadow-md rounded-lg">
            <h3 class="font-bold">Collection B</h3>
            <img src="https://loremflickr.com/600/400/fashion" alt="fashion"> <!-- Duplicate -->
        </div>
    </div>
</body>
</html>`;

    const business = {
        name: "Luxury Boutique Riyadh",
        types: ["fashion", "luxury", "boutique"]
    };

    console.log("[Test] Running audit...");
    try {
        const polishedHtml = await retoucher.retouchWebsite(dummyHtml, business);
        
        console.log("\n[Test] Polished HTML Preview (First 500 chars):");
        console.log(polishedHtml.substring(0, 500));

        if (polishedHtml.includes('backdrop-blur') || polishedHtml.includes('glassmorphism')) {
            console.log("\n✅ SUCCESS: Premium UI styles detected!");
        } else {
            console.log("\n⚠️ WARNING: No premium styles found in output.");
        }

        const imgOccurrences = (polishedHtml.match(/loremflickr\.com/g) || []).length;
        console.log(`[Test] Image occurrences after audit: ${imgOccurrences}`);

    } catch (error) {
        console.error("[Test] Audit failed:", error.message);
    }
}

testRetoucher();
