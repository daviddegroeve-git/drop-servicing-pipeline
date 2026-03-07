import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity } from 'lucide-react';

export default function GlobalStatusBar() {
    const [agentLastActions, setAgentLastActions] = useState({});
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        fetchInitialState();

        // Subscribe to new log insertions
        const channel = supabase
            .channel('public:global_status')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, (payload) => {
                setAgentLastActions(prev => ({
                    ...prev,
                    [payload.new.agent]: payload.new
                }));
            })
            .subscribe();

        const pollInterval = setInterval(() => {
            console.log('[StatusBar] Polling for updates...');
            fetchInitialState();
        }, 30000); // 30s polling fallback

        const refreshInterval = setInterval(() => setNow(Date.now()), 2000); // 2s clock refresh for smoother animations

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
            clearInterval(refreshInterval);
        };
    }, []);

    async function fetchInitialState() {
        try {
            // Fetch the last action for each agent
            const { data, error } = await supabase
                .from('logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            const lastActions = data.reduce((acc, log) => {
                if (!acc[log.agent] || new Date(log.created_at) > new Date(acc[log.agent].created_at)) {
                    acc[log.agent] = log;
                }
                return acc;
            }, {});

            setAgentLastActions(lastActions);
        } catch (e) {
            console.error(e);
        }
    }

    const defaultAgents = ['orchestrator', 'scout', 'creator', 'retoucher', 'publisher', 'closer', 'chatbot'];
    const uniqueAgents = [...new Set([...defaultAgents, ...Object.keys(agentLastActions)])];

    return (
        <div className="flex items-center gap-6 px-6 py-2 bg-[#0a0a0b]/80 border-b border-zinc-800 overflow-x-auto flex-shrink-0 backdrop-blur-md sticky top-0 z-50 w-full shadow-sm">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mr-2 flex items-center gap-1.5 flex-shrink-0">
                <Activity className="w-3 h-3" /> System Status
            </span>
            {uniqueAgents.map(agent => {
                const lastAction = agentLastActions[agent];
                const isError = lastAction?.status === 'error';
                // We define "working" as the last action being an info/warning (an active start action) and less than 50 mins ago (3,000,000 ms)
                const isWorking = lastAction && !isError && lastAction.status !== 'success' && (now - new Date(lastAction.created_at).getTime() < 3000000);

                return (
                    <div key={`led-${agent}`} className="flex flex-shrink-0 items-center gap-2 py-0.5 px-1.5 rounded-md transition-colors cursor-default" title={lastAction?.action || 'Idle'}>
                        <div className="relative flex h-2 w-2">
                            {isError ? (
                                <>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                                </>
                            ) : isWorking ? (
                                <>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                                </>
                            ) : (
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-800 border border-zinc-700"></span>
                            )}
                        </div>
                        <span className={`text-xs font-semibold capitalize tracking-wide ${isError ? 'text-red-400' : isWorking ? 'text-emerald-400' : 'text-zinc-600'}`}>
                            {agent}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
