import React from 'react'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { useAuthStore } from '../../store/authStore'
import { Plus, Check, FileDown, Layers, Calendar, ClipboardList, KeyRound, CheckSquare, X, Loader2, AlertTriangle } from 'lucide-react'
import EmptyState from '../../components/EmptyState'

interface PurchaseCodeItem {
  id: number
  code: string
  type: string
  code_type?: string | null
  credit_amount?: string | null
  amount: string
  course?: {
    title: string
  } | null
  package?: {
    title: string
  } | null
  teacher?: {
    name: string
  } | null
  is_redeemed: boolean
  redeemed_by?: {
    name: string
  } | null
  redeemed_at?: string | null
  expires_at?: string | null
}

interface CourseItem {
  id: number
  title: string
}

interface TeacherItem {
  id: number
  name: string
}

interface PackageItem {
  id: number
  title: string
}

const MIN_QUANTITY = 1
const MAX_QUANTITY = 10000

export default function PurchaseCodes() {
  const { user } = useAuthStore()
  const [codes, setCodes] = React.useState<PurchaseCodeItem[]>([])
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [teachers, setTeachers] = React.useState<TeacherItem[]>([])
  const [packages, setPackages] = React.useState<PackageItem[]>([])
  
  // Bulk delete states
  const [showBulkDeleteModal, setShowBulkDeleteModal] = React.useState(false)
  const [confirmPhrase, setConfirmPhrase] = React.useState('')
  const [bulkDeleting, setBulkDeleting] = React.useState(false)
  
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Filters
  const [filterType, setFilterType] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState('')

  // Generation Form Inputs
  const [showGenForm, setShowGenForm] = React.useState(false)
  const [type, setType] = React.useState<'wallet' | 'course' | 'teacher'>('wallet')
  const [quantity, setQuantity] = React.useState('10')
  const [quantityError, setQuantityError] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [targetType, setTargetType] = React.useState<'course' | 'package'>('course')
  const [courseId, setCourseId] = React.useState('')
  const [packageId, setPackageId] = React.useState('')
  const [teacherId, setTeacherId] = React.useState('')
  const [expiresAt, setExpiresAt] = React.useState('')

  // Newly generated codes display
  const [newCodes, setNewCodes] = React.useState<PurchaseCodeItem[]>([])

  const fetchCodes = () => {
    setLoading(true)
    API.get(`/admin/purchase-codes?type=${filterType}&status=${filterStatus}`)
      .then((res) => {
        setCodes(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  React.useEffect(() => {
    fetchCodes()
  }, [filterType, filterStatus])

  React.useEffect(() => {
    // Load courses, teachers & packages for select menus
    API.get('/admin/courses').then((res) => setCourses(res.data))
    API.get('/admin/teachers').then((res) => setTeachers(res.data))
    API.get('/admin/packages').then((res) => setPackages(res.data))
  }, [])

  const handleQuantityChange = (val: string) => {
    setQuantity(val)
    if (val === '') {
      setQuantityError('الكمية مطلوبة / Quantity is required')
      return
    }
    const qNum = Number(val)
    if (isNaN(qNum) || !Number.isInteger(qNum)) {
      setQuantityError('يجب إدخال عدد صحيح فقط / Must be a whole integer')
      return
    }
    if (qNum < MIN_QUANTITY) {
      setQuantityError(`الحد الأدنى هو ${MIN_QUANTITY} / Minimum is ${MIN_QUANTITY}`)
      return
    }
    if (qNum > MAX_QUANTITY) {
      setQuantityError(`الحد الأقصى هو ${MAX_QUANTITY} / Maximum is ${MAX_QUANTITY}`)
      return
    }
    setQuantityError('')
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()

    const qNum = Number(quantity)
    if (!quantity || isNaN(qNum) || !Number.isInteger(qNum) || qNum < MIN_QUANTITY || qNum > MAX_QUANTITY) {
      setQuantityError(`يرجى إدخال عدد صحيح بين ${MIN_QUANTITY} و ${MAX_QUANTITY}.`)
      return
    }
    setQuantityError('')

    setSaving(true)
    setNewCodes([])

    const payload = {
      type,
      quantity: qNum,
      amount: (type === 'wallet' || type === 'teacher') && amount ? Number(amount) : null,
      course_id: type === 'course' && courseId ? Number(courseId) : null,
      package_id: type === 'course' && packageId ? Number(packageId) : null,
      teacher_id: teacherId ? Number(teacherId) : null,
      expires_at: expiresAt || null,
    }

    try {
      const res = await API.post('/admin/purchase-codes', payload)
      setNewCodes(res.data.codes)
      setShowGenForm(false)
      fetchCodes()
      useModalStore.getState().showToast(res.data.message || 'تم توليد الأكواد بنجاح.', 'success')
    } catch (err: any) {
      console.error(err)
      if (err.response && err.response.data && err.response.data.message) {
        useModalStore.getState().showAlert({
          title: 'فشل التوليد',
          description: err.response.data.message,
          type: 'error'
        })
      } else {
        useModalStore.getState().showToast('حدث خطأ أثناء توليد الأكواد. تأكد من ملء الحقول المطلوبة بشكل صحيح.', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  // Export newly generated codes to CSV
  const handleExportCSV = (codesList: PurchaseCodeItem[]) => {
    if (codesList.length === 0) return

    const headers = 'الكود,النوع,القيمة,الكورس المرتبط,المعلم,الحالة\n'
    const rows = codesList.map((c) => {
      const codeType = c.code_type || c.type
      const typeStr = codeType === 'wallet' ? 'شحن محفظة' : (codeType === 'teacher' ? 'رصيد معلم' : 'اشتراك كورس')
      const amtStr = (codeType === 'wallet' || codeType === 'teacher') ? (c.amount || c.credit_amount) : '0.00'
      const courseStr = c.course?.title ? `"${c.course.title}"` : 'لا يوجد'
      const teachStr = c.teacher?.name ? `"${c.teacher.name}"` : 'لا يوجد'
      const statusStr = c.is_redeemed ? 'مستعمل' : 'متاح'
      return `${c.code},${typeStr},${amtStr},${courseStr},${teachStr},${statusStr}\n`
    })

    const csvContent = '\uFEFF' + headers + rows.join('')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `elm_codes_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      
      {/* Title bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[var(--border-color)] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black">أكواد وكوبونات الشحن</h1>
            {user?.role === 'admin' && (user?.is_super_admin || user?.is_super) && (
              <button
                onClick={() => {
                  setShowBulkDeleteModal(true);
                  setConfirmPhrase('');
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all duration-205 cursor-pointer flex items-center gap-1.5 shadow-lg shadow-red-600/10 hover:shadow-red-600/20"
              >
                <span>🗑 حذف جميع الأكواد</span>
              </button>
            )}
          </div>
          <p className="text-sm text-slate-400 font-light mt-1">قم بتوليد أكواد شحن المحفظة أو أكواد تفعيل الكورسات لبيعها للطلاب</p>
        </div>

        <button
          onClick={() => {
            setNewCodes([])
            setQuantity('10')
            setQuantityError('')
            setShowGenForm(true)
          }}
          className="px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-primary/20 glow-btn w-fit"
        >
          <Plus className="h-4.5 w-4.5" /> <span>توليد أكواد جديدة</span>
        </button>
      </div>

      {/* Generated Display Box */}
      {newCodes.length > 0 && (
        <div className="p-6 bg-emerald-500/5 border border-brand-primary/20 rounded-3xl space-y-4">
          <div className="flex justify-between items-center border-b border-brand-primary/10 pb-3">
            <h3 className="font-bold text-sm text-brand-primary">الأكواد التي تم توليدها مؤخراً:</h3>
            <button
              onClick={() => handleExportCSV(newCodes)}
              className="px-3 py-1.5 bg-brand-primary text-white text-[10px] rounded-lg font-bold flex items-center gap-1 cursor-pointer"
            >
              <FileDown className="h-3.5 w-3.5" /> تنزيل كملف Excel / CSV
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-40 overflow-y-auto font-mono text-xs select-all bg-black/20 p-4 rounded-xl border border-slate-800">
            {newCodes.map((c) => (
              <div key={c.id} className="p-2 border border-slate-800 bg-slate-900 rounded text-center font-bold">
                {c.code}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Catalog */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-brand-card border border-[var(--border-color)] p-4 rounded-2xl">
        <div className="flex flex-wrap gap-4 w-full sm:w-auto">
          
          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs font-semibold"
          >
            <option value="">جميع أنواع الأكواد</option>
            <option value="wallet">شحن محفظة</option>
            <option value="teacher">رصيد معلم</option>
            <option value="course">اشتراك كورس</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs font-semibold"
          >
            <option value="">جميع الحالات</option>
            <option value="active">متاحة وغير مستعملة</option>
            <option value="redeemed">مستعملة ومفعلة</option>
            <option value="expired">منتهية الصلاحية</option>
          </select>

        </div>

        {codes.length > 0 && (
          <button
            onClick={() => handleExportCSV(codes)}
            className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl text-xs font-bold hover:bg-[rgba(255,255,255,0.06)] flex items-center gap-1.5 cursor-pointer"
          >
            <FileDown className="h-4 w-4" /> <span>تصدير الكل لـ CSV</span>
          </button>
        )}
      </div>

      {/* Catalog lists */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
        </div>
      ) : codes.length === 0 ? (
        <EmptyState
          type="general"
          title="لا توجد أكواد شحن مطابقة"
          description="لم نعثر على أكواد شحن تطابق خيارات التصفية المدخلة."
        />
      ) : (
        <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead>
                <tr className="bg-[rgba(255,255,255,0.01)] border-b border-[var(--border-color)] text-slate-400">
                  <th className="p-4 sm:p-6 font-semibold">كود الشحن (Coupon)</th>
                  <th className="p-4 sm:p-6 font-semibold">نوع التفعيل</th>
                  <th className="p-4 sm:p-6 font-semibold">القيمة المالية</th>
                  <th className="p-4 sm:p-6 font-semibold">الكورس / الباقة / المعلم المرتبط</th>
                  <th className="p-4 sm:p-6 font-semibold">الحالة</th>
                  <th className="p-4 sm:p-6 font-semibold">تاريخ الاستخدام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {codes.map((c) => (
                  <tr key={c.id} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                    
                    {/* Code */}
                    <td className="p-4 sm:p-6 font-bold font-mono select-all text-slate-100">
                      {c.code}
                    </td>

                    {/* Type */}
                    <td className="p-4 sm:p-6 text-slate-300 font-medium">
                      {(c.code_type || c.type) === 'wallet' ? 'شحن رصيد المحفظة' : ((c.code_type || c.type) === 'teacher' ? 'رصيد مقيد بمعلم' : 'اشتراك بكورس/باقة')}
                    </td>

                    {/* Amount */}
                    <td className="p-4 sm:p-6 font-bold text-brand-primary">
                      {c.amount && parseFloat(c.amount) > 0 ? `${c.amount} ج.م` : '-'}
                    </td>

                    {/* Associated Course / Teacher / Package */}
                    <td className="p-4 sm:p-6 text-slate-300 font-medium max-w-xs truncate">
                      {c.type === 'course' && c.course ? (
                        <span>كورس: {c.course.title}</span>
                      ) : c.type === 'course' && c.package ? (
                        <span>باقة: {c.package.title}</span>
                      ) : c.teacher?.name ? (
                        <span>مدرس: {c.teacher.name}</span>
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-4 sm:p-6">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        c.is_redeemed
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-brand-success'
                      }`}>
                        {c.is_redeemed ? 'مستعمل' : 'متاح للتفعيل'}
                      </span>
                    </td>

                    {/* Redeemed At / Expiry */}
                    <td className="p-4 sm:p-6 text-slate-400 font-light">
                      {c.is_redeemed && c.redeemed_at ? (
                        <div className="space-y-0.5">
                          <div>المستعمل: {c.redeemed_by?.name || 'طالب'}</div>
                          <div className="text-[9px] text-slate-500">{new Date(c.redeemed_at).toLocaleDateString('ar-EG')}</div>
                        </div>
                      ) : c.expires_at ? (
                        <span>ينتهي: {new Date(c.expires_at).toLocaleDateString('ar-EG')}</span>
                      ) : (
                        <span>لا ينتهي</span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. OVERLAYS */}

      {/* Generation Form Popup Modal */}
      {showGenForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/10 z-40" onClick={() => setShowGenForm(false)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl z-50 text-right">
            <h3 className="text-lg font-black border-b border-[var(--border-color)] pb-3 text-right">توليد أكواد شحن وتفعيل</h3>
            
            <form onSubmit={handleGenerate} className="space-y-4 text-right">
              
              {/* Type */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">نوع التفعيل</label>
                <select
                  value={type}
                  onChange={(e: any) => setType(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                >
                  <option value="wallet">شحن رصيد المحفظة (عام)</option>
                  <option value="teacher">شحن رصيد خاص بمعلم محدد</option>
                  <option value="course">اشتراك كورس دراسي مباشرة</option>
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">الكمية المطلوبة</label>
                <input
                  type="number"
                  required
                  min={MIN_QUANTITY}
                  max={MAX_QUANTITY}
                  step="1"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  placeholder="Enter number of codes"
                  className={`w-full bg-[rgba(255,255,255,0.02)] border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-colors text-right ${
                    quantityError ? 'border-rose-500 focus:border-rose-500' : 'border-[var(--border-color)] focus:border-brand-primary'
                  }`}
                />
                <span className="text-[10px] text-slate-400 block mt-1 leading-normal text-right">
                  Generate exactly the number of recharge codes you need.
                </span>
                {quantityError && (
                  <span className="text-[10px] text-rose-500 block mt-1 font-medium text-right">{quantityError}</span>
                )}
              </div>

              {/* Amount (Wallet/Teacher specific) */}
              {(type === 'wallet' || type === 'teacher') && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold">
                    {type === 'wallet' ? 'قيمة كود الشحن المالي (ج.م)' : 'قيمة رصيد المعلم المستهدف (ج.م)'}
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="مثال: 50 أو 100"
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                  />
                </div>
              )}

              {/* Course/Package target selectors */}
              {type === 'course' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">نوع التفعيل المستهدف</label>
                    <select
                      value={targetType}
                      onChange={(e: any) => {
                        setTargetType(e.target.value)
                        setCourseId('')
                        setPackageId('')
                      }}
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                    >
                      <option value="course">اشتراك كورس دراسي</option>
                      <option value="package">اشتراك باقة شهرية</option>
                    </select>
                  </div>

                  {targetType === 'course' ? (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">الكورس المستهدف بالتفعيل</label>
                      <select
                        required
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                        className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                      >
                        <option value="">اختر الكورس...</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">الباقة المستهدفة بالتفعيل</label>
                      <select
                        required
                        value={packageId}
                        onChange={(e) => setPackageId(e.target.value)}
                        className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                      >
                        <option value="">اختر الباقة...</option>
                        {packages.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Optional restrictions for Wallet type */}
              {type === 'wallet' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">تقييد الكود بكورس محدد (اختياري)</label>
                    <select
                      value={courseId}
                      onChange={(e) => {
                        setCourseId(e.target.value)
                        if (e.target.value) setPackageId('')
                      }}
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                    >
                      <option value="">بدون تقييد بكورس...</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold">تقييد الكود بباقة محددة (اختياري)</label>
                    <select
                      value={packageId}
                      onChange={(e) => {
                        setPackageId(e.target.value)
                        if (e.target.value) setCourseId('')
                      }}
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                    >
                      <option value="">بدون تقييد بباقة...</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Teacher ID (Optional link or required depending on type) */}
              {(type === 'teacher' || type === 'wallet') && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold">
                    {type === 'teacher' ? 'المعلم المستهدف (إجباري)' : 'ربط الكود بمعلم محدد (اختياري)'}
                  </label>
                  <select
                    required={type === 'teacher'}
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                  >
                    <option value="">{type === 'teacher' ? 'اختر معلم...' : 'لا يوجد معلم مرتبط...'}</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Expiry Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">تاريخ الانتهاء (اختياري)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
                <button type="button" onClick={() => setShowGenForm(false)} className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl">إلغاء</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl">
                  {saving ? 'جاري التوليد...' : 'توليد الكود'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 6. Bulk Delete Codes Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/10 z-40" onClick={() => { if (!bulkDeleting) setShowBulkDeleteModal(false); }} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl z-50 text-right">
            <h3 className="text-lg font-black text-red-500 flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
              <span>تأكيد الإجراء الخطير: حذف جميع الأكواد</span>
            </h3>
            <div className="text-xs text-slate-300 font-bold leading-relaxed bg-red-500/10 p-4 border border-red-500/20 rounded-2xl">
              ⚠️ سيتم حذف جميع الأكواد نهائياً.
            </div>
            
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              * سيتم حذف جميع الأكواد المستعملة والمتاحة للتفعيل.<br/>
              * سيتم حذف كافة أكواد شحن الرصيد والاشتراكات بالكورسات المضافة مسبقاً.<br/>
              * <strong>تنبيه:</strong> لن يتمكن أي طالب من تفعيل كود تم شراؤه مسبقاً بعد إتمام هذه العملية.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                اكتب <span className="font-mono text-red-400 font-black">"DELETE CODES"</span> للتأكيد.
              </label>
              <input
                type="text"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="DELETE CODES"
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
                disabled={confirmPhrase !== 'DELETE CODES' || bulkDeleting}
                onClick={async () => {
                  setBulkDeleting(true);
                  try {
                    await API.post('/admin/bulk/codes');
                    useModalStore.getState().showToast('تم حذف جميع الأكواد بنجاح وبشكل آمن.', 'success');
                    setShowBulkDeleteModal(false);
                    setConfirmPhrase('');
                    fetchCodes();
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
