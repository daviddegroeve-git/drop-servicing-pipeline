require('dotenv').config();
const DatabaseService = require('./services/db');

async function testOuterCatch() {
    const db = new DatabaseService();
    try {
        console.log("Simulating API call...");
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Fake Timeout!')), 2000);
        });

        // This promise never resolves
        const fakeApiCall = new Promise(() => { });

        const response = await Promise.race([
            fakeApiCall,
            timeoutPromise
        ]);

        clearTimeout(timeoutId);
        console.log("Success (should not happen)");
    } catch (innerError) {
        console.error(`Caught error:`, innerError.message);
        try {
            console.log("Adding error logs...");
            await db.addLog('orchestrator', 'lead_error', 'TEST_LEAD', { message: innerError.message }, 'error');
            await db.incrementRetryCount('TEST_LEAD', innerError.message);
            console.log("Done adding error logs.");
        } catch (dbError) {
            console.error("DB logging failed:", dbError);
        }
    }
}
testOuterCatch();
