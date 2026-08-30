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
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <SEO 
        title="الامتحانات الشهرية الشاملة | منصة خطوتك التعليمية"
        description="اختبر مستواك الدراسي مع الامتحانات الشهرية التفاعلية بنظام التقييم الفوري ونظام منع الغش الذكي."
      />

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900/80 to-purple-900/30 border border-indigo-500/20 p-8 sm:p-12 backdrop-blur-xl shadow-2xl">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 text-center md:text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>التقييمات والاختبارات الشهرية المعتمدة</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                الامتحانات الشهرية الشاملة
              </h1>
              <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
                امتحانات شهرية مستقلة تحاكي مواصفات الامتحانات الرسمية، مع تصحيح ذكي فوري، وتحليل أداء تفصيلي لكل مادة.
              </p>
            </div>

            {/* Student Wallet Quick Card */}
            {isLoggedIn && user?.role === 'student' && (
              <div className="shrink-0 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">رصيد محفظتك الحالي</div>
                  <div className="text-xl font-black text-emerald-400">
                    {userWalletBalance !== null ? `${userWalletBalance.toFixed(2)} ج.م` : 'جاري التحميل...'}
                  </div>
                </div>
                <Link
                  to="/student/wallet"
                  className="mr-2 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold border border-indigo-500/30 transition-colors"
                >
                  شحن المحفظة
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث باسم الامتحان أو المعلم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            </div>

            {/* Month Filter */}
            <div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {MONTHS_LIST.map((m) => (
                  <option key={m} value={m} className="bg-slate-900">{m}</option>
                ))}
              </select>
            </div>

            {/* Grade Filter */}
            <div>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {GRADES_LIST.map((g) => (
                  <option key={g.value} value={g.value} className="bg-slate-900">{g.label}</option>
                ))}
              </select>
            </div>

            {/* Subject Filter */}
            <div>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="all" className="bg-slate-900">جميع المواد الدراسية</option>
                {availableSubjects.filter(s => s !== 'all').map((s) => (
                  <option key={s} value={s} className="bg-slate-900">{s}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Exams Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-72 rounded-2xl bg-slate-900/40 border border-slate-800/60 animate-pulse p-6 space-y-4">
                <div className="h-6 bg-slate-800 rounded-md w-3/4" />
                <div className="h-4 bg-slate-800/60 rounded-md w-1/2" />
                <div className="h-20 bg-slate-800/30 rounded-xl" />
                <div className="h-10 bg-slate-800 rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/30 border border-slate-800 rounded-3xl p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">لا توجد امتحانات شهرية مطابقة</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
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
                  className="flex flex-col justify-between bg-slate-900/70 hover:bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-6 transition-all duration-300 shadow-xl group relative overflow-hidden"
                >
                  {/* Subtle Glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none" />

                  {/* Top Badges */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
                        <Calendar className="w-3.5 h-3.5" />
                        {exam.month}
                      </span>

                      {isFree ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black">
                          مجاني
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black">
                          {priceNum} ج.م
                        </span>
                      )}
                    </div>

                    {/* Title & Subject */}
                    <div>
                      <div className="text-xs text-indigo-400 font-semibold mb-1">
                        {exam.subject} • {exam.grade}
                      </div>
                      <h3 className="text-lg font-black text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {exam.title}
                      </h3>
                      {exam.description && (
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                          {exam.description}
                        </p>
                      )}
                    </div>

                    {/* Teacher Info */}
                    {exam.teacher && (
                      <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 overflow-hidden">
                          {exam.teacher.avatar ? (
                            <img src={exam.teacher.avatar} alt={exam.teacher.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-300">
                          {exam.teacher.name}
                        </span>
                      </div>
                    )}

                    {/* Exam Specs Badges */}
                    <div className="grid grid-cols-3 gap-2 py-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium">المدة</div>
                        <div className="text-xs font-bold text-slate-200 mt-0.5">{exam.time_limit_minutes} دقيقة</div>
                      </div>
                      <div className="border-r border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-medium">الأسئلة</div>
                        <div className="text-xs font-bold text-slate-200 mt-0.5">{exam.questions_count} سؤال</div>
                      </div>
                      <div className="border-r border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-medium">الدرجة</div>
                        <div className="text-xs font-bold text-indigo-400 mt-0.5">{exam.max_score} درجة</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-5 pt-3">
                    {isTerminated ? (
                      <button
                        onClick={() => navigate(`/monthly-exams/${exam.id}/results`)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>تم إنهاء المحاولة (مخالفة) - عرض التقرير</span>
                      </button>
                    ) : attempt && attempt.status === 'started' ? (
                      <button
                        onClick={() => handleExamAction(exam)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>استكمال الامتحان الجاري</span>
                      </button>
                    ) : attempt && (attempt.status === 'submitted' || attempt.status === 'graded') ? (
                      <button
                        onClick={() => navigate(`/monthly-exams/${exam.id}/results`)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all"
                      >
                        <Eye className="w-4 h-4 text-indigo-400" />
                        <span>عرض النتيجة والتقرير ({attempt.score ?? 0} / {exam.max_score})</span>
                      </button>
                    ) : isPurchased || isFree ? (
                      <button
                        onClick={() => handleExamAction(exam)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>بدء الامتحان الآن</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleExamAction(exam)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-right"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-lg font-black text-white">تأكيد شراء امتحان شهري</h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                  {purchasingExam.month}
                </span>
              </div>

              <div className="space-y-3">
                <h4 className="text-base font-bold text-indigo-300">{purchasingExam.title}</h4>
                <div className="text-xs text-slate-400">
                  المادة: <span className="text-slate-200">{purchasingExam.subject}</span> • الصف: <span className="text-slate-200">{purchasingExam.grade}</span>
                </div>
                {purchasingExam.teacher && (
                  <div className="text-xs text-slate-400">
                    المعلم: <span className="text-slate-200">{purchasingExam.teacher.name}</span>
                  </div>
                )}
              </div>

              {/* Price Details */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>سعر الامتحان الشهري:</span>
                  <span className="text-slate-200 font-bold text-sm">{purchasingExam.price} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>رصيد محفظتك الحالي:</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {userWalletBalance !== null ? `${userWalletBalance.toFixed(2)} ج.م` : '...'}
                  </span>
                </div>
                {userWalletBalance !== null && userWalletBalance < parseFloat(String(purchasingExam.price)) && (
                  <div className="pt-2 text-rose-400 text-[11px] font-semibold flex items-center gap-1.5 border-t border-slate-800">
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
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
                  >
                    الانتقال لشحن المحفظة
                  </button>
                ) : (
                  <button
                    disabled={isPurchasing}
                    onClick={confirmPurchase}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    {isPurchasing && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>تأكيد الشراء والخصم من المحفظة</span>
                  </button>
                )}
                <button
                  disabled={isPurchasing}
                  onClick={() => setPurchasingExam(null)}
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
