import React from 'react'
import { Link } from 'react-router-dom'
import API from '../../services/api'
import { BookOpen, Users, Wallet, TrendingUp, Award, ClipboardList, Package, Edit3, Trash2, Check, AlertCircle } from 'lucide-react'
import { useModalStore } from '../../store/modalStore'
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  XAxis, 
  YAxis 
} from 'recharts'

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-[#111827] border border-[#1F2937] p-4 rounded-2xl shadow-xl text-right text-xs space-y-1.5" dir="rtl">
        <p className="font-black text-slate-200">الشهر: {label}</p>
        <p className="font-bold text-brand-success">الإيراد: {data.revenue.toFixed(2)} ج.م</p>
        <p className="font-bold text-indigo-400">الاشتراكات: {data.subscriptions} طالب</p>
      </div>
    )
  }
  return null
}

const GrowthTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-[#111827] border border-[#1F2937] p-4 rounded-2xl shadow-xl text-right text-xs space-y-1.5" dir="rtl">
        <p className="font-black text-slate-200">الشهر: {label}</p>
        <p className="font-bold text-indigo-400">الاشتراكات الجديدة: {data.subscriptions} طالب</p>
        <p className={`font-bold ${data.growth >= 0 ? 'text-brand-success' : 'text-rose-500'}`}>
          معدل النمو: {data.growth >= 0 ? '+' : ''}{data.growth}%
        </p>
      </div>
    )
  }
  return null
}

const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-[#111827] border border-[#1F2937] p-4 rounded-2xl shadow-xl text-right text-xs" dir="rtl">
        <p className="font-black text-slate-200">{data.name}</p>
        <p className="font-bold text-indigo-400 mt-1">الطلاب المشتركون: {data.value} طالب</p>
      </div>
    )
  }
  return null
}

interface PackageItem {
  id: number
  course_id: number
  title: string
  price: string
  lessons_count?: number
  lessons?: any[]
  enrollments_count?: number
  course?: {
    id: number
    title: string
  }
  description?: string
  cover_image?: string
  package_thumbnail?: string
}

interface DashboardStats {
  courses_count: number
  students_count: number
  active_students_count: number
  total_revenue: string
  monthly_revenue: string
  course_sales: string
  exam_sales: string
  total_watch_hours: number
  quizzes_count: number
  average_grade: number
  packages?: PackageItem[]
  enrollments_chart?: { month: string, count: number }[]
  revenue_chart?: { month: string, total: string }[]
  course_performance?: { id: number, title: string, students_count: number, avg_progress: number }[]
}

export default function Dashboard() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Package editing state
  const [showPackageForm, setShowPackageForm] = React.useState(false)
  const [editPackageMode, setEditPackageMode] = React.useState<PackageItem | null>(null)
  const [packageTitle, setPackageTitle] = React.useState('')
  const [packagePrice, setPackagePrice] = React.useState('')
  const [packageDesc, setPackageDesc] = React.useState('')
  const [packageCoverImage, setPackageCoverImage] = React.useState('')
  const [packageThumbnail, setPackageThumbnail] = React.useState('')
  const [uploadingThumbnail, setUploadingThumbnail] = React.useState(false)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [selectedLessons, setSelectedLessons] = React.useState<number[]>([])
  const [courseLessons, setCourseLessons] = React.useState<any[]>([])
  const [actionLoading, setActionLoading] = React.useState(false)

  const fetchStats = () => {
    API.get('/teacher/dashboard')
      .then((res) => {
        setStats(res.data)
      })
      .catch((err) => console.error(err))
  }

  const getGrowthRate = () => {
    if (!stats || !stats.enrollments_chart || stats.enrollments_chart.length < 2) return '0%'
    const len = stats.enrollments_chart.length
    const current = stats.enrollments_chart[len - 1].count
    const previous = stats.enrollments_chart[len - 2].count
    if (previous === 0) return current > 0 ? '+100%' : '0%'
    const pct = ((current - previous) / previous) * 100
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
  }

  const getCurrentMonthArabic = () => {
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ]
    return months[new Date().getMonth()]
  }

  const getPreviousMonthArabic = () => {
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ]
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return months[d.getMonth()]
  }

  const mergedChartData = React.useMemo(() => {
    if (!stats) return []
    
    let revs = stats.revenue_chart || []
    let enrolls = stats.enrollments_chart || []
    
    // Support the { labels: [], datasets: [] } API format
    const apiRaw: any = stats
    if (apiRaw.labels && Array.isArray(apiRaw.labels) && apiRaw.datasets && Array.isArray(apiRaw.datasets)) {
      const result = apiRaw.labels.map((label: string, idx: number) => {
        const revenue = apiRaw.datasets[0]?.data?.[idx] ?? 0
        const subscriptions = apiRaw.datasets[1]?.data?.[idx] ?? 0
        return {
          month: label,
          revenue: parseFloat(revenue) || 0,
          subscriptions: parseInt(subscriptions) || 0,
          growth: 0
        }
      })
      
      for (let i = 0; i < result.length; i++) {
        if (i === 0) {
          result[i].growth = 0
        } else {
          const prev = result[i - 1].subscriptions
          const curr = result[i].subscriptions
          if (prev === 0) {
            result[i].growth = curr > 0 ? 100 : 0
          } else {
            result[i].growth = parseFloat((((curr - prev) / prev) * 100).toFixed(1))
          }
        }
      }
      
      if (result.length > 0) {
        return result
      }
    }

    const totalRevVal = parseFloat(stats.total_revenue) || 0
    const totalStudentsVal = stats.students_count || 0
    const hasDataPoints = revs.length > 0 || enrolls.length > 0

    // Fallback: If no data points exist, but totals exist, generate fallback
    if (!hasDataPoints && (totalRevVal > 0 || totalStudentsVal > 0)) {
      const prevMonth = getPreviousMonthArabic()
      const currMonth = getCurrentMonthArabic()
      return [
        {
          month: prevMonth,
          revenue: 0,
          subscriptions: 0,
          growth: 0
        },
        {
          month: currMonth,
          revenue: totalRevVal,
          subscriptions: totalStudentsVal,
          growth: totalStudentsVal > 0 ? 100 : 0
        }
      ]
    }

    const dataMap = new Map<string, { month: string, revenue: number, subscriptions: number, growth: number }>()
    
    revs.forEach(r => {
      dataMap.set(r.month, {
        month: r.month,
        revenue: parseFloat(r.total) || 0,
        subscriptions: 0,
        growth: 0
      })
    })
    
    enrolls.forEach(e => {
      const existing = dataMap.get(e.month)
      if (existing) {
        existing.subscriptions = e.count
      } else {
        dataMap.set(e.month, {
          month: e.month,
          revenue: 0,
          subscriptions: e.count,
          growth: 0
        })
      }
    })
    
    const arr = Array.from(dataMap.values())
    
    for (let i = 0; i < arr.length; i++) {
      if (i === 0) {
        arr[i].growth = 0
      } else {
        const prev = arr[i - 1].subscriptions
        const curr = arr[i].subscriptions
        if (prev === 0) {
          arr[i].growth = curr > 0 ? 100 : 0
        } else {
          arr[i].growth = parseFloat((((curr - prev) / prev) * 100).toFixed(1))
        }
      }
    }
    
    // Prepend previous month if only 1 data point exists to ensure nice chart rendering
    if (arr.length === 1 && (totalRevVal > 0 || totalStudentsVal > 0)) {
      const prevMonth = getPreviousMonthArabic()
      return [
        {
          month: prevMonth,
          revenue: 0,
          subscriptions: 0,
          growth: 0
        },
        arr[0]
      ]
    }
    
    return arr
  }, [stats])

  const pieData = React.useMemo(() => {
    if (!stats || !stats.course_performance) return []
    return stats.course_performance.map(c => ({
      name: c.title,
      value: c.students_count
    }))
  }, [stats])

  const hasEnoughData = mergedChartData.length > 1

  React.useEffect(() => {
    setLoading(true)
    API.get('/teacher/dashboard')
      .then((res) => {
        setStats(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const handleEditPackageClick = async (pkg: PackageItem) => {
    setEditPackageMode(pkg)
    setPackageTitle(pkg.title)
    setPackagePrice(pkg.price)
    setPackageDesc(pkg.description || '')
    setPackageCoverImage(pkg.cover_image || '')
    setPackageThumbnail(pkg.package_thumbnail || '')
    setSelectedLessons(pkg.lessons ? pkg.lessons.map((l: any) => l.id) : [])
    
    try {
      const res = await API.get(`/courses/${pkg.course_id}`)
      const lessons = res.data.units.flatMap((u: any) => u.lessons)
      setCourseLessons(lessons)
      setShowPackageForm(true)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('حدث خطأ أثناء تحميل محاضرات الكورس.', 'error')
    }
  }

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editPackageMode || !packageTitle.trim() || selectedLessons.length === 0) return

    setActionLoading(true)
    try {
      await API.put(`/teacher/packages/${editPackageMode.id}`, {
        title: packageTitle,
        price: packagePrice || '0.00',
        description: packageDesc,
        cover_image: packageCoverImage,
        package_thumbnail: packageThumbnail,
        lesson_ids: selectedLessons,
      })
      useModalStore.getState().showToast('تم تعديل الباقة المجمعة بنجاح.', 'success')
      setShowPackageForm(false)
      setEditPackageMode(null)
      setPackageTitle('')
      setPackagePrice('')
      setPackageDesc('')
      setPackageCoverImage('')
      setPackageThumbnail('')
      fetchStats()
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تعديل الباقة.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeletePackage = (packageId: number) => {
    useModalStore.getState().showConfirm({
      title: 'حذف الباقة المجمعة',
      description: 'هل أنت متأكد من حذف هذه الباقة؟ لن يؤثر حذف الباقة على اشتراكات الطلاب الحالية ولكن لن يتمكن طلاب جدد من الاشتراك بها.',
      confirmText: 'حذف الباقة',
      cancelText: 'إلغاء',
      type: 'delete',
      onConfirm: async () => {
        setLoading(true)
        try {
          await API.delete(`/teacher/packages/${packageId}`)
          fetchStats()
          useModalStore.getState().showToast('تم حذف الباقة بنجاح.', 'success')
        } catch (err) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف الباقة.', 'error')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const toggleLessonInPackage = (lessonId: number) => {
    setSelectedLessons((prev) => {
      if (prev.includes(lessonId)) {
        return prev.filter((id) => id !== lessonId)
      } else {
        return [...prev, lessonId]
      }
    })
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 animate-pulse text-right" dir="rtl">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <div className="h-8 bg-slate-800 rounded-lg w-48"></div>
          <div className="h-4 bg-slate-800 rounded-lg w-80"></div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-brand-card border border-[var(--border-color)] p-5 rounded-3xl h-28 flex flex-col justify-between">
              <div className="flex justify-between items-center">
                <div className="h-3 bg-slate-800 rounded w-16"></div>
                <div className="w-8 h-8 bg-slate-800 rounded-xl"></div>
              </div>
              <div className="h-6 bg-slate-800 rounded w-24"></div>
            </div>
          ))}
        </div>

        {/* Spacing */}
        <div className="h-px bg-slate-800 my-8"></div>

        {/* Charts Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl h-80 flex flex-col justify-between">
            <div className="h-5 bg-slate-800 rounded w-48 mb-6"></div>
            <div className="flex-1 bg-slate-850 rounded-2xl"></div>
          </div>
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl h-80 flex flex-col justify-between">
            <div className="h-5 bg-slate-800 rounded w-48 mb-6"></div>
            <div className="flex-1 bg-slate-850 rounded-2xl"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black">لوحة التحكم للمعلم</h1>
        <p className="text-sm text-slate-400 font-light mt-1">مرحباً بك مجدداً. تابع مبيعاتك وحضور طلابك في حصصك ومحاضراتك</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          
          {/* Courses */}
          <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-3xl space-y-3.5 shadow-sm flex flex-col justify-between hover:border-brand-primary/20 transition-all duration-300">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-semibold">المواد الدراسية</span>
              <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                <BookOpen className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xl font-black text-slate-100">{stats.courses_count}</div>
              <div className="text-[10px] text-slate-500 font-light">كورسات مفعلة بالمنصة</div>
            </div>
          </div>

          {/* Students (Total & Active) */}
          <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-3xl space-y-3.5 shadow-sm flex flex-col justify-between hover:border-brand-primary/20 transition-all duration-300">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-semibold">الطلاب (نشط/كلي)</span>
              <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                <Users className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xl font-black text-slate-100">
                <span>{stats.active_students_count}</span>
                <span className="text-xs text-slate-500 font-normal"> / {stats.students_count}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-light">طالب مسجل (النشطين 30 يوم)</div>
            </div>
          </div>

          {/* Total Rev */}
          <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-3xl space-y-3.5 shadow-sm flex flex-col justify-between hover:border-brand-primary/20 transition-all duration-300">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-semibold">إجمالي الأرباح</span>
              <div className="p-2 bg-emerald-500/10 text-brand-success rounded-xl">
                <Wallet className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xl font-black text-brand-success">{parseFloat(stats.total_revenue).toFixed(2)} ج.م</div>
              <div className="text-[10px] text-slate-500 font-light">الأرباح التراكمية بالكامل</div>
            </div>
          </div>

          {/* Course Sales vs Exam Sales */}
          <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-3xl space-y-3.5 shadow-sm flex flex-col justify-between hover:border-brand-primary/20 transition-all duration-300">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-semibold">مبيعات الكورسات / الامتحانات</span>
              <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                <TrendingUp className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-slate-200">
                <div className="text-xs text-slate-400">الكورسات: <span className="font-black text-brand-primary">{parseFloat(stats.course_sales || '0').toFixed(0)}</span></div>
                <div className="text-xs text-slate-400">الامتحانات: <span className="font-black text-amber-500">{parseFloat(stats.exam_sales || '0').toFixed(0)}</span></div>
              </div>
            </div>
          </div>

          {/* Quizzes & Grade */}
          <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-3xl space-y-3.5 shadow-sm flex flex-col justify-between hover:border-brand-primary/20 transition-all duration-300">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-semibold">الاختبارات / متوسط الدرجات</span>
              <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                <ClipboardList className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xl font-black text-slate-100">
                <span>{stats.quizzes_count}</span>
                <span className="text-xs text-slate-500 font-normal"> ({stats.average_grade}%)</span>
              </div>
              <div className="text-[10px] text-slate-500 font-light">عدد الاختبارات ومتوسط الحل</div>
            </div>
          </div>

          {/* Watch Statistics */}
          <div className="bg-brand-card border border-[var(--border-color)] p-5 rounded-3xl space-y-3.5 shadow-sm flex flex-col justify-between hover:border-brand-primary/20 transition-all duration-300">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-semibold">إحصائيات المشاهدة</span>
              <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                <Award className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xl font-black text-slate-100">{stats.total_watch_hours} ساعة</div>
              <div className="text-[10px] text-slate-500 font-light">إجمالي زمن مشاهدة الطلاب للفيديوهات</div>
            </div>
          </div>

        </div>
      )}

      {/* Action links shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
        
        {/* Card 1 */}
        <Link to="/teacher/courses" className="bg-brand-card border border-[var(--border-color)] hover:border-brand-primary/30 p-8 rounded-3xl space-y-4 shadow-sm flex flex-col justify-between group">
          <div className="space-y-2">
            <h3 className="font-bold text-base group-hover:text-brand-primary transition-colors">إدارة الكورسات ومحاضرات الشرح</h3>
            <p className="text-xs text-slate-400 font-light leading-relaxed">أنشئ مواد جديدة، أضف الوحدات الدراسية، ارفع فيديوهات شرح ومذكرات ملخصة.</p>
          </div>
          <span className="text-xs text-brand-primary font-bold mt-4 flex items-center gap-1">المتابعة والتعديل ←</span>
        </Link>

        {/* Card 2 */}
        <Link to="/teacher/students" className="bg-brand-card border border-[var(--border-color)] hover:border-brand-primary/30 p-8 rounded-3xl space-y-4 shadow-sm flex flex-col justify-between group">
          <div className="space-y-2">
            <h3 className="font-bold text-base group-hover:text-brand-primary transition-colors">قائمة الطلاب ومتابعة تقدمهم</h3>
            <p className="text-xs text-slate-400 font-light leading-relaxed">شاهد إحصائيات ونسبة إتمام المشاهدة بالفيديو لكل طالب ونتائج اختباراتهم الأسبوعية والنهائية.</p>
          </div>
          <span className="text-xs text-brand-primary font-bold mt-4 flex items-center gap-1">عرض الطلاب والتقارير ←</span>
        </Link>

        {/* Card 3 */}
        <Link to="/teacher/exams" className="bg-brand-card border border-[var(--border-color)] hover:border-brand-primary/30 p-8 rounded-3xl space-y-4 shadow-sm flex flex-col justify-between group">
          <div className="space-y-2">
            <h3 className="font-bold text-base group-hover:text-brand-primary transition-colors">إدارة الاختبارات وتصحيح الواجبات يدوياً</h3>
            <p className="text-xs text-slate-400 font-light leading-relaxed">أنشئ اختبارات MCQ، صح وخطأ، أو أسئلة مقالية. تصفح حلول الواجبات ورصد درجاتها وكتابة ملاحظاتك للطلاب.</p>
          </div>
          <span className="text-xs text-brand-primary font-bold mt-4 flex items-center gap-1">تصحيح الامتحانات ←</span>
        </Link>

      </div>

      {/* Statistics Above Charts */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-[var(--border-color)]">
          {/* Card: Total Revenue */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 hover:border-brand-primary/20 transition-all shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold">💰 إجمالي الأرباح</span>
              <div className="p-2.5 bg-emerald-500/10 text-brand-success rounded-2xl">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-brand-success">
              {parseFloat(stats.total_revenue).toFixed(2)} ج.م
            </div>
          </div>

          {/* Card: Total Students */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 hover:border-brand-primary/20 transition-all shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold">👨‍🎓 إجمالي الطلاب</span>
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-indigo-400">
              {stats.students_count} طالب
            </div>
          </div>

          {/* Card: Growth Rate */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 hover:border-brand-primary/20 transition-all shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold">📈 معدل النمو</span>
              <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-2xl">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-500">
              {getGrowthRate()}
            </div>
          </div>

          {/* Card: Total Courses */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 hover:border-brand-primary/20 transition-all shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold">📚 إجمالي الكورسات</span>
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-2xl">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-400">
              {stats.courses_count} كورس
            </div>
          </div>
        </div>
      )}

      {/* Suggested Layout for Charts */}
      {stats && (
        <div className="space-y-8 pt-8">
          {!hasEnoughData ? (
            /* 3. Empty State */
            <div className="bg-brand-card border border-[var(--border-color)] h-[320px] text-center rounded-3xl flex flex-col items-center justify-center space-y-4 shadow-sm">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
                <AlertCircle className="h-8 w-8 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-slate-200">لا توجد بيانات كافية لعرض التحليلات حتى الآن</h3>
              <p className="text-xs text-slate-400 font-light max-w-xs leading-relaxed">
                ستظهر الإحصائيات تلقائياً بعد وجود اشتراكات وعمليات أكثر.
              </p>
            </div>
          ) : (
            <>
              {/* Revenue Bar Chart */}
              <div className="bg-brand-card border border-[var(--border-color)] p-6 sm:p-8 rounded-3xl space-y-6 shadow-sm">
                <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
                  <h3 className="font-bold text-base text-slate-200">📊 المبيعات والأرباح الشهرية</h3>
                  <span className="text-xs text-slate-400">الإيراد بالجنيه المصري (EGP)</span>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mergedChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2E333D" vertical={false} />
                      <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                      <Legend verticalAlign="top" height={36} align="right" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Bar name="صافي الإيراد (ج.م)" dataKey="revenue" fill="#10B981" radius={[8, 8, 0, 0]} maxBarSize={60} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Student Growth Line Chart */}
              <div className="bg-brand-card border border-[var(--border-color)] p-6 sm:p-8 rounded-3xl space-y-6 shadow-sm">
                <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
                  <h3 className="font-bold text-base text-slate-200">📈 نمو الاشتراكات الطلابية الجديدة</h3>
                  <span className="text-xs text-slate-400">معدل الانضمام الشهري</span>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mergedChartData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2E333D" vertical={false} />
                      <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} />
                      <RechartsTooltip content={<GrowthTooltip />} />
                      <Legend verticalAlign="top" height={36} align="right" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Area name="الاشتراكات الجديدة" type="monotone" dataKey="subscriptions" stroke="#6366F1" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: '#1E293B' }} activeDot={{ r: 7 }} fillOpacity={1} fill="url(#colorGrowth)" animationDuration={1200} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Revenue by Course Pie Chart */}
              {pieData.length > 0 && (
                <div className="bg-brand-card border border-[var(--border-color)] p-6 sm:p-8 rounded-3xl space-y-6 shadow-sm">
                  <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
                    <h3 className="font-bold text-base text-slate-200">🍰 توزيع الأرباح حسب الكورس</h3>
                    <span className="text-xs text-slate-400">نسبة المشتركين بالمواد</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            animationDuration={1500}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip content={<PieTooltip />} />
                          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Course list summary table inside Pie section */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-xs text-slate-400 border-b border-[var(--border-color)] pb-2">جدول التوزيع التفصيلي للكورسات</h4>
                      <div className="divide-y divide-[var(--border-color)] max-h-56 overflow-y-auto pr-1">
                        {stats.course_performance?.map((c, index) => (
                          <div key={c.id} className="py-2.5 flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                              <span className="font-semibold text-slate-350">{c.title}</span>
                            </div>
                            <span className="font-bold text-slate-200">{c.students_count} مشترك</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Monthly Packages Section */}
      {stats && stats.packages && (
        <div className="space-y-6 pt-12 border-t border-[var(--border-color)]">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-brand-primary" />
                <span>الباقات المجمعة النشطة (الاشتراكات الشهرية)</span>
              </h2>
              <p className="text-xs text-slate-400 font-light mt-1">تصفح وعدل الباقات الشهرية المفعلة لطلابك بكافة الكورسات</p>
            </div>
            <Link
              to="/teacher/courses"
              className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1"
            >
              <span>+ بناء باقة جديدة</span>
            </Link>
          </div>

          {stats.packages.length === 0 ? (
            <div className="bg-brand-card border border-[var(--border-color)] p-12 text-center rounded-3xl text-slate-500 font-light text-sm">
              لا توجد أي باقات مجمعة منشأة حالياً. اذهب لصفحة إدارة الكورسات لبناء أول باقة.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.packages.map((pkg) => (
                <div key={pkg.id} className="bg-brand-card border border-border-color rounded-3xl overflow-hidden hover:border-brand-primary/30 hover:shadow-xl transition-all duration-300 group flex flex-col justify-between shadow-md">
                  {/* Thumbnail area */}
                  <div className="aspect-video bg-brand-surface relative overflow-hidden">
                    <img 
                      src={pkg.package_thumbnail || pkg.cover_image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} 
                      alt={pkg.title} 
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute top-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md text-white rounded-full text-[10px] font-black border border-white/10">
                      باقة مجمعة
                    </div>
                  </div>

                  <div className="p-6 space-y-4 flex-grow flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-base text-foreground group-hover:text-brand-primary transition-colors">{pkg.title}</h3>
                          <span className="text-[10px] text-text-secondary font-light block mt-0.5">الكورس: {pkg.course?.title}</span>
                        </div>
                        <span className="text-xs font-bold text-brand-success bg-brand-success/10 px-2 py-1 rounded-lg shrink-0">
                          {pkg.price} ج.م
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] text-text-secondary font-light pt-2">
                        <div>عدد الكورسات: 1</div>
                        <div>عدد المحاضرات: {pkg.lessons?.length || pkg.lessons_count || 0}</div>
                        <div className="col-span-2">عدد المشتركين: {pkg.enrollments_count || 0} طالباً</div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-border-color">
                      <button
                        onClick={() => handleEditPackageClick(pkg)}
                        className="flex-1 py-2.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Edit3 className="h-4 w-4" /> <span>تعديل</span>
                      </button>
                      <button
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/10 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Trash2 className="h-4 w-4" /> <span>حذف</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Package Edit Form Modal */}
      {showPackageForm && editPackageMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowPackageForm(false); setEditPackageMode(null); }} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] z-10 text-right">
            <h3 className="text-lg font-black border-b border-[var(--border-color)] pb-3">تعديل الباقة المجمعة</h3>
            
            <form onSubmit={handleSavePackage} className="space-y-4 text-right">
              
              <div className="space-y-1">
                <label className="text-xs font-semibold">عنوان الباقة</label>
                <input
                  type="text"
                  required
                  value={packageTitle}
                  onChange={(e) => setPackageTitle(e.target.value)}
                  placeholder="مثال: باقة محاضرات شهر أكتوبر كيمياء..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">سعر الباقة المجمعة (ج.م)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={packagePrice}
                  onChange={(e) => setPackagePrice(e.target.value)}
                  placeholder="مثال: 80.00"
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">وصف الباقة المجمعة</label>
                <textarea
                  value={packageDesc}
                  onChange={(e) => setPackageDesc(e.target.value)}
                  placeholder="مثال: تشمل الباقة جميع محاضرات الباب الأول في الكيمياء العضوية..."
                  rows={3}
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none resize-none text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">رابط غلاف الباقة (اختياري)</label>
                <input
                  type="text"
                  value={packageCoverImage}
                  onChange={(e) => setPackageCoverImage(e.target.value)}
                  placeholder="رابط الصورة أو اتركها فارغة لاستخدام غلاف الكورس"
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold block">صورة الباقة المجمعة (تحميل مباشر)</label>
                
                {/* Drag & Drop area */}
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const formData = new FormData();
                      formData.append('file', file);
                      setUploadingThumbnail(true);
                      try {
                        const res = await API.post('/upload', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                        });
                        setPackageThumbnail(res.data.url);
                        useModalStore.getState().showToast('تم رفع صورة الباقة بنجاح.', 'success');
                      } catch (err) {
                        useModalStore.getState().showToast('فشل الرفع.', 'error');
                      } finally {
                        setUploadingThumbnail(false);
                      }
                    }
                  }}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                    isDragOver ? 'border-brand-primary bg-brand-primary/5' : 'border-border-color bg-brand-surface/10'
                  }`}
                >
                  {packageThumbnail ? (
                    <div className="space-y-3">
                      <img src={packageThumbnail} alt="Preview" className="h-28 mx-auto rounded-xl object-cover aspect-video border border-border-color" />
                      <button 
                        type="button" 
                        onClick={() => setPackageThumbnail('')}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black"
                      >
                        إزالة الصورة
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <span className="text-[10px] text-text-secondary block font-bold">اسحب صورة الباقة وأفلتها هنا، أو اضغط على الزر أدناه</span>
                      <label className="inline-block px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow shadow-brand-primary/10">
                        <span>اختر صورة للباقة</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const formData = new FormData();
                              formData.append('file', file);
                              setUploadingThumbnail(true);
                              try {
                                const res = await API.post('/upload', formData, {
                                  headers: { 'Content-Type': 'multipart/form-data' },
                                });
                                setPackageThumbnail(res.data.url);
                                useModalStore.getState().showToast('تم رفع صورة الباقة بنجاح.', 'success');
                              } catch (err) {
                                useModalStore.getState().showToast('فشل الرفع.', 'error');
                              } finally {
                                setUploadingThumbnail(false);
                              }
                            }
                          }}
                        />
                      </label>
                      {uploadingThumbnail && (
                        <div className="text-[10px] text-brand-primary animate-pulse font-bold">جاري رفع الصورة...</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">اختر المحاضرات التابعة للباقة:</label>
                
                <div className="space-y-2 border border-[var(--border-color)] p-4 rounded-2xl max-h-40 overflow-y-auto bg-[rgba(0,0,0,0.05)]">
                  {courseLessons.length === 0 ? (
                    <div className="text-center py-4 text-[10px] text-slate-500 font-light">لا توجد محاضرات مضافة بالكورس لتضمينها بالباقة بعد.</div>
                  ) : (
                    courseLessons.map((lesson) => {
                      const isChecked = selectedLessons.includes(lesson.id)
                      return (
                        <button
                          type="button"
                          key={lesson.id}
                          onClick={() => toggleLessonInPackage(lesson.id)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition-colors ${
                            isChecked ? 'border-brand-primary bg-brand-primary/5 text-slate-100 font-bold' : 'border-[var(--border-color)] text-slate-400'
                          }`}
                        >
                          <span className="text-xs">{lesson.title}</span>
                          {isChecked && <Check className="h-4 w-4 text-brand-primary" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => { setShowPackageForm(false); setEditPackageMode(null); }} className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl">إلغاء</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl">
                  {actionLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
