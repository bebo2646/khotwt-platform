import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../../services/api'
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { SubscriptionPlanCard } from '../../components/ui/SubscriptionPlanCard'

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
  isActive?: boolean
  billing_options?: any
  durationType?: string
  discountPercentage?: number | string
  finalPrice?: number | string
  price?: number | string
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
      
      const rawPlans = res.data.plans || []
      const activePlans = rawPlans.filter((p: any) => p.active !== false && (p as any).active !== 0 && (p as any).active !== '0' && (p as any).isActive !== false && ((p as any).isActive as any) !== 0 && ((p as any).isActive as any) !== '0')
      setPlans(activePlans)
      
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

  const submitSubscriptionRequest = async (payload: any) => {
    await API.post('/teacher/subscription/upgrade-request', payload)
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
      await submitSubscriptionRequest(payload)
      showToast('تم تقديم طلب الترقية بنجاح إلى إدارة المنصة. سيتم تفعيله بعد التحقق.', 'success')
      loadData()
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
          return (
            <SubscriptionPlanCard
              key={p.id}
              plan={p}
              isCurrent={isCurrent}
              billingPeriod={billingPeriod}
              settings={settings}
              onUpgradeRequest={handleRequestUpgrade}
              submitting={submittingId === p.id}
            />
          )
        })}
      </div>
    </div>
  )
}
