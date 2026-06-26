import React from 'react'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { useAuthStore } from '../../store/authStore'
import { 
  Users, 
  Search, 
  Wallet, 
  BookOpen, 
  Clock, 
  Trash2, 
  KeyRound, 
  Eye, 
  ShieldAlert, 
  ShieldCheck, 
  X, 
  Loader2, 
  AlertTriangle,
  Award,
  Activity
} from 'lucide-react'
import EmptyState from '../../components/EmptyState'

interface StudentItem {
  id: number
  name: string
  email: string
  phone: string
  status: 'active' | 'disabled'
  enrollments_count: number
  wallet?: {
    balance: string
  }
}

export default function StudentsList() {
  const { user } = useAuthStore()
  const [students, setStudents] = React.useState<StudentItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')

  // Bulk delete states
  const [showBulkDeleteModal, setShowBulkDeleteModal] = React.useState(false)
  const [confirmPhrase, setConfirmPhrase] = React.useState('')
  const [bulkDeleting, setBulkDeleting] = React.useState(false)

  // Modals state
  const [resetPasswordStudent, setResetPasswordStudent] = React.useState<StudentItem | null>(null)
  const [newPasswordVal, setNewPasswordVal] = React.useState('')
  const [resettingPassword, setResettingPassword] = React.useState(false)

  const [deleteStudentItem, setDeleteStudentItem] = React.useState<StudentItem | null>(null)
  const [deletingStudent, setDeletingStudent] = React.useState(false)

  const [viewStudentItem, setViewStudentItem] = React.useState<StudentItem | null>(null)
  const [studentAnalytics, setStudentAnalytics] = React.useState<any>(null)
  const [loadingAnalytics, setLoadingAnalytics] = React.useState(false)

  // Enrollments & wallet adjustment state additions
  const [enrollments, setEnrollments] = React.useState<any[]>([])
  const [loadingEnrollments, setLoadingEnrollments] = React.useState(false)
  const [adjustAction, setAdjustAction] = React.useState<'increase' | 'decrease'>('increase')
  const [adjustAmount, setAdjustAmount] = React.useState('')
  const [adjustDescription, setAdjustDescription] = React.useState('')
  const [submittingAdjustment, setSubmittingAdjustment] = React.useState(false)

  const fetchStudents = () => {
    setLoading(true)
    API.get('/admin/students')
      .then((res) => {
        setStudents(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  React.useEffect(() => {
    fetchStudents()
  }, [])

  // Toggle user status (Disable / Enable)
  const handleToggleStatus = (st: StudentItem) => {
    const isEnabling = st.status !== 'active'
    useModalStore.getState().showConfirm({
      title: 'تغيير حالة حساب الطالب',
      description: `هل أنت متأكد من ${isEnabling ? 'تفعيل' : 'تعطيل'} حساب الطالب "${st.name}"؟`,
      confirmText: isEnabling ? 'تفعيل الحساب' : 'تعطيل الحساب',
      cancelText: 'إلغاء',
      type: 'warning',
      onConfirm: async () => {
        try {
          if (isEnabling) {
            await API.post(`/admin/users/${st.id}/enable`)
          } else {
            await API.post(`/admin/users/${st.id}/disable`)
          }
          useModalStore.getState().showToast('تم تغيير حالة حساب الطالب بنجاح.', 'success')
          fetchStudents()
        } catch (err) {
          console.error(err)
          useModalStore.getState().showToast('فشل تغيير حالة الحساب.', 'error')
        }
      }
    })
  }

  // Handle password reset
  const handleResetPasswordClick = (st: StudentItem) => {
    setResetPasswordStudent(st)
    setNewPasswordVal('')
  }

  const submitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordStudent) return
    if (newPasswordVal.length < 6) {
      useModalStore.getState().showToast('يجب أن تكون كلمة المرور من 6 أحرف على الأقل.', 'error')
      return
    }

    setResettingPassword(true)
    try {
      await API.post(`/admin/students/${resetPasswordStudent.id}/reset-password`, {
        password: newPasswordVal
      })
      useModalStore.getState().showToast('تم إعادة تعيين كلمة مرور الطالب بنجاح.', 'success')
      setResetPasswordStudent(null)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل إعادة تعيين كلمة المرور.', 'error')
    } finally {
      setResettingPassword(false)
    }
  }

  const fetchEnrollments = async (studentId: number) => {
    setLoadingEnrollments(true)
    try {
      const res = await API.get(`/admin/students/${studentId}/enrollments`)
      setEnrollments(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingEnrollments(false)
    }
  }

  const handleRefund = (enrollment: any) => {
    useModalStore.getState().showConfirm({
      title: 'إلغاء الاشتراك وإعادة المبلغ',
      description: `هل تريد إلغاء هذا الاشتراك وإعادة المبلغ إلى محفظة الطالب؟`,
      confirmText: 'نعم، إلغاء الاشتراك وإرجاع المبلغ',
      cancelText: 'تراجع',
      type: 'warning',
      onConfirm: async () => {
        try {
          const res = await API.post(`/admin/enrollments/${enrollment.id}/refund`)
          useModalStore.getState().showToast(res.data.message || 'تم إلغاء الاشتراك وإرجاع المبلغ بنجاح.', 'success')
          if (viewStudentItem) {
            fetchEnrollments(viewStudentItem.id)
            const anaRes = await API.get(`/admin/students/${viewStudentItem.id}/analytics`)
            setStudentAnalytics(anaRes.data)
            fetchStudents()
          }
        } catch (err: any) {
          console.error(err)
          useModalStore.getState().showToast(err.response?.data?.message || 'حدث خطأ أثناء إلغاء الاشتراك.', 'error')
        }
      }
    })
  }

  const handleWalletAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!viewStudentItem) return
    const amt = Number(adjustAmount)
    if (isNaN(amt) || amt <= 0) {
      useModalStore.getState().showToast('يرجى إدخال مبلغ صحيح أكبر من صفر.', 'error')
      return
    }

    setSubmittingAdjustment(true)
    try {
      const res = await API.post(`/admin/students/${viewStudentItem.id}/wallet/adjust`, {
        action: adjustAction,
        amount: amt,
        description: adjustDescription
      })
      useModalStore.getState().showToast(res.data.message || 'تم تعديل محفظة الطالب بنجاح.', 'success')
      setAdjustAmount('')
      setAdjustDescription('')
      
      // Update local viewStudentItem balance representation
      setViewStudentItem(prev => prev ? {
        ...prev,
        wallet: { balance: String(res.data.balance) }
      } : null)

      // Refresh student list details
      fetchStudents()
    } catch (err: any) {
      console.error(err)
      useModalStore.getState().showToast(err.response?.data?.message || 'فشل تعديل رصيد المحفظة.', 'error')
    } finally {
      setSubmittingAdjustment(false)
    }
  }

  // Handle student profile stats details modal
  const handleViewStudentClick = async (st: StudentItem) => {
    setViewStudentItem(st)
    setLoadingAnalytics(true)
    setStudentAnalytics(null)
    setEnrollments([])
    try {
      const res = await API.get(`/admin/students/${st.id}/analytics`)
      setStudentAnalytics(res.data)
      fetchEnrollments(st.id)
    } catch (err) {
      console.error(err)
    } finally {
      setViewStudentItem(st)
      setLoadingAnalytics(false)
    }
  }

  // Handle student deletion
  const handleDeleteStudentClick = (st: StudentItem) => {
    useModalStore.getState().showConfirm({
      title: 'حذف الطالب',
      description: `هل أنت متأكد من حذف الطالب "${st.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      confirmText: 'حذف الطالب',
      cancelText: 'إلغاء',
      type: 'delete',
      onConfirm: async () => {
        setDeletingStudent(true)
        try {
          await API.delete(`/admin/students/${st.id}`)
          useModalStore.getState().showToast('تم حذف الطالب بنجاح.', 'success')
          fetchStudents()
        } catch (err) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف حساب الطالب.', 'error')
        } finally {
          setDeletingStudent(false)
        }
      }
    })
  }

  const filteredStudents = students.filter(
    (st) =>
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.phone.includes(searchQuery) ||
      st.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 text-right" dir="rtl">
      
      {/* Title & Search */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-[var(--border-color)] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-100">إدارة حسابات الطلاب</h1>
            {user?.role === 'admin' && (user?.is_super_admin || user?.is_super) && (
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-lg shadow-red-600/10 hover:shadow-red-600/20"
              >
                <span>🗑 حذف جميع الطلاب</span>
              </button>
            )}
          </div>
          <p className="text-sm text-slate-400 font-light mt-1">عرض قائمة الطلاب المشتركين، تعديل حالاتهم، تعيين كلمات مرورهم، ومراجعة إحصائياتهم.</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف أو البريد..."
            className="w-full bg-brand-card border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary text-right"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin h-8 w-8 text-brand-primary" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          type="students"
          title="لا يوجد طلاب مسجلون"
          description={searchQuery ? "لم نعثر على طلاب يطابقون خيارات البحث." : "لم يتم تسجيل أي حساب طالب على المنصة بعد."}
        />
      ) : (
        /* Students catalog grid table */
        <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead>
                <tr className="bg-[rgba(255,255,255,0.01)] border-b border-[var(--border-color)] text-slate-400">
                  <th className="p-4 sm:p-6 font-semibold">الطالب</th>
                  <th className="p-4 sm:p-6 font-semibold">رقم الهاتف</th>
                  <th className="p-4 sm:p-6 font-semibold">رصيد المحفظة</th>
                  <th className="p-4 sm:p-6 font-semibold">الكورسات المشترك بها</th>
                  <th className="p-4 sm:p-6 font-semibold">الحالة</th>
                  <th className="p-4 sm:p-6 font-semibold">خيارات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] text-slate-300">
                {filteredStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                    
                    {/* Name/Email */}
                    <td className="p-4 sm:p-6 font-bold">
                      <div className="space-y-0.5">
                        <div className="text-slate-200">{st.name}</div>
                        <div className="text-[10px] text-slate-500 font-light">{st.email}</div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="p-4 sm:p-6 font-semibold text-slate-300">
                      {st.phone}
                    </td>

                    {/* Wallet balance */}
                    <td className="p-4 sm:p-6 font-bold text-brand-primary">
                      {st.wallet ? `${st.wallet.balance} ج.م` : '0.00 ج.م'}
                    </td>

                    {/* Enrollments Count */}
                    <td className="p-4 sm:p-6 font-semibold text-slate-300">
                      {st.enrollments_count} كورس
                    </td>

                    {/* Status Toggle */}
                    <td className="p-4 sm:p-6">
                      <button
                        onClick={() => handleToggleStatus(st)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                          st.status === 'active'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-brand-success'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                        }`}
                      >
                        {st.status === 'active' ? (
                          <>
                            <ShieldCheck className="h-3 w-3" /> نشط
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="h-3 w-3" /> معطل
                          </>
                        )}
                      </button>
                    </td>

                    {/* Options */}
                    <td className="p-4 sm:p-6">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewStudentClick(st)}
                          className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                          title="عرض إحصائيات الطالب"
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={() => handleResetPasswordClick(st)}
                          className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                          title="إعادة تعيين كلمة المرور"
                        >
                          <KeyRound className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudentClick(st)}
                          className="p-1.5 hover:bg-rose-500/10 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="حذف حساب الطالب"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODALS & OVERLAYS
          ========================================================================== */}

      {/* 1. Reset Student Password Modal */}
      {resetPasswordStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResetPasswordStudent(null)} />
          <form onSubmit={submitResetPassword} className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-lg font-black text-slate-200 flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <KeyRound className="h-5 w-5 text-brand-primary" />
              <span>إعادة تعيين كلمة مرور الطالب</span>
            </h3>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              اكتب كلمة المرور الجديدة للطالب <span className="font-bold text-brand-primary">"{resetPasswordStudent.name}"</span>. 
              سيتم فرض تغيير كلمة المرور عليه في تسجيل الدخول القادم.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">كلمة المرور الجديدة</label>
              <input
                type="text"
                required
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                placeholder="••••••"
                className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary font-mono text-left font-bold"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResetPasswordStudent(null)}
                className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl cursor-pointer text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={resettingPassword}
                className="px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {resettingPassword ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. View Student Statistics & Profile Modal */}
      {viewStudentItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewStudentItem(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-xl w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] z-10 text-right">
            
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-lg font-black text-slate-200">ملف الطالب ومراجعة الإحصائيات</h3>
              <button 
                onClick={() => setViewStudentItem(null)} 
                className="p-1.5 hover:bg-slate-800 rounded-xl cursor-pointer text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingAnalytics ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin h-8 w-8 text-brand-primary" />
              </div>
            ) : studentAnalytics ? (
              <div className="space-y-6">
                
                {/* Student header */}
                <div className="flex items-center gap-4 bg-[rgba(255,255,255,0.005)] border border-[var(--border-color)] p-4 rounded-xl">
                  <div className="h-12 w-12 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary text-lg font-black shrink-0">
                    {studentAnalytics.student.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-200">{studentAnalytics.student.name}</h4>
                    <span className="text-[10px] text-slate-400">{studentAnalytics.student.email} | {studentAnalytics.student.phone}</span>
                  </div>
                </div>

                {/* Progress Overview stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold block">معدل المشاهدة</span>
                    <div className="text-base font-black text-brand-primary">{studentAnalytics.progress.completion_rate}%</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold block">دقائق الحضور</span>
                    <div className="text-base font-black text-slate-200">{studentAnalytics.progress.watch_time_minutes} د</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold block">آخر نشاط مسجل</span>
                    <div className="text-[10px] font-bold text-slate-300 truncate">{studentAnalytics.last_activity}</div>
                  </div>
                </div>

                {/* Exam Submissions History */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Award className="h-4 w-4 text-brand-primary" />
                    <span>سجل محاولات الامتحانات للدروس المشترك بها:</span>
                  </h4>

                  {studentAnalytics.exam_attempts.length === 0 ? (
                    <div className="text-center py-6 border border-slate-800 rounded-xl text-xs text-slate-400 font-light">لا توجد محاولات حل امتحانات مسجلة.</div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-right border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                            <th className="p-3">اسم الامتحان</th>
                            <th className="p-3 text-center">الدرجة</th>
                            <th className="p-3 text-center">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {studentAnalytics.exam_attempts.map((attempt: any) => (
                            <tr key={attempt.id}>
                              <td className="p-3 font-semibold">{attempt.exam.title}</td>
                              <td className="p-3 text-center font-bold">
                                {attempt.score !== null ? `${attempt.score} / ${attempt.exam.max_score}` : 'لم ترصد'}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  attempt.status === 'graded' ? 'bg-emerald-500/10 text-brand-success' : 'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {attempt.status === 'graded' ? 'تم التصحيح' : 'قيد المراجعة'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ==================== 1. Wallet Balance & Administration ==================== */}
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                    <Wallet className="h-4 w-4 text-brand-primary" />
                    <span>التحكم في محفظة الطالب ورصيده الإجمالي</span>
                  </h4>
                  
                  <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 font-light">الرصيد الحالي بالمحفظة:</span>
                    <span className="text-sm font-black text-brand-primary">
                      {viewStudentItem.wallet ? `${viewStudentItem.wallet.balance} ج.م` : '0.00 ج.م'}
                    </span>
                  </div>

                  <form onSubmit={handleWalletAdjust} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 block">نوع الإجراء</label>
                      <select
                        value={adjustAction}
                        onChange={(e: any) => setAdjustAction(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary text-slate-200"
                      >
                        <option value="increase">➕ إضافة رصيد (+ شحن)</option>
                        <option value="decrease">➖ سحب رصيد (خصم)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 block">المبلغ المراد تعديله</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        placeholder="مثال: 50"
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary text-center font-bold text-slate-200"
                      />
                    </div>

                    <div className="w-full">
                      <button
                        type="submit"
                        disabled={submittingAdjustment}
                        className="w-full py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-brand-primary/10 hover:shadow-brand-primary/20 flex justify-center items-center gap-1.5"
                      >
                        {submittingAdjustment ? (
                          <Loader2 className="animate-spin h-3.5 w-3.5" />
                        ) : (
                          <span>تنفيذ التعديل</span>
                        )}
                      </button>
                    </div>

                    <div className="space-y-1 sm:col-span-3">
                      <label className="text-[10px] font-semibold text-slate-400 block">ملاحظات أو سبب تعديل الرصيد (اختياري)</label>
                      <input
                        type="text"
                        value={adjustDescription}
                        onChange={(e) => setAdjustDescription(e.target.value)}
                        placeholder="مثال: تعديل رصيد الطالب يدوياً بواسطة الإدارة"
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary text-slate-200"
                      />
                    </div>
                  </form>
                </div>

                {/* ==================== 2. Enrolled Courses & Packages ==================== */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-brand-primary" />
                    <span>الكورسات والباقات المشترك بها:</span>
                  </h4>

                  {loadingEnrollments ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="animate-spin h-5 w-5 text-brand-primary" />
                    </div>
                  ) : enrollments.length === 0 ? (
                    <div className="text-center py-6 border border-slate-800 rounded-xl text-xs text-slate-400 font-light">لا توجد اشتراكات نشطة مسجلة للطالب.</div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-right border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                            <th className="p-3">اسم المادة / الكورس</th>
                            <th className="p-3 text-center">النوع</th>
                            <th className="p-3 text-center">تاريخ الاشتراك</th>
                            <th className="p-3 text-center">الإجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {enrollments.map((en: any) => (
                            <tr key={en.id} className="hover:bg-slate-850/20 transition-colors">
                              <td className="p-3 font-semibold text-slate-200">
                                {en.package_id && en.package ? en.package.title : en.course?.title}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  en.package_id ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-brand-success'
                                }`}>
                                  {en.package_id ? 'باقة شهرية' : 'كورس كامل'}
                                </span>
                              </td>
                              <td className="p-3 text-center text-slate-400">
                                {en.enrolled_at ? new Date(en.enrolled_at).toLocaleDateString('ar-EG') : '-'}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRefund(en)}
                                  className="px-2 py-1 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-lg text-[9px] font-bold transition-all duration-200 cursor-pointer border border-rose-500/20"
                                >
                                  إلغاء الاشتراك
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="text-center py-6 text-xs text-rose-400 font-light">فشل تحميل بيانات النشاط.</div>
            )}

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setViewStudentItem(null)}
                className="px-6 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!bulkDeleting) setShowBulkDeleteModal(false); }} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-lg font-black text-red-500 flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
              <span>تأكيد الإجراء الخطير: حذف جميع الطلاب</span>
            </h3>
            <div className="text-xs text-slate-300 font-bold leading-relaxed bg-red-500/10 p-4 border border-red-500/20 rounded-2xl">
              ⚠️ سيتم حذف جميع الطلاب نهائياً ولا يمكن التراجع عن العملية.
            </div>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              * سيتم حذف جميع حسابات الطلاب بالكامل.<br/>
              * سيتم حذف اشتراكاتهم وتفعيل كورس الدخول الخاص بهم.<br/>
              * سيتم مسح جميع محاولات حل الامتحانات والواجبات.<br/>
              * سيتم تصفير سجلات المشاهدة والإشعارات بالكامل.<br/>
              * <strong>لن يتم حذف</strong> حسابات المعلمين أو المشرفين.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                اكتب <span className="font-mono text-red-400 font-black">"DELETE STUDENTS"</span> للتأكيد.
              </label>
              <input
                type="text"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="DELETE STUDENTS"
                disabled={bulkDeleting}
                className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-red-500 text-center font-black placeholder:font-light"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setConfirmPhrase('');
                }}
                className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl cursor-pointer text-slate-300 transition-all hover:bg-slate-800"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={confirmPhrase !== 'DELETE STUDENTS' || bulkDeleting}
                onClick={async () => {
                  setBulkDeleting(true);
                  try {
                    await API.post('/admin/bulk/students');
                    useModalStore.getState().showToast('تم حذف جميع الطلاب بنجاح وبشكل آمن.', 'success');
                    setShowBulkDeleteModal(false);
                    setConfirmPhrase('');
                    fetchStudents();
                  } catch (err: any) {
                    console.error(err);
                    useModalStore.getState().showToast(err.response?.data?.message || 'فشل تنفيذ عملية الحذف.', 'error');
                  } finally {
                    setBulkDeleting(false);
                  }
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-lg shadow-red-600/10 hover:shadow-red-600/20"
              >
                {bulkDeleting ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <span>تأكيد الحذف النهائي</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
