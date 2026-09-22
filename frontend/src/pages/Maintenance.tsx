import React from 'react'
import SEO from '../components/SEO'
import { RefreshCw, Calendar, MessageCircle, Sun, Moon } from 'lucide-react'

import { useConfigStore } from '../store/configStore'
import { useThemeStore } from '../store/themeStore'

export default function Maintenance() {
  const [loading, setLoading] = React.useState(true)
  const [message, setMessage] = React.useState<string | null>(null)
  const [eta, setEta] = React.useState<string | null>(null)
  const [rechecking, setRechecking] = React.useState(false)
  const { theme, toggleTheme, initTheme } = useThemeStore()

  // Fetch settings from config endpoint
  const checkStatus = async (silent = false) => {
    if (!silent) setRechecking(true)
    try {
      const data = await useConfigStore.getState().fetchConfig(true)
      
      // If maintenance mode is disabled, redirect home
      if (data && !data.maintenance) {
        window.location.href = '/'
        return
      }

      // Update state with backend settings
      setMessage(data.maintenance_message || sessionStorage.getItem('maintenance_message'))
      setEta(data.maintenance_eta || sessionStorage.getItem('maintenance_eta'))
    } catch (err) {
      console.error('Failed to retrieve system status', err)
    } finally {
      setLoading(false)
      setRechecking(false)
    }
  }

  React.useEffect(() => {
    initTheme()
    checkStatus(false)

    // Check periodically in the background every 20 seconds
    const interval = setInterval(() => {
      checkStatus(true)
    }, 20000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen w-full flex items-center justify-center maintenance-screen relative overflow-hidden font-sans select-none antialiased">
      <SEO 
        title="المنصة قيد الصيانة" 
        description="نعتذر لكم، يتم حالياً إجراء تحديثات لتحسين المنصة. يرجى المحاولة مرة أخرى بعد قليل." 
        noindex={true} 
      />

      {/* Theme Toggle Button */}
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={toggleTheme}
          type="button"
          aria-label="تبديل المظهر"
          className="p-2.5 rounded-2xl border border-[var(--border-color)] bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-md text-slate-300 transition-all shadow-sm cursor-pointer hover:border-[#6D5DFC]"
          title={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-[#6D5DFC]" />}
        </button>
      </div>

      {/* Floating Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#6D5DFC]/15 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8000ms]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#8B5CF6]/15 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[6000ms]"></div>

      {/* Glassmorphic Container with entrance animation */}
      <div className="relative z-10 w-full max-w-lg mx-4 animate-fade-in-up">
        <div className="backdrop-blur-2xl maintenance-card rounded-[32px] p-8 md:p-10 flex flex-col items-center text-center space-y-8">
          
          {/* Logo & Platform Name */}
          <div className="flex flex-col items-center space-y-3">
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500 to-[#6D5DFC] rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <img 
                src="/logo.png" 
                alt="خطوتك التعليمية" 
                className="relative h-20 w-20 object-contain drop-shadow-[0_4px_10px_rgba(109,93,252,0.2)]" 
              />
            </div>
            <h2 className="text-base font-black tracking-wide maintenance-brand-accent">خطوتك التعليمية</h2>
          </div>

          {/* Indeterminate Loader bar with glowing effect */}
          <div className="w-full">
            <div className="h-2 w-full maintenance-bar-track rounded-full overflow-hidden relative shadow-inner">
              <div className="h-full bg-gradient-to-r from-[#6D5DFC] via-[#8B5CF6] to-[#6D5DFC] shadow-[0_0_12px_#6D5DFC] w-2/5 rounded-full absolute animate-[loading-bar_2s_infinite_ease-in-out]"></div>
            </div>
          </div>

          {/* Main Title & Description */}
          <div className="space-y-4 text-center mt-2 w-full">
            <h1 className="text-[28px] md:text-[34px] font-bold maintenance-card-title flex items-center justify-center gap-2.5">
              <span className="text-3xl md:text-4xl flex items-center leading-none">🚧</span>
              <span className="maintenance-brand-accent font-extrabold leading-none">جاري تحديث المنصة</span>
            </h1>
            <p className="maintenance-card-body font-semibold text-sm md:text-base leading-relaxed max-w-sm mx-auto">
              نعتذر لكم، يتم حالياً إجراء تحديثات لتحسين المنصة.
            </p>
            <p className="maintenance-card-secondary font-medium text-xs md:text-sm">
              يرجى المحاولة مرة أخرى بعد قليل.
            </p>
          </div>

          {/* Optional Message or ETA */}
          {(message || eta) && (
            <div className="w-full maintenance-details-box rounded-2xl p-5 space-y-3.5 text-right shadow-sm">
              {message && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-[#6D5DFC] mt-0.5 shrink-0" />
                  <div className="w-full">
                    <h4 className="text-xs maintenance-details-title font-bold mb-1">تفاصيل التحديث</h4>
                    <p className="text-sm maintenance-details-content leading-relaxed font-medium">{message}</p>
                  </div>
                </div>
              )}
              {eta && (
                <div className={`flex items-start gap-3 ${message ? 'border-t maintenance-card-divider pt-3.5' : ''}`}>
                  <Calendar className="h-5 w-5 text-[#6D5DFC] mt-0.5 shrink-0" />
                  <div className="w-full">
                    <h4 className="text-xs maintenance-details-title font-bold mb-1">الوقت المتوقع للاكتمال</h4>
                    <p className="text-sm maintenance-details-eta font-black">{eta}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action button */}
          <button
            onClick={() => checkStatus(false)}
            disabled={rechecking || loading}
            className="w-full py-3.5 bg-[#6D5DFC] hover:bg-[#5B4AE3] active:scale-[0.98] text-white font-bold text-sm rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${rechecking ? 'animate-spin' : ''}`} />
            <span>{rechecking ? 'جاري التحقق...' : 'إعادة التحقق من حالة المنصة'}</span>
          </button>
        </div>
      </div>
      
      {/* Dynamic Keyframe Injection */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes loading-bar {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  )
}
