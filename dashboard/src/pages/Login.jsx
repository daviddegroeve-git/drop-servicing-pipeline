import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    // After login, go back to where they were or to home
    const from = location.state?.from?.pathname || "/";

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            });

            if (error) throw error;

            navigate(from, { replace: true });
        } catch (err) {
            setError(err.message || 'Failed to sign in. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#0a0c10] text-gray-100 overflow-hidden font-sans relative">
            {/* Subtle glow background */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="z-10 w-full max-w-md p-8 lg:p-12 mb-12"
            >
                {/* Logo/Brand (Simple Text for now) */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black tracking-tight text-white mb-2">
                        Dashboard<span className="text-blue-500">.</span>
                    </h1>
                    <p className="text-gray-400 text-sm font-medium">Administrator Access Portal</p>
                </div>

                <div className="bg-[#11141b] p-8 rounded-2xl border border-gray-800 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                    <form onSubmit={handleLogin} className="space-y-6 relative">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full bg-[#0a0c10] border border-gray-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all duration-300 placeholder:text-gray-600"
                                    placeholder="admin@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full bg-[#0a0c10] border border-gray-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all duration-300 placeholder:text-gray-600"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-red-500 text-sm"
                            >
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <span>{error}</span>
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Secure Login"
                            )}
                        </button>
                    </form>
                </div>
            </motion.div>

            <div className="absolute bottom-8 text-center text-[10px] text-gray-600 font-mono tracking-widest uppercase opacity-50">
                &copy; 2026 Atlas Digital System // Encrypted Session
            </div>
        </div>
    );
};

export default Login;
