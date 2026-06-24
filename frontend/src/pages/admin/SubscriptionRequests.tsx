import React, { useState, useEffect } from 'react'
import API from '../../services/api'
import { Check, X, ShieldAlert, Award, HardDrive, Users, Calendar, MessageSquare, AlertCircle } from 'lucide-react'
import { useModalStore } from '../../store/modalStore'
import { Link } from 'react-router-dom'

interface Teacher {
  id: number
  name: string
  email: string
}

interface Plan {
  id: number
  name: string
  price_egp: number
}

interface SubscriptionRequest {
  id: number
  teacher_id: number
  teacher: Teacher
  type: 'plan_upgrade' | 'extra_storage' | 'extra_codes'
  requested_plan_id: number | null
  requested_plan: Plan | null
  amount: number | null
  status: 'Pending' | 'Approved' | 'Rejected'
  billing_period: 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
  admin_response: string | null
  created_at: string
}

export default function SubscriptionRequests() {
  const [requests, setRequests] = useState<SubscriptionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionNotes, setActionNotes] = useState<{ [id: number]: string }>({})
  const [processingId, setProcessingId] = useState<number | null>(null)

  const loadRequests = async () => {
    try {
      setLoading(true)
      const res = await API.get('/admin/subscriptions/requests')
      setRequests(res.data)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل طلبات الاشتراكات والترقية.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const handleAction = async (id: number, status: 'Approved' | 'Rejected') => {
    const notes = actionNotes[id] || ''
    setProcessingId(id)
    try {
      await API.post(`/admin/subscriptions/requests/${id}/action`, {
        status,
        admin_response: notes,
      })
      useModalStore.getState().showToast(
        status === 'Approved' ? 'تمت الموافقة على الطلب بنجاح.' : 'تم رفض الطلب بنجاح.', 
        'success'
      )
      loadRequests()
    } catch (err: any) {
      console.error(err)
      useModalStore.getState().showToast(err.response?.data?.message || 'فشل معالجة الطلب.', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'plan_upgrade': return 'ترقية الباقة'
      case 'extra_storage': return 'مساحة إضافية'
      case 'extra_codes': return 'أكواد طلاب إضافية'
      default: return type
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'plan_upgrade': return <Award className="w-4 h-4 text-indigo-400" />
      case 'extra_storage': return <HardDrive className="w-4 h-4 text-emerald-400" />
      case 'extra_codes': return <Users className="w-4 h-4 text-blue-400" />
      default: return <AlertCircle className="w-4 h-4 text-zinc-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">مقبول</span>
      case 'Rejected':
        return <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400">مرفوض</span>
      default:
        return <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">معلق</span>
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
    <div className="max-w-7xl mx-auto px-4 py-8 text-right font-sans" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-color)] flex items-center gap-3">
          <ShieldAlert className="w-7 h-7 text-indigo-400" />
          طلبات ترقية الاشتراكات والموارد
        </h1>
        <p className="text-[var(--text-secondary)] text-xs mt-1">
          مراجعة وتحديث حالة طلبات الباقات والإضافات المقدمة من المعلمين.
        </p>
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-6 shadow-xl">
        {requests.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldAlert className="w-12 h-12 text-[var(--text-secondary)]/30 mx-auto mb-3" />
            <p className="text-[var(--text-secondary)] text-sm">لا توجد طلبات اشتراكات مقدمة حالياً.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {requests.map((req) => (
              <div 
                key={req.id} 
                className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                <div className="space-y-2 flex-grow">
                  <div className="flex items-center gap-3">
                    <Link 
                      to={`/admin/teachers/${req.teacher_id}/subscription`}
                      className="text-sm font-extrabold text-[var(--text-color)] hover:text-indigo-400 hover:underline transition"
                    >
                      {req.teacher?.name}
                    </Link>
                    {getStatusBadge(req.status)}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      {getTypeIcon(req.type)}
                      <strong>الطلب:</strong> {getTypeLabel(req.type)}
                    </span>
                    {req.type === 'plan_upgrade' && (
                      <span className="flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-indigo-400" />
                        <strong>الباقة المطلوبة:</strong> {req.requested_plan?.name} ({req.billing_period === 'annual' ? 'سنوي' : (req.billing_period === 'semi_annual' ? 'نصف سنوي' : req.billing_period === 'quarterly' ? '3 أشهر' : 'شهري')})
                      </span>
                    )}
                    {req.type !== 'plan_upgrade' && (
                      <span className="flex items-center gap-1.5">
                        <strong>الكمية الإضافية:</strong> {req.amount} {req.type === 'extra_storage' ? 'جيجا' : 'كود'}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <strong>تاريخ الطلب:</strong> {new Date(req.created_at).toLocaleDateString('ar-EG', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {req.admin_response && (
                    <div className="mt-2.5 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-xs">
                      <span className="font-bold text-[var(--text-color)] flex items-center gap-1.5 mb-1">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                        رد الإدارة المكتوب:
                      </span>
                      <p className="text-[var(--text-secondary)]/90 leading-relaxed font-mono">{req.admin_response}</p>
                    </div>
                  )}
                </div>

                {req.status === 'Pending' && (
                  <div className="w-full md:w-auto shrink-0 space-y-3">
                    <input
                      type="text"
                      placeholder="ملاحظات أو سبب الرفض/القبول..."
                      value={actionNotes[req.id] || ''}
                      onChange={(e) => setActionNotes({ ...actionNotes, [req.id]: e.target.value })}
                      className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => handleAction(req.id, 'Approved')}
                        disabled={processingId !== null}
                        className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition active:scale-95 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        قبول وتفعيل
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'Rejected')}
                        disabled={processingId !== null}
                        className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition active:scale-95 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        رفض الطلب
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
