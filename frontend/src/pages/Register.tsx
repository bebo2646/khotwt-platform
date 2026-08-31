import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import API from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useConfigStore } from '../store/configStore'
import { Mail, Lock, User, Phone, ShieldCheck, AlertCircle, Loader2, Sparkles, BookOpen, GraduationCap, CheckCircle } from 'lucide-react'
import SEO from '../components/SEO'
import { useModalStore } from '../store/modalStore'
import { useTaxonomyStore } from '../store/taxonomyStore'
import EducationalHeroBackground from '../components/ui/EducationalHeroBackground'

type RegisterFormInputs = {
  name: string
  email: string
  phone: string
  parent_phone: string
  stage: string
  grade: string
  password: string
  password_confirmation: string
  student_type: 'online' | 'center'
}

const normalizePhone = (num: string): string => {
  if (!num) return ''
  let clean = num.replace(/\D/g, '')
  if (clean.startsWith('00201') && clean.length === 14) {
    clean = clean.substring(4)
  } else if (clean.startsWith('201') && clean.length === 12) {
    clean = clean.substring(2)
  } else if (clean.startsWith('01') && clean.length === 11) {
    clean = clean.substring(1)
  } else if (clean.startsWith('0')) {
    clean = clean.substring(1)
  }
  return clean
}

export default function Register() {
  const navigate = useNavigate()
  const loginUser = useAuthStore((state) => state.login)
  const { stages, grades, fetchTaxonomy } = useTaxonomyStore()
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    fetchTaxonomy()
  }, [fetchTaxonomy])

  const activeStages = stages.filter(s => s.is_active)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<RegisterFormInputs>({
    defaultValues: {
      stage: 'secondary',
      grade: 'first_secondary',
      student_type: 'online'
    }
  })

  const selectedStage = watch('stage')
  const password = watch('password')

  const currentStage = stages.find(s => s.slug === selectedStage || String(s.id) === selectedStage)
  const availableGrades = grades.filter(g => 
    g.is_active && (
      currentStage ? g.stage_id === currentStage.id : true
    )
  )

  // Auto select first grade option when stage changes
  React.useEffect(() => {
    if (availableGrades.length > 0) {
      const currentGradeVal = getValues('grade')
      const existsInAvailable = availableGrades.some(g => g.slug === currentGradeVal)
      if (!existsInAvailable) {
        setValue('grade', availableGrades[0].slug)
      }
    }
  }, [selectedStage, availableGrades, setValue, getValues])

  const onSubmit = async (data: RegisterFormInputs) => {
    setApiError(null)
    setSubmitting(true)
    try {
      const res = await API.post('/register', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        parent_phone: data.parent_phone,
        grade: data.grade,
        password: data.password,
        student_type: data.student_type,
      })
      const { user: registeredUser, token, session_token, status } = res.data
      
      if (status === 'pending') {
        useModalStore.getState().showToast('تم تسجيل حسابك بنجاح. حسابك قيد المراجعة حالياً.', 'success')
        navigate('/login', { replace: true })
        return
      }

      const configData = await useConfigStore.getState().fetchConfig(true)
      if (configData && configData.maintenance) {
        // Store the token momentarily so we can call the logout API to destroy backend session
        localStorage.setItem('auth_token', token)
        localStorage.setItem('elm_token', token)
        if (session_token) {
          localStorage.setItem('session_token', session_token)
          localStorage.setItem('elm_session_token', session_token)
        }

        try {
          await API.post('/logout')
        } catch (logoutErr) {
          console.error('Logout failed during register maintenance redirect', logoutErr)
        }

        // Clear frontend credentials
        const authStore = useAuthStore.getState()
        authStore.logout()

        // Store maintenance params for display
        sessionStorage.setItem('maintenance_message', configData.maintenance_message || '')
        sessionStorage.setItem('maintenance_eta', configData.maintenance_eta || '')

        // Redirect to maintenance screen
        window.location.href = '/maintenance'
        return
      }

      loginUser(registeredUser, token, session_token)
      navigate('/student/dashboard', { replace: true })
    } catch (err: any) {
      console.error(err)
      if (err.response && err.response.data && err.response.data.message) {
        setApiError(err.response.data.message)
      } else if (err.response && err.response.data && err.response.data.errors) {
        const errorMsg = Object.values(err.response.data.errors)[0] as string[]
        setApiError(errorMsg[0])
      } else {
        setApiError('حدث خطأ أثناء إنشاء الحساب. يرجى التأكد من أن البريد الإلكتروني غير مسجل مسبقاً.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 text-right font-sans relative z-0" dir="rtl">
      <SEO 
        title="إنشاء حساب جديد | منصة خطوتك"
        description="سجل حساب طالب جديد في منصة خطوتك التعليمية لتتمكن من الاشتراك في الكورسات وحل الاختبارات ومتابعة دراستك مباشرة."
        keywords="إنشاء حساب, تسجيل حساب طالب, منصة خطوتك تسجيل, حساب جديد خطوتك"
      />
      
      <EducationalHeroBackground />
      
      {/* Left Column: Register Form */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-12 bg-transparent transition-colors duration-300 relative z-10">
        <div className="w-full max-w-lg bg-brand-card border border-[var(--border-color)] p-8 sm:p-10 rounded-[32px] shadow-2xl space-y-8">
          
          {/* Header */}
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
              <h2 className="text-2xl font-black text-slate-100">حساب طالب جديد </h2>
              <p className="text-xs text-slate-400 font-light mt-1">سجل حسابك كطالب الآن وابدأ رحلة التفوق مع أكبر المدرسين.</p>
            </div>
          </div>

          {/* Error Alert */}
          {apiError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs flex items-center gap-2.5 animate-pulse">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span className="font-semibold">{apiError}</span>
            </div>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            
            {/* Grid for Name and Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-100">الاسم بالكامل</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="مثال: أحمد علي..."
                    {...register('name', { required: 'الاسم بالكامل مطلوب لإنشاء الحساب.' })}
                    className={`w-full bg-brand-surface/40 hover:bg-brand-surface/60 focus:bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-2xl pr-10 pl-4 py-3 text-sm focus:outline-none transition-all duration-300 text-slate-100 ${errors.name ? 'is-invalid' : ''}`}
                  />
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                </div>
                {errors.name && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.name.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-100">البريد الإلكتروني</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="student@example.com"
                    {...register('email', { 
                      required: 'البريد الإلكتروني مطلوب للتوثيق.', 
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

            </div>

            {/* Grid for Phones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-100">رقم الهاتف الشخصي</label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="010XXXXXXXX"
                    {...register('phone', { 
                      required: 'رقم هاتف الطالب مطلوب.',
                      pattern: {
                        value: /^01[0125][0-9]{8}$/,
                        message: 'رقم الهاتف المصري غير صحيح.'
                      },
                      validate: (val) => {
                        const parentPhone = getValues('parent_phone');
                        if (!parentPhone) return true;
                        if (normalizePhone(val) === normalizePhone(parentPhone)) {
                          return "The student's phone number cannot be the same as the parent's phone number.";
                        }
                        return true;
                      }
                    })}
                    className={`w-full bg-brand-surface/40 hover:bg-brand-surface/60 focus:bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-2xl pr-10 pl-4 py-3 text-sm focus:outline-none transition-all duration-300 text-slate-100 ${errors.phone ? 'is-invalid' : ''}`}
                  />
                  <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                </div>
                {errors.phone && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.phone.message}</p>
                )}
              </div>

              {/* Parent Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-100">رقم هاتف ولي الأمر</label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="011XXXXXXXX"
                    {...register('parent_phone', { 
                      required: 'رقم هاتف ولي الأمر مطلوب للمتابعة الأكاديمية.',
                      pattern: {
                        value: /^01[0125][0-9]{8}$/,
                        message: 'رقم الهاتف المصري غير صحيح.'
                      },
                      validate: (val) => {
                        const studentPhone = getValues('phone');
                        if (!studentPhone) return true;
                        if (normalizePhone(val) === normalizePhone(studentPhone)) {
                          return "The student's phone number cannot be the same as the parent's phone number.";
                        }
                        return true;
                      }
                    })}
                    className={`w-full bg-brand-surface/40 hover:bg-brand-surface/60 focus:bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-2xl pr-10 pl-4 py-3 text-sm focus:outline-none transition-all duration-300 text-slate-100 ${errors.parent_phone ? 'is-invalid' : ''}`}
                  />
                  <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                </div>
                {errors.parent_phone && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.parent_phone.message}</p>
                )}
              </div>

            </div>

            {/* Grid for Stages & Grades */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Educational Stage */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-100">المرحلة الدراسية</label>
                <select
                  {...register('stage', { required: 'يرجى تحديد المرحلة الدراسية.' })}
                  className="w-full bg-brand-surface/40 hover:bg-brand-surface/60 focus:bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-2xl px-4 py-3 text-sm focus:outline-none transition-all duration-300 text-slate-100 cursor-pointer"
                >
                  {activeStages.map((stage) => (
                    <option key={stage.id || stage.slug} value={stage.slug}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Specific Grade */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-100">الصف الدراسي</label>
                <select
                  {...register('grade', { required: 'الصف الدراسي مطلوب.' })}
                  className="w-full bg-brand-surface/40 hover:bg-brand-surface/60 focus:bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-2xl px-4 py-3 text-sm focus:outline-none transition-all duration-300 text-slate-100 cursor-pointer"
                >
                  {availableGrades.map((grade) => (
                    <option key={grade.id || grade.slug} value={grade.slug}>
                      {grade.name}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Preferred Learning Mode / Student Type */}
            <div className="space-y-2 text-right animate-fade-in" dir="rtl">
              <label className="text-xs font-semibold text-slate-100 block">نوع الطالب (طريقة الدراسة المفضلة)</label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center justify-between p-4 bg-brand-surface/20 hover:bg-brand-surface/40 border border-[var(--border-color)] rounded-2xl cursor-pointer transition-all duration-300 select-none">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base shrink-0">🟢</span>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-100 block">طالب أونلاين</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Online Student</span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    value="online"
                    {...register('student_type', { required: 'يرجى تحديد نوع الطالب.' })}
                    className="accent-brand-primary h-4.5 w-4.5 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-brand-surface/20 hover:bg-brand-surface/40 border border-[var(--border-color)] rounded-2xl cursor-pointer transition-all duration-300 select-none">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base shrink-0">🏫</span>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-100 block">طالب سنتر</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Center Student</span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    value="center"
                    {...register('student_type', { required: 'يرجى تحديد نوع الطالب.' })}
                    className="accent-brand-primary h-4.5 w-4.5 cursor-pointer"
                  />
                </label>
              </div>
              {errors.student_type && (
                <p className="text-[11px] text-rose-500 font-medium">{errors.student_type.message}</p>
              )}
            </div>

            {/* Grid for Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-100">كلمة المرور</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    {...register('password', { 
                      required: 'كلمة المرور مطلوبة للأمان.', 
                      minLength: {
                        value: 6,
                        message: 'يجب ألا تقل عن 6 أحرف.'
                      }
                    })}
                    className={`w-full bg-brand-surface/40 hover:bg-brand-surface/60 focus:bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-2xl pr-10 pl-4 py-3 text-sm focus:outline-none transition-all duration-300 text-slate-100 ${errors.password ? 'is-invalid' : ''}`}
                  />
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                </div>
                {errors.password && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-100">تأكيد كلمة المرور</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    {...register('password_confirmation', { 
                      required: 'تأكيد كلمة المرور مطلوب.',
                      validate: (value) => value === password || 'كلمات المرور غير متطابقة.'
                    })}
                    className={`w-full bg-brand-surface/40 hover:bg-brand-surface/60 focus:bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-2xl pr-10 pl-4 py-3 text-sm focus:outline-none transition-all duration-300 text-slate-100 ${errors.password_confirmation ? 'is-invalid' : ''}`}
                  />
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                </div>
                {errors.password_confirmation && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.password_confirmation.message}</p>
                )}
              </div>

            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/40 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>جاري تسجيل بياناتك...</span>
                </>
              ) : (
                <span>إنشاء حساب والبدء فوراً</span>
              )}
            </button>

          </form>

          {/* Footer Info */}
          <div className="border-t border-[var(--border-color)] pt-6 text-center text-xs text-slate-400">
            <span>لديك حساب بالفعل على المنصة؟ </span>
            <Link to="/login" className="text-brand-primary font-black hover:text-brand-primary-hover hover:underline">
              سجل دخولك من هنا
            </Link>
          </div>

        </div>
      </div>

      {/* Right Column: Premium Banner Section */}
      <div className="hidden lg:col-span-6 lg:flex flex-col justify-between p-12 bg-transparent border-r border-[var(--border-color)] relative overflow-hidden z-10">

        {/* Top Badges */}
        <div className="flex justify-between items-center relative z-10">
          <div className="flex items-center gap-2 bg-brand-card border border-[var(--border-color)] px-4 py-2 rounded-full shadow-sm">
            <Sparkles className="h-4 w-4 text-brand-primary animate-pulse" />
            <span className="text-[10px] text-slate-200 font-bold">بوابة الطلاب المتفوقين 🛡️</span>
          </div>
        </div>

        {/* Main Content Illustration Grid */}
        <div className="max-w-xl mx-auto space-y-8 relative z-10 text-right">
          <h1 className="text-4xl sm:text-5xl font-black text-slate-100 leading-tight">
            ابدأ رحلتك التعليمية الذكية اليوم مع <span className="text-brand-primary font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-brand-primary to-brand-secondary">خطوتك</span>
          </h1>
          <p className="text-slate-300 font-light leading-relaxed text-sm">
            قم بإنشاء حسابك لتبدأ في اختيار المواد، حضور المحاضرات، حل الامتحانات التفاعلية، وتنزيل ملخصاتك الدراسية وحل واجباتك ومناقشتها مع مدرسي المادة المفضلين لديك.
          </p>

          {/* Floating cards showcase */}
          <div className="space-y-4 pt-4 text-right">
            
            <div className="flex gap-4 p-4 bg-brand-card border border-[var(--border-color)] rounded-2xl shadow-sm hover:border-brand-primary/30 hover:-translate-y-0.5 transition-all group">
              <span className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl h-fit group-hover:bg-brand-primary group-hover:text-white transition-all">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h4 className="font-bold text-xs text-slate-100">حماية الخصوصية والأمان</h4>
                <p className="text-[10px] text-slate-400 font-medium leading-normal mt-1">تشفير تام للبيانات، وسرية معلومات التواصل الشخصية ومعلومات أولياء الأمور.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-brand-card border border-[var(--border-color)] rounded-2xl shadow-sm hover:border-brand-primary/30 hover:-translate-y-0.5 transition-all group">
              <span className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl h-fit group-hover:bg-brand-primary group-hover:text-white transition-all">
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <h4 className="font-bold text-xs text-slate-100">بيئة علمية خالية من الإعلانات</h4>
                <p className="text-[10px] text-slate-400 font-medium leading-normal mt-1">تركيز كامل بنسبة 100% على الدروس والامتحانات والمناهج بدون أي مشتتات.</p>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom copyright footer */}
        <div className="text-xs text-slate-400 font-semibold relative z-10">
          حقوق الطبع محفوظة © {new Date().getFullYear()} خطوتك التعليمية. جميع الحقوق محفوظة.
        </div>

      </div>

    </div>
  )
}
