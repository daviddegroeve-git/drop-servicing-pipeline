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
        const proxyEmail = `${phone.replace(/\D/g, '')}@client.alatlas.local`;

        // 3. Initialize Supabase Admin client
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 4. Create or Update the user
        // We attempt to create the user first. If they exist, we catch the "already registered" error and update.
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: proxyEmail,
            password: generatedPassword,
            email_confirm: true,
            user_metadata: { phone: phone, name: lead.name }
        });

        if (createError) {
            // Check if the error is due to the user already existing
            if (createError.message.includes('already been registered') || createError.status === 422) {
                console.log(`[Client-Auth] User ${proxyEmail} already exists, locating and updating...`);

                // Find the user ID to update them specifically
                // Note: listUsers() returns a batch. For better scale, one might loop through pages, 
                // but for this system, the user is likely in the recent batch or we can filter.
                const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
                    perPage: 100
                });

                if (listError) throw listError;

                const existingUser = usersData.users.find(u => u.email === proxyEmail);
                if (!existingUser) {
                    throw new Error(`User ${proxyEmail} exists but could not be located in the management list.`);
                }

                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                    existingUser.id,
                    { password: generatedPassword }
                );

                if (updateError) throw updateError;
                console.log(`[Client-Auth] Successfully updated password for: ${phone}`);
            } else {
                // If it's a different error, rethrow it
                throw createError;
            }
        } else {
            console.log(`[Client-Auth] Created new client auth user for: ${phone}`);
        }

        // 5. Send the password via Local WhatsApp Service
        const whatsappServiceUrl = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:8080';
        const message = `Hello ${lead.name}! 💎\n\nYour temporary password for the ALATLAS Client Dashboard is: *${generatedPassword}*\n\nPlease log in using your phone number to manage your website.\n\nPortal: https://drop-servicing-pipeline.vercel.app/client-dashboard`;

        try {
            console.log(`[Client-Auth] Sending password to ${phone} via ${whatsappServiceUrl}`);
            const waResponse = await axios.post(`${whatsappServiceUrl}/send`, {
                to: phone,
                message: message
            });
            console.log(`[Client-Auth] Sent password via local service to ${phone}`, waResponse.data);
        } catch (waError) {
            console.error(`[Client-Auth] WhatsApp Service Error:`, waError.response?.data || waError.message);
            const errorDetail = waError.response?.data?.error || waError.message;
            return response.status(500).json({ error: `WhatsApp Error: ${errorDetail}` });
        }

        return response.status(200).json({ success: true, message: 'Password sent successfully.' });

    } catch (error) {
        console.error('[Client-Auth Error]', error.message);
        return response.status(500).json({ success: false, error: error.message });
    }
}
