import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { 
  ArrowLeft, 
  Save, 
  Copy, 
  Check, 
  Database, 
  Hash, 
  Coins, 
  User, 
  Shield, 
  Upload, 
  Eye, 
  EyeOff 
} from 'lucide-react'

const SUBJECTS = [
  { key: 'chemistry', val: 'الكيمياء' },
  { key: 'physics', val: 'الفيزياء' },
  { key: 'biology', val: 'الأحياء' },
  { key: 'math', val: 'الرياضيات' },
  { key: 'science', val: 'العلوم' },
  { key: 'arabic', val: 'اللغة العربية' },
  { key: 'english', val: 'اللغة الإنجليزية' },
]

const GRADES = [
  { key: 'first_preparatory', val: 'الأول الإعدادي' },
  { key: 'second_preparatory', val: 'الثاني الإعدادي' },
  { key: 'third_preparatory', val: 'الثالث الإعدادي' },
  { key: 'first_secondary', val: 'الأول الثانوي' },
  { key: 'second_secondary', val: 'الثاني الثانوي' },
  { key: 'third_secondary', val: 'الثالث الثانوي' },
]

const PLANS = [
  { id: 1, name: 'Starter', storage: 10, codes: 50, price: 199 },
  { id: 2, name: 'Basic', storage: 25, codes: 100, price: 399 },
  { id: 3, name: 'Pro', storage: 50, codes: 250, price: 699 },
  { id: 4, name: 'Academy', storage: 100, codes: 500, price: 1199 },
]

export default function CreateTeacher() {
  const navigate = useNavigate()

  // Form states
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [subject, setSubject] = React.useState('')
  const [experience, setExperience] = React.useState('')
  const [bio, setBio] = React.useState('')
  const [selectedGrades, setSelectedGrades] = React.useState<string[]>([])
  const [status, setStatus] = React.useState<'active' | 'disabled'>('active')
  const [teachingMode, setTeachingMode] = React.useState<string>('online')
  const [avatar, setAvatar] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Subscription states
  const [selectedPlanId, setSelectedPlanId] = React.useState<number>(1)
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'quarterly' | 'semi_annual' | 'annual'>('monthly')
  const [extraStorage, setExtraStorage] = React.useState<number>(0)
  const [extraCodes, setExtraCodes] = React.useState<number>(0)

  // Success view state (Credentials display)
  const [createdCredentials, setCreatedCredentials] = React.useState<{
    email: string
    password: string
    name: string
  } | null>(null)
  const [copied, setCopied] = React.useState(false)

  // Fetch plans from backend
  const [plans, setPlans] = React.useState<any[]>(PLANS)
  const [settings, setSettings] = React.useState<any>({
    discount_semi_annually: '10',
    discount_annually: '20'
  })

  React.useEffect(() => {
    API.get('/admin/subscription-plans')
      .then(res => {
        if (res.data.plans && res.data.plans.length > 0) {
          const mapped = res.data.plans.map((p: any) => ({
            id: p.id,
            name: p.name,
            storage: p.video_storage_gb,
            codes: p.student_codes,
            price: Math.round(p.price_egp),
            billing_options: p.billing_options
          }))
          setPlans(mapped)
          // Set to the first plan in list
          setSelectedPlanId(mapped[0].id)
        }
        if (res.data.settings) {
          setSettings(res.data.settings)
        }
      })
      .catch(err => {
        console.error("Failed to load plans from backend", err)
      })
  }, [])

  // Calculations
  const selectedPlan = plans.find(p => Number(p.id) === Number(selectedPlanId)) || plans[0] || PLANS[0]
  
  const getPlanDiscount = React.useCallback((plan: any, cycle: string) => {
    if (!plan) return 0
    let opts = plan.billing_options
    if (opts) {
      if (typeof opts === 'string') {
        try {
          opts = JSON.parse(opts)
        } catch (e) {
          opts = null
        }
      }
      if (opts) {
        if (cycle === 'monthly') return Number(opts.monthly?.discount ?? 0)
        if (cycle === 'quarterly') return Number(opts.three_months?.discount ?? 0)
        if (cycle === 'semi_annual' && opts.six_months?.enabled) return Number(opts.six_months.discount)
        if (cycle === 'annual' && opts.yearly?.enabled) return Number(opts.yearly.discount)
      }
    }
    // Fallback to settings
    if (cycle === 'semi_annual') return parseFloat(settings.discount_semi_annually || '10')
    if (cycle === 'annual') return parseFloat(settings.discount_annually || '20')
    return 0
  }, [settings])

  const billingMonths = React.useMemo(() => {
    if (billingCycle === 'monthly') return 1
    if (billingCycle === 'quarterly') return 3
    if (billingCycle === 'semi_annual') return 6
    if (billingCycle === 'annual') return 12
    return 1
  }, [billingCycle])

  const discountPercent = React.useMemo(() => {
    return getPlanDiscount(selectedPlan, billingCycle)
  }, [selectedPlan, billingCycle, getPlanDiscount])

  const getCardPrice = React.useCallback((monthlyPrice: number, plan: any) => {
    const base = monthlyPrice * billingMonths
    const discountPct = getPlanDiscount(plan, billingCycle)
    return base * (1 - discountPct / 100)
  }, [billingMonths, billingCycle, getPlanDiscount])

  const basePlanPrice = selectedPlan.price * billingMonths
  const discountAmount = basePlanPrice * (discountPercent / 100)
  const planCost = basePlanPrice - discountAmount
  const extraStorageCost = extraStorage * 15
  const extraCodesCost = extraCodes * 5
  const addonsPrice = extraStorageCost + extraCodesCost
  const totalCost = planCost + addonsPrice

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const res = await API.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      setAvatar(res.data.url)
      useModalStore.getState().showToast('تم رفع الصورة الشخصية بنجاح.', 'success')
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل رفع الصورة.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleGradeToggle = (gradeKey: string) => {
    setSelectedGrades((prev) => {
      if (prev.includes(gradeKey)) {
        return prev.filter((g) => g !== gradeKey)
      } else {
        return [...prev, gradeKey]
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedGrades.length === 0) {
      useModalStore.getState().showToast('يرجى تحديد مرحلة دراسية واحدة على الأقل.', 'warning')
      return
    }

    setSaving(true)
    const payload = {
      name,
      email: email || undefined,
      phone,
      password: password || undefined,
      subject,
      experience,
      bio,
      grades: selectedGrades,
      status,
      teaching_mode: teachingMode,
      avatar,
      plan_id: Number(selectedPlanId) || (plans[0] ? Number(plans[0].id) : 1),
      billing_cycle: billingCycle,
      extra_storage_gb: extraStorage,
      extra_codes: extraCodes
    }

    try {
      const res = await API.post('/admin/teachers', payload)
      useModalStore.getState().showToast('تم إنشاء حساب المعلم والاشتراك بنجاح.', 'success')
      setCreatedCredentials({
        name: name,
        email: res.data.generated_email,
        password: res.data.temporary_password,
      })
    } catch (err: any) {
      console.error(err)
      if (err.response?.data?.errors) {
        const errors = err.response.data.errors
        const errorMsg = Object.entries(errors)
          .map(([field, msgs]: any) => `- ${field}: ${msgs.join(', ')}`)
          .join('\n')
        useModalStore.getState().showAlert({
          title: 'خطأ في التحقق من البيانات',
          description: `الرجاء التأكد من صحة المدخلات:\n${errorMsg}`,
          type: 'error'
        })
      } else if (err.response?.data?.message) {
        useModalStore.getState().showToast(err.response.data.message, 'error')
      } else {
        useModalStore.getState().showToast('فشل حفظ المعلم.', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCopyCredentials = () => {
    if (!createdCredentials) return
    const text = `بيانات دخول المعلم الجديد:\nالاسم: ${createdCredentials.name}\nالبريد الإلكتروني: ${createdCredentials.email}\nكلمة المرور المؤقتة: ${createdCredentials.password}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    useModalStore.getState().showToast('تم نسخ بيانات الدخول إلى الحافظة.', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  if (createdCredentials) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-right" dir="rtl">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 space-y-8 shadow-xl">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-[var(--text-color)]">تم إنشاء حساب المعلم بنجاح!</h1>
            <p className="text-sm text-[var(--text-secondary)]">يرجى حفظ بيانات الدخول المؤقتة التالية ومشاركتها مع المعلم:</p>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-secondary)]">الاسم:</span>
              <span className="text-sm font-bold text-[var(--text-color)]">{createdCredentials.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-secondary)]">البريد الإلكتروني للوجين:</span>
              <span className="text-sm font-bold text-brand-primary">{createdCredentials.email}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs text-[var(--text-secondary)]">كلمة المرور المؤقتة:</span>
              <span className="text-sm font-mono font-bold text-amber-400">{createdCredentials.password}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={handleCopyCredentials}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>نسخ بيانات الدخول</span>
            </button>
            <button
              onClick={() => navigate('/admin/teachers')}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--bg-color)]/30 hover:bg-[var(--bg-color)]/50 text-[var(--text-color)] rounded-xl text-xs font-bold transition-colors cursor-pointer border border-[var(--border-color)]"
            >
              <span>العودة لقائمة المعلمين</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8 text-right" dir="rtl">
      
      {/* Header Back Button */}
      <div className="flex items-center gap-3">
        <Link 
          to="/admin/teachers" 
          className="p-2.5 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-[var(--text-color)]">إضافة معلم جديد للمنصة</h1>
          <p className="text-xs text-[var(--text-secondary)] font-light mt-1">تعبئة بيانات المعلم والتحكم بحجم التخزين والطلاب وخطته الشهرية</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Inputs */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 1. Teacher Profile Info */}
          <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 space-y-6">
            <h2 className="text-lg font-black text-[var(--text-color)] border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-400" />
              <span>بيانات المعلم الأساسية</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-color)]">اسم المعلم بالكامل <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أ. أحمد محمد علي"
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-color)] focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-color)]">رقم الهاتف <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-color)] focus:outline-none focus:border-brand-primary text-left"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-color)]">البريد الإلكتروني (اختياري - سيتم توليده تلقائياً إذا تركت الحقل فارغاً)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@example.com"
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-color)] focus:outline-none focus:border-brand-primary text-left"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-color)]">كلمة المرور (اختياري - سيتم توليد كلمة مرور عشوائية إذا تركت فارغاً)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="رمز المرور المؤقت"
                    className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-color)] focus:outline-none focus:border-brand-primary text-left"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[var(--text-secondary)] hover:text-[var(--text-color)]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-color)]">المادة العلمية <span className="text-red-500">*</span></label>
                <select
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-color)] focus:outline-none focus:border-brand-primary"
                >
                  <option value="">اختر المادة...</option>
                  {SUBJECTS.map((s) => (
                    <option key={s.key} value={s.key}>{s.val}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-color)]">حالة الحساب</label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-color)] focus:outline-none focus:border-brand-primary"
                >
                  <option value="active">نشط ومفعل</option>
                  <option value="disabled">معطل وموقوف</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-color)]">نظام التدريس (أونلاين/سنتر)</label>
                <select
                  value={teachingMode}
                  onChange={(e: any) => setTeachingMode(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-color)] focus:outline-none focus:border-brand-primary"
                >
                  <option value="online">أونلاين فقط</option>
                  <option value="center">سنتر فقط</option>
                  <option value="both">أونلاين + سنتر</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[var(--text-color)]">الخبرة وسنوات التدريس <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="مثال: خبرة 12 سنة بوزارة التربية والتعليم ومؤلف كتاب العبقري"
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-color)] focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[var(--text-color)]">النبذة التعريفية للملف الشخصي (Bio)</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="نبذة مختصرة تظهر للطلاب في بطاقة المعلم..."
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl p-4 text-xs text-[var(--text-color)] focus:outline-none focus:border-brand-primary"
                />
              </div>

            </div>

            {/* Profile Avatar Upload */}
            <div className="space-y-2">
              <label className="text-xs font-semibold block text-[var(--text-color)]/90">الصورة الشخصية</label>
              <div className="flex items-center gap-4 bg-[var(--bg-color)]/10 border border-[var(--border-color)] p-4 rounded-2xl">
                <div className="relative h-16 w-16 shrink-0 rounded-full border border-[var(--border-color)] overflow-hidden bg-[var(--bg-color)]/20 flex items-center justify-center">
                  {avatar ? (
                    <img src={avatar} alt="Avatar Preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-[var(--text-secondary)]/50 font-light">لا توجد صورة</span>
                  )}
                </div>
                <div className="space-y-1 flex-grow">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="text-xs text-[var(--text-secondary)] file:ml-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer"
                  />
                  {uploading && <div className="text-xs text-brand-primary animate-pulse font-bold mt-1">جاري الرفع...</div>}
                </div>
              </div>
            </div>

            {/* Grades Selection */}
            <div className="space-y-3">
              <label className="text-xs font-semibold block text-[var(--text-color)]/90">
                اختر المراحل الدراسية للمعلم <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {GRADES.map((g) => {
                  const isChecked = selectedGrades.includes(g.key)
                  return (
                    <button
                      type="button"
                      key={g.key}
                      onClick={() => handleGradeToggle(g.key)}
                      className={`px-4 py-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                          : 'bg-[var(--input-bg)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-color)]/25'
                      }`}
                    >
                      {g.val}
                    </button>
                  )
                })}
              </div>
            </div>

          </div>

          {/* 2. Subscription Customization */}
          <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 space-y-6">
            <h2 className="text-lg font-black text-[var(--text-color)] border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <span>تخصيص باقة الاشتراك والمساحة الإضافية</span>
            </h2>

            {/* Plan Selector Grid */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[var(--text-color)] block">اختر خطة الاشتراك الأساسية:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((p) => {
                  const isSelected = Number(selectedPlanId) === Number(p.id)
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setSelectedPlanId(Number(p.id))}
                      className={`flex flex-col text-right p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary/5 text-[var(--text-color)] shadow-md ring-1 ring-brand-primary/30'
                          : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-color)]/20'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm font-black">{p.name}</span>
                        <span className="text-xs font-black text-brand-primary">{getCardPrice(p.price, p).toFixed(2)} ج.م</span>
                      </div>
                      <div className="text-[10px] space-y-1 font-light text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1.5">
                          <Database className="w-3 h-3 text-[var(--text-secondary)]/70" />
                          <span>تخزين: {p.storage} جيجابايت</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Hash className="w-3 h-3 text-[var(--text-secondary)]/70" />
                          <span>طلاب: {p.codes} كود</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Billing Cycle Selector */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-color)]">
              <label className="text-xs font-semibold text-[var(--text-secondary)] block">دورة الدفع للباقة الأساسية:</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as any)}
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-brand-primary font-bold"
              >
                <option value="monthly">
                  {`شهري (${getPlanDiscount(selectedPlan, 'monthly') > 0 ? `خصم ${getPlanDiscount(selectedPlan, 'monthly')}%` : 'بدون خصم'})`}
                </option>
                <option value="quarterly">
                  {`3 أشهر (${getPlanDiscount(selectedPlan, 'quarterly') > 0 ? `خصم ${getPlanDiscount(selectedPlan, 'quarterly')}%` : 'بدون خصم'})`}
                </option>
                <option value="semi_annual">
                  {`نصف سنوي (${getPlanDiscount(selectedPlan, 'semi_annual') > 0 ? `خصم ${getPlanDiscount(selectedPlan, 'semi_annual')}%` : 'بدون خصم'})`}
                </option>
                <option value="annual">
                  {`سنوي (${getPlanDiscount(selectedPlan, 'annual') > 0 ? `خصم ${getPlanDiscount(selectedPlan, 'annual')}%` : 'بدون خصم'})`}
                </option>
              </select>
            </div>

            {/* Customization Addons */}
            <div className="pt-4 border-t border-[var(--border-color)] space-y-6">
              <h3 className="text-sm font-bold text-[var(--text-color)]">الزيادات والموارد المخصصة (Subscription Customization)</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Custom Storage */}
                <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[var(--text-color)]">تخزين إضافي (جيجابايت)</span>
                    <span className="text-[10px] text-brand-primary font-bold">1 جيجا = 15 ج.م</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={extraStorage}
                    onChange={(e) => setExtraStorage(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-color)] focus:outline-none focus:border-brand-primary"
                    placeholder="0"
                  />
                  <div className="text-[10px] text-[var(--text-secondary)] font-light flex justify-between">
                    <span>التكلفة الإضافية للتخزين:</span>
                    <span className="font-bold text-[var(--text-color)]">{extraStorageCost} ج.م</span>
                  </div>
                </div>

                {/* Custom Codes */}
                <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[var(--text-color)]">أكواد طلاب إضافية</span>
                    <span className="text-[10px] text-brand-primary font-bold">1 كود = 5 ج.م</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={extraCodes}
                    onChange={(e) => setExtraCodes(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-color)] focus:outline-none focus:border-brand-primary"
                    placeholder="0"
                  />
                  <div className="text-[10px] text-[var(--text-secondary)] font-light flex justify-between">
                    <span>التكلفة الإضافية للأكواد:</span>
                    <span className="font-bold text-[var(--text-color)]">{extraCodesCost} ج.م</span>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* Right Side: Total Cost Card */}
        <div className="space-y-6">
          <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 shadow-md space-y-6 sticky top-24">
            <h2 className="text-lg font-black text-[var(--text-color)] border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
              <Coins className="w-5 h-5 text-brand-primary" />
              <span>تفاصيل فاتورة الاشتراك</span>
            </h2>

            {/* Calculations Breakdown */}
            <div className="space-y-4 text-xs font-medium">
              <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">سعر الباقة الأساسية ({selectedPlan.name} × {billingMonths} أشهر):</span>
                <span className="text-[var(--text-color)] font-bold">{basePlanPrice.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">قيمة الخصم ({discountPercent}%):</span>
                <span className="text-rose-400 font-bold">-{discountAmount.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">سعر الباقة بعد الخصم:</span>
                <span className="text-[var(--text-color)] font-bold">{planCost.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">سعر الموارد الإضافية:</span>
                <span className="text-[var(--text-color)] font-bold">{addonsPrice.toFixed(2)} ج.م</span>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] pr-2 space-y-1">
                <div>• مساحة تخزين (+{extraStorage} جيجا): {extraStorageCost.toFixed(2)} ج.م</div>
                <div>• أكواد طلاب (+{extraCodes} كود): {extraCodesCost.toFixed(2)} ج.م</div>
              </div>
              <div className="flex justify-between items-center py-3 text-sm font-black text-[var(--text-color)] bg-brand-primary/5 px-4 rounded-xl border border-brand-primary/10">
                <span className="text-brand-primary">الإجمالي النهائي:</span>
                <span className="text-brand-primary text-base">{totalCost.toFixed(2)} ج.م</span>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="space-y-3 pt-3">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-lg shadow-brand-primary/15 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'جاري الحفظ والإنشاء...' : 'تأكيد الحساب والاشتراك'}</span>
              </button>
              <Link
                to="/admin/teachers"
                className="w-full flex items-center justify-center py-3 bg-[var(--bg-color)]/20 hover:bg-[var(--bg-color)]/40 text-[var(--text-secondary)] hover:text-[var(--text-color)] rounded-xl text-xs font-bold transition-colors cursor-pointer border border-[var(--border-color)]"
              >
                <span>إلغاء والعودة للقائمة</span>
              </Link>
            </div>

          </div>
        </div>

      </form>

    </div>
  )
}
