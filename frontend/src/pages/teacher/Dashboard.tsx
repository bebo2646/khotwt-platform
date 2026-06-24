import React from 'react'
import { Link } from 'react-router-dom'
import API from '../../services/api'
import { BookOpen, Users, Wallet, TrendingUp, Award, ClipboardList, Package, Edit3, Trash2, Check } from 'lucide-react'
import { useModalStore } from '../../store/modalStore'

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
      <div className="flex justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
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

      {/* Charts and Analytics Section */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-12 border-t border-[var(--border-color)] text-right" dir="rtl">
          
          {/* Enrollments growth chart */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-6 shadow-sm">
            <h3 className="font-bold text-base text-slate-200">النمو والاشتراكات الشهرية للطلاب</h3>
            <div className="h-64 flex items-end justify-between gap-4 pt-6 pb-2 px-4 bg-slate-950/40 rounded-2xl border border-slate-900">
              {stats.enrollments_chart && stats.enrollments_chart.length > 0 ? (
                stats.enrollments_chart.map((item, idx) => {
                  const maxVal = Math.max(...stats.enrollments_chart!.map(i => i.count), 5)
                  const heightPercent = (item.count / maxVal) * 100
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative h-full justify-end">
                      <span className="absolute -top-10 scale-0 group-hover:scale-100 bg-brand-primary text-slate-950 text-[10px] font-black px-2 py-1 rounded shadow-md transition-all duration-200 z-10">
                        {item.count} طالب
                      </span>
                      <div 
                        className="w-full bg-gradient-to-t from-brand-primary to-brand-secondary rounded-t-lg transition-all duration-500 group-hover:opacity-90 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                        style={{ height: `${Math.max(5, heightPercent)}%` }}
                      />
                      <span className="text-[10px] text-slate-400 font-light truncate max-w-full">{item.month}</span>
                    </div>
                  )
                })
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">لا توجد بيانات اشتراكات مسجلة بعد.</div>
              )}
            </div>
          </div>

          {/* Revenue split chart */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-6 shadow-sm">
            <h3 className="font-bold text-base text-slate-200">المبيعات والأرباح الشهرية (ج.م)</h3>
            <div className="h-64 flex items-end justify-between gap-4 pt-6 pb-2 px-4 bg-slate-950/40 rounded-2xl border border-slate-900">
              {stats.revenue_chart && stats.revenue_chart.length > 0 ? (
                stats.revenue_chart.map((item, idx) => {
                  const maxVal = Math.max(...stats.revenue_chart!.map(i => parseFloat(i.total)), 100)
                  const heightPercent = (parseFloat(item.total) / maxVal) * 100
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative h-full justify-end">
                      <span className="absolute -top-10 scale-0 group-hover:scale-100 bg-brand-secondary text-slate-950 text-[10px] font-black px-2 py-1 rounded shadow-md transition-all duration-200 z-10">
                        {parseFloat(item.total).toFixed(0)} ج.م
                      </span>
                      <div 
                        className="w-full bg-gradient-to-t from-brand-secondary to-brand-accent rounded-t-lg transition-all duration-500 group-hover:opacity-90 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                        style={{ height: `${Math.max(5, heightPercent)}%` }}
                      />
                      <span className="text-[10px] text-slate-400 font-light truncate max-w-full">{item.month}</span>
                    </div>
                  )
                })
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">لا توجد أرباح مسجلة بعد.</div>
              )}
            </div>
          </div>

          {/* Course Performance chart and list */}
          <div className="lg:col-span-2 bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
            <h3 className="font-bold text-base text-slate-200">أداء الكورسات ونسبة إنجاز مشاهدات الطلاب</h3>
            <div className="divide-y divide-[var(--border-color)]">
              {stats.course_performance && stats.course_performance.length > 0 ? (
                stats.course_performance.map((c) => (
                  <div key={c.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 sm:max-w-xs w-full text-right">
                      <h4 className="font-bold text-sm text-slate-200">{c.title}</h4>
                      <p className="text-[10px] text-slate-500 font-light">الطلاب المشتركين: {c.students_count} طالب</p>
                    </div>

                    <div className="flex-grow max-w-md w-full flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">متوسط إنجاز الشرح بالفيديو:</span>
                      <div className="flex-grow h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                        <div 
                          className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full transition-all duration-500" 
                          style={{ width: `${c.avg_progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-brand-primary shrink-0">{c.avg_progress}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs font-light">لا توجد مواد مسجلة لعرض بيانات أدائها حالياً.</div>
              )}
            </div>
          </div>

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
