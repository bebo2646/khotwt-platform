import React from 'react'
import { Link } from 'react-router-dom'
import { 
  KeyRound, 
  Send, 
  PhoneCall, 
  ShieldCheck, 
  ExternalLink, 
  Globe, 
  ArrowRight,
  Sparkles,
  Lock
} from 'lucide-react'

export default function ForgotPassword() {
  const botUsername = 'khatwtk_edu_bot'
  const telegramAppUrl = `https://t.me/${botUsername}?start=recover`
  const telegramWebUrl = `https://web.telegram.org/a/#?tgaddr=${encodeURIComponent(`resolve?domain=${botUsername}&start=recover`)}`

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-lg bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 sm:p-10 space-y-8 shadow-2xl relative overflow-hidden">
        
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10 mb-1">
            <Lock className="w-8 h-8 text-sky-400" />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            استعادة كلمة المرور
          </h1>
          
          <p className="text-xs sm:text-sm text-slate-400 font-light max-w-md leading-relaxed">
            حرصاً على أمان بياناتك، تتم استعادة الحساب عبر التحقق الموثق برقم هاتفك المسجل من خلال <span className="text-sky-400 font-bold">بوت خطوتك الرسمي</span>.
          </p>
        </div>

        {/* Step by Step Guide */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-300">خطوات الاستعادة السريعة:</h3>
          
          <div className="space-y-3">
            <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                1
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-white">افتح بوت خطوتك</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  اضغط على الزر بالأسفل لفتح المحادثة الرسمية للبوت <span className="text-sky-400 font-bold" dir="ltr">@{botUsername}</span> واضغط <b>Start</b>.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                2
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-white">شارك رقم هاتفك المسجل</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  اضغط على زر «<b>📱 مشاركة رقم هاتفي للتحقق</b>» داخل تيليجرام لمطابقته مع حسابك بأمان وموثوقية.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                3
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-white">عيّن كلمة المرور الجديدة</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ستصلك رسالة فورية برابط سري صالح لمرة واحدة لمدة 15 دقيقة لتعيين كلمة مرور جديدة لحسابك.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <a
            href={telegramAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-sky-500/25"
          >
            <Send className="w-5 h-5 -rotate-45 ml-1" />
            <span>فتح البوت واستعادة كلمة المرور</span>
            <ExternalLink className="w-4 h-4 opacity-75 mr-1" />
          </a>

          <a
            href={telegramWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 rounded-xl text-xs font-bold transition-all"
          >
            <Globe className="w-4 h-4 text-sky-400" />
            <span>فتح عبر متصفح الويب (Telegram Web)</span>
          </a>
        </div>

        {/* Return to Login */}
        <div className="text-center pt-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>تذكرت كلمة المرور؟ تسجيل الدخول</span>
          </Link>
        </div>

      </div>
    </div>
  )
}
