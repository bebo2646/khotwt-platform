import React, { useState, useEffect } from 'react'
import API from '../../services/api'
import { Check, X, ShieldAlert, Calendar, User, Phone, Mail, FileText, AlertCircle } from 'lucide-react'
import { useModalStore } from '../../store/modalStore'
import { useTaxonomyStore } from '../../store/taxonomyStore'

interface PendingStudent {
  id: number
  name: string
  email: string
  phone: string
  parent_phone: string
  grades: string[]
  created_at: string
  status: string
}

export default function PendingStudents() {
  const { getGradeName, fetchTaxonomy } = useTaxonomyStore()
  const [students, setStudents] = useState<PendingStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)

  useEffect(() => {
    fetchTaxonomy()
  }, [fetchTaxonomy])
  
  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectingStudentId, setRejectingStudentId] = useState<number | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const loadPendingStudents = async () => {
    try {
      setLoading(true)
      const res = await API.get('/admin/pending-students')
      setStudents(res.data)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل قائمة الطلاب قيد الانتظار.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPendingStudents()
  }, [])

  const handleApprove = async (id: number) => {
    setProcessingId(id)
    try {
      await API.post(`/admin/students/${id}/approve`)
      useModalStore.getState().showToast('تم قبول وتفعيل حساب الطالب بنجاح.', 'success')
      loadPendingStudents()
    } catch (err: any) {
      console.error(err)
      useModalStore.getState().showToast(err.response?.data?.message || 'فشل قبول الطالب.', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const openRejectModal = (id: number) => {
    setRejectingStudentId(id)
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingStudentId || !rejectionReason.trim()) return

    setProcessingId(rejectingStudentId)
    setShowRejectModal(false)
    try {
      const res = await API.post(`/admin/students/${rejectingStudentId}/reject`, {
        reason: rejectionReason,
      })
      useModalStore.getState().showToast(res.data.message || 'تم رفض حساب الطالب.', 'success')
      loadPendingStudents()
    } catch (err: any) {
      console.error(err)
      useModalStore.getState().showToast(err.response?.data?.message || 'فشل رفض الطالب.', 'error')
    } finally {
      setProcessingId(null)
      setRejectingStudentId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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
          <ShieldAlert className="w-7 h-7 text-rose-500 animate-pulse" />
          مراجعة طلبات تسجيل الطلاب
        </h1>
        <p className="text-[var(--text-secondary)] text-xs mt-1">
          مراجعة بيانات الطلاب الجدد المسجلين للموافقة عليهم أو رفضهم.
        </p>
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-6 shadow-xl">
        {students.length === 0 ? (
          <div className="py-16 text-center">
            <User className="w-12 h-12 text-[var(--text-secondary)]/30 mx-auto mb-3" />
            <p className="text-[var(--text-secondary)] text-sm">لا توجد حسابات معلقة قيد المراجعة حالياً.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {students.map((student) => (
              <div 
                key={student.id} 
                className="bg-[var(--bg-color)]/25 border border-[var(--border-color)] p-5 rounded-2xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 hover:border-brand-primary/45 transition-all duration-300"
              >
                <div className="space-y-2.5 flex-grow text-right w-full">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                    <span className="text-base font-extrabold text-[var(--text-color)]">{student.name}</span>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">قيد المراجعة</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold text-[var(--text-color)]">رقم الهاتف:</span>
                      <span>{student.phone}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="font-bold text-[var(--text-color)]">هاتف ولي الأمر:</span>
                      <span>{student.parent_phone}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="font-bold text-[var(--text-color)]">المرحلة الدراسية:</span>
                      <span>{getGradeName(student.grades?.[0] || '') || 'غير محدد'}</span>
                    </div>

                    <div className="flex items-center gap-2 md:col-span-2">
                      <Mail className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="font-bold text-[var(--text-color)]">البريد الإلكتروني:</span>
                      <span>{student.email}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-bold text-[var(--text-color)]">وقت التسجيل:</span>
                      <span>{formatDate(student.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto justify-end border-t border-[var(--border-color)] lg:border-none pt-4 lg:pt-0 shrink-0">
                  <button
                    onClick={() => handleApprove(student.id)}
                    disabled={processingId !== null}
                    className="flex-grow lg:flex-grow-0 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    <Check className="w-4 h-4" />
                    تفعيل الحساب
                  </button>
                  
                  <button
                    onClick={() => openRejectModal(student.id)}
                    disabled={processingId !== null}
                    className="flex-grow lg:flex-grow-0 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-500/20"
                  >
                    <X className="w-4 h-4" />
                    رفض التسجيل
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" dir="rtl">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] w-full max-w-md rounded-3xl p-6 shadow-2xl relative text-right">
            <h3 className="text-lg font-extrabold text-[var(--text-color)] mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              تأكيد رفض طلب التسجيل
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              يرجى إدخال سبب الرفض لتوضيحه للطالب أثناء محاولة تسجيل الدخول.
            </p>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-color)] mb-1">سبب الرفض:</label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm focus:outline-none focus:border-brand-primary"
                  placeholder="مثال: رقم هاتف ولي الأمر غير صحيح أو غير مفعل."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-color)] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  تأكيد الرفض
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
