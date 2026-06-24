import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react'

interface UnauthorizedProps {
  requiredPermission?: string
}

export default function Unauthorized({ requiredPermission }: UnauthorizedProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Determine back to dashboard URL based on role
  const getDashboardUrl = () => {
    if (!user) return '/'
    if (user.role === 'admin') return '/admin/dashboard'
    if (user.role === 'teacher') return '/teacher/dashboard'
    return '/student/dashboard'
  }

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleGoDashboard = () => {
    navigate(getDashboardUrl())
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 bg-brand-background text-slate-100">
      <div className="max-w-md w-full bg-brand-card border border-red-500/20 shadow-2xl shadow-red-500/5 rounded-3xl p-8 text-center space-y-6 relative overflow-hidden">
        
        {/* Glow decorative element */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
        
        {/* Icon */}
        <div className="mx-auto h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 animate-pulse">
          <ShieldAlert className="h-8 w-8" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">403 Access Denied</h1>
          <p className="text-sm text-slate-400 font-light leading-relaxed">
            ليس لديك صلاحية للوصول لهذه الصفحة
          </p>
        </div>

        {/* Permission Details */}
        {requiredPermission && (
          <div className="bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-2xl p-4 text-right space-y-2 text-xs font-semibold">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2 text-red-400">
              <span>الصلاحية المطلوبة:</span>
              <code className="bg-red-500/10 px-2 py-0.5 rounded text-[10px] select-all font-mono">{requiredPermission}</code>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 block text-[10px]">صلاحياتك الحالية:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {user?.is_super_admin || user?.is_super ? (
                  <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-mono">super_admin</span>
                ) : user?.permissions && user.permissions.length > 0 ? (
                  user.permissions.map((p) => (
                    <span key={p} className="bg-[rgba(255,255,255,0.05)] text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">{p}</span>
                  ))
                ) : (
                  <span className="text-slate-500 font-light italic">لا توجد صلاحيات مسجلة</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleGoDashboard}
            className="flex-1 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-black rounded-xl shadow-lg shadow-brand-primary/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>العودة للوحة التحكم</span>
          </button>
          
          <button
            onClick={handleGoBack}
            className="flex-1 py-3 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] border border-[var(--border-color)] text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>الرجوع للصفحة السابقة</span>
          </button>
        </div>

      </div>
    </div>
  )
}
