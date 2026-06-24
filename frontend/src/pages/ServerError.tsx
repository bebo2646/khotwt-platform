import React from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { ServerCrash, RefreshCw } from 'lucide-react'

export default function ServerError() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 space-y-6">
      <SEO 
        title="خطأ في الاتصال بالخادم - 500" 
        description="عذراً، نواجه مشكلة تقنية مؤقتة حالياً في الاتصال بالخادم. يرجى المحاولة لاحقاً." 
        noindex={true} 
      />
      <div className="p-4 bg-amber-500/10 text-amber-500 rounded-full animate-pulse">
        <ServerCrash className="h-16 w-16" />
      </div>
      <h1 className="text-4xl font-black text-slate-100">500 - خطأ في الاتصال</h1>
      <p className="text-sm text-slate-400 font-light max-w-md leading-relaxed">
        حدثت مشكلة غير متوقعة في الخادم. نحن نعمل على حلها حالياً. يرجى تحديث الصفحة أو المحاولة مجدداً في وقت لاحق.
      </p>
      <div className="flex gap-4">
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          <span>تحديث الصفحة</span>
        </button>
        <Link 
          to="/" 
          className="px-6 py-3 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] border border-[var(--border-color)] text-slate-300 rounded-xl font-bold text-sm transition-all"
        >
          الرئيسية
        </Link>
      </div>
    </div>
  )
}
