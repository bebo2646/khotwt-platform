import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  Clock, 
  Award, 
  HelpCircle, 
  User, 
  CheckCircle, 
  AlertCircle, 
  ChevronLeft, 
  Calendar, 
  Filter, 
  Search, 
  Sparkles, 
  Wallet, 
  Lock, 
  Play, 
  Eye, 
  BookOpen, 
  ShieldAlert,
  Loader2
} from 'lucide-react'
import API from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useModalStore } from '../store/modalStore'
import SEO from '../components/SEO'
import { formatGradeName, formatSubjectName } from '../utils/formatters'

interface MonthlyExam {
  id: number
  title: string
  description?: string
  month: string
  stage?: string
  grade: string
  subject: string
  time_limit_minutes: number
  max_score: number
  price: number | string
  is_paid: boolean
  is_published: boolean
  is_active: boolean
  questions_count: number
  teacher?: {
    id: number
    name: string
    avatar?: string
    subject?: string
    bio?: string
  }
  is_purchased?: boolean
  attempts_count?: number
  availability?: {
    is_available: boolean
    status: string
    error_code?: string
    message: string
    formatted_dates?: string | null
    starts_at?: string | null
    ends_at?: string | null
  }
  latest_attempt?: {
    id: number
    status: string
    score: number | null
    submitted_at: string | null
    is_terminated_for_cheating?: boolean
  } | null
}

const MONTHS_LIST = [
  'جميع الشهور',
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
  { value: 'all', label: 'جميع الصفوف' },
  { value: 'first_secondary', label: 'الصف الأول الثانوي' },
  { value: 'second_secondary', label: 'الصف الثاني الثانوي' },
  { value: 'third_secondary', label: 'الصف الثالث الثانوي' },
  { value: 'third_prep', label: 'الصف الثالث الإعدادي' },
  { value: 'second_prep', label: 'الصف الثاني الإعدادي' },
  { value: 'first_prep', label: 'الصف الأول الإعدادي' },
]

export default function MonthlyExams() {
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuthStore()
  const { showToast } = useModalStore()

  const [exams, setExams] = useState<MonthlyExam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('جميع الشهور')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [selectedSubject, setSelectedSubject] = useState('all')

  // Purchase Modal State
  const [purchasingExam, setPurchasingExam] = useState<MonthlyExam | null>(null)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [userWalletBalance, setUserWalletBalance] = useState<number | null>(null)

  const fetchExams = async () => {
    setLoading(true)
    try {
      const res = await API.get('/monthly-exams')
      setExams(Array.isArray(res.data) ? res.data : [])
    } catch (err: any) {
      console.error('Failed to load monthly exams:', err)
      showToast('تعذر تحميل الامتحانات الشهرية حالياً.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchWallet = async () => {
    if (isLoggedIn && user?.role === 'student') {
      try {
        const res = await API.get('/student/wallet')
        const bal = res.data?.balance ?? res.data?.wallet?.balance ?? 0
        setUserWalletBalance(parseFloat(bal))
      } catch (err) {
        console.error('Failed to fetch wallet balance:', err)
      }
    }
  }

  useEffect(() => {
    fetchExams()
    fetchWallet()
  }, [isLoggedIn])

  // Extract unique subjects from loaded exams
  const availableSubjects = ['all', ...Array.from(new Set(exams.map(e => e.subject).filter(Boolean)))]

  // Filtered Exams
  const filteredExams = exams.filter((exam) => {
    const matchesSearch = 
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exam.description && exam.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (exam.teacher && exam.teacher.name.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesMonth = selectedMonth === 'جميع الشهور' || exam.month === selectedMonth
    const matchesGrade = selectedGrade === 'all' || exam.grade === selectedGrade
    const matchesSubject = selectedSubject === 'all' || exam.subject === selectedSubject

    return matchesSearch && matchesMonth && matchesGrade && matchesSubject
  })

  // Handle Exam Action (Start / Resume / Results / Purchase)
  const handleExamAction = (exam: MonthlyExam) => {
    if (!isLoggedIn) {
      showToast('يرجى تسجيل الدخول أولاً للوصول إلى الامتحان.', 'info')
      navigate('/login')
      return
    }

    if (user?.role !== 'student') {
      showToast('الامتحانات الشهرية مخصصة لحسابات الطلاب.', 'info')
      return
    }

    // If not purchased and paid -> open purchase modal
    if (!exam.is_purchased && exam.is_paid && parseFloat(String(exam.price)) > 0) {
      setPurchasingExam(exam)
      fetchWallet()
      return
    }

    // If purchased / free
    if (exam.latest_attempt) {
      if (exam.latest_attempt.status === 'started') {
        navigate(`/monthly-exams/${exam.id}/player`)
      } else {
        navigate(`/monthly-exams/${exam.id}/results`)
      }
    } else {
      if (exam.availability && !exam.availability.is_available) {
        useModalStore.getState().showAlert({
          title: exam.availability.status === 'not_started' ? 'الامتحان غير متاح بعد' : 'انتهت فترة إتاحة الامتحان',
          description: `${exam.availability.message}${exam.availability.formatted_dates ? `\nفترة الإتاحة: ${exam.availability.formatted_dates}` : ''}`,
          type: exam.availability.status === 'not_started' ? 'warning' : 'error',
          buttonText: 'حسناً'
        })
        return
      }
      navigate(`/monthly-exams/${exam.id}/player`)
    }
  }

  // Execute Purchase
  const confirmPurchase = async () => {
    if (!purchasingExam) return
    setIsPurchasing(true)
    try {
      const res = await API.post(`/monthly-exams/${purchasingExam.id}/purchase`)
      showToast(res.data?.message || 'تم شراء الامتحان بنجاح!', 'success')
      setPurchasingExam(null)
      fetchExams()
      fetchWallet()
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'فشلت عملية الشراء.'
      showToast(msg, 'error')
    } finally {
      setIsPurchasing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8 text-right" dir="rtl">
      <SEO 
        title="الامتحانات الشهرية الشاملة | منصة خطوتك التعليمية"
        description="اختبر مستواك الدراسي مع الامتحانات الشهرية التفاعلية بنظام التقييم الفوري ونظام منع الغش الذكي."
      />

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-primary/10 via-[var(--surface-bg)] to-brand-secondary/10 border border-[var(--border-color)] p-8 sm:p-12 backdrop-blur-xl shadow-lg">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 text-center md:text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-black">
                <Sparkles className="w-3.5 h-3.5" />
                <span>التقييمات والاختبارات الشهرية المعتمدة</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
                الامتحانات الشهرية الشاملة
              </h1>
              <p className="text-[var(--text-secondary)] text-sm sm:text-base max-w-2xl leading-relaxed font-medium">
                امتحانات شهرية مستقلة تحاكي مواصفات الامتحانات الرسمية، مع تصحيح ذكي فوري، وتحليل أداء تفصيلي لكل مادة.
              </p>
            </div>

            {/* Student Wallet Quick Card */}
            {isLoggedIn && user?.role === 'student' && (
              <div className="shrink-0 bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] font-medium">رصيد محفظتك الحالي</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {userWalletBalance !== null ? `${userWalletBalance.toFixed(2)} ج.م` : 'جاري التحميل...'}
                  </div>
                </div>
                <Link
                  to="/student/wallet"
                  className="mr-2 px-3.5 py-1.5 rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-bold border border-brand-primary/30 transition-colors"
                >
                  شحن المحفظة
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث باسم الامتحان أو المعلم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl pr-10 pl-4 py-2.5 text-sm text-[var(--input-text)] placeholder-[var(--placeholder-color)] focus:outline-none focus:border-brand-primary transition-colors"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            </div>

            {/* Month Filter */}
            <div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--input-text)] focus:outline-none focus:border-brand-primary transition-colors cursor-pointer"
              >
                {MONTHS_LIST.map((m) => (
                  <option key={m} value={m} className="bg-[var(--surface-bg)] text-foreground">{m}</option>
                ))}
              </select>
            </div>

            {/* Grade Filter */}
            <div>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--input-text)] focus:outline-none focus:border-brand-primary transition-colors cursor-pointer"
              >
                {GRADES_LIST.map((g) => (
                  <option key={g.value} value={g.value} className="bg-[var(--surface-bg)] text-foreground">{g.label}</option>
                ))}
              </select>
            </div>

            {/* Subject Filter */}
            <div>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--input-text)] focus:outline-none focus:border-brand-primary transition-colors cursor-pointer"
              >
                <option value="all" className="bg-[var(--surface-bg)] text-foreground">جميع المواد الدراسية</option>
                {availableSubjects.filter(s => s !== 'all').map((s) => (
                  <option key={s} value={s} className="bg-[var(--surface-bg)] text-foreground">{formatSubjectName(s)}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Exams Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-72 rounded-2xl bg-[var(--surface-bg)] border border-[var(--border-color)] animate-pulse p-6 space-y-4">
                <div className="h-6 bg-[var(--border-color)] rounded-md w-3/4" />
                <div className="h-4 bg-[var(--border-color)]/70 rounded-md w-1/2" />
                <div className="h-20 bg-[var(--border-color)]/40 rounded-xl" />
                <div className="h-10 bg-[var(--border-color)]/60 rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="text-center py-16 bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-3xl p-8 space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-foreground">لا توجد امتحانات شهرية مطابقة</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              لم نتمكن من العثور على امتحانات شهرية تطابق معايير البحث المحددة. جرب تغيير الفلاتر.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam) => {
              const isPurchased = !!exam.is_purchased
              const priceNum = parseFloat(String(exam.price))
              const isFree = !exam.is_paid || priceNum <= 0

              const attempt = exam.latest_attempt
              const isTerminated = attempt?.is_terminated_for_cheating

              return (
                <motion.div
                  key={exam.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col justify-between bg-[var(--surface-bg)] hover:bg-[var(--surface-bg)] border border-[var(--border-color)] hover:border-brand-primary/40 rounded-2xl p-6 transition-all duration-300 shadow-sm hover:shadow-md group relative overflow-hidden"
                >
                  {/* Subtle Glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-2xl group-hover:bg-brand-primary/10 transition-colors pointer-events-none" />

                  {/* Top Badges */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-black">
                        <Calendar className="w-3.5 h-3.5" />
                        {exam.month}
                      </span>

                      {isFree ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                          مجاني
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black">
                          {priceNum} ج.م
                        </span>
                      )}
                    </div>

                    {/* Title & Subject */}
                    <div>
                      <div className="text-xs text-brand-primary font-bold mb-1 flex items-center gap-1.5" dir="rtl">
                        <span>{formatGradeName(exam.grade)}</span>
                        <span className="text-[var(--text-muted)]">•</span>
                        <span>{formatSubjectName(exam.subject)}</span>
                      </div>
                      <h3 className="text-lg font-black text-foreground group-hover:text-brand-primary transition-colors line-clamp-2">
                        {exam.title}
                      </h3>
                      {exam.description && (
                        <p className="text-xs text-[var(--text-secondary)] mt-2 line-clamp-2 leading-relaxed font-normal">
                          {exam.description}
                        </p>
                      )}
                    </div>

                    {/* Teacher Info */}
                    {exam.teacher && (
                      <div className="flex items-center gap-3 pt-2 border-t border-[var(--border-color)]">
                        <div className="w-8 h-8 rounded-full bg-[var(--bg-color)] border border-[var(--border-color)] flex items-center justify-center text-xs font-bold text-[var(--text-secondary)] overflow-hidden">
                          {exam.teacher.avatar ? (
                            <img src={exam.teacher.avatar} alt={exam.teacher.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-[var(--text-muted)]" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          {exam.teacher.name}
                        </span>
                      </div>
                    )}

                    {/* Exam Specs Badges */}
                    <div className="grid grid-cols-3 gap-2 py-3 bg-[var(--bg-color)]/60 rounded-xl border border-[var(--border-color)] text-center">
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)] font-bold">المدة</div>
                        <div className="text-xs font-black text-foreground mt-0.5">{exam.time_limit_minutes} دقيقة</div>
                      </div>
                      <div className="border-r border-[var(--border-color)]">
                        <div className="text-[10px] text-[var(--text-muted)] font-bold">الأسئلة</div>
                        <div className="text-xs font-black text-foreground mt-0.5">{exam.questions_count} سؤال</div>
                      </div>
                      <div className="border-r border-[var(--border-color)]">
                        <div className="text-[10px] text-[var(--text-muted)] font-bold">الدرجة</div>
                        <div className="text-xs font-black text-brand-primary mt-0.5">{exam.max_score} درجة</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-5 pt-3">
                    {isTerminated ? (
                      <button
                        onClick={() => navigate(`/monthly-exams/${exam.id}/results`)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>تم إنهاء المحاولة (مخالفة) - عرض التقرير</span>
                      </button>
                    ) : attempt && attempt.status === 'started' ? (
                      <button
                        onClick={() => handleExamAction(exam)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>استكمال الامتحان الجاري</span>
                      </button>
                    ) : attempt && (attempt.status === 'submitted' || attempt.status === 'graded') ? (
                      <button
                        onClick={() => navigate(`/monthly-exams/${exam.id}/results`)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--surface-bg)] hover:bg-[var(--border-color)]/30 text-foreground border border-[var(--border-color)] text-xs font-bold transition-all cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-brand-primary" />
                        <span>عرض النتيجة والتقرير ({attempt.score ?? 0} / {exam.max_score})</span>
                      </button>
                    ) : (isPurchased || isFree) && exam.availability && !exam.availability.is_available ? (
                      <button
                        onClick={() => handleExamAction(exam)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          exam.availability.status === 'not_started'
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/30'
                            : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/30'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>{exam.availability.status === 'not_started' ? 'الامتحان غير متاح بعد ⏱️' : 'انتهت فترة إتاحة الامتحان ⏱️'}</span>
                      </button>
                    ) : isPurchased || isFree ? (
                      <button
                        onClick={() => handleExamAction(exam)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold shadow-lg shadow-brand-primary/20 transition-all cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>بدء الامتحان الآن</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleExamAction(exam)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <Lock className="w-4 h-4" />
                        <span>شراء الامتحان ({priceNum} ج.م)</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

      </div>

      {/* Purchase Modal */}
      <AnimatePresence>
        {purchasingExam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-right"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                <h3 className="text-lg font-black text-foreground">تأكيد شراء امتحان شهري</h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary font-bold border border-brand-primary/20">
                  {purchasingExam.month}
                </span>
              </div>

              <div className="space-y-3">
                <h4 className="text-base font-black text-brand-primary">{purchasingExam.title}</h4>
                <div className="text-xs text-[var(--text-secondary)]">
                  المادة: <span className="text-foreground font-bold">{formatSubjectName(purchasingExam.subject)}</span> • الصف: <span className="text-foreground font-bold">{formatGradeName(purchasingExam.grade)}</span>
                </div>
                {purchasingExam.teacher && (
                  <div className="text-xs text-[var(--text-secondary)]">
                    المعلم: <span className="text-foreground font-bold">{purchasingExam.teacher.name}</span>
                  </div>
                )}
              </div>

              {/* Price Details */}
              <div className="bg-[var(--bg-color)]/80 border border-[var(--border-color)] rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center text-[var(--text-secondary)]">
                  <span>سعر الامتحان الشهري:</span>
                  <span className="text-foreground font-black text-sm">{purchasingExam.price} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-[var(--text-secondary)]">
                  <span>رصيد محفظتك الحالي:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                    {userWalletBalance !== null ? `${userWalletBalance.toFixed(2)} ج.م` : '...'}
                  </span>
                </div>
                {userWalletBalance !== null && userWalletBalance < parseFloat(String(purchasingExam.price)) && (
                  <div className="pt-2 text-rose-500 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-1.5 border-t border-[var(--border-color)]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>رصيدك غير كافٍ لإتمام الشراء. يرجى شحن المحفظة.</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                {userWalletBalance !== null && userWalletBalance < parseFloat(String(purchasingExam.price)) ? (
                  <button
                    onClick={() => {
                      setPurchasingExam(null)
                      navigate('/student/wallet')
                    }}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    الانتقال لشحن المحفظة
                  </button>
                ) : (
                  <button
                    disabled={isPurchasing}
                    onClick={confirmPurchase}
                    className="flex-1 py-3 rounded-xl bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-brand-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isPurchasing && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>تأكيد الشراء والخصم من المحفظة</span>
                  </button>
                )}
                <button
                  disabled={isPurchasing}
                  onClick={() => setPurchasingExam(null)}
                  className="px-5 py-3 rounded-xl bg-[var(--surface-bg)] hover:bg-[var(--border-color)]/30 text-[var(--text-secondary)] hover:text-foreground font-bold text-xs border border-[var(--border-color)] transition-colors cursor-pointer"
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
