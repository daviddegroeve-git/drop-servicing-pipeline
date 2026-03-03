import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Loader2, Info } from 'lucide-react';
import { motion as M } from 'framer-motion';

export default function Settings() {
    const [settings, setSettings] = useState({});
    const [descriptions, setDescriptions] = useState({});
    const [loading, setLoading] = useState(true);
    const [savingKeys, setSavingKeys] = useState({});

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings() {
        try {
            const { data, error } = await supabase.from('settings').select('*');
            if (error) throw error;

            const configMap = {};
            const descMap = {};
            data.forEach(item => {
                // Pretty print JSON for the textarea
                configMap[item.key] = JSON.stringify(item.value, null, 2);
                descMap[item.key] = item.description;
            });

            setSettings(configMap);
            setDescriptions(descMap);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const handleSave = async (key) => {
        setSavingKeys({ ...savingKeys, [key]: true });
        try {
            // Parse back to JSON before saving
            const parsedValue = JSON.parse(settings[key]);

            const { error } = await supabase
                .from('settings')
                .update({ value: parsedValue, updated_at: new Date().toISOString() })
                .eq('key', key);

            if (error) throw error;
        } catch (e) {
            alert(`Error saving \${key}: \${e.message}\\n\\nMake sure your input is valid JSON.`);
        } finally {
            setSavingKeys({ ...savingKeys, [key]: false });
        }
    };

    if (loading) return <div className="text-zinc-500 animate-pulse">Loading settings...</div>;

    return (
        <div className="space-y-6 max-w-4xl">
            <header>
                <h1 className="text-3xl font-bold text-zinc-100">Agent Configuration</h1>
                <p className="text-zinc-400 mt-1">Fine-tune the behavior of your Drop Servicing pipeline.</p>
            </header>

            <div className="space-y-8">
                {Object.entries(settings).map(([key, value], i) => (
                    <M.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={key}
                        className="bg-surface border border-zinc-800 rounded-2xl p-6"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-200 capitalize flex items-center gap-2">
                                    {key.replace('_', ' ')}
                                </h3>
                                <p className="text-sm text-zinc-400 mt-1 flex items-start gap-1">
                                    <Info className="h-4 w-4 mt-0.5 shrink-0 text-zinc-500" />
                                    {descriptions[key]}
                                </p>
                            </div>
                            <button
                                onClick={() => handleSave(key)}
                                disabled={savingKeys[key]}
                                className="inline-flex items-center justify-center rounded-xl bg-zinc-800 py-2 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                            >
                                {savingKeys[key] ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Save</>}
                            </button>
                        </div>

                        <textarea
                            className="w-full h-48 bg-background border border-zinc-800 rounded-xl p-4 text-zinc-300 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-y"
                            value={value}
                            onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                            spellCheck="false"
                        />
                    </M.div>
                ))}
            </div>
        </div>
    );
}
