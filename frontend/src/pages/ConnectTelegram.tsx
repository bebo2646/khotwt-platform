import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import API from '../services/api'
import { useAuthStore } from '../store/authStore'
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  Bell, 
  KeyRound, 
  ExternalLink, 
  Globe, 
  ArrowLeft,
  Sparkles
} from 'lucide-react'

export default function ConnectTelegram() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const isNewAccount = searchParams.get('new_account') === 'true'

  const [loading, setLoading] = useState<boolean>(true)
  const [tokenLoading, setTokenLoading] = useState<boolean>(false)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [webLink, setWebLink] = useState<string | null>(null)
  const [isLinked, setIsLinked] = useState<boolean>(false)
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSkipModal, setShowSkipModal] = useState<boolean>(false)
  const [openedLink, setOpenedLink] = useState<boolean>(false)

  const pollingRef = useRef<any>(null)

  // 1. Fetch initial status and generate deep link
  const init = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check current link status
      const statusRes: any = await API.get('/telegram/status')
      const statusData = statusRes.data || statusRes

      if (statusData.is_linked) {
        setIsLinked(true)
        setTelegramUsername(statusData.telegram_username || null)
        setLoading(false)
        return
      }

      // Generate deep link
      await requestLinkToken()
    } catch (err: any) {
      console.error('Failed to initialize connect telegram:', err)
      setError('تعذر تحميل بيانات الربط. يرجى المحاولة مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  const requestLinkToken = async () => {
    try {
      setTokenLoading(true)
      const tokenRes: any = await API.post('/telegram/link-token')
      const tokenData = tokenRes.data || tokenRes
      if (tokenData.deep_link) {
        setDeepLink(tokenData.deep_link)
        setWebLink(tokenData.web_link || `https://web.telegram.org/a/#?tgaddr=${encodeURIComponent('resolve?domain=khatwtk_edu_bot&start=' + tokenData.deep_link.split('start=')[1])}`)
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'فشل في إنشاء رمز الربط. حاول مجدداً.'
      setError(msg)
    } finally {
      setTokenLoading(false)
    }
  }

  useEffect(() => {
    init()

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  // 2. Start polling for link status
  useEffect(() => {
    if (isLinked) {
      if (pollingRef.current) clearInterval(pollingRef.current)
      return
    }

    pollingRef.current = setInterval(async () => {
      try {
        const res: any = await API.get('/telegram/status')
        const data = res.data || res
        if (data.is_linked) {
          setIsLinked(true)
          setTelegramUsername(data.telegram_username || null)
          if (pollingRef.current) clearInterval(pollingRef.current)

          // Auto-redirect to student dashboard after 2.5 seconds
          setTimeout(() => {
            navigate('/student/dashboard', { replace: true })
          }, 2500)
        }
      } catch (e) {
        // Silent catch for background polling
      }
    }, 2500)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [isLinked, navigate])

  const handleOpenTelegram = (url: string) => {
    setOpenedLink(true)
    window.open(url, '_blank')
  }

  const handleSkipConfirmed = () => {
    setShowSkipModal(false)
    navigate('/student/dashboard', { replace: true })
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-xl bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 sm:p-10 space-y-8 shadow-2xl relative overflow-hidden">
        
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

        {/* Step indicator (when coming from registration) */}
        {isNewAccount && (
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 py-1.5 px-4 rounded-full mx-auto w-fit">
            <Sparkles className="w-3.5 h-3.5" />
            <span>تم إنشاء حسابك بنجاح! خطوة أخيرة ومهمة</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10 mb-1">
            <Send className="w-8 h-8 -rotate-45 ml-1 text-sky-400" />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            مساعد خطوتك على Telegram
          </h1>
          
          <p className="text-sm sm:text-base font-bold text-sky-400 max-w-md">
            «اربط حسابك ببوت خطوتك لتفعيل خدمات الإشعارات واستعادة كلمة المرور»
          </p>
          
          <p className="text-xs text-slate-400 font-light max-w-md leading-relaxed">
            مرحباً {user?.name || 'بك'}. خطوة واحدة تفصلك عن تلقي درجاتك وإشعارات الامتحانات واستعادة حسابك برقم هاتفك في أي وقت بأمان.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            <p className="text-xs text-slate-400">جارٍ تجهيز رابط الربط الآمن الخاص بحسابك...</p>
          </div>
        )}

        {/* Error notice */}
        {error && !loading && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between gap-3 text-rose-400 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={requestLinkToken}
              disabled={tokenLoading}
              className="text-white bg-rose-500/30 px-3 py-1 rounded-lg hover:bg-rose-500/50 font-bold shrink-0 transition-all"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Success State (Account already linked or just linked) */}
        {isLinked && !loading && (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">تم ربط حسابك ببوت خطوتك بنجاح! 🎉</h3>
              <p className="text-xs text-slate-400">
                مرتبط بمعرف تيليجرام: <span className="text-emerald-400 font-bold" dir="ltr">@{telegramUsername || 'Telegram'}</span>
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                جارٍ توجيهك إلى لوحة التحكم الخاصة بك تلقائياً...
              </p>
            </div>
            <button
              onClick={() => navigate('/student/dashboard', { replace: true })}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
            >
              الانتقال للوحة التحكم الآن
            </button>
          </div>
        )}

        {/* Unlinked State: Actions and Value Proposition */}
        {!isLinked && !loading && (
          <div className="space-y-6">
            
            {/* Value cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-200">إشعارات فورية</h4>
                <p className="text-[10px] text-slate-400 leading-tight">
                  تنبيهات فورية عند اعتماد درجات الامتحانات والدروس الجديدة.
                </p>
              </div>

              <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-200">استعادة كلمة المرور</h4>
                <p className="text-[10px] text-slate-400 leading-tight">
                  استرجاع الحساب برقم هاتفك المسجل بضغطة زر دون بريد إلكتروني.
                </p>
              </div>

              <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-200">حماية موثقة</h4>
                <p className="text-[10px] text-slate-400 leading-tight">
                  ربط أحادي مشفر يضمن عدم تكرار الحسابات وسرية بياناتك.
                </p>
              </div>
            </div>

            {/* Steps & Live Status */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs text-slate-300">
              <div className="font-bold text-white flex items-center gap-2">
                <span>طريقة الربط في ثوانٍ:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
                <li>اضغط على زر «<b>ربط حساب Telegram</b>» بالأسفل.</li>
                <li>سيفتح لك البوت الرسمي <span className="text-sky-400 font-bold" dir="ltr">@khatwtk_edu_bot</span>.</li>
                <li>اضغط على زر <b>Start (ابدأ)</b> داخل المحادثة.</li>
                <li>ستقوم هذه الصفحة برصد الربط تلقائياً وتحويلك للمنصة فوراً.</li>
              </ol>

              {openedLink && (
                <div className="pt-2 flex items-center justify-center gap-2 text-sky-400 text-xs font-medium animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>في انتظار الضغط على Start داخل Telegram...</span>
                </div>
              )}
            </div>

            {/* Primary Action Button */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => deepLink && handleOpenTelegram(deepLink)}
                disabled={!deepLink || tokenLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-sky-500/25 disabled:opacity-50"
              >
                {tokenLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5 -rotate-45 ml-1" />
                )}
                <span>ربط حساب Telegram</span>
                <ExternalLink className="w-4 h-4 opacity-75 mr-1" />
              </button>

              {/* Web Telegram Fallback Button */}
              {webLink && (
                <button
                  type="button"
                  onClick={() => handleOpenTelegram(webLink)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 rounded-xl text-xs font-bold transition-all"
                >
                  <Globe className="w-4 h-4 text-sky-400" />
                  <span>ليس لديك تطبيق Telegram؟ اضغط هنا للفتح في متصفح الويب (Telegram Web)</span>
                </button>
              )}
            </div>

            {/* Skip Button (with functional confirmation) */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setShowSkipModal(true)}
                className="text-xs text-slate-500 hover:text-slate-400 hover:underline transition-colors font-medium"
              >
                تخطي هذه الخطوة مؤقتاً والانتقال للمنصة
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Skip Confirmation Modal */}
      {showSkipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl text-right animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">
                هل أنت متأكد من تخطي ربط Telegram؟
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                ربط البوت خطوة أساسية لضمان أمان حسابك وتلقي إشعارات درجاتك ومواعيد الامتحانات. 
                <br /><br />
                <span className="text-rose-400 font-bold">⚠️ تنبيه:</span> إذا نسيت كلمة المرور لاحقاً، فلن تتمكن من استعادتها برقم هاتفك دون ربط هذا البوت مسبقاً.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSkipModal(false)}
                className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-sky-500/20"
              >
                العودة والمتابعة في الربط (موصى به)
              </button>
              <button
                type="button"
                onClick={handleSkipConfirmed}
                className="w-full py-2.5 px-4 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold transition-all"
              >
                تأكيد التخطي الآن وسأقوم بالربط لاحقاً
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
