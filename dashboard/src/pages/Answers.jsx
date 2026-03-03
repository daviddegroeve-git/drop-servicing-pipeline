import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MessageSquare, CheckCircle, Edit3, Save, Globe2 } from 'lucide-react';
import { motion as M, AnimatePresence } from 'framer-motion';

const TranslationTooltip = ({ text }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative inline-block ml-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-indigo-400 focus:outline-none transition-colors align-middle"
                title="View English Translation"
            >
                <Globe2 className="w-4 h-4" />
            </button>
            <AnimatePresence>
                {isOpen && text && (
                    <M.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-zinc-800 text-zinc-200 text-xs p-3 rounded-lg border border-zinc-700 shadow-xl z-50 text-left pointer-events-none"
                    >
                        <p className="font-semibold text-indigo-400 mb-1 border-b border-zinc-700/50 pb-1">Translation</p>
                        <p className="whitespace-pre-wrap">{text}</p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-zinc-800"></div>
                    </M.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function Answers() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        fetchPendingLogs();

        const channel = supabase
            .channel('chat_logs_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_logs' }, () => {
                fetchPendingLogs();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    async function fetchPendingLogs() {
        try {
            const { data, error } = await supabase
                .from('chat_logs')
                .select(`
                    id, 
                    message_in, 
                    message_out, 
                    translated_message,
                    status, 
                    created_at, 
                    phone,
                    leads ( name )
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLogs(data || []);
        } catch (e) {
            console.error('Error fetching chat logs:', e);
        } finally {
            setLoading(false);
        }
    }

    async function handleApprove(id) {
        try {
            const { error } = await supabase
                .from('chat_logs')
                .update({ status: 'approved' })
                .eq('id', id);

            if (error) throw error;
            setLogs(logs.filter(log => log.id !== id));
        } catch (e) {
            console.error('Error approving log:', e);
        }
    }

    async function handleSaveCorrection(id) {
        try {
            const { error } = await supabase
                .from('chat_logs')
                .update({
                    status: 'corrected',
                    corrected_text: editValue
                })
                .eq('id', id);

            if (error) throw error;
            setEditingId(null);
            setEditValue('');
            setLogs(logs.filter(log => log.id !== id));
        } catch (e) {
            console.error('Error saving correction:', e);
        }
    }

    return (
        <div className="h-full flex flex-col">
            <header className="mb-6 flex-shrink-0">
                <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-2">
                    <MessageSquare className="h-7 w-7 text-indigo-400" /> AI Training (Answers)
                </h1>
                <p className="text-zinc-400 mt-2 max-w-2xl">
                    Review how the Gemini AI responded to incoming WhatsApp messages.
                    <strong>Approve</strong> good answers, or <strong>Correct</strong> mistakes.
                    Your corrections will be used to train the AI for future conversations!
                </p>
            </header>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 pb-10">
                {loading ? (
                    <div className="text-zinc-500 animate-pulse bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
                        Loading pending replies...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center">
                        <MessageSquare className="h-12 w-12 text-zinc-600 mx-auto mb-4 opacity-50" />
                        <h3 className="text-xl font-medium text-zinc-300">All caught up!</h3>
                        <p className="text-zinc-500 mt-2">No pending AI responses need your review.</p>
                    </div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg transition-all hover:border-zinc-700">

                            {/* Header info */}
                            <div className="bg-zinc-800/50 px-5 py-3 border-b border-zinc-800 flex justify-between items-center">
                                <div>
                                    <span className="font-medium text-zinc-200">
                                        {log.leads?.name || 'Unknown Lead'}
                                    </span>
                                    <span className="text-zinc-500 text-sm ml-3">
                                        Phone: {log.phone?.replace('@c.us', '')}
                                    </span>
                                </div>
                                <span className="text-zinc-500 text-xs text-right">
                                    {new Date(log.created_at).toLocaleString()}
                                </span>
                            </div>

                            {/* Conversation block */}
                            <div className="p-5 space-y-4">
                                {/* Lead's Message */}
                                <div className="flex items-start gap-3">
                                    <div className="bg-zinc-800 pt-2 pb-3 px-4 rounded-2xl rounded-tl-sm text-zinc-300 max-w-[80%] border border-zinc-700/50">
                                        <p className="text-xs text-zinc-500 mb-1 font-medium">Lead asked:</p>
                                        <div className="flex items-start gap-1">
                                            <p className="whitespace-pre-wrap">{log.message_in}</p>
                                            {log.translated_message && log.translated_message !== log.message_in && (
                                                <TranslationTooltip text={log.translated_message} />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* AI's Reply */}
                                <div className="flex items-start gap-3 justify-end">
                                    <div className="bg-indigo-900/30 pt-2 pb-3 px-4 rounded-2xl rounded-tr-sm text-indigo-100 max-w-[80%] border border-indigo-500/30">
                                        <p className="text-xs text-indigo-400 mb-1 font-medium">AI replied:</p>

                                        {editingId === log.id ? (
                                            <div className="mt-2 min-w-[300px]">
                                                <textarea
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="w-full bg-zinc-950 border border-indigo-500/50 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
                                                    placeholder="Type what the AI *should* have said..."
                                                    autoFocus
                                                />
                                                <div className="flex justify-end gap-2 mt-3">
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => handleSaveCorrection(log.id)}
                                                        disabled={!editValue.trim() || editValue === log.message_out}
                                                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-xs font-semibold text-white flex items-center gap-1 transition-colors shadow-lg shadow-indigo-900/20"
                                                    >
                                                        <Save className="h-3.5 w-3.5" /> Save Training
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap">{log.message_out}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action Footer */}
                            {editingId !== log.id && (
                                <div className="px-5 py-3 bg-zinc-950 flex justify-end gap-3 border-t border-zinc-800/80">
                                    <button
                                        onClick={() => {
                                            setEditingId(log.id);
                                            setEditValue(log.message_out);
                                        }}
                                        className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-md transition-colors border border-zinc-700 flex items-center gap-2"
                                    >
                                        <Edit3 className="h-4 w-4" /> Edit & Train
                                    </button>
                                    <button
                                        onClick={() => handleApprove(log.id)}
                                        className="px-4 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
                                    >
                                        <CheckCircle className="h-4 w-4" /> Good Answer
                                    </button>
                                </div>
                            )}

                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
