import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import API from '../../services/api'
import { 
  ArrowRight, Shield, Award, HardDrive, 
  Users, Calendar, Clock, DollarSign, PlusCircle, 
  CheckCircle, AlertCircle, RefreshCw, FileText, AlertTriangle
} from 'lucide-react'
import { useModalStore } from '../../store/modalStore'

interface Plan {
  id: number
  name: string
  video_storage_gb: number
  student_codes: number
  price_egp: number
  is_popular?: boolean
  is_trial?: boolean
  billing_options?: any
}

interface Subscription {
  id: number
  plan: Plan
  start_date: string
  end_date: string
  status: string
  used_storage_bytes: number
  used_codes: number
  extra_storage_gb: number
  extra_codes: number
  total_storage_gb: number
  total_codes: number
  remaining_storage_gb: number
  remaining_codes: number
  storage_percentage: number
  students_count: number
}

interface Addon {
  id: number
  type: string
  amount: number
  price_egp: number
  created_at: string
}

interface Payment {
  id: number
  amount: number
  payment_status: string
  payment_date: string | null
  admin_name: string | null
  notes: string | null
  created_at: string
}

interface Teacher {
  id: number
  name: string
  email: string
  phone: string;
}

export default function TeacherSubscription() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [addons, setAddons] = useState<Addon[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)

  // Plan Upgrading State
  const [selectedPlanId, setSelectedPlanId] = useState<number>(0)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'quarterly' | 'semi_annual' | 'annual'>('monthly')
  const [updatingPlan, setUpdatingPlan] = useState(false)

  // Addons states
  const [addonType, setAddonType] = useState<'storage' | 'codes'>('storage')
  const [addonAmount, setAddonAmount] = useState<number>(0)
  const [addingAddon, setAddingAddon] = useState(false)

  // Live calculator states
  const [calcPlanId, setCalcPlanId] = useState<number>(0)
  const [calcStorage, setCalcStorage] = useState<number>(0)
  const [calcCodes, setCalcCodes] = useState<number>(0)

  // Payment Confirmation states
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null)
  const [paymentStatusInput, setPaymentStatusInput] = useState<string>('Paid')
  const [paymentNotes, setPaymentNotes] = useState<string>('')
  const [updatingPayment, setUpdatingPayment] = useState(false)

  // Override admin states
  const [resourceOverrides, setResourceOverrides] = useState<{
    base_storage_gb: number
    base_student_codes: number
    extra_storage_gb: number
    extra_student_codes: number
    storage_limit_gb: number
    student_codes_limit: number
    plan_name: string
  } | null>(null)
  
  const [extraStorageInput, setExtraStorageInput] = useState<number>(0)
  const [extraCodesInput, setExtraCodesInput] = useState<number>(0)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideSubmitting, setOverrideSubmitting] = useState(false)

  // Message alert states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await API.get(`/admin/teachers/${id}/subscription`)
      setTeacher(res.data.teacher)
      setSubscription(res.data.subscription)
      setAddons(res.data.addons)
      setPayments(res.data.payments)
      setPlans(res.data.plans)
      setSettings(res.data.settings)

      // Initialize defaults
      if (res.data.subscription?.plan) {
        setSelectedPlanId(res.data.subscription.plan.id)
        setCalcPlanId(res.data.subscription.plan.id)
      }

      // Load resources overrides
      try {
        const overridesRes = await API.get(`/admin/teachers/${id}/resources`)
        setResourceOverrides(overridesRes.data)
        setExtraStorageInput(overridesRes.data.extra_storage_gb)
        setExtraCodesInput(overridesRes.data.extra_student_codes)
      } catch (errOverrides) {
        console.error("Failed to load resources overrides:", errOverrides)
      }
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل تحميل بيانات الاشتراك.', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const getBillingCycleDetails = (plan: any, period: 'monthly' | 'quarterly' | 'semi_annual' | 'annual') => {
    let months = 1;
    let discountPercent = 0;
    
    // Check if custom billing options exist and are enabled
    if (plan && plan.billing_options) {
      let opts = plan.billing_options;
      if (typeof opts === 'string') {
        try { opts = JSON.parse(opts); } catch(e) { opts = {}; }
      }
      
      let cycleKey: string = period;
      if (cycleKey === 'quarterly') {
        cycleKey = 'three_months';
      } else if (cycleKey === 'semi_annual') {
        cycleKey = 'six_months';
      } else if (cycleKey === 'annual') {
        cycleKey = 'yearly';
      }
      
      if (opts[cycleKey]?.enabled) {
        const price = Number(opts[cycleKey].price) || 0;
        const discount = Number(opts[cycleKey].discount) || 0;
        const finalPrice = price - (price * discount / 100);
        
        if (period === 'quarterly') months = 3;
        else if (period === 'semi_annual') months = 6;
        else if (period === 'annual') months = 12;
        
        return {
          months,
          discountPercent: discount,
          basePrice: price,
          discountAmount: price * (discount / 100),
          finalPrice: finalPrice
        };
      }
    }

    const basePricePerMonth = plan ? (Number(plan.price_egp) || 0) : 0;
    
    if (period === 'quarterly') {
      months = 3;
      discountPercent = 0;
    } else if (period === 'semi_annual') {
      months = 6;
      discountPercent = parseFloat(settings?.discount_semi_annually || '10');
    } else if (period === 'annual') {
      months = 12;
      discountPercent = parseFloat(settings?.discount_annually || '20');
    }
    
    const basePrice = basePricePerMonth * months;
    const discountAmount = basePrice * (discountPercent / 100);
    const finalPrice = basePrice - discountAmount;
    
    return {
      months,
      discountPercent,
      basePrice,
      discountAmount,
      finalPrice
    };
  }

  // Sync Storage
  const triggerSync = async () => {
    try {
      setSyncing(true)
      await API.get(`/admin/teachers/${id}/subscription`) // Backend automatically syncs storage on GET
      await loadData()
      showToast('تمت مزامنة المساحة التخزينية بنجاح من Bunny Stream.', 'success')
    } catch (err: any) {
      console.error(err)
      showToast('فشل مزامنة مساحة التخزين.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // Handle Plan Update
  const handlePlanUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlanId) return

    try {
      setUpdatingPlan(true)
      await API.post(`/admin/teachers/${id}/subscription/plan`, {
        plan_id: Number(selectedPlanId),
        billing_period: billingPeriod,
      })
      showToast('تم تحديث خطة الاشتراك وتفعيل الباقة بنجاح.', 'success')
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'حدث خطأ أثناء ترقية الباقة.', 'error')
    } finally {
      setUpdatingPlan(false)
    }
  }

  // Handle Addon Add
  const handleAddonAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (addonAmount <= 0) {
      showToast('يرجى تحديد كمية صالحة أكبر من الصفر.', 'warning')
      return
    }

    try {
      setAddingAddon(true)
      await API.post(`/admin/teachers/${id}/subscription/addons`, {
        type: addonType,
        amount: addonAmount,
      })
      showToast('تمت إضافة الإضافة بنجاح، وتم إنشاء فاتورة بالمعاملة معلقة الدفع.', 'success')
      setAddonAmount(0)
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل إضافة الإضافات.', 'error')
    } finally {
      setAddingAddon(false)
    }
  }

  // Handle Payment Update
  const handlePaymentUpdate = async (paymentId: number) => {
    try {
      setUpdatingPayment(true)
      await API.post(`/admin/teachers/${id}/subscription/payments`, {
        payment_id: paymentId,
        payment_status: paymentStatusInput,
        notes: paymentNotes,
      })
      showToast('تم تحديث حالة الدفع وتسجيل تاريخ السداد بنجاح.', 'success')
      setEditingPaymentId(null)
      setPaymentNotes('')
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل تحديث حالة الفاتورة.', 'error')
    } finally {
      setUpdatingPayment(false)
    }
  }

  const handleSaveOverrides = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setOverrideSubmitting(true)
      await API.put(`/admin/teachers/${id}/resources`, {
        extra_storage_gb: Number(extraStorageInput),
        extra_student_codes: Number(extraCodesInput)
      })
      showToast('تم تحديث الموارد بنجاح.', 'success')
      setShowOverrideModal(false)
      await loadData(true)
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل تحديث الموارد.', 'error')
    } finally {
      setOverrideSubmitting(false)
    }
  }

  const handleRemoveOverrides = () => {
    useModalStore.getState().showConfirm({
      title: 'إزالة وتصفير الموارد الإضافية',
      description: `هل أنت متأكد من رغبتك في إزالة الموارد الإضافية المخصصة لهذا المعلم وإعادتها للصفر؟`,
      confirmText: 'نعم، إزالة الموارد',
      cancelText: 'إلغاء',
      type: 'delete',
      onConfirm: async () => {
        try {
          await API.delete(`/admin/teachers/${id}/resources`)
          showToast('تمت إزالة الموارد الإضافية بنجاح.', 'success')
          await loadData(true)
        } catch (err: any) {
          console.error(err)
          showToast('فشل إزالة الموارد.', 'error')
        }
      }
    })
  }

  // Live Calculation Computation
  const calculateAddonPrice = (type: 'storage' | 'codes', amount: number) => {
    if (amount <= 0) return 0
    if (!settings) {
      return type === 'storage' ? amount * 15 : amount * 5
    }

    const packagesRaw = type === 'storage' 
      ? settings.extra_storage_packages 
      : settings.extra_codes_packages

    if (!packagesRaw) {
      return type === 'storage' ? amount * 15 : amount * 5
    }

    const packages: { [key: number]: number } = {}
    Object.keys(packagesRaw).forEach(k => {
      packages[Number(k)] = Number(packagesRaw[k])
    })

    const sortedKeys = Object.keys(packages)
      .map(Number)
      .sort((a, b) => b - a)

    let price = 0
    let remaining = amount

    for (const pkgAmount of sortedKeys) {
      if (pkgAmount <= 0) continue
      const count = Math.floor(remaining / pkgAmount)
      if (count > 0) {
        price += count * packages[pkgAmount]
        remaining %= pkgAmount
      }
    }

    if (remaining > 0) {
      if (type === 'storage') {
        const unitPrice = packages[1] !== undefined ? packages[1] : 15
        price += remaining * unitPrice
      } else {
        const keys = Object.keys(packages).map(Number).sort((a, b) => a - b)
        if (keys.length > 0) {
          const smallestKey = keys[0]
          const smallestPrice = packages[smallestKey]
          price += Math.ceil(remaining / smallestKey) * smallestPrice
        } else {
          price += remaining * 5
        }
      }
    }

    return price
  }

  const activeCalcPlan = plans.find(p => Number(p.id) === Number(calcPlanId))
  const planCost = activeCalcPlan ? Number(activeCalcPlan.price_egp) : 0
  const storageCost = calculateAddonPrice('storage', calcStorage)
  const codesCost = calculateAddonPrice('codes', calcCodes)
  const totalCost = planCost + storageCost + codesCost

  // Status Badge Selector Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <span className="px-3 py-1 text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/30">نشط</span>
      case 'Expiring Soon':
        return <span className="px-3 py-1 text-xs font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-500/30">ينتهي قريباً</span>
      case 'Expired':
        return <span className="px-3 py-1 text-xs font-bold bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-500/30">منتهي</span>
      case 'Suspended':
        return <span className="px-3 py-1 text-xs font-bold bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full border border-purple-200 dark:border-purple-500/30">معلق</span>
      default:
        return <span className="px-3 py-1 text-xs font-bold bg-[var(--border-color)] text-[var(--text-secondary)] rounded-full border border-[var(--border-color)]">{status}</span>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-brand-primary">
        <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!teacher || !subscription) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <AlertTriangle className="mx-auto w-16 h-16 text-rose-600 dark:text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-color)] mb-2">المعلم غير موجود</h2>
        <p className="text-[var(--text-secondary)] mb-6">لم نتمكن من العثور على بيانات هذا المعلم في قاعدة البيانات.</p>
        <Link to="/admin/teachers" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition">
          العودة لقائمة المعلمين
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-right" dir="rtl">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-5 left-5 z-50 px-6 py-3.5 rounded-xl border shadow-xl flex items-center gap-3 transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/30' : 
          toast.type === 'error' ? 'bg-rose-950/90 text-rose-400 border-rose-500/30' : 
          'bg-amber-950/90 text-amber-400 border-amber-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-zinc-400 hover:text-white transition text-xs mb-2">
            <ArrowRight className="w-4 h-4" />
            <Link to="/admin/teachers">إدارة المعلمين</Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-color)]">إدارة اشتراك المعلم: {teacher.name}</h1>
          <p className="text-[var(--text-secondary)] text-xs mt-1">البريد الإلكتروني: {teacher.email} | الهاتف: {teacher.phone}</p>
        </div>
        <button
          onClick={triggerSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-primary to-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-indigo-500/10 active:scale-95 disabled:opacity-50 transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'جاري المزامنة...' : 'مزامنة مساحة Bunny Stream'}
        </button>
      </div>

      {/* Grid Layout: Main info and payment status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Subscription Info Card */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              بيانات الاشتراك الحالي
            </h2>
            {getStatusBadge(subscription.status)}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
              <span className="text-[var(--text-secondary)] text-[10px] block mb-1">اسم الباقة الحالية</span>
              <span className="text-sm font-bold text-[var(--text-color)]">{subscription.plan?.name || 'مخصص'}</span>
            </div>
            <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
              <span className="text-[var(--text-secondary)] text-[10px] block mb-1">الطلاب المشتركون</span>
              <span className="text-sm font-bold text-[var(--text-color)]">{subscription.students_count} طالب</span>
            </div>
            <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
              <span className="text-[var(--text-secondary)] text-[10px] block mb-1">الكورسات المضافة</span>
              <span className="text-sm font-bold text-[var(--text-color)]">{(subscription as any).courses_count ?? 0} كورس</span>
            </div>
            <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
              <span className="text-[var(--text-secondary)] text-[10px] block mb-1">أرباح المدرس الإجمالية</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{(subscription as any).current_revenue ?? 0} ج.م</span>
            </div>
            <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
              <span className="text-[var(--text-secondary)] text-[10px] block mb-1">الأيام المتبقية للاشتراك</span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{(subscription as any).remaining_days ?? 0} يوم</span>
            </div>
            <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
              <span className="text-[var(--text-secondary)] text-[10px] block mb-1">حالة الدفع الأخيرة</span>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                (subscription as any).payment_status === 'Paid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                (subscription as any).payment_status === 'Pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-500' :
                (subscription as any).payment_status === 'Refunded' ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-500' :
                'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400'
              }`}>
                {(subscription as any).payment_status === 'Paid' ? 'تم الدفع' : 
                 (subscription as any).payment_status === 'Pending' ? 'معلق' : 
                 (subscription as any).payment_status === 'Refunded' ? 'مسترجع' : 'غير مدفوع'}
              </span>
            </div>
            <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
              <span className="text-[var(--text-secondary)] text-[10px] block mb-1">تاريخ بداية الاشتراك</span>
              <span className="text-xs font-bold text-[var(--text-color)]">{subscription.start_date}</span>
            </div>
            <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
              <span className="text-[var(--text-secondary)] text-[10px] block mb-1">تاريخ نهاية الاشتراك</span>
              <span className="text-xs font-bold text-[var(--text-color)]">{subscription.end_date}</span>
            </div>
          </div>

          {/* Quota Progress */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[var(--text-secondary)]/70" />
                  أكواد الطلاب المنتجة (سعة الطلاب النشطة)
                </span>
                <span className="font-semibold text-[var(--text-color)]">
                  {subscription.used_codes} / {subscription.total_codes} كود
                </span>
              </div>
              <div className="w-full bg-[var(--bg-color)]/30 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (subscription.used_codes / (subscription.total_codes || 1)) * 100)}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-1 flex justify-between items-center">
                <span>أكواد الباقة الأساسية ({subscription.plan?.student_codes} كود) + إضافات أكواد (+{subscription.extra_codes} كود)</span>
                <span className="font-bold text-indigo-500">الأكواد المتبقية: {(subscription as any).remaining_codes ?? 0} كود</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-[var(--text-secondary)]/70" />
                  مساحة تخزين الفيديو المتاحة (Bunny Stream)
                </span>
                <span className="font-semibold text-[var(--text-color)]">
                  {roundSize(subscription.used_storage_bytes)} / {subscription.total_storage_gb} جيجابايت
                </span>
              </div>
              <div className="w-full bg-[var(--bg-color)]/30 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    subscription.storage_percentage >= 90 ? 'bg-rose-500' : 
                    subscription.storage_percentage >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${subscription.storage_percentage}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-1 flex justify-between items-center">
                <span>مساحة الباقة الأساسية ({subscription.plan?.video_storage_gb} جيجا) + إضافات مساحة (+{subscription.extra_storage_gb} جيجا)</span>
                <span className="font-bold text-indigo-500">المساحة المتبقية: {(subscription as any).remaining_storage_gb ?? 0} جيجابايت</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Confirmation Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              حالة المدفوعات والفواتير
            </h2>
            <p className="text-[var(--text-secondary)] text-xs mb-6">
              من هنا يمكنك مراجعة وتحديث حالة فواتير الباقات أو الإضافات التي يطلبها المعلم.
            </p>

            {payments.length === 0 ? (
              <div className="bg-[var(--bg-color)]/20 p-6 rounded-xl border border-dashed border-[var(--border-color)] text-center">
                <p className="text-[var(--text-secondary)]/50 text-xs">لا يوجد أي فواتير مسجلة حالياً.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                {payments.map(p => (
                  <div key={p.id} className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[var(--text-color)] block">{p.amount} جنيه مصري</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">{p.notes || 'تجديد/ترقية اشتراك'}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                        p.payment_status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        p.payment_status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        p.payment_status === 'Refunded' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {p.payment_status === 'Paid' ? 'تم الدفع' : p.payment_status === 'Pending' ? 'معلق' : p.payment_status === 'Refunded' ? 'مسترجع' : 'غير مدفوع'}
                      </span>
                      {editingPaymentId !== p.id ? (
                        <button
                          onClick={() => {
                            setEditingPaymentId(p.id)
                            setPaymentStatusInput(p.payment_status)
                            setPaymentNotes(p.notes || '')
                          }}
                          className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                        >
                          تعديل الحالة
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {editingPaymentId && (
            <div className="mt-4 bg-[var(--bg-color)]/50 border border-[var(--border-color)] p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-[var(--text-color)]">تأكيد حالة السداد للفاتورة</h3>
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] block mb-1">الحالة</label>
                <select
                  value={paymentStatusInput}
                  onChange={(e) => setPaymentStatusInput(e.target.value)}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                >
                  <option value="Paid">مدفوعة (Paid)</option>
                  <option value="Pending">معلقة (Pending)</option>
                  <option value="Unpaid">غير مدفوعة (Unpaid)</option>
                  <option value="Refunded">مسترجعة (Refunded)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] block mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="رقم المعاملة، المحصل..."
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingPaymentId(null)}
                  className="px-2.5 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => handlePaymentUpdate(editingPaymentId)}
                  disabled={updatingPayment}
                  className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition cursor-pointer"
                >
                  {updatingPayment ? 'جاري الحفظ...' : 'تأكيد ودفع'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Additional Resources Overrides Card */}
      {resourceOverrides && (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-indigo-400" />
                إدارة الموارد الإضافية الاستثنائية
              </h2>
              <p className="text-[var(--text-secondary)] text-xs mt-1">تخصيص مساحات وأكواد إضافية للمعلم يدوياً خارج الباقة.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowOverrideModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 cursor-pointer"
              >
                تعديل الموارد
              </button>
              {(resourceOverrides.extra_storage_gb > 0 || resourceOverrides.extra_student_codes > 0) && (
                <button
                  type="button"
                  onClick={handleRemoveOverrides}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 cursor-pointer"
                >
                  تصفير الزيادات
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Storage override column */}
            <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-5 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold border-b border-[var(--border-color)] pb-2 text-[var(--text-secondary)]">مساحة التخزين</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">المساحة الأساسية بالباقة (Base):</span>
                  <span className="font-bold text-[var(--text-color)]">{resourceOverrides.base_storage_gb} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">المساحة الإضافية يدوياً (Extra):</span>
                  <span className="font-bold text-amber-500">+{resourceOverrides.extra_storage_gb} GB</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-dashed border-[var(--border-color)] text-sm">
                  <span className="font-extrabold text-[var(--text-color)]">الحد النهائي للمساحة (Final):</span>
                  <span className="font-black text-emerald-400">{resourceOverrides.storage_limit_gb} GB</span>
                </div>
              </div>
            </div>

            {/* Student codes override column */}
            <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-5 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold border-b border-[var(--border-color)] pb-2 text-[var(--text-secondary)]">أكواد الطلاب</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">أكواد الطلاب الأساسية بالباقة (Base):</span>
                  <span className="font-bold text-[var(--text-color)]">{resourceOverrides.base_student_codes} كود</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">أكواد إضافية يدوياً (Extra):</span>
                  <span className="font-bold text-amber-500">+{resourceOverrides.extra_student_codes} كود</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-dashed border-[var(--border-color)] text-sm">
                  <span className="font-extrabold text-[var(--text-color)]">الحد النهائي للأكواد (Final):</span>
                  <span className="font-black text-emerald-400">{resourceOverrides.student_codes_limit} كود</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/60 z-40" onClick={() => setShowOverrideModal(false)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl z-50 text-right">
            <div>
              <h3 className="text-base font-black text-[var(--text-color)]">تعديل الموارد الإضافية</h3>
              <p className="text-[10px] text-slate-400 mt-1">تعديل الموارد الاستثنائية المخصصة للمعلم: <strong className="text-white">{teacher?.name}</strong></p>
            </div>

            <form onSubmit={handleSaveOverrides} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold block text-slate-300">المساحة الإضافية (بالجيجابايت GB):</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={extraStorageInput}
                  onChange={(e) => setExtraStorageInput(Number(e.target.value))}
                  placeholder="مثال: 5"
                  className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold block text-slate-300">أكواد الطلاب الإضافية يدوياً:</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={extraCodesInput}
                  onChange={(e) => setExtraCodesInput(Number(e.target.value))}
                  placeholder="مثال: 20"
                  className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none text-right"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl text-slate-300 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {overrideSubmitting ? 'جاري الحفظ...' : 'حفظ وتحديث الموارد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Platform Plans Section & Live Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Available Plans */}
        {/* Available Plans */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-indigo-400" />
            خطط ترقية الاشتراك المتاحة
          </h2>
          <p className="text-[var(--text-secondary)] text-xs mb-6">
            اختر خطة ترقية الاشتراك للمعلم لتعديل خصائصه الأساسية (المساحة وعدد أكواد الطلاب).
          </p>

          <form onSubmit={handlePlanUpdate} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {plans.filter(p => !p.is_trial).map(p => {
                const cycle = getBillingCycleDetails(p, billingPeriod);
                return (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedPlanId(Number(p.id))}
                    className={`border-2 rounded-xl p-4 cursor-pointer text-center relative transition-all ${
                      Number(selectedPlanId) === Number(p.id) 
                        ? 'border-indigo-500 bg-indigo-500/10' 
                        : 'border-[var(--border-color)] hover:border-indigo-500/50 bg-[var(--bg-color)]/20'
                    }`}
                  >
                    {subscription.plan?.id === p.id && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-[8px] px-2 py-0.5 rounded font-extrabold text-white uppercase tracking-wider">
                        الباقة الحالية
                      </span>
                    )}
                    {p.is_popular && (
                      <span className="absolute -top-2.5 right-2 bg-amber-500 text-zinc-950 text-[8px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider">
                        الأكثر استخداماً
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-[var(--text-color)] mb-2">{p.name}</h3>
                    <div className="text-lg font-black text-[var(--text-color)] mb-1">{cycle.finalPrice.toFixed(2)} EGP</div>
                    {cycle.discountPercent > 0 && (
                      <div className="text-[9px] text-[var(--text-secondary)] line-through mb-2">
                        {cycle.basePrice.toFixed(2)} EGP
                      </div>
                    )}
                    <div className="space-y-1.5 text-[10px] text-[var(--text-secondary)]">
                      <p className="flex items-center justify-center gap-1">
                        <Users className="w-3 h-3 text-indigo-500" />
                        {p.student_codes} كود طلاب (سعة الطلاب)
                      </p>
                      <p className="flex items-center justify-center gap-1">
                        <HardDrive className="w-3 h-3 text-emerald-500" />
                        {p.video_storage_gb} جيجا فيديو
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Invoice Summary */}
            {(() => {
              const selectedPlan = plans.find(p => Number(p.id) === Number(selectedPlanId));
              if (!selectedPlan) return null;
              const details = getBillingCycleDetails(selectedPlan, billingPeriod);
              return (
                <div className="bg-[var(--bg-color)]/70 p-4 rounded-xl border border-[var(--border-color)] space-y-2 mt-4">
                  <h4 className="text-xs font-black text-[var(--text-color)] mb-2 border-b border-[var(--border-color)] pb-2">ملخص الفاتورة والأسعار المقدرة:</h4>
                  <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                    <span>السعر الأساسي ({details.months} أشهر):</span>
                    <span>{details.basePrice.toFixed(2)} EGP</span>
                  </div>
                  {details.discountPercent > 0 && (
                    <div className="flex justify-between text-xs text-rose-500 font-bold">
                      <span>خصم ({details.discountPercent}%):</span>
                      <span>-{details.discountAmount.toFixed(2)} EGP</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-[var(--text-color)] pt-2 border-t border-dashed border-[var(--border-color)]">
                    <span>المبلغ النهائي:</span>
                    <span className="text-emerald-500 font-black">{details.finalPrice.toFixed(2)} EGP</span>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col sm:flex-row gap-4 items-end bg-[var(--bg-color)]/50 p-4 rounded-xl border border-[var(--border-color)]">
              <div className="flex-1 w-full">
                <label className="text-[11px] text-[var(--text-secondary)] block mb-1">دورة الفاتورة المحددة للمعلم</label>
                <select
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value as any)}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg px-3 py-2 text-xs focus:outline-none font-bold"
                >
                  <option value="monthly">شهري (بدون خصم)</option>
                  <option value="quarterly">3 أشهر (بدون خصم)</option>
                  <option value="semi_annual">نصف سنوي (خصم 10%)</option>
                  <option value="annual">سنوي (خصم 20%)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={updatingPlan}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg active:scale-95 transition cursor-pointer"
              >
                {updatingPlan ? 'جاري ترقية الباقة...' : 'حفظ ترقية الباقة'}
              </button>
            </div>
          </form>
        </div>

        {/* Live Calculation Panel */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-purple-400" />
              آلة حاسبة تكاليف الباقة الحية
            </h2>
            <p className="text-[var(--text-secondary)] text-xs mb-4">
              احسب تكاليف الاشتراك والإضافات الحالية والجديدة فوراً وبشكل ديناميكي.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] block mb-1">الباقة المختارة</label>
                <select
                  value={calcPlanId}
                  onChange={(e) => setCalcPlanId(Number(e.target.value))}
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg px-3 py-2 text-xs focus:outline-none"
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.price_egp} جنيه)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-secondary)] block mb-1">إضافة مساحة (جيجابايت)</label>
                <input
                  type="number"
                  min="0"
                  value={calcStorage === 0 ? '' : calcStorage}
                  onChange={(e) => setCalcStorage(Math.max(0, Number(e.target.value)))}
                  placeholder="0 جيجا إضافي"
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-secondary)] block mb-1">إضافة أكواد طلاب</label>
                <input
                  type="number"
                  min="0"
                  value={calcCodes === 0 ? '' : calcCodes}
                  onChange={(e) => setCalcCodes(Math.max(0, Number(e.target.value)))}
                  placeholder="0 كود إضافي"
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg px-3 py-2 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border-color)] space-y-2">
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>تكلفة الباقة الأساسية:</span>
              <span>{planCost} جنيه</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>تكلفة المساحة الإضافية:</span>
              <span>{storageCost.toFixed(2)} جنيه</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>تكلفة الأكواد الإضافية:</span>
              <span>{codesCost.toFixed(2)} جنيه</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-[var(--text-color)] pt-2 border-t border-dashed border-[var(--border-color)]">
              <span>الإجمالي الكلي:</span>
              <span className="text-emerald-600 dark:text-emerald-400">{totalCost.toFixed(2)} جنيه مصري</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Extra Storage or Codes & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Add Addon Forms */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-2">
            <PlusCircle className="w-5 h-5 text-emerald-500" />
            زيادة مساحة أو أكواد
          </h2>
          <p className="text-[var(--text-secondary)] text-xs mb-4">
            إضافة موارد للمعلم بشكل مباشر دون تغيير باقته الأساسية.
          </p>

          <form onSubmit={handleAddonAdd} className="space-y-4">
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">نوع المورد</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAddonType('storage')}
                  className={`py-2 text-xs font-bold rounded-lg border transition ${
                    addonType === 'storage' 
                      ? 'bg-emerald-600 border-emerald-500 text-white' 
                      : 'bg-[var(--bg-color)]/20 border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)]'
                  }`}
                >
                  مساحة إضافية (GB)
                </button>
                <button
                  type="button"
                  onClick={() => setAddonType('codes')}
                  className={`py-2 text-xs font-bold rounded-lg border transition ${
                    addonType === 'codes' 
                      ? 'bg-emerald-600 border-emerald-500 text-white' 
                      : 'bg-[var(--bg-color)]/20 border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)]'
                  }`}
                >
                  أكواد إضافية
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">الكمية</label>
              <input
                type="number"
                min="1"
                required
                value={addonAmount === 0 ? '' : addonAmount}
                onChange={(e) => setAddonAmount(Math.max(0, Number(e.target.value)))}
                placeholder={addonType === 'storage' ? 'جيجابايت إضافية' : 'عدد الأكواد الإضافية'}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg px-3 py-2 text-xs focus:outline-none"
              />
            </div>

            <div className="bg-[var(--bg-color)]/50 p-3 rounded-lg border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)]">
              <div className="flex justify-between">
                <span>حساب التكلفة:</span>
                <span>بناءً على باقات الإضافات المعتمدة</span>
              </div>
              <div className="flex justify-between font-bold text-[var(--text-color)] mt-1">
                <span>القيمة المطلوبة:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{calculateAddonPrice(addonType, addonAmount).toFixed(2)} جنيه</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={addingAddon}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg active:scale-95 transition cursor-pointer"
            >
              {addingAddon ? 'جاري حفظ الإضافة...' : 'تأكيد وزيادة الموارد'}
            </button>
          </form>
        </div>

        {/* Addons History List */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 overflow-hidden flex flex-col">
          <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            تاريخ الإضافات والموارد المشتراة
          </h2>
          <p className="text-[var(--text-secondary)] text-xs mb-4">
            سجل بجميع الإضافات المستقلة التي تم شحنها لحساب المعلم.
          </p>

          <div className="overflow-x-auto flex-grow max-h-[300px] overflow-y-auto">
            {addons.length === 0 ? (
              <div className="bg-[var(--bg-color)]/20 p-12 rounded-xl border border-dashed border-[var(--border-color)] text-center flex items-center justify-center">
                <p className="text-[var(--text-secondary)]/50 text-xs">لا توجد إضافات مشتراة لهذا المعلم بعد.</p>
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-secondary)]">
                    <th className="py-2.5 px-3">نوع الإضافة</th>
                    <th className="py-2.5 px-3">الكمية</th>
                    <th className="py-2.5 px-3">السعر الإجمالي</th>
                    <th className="py-2.5 px-3">تاريخ الإضافة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {addons.map(a => (
                    <tr key={a.id} className="text-[var(--text-color)] hover:bg-[var(--bg-color)]/20">
                      <td className="py-3 px-3">
                        {a.type === 'storage' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">مساحة تخزين فيديو</span>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400 font-bold">أكواد طلاب</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        {a.amount} {a.type === 'storage' ? 'جيجا' : 'كود'}
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">{a.price_egp} جنيه</td>
                      <td className="py-3 px-3 text-[var(--text-secondary)] text-[10px]">
                        {new Date(a.created_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function roundSize(bytes: number) {
  if (bytes <= 0) return '0'
  const gb = bytes / (1024 * 1024 * 1024)
  return gb.toFixed(2)
}
