import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ExternalLink, Phone, MapPin, Eye, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Pipeline() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeads();

        const channel = supabase
            .channel('public:leads')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    async function fetchLeads() {
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setLeads(data);
        } catch (error) {
            console.error('Error fetching leads:', error);
        } finally {
            setLoading(false);
        }
    }

    const getStatusColor = (status) => {
        const colors = {
            scouted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            created: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            published: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            pitched: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            completed: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
            error: 'bg-red-500/10 text-red-400 border-red-500/20',
        };
        return colors[status] || 'bg-zinc-800 text-zinc-400 border-zinc-700';
    };

    const handleUnlock = async (id) => {
        if (!confirm('Have you verified the STC Pay transfer on your phone?')) return;

        try {
            const res = await fetch('/api/unlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (!res.ok) throw new Error('Failed to unlock site');
            alert('Site successfully unlocked!');
            fetchLeads(); // Refresh to show completed status
        } catch (error) {
            console.error(error);
            alert('Error unlocking site.');
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-100">Pipeline Directory</h1>
                    <p className="text-zinc-400 mt-1">Recent leads and their current agent status.</p>
                </div>
            </header>

            <div className="bg-surface border border-zinc-800 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-zinc-500 animate-pulse">Loading leads...</div>
                ) : leads.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">No leads found. Check your search queries in Settings.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                                    <th className="p-4 text-sm font-semibold text-zinc-400 font-medium">Business</th>
                                    <th className="p-4 text-sm font-semibold text-zinc-400 font-medium">Contact</th>
                                    <th className="p-4 text-sm font-semibold text-zinc-400 font-medium">Status</th>
                                    <th className="p-4 text-sm font-semibold text-zinc-400 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {leads.map((lead, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        key={lead.place_id}
                                        className="hover:bg-zinc-800/20 transition-colors"
                                    >
                                        <td className="p-4">
                                            <div className="font-medium text-zinc-100">{lead.name}</div>
                                            <div className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                                                <MapPin className="h-3 w-3" />
                                                <span className="truncate max-w-[200px]">{lead.address}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm text-zinc-300 flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-zinc-500" />
                                                {lead.phone}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border \${getStatusColor(lead.status)}`}>
                                                {lead.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {lead.status === 'pitched' && (
                                                    <button
                                                        onClick={() => handleUnlock(lead.place_id)}
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-sm font-medium rounded-lg transition-colors"
                                                    >
                                                        <CheckCircle className="h-4 w-4" /> Verify Payment
                                                    </button>
                                                )}
                                                {lead.vercel_url ? (
                                                    <a
                                                        href={lead.vercel_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg text-zinc-200 transition-colors"
                                                    >
                                                        <Eye className="h-4 w-4" /> Live Site
                                                    </a>
                                                ) : (
                                                    <span className="text-sm text-zinc-600 italic">Processing...</span>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
