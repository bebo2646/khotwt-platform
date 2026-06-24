import React from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { AlertTriangle, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 space-y-6">
      <SEO 
        title="الصفحة غير موجودة - 404" 
        description="عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها. تفضل بالعودة للصفحة الرئيسية." 
        noindex={true} 
      />
      <div className="p-4 bg-rose-500/10 text-rose-500 rounded-full animate-bounce">
        <AlertTriangle className="h-16 w-16" />
      </div>
      <h1 className="text-4xl font-black text-slate-100">404 - الصفحة غير موجودة</h1>
      <p className="text-sm text-slate-400 font-light max-w-md leading-relaxed">
        يبدو أنك سلكت طريقاً خاطئاً أو أن الصفحة تم حذفها. لا تقلق، يمكنك العودة للصفحة الرئيسية للمنصة.
      </p>
      <Link 
        to="/" 
        className="px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg"
      >
        <Home className="h-4 w-4" />
        <span>العودة للرئيسية</span>
      </Link>
    </div>
  )
}
