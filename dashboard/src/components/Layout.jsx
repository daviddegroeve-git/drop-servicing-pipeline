import { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, Settings, Zap, Globe, Map as MapIcon, MessageSquare, BarChart3, MessageCircle, LogOut } from 'lucide-react';
import GlobalStatusBar from './GlobalStatusBar';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

const Layout = () => {
    const { user } = useAuth();
    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Overview' },
        { to: '/pipeline', icon: Users, label: 'Pipeline' },
        { to: '/map', icon: MapIcon, label: 'Map' },
        { to: '/answers', icon: MessageSquare, label: 'Answers' },
        { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp Inbox' },
        { to: '/analytics', icon: BarChart3, label: 'Analytics' },
        { to: '/websites', icon: Globe, label: 'Live Sites' },
        { to: '/logs', icon: Activity, label: 'Live Logs' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ];

    const [triggering, setTriggering] = useState(false);

    const handleTrigger = async () => {
        if (triggering) return;
        setTriggering(true);
        try {
            // Call the Vercel serverless function directly
            const res = await fetch('/api/trigger', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to trigger');
            alert('🚀 Manual agent cycle launched! Switch to the Live Logs tab to watch the magic happen.');
        } catch (e) {
            console.error(e);
            alert('❌ Failed to trigger pipeline manually. Ensure your backend is running.');
        } finally {
            setTriggering(false);
        }
    };

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error logging out:', error.message);
    };

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-zinc-800 flex flex-col">
                <div className="p-6 border-b border-zinc-800">
                    <Link to="/" className="flex flex-col gap-1 transition-opacity hover:opacity-80">
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="ALATLAS" className="h-8 w-8 object-contain" />
                            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent italic tracking-tighter">
                                ALATLAS
                            </h1>
                        </div>
                        <p className="text-[10px] text-zinc-500 ml-11 uppercase tracking-[0.2em] font-bold">Intelligence Ops</p>
                    </Link>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                    ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                                }`
                            }
                        >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-zinc-800">
                    <button
                        onClick={handleTrigger}
                        disabled={triggering}
                        className={`w-full py-3 px-4 ${triggering ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-blue-600'} text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 mb-4`}
                    >
                        <Zap className={`h-4 w-4 fill-current ${triggering ? 'animate-pulse' : ''}`} />
                        {triggering ? 'Launching...' : 'Trigger Pipeline'}
                    </button>

                    <div className="pt-4 border-t border-zinc-800">
                        <div className="flex items-center gap-3 px-2 mb-4">
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-zinc-100 truncate">{user?.email}</p>
                                <p className="text-[10px] text-zinc-500">Administrator</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-200"
                        >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-[#0a0a0b] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.1),rgba(255,255,255,0))] relative flex flex-col">
                <GlobalStatusBar />
                <div className="p-8 max-w-7xl mx-auto flex-1 w-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
