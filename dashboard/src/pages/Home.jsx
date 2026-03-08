import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Users, Globe2, CheckCircle, Clock, Map as MapIcon, MessageCircle, MessageSquare, Activity, ChevronRight, Languages } from 'lucide-react';
import { motion } from 'framer-motion';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4 }}
        className="bg-surface p-6 rounded-2xl border border-zinc-800 flex items-center gap-4 hover:border-zinc-700 transition-colors shadow-lg"
    >
        <div className={`p-4 rounded-xl ${color} bg-opacity-10`}>
            <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        <div>
            <p className="text-sm text-zinc-400 font-medium">{title}</p>
            <h3 className="text-2xl font-bold text-zinc-100 mt-1">{value}</h3>
        </div>
    </motion.div>
);

export default function Home() {
    const [loading, setLoading] = useState(true);

    // Data states
    const [stats, setStats] = useState({ scouted: 0, created: 0, published: 0, pitched: 0, completed: 0 });
    const [recentLeads, setRecentLeads] = useState([]);
    const [recentChats, setRecentChats] = useState([]);
    const [pendingAnswers, setPendingAnswers] = useState(0);
    const [recentLogs, setRecentLogs] = useState([]);
    const [mapLeads, setMapLeads] = useState([]);
    const [engagementStats, setEngagementStats] = useState({ warming: 0, promo: 0 });
    const [queueSizes, setQueueSizes] = useState({ warming: 0, promotion: 0 });

    useEffect(() => {
        fetchAllData(true);

        // Subscribe to relevant realtime updates
        const leadsSub = supabase.channel('home_leads')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                fetchStatsAndRecentLeads();
                fetchQueueSizes();
            })
            .subscribe();

        const chatSub = supabase.channel('home_chats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_logs' }, () => {
                fetchRecentChats();
                fetchPendingAnswers();
            })
            .subscribe();

        const logsSub = supabase.channel('home_logs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, () => {
                fetchRecentLogs();
                fetchEngagementStats();
                fetchQueueSizes();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(leadsSub);
            supabase.removeChannel(chatSub);
            supabase.removeChannel(logsSub);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchAllData(showLoading = false) {
        if (showLoading) setLoading(true);
        await Promise.all([
            fetchStatsAndRecentLeads(),
            fetchRecentChats(),
            fetchPendingAnswers(),
            fetchRecentLogs(),
            fetchEngagementStats(),
            fetchQueueSizes()
        ]);
        if (showLoading) setLoading(false);
    }

    async function fetchStatsAndRecentLeads() {
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Calculate stats
            const counts = data.reduce((acc, lead) => {
                acc[lead.status] = (acc[lead.status] || 0) + 1;
                return acc;
            }, { scouted: 0, created: 0, published: 0, pitched: 0, completed: 0 });
            setStats(counts);

            // Set Recent Leads (top 5)
            setRecentLeads(data.slice(0, 5));

            // Set Map Leads (top 20 with lat/lng)
            const mapData = data.filter(l => l.lat && l.lng).slice(0, 20);
            setMapLeads(mapData);

        } catch (error) {
            console.error('Error fetching leads:', error);
        }
    }

    async function fetchRecentChats() {
        try {
            const { data, error } = await supabase
                .from('chat_logs')
                .select('id, phone, message_in, message_out, translated_message, created_at, leads(name)')
                .order('created_at', { ascending: false })
                .limit(4);
            if (!error) setRecentChats(data || []);
        } catch (e) {
            console.error(e);
        }
    }

    async function fetchPendingAnswers() {
        try {
            const { count, error } = await supabase
                .from('chat_logs')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            if (!error) setPendingAnswers(count || 0);
        } catch (e) {
            console.error(e);
        }
    }

    async function fetchRecentLogs() {
        try {
            const { data, error } = await supabase
                .from('logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(4);
            if (!error) setRecentLogs(data || []);
        } catch (e) {
            console.error(e);
        }
    }

    async function fetchEngagementStats() {
        try {
            const { count: warming } = await supabase
                .from('logs')
                .select('*', { count: 'exact', head: true })
                .eq('action', 'warming_sent');

            const { count: promo } = await supabase
                .from('logs')
                .select('*', { count: 'exact', head: true })
                .eq('action', 'promo_sent');

            setEngagementStats({ warming: warming || 0, promo: promo || 0 });
        } catch (e) {
            console.error('Error fetching engagement stats:', e);
        }
    }

    async function fetchQueueSizes() {
        try {
            // Warming Queue: Lead status 'scouted' minus those with 'warming_sent' logs
            const { count: scoutedCount } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'scouted');
            const { count: warmingLogs } = await supabase.from('logs').select('*', { count: 'exact', head: true }).eq('action', 'warming_sent');

            // Promotion Queue: Leads with status 'pitched' OR 'published' minus those with 'promo_sent' logs
            const { count: pitchedCount } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'pitched');
            const { count: publishedCount } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'published');
            const { count: promoLogs } = await supabase.from('logs').select('*', { count: 'exact', head: true }).eq('action', 'promo_sent');

            setQueueSizes({
                warming: Math.max(0, (scoutedCount || 0) - (warmingLogs || 0)),
                promotion: Math.max(0, (pitchedCount || 0) + (publishedCount || 0) - (promoLogs || 0))
            });
        } catch (e) {
            console.error('Error fetching queue sizes:', e);
        }
    }

    // Helper formatting
    const getStatusColor = (status) => {
        const colors = {
            scouted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            warmed: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            created: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            published: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
            pitched: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            completed: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
            error: 'bg-red-500/20 text-red-400 border-red-500/30',
        };
        return colors[status] || 'bg-zinc-800 text-zinc-300 border-zinc-700';
    };

    const getMarkerColor = (status) => {
        const colors = { scouted: '#3b82f6', warmed: '#f59e0b', created: '#a855f7', published: '#0ea5e9', pitched: '#10b981', completed: '#6366f1' };
        return colors[status] || '#71717a';
    };

    if (loading && Object.values(stats).every(v => v === 0)) {
        return <div className="text-zinc-400 animate-pulse flex h-full items-center justify-center">Loading comprehensive dashboard...</div>;
    }

    // Determine map center
    const mapCenter = mapLeads.length > 0
        ? { lat: parseFloat(mapLeads[0].lat), lng: parseFloat(mapLeads[0].lng) }
        : { lat: 24.7136, lng: 46.6753 }; // Default Riyadh

    return (
        <div className="space-y-6 pb-10">

            {/* Top Row: Metric Cards */}
            {/* Main Engagement Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard delay={0.1} title="Total Leads Processed" value={stats.scouted + stats.created + stats.published + stats.pitched + stats.completed} icon={Users} color="bg-blue-500" />
                <StatCard delay={0.2} title="Websites Ready" value={stats.published + stats.pitched + stats.completed} icon={Globe2} color="bg-purple-500" />
                <StatCard delay={0.3} title="Pitches & Promos" value={stats.pitched + stats.completed + engagementStats.promo} icon={CheckCircle} color="bg-emerald-500" />
                <StatCard delay={0.4} title="Interest Confirmed" value={engagementStats.warming} icon={Activity} color="bg-amber-500" />
            </div>

            {/* Pipeline Queues (Backlogs) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard delay={0.5} title="Warming Queue (Backlog)" value={queueSizes.warming} icon={Clock} color="bg-zinc-500" />
                <StatCard delay={0.6} title="Promotion Queue (Backlog)" value={queueSizes.promotion} icon={Clock} color="bg-zinc-500" />
            </div>

            {/* Bento Grid layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Col: Pipeline Activity */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="lg:col-span-2 bg-surface p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-500" /> Recent Pipeline Activity
                        </h2>
                        <Link to="/pipeline" className="text-sm text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
                            View all <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-zinc-500 uppercase bg-zinc-900/50">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Business Name</th>
                                    <th className="px-4 py-3">Website</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 rounded-tr-lg text-right">Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentLeads.map((lead) => (
                                    <tr key={lead.place_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                                        <td className="px-4 py-3 font-medium text-zinc-200">{lead.name}</td>
                                        <td className="px-4 py-3">
                                            {lead.vercel_url ? (
                                                <a href={lead.vercel_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate max-w-[150px] inline-block">
                                                    {lead.vercel_url.replace('https://', '')}
                                                </a>
                                            ) : (
                                                <span className="text-zinc-600">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${getStatusColor(lead.status)}`}>
                                                {lead.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-500 text-xs">
                                            {new Date(lead.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {recentLeads.length === 0 && <div className="text-center text-zinc-500 py-6">No leads found in pipeline.</div>}
                    </div>
                </motion.div>

                {/* Right Col Top: Mini Map */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="bg-surface rounded-2xl border border-zinc-800 shadow-xl flex flex-col overflow-hidden relative min-h-[300px]"
                >
                    <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-zinc-950/80 to-transparent z-10 flex justify-between items-start pointer-events-none">
                        <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 drop-shadow-md">
                            <MapIcon className="w-5 h-5 text-emerald-500" /> Live Scout Map
                        </h2>
                        <Link to="/map" className="pointer-events-auto bg-zinc-900/80 backdrop-blur-sm border border-zinc-700 hover:bg-zinc-800 text-xs text-white px-2.5 py-1.5 rounded-md transition-colors shadow-lg">
                            Expand
                        </Link>
                    </div>

                    {GOOGLE_MAPS_API_KEY ? (
                        <div className="flex-1">
                            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                                <GoogleMap
                                    defaultCenter={mapCenter}
                                    defaultZoom={11}
                                    disableDefaultUI={true}
                                    mapId="drop_mini_map"
                                    options={{ zoomControl: false, gestureHandling: 'none' }}
                                >
                                    {mapLeads.map(lead => (
                                        <AdvancedMarker key={lead.place_id} position={{ lat: parseFloat(lead.lat), lng: parseFloat(lead.lng) }}>
                                            <div className="w-3 h-3 rounded-full border border-white/50 shadow-lg shadow-black/50" style={{ backgroundColor: getMarkerColor(lead.status) }} />
                                        </AdvancedMarker>
                                    ))}
                                </GoogleMap>
                            </APIProvider>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-zinc-900/50 p-6 text-center text-sm text-zinc-500">
                            Google Maps API Key required for preview.
                        </div>
                    )}
                </motion.div>

                {/* Bottom Row Col 1: WhatsApp Snippets */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                    className="bg-surface p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col"
                >
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-emerald-500" /> Recent Chats
                        </h2>
                        <Link to="/whatsapp" className="text-zinc-500 hover:text-white transition-colors"><ChevronRight className="w-5 h-5" /></Link>
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                        {recentChats.length === 0 ? (
                            <div className="text-center text-zinc-600 text-sm py-4">No recent messages.</div>
                        ) : (
                            recentChats.map(chat => (
                                <div key={chat.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-zinc-300 truncate">{chat.leads?.name || chat.phone.replace('@c.us', '')}</span>
                                        <span className="text-[10px] text-zinc-500">{new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed flex items-center gap-1.5 overflow-hidden">
                                        {chat.message_in ? (
                                            <span className="text-zinc-500 mr-1 shrink-0">Inbox:</span>
                                        ) : (
                                            <span className="text-emerald-500/80 mr-1 shrink-0">Out:</span>
                                        )}
                                        <span className="truncate flex-1">
                                            {chat.message_in || chat.message_out}
                                        </span>
                                        {chat.message_in && chat.translated_message && chat.translated_message !== chat.message_in && (
                                            <Languages className="w-3 h-3 text-zinc-600 shrink-0" title={`Translation: ${chat.translated_message}`} />
                                        )}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Bottom Row Col 2: AI Training Alert */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                    className="bg-surface p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col justify-between relative overflow-hidden group"
                >
                    <div className={`absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20 ${pendingAnswers > 0 ? 'bg-amber-500' : 'bg-zinc-500'}`} />

                    <div className="relative z-10 flex justify-between items-start">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pendingAnswers > 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
                            <MessageSquare className="w-6 h-6" />
                        </div>
                        <Link to="/answers" className="bg-zinc-900 border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 transition-colors">
                            Manage
                        </Link>
                    </div>

                    <div className="relative z-10 mt-6">
                        <h3 className="text-4xl font-bold text-zinc-100">{pendingAnswers}</h3>
                        <p className="text-sm font-medium mt-1 text-zinc-400">
                            {pendingAnswers > 0 ? (
                                <span className="text-amber-400">AI replies require review</span>
                            ) : (
                                "No pending replies to review"
                            )}
                        </p>
                        <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                            Approve or correct the AI's autonomous responses so it learns your style.
                        </p>
                    </div>
                </motion.div>

                {/* Bottom Row Col 3: System Health / Logs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
                    className="bg-surface p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col"
                >
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-indigo-500" /> System Logs
                        </h2>
                        <Link to="/logs" className="text-zinc-500 hover:text-white transition-colors"><ChevronRight className="w-5 h-5" /></Link>
                    </div>

                    <div className="flex-1 flex flex-col gap-2 font-mono text-xs overflow-hidden relative">
                        {/* Fade out text at the bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface to-transparent z-10 pointer-events-none" />

                        {recentLogs.length === 0 ? (
                            <div className="text-center text-zinc-600 py-4 font-sans">No recent activity.</div>
                        ) : (
                            recentLogs.map(log => (
                                <div key={log.id} className="flex gap-2 text-zinc-400 items-start">
                                    <span className="text-zinc-600 shrink-0">[{new Date(log.created_at).toLocaleTimeString([], { hour12: false })}]</span>
                                    <span className={`px-1.5 rounded shrink-0 ${log.status === 'error' ? 'bg-red-500/20 text-red-400' : log.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        {log.agent}
                                    </span>
                                    <span className="truncate">{log.action}</span>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
