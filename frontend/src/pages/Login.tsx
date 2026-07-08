import React from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import API from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useConfigStore } from '../store/configStore'
import { useModalStore } from '../store/modalStore'
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, Sparkles, BookOpen, GraduationCap, CheckCircle } from 'lucide-react'
import SEO from '../components/SEO'

type LoginFormInputs = {
  email: string
  password: string
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const loginUser = useAuthStore((state) => state.login)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [rememberMe, setRememberMe] = React.useState(false)

  // Redirect target path
  const from = (location.state as any)?.from?.pathname || '/'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>()

  const onSubmit = async (data: LoginFormInputs) => {
    setApiError(null)
    setSubmitting(true)
    try {
      const res = await API.post('/login', data)
      if (import.meta.env.DEV) {
        console.log('[Login Response]:', res.data)
      }
      const { token, session_token } = res.data
      
      // Store token immediately so Axios interceptor uses it for the next call
      localStorage.setItem('auth_token', token)
      localStorage.setItem('elm_token', token)
      if (session_token) {
        localStorage.setItem('session_token', session_token)
        localStorage.setItem('elm_session_token', session_token)
      }

      // Verify/refetch fresh user profile from GET /api/me
      const profileRes = await API.get('/me')
      if (import.meta.env.DEV) {
        console.log('[Me Response on Login]:', profileRes.data)
      }
      const freshUser = profileRes.data.user || profileRes.data.data || profileRes.data

      // Check maintenance status after successful authentication
      const configData = await useConfigStore.getState().fetchConfig(true)
      if (configData && configData.maintenance) {
        if (!freshUser.is_super_admin && !freshUser.is_super) {
          // Immediately logout the user safely
          try {
            await API.post('/logout')
          } catch (logoutErr) {
            console.error('Logout failed during login maintenance redirect', logoutErr)
          }

          // Clear frontend state and credentials
          const authStore = useAuthStore.getState()
          authStore.logout()

          // Store maintenance parameters for display
          sessionStorage.setItem('maintenance_message', configData.maintenance_message || '')
          sessionStorage.setItem('maintenance_eta', configData.maintenance_eta || '')

          // Redirect to maintenance screen
          window.location.href = '/maintenance'
          return
        }
      }

      loginUser(freshUser, token, session_token)
      
      if (rememberMe) {
        localStorage.setItem('elm_remembered_email', data.email)
      } else {
        localStorage.removeItem('elm_remembered_email')
      }

      // If user must change password, redirect to change password
      if (freshUser.must_change_password) {
        navigate('/change-password', { replace: true })
      } else {
        if (freshUser.role === 'admin') {
          const hasPerm = (perm: string) => freshUser.permissions && freshUser.permissions.includes(perm);
          const target = freshUser.is_super_admin || freshUser.is_super
            ? '/admin/dashboard'
            : (hasPerm('teachers.manage') ? '/admin/teachers'
            : hasPerm('students.manage') ? '/admin/students'
            : hasPerm('courses.manage') ? '/admin/courses'
            : hasPerm('coupons.manage') ? '/admin/codes'
            : hasPerm('reports.view') ? '/admin/reports'
            : hasPerm('admins.manage') ? '/admin/manage'
            : '/admin/dashboard');
          navigate(target, { replace: true })
        } else if (freshUser.role === 'teacher') {
          navigate('/teacher/dashboard', { replace: true })
        } else {
          navigate('/student/dashboard', { replace: true })
        }
      }
    } catch (err: any) {
      console.error(err)
      if (err.response && err.response.data && err.response.data.status === 'pending') {
        navigate('/pending-approval', { replace: true })
        return
      }
      if (err.response && err.response.data && err.response.data.status === 'rejected') {
        const reason = err.response.data.rejection_reason || 'لا يوجد سبب محدد'
        const email = data.email
        navigate(`/rejected-account?reason=${encodeURIComponent(reason)}&email=${encodeURIComponent(email)}`, { replace: true })
        return
      }
      if (err.response && err.response.data && err.response.data.message) {
        setApiError(err.response.data.message)
      } else if (err.response && err.response.data && err.response.data.errors) {
        const errorMsg = Object.values(err.response.data.errors)[0] as string[]
        setApiError(errorMsg[0])
      } else {
        setApiError('بيانات الدخول غير صحيحة أو هناك مشكلة في الاتصال بالخادم.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Set remembered email and check for session invalidation redirect
  React.useEffect(() => {

    const email = localStorage.getItem('elm_remembered_email')
    if (email) {
      setRememberMe(true)
    }

    const params = new URLSearchParams(location.search)
    if (params.get('session_invalid') === 'true') {
      setApiError('تم تسجيل الدخول من جهاز آخر.')
    }
  }, [location.search])

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 text-right font-sans" dir="rtl">
      <SEO 
        title="بوابة تسجيل الدخول | منصة خطوتك"
        description="سجل الدخول إلى حسابك في منصة خطوتك التعليمية لمتابعة دروسك، ومحاضراتك، واختباراتك التفاعلية بكل سهولة."
        keywords="تسجيل الدخول, خطوتك دخول, حساب الطالب, منصة خطوتك تسجيل الدخول"
      />
      
      {/* Left Column: Form Section */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-12 bg-brand-dark-bg transition-colors duration-300 relative overflow-hidden">
        {/* Floating purple gradient circles/blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <motion.div
            animate={{
              x: [0, 60, -40, 0],
              y: [0, -50, 60, 0],
              scale: [1, 1.15, 0.9, 1]
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ position: 'absolute', pointerEvents: 'none', zIndex: 0 }}
            className="top-[-15%] left-[-15%] w-[400px] h-[400px] rounded-full bg-[#7C5CFF]/15 blur-[120px]"
          />
          <motion.div
            animate={{
              x: [0, -70, 50, 0],
              y: [0, 60, -60, 0],
              scale: [1, 0.85, 1.15, 1]
            }}
            transition={{
              duration: 28,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ position: 'absolute', pointerEvents: 'none', zIndex: 0 }}
            className="bottom-[-15%] right-[-15%] w-[450px] h-[450px] rounded-full bg-[#8B5CF6]/20 blur-[120px]"
          />
          <motion.div
            animate={{
              x: [0, 40, -30, 0],
              y: [0, 30, -40, 0],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ position: 'absolute', pointerEvents: 'none', zIndex: 0 }}
            className="top-[25%] right-[-10%] w-[350px] h-[350px] rounded-full bg-[#6366F1]/10 blur-[120px]"
          />
        </div>

        <div 
          className="w-full max-w-md bg-brand-card border border-[var(--border-color)] p-8 sm:p-10 rounded-[32px] shadow-2xl space-y-8 relative z-10"
          style={{ position: 'relative', zIndex: 10 }}
        >
          
          {/* Logo & Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-brand-primary">
              <img 
                src="/logo.png" 
                alt="شعار خطوتك" 
                className="h-12 w-12 object-contain"
              />
              <span className="text-3xl font-black tracking-wider text-slate-100 font-extrabold">خطوتك</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-100">مرحباً بك مجدداً </h2>
              <p className="text-xs text-slate-400 font-light mt-1">سجل الدخول لحسابك التعليمي وتابع دروسك فوراً.</p>
            </div>
          </div>

          {/* Validation Alert */}
          {apiError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs flex items-center gap-2.5 animate-pulse">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span className="font-semibold">{apiError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-100">البريد الإلكتروني</label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="name@example.com"
                  defaultValue={localStorage.getItem('elm_remembered_email') || ''}
                  {...register('email', { 
                    required: 'البريد الإلكتروني مطلوب لدخول المنصة.', 
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'البريد الإلكتروني المدخل غير صالح.'
                    }
                  })}
                  className={`w-full bg-brand-surface/40 hover:bg-brand-surface/60 focus:bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-2xl pr-10 pl-4 py-3 text-sm focus:outline-none transition-all duration-300 text-slate-100 ${errors.email ? 'is-invalid' : ''}`}
                />
                <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
              </div>
              {errors.email && (
                <p className="text-[11px] text-rose-500 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-100">كلمة المرور</label>
                <Link to="#" onClick={() => useModalStore.getState().showAlert({ title: 'إعادة تعيين كلمة المرور', description: 'يرجى التواصل مع إدارة المنصة أو المدرس الخاص بك لإعادة تعيين كلمة مرورك.', type: 'info' })} className="text-[11px] text-brand-primary hover:text-brand-primary-hover hover:underline font-bold">
                  نسيت كلمة المرور؟
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password', { 
                    required: 'كلمة المرور مطلوبة.', 
                    minLength: {
                      value: 6,
                      message: 'كلمة المرور يجب ألا تقل عن 6 أحرف.'
                    }
                  })}
                  className={`w-full bg-brand-surface/40 hover:bg-brand-surface/60 focus:bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-2xl pr-10 pl-11 py-3 text-sm focus:outline-none transition-all duration-300 text-slate-100 ${errors.password ? 'is-invalid' : ''}`}
                />
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-rose-500 font-medium">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember_me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-color)] text-brand-primary focus:ring-brand-primary bg-brand-surface accent-brand-primary cursor-pointer"
              />
              <label htmlFor="remember_me" className="text-xs text-slate-300 font-bold cursor-pointer select-none">
                تذكر بريدي الإلكتروني على هذا الجهاز
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/40 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>

          </form>

          {/* Footer Info */}
          <div className="border-t border-[var(--border-color)] pt-6 text-center text-xs text-slate-400">
            <span>ليس لديك حساب طالب؟ </span>
            <Link to="/register" className="text-brand-primary font-black hover:text-brand-primary-hover hover:underline">
              أنشئ حساباً جديداً
            </Link>
          </div>

        </div>
      </div>

      {/* Right Column: Premium Banner Section */}
      <div className="hidden lg:col-span-7 lg:flex flex-col justify-between p-12 bg-gradient-to-br from-brand-surface to-brand-dark-bg border-r border-[var(--border-color)] relative overflow-hidden">
        
        {/* Glow Spheres */}
        <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-brand-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-brand-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Top Badges */}
        <div className="flex justify-between items-center relative z-10">
          <div className="flex items-center gap-2 bg-brand-card border border-[var(--border-color)] px-4 py-2 rounded-full shadow-sm">
            <Sparkles className="h-4 w-4 text-brand-primary animate-pulse" />
            <span className="text-[10px] text-slate-200 font-bold">مستقبل تعليمي ذكي ومرن 💫</span>
          </div>
        </div>

        {/* Main Content Illustration Grid */}
        <div className="max-w-xl mx-auto space-y-8 relative z-10 text-right">
          <h1 className="text-4xl sm:text-5xl font-black text-slate-100 leading-tight">
            استمتع بتجربة دراسة ذكية وبسيطة مع <span className="text-brand-primary font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-brand-primary to-brand-secondary">خطوتك</span>
          </h1>
          <p className="text-slate-300 font-light leading-relaxed text-sm">
            نظام متطور لمتابعة المحاضرات بالفيديو، تقارير حضور فورية، بنك أسئلة واختبارات شاملة، ومحفظة إلكترونية متطورة لشحن اشتراكاتك بسهولة ويسر.
          </p>

          {/* Floating cards showcase */}
          <div className="grid grid-cols-2 gap-4 pt-4 text-right">
            
            <div className="p-5 bg-brand-card border border-[var(--border-color)] rounded-2xl shadow-sm space-y-2 hover:border-brand-primary/30 hover:-translate-y-0.5 transition-all group">
              <span className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl inline-block group-hover:bg-brand-primary group-hover:text-white transition-all">
                <BookOpen className="h-5 w-5" />
              </span>
              <h4 className="font-bold text-xs text-slate-100">محاضرات تفاعلية</h4>
              <p className="text-[10px] text-slate-400 font-medium leading-normal">فيديوهات شرح مشفرة بالكامل تتبع آخر موضع وقفت عنده بدقة بالغة.</p>
            </div>

            <div className="p-5 bg-brand-card border border-[var(--border-color)] rounded-2xl shadow-sm space-y-2 hover:border-brand-primary/30 hover:-translate-y-0.5 transition-all group">
              <span className="p-2.5 bg-emerald-500/10 text-brand-primary rounded-xl inline-block group-hover:bg-brand-primary group-hover:text-white transition-all">
                <CheckCircle className="h-5 w-5" />
              </span>
              <h4 className="font-bold text-xs text-slate-100">اختبارات وواجبات أسبوعية</h4>
              <p className="text-[10px] text-slate-400 font-medium leading-normal">تصحيح فوري لأسئلة الاختيار من متعدد ورصد درجات الواجب المقالي يدوياً.</p>
            </div>

          </div>
        </div>

        {/* Bottom spacer to keep alignment balanced */}
        <div className="h-4 pointer-events-none"></div>

      </div>

    </div>
  )
}
