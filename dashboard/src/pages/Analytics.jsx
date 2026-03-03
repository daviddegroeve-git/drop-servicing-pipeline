import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, CheckCircle, XCircle, RefreshCcw, BarChart3 } from 'lucide-react';
import { motion as M } from 'framer-motion';

const MetricCard = ({ title, value, icon: Icon, color, delay, subtitle }) => (
    <M.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4 }}
        className="bg-surface p-6 rounded-2xl border border-zinc-800 flex items-start gap-4 hover:border-zinc-700 transition-colors"
    >
        <div className={`p-4 rounded-xl ${color} bg-opacity-10 mt-1`}>
            <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        <div>
            <p className="text-sm text-zinc-400 font-medium">{title}</p>
            <h3 className="text-3xl font-bold text-zinc-100 mt-1">{value}</h3>
            {subtitle && <p className="text-xs text-zinc-500 mt-2">{subtitle}</p>}
        </div>
    </M.div>
);

export default function Analytics() {
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMetrics();

        // Refresh every minute
        const interval = setInterval(fetchMetrics, 60000);
        return () => clearInterval(interval);
    }, []);

    async function fetchMetrics() {
        setLoading(true);
        try {
            // Call the custom Supabase RPC function we created
            const { data, error } = await supabase.rpc('get_agent_metrics');

            if (error) throw error;

            // Format existing data and calculate Success Rates
            const formattedData = data.map(agentData => {
                const totalAttempts = Number(agentData.completions) + Number(agentData.failures);
                const successRate = totalAttempts > 0
                    ? Math.round((Number(agentData.completions) / totalAttempts) * 100)
                    : 0;

                return {
                    ...agentData,
                    successRate
                };
            });

            // Sort to ensure a consistent, logical order
            const order = ['orchestrator', 'scout', 'creator', 'publisher', 'closer', 'biller'];
            formattedData.sort((a, b) => order.indexOf(a.agent) - order.indexOf(b.agent));

            setMetrics(formattedData);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading && metrics.length === 0) {
        return <div className="text-zinc-400 animate-pulse">Calculating Agent Metrics...</div>;
    }

    return (
        <div className="space-y-8 pb-10">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-primary" />
                        Agent Analytics
                    </h1>
                    <p className="text-zinc-400 mt-2">
                        Performance metrics across all autonomous AI agents. Track completions, unrectified failures, and self-corrections.
                    </p>
                </div>
                <button
                    onClick={fetchMetrics}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-colors border border-zinc-700"
                >
                    <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Stats
                </button>
            </header>

            {metrics.map((agent, index) => (
                <M.div
                    key={agent.agent}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-black/20 border border-zinc-800/60 rounded-3xl p-6 lg:p-8"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-800/50">
                        <div>
                            <h2 className="text-2xl font-bold text-zinc-100 capitalize flex items-center gap-2">
                                {agent.agent} Agent
                            </h2>
                            <p className="text-zinc-500 text-sm mt-1">
                                Lifetime performance statistics
                            </p>
                        </div>

                        <div className="bg-surface border border-zinc-800 rounded-xl px-6 py-4 flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Success Rate</p>
                                <p className={`text-2xl font-bold ${agent.successRate >= 90 ? 'text-emerald-400' : agent.successRate >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {agent.successRate}%
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <MetricCard
                            title="Total Completions"
                            value={agent.completions}
                            icon={CheckCircle}
                            color="bg-emerald-500"
                            delay={0.1 + (index * 0.1)}
                            subtitle="Successful actions logged by this agent"
                        />
                        <MetricCard
                            title="Unrectified Failures"
                            value={agent.failures}
                            icon={XCircle}
                            color="bg-red-500"
                            delay={0.2 + (index * 0.1)}
                            subtitle="Errors that were never followed by a success for the same lead"
                        />
                        <MetricCard
                            title="Rectified Failures"
                            value={agent.rectified_failures}
                            icon={Activity}
                            color="bg-amber-500"
                            delay={0.3 + (index * 0.1)}
                            subtitle="Errors that the pipeline subsequently recovered from"
                        />
                    </div>
                </M.div>
            ))}

            {metrics.length === 0 && !loading && (
                <div className="text-center py-20 bg-surface rounded-3xl border border-zinc-800">
                    <BarChart3 className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-zinc-300">No Analytics Available</h3>
                    <p className="text-zinc-500 mt-2">The agents haven't generated any logs yet.</p>
                </div>
            )}
        </div>
    );
}
