import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { 
  Award, HardDrive, Users, Calendar, Clock, DollarSign, 
  PlusCircle, CheckCircle, AlertCircle, RefreshCw, ChevronDown, 
  HelpCircle, ChevronUp, AlertTriangle, Shield, Check, BookOpen
} from 'lucide-react'
import { SubscriptionPlanCard } from '../../components/ui/SubscriptionPlanCard'

interface Plan {
  id: number
  name: string
  video_storage_gb: number
  student_codes: number
  price_egp: number
  is_popular?: boolean
  is_trial?: boolean
  active?: boolean
  isActive?: boolean
  billing_options?: any
  durationType?: string
  discountPercentage?: number | string
  finalPrice?: number | string
  price?: number | string
  featured?: boolean
  most_popular?: boolean
  recommended?: boolean
  billing_type?: 'monthly' | 'revenue_sharing'
  commission_percentage?: number | string
  max_students?: number | null
  codes_limit_type?: 'unlimited' | 'max'
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
  remaining_days: number
  students_count: number
  courses_count: number
  billing_period: string
  billing_cycle: string
  final_price: number | string
  discount_percentage?: number | string
  discount_amount?: number | string
  included_storage_gb: number
  included_codes: number
}

interface Addon {
  id: number
  type: string
  amount: number
  price_egp: number
  created_at: string
}

export default function Subscription() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [addons, setAddons] = useState<Addon[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [alerts, setAlerts] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const [earnings, setEarnings] = useState<any>(null)

  // Expandable request panel state
  const [showRequestSection, setShowRequestSection] = useState(false)
  const [requestType, setRequestType] = useState<'plan_upgrade' | 'extra_storage' | 'extra_codes'>('plan_upgrade')
  const [reqPlanId, setReqPlanId] = useState<string>('')
  const [reqAmount, setReqAmount] = useState<number>(0)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'semi_annual' | 'annual'>('monthly')
  const [sendingRequest, setSendingRequest] = useState(false)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)

  // Dynamic packages
  const [activationCodePackages, setActivationCodePackages] = useState<any[]>([])
  const [storagePackages, setStoragePackages] = useState<any[]>([])
  const [selectedCodePackageId, setSelectedCodePackageId] = useState<string>('')
  const [selectedStoragePackageId, setSelectedStoragePackageId] = useState<string>('')

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null)

  const getStudentLimitDisplay = () => {
    if (!subscription) return ''
    if (subscription.plan?.billing_type === 'revenue_sharing') {
      const maxStudents = subscription.plan?.max_students;
      if (maxStudents === null || maxStudents === undefined || subscription.plan?.codes_limit_type === 'unlimited') {
        return 'غير محدد'
      }
      return (Number(maxStudents) + (subscription.extra_codes || 0)).toString()
    }
    // Monthly Plan
    if (subscription.total_codes === null || subscription.total_codes === undefined || subscription.plan?.codes_limit_type === 'unlimited') {
      return 'غير محدود'
    }
    return subscription.total_codes.toString()
  }

  console.log("Subscription Page Render");
  console.log("Packages Response:", plans);
  console.log("Subscription State:", subscription);
  console.log("Current User:", user);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await API.get('/teacher/subscription')
      setSubscription(res.data.subscription)
      setAddons(res.data.addons)
      setEarnings(res.data.earnings || null)
      
      const rawPlans = res.data.plans || []
      const activePlans = rawPlans.filter((p: any) => p.active !== false && (p as any).active !== 0 && (p as any).active !== '0' && (p as any).isActive !== false && ((p as any).isActive as any) !== 0 && ((p as any).isActive as any) !== '0')
      setPlans(activePlans)
      
      setSettings(res.data.settings)
      setAlerts(res.data.alerts || [])

      const currentPlanId = res.data.subscription?.plan?.id
      const filterPlans = activePlans.filter((p: any) => p.id !== currentPlanId && !p.is_trial)
      if (filterPlans.length > 0 && !reqPlanId) {
        setReqPlanId(filterPlans[0].id.toString())
      }
      setHasPendingRequest(!!res.data.has_pending_request)

      if (res.data.activation_code_packages) {
        setActivationCodePackages(res.data.activation_code_packages)
        if (res.data.activation_code_packages.length > 0 && !selectedCodePackageId) {
          setSelectedCodePackageId(res.data.activation_code_packages[0].id.toString())
        }
      }
      if (res.data.storage_packages) {
        setStoragePackages(res.data.storage_packages)
        if (res.data.storage_packages.length > 0 && !selectedStoragePackageId) {
          setSelectedStoragePackageId(res.data.storage_packages[0].id.toString())
        }
      }
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل تحميل بيانات الاشتراك.', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const plansToShow = React.useMemo(() => {
    if (!plans || plans.length === 0) return []
    
    // Filter plans that are Featured, Most Popular, or Recommended
    let highlighted = plans.filter(p => !!p.featured || !!p.most_popular || !!p.recommended)
    
    // If no plan is marked, fall back to showing the first active plans (e.g., first 3 plans)
    if (highlighted.length === 0) {
      highlighted = plans.slice(0, 3)
    }
    
    return highlighted
  }, [plans])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (plans.length > 0) {
      console.log("Teacher Packages:", plans);
      plans.forEach(p => {
        console.log(`Package: ID=${p.id}, Name=${p.name}, Price=${(p as any).price}, FinalPrice=${(p as any).finalPrice}, Duration=${(p as any).duration_in_days || (p as any).duration_days}, BillingOptions=${JSON.stringify((p as any).billing_options)}`);
      });
    }
  }, [plans]);

  const triggerSync = async () => {
    try {
      setSyncing(true)
      await API.get('/teacher/subscription') // Trigger sync endpoint
      await loadData(true)
      showToast('تم تحديث إحصائيات التخزين مباشرة من خوادم Bunny Stream.', 'success')
    } catch (err) {
      console.error(err)
      showToast('فشل تحديث البيانات.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const submitSubscriptionRequest = async (payload: any) => {
    return await API.post('/teacher/subscription/upgrade-request', payload)
  }

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSendingRequest(true)
      const payload: any = {
        type: requestType,
      }
      
      if (requestType === 'plan_upgrade') {
        payload.requested_plan_id = Number(reqPlanId)
        payload.billing_period = billingPeriod
      } else if (requestType === 'extra_storage') {
        payload.storage_package_id = Number(selectedStoragePackageId)
      } else if (requestType === 'extra_codes') {
        payload.activation_code_package_id = Number(selectedCodePackageId)
      }

      console.log('TOP FORM PAYLOAD', payload)
      const response = await submitSubscriptionRequest(payload)
      console.log('UPGRADE RESPONSE', response)
      console.log('UPGRADE RESPONSE DATA', response.data)

      showToast(response.data.message || 'تم تقديم طلب الترقية بنجاح إلى إدارة المنصة للمراجعة.', 'success')
      setRequestType('plan_upgrade')
      setShowRequestSection(false)
      loadData(true)
    } catch (err: any) {
      console.error(err)
      const errorMsg = err.response?.data?.errors 
        ? Object.values(err.response.data.errors).flat().join(', ')
        : (err.response?.data?.message || 'حدث خطأ أثناء إرسال طلب الترقية.')
      showToast(errorMsg, 'error')
    } finally {
      setSendingRequest(false)
    }
  }

  const handleRequestUpgrade = async (planId: number, duration: string) => {
    try {
      setSendingRequest(true)
      const payload = {
        type: 'plan_upgrade',
        requested_plan_id: planId,
        billing_period: duration === 'yearly' ? 'annual' : duration
      }
      console.log('BOTTOM CARD PAYLOAD', payload)
      const response = await submitSubscriptionRequest(payload)
      console.log('UPGRADE RESPONSE', response)
      console.log('UPGRADE RESPONSE DATA', response.data)

      showToast(response.data.message || 'تم تقديم طلب الترقية بنجاح إلى إدارة المنصة للمراجعة.', 'success')
      loadData(true)
    } catch (err: any) {
      console.error(err)
      const errorMsg = err.response?.data?.errors 
        ? Object.values(err.response.data.errors).flat().join(', ')
        : (err.response?.data?.message || 'حدث خطأ أثناء إرسال طلب الترقية.')
      showToast(errorMsg, 'error')
    } finally {
      setSendingRequest(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <span className="px-3 py-1 text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/30">نشط</span>
      case 'Expiring Soon':
        return <span className="px-3 py-1 text-xs font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-500/30">ينتهي قريباً</span>
      case 'Expired':
        return <span className="px-3 py-1 text-xs font-bold bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-500/30">منتهي الباقة</span>
      default:
        return <span className="px-3 py-1 text-xs font-bold bg-[var(--border-color)] text-[var(--text-secondary)] rounded-full border border-[var(--border-color)]">{status}</span>
    }
  }

  const roundSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(2);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-brand-primary">
        <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-[var(--text-secondary)]">
        بيانات الاشتراك غير متوفرة حالياً.
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-right font-sans" dir="rtl">
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

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-color)]">إدارة اشتراكي الحالي</h1>
          <p className="text-[var(--text-secondary)] text-xs mt-1">تتبع مساحتك السحابية للفيديوهات وحالة أكواد الطلاب الخاصة بك.</p>
        </div>
        <button
          onClick={triggerSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--card-bg)] hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] font-bold text-xs rounded-xl shadow-md active:scale-95 transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          تحديث مساحة التخزين
        </button>
      </div>

      {/* Subscription Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-3">
          {alerts.map((alert, idx) => (
            <div key={idx} className="bg-rose-500/10 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 p-4 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-xs font-bold">{alert}</p>
            </div>
          ))}
        </div>
      )}

      {/* Commission Earnings Report (Feature 3) */}
      {earnings && (
        <div className="mb-8 space-y-6">
          <h2 className="text-lg font-black text-[var(--text-color)] flex items-center gap-2 border-r-4 border-brand-primary pr-3 leading-none">
            <span>تقرير أرباح نسبة المشاركة والمدفوعات</span>
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Today's earnings */}
            <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-5 rounded-3xl space-y-3.5 shadow-sm hover:border-brand-primary/30 transition-all duration-300">
              <span className="text-xs text-slate-400 font-semibold block">أرباح اليوم</span>
              <div className="text-xl font-black text-brand-primary">{parseFloat(earnings.today_earnings || 0).toFixed(2)} ج.م</div>
              <p className="text-[10px] text-slate-500 font-light">مبيعات اليوم حتى الآن</p>
            </div>

            {/* Monthly earnings */}
            <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-5 rounded-3xl space-y-3.5 shadow-sm hover:border-brand-primary/30 transition-all duration-300">
              <span className="text-xs text-slate-400 font-semibold block">أرباح الشهر الحالي</span>
              <div className="text-xl font-black text-brand-primary">{parseFloat(earnings.monthly_earnings || 0).toFixed(2)} ج.م</div>
              <p className="text-[10px] text-slate-500 font-light">الشهر الحالي بالكامل</p>
            </div>

            {/* Lifetime earnings */}
            <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-5 rounded-3xl space-y-3.5 shadow-sm hover:border-brand-primary/30 transition-all duration-300">
              <span className="text-xs text-slate-400 font-semibold block">إجمالي الأرباح التراكمية</span>
              <div className="text-xl font-black text-brand-primary">{parseFloat(earnings.lifetime_earnings || 0).toFixed(2)} ج.م</div>
              <p className="text-[10px] text-slate-500 font-light">تراكمي مبيعات الكورسات والحصص</p>
            </div>

            {/* Pending Payout balance */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-3xl space-y-3.5 shadow-sm hover:border-emerald-500/30 transition-all duration-300">
              <span className="text-xs text-emerald-400/80 font-semibold block">الرصيد المعلق المستحق للصرف</span>
              <div className="text-xl font-black text-emerald-400">{parseFloat(earnings.pending_payout || 0).toFixed(2)} ج.م</div>
              <p className="text-[10px] text-emerald-500/60 font-light">الرصيد الجاهز لطلب الدفع</p>
            </div>
          </div>

          {/* Payout Logs Table */}
          {earnings.payouts && earnings.payouts.length > 0 && (
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl overflow-hidden p-6 space-y-4">
              <h3 className="text-sm font-black text-slate-200">سجل دفعاتي المالية المستلمة</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900/40 text-slate-400 border-b border-[var(--border-color)] font-bold">
                    <tr>
                      <th className="p-3">تاريخ الصرف</th>
                      <th className="p-3">المبلغ المستلم</th>
                      <th className="p-3">وسيلة الدفع</th>
                      <th className="p-3">ملاحظات التحويل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {earnings.payouts.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-900/10">
                        <td className="p-3 text-slate-400">
                          {new Date(log.payout_date).toLocaleDateString('ar-EG', {
                            year: 'numeric', month: 'long', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="p-3 font-extrabold text-emerald-400">
                          {parseFloat(log.amount).toFixed(2)} ج.م
                        </td>
                        <td className="p-3 text-slate-400 font-bold">
                          {log.payment_method === 'bank_transfer' ? '🏦 تحويل بنكي' : 
                           log.payment_method === 'vodafone_cash' ? '📱 محفظة إلكترونية' : '💵 كاش / نقدي'}
                        </td>
                        <td className="p-3 text-slate-400 font-light max-w-[250px] truncate" title={log.notes || ''}>
                          {log.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl">
          <span className="text-[10px] text-[var(--text-secondary)] block mb-1">باقة الاشتراك</span>
          <span className="text-sm font-extrabold text-[var(--text-color)] flex items-center gap-1.5">
            <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {subscription.plan?.name || 'Starter'}
          </span>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl">
          <span className="text-[10px] text-[var(--text-secondary)] block mb-1">دورة الفاتورة</span>
          <span className="text-sm font-extrabold text-[var(--text-color)] flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {subscription.billing_period === 'annual' ? 'سنوي' : subscription.billing_period === 'semi_annual' ? 'نصف سنوي' : subscription.billing_period === 'quarterly' ? '3 أشهر' : 'شهري'}
          </span>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl">
          <span className="text-[10px] text-[var(--text-secondary)] block mb-1">الأيام المتبقية</span>
          <span className="text-sm font-extrabold text-[var(--text-color)] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            {subscription.remaining_days} يوم
          </span>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl">
          <span className="text-[10px] text-[var(--text-secondary)] block mb-1">تاريخ انتهاء الباقة</span>
          <span className="text-xs font-extrabold text-[var(--text-color)] flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            {subscription.end_date}
          </span>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl col-span-2 md:col-span-1">
          <span className="text-[10px] text-[var(--text-secondary)] block mb-1">الطلاب النشطون</span>
          <span className="text-xs font-extrabold text-[var(--text-color)] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            {subscription.used_codes} / {getStudentLimitDisplay()}
          </span>
        </div>
      </div>

      {/* Main Info Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* Plan Specs & Quotas */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              مواصفات الاشتراك الحالي
            </h2>
            {getStatusBadge(subscription.status)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-[var(--bg-color)]/25 p-4 rounded-xl border border-[var(--border-color)] flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] block mb-1">سعر وقيمة الاشتراك الحالي</span>
                <span className="text-xs font-black text-[var(--text-color)]">
                  {subscription.plan?.billing_type === 'revenue_sharing' 
                    ? `نظام النسبة (عمولة ${subscription.plan?.commission_percentage}%)` 
                    : `${Number(subscription.final_price).toFixed(2)} ج.م / ${
                        subscription.billing_period === 'annual' ? 'سنوي' : 
                        subscription.billing_period === 'semi_annual' ? '6 أشهر' : 
                        subscription.billing_period === 'quarterly' ? '3 أشهر' : 'شهرياً'
                      }`
                  }
                </span>
              </div>
              <button
                onClick={() => navigate('/teacher/plans')}
                className="mt-3 w-full py-1.5 bg-indigo-650/10 hover:bg-indigo-650/20 text-indigo-450 font-bold text-[10px] rounded-lg active:scale-95 transition cursor-pointer text-center border border-indigo-550/10"
              >
                ترقية أو تجديد الباقة
              </button>
            </div>
            <div className="bg-[var(--bg-color)]/25 p-4 rounded-xl border border-[var(--border-color)]">
              <span className="text-[10px] text-[var(--text-secondary)] block mb-1">تاريخ بداية الباقة</span>
              <span className="text-xs font-bold text-[var(--text-color)]">{subscription.start_date}</span>
            </div>
            <div className="bg-[var(--bg-color)]/25 p-4 rounded-xl border border-[var(--border-color)]">
              <span className="text-[10px] text-[var(--text-secondary)] block mb-1">الأيام المتبقية للتجديد</span>
              <span className="text-xs font-bold text-[var(--text-color)] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                {subscription.remaining_days} يوم
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Codes usage details (PRIMARY) */}
            <div className="bg-[var(--bg-color)]/10 p-6 rounded-2xl border border-[var(--border-color)] space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-[var(--border-color)]/60">
                <span className="text-sm font-bold text-[var(--text-color)] flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  السعة الاستيعابية للطلاب (الأكواد)
                </span>
                {subscription.plan?.codes_limit_type === 'unlimited' ? (
                  <span className="px-2.5 py-1 text-xs font-black bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
                    سعة غير محدودة
                  </span>
                ) : (
                  <span className="text-sm font-extrabold text-[var(--text-color)]">
                    {subscription.used_codes} / {subscription.total_codes} طالب نشط
                  </span>
                )}
              </div>

              {subscription.plan?.codes_limit_type !== 'unlimited' && (
                <div className="space-y-3">
                  {/* Progress Bar */}
                  <div className="relative w-full bg-[var(--bg-color)]/30 h-3.5 rounded-full overflow-hidden border border-[var(--border-color)]/40 shadow-inner">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 shadow-md ${
                        (subscription.used_codes / (subscription.total_codes || 1)) >= 0.9 ? 'bg-gradient-to-r from-rose-500 to-red-600 animate-pulse' : 
                        (subscription.used_codes / (subscription.total_codes || 1)) >= 0.7 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-indigo-500 to-brand-primary'
                      }`}
                      style={{ width: `${Math.min(100, (subscription.used_codes / (subscription.total_codes || 1)) * 100)}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-[var(--text-secondary)] font-medium">
                    <span>نسبة الاستهلاك: {Math.round((subscription.used_codes / (subscription.total_codes || 1)) * 100)}%</span>
                    <span className="font-bold text-brand-primary">السعة المتبقية: {subscription.remaining_codes} طالب</span>
                  </div>

                  {subscription.remaining_codes !== null && subscription.remaining_codes < 10 && (
                    <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-450 rounded-xl text-[10px] font-extrabold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>تنبيه: رصيد أكواد التفعيل الخاص بك شارف على النفاد. Your activation code balance is running low.</span>
                    </div>
                  )}

                  {/* Breakdown & Extra Capacity */}
                  <div className="pt-2 flex flex-col gap-2 border-t border-[var(--border-color)]/45 mt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[var(--text-secondary)]">الباقة الأساسية:</span>
                      <span className="font-semibold text-[var(--text-color)]">{subscription.included_codes} طالب</span>
                    </div>
                    {subscription.extra_codes > 0 && (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--text-secondary)]">سعة إضافية (إضافات/تعديل الإدارة):</span>
                          <span className="font-bold text-emerald-400">+{subscription.extra_codes} طالب</span>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-1.5 border-t border-dashed border-[var(--border-color)]/30">
                          <span className="font-bold text-[var(--text-color)]">السعة الإجمالية:</span>
                          <span className="font-bold text-brand-primary">{subscription.total_codes} طالب</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 mt-2 border-t border-[var(--border-color)]/30">
                    <button
                      onClick={() => {
                        setRequestType('extra_codes')
                        setShowRequestSection(true)
                        setTimeout(() => {
                          document.getElementById('upgrade-request-form')?.scrollIntoView({ behavior: 'smooth' })
                        }, 100)
                      }}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl active:scale-95 transition cursor-pointer text-center"
                    >
                      شراء أكواد تفعيل إضافية
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Storage usage details (SECONDARY) */}
            <div className="bg-[var(--bg-color)]/10 p-6 rounded-2xl border border-[var(--border-color)] space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-[var(--border-color)]/60">
                <span className="text-sm font-bold text-[var(--text-color)] flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-emerald-400" />
                  مساحة تخزين الفيديو (Bunny Stream)
                </span>
                <span className="text-sm font-extrabold text-[var(--text-color)]">
                  {roundSize(subscription.used_storage_bytes)} / {subscription.total_storage_gb} GB
                </span>
              </div>

              <div className="space-y-3">
                {/* Progress Bar */}
                <div className="relative w-full bg-[var(--bg-color)]/30 h-3.5 rounded-full overflow-hidden border border-[var(--border-color)]/40 shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 shadow-md ${
                      subscription.storage_percentage >= 90 ? 'bg-gradient-to-r from-rose-500 to-red-600 animate-pulse' : 
                      subscription.storage_percentage >= 70 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    }`}
                    style={{ width: `${subscription.storage_percentage}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-center text-xs text-[var(--text-secondary)] font-medium">
                  <span>نسبة الاستهلاك: {subscription.storage_percentage}%</span>
                  <span className="font-bold text-emerald-400">المساحة المتبقية: {subscription.remaining_storage_gb} GB</span>
                </div>

                {/* Breakdown & Extra Storage */}
                <div className="pt-2 flex flex-col gap-2 border-t border-[var(--border-color)]/45 mt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--text-secondary)]">المساحة الأساسية:</span>
                    <span className="font-semibold text-[var(--text-color)]">{subscription.included_storage_gb} GB</span>
                  </div>
                  {subscription.extra_storage_gb > 0 && (
                    <>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--text-secondary)]">مساحة إضافية مشتراة:</span>
                        <span className="font-bold text-emerald-400">+{subscription.extra_storage_gb} GB</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-dashed border-[var(--border-color)]/30">
                        <span className="font-bold text-[var(--text-color)]">المساحة الإجمالية:</span>
                        <span className="font-bold text-emerald-400">{subscription.total_storage_gb} GB</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Action Button */}
                <div className="pt-4 mt-2 border-t border-[var(--border-color)]/30">
                  <button
                    onClick={() => {
                      setRequestType('extra_storage')
                      setShowRequestSection(true)
                      setTimeout(() => {
                        document.getElementById('upgrade-request-form')?.scrollIntoView({ behavior: 'smooth' })
                      }, 100)
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl active:scale-95 transition cursor-pointer text-center"
                  >
                    شراء مساحة تخزين إضافية
                  </button>
                </div>
              </div>
            </div>

            {/* Active Resources Summary */}
            <div className="pt-4 border-t border-[var(--border-color)] grid grid-cols-2 gap-4">
              <div className="bg-[var(--bg-color)]/10 p-3.5 rounded-xl border border-[var(--border-color)]/40 flex items-center gap-3">
                <Users className="w-4 h-4 text-sky-400 shrink-0" />
                <div className="text-right">
                  <span className="text-[9px] text-[var(--text-secondary)] block">إجمالي الطلاب المشتركين</span>
                  <span className="text-xs font-black text-[var(--text-color)]">{subscription.students_count || 0} طالب</span>
                </div>
              </div>
              <div className="bg-[var(--bg-color)]/10 p-3.5 rounded-xl border border-[var(--border-color)]/40 flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-purple-400 shrink-0" />
                <div className="text-right">
                  <span className="text-[9px] text-[var(--text-secondary)] block">إجمالي الكورسات المنشورة</span>
                  <span className="text-xs font-black text-[var(--text-color)]">{subscription.courses_count || 0} كورس</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Purchased Add-ons Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-4">
              <PlusCircle className="w-5 h-5 text-emerald-400" />
              سجل الإضافات المشتراة الحالية
            </h2>
            <p className="text-[var(--text-secondary)] text-xs mb-4">
              تلقائيًا يتم إدراج هذه الإضافات ضمن المساحة الإجمالية والأكواد المتاحة في الأعلى.
            </p>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {addons.length === 0 ? (
                <div className="bg-[var(--bg-color)]/30 p-6 rounded-xl border border-dashed border-[var(--border-color)] text-center">
                  <p className="text-[var(--text-secondary)]/80 text-xs">لم تشحن أي موارد إضافية بعد.</p>
                </div>
              ) : (
                addons.map(addon => (
                  <div key={addon.id} className="bg-[var(--bg-color)]/60 border border-[var(--border-color)] p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[var(--text-color)] block">
                        {addon.type === 'storage' ? `+${addon.amount} جيجابايت مساحة` : `+${addon.amount} كود طلاب إضافي`}
                      </span>
                      <span className="text-[9px] text-[var(--text-secondary)]">
                        {new Date(addon.created_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">
                      {addon.price_egp} ج.م
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upgrade Request expand trigger button */}
          <button
            onClick={() => setShowRequestSection(!showRequestSection)}
            className="w-full mt-4 py-3 bg-gradient-to-r from-brand-primary to-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-lg hover:shadow-indigo-500/10 active:scale-95 transition flex items-center justify-center gap-1 cursor-pointer"
          >
            {showRequestSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showRequestSection ? 'إغلاق نافذة الطلب' : 'طلب ترقية أو شحن موارد إضافية'}
          </button>
        </div>
      </div>

      {/* Expandable Upgrade Request Section */}
      {showRequestSection && (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 mb-8 animate-in slide-in-from-top duration-300">
          <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-2">
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            تقديم طلب ترقية أو إضافة جديدة
          </h2>
          <p className="text-[var(--text-secondary)] text-xs mb-6">
            قدم طلبًا لتعديل اشتراكك أو إضافة مساحة فيديو أو أكواد طلاب، وسيصل تنبيه للإدارة لمراجعة الطلب والموافقة عليه.
          </p>

          <form onSubmit={handleRequestSubmit} className="space-y-4 max-w-xl">
            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1.5 font-bold">نوع الطلب</label>
              <select
                value={requestType}
                onChange={(e) => {
                  setRequestType(e.target.value as any)
                  setReqAmount(0)
                }}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="plan_upgrade">ترقية الباقة الأساسية (Higher Plan)</option>
                <option value="extra_storage">شراء مساحة تخزين إضافية (Additional Storage)</option>
                <option value="extra_codes">شراء أكواد طلاب إضافية (Additional Codes)</option>
              </select>
            </div>

            {requestType === 'plan_upgrade' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] block mb-1.5 font-bold">اختر الباقة المطلوبة</label>
                  <select
                    value={reqPlanId}
                    onChange={(e) => {
                      const id = e.target.value
                      setReqPlanId(id)
                      const selectedPlan = plans.find(plan => plan.id.toString() === id)
                      if (selectedPlan && (selectedPlan as any).durationType) {
                        const pDuration = (selectedPlan as any).durationType
                        setBillingPeriod(pDuration === 'yearly' ? 'annual' : pDuration as any)
                      }
                    }}
                    className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    {plans.filter(p => p.active && p.id !== subscription.plan?.id && !p.is_trial).map(p => {
                      const finalPrice = (p as any).finalPrice !== undefined ? (p as any).finalPrice : p.price_egp
                      const durationLabel = (p as any).durationType === 'quarterly' ? '3 أشهر' : (p as any).durationType === 'semi_annual' ? '6 أشهر' : (p as any).durationType === 'yearly' || (p as any).durationType === 'annual' ? 'سنة' : 'شهر'
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} ({finalPrice} ج.م / {durationLabel} / {p.student_codes} طالب / {p.video_storage_gb}GB)
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>
            )}

            {requestType === 'extra_storage' && (
              <div>
                <label className="text-xs text-[var(--text-secondary)] block mb-1.5 font-bold">اختر باقة التخزين الإضافية</label>
                <select
                  value={selectedStoragePackageId}
                  onChange={(e) => setSelectedStoragePackageId(e.target.value)}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-bold"
                >
                  {storagePackages.length === 0 && <option value="">لا يوجد باقات تخزين متاحة حالياً</option>}
                  {storagePackages.map(pkg => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.storage_gb} GB) - {Number(pkg.price).toFixed(2)} ج.م / شهرياً
                    </option>
                  ))}
                </select>
                {selectedStoragePackageId && (
                  <span className="text-[10px] text-indigo-400 mt-1.5 block font-bold">
                    سيتم إرسال طلب تفعيل الباقة للإدارة للموافقة عليها.
                  </span>
                )}
              </div>
            )}

            {requestType === 'extra_codes' && (
              <div>
                <label className="text-xs text-[var(--text-secondary)] block mb-1.5 font-bold">اختر باقة الطلاب الإضافية</label>
                <select
                  value={selectedCodePackageId}
                  onChange={(e) => setSelectedCodePackageId(e.target.value)}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-bold"
                >
                  {activationCodePackages.length === 0 && <option value="">لا يوجد باقات أكواد متاحة حالياً</option>}
                  {activationCodePackages.map(pkg => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.number_of_codes} كود) - بسعر {Number(pkg.total_price).toFixed(2)} ج.م
                    </option>
                  ))}
                </select>
                {selectedCodePackageId && (
                  <span className="text-[10px] text-indigo-400 mt-1.5 block font-bold">
                    سيتم إرسال طلب تفعيل الباقة للإدارة للموافقة عليها.
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={sendingRequest || hasPendingRequest || (requestType === 'extra_storage' && !selectedStoragePackageId) || (requestType === 'extra_codes' && !selectedCodePackageId)}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {sendingRequest ? 'جاري تقديم الطلب...' : hasPendingRequest ? 'لديك طلب ترقية معلق' : 'إرسال طلب الترقية'}
            </button>
          </form>
        </div>
      )}

      {/* Available Plans Premium Cards Showcase */}
      <div className="border-t border-[var(--border-color)] pt-8 mt-12 space-y-8 text-right" dir="rtl">
        <div>
          <h2 className="text-xl font-black text-[var(--text-color)] flex items-center gap-2 mb-1">
            <Award className="w-5.5 h-5.5 text-indigo-400" />
            باقات الاشتراك المقترحة لك
          </h2>
          <p className="text-[var(--text-secondary)] text-xs font-light">
            استعرض باقة اشتراكك الحالية وأبرز خطط الترقية المتاحة لتوفير مساحة سحابية وسعة طلاب أعلى.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {plansToShow.map(p => {
            const isCurrent = subscription?.plan?.id === p.id
            return (
              <SubscriptionPlanCard
                key={p.id}
                plan={p}
                isCurrent={isCurrent}
                billingPeriod={billingPeriod as any}
                settings={settings || { discount_semi_annually: '10', discount_annually: '20' }}
                onUpgradeRequest={handleRequestUpgrade}
                submitting={sendingRequest}
                hasPendingRequest={hasPendingRequest}
              />
            )
          })}
        </div>

        <div className="flex justify-center pt-4">
          <button 
            onClick={() => navigate('/teacher/plans')}
            className="px-8 py-3 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-color)] font-bold text-xs rounded-2xl border border-[var(--border-color)] hover:border-indigo-500/50 shadow-md transition active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <span>عرض جميع الخطط والباقات</span>
            <span>←</span>
          </button>
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
