import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ExternalLink, Phone, MapPin, Eye, CheckCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Pipeline() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [verificationModal, setVerificationModal] = useState({ isOpen: false, leadId: null, leadName: '', date: '', tier: 'monthly' });

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

    const handleUnlock = async () => {
        if (!verificationModal.date) {
            alert('Please select the payment date before verifying.');
            return;
        }

        try {
            const res = await fetch('/api/unlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: verificationModal.leadId,
                    payment_date: verificationModal.date,
                    tier: verificationModal.tier
                })
            });
            if (!res.ok) throw new Error('Failed to unlock site');
            alert('Site successfully unlocked and subscription started!');
            setVerificationModal({ isOpen: false, leadId: null, leadName: '', date: '', tier: 'monthly' });
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
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}>
                                                {lead.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {lead.status === 'pitched' && (
                                                    <button
                                                        onClick={() => setVerificationModal({
                                                            isOpen: true,
                                                            leadId: lead.place_id,
                                                            leadName: lead.name,
                                                            date: new Date().toISOString().split('T')[0],
                                                            tier: 'monthly'
                                                        })}
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

            {/* Verification Modal with Date Picker */}
            <AnimatePresence>
                {verificationModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl w-full max-w-md p-6"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">Verify Payment</h3>
                                <button onClick={() => setVerificationModal({ isOpen: false, leadId: null, leadName: '', date: '', tier: 'monthly' })} className="text-zinc-500 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-zinc-300 mb-6 font-medium">
                                Confirming payment for: <span className="text-emerald-400">{verificationModal.leadName}</span>
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-1">When was this payment made?</label>
                                    <p className="text-xs text-zinc-500 mb-2">This date will start the 30-day subscription clock and trigger the renewal reminders.</p>
                                    <input
                                        type="date"
                                        value={verificationModal.date}
                                        onChange={(e) => setVerificationModal({ ...verificationModal, date: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    />
                                </div>
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-zinc-400 mb-1">Subscription Tier</label>
                                    <p className="text-xs text-zinc-500 mb-2">Select whether this client paid for Monthly or Yearly.</p>
                                    <select
                                        value={verificationModal.tier}
                                        onChange={(e) => setVerificationModal({ ...verificationModal, tier: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none"
                                    >
                                        <option value="monthly">Monthly Subscription (99 SAR / 30 Days)</option>
                                        <option value="yearly">Yearly Subscription (990 SAR / 365 Days)</option>
                                    </select>
                                </div>
                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg mt-4 text-emerald-300 flex items-start gap-3 text-sm">
                                    <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <div>Verifying changes this lead to `completed`, unlocks their website, and enables automatic WhatsApp billing reminders.</div>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-8">
                                <button
                                    onClick={() => setVerificationModal({ isOpen: false, leadId: null, leadName: '', date: '', tier: 'monthly' })}
                                    className="px-4 py-2 text-zinc-400 hover:text-white transition-colors font-medium border border-transparent"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUnlock}
                                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 outline outline-transparent hover:outline-emerald-500/30 text-emerald-950 font-bold rounded-lg transition-all"
                                >
                                    Confirm & Unlock Site
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
