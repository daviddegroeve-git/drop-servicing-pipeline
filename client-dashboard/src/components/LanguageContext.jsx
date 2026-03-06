import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

const translations = {
    en: {
        nav: {
            website: "My Website",
            profile: "Profile",
            payment: "Payment",
            signOut: "Sign Out",
            portal: "Client Portal"
        },
        login: {
            title: "ALATLAS",
            subtitle: "Secure Client Portal",
            phoneLabel: "Phone Number (with Country Code)",
            passwordLabel: "Password",
            passPlaceholder: "Enter your password",
            signIn: "Sign In",
            authenticating: "Authenticating...",
            firstTime: "First time or forgot password?",
            requestPass: "Request Password via WhatsApp",
            phoneError: "Please enter your phone number first.",
            successSent: "If this number is registered, a password has been sent via WhatsApp!",
            loginFailed: "Failed to login"
        },
        website: {
            title: "My Website",
            subtitle: "Preview and manage your live business site",
            openLive: "Open Live Site",
            status: "Status",
            businessName: "Business Name",
            plan: "Plan",
            starter: "Starter",
            loading: "Loading your website preview...",
            noWebsite: "No Website Found",
            noWebsiteDesc: "We couldn't find a website associated with your account yet. If you just registered, please wait a few minutes or contact support."
        },
        payment: {
            title: "Subscription & Payment",
            subtitle: "Manage your website subscription and billing",
            currentPlan: "Current Plan",
            active: "Active",
            starterPlan: "Starter Plan",
            monthly: "Monthly auto-renewal",
            sar: "SAR",
            perMo: "/mo",
            features: [
                "Unlimited Edits",
                "Custom Domain (.com / .net)",
                "Ultra-Fast Hosting",
                "24/7 AI Support",
                "SSL Certificate included"
            ],
            onlineSoon: "We are currently upgrading our automated checkout system. Online payments will be available soon.",
            stcGateway: "STC Pay Gateway",
            manualPay: "Manual Payment",
            transferDesc: "To renew or activate your subscription, please transfer the money directly via STC Pay.",
            stcNumberLabel: "STC Pay Number",
            copy: "Copy",
            copied: "Copied",
            shareReceipt: "After transferring, please share the receipt here:",
            sendWhatsApp: "Send Screenshot to WhatsApp",
            comingSoon: "Coming Soon: Automatic Checkout",
            localSupport: "Local Support",
            supportDesc: "Our Riyadh-based team is here to help you 24/7",
            contactSupport: "CONTACT SUPPORT"
        },
        profile: {
            title: "Profile Settings",
            subtitle: "Manage your account information and security",
            fullName: "Full Name",
            email: "Email Address",
            phone: "Phone Number",
            newPass: "New Password (Leave blank to keep current)",
            save: "Save Changes",
            saving: "Saving...",
            updated: "Profile updated successfully!"
        }
    },
    ar: {
        nav: {
            website: "موقعي",
            profile: "الملف الشخصي",
            payment: "الدفع",
            signOut: "تسجيل الخروج",
            portal: "بوابة العملاء"
        },
        login: {
            title: "الأطلس",
            subtitle: "بوابة العملاء الآمنة",
            phoneLabel: "رقم الهاتف (مع رمز الدولة)",
            passwordLabel: "كلمة المرور",
            passPlaceholder: "أدخل كلمة المرور",
            signIn: "تسجيل الدخول",
            authenticating: "جاري التحقق...",
            firstTime: "أول مرة أو نسيت كلمة المرور؟",
            requestPass: "طلب كلمة المرور عبر الواتساب",
            phoneError: "يرجى إدخال رقم هاتفك أولاً.",
            successSent: "إذا كان هذا الرقم مسجلاً، فقد تم إرسال كلمة المرور عبر الواتساب!",
            loginFailed: "فشل تسجيل الدخول"
        },
        website: {
            title: "موقعي الإلكتروني",
            subtitle: "معاينة وإدارة موقع عملك المباشر",
            openLive: "فتح الموقع المباشر",
            status: "الحالة",
            businessName: "اسم العمل",
            plan: "الخطة",
            starter: "البداية",
            loading: "جاري تحميل معاينة موقعك...",
            noWebsite: "لم يتم العثور على موقع",
            noWebsiteDesc: "لم نتمكن من العثور على موقع مرتبط بحسابك بعد. إذا كنت قد سجلت للتو، يرجى الانتظار بضع دقائق أو الاتصال بالدعم."
        },
        payment: {
            title: "الاشتراك والدفع",
            subtitle: "إدارة اشتراك موقعك وفواتيرك",
            currentPlan: "الخطة الحالية",
            active: "نشط",
            starterPlan: "خطة البداية",
            monthly: "تجديد شهري تلقائي",
            sar: "ريال",
            perMo: "/شهرياً",
            features: [
                "تعديلات غير محدودة",
                "نطاق مخصص (.com / .net)",
                "استضافة فائقة السرعة",
                "دعم ذكاء اصطناعي 24/7",
                "شهادة SSL متضمنة"
            ],
            onlineSoon: "نحن نقوم حالياً بترقية نظام الدفع التلقائي الخاص بنا. ستكون المدفوعات عبر الإنترنت متاحة قريباً.",
            stcGateway: "بوابة STC Pay",
            manualPay: "الدفع اليدوي",
            transferDesc: "لتجديد أو تفعيل اشتراكك، يرجى تحويل المبلغ مباشرة عبر STC Pay.",
            stcNumberLabel: "رقم STC Pay",
            copy: "نسخ",
            copied: "تم النسخ",
            shareReceipt: "بعد التحويل، يرجى مشاركة الإيصال هنا:",
            sendWhatsApp: "إرسال لقطة شاشة للواتساب",
            comingSoon: "قريباً: الدفع التلقائي",
            localSupport: "الدعم المحلي",
            supportDesc: "فريقنا المتواجد في الرياض هنا لمساعدتك على مدار الساعة",
            contactSupport: "اتصل بالدعم"
        },
        profile: {
            title: "إعدادات الملف الشخصي",
            subtitle: "إدارة معلومات حسابك وأمانك",
            fullName: "الاسم الكامل",
            email: "البريد الإلكتروني",
            phone: "رقم الهاتف",
            newPass: "كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)",
            save: "حفظ التغييرات",
            saving: "جاري الحفظ...",
            updated: "تم تحديث الملف الشخصي بنجاح!"
        }
    }
};

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState(localStorage.getItem('alatlas_lang') || 'ar');

    useEffect(() => {
        localStorage.setItem('alatlas_lang', lang);
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }, [lang]);

    const t = (path) => {
        const keys = path.split('.');
        let result = translations[lang];
        for (const key of keys) {
            result = result?.[key];
        }
        return result || path;
    };

    const toggleLanguage = () => {
        setLang(prev => prev === 'en' ? 'ar' : 'en');
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang, t, toggleLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
