import React, { useState } from 'react'
import { Check, CheckCircle } from 'lucide-react'

// Plan interface including all new dynamic fields
export interface Plan {
  id: number
  name: string
  video_storage_gb: number
  student_codes: number
  price_egp: number
  duration_days?: number
  is_trial?: boolean
  featured?: boolean
  active?: boolean
  isActive?: boolean
  billing_options?: any
  durationType?: string
  discountPercentage?: number | string
  finalPrice?: number | string
  price?: number | string

  billing_type?: 'monthly' | 'revenue_sharing'
  commission_percentage?: number | string
  default_storage_gb?: number
  auto_expand_storage?: boolean
  codes_limit_type?: 'unlimited' | 'max'
  max_codes_limit?: number
  most_popular?: boolean
  recommended?: boolean
  description?: string | null
  sort_order?: number
}

interface SubscriptionPlanCardProps {
  plan: Plan
  isCurrent: boolean
  billingPeriod: 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
  settings: {
    discount_semi_annually: string
    discount_annually: string
  }
  onUpgradeRequest: (planId: number, duration: string) => Promise<void>
  submitting: boolean
  hasPendingRequest?: boolean
}

export const SubscriptionPlanCard: React.FC<SubscriptionPlanCardProps> = ({
  plan,
  isCurrent,
  billingPeriod,
  settings,
  onUpgradeRequest,
  submitting,
  hasPendingRequest = false
}) => {
  const getEnabledBillingOptions = (p: Plan) => {
    if (!p.billing_options) return []
    let opts = p.billing_options
    if (typeof opts === 'string') {
      try {
        opts = JSON.parse(opts)
      } catch (e) {
        return []
      }
    }
    const result = []
    if (opts.monthly?.enabled) {
      result.push({ key: 'monthly', label: 'شهري', price: Number(opts.monthly.price), discount: Number(opts.monthly.discount) })
    }
    if (opts.three_months?.enabled) {
      result.push({ key: 'quarterly', label: '3 أشهر', price: Number(opts.three_months.price), discount: Number(opts.three_months.discount) })
    }
    if (opts.six_months?.enabled) {
      result.push({ key: 'semi_annual', label: '6 أشهر', price: Number(opts.six_months.price), discount: Number(opts.six_months.discount) })
    }
    if (opts.yearly?.enabled) {
      result.push({ key: 'annual', label: 'سنوي', price: Number(opts.yearly.price), discount: Number(opts.yearly.discount) })
    }
    return result
  }

  const customOpts = getEnabledBillingOptions(plan)
  const initialPeriod = customOpts.length > 0 ? customOpts[0].key : (plan.durationType || billingPeriod)
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialPeriod)

  const calculatePrice = () => {
    // 1. Percentage Split / Revenue Sharing
    if (plan.billing_type === 'revenue_sharing') {
      return {
        price: 0,
        text: `عمولة: ${plan.commission_percentage}%`,
        isRevenueSharing: true,
        originalPrice: null,
        discountPercent: null,
        discountAmount: null
      }
    }

    // 2. Custom billing periods from admin
    if (customOpts.length > 0) {
      const opt = customOpts.find(o => o.key === selectedPeriod) || customOpts[0]
      const price = opt.price
      const discount = opt.discount
      const finalPrice = price - (price * discount / 100)

      let label = 'EGP / شهرياً'
      if (opt.key === 'quarterly') label = 'EGP / 3 أشهر'
      else if (opt.key === 'semi_annual') label = 'EGP / 6 أشهر'
      else if (opt.key === 'annual') label = 'EGP / سنوي'

      return {
        price: finalPrice,
        text: label,
        originalPrice: discount > 0 ? price : null,
        discountPercent: discount > 0 ? discount : null,
        discountAmount: discount > 0 ? (price * discount / 100) : null
      }
    }

    // 3. Simple duration settings
    if (plan.durationType) {
      const price = Number(plan.price) || Number(plan.price_egp) || 0
      const discount = Number(plan.discountPercentage) || 0
      const finalPrice = Number(plan.finalPrice) || price

      let label = 'EGP / شهرياً'
      if (plan.durationType === 'quarterly') label = 'EGP / 3 أشهر'
      else if (plan.durationType === 'semi_annual') label = 'EGP / 6 أشهر'
      else if (plan.durationType === 'yearly' || plan.durationType === 'annual') label = 'EGP / سنوي'

      return {
        price: finalPrice,
        text: label,
        originalPrice: discount > 0 ? price : null,
        discountPercent: discount > 0 ? discount : null,
        discountAmount: discount > 0 ? (price - finalPrice) : null
      }
    }

    if (plan.price_egp === 0) {
      return { price: 0, text: 'مجاناً' }
    }

    let months = 1
    let discount = 0
    let label = 'EGP / شهرياً'

    if (selectedPeriod === 'quarterly') {
      months = 3
      discount = 0
      label = 'EGP / 3 أشهر'
    } else if (selectedPeriod === 'semi_annual') {
      months = 6
      discount = parseFloat(settings.discount_semi_annually || '10')
      label = 'EGP / نصف سنوي'
    } else if (selectedPeriod === 'annual') {
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

  const calculated = calculatePrice()

  return (
    <div
      className={`bg-[var(--card-bg)] border-2 rounded-[24px] p-6 flex flex-col justify-between relative transition-all duration-300 text-right ${
        isCurrent
          ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_50px_rgba(16,185,129,0.18)] md:scale-105 z-10 ring-4 ring-emerald-500/10'
          : plan.most_popular
          ? 'border-indigo-500 bg-indigo-500/5 shadow-xl scale-[1.01] ring-2 ring-indigo-500/10'
          : plan.recommended
          ? 'border-purple-500 bg-purple-500/5 shadow-lg'
          : 'border-[var(--border-color)] hover:border-indigo-500/50 hover:shadow-lg'
      }`}
      dir="rtl"
    >
      {/* Dynamic Badges Showcase */}
      {isCurrent && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-[10px] font-black text-white px-5 py-1 rounded-full border border-emerald-400 shadow-md whitespace-nowrap">
          ✓ باقة اشتراكك الحالية
        </div>
      )}

      {!isCurrent && plan.most_popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-[10px] font-black text-white px-5 py-1 rounded-full border border-indigo-400 shadow-md whitespace-nowrap">
          ⭐ الأكثر شعبية
        </div>
      )}

      {!isCurrent && !plan.most_popular && plan.recommended && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-600 to-purple-600 text-[10px] font-black text-white px-5 py-1 rounded-full border border-pink-400 shadow-md whitespace-nowrap">
          👑 موصى بها
        </div>
      )}

      {!isCurrent && !plan.most_popular && !plan.recommended && plan.featured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-600 text-[10px] font-black text-white px-5 py-1 rounded-full border border-amber-400 shadow-md whitespace-nowrap">
          🔥 أفضل قيمة
        </div>
      )}

      <div>
        {/* Plan Header */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-black text-[var(--text-color)] mb-2">{plan.name}</h3>

          {/* Duration Selector for configurable billing options */}
          {customOpts.length > 0 && !calculated.isRevenueSharing && (
            <div className="flex justify-center gap-1.5 mb-4 bg-[var(--bg-color)]/30 p-1.5 rounded-xl border border-[var(--border-color)]">
              {customOpts.map(opt => {
                const isSelected = selectedPeriod === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedPeriod(opt.key)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-color)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex flex-col items-center justify-center mb-2 min-h-[75px]">
            {calculated.isRevenueSharing ? (
              <div className="text-center space-y-1">
                <span className="text-3xl font-black text-indigo-400">نظام النسبة</span>
                <p className="text-[10px] text-slate-400 font-bold">بدون رسوم شهرية ثابتة</p>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

        <hr className="border-[var(--border-color)] mb-6" />

        {/* Plan Spec List */}
        <ul className="space-y-4 text-xs text-[var(--text-secondary)] pr-1 mb-8">
          {plan.billing_type === 'revenue_sharing' ? (
            <>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>نسبة المنصة: <strong className="text-[var(--text-color)]">{plan.commission_percentage}% من المبيعات</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>مساحة الفيديو الافتراضية: <strong className="text-[var(--text-color)]">{plan.default_storage_gb || plan.video_storage_gb} جيجابايت</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>زيادة المساحة: <strong className="text-[var(--text-color)]">تلقائية مجانية عند كل عملية مبيعات</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>سعة أكواد الطلاب: <strong className="text-[var(--text-color)]">
                  {plan.codes_limit_type === 'unlimited' ? 'غير محدودة' : `${plan.max_codes_limit || plan.student_codes} كود/طالب`}
                </strong></span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>قدرة الطلاب: <strong className="text-[var(--text-color)]">{plan.student_codes} طالب نشط</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>أكواد نشطة: <strong className="text-[var(--text-color)]">{plan.student_codes} كود طلاب</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>مساحة الفيديو: <strong className="text-[var(--text-color)]">{plan.video_storage_gb} جيجابايت</strong></span>
              </li>
            </>
          )}
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
          type="button"
          onClick={() => onUpgradeRequest(plan.id, selectedPeriod)}
          disabled={submitting || hasPendingRequest}
          className={`w-full py-3 text-xs font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
            plan.most_popular || plan.featured
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold shadow-lg shadow-indigo-600/15'
              : 'bg-[var(--card-bg)] hover:bg-[var(--bg-color)] text-[var(--text-color)] border border-[var(--border-color)]'
          } ${(submitting || hasPendingRequest) ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : hasPendingRequest ? (
            'لديك طلب معلق'
          ) : (
            'طلب تفعيل / ترقية'
          )}
        </button>
      )}
    </div>
  )
}
