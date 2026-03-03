import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { MessageCircle, Search, User, ChevronRight, Hash, Globe2 } from 'lucide-react';
import { motion as M, AnimatePresence } from 'framer-motion';

const TranslationTooltip = ({ text }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative inline-block ml-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-emerald-400 focus:outline-none transition-colors align-middle"
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
                        <p className="font-semibold text-emerald-400 mb-1 border-b border-zinc-700/50 pb-1">Translation</p>
                        <p className="whitespace-pre-wrap">{text}</p>
                        {/* Little triangle arrow pointing down */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-zinc-800"></div>
                    </M.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function WhatsApp() {
    const [threads, setThreads] = useState([]);
    const [activeThread, setActiveThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const messagesEndRef = useRef(null);

    // Fetch unique threads on load
    useEffect(() => {
        fetchThreads();

        // Subscribe to real-time chat log changes
        const channel = supabase
            .channel('whatsapp_inbox')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_logs' }, () => {
                fetchThreads();
                if (activeThread) {
                    fetchMessages(activeThread.phone);
                }
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [activeThread]);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    async function fetchThreads() {
        try {
            // Get all chat logs sorted by newest first
            const { data, error } = await supabase
                .from('chat_logs')
                .select(`
                    id, 
                    phone, 
                    message_in, 
                    message_out, 
                    translated_message,
                    created_at,
                    leads ( name )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Group by phone number to create unique threads
            const uniqueThreads = [];
            const seenPhones = new Set();

            data.forEach(log => {
                if (!seenPhones.has(log.phone)) {
                    seenPhones.add(log.phone);
                    uniqueThreads.push({
                        phone: log.phone,
                        name: log.leads?.name || 'Unknown Lead',
                        lastMessage: log.message_in || log.message_out || 'Interaction recorded',
                        lastTime: log.created_at,
                        isLastInbound: !!log.message_in
                    });
                }
            });

            setThreads(uniqueThreads);
        } catch (e) {
            console.error('Error fetching WhatsApp threads:', e);
        } finally {
            setLoading(false);
        }
    }

    async function fetchMessages(phone) {
        if (!phone) return;
        try {
            const { data, error } = await supabase
                .from('chat_logs')
                .select('*')
                .eq('phone', phone)
                .order('created_at', { ascending: true }); // Chronological

            if (error) throw error;
            setMessages(data || []);
        } catch (e) {
            console.error('Error fetching messages:', e);
        }
    }

    const handleSelectThread = (thread) => {
        setActiveThread(thread);
        fetchMessages(thread.phone);
    };

    const filteredThreads = threads.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.phone.includes(searchQuery)
    );

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDateIndicator = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    };

    // Helper to render alternating message bubbles from a single db row
    const renderMessageLog = (log) => {
        const bubbles = [];

        // 1. If there's an outbound message (sent by us/AI)
        if (log.message_out) {
            bubbles.push(
                <div key={`out-${log.id}`} className="flex justify-end mb-4">
                    <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[75%] shadow-sm">
                        <p className="whitespace-pre-wrap text-[15px]">{log.message_out}</p>
                        <div className="text-right mt-1">
                            <span className="text-[11px] text-emerald-200">{formatTime(log.created_at)}</span>
                        </div>
                    </div>
                </div>
            );
        }

        // 2. If there's an inbound message (sent by lead)
        if (log.message_in) {
            bubbles.push(
                <div key={`in-${log.id}`} className="flex justify-start mb-4">
                    <div className="bg-zinc-800 text-zinc-200 border border-zinc-700/50 px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[75%] shadow-sm relative">
                        <div className="flex items-start gap-1">
                            <p className="whitespace-pre-wrap text-[15px]">{log.message_in}</p>
                            {log.translated_message && log.translated_message !== log.message_in && (
                                <TranslationTooltip text={log.translated_message} />
                            )}
                        </div>
                        <div className="text-right mt-1">
                            <span className="text-[11px] text-zinc-500">{formatTime(log.created_at)}</span>
                        </div>
                    </div>
                </div>
            );
        }

        return bubbles;
    };

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col -m-6"> {/* Negative margin to bleed edges if needed, or adjust padding */}

            {/* Header */}
            <header className="px-8 pt-6 pb-4 flex-shrink-0 border-b border-zinc-800 bg-surface z-10">
                <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-2">
                    <MessageCircle className="h-7 w-7 text-emerald-500" /> WhatsApp Inbox
                </h1>
                <p className="text-zinc-400 mt-1">View comprehensive chat histories between your AI and potential leads.</p>
            </header>

            {/* Main 2-Pane Container */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left Pane: Thread List */}
                <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-zinc-800 bg-zinc-900/30 flex flex-col">

                    {/* Search Bar */}
                    <div className="p-4 border-b border-zinc-800">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Search names or numbers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Threads */}
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-500 text-sm animate-pulse">Loading conversations...</div>
                        ) : filteredThreads.length === 0 ? (
                            <div className="p-8 text-center text-zinc-600 text-sm">No conversations found.</div>
                        ) : (
                            <div className="divide-y divide-zinc-800/50">
                                {filteredThreads.map((thread) => (
                                    <button
                                        key={thread.phone}
                                        onClick={() => handleSelectThread(thread)}
                                        className={`w-full text-left p-4 hover:bg-zinc-800/50 transition-colors ${activeThread?.phone === thread.phone ? 'bg-zinc-800/80 border-l-2 border-emerald-500' : 'border-l-2 border-transparent'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-zinc-200 truncate pr-2">{thread.name}</span>
                                            <span className="text-xs text-zinc-500 whitespace-nowrap mt-0.5">{formatTime(thread.lastTime)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1.5">
                                            <Hash className="w-3 h-3" /> {thread.phone.replace('@c.us', '')}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {thread.isLastInbound ? (
                                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                            )}
                                            <p className="text-sm text-zinc-400 truncate">{thread.lastMessage}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Pane: Conversation History */}
                <div className="flex-1 flex flex-col bg-zinc-950 relative">
                    {/* WhatsApp Doodles Background (Optional subtle texture) */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4ade80 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                    {activeThread ? (
                        <>
                            {/* Active Chat Header */}
                            <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center gap-4 z-10 shrink-0 shadow-sm">
                                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                                    <User className="w-5 h-5 text-zinc-400" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-zinc-100">{activeThread.name}</h2>
                                    <p className="text-xs text-zinc-400">{activeThread.phone.replace('@c.us', '')}</p>
                                </div>
                            </div>

                            {/* Chat Messages Area */}
                            <div className="flex-1 p-6 overflow-y-auto relative z-10">
                                {messages.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-zinc-600">No messages loaded.</div>
                                ) : (
                                    <div className="max-w-3xl mx-auto flex flex-col">

                                        {/* Optional: Add a top date badge representing the start of the log */}
                                        <div className="flex justify-center mb-6">
                                            <div className="bg-zinc-800/80 backdrop-blur-sm text-zinc-400 text-[10px] font-medium uppercase tracking-wider px-3 py-1 rounded-full border border-zinc-700/50 shadow-sm">
                                                {formatDateIndicator(messages[0]?.created_at)}
                                            </div>
                                        </div>

                                        {messages.map((log) => (
                                            <div key={log.id}>
                                                {renderMessageLog(log)}
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* In the future: Text Input could go here if manual reply is added */}
                            <div className="p-4 bg-zinc-900 border-t border-zinc-800 z-10 shrink-0 text-center text-xs text-zinc-600">
                                🔒 Read-only view. The Chatbot AI manages these conversations autonomously.
                            </div>
                        </>
                    ) : (
                        // Empty State
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 z-10">
                            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 shadow-xl border border-zinc-800">
                                <MessageCircle className="w-10 h-10 text-emerald-500/50" />
                            </div>
                            <h2 className="text-2xl font-bold text-zinc-200 mb-2">WhatsApp Inbox</h2>
                            <p className="text-zinc-500 max-w-sm">Select a thread from the left sidebar to view the full conversation history between the lead and the AI.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
