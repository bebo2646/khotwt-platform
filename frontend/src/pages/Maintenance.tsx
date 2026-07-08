import React from 'react'
import SEO from '../components/SEO'
import API from '../services/api'
import { AlertCircle, RefreshCw, Calendar, MessageCircle } from 'lucide-react'

import { useConfigStore } from '../store/configStore'

export default function Maintenance() {
  const [loading, setLoading] = React.useState(true)
  const [message, setMessage] = React.useState<string | null>(null)
  const [eta, setEta] = React.useState<string | null>(null)
  const [rechecking, setRechecking] = React.useState(false)

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
    checkStatus(false)

    // Check periodically in the background every 20 seconds
    const interval = setInterval(() => {
      checkStatus(true)
    }, 20000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 relative overflow-hidden font-sans select-none antialiased">
      <SEO 
        title="المنصة قيد الصيانة" 
        description="نعتذر لكم، يتم حالياً إجراء تحديثات لتحسين المنصة. يرجى المحاولة مرة أخرى بعد قليل." 
        noindex={true} 
      />

      {/* Floating Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8000ms]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#5B5CEB]/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[6000ms]"></div>

      {/* Glassmorphic Container with entrance animation */}
      <div className="relative z-10 w-full max-w-lg mx-4 animate-fade-in-up">
        <div className="backdrop-blur-2xl bg-white/90 border border-white/40 rounded-[32px] p-8 md:p-10 shadow-[0_30px_70px_rgba(0,0,0,0.35)] flex flex-col items-center text-center space-y-8">
          
          {/* Logo & Platform Name */}
          <div className="flex flex-col items-center space-y-3">
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-400 to-[#5B5CEB] rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <img 
                src="/logo.png" 
                alt="خطوتك التعليمية" 
                className="relative h-20 w-20 object-contain drop-shadow-[0_4px_10px_rgba(91,92,235,0.15)]" 
              />
            </div>
            <h2 className="text-base font-black tracking-wide text-[#5B5CEB]">خطوتك التعليمية</h2>
          </div>

          {/* Indeterminate Loader bar with glowing effect */}
          <div className="w-full">
            <div className="h-2 w-full bg-slate-200/50 rounded-full overflow-hidden relative shadow-inner">
              <div className="h-full bg-gradient-to-r from-[#5B5CEB] via-indigo-400 to-[#5B5CEB] shadow-[0_0_8px_#5B5CEB] w-2/5 rounded-full absolute animate-[loading-bar_2s_infinite_ease-in-out]"></div>
            </div>
          </div>

          {/* Main Title & Description */}
          <div className="space-y-4 text-center mt-2 w-full">
            <h1 className="text-[28px] md:text-[34px] font-bold text-slate-800 flex items-center justify-center gap-2.5">
              <span className="text-3xl md:text-4xl flex items-center leading-none">🚧</span>
              <span className="text-[#5B5CEB] font-extrabold leading-none">جاري تحديث المنصة</span>
            </h1>
            <p className="text-slate-700 font-semibold text-sm md:text-base leading-relaxed max-w-sm mx-auto">
              نعتذر لكم، يتم حالياً إجراء تحديثات لتحسين المنصة.
            </p>
            <p className="text-slate-500 font-medium text-xs md:text-sm">
              يرجى المحاولة مرة أخرى بعد قليل.
            </p>
          </div>

          {/* Optional Message or ETA */}
          {(message || eta) && (
            <div className="w-full bg-slate-50/80 border border-slate-100/90 rounded-2xl p-5 space-y-3 text-right shadow-sm">
              {message && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-[10px] text-slate-400 font-bold">تفاصيل التحديث</h4>
                    <p className="text-sm text-slate-700 leading-normal font-medium">{message}</p>
                  </div>
                </div>
              )}
              {eta && (
                <div className="flex items-start gap-3 border-t border-slate-200/50 pt-3">
                  <Calendar className="h-5 w-5 text-[#5B5CEB] mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-[10px] text-slate-400 font-bold">الوقت المتوقع للاكتمال</h4>
                    <p className="text-sm text-[#5B5CEB] font-bold">{eta}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action button */}
          <button
            onClick={() => checkStatus(false)}
            disabled={rechecking || loading}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-[#5B5CEB] hover:from-indigo-500 hover:to-[#4a4bbd] active:scale-[0.98] text-white font-bold text-sm rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50 cursor-pointer"
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
