import React from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import API from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { 
  BookOpen, 
  Video, 
  Clock, 
  Award, 
  Activity, 
  Percent, 
  Lock, 
  Eye, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  User,
  Mail,
  Phone,
  Wallet
} from 'lucide-react'

const GRADES_OPTIONS = {
  preparatory: [
    { value: 'first_preparatory', label: 'الصف الأول الإعدادي' },
    { value: 'second_preparatory', label: 'الصف الثاني الإعدادي' },
    { value: 'third_preparatory', label: 'الصف الثالث الإعدادي' },
  ],
  secondary: [
    { value: 'first_secondary', label: 'الصف الأول الثانوي' },
    { value: 'second_secondary', label: 'الصف الثاني الثانوي' },
    { value: 'third_secondary', label: 'الصف الثالث الثانوي' },
  ]
}

interface CourseProgress {
  id: number
  title: string
  cover_image: string
  teacher_name: string
  progress_percentage: number
  completed_lectures: number
  remaining_lectures: number
}

interface ExamHistoryItem {
  id: number
  exam_title: string
  course_title: string
  score: number | null
  max_score: number
  percentage: number | null
  submitted_at: string
}

interface WatchHistoryItem {
  id: number
  video_title: string
  views_count: number
  watched_percentage: string | number
  updated_at: string
}

interface ProfileStatsData {
  stats: {
    enrolled_courses_count: number
    completed_lectures_count: number
    watched_hours: number
    exams_solved_count: number
    average_score: number
    last_activity: string | null
  }
  courses: CourseProgress[]
  exams_history: ExamHistoryItem[]
  watch_history: WatchHistoryItem[]
}

type ChangePasswordFormInputs = {
  current_password?: string
  password: string
  password_confirmation: string
}

export default function ProfileDashboard() {
  const { user, updateUser } = useAuthStore()
  const [data, setData] = React.useState<ProfileStatsData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [walletTransactions, setWalletTransactions] = React.useState<any[]>([])

  const [coursesIndex, setCoursesIndex] = React.useState(0)
  const [visibleSlides, setVisibleSlides] = React.useState(2)

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setVisibleSlides(1)
      } else {
        setVisibleSlides(2)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const transactionsWithRollingBalance = React.useMemo(() => {
    const sorted = [...walletTransactions].reverse();
    let currentBalance = 0;
    const calculated = sorted.map((tx) => {
      const amount = parseFloat(tx.amount) || 0;
      const isCredit = tx.type === 'recharge' || tx.type === 'refund';
      if (isCredit) {
        currentBalance += amount;
      } else {
        currentBalance -= amount;
      }
      return {
        ...tx,
        rollingBalance: currentBalance,
      };
    });
    return calculated.reverse();
  }, [walletTransactions]);

  // Profile fields state
  const [profileName, setProfileName] = React.useState(user?.name || '')
  const [profileEmail, setProfileEmail] = React.useState(user?.email || '')
  const [profilePhone, setProfilePhone] = React.useState(user?.phone || '')
  const [profileParentPhone, setProfileParentPhone] = React.useState(user?.parent_phone || '')
  const [profileStudentType, setProfileStudentType] = React.useState(user?.student_type || 'online')
  
  // Determine initial stage and grade
  const getInitialGradeAndStage = () => {
    const initialGrade = user?.grades && user.grades.length > 0 ? user.grades[0] : 'first_preparatory'
    const initialStage = initialGrade.includes('secondary') ? 'secondary' : 'preparatory'
    return { initialGrade, initialStage }
  }

  const { initialGrade, initialStage } = getInitialGradeAndStage()
  const [profileStage, setProfileStage] = React.useState<'preparatory' | 'secondary'>(initialStage as any)
  const [profileGrade, setProfileGrade] = React.useState(initialGrade)

  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(null)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [profileSubmitting, setProfileSubmitting] = React.useState(false)

  // Password Change form state
  const [passwordError, setPasswordError] = React.useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null)
  const [passwordSubmitting, setPasswordSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormInputs>()

  const password = watch('password')

  // Keep state in sync if user changes (e.g. initial render or update)
  React.useEffect(() => {
    if (user) {
      setProfileName(user.name || '')
      setProfileEmail(user.email || '')
      setProfilePhone(user.phone || '')
      setProfileParentPhone(user.parent_phone || '')
      const { initialGrade, initialStage } = getInitialGradeAndStage()
      setProfileStage(initialStage as any)
      setProfileGrade(initialGrade)
    }
  }, [user])

  React.useEffect(() => {
    // When stage changes, adjust grade to default for that stage if current grade doesn't belong to it
    if (profileStage === 'preparatory' && !profileGrade.includes('preparatory')) {
      setProfileGrade('first_preparatory')
    } else if (profileStage === 'secondary' && !profileGrade.includes('secondary')) {
      setProfileGrade('first_secondary')
    }
  }, [profileStage])

  React.useEffect(() => {
    fetchProfileStats()
  }, [])

  const fetchProfileStats = () => {
    setLoading(true)
    Promise.all([
      API.get('/student/profile-stats'),
      API.get('/student/wallet')
    ])
      .then(([profileRes, walletRes]) => {
        setData(profileRes.data)
        setWalletTransactions(walletRes.data.transactions || [])
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  const onProfileUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(null)
    setProfileSubmitting(true)

    try {
      const res = await API.post('/student/profile/update', {
        name: profileName,
        email: profileEmail,
        phone: profilePhone,
        parent_phone: profileParentPhone,
        grade: profileGrade,
        student_type: profileStudentType,
      })

      setProfileSuccess(res.data.message)
      if (res.data.user) {
        updateUser(res.data.user)
      }
    } catch (err: any) {
      console.error(err)
      if (err.response && err.response.data && err.response.data.message) {
        setProfileError(err.response.data.message)
      } else if (err.response && err.response.data && err.response.data.errors) {
        const firstErr = Object.values(err.response.data.errors)[0] as string[]
        setProfileError(firstErr[0] || 'فشل في تحديث بيانات الملف الشخصي.')
      } else {
        setProfileError('حدث خطأ أثناء تحديث بيانات الملف الشخصي. حاول مجدداً.')
      }
    } finally {
      setProfileSubmitting(false)
    }
  }

  const onChangePasswordSubmit = async (formData: ChangePasswordFormInputs) => {
    setPasswordError(null)
    setPasswordSuccess(null)
    setPasswordSubmitting(true)
    try {
      const res = await API.post('/change-password', {
        current_password: formData.current_password,
        password: formData.password,
        password_confirmation: formData.password_confirmation,
      })
      
      setPasswordSuccess(res.data.message)
      reset() // clear form
    } catch (err: any) {
      console.error(err)
      if (err.response && err.response.data && err.response.data.message) {
        setPasswordError(err.response.data.message)
      } else if (err.response && err.response.data && err.response.data.errors) {
        const firstErr = Object.values(err.response.data.errors)[0] as string[]
        setPasswordError(firstErr[0] || 'فشل في تغيير كلمة المرور.')
      } else {
        setPasswordError('حدث خطأ أثناء تغيير كلمة المرور. حاول مجدداً.')
      }
    } finally {
      setPasswordSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-brand-primary" />
          <span className="text-xs text-slate-400 font-medium">جاري تحميل لوحة المتابعة الشخصية...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        فشل تحميل بيانات الملف الشخصي. يرجى إعادة المحاولة.
      </div>
    )
  }

  const { stats, courses, exams_history, watch_history } = data

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 text-right" dir="rtl">
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-black text-slate-100 flex items-center gap-2">
          <span>الملف الشخصي للطالب</span>
          <span className="text-brand-primary">({user?.name})</span>
        </h1>
        <p className="text-xs text-slate-400 font-light mt-1">
          إحصائيات الإنجاز وسجل الحضور وحل الواجبات والاختبارات لمنصتك التعليمية.
        </p>
      </div>

      {/* 1. Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        
        {/* Enrolled Courses */}
        <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-2xl flex flex-col justify-between hover:border-brand-primary/25 transition-all">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 space-y-0.5">
            <span className="text-[10px] text-slate-400 font-semibold block">الكورسات المشترك بها</span>
            <div className="text-2xl font-black text-slate-100">{stats.enrolled_courses_count}</div>
          </div>
        </div>

        {/* Completed Lectures */}
        <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-2xl flex flex-col justify-between hover:border-brand-primary/25 transition-all">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
              <Video className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 space-y-0.5">
            <span className="text-[10px] text-slate-400 font-semibold block">محاضرات مكتملة</span>
            <div className="text-2xl font-black text-slate-100">{stats.completed_lectures_count}</div>
          </div>
        </div>

        {/* Watch Hours */}
        <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-2xl flex flex-col justify-between hover:border-brand-primary/25 transition-all">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 space-y-0.5">
            <span className="text-[10px] text-slate-400 font-semibold block">ساعات المشاهدة</span>
            <div className="text-2xl font-black text-slate-100">{stats.watched_hours} س</div>
          </div>
        </div>

        {/* Solved Exams */}
        <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-2xl flex flex-col justify-between hover:border-brand-primary/25 transition-all">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 space-y-0.5">
            <span className="text-[10px] text-slate-400 font-semibold block">امتحانات تم حلها</span>
            <div className="text-2xl font-black text-slate-100">{stats.exams_solved_count}</div>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-2xl flex flex-col justify-between hover:border-brand-primary/25 transition-all">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Percent className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 space-y-0.5">
            <span className="text-[10px] text-slate-400 font-semibold block">متوسط الدرجات</span>
            <div className="text-2xl font-black text-emerald-400">{stats.average_score}%</div>
          </div>
        </div>

        {/* Last Activity */}
        <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-2xl flex flex-col justify-between hover:border-brand-primary/25 transition-all">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 space-y-0.5">
            <span className="text-[10px] text-slate-400 font-semibold block">آخر نشاط للطالب</span>
            <div className="text-xs font-bold text-slate-200 truncate mt-1">
              {stats.last_activity ? new Date(stats.last_activity).toLocaleDateString('ar-EG', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : 'لا يوجد نشاط مسجل'}
            </div>
          </div>
        </div>

      </div>

      {/* 2. Enrolled Courses Achievements Slider */}
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-brand-primary" />
            <span>متابعة إنجاز الكورسات</span>
          </h2>
          {courses.length > visibleSlides && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCoursesIndex(prev => Math.max(0, prev - 1))}
                disabled={coursesIndex === 0}
                className="p-2 bg-slate-900/60 border border-[var(--border-color)] hover:border-brand-primary/45 rounded-xl text-slate-300 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="السابق"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button 
                onClick={() => setCoursesIndex(prev => Math.min(courses.length - visibleSlides, prev + 1))}
                disabled={coursesIndex >= courses.length - visibleSlides}
                className="p-2 bg-slate-900/60 border border-[var(--border-color)] hover:border-brand-primary/45 rounded-xl text-slate-300 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="التالي"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
        
        {courses.length === 0 ? (
          <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-8 text-center text-slate-400 text-xs font-light">
            أنت غير مشترك في أي كورسات حالياً.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl w-full">
            <div 
              className="flex transition-transform duration-500 ease-out"
              style={{
                transform: `translateX(${coursesIndex * (100 / visibleSlides)}%)`,
                width: `${(courses.length / visibleSlides) * 100}%`
              }}
            >
              {courses.map((course) => (
                <div 
                  key={course.id} 
                  style={{ width: `${100 / courses.length}%` }}
                  className="px-2"
                >
                  <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 hover:border-brand-primary/25 transition-all h-full">
                    <div className="w-full sm:w-28 h-20 bg-slate-800 rounded-xl overflow-hidden shrink-0">
                      <img 
                        src={course.cover_image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} 
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-grow space-y-3 w-full">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-sm text-slate-200 line-clamp-1">{course.title}</h3>
                          <span className="text-[10px] text-slate-400 font-medium">المعلم: {course.teacher_name}</span>
                        </div>
                        <span className="text-[10px] bg-brand-primary/10 text-brand-primary font-bold px-2 py-0.5 rounded-full shrink-0">
                          {course.progress_percentage}% مكتمل
                        </span>
                      </div>

                      {/* Progress Line */}
                      <div className="space-y-1.5">
                        <div className="w-full bg-slate-850 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-brand-primary h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${course.progress_percentage}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-light">
                          <span>محاضرات مكتملة: {course.completed_lectures}</span>
                          <span>متبقية: {course.remaining_lectures}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid: 3. Exam attempts & 4. Watch history */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 3. Exam History attempts */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Award className="h-5 w-5 text-brand-primary" />
            <span>سجل الامتحانات المحلولة</span>
          </h2>

          <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
            {exams_history.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-light">
                لا يوجد سجل امتحانات محلولة حتى الآن.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="p-4">اسم الامتحان</th>
                      <th className="p-4">الكورس</th>
                      <th className="p-4 text-center">الدرجة</th>
                      <th className="p-4 text-center">النسبة</th>
                      <th className="p-4 text-left">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] text-xs">
                    {exams_history.map((attempt) => (
                      <tr key={attempt.id} className="hover:bg-[rgba(255,255,255,0.005)]">
                        <td className="p-4 font-semibold text-slate-200">{attempt.exam_title}</td>
                        <td className="p-4 text-slate-400 font-light">{attempt.course_title}</td>
                        <td className="p-4 text-center font-bold text-slate-200">
                          {attempt.score !== null ? `${attempt.score} / ${attempt.max_score}` : 'لم ترصد'}
                        </td>
                        <td className="p-4 text-center">
                          {attempt.percentage !== null ? (
                            <span className={`font-bold ${attempt.percentage >= 50 ? 'text-brand-success' : 'text-rose-500'}`}>
                              {attempt.percentage}%
                            </span>
                          ) : (
                            <span className="text-slate-500 font-light">-</span>
                          )}
                        </td>
                        <td className="p-4 text-left text-slate-400 font-light">
                          {new Date(attempt.submitted_at).toLocaleDateString('ar-EG')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 4. Watch History Ledger */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Video className="h-5 w-5 text-brand-primary" />
            <span>سجل المشاهدات</span>
          </h2>

          <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
            {watch_history.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-light">
                لا توجد محاضرات تمت مشاهدتها بعد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="p-4">اسم المحاضرة / الفيديو</th>
                      <th className="p-4 text-center">عدد المشاهدات</th>
                      <th className="p-4 text-center">التقدم</th>
                      <th className="p-4 text-left">آخر مشاهدة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] text-xs">
                    {watch_history.map((progress) => (
                      <tr key={progress.id} className="hover:bg-[rgba(255,255,255,0.005)]">
                        <td className="p-4 font-semibold text-slate-200">{progress.video_title}</td>
                        <td className="p-4 text-center font-bold text-brand-primary">
                          {progress.views_count} {progress.views_count > 1 ? 'مرات' : 'مرة'}
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-semibold text-slate-300">
                            {Number(progress.watched_percentage).toFixed(0)}%
                          </span>
                        </td>
                        <td className="p-4 text-left text-slate-400 font-light">
                          {new Date(progress.updated_at).toLocaleDateString('ar-EG', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Wallet Ledger Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-brand-primary" />
          <span>دفتر حساب المحفظة (الشفافية المالية)</span>
        </h2>

        <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
          {walletTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-light">
              لا توجد أي معاملات مالية مسجلة حالياً.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">العملية</th>
                    <th className="p-4 text-center">القيمة</th>
                    <th className="p-4 text-left">الرصيد المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] text-xs">
                  {transactionsWithRollingBalance.map((tx) => {
                    const isRecharge = tx.type === 'recharge' || tx.type === 'refund'
                    return (
                      <tr key={tx.id} className="hover:bg-[rgba(255,255,255,0.005)] transition-colors">
                        <td className="p-4 text-slate-400 font-light whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleDateString('ar-EG', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="p-4 font-semibold text-slate-200">
                          {tx.description}
                        </td>
                        <td className={`p-4 text-center font-black ${isRecharge ? 'text-brand-success' : 'text-rose-500'}`}>
                          {isRecharge ? '+' : '-'}{Number(tx.amount).toFixed(2)} ج.م
                        </td>
                        <td className="p-4 text-left font-black text-slate-100 whitespace-nowrap">
                          {tx.rollingBalance.toFixed(2)} ج.م
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 5. Account Settings Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Personal Details Form */}
        <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 space-y-6 shadow-sm">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl font-black text-slate-100 flex items-center justify-center gap-2">
              <User className="h-5 w-5 text-brand-primary" />
              <span>البيانات الشخصية والصف الدراسي</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-light">
              قم بتحديث اسمك، بريدك الإلكتروني، أرقام الهواتف والصف الدراسي الحالي.
            </p>
          </div>

          {profileError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center gap-2 justify-start">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {profileSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-brand-success rounded-xl text-xs flex items-center gap-2 justify-start">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          <form onSubmit={onProfileUpdateSubmit} className="space-y-4">
            
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">الاسم بالكامل</label>
              <div className="relative">
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  placeholder="مثال: أحمد علي..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-right text-slate-100"
                />
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">البريد الإلكتروني</label>
              <div className="relative">
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  required
                  placeholder="student@example.com"
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-right text-slate-100"
                />
                <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Phone Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">رقم الهاتف</label>
                <div className="relative">
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    required
                    placeholder="010XXXXXXXX"
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-right text-slate-100"
                  />
                  <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* Parent Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">هاتف ولي الأمر</label>
                <div className="relative">
                  <input
                    type="text"
                    value={profileParentPhone}
                    onChange={(e) => setProfileParentPhone(e.target.value)}
                    required
                    placeholder="011XXXXXXXX"
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-right text-slate-100"
                  />
                  <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Stage and Grade Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Educational Stage */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">المرحلة الدراسية</label>
                <select
                  value={profileStage}
                  onChange={(e) => setProfileStage(e.target.value as any)}
                  className="w-full bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-xl px-4 py-3 text-sm focus:outline-none text-right text-slate-100 cursor-pointer"
                >
                  <option value="preparatory">المرحلة الإعدادية</option>
                  <option value="secondary">المرحلة الثانوية</option>
                </select>
              </div>

              {/* Grade */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">الصف الدراسي</label>
                <select
                  value={profileGrade}
                  onChange={(e) => setProfileGrade(e.target.value)}
                  className="w-full bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-xl px-4 py-3 text-sm focus:outline-none text-right text-slate-100 cursor-pointer"
                >
                  {GRADES_OPTIONS[profileStage].map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preferred Learning Mode (Student Type) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">طريقة الدراسة المفضلة</label>
              <select
                value={profileStudentType}
                onChange={(e) => setProfileStudentType(e.target.value as any)}
                className="w-full bg-brand-surface border border-[var(--border-color)] focus:border-brand-primary rounded-xl px-4 py-3 text-sm focus:outline-none text-right text-slate-100 cursor-pointer"
              >
                <option value="online">طالب أونلاين (Online Student)</option>
                <option value="center">طالب سنتر (Center Student)</option>
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={profileSubmitting}
              className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {profileSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري تحديث البيانات...</span>
                </>
              ) : (
                <span>تحديث البيانات الشخصية</span>
              )}
            </button>

          </form>
        </div>

        {/* Change Password Section */}
        <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 space-y-6 shadow-sm">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl font-black text-slate-100 flex items-center justify-center gap-2">
              <Lock className="h-5 w-5 text-brand-primary" />
              <span>تغيير كلمة المرور</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-light">
              لحماية حسابك وتأمينه، قم بتحديث كلمة المرور بانتظام.
            </p>
          </div>

          {passwordError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center gap-2 justify-start">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-brand-success rounded-xl text-xs flex items-center gap-2 justify-start">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onChangePasswordSubmit)} className="space-y-4">
            
            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">كلمة المرور الحالية</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="••••••••"
                  {...register('current_password', { 
                    required: 'كلمة المرور الحالية مطلوبة لتحديث كلمة المرور.'
                  })}
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-right"
                />
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
              {errors.current_password && (
                <p className="text-xs text-rose-500 font-light">{errors.current_password.message}</p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="••••••••"
                  {...register('password', { 
                    required: 'كلمة المرور الجديدة مطلوبة.', 
                    minLength: {
                      value: 6,
                      message: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.'
                    }
                  })}
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-right"
                />
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
              {errors.password && (
                <p className="text-xs text-rose-500 font-light">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">تأكيد كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="••••••••"
                  {...register('password_confirmation', { 
                    required: 'تأكيد كلمة المرور مطلوب.',
                    validate: (value) => value === password || 'كلمات المرور غير متطابقة.'
                  })}
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-right"
                />
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
              {errors.password_confirmation && (
                <p className="text-xs text-rose-500 font-light">{errors.password_confirmation.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={passwordSubmitting}
              className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {passwordSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <span>حفظ وتحديث كلمة المرور</span>
              )}
            </button>

          </form>
        </div>

      </div>

    </div>
  )
}
