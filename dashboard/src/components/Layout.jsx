import { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, Settings, Zap, Globe } from 'lucide-react';

const Layout = () => {
    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Overview' },
        { to: '/pipeline', icon: Users, label: 'Pipeline' },
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

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-zinc-800 flex flex-col">
                <div className="p-6 border-b border-zinc-800">
                    <Link to="/" className="flex flex-col gap-1 transition-opacity hover:opacity-80">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            Drop Servicing
                        </h1>
                        <p className="text-xs text-zinc-500 ml-7">SaaS Pipeline Dashboard</p>
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
                        className={`w-full py-3 px-4 ${triggering ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-blue-600'} text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20`}
                    >
                        <Zap className={`h-4 w-4 fill-current ${triggering ? 'animate-pulse' : ''}`} />
                        {triggering ? 'Launching...' : 'Trigger Pipeline'}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-[#0a0a0b] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.1),rgba(255,255,255,0))]">
                <div className="p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
