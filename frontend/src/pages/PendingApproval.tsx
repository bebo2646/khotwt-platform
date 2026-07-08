import React from 'react'
import SEO from '../components/SEO'
import { useNavigate } from 'react-router-dom'
import { Clock, ArrowLeft } from 'lucide-react'

export default function PendingApproval() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 relative overflow-hidden font-sans select-none antialiased">
      <SEO 
        title="الحساب قيد المراجعة" 
        description="تم استلام طلب إنشاء حسابك وهو قيد المراجعة حالياً. سيتم تفعيله خلال 24 ساعة." 
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
              <div className="h-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 shadow-[0_0_8px_#fbbf24] w-2/5 rounded-full absolute animate-[loading-bar_2.5s_infinite_ease-in-out]"></div>
            </div>
          </div>

          {/* Main Title & Description */}
          <div className="space-y-4 text-center mt-2 w-full" dir="rtl">
            <h1 className="text-[24px] md:text-[28px] font-bold text-slate-800 flex items-center justify-center gap-2.5">
              <Clock className="h-7 w-7 text-amber-500 animate-bounce" />
              <span className="text-[#5B5CEB] font-extrabold leading-none">الحساب قيد المراجعة</span>
            </h1>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center space-y-3 shadow-sm">
              <p className="text-slate-850 font-black text-sm md:text-base leading-relaxed">
                تم استلام طلب إنشاء الحساب.
              </p>
              <p className="text-slate-700 font-bold text-xs md:text-sm">
                جار مراجعة بياناتك.
              </p>
              <p className="text-[#5B5CEB] font-black text-xs md:text-sm">
                سيتم الرد خلال 24 ساعة.
              </p>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-[#5B5CEB] hover:from-indigo-500 hover:to-[#4a4bbd] active:scale-[0.98] text-white font-bold text-sm rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>العودة لصفحة تسجيل الدخول</span>
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
