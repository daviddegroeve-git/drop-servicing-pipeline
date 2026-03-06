const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const DatabaseService = require('../services/db');

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { phone } = request.body;
        if (!phone) {
            return response.status(400).json({ error: 'Phone number is required.' });
        }

        const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!adminKey) {
            console.error('[Client-Auth] Missing SUPABASE_SERVICE_ROLE_KEY in .env');
            return response.status(500).json({ error: 'System configuration error. Admin role key missing.' });
        }

        // 1. Verify that this phone number belongs to a known lead
        const db = new DatabaseService();
        const lead = await db.getLeadByPhone(phone);

        if (!lead) {
            return response.status(404).json({ error: 'This phone number is not registered in our system.' });
        }

        // 2. Generate a 6-digit PIN string
        const generatedPassword = Math.floor(100000 + Math.random() * 900000).toString();
        const proxyEmail = `${phone.replace(/\D/g, '')}@client.drop-servicing.local`;

        // 3. Initialize Supabase Admin client
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 4. Create or Update the user
        // We first try to get the user by their email
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) {
            throw new Error(`Failed to list users: ${listError.message}`);
        }

        const existingUser = users.users.find(u => u.email === proxyEmail);

        if (existingUser) {
            // Update password
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                existingUser.id,
                { password: generatedPassword }
            );
            if (updateError) throw updateError;
            console.log(`[Client-Auth] Updated password for existing client: ${phone}`);
        } else {
            // Create new auth user
            const { error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: proxyEmail,
                password: generatedPassword,
                email_confirm: true,
                user_metadata: { phone: phone, name: lead.name }
            });
            if (createError) throw createError;
            console.log(`[Client-Auth] Created new client user: ${phone}`);
        }

        // 5. Send the password via Ultramsg (Reliable Cloud-to-WhatsApp)
        const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
        const token = process.env.ULTRAMSG_TOKEN;

        if (!instanceId || !token) {
            console.error('[Client-Auth] Missing Ultramsg credentials in environment');
            return response.status(500).json({ error: 'System configuration error. WhatsApp credentials missing in Vercel.' });
        }

        const message = `Hello ${lead.name}!\n\nYour temporary password for the ALATLAS Client Dashboard is: *${generatedPassword}*\n\nPlease log in using your phone number to manage your website.`;

        try {
            const waResponse = await axios.post(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
                token: token,
                to: phone.startsWith('+') ? phone : `+${phone}`,
                body: message,
                priority: 10
            });
            console.log(`[Client-Auth] Sent password via Ultramsg to ${phone}`, waResponse.data);
        } catch (waError) {
            console.error(`[Client-Auth] Ultramsg Error:`, waError.response?.data || waError.message);
            const errorDetail = waError.response?.data?.error || waError.message;
            return response.status(500).json({ error: `WhatsApp Error: ${errorDetail}` });
        }

        return response.status(200).json({ success: true, message: 'Password sent successfully.' });

    } catch (error) {
        console.error('[Client-Auth Error]', error.message);
        return response.status(500).json({ success: false, error: error.message });
    }
}
