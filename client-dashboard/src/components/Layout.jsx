import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import {
    Layout as LayoutIcon,
    User,
    CreditCard,
    LogOut,
    Menu,
    X,
    Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navigation = [
    { name: 'My Website', href: '/my-website', icon: Globe },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Payment', href: '/payment', icon: CreditCard },
];

export default function Layout() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[#0a0c10] flex">
            {/* Sidebar - Desktop */}
            <aside className="hidden lg:flex w-72 flex-col bg-[#11141b] border-r border-zinc-800/60 p-6">
                <div className="flex items-center gap-3 px-2 mb-10">
                    <img src="/logo.png" alt="ALATLAS" className="h-10 w-10 object-contain" />
                    <div>
                        <h2 className="text-xl font-black text-white italic tracking-tighter">ALATLAS</h2>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Client Portal</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-1.5">
                    {navigation.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                                }`
                            }
                        >
                            <item.icon className="h-5 w-5" />
                            <span className="font-medium">{item.name}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-auto pt-6 border-t border-zinc-800/60">
                    <div className="bg-black/20 rounded-2xl p-4 flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                            <User className="h-5 w-5 text-zinc-400" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-zinc-100 truncate">{user?.email?.split('@')[0]}</p>
                            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200 group"
                    >
                        <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#11141b]/80 backdrop-blur-lg border-b border-zinc-800 z-50 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="ALATLAS" className="h-8 w-8 object-contain" />
                    <span className="font-bold text-white tracking-tighter italic">ALATLAS</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-zinc-400 hover:text-white transition-colors"
                >
                    {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: -100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        className="lg:hidden fixed inset-0 top-16 bg-[#11141b] z-40 p-6 flex flex-col"
                    >
                        <nav className="space-y-2">
                            {navigation.map((item) => (
                                <NavLink
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'text-zinc-400'
                                        }`
                                    }
                                >
                                    <item.icon className="h-6 w-6" />
                                    <span className="text-lg font-medium">{item.name}</span>
                                </NavLink>
                            ))}
                        </nav>
                        <button
                            onClick={handleLogout}
                            className="mt-auto flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-400 border border-zinc-800"
                        >
                            <LogOut className="h-6 w-6" />
                            <span className="text-lg font-medium">Sign Out</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 pt-16 lg:pt-0 overflow-hidden relative">
                <div className="flex-1 overflow-auto p-4 lg:p-10">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
