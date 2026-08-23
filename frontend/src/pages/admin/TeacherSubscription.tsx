import React, { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import API from '../../services/api'
import { 
  ArrowRight, Shield, Award, HardDrive, 
  Users, Calendar, Clock, DollarSign, PlusCircle, 
  CheckCircle, AlertCircle, RefreshCw, FileText, AlertTriangle,
  ChevronLeft, LayoutDashboard, Calculator, Zap, Sliders, History
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
  plan?: Plan
  plan_id?: number
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
  courses_count?: number
  current_revenue?: number
  remaining_days?: number
  payment_status?: string
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
  phone: string
}

export default function TeacherSubscription() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // Tab Management (overview, payments, plans, calculator, addons, overrides)
  const activeTab = searchParams.get('tab') || 'overview'
  const setTab = (tabKey: string) => {
    setSearchParams({ tab: tabKey })
  }

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

  // Renewing State
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [renewBillingPeriod, setRenewBillingPeriod] = useState<'monthly' | 'quarterly' | 'semi_annual' | 'annual'>('monthly')
  const [renewing, setRenewing] = useState(false)

  // Addons states
  const [addonType, setAddonType] = useState<'storage' | 'codes'>('storage')
  const [addonAmount, setAddonAmount] = useState<number>(0)
  const [addingAddon, setAddingAddon] = useState(false)

  // Live calculator states
  const [calcPlanId, setCalcPlanId] = useState<number>(0)
  const [calcStorage, setCalcStorage] = useState<number>(0)
  const [calcCodes, setCalcCodes] = useState<number>(0)

  // Payment Confirmation states
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [paymentStatusInput, setPaymentStatusInput] = useState<string>('Paid')
  const [paymentNotes, setPaymentNotes] = useState<string>('')
  const [updatingPayment, setUpdatingPayment] = useState(false)

  // Override admin states
  const [resourceOverrides, setResourceOverrides] = useState<{
    base_storage_gb: number
    base_student_codes: number | null
    addon_storage_gb: number
    addon_student_codes: number
    manual_override_storage_gb: number
    manual_override_student_codes: number
    sales_storage_gb: number
    extra_storage_gb: number
    extra_student_codes: number
    storage_limit_gb: number
    student_codes_limit: number | null
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
      setAddons(res.data.addons || [])
      setPayments(res.data.payments || [])
      setPlans(res.data.plans || [])
      setSettings(res.data.settings)

      // Initialize defaults
      if (res.data.subscription?.plan?.id) {
        setSelectedPlanId(res.data.subscription.plan.id)
        setCalcPlanId(res.data.subscription.plan.id)
      } else if (res.data.plans?.length > 0) {
        setSelectedPlanId(res.data.plans[0].id)
        setCalcPlanId(res.data.plans[0].id)
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

  const getEffectivePlan = (): Plan | null => {
    if (subscription?.plan) return subscription.plan
    if (subscription?.plan_id) {
      const found = plans.find(p => p.id === subscription.plan_id)
      if (found) return found
    }
    return plans.length > 0 ? plans[0] : null
  }

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
        let baseMonths = 1;
        if (period === 'quarterly') baseMonths = 3;
        if (period === 'semi_annual') baseMonths = 6;
        if (period === 'annual') baseMonths = 12;
        
        const basePrice = (Number(plan.price_egp) || 0) * baseMonths;
        const discountAmount = Math.max(0, basePrice - price);
        const discPercent = basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0;
        
        return {
          months: baseMonths,
          basePrice,
          finalPrice: price,
          discountAmount,
          discountPercent: discPercent
        };
      }
    }

    if (period === 'monthly') {
      months = 1;
      discountPercent = 0;
    } else if (period === 'quarterly') {
      months = 3;
      discountPercent = 0;
    } else if (period === 'semi_annual') {
      months = 6;
      discountPercent = 10;
    } else if (period === 'annual') {
      months = 12;
      discountPercent = 20;
    }

    const basePrice = (Number(plan?.price_egp) || 0) * months;
    const discountAmount = (basePrice * discountPercent) / 100;
    const finalPrice = basePrice - discountAmount;

    return {
      months,
      basePrice,
      discountAmount,
      discountPercent,
      finalPrice
    };
  }

  // Handle Renew Subscription
  const handleRenewSubscription = async () => {
    try {
      setRenewing(true)
      await API.post(`/admin/teachers/${id}/subscription/renew`, {
        billing_period: renewBillingPeriod
      })
      showToast('تم تجديد الباقة الحالية للمعلم بنجاح وسجل الدفع التلقائي.', 'success')
      setShowRenewModal(false)
      loadData(true)
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل تجديد الاشتراك.', 'error')
    } finally {
      setRenewing(false)
    }
  }

  const getRenewEndDatePreview = (period: 'monthly' | 'quarterly' | 'semi_annual' | 'annual') => {
    const effPlan = getEffectivePlan()
    if (!subscription || !effPlan) return ''
    const details = getBillingCycleDetails(effPlan, period)
    const months = details.months
    const isActive = subscription.status === 'Active'
    
    let baseDate: Date
    if (isActive && subscription.end_date) {
      baseDate = new Date(subscription.end_date)
    } else {
      baseDate = new Date()
    }
    
    const newDate = new Date(baseDate)
    newDate.setMonth(newDate.getMonth() + months)
    
    return newDate.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Sync Storage
  const triggerSync = async () => {
    try {
      setSyncing(true)
      await API.get(`/admin/teachers/${id}/subscription`) // Backend automatically syncs storage on GET
      await loadData(true)
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
      loadData(true)
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
      showToast('تمت إضافة المورد بنجاح وإنشاء فاتورة بالمعاملة.', 'success')
      setAddonAmount(0)
      loadData(true)
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل إضافة المورد.', 'error')
    } finally {
      setAddingAddon(false)
    }
  }

  // Handle Payment Update
  const handlePaymentUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!editingPayment) return

    try {
      setUpdatingPayment(true)
      await API.post(`/admin/teachers/${id}/subscription/payments`, {
        payment_id: editingPayment.id,
        payment_status: paymentStatusInput,
        notes: paymentNotes,
      })
      showToast('تم تحديث حالة الدفع بنجاح.', 'success')
      setEditingPayment(null)
      setPaymentNotes('')
      loadData(true)
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <span className="px-3 py-1 text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/30">نشط</span>
      case 'Grace Period':
      case 'Expiring Soon':
        return <span className="px-3 py-1 text-xs font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-500/30">فترة سماح / ينتهي قريباً</span>
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
      <div className="max-w-4xl mx-auto px-4 py-12 text-center" dir="rtl">
        <AlertTriangle className="mx-auto w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-color)] mb-2">المعلم غير موجود</h2>
        <p className="text-[var(--text-secondary)] mb-6 text-xs">لم نتمكن من العثور على بيانات هذا المعلم في قاعدة البيانات.</p>
        <Link 
          to="/admin/teachers" 
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لقائمة المعلمين</span>
        </Link>
      </div>
    )
  }

  const effectivePlan = getEffectivePlan()

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-right space-y-6" dir="rtl">
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

      {/* Top Header & Breadcrumbs */}
      <div className="space-y-4">
        {/* Navigation Breadcrumb Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-color)]/60 pb-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/teachers"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-all duration-200 group cursor-pointer shadow-sm active:scale-95"
              title="العودة لإدارة المعلمين"
            >
              <ArrowRight className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>إدارة المعلمين</span>
            </Link>
            
            <nav className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Link to="/admin/dashboard" className="hover:text-white transition">الرئيسية</Link>
              <span>/</span>
              <Link to="/admin/teachers" className="hover:text-white transition">المعلمون</Link>
              <span>/</span>
              <span className="text-slate-200 font-bold">{teacher.name}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRenewModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-emerald-500/10 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تجديد الاشتراك</span>
            </button>
            <button
              type="button"
              onClick={triggerSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--card-bg)] hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] font-bold text-xs rounded-xl shadow-sm hover:shadow-indigo-500/10 active:scale-95 disabled:opacity-50 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'جاري المزامنة...' : 'مزامنة Bunny'}</span>
            </button>
          </div>
        </div>

        {/* Teacher Title Info */}
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[var(--text-color)]">
            إدارة اشتراك المعلم: {teacher.name}
          </h1>
          <p className="text-[var(--text-secondary)] text-xs mt-1">
            البريد الإلكتروني: <span className="font-mono text-slate-300">{teacher.email}</span> | الهاتف: <span className="font-mono text-slate-300">{teacher.phone || 'غير مسجل'}</span>
          </p>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)]'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>نظرة عامة والاشتراك</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('payments')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)]'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>سجل الدفع والفواتير</span>
            {payments.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-300">
                {payments.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab('plans')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'plans'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)]'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>ترقية وتعديل الخطة</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('addons')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'addons'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)]'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-teal-400" />
            <span>شحن مساحة وأكواد</span>
            {addons.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-teal-500/20 text-teal-300">
                {addons.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab('overrides')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'overrides'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)]'
            }`}
          >
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>الموارد الاستثنائية</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('calculator')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'calculator'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)]'
            }`}
          >
            <Calculator className="w-4 h-4 text-sky-400" />
            <span>الحاسبة الديناميكية</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT: Overview */}
      {(activeTab === 'overview' || activeTab === 'usage') && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subscription Info Card */}
            <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-400" />
                  بيانات الاشتراك الحالي
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRenewModal(true)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black rounded-xl hover:shadow-emerald-500/10 active:scale-95 transition cursor-pointer"
                  >
                    تجديد الاشتراك الحالي
                  </button>
                  {getStatusBadge(subscription.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
                  <span className="text-[var(--text-secondary)] text-[10px] block mb-1">اسم الباقة الحالية</span>
                  <span className="text-sm font-bold text-[var(--text-color)]">{effectivePlan?.name || 'مخصص'}</span>
                </div>
                <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
                  <span className="text-[var(--text-secondary)] text-[10px] block mb-1">الطلاب المشتركون</span>
                  <span className="text-sm font-bold text-[var(--text-color)]">{subscription.students_count} طالب</span>
                </div>
                <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
                  <span className="text-[var(--text-secondary)] text-[10px] block mb-1">الكورسات المضافة</span>
                  <span className="text-sm font-bold text-[var(--text-color)]">{subscription.courses_count ?? 0} كورس</span>
                </div>
                <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
                  <span className="text-[var(--text-secondary)] text-[10px] block mb-1">أرباح المدرس الإجمالية</span>
                  <span className="text-sm font-bold text-emerald-400">{subscription.current_revenue ?? 0} ج.م</span>
                </div>
                <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
                  <span className="text-[var(--text-secondary)] text-[10px] block mb-1">الأيام المتبقية للاشتراك</span>
                  <span className="text-sm font-bold text-indigo-400">{subscription.remaining_days ?? 0} يوم</span>
                </div>
                <div className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-4 rounded-xl">
                  <span className="text-[var(--text-secondary)] text-[10px] block mb-1">حالة الدفع الأخيرة</span>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                    subscription.payment_status === 'Paid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    subscription.payment_status === 'Pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                    subscription.payment_status === 'Refunded' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                    'bg-slate-500/10 border-slate-500/20 text-slate-400'
                  }`}>
                    {subscription.payment_status === 'Paid' ? 'تم الدفع' : 
                     subscription.payment_status === 'Pending' ? 'معلق' : 
                     subscription.payment_status === 'Refunded' ? 'مسترجع' : 'غير مدفوع'}
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
              <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
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
                    <span>أكواد الباقة الأساسية ({effectivePlan?.student_codes ?? 0} كود) + إضافات أكواد (+{subscription.extra_codes} كود)</span>
                    <span className="font-bold text-indigo-400">الأكواد المتبقية: {subscription.remaining_codes ?? 0} كود</span>
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
                    <span>مساحة الباقة الأساسية ({effectivePlan?.video_storage_gb ?? 0} جيجا) + إضافات مساحة (+{subscription.extra_storage_gb} جيجا)</span>
                    <span className="font-bold text-indigo-400">المساحة المتبقية: {subscription.remaining_storage_gb ?? 0} جيجابايت</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Payments Summary */}
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 flex flex-col justify-between space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  أحدث الفواتير والمدفوعات
                </h2>
                <p className="text-[var(--text-secondary)] text-xs mb-4">
                  ملخص بأحدث العمليات المالية المسجلة للمعلم.
                </p>

                {payments.length === 0 ? (
                  <div className="bg-[var(--bg-color)]/20 p-6 rounded-xl border border-dashed border-[var(--border-color)] text-center">
                    <p className="text-[var(--text-secondary)]/50 text-xs">لا يوجد أي فواتير مسجلة حالياً.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.slice(0, 3).map(p => (
                      <div key={p.id} className="bg-[var(--bg-color)]/30 border border-[var(--border-color)] p-3 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-[var(--text-color)] block">{p.amount} ج.م</span>
                          <span className="text-[10px] text-[var(--text-secondary)]">{p.notes || 'تجديد / ترقية'}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                            p.payment_status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            p.payment_status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            p.payment_status === 'Refunded' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          }`}>
                            {p.payment_status === 'Paid' ? 'تم الدفع' : p.payment_status === 'Pending' ? 'معلق' : p.payment_status === 'Refunded' ? 'مسترجع' : 'غير مدفوع'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPayment(p)
                              setPaymentStatusInput(p.payment_status)
                              setPaymentNotes(p.notes || '')
                            }}
                            className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                          >
                            تعديل الحالة
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[var(--border-color)] flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab('payments')}
                  className="flex-1 py-2 bg-brand-surface hover:bg-brand-surface/80 border border-[var(--border-color)] text-xs font-bold rounded-xl text-center cursor-pointer transition"
                >
                  عرض جميع الفواتير ({payments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('plans')}
                  className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl text-center cursor-pointer transition"
                >
                  ترقية الباقة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Payments List */}
      {activeTab === 'payments' && (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                سجل المدفوعات وفواتير المعلم
              </h2>
              <p className="text-[var(--text-secondary)] text-xs mt-1">
                سجل كامل بجميع الفواتير وحالات السداد مع إمكانية تعديل حالة الفواتير وتأكيد الدفع.
              </p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl">
              إجمالي الفواتير: {payments.length}
            </span>
          </div>

          {payments.length === 0 ? (
            <div className="bg-[var(--bg-color)]/20 p-12 rounded-2xl border border-dashed border-[var(--border-color)] text-center">
              <DollarSign className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-50" />
              <p className="text-[var(--text-secondary)] text-xs">لا يوجد أي فواتير مسجلة لهذا المعلم بعد.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-secondary)]">
                    <th className="py-3 px-3">رقم الفاتورة</th>
                    <th className="py-3 px-3">المبلغ</th>
                    <th className="py-3 px-3">حالة السداد</th>
                    <th className="py-3 px-3">تاريخ الدفع</th>
                    <th className="py-3 px-3">المسؤول / المشرف</th>
                    <th className="py-3 px-3">ملاحظات</th>
                    <th className="py-3 px-3 text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {payments.map(p => (
                    <tr key={p.id} className="text-[var(--text-color)] hover:bg-[var(--bg-color)]/20 transition">
                      <td className="py-3 px-3 font-mono font-bold">#{p.id}</td>
                      <td className="py-3 px-3 font-black text-emerald-400">{p.amount} ج.م</td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${
                          p.payment_status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          p.payment_status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          p.payment_status === 'Refunded' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}>
                          {p.payment_status === 'Paid' ? 'تم الدفع' : p.payment_status === 'Pending' ? 'معلق' : p.payment_status === 'Refunded' ? 'مسترجع' : 'غير مدفوع'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">
                        {p.payment_date ? new Date(p.payment_date).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : 'لم يتم الدفع بعد'}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)] font-medium">
                        {p.admin_name || 'النظام التلقائي'}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)] max-w-xs truncate">
                        {p.notes || '—'}
                      </td>
                      <td className="py-3 px-3 text-left">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPayment(p)
                            setPaymentStatusInput(p.payment_status)
                            setPaymentNotes(p.notes || '')
                          }}
                          className="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold transition cursor-pointer active:scale-95"
                        >
                          تعديل الحالة
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Plans & Upgrades */}
      {activeTab === 'plans' && (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-indigo-400" />
              خطط وترقية اشتراك المعلم
            </h2>
            <p className="text-[var(--text-secondary)] text-xs">
              اختر خطة ترقية الاشتراك للمعلم لتعديل الخصائص الأساسية (المساحة وعدد أكواد الطلاب).
            </p>
          </div>

          <form onSubmit={handlePlanUpdate} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {plans.filter(p => !p.is_trial).map(p => {
                const cycle = getBillingCycleDetails(p, billingPeriod);
                return (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedPlanId(Number(p.id))}
                    className={`border-2 rounded-2xl p-4 cursor-pointer text-center relative transition-all ${
                      Number(selectedPlanId) === Number(p.id) 
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10' 
                        : 'border-[var(--border-color)] hover:border-indigo-500/50 bg-[var(--bg-color)]/20'
                    }`}
                  >
                    {effectivePlan?.id === p.id && (
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
                  <h4 className="text-xs font-black text-[var(--text-color)] mb-2 border-b border-[var(--border-color)] pb-2">ملخص الفاتورة المقدرة:</h4>
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
                {(() => {
                  const selectedPlan = plans.find(p => Number(p.id) === Number(selectedPlanId));
                  const monthlyDisc = selectedPlan ? getBillingCycleDetails(selectedPlan, 'monthly').discountPercent : 0;
                  const quarterlyDisc = selectedPlan ? getBillingCycleDetails(selectedPlan, 'quarterly').discountPercent : 0;
                  const semiAnnualDisc = selectedPlan ? getBillingCycleDetails(selectedPlan, 'semi_annual').discountPercent : 10;
                  const annualDisc = selectedPlan ? getBillingCycleDetails(selectedPlan, 'annual').discountPercent : 20;
                  return (
                    <select
                      value={billingPeriod}
                      onChange={(e) => setBillingPeriod(e.target.value as any)}
                      className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg px-3 py-2 text-xs focus:outline-none font-bold"
                    >
                      <option value="monthly">
                        {`شهري (${monthlyDisc > 0 ? `خصم ${monthlyDisc}%` : 'بدون خصم'})`}
                      </option>
                      <option value="quarterly">
                        {`3 أشهر (${quarterlyDisc > 0 ? `خصم ${quarterlyDisc}%` : 'بدون خصم'})`}
                      </option>
                      <option value="semi_annual">
                        {`نصف سنوي (${semiAnnualDisc > 0 ? `خصم ${semiAnnualDisc}%` : 'بدون خصم'})`}
                      </option>
                      <option value="annual">
                        {`سنوي (${annualDisc > 0 ? `خصم ${annualDisc}%` : 'بدون خصم'})`}
                      </option>
                    </select>
                  );
                })()}
              </div>
              <button
                type="submit"
                disabled={updatingPlan}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {updatingPlan ? 'جاري ترقية الباقة...' : 'حفظ ترقية الباقة'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB CONTENT: Addons & Resources */}
      {activeTab === 'addons' && (
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
                    className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
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
                    className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
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
                  <span className="text-emerald-400">{calculateAddonPrice(addonType, addonAmount).toFixed(2)} جنيه</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={addingAddon}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl active:scale-95 transition cursor-pointer disabled:opacity-50"
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
                            <span className="text-emerald-400 font-bold">مساحة تخزين فيديو</span>
                          ) : (
                            <span className="text-blue-400 font-bold">أكواد طلاب</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold">
                          {a.amount} {a.type === 'storage' ? 'جيجا' : 'كود'}
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-400">{a.price_egp} جنيه</td>
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
      )}

      {/* TAB CONTENT: Overrides */}
      {activeTab === 'overrides' && (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--border-color)] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-400" />
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
              {resourceOverrides && (resourceOverrides.extra_storage_gb > 0 || resourceOverrides.extra_student_codes > 0) && (
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

          {resourceOverrides ? (
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
                    <span className="text-[var(--text-secondary)]">المساحة الإضافية (Extra):</span>
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
                    <span className="font-bold text-[var(--text-color)]">
                      {resourceOverrides.base_student_codes === null || resourceOverrides.base_student_codes === undefined 
                        ? 'غير محدود' 
                        : `${resourceOverrides.base_student_codes} كود`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">أكواد إضافية (Extra):</span>
                    <span className="font-bold text-amber-500">+{resourceOverrides.extra_student_codes} كود</span>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-dashed border-[var(--border-color)] text-sm">
                    <span className="font-extrabold text-[var(--text-color)]">الحد النهائي للأكواد (Final):</span>
                    <span className="font-black text-emerald-400">
                      {resourceOverrides.student_codes_limit === null || resourceOverrides.student_codes_limit === undefined 
                        ? 'غير محدود' 
                        : `${resourceOverrides.student_codes_limit} كود`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400">
              لا تتوفر تفاصيل موارد حالياً.
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Calculator */}
      {activeTab === 'calculator' && (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-1">
              <Calculator className="w-5 h-5 text-sky-400" />
              آلة حاسبة تكاليف الباقة الحية
            </h2>
            <p className="text-[var(--text-secondary)] text-xs">
              احسب تكاليف الاشتراك والإضافات الحالية والجديدة فوراً وبشكل ديناميكي.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1">الباقة المختارة</label>
              <select
                value={calcPlanId}
                onChange={(e) => setCalcPlanId(Number(e.target.value))}
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.price_egp} جنيه)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1">إضافة مساحة (جيجابايت)</label>
              <input
                type="number"
                min="0"
                value={calcStorage === 0 ? '' : calcStorage}
                onChange={(e) => setCalcStorage(Math.max(0, Number(e.target.value)))}
                placeholder="0 جيجا إضافي"
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1">إضافة أكواد طلاب</label>
              <input
                type="number"
                min="0"
                value={calcCodes === 0 ? '' : calcCodes}
                onChange={(e) => setCalcCodes(Math.max(0, Number(e.target.value)))}
                placeholder="0 كود إضافي"
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-color)] space-y-2 bg-[var(--bg-color)]/40 p-4 rounded-xl">
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>تكلفة الباقة الأساسية:</span>
              <span className="font-bold text-[var(--text-color)]">{planCost} جنيه</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>تكلفة المساحة الإضافية:</span>
              <span className="font-bold text-[var(--text-color)]">{storageCost.toFixed(2)} جنيه</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>تكلفة الأكواد الإضافية:</span>
              <span className="font-bold text-[var(--text-color)]">{codesCost.toFixed(2)} جنيه</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-[var(--text-color)] pt-2 border-t border-dashed border-[var(--border-color)]">
              <span>الإجمالي الكلي:</span>
              <span className="text-emerald-400 font-black">{totalCost.toFixed(2)} جنيه مصري</span>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/60 z-40" onClick={() => setShowRenewModal(false)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl z-50 text-right font-sans" dir="rtl">
            <div>
              <h3 className="text-base font-black text-[var(--text-color)] flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-400" />
                تجديد الاشتراك الحالي للمعلم
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">تجديد الباقة الحالية: <strong className="text-white">{effectivePlan?.name || 'الباقة الأساسية'}</strong></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold block text-slate-300 mb-1.5">اختر دورة الدفع والتجديد:</label>
                {(() => {
                  const monthlyDisc = effectivePlan ? getBillingCycleDetails(effectivePlan, 'monthly').discountPercent : 0;
                  const quarterlyDisc = effectivePlan ? getBillingCycleDetails(effectivePlan, 'quarterly').discountPercent : 0;
                  const semiAnnualDisc = effectivePlan ? getBillingCycleDetails(effectivePlan, 'semi_annual').discountPercent : 10;
                  const annualDisc = effectivePlan ? getBillingCycleDetails(effectivePlan, 'annual').discountPercent : 20;
                  return (
                    <select
                      value={renewBillingPeriod}
                      onChange={(e) => setRenewBillingPeriod(e.target.value as any)}
                      className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2 text-xs focus:outline-none font-bold"
                    >
                      <option value="monthly">
                        {`شهري (${monthlyDisc > 0 ? `خصم ${monthlyDisc}%` : 'بدون خصم'})`}
                      </option>
                      <option value="quarterly">
                        {`3 أشهر (${quarterlyDisc > 0 ? `خصم ${quarterlyDisc}%` : 'بدون خصم'})`}
                      </option>
                      <option value="semi_annual">
                        {`نصف سنوي (${semiAnnualDisc > 0 ? `خصم ${semiAnnualDisc}%` : 'بدون خصم'})`}
                      </option>
                      <option value="annual">
                        {`سنوي (${annualDisc > 0 ? `خصم ${annualDisc}%` : 'بدون خصم'})`}
                      </option>
                    </select>
                  );
                })()}
              </div>

              {/* Renewal Preview Details */}
              {effectivePlan && (() => {
                const details = getBillingCycleDetails(effectivePlan, renewBillingPeriod);
                const isGraceOrExpired = subscription.status === 'Grace Period' || subscription.status === 'Expired';
                return (
                  <div className="bg-[var(--bg-color)]/70 p-4 rounded-xl border border-[var(--border-color)] space-y-2 text-xs">
                    <h4 className="font-bold text-[var(--text-color)] mb-2 border-b border-[var(--border-color)] pb-2 flex justify-between">
                      <span>معاينة التجديد:</span>
                      <span className="text-[10px] text-amber-500 font-semibold">
                        {isGraceOrExpired ? 'يبدأ التجديد من اليوم' : 'يمتد التجديد بعد نهاية الاشتراك الحالي'}
                      </span>
                    </h4>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>تاريخ الانتهاء الحالي:</span>
                      <span className="font-mono text-left">{subscription.end_date}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>تاريخ الانتهاء الجديد:</span>
                      <span className="font-bold text-indigo-400 font-mono text-left">{getRenewEndDatePreview(renewBillingPeriod)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>السعر الأساسي:</span>
                      <span className="font-mono text-left">{details.basePrice.toFixed(2)} EGP</span>
                    </div>
                    {details.discountPercent > 0 && (
                      <div className="flex justify-between text-rose-500 font-bold">
                        <span>خصم التجديد ({details.discountPercent}%):</span>
                        <span className="font-mono text-left">-{details.discountAmount.toFixed(2)} EGP</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-[var(--text-color)] pt-2 border-t border-dashed border-[var(--border-color)]">
                      <span>القيمة المطلوبة للدفع:</span>
                      <span className="text-emerald-400 font-black">{details.finalPrice.toFixed(2)} EGP</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setShowRenewModal(false)}
                className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl text-slate-300 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleRenewSubscription}
                disabled={renewing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {renewing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التجديد...</span>
                  </>
                ) : 'تأكيد التجديد الآن'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Status Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/60 z-40" onClick={() => setEditingPayment(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl z-50 text-right font-sans" dir="rtl">
            <div>
              <h3 className="text-base font-black text-[var(--text-color)] flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                تعديل حالة الفاتورة #{editingPayment.id}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">المبلغ المطلوب: <strong className="text-emerald-400">{editingPayment.amount} ج.م</strong></p>
            </div>

            <form onSubmit={handlePaymentUpdate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">حالة السداد</label>
                <select
                  value={paymentStatusInput}
                  onChange={(e) => setPaymentStatusInput(e.target.value)}
                  className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2.5 text-xs focus:outline-none font-bold"
                >
                  <option value="Paid">مدفوعة (Paid)</option>
                  <option value="Pending">معلقة (Pending)</option>
                  <option value="Unpaid">غير مدفوعة (Unpaid)</option>
                  <option value="Refunded">مسترجعة (Refunded)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">ملاحظات التحصيل والدفع</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="رقم المعاملة، المحصل، طريقة الدفع..."
                  className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl text-slate-300 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={updatingPayment}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {updatingPayment ? 'جاري الحفظ...' : 'تأكيد وحفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/60 z-40" onClick={() => setShowOverrideModal(false)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl z-50 text-right font-sans" dir="rtl">
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
    </div>
  )
}

function roundSize(bytes: number) {
  if (bytes <= 0) return '0'
  const gb = bytes / (1024 * 1024 * 1024)
  return gb.toFixed(2)
}
