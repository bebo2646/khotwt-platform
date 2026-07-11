import React from 'react'
import API from '../../services/api'
import { SafeResponsiveContainer } from '../../components/ui/SafeResponsiveContainer'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { 
  FileDown, RefreshCw, BarChart2, DollarSign, BookOpen, AlertCircle, 
  Coins, Filter, Search, Calendar, ChevronDown, ChevronRight, X, Eye, 
  Users, Wallet, GraduationCap, Percent, TrendingUp, Clock, BookOpen as BookIcon,
  Award, FileText, CheckCircle, Printer, HelpCircle
} from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import { useModalStore } from '../../store/modalStore'

interface TransactionItem {
  id: number
  created_at: string
  student: {
    id: number
    name: string
    email: string
    phone: string
  }
  teacher: {
    id: number
    name: string
    subject: string
  }
  product_type: string
  product_name: string
  course_name: string
  bundle_name: string
  original_price: number
  discount: number
  final_paid_amount: number
  teacher_share: number
  platform_share: number
  payment_method: string
  wallet_transaction_id: number | null
  status: string
  activation_time: string
}

interface DailyReportItem {
  date: string
  total_revenue: number
  platform_earnings: number
  teachers_earnings: number
  purchases_count: number
  new_students_count: number
  courses_sold: number
  bundles_sold: number
  monthly_packages_sold: number
  revision_packages_sold: number
  standalone_sold: number
}

interface TeacherStatsItem {
  teacher: {
    id: number
    name: string
    subject: string
  }
  total_revenue: number
  today_revenue: number
  week_revenue: number
  month_revenue: number
  year_revenue: number
  sales_count: number
  avg_order_value: number
  top_selling_products: string
  pending_payouts: number
  completed_payouts: number
}

interface StudentStatsItem {
  student: {
    id: number
    name: string
    email: string
    phone: string
  }
  total_spending: number
  purchases_count: number
  last_purchase_date: string | null
  favorite_teacher: string
  favorite_subject: string
  favorite_product_type: string
}

export default function FinancialAnalytics() {
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'transactions' | 'daily' | 'teachers' | 'students'>('dashboard')
  const [loading, setLoading] = React.useState(true)

  // Filters
  const [range, setRange] = React.useState('this_month')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [teacherId, setTeacherId] = React.useState('')
  const [studentId, setStudentId] = React.useState('')
  const [courseId, setCourseId] = React.useState('')
  const [packageId, setPackageId] = React.useState('')
  const [productType, setProductType] = React.useState('')
  const [paymentMethod, setPaymentMethod] = React.useState('')
  const [purchaseType, setPurchaseType] = React.useState('')
  const [priceMin, setPriceMin] = React.useState('')
  const [priceMax, setPriceMax] = React.useState('')
  const [grade, setGrade] = React.useState('')
  const [subject, setSubject] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [studentSearch, setStudentSearch] = React.useState('')

  // Lists for reference dropdowns
  const [teachersList, setTeachersList] = React.useState<any[]>([])
  const [coursesList, setCoursesList] = React.useState<any[]>([])
  const [packagesList, setPackagesList] = React.useState<any[]>([])

  // Dashboard Data
  const [summary, setSummary] = React.useState<any>({})
  const [dailyChart, setDailyChart] = React.useState<any[]>([])
  const [weeklyChart, setWeeklyChart] = React.useState<any[]>([])
  const [monthlyChart, setMonthlyChart] = React.useState<any[]>([])
  const [yearlyChart, setYearlyChart] = React.useState<any[]>([])
  const [teacherChart, setTeacherChart] = React.useState<any[]>([])
  const [subjectChart, setSubjectChart] = React.useState<any[]>([])
  const [gradeChart, setGradeChart] = React.useState<any[]>([])
  const [productTypeChart, setProductTypeChart] = React.useState<any[]>([])
  const [topCoursesChart, setTopCoursesChart] = React.useState<any[]>([])
  const [topBundlesChart, setTopBundlesChart] = React.useState<any[]>([])
  const [topTeachersChart, setTopTeachersChart] = React.useState<any[]>([])
  const [topStudentsChart, setTopStudentsChart] = React.useState<any[]>([])

  // Transaction Data
  const [transactions, setTransactions] = React.useState<TransactionItem[]>([])
  const [currentPage, setCurrentPage] = React.useState(1)
  const [lastPage, setLastPage] = React.useState(1)
  const [totalTransactions, setTotalTransactions] = React.useState(0)
  const [selectedTransaction, setSelectedTransaction] = React.useState<TransactionItem | null>(null)

  // Daily report Data
  const [dailyReports, setDailyReports] = React.useState<DailyReportItem[]>([])

  // Teacher Revenue Data
  const [teacherReport, setTeacherReport] = React.useState<TeacherStatsItem[]>([])

  // Student Purchase Data
  const [studentReport, setStudentReport] = React.useState<StudentStatsItem[]>([])
  const [studentPage, setStudentPage] = React.useState(1)
  const [studentLastPage, setStudentLastPage] = React.useState(1)

  // Fetch reference lists
  React.useEffect(() => {
    API.get('/admin/teachers').then((res) => setTeachersList(res.data.teachers || res.data || []))
    API.get('/admin/courses').then((res) => setCoursesList(res.data.courses || res.data.data || []))
    API.get('/admin/packages').then((res) => {
      // Find package types, filtering for bundles if needed or showing all packages
      const pkgs = res.data.packages || res.data.data || res.data || []
      setPackagesList(pkgs)
    }).catch(err => console.error("Error loading packages:", err))
  }, [])

  // Clear all filters helper
  const handleClearFilters = () => {
    setRange('this_month')
    setStartDate('')
    setEndDate('')
    setTeacherId('')
    setStudentId('')
    setCourseId('')
    setPackageId('')
    setProductType('')
    setPaymentMethod('')
    setPurchaseType('')
    setPriceMin('')
    setPriceMax('')
    setGrade('')
    setSubject('')
    setStatus('')
    setStudentSearch('')
    setCurrentPage(1)
    setStudentPage(1)
  }

  // Load active tab data
  const fetchData = React.useCallback(async () => {
    setLoading(true)
    const params = {
      range,
      start_date: startDate,
      end_date: endDate,
      teacher_id: teacherId,
      student_id: studentId,
      course_id: courseId,
      package_id: packageId,
      product_type: productType,
      payment_method: paymentMethod,
      purchase_type: purchaseType,
      min_price: priceMin,
      max_price: priceMax,
      grade,
      subject,
      status,
    }

    try {
      if (activeTab === 'dashboard') {
        const res = await API.get('/admin/financial/dashboard', { params })
        setSummary(res.data.summary)
        setDailyChart(res.data.charts.daily_revenue || [])
        setWeeklyChart(res.data.charts.weekly_revenue || [])
        setMonthlyChart(res.data.charts.monthly_revenue || [])
        setYearlyChart(res.data.charts.yearly_revenue || [])
        setTeacherChart(res.data.charts.revenue_per_teacher || [])
        setSubjectChart(res.data.charts.revenue_per_subject || [])
        setGradeChart(res.data.charts.revenue_per_grade || [])
        setProductTypeChart(res.data.charts.revenue_by_product_type || [])
        setTopCoursesChart(res.data.charts.top_selling_courses || [])
        setTopBundlesChart(res.data.charts.top_selling_bundles || [])
        setTopTeachersChart(res.data.charts.top_teachers || [])
        setTopStudentsChart(res.data.charts.top_students_by_spending || [])
      } else if (activeTab === 'transactions') {
        const res = await API.get('/admin/financial/transactions', { 
          params: { ...params, page: currentPage } 
        })
        setTransactions(res.data.data || [])
        setLastPage(res.data.last_page || 1)
        setTotalTransactions(res.data.total || 0)
      } else if (activeTab === 'daily') {
        const res = await API.get('/admin/financial/daily-report', { params })
        setDailyReports(res.data || [])
      } else if (activeTab === 'teachers') {
        const res = await API.get('/admin/financial/teachers', { params })
        setTeacherReport(res.data || [])
      } else if (activeTab === 'students') {
        const res = await API.get('/admin/financial/students', { 
          params: { ...params, search: studentSearch, page: studentPage } 
        })
        setStudentReport(res.data.data || [])
        setStudentLastPage(res.data.last_page || 1)
      }
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('حدث خطأ أثناء تحميل البيانات المالية من السيرفر.', 'error')
    } finally {
      setLoading(false)
    }
  }, [activeTab, range, startDate, endDate, teacherId, studentId, courseId, packageId, productType, paymentMethod, purchaseType, priceMin, priceMax, grade, subject, status, currentPage, studentSearch, studentPage])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Trigger export CSV from the optimized streaming API
  const handleExportCSV = async () => {
    try {
      const params = {
        range,
        start_date: startDate,
        end_date: endDate,
        teacher_id: teacherId,
        student_id: studentId,
        course_id: courseId,
        package_id: packageId,
        product_type: productType,
        payment_method: paymentMethod,
        purchase_type: purchaseType,
        min_price: priceMin,
        max_price: priceMax,
        grade,
        subject,
        status,
      }
      
      const response = await API.get('/admin/financial/export', {
        params,
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `financial_report_${Date.now()}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      useModalStore.getState().showToast('تم تصدير التقرير الكامل كملف CSV بنجاح.', 'success')
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('حدث خطأ أثناء تصدير التقرير المالي.', 'error')
    }
  }

  const handlePrintReport = () => {
    window.print()
  }

  return (
    <div className="space-y-6 pb-12 text-right antialiased font-sans">
      {/* Printable Report Header Helper */}
      <div className="hidden print:block text-center border-b pb-4 mb-6">
        <h1 className="text-2xl font-black text-slate-900">التقرير المالي والحسابات الختامية للمنصة</h1>
        <p className="text-sm text-slate-600 mt-2">تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')} - الوقت الحالي: {new Date().toLocaleTimeString('ar-EG')}</p>
        <p className="text-xs text-slate-500 mt-1">الفلاتر المطبقة: {range === 'custom' ? `من ${startDate} إلى ${endDate}` : `فترة: ${range}`}</p>
      </div>

      {/* Header and Exporters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-brand-card p-6 border border-[var(--border-color)] rounded-3xl print:hidden">
        <div>
          <h2 className="text-xl font-black text-slate-200">التحليلات المالية وتتبع الإيرادات</h2>
          <p className="text-xs text-slate-400 mt-1 font-light">نظام الرقابة المالية والحسابات الكامل للمبيعات، أنصبة المعلمين، المسحوبات والعمولات.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 hover:border-transparent rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileDown className="h-4 w-4" /> <span>تصدير Excel / CSV</span>
          </button>
          <button
            onClick={handlePrintReport}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-transparent rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="h-4 w-4" /> <span>طباعة التقرير / PDF</span>
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-350 border border-[var(--border-color)] rounded-2xl transition-all cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex overflow-x-auto gap-1.5 bg-brand-card border border-[var(--border-color)] p-1.5 rounded-2xl print:hidden">
        {[
          { key: 'dashboard', label: 'لوحة التحكم والتحليلات البيانية' },
          { key: 'transactions', label: 'سجل المبيعات والعمليات' },
          { key: 'daily', label: 'التقارير الحسابية اليومية' },
          { key: 'teachers', label: 'إيرادات ومستحقات المعلمين' },
          { key: 'students', label: 'حسابات الطلاب ومشترياتهم' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key as any)
              setCurrentPage(1)
            }}
            className={`px-4.5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/20 font-bold'
                : 'text-slate-400 hover:bg-[rgba(255,255,255,0.02)] hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Advanced Filters Grid */}
      <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 print:hidden">
        <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
          <button
            onClick={handleClearFilters}
            className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
          >
            تفريغ الفلاتر وتصفير المعاينة
          </button>
          <h4 className="text-xs font-black text-slate-200 flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-indigo-400" />
            <span>لوحة فلاتر البحث والفلترة المتقاطعة (تعمل معاً)</span>
          </h4>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">الفترة الزمنية</label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="today">اليوم</option>
              <option value="yesterday">أمس</option>
              <option value="last_7_days">آخر 7 أيام</option>
              <option value="last_30_days">آخر 30 يوماً</option>
              <option value="this_month">هذا الشهر</option>
              <option value="last_month">الشهر الماضي</option>
              <option value="this_year">هذه السنة</option>
              <option value="custom">مخصص (تاريخ محدد)</option>
            </select>
          </div>

          {range === 'custom' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">تاريخ البدء</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-250 focus:outline-none focus:border-indigo-500 text-right"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">تاريخ الانتهاء</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-250 focus:outline-none focus:border-indigo-500 text-right"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">المعلم</label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">الكل</option>
              {teachersList.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">الطالب (كود ID)</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="مثال: 5"
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">الكورس</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">الكل</option>
              {coursesList.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">الباقات والحزم</label>
            <select
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">الكل</option>
              {packagesList.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({p.type === 'bundle' ? 'حزمة' : p.type === 'month' ? 'شهري' : 'مراجعة'})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">الصف الدراسي</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">الكل</option>
              <option value="1">الصف الأول الثانوي</option>
              <option value="2">الصف الثاني الثانوي</option>
              <option value="3">الصف الثالث الثانوي</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">المادة الدراسية</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثال: فيزياء، رياضيات"
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">نوع المنتج</label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">الكل</option>
              <option value="course">Course (كورس كامل)</option>
              <option value="bundle">Bundle (حزمة محاضرات)</option>
              <option value="month">Monthly Package (اشتراك شهري)</option>
              <option value="revision">Revision Package (مراجعة نهائية)</option>
              <option value="lesson">Standalone Lecture (محاضرة منفردة)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">طريقة الدفع</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">الكل</option>
              <option value="wallet">المحفظة الإلكترونية</option>
              <option value="code">أكواد الشحن الورقية</option>
              <option value="fawry">فوري</option>
              <option value="instapay">إنستاباي</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">نوع الشراء</label>
            <select
              value={purchaseType}
              onChange={(e) => setPurchaseType(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.02)] border border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">الكل</option>
              <option value="direct">شراء مباشر (رصيد المحفظة)</option>
              <option value="code">تفعيل كود شراء</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">سعر العملية (الحد الأدنى)</label>
            <input
              type="number"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              placeholder="0"
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">سعر العملية (الحد الأقصى)</label>
            <input
              type="number"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="1000"
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">حالة المعاملة</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">الكل</option>
              <option value="paid">مدفوعة ومكتملة (Paid)</option>
              <option value="refunded">مسترجعة (Refunded)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-brand-card border border-[var(--border-color)] rounded-3xl">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <span className="text-xs text-slate-400 font-light mt-3">جاري تجميع الحسابات الحسابية وتصفية النتائج الحالية...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: DASHBOARD ANALYTICS */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Financial Metrics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {[
                  { title: "إيرادات اليوم", val: summary.today, icon: <DollarSign className="w-5 h-5 text-indigo-400" />, desc: "آخر 24 ساعة" },
                  { title: "إيرادات أمس", val: summary.yesterday, icon: <Clock className="w-5 h-5 text-amber-400" />, desc: "أمس بالكامل" },
                  { title: "إيرادات الأسبوع الحالي", val: summary.week, icon: <TrendingUp className="w-5 h-5 text-emerald-400" />, desc: "هذا الأسبوع" },
                  { title: "إيرادات الشهر الحالي", val: summary.month, icon: <Calendar className="w-5 h-5 text-sky-400" />, desc: "هذا الشهر" },
                  { title: "إيرادات العام الحالي", val: summary.year, icon: <Coins className="w-5 h-5 text-purple-400" />, desc: "هذا العام" },
                  { title: "الفترة المحددة مخصصة", val: summary.filtered_total, icon: <Coins className="w-5 h-5 text-rose-400" />, desc: "فترة الفلترة الحالية", highlight: true },
                ].map((c, i) => (
                  <div key={i} className={`bg-brand-card border p-5 rounded-2xl text-right flex flex-col justify-between ${c.highlight ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-[var(--border-color)]'}`}>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] text-slate-400 font-bold">{c.title}</span>
                      {c.icon}
                    </div>
                    <div className="mt-3">
                      <span className="text-lg font-black text-slate-100">{(c.val || 0).toLocaleString()} <span className="text-xs font-bold text-slate-450">ج.م</span></span>
                      <p className="text-[9px] text-slate-450 mt-1 font-light">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Commission Cards Split */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { title: "صافي أرباح المنصة", val: summary.platform_net_profit, icon: <Percent className="w-5 h-5 text-indigo-400" />, desc: "العمولة المحصلة للمنصة" },
                  { title: "إيرادات المعلمين الكلية", val: summary.teachers_earnings, icon: <Users className="w-5 h-5 text-emerald-400" />, desc: "أنصبة المدرسين الكلية" },
                  { title: "عمولة المنصة الكلية", val: summary.platform_commission, icon: <Percent className="w-5 h-5 text-pink-400" />, desc: `نسبة متوسطة: ${summary.average_commission_percentage}%` },
                  { title: "مسحوبات قيد الانتظار", val: summary.pending_withdrawals, icon: <Clock className="w-5 h-5 text-amber-400" />, desc: "طلبات سحب معلقة للمدرسين" },
                  { title: "مسحوبات مكتملة ومحولة", val: summary.completed_withdrawals, icon: <Wallet className="w-5 h-5 text-sky-400" />, desc: "المبالغ المحولة بالفعل" },
                ].map((c, i) => (
                  <div key={i} className="bg-brand-card border border-[var(--border-color)] p-5 rounded-2xl text-right flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] text-slate-400 font-bold">{c.title}</span>
                      {c.icon}
                    </div>
                    <div className="mt-3">
                      <span className="text-lg font-black text-slate-100">{(c.val || 0).toLocaleString()} <span className="text-xs font-bold text-slate-450">ج.م</span></span>
                      <p className="text-[9px] text-slate-450 mt-1 font-light">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Daily Revenue Chart */}
                <div className="lg:col-span-2 bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-normal">عدد الأيام النشطة: {dailyChart.length} يوم</span>
                    <span>مخطط الإيرادات اليومية</span>
                  </h5>
                  <div className="h-64">
                    {dailyChart.length > 0 ? (
                      <SafeResponsiveContainer height={256}>
                        <AreaChart data={dailyChart}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} />
                          <YAxis stroke="#94a3b8" fontSize={9} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', textAlign: 'right' }} />
                          <Area type="monotone" dataKey="total" name="الإيرادات الكلية" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                        </AreaChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد بيانات مخطط مبيعات يومية متوفرة" />
                    )}
                  </div>
                </div>

                {/* 2. Product Type Split Chart */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4">مبيعات المنصة حسب نوع المنتج</h5>
                  <div className="h-64">
                    {productTypeChart.some((d: any) => d.value > 0) ? (
                      <SafeResponsiveContainer height={256}>
                        <BarChart data={productTypeChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} />
                          <YAxis stroke="#94a3b8" fontSize={9} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', textAlign: 'right' }} />
                          <Bar dataKey="value" name="المبيعات الكلية" fill="#10b981" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد أرباح حسب نوع المنتج" />
                    )}
                  </div>
                </div>

                {/* 3. Weekly Revenue Chart */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4">تحليل الإيرادات الأسبوعية</h5>
                  <div className="h-64">
                    {weeklyChart.length > 0 ? (
                      <SafeResponsiveContainer height={256}>
                        <BarChart data={weeklyChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={8} />
                          <YAxis stroke="#94a3b8" fontSize={9} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', textAlign: 'right' }} />
                          <Bar dataKey="value" name="مبيعات الأسبوع" fill="#6366f1" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد بيانات أسبوعية" />
                    )}
                  </div>
                </div>

                {/* 4. Monthly Revenue Chart */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4">تحليل الإيرادات الشهرية</h5>
                  <div className="h-64">
                    {monthlyChart.length > 0 ? (
                      <SafeResponsiveContainer height={256}>
                        <BarChart data={monthlyChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} />
                          <YAxis stroke="#94a3b8" fontSize={9} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', textAlign: 'right' }} />
                          <Bar dataKey="value" name="مبيعات الشهر" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد بيانات شهرية" />
                    )}
                  </div>
                </div>

                {/* 5. Yearly Revenue Chart */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4">تحليل الإيرادات السنوية</h5>
                  <div className="h-64">
                    {yearlyChart.length > 0 ? (
                      <SafeResponsiveContainer height={256}>
                        <BarChart data={yearlyChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} />
                          <YAxis stroke="#94a3b8" fontSize={9} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', textAlign: 'right' }} />
                          <Bar dataKey="value" name="مبيعات السنة" fill="#ec4899" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد بيانات سنوية" />
                    )}
                  </div>
                </div>

                {/* 6. Revenue Per Teacher */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4">الأكثر مبيعاً من المدرسين</h5>
                  <div className="h-64">
                    {teacherChart.length > 0 ? (
                      <SafeResponsiveContainer height={256}>
                        <BarChart data={teacherChart} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                          <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={8} width={75} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', textAlign: 'right' }} />
                          <Bar dataKey="value" name="إيرادات" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد بيانات مدرسين متوفرة" />
                    )}
                  </div>
                </div>

                {/* 7. Subject Split Chart */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4">مبيعات المنصة حسب المواد الدراسية</h5>
                  <div className="h-64">
                    {subjectChart.length > 0 ? (
                      <SafeResponsiveContainer height={256}>
                        <BarChart data={subjectChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} />
                          <YAxis stroke="#94a3b8" fontSize={9} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', textAlign: 'right' }} />
                          <Bar dataKey="value" name="المبيعات" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد مبيعات للمواد" />
                    )}
                  </div>
                </div>

                {/* 8. Grade Split Chart */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4">مبيعات المنصة حسب الصفوف الدراسية</h5>
                  <div className="h-64">
                    {gradeChart.length > 0 ? (
                      <SafeResponsiveContainer height={256}>
                        <BarChart data={gradeChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} />
                          <YAxis stroke="#94a3b8" fontSize={9} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', textAlign: 'right' }} />
                          <Bar dataKey="value" name="المبيعات" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد مبيعات للصفوف" />
                    )}
                  </div>
                </div>

                {/* 9. Top Selling Courses */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4">الكورسات الأكثر مبيعاً (Top Courses)</h5>
                  <div className="h-64">
                    {topCoursesChart.length > 0 ? (
                      <SafeResponsiveContainer height={256}>
                        <BarChart data={topCoursesChart} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                          <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={8} width={75} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', textAlign: 'right' }} />
                          <Bar dataKey="sales_count" name="عدد المبيعات" fill="#10b981" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد بيانات كورسات مبيعاً" />
                    )}
                  </div>
                </div>

                {/* 10. Top Selling Bundles */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4">الحزم والمحاضرات المجمعة الأكثر مبيعاً</h5>
                  <div className="h-64">
                    {topBundlesChart.length > 0 ? (
                      <SafeResponsiveContainer height={256}>
                        <BarChart data={topBundlesChart} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                          <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={8} width={75} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', textAlign: 'right' }} />
                          <Bar dataKey="sales_count" name="عدد المبيعات" fill="#ec4899" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد مبيعات للحزم" />
                    )}
                  </div>
                </div>

                {/* 11. Top Teachers */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4">أعلى المدرسين تحقيقاً للإيرادات</h5>
                  <div className="h-64">
                    {topTeachersChart.length > 0 ? (
                      <SafeResponsiveContainer height={256}>
                        <BarChart data={topTeachersChart} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                          <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={8} width={75} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', textAlign: 'right' }} />
                          <Bar dataKey="value" name="مبيعات كلية (ج.م)" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد بيانات مدرسين" />
                    )}
                  </div>
                </div>

                {/* 12. Top Students by Spending */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4">الطلاب الأكثر إنفاقاً للمشتريات</h5>
                  <div className="h-64">
                    {topStudentsChart.length > 0 ? (
                      <SafeResponsiveContainer height={256}>
                        <BarChart data={topStudentsChart} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                          <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={8} width={75} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', textAlign: 'right' }} />
                          <Bar dataKey="value" name="إجمالي الإنفاق (ج.م)" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <EmptyState type="general" title="لا توجد بيانات إنفاق" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DETAILED TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden text-right">
              <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
                <span className="text-xs text-slate-400 font-light">إجمالي المبيعات المفلترة: {totalTransactions} عملية</span>
                <h5 className="font-bold text-sm text-slate-200">سجل المدفوعات والعمليات التفصيلية</h5>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-350">
                  <thead className="bg-[rgba(255,255,255,0.01)] text-[10px] uppercase font-bold text-slate-400 border-b border-[var(--border-color)]">
                    <tr>
                      <th className="px-6 py-4 text-right">التاريخ والوقت</th>
                      <th className="px-6 py-4 text-right">العملية ID</th>
                      <th className="px-6 py-4 text-right">اسم الطالب</th>
                      <th className="px-6 py-4 text-right">كود الطالب</th>
                      <th className="px-6 py-4 text-right">اسم المعلم</th>
                      <th className="px-6 py-4 text-right">كود المعلم</th>
                      <th className="px-6 py-4 text-right">نوع المنتج</th>
                      <th className="px-6 py-4 text-right">اسم المنتج</th>
                      <th className="px-6 py-4 text-right">السعر الأصلي</th>
                      <th className="px-6 py-4 text-right">الخصم</th>
                      <th className="px-6 py-4 text-right">القيمة المدفوعة</th>
                      <th className="px-6 py-4 text-right">نصيب المعلم</th>
                      <th className="px-6 py-4 text-right">نصيب المنصة</th>
                      <th className="px-6 py-4 text-right">طريقة الدفع</th>
                      <th className="px-6 py-4 text-right">معاملة المحفظة ID</th>
                      <th className="px-6 py-4 text-right">حالة الشراء</th>
                      <th className="px-6 py-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] font-light">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={17} className="py-8">
                          <EmptyState type="general" title="لا توجد عمليات بيع مطابقة للفلاتر النشطة حالياً." />
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tr) => (
                        <tr key={tr.id} className="hover:bg-[rgba(255,255,255,0.01)] transition-all">
                          <td className="px-6 py-4 whitespace-nowrap">{tr.created_at}</td>
                          <td className="px-6 py-4 font-mono font-bold">#{tr.id}</td>
                          <td className="px-6 py-4 font-bold">{tr.student.name}</td>
                          <td className="px-6 py-4 font-mono">#{tr.student.id}</td>
                          <td className="px-6 py-4">{tr.teacher.name}</td>
                          <td className="px-6 py-4 font-mono">#{tr.teacher.id}</td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-bold">
                              {tr.product_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold">{tr.product_name}</td>
                          <td className="px-6 py-4 font-mono">{tr.original_price} ج.م</td>
                          <td className="px-6 py-4 font-mono text-rose-450">-{tr.discount} ج.م</td>
                          <td className="px-6 py-4 font-bold text-slate-100 font-mono">{tr.final_paid_amount} ج.م</td>
                          <td className="px-6 py-4 text-emerald-400 font-mono">{tr.teacher_share} ج.م</td>
                          <td className="px-6 py-4 text-indigo-400 font-mono">{tr.platform_share} ج.م</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {tr.payment_method === 'wallet' ? 'محفظة إلكترونية' : tr.payment_method === 'code' ? 'أكواد شحن' : tr.payment_method}
                          </td>
                          <td className="px-6 py-4 font-mono">{tr.wallet_transaction_id ? `#${tr.wallet_transaction_id}` : 'N/A'}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tr.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {tr.status === 'paid' ? 'مكتملة' : 'مسترجعة'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => setSelectedTransaction(tr)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-indigo-650 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                            >
                              <Eye className="h-3.5 w-3.5" /> <span>تفاصيل</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {lastPage > 1 && (
                <div className="p-4 border-t border-[var(--border-color)] flex justify-between items-center text-xs">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-350 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    السابق
                  </button>
                  <span className="text-slate-400">الصفحة {currentPage} من {lastPage}</span>
                  <button
                    disabled={currentPage === lastPage}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-350 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    التالي
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DAILY FINANCIAL REPORTS */}
          {activeTab === 'daily' && (
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden text-right">
              <div className="p-6 border-b border-[var(--border-color)]">
                <h5 className="font-bold text-sm text-slate-200">التقارير المالية اليومية للمنصة</h5>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-350">
                  <thead className="bg-[rgba(255,255,255,0.01)] text-[10px] uppercase font-bold text-slate-400 border-b border-[var(--border-color)]">
                    <tr>
                      <th className="px-6 py-4 text-right">التاريخ</th>
                      <th className="px-6 py-4 text-right">الكورسات الكلية</th>
                      <th className="px-6 py-4 text-right">حزم المحاضرات (Bundles)</th>
                      <th className="px-6 py-4 text-right">المحاضرات المنفردة</th>
                      <th className="px-6 py-4 text-right">الباقات الشهرية</th>
                      <th className="px-6 py-4 text-right">مراجعات نهائية</th>
                      <th className="px-6 py-4 text-right">مجموع عمليات البيع</th>
                      <th className="px-6 py-4 text-right">الطلاب الجدد</th>
                      <th className="px-6 py-4 text-right">أرباح المدرسين</th>
                      <th className="px-6 py-4 text-right">صافي أرباح المنصة</th>
                      <th className="px-6 py-4 text-right">إجمالي المبيعات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] font-light">
                    {dailyReports.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8">
                          <EmptyState type="general" title="لا توجد تقارير يومية مسجلة للفترة المحددة." />
                        </td>
                      </tr>
                    ) : (
                      dailyReports.map((item, i) => (
                        <tr key={i} className="hover:bg-[rgba(255,255,255,0.01)] transition-all">
                          <td className="px-6 py-4 font-bold whitespace-nowrap">{item.date}</td>
                          <td className="px-6 py-4 font-mono">{item.courses_sold} كورس</td>
                          <td className="px-6 py-4 font-mono">{item.bundles_sold} حزمة</td>
                          <td className="px-6 py-4 font-mono">{item.standalone_sold} محاضرة</td>
                          <td className="px-6 py-4 font-mono">{item.monthly_packages_sold} باقة</td>
                          <td className="px-6 py-4 font-mono">{item.revision_packages_sold} مراجعة</td>
                          <td className="px-6 py-4 font-bold font-mono">{item.purchases_count} عملية</td>
                          <td className="px-6 py-4 font-semibold text-sky-400 font-mono">+{item.new_students_count} طالب</td>
                          <td className="px-6 py-4 text-emerald-400 font-mono">{item.teachers_earnings.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 text-indigo-400 font-mono">{item.platform_earnings.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 font-black text-slate-100 bg-indigo-500/[0.01] font-mono">{item.total_revenue.toLocaleString()} ج.م</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: TEACHERS REVENUE TRACKING */}
          {activeTab === 'teachers' && (
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden text-right">
              <div className="p-6 border-b border-[var(--border-color)]">
                <h5 className="font-bold text-sm text-slate-200">تحليلات الأرباح ومبيعات المعلمين بالتفصيل</h5>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-350">
                  <thead className="bg-[rgba(255,255,255,0.01)] text-[10px] uppercase font-bold text-slate-400 border-b border-[var(--border-color)]">
                    <tr>
                      <th className="px-6 py-4 text-right">اسم المعلم</th>
                      <th className="px-6 py-4 text-right">المادة</th>
                      <th className="px-6 py-4 text-right">أرباح اليوم</th>
                      <th className="px-6 py-4 text-right">أرباح هذا الأسبوع</th>
                      <th className="px-6 py-4 text-right">أرباح هذا الشهر</th>
                      <th className="px-6 py-4 text-right">أرباح هذا العام</th>
                      <th className="px-6 py-4 text-right">إجمالي المبيعات</th>
                      <th className="px-6 py-4 text-right">متوسط المعاملة</th>
                      <th className="px-6 py-4 text-right">الأكثر مبيعاً</th>
                      <th className="px-6 py-4 text-right">سحوبات معلقة</th>
                      <th className="px-6 py-4 text-right">مسحوبات مكتملة</th>
                      <th className="px-6 py-4 text-right">المجموع التراكمي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] font-light">
                    {teacherReport.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-8">
                          <EmptyState type="general" title="لا توجد بيانات مدرسين مسجلة على السيستم." />
                        </td>
                      </tr>
                    ) : (
                      teacherReport.map((item, i) => (
                        <tr key={i} className="hover:bg-[rgba(255,255,255,0.01)] transition-all">
                          <td className="px-6 py-4 font-bold">{item.teacher.name}</td>
                          <td className="px-6 py-4 font-semibold text-indigo-400">{item.teacher.subject}</td>
                          <td className="px-6 py-4 font-bold text-slate-100 font-mono">{item.today_revenue.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 font-mono">{item.week_revenue.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 font-mono">{item.month_revenue.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 font-mono">{item.year_revenue.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 font-bold font-mono">{item.sales_count} مبيعة</td>
                          <td className="px-6 py-4 font-mono">{item.avg_order_value} ج.م</td>
                          <td className="px-6 py-4 text-slate-400 font-semibold">{item.top_selling_products}</td>
                          <td className="px-6 py-4 text-amber-400 font-bold font-mono">{item.pending_payouts.toLocaleString()} ...</td>
                          <td className="px-6 py-4 text-sky-400 font-mono">{item.completed_payouts.toLocaleString()} ...</td>
                          <td className="px-6 py-4 font-black text-slate-100 bg-indigo-500/[0.01] font-mono">{item.total_revenue.toLocaleString()} ج.م</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: STUDENT PURCHASE TRACKING */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-brand-card border border-[var(--border-color)] p-4 rounded-2xl gap-4">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="ابحث باسم الطالب، البريد، أو المادة..."
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right font-light"
                  />
                  <Search className="absolute right-3.5 top-3 h-4 w-4 text-slate-400" />
                </div>
                <h5 className="font-bold text-sm text-slate-200">تحليلات مشتريات الطلاب وحجم الإنفاق</h5>
              </div>

              <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden text-right">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-slate-350">
                    <thead className="bg-[rgba(255,255,255,0.01)] text-[10px] uppercase font-bold text-slate-400 border-b border-[var(--border-color)]">
                      <tr>
                        <th className="px-6 py-4 text-right">الطالب</th>
                        <th className="px-6 py-4 text-right">البريد الإلكتروني</th>
                        <th className="px-6 py-4 text-right">الهاتف المحمول</th>
                        <th className="px-6 py-4 text-right">آخر عملية شراء</th>
                        <th className="px-6 py-4 text-right">المعلم المفضل</th>
                        <th className="px-6 py-4 text-right">المادة المفضلة</th>
                        <th className="px-6 py-4 text-right">نوع المنتج المفضل</th>
                        <th className="px-6 py-4 text-right">إجمالي المشتريات</th>
                        <th className="px-6 py-4 text-right">إجمالي الإنفاق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)] font-light">
                      {studentReport.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8">
                            <EmptyState type="general" title="لا توجد نتائج بحث مطابقة لحسابات الطلاب." />
                          </td>
                        </tr>
                      ) : (
                        studentReport.map((item, i) => (
                          <tr key={i} className="hover:bg-[rgba(255,255,255,0.01)] transition-all">
                            <td className="px-6 py-4 font-bold">{item.student.name}</td>
                            <td className="px-6 py-4 font-mono">{item.student.email}</td>
                            <td className="px-6 py-4 font-mono">{item.student.phone || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{item.last_purchase_date || 'N/A'}</td>
                            <td className="px-6 py-4 text-indigo-400 font-semibold">{item.favorite_teacher}</td>
                            <td className="px-6 py-4 text-pink-400 font-semibold">{item.favorite_subject}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] font-bold">
                                {item.favorite_product_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold font-mono">{item.purchases_count} عملية</td>
                            <td className="px-6 py-4 font-black text-slate-100 bg-indigo-500/[0.01] font-mono">{item.total_spending.toLocaleString()} ج.م</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {studentLastPage > 1 && (
                  <div className="p-4 border-t border-[var(--border-color)] flex justify-between items-center text-xs">
                    <button
                      disabled={studentPage === 1}
                      onClick={() => setStudentPage((p) => p - 1)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-350 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      السابق
                    </button>
                    <span className="text-slate-400">الصفحة {studentPage} من {studentLastPage}</span>
                    <button
                      disabled={studentPage === studentLastPage}
                      onClick={() => setStudentPage((p) => p + 1)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-350 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Transaction Details Modal (Drill down) */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-right">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <button
                onClick={() => setSelectedTransaction(null)}
                className="p-2 hover:bg-slate-800 text-slate-450 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
              <div>
                <h4 className="font-black text-sm text-slate-100">تفاصيل العملية والرقابة الحسابية</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">معرف المعاملة الفريد: #{selectedTransaction.id}</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[72vh]">
              {/* Student Information */}
              <div className="space-y-2 border-b border-slate-800 pb-4">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 justify-end">
                  <span>بيانات الطالب المشتري</span>
                  <Users className="h-3.5 w-3.5 text-indigo-400" />
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">رقم كود الطالب (ID)</span>
                    <p className="font-mono font-bold text-slate-300">#{selectedTransaction.student.id}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">اسم الطالب بالكامل</span>
                    <p className="font-bold text-slate-200">{selectedTransaction.student.name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">البريد الإلكتروني للغرض</span>
                    <p className="font-mono text-slate-300">{selectedTransaction.student.email}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">رقم الهاتف المحمول</span>
                    <p className="font-mono text-slate-300">{selectedTransaction.student.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Teacher Information */}
              <div className="space-y-2 border-b border-slate-800 pb-4">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 justify-end">
                  <span>بيانات المعلم المنسوب</span>
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">كود المعلم (ID)</span>
                    <p className="font-mono font-bold text-slate-300">#{selectedTransaction.teacher.id}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">اسم المعلم المعتمد</span>
                    <p className="font-bold text-slate-200">{selectedTransaction.teacher.name}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-500 block">المادة الدراسية المسؤولة</span>
                    <p className="text-slate-300 font-semibold">مادة {selectedTransaction.teacher.subject || 'غير محددة'}</p>
                  </div>
                </div>
              </div>

              {/* Purchased Product */}
              <div className="space-y-2 border-b border-slate-800 pb-4">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 justify-end">
                  <span>تفاصيل المحتوى والمنتج المشتري</span>
                  <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                </span>
                <div className="bg-slate-950/35 border border-slate-850 p-4.5 rounded-2xl space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-lg text-[10px] font-black">
                      {selectedTransaction.product_type}
                    </span>
                    <span className="text-slate-400 font-bold">نوع المنتج</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-200">{selectedTransaction.product_name}</span>
                    <span className="text-slate-450">اسم المنتج المشتري</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300 font-medium">{selectedTransaction.course_name}</span>
                    <span className="text-slate-450">اسم الكورس التابع له</span>
                  </div>
                  {selectedTransaction.bundle_name !== 'N/A' && (
                    <div className="flex justify-between">
                      <span className="text-slate-300 font-medium">{selectedTransaction.bundle_name}</span>
                      <span className="text-slate-450">اسم الحزمة / الباقة</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Details */}
              <div className="space-y-3 bg-indigo-950/10 border border-indigo-950/25 p-5 rounded-2xl">
                <span className="text-[10px] font-bold text-indigo-400 block">التوزيع المالي للعملية</span>
                <div className="space-y-2.5 text-xs text-slate-350">
                  <div className="flex justify-between font-mono">
                    <span className="font-bold text-slate-250">{selectedTransaction.original_price} ج.م</span>
                    <span className="text-slate-400">سعر البيع الأصلي للمنتج</span>
                  </div>
                  <div className="flex justify-between font-mono text-rose-450">
                    <span>-{selectedTransaction.discount} ج.م</span>
                    <span className="text-slate-450">قيمة الخصم الممنوحة</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/60 pt-2 font-bold text-slate-100 font-mono">
                    <span>{selectedTransaction.final_paid_amount} ج.م</span>
                    <span>المبلغ الفعلي المدفوع</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-mono">
                    <span>{selectedTransaction.teacher_share} / {selectedTransaction.final_paid_amount} ج.م</span>
                    <span className="text-slate-400">نصيب أرباح المعلم</span>
                  </div>
                  <div className="flex justify-between text-indigo-400 font-mono">
                    <span>{selectedTransaction.platform_share} / {selectedTransaction.final_paid_amount} ج.م</span>
                    <span className="text-slate-400">نسبة أرباح المنصة</span>
                  </div>
                </div>
              </div>

              {/* Timelines and method */}
              <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">طريقة السداد</span>
                  <p className="text-slate-200 mt-1 font-bold">
                    {selectedTransaction.payment_method === 'wallet' ? 'رصيد المحفظة الإلكترونية' : selectedTransaction.payment_method === 'code' ? 'تفعيل كود شحن ورقي' : selectedTransaction.payment_method}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">أكواد الفواتير والمعاملات</span>
                  <p className="text-slate-200 mt-1 font-mono">
                    عملية محفظة ID: {selectedTransaction.wallet_transaction_id ? `#${selectedTransaction.wallet_transaction_id}` : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">وقت وتاريخ الشراء</span>
                  <p className="text-slate-200 mt-1 font-mono">{selectedTransaction.created_at}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">وقت التفعيل والحيازة</span>
                  <p className="text-slate-200 mt-1 font-mono">{selectedTransaction.activation_time}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/20 flex justify-end">
              <button
                onClick={() => setSelectedTransaction(null)}
                className="px-6 py-2 bg-slate-850 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
