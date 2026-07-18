import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../../services/api'
import { ArrowLeft, CheckCircle, AlertCircle, Award } from 'lucide-react'
import { SubscriptionPlanCard, type Plan } from '../../components/ui/SubscriptionPlanCard'

interface Subscription {
  id: number
  plan: Plan
  status: string
}

interface Settings {
  discount_semi_annually: string
  discount_annually: string
}

export default function Plans() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [settings, setSettings] = useState<Settings>({
    discount_semi_annually: '10',
    discount_annually: '20'
  })
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'quarterly' | 'semi_annual' | 'annual'>('monthly')
  const [submittingId, setSubmittingId] = useState<number | null>(null)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  
  // Dynamic packages
  const [activationCodePackages, setActivationCodePackages] = useState<any[]>([])

  // Checkout Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<string>('monthly')
  const [customDays, setCustomDays] = useState<number>(30)
  const [wantsCodes, setWantsCodes] = useState<boolean>(false)
  const [selectedCodePackage, setSelectedCodePackage] = useState<any | null>(null)
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)

  // Search, Filter and Sort States
  const [searchQuery, setSearchQuery] = useState('')
  const [billingTypeFilter, setBillingTypeFilter] = useState<'all' | 'monthly' | 'revenue_sharing'>('all')
  const [sortBy, setSortBy] = useState<'price' | 'newest' | 'popular'>('popular')

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await API.get('/teacher/subscription')
      setSubscription(res.data.subscription)
      
      const rawPlans = res.data.plans || []
      const activePlans = rawPlans.filter((p: any) => p.active !== false && (p as any).active !== 0 && (p as any).active !== '0' && (p as any).isActive !== false && ((p as any).isActive as any) !== 0 && ((p as any).isActive as any) !== '0')
      setPlans(activePlans)
      
      if (res.data.settings) {
        setSettings(res.data.settings)
      }
      if (res.data.subscription?.billing_cycle) {
        setBillingPeriod(res.data.subscription.billing_cycle)
      }
      setHasPendingRequest(!!res.data.has_pending_request)
      if (res.data.activation_code_packages) {
        setActivationCodePackages(res.data.activation_code_packages)
      }
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل تحميل خطط الاشتراك.', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const submitSubscriptionRequest = async (payload: any) => {
    return await API.post('/teacher/subscription/upgrade-request', payload)
  }

  const getScaledPlanPrice = (plan: Plan, days: number) => {
    if (plan.billing_type === 'revenue_sharing') {
      return { base: 0, discount: 0, final: 0 }
    }
    const monthlyPrice = Number(plan.price_egp) || 0
    const basePrice = (monthlyPrice / 30.0) * days
    
    // Apply discount if semi-annual (180 days) or annual (365 days)
    let discount = 0
    if (days === 180) {
      discount = parseFloat(settings.discount_semi_annually || '10')
    } else if (days >= 360) {
      discount = parseFloat(settings.discount_annually || '20')
    }
    
    const finalPrice = basePrice - (basePrice * discount / 100)
    return {
      base: basePrice,
      discount,
      final: finalPrice
    }
  }

  const handleRequestUpgrade = async (planId: number, duration: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan) return
    
    setSelectedPlan(plan)
    setSelectedDuration(duration)
    // Default duration in days based on duration string
    let days = 30
    if (duration === 'quarterly') days = 90
    else if (duration === 'semi_annual') days = 180
    else if (duration === 'annual' || duration === 'yearly') days = 365
    setCustomDays(days)
    
    setWantsCodes(false)
    setSelectedCodePackage(null)
    setCheckoutStep(1)
    setCheckoutModalOpen(true)
  }

  const handleConfirmCheckout = async () => {
    if (!selectedPlan) return
    try {
      setCheckoutSubmitting(true)
      const payload: any = {
        type: 'plan_upgrade',
        requested_plan_id: selectedPlan.id,
        duration_days: customDays,
      }
      
      // If code package selected
      if (wantsCodes && selectedCodePackage) {
        payload.activation_code_package_id = selectedCodePackage.id
      }
      
      const response = await API.post('/teacher/subscription/upgrade-request', payload)
      showToast(response.data.message || 'تم تقديم طلب الترقية بنجاح إلى إدارة المنصة. سيتم تفعيله بعد التحقق.', 'success')
      setCheckoutModalOpen(false)
      loadData(true)
    } catch (err: any) {
      console.error(err)
      const errorMsg = err.response?.data?.errors 
        ? Object.values(err.response.data.errors).flat().join(', ')
        : (err.response?.data?.message || 'فشل تقديم طلب الترقية.')
      showToast(errorMsg, 'error')
    } finally {
      setCheckoutSubmitting(false)
    }
  }

  // Filtered and sorted plans calculation
  const filteredAndSortedPlans = React.useMemo(() => {
    return plans
      .filter(p => {
        // Search text matching
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase()
          const matchesName = p.name.toLowerCase().includes(query)
          const matchesDesc = (p.description || '').toLowerCase().includes(query)
          if (!matchesName && !matchesDesc) return false
        }
        
        // Billing type filter matching
        if (billingTypeFilter === 'monthly') {
          return p.billing_type === 'monthly' || !p.billing_type
        }
        if (billingTypeFilter === 'revenue_sharing') {
          return p.billing_type === 'revenue_sharing'
        }
        
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'price') {
          const priceA = a.billing_type === 'revenue_sharing' ? 0 : (Number(a.finalPrice) || Number(a.price) || Number(a.price_egp) || 0)
          const priceB = b.billing_type === 'revenue_sharing' ? 0 : (Number(b.finalPrice) || Number(b.price) || Number(b.price_egp) || 0)
          return priceA - priceB
        }
        if (sortBy === 'newest') {
          return b.id - a.id
        }
        if (sortBy === 'popular') {
          const popA = a.most_popular ? 1 : 0
          const popB = b.most_popular ? 1 : 0
          if (popA !== popB) return popB - popA
          return (a.sort_order || 0) - (b.sort_order || 0)
        }
        return 0
      })
  }, [plans, searchQuery, billingTypeFilter, sortBy])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-brand-primary">
        <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 text-right font-sans" dir="rtl">
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

      {/* Navigation and Title */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate('/teacher/subscription')}
            className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-color)] transition text-xs mb-3 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            العودة لصفحة اشتراكي الحالية
          </button>
          <h1 className="text-3xl font-extrabold text-[var(--text-color)]">تصفح جميع خطط وأسعار المنصة</h1>
          <p className="text-[var(--text-secondary)] text-xs mt-1">قارن بين خطط الدعم الشهري ونظام مشاركة الأرباح بنسبة مبيعاتك.</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 p-6 rounded-[24px] mb-8 space-y-4 text-right shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between lg:space-y-0 gap-4" dir="rtl">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="البحث عن خطة اشتراك باسم الباقة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/50 border border-slate-800 focus:border-indigo-500 rounded-2xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none placeholder:text-slate-500"
          />
        </div>

        {/* Filter and Sort options */}
        <div className="flex flex-wrap items-center gap-4 justify-start">
          {/* Billing Type Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold">نوع الاشتراك:</span>
            <div className="flex bg-slate-950 p-1 border border-slate-800/80 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setBillingTypeFilter('all')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                  billingTypeFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setBillingTypeFilter('monthly')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                  billingTypeFilter === 'monthly'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                اشتراك شهري
              </button>
              <button
                type="button"
                onClick={() => setBillingTypeFilter('revenue_sharing')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                  billingTypeFilter === 'revenue_sharing'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                نظام النسبة
              </button>
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold">ترتيب حسب:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 text-slate-300 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="popular">الأكثر استخداماً</option>
              <option value="price">السعر (الأقل أولاً)</option>
              <option value="newest">الأحدث</option>
            </select>
          </div>
        </div>
      </div>

      {/* Billing Cycle Display (Read-Only for Teacher) */}
      <div className="flex justify-center mb-8">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] px-6 py-3 rounded-2xl flex items-center gap-2 shadow-sm text-xs font-bold text-[var(--text-color)]">
          <span className="text-[var(--text-secondary)]">دورة الدفع الافتراضية للاشتراكات:</span>
          <span className="px-3 py-1 bg-indigo-600/10 text-indigo-400 rounded-lg">
            {billingPeriod === 'monthly' && 'شهري'}
            {billingPeriod === 'quarterly' && '3 أشهر'}
            {billingPeriod === 'semi_annual' && (Number(settings.discount_semi_annually || 10) > 0 ? `نصف سنوي (خصم ${settings.discount_semi_annually || '10'}%)` : 'نصف سنوي (بدون خصم)')}
            {billingPeriod === 'annual' && (Number(settings.discount_annually || 20) > 0 ? `سنوي (خصم ${settings.discount_annually || '20'}%)` : 'سنوي (بدون خصم)')}
          </span>
        </div>
      </div>

      {/* Empty State vs Cards Grid */}
      {filteredAndSortedPlans.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-16 text-center space-y-4">
          <p className="text-sm text-slate-400 font-medium">لا توجد خطط اشتراك تطابق معايير البحث والفلترة المحددة حالياً.</p>
          <button
            onClick={() => {
              setSearchQuery('')
              setBillingTypeFilter('all')
              setSortBy('popular')
            }}
            className="px-5 py-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            إعادة تعيين فلاتر البحث
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
          {filteredAndSortedPlans.map(p => {
            const isCurrent = subscription?.plan?.id === p.id
            return (
              <SubscriptionPlanCard
                key={p.id}
                plan={p}
                isCurrent={isCurrent}
                billingPeriod={billingPeriod}
                settings={settings}
                onUpgradeRequest={handleRequestUpgrade}
                submitting={submittingId === p.id}
                hasPendingRequest={hasPendingRequest}
              />
            )
          })}
        </div>
      )}

      {/* Checkout Wizard Modal */}
      {checkoutModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-right" dir="rtl">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-850 pb-4">
              <h3 className="text-base font-black text-slate-200 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-400" />
                <span>إتمّام ترقية/تجديد الاشتراك</span>
              </h3>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer text-xs font-bold bg-slate-850 px-3 py-1.5 rounded-lg"
              >
                إغلاق
              </button>
            </div>

            {/* Steps Progress Indicator */}
            <div className="flex justify-between items-center px-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  checkoutStep >= 1 ? 'bg-indigo-650 text-white font-black' : 'bg-slate-800 text-slate-400'
                }`}>1</div>
                <span className="text-[9px] text-slate-450 mt-1 font-bold">مدة الاشتراك</span>
              </div>
              <div className="flex-1 h-0.5 bg-slate-850 mx-2" />
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  checkoutStep >= 2 ? 'bg-indigo-650 text-white font-black' : 'bg-slate-800 text-slate-400'
                }`}>2</div>
                <span className="text-[9px] text-slate-450 mt-1 font-bold">أكواد تفعيل إضافية</span>
              </div>
              <div className="flex-1 h-0.5 bg-slate-850 mx-2" />
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  checkoutStep >= 3 ? 'bg-indigo-650 text-white font-black' : 'bg-slate-800 text-slate-400'
                }`}>3</div>
                <span className="text-[9px] text-slate-450 mt-1 font-bold">مراجعة وتأكيد</span>
              </div>
            </div>

            {/* Wizard Content */}
            <div className="min-h-[220px] py-2">
              
              {/* STEP 1: Select Duration */}
              {checkoutStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-1">الخطوة 1: اختر مدة صلاحية الاشتراك</h4>
                    <p className="text-[10px] text-slate-450">يمكنك اختيار صلاحية مخصصة بالايام للاشتراك وتجديده.</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { label: '30 يوم', days: 30 },
                      { label: '60 يوم', days: 60 },
                      { label: '90 يوم', days: 90 },
                      { label: '180 يوم', days: 180, tag: `خصم ${settings.discount_semi_annually || '10'}%` },
                      { label: '365 يوم', days: 365, tag: `خصم ${settings.discount_annually || '20'}%` }
                    ].map(d => {
                      const isSelected = customDays === d.days
                      return (
                        <button
                          key={d.days}
                          type="button"
                          onClick={() => setCustomDays(d.days)}
                          className={`relative p-3 rounded-xl border text-center transition cursor-pointer flex flex-col justify-center items-center ${
                            isSelected 
                              ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 font-bold' 
                              : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'
                          }`}
                        >
                          <span className="text-xs">{d.label}</span>
                          {d.tag && (
                            <span className="absolute -top-2 bg-rose-600 text-white text-[8px] px-1 rounded-md font-extrabold">{d.tag}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Dynamic Price Calculation display */}
                  <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">الباقة المختارة:</span>
                      <strong className="text-slate-200">{selectedPlan.name}</strong>
                    </div>
                    <div className="text-left">
                      <span className="text-slate-400 block text-[10px]">قيمة الاشتراك:</span>
                      <strong className="text-emerald-400 text-sm">
                        {selectedPlan.billing_type === 'revenue_sharing' 
                          ? 'نظام نسبة مشاركة الأرباح' 
                          : `${getScaledPlanPrice(selectedPlan, customDays).final.toFixed(2)} ج.م`
                        }
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Ask for Codes */}
              {checkoutStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-1">الخطوة 2: هل ترغب في إضافة حزمة أكواد تفعيل للطلاب الآن؟</h4>
                    <p className="text-[10px] text-slate-450">تمنحك الأكواد سعة لتسجيل الطلاب وتفعيل حساباتهم على منصتك.</p>
                  </div>

                  <div className="flex bg-slate-950 p-1 border border-slate-850 rounded-xl gap-2 max-w-xs mx-auto mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setWantsCodes(true)
                        if (activationCodePackages.length > 0) {
                          setSelectedCodePackage(activationCodePackages[0])
                        }
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center cursor-pointer transition ${
                        wantsCodes ? 'bg-indigo-600 text-white font-black' : 'text-slate-500'
                      }`}
                    >
                      نعم، أرغب في إضافة حزمة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWantsCodes(false)
                        setSelectedCodePackage(null)
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center cursor-pointer transition ${
                        !wantsCodes ? 'bg-indigo-600 text-white font-black' : 'text-slate-500'
                      }`}
                    >
                      لا، شكراً
                    </button>
                  </div>

                  {wantsCodes && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[140px] overflow-y-auto pr-1">
                      {activationCodePackages.map(pkg => {
                        const isSelected = selectedCodePackage?.id === pkg.id
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => setSelectedCodePackage(pkg)}
                            className={`p-3 rounded-xl border text-right transition cursor-pointer flex justify-between items-center ${
                              isSelected 
                                ? 'bg-indigo-650/10 border-indigo-550 text-indigo-400 font-bold' 
                                : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'
                            }`}
                          >
                            <div>
                              <span className="text-xs font-black block text-slate-200">{pkg.name}</span>
                              <span className="text-[10px] text-slate-450">{pkg.number_of_codes} كود طلاب</span>
                            </div>
                            <span className="text-xs font-black text-emerald-450">{Number(pkg.total_price).toFixed(2)} ج.م</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Grand Total Summary */}
              {checkoutStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-1">الخطوة 3: مراجعة ملخص الفاتورة الإجمالية</h4>
                    <p className="text-[10px] text-slate-450">يرجى التأكد من تفاصيل طلبك وقيمته قبل إرساله للإدارة.</p>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 text-xs space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">باقة الاشتراك الأساسية:</span>
                      <strong className="text-slate-200">{selectedPlan.name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">صلاحية الاشتراك:</span>
                      <strong className="text-slate-200">{customDays} يوم</strong>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-850/60 pb-2">
                      <span className="text-slate-400 font-bold">سعر الباقة الأساسي:</span>
                      <strong className="text-emerald-400">
                        {selectedPlan.billing_type === 'revenue_sharing' 
                          ? 'مشاركة أرباح (0.00 ج.م)' 
                          : `${getScaledPlanPrice(selectedPlan, customDays).final.toFixed(2)} ج.م`
                        }
                      </strong>
                    </div>

                    {wantsCodes && selectedCodePackage && (
                      <div className="flex justify-between items-center border-b border-slate-850/60 pb-2">
                        <span className="text-slate-400 font-bold">حزمة الأكواد المضافة ({selectedCodePackage.name}):</span>
                        <strong className="text-emerald-400">{Number(selectedCodePackage.total_price).toFixed(2)} ج.م</strong>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-sm font-black text-indigo-400">المجموع الإجمالي للفاتورة:</span>
                      <strong className="text-base font-black text-emerald-400">
                        {(
                          (selectedPlan.billing_type === 'revenue_sharing' ? 0 : getScaledPlanPrice(selectedPlan, customDays).final) + 
                          (wantsCodes && selectedCodePackage ? Number(selectedCodePackage.total_price) : 0)
                        ).toFixed(2)} ج.م
                      </strong>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-850">
              <div>
                {checkoutStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCheckoutStep((prev) => (prev - 1) as any)}
                    className="px-5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    السابق
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
                  className="px-5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-350 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                {checkoutStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setCheckoutStep((prev) => (prev + 1) as any)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer"
                  >
                    التالي
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmCheckout}
                    disabled={checkoutSubmitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl active:scale-95 transition cursor-pointer disabled:opacity-50"
                  >
                    {checkoutSubmitting ? 'جاري التقديم...' : 'تأكيد وإرسال الطلب'}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
