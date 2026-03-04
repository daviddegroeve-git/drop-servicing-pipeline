require('dotenv').config();
const Orchestrator = require('./orchestrator');

(async () => {
    try {
        console.log('[Cloud Run Job] Starting Orchestrator Pipeline execution...');
        const orchestrator = new Orchestrator();
        await orchestrator.runPipeline();
        console.log('[Cloud Run Job] Execution completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('[Cloud Run Job] Execution failed:', error);
        process.exit(1);
    }
})();
