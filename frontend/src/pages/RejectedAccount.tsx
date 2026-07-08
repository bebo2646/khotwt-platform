import React from 'react'
import SEO from '../components/SEO'
import API from '../services/api'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { XCircle, UserPlus, AlertCircle } from 'lucide-react'

export default function RejectedAccount() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reason = searchParams.get('reason') || 'لا يوجد سبب محدد'
  const email = searchParams.get('email')

  React.useEffect(() => {
    if (email) {
      // Auto delete the rejected account immediately after the first successful display
      API.post('/auth/delete-rejected-account', { email })
        .then(() => {
          console.log('Rejected account auto-deleted successfully.')
        })
        .catch((err) => {
          console.error('Failed to auto-delete rejected account', err)
        })
    }
  }, [email])

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 relative overflow-hidden font-sans select-none antialiased">
      <SEO 
        title="تم رفض الحساب" 
        description="تم رفض طلب إنشاء حسابك من قبل إدارة المنصة." 
        noindex={true} 
      />

      {/* Floating Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8000ms]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#5B5CEB]/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[6000ms]"></div>

      {/* Glassmorphic Container with entrance animation */}
      <div className="relative z-10 w-full max-w-lg mx-4 animate-fade-in-up">
        <div className="backdrop-blur-2xl bg-white/90 border border-white/40 rounded-[32px] p-8 md:p-10 shadow-[0_30px_70px_rgba(0,0,0,0.35)] flex flex-col items-center text-center space-y-8">
          
          {/* Logo & Platform Name */}
          <div className="flex flex-col items-center space-y-3">
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-rose-400 to-[#5B5CEB] rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <img 
                src="/logo.png" 
                alt="خطوتك التعليمية" 
                className="relative h-20 w-20 object-contain drop-shadow-[0_4px_10px_rgba(244,63,94,0.15)]" 
              />
            </div>
            <h2 className="text-base font-black tracking-wide text-[#5B5CEB]">خطوتك التعليمية</h2>
          </div>

          {/* Indeterminate Loader bar with glowing effect */}
          <div className="w-full">
            <div className="h-2 w-full bg-slate-200/50 rounded-full overflow-hidden relative shadow-inner">
              <div className="h-full bg-gradient-to-r from-rose-500 via-pink-400 to-rose-500 shadow-[0_0_8px_#f43f5e] w-3/5 rounded-full absolute animate-[loading-bar_3s_infinite_ease-in-out]"></div>
            </div>
          </div>

          {/* Main Title & Description */}
          <div className="space-y-4 text-center mt-2 w-full" dir="rtl">
            <h1 className="text-[24px] md:text-[28px] font-bold text-slate-800 flex items-center justify-center gap-2.5">
              <XCircle className="h-7 w-7 text-rose-500 animate-pulse" />
              <span className="text-rose-500 font-extrabold leading-none">تم رفض الحساب</span>
            </h1>
            
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-right space-y-3 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400">سبب الرفض:</h3>
              <p className="text-slate-700 font-black text-sm md:text-base leading-relaxed flex items-start gap-2 bg-rose-500/5 p-4 rounded-xl border border-rose-500/10">
                <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                <span>{reason}</span>
              </p>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={() => navigate('/register', { replace: true })}
            className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-[#5B5CEB] hover:from-rose-500 hover:to-[#4a4bbd] active:scale-[0.98] text-white font-bold text-sm rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-rose-100 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>إنشاء حساب جديد</span>
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
