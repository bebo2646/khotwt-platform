import React from 'react'
import { useNotifications } from '../context/NotificationContext'
import { AlertTriangle } from 'lucide-react'

export const NotificationToast: React.FC = () => {
  const { activeImportant, dismissImportant } = useNotifications()

  if (!activeImportant) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" dir="rtl">
      <div className="fixed inset-0 bg-black/10 z-40" onClick={() => dismissImportant(false)} />
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-3xl max-w-md w-full shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-right animate-scale-up space-y-4 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-amber-500/10 text-amber-500">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-amber-500">تنبيه هام وعاجل</h3>
            <span className="text-[10px] text-[var(--text-muted)]">إشعار نظام رسمي</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-base font-black text-[var(--text-color)]">{activeImportant.title}</h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{activeImportant.message}</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button 
            onClick={() => dismissImportant(true)}
            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
          >
            قراءة ومتابعة
          </button>
          <button 
            onClick={() => dismissImportant(false)}
            className="px-4 py-2.5 bg-transparent border border-[var(--border-color)] hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold rounded-xl transition"
          >
            إغلاق مؤقت
          </button>
        </div>
      </div>
    </div>
  )
}
