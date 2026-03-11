require('dotenv').config();
const DatabaseService = require('./services/db');
const ChatbotAgent = require('./agents/chatbot');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function backfillAllTranslations() {
    console.log("Looking for ALL chat logs with missing translations...");
    const db = new DatabaseService();
    const chatbot = new ChatbotAgent();

    if (!chatbot.apiKey) {
        console.error("No API key found.");
        return;
    }

    try {
        let hasMore = true;
        let processedCount = 0;

        while (hasMore) {
            // Find chat logs where translated_message is null and message_in is not null
            // We fetch in small batches to manage memory and API rate limits
            const { data: logs, error: logError } = await db.supabase
                .from('chat_logs')
                .select('*')
                .is('translated_message', null)
                .not('message_in', 'is', null)
                .order('created_at', { ascending: false })
                .limit(20);

            if (logError) {
                console.error("Error fetching logs:", logError.message);
                return;
            }

            if (!logs || logs.length === 0) {
                console.log(`\nFinished! All inbound messages already have translations. Processed total: ${processedCount}`);
                hasMore = false;
                break;
            }

            console.log(`Found a batch of ${logs.length} messages needing translations.`);

            for (const log of logs) {
                console.log(`\nTranslating message ID ${log.id}: "${log.message_in}"`);

                let translatedMsg = null;
                let retryCount = 0;
                let success = false;

                while (!success && retryCount < 3) {
                    try {
                        const translationPrompt = `Translate the following text to English for admin review. If it's already in English or just an emoji/symbol, just return the exact same text. Do not add any conversational filler, just output the translation:\n\n"${log.message_in}"`;
                        const translationResponse = await chatbot.ai.models.generateContent({
                            model: 'gemini-2.5-flash',
                            contents: translationPrompt,
                        });
                        translatedMsg = translationResponse.text.trim();
                        console.log(`Result: "${translatedMsg}"`);
                        success = true;
                    } catch (err) {
                        retryCount++;
                        console.error(`Translation failed (Attempt ${retryCount}/3):`, err.message);
                        if (err.message.includes('429')) {
                            console.log("Rate limited. Waiting 10 seconds before retrying...");
                            await delay(10000);
                        } else {
                            // Wait a bit anyway before retry
                            await delay(3000);
                        }
                    }
                }

                if (!success) {
                    console.log(`Failed to translate message ID ${log.id} after 3 attempts. Skipping for now.`);
                    // We'll mark it with a distinct string so it doesn't get picked up repeatedly in the while loop if it permanently fails
                    translatedMsg = "[Translation Failed]";
                }

                // Update the record
                if (translatedMsg) {
                    const { error: updateError } = await db.supabase
                        .from('chat_logs')
                        .update({ translated_message: translatedMsg })
                        .eq('id', log.id);

                    if (updateError) {
                        console.error(`Failed to save translation for ${log.id}:`, updateError.message);
                    } else {
                        console.log(`Successfully saved translation for ${log.id}`);
                        processedCount++;
                    }
                }

                // Add a bigger base delay to avoid the 429 rate limit (e.g. 15 RPM for free tier)
                console.log("Waiting 5 seconds to respect rate limits...");
                await delay(5000);
            }
        }

    } catch (e) {
        console.error("Script failed:", e);
    }
}

backfillAllTranslations();
