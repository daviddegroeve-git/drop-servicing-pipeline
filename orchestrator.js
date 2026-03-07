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
    this.isRunning = false;
    this.axios = require('axios');
  }

  /**
   * Executes a single pipeline run
   */
  async runPipeline() {
    if (this.isRunning) {
      console.log('[Orchestrator] Cycle already in progress. Skipping.');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    const promotionMode = process.env.PROMOTION_MODE === 'true';

    console.log('\n======================================================');
    console.log(`[Orchestrator] Starting cycle (Promotion Mode: ${promotionMode})`);
    console.log('======================================================');
    await this.db.addLog('orchestrator', 'cycle_start', null, { promotionMode }, 'info');

    try {
      // Step 0: Check Subscriptions
      await this.biller.checkSubscriptions();

      // Step 1: Scouting or Warming/Promotion
      if (!promotionMode) {
        let queries;
        try {
          queries = await this.db.getSetting('search_queries');
        } catch (e) {
          queries = ['restaurant in Riyadh', 'barbershop in Riyadh'];
        }
        const query = queries[Math.floor(Math.random() * queries.length)];
        console.log(`[Orchestrator] Scouting for leads matching "${query}"`);
        await this.db.addLog('scout', 'search_started', null, { query }, 'info');
        const leads = await this.scout.findLeads(query);
        for (const lead of leads) {
          await this.db.upsertLead(lead);
        }
        await this.db.addLog('scout', 'search_completed', null, { found: leads.length, query }, 'success');
      } else {
        console.log('[Orchestrator] Scouting DISABLED in Promotion Mode (Cost Shield ACTIVE 🛡️)');
        // Prioritize already-pitched leads (who have a website) to use the 1 week free trial
        await this.runPromotionCycle();
        await this.runWarmingCycle();
      }

      // Step 2: Process intermediate leads (backlog)
      let activeDbLead = await this.db.getPendingLead();

      while (activeDbLead) {
        // If in promotion mode, we SKIP leads that are just 'scouted' to avoid auto-generation costs.
        if (promotionMode && activeDbLead.status === 'scouted') {
          console.log(`[Orchestrator] Skipping auto-generation for ${activeDbLead.name} (Waiting for Warming)`);
          break; // Exit queue processing for this cycle to save costs
        }

        const elapsedSeconds = (Date.now() - startTime) / 1000;
        if (elapsedSeconds > 3000) break;

        const activeLead = {
          name: activeDbLead.name,
          phone: activeDbLead.phone,
          placeId: activeDbLead.place_id,
          address: activeDbLead.address,
          location: { lat: activeDbLead.lat, lng: activeDbLead.lng },
          photos: activeDbLead.photos || []
        };

        console.log(`\n[Orchestrator] Selected lead: ${activeLead.name}`);

        try {
          if (activeDbLead.status !== 'pitched') {
            const health = await this.axios.get('http://localhost:8080/health');
            if (!health.data.ready) throw new Error('WhatsApp not ready');
          }

          let currentHtml = activeDbLead.website_html || '';
          let vercelUrl = activeDbLead.vercel_url || '';

          if (activeDbLead.status === 'scouted') {
            await this.db.addLog('creator', 'generation_started', activeLead.placeId, { name: activeLead.name }, 'info');
            currentHtml = await this.creator.createWebsite(activeLead, this.db);
            await this.db.updateLeadStatus(activeLead.placeId, 'created', { website_html: currentHtml });
          }

          if (activeDbLead.status === 'scouted' || activeDbLead.status === 'created') {
            await this.db.addLog('retoucher', 'audit_started', activeLead.placeId, { name: activeLead.name }, 'info');
            currentHtml = await this.retoucher.retouchWebsite(currentHtml, activeLead);
            await this.db.updateLeadStatus(activeLead.placeId, 'retouched', { website_html: currentHtml });
          }

          if (activeDbLead.status === 'scouted' || activeDbLead.status === 'created' || activeDbLead.status === 'retouched') {
            await this.db.addLog('publisher', 'deployment_started', activeLead.placeId, {}, 'info');
            vercelUrl = await this.publisher.handlePublish(activeLead.placeId);
            await this.db.updateLeadStatus(activeLead.placeId, 'published', { vercel_url: vercelUrl });
          }

          if (activeDbLead.status !== 'pitched') {
            await this.db.addLog('closer', 'pitch_started', activeLead.placeId, { phone: activeLead.phone }, 'info');
            await this.closer.pitchLead(activeLead.name, activeLead.phone, vercelUrl, this.db);
            await this.db.updateLeadStatus(activeLead.placeId, 'pitched');
            console.log('[Orchestrator] Throttling for 20s...');
            await new Promise(resolve => setTimeout(resolve, 20000));
          }

          await this.db.addLog('orchestrator', 'cycle_success', activeLead.placeId, { name: activeLead.name }, 'success');
        } catch (innerError) {
          console.error(`[Orchestrator] Failed lead ${activeLead.name}:`, innerError.message);
          await this.db.addLog('orchestrator', 'lead_error', activeLead.placeId, { message: innerError.message }, 'error');
          await this.db.incrementRetryCount(activeLead.placeId, innerError.message);
        }

        activeDbLead = await this.db.getPendingLead();
      }

      console.log('[Orchestrator] Cycle finished.');
    } catch (error) {
      console.error(`[Orchestrator] Cycle Aborted:`, error.message);
      await this.db.addLog('orchestrator', 'cycle_error', null, { message: error.message }, 'error');
    } finally {
      this.isRunning = false;
    }
  }

  async runWarmingCycle() {
    console.log('[Orchestrator] Running Lead Warming Cycle...');
    const leads = await this.db.getScoutedLeads(15);
    for (const lead of leads) {
      try {
        const success = await this.closer.warmLead(lead.name, lead.phone);
        if (success) {
          await this.db.addLog('closer', 'warming_sent', lead.place_id, { name: lead.name }, 'success');
        }
        await new Promise(r => setTimeout(r, 10000));
      } catch (e) {
        console.error(`[Orchestrator] Warming failed for ${lead.name}:`, e.message);
      }
    }
  }

  async runPromotionCycle() {
    console.log('[Orchestrator] Running 19 SAR Promotion Cycle...');
    const leads = await this.db.getPitchedLeads(15);
    for (const lead of leads) {
      try {
        const success = await this.closer.sendPromotion(lead.name, lead.phone, lead.vercel_url);
        if (success) {
          await this.db.addLog('closer', 'promo_sent', lead.place_id, { name: lead.name }, 'success');
        }
        await new Promise(r => setTimeout(r, 10000));
      } catch (e) {
        console.error(`[Orchestrator] Promo failed for ${lead.name}:`, e.message);
      }
    }
  }

  startLoop() {
    const intervalMinutes = parseInt(process.env.RUN_INTERVAL_MINUTES || '60', 10);
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`[Orchestrator] Initializing ALATLAS Intelligence Pipeline...`);
    this.runPipeline();
    setInterval(() => this.runPipeline(), intervalMs);
  }
}

module.exports = Orchestrator;

if (require.main === module) {
  const main = new Orchestrator();
  main.startLoop();
}
