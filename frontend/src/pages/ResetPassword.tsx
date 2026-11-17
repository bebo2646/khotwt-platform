import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import API from '../services/api'
import { Lock, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'

type ResetPasswordFormInputs = {
  password: string
  password_confirmation: string
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<boolean>(true)
  const [isTokenValid, setIsTokenValid] = useState<boolean>(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiSuccess, setApiSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormInputs>()

  const password = watch('password')

  useEffect(() => {
    // 1. Extract token from URL hash (#token=...) or fallback search param (?token=...)
    let extractedToken: string | null = null

    if (window.location.hash && window.location.hash.includes('token=')) {
      const match = window.location.hash.match(/token=([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        extractedToken = match[1]
      }
    } else {
      const urlParams = new URLSearchParams(window.location.search)
      extractedToken = urlParams.get('token')
    }

    // 2. Immediately purge token from address bar to prevent history & referrer leakage
    if (extractedToken) {
      window.history.replaceState(null, '', window.location.pathname)
      setToken(extractedToken)

      // 3. Verify token validity with backend API
      API.post('/telegram/verify-reset-token', { token: extractedToken })
        .then((res: any) => {
          const isValid = res.data?.valid ?? res.valid ?? false
          setIsTokenValid(isValid)
          if (!isValid) {
            setApiError('رمز إعادة التعيين منتهي الصلاحية أو تم استخدامه بالفعل. يرجى طلب رابط جديد عبر البوت.')
          }
        })
        .catch(() => {
          setIsTokenValid(false)
          setApiError('تعذر التحقق من صلاحية الرمز. يرجى التأكد من الاتصال بالإنترنت أو طلب رابط جديد.')
        })
        .finally(() => {
          setVerifying(false)
        })
    } else {
      setVerifying(false)
      setIsTokenValid(false)
      setApiError('لم يتم العثور على رمز إعادة التعيين في الرابط. يرجى فتح الرابط المرسل إليك عبر تيليجرام.')
    }
  }, [])

  const onSubmit = async (data: ResetPasswordFormInputs) => {
    if (!token) {
      setApiError('رمز إعادة التعيين مفقود. يرجى طلب رابط جديد من تيليجرام.')
      return
    }

    setApiError(null)
    setApiSuccess(null)
    setSubmitting(true)

    try {
      const res: any = await API.post('/telegram/reset-password', {
        token,
        password: data.password,
        password_confirmation: data.password_confirmation,
      })

      const successMsg = res.data?.message || res.message || 'تمت إعادة تعيين كلمة المرور بنجاح!'
      setApiSuccess(successMsg)

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 2000)
    } catch (err: any) {
      console.error('Password reset failed:', err)
      if (err.response && err.response.data && err.response.data.message) {
        setApiError(err.response.data.message)
      } else {
        setApiError('حدث خطأ أثناء إعادة تعيين كلمة المرور. يرجى المحاولة مرة أخرى.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 space-y-6 shadow-2xl">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <img 
            src="/logo.png" 
            alt="شعار خطوتك" 
            className="h-14 w-14 object-contain mb-1"
          />
          <h2 className="text-2xl font-black text-brand-primary">استعادة كلمة المرور</h2>
          <p className="text-xs text-slate-400 font-light leading-relaxed">
            منظومة الاستعادة الموثقة عبر Telegram Assistant
          </p>
        </div>

        {/* Loading state during initial token verification */}
        {verifying && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-slate-400">جارٍ التحقق من صلاحية الرابط الآمن...</p>
          </div>
        )}

        {/* Invalid or expired token notice */}
        {!verifying && !isTokenValid && (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">الرابط غير صالح</p>
                <p className="text-xs opacity-90 leading-relaxed">
                  {apiError || 'انتهت صلاحية هذا الرابط أو تم استخدامه سابقاً. روابط تيليجرام صالحة لمرة واحدة فقط ولمدة 15 دقيقة.'}
                </p>
              </div>
            </div>

            <a
              href="https://t.me/khatwtk_edu_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-primary/20"
            >
              فتح بوت خطوتك في Telegram لطلب رابط جديد
            </a>

            <div className="text-center pt-2">
              <Link to="/login" className="text-xs text-slate-400 hover:text-white transition-colors">
                العودة لصفحة تسجيل الدخول
              </Link>
            </div>
          </div>
        )}

        {/* Success feedback */}
        {apiSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="font-semibold">{apiSuccess}</p>
          </div>
        )}

        {/* Password Reset Form */}
        {!verifying && isTokenValid && !apiSuccess && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {apiError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{apiError}</p>
              </div>
            )}

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                كلمة المرور الجديدة <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  dir="ltr"
                  placeholder="••••••••"
                  className="w-full bg-slate-900/50 border border-[var(--border-color)] rounded-2xl px-4 py-3 pl-11 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary transition-colors"
                  {...register('password', {
                    required: 'كلمة المرور الجديدة مطلوبة',
                    minLength: {
                      value: 8,
                      message: 'يجب ألا تقل كلمة المرور عن 8 أحرف',
                    },
                  })}
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
              </div>
              {errors.password && (
                <span className="text-[11px] text-red-400 font-medium">
                  {errors.password.message}
                </span>
              )}
            </div>

            {/* Password Confirmation */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                تأكيد كلمة المرور الجديدة <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  dir="ltr"
                  placeholder="••••••••"
                  className="w-full bg-slate-900/50 border border-[var(--border-color)] rounded-2xl px-4 py-3 pl-11 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary transition-colors"
                  {...register('password_confirmation', {
                    required: 'تأكيد كلمة المرور مطلوب',
                    validate: (value) =>
                      value === password || 'كلمتا المرور غير متطابقتين',
                  })}
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
              </div>
              {errors.password_confirmation && (
                <span className="text-[11px] text-red-400 font-medium">
                  {errors.password_confirmation.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ الحفظ والتحديث...</span>
                </>
              ) : (
                <span>حفظ كلمة المرور الجديدة</span>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
