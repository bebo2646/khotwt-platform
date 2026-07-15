import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkExamAvailability } from '../../utils/exam'
import { motion, AnimatePresence } from 'framer-motion'
import API from '../../services/api'
import { formatWatchedTimeArabic } from '../../utils/video'
import { 
  BookOpen, 
  Wallet, 
  User as UserIcon, 
  Sparkles, 
  Search, 
  GraduationCap,
  Play,
  ArrowLeft,
  ChevronRight,
  BookOpenCheck,
  Video,
  Clock,
  Award,
  Percent,
  TrendingUp,
  Bookmark,
  Zap,
  CheckCircle2,
  Calendar,
  ChevronLeft
} from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import CourseCard from '../../components/ui/CourseCard'
import TeacherCard from '../../components/ui/TeacherCard'
import { useAuthStore } from '../../store/authStore'
import { DashboardSkeleton } from '../../components/ui/Skeleton'

interface CourseProgress {
  id: number
  title: string
  cover_image: string
  subject: string
  grade: string
  teacher: {
    name: string
    avatar?: string
  }
  progress_percentage: number
  watched_seconds?: number
  total_duration_seconds?: number
  description?: string
  purchase_type?: string
  package_id?: number | null
  lesson_id?: number | null
}

interface DashboardData {
  wallet_balance: string
  courses: CourseProgress[]
  last_watched?: Array<{
    course_id: number
    course_title: string
    course_cover?: string | null
    video_id: number
    video_title: string
    watched_seconds: number
    duration_seconds: number
    progress_percentage: number
    lesson_id: number
    package_id?: number | null
    purchase_type: string
    teacher_name: string
  }> | {
    course_id: number
    course_title: string
    course_cover?: string | null
    video_id: number
    video_title: string
    watched_seconds: number
    duration_seconds: number
    progress_percentage: number
    lesson_id: number
    package_id?: number | null
    purchase_type: string
    teacher_name: string
  } | null
  overall_progress_percentage: number
  stats: {
    enrolled_courses_count: number
    completed_lectures_count: number
    exams_solved_count: number
    average_score: number
  }
  upcoming_exams: Array<{
    id: number
    title: string
    type: 'quiz' | 'homework' | 'monthly_exam'
    time_limit_minutes: number
    max_score: number
    lesson: {
      title: string
      unit: {
        course: {
          title: string
        }
      }
    }
  }>
  exam_history: Array<{
    id: number
    exam_title: string
    course_title: string
    score: number | null
    max_score: number
    percentage: number | null
    submitted_at: string
  }>
  homework_history: Array<{
    id: number
    exam_title: string
    course_title: string
    score: number | null
    max_score: number
    percentage: number | null
    submitted_at: string
  }>
  watch_history: Array<{
    id: number
    video_title: string
    course_title: string
    views_count: number
    watched_percentage: number
    updated_at: string
  }>
}

interface Teacher {
  id: number
  name: string
  subject: string
  avatar?: string
  courses_count: number
  published_courses_count?: number
  experience?: string
  teaching_mode?: 'online' | 'center' | 'both'
}

interface AvailableCourse {
  id: number
  title: string
  cover_image: string
  price: string
  subject: string
  lessons_count: number
  enable_discount?: boolean
  discount_type?: 'percentage' | 'fixed' | null
  discount_value?: number | null
  final_price?: number | null
  teacher: {
    id: number
    name: string
    avatar?: string
  }
  grade?: string
  availability?: 'online' | 'center' | 'both'
  is_bundle?: boolean | number | string
}

const SUBJECTS_TRANSLATION: Record<string, string> = {
  chemistry: 'الكيمياء',
  physics: 'الفيزياء',
  integrated_science: 'علوم متكاملة',
  biology: 'الأحياء',
  math: 'الرياضيات',
  science: 'العلوم',
  arabic: 'اللغة العربية',
  english: 'اللغة الإنجليزية',
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const cardItemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 80, damping: 15 }
  }
}

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [dbData, setDbData] = React.useState<DashboardData | null>(null)
  const [teachers, setTeachers] = React.useState<Teacher[]>([])
  const [availableCourses, setAvailableCourses] = React.useState<AvailableCourse[]>([])
  const [recommendedData, setRecommendedData] = React.useState<{
    recommended: AvailableCourse[]
    latest: AvailableCourse[]
    allCourses: AvailableCourse[]
  }>({ recommended: [], latest: [], allCourses: [] })
  
  const [activeTab, setActiveTab] = React.useState<'courses' | 'recent_watched' | 'upcoming_exams' | 'exam_history' | 'homework_history'>('courses')
  
  const [loading, setLoading] = React.useState(true)
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedSubject, setSelectedSubject] = React.useState('all')

  const GRADES = [
    { key: 'first_preparatory', val: 'الصف الأول الإعدادي' },
    { key: 'second_preparatory', val: 'الصف الثاني الإعدادي' },
    { key: 'third_preparatory', val: 'الصف الثالث الإعدادي' },
    { key: 'first_secondary', val: 'الصف الأول الثانوي' },
    { key: 'second_secondary', val: 'الصف الثاني الثانوي' },
    { key: 'third_secondary', val: 'الصف الثالث الثانوي' },
  ]
  const studentGradeKey = user?.grades?.[0] || ''
  const studentGradeVal = GRADES.find(g => g.key === studentGradeKey)?.val || ''
  const hasGrade = !!studentGradeKey

  const [error, setError] = React.useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dbRes, teachersRes, recRes] = await Promise.all([
        API.get('/student/dashboard'),
        API.get('/teachers'),
        API.get('/student/recommended-courses')
      ])
      setDbData(dbRes.data)
      setTeachers(teachersRes.data)
      setRecommendedData(recRes.data)
      setAvailableCourses(recRes.data.allCourses || [])
    } catch (err: any) {
      console.error('Error loading student home page:', err)
      setError(err.message || 'فشل الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو تحديث الصفحة.')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-6">
        <div className="p-4 bg-red-500/10 text-red-500 rounded-full animate-bounce">
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-black text-slate-100">فشل الاتصال بالخادم</h3>
        <p className="text-xs text-slate-400 font-light max-w-sm leading-relaxed">{error}</p>
        <button onClick={fetchData} className="px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-black rounded-2xl cursor-pointer shadow-lg hover:shadow-brand-primary/20 transition-all">
          إعادة المحاولة
        </button>
      </div>
    )
  }

  // Temporary logging before filters (as requested by User Request)
  console.log("teachers state value:", teachers);
  console.log("Array.isArray(teachers):", Array.isArray(teachers));
  console.log("typeof teachers:", typeof teachers);

  console.log("availableCourses state value:", availableCourses);
  console.log("Array.isArray(availableCourses):", Array.isArray(availableCourses));
  console.log("typeof availableCourses:", typeof availableCourses);

  console.log("dbData state value:", dbData);
  console.log("typeof dbData:", typeof dbData);

  // Safe array guards
  const safeTeachers = Array.isArray(teachers) ? teachers : []
  const safeAvailableCourses = Array.isArray(availableCourses) ? availableCourses : []
  const safeCourses = Array.isArray(dbData?.courses) ? dbData.courses : []
  const safeWatchHistory = Array.isArray(dbData?.watch_history) ? dbData.watch_history : []
  const safeUpcomingExams = Array.isArray(dbData?.upcoming_exams) ? dbData.upcoming_exams : []
  const safeExamHistory = Array.isArray(dbData?.exam_history) ? dbData.exam_history : []
  const safeHomeworkHistory = Array.isArray(dbData?.homework_history) ? dbData.homework_history : []

  const safeRecommended = Array.isArray(recommendedData?.recommended) ? recommendedData.recommended : []
  const safeLatest = Array.isArray(recommendedData?.latest) ? recommendedData.latest : []

  // Filter logic using safe arrays
  const filteredTeachers = safeTeachers.filter(t => {
    const matchesSubject = selectedSubject === 'all' || t.subject === selectedSubject
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSubject && matchesSearch
  })

  const filteredCourses = safeAvailableCourses.filter(c => {
    const matchesSubject = selectedSubject === 'all' || c.subject === selectedSubject
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.teacher.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSubject && matchesSearch
  })

  // Recommended & Latest using safe arrays
  const enrolledCourseIds = new Set(safeCourses.map(c => c.id))
  const recommendedCourses = safeAvailableCourses
    .filter(c => !enrolledCourseIds.has(c.id))
    .slice(0, 3)

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background py-10 space-y-16 text-right" 
      dir="rtl"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* ====================================
            1. HERO SECTION
            ==================================== */}
        <div className="relative rounded-3xl overflow-hidden border border-border-color bg-gradient-to-br from-[var(--card-bg)]/90 via-[var(--bg-color)]/95 to-[var(--card-bg)]/90 p-8 sm:p-10 md:p-12 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
          {/* Animated decorative shapes */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(22,196,127,0.1),transparent_45%)] pointer-events-none"></div>
          <motion.div 
            animate={{ 
              y: [-10, 10, -10],
              rotate: [0, 5, 0]
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute bottom-[-50px] left-10 w-72 h-72 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none"
          />
          <motion.div 
            animate={{ 
              y: [10, -10, 10],
              x: [-10, 10, -10]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-10 right-20 w-48 h-48 bg-accent/10 rounded-full blur-2xl pointer-events-none"
          />
          
          <div className="space-y-6 max-w-xl relative z-10">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-xs text-brand-primary font-black shadow-[0_0_15px_rgba(22,196,127,0.1)]"
            >
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span>خطوتك هي أول خطوة في طريق النجاح ✨</span>
            </motion.div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground leading-tight tracking-tight">
              مرحباً بك مجدداً، يا <span className="text-brand-primary drop-shadow-[0_0_15px_rgba(22,196,127,0.2)]">{user?.name || 'طالبنا العزيز'}</span> 👋
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-300 font-light leading-relaxed">
              تعلم بذكاء، تابع تقدمك، اختبر نفسك، وحقق أفضل النتائج مع تجربة تعليمية مصممة خصيصًا لطلاب المرحلة الإعدادية والثانوية.
            </p>

            {/* Search UI removed per request */}
          </div>

          {/* Premium Wallet Widget */}
          <motion.div 
            whileHover={{ y: -4, boxShadow: "0 20px 30px rgba(0,0,0,0.3)" }}
            className="relative shrink-0 w-full md:w-80 bg-brand-card/90 border border-border-color p-6 rounded-3xl shadow-xl hover:border-brand-primary/30 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-24 h-24 bg-brand-primary/5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute bottom-[-20px] right-[-20px] w-24 h-24 bg-accent/5 rounded-full blur-xl pointer-events-none"></div>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-2xl border border-brand-primary/20">
                <Wallet className="h-6 w-6" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-black tracking-wider block">رصيد محفظتك الحالي</span>
                <div className="text-2xl font-black text-brand-primary tracking-tight">
                  {Number(dbData?.wallet_balance || 0).toFixed(2)} <span className="text-xs font-bold text-slate-300">ج.م</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <Link 
                to="/student/wallet" 
                className="w-full block text-center py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-2xl text-xs font-black shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all duration-200"
              >
                شحن محفظتك الآن
              </Link>
            </div>
          </motion.div>
        </div>

        {/* ====================================
            2. STUDENT STATS SECTION
            ==================================== */}
        {dbData && dbData.stats && (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {/* Stats: Enrolled */}
            <motion.div 
              variants={cardItemVariants}
              whileHover={{ y: -4, borderColor: "rgba(99, 102, 241, 0.4)", boxShadow: "0 0 20px rgba(99, 102, 241, 0.15)" }}
              className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-6 rounded-3xl flex flex-row items-center justify-between transition-all duration-300 group"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-black tracking-wider block">الكورسات المشترك بها</span>
                <div className="text-3xl font-black text-foreground group-hover:text-brand-primary transition-colors">{dbData.stats.enrolled_courses_count}</div>
              </div>
              <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-2xl border border-brand-primary/20 group-hover:bg-brand-primary group-hover:text-white transition-all shadow-sm">
                <BookOpen className="h-6 w-6" />
              </div>
            </motion.div>

            {/* Stats: Lectures Completed */}
            <motion.div 
              variants={cardItemVariants}
              whileHover={{ y: -4, borderColor: "rgba(56, 189, 248, 0.4)", boxShadow: "0 0 20px rgba(56, 189, 248, 0.15)" }}
              className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-6 rounded-3xl flex flex-row items-center justify-between transition-all duration-300 group"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-black tracking-wider block">المحاضرات المكتملة</span>
                <div className="text-3xl font-black text-foreground group-hover:text-accent transition-colors">{dbData.stats.completed_lectures_count}</div>
              </div>
              <div className="p-3 bg-accent/10 text-accent rounded-2xl border border-accent/20 group-hover:bg-accent group-hover:text-slate-950 transition-all shadow-sm">
                <Video className="h-6 w-6" />
              </div>
            </motion.div>

            {/* Stats: Exams Solved */}
            <motion.div 
              variants={cardItemVariants}
              whileHover={{ y: -4, borderColor: "rgba(129, 140, 248, 0.4)", boxShadow: "0 0 20px rgba(129, 140, 248, 0.15)" }}
              className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-6 rounded-3xl flex flex-row items-center justify-between transition-all duration-300 group"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-black tracking-wider block">الامتحانات المحلولة</span>
                <div className="text-3xl font-black text-foreground group-hover:text-indigo-400 transition-colors">{dbData.stats.exams_solved_count}</div>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 group-hover:bg-indigo-400 group-hover:text-white transition-all shadow-sm">
                <Award className="h-6 w-6" />
              </div>
            </motion.div>

            {/* Stats: Average Score */}
            <motion.div 
              variants={cardItemVariants}
              whileHover={{ y: -4, borderColor: "rgba(245, 158, 11, 0.4)", boxShadow: "0 0 20px rgba(245, 158, 11, 0.15)" }}
              className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-6 rounded-3xl flex flex-row items-center justify-between transition-all duration-300 group"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-black tracking-wider block">متوسط الدرجات</span>
                <div className="text-3xl font-black text-amber-500 group-hover:text-amber-400 transition-colors">{dbData.stats.average_score}%</div>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-sm">
                <Percent className="h-6 w-6" />
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ====================================
            3. CONTINUE LEARNING (My Current Enrolled Courses)
            ==================================== */}
        {dbData?.last_watched && (Array.isArray(dbData.last_watched) ? dbData.last_watched : [dbData.last_watched]).filter(Boolean).length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-foreground flex items-center gap-2 border-r-4 border-brand-primary pr-3 leading-none">
                <span>استكمال التعليم</span>
                <span className="text-[10px] text-slate-450 font-light mt-1">تابع من حيث توقفت في آخر محاضرة شاهدتها</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(Array.isArray(dbData.last_watched) ? dbData.last_watched : [dbData.last_watched]).filter(Boolean).map((item, idx) => (
                <motion.div 
                  key={`${item.course_id}-${item.package_id}-${idx}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full"
                >
                  <div 
                    className="group bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-3xl overflow-hidden flex flex-col sm:flex-row transition-all duration-350 hover:border-brand-primary/30 shadow-xl h-full"
                  >
                    <div className="sm:w-2/5 aspect-video sm:aspect-auto bg-brand-surface relative overflow-hidden shrink-0">
                      <img 
                        src={item.course_cover || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} 
                        alt={item.course_title} 
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" 
                      />
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2 text-right" dir="rtl">
                        <span className="text-[10px] text-brand-primary font-bold block">مدرس المادة: {item.teacher_name}</span>
                        <h3 className="font-black text-sm text-slate-200 leading-relaxed line-clamp-1">{item.course_title}</h3>
                        <p className="text-[11px] text-slate-450 font-medium leading-relaxed line-clamp-1">{item.video_title}</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-black text-text-secondary">
                          <span>شاهدت: {formatWatchedTimeArabic(item.watched_seconds)} من {formatWatchedTimeArabic(item.duration_seconds)}</span>
                          <span className="text-brand-primary">{Math.round(item.progress_percentage)}%</span>
                        </div>
                        
                        <div className="w-full bg-background/50 rounded-full h-1.5 overflow-hidden border border-border-color">
                          <div 
                            style={{ width: `${item.progress_percentage}%` }}
                            className="bg-gradient-to-r from-brand-primary to-brand-secondary h-full rounded-full transition-all duration-500" 
                          />
                        </div>

                        <div className="flex justify-end pt-1">
                          <Link 
                            to={`/course/${item.course_id}?video_id=${item.video_id}&lesson_id=${item.lesson_id}${item.package_id ? `&package_id=${item.package_id}` : ''}`} 
                            className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-[10px] font-black shadow-md hover:shadow-[0_0_15px_rgba(99,102,241,0.25)] transition-all duration-200 flex items-center gap-1.5"
                          >
                            <span>متابعة المشاهدة</span>
                            <Play className="h-3 w-3 fill-current" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ====================================
            4. CATEGORIES SECTION (Subjects Grid)
            ==================================== */}
        <div className="space-y-6">
          <h2 className="text-xl font-black text-foreground flex items-center gap-2 border-r-4 border-brand-primary pr-3 leading-none">
            <span>تصفح حسب المواد العلمية</span>
          </h2>
          
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
            <button 
              onClick={() => setSelectedSubject('all')}
              className={`p-4 rounded-2xl text-center border font-black text-xs transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-2 shrink-0 w-28 snap-start ${
                selectedSubject === 'all' 
                  ? 'bg-brand-primary border-brand-primary text-white shadow-[0_0_15px_rgba(22,196,127,0.25)]' 
                  : 'bg-brand-card border-border-color text-slate-350 hover:border-brand-primary/30 hover:bg-brand-card/85'
              }`}
            >
              <Sparkles className="h-5 w-5" />
              <span>الجميع</span>
            </button>
            {Object.entries(SUBJECTS_TRANSLATION).map(([key, name]) => (
              <button 
                key={key}
                onClick={() => setSelectedSubject(key)}
                className={`p-4 rounded-2xl text-center border font-black text-xs transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-2 shrink-0 w-28 snap-start ${
                  selectedSubject === key 
                    ? 'bg-brand-primary border-brand-primary text-white shadow-[0_0_15px_rgba(22,196,127,0.25)]' 
                    : 'bg-brand-card border-border-color text-slate-350 hover:border-brand-primary/30 hover:bg-brand-card/85'
                }`}
              >
                <BookOpen className="h-5 w-5 opacity-70" />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ====================================
            5. FEATURED TEACHERS SECTION
            ==================================== */}
        <div className="space-y-6">
          <h2 className="text-xl font-black text-foreground flex items-center gap-2 border-r-4 border-brand-primary pr-3 leading-none">
            <span>المعلمون المميزون</span>
            <span className="text-[10px] text-slate-400 font-light mt-1">شاهد شروحات نخبة من المحاضرين</span>
          </h2>

          {filteredTeachers.length === 0 ? (
            <div className="bg-brand-card border border-border-color rounded-3xl p-12 text-center text-slate-500 font-light text-xs">لا يوجد معلمون مسجلون يطابقون خيارات التصفية المدخلة.</div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {filteredTeachers.map((teacher) => (
                <motion.div variants={cardItemVariants} key={teacher.id}>
                  <TeacherCard
                    id={teacher.id}
                    name={teacher.name}
                    subject={teacher.subject}
                    avatar={teacher.avatar}
                    experience={teacher.experience}
                    coursesCount={teacher.published_courses_count || 0}
                    teaching_mode={teacher.teaching_mode}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* ====================================
            6. STUDENT COURSE RECOMMENDATIONS
            ==================================== */}
        {!hasGrade ? (
          <div className="bg-brand-card border border-[var(--border-color)] p-8 rounded-3xl text-center space-y-4 shadow-md flex flex-col items-center justify-center">
            <GraduationCap className="h-12 w-12 text-indigo-400 animate-bounce" />
            <h3 className="text-lg font-bold text-slate-200">أكمل ملفك الشخصي لاختيار الكورسات المناسبة لك</h3>
            <p className="text-xs text-slate-400 font-light max-w-sm">
              قم باختيار مرحلتك الدراسية لنتمكن من تقديم توصيات مخصصة لك ووضع خطط تناسبك.
            </p>
            <Link 
              to="/student/profile" 
              className="inline-flex items-center justify-center px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-brand-primary/20 cursor-pointer"
            >
              إكمال الملف الشخصي
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Banner Section */}
            <div className="p-6 sm:p-8 rounded-3xl text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)'
              }}
            >
              {/* Background accent */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_45%)] pointer-events-none"></div>
              <div className="relative z-10 space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-[10px] font-black tracking-wider uppercase">
                  ⭐ مخصص لمرحلتك الدراسية
                </span>
                <h2 className="text-2xl font-black">
                  ✨ كورسات مقترحة لطلاب {studentGradeVal}
                </h2>
                <p className="text-xs text-indigo-100 font-light">
                  تم اختيار هذه الكورسات بعناية لتناسب صفك الدراسي وتساعدك على التفوق.
                </p>
              </div>
            </div>

            {/* Recommended grid */}
            {/* Recommended grid */}
            {safeRecommended.length === 0 ? (
              <div className="bg-brand-card border border-border-color rounded-3xl p-8 text-center text-slate-400 font-light text-xs">
                لا توجد كورسات مقترحة متوفرة حالياً لهذه المرحلة الدراسية.
              </div>
            ) : (
              <div className="bastahalak-grid">
                {safeRecommended.map((course) => (
                  <CourseCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    coverImage={course.cover_image}
                    price={course.price}
                    subject={course.subject}
                    teacherName={course.teacher.name}
                    teacherAvatar={course.teacher.avatar}
                    isSubscribed={enrolledCourseIds.has(course.id)}
                    lessonsCount={course.lessons_count}
                    enableDiscount={course.enable_discount === true}
                    discountType={course.discount_type ?? undefined}
                    discountValue={course.discount_value ?? undefined}
                    finalPrice={course.final_price ?? undefined}
                    grade={course.grade}
                    availability={course.availability}
                    isBundle={course.is_bundle === true || course.is_bundle === 1 || course.is_bundle === '1'}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====================================
            7. LATEST COURSES
            ==================================== */}
        <div className="space-y-6">
          <h2 className="text-xl font-black text-foreground flex items-center gap-2 border-r-4 border-brand-primary pr-3 leading-none">
            <span> أحدث الكورسات</span>
          </h2>
          
          {safeLatest.length === 0 ? (
            <div className="bg-brand-card border border-border-color rounded-3xl p-8 text-center text-slate-400 font-light text-xs">
              لا توجد كورسات مضافة حديثاً.
            </div>
          ) : (
            <div className="bastahalak-grid">
              {safeLatest.map((course) => (
                <CourseCard
                  key={course.id}
                  id={course.id}
                  title={course.title}
                  coverImage={course.cover_image}
                  price={course.price}
                  subject={course.subject}
                  teacherName={course.teacher.name}
                  teacherAvatar={course.teacher.avatar}
                  isSubscribed={enrolledCourseIds.has(course.id)}
                  lessonsCount={course.lessons_count}
                  enableDiscount={course.enable_discount === true}
                  discountType={course.discount_type ?? undefined}
                  discountValue={course.discount_value ?? undefined}
                  finalPrice={course.final_price ?? undefined}
                  grade={course.grade}
                  availability={course.availability}
                  isBundle={course.is_bundle === true || course.is_bundle === 1 || course.is_bundle === '1'}
                />
              ))}
            </div>
          )}
        </div>

        {/* ====================================
            8. ALL COURSES (Filtered/Searched catalog)
            ==================================== */}
        <div className="space-y-6">
          <h2 className="text-xl font-black text-foreground flex items-center gap-2 border-r-4 border-brand-primary pr-3 leading-none">
            <span> جميع الكورسات</span>
          </h2>

          {filteredCourses.length === 0 ? (
            <div className="bg-brand-card border border-border-color rounded-3xl p-12 text-center text-slate-500 font-light text-xs">
              لا يوجد كورسات مطابقة لخيارات التصفية أو البحث.
            </div>
          ) : (
            <div className="bastahalak-grid">
              {filteredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  id={course.id}
                  title={course.title}
                  coverImage={course.cover_image}
                  price={course.price}
                  subject={course.subject}
                  teacherName={course.teacher.name}
                  teacherAvatar={course.teacher.avatar}
                  isSubscribed={enrolledCourseIds.has(course.id)}
                  lessonsCount={course.lessons_count}
                  enableDiscount={course.enable_discount === true}
                  discountType={course.discount_type ?? undefined}
                  discountValue={course.discount_value ?? undefined}
                  finalPrice={course.final_price ?? undefined}
                  grade={course.grade}
                  availability={course.availability}
                  isBundle={course.is_bundle === true || course.is_bundle === 1 || course.is_bundle === '1'}
                />
              ))}
            </div>
          )}
        </div>

        {/* ====================================
            TABS & ACTIVITIES LOG
            ==================================== */}
        <div className="space-y-6 bg-brand-card border border-border-color p-6 sm:p-8 rounded-[32px] shadow-xl">
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-primary animate-pulse" />
            <span>سجلات الأنشطة ومتابعة الامتحانات</span>
          </h2>

          <div className="flex gap-2 border-b border-border-color pb-3 overflow-x-auto scrollbar-thin">
            {[
              { id: 'courses', label: 'كورساتي الحالية', count: dbData?.courses.length || 0 },
              { id: 'recent_watched', label: 'شوهد مؤخراً', count: dbData?.watch_history?.length || 0 },
              { id: 'upcoming_exams', label: 'امتحانات قادمة', count: dbData?.upcoming_exams?.length || 0 },
              { id: 'exam_history', label: 'سجل الاختبارات', count: dbData?.exam_history?.length || 0 },
              { id: 'homework_history', label: 'سجل الواجبات', count: dbData?.homework_history?.length || 0 }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-xs font-black transition-all border-b-2 cursor-pointer shrink-0 pb-3 relative ${
                  activeTab === tab.id 
                    ? 'text-brand-primary' 
                    : 'border-transparent text-text-secondary hover:text-foreground'
                }`}
              >
                <span>{tab.label} ({tab.count})</span>
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-brand-primary"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="pt-4 min-h-[150px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* Courses Tab inside Log */}
                {activeTab === 'courses' && (
                  <div>
                    {safeCourses.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs font-light">أنت غير مشترك في أي كورسات حالياً.</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {safeCourses.map((course) => (
                          <div key={course.id} className="bg-background border border-border-color p-5 rounded-2xl flex items-center justify-between group hover:border-brand-primary/25 transition-all">
                            <div className="space-y-1">
                              <h4 className="font-black text-xs text-slate-200 group-hover:text-brand-primary transition-colors">{course.title}</h4>
                              <span className="text-[9px] text-slate-500 block">الإنجاز: {course.progress_percentage}%</span>
                            </div>
                            <Link to={`/course/${course.id}${course.purchase_type === 'package' ? `?package_id=${course.package_id}` : (course.purchase_type === 'lesson' ? `?lesson_id=${course.lesson_id}` : '')}`} className="p-2.5 bg-brand-primary/10 text-brand-primary group-hover:bg-brand-primary group-hover:text-white rounded-xl transition-all">
                              <Play className="h-4 w-4 fill-current" />
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recently Watched Tab */}
                {activeTab === 'recent_watched' && (
                  <div>
                    {safeWatchHistory.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs font-light">لا يوجد محاضرات تمت مشاهدتها بعد.</div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-border-color bg-background/30">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr className="border-b border-border-color bg-background/50 text-[10px] font-bold text-slate-400">
                              <th className="p-4">اسم المحاضرة / الفيديو</th>
                              <th className="p-4">اسم الكورس</th>
                              <th className="p-4 text-center">عدد المشاهدات</th>
                              <th className="p-4 text-center">التقدم</th>
                              <th className="p-4 text-left">آخر مشاهدة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-color/50 text-xs">
                            {safeWatchHistory.map((progress) => (
                              <tr key={progress.id} className="hover:bg-background/80 transition-colors">
                                <td className="p-4 font-black text-slate-200">{progress.video_title}</td>
                                <td className="p-4 text-slate-400 font-semibold">{progress.course_title}</td>
                                <td className="p-4 text-center font-bold text-brand-primary">{progress.views_count} مرات</td>
                                <td className="p-4 text-center">
                                  <span className="font-black text-slate-350 bg-background/60 px-2 py-0.5 rounded-lg border border-border-color">{progress.watched_percentage}%</span>
                                </td>
                                <td className="p-4 text-left text-slate-400">
                                  {new Date(progress.updated_at).toLocaleDateString('ar-EG')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Upcoming Exams Tab */}
                {activeTab === 'upcoming_exams' && (
                  <div>
                    {safeUpcomingExams.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs font-light">رائع! لا يوجد امتحانات معلقة حالياً.</div>
                    ) : (
                      <div className="space-y-4">
                        {safeUpcomingExams.map((exam) => (
                          <div key={exam.id} className="bg-background/50 border border-border-color p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-brand-primary/20 transition-all">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black ${
                                  exam.type === 'homework' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                                }`}>
                                  {exam.type === 'homework' ? 'واجب منزلي' : exam.type === 'monthly_exam' ? 'امتحان شهري' : 'اختبار تفاعلي'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold">{exam.lesson?.unit?.course?.title} - {exam.lesson?.title}</span>
                              </div>
                              <h4 className="font-bold text-xs text-slate-200 mt-1">{exam.title}</h4>
                              <p className="text-[10px] text-slate-500 font-semibold">المدة: {exam.time_limit_minutes} دقيقة | الدرجة القصوى: {exam.max_score} درجة</p>
                            </div>
                            <button
                              onClick={() => {
                                if (checkExamAvailability(exam)) {
                                  navigate(`/student/exams/${exam.id}`);
                                }
                              }}
                              className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-[10px] font-black shadow-md transition-all duration-200 cursor-pointer"
                            >
                              ابدأ الحل الآن
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Exam History Tab */}
                {activeTab === 'exam_history' && (
                  <div>
                    {safeExamHistory.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs font-light">لا يوجد سجل امتحانات محلولة حتى الآن.</div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-border-color bg-background/30">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr className="border-b border-border-color bg-background/50 text-[10px] font-bold text-slate-400">
                              <th className="p-4">اسم الامتحان</th>
                              <th className="p-4">الكورس</th>
                              <th className="p-4 text-center">الدرجة</th>
                              <th className="p-4 text-center">النسبة</th>
                              <th className="p-4 text-left">التاريخ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-color/50 text-xs">
                            {safeExamHistory.map((attempt) => (
                              <tr key={attempt.id} className="hover:bg-background/80 transition-colors">
                                <td className="p-4 font-black text-slate-200">{attempt.exam_title}</td>
                                <td className="p-4 text-slate-400 font-semibold">{attempt.course_title}</td>
                                <td className="p-4 text-center font-bold text-slate-200">
                                  {attempt.score !== null ? `${attempt.score} / ${attempt.max_score}` : 'لم ترصد بعد'}
                                </td>
                                <td className="p-4 text-center">
                                  {attempt.percentage !== null ? (
                                    <span className={`font-black px-2 py-0.5 rounded-lg text-[11px] ${
                                      attempt.percentage >= 50 
                                        ? 'text-brand-success bg-brand-primary/10 border border-brand-primary/20' 
                                        : 'text-rose-500 bg-rose-500/10 border border-rose-500/20'
                                    }`}>
                                      {attempt.percentage}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 font-light">-</span>
                                  )}
                                </td>
                                <td className="p-4 text-left text-slate-400 font-semibold">
                                  {new Date(attempt.submitted_at).toLocaleDateString('ar-EG')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Homework History Tab */}
                {activeTab === 'homework_history' && (
                  <div>
                    {safeHomeworkHistory.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs font-light">لا يوجد واجبات تم تسليمها حتى الآن.</div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-border-color bg-background/30">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr className="border-b border-border-color bg-background/50 text-[10px] font-bold text-slate-400">
                              <th className="p-4">اسم الواجب</th>
                              <th className="p-4">الكورس</th>
                              <th className="p-4 text-center">الدرجة</th>
                              <th className="p-4 text-center">النسبة</th>
                              <th className="p-4 text-left">التاريخ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-color/50 text-xs">
                            {safeHomeworkHistory.map((attempt) => (
                              <tr key={attempt.id} className="hover:bg-background/80 transition-colors">
                                <td className="p-4 font-black text-slate-200">{attempt.exam_title}</td>
                                <td className="p-4 text-slate-400 font-semibold">{attempt.course_title}</td>
                                <td className="p-4 text-center font-bold text-slate-200">
                                  {attempt.score !== null ? `${attempt.score} / ${attempt.max_score}` : 'لم ترصد بعد'}
                                </td>
                                <td className="p-4 text-center">
                                  {attempt.percentage !== null ? (
                                    <span className={`font-black px-2 py-0.5 rounded-lg text-[11px] ${
                                      attempt.percentage >= 50 
                                        ? 'text-brand-success bg-brand-primary/10 border border-brand-primary/20' 
                                        : 'text-rose-500 bg-rose-500/10 border border-rose-500/20'
                                    }`}>
                                      {attempt.percentage}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 font-light">-</span>
                                  )}
                                </td>
                                <td className="p-4 text-left text-slate-400 font-semibold">
                                  {new Date(attempt.submitted_at).toLocaleDateString('ar-EG')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

      </div>
    </motion.div>
  )
}
