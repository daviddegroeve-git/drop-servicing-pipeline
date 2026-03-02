require('dotenv').config();

const CreatorAgent = require('./agents/creator');
const PublisherAgent = require('./agents/publisher');
const CloserAgent = require('./agents/closer');
const DatabaseService = require('./services/db');

class Orchestrator {
  constructor() {
    this.scout = new ScoutAgent();
    this.creator = new CreatorAgent();
    this.publisher = new PublisherAgent();
    this.closer = new CloserAgent();
    this.db = new DatabaseService();

    // Default queries to cycle through across intervals
    this.queries = [
      'restaurant in Riyadh',
      'auto repair in Riyadh',
      'clinic in Riyadh',
      'barbershop in Riyadh'
    ];
    this.currentQueryIndex = 0;
  }

  /**
   * Executes a single pipeline run
   */
  async runPipeline() {
    const query = this.queries[this.currentQueryIndex];
    console.log('\n======================================================');
    console.log(`[Orchestrator] Starting cycle using query: "${query}"`);
    console.log('======================================================');

    try {
      // Step 1: Scout
      const leads = await this.scout.findLeads(query);

      if (leads.length === 0) {
        console.log('[Orchestrator] No viable leads found this cycle. Will wait until next interval.');
        this.advanceQueryIndex();
        return;
      }

      // We'll iterate through all scouted leads and process the first one that hasn't been pitched yet
      let activeLead = null;

      for (const lead of leads) {
        // Step 1a: Upsert lead into database (marks as scouted by default)
        await this.db.upsertLead(lead);

        // Fetch to check status
        const dbLead = await this.db.getLead(lead.placeId);

        // We only want to process leads that are purely 'scouted'
        // If they are 'created', 'published', or 'pitched', we skip them to avoid spam
        if (dbLead && dbLead.status === 'scouted') {
          activeLead = lead;
          break;
        }
      }

      if (!activeLead) {
        console.log('[Orchestrator] All leads in this batch have already been processed. Moving to next query.');
        this.advanceQueryIndex();
        return;
      }

      console.log(`[Orchestrator] Selected lead: ${activeLead.name} (${activeLead.phone})`);

      // Step 2: Create HTML
      const rawHtml = await this.creator.createWebsite(activeLead);
      await this.db.updateLeadStatus(activeLead.placeId, 'created', { website_html: rawHtml });

      // Step 3: Publish to Vercel
      const liveUrl = await this.publisher.handlePublish(activeLead.name, rawHtml);
      await this.db.updateLeadStatus(activeLead.placeId, 'published', { vercel_url: liveUrl });

      // Step 4: Close (Send WhatsApp text)
      await this.closer.pitchLead(activeLead.name, activeLead.phone, liveUrl);
      await this.db.updateLeadStatus(activeLead.placeId, 'pitched');

      console.log(`[Orchestrator] Successfully completed pipeline for ${activeLead.name}`);

    } catch (error) {
      console.error(`[Orchestrator] Pipeline encountered an error and aborted this cycle.`, error.message);
      // We catch the error so the overall node process doesn't crash,
      // allowing the setInterval to try again naturally.
    }

    this.advanceQueryIndex();
  }

  advanceQueryIndex() {
    this.currentQueryIndex = (this.currentQueryIndex + 1) % this.queries.length;
  }

  /**
   * Starts the cron/interval loop
   */
  startLoop() {
    const intervalMinutes = parseInt(process.env.RUN_INTERVAL_MINUTES || '60', 10);
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`[Orchestrator] Initializing Drop Servicing Pipeline...`);
    console.log(`[Orchestrator] Configured to run every ${intervalMinutes} minutes.`);

    // Run the first pipeline cycle immediately
    this.runPipeline();

    // Set up the interval for future cycles
    setInterval(() => {
      this.runPipeline();
    }, intervalMs);
  }
}

// Instantiate and start
const main = new Orchestrator();
main.startLoop();
