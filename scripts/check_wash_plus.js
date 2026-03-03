const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase
        .from('leads')
        .select('name, website_html')
        .ilike('name', '%Wash Plus%')
        .limit(1);

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    if (data && data.length > 0) {
        const html = data[0].website_html;
        const images = [...html.matchAll(/src="([^">]+loremflickr[^">]+)"/g)].map(m => m[1]);
        const bgImages = [...html.matchAll(/url\(['"]?([^'"\)]+loremflickr[^'"\)]+)['"]?\)/g)].map(m => m[1]);
        console.log(`Images for ${data[0].name}:`);
        console.log(images);
        console.log('Background images:');
        console.log(bgImages);
    } else {
        console.log('No lead found for Wash Plus');
    }
}

check();
