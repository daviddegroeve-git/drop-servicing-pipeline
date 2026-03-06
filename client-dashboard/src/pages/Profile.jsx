import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { useLanguage } from '../components/LanguageContext';
import { supabase } from '../lib/supabase';
import { User, Mail, Phone, Lock, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Profile() {
    const { user } = useAuth();
    const { lang, t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    // Form states
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.user_metadata?.name || '');
            setEmail(user.email || '');
            setPhone(user.user_metadata?.phone || '');
        }
    }, [user]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        setError(null);

        try {
            const updates = {
                data: { name, phone }
            };

            if (email !== user.email && !email.endsWith('.local')) {
                updates.email = email;
            }

            if (password) {
                updates.password = password;
            }

            const { error: updateError } = await supabase.auth.updateUser(updates);
            if (updateError) throw updateError;

            setMessage(t('profile.updated'));
            setPassword('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header className={lang === 'ar' ? 'text-right' : 'text-left'}>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <User className="h-8 w-8 text-blue-500" />
                    {t('profile.title')}
                </h1>
                <p className="text-zinc-500 mt-1">{t('profile.subtitle')}</p>
            </header>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface border border-zinc-800/60 rounded-3xl overflow-hidden shadow-2xl"
            >
                <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
                    {message && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500">
                            <CheckCircle className="h-5 w-5 flex-shrink-0" />
                            <p className="text-sm font-medium">{message}</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className={`text-sm font-medium text-zinc-400 ${lang === 'ar' ? 'pr-1 text-right' : 'pl-1 text-left'} block`}>
                                {t('profile.fullName')}
                            </label>
                            <div className="relative">
                                <div className={`absolute inset-y-0 ${lang === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none`}>
                                    <User className="h-5 w-5 text-zinc-500" />
                                </div>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={`w-full bg-black/40 border border-zinc-800 rounded-xl py-3 ${lang === 'ar' ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'} text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium`}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className={`text-sm font-medium text-zinc-400 ${lang === 'ar' ? 'pr-1 text-right' : 'pl-1 text-left'} block`}>
                                {t('profile.email')}
                            </label>
                            <div className="relative">
                                <div className={`absolute inset-y-0 ${lang === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none`}>
                                    <Mail className="h-5 w-5 text-zinc-500" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={`w-full bg-black/40 border border-zinc-800 rounded-xl py-3 ${lang === 'ar' ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'} text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium`}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className={`text-sm font-medium text-zinc-400 ${lang === 'ar' ? 'pr-1 text-right' : 'pl-1 text-left'} block`}>
                                {t('profile.phone')}
                            </label>
                            <div className="relative">
                                <div className={`absolute inset-y-0 ${lang === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none`}>
                                    <Phone className="h-5 w-5 text-zinc-500" />
                                </div>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className={`w-full bg-black/40 border border-zinc-800 rounded-xl py-3 ${lang === 'ar' ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'} text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium`}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className={`text-sm font-medium text-zinc-400 ${lang === 'ar' ? 'pr-1 text-right' : 'pl-1 text-left'} block text-xs`}>
                                {t('profile.newPass')}
                            </label>
                            <div className="relative">
                                <div className={`absolute inset-y-0 ${lang === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none`}>
                                    <Lock className="h-5 w-5 text-zinc-500" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="********"
                                    className={`w-full bg-black/40 border border-zinc-800 rounded-xl py-3 ${lang === 'ar' ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'} text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium`}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={`pt-6 border-t border-zinc-800 flex ${lang === 'ar' ? 'justify-start' : 'justify-end'}`}>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                        >
                            {loading ? t('profile.saving') : (
                                <>
                                    <Save className="h-5 w-5" />
                                    {t('profile.save')}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
