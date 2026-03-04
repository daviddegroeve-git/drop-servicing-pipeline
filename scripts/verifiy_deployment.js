const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkRecentLogs() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    console.log('Checking for logs in the last 2 minutes...');
    
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
        .from('logs')
        .select('*')
        .gt('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching logs:', error.message);
        return;
    }

    if (data.length === 0) {
        console.log('No logs found in the last 2 minutes.');
    } else {
        console.log(`Found ${data.length} recent log entries:`);
        data.forEach(log => {
            console.log(`[${log.created_at}] [${log.agent}] ${log.action} - ${log.status}`);
        });
    }
}

checkRecentLogs();
