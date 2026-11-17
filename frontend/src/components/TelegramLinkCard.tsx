import React, { useEffect, useState } from 'react'
import API from '../services/api'
import { Send, CheckCircle2, AlertCircle, Loader2, Unlink, ExternalLink } from 'lucide-react'

export default function TelegramLinkCard() {
  const [loading, setLoading] = useState<boolean>(true)
  const [isLinked, setIsLinked] = useState<boolean>(false)
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null)
  const [linkedAt, setLinkedAt] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const res: any = await API.get('/telegram/status')
      const data = res.data || res
      setIsLinked(Boolean(data.is_linked))
      setTelegramUsername(data.telegram_username || null)
      setLinkedAt(data.linked_at || null)
    } catch (err) {
      console.error('Failed to fetch Telegram link status:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleGenerateLink = async () => {
    try {
      setActionLoading(true)
      setFeedback(null)
      const res: any = await API.post('/telegram/link-token')
      const data = res.data || res
      if (data.deep_link) {
        // Open deep link in Telegram
        window.open(data.deep_link, '_blank')
        setFeedback({
          type: 'success',
          message: 'تم فتح رابط الربط في Telegram. اضغط Start في التطبيق لتأكيد الربط.',
        })
        // Poll status after 5s
        setTimeout(fetchStatus, 5000)
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'فشل في إنشاء رمز الربط. حاول مجدداً.'
      setFeedback({ type: 'error', message: msg })
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnlink = async () => {
    if (!window.confirm('هل أنت متأكد من إلغاء ربط حسابك ببوت Telegram؟')) {
      return
    }

    try {
      setActionLoading(true)
      setFeedback(null)
      await API.post('/telegram/unlink')
      setIsLinked(false)
      setTelegramUsername(null)
      setLinkedAt(null)
      setFeedback({
        type: 'success',
        message: 'تم إلغاء ربط حساب Telegram بنجاح.',
      })
    } catch (err: any) {
      const msg = err.response?.data?.message || 'فشل في إلغاء الربط.'
      setFeedback({ type: 'error', message: msg })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 shadow-xl flex items-center justify-center min-h-[140px]">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Send className="w-5 h-5 -rotate-45 ml-0.5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              مساعد خطوتك على Telegram
              {isLinked && (
                <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  مرتبط
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 font-light">
              تلقي إشعارات الدرجات، استعادة كلمة المرور، وخدمات البوت المباشرة
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {isLinked ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-slate-300 font-medium">
              مرتبط بالمعرف: <span className="text-sky-400 font-bold" dir="ltr">@{telegramUsername || 'Telegram User'}</span>
            </p>
            {linkedAt && (
              <p className="text-[11px] text-slate-500">
                تاريخ الربط: {new Date(linkedAt).toLocaleDateString('ar-EG')}
              </p>
            )}
          </div>
          <button
            onClick={handleUnlink}
            disabled={actionLoading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {actionLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Unlink className="w-3.5 h-3.5" />
            )}
            <span>إلغاء الربط</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-400 leading-relaxed max-w-md">
            حسابك غير مرتبط حالياً. اربط حسابك للوصول الفوري إلى نتائج الامتحانات، واستعادة حسابك برقم الهاتف في أي وقت.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleGenerateLink}
              disabled={actionLoading}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              <span>ربط حساب Telegram</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
