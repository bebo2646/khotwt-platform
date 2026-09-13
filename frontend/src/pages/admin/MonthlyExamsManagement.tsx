import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  Lock,
  Loader2, 
  X, 
  AlertCircle,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  BookOpen
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

interface StudentAttemptListItem {
  id: number
  student_id: number
  student?: {
    id: number
    name: string
    email?: string
    phone?: string
  }
  score: number | null
  max_score?: number
  passing_score?: number
  percentage?: number
  status: string
  is_terminated_for_cheating: boolean
  can_view_answers: boolean
  started_at: string | null
  submitted_at: string | null
  duration_minutes?: number | null
  auto_submitted?: boolean
  submission_reason?: string | null
  violation_count?: number
  cheat_violations_count?: number
  terminated_for_cheating_at?: string | null
  answers_unlocked_at?: string | null
  answers_unlocked_by?: number | null
  unlocked_by?: {
    id: number
    name: string
  } | null
}

interface ReviewQuestion {
  id: number
  text: string
  type: string
  options?: string[] | null
  correct_answer?: string | null
  explanation?: string | null
  score: number
  is_answered: boolean
  student_answer: string | null
  is_correct: boolean
  score_awarded: number
}

interface AttemptReviewData {
  exam: {
    id: number
    title: string
    month?: string
    stage?: string
    grade?: string
    subject?: string
    max_score: number
    passing_score: number
    time_limit_minutes: number
  }
  student: {
    id?: number
    name: string
    email?: string
    phone?: string
  }
  attempt: {
    id: number
    status: string
    score: number | null
    max_score: number
    percentage: number
    started_at: string | null
    submitted_at: string | null
    graded_at: string | null
    duration_minutes: number | null
    auto_submitted: boolean
    submission_reason: string | null
    violation_count: number
    cheat_violations_count: number
    is_terminated_for_cheating: boolean
    terminated_for_cheating_at: string | null
    answers_unlocked_at: string | null
    answers_unlocked_by: number | null
    unlocked_by: {
      id: number
      name: string
    } | null
    can_student_view_answers: boolean
  }
  questions: ReviewQuestion[]
  violations: Array<{
    id: number
    violation_type: string
    time_remaining_seconds?: number | null
    metadata?: any
    created_at?: string | null
  }>
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
  const navigate = useNavigate()
  const { examId: routeExamId } = useParams<{ examId?: string }>()

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

  // Attempts Management State
  const [attemptsModalOpen, setAttemptsModalOpen] = useState(false)
  const [selectedExamForAttempts, setSelectedExamForAttempts] = useState<AdminMonthlyExam | null>(null)
  const [attemptsList, setAttemptsList] = useState<StudentAttemptListItem[]>([])
  const [loadingAttempts, setLoadingAttempts] = useState(false)
  const [attemptsSearch, setAttemptsSearch] = useState('')
  const [attemptsStatusFilter, setAttemptsStatusFilter] = useState('all')
  const [attemptsVisibilityFilter, setAttemptsVisibilityFilter] = useState('all')

  // Attempt Detailed Review State
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewData, setReviewData] = useState<AttemptReviewData | null>(null)
  const [loadingReview, setLoadingReview] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [showViolationsTimeline, setShowViolationsTimeline] = useState(false)

  const fetchExams = async () => {
    setLoading(true)
    try {
      const endpoint = user?.role === 'teacher' ? '/teacher/monthly-exams' : '/admin/monthly-exams'
      const res = await API.get(endpoint)
      const data: AdminMonthlyExam[] = Array.isArray(res.data) ? res.data : []
      setExams(data)

      // If route param specified examId, auto-open attempts
      if (routeExamId) {
        const target = data.find(e => String(e.id) === String(routeExamId))
        if (target) {
          openAttemptsModal(target)
        }
      }
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

  // Open Create in ExamBuilder
  const openCreateModal = () => {
    navigate('/teacher/exams/create?context=monthly_standalone')
  }

  // Open Edit in ExamBuilder
  const openEditModal = (exam: AdminMonthlyExam) => {
    navigate(`/teacher/exams/edit/${exam.id}?context=monthly_standalone`)
  }

  // Open Attempts Management for Exam
  const openAttemptsModal = async (exam: AdminMonthlyExam) => {
    setSelectedExamForAttempts(exam)
    setAttemptsModalOpen(true)
    setLoadingAttempts(true)
    setAttemptsList([])
    setAttemptsSearch('')
    setAttemptsStatusFilter('all')
    setAttemptsVisibilityFilter('all')

    try {
      const endpoint = user?.role === 'teacher'
        ? `/teacher/monthly-exams/${exam.id}/attempts`
        : `/admin/monthly-exams/${exam.id}/attempts`
      const res = await API.get(endpoint)
      setAttemptsList(res.data?.attempts || [])
    } catch (err: any) {
      console.error('Failed to fetch exam attempts:', err)
      const msg = err.response?.data?.message || 'تعذر تحميل محاولات الطلاب لهذا الامتحان.'
      showToast(msg, 'error')
    } finally {
      setLoadingAttempts(false)
    }
  }

  // Open Detailed Review for Student Attempt
  const openAttemptReview = async (attemptId: number, examId?: number) => {
    const targetExamId = examId || selectedExamForAttempts?.id
    if (!targetExamId) return

    setReviewModalOpen(true)
    setLoadingReview(true)
    setReviewData(null)
    setShowViolationsTimeline(false)

    try {
      const endpoint = user?.role === 'teacher'
        ? `/teacher/monthly-exams/${targetExamId}/attempts/${attemptId}`
        : `/admin/monthly-exams/${targetExamId}/attempts/${attemptId}`
      const res = await API.get(endpoint)
      setReviewData(res.data)
    } catch (err: any) {
      console.error('Failed to load attempt details:', err)
      const msg = err.response?.data?.message || 'تعذر تحميل تفاصيل المحاولة للمراجعة.'
      showToast(msg, 'error')
      setReviewModalOpen(false)
    } finally {
      setLoadingReview(false)
    }
  }

  // Unlock Answers Action
  const handleUnlockAnswers = async (attemptId: number) => {
    setUnlocking(true)
    try {
      const endpoint = user?.role === 'teacher'
        ? `/teacher/monthly-exams/attempts/${attemptId}/unlock-answers`
        : `/admin/monthly-exams/attempts/${attemptId}/unlock-answers`
      const res = await API.post(endpoint)
      const successMsg = res.data?.message || 'تم فتح عرض نموذج الإجابات للطالب بنجاح.'
      showToast(successMsg, 'success')

      const updatedAttempt = res.data?.attempt
      const unlockDateIso = updatedAttempt?.answers_unlocked_at || new Date().toISOString()
      const unlockedByName = updatedAttempt?.unlocked_by?.name || user?.name || 'المشرف / المعلم'

      // Update state in detailed review modal
      setReviewData(prev => {
        if (!prev) return null
        return {
          ...prev,
          attempt: {
            ...prev.attempt,
            answers_unlocked_at: unlockDateIso,
            can_student_view_answers: true,
            unlocked_by: {
              id: user?.id || 0,
              name: unlockedByName
            }
          }
        }
      })

      // Update row in attempts list
      setAttemptsList(prev => prev.map(att => {
        if (att.id === attemptId) {
          return {
            ...att,
            answers_unlocked_at: unlockDateIso,
            can_view_answers: true,
            unlocked_by: {
              id: user?.id || 0,
              name: unlockedByName
            }
          }
        }
        return att
      }))
    } catch (err: any) {
      console.error('Failed to unlock answers:', err)
      const msg = err.response?.data?.message || 'تعذر إلغاء قفل الإجابات للطالب.'
      showToast(msg, 'error')
    } finally {
      setUnlocking(false)
    }
  }

  // Save Exam (Create / Update via inline fallback)
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

  // Filtered Exams List
  const filteredExams = exams.filter((e) => {
    const matchSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.subject.toLowerCase().includes(searchQuery.toLowerCase())
    const matchMonth = selectedMonth === 'all' || e.month === selectedMonth
    const matchGrade = selectedGrade === 'all' || e.grade === selectedGrade
    return matchSearch && matchMonth && matchGrade
  })

  // Filtered Attempts List
  const filteredAttempts = attemptsList.filter((att) => {
    const studentName = att.student?.name?.toLowerCase() || ''
    const studentEmail = att.student?.email?.toLowerCase() || ''
    const studentPhone = att.student?.phone || ''
    const matchSearch = studentName.includes(attemptsSearch.toLowerCase()) ||
      studentEmail.includes(attemptsSearch.toLowerCase()) ||
      studentPhone.includes(attemptsSearch)

    let matchStatus = true
    if (attemptsStatusFilter === 'graded') {
      matchStatus = att.status === 'graded' && !att.is_terminated_for_cheating
    } else if (attemptsStatusFilter === 'terminated_for_cheating') {
      matchStatus = att.is_terminated_for_cheating || att.status === 'terminated_for_cheating'
    } else if (attemptsStatusFilter === 'started') {
      matchStatus = att.status === 'started'
    }

    let matchVisibility = true
    if (attemptsVisibilityFilter === 'locked') {
      matchVisibility = !att.can_view_answers
    } else if (attemptsVisibilityFilter === 'unlocked') {
      matchVisibility = att.can_view_answers
    }

    return matchSearch && matchStatus && matchVisibility
  })

  // Metrics
  const totalExamsCount = exams.length
  const totalPublishedCount = exams.filter(e => e.is_published).length
  const totalPurchasesCount = exams.reduce((acc, curr) => acc + (curr.purchases_count || 0), 0)
  const totalAttemptsCount = exams.reduce((acc, curr) => acc + (curr.attempts_count || 0), 0)

  return (
    <div className="space-y-8 p-4 sm:p-8 text-right" dir="rtl">
      <SEO title="إدارة الامتحانات الشهرية | لوحة التحكم" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <Award className="w-8 h-8 text-indigo-500" />
            <span>إدارة الامتحانات الشهرية ومتابعة النتائج</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 font-medium">
            إنشاء وإدارة الامتحانات الشهرية المستقلة، مراجعة محاولات وتسليمات الطلاب، وإدارة فك حجب الإجابات ومكافحة الغش.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-xl shadow-indigo-600/25 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة امتحان شهري جديد</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-2">
          <div className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>إجمالي الامتحانات الشهرية</span>
          </div>
          <div className="text-2xl font-black text-white">{totalExamsCount}</div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-2">
          <div className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>الامتحانات المنشورة</span>
          </div>
          <div className="text-2xl font-black text-emerald-400">{totalPublishedCount}</div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-2">
          <div className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span>إجمالي الاشتراكات</span>
          </div>
          <div className="text-2xl font-black text-amber-400">{totalPurchasesCount}</div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-2">
          <div className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>إجمالي محاولات الطلاب</span>
          </div>
          <div className="text-2xl font-black text-indigo-400">{totalAttemptsCount}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="بحث باسم الامتحان أو المادة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        </div>

        <div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="all">جميع الشهور الدراسية</option>
            {MONTHS_LIST.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="all">جميع الصفوف الدراسية</option>
            {GRADES_LIST.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Exams Table */}
      {loading ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-3xl">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 mt-3 font-bold">جاري تحميل قائمة الامتحانات الشهرية...</p>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-3">
          <FileText className="w-12 h-12 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-300">لا توجد امتحانات شهرية مطابقة</h4>
          <p className="text-xs text-slate-500">انقر على زر "إضافة امتحان شهري جديد" لإنشاء أول امتحان شهري مستقل.</p>
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-bold">
                <tr>
                  <th className="p-4">عنوان الامتحان</th>
                  <th className="p-4">الشهر / المادة</th>
                  <th className="p-4">المعلم</th>
                  <th className="p-4">السعر</th>
                  <th className="p-4">الأسئلة / المدة</th>
                  <th className="p-4">المشتركون</th>
                  <th className="p-4 text-center">نتائج ومحاولات الطلاب</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-bold">
                      <div className="text-slate-100 font-black">{exam.title}</div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">{formatGradeName(exam.grade)}</div>
                    </td>
                    <td className="p-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20 text-[11px]">
                        {exam.month}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1 font-medium">{formatSubjectName(exam.subject)}</div>
                    </td>
                    <td className="p-4 text-slate-300 font-medium">
                      {exam.teacher?.name || '—'}
                    </td>
                    <td className="p-4 font-bold">
                      {exam.is_paid && parseFloat(String(exam.price)) > 0 ? (
                        <span className="text-amber-400 font-black">{exam.price} ج.م</span>
                      ) : (
                        <span className="text-emerald-400 font-bold">مجاني</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-bold">{exam.questions_count || 0} سؤال</div>
                      <div className="text-[10px] text-slate-400">{exam.time_limit_minutes} دقيقة</div>
                    </td>
                    <td className="p-4 font-bold text-slate-300">
                      {exam.purchases_count || 0} طالب
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => openAttemptsModal(exam)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-black text-xs transition-all shadow-sm cursor-pointer"
                        title="عرض نتائج ومحاولات الطلاب"
                      >
                        <Users className="w-4 h-4 text-indigo-400" />
                        <span>نتائج الطلاب ({exam.attempts_count || 0})</span>
                      </button>
                    </td>
                    <td className="p-4">
                      {exam.is_published ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[10px]">
                          منشور
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 font-bold text-[10px]">
                          مسودة
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openAttemptsModal(exam)}
                          title="عرض نتائج ومحاولات الطلاب"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600/20 text-indigo-400 transition-colors cursor-pointer"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(exam)}
                          title="تعديل الامتحان"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600/20 text-indigo-300 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(exam)}
                          title="حذف الامتحان"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/20 text-rose-400 transition-colors cursor-pointer"
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

      {/* =========================================================================
          ATTEMPTS LIST MODAL ("نتائج ومحاولات الطلاب")
          ========================================================================= */}
      <AnimatePresence>
        {attemptsModalOpen && selectedExamForAttempts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-5xl w-full shadow-2xl space-y-6 text-right my-8 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-5 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[11px] font-bold">
                      {selectedExamForAttempts.month}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatGradeName(selectedExamForAttempts.grade)} • {formatSubjectName(selectedExamForAttempts.subject)}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    <span>نتائج ومحاولات الطلاب: {selectedExamForAttempts.title}</span>
                  </h3>
                </div>

                <button
                  onClick={() => setAttemptsModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <div className="text-[11px] text-slate-400 font-bold">إجمالي المحاولات</div>
                  <div className="text-xl font-black text-white">{attemptsList.length}</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <div className="text-[11px] text-slate-400 font-bold">المحاولات الناجحة</div>
                  <div className="text-xl font-black text-emerald-400">
                    {attemptsList.filter(a => (a.score ?? 0) >= (a.passing_score ?? (selectedExamForAttempts.max_score * 0.5))).length}
                  </div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <div className="text-[11px] text-slate-400 font-bold">المحاولات الراسبة</div>
                  <div className="text-xl font-black text-amber-400">
                    {attemptsList.filter(a => a.status === 'graded' && (a.score ?? 0) < (a.passing_score ?? (selectedExamForAttempts.max_score * 0.5))).length}
                  </div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <div className="text-[11px] text-slate-400 font-bold">محظور لنظام المراقبة</div>
                  <div className="text-xl font-black text-rose-400">
                    {attemptsList.filter(a => a.is_terminated_for_cheating).length}
                  </div>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="بحث باسم الطالب أو الهاتف..."
                    value={attemptsSearch}
                    onChange={(e) => setAttemptsSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                </div>

                <div>
                  <select
                    value={attemptsStatusFilter}
                    onChange={(e) => setAttemptsStatusFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">جميع حالات التسليم</option>
                    <option value="graded">تسليمات مصححة نظامية</option>
                    <option value="terminated_for_cheating">محظور لمخالفة المراقبة ⚠️</option>
                    <option value="started">قيد الحل حالياً</option>
                  </select>
                </div>

                <div>
                  <select
                    value={attemptsVisibilityFilter}
                    onChange={(e) => setAttemptsVisibilityFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">جميع حالات الإجابات</option>
                    <option value="locked">الإجابات محجوبة 🔒</option>
                    <option value="unlocked">الإجابات مفتوحة للطالب 🔓</option>
                  </select>
                </div>
              </div>

              {/* Attempts Table */}
              <div className="overflow-y-auto flex-1 border border-slate-800 rounded-2xl">
                {loadingAttempts ? (
                  <div className="text-center py-16">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 mt-2 font-bold">جاري تحميل محاولات الطلاب...</p>
                  </div>
                ) : filteredAttempts.length === 0 ? (
                  <div className="text-center py-16 space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-400">لا توجد محاولات مسجلة مطابقة للفلاتر</p>
                  </div>
                ) : (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold sticky top-0">
                      <tr>
                        <th className="p-3.5">الطالب</th>
                        <th className="p-3.5">حالة المحاولة</th>
                        <th className="p-3.5">الدرجة</th>
                        <th className="p-3.5">تاريخ التسليم</th>
                        <th className="p-3.5">المراقبة والمخالفات</th>
                        <th className="p-3.5">نموذج الإجابات</th>
                        <th className="p-3.5 text-center">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {filteredAttempts.map((att) => {
                        const isCheater = att.is_terminated_for_cheating || att.status === 'terminated_for_cheating'
                        const isPassed = !isCheater && (att.score ?? 0) >= (att.passing_score ?? (selectedExamForAttempts.max_score * 0.5))

                        return (
                          <tr key={att.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-3.5 font-bold">
                              <div className="text-white font-black">{att.student?.name || 'طالب غير معروف'}</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                {att.student?.phone ? `هاتف: ${att.student.phone}` : att.student?.email}
                              </div>
                            </td>
                            <td className="p-3.5">
                              {isCheater ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20">
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>مخالفة مراقبة</span>
                                </span>
                              ) : att.status === 'graded' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>تم التصحيح</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                                  <Clock className="w-3 h-3" />
                                  <span>قيد الحل</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 font-bold">
                              <div className={`font-black text-sm ${
                                isCheater ? 'text-rose-400' : isPassed ? 'text-emerald-400' : 'text-amber-400'
                              }`}>
                                {att.score ?? 0} / {selectedExamForAttempts.max_score}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {att.percentage ?? 0}%
                              </div>
                            </td>
                            <td className="p-3.5 text-slate-300">
                              <div>{att.submitted_at ? new Date(att.submitted_at).toLocaleDateString('ar-EG') : '—'}</div>
                              <div className="text-[10px] text-slate-400">
                                {att.submitted_at ? new Date(att.submitted_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </div>
                            </td>
                            <td className="p-3.5">
                              {isCheater ? (
                                <div className="text-rose-400 font-bold text-[11px] flex items-center gap-1">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  <span>حرمان ({att.cheat_violations_count || att.violation_count || 0} مخالفات)</span>
                                </div>
                              ) : (att.violation_count ?? 0) > 0 ? (
                                <span className="text-amber-400 font-bold text-[11px]">
                                  {att.violation_count} مخالفة مسجلة
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">نظامية</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              {att.can_view_answers ? (
                                <div className="flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>مفتوحة للطالب</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-rose-400 font-bold text-[11px]">
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>محجوبة 🔒</span>
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                onClick={() => openAttemptReview(att.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold transition-all cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>عرض المحاولة</span>
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Close Button */}
              <div className="pt-2 flex justify-end shrink-0">
                <button
                  onClick={() => setAttemptsModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          ATTEMPT REVIEW MODAL ("مراجعة تفاصيل المحاولة وإلغاء القفل")
          ========================================================================= */}
      <AnimatePresence>
        {reviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-4xl w-full shadow-2xl space-y-6 text-right my-8 max-h-[92vh] flex flex-col"
            >
              {/* Review Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-bold text-indigo-400">مراجعة تسليم الطالب:</span>
                    <span className="text-white font-bold">{reviewData?.student?.name}</span>
                    {reviewData?.student?.phone && (
                      <span className="text-slate-400">({reviewData.student.phone})</span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {reviewData?.exam?.title || 'تقرير مراجعة الامتحان'}
                  </h3>
                </div>

                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingReview ? (
                <div className="text-center py-24 space-y-3">
                  <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 font-bold">جاري تحميل الأسئلة وإجابات الطالب...</p>
                </div>
              ) : !reviewData ? (
                <div className="text-center py-16 space-y-2">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-300">تعذر تحميل بيانات المراجعة لهذه المحاولة.</p>
                </div>
              ) : (
                <div className="overflow-y-auto space-y-6 flex-1 pr-1">
                  
                  {/* Summary Score Card */}
                  <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                    reviewData.attempt.is_terminated_for_cheating
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : reviewData.attempt.percentage >= 50
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-amber-500/10 border-amber-500/30'
                  }`}>
                    <div className="space-y-1.5 text-center sm:text-right">
                      <div className="text-xs font-bold text-slate-300 flex flex-wrap items-center gap-2">
                        <span>المحاولة رقم: #{reviewData.attempt.id}</span>
                        <span>•</span>
                        <span>تاريخ التسليم: {reviewData.attempt.submitted_at ? new Date(reviewData.attempt.submitted_at).toLocaleString('ar-EG') : '—'}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-200">
                        حالة المحاولة: <span className="font-black text-white">
                          {reviewData.attempt.is_terminated_for_cheating
                            ? 'ملغاة بواسطة نظام المراقبة الذكي (حرمان من النتيجة)'
                            : reviewData.attempt.status === 'graded'
                            ? 'تم التصحيح واحتساب الدرجة'
                            : 'قيد الحل / غير مكتملة'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      <div className="text-center">
                        <div className={`text-2xl font-black ${
                          reviewData.attempt.is_terminated_for_cheating
                            ? 'text-rose-400'
                            : reviewData.attempt.percentage >= 50
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}>
                          {reviewData.attempt.score ?? 0} / {reviewData.exam.max_score}
                        </div>
                        <div className="text-[11px] font-bold text-slate-400">
                          النسبة: {reviewData.attempt.percentage}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Anti-Cheat Banner & Violations (if terminated) */}
                  {reviewData.attempt.is_terminated_for_cheating && (
                    <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-black text-xs text-rose-300">
                          <ShieldAlert className="w-5 h-5 text-rose-400" />
                          <span>إنهاء المحاولة لمخالفة قواعد المراقبة ({reviewData.attempt.cheat_violations_count} مخالفات)</span>
                        </div>
                        {reviewData.violations.length > 0 && (
                          <button
                            onClick={() => setShowViolationsTimeline(!showViolationsTimeline)}
                            className="text-[11px] text-rose-300 underline font-bold hover:text-white"
                          >
                            {showViolationsTimeline ? 'إخفاء سجل المخالفات' : 'عرض سجل المخالفات'}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed text-rose-200">
                        تم إنهاء هذه المحاولة تلقائياً وحرمان الطالب من درجات الامتحان بسبب رصد تكرار مخالفات قواعد النزاهة والمراقبة (السبب: {reviewData.attempt.submission_reason || 'تجاوز حد المخالفات'}).
                      </p>

                      {showViolationsTimeline && reviewData.violations.length > 0 && (
                        <div className="pt-2 border-t border-rose-500/20 space-y-1.5 text-[10px]">
                          {reviewData.violations.map((v, vIdx) => (
                            <div key={v.id || vIdx} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                              <span>مخالفة: <span className="font-bold text-rose-400">{v.violation_type}</span></span>
                              <span>الوقت المتبقي: {v.time_remaining_seconds} ثانية</span>
                              <span>التاريخ: {v.created_at ? new Date(v.created_at).toLocaleTimeString('ar-EG') : '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* =========================================================================
                      ANSWER VISIBILITY & UNLOCK ACTION BOX (CRITICAL SECTION 5)
                      ========================================================================= */}
                  <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-black text-white flex items-center gap-2">
                          {reviewData.attempt.can_student_view_answers ? (
                            <Unlock className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-rose-400" />
                          )}
                          <span>حالة عرض الإجابات النموذجية للطالب:</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                            reviewData.attempt.can_student_view_answers
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}>
                            {reviewData.attempt.can_student_view_answers
                              ? 'مفتوحة ومتاحة للطالب 🔓'
                              : 'محجوبة عن الطالب 🔒'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {reviewData.attempt.can_student_view_answers
                            ? 'يستطيع الطالب حالياً الدخول إلى صفحة النتيجة ورؤية الإجابات الصحيحة والتوضيحات النموذجية.'
                            : 'الإجابات النموذجية والتوضيحات مخفية ومحجوبة تماماً عن الطالب داخل صفحة نتائجه.'}
                        </p>
                        {reviewData.attempt.answers_unlocked_at && (
                          <div className="text-[10px] text-indigo-400 font-bold pt-0.5">
                            تم الفتح بواسطة: {reviewData.attempt.unlocked_by?.name || 'المعلم / المشرف'} • بتاريخ: {new Date(reviewData.attempt.answers_unlocked_at).toLocaleString('ar-EG')}
                          </div>
                        )}
                      </div>

                      {/* Unlock Action Button */}
                      {!reviewData.attempt.can_student_view_answers ? (
                        <button
                          disabled={unlocking}
                          onClick={() => handleUnlockAnswers(reviewData.attempt.id)}
                          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black shadow-lg shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
                        >
                          {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                          <span>إظهار الإجابات الصحيحة للطالب</span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تم فتح الإجابات للمراجعة</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* =========================================================================
                      QUESTIONS REVIEW SECTION (CRITICAL SECTION 4 & 8)
                      ========================================================================= */}
                  <div className="space-y-4 pt-2">
                    <h4 className="font-black text-sm text-slate-200 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-400" />
                      <span>مراجعة الأسئلة وتفاصيل إجابات الطالب ({reviewData.questions.length} سؤال):</span>
                    </h4>

                    <div className="space-y-4">
                      {reviewData.questions.map((q, idx) => {
                        return (
                          <div
                            key={q.id}
                            className={`p-5 rounded-2xl border bg-slate-950/40 space-y-3.5 transition-colors ${
                              q.is_correct
                                ? 'border-emerald-500/30 bg-emerald-950/5'
                                : q.is_answered
                                ? 'border-rose-500/30 bg-rose-950/5'
                                : 'border-slate-800'
                            }`}
                          >
                            {/* Question Header */}
                            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-white">سؤال {idx + 1}</span>
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">
                                  {q.type === 'mcq' ? 'اختيار من متعدد' : q.type === 'true_false' ? 'صواب وخطأ' : 'سؤال مقالي'}
                                </span>
                                {q.is_correct ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-black border border-emerald-500/25">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>إجابة صحيحة</span>
                                  </span>
                                ) : q.is_answered ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-black border border-rose-500/25">
                                    <XCircle className="w-3 h-3" />
                                    <span>إجابة خاطئة</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-black border border-amber-500/25">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>لم تتم الإجابة</span>
                                  </span>
                                )}
                              </div>

                              <div className="text-xs font-black text-indigo-400">
                                الدرجة: {q.score_awarded} / {q.score}
                              </div>
                            </div>

                            {/* Question Text */}
                            <div className="text-xs sm:text-sm font-bold text-slate-100 leading-relaxed">
                              {q.text}
                            </div>

                            {/* Choices (for MCQ) */}
                            {q.type === 'mcq' && q.options && Array.isArray(q.options) && (
                              <div className="grid grid-cols-1 gap-2 pt-1">
                                {q.options.map((opt, optIdx) => {
                                  const isStudentChoice = q.student_answer === opt
                                  const isCorrectChoice = q.correct_answer === opt

                                  let cardStyle = 'bg-slate-900/60 border-slate-800 text-slate-300'
                                  if (isCorrectChoice) {
                                    cardStyle = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-bold'
                                  } else if (isStudentChoice && !q.is_correct) {
                                    cardStyle = 'bg-rose-500/15 border-rose-500/50 text-rose-200 font-bold line-through'
                                  }

                                  return (
                                    <div key={optIdx} className={`p-3 rounded-xl border text-xs flex items-center justify-between ${cardStyle}`}>
                                      <span>{opt}</span>
                                      <div className="flex items-center gap-1.5">
                                        {isCorrectChoice && (
                                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                                            الإجابة الصحيحة النموذجية
                                          </span>
                                        )}
                                        {isStudentChoice && (
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                            isCorrectChoice ? 'bg-emerald-500/30 text-emerald-200' : 'bg-rose-500/30 text-rose-200'
                                          }`}>
                                            إجابة الطالب
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* True / False display */}
                            {q.type === 'true_false' && (
                              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-wrap gap-4 text-xs">
                                <div>
                                  <span className="text-slate-400">إجابة الطالب: </span>
                                  <span className={`font-black ${
                                    q.is_correct ? 'text-emerald-400' : 'text-rose-400'
                                  }`}>
                                    {q.student_answer || 'لم تتم الإجابة'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400">الإجابة النموذجية: </span>
                                  <span className="font-black text-emerald-400">{q.correct_answer}</span>
                                </div>
                              </div>
                            )}

                            {/* Essay Question display */}
                            {q.type === 'essay' && (
                              <div className="space-y-2 text-xs">
                                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                  <div className="text-slate-400 font-bold mb-1">إجابة الطالب المكتوبة:</div>
                                  <div className="text-slate-200">{q.student_answer || 'لم تتم كتابة إجابة.'}</div>
                                </div>
                                {q.correct_answer && (
                                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-300">
                                    <span className="font-bold">الإجابة الإرشادية / النموذج: </span>
                                    <span>{q.correct_answer}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Model Explanation */}
                            {q.explanation && (
                              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                                <span className="font-bold">شرح وتوضيح الإجابة: </span>
                                <span>{q.explanation}</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                </div>
              )}

              {/* Review Footer */}
              <div className="pt-3 border-t border-slate-800 flex justify-end shrink-0">
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  إغلاق المراجعة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          CREATE / EDIT MODAL (Fallback inline)
          ========================================================================= */}
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
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">عنوان الامتحان</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: امتحان فيزياء شهر أكتوبر الشامل"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">الوصف (اختياري)</label>
                  <textarea
                    rows={2}
                    placeholder="وصف محتوى الامتحان..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

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
