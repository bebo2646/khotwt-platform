import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Award, 
  DollarSign, 
  Users, 
  ShieldAlert, 
  Unlock, 
  Loader2, 
  X, 
  AlertCircle,
  Calendar,
  Sparkles
} from 'lucide-react'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { useAuthStore } from '../../store/authStore'
import SEO from '../../components/SEO'
import { formatGradeName, formatSubjectName } from '../../utils/formatters'

interface AdminMonthlyExam {
  id: number
  title: string
  description?: string
  month: string
  stage?: string
  grade: string
  subject: string
  teacher_id?: number
  time_limit_minutes: number
  max_score: number
  passing_score?: number
  price: number | string
  is_paid: boolean
  is_published: boolean
  is_active: boolean
  allowed_violations: number
  enable_fullscreen: boolean
  enable_anti_tab_switching: boolean
  enable_copy_protection: boolean
  randomize_questions: boolean
  randomize_options: boolean
  questions_count?: number
  attempts_count?: number
  purchases_count?: number
  teacher?: {
    id: number
    name: string
    email: string
  }
}

interface TeacherOption {
  id: number
  name: string
  subject?: string
}

const MONTHS_LIST = [
  'شهر سبتمبر',
  'شهر أكتوبر',
  'شهر نوفمبر',
  'شهر ديسمبر',
  'شهر يناير',
  'شهر فبراير',
  'شهر مارس',
  'شهر أبريل',
  'شهر مايو',
]

const GRADES_LIST = [
  { value: 'first_secondary', label: 'الصف الأول الثانوي' },
  { value: 'second_secondary', label: 'الصف الثاني الثانوي' },
  { value: 'third_secondary', label: 'الصف الثالث الثانوي' },
  { value: 'third_prep', label: 'الصف الثالث الإعدادي' },
  { value: 'second_prep', label: 'الصف الثاني الإعدادي' },
  { value: 'first_prep', label: 'الصف الأول الإعدادي' },
]

export default function MonthlyExamsManagement() {
  const { user } = useAuthStore()
  const { showToast } = useModalStore()

  const [exams, setExams] = useState<AdminMonthlyExam[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedGrade, setSelectedGrade] = useState('all')

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExam, setEditingExam] = useState<AdminMonthlyExam | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    month: 'شهر أكتوبر',
    stage: 'المرحلة الثانوية',
    grade: 'third_secondary',
    subject: 'الكيمياء',
    teacher_id: '',
    time_limit_minutes: 60,
    max_score: 50,
    passing_score: 25,
    price: 30,
    is_published: true,
    is_active: true,
    allowed_violations: 3,
    enable_fullscreen: true,
    enable_anti_tab_switching: true,
    enable_copy_protection: true,
    randomize_questions: true,
    randomize_options: true,
  })

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<AdminMonthlyExam | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchExams = async () => {
    setLoading(true)
    try {
      const endpoint = user?.role === 'teacher' ? '/teacher/monthly-exams' : '/admin/monthly-exams'
      const res = await API.get(endpoint)
      setExams(Array.isArray(res.data) ? res.data : [])
    } catch (err: any) {
      console.error('Failed to load monthly exams:', err)
      showToast('تعذر تحميل الامتحانات الشهرية.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeachers = async () => {
    if (user?.role === 'admin') {
      try {
        const res = await API.get('/teachers')
        setTeachers(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        console.error('Failed to load teachers list:', err)
      }
    }
  }

  useEffect(() => {
    fetchExams()
    fetchTeachers()
  }, [])

  const navigate = useNavigate()

  // Open Create in ExamBuilder
  const openCreateModal = () => {
    navigate('/teacher/exams/create?context=monthly_standalone')
  }

  // Open Edit in ExamBuilder
  const openEditModal = (exam: AdminMonthlyExam) => {
    navigate(`/teacher/exams/edit/${exam.id}?context=monthly_standalone`)
  }

  // Save Exam (Create / Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const endpointBase = user?.role === 'teacher' ? '/teacher/monthly-exams' : '/admin/monthly-exams'
      if (editingExam) {
        await API.put(`${endpointBase}/${editingExam.id}`, formData)
        showToast('تم تحديث بيانات الامتحان الشهري بنجاح!', 'success')
      } else {
        await API.post(endpointBase, formData)
        showToast('تم إنشاء الامتحان الشهري بنجاح!', 'success')
      }
      setModalOpen(false)
      fetchExams()
    } catch (err: any) {
      console.error('Failed to save exam:', err)
      const msg = err.response?.data?.message || 'حدث خطأ أثناء حفظ البيانات.'
      showToast(msg, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete Exam
  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const endpointBase = user?.role === 'teacher' ? '/teacher/monthly-exams' : '/admin/monthly-exams'
      const res = await API.delete(`${endpointBase}/${deleteTarget.id}`)
      showToast(res.data?.message || 'تم حذف الامتحان بنجاح.', 'success')
      setDeleteTarget(null)
      fetchExams()
    } catch (err: any) {
      const msg = err.response?.data?.message || 'فشل حذف الامتحان.'
      showToast(msg, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtered List
  const filteredExams = exams.filter((e) => {
    const matchSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.subject.toLowerCase().includes(searchQuery.toLowerCase())
    const matchMonth = selectedMonth === 'all' || e.month === selectedMonth
    const matchGrade = selectedGrade === 'all' || e.grade === selectedGrade
    return matchSearch && matchMonth && matchGrade
  })

  // Metrics
  const totalExamsCount = exams.length
  const totalPublishedCount = exams.filter(e => e.is_published).length
  const totalPurchasesCount = exams.reduce((acc, curr) => acc + (curr.purchases_count || 0), 0)
  const totalAttemptsCount = exams.reduce((acc, curr) => acc + (curr.attempts_count || 0), 0)

  return (
    <div className="space-y-8 p-4 sm:p-8">
      <SEO title="إدارة الامتحانات الشهرية | لوحة التحكم" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">إدارة الامتحانات الشهرية</h1>
          <p className="text-xs text-slate-400 mt-1">
            إنشاء وإدارة الامتحانات الشهرية المستقلة، تحديد الأسعار، وإعدادات المراقبة الذكية.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة امتحان شهري جديد</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-xs text-slate-400 font-medium">إجمالي الامتحانات</div>
          <div className="text-2xl font-black text-white">{totalExamsCount}</div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-xs text-slate-400 font-medium">الامتحانات المنشورة</div>
          <div className="text-2xl font-black text-emerald-400">{totalPublishedCount}</div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-xs text-slate-400 font-medium">إجمالي عمليات الشراء</div>
          <div className="text-2xl font-black text-indigo-400">{totalPurchasesCount}</div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-xs text-slate-400 font-medium">إجمالي المحاولات</div>
          <div className="text-2xl font-black text-amber-400">{totalAttemptsCount}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="بحث بالاسم أو المادة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        </div>

        <div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">جميع الشهور</option>
            {MONTHS_LIST.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">جميع الصفوف</option>
            {GRADES_LIST.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Exams Table */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-2xl p-8 space-y-2">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-300">لا توجد امتحانات شهرية مضافة</h4>
          <p className="text-xs text-slate-500">انقر على زر "إضافة امتحان شهري جديد" لإنشاء أول امتحان.</p>
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold">
                <tr>
                  <th className="p-4">عنوان الامتحان</th>
                  <th className="p-4">الشهر / المادة</th>
                  <th className="p-4">المعلم</th>
                  <th className="p-4">السعر</th>
                  <th className="p-4">الأسئلة / المدة</th>
                  <th className="p-4">المشتركون</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-bold">
                      <div className="text-slate-100">{exam.title}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{formatGradeName(exam.grade)}</div>
                    </td>
                    <td className="p-4">
                      <span className="inline-block px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20 text-[11px]">
                        {exam.month}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{formatSubjectName(exam.subject)}</div>
                    </td>
                    <td className="p-4 text-slate-300">
                      {exam.teacher?.name || '—'}
                    </td>
                    <td className="p-4 font-bold">
                      {exam.is_paid && parseFloat(String(exam.price)) > 0 ? (
                        <span className="text-amber-400">{exam.price} ج.م</span>
                      ) : (
                        <span className="text-emerald-400">مجاني</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div>{exam.questions_count || 0} سؤال</div>
                      <div className="text-[10px] text-slate-400">{exam.time_limit_minutes} دقيقة</div>
                    </td>
                    <td className="p-4 font-bold text-slate-300">
                      {exam.purchases_count || 0} طالب
                    </td>
                    <td className="p-4">
                      {exam.is_published ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[10px]">
                          منشور
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold text-[10px]">
                          مسودة
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(exam)}
                          title="تعديل الامتحان"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-indigo-300 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(exam)}
                          title="حذف الامتحان"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 text-right my-8"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-lg font-black text-white">
                  {editingExam ? 'تعديل بيانات الامتحان الشهري' : 'إضافة امتحان شهري جديد'}
                </h3>
                <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">عنوان الامتحان</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: امتحان كيمياء شهر أكتوبر الشامل"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">الوصف (اختياري)</label>
                  <textarea
                    rows={2}
                    placeholder="وصف محتوى الامتحان والدروس المشمولة..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Month, Grade, Subject */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">الشهر</label>
                    <select
                      value={formData.month}
                      onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      {MONTHS_LIST.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">الصف الدراسي</label>
                    <select
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      {GRADES_LIST.map((g) => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">المادة الدراسية</label>
                    <input
                      type="text"
                      required
                      placeholder="الكيمياء، الفيزياء..."
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Teacher, Price, Duration, Max Score */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {user?.role === 'admin' && (
                    <div className="space-y-1">
                      <label className="font-bold text-slate-300">المعلم المعين</label>
                      <select
                        value={formData.teacher_id}
                        onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">بدون معلم</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">السعر (ج.م)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">المدة (بالدقائق)</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.time_limit_minutes}
                      onChange={(e) => setFormData({ ...formData, time_limit_minutes: parseInt(e.target.value) || 60 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">الدرجة الكلية</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.max_score}
                      onChange={(e) => setFormData({ ...formData, max_score: parseInt(e.target.value) || 50 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Anti-Cheat Settings */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                  <div className="font-bold text-indigo-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>إعدادات المراقبة ومنع الغش الذكية</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enable_fullscreen}
                        onChange={(e) => setFormData({ ...formData, enable_fullscreen: e.target.checked })}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>فرض وضع ملء الشاشة</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enable_anti_tab_switching}
                        onChange={(e) => setFormData({ ...formData, enable_anti_tab_switching: e.target.checked })}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>رصد مغادرة الصفحة والتبديل</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enable_copy_protection}
                        onChange={(e) => setFormData({ ...formData, enable_copy_protection: e.target.checked })}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>منع النسخ واللصق والنقر الأيمن</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.randomize_questions}
                        onChange={(e) => setFormData({ ...formData, randomize_questions: e.target.checked })}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>ترتيب عشوائي للأسئلة لكل طالب</span>
                    </label>
                  </div>
                </div>

                {/* Published / Active Toggles */}
                <div className="flex gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_published}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-bold text-slate-200">نشر الامتحان للطلاب</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-bold text-slate-200">الامتحان نشط ومتاح للحل</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{editingExam ? 'حفظ التعديلات' : 'إنشاء الامتحان الآن'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-right"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-black text-white">تأكيد حذف الامتحان الشهري</h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف <span className="font-bold text-white">"{deleteTarget.title}"</span>؟ إذا كان هناك طلاب قد أجروا الامتحان مسبقاً، سيتم تعطيله وإخفاؤه للحفاظ على سجلات النتائج.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>تأكيد الحذف</span>
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
