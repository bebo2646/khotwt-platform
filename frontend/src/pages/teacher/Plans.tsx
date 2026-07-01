import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../../services/api'
import { 
  Award, HardDrive, Users, Check, Clock, Zap, ArrowLeft, CheckCircle, AlertCircle
} from 'lucide-react'

interface Plan {
  id: number
  name: string
  video_storage_gb: number
  student_codes: number
  price_egp: number
  duration_days: number
  is_trial: boolean
  is_popular: boolean
  active?: boolean
}

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
  const [selectedPeriods, setSelectedPeriods] = useState<Record<number, string>>({})

  const getEnabledBillingOptions = (plan: any) => {
    if (!plan.billing_options) return [];
    let opts = plan.billing_options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch(e) { return []; }
    }
    const result = [];
    if (opts.monthly?.enabled) result.push({ key: 'monthly', label: 'شهري', price: Number(opts.monthly.price), discount: Number(opts.monthly.discount) });
    if (opts.three_months?.enabled) result.push({ key: 'quarterly', label: '3 أشهر', price: Number(opts.three_months.price), discount: Number(opts.three_months.discount) });
    if (opts.six_months?.enabled) result.push({ key: 'semi_annual', label: '6 أشهر', price: Number(opts.six_months.price), discount: Number(opts.six_months.discount) });
    if (opts.yearly?.enabled) result.push({ key: 'annual', label: 'سنوي', price: Number(opts.yearly.price), discount: Number(opts.yearly.discount) });
    return result;
  }
  
  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await API.get('/teacher/subscription')
      setSubscription(res.data.subscription)
      setPlans(res.data.plans || [])
      if (res.data.settings) {
        setSettings(res.data.settings)
      }
      if (res.data.subscription?.billing_cycle) {
        setBillingPeriod(res.data.subscription.billing_cycle)
      }
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل تحميل خطط الاشتراك.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Invalidate stale cache and auto-refetch if inactive plan is found
  useEffect(() => {
    if (plans.length > 0) {
      const hasInactive = plans.some(p => p.active === false || (p.active as any) === 0 || (p as any).active === '0' || (p as any).isActive === false || ((p as any).isActive as any) === 0 || ((p as any).isActive as any) === '0');
      if (hasInactive) {
        console.warn("Inactive plan detected in cache. Invalidating and auto-refetching...");
        setPlans(prev => prev.filter(p => p.active !== false && (p.active as any) !== 0 && (p as any).active !== '0' && (p as any).isActive !== false && ((p as any).isActive as any) !== 0 && ((p as any).isActive as any) !== '0'));
        loadData();
      }
    }
  }, [plans]);

  const handleRequestUpgrade = async (planId: number) => {
    try {
      setSubmittingId(planId)
      const selectedPlan = plans.find(p => p.id === planId)
      
      let pDuration = billingPeriod;
      const customOpts = getEnabledBillingOptions(selectedPlan);
      if (customOpts.length > 0) {
        pDuration = (selectedPeriods[planId] || customOpts[0].key) as any;
      } else if (selectedPlan && (selectedPlan as any).durationType) {
        pDuration = (selectedPlan as any).durationType;
      }
      
      await API.post('/teacher/subscription/upgrade-request', {
        type: 'plan_upgrade',
        requested_plan_id: planId,
        billing_period: (pDuration as string) === 'yearly' ? 'annual' : pDuration
      })
      showToast('تم تقديم طلب الترقية بنجاح إلى إدارة المنصة. سيتم تفعيله بعد التحقق.', 'success')
      // Refresh to get any updated request status
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل تقديم طلب الترقية.', 'error')
    } finally {
      setSubmittingId(null)
    }
  }

  // Calculate pricing based on period and discounts
  const calculatePrice = (plan: Plan) => {
    // If custom options exist, use them
    const customOpts = getEnabledBillingOptions(plan);
    if (customOpts.length > 0) {
      const currentPeriod = selectedPeriods[plan.id] || customOpts[0].key;
      const opt = customOpts.find(o => o.key === currentPeriod) || customOpts[0];
      
      const price = opt.price;
      const discount = opt.discount;
      const finalPrice = price - (price * discount / 100);
      
      let label = 'EGP / شهرياً';
      if (opt.key === 'quarterly') label = 'EGP / 3 أشهر';
      else if (opt.key === 'semi_annual') label = 'EGP / 6 أشهر';
      else if (opt.key === 'annual') label = 'EGP / سنوي';
      
      return {
        price: finalPrice,
        text: label,
        originalPrice: discount > 0 ? price : null,
        discountPercent: discount > 0 ? discount : null,
        discountAmount: discount > 0 ? (price * discount / 100) : null
      }
    }

    if ((plan as any).durationType) {
      const price = Number((plan as any).price) || Number(plan.price_egp) || 0
      const discount = Number((plan as any).discountPercentage) || 0
      const finalPrice = Number((plan as any).finalPrice) || price
      
      let label = 'EGP / شهرياً'
      if ((plan as any).durationType === 'quarterly') label = 'EGP / 3 أشهر'
      else if ((plan as any).durationType === 'semi_annual') label = 'EGP / 6 أشهر'
      else if ((plan as any).durationType === 'yearly' || (plan as any).durationType === 'annual') label = 'EGP / سنوي'
      
      return {
        price: finalPrice,
        text: label,
        originalPrice: discount > 0 ? price : null,
        discountPercent: discount > 0 ? discount : null,
        discountAmount: discount > 0 ? (price - finalPrice) : null
      }
    }

    if (plan.price_egp === 0) return { price: 0, text: 'مجاناً' }
    
    let months = 1
    let discount = 0
    let label = 'EGP / شهرياً'
    
    if (billingPeriod === 'quarterly') {
      months = 3
      discount = 0
      label = 'EGP / 3 أشهر'
    } else if (billingPeriod === 'semi_annual') {
      months = 6
      discount = parseFloat(settings.discount_semi_annually || '10')
      label = 'EGP / نصف سنوي'
    } else if (billingPeriod === 'annual') {
      months = 12
      discount = parseFloat(settings.discount_annually || '20')
      label = 'EGP / سنوي'
    }
    
    const basePrice = plan.price_egp * months
    const discountAmount = basePrice * (discount / 100)
    const finalPrice = basePrice - discountAmount
    
    return {
      price: finalPrice,
      text: label,
      originalPrice: discount > 0 ? basePrice : null,
      discountPercent: discount > 0 ? discount : null,
      discountAmount: discount > 0 ? discountAmount : null
    }
  }

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
      <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate('/teacher/subscription')}
            className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-color)] transition text-xs mb-3 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            العودة لصفحة اشتراكي
          </button>
          <h1 className="text-3xl font-extrabold text-[var(--text-color)]">خطط وأسعار المنصة</h1>
          <p className="text-[var(--text-secondary)] text-xs mt-1">اختر الباقة المناسبة لقدرة طلابك وااحتياجاتك التخزينية.</p>
        </div>
      </div>

      {/* Billing Cycle Display (Read-Only for Teacher) */}
      <div className="flex justify-center mb-10">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] px-6 py-3.5 rounded-2xl flex items-center gap-2 shadow-sm text-xs font-bold text-[var(--text-color)]">
          <span className="text-[var(--text-secondary)]">دورة الدفع الحالية للاشتراك:</span>
          <span className="px-3 py-1 bg-indigo-600/10 text-indigo-400 rounded-lg">
            {billingPeriod === 'monthly' && 'شهري'}
            {billingPeriod === 'quarterly' && '3 أشهر'}
            {billingPeriod === 'semi_annual' && `نصف سنوي (خصم ${settings.discount_semi_annually || '10'}%)`}
            {billingPeriod === 'annual' && `سنوي (خصم ${settings.discount_annually || '20'}%)`}
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid (Excluded Free Trial for clean 4-column layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {plans.filter(p => p.active && !p.is_trial).map(p => {
          const isCurrent = subscription?.plan?.id === p.id
          const calculated = calculatePrice(p)
          
          return (
            <div 
              key={p.id}
              className={`bg-[var(--card-bg)] border-2 rounded-3xl p-6 backdrop-blur-md flex flex-col justify-between relative transition-all duration-300 ${
                isCurrent 
                  ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_40px_rgba(99,102,241,0.15)] scale-105 z-10' 
                  : p.is_popular 
                  ? 'border-indigo-500/50 shadow-xl' 
                  : 'border-[var(--border-color)] hover:border-indigo-500/50'
              }`}
            >
              {/* Popular Badge */}
              {p.is_popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-[9px] font-black text-white px-4 py-1 rounded-full border border-indigo-400 shadow-md">
                  الأكثر استخداماً
                </div>
              )}
              
              {/* Current Active Plan Badge */}
              {isCurrent && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-500 text-[8px] font-black text-white px-4 py-1 rounded-full border border-indigo-400 shadow-md">
                  باقة اشتراكك الحالية
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="text-center mb-6">
                  <h3 className="text-lg font-black text-[var(--text-color)] mb-2">{p.name}</h3>
                  
                  {/* Duration Selector if billing options exist */}
                  {getEnabledBillingOptions(p).length > 0 && (
                    <div className="flex justify-center gap-1.5 mb-4 bg-[var(--bg-color)]/30 p-1.5 rounded-xl border border-[var(--border-color)]">
                      {getEnabledBillingOptions(p).map(opt => {
                        const isSelected = (selectedPeriods[p.id] || getEnabledBillingOptions(p)[0].key) === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setSelectedPeriods({
                              ...selectedPeriods,
                              [p.id]: opt.key
                            })}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-color)]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center mb-2 min-h-[75px]">
                    {calculated.originalPrice && (
                      <div className="text-[10px] text-[var(--text-secondary)] font-medium mb-1 flex flex-col items-center">
                        <span className="line-through">{calculated.originalPrice.toFixed(2)} EGP</span>
                        {calculated.discountAmount && (
                          <span className="text-[10px] text-rose-500 font-bold">الخصم: -{calculated.discountAmount.toFixed(2)} EGP</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-3xl font-black text-[var(--text-color)]">
                        {calculated.price.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)] font-bold">
                        {calculated.text}
                      </span>
                    </div>
                    {calculated.discountPercent && (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-full mt-1.5">
                        وفر {calculated.discountPercent}%
                      </span>
                    )}
                  </div>
                </div>

                <hr className="border-[var(--border-color)] mb-6" />

                {/* Plan Spec List */}
                <ul className="space-y-4 text-xs text-[var(--text-secondary)] pr-1 mb-8">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span>قدرة الطلاب: <strong className="text-[var(--text-color)]">{p.student_codes} طالب نشط</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span>أكواد نشطة: <strong className="text-[var(--text-color)]">{p.student_codes} كود طلاب</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span>مساحة الفيديو: <strong className="text-[var(--text-color)]">{p.video_storage_gb} جيجابايت</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span>دعم رفع Bunny Stream</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span>تقارير الطلاب والامتحانات</span>
                  </li>
                </ul>
              </div>

              {/* Action Button */}
              {isCurrent ? (
                <div className="w-full py-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs rounded-xl border border-emerald-500/20 text-center flex items-center justify-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  باقة مفعلة حالياً
                </div>
              ) : (
                <button
                  onClick={() => handleRequestUpgrade(p.id)}
                  disabled={submittingId !== null}
                  className={`w-full py-3 text-xs font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                    p.is_popular
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold shadow-lg shadow-indigo-600/15'
                      : 'bg-[var(--card-bg)] hover:bg-[var(--bg-color)] text-[var(--text-color)] border border-[var(--border-color)]'
                  }`}
                >
                  {submittingId === p.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'طلب تفعيل / ترقية'
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
