import React, { useState, useEffect } from 'react'
import API from '../../services/api'
import { 
  Plus, Edit2, Trash2, ArrowUp, ArrowDown, History, 
  FileText, Check, X, Shield, Info, DollarSign, 
  Layers, Database, Code, Calendar, AlertTriangle, AlertCircle, Percent
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

interface Plan {
  id: number
  name: string
  slug: string
  description: string | null
  price: number | string
  currency: string
  duration_in_days: number
  max_courses: number | null
  max_storage_gb: number
  included_codes: number
  featured: boolean
  active: boolean
  sort_order: number
  badge_text: string | null
  color_theme: string | null
  durationType?: string
  discountPercentage?: number | string
  finalPrice?: number | string
  isActive?: boolean
  created_at?: string
  updated_at?: string
  billing_options?: any
}

interface PriceHistory {
  id: number
  plan_id: number
  old_price: number | string
  new_price: number | string
  created_at: string
  admin?: {
    id: number
    name: string
    email: string
  }
}

interface AuditLog {
  id: number
  plan_id: number
  user_id: number
  action: string
  old_values: any
  new_values: any
  created_at: string
  user?: {
    id: number
    name: string
    email: string
    role: string
  }
}

export default function SubscriptionPlans() {
  const { user } = useAuthStore()
  const isSuperAdmin = !!user?.is_super_admin || !!user?.is_super
  const hasEditPermission = isSuperAdmin || (!!user?.permissions && user.permissions.includes('subscription_plans.edit'))

  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Drawer / Modal Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  
  // Form fields
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [currency, setCurrency] = useState('EGP')
  const [durationInDays, setDurationInDays] = useState<number>(30)
  const [maxCourses, setMaxCourses] = useState<string>('')
  const [maxStorageGb, setMaxStorageGb] = useState<number>(10)
  const [includedCodes, setIncludedCodes] = useState<number>(50)
  const [featured, setFeatured] = useState(false)
  const [active, setActive] = useState(true)
  const [sortOrder, setSortOrder] = useState<number>(0)
  const [badgeText, setBadgeText] = useState('')
  const [colorTheme, setColorTheme] = useState('indigo')

  // New Subscription Durations and Package fields
  const [durationType, setDurationType] = useState('monthly')
  const [discountPercentage, setDiscountPercentage] = useState<number>(0)
  const [finalPrice, setFinalPrice] = useState<number>(0)
  const [isActive, setIsActive] = useState(true)
  const [billingOptions, setBillingOptions] = useState({
    monthly: { enabled: false, price: 0, discount: 0 },
    three_months: { enabled: false, price: 0, discount: 0 },
    six_months: { enabled: false, price: 0, discount: 0 },
    yearly: { enabled: false, price: 0, discount: 0 },
  })

  // Auto-calculate final price
  useEffect(() => {
    const calculated = price - (price * discountPercentage / 100)
    setFinalPrice(calculated < 0 ? 0 : calculated)
  }, [price, discountPercentage])

  // Price Confirmation Modal State
  const [priceConfirmOpen, setPriceConfirmOpen] = useState(false)
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null)
  const [confirmPriceDetails, setConfirmPriceDetails] = useState<{ old: number; new: number } | null>(null)

  // Side Panels for History / Logs
  const [selectedPlanForHistory, setSelectedPlanForHistory] = useState<Plan | null>(null)
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [selectedPlanForLogs, setSelectedPlanForLogs] = useState<Plan | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const res = await API.get('/admin/subscription-plans')
      setPlans(res.data.plans || [])
    } catch (err: any) {
      console.error(err)
      setError('فشل في تحميل خطط الاشتراك من الخادم.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  // Auto-fill form when editing
  useEffect(() => {
    if (editingPlan) {
      setName(editingPlan.name || '')
      setSlug(editingPlan.slug || '')
      setDescription(editingPlan.description || '')
      setPrice(Number(editingPlan.price) || 0)
      setCurrency(editingPlan.currency || 'EGP')
      setDurationInDays(editingPlan.duration_in_days || 30)
      setMaxCourses(editingPlan.max_courses !== null ? String(editingPlan.max_courses) : '')
      setMaxStorageGb(editingPlan.max_storage_gb || 0)
      setIncludedCodes(editingPlan.included_codes || 0)
      setFeatured(editingPlan.featured || false)
      setActive(editingPlan.isActive !== false)
      setSortOrder(editingPlan.sort_order || 0)
      setBadgeText(editingPlan.badge_text || '')
      setColorTheme(editingPlan.color_theme || 'indigo')
      setDurationType(editingPlan.durationType || 'monthly')
      setDiscountPercentage(Number(editingPlan.discountPercentage) || 0)
      setFinalPrice(Number(editingPlan.finalPrice) || 0)
      setIsActive(editingPlan.isActive !== false)

      if (editingPlan.billing_options) {
        let opts = editingPlan.billing_options;
        if (typeof opts === 'string') {
          try { opts = JSON.parse(opts); } catch(e) { opts = {}; }
        }
        setBillingOptions({
          monthly: {
            enabled: !!opts.monthly?.enabled,
            price: Number(opts.monthly?.price) || 0,
            discount: Number(opts.monthly?.discount) || 0,
          },
          three_months: {
            enabled: !!opts.three_months?.enabled,
            price: Number(opts.three_months?.price) || 0,
            discount: Number(opts.three_months?.discount) || 0,
          },
          six_months: {
            enabled: !!opts.six_months?.enabled,
            price: Number(opts.six_months?.price) || 0,
            discount: Number(opts.six_months?.discount) || 0,
          },
          yearly: {
            enabled: !!opts.yearly?.enabled,
            price: Number(opts.yearly?.price) || 0,
            discount: Number(opts.yearly?.discount) || 0,
          },
        })
      } else {
        setBillingOptions({
          monthly: { enabled: false, price: 0, discount: 0 },
          three_months: { enabled: false, price: 0, discount: 0 },
          six_months: { enabled: false, price: 0, discount: 0 },
          yearly: { enabled: false, price: 0, discount: 0 },
        })
      }
    } else {
      // Reset defaults for Create
      setName('')
      setSlug('')
      setDescription('')
      setPrice(0)
      setCurrency('EGP')
      setDurationInDays(30)
      setMaxCourses('')
      setMaxStorageGb(10)
      setIncludedCodes(50)
      setFeatured(false)
      setActive(true)
      setSortOrder(plans.length)
      setBadgeText('')
      setColorTheme('indigo')
      setDurationType('monthly')
      setDiscountPercentage(0)
      setFinalPrice(0)
      setIsActive(true)
      setBillingOptions({
        monthly: { enabled: false, price: 0, discount: 0 },
        three_months: { enabled: false, price: 0, discount: 0 },
        six_months: { enabled: false, price: 0, discount: 0 },
        yearly: { enabled: false, price: 0, discount: 0 },
      })
    }
  }, [editingPlan, isFormOpen])

  // Get color values based on theme name
  const getThemeClasses = (theme: string | null) => {
    switch (theme) {
      case 'emerald':
        return { border: 'border-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-500/10', glow: 'shadow-emerald-500/10', btn: 'bg-emerald-600 hover:bg-emerald-500' }
      case 'purple':
        return { border: 'border-purple-500', text: 'text-purple-500', bg: 'bg-purple-500/10', glow: 'shadow-purple-500/10', btn: 'bg-purple-600 hover:bg-purple-500' }
      case 'rose':
        return { border: 'border-rose-500', text: 'text-rose-500', bg: 'bg-rose-500/10', glow: 'shadow-rose-500/10', btn: 'bg-rose-600 hover:bg-rose-500' }
      case 'orange':
        return { border: 'border-orange-500', text: 'text-orange-500', bg: 'bg-orange-500/10', glow: 'shadow-orange-500/10', btn: 'bg-orange-600 hover:bg-emerald-500' }
      case 'amber':
        return { border: 'border-amber-500', text: 'text-amber-500', bg: 'bg-amber-500/10', glow: 'shadow-amber-500/10', btn: 'bg-amber-600 hover:bg-amber-500' }
      default:
        return { border: 'border-indigo-500', text: 'text-indigo-500', bg: 'bg-indigo-500/10', glow: 'shadow-indigo-500/10', btn: 'bg-indigo-600 hover:bg-indigo-500' }
    }
  }

  // Handle plan status toggle
  const handleToggleActive = async (plan: Plan) => {
    if (!hasEditPermission) {
      showToast('ليس لديك صلاحية لتعديل خطط الاشتراك.', 'error')
      return
    }

    try {
      const res = await API.post(`/admin/subscription-plans/${plan.id}/toggle`)
      showToast(res.data.message || 'تم تغيير حالة الخطة بنجاح.', 'success')
      fetchPlans()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل في تبديل حالة الخطة.', 'error')
    }
  }

  // Handle Reordering
  const handleReorder = async (direction: 'up' | 'down', index: number) => {
    if (!hasEditPermission) {
      showToast('ليس لديك صلاحية لإعادة ترتيب الخطط.', 'error')
      return
    }

    const newPlans = [...plans]
    if (direction === 'up' && index > 0) {
      const temp = newPlans[index]
      newPlans[index] = newPlans[index - 1]
      newPlans[index - 1] = temp
    } else if (direction === 'down' && index < plans.length - 1) {
      const temp = newPlans[index]
      newPlans[index] = newPlans[index + 1]
      newPlans[index + 1] = temp
    } else {
      return // invalid move
    }

    try {
      const ids = newPlans.map(p => p.id)
      await API.post('/admin/subscription-plans/reorder', { orders: ids })
      showToast('تم إعادة الترتيب وحفظه بنجاح.', 'success')
      setPlans(newPlans)
    } catch (err: any) {
      console.error(err)
      showToast('فشل إعادة ترتيب الخطط على الخادم.', 'error')
      fetchPlans()
    }
  }

  // Handle Plan Delete
  const handleDelete = async (plan: Plan) => {
    if (!hasEditPermission) {
      showToast('ليس لديك صلاحية لحذف خطط الاشتراك.', 'error')
      return
    }

    if (!window.confirm(`هل أنت متأكد من حذف الخطة (${plan.name})؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      return
    }

    console.log("Deleting package:", plan.id);

    try {
      const res = await API.delete(`/admin/subscription-plans/${plan.id}`)
      console.log("Delete response:", res);
      showToast(res.data.message || 'تم حذف الخطة بنجاح.', 'success')
      
      // Update UI state immediately without page reload
      setPlans(prev => prev.filter(p => p.id !== plan.id))
      
      fetchPlans()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل حذف الخطة. قد تكون مرتبطة باشتراكات نشطة.', 'error')
    }
  }

  // Trigger form submit or open price confirmation modal
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasEditPermission) {
      showToast('ليس لديك صلاحية لتعديل أو إنشاء الخطط.', 'error')
      return
    }

    const payload = {
      name,
      slug: slug || undefined,
      description: description || null,
      price,
      currency,
      duration_in_days: durationInDays,
      max_courses: maxCourses === '' ? null : Number(maxCourses),
      max_storage_gb: maxStorageGb,
      included_codes: includedCodes,
      featured,
      active,
      sort_order: sortOrder,
      badge_text: badgeText || null,
      color_theme: colorTheme,
      durationType,
      discountPercentage,
      finalPrice,
      isActive,
      billing_options: billingOptions
    }

    // Check if price changed for an existing plan
    if (editingPlan && Number(editingPlan.price) !== Number(price)) {
      setPendingSubmitData(payload)
      setConfirmPriceDetails({ old: Number(editingPlan.price), new: Number(price) })
      setPriceConfirmOpen(true)
    } else {
      submitPlanData(payload)
    }
  }

  const submitPlanData = async (payload: any) => {
    try {
      if (editingPlan) {
        await API.put(`/admin/subscription-plans/${editingPlan.id}`, payload)
        showToast('تم تحديث خطة الاشتراك بنجاح.', 'success')
      } else {
        await API.post('/admin/subscription-plans', payload)
        showToast('تم إنشاء خطة الاشتراك بنجاح.', 'success')
      }
      setIsFormOpen(false)
      setEditingPlan(null)
      fetchPlans()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل حفظ بيانات الخطة.', 'error')
    }
  }

  const handleConfirmPriceChange = () => {
    if (pendingSubmitData) {
      submitPlanData(pendingSubmitData)
      setPriceConfirmOpen(false)
      setPendingSubmitData(null)
      setConfirmPriceDetails(null)
    }
  }

  // Fetch price history
  const viewPriceHistory = async (plan: Plan) => {
    try {
      setSelectedPlanForHistory(plan)
      setHistoryLoading(true)
      setPriceHistory([])
      const res = await API.get(`/admin/subscription-plans/${plan.id}/price-history`)
      setPriceHistory(res.data.history || [])
    } catch (err) {
      console.error(err)
      showToast('فشل في تحميل سجل الأسعار.', 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

  // Fetch audit logs
  const viewAuditLogs = async (plan: Plan) => {
    try {
      setSelectedPlanForLogs(plan)
      setLogsLoading(true)
      setAuditLogs([])
      const res = await API.get(`/admin/subscription-plans/${plan.id}/audit-logs`)
      setAuditLogs(res.data.logs || [])
    } catch (err) {
      console.error(err)
      showToast('فشل في تحميل سجل التغييرات.', 'error')
    } finally {
      setLogsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 text-right font-sans" dir="rtl">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-5 left-5 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl border text-sm font-extrabold shadow-lg animate-in fade-in slide-in-from-top-4 duration-305 ${
          toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-450' : 'bg-rose-500/15 border-rose-500/30 text-rose-450'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-color)] flex items-center gap-3">
            <Layers className="w-7 h-7 text-indigo-500" />
            <span>إدارة خطط وباقات الاشتراك</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5 font-medium">
            تخصيص أسعار وميزات الباقات وعرض سجلات التغيير والأسعار.
          </p>
        </div>
        
        {hasEditPermission && (
          <button
            id="btn-create-plan"
            onClick={() => {
              setEditingPlan(null)
              setIsFormOpen(true)
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm px-6 py-3 rounded-2xl shadow-lg shadow-indigo-600/15 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء باقة جديدة</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-[var(--text-secondary)] mt-4 font-bold">جاري تحميل باقات الاشتراك...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-3xl flex items-center gap-3 text-sm font-bold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[var(--border-color)] rounded-3xl">
          <Layers className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-sm text-[var(--text-secondary)] font-extrabold">لا يوجد خطط اشتراك مضافة حالياً.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan, index) => {
            const theme = getThemeClasses(plan.color_theme)
            const getDurationLabel = (type: string | undefined) => {
              switch (type) {
                case 'monthly': return 'شهر'
                case 'quarterly': return '3 شهور'
                case 'semi_annual': return '6 شهور'
                case 'yearly': return 'سنة'
                default: return 'شهر'
              }
            }
            const isPlanActive = plan.isActive !== false
            return (
              <div 
                key={plan.id}
                className={`bg-[var(--card-bg)] border-2 rounded-3xl p-6 flex flex-col justify-between relative shadow-md transition-all duration-300 ${
                  !isPlanActive
                    ? 'border-slate-800 bg-slate-900/40 opacity-70 grayscale'
                    : plan.featured 
                      ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.1)] scale-[1.01]' 
                      : 'border-[var(--border-color)] hover:border-indigo-500/30'
                }`}
              >
                {/* Active Indicator / Badge */}
                <div className="absolute top-4 left-4 flex gap-1.5 flex-row-reverse">
                  {isPlanActive ? (
                    <span className="text-[9px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full shadow-sm">
                      نشطة ومتاحة
                    </span>
                  ) : (
                    <span className="text-[9px] font-black bg-slate-850 border border-slate-750 text-slate-400 px-2.5 py-0.5 rounded-full shadow-sm">
                      غير متاحة حالياً
                    </span>
                  )}
                  {plan.badge_text && (
                    <span className={`text-[9px] font-black text-white px-2.5 py-0.5 rounded-full shadow-sm ${theme.btn}`}>
                      {plan.badge_text}
                    </span>
                  )}
                </div>

                <div>
                  {/* Plan Theme Header */}
                  <div className="flex items-center gap-3 mb-4 mt-2">
                    <span className={`p-2.5 rounded-2xl border ${theme.border} ${theme.bg} ${theme.text}`}>
                      <Layers className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-black text-[var(--text-color)]">{plan.name}</h3>
                      <span className="text-[10px] font-bold text-slate-400">Slug: {plan.slug}</span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed mb-6 min-h-[40px]">
                    {plan.description || 'لا يوجد وصف مضاف لهذه الباقة.'}
                  </p>

                  <hr className="border-[var(--border-color)] mb-6" />

                  {/* Plan Details Specs */}
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                        السعر الأصلي:
                      </span>
                      <span className="font-black text-[var(--text-color)] text-sm">
                        {plan.price} {plan.currency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-indigo-500" />
                        الخصم:
                      </span>
                      <span className="font-black text-rose-500">
                        {plan.discountPercentage || 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                        السعر النهائي:
                      </span>
                      <span className="font-black text-emerald-500 text-sm">
                        {plan.finalPrice || plan.price} {plan.currency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        مدة الاشتراك:
                      </span>
                      <span className="font-black text-[var(--text-color)]">
                        {getDurationLabel(plan.durationType)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-500" />
                        حالة الباقة:
                      </span>
                      <span className={`font-black ${isPlanActive ? 'text-emerald-500' : 'text-slate-500'}`}>
                        {isPlanActive ? 'نشط' : 'غير نشط'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-indigo-500" />
                        مساحة التخزين:
                      </span>
                      <span className="font-black text-[var(--text-color)]">
                        {plan.max_storage_gb} جيجابايت
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5 text-indigo-500" />
                        أكواد الطلاب المشمولة:
                      </span>
                      <span className="font-black text-[var(--text-color)]">
                        {plan.included_codes} كود
                      </span>
                    </div>
                  </div>
                </div>

                {/* Plan Control Panel Actions */}
                <div className="flex flex-col gap-3 mt-4">
                  {/* Reordering and Toggling Status Controls */}
                  <div className="flex justify-between items-center bg-[var(--bg-color)]/30 border border-[var(--border-color)] px-4 py-2 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-bold">ترتيب: #{plan.sort_order}</span>
                    <div className="flex gap-1.5">
                      <button 
                        disabled={index === 0}
                        onClick={() => handleReorder('up', index)}
                        className="p-1.5 hover:bg-[var(--border-color)] text-[var(--text-color)] rounded-lg transition disabled:opacity-30 cursor-pointer"
                        title="تحريك لأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        disabled={index === plans.length - 1}
                        onClick={() => handleReorder('down', index)}
                        className="p-1.5 hover:bg-[var(--border-color)] text-[var(--text-color)] rounded-lg transition disabled:opacity-30 cursor-pointer"
                        title="تحريك لأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold">نشط:</span>
                      <button
                        onClick={() => handleToggleActive(plan)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${isPlanActive ? 'bg-indigo-600' : 'bg-slate-700'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 transform ${isPlanActive ? '-translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setEditingPlan(plan)
                        setIsFormOpen(true)
                      }}
                      className="py-2.5 bg-slate-800 hover:bg-slate-750 border border-[var(--border-color)] text-[var(--text-color)] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(plan)}
                      className="py-2.5 bg-slate-800 hover:bg-rose-950/20 border border-[var(--border-color)] hover:border-rose-900/30 text-[var(--text-color)] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      حذف
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => viewPriceHistory(plan)}
                      className="py-2 bg-slate-900/40 hover:bg-slate-900/60 text-slate-300 rounded-xl font-medium text-[10px] flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
                    >
                      <History className="w-3 h-3 text-indigo-400" />
                      سجل الأسعار
                    </button>
                    <button
                      onClick={() => viewAuditLogs(plan)}
                      className="py-2 bg-slate-900/40 hover:bg-slate-900/60 text-slate-300 rounded-xl font-medium text-[10px] flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
                    >
                      <FileText className="w-3 h-3 text-indigo-400" />
                      سجل التعديلات
                    </button>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}

      {/* -------------------- CREATE/EDIT PLAN FORM DRAWER/MODAL -------------------- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 left-4 p-2 hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-black text-[var(--text-color)] mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              <span>{editingPlan ? `تعديل باقة: ${editingPlan.name}` : 'إنشاء باقة اشتراك جديدة'}</span>
            </h2>

            {!hasEditPermission && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-bold mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>أنت كـ مشرف مخصص ليس لديك الصلاحية لحفظ هذا النموذج (عرض فقط).</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-right">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم الباقة *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition"
                    placeholder="مثال: الباقة الفضية"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الرابط الفريد (Slug)</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition"
                    placeholder="سيتم إنشاؤه تلقائياً إذا ترك فارغاً"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">الوصف والتفاصيل</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition resize-none"
                  placeholder="اكتب ميزات هذه الباقة ومحتواها بالتفصيل..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Duration Type selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">مدة الاشتراك *</label>
                  <select
                    value={durationType}
                    onChange={(e) => {
                      const val = e.target.value
                      setDurationType(val)
                      // Auto-update durationInDays for backwards compatibility
                      if (val === 'monthly') setDurationInDays(30)
                      else if (val === 'quarterly') setDurationInDays(90)
                      else if (val === 'semi_annual') setDurationInDays(180)
                      else if (val === 'yearly') setDurationInDays(365)
                    }}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                  >
                    <option value="monthly">شهر</option>
                    <option value="quarterly">3 شهور</option>
                    <option value="semi_annual">6 شهور</option>
                    <option value="yearly">سنة</option>
                  </select>
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">العملة *</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                  >
                    <option value="EGP">EGP - الجنيه المصري</option>
                    <option value="USD">USD - الدولار الأمريكي</option>
                    <option value="SAR">SAR - الريال السعودي</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Base Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">السعر الأصلي *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                {/* Discount Percentage */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الخصم (%) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                {/* Final Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">السعر النهائي (محسوب)</label>
                  <input
                    type="number"
                    readOnly
                    value={finalPrice}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)]/50 border border-[var(--border-color)] rounded-xl text-sm font-semibold text-slate-400 focus:outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Storage */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">مساحة التخزين (جيجابايت) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={maxStorageGb}
                    onChange={(e) => setMaxStorageGb(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                {/* Codes */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">أكواد الطلاب المشمولة *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={includedCodes}
                    onChange={(e) => setIncludedCodes(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                {/* Max Courses */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الحد الأقصى للكورسات</label>
                  <input
                    type="number"
                    min="0"
                    value={maxCourses}
                    onChange={(e) => setMaxCourses(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition"
                    placeholder="اتركه فارغاً لبلا حد أقصى"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Badge text */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">نص الشارة المميزة (badge)</label>
                  <input
                    type="text"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition"
                    placeholder="مثال: الأكثر شعبية"
                  />
                </div>

                {/* Color Theme */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">سمة اللون للمظهر</label>
                  <select
                    value={colorTheme}
                    onChange={(e) => setColorTheme(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                  >
                    <option value="indigo">Indigo (أزرق نيلي)</option>
                    <option value="emerald">Emerald (أخضر زمردي)</option>
                    <option value="purple">Purple (بنفسجي)</option>
                    <option value="rose">Rose (وردي/أحمر)</option>
                    <option value="orange">Orange (برتقالي)</option>
                    <option value="amber">Amber (أصفر ذهبي)</option>
                  </select>
                </div>

                {/* Sort order */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الترتيب *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm font-semibold text-[var(--text-color)] focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Subscription Billing Options */}
              <div className="bg-[var(--bg-color)]/20 border border-[var(--border-color)] p-5 rounded-2xl space-y-4">
                <h3 className="text-sm font-black text-indigo-400">Subscription Billing Options (اختيارات الدفع المخصصة للاشتراك)</h3>
                <p className="text-[10px] text-slate-400 font-medium">تخصيص فترات دفع متعددة لهذه الباقة. هذه الخيارات اختيارية. إذا تم إبقاؤها غير مفعلة، ستعمل الباقة بالنظام الافتراضي الحالي.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Monthly Option */}
                  <div className="border border-[var(--border-color)] p-4 rounded-xl space-y-3 bg-[var(--surface-bg)]/40">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
                      <input 
                        type="checkbox"
                        checked={billingOptions.monthly.enabled}
                        onChange={(e) => setBillingOptions({
                          ...billingOptions,
                          monthly: { ...billingOptions.monthly, enabled: e.target.checked }
                        })}
                        className="w-4 h-4 border-[var(--border-color)] rounded bg-[var(--bg-color)] accent-indigo-500"
                      />
                      <span>تفعيل الدفع الشهري (Monthly)</span>
                    </label>
                    {billingOptions.monthly.enabled && (
                      <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-300 mb-1">السعر (EGP)</label>
                          <input 
                            type="number"
                            min="0"
                            value={billingOptions.monthly.price}
                            onChange={(e) => setBillingOptions({
                              ...billingOptions,
                              monthly: { ...billingOptions.monthly, price: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-color)] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-300 mb-1">الخصم (%)</label>
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            value={billingOptions.monthly.discount}
                            onChange={(e) => setBillingOptions({
                              ...billingOptions,
                              monthly: { ...billingOptions.monthly, discount: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-color)] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3 Months Option */}
                  <div className="border border-[var(--border-color)] p-4 rounded-xl space-y-3 bg-[var(--surface-bg)]/40">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
                      <input 
                        type="checkbox"
                        checked={billingOptions.three_months.enabled}
                        onChange={(e) => setBillingOptions({
                          ...billingOptions,
                          three_months: { ...billingOptions.three_months, enabled: e.target.checked }
                        })}
                        className="w-4 h-4 border-[var(--border-color)] rounded bg-[var(--bg-color)] accent-indigo-500"
                      />
                      <span>تفعيل دفع 3 أشهر (3 Months)</span>
                    </label>
                    {billingOptions.three_months.enabled && (
                      <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-300 mb-1">السعر الإجمالي (EGP)</label>
                          <input 
                            type="number"
                            min="0"
                            value={billingOptions.three_months.price}
                            onChange={(e) => setBillingOptions({
                              ...billingOptions,
                              three_months: { ...billingOptions.three_months, price: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-color)] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-300 mb-1">الخصم (%)</label>
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            value={billingOptions.three_months.discount}
                            onChange={(e) => setBillingOptions({
                              ...billingOptions,
                              three_months: { ...billingOptions.three_months, discount: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-color)] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 6 Months Option */}
                  <div className="border border-[var(--border-color)] p-4 rounded-xl space-y-3 bg-[var(--surface-bg)]/40">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
                      <input 
                        type="checkbox"
                        checked={billingOptions.six_months.enabled}
                        onChange={(e) => setBillingOptions({
                          ...billingOptions,
                          six_months: { ...billingOptions.six_months, enabled: e.target.checked }
                        })}
                        className="w-4 h-4 border-[var(--border-color)] rounded bg-[var(--bg-color)] accent-indigo-500"
                      />
                      <span>تفعيل دفع 6 أشهر (6 Months)</span>
                    </label>
                    {billingOptions.six_months.enabled && (
                      <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-300 mb-1">السعر الإجمالي (EGP)</label>
                          <input 
                            type="number"
                            min="0"
                            value={billingOptions.six_months.price}
                            onChange={(e) => setBillingOptions({
                              ...billingOptions,
                              six_months: { ...billingOptions.six_months, price: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-color)] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-300 mb-1">الخصم (%)</label>
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            value={billingOptions.six_months.discount}
                            onChange={(e) => setBillingOptions({
                              ...billingOptions,
                              six_months: { ...billingOptions.six_months, discount: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-color)] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Yearly Option */}
                  <div className="border border-[var(--border-color)] p-4 rounded-xl space-y-3 bg-[var(--surface-bg)]/40">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
                      <input 
                        type="checkbox"
                        checked={billingOptions.yearly.enabled}
                        onChange={(e) => setBillingOptions({
                          ...billingOptions,
                          yearly: { ...billingOptions.yearly, enabled: e.target.checked }
                        })}
                        className="w-4 h-4 border-[var(--border-color)] rounded bg-[var(--bg-color)] accent-indigo-500"
                      />
                      <span>تفعيل الدفع السنوي (Yearly)</span>
                    </label>
                    {billingOptions.yearly.enabled && (
                      <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-300 mb-1">السعر الإجمالي (EGP)</label>
                          <input 
                            type="number"
                            min="0"
                            value={billingOptions.yearly.price}
                            onChange={(e) => setBillingOptions({
                              ...billingOptions,
                              yearly: { ...billingOptions.yearly, price: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-color)] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-300 mb-1">الخصم (%)</label>
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            value={billingOptions.yearly.discount}
                            onChange={(e) => setBillingOptions({
                              ...billingOptions,
                              yearly: { ...billingOptions.yearly, discount: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-color)] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6 py-2 bg-[var(--bg-color)]/20 border border-[var(--border-color)] p-4 rounded-2xl">
                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold select-none">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-4 h-4 border-[var(--border-color)] rounded bg-[var(--bg-color)] accent-indigo-500"
                  />
                  <span>تمييز الباقة في واجهة العرض (الأكثر شعبية)</span>
                </label>
              </div>

              {/* Active / Inactive Toggle Switch */}
              <div className="flex items-center justify-between p-4 bg-[var(--surface-bg)] rounded-2xl border border-[var(--border-color)]">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-color)]">حالة الباقة</h4>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">تبديل حالة نشاط الباقة (تفعيل / إلغاء تفعيل)</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isActive
                    setIsActive(next)
                    setActive(next)
                  }}
                  className={`w-20 h-8 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer flex items-center justify-between relative ${isActive ? 'bg-indigo-600' : 'bg-slate-700'}`}
                >
                  <span className="text-[9px] font-black text-white px-2.5 select-none">{isActive ? 'نشط' : 'غير نشط'}</span>
                  <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ${isActive ? '-translate-x-12' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Form buttons */}
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 border border-[var(--border-color)] text-slate-300 hover:text-white text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer"
                >
                  إلغاء
                </button>
                {hasEditPermission && (
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-600/15 active:scale-95 transition cursor-pointer"
                  >
                    حفظ البيانات
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- PRICE CHANGE CONFIRMATION MODAL -------------------- */}
      {priceConfirmOpen && confirmPriceDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--card-bg)] border border-rose-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-right animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-rose-500/15 text-rose-500 rounded-2xl border border-rose-500/30">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-rose-500">تأكيد تعديل سعر باقة الاشتراك</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 font-bold">
                  أنت على وشك تعديل سعر هذه الخطة. يرجى مراجعة تفاصيل التغيير.
                </p>
              </div>
            </div>

            <div className="bg-[var(--bg-color)]/60 border border-[var(--border-color)] p-4 rounded-2xl mb-6 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400">السعر القديم:</span>
                <span className="font-black text-rose-400 line-through">{confirmPriceDetails.old} {currency}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400">السعر الجديد المقترح:</span>
                <span className="font-black text-emerald-400 text-sm">{confirmPriceDetails.new} {currency}</span>
              </div>
              
              <div className="pt-2 border-t border-[var(--border-color)] text-[10px] text-amber-400 font-extrabold flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-500" />
                <span>
                  تنبيه: تغيير الأسعار لن يؤثر على الاشتراكات النشطة الحالية للمعلمين. سيتم فرض السعر الجديد فقط عند الاشتراكات أو التجديدات الجديدة.
                </span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setPriceConfirmOpen(false)
                  setPendingSubmitData(null)
                  setConfirmPriceDetails(null)
                }}
                className="px-4 py-2 border border-[var(--border-color)] text-slate-300 hover:text-white text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                onClick={handleConfirmPriceChange}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-rose-600/15 active:scale-95 transition cursor-pointer"
              >
                موافق، تعديل السعر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- PRICE HISTORY SIDE DRAWER / MODAL -------------------- */}
      {selectedPlanForHistory && (
        <div className="fixed inset-0 z-40 flex items-center justify-end bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--card-bg)] border-r border-[var(--border-color)] h-full max-w-lg w-full p-6 shadow-2xl relative flex flex-col justify-between animate-in slide-in-from-left duration-300">
            <div>
              <button
                onClick={() => setSelectedPlanForHistory(null)}
                className="absolute top-4 left-4 p-2 hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-lg font-black text-[var(--text-color)] mb-1 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                <span>سجل أسعار الخطة: {selectedPlanForHistory.name}</span>
              </h2>
              <span className="text-[10px] text-slate-400 font-bold block mb-6">سجل التغييرات الكامل للتسعير وتاريخه.</span>

              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : priceHistory.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[var(--border-color)] rounded-2xl">
                  <p className="text-xs text-[var(--text-secondary)] font-bold">لا يوجد تغييرات مسجلة للأسعار على هذه الباقة.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {priceHistory.map((item) => (
                    <div key={item.id} className="bg-[var(--bg-color)]/40 border border-[var(--border-color)] p-4 rounded-2xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
                          تعديل تسعير
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          {new Date(item.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs py-2">
                        <div>
                          <span className="text-slate-400 font-bold block">السعر السابق:</span>
                          <span className="font-extrabold text-rose-500 line-through">{item.old_price} {selectedPlanForHistory.currency}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block">السعر الجديد:</span>
                          <span className="font-extrabold text-emerald-500">{item.new_price} {selectedPlanForHistory.currency}</span>
                        </div>
                      </div>

                      {item.admin && (
                        <div className="pt-2 border-t border-[var(--border-color)] mt-1.5 flex justify-between items-center text-[10px]">
                          <span className="text-slate-500 font-medium">بواسطة المشرف:</span>
                          <span className="font-bold text-slate-300">{item.admin.name} ({item.admin.email})</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedPlanForHistory(null)}
              className="w-full py-3 bg-[var(--bg-color)]/50 hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-slate-300 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* -------------------- AUDIT LOGS SIDE DRAWER / MODAL -------------------- */}
      {selectedPlanForLogs && (
        <div className="fixed inset-0 z-40 flex items-center justify-end bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--card-bg)] border-r border-[var(--border-color)] h-full max-w-xl w-full p-6 shadow-2xl relative flex flex-col justify-between animate-in slide-in-from-left duration-300">
            <div className="flex-1 flex flex-col min-h-0">
              <button
                onClick={() => setSelectedPlanForLogs(null)}
                className="absolute top-4 left-4 p-2 hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-lg font-black text-[var(--text-color)] mb-1 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>سجل عمليات الباقة: {selectedPlanForLogs.name}</span>
              </h2>
              <span className="text-[10px] text-slate-400 font-bold block mb-6">سجل التغييرات الكامل للخصائص والقيم المشمولة.</span>

              {logsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[var(--border-color)] rounded-2xl">
                  <p className="text-xs text-[var(--text-secondary)] font-bold">لا يوجد تعديلات مسجلة لهذه الباقة.</p>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="bg-[var(--bg-color)]/40 border border-[var(--border-color)] p-4 rounded-2xl text-right">
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          log.action === 'create' ? 'bg-emerald-500/10 text-emerald-400' :
                          log.action === 'update' ? 'bg-indigo-500/10 text-indigo-400' :
                          log.action === 'delete' ? 'bg-rose-500/10 text-rose-400' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          {log.action === 'create' ? 'إنشاء' :
                           log.action === 'update' ? 'تحديث خصائص' :
                           log.action === 'delete' ? 'حذف' :
                           log.action === 'toggle_active' ? 'تغيير حالة النشاط' : log.action}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          {new Date(log.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>

                      {/* Display Old & New Values */}
                      {log.action === 'update' && log.old_values && log.new_values && (
                        <div className="my-2.5 space-y-1.5 text-[10px] bg-[var(--bg-color)]/80 p-3 rounded-xl border border-[var(--border-color)] font-medium">
                          {Object.keys(log.new_values).map((key) => {
                            if (JSON.stringify(log.old_values[key]) !== JSON.stringify(log.new_values[key])) {
                              // Skip system fields
                              if (['updated_at', 'price_egp', 'video_storage_gb', 'student_codes', 'duration_days', 'is_popular', 'is_trial'].includes(key)) return null
                              return (
                                <div key={key} className="flex flex-col gap-0.5 py-1 border-b border-[var(--border-color)] last:border-b-0">
                                  <span className="font-bold text-slate-400">حقل ({key}):</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-rose-400 line-through">{String(log.old_values[key] ?? 'فارغ')}</span>
                                    <span>←</span>
                                    <span className="text-emerald-400 font-black">{String(log.new_values[key] ?? 'فارغ')}</span>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          })}
                        </div>
                      )}

                      {log.user && (
                        <div className="pt-2 border-t border-[var(--border-color)] mt-2 flex justify-between items-center text-[10px]">
                          <span className="text-slate-500 font-medium">بواسطة المستخدم:</span>
                          <span className="font-bold text-slate-300">{log.user.name} ({log.user.email})</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedPlanForLogs(null)}
              className="w-full py-3 bg-[var(--bg-color)]/50 hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-slate-300 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer mt-4"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
