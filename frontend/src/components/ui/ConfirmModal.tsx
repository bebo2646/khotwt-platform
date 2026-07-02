import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useModalStore } from '../../store/modalStore'
import { 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  HelpCircle, 
  X,
  Trash2,
  AlertOctagon
} from 'lucide-react'

// 1. Reusable Dialog Modal for Confirmation
export function ConfirmModal() {
  const { confirmOpen, confirmOptions, closeConfirm } = useModalStore()

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmOpen) {
        closeConfirm()
        if (confirmOptions?.onCancel) confirmOptions.onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [confirmOpen, closeConfirm, confirmOptions])

  if (!confirmOpen || !confirmOptions) return null

  const {
    title = '',
    description = '',
    confirmText = 'تأكيد',
    cancelText = 'إلغاء',
    type = 'question',
    onConfirm,
    onCancel,
  } = confirmOptions || {}

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-8 w-8 text-amber-500" />
      case 'delete':
        return <Trash2 className="h-8 w-8 text-rose-500" />
      case 'success':
        return <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      default:
        return <HelpCircle className="h-8 w-8 text-blue-500" />
    }
  }

  const getIconBg = () => {
    switch (type) {
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/20'
      case 'delete':
        return 'bg-rose-500/10 border-rose-500/20'
      case 'success':
        return 'bg-emerald-500/10 border-emerald-500/20'
      default:
        return 'bg-blue-500/10 border-blue-500/20'
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => {
          closeConfirm()
          if (onCancel) onCancel()
        }}
        className="absolute inset-0 bg-transparent z-[9998]"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.3 }}
        className="relative bg-brand-card border border-[var(--border-color)] rounded-[20px] p-6 max-w-md w-full shadow-2xl z-[9999] text-right font-sans space-y-6"
        dir="rtl"
      >
        {/* Header section with Icon */}
        <div className="flex items-start gap-4">
          <span className={`p-3 rounded-2xl border ${getIconBg()} shrink-0`}>
            {getIcon()}
          </span>
          <div className="space-y-1.5 pt-1">
            <h3 className="text-base font-black text-slate-100">{title}</h3>
            <p className="text-xs text-slate-400 font-light leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={() => {
              closeConfirm()
              if (onCancel) onCancel()
            }}
            className="px-4 py-2.5 btn-secondary rounded-xl text-xs font-semibold cursor-pointer transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onConfirm) onConfirm()
              closeConfirm()
            }}
            className={`px-5 py-2.5 text-white rounded-xl text-xs font-black cursor-pointer transition-all ${
              type === 'delete' 
                ? 'bg-rose-500 hover:bg-rose-600' 
                : 'bg-brand-primary hover:bg-brand-primary-hover'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// 2. Reusable Dialog Modal for Alerts
export function AlertModal() {
  const { alertOpen, alertOptions, closeAlert } = useModalStore()

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && alertOpen) {
        closeAlert()
        if (alertOptions?.onConfirm) alertOptions.onConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [alertOpen, closeAlert, alertOptions])

  if (!alertOpen || !alertOptions) return null

  const {
    title = '',
    description = '',
    buttonText = 'موافق',
    type = 'info',
    onConfirm,
  } = alertOptions || {}

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      case 'warning':
        return <AlertTriangle className="h-8 w-8 text-amber-500" />
      case 'error':
        return <AlertOctagon className="h-8 w-8 text-rose-500" />
      default:
        return <Info className="h-8 w-8 text-blue-500" />
    }
  }

  const getIconBg = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500/10 border-emerald-500/20'
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/20'
      case 'error':
        return 'bg-rose-500/10 border-rose-500/20'
      default:
        return 'bg-blue-500/10 border-blue-500/20'
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => {
          closeAlert()
          if (onConfirm) onConfirm()
        }}
        className="absolute inset-0 bg-transparent z-[9998]"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.3 }}
        className="relative bg-brand-card border border-[var(--border-color)] rounded-[20px] p-6 max-w-sm w-full shadow-2xl z-[9999] text-right font-sans space-y-6"
        dir="rtl"
      >
        <div className="flex items-start gap-4">
          <span className={`p-3 rounded-2xl border ${getIconBg()} shrink-0`}>
            {getIcon()}
          </span>
          <div className="space-y-1.5 pt-1">
            <h3 className="text-base font-black text-slate-100">{title}</h3>
            <p className="text-xs text-slate-400 font-light leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => {
              closeAlert()
              if (onConfirm) onConfirm()
            }}
            className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl cursor-pointer transition-all"
          >
            {buttonText}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// 3. Custom Toast Container for beautiful micro-animations
export function ToastContainer() {
  const { toasts, removeToast } = useModalStore()

  return (
    <div className="fixed top-6 left-4 right-4 md:left-6 md:right-auto md:w-96 md:max-w-sm z-[2000] flex flex-col gap-3 w-auto pointer-events-none" dir="rtl">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9, x: -50 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: -100 }}
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-lg pointer-events-auto bg-[var(--card-bg)] ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : toast.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/25 text-rose-500'
                : toast.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-500'
                : 'bg-blue-500/10 border-blue-500/25 text-blue-400'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs font-semibold leading-relaxed">
              {toast.type === 'success' && <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-500" />}
              {toast.type === 'error' && <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-500" />}
              {toast.type === 'warning' && <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500" />}
              {toast.type === 'info' && <Info className="h-4.5 w-4.5 shrink-0 text-blue-400" />}
              <span>{toast.message}</span>
            </div>
            
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// 4. ModalProvider combines everything
export function ModalProvider() {
  React.useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <>
      <ConfirmModal />
      <AlertModal />
      <ToastContainer />
    </>
  )
}
