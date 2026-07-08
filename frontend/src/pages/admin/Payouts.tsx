import React, { useState, useEffect } from 'react'
import API from '../../services/api'
import { 
  DollarSign, Users, Wallet, CreditCard, Calendar, 
  Search, FileText, Check, ArrowDownLeft, AlertCircle, 
  User, RefreshCw, Send, CheckCircle2, Landmark
} from 'lucide-react'
import { useModalStore } from '../../store/modalStore'
import { motion, AnimatePresence } from 'framer-motion'

interface TeacherBalance {
  id: number
  name: string
  email: string
  subject: string
  wallet_balance?: string
  lifetime_earnings?: string | number
  lifetime_payouts?: string | number
  pending_payout?: number
}

interface PayoutLog {
  id: number
  teacher: {
    id: number
    name: string
    email: string
  }
  amount: string
  payout_date: string
  payment_method: string | null
  notes: string | null
  admin?: {
    id: number
    name: string
    email: string
  }
}

export default function Payouts() {
  const [activeTab, setActiveTab] = useState<'balances' | 'logs'>('balances')
  const [balances, setBalances] = useState<TeacherBalance[]>([])
  const [logs, setLogs] = useState<PayoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Recording payout modal
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherBalance | null>(null)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [payoutNotes, setPayoutNotes] = useState('')
  const [payoutSaving, setPayoutSaving] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await API.get('/admin/payouts')
      setBalances(res.data.balances || [])
      setLogs(res.data.logs || [])
    } catch (err: any) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل بيانات مستحقات المعلمين.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeacher) return

    const amountNum = parseFloat(payoutAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      useModalStore.getState().showToast('يرجى إدخال مبلغ صحيح.', 'error')
      return
    }

    if (amountNum > (selectedTeacher.pending_payout || 0)) {
      if (!window.confirm(`تنبيه: المبلغ المدخل (${amountNum} ج.م) يتجاوز الرصيد المستحق للمعلم (${selectedTeacher.pending_payout} ج.م). هل تريد الاستمرار؟`)) {
        return
      }
    }

    setPayoutSaving(true)
    try {
      await API.post('/admin/payouts', {
        teacher_id: selectedTeacher.id,
        amount: amountNum,
        payment_method: paymentMethod,
        notes: payoutNotes
      })
      useModalStore.getState().showToast('تم تسجيل الدفعة وصرف المستحقات بنجاح.', 'success')
      setShowPayoutModal(false)
      setSelectedTeacher(null)
      setPayoutAmount('')
      setPayoutNotes('')
      fetchData()
    } catch (err: any) {
      console.error(err)
      useModalStore.getState().showToast(err.response?.data?.message || 'فشل تسجيل عملية الدفع.', 'error')
    } finally {
      setPayoutSaving(false)
    }
  }

  // Filtered lists
  const filteredBalances = balances.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.subject && b.subject.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredLogs = logs.filter(l => 
    l.teacher?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.teacher?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.notes && l.notes.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-8 text-right p-2 sm:p-6" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Landmark className="h-8 w-8 text-brand-primary" />
            <span>إدارة مستحقات ومدفوعات المعلمين</span>
          </h1>
          <p className="text-sm text-slate-400 font-light mt-1">تتبع أرباح معلمي المنصة المشتركين بنظام نسبة الأرباح، وقم بتسجيل وتوثيق دفعاتهم المالية</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 border border-slate-800 hover:border-brand-primary rounded-xl text-xs font-black hover:bg-slate-900/60 transition-all text-slate-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          تحديث البيانات
        </button>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-[var(--border-color)] gap-1 sm:gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('balances')}
          className={`px-5 py-3 text-xs sm:text-sm font-black border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeTab === 'balances' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet className="h-4 w-4" />
          مستحقات المعلمين ({balances.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-5 py-3 text-xs sm:text-sm font-black border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeTab === 'logs' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          سجل المدفوعات الصادرة ({logs.length})
        </button>
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] p-4 rounded-2xl max-w-md">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث باسم المعلم، البريد أو المادة..."
          className="bg-transparent border-none focus:outline-none w-full text-xs text-slate-200"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-650 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 mt-4 font-bold">جاري تحميل البيانات المالية...</span>
        </div>
      ) : activeTab === 'balances' ? (
        
        /* TAB 1: Balances Table */
        <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/50 text-slate-400 border-b border-[var(--border-color)] font-bold">
                <tr>
                  <th className="p-4 sm:p-5">المعلم</th>
                  <th className="p-4 sm:p-5">المادة العلمية</th>
                  <th className="p-4 sm:p-5">إجمالي الأرباح المتراكمة</th>
                  <th className="p-4 sm:p-5">إجمالي المدفوعات السابقة</th>
                  <th className="p-4 sm:p-5">الرصيد المعلق المستحق</th>
                  <th className="p-4 sm:p-5 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-light">لا توجد مستحقات مالية للمعلمين تطابق البحث.</td>
                  </tr>
                ) : (
                  filteredBalances.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-slate-900/10 transition-all duration-150">
                      <td className="p-4 sm:p-5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center font-bold text-indigo-400">
                            {teacher.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-200">{teacher.name}</div>
                            <div className="text-[10px] text-slate-500 font-light">{teacher.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 sm:p-5 font-bold text-slate-400">{teacher.subject || 'غير محدد'}</td>
                      <td className="p-4 sm:p-5 font-extrabold text-slate-300">
                        {parseFloat(String(teacher.lifetime_earnings || 0)).toFixed(2)} ج.م
                      </td>
                      <td className="p-4 sm:p-5 font-bold text-slate-400">
                        {parseFloat(String(teacher.lifetime_payouts || 0)).toFixed(2)} ج.م
                      </td>
                      <td className="p-4 sm:p-5 font-black text-emerald-500 text-sm">
                        {parseFloat(String(teacher.pending_payout || 0)).toFixed(2)} ج.م
                      </td>
                      <td className="p-4 sm:p-5 text-center">
                        <button
                          onClick={() => {
                            setSelectedTeacher(teacher)
                            setPayoutAmount(String(teacher.pending_payout || ''))
                            setShowPayoutModal(true)
                          }}
                          disabled={(teacher.pending_payout || 0) <= 0}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-wide transition-all shadow-sm ${
                            (teacher.pending_payout || 0) <= 0 
                              ? 'bg-slate-800 text-slate-650 cursor-not-allowed border border-transparent'
                              : 'bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/25 hover:border-emerald-500 text-emerald-400 hover:text-white cursor-pointer active:scale-95'
                          }`}
                        >
                          💸 صرف دفعة مالية
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      ) : (

        /* TAB 2: Payouts History Logs */
        <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/50 text-slate-400 border-b border-[var(--border-color)] font-bold">
                <tr>
                  <th className="p-4 sm:p-5">المعلم</th>
                  <th className="p-4 sm:p-5">تاريخ الدفع</th>
                  <th className="p-4 sm:p-5">المبلغ المدفوع</th>
                  <th className="p-4 sm:p-5">وسيلة الدفع</th>
                  <th className="p-4 sm:p-5">مسجل بواسطة الأدمن</th>
                  <th className="p-4 sm:p-5">ملاحظات وإيصالات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-light">لا توجد عمليات صرف مسجلة.</td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/10 transition-all duration-150">
                      <td className="p-4 sm:p-5 font-extrabold text-slate-200">
                        {log.teacher?.name || 'مدرس غير معروف'}
                      </td>
                      <td className="p-4 sm:p-5 text-slate-400 font-medium">
                        {new Date(log.payout_date).toLocaleDateString('ar-EG', {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="p-4 sm:p-5 font-black text-rose-500 text-sm">
                        {parseFloat(log.amount).toFixed(2)} ج.م
                      </td>
                      <td className="p-4 sm:p-5">
                        <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-[10px] text-zinc-300 font-bold border border-zinc-700">
                          {log.payment_method === 'bank_transfer' ? '🏦 تحويل بنكي' : 
                           log.payment_method === 'vodafone_cash' ? '📱 محفظة إلكترونية' : '💵 نقدى / يدوي'}
                        </span>
                      </td>
                      <td className="p-4 sm:p-5 text-slate-400 font-bold">
                        {log.admin?.name || 'السيستم'}
                      </td>
                      <td className="p-4 sm:p-5 text-slate-400 font-light line-clamp-1 max-w-[200px]" title={log.notes || ''}>
                        {log.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      )}

      {/* Record Payout Modal */}
      <AnimatePresence>
        {showPayoutModal && selectedTeacher && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowPayoutModal(false)
                setSelectedTeacher(null)
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl z-10"
            >
              <div>
                <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                  <Send className="h-5 w-5 text-emerald-500" />
                  <span>تسجيل صرف مستحقات المعلم</span>
                </h3>
                <p className="text-xs text-slate-400 font-light mt-1">
                  تسجيل صرف دفعة مالية للمعلم <strong className="text-slate-200">{selectedTeacher.name}</strong> وإصدار إشعار الخصم من رصيده
                </p>
              </div>

              <form onSubmit={handleRecordPayout} className="space-y-4">
                
                {/* Payout balance helper */}
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-bold">الرصيد المستحق الكلي:</span>
                  <span className="text-sm font-black text-emerald-400">
                    {parseFloat(String(selectedTeacher.pending_payout || 0)).toFixed(2)} ج.م
                  </span>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">المبلغ المصروف (ج.م) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-slate-800 focus:border-brand-primary rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                    placeholder="أدخل المبلغ..."
                  />
                </div>

                {/* Method */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">وسيلة الدفع والصرف *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-slate-800 focus:border-brand-primary rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="bank_transfer">🏦 تحويل بنكي</option>
                    <option value="vodafone_cash">📱 فودافون كاش / محفظة إلكترونية</option>
                    <option value="cash">💵 صرف يدوي / نقدي</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">تفاصيل التحويل / ملاحظات إضافية</label>
                  <textarea
                    rows={3}
                    value={payoutNotes}
                    onChange={(e) => setPayoutNotes(e.target.value)}
                    placeholder="رقم العملية، اسم المستلم، أو أي بيانات إثبات دفع..."
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-slate-800 focus:border-brand-primary rounded-xl p-4 text-xs text-slate-200 focus:outline-none resize-none"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPayoutModal(false)
                      setSelectedTeacher(null)
                    }}
                    className="px-5 py-2.5 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-black rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={payoutSaving}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-2 shadow-md shadow-emerald-500/10"
                  >
                    {payoutSaving && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                    تأكيد وتسجيل الصرف
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
