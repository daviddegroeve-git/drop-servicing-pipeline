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

        // We only care about pitched or completed leads since they are the ones receiving messages
        const { data, error } = await this.supabase
            .from('leads')
            .select('*')
            .in('status', ['pitched', 'completed'])
            .ilike('phone', `%${last7}%`);

        if (error) {
            console.error('[DB] Error searching for lead by phone:', error.message);
            return null;
        }

        // Secondary filter in memory to ensure it really matches avoiding basic collisions
        for (const lead of data) {
            const dbCleanPhone = lead.phone.replace(/\D/g, '');
            if (cleanPhone.includes(dbCleanPhone) || dbCleanPhone.includes(cleanPhone)) {
                return lead;
            }
        }

        // Fallback for safety
        return data.length > 0 ? data[0] : null;
    }

    /**
     * Save an inbound chat interaction
     */
    async saveChatLog(placeId, phone, messageIn, messageOut, status = 'pending') {
        const { error } = await this.supabase
            .from('chat_logs')
            .insert({
                place_id: placeId,
                phone: phone,
                message_in: messageIn,
                message_out: messageOut,
                status: status
            });

        if (error) {
            console.error('[DB] Error saving chat log:', error.message);
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
}

module.exports = DatabaseService;
