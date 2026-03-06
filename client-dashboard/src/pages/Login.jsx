import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';
import { Navigate } from 'react-router-dom';
import { Lock, Phone, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
    const { user } = useAuth();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    if (user) {
        return <Navigate to="/" replace />;
    }

    const formatPhoneForEmail = (p) => {
        // Strip out any non-numeric characters just to be safe
        const digits = p.replace(/\D/g, '');
        return `${digits}@client.drop-servicing.local`;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const email = formatPhoneForEmail(phone);
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            // Re-route handled by AuthGuard/user state
        } catch (err) {
            setError(err.message || 'Failed to login');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestPassword = async () => {
        if (!phone) {
            setError("Please enter your phone number first.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // Call the Vercel function to generate and send password via WhatsApp
            const response = await fetch('/api/request-client-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to request password');
            }

            setMessage("If this number is registered, a password has been sent via WhatsApp!");
        } catch (err) {
            setError(err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center p-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-surface border border-zinc-800/60 p-8 rounded-3xl shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center mb-6">
                            <img src="/logo.png" alt="ALATLAS" className="h-20 w-20 object-contain drop-shadow-2xl" />
                        </div>
                        <h1 className="text-4xl font-black text-white italic tracking-tighter">ALATLAS</h1>
                        <p className="text-zinc-500 mt-2 uppercase tracking-widest text-[10px] font-bold">Secure Client Portal</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <p className="text-sm text-red-500 text-center">{error}</p>
                        </div>
                    )}

                    {message && (
                        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <p className="text-sm text-emerald-500 text-center">{message}</p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-zinc-400 pl-1">Phone Number (with Country Code)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Phone className="h-5 w-5 text-zinc-500" />
                                </div>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+96650..."
                                    className="w-full bg-black/40 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-sm font-medium text-zinc-400">Password</label>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-zinc-500" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full bg-black/40 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !password}
                            className={`w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all ${loading || !password ? 'opacity-50 cursor-not-allowed' : 'shadow-lg shadow-blue-500/25'
                                }`}
                        >
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
                        <p className="text-sm text-zinc-400 mb-4">First time or forgot password?</p>
                        <button
                            type="button"
                            onClick={handleRequestPassword}
                            disabled={loading}
                            className={`w-full py-3 px-4 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-all border border-zinc-700 font-medium flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                        >
                            <MessageCircle className="w-5 h-5 text-emerald-500" />
                            Request Password via WhatsApp
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
