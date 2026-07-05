import React from 'react'
import SEO from '../components/SEO'
import API from '../services/api'
import { AlertCircle, RefreshCw, Calendar, MessageCircle } from 'lucide-react'

export default function Maintenance() {
  const [loading, setLoading] = React.useState(true)
  const [message, setMessage] = React.useState<string | null>(null)
  const [eta, setEta] = React.useState<string | null>(null)
  const [rechecking, setRechecking] = React.useState(false)

  // Fetch settings from config endpoint
  const checkStatus = async (silent = false) => {
    if (!silent) setRechecking(true)
    try {
      const res = await API.get('/config')
      const data = res.data
      
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
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[6000ms]"></div>

      {/* Glassmorphic Container */}
      <div className="relative z-10 w-full max-w-lg mx-4">
        <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 md:p-10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center text-center space-y-8">
          
          {/* Logo & Platform Name */}
          <div className="flex flex-col items-center space-y-3">
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500 to-brand-primary rounded-full blur opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
              <img 
                src="/logo.png" 
                alt="خطوتك التعليمية" 
                className="relative h-20 w-20 object-contain drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]" 
              />
            </div>
            <h2 className="text-xl font-bold tracking-wide text-indigo-400">خطوتك التعليمية</h2>
          </div>

          {/* Indeterminate Loader bar */}
          <div className="w-full space-y-2">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
              <div className="h-full bg-gradient-to-r from-indigo-500 via-brand-primary to-indigo-500 w-1/3 rounded-full absolute animate-[loading-bar_1.8s_infinite_ease-in-out]"></div>
            </div>
          </div>

          {/* Main Title & Description */}
          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center justify-center gap-3">
              <span>🚧</span>
              <span>جاري تحديث المنصة</span>
            </h1>
            <p className="text-slate-300 font-medium text-sm md:text-base leading-relaxed">
              نعتذر لكم، يتم حالياً إجراء تحديثات لتحسين المنصة.
            </p>
            <p className="text-slate-400 font-light text-xs md:text-sm">
              يرجى المحاولة مرة أخرى بعد قليل.
            </p>
          </div>

          {/* Optional Message or ETA */}
          {(message || eta) && (
            <div className="w-full bg-slate-950/50 border border-slate-800/60 rounded-2xl p-5 space-y-3 text-right">
              {message && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs text-slate-500 font-bold">تفاصيل التحديث</h4>
                    <p className="text-sm text-slate-300 leading-normal">{message}</p>
                  </div>
                </div>
              )}
              {eta && (
                <div className="flex items-start gap-3 border-t border-slate-800/40 pt-3">
                  <Calendar className="h-5 w-5 text-brand-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs text-slate-500 font-bold">الوقت المتوقع للاكتمال</h4>
                    <p className="text-sm text-brand-primary font-bold">{eta}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action button */}
          <button
            onClick={() => checkStatus(false)}
            disabled={rechecking || loading}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] text-white font-bold text-sm rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${rechecking ? 'animate-spin' : ''}`} />
            <span>{rechecking ? 'جاري التحقق...' : 'إعادة التحقق من حالة المنصة'}</span>
          </button>
        </div>
      </div>
      
      {/* Dynamic Keyframe Injection for the Loader Bar */}
      <style>{`
        @keyframes tilt {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes loading-bar {
          0% { left: -35%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  )
}
