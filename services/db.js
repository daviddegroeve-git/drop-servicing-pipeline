const { createClient } = require('@supabase/supabase-js');

class DatabaseService {
    constructor() {
        this.supabaseUrl = process.env.SUPABASE_URL;
        this.supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!this.supabaseUrl || !this.supabaseKey) {
            throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY missing in environment variables.');
        }

        this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    }

    /**
     * Upsert a lead into the database. If it exists, it will be updated.
     * @param {Object} lead - The lead object (placeId, name, phone, address, location)
     */
    async upsertLead(lead) {
        const { data, error } = await this.supabase
            .from('leads')
            .upsert({
                place_id: lead.placeId,
                name: lead.name,
                phone: lead.phone,
                address: lead.address,
                lat: lead.location?.lat || null,
                lng: lead.location?.lng || null,
                photos: lead.photos || [],
                updated_at: new Date().toISOString()
            }, { onConflict: 'place_id' })
            .select();

        if (error) {
            console.error(`[DB] Error upserting lead ${lead.placeId}:`, error.message);
            throw error;
        }
        return data[0];
    }

    /**
     * Finds a lead by place_id
     * @param {string} placeId
     * @returns {Promise<Object|null>} The lead or null if not found
     */
    async getLead(placeId) {
        const { data, error } = await this.supabase
            .from('leads')
            .select('*')
            .eq('place_id', placeId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is multiple/no rows returned (no rows in this case)
            console.error(`[DB] Error fetching lead ${placeId}:`, error.message);
            throw error;
        }
        return data || null;
    }

    /**
     * Fetches the next available lead that needs processing.
     * Includes leads that are 'scouted' (new) or interrupted in intermediate states.
     */
    async getPendingLead() {
        const { data, error } = await this.supabase
            .from('leads')
            .select('*')
            .in('status', ['interest_confirmed', 'scouted', 'warming_sent', 'warmed', 'created', 'retouched', 'published'])
            .or('retry_count.lt.3,retry_count.is.null')
            .order('updated_at', { ascending: true })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error(`[DB] Error fetching pending lead:`, error.message);
            throw error;
        }
        return data || null;
    }

    /**
     * Updates the status of a lead and optionally attaches extra data (like HTML or URLs)
     * @param {string} placeId
     * @param {string} newStatus - The new status (scouted, created, published, pitched, error)
     * @param {Object} extraData - Optional. E.g. { website_html: '<html>...', vercel_url: 'https...' }
     */
    async updateLeadStatus(placeId, newStatus, extraData = {}) {
        const updatePayload = {
            status: newStatus,
            updated_at: new Date().toISOString(),
            ...extraData
        };

        const { data, error } = await this.supabase
            .from('leads')
            .update(updatePayload)
            .eq('place_id', placeId)
            .select();

        if (error) {
            console.error(`[DB] Error updating status for lead ${placeId}:`, error.message);
            throw error;
        }

        return data[0];
    }

    /**
     * Fetch a setting from the settings table
     * @param {string} key
     * @returns {Promise<any>} The parsed JSON value of the setting
     */
    async getSetting(key) {
        const { data, error } = await this.supabase
            .from('settings')
            .select('value')
            .eq('key', key)
            .single();

        if (error) {
            console.error(`[DB] Error fetching setting ${key}:`, error.message);
            throw error;
        }
        return data.value;
    }

    /**
     * Insert a log entry into the logs table
     * @param {string} agent - The name of the agent (e.g., 'scout', 'creator')
     * @param {string} action - Action performed
     * @param {string|null} placeId - Optional place_id being worked on
     * @param {Object} details - Optional JSON object with details
     * @param {string} status - 'info', 'success', 'warning', 'error'
     */
    async addLog(agent, action, placeId = null, details = {}, status = 'info') {
        const payload = {
            agent,
            action,
            place_id: placeId,
            details,
            status
        };

        const { error } = await this.supabase
            .from('logs')
            .insert(payload);

        if (error) {
            console.error(`[DB] Failed to insert log for ${agent}:`, error.message);
            // Optionally throw or just fail silently to not block the pipeline
        }
    }

    /**
     * Find a lead using an Ultramsg formatted phone number (e.g. 966501234567@c.us)
     */
    async getLeadByPhone(ultramsgPhone) {
        // purely keep digits
        const cleanPhone = ultramsgPhone.replace(/\D/g, '');
        // Take the last 7 digits to match against the varied Google Places formats (+966 50 123 4567, 050 123 4567, etc.)
        if (cleanPhone.length < 7) return null;

        const last7 = cleanPhone.slice(-7);

        // Fetch all leads since we need to strip formatting to match accurately
        const { data, error } = await this.supabase
            .from('leads')
            .select('*');

        if (error || !data) {
            console.error('[DB] Error searching for lead by phone:', error ? error.message : 'No data');
            return null;
        }

        // Filter in memory to bypass formatting like spaces, hyphens, or parentheses in the DB string
        for (const lead of data) {
            if (lead.phone) {
                const dbCleanPhone = lead.phone.replace(/\D/g, '');
                if (dbCleanPhone.includes(last7) || cleanPhone.includes(dbCleanPhone)) {
                    return lead;
                }
            }
        }

        return null;
    }

    /**
     * Save an inbound chat interaction
     */
    async saveChatLog(placeId, phone, messageIn, messageOut, status = 'pending', translatedMessage = null) {
        const { error } = await this.supabase
            .from('chat_logs')
            .insert({
                place_id: placeId,
                phone: phone,
                message_in: messageIn,
                message_out: messageOut,
                status: status,
                translated_message: translatedMessage
            });

        if (error) {
            console.error('[DB] Error saving chat log:', error.message);
        }
    }

    /**
     * Save only an inbound message (used by webhook)
     */
    async saveInboundChatLog(placeId, phone, messageIn, translatedMessage = null) {
        const { error } = await this.supabase
            .from('chat_logs')
            .insert({
                place_id: placeId,
                phone: phone,
                message_in: messageIn,
                message_out: null,
                status: 'pending',
                translated_message: translatedMessage
            });

        if (error) {
            console.error('[DB] Error saving inbound chat log:', error.message);
        }
    }

    /**
     * Get approved or corrected logs to train the AI
     */
    async getTrainingLogs() {
        const { data, error } = await this.supabase
            .from('chat_logs')
            .select('*')
            .in('status', ['approved', 'corrected'])
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) {
            console.error('[DB] Error fetching training logs:', error.message);
            return [];
        }
        return data;
    }

    /**
     * Fetch the most recent chat log for a given phone number.
     * Used for deduplication against webhook events.
     */
    async getLatestChatLog(phone) {
        const { data, error } = await this.supabase
            .from('chat_logs')
            .select('*')
            .eq('phone', phone)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('[DB] Error fetching latest chat log:', error.message);
            return null;
        }
        return data || null;
    }

    /**
     * Save a unilateral outbound message (e.g. from manual admin typing or webhook)
     */
    async saveOutboundChatLog(placeId, phone, messageOut) {
        const { error } = await this.supabase
            .from('chat_logs')
            .insert({
                place_id: placeId,
                phone: phone,
                message_in: null,
                message_out: messageOut,
                status: 'approved' // Automatically "approved" so it bypasses AI Answers queue but shows in loop
            });

        if (error) {
            console.error('[DB] Error saving outbound chat log:', error.message);
        }
    }

    /**
     * Increment a numeric counter column on a lead
     */
    async incrementLeadMetric(placeId, column) {
        // Fetch current value first
        const { data: lead, error: fetchError } = await this.supabase
            .from('leads')
            .select(column)
            .eq('place_id', placeId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error(`[DB] Error fetching metric for increment:`, fetchError.message);
            return;
        }

        const currentValue = lead ? lead[column] : 0;
        const baseValue = typeof currentValue === 'number' ? currentValue : 0;

        const updatePayload = {};
        updatePayload[column] = baseValue + 1;

        const { error: updateError } = await this.supabase
            .from('leads')
            .update(updatePayload)
            .eq('place_id', placeId);

        if (updateError) {
            console.error(`[DB] Error incrementing metric:`, updateError.message);
        }
    }

    /**
     * Increments the retry count for a lead and logs the last error
     */
    async incrementRetryCount(placeId, errorMessage) {
        // Fetch current retry count
        const { data: lead, error: fetchError } = await this.supabase
            .from('leads')
            .select('retry_count')
            .eq('place_id', placeId)
            .single();

        const currentRetry = lead ? (lead.retry_count || 0) : 0;

        const { error: updateError } = await this.supabase
            .from('leads')
            .update({
                retry_count: currentRetry + 1,
                last_error: errorMessage,
                updated_at: new Date().toISOString()
            })
            .eq('place_id', placeId);

        if (updateError) {
            console.error(`[DB] Error incrementing retry count for ${placeId}:`, updateError.message);
        }
    }

    /**
     * Fetch leads in 'scouted' status that haven't been 'warmed' yet
     * We check the 'logs' table to see if a 'warming_sent' action exists for this place_id.
     */
    async getScoutedLeads(limit = 10) {
        // 1. Get all scouted leads
        const { data: leads, error } = await this.supabase
            .from('leads')
            .select('*')
            .eq('status', 'scouted')
            .order('updated_at', { ascending: true });

        if (error) throw error;

        // 2. Filter for those without a 'warming_sent' log (in memory for simplicity/performance in small sets)
        const finalLeads = [];
        for (const lead of leads) {
            const { data: logs } = await this.supabase
                .from('logs')
                .select('id')
                .eq('place_id', lead.place_id)
                .eq('action', 'warming_sent')
                .limit(1);

            if (!logs || logs.length === 0) {
                finalLeads.push(lead);
            }
            if (finalLeads.length >= limit) break;
        }

        return finalLeads;
    }

    /**
     * Fetch leads in 'pitched' status that haven't received the 19 SAR promo yet
     */
    async getPitchedLeads(limit = 10) {
        // 1. Get pitched leads
        const { data: leads, error } = await this.supabase
            .from('leads')
            .select('*')
            .eq('status', 'pitched')
            .order('updated_at', { ascending: true });

        if (error) throw error;

        // 2. Filter for those without a 'promo_sent' log
        const finalLeads = [];
        for (const lead of leads) {
            const { data: logs } = await this.supabase
                .from('logs')
                .select('id')
                .eq('place_id', lead.place_id)
                .eq('action', 'promo_sent')
                .limit(1);

            if (!logs || logs.length === 0) {
                finalLeads.push(lead);
            }
            if (finalLeads.length >= limit) break;
        }

        return finalLeads;
    }
}

module.exports = DatabaseService;
