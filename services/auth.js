const { createClient } = require('@supabase/supabase-js');

/**
 * AuthService
 * Handles background user registration and authentication logic for leads.
 * Uses SUPABASE_SERVICE_ROLE_KEY for admin operations.
 */
class AuthService {
    constructor() {
        this.supabaseUrl = process.env.SUPABASE_URL;
        this.supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!this.supabaseUrl || !this.supabaseAdminKey) {
            throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in environment variables.');
        }

        // Initialize Supabase Admin client
        this.admin = createClient(this.supabaseUrl, this.supabaseAdminKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
    }

    /**
     * Generates a 6-digit numeric PIN
     */
    generatePin() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Standardizes phone number to international format (e.g., 966...)
     */
    formatPhone(phone) {
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('05') && cleaned.length === 10) {
            cleaned = '966' + cleaned.substring(1);
        } else if (cleaned.length === 9 && !cleaned.startsWith('966')) {
            cleaned = '966' + cleaned;
        }
        return cleaned;
    }

    /**
     * Creates a proxy email for the user based on their phone number
     */
    getProxyEmail(phone) {
        const cleanPhone = this.formatPhone(phone);
        return `${cleanPhone}@client.alatlas.local`;
    }

    /**
     * Registers a new lead user or identifies an existing one.
     * Returns the password (PIN) and whether it was a new user.
     * @param {Object} lead - Lead object with name and phone
     */
    async registerLead(lead) {
        const phone = lead.phone;
        const name = lead.name;
        const proxyEmail = this.getProxyEmail(phone);
        const pin = this.generatePin();

        try {
            // Check if user already exists using listUsers (with high perPage to avoid missing users)
            const { data: { users }, error: listError } = await this.admin.auth.admin.listUsers({ perPage: 1000 });
            if (listError) throw listError;

            const existingUser = users.find(u => u.email === proxyEmail);

            if (existingUser) {
                console.log(`[AuthService] User already exists for ${phone}. Updating password...`);
                const { error: updateError } = await this.admin.auth.admin.updateUserById(
                    existingUser.id,
                    { password: pin }
                );
                if (updateError) throw updateError;
                return { pin, isNew: false, userId: existingUser.id };
            } else {
                console.log(`[AuthService] Creating new user account for ${phone}...`);
                const { data: newUser, error: createError } = await this.admin.auth.admin.createUser({
                    email: proxyEmail,
                    password: pin,
                    email_confirm: true,
                    user_metadata: { phone, name }
                });
                if (createError) throw createError;
                return { pin, isNew: true, userId: newUser.user.id };
            }
        } catch (error) {
            console.error(`[AuthService] Registration failed for ${phone}:`, error.message);
            throw error;
        }
    }

    /**
     * Checks if a user already has an account
     */
    async userExists(phone) {
        const proxyEmail = this.getProxyEmail(phone);
        const { data: users, error } = await this.admin.auth.admin.listUsers();
        if (error) return false;
        return users.users.some(u => u.email === proxyEmail);
    }
}

module.exports = new AuthService();
