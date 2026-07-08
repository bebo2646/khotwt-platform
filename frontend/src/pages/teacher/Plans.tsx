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

  const handleRequestUpgrade = async (planId: number, duration: string) => {
    try {
      setSubmittingId(planId)
      const payload = {
        type: 'plan_upgrade',
        requested_plan_id: planId,
        billing_period: duration === 'yearly' ? 'annual' : duration
      }
      console.log('BOTTOM CARD PAYLOAD', payload)
      const response = await submitSubscriptionRequest(payload)
      console.log('UPGRADE RESPONSE', response)
      console.log('UPGRADE RESPONSE DATA', response.data)

      showToast(response.data.message || 'تم تقديم طلب الترقية بنجاح إلى إدارة المنصة. سيتم تفعيله بعد التحقق.', 'success')
      loadData(true)
    } catch (err: any) {
      console.error(err)
      const errorMsg = err.response?.data?.errors 
        ? Object.values(err.response.data.errors).flat().join(', ')
        : (err.response?.data?.message || 'فشل تقديم طلب الترقية.')
      showToast(errorMsg, 'error')
    } finally {
      setSubmittingId(null)
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
            {billingPeriod === 'semi_annual' && `نصف سنوي (خصم ${settings.discount_semi_annually || '10'}%)`}
            {billingPeriod === 'annual' && `سنوي (خصم ${settings.discount_annually || '20'}%)`}
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
    </div>
  )
}
