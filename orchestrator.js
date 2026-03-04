require('dotenv').config();

const CreatorAgent = require('./agents/creator');
const RetoucherAgent = require('./agents/retoucher');
const PublisherAgent = require('./agents/publisher');
const CloserAgent = require('./agents/closer');
const BillerAgent = require('./agents/biller');
const DatabaseService = require('./services/db');

const ScoutAgent = require('./agents/scout');

class Orchestrator {
  constructor() {
    this.scout = new ScoutAgent();
    this.creator = new CreatorAgent();
    this.retoucher = new RetoucherAgent();
    this.publisher = new PublisherAgent();
    this.closer = new CloserAgent();
    this.biller = new BillerAgent();
    this.db = new DatabaseService();
  }

  /**
   * Executes a single pipeline run
   */
  async runPipeline() {
    // Fetch active search queries from the Supabase settings table, 
    // with a fallback to defaults if database row is missing.
    let queries;
    try {
      queries = await this.db.getSetting('search_queries');
    } catch (e) {
      queries = ['restaurant in Riyadh', 'barbershop in Riyadh'];
    }

    // randomly select a query instead of sequential counting
    const randomIndex = Math.floor(Math.random() * queries.length);
    const query = queries[randomIndex];

    console.log('\n======================================================');
    console.log(`[Orchestrator] Starting cycle using query: "${query}"`);
    console.log('======================================================');
    await this.db.addLog('orchestrator', 'cycle_start', null, { query }, 'info');

    try {
      // Step 0: Check Subscriptions and send out reminders
      await this.biller.checkSubscriptions();

      // Step 1: Scout
      console.log(`[Orchestrator] Scouting for leads matching "${query}"`);
      await this.db.addLog('scout', 'search_started', null, { query }, 'info');
      const leads = await this.scout.findLeads(query);

      if (leads.length === 0) {
        console.log('[Orchestrator] No viable leads found this cycle. Will wait until next interval.');
        await this.db.addLog('scout', 'search_completed', null, { found: 0, query }, 'warning');
        return;
      }

      await this.db.addLog('scout', 'search_completed', null, { found: leads.length, query }, 'success');

      // Step 1a: Upsert all valid scouted leads into the database
      for (const lead of leads) {
        await this.db.upsertLead(lead);
      }

      // Step 1b: Fetch the next pending lead from the database to process, oldest first
      const activeDbLead = await this.db.getPendingLead();

      if (!activeDbLead) {
        console.log('[Orchestrator] All leads have already been processed or are problematic.');
        await this.db.addLog('orchestrator', 'batch_skipped', null, { reason: 'No viable leads in backlog' }, 'warning');
        return;
      }

      // Format it to match the activeLead object structure normally returned by the scout
      const activeLead = {
        name: activeDbLead.name,
        phone: activeDbLead.phone,
        placeId: activeDbLead.place_id,
        address: activeDbLead.address,
        location: { lat: activeDbLead.lat, lng: activeDbLead.lng },
        photos: activeDbLead.photos || []
      };

      console.log(`[Orchestrator] Selected lead: ${activeLead.name} (${activeLead.phone})`);
      await this.db.addLog('orchestrator', 'lead_selected', activeLead.placeId, { name: activeLead.name, phone: activeLead.phone }, 'info');

      // Step 2: Create HTML
      try {
        await this.db.addLog('creator', 'generation_started', activeLead.placeId, { name: activeLead.name }, 'info');
        const rawHtml = await this.creator.createWebsite(activeLead, this.db);
        await this.db.addLog('creator', 'website_generated', activeLead.placeId, { length: rawHtml.length }, 'success');
        await this.db.updateLeadStatus(activeLead.placeId, 'created', { website_html: rawHtml });

        // Step 2.5: Retouch HTML
        await this.db.addLog('retoucher', 'audit_started', activeLead.placeId, { name: activeLead.name }, 'info');
        const finalHtml = await this.retoucher.retouchWebsite(rawHtml, activeLead);
        await this.db.addLog('retoucher', 'audit_completed', activeLead.placeId, { length: finalHtml.length }, 'success');
        await this.db.updateLeadStatus(activeLead.placeId, 'retouched', { website_html: finalHtml });

        // Step 3: Publish to Vercel (Dynamic Generation)
        await this.db.addLog('publisher', 'deployment_started', activeLead.placeId, {}, 'info');
        const liveUrl = await this.publisher.handlePublish(activeLead.placeId);
        await this.db.addLog('publisher', 'deployment_success', activeLead.placeId, { url: liveUrl }, 'success');
        await this.db.updateLeadStatus(activeLead.placeId, 'published', { vercel_url: liveUrl });

        // Step 4: Close (Send WhatsApp text)
        await this.db.addLog('closer', 'pitch_started', activeLead.placeId, { phone: activeLead.phone }, 'info');
        await this.closer.pitchLead(activeLead.name, activeLead.phone, liveUrl, this.db);
        await this.db.addLog('closer', 'pitch_sent', activeLead.placeId, { url: liveUrl }, 'success');
        await this.db.updateLeadStatus(activeLead.placeId, 'pitched');

        console.log(`[Orchestrator] Successfully completed pipeline for ${activeLead.name}`);
        await this.db.addLog('orchestrator', 'cycle_success', activeLead.placeId, { name: activeLead.name }, 'success');

      } catch (innerError) {
        console.error(`[Orchestrator] Failed to process lead ${activeLead.name}:`, innerError.message);
        await this.db.addLog('orchestrator', 'lead_error', activeLead.placeId, { message: innerError.message }, 'error');
        // Increment retry count so this lead doesn't block the queue forever
        await this.db.incrementRetryCount(activeLead.placeId, innerError.message);
      }

    } catch (error) {
      console.error(`[Orchestrator] Pipeline encountered an error and aborted this cycle.`, error.message);
      await this.db.addLog('orchestrator', 'cycle_error', null, { message: error.message }, 'error');
    }
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

module.exports = Orchestrator;

// Only instantiate and start the loop if this script is executed directly via CLI
if (require.main === module) {
  const main = new Orchestrator();
  main.startLoop();
}
