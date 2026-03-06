import { CreditCard, AlertCircle, Copy, Check, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../components/LanguageContext';
import { motion } from 'framer-motion';

export default function Payment() {
    const { lang, t } = useLanguage();
    const [copied, setCopied] = useState(false);
    const stcNumber = "966507913514";

    const handleCopy = () => {
        navigator.clipboard.writeText(stcNumber);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <header className={lang === 'ar' ? 'text-right' : 'text-left'}>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <CreditCard className="h-8 w-8 text-blue-500" />
                    {t('payment.title')}
                </h1>
                <p className="text-zinc-500 mt-1">{t('payment.subtitle')}</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <motion.div
                    initial={{ opacity: 0, x: lang === 'ar' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-surface border border-zinc-800/60 p-8 rounded-3xl h-fit shadow-2xl"
                >
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold text-white">{t('payment.currentPlan')}</h2>
                        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold rounded-full uppercase tracking-widest">
                            {t('payment.active')}
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className={`flex justify-between items-end border-b border-zinc-800 pb-4 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
                            <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                                <p className="text-2xl font-black text-white">{t('payment.starterPlan')}</p>
                                <p className="text-sm text-zinc-500">{t('payment.monthly')}</p>
                            </div>
                            <p className="text-xl font-bold text-blue-500"> {t('payment.sar')} 99 <span className="text-xs text-zinc-600">{t('payment.perMo')}</span></p>
                        </div>
                    </div>

                    <ul className="space-y-4 mb-8">
                        {t('payment.features').map((feature, i) => (
                            <li key={i} className={`flex items-center gap-3 text-zinc-400 text-sm font-medium ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                <span className={lang === 'ar' ? 'text-right' : 'text-left'}>{feature}</span>
                            </li>
                        ))}
                    </ul>

                    <div className={`p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
                        <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className={`text-xs text-blue-200/80 leading-relaxed font-medium ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                            {t('payment.onlineSoon')}
                        </p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: lang === 'ar' ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative group"
                >
                    <div className="absolute inset-x-4 -top-4 bottom-4 bg-blue-600/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="bg-[#5c2d91]/10 border border-[#5c2d91]/30 p-8 rounded-3xl shadow-2xl relative z-10 backdrop-blur-sm px-6 md:px-8">
                        <div className={`flex items-center gap-4 mb-6 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
                            <div className="h-14 w-14 rounded-2xl bg-[#5c2d91] flex items-center justify-center shadow-lg shadow-[#5c2d91]/20">
                                <span className="text-white font-black text-xl italic uppercase font-serif tracking-tighter leading-none select-none">STC</span>
                            </div>
                            <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                                <p className="text-sm font-bold text-white uppercase tracking-widest opacity-50">{t('payment.stcGateway')}</p>
                                <h2 className="text-2xl font-black text-white">{t('payment.manualPay')}</h2>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <p className="text-zinc-300 font-medium leading-relaxed">
                                {t('payment.transferDesc')}
                            </p>

                            <div className="bg-black/40 border border-zinc-800 p-6 rounded-2xl space-y-4">
                                <p className={`text-[10px] text-zinc-500 font-bold uppercase tracking-widest ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t('payment.stcNumberLabel')}</p>
                                <div className={`flex items-center justify-between gap-4 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-2xl font-black text-white tracking-widest">{stcNumber}</span>
                                    <button
                                        onClick={handleCopy}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${copied
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                            }`}
                                    >
                                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        {copied ? t('payment.copied') : t('payment.copy')}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className={`text-sm text-zinc-400 font-medium ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t('payment.shareReceipt')}</p>
                                <button className="w-full flex items-center justify-center gap-3 py-4 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#25D366]/20 group px-4">
                                    <MessageSquare className="h-5 w-5 transition-transform group-hover:scale-110" />
                                    {t('payment.sendWhatsApp')}
                                </button>
                            </div>

                            <div className="text-center pt-4">
                                <p className="text-xs font-black text-[#5c2d91] uppercase tracking-[0.2em] animate-pulse">{t('payment.comingSoon')}</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            <div className={`bg-surface border border-zinc-800/60 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border-dashed ${lang === 'ar' ? 'md:flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-6 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <div className="h-16 w-16 rounded-full bg-zinc-800 flex items-center justify-center text-4xl shadow-inner border border-zinc-700">
                        🇸🇦
                    </div>
                    <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                        <h3 className="text-xl font-black text-white">{t('payment.localSupport')}</h3>
                        <p className="text-sm text-zinc-500 font-medium">{t('payment.supportDesc')}</p>
                    </div>
                </div>
                <button className="px-10 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black rounded-2xl transition-all border border-zinc-700 uppercase tracking-widest text-xs">
                    {t('payment.contactSupport')}
                </button>
            </div>
        </div>
    );
}
