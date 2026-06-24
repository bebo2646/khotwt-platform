import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import API from '../services/api'
import { useAuthStore } from '../store/authStore'
import { Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

type ChangePasswordFormInputs = {
  password: string
  password_confirmation: string
}

export default function ChangePassword() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [apiSuccess, setApiSuccess] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordFormInputs>()

  const password = watch('password')

  const onSubmit = async (data: ChangePasswordFormInputs) => {
    setApiError(null)
    setApiSuccess(null)
    setSubmitting(true)
    try {
      const res = await API.post('/change-password', {
        password: data.password,
        password_confirmation: data.password_confirmation,
      })
      
      setApiSuccess(res.data.message)
      
      // Update must_change_password status
      updateUser({ must_change_password: false })
      
      // Redirect based on role
      setTimeout(() => {
        if (user?.role === 'teacher') {
          navigate('/teacher', { replace: true })
        } else if (user?.role === 'admin') {
          navigate('/admin', { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      }, 1500)
    } catch (err: any) {
      console.error(err)
      if (err.response && err.response.data && err.response.data.message) {
        setApiError(err.response.data.message)
      } else {
        setApiError('حدث خطأ أثناء تغيير كلمة المرور. حاول مجدداً.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 space-y-6 shadow-2xl">
        
        <div className="flex flex-col items-center text-center space-y-3">
          <img 
            src="/logo.png" 
            alt="شعار خطوتك" 
            className="h-14 w-14 object-contain mb-1"
          />
          <h2 className="text-2xl font-black text-brand-primary">تغيير كلمة المرور</h2>
          <p className="text-xs text-slate-400 font-light leading-relaxed">
            {user?.must_change_password 
              ? 'يجب عليك تغيير كلمة المرور المؤقتة التي تم إنشاؤها لك لأول مرة قبل تصفح لوحة التحكم.'
              : 'قم بتحديث كلمة مرور حسابك بكلمة مرور جديدة لحماية أمان بياناتك.'}
          </p>
        </div>

        {apiError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {apiSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-brand-success rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{apiSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* New Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">كلمة المرور الجديدة</label>
            <div className="relative">
              <input
                type="password"
                placeholder="••••••••"
                {...register('password', { 
                  required: 'كلمة المرور الجديدة مطلوبة.', 
                  minLength: {
                    value: 6,
                    message: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.'
                  }
                })}
                className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-brand-primary"
              />
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
            {errors.password && (
              <p className="text-xs text-rose-500 font-light">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">تأكيد كلمة المرور</label>
            <div className="relative">
              <input
                type="password"
                placeholder="••••••••"
                {...register('password_confirmation', { 
                  required: 'تأكيد كلمة المرور مطلوب.',
                  validate: (value) => value === password || 'كلمات المرور غير متطابقة.'
                })}
                className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-brand-primary"
              />
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
            {errors.password_confirmation && (
              <p className="text-xs text-rose-500 font-light">{errors.password_confirmation.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <span>حفظ وتحديث كلمة المرور</span>
            )}
          </button>

        </form>

      </div>
    </div>
  )
}
