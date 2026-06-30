import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, Ticket, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import API from '../services/api'

interface PurchaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newBalance: number) => void
  title: string
  price: string | number
  type: 'course' | 'package'
  itemId: number | string
  walletBalance: number
}

export default function PurchaseModal({
  isOpen,
  onClose,
  onSuccess,
  title,
  price,
  type,
  itemId,
  walletBalance,
}: PurchaseModalProps) {
  const [paymentMethod, setPaymentMethod] = React.useState<'wallet' | 'code'>('wallet')
  const [code, setCode] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  const handlePurchase = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const endpoint = type === 'course' ? `/courses/${itemId}/subscribe` : `/packages/${itemId}/subscribe`
      const payload = paymentMethod === 'wallet' 
        ? { payment_method: 'wallet' }
        : { payment_method: 'code', code }

      const res = await API.post(endpoint, payload)
      setSuccess(res.data.message || 'تم الاشتراك بنجاح!')
      
      setTimeout(() => {
        onSuccess(res.data.balance !== undefined ? parseFloat(res.data.balance) : walletBalance)
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error(err)
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message)
      } else {
        setError('حدث خطأ أثناء إتمام عملية الشراء. يرجى المحاولة مرة أخرى.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const isWalletInsufficient = walletBalance < parseFloat(price.toString())

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal content */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative w-full max-w-md bg-brand-card border border-[var(--border-color)] rounded-[32px] shadow-2xl p-6 sm:p-8 text-right z-10 font-sans"
          dir="rtl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 left-5 p-2 bg-[rgba(255,255,255,0.02)] hover:bg-brand-surface border border-[var(--border-color)] hover:border-brand-primary/40 rounded-full text-slate-400 hover:text-brand-primary transition-all duration-200"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          {/* Modal Header */}
          <div className="space-y-2 mt-2">
            <h3 className="text-xl font-black text-foreground">تأكيد الاشتراك والدفع</h3>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              أنت على وشك الاشتراك في: <span className="font-bold text-slate-200">{title}</span>
            </p>
          </div>

          {/* Price display */}
          <div className="my-6 p-4 bg-brand-surface/40 border border-[var(--border-color)] rounded-2xl flex justify-between items-center">
            <span className="text-sm text-slate-400 font-medium">سعر الاشتراك</span>
            <span className="text-lg font-black text-brand-primary">
              {parseFloat(price.toString()) === 0 ? 'مجاني' : `${price} ج.م`}
            </span>
          </div>

          {/* Success / Error Messages */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-2xl text-xs flex items-center gap-2.5 font-bold mb-4"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 animate-bounce" />
              <span>{success}</span>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs flex items-center gap-2.5 font-bold mb-4"
            >
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300">اختر طريقة الدفع:</label>
            <div className="grid grid-cols-2 gap-4">
              {/* Wallet Button */}
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('wallet')
                  setError(null)
                }}
                className={`p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentMethod === 'wallet'
                    ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-lg shadow-brand-primary/5'
                    : 'bg-brand-surface/20 border-[var(--border-color)] hover:border-slate-700 text-slate-400'
                }`}
              >
                <Wallet className="h-6 w-6" />
                <span className="text-xs font-bold">الدفع من المحفظة</span>
              </button>

              {/* Code Button */}
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('code')
                  setError(null)
                }}
                className={`p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentMethod === 'code'
                    ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-lg shadow-brand-primary/5'
                    : 'bg-brand-surface/20 border-[var(--border-color)] hover:border-slate-700 text-slate-400'
                }`}
              >
                <Ticket className="h-6 w-6" />
                <span className="text-xs font-bold">استخدام كود شراء</span>
              </button>
            </div>
          </div>

          {/* Payment Input Fields */}
          <div className="mt-6">
            {paymentMethod === 'wallet' ? (
              <div className="p-4 bg-brand-surface/30 border border-[var(--border-color)] rounded-2xl space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>رصيد محفظتك الحالي:</span>
                  <span className={`font-bold ${isWalletInsufficient ? 'text-rose-500' : 'text-slate-200'}`}>
                    {walletBalance} ج.م
                  </span>
                </div>
                {isWalletInsufficient && (
                  <p className="text-[10px] text-rose-500 font-light leading-relaxed">
                    رصيدك الحالي غير كافٍ. يمكنك شحن الرصيد باستخدام كود شحن أو الاتصال بالدعم.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">أدخل كود الشراء:</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ELM-XXXXXXXX"
                  className="w-full bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-xl px-4 py-3 text-sm focus:outline-none transition-all text-slate-100 placeholder-slate-600"
                />
              </div>
            )}
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            onClick={handlePurchase}
            disabled={loading || (paymentMethod === 'wallet' && isWalletInsufficient) || (paymentMethod === 'code' && !code.trim())}
            className="w-full mt-6 py-3.5 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-brand-primary/10 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : paymentMethod === 'wallet' ? (
              'تأكيد الدفع من المحفظة'
            ) : (
              'تفعيل الكود والاشتراك'
            )}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
