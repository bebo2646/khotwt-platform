import React from 'react'
import API from '../../services/api'
import { SafeResponsiveContainer } from '../../components/ui/SafeResponsiveContainer'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { 
  FileDown, RefreshCw, BarChart2, DollarSign, BookOpen, AlertCircle, 
  Coins, Filter, Search, Calendar, ChevronDown, ChevronRight, X, Eye, 
  Users, Wallet, GraduationCap, Percent, TrendingUp, Clock, BookOpen as BookIcon,
  Award, FileText, CheckCircle, Printer, HelpCircle, ArrowLeft, PlusCircle, ArrowDownCircle, ArrowUpCircle, ShieldAlert, ShieldCheck
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
  refunds_amount: number
  courses_sold: number
  bundles_sold: number
  monthly_packages_sold: number
  revision_packages_sold: number
  standalone_sold: number
  top_teacher: string
  top_course: string
  top_bundle: string
  top_subject: string
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

interface StatementEvent {
  id: string
  date: string
  type: 'Sale' | 'Adjustment' | 'Reversal' | 'Withdrawal'
  description: string
  amount: number
  running_balance: number
}

interface AuditLogItem {
  id: number
  admin_name: string
  action: string
  previous_value: string | null
  new_value: string | null
  reason: string | null
  ip_address: string | null
  created_at: string
}

export default function FinancialAnalytics() {
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'transactions' | 'daily' | 'teachers' | 'students' | 'audit'>('dashboard')
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

  // Reference lists
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
  const [alerts, setAlerts] = React.useState<any>({
    large_refunds: [],
    large_adjustments: [],
    negative_balances: [],
    revenue_mismatch: { mismatch: false, student_payments: 0, teacher_earnings: 0, platform_earnings: 0, difference: 0 },
    duplicate_payments: [],
    duplicate_wallet_transactions: []
  })

  // Transactions Data
  const [transactions, setTransactions] = React.useState<TransactionItem[]>([])
  const [currentPage, setCurrentPage] = React.useState(1)
  const [lastPage, setLastPage] = React.useState(1)
  const [totalTransactions, setTotalTransactions] = React.useState(0)
  const [selectedTransaction, setSelectedTransaction] = React.useState<TransactionItem | null>(null)

  // Daily Reports Closing Data
  const [dailyReports, setDailyReports] = React.useState<DailyReportItem[]>([])

  // Teacher Revenue Reports
  const [teacherReport, setTeacherReport] = React.useState<TeacherStatsItem[]>([])
  const [selectedTeacherStatement, setSelectedTeacherStatement] = React.useState<any | null>(null)
  const [isStatementLoading, setIsStatementLoading] = React.useState(false)
  const [isAdjustmentLoading, setIsAdjustmentLoading] = React.useState(false)
  const [adjustAmount, setAdjustAmount] = React.useState('')
  const [adjustDescription, setAdjustDescription] = React.useState('')
  const [showAdjustForm, setShowAdjustForm] = React.useState(false)

  // Student Ledger Reports
  const [studentReport, setStudentReport] = React.useState<StudentStatsItem[]>([])
  const [studentPage, setStudentPage] = React.useState(1)
  const [studentLastPage, setStudentLastPage] = React.useState(1)
  const [selectedStudentLedger, setSelectedStudentLedger] = React.useState<any | null>(null)
  const [isLedgerLoading, setIsLedgerLoading] = React.useState(false)

  // Audit Logs
  const [auditLogs, setAuditLogs] = React.useState<AuditLogItem[]>([])
  const [auditPage, setAuditPage] = React.useState(1)
  const [auditLastPage, setAuditLastPage] = React.useState(1)

  // Fetch reference lists
  React.useEffect(() => {
    API.get('/admin/teachers').then((res) => setTeachersList(res.data.teachers || res.data || []))
    API.get('/admin/courses').then((res) => setCoursesList(res.data.courses || res.data.data || []))
    API.get('/admin/packages').then((res) => setPackagesList(res.data.packages || res.data.data || res.data || []))
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
    setAuditPage(1)
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
        setAlerts(res.data.alerts || {
          large_refunds: [],
          large_adjustments: [],
          negative_balances: [],
          revenue_mismatch: { mismatch: false },
          duplicate_payments: [],
          duplicate_wallet_transactions: []
        })
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
      } else if (activeTab === 'audit') {
        const res = await API.get('/admin/financial/audit-logs', { 
          params: { page: auditPage } 
        })
        setAuditLogs(res.data.data || [])
        setAuditLastPage(res.data.last_page || 1)
      }
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('حدث خطأ أثناء تحميل البيانات المالية من السيرفر.', 'error')
    } finally {
      setLoading(false)
    }
  }, [activeTab, range, startDate, endDate, teacherId, studentId, courseId, packageId, productType, paymentMethod, purchaseType, priceMin, priceMax, grade, subject, status, currentPage, studentSearch, studentPage, auditPage])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch Teacher Statement
  const fetchTeacherStatement = async (id: number) => {
    setIsStatementLoading(true)
    try {
      const res = await API.get(`/admin/financial/teachers/${id}/statement`, {
        params: { start_date: startDate, end_date: endDate }
      })
      setSelectedTeacherStatement(res.data)
      setShowAdjustForm(false)
      setAdjustAmount('')
      setAdjustDescription('')
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('حدث خطأ أثناء تحميل كشف الحساب المالي للمعلم.', 'error')
    } finally {
      setIsStatementLoading(false)
    }
  }

  // Post Teacher Adjustment
  const handleTeacherAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeacherStatement) return
    setIsAdjustmentLoading(true)
    try {
      await API.post(`/admin/financial/teachers/${selectedTeacherStatement.teacher.id}/adjust`, {
        amount: parseFloat(adjustAmount),
        description: adjustDescription
      })
      useModalStore.getState().showToast('تم حفظ التسوية الحسابية اليدوية بنجاح.', 'success')
      fetchTeacherStatement(selectedTeacherStatement.teacher.id)
      fetchData() // Refresh parent reports
    } catch (err: any) {
      console.error(err)
      useModalStore.getState().showToast(err.message || 'فشلت إضافة التسوية اليدوية للمعلم.', 'error')
    } finally {
      setIsAdjustmentLoading(false)
    }
  }

  // Fetch Student Ledger
  const fetchStudentLedger = async (id: number) => {
    setIsLedgerLoading(true)
    try {
      const res = await API.get(`/admin/financial/students/${id}/ledger`)
      setSelectedStudentLedger(res.data)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('حدث خطأ أثناء تحميل كشف عمليات الطالب.', 'error')
    } finally {
      setIsLedgerLoading(false)
    }
  }

  // Export CSV
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

  // Export Single Day Closing report
  const handleExportDayClosing = async (date: string) => {
    try {
      const response = await API.get('/admin/financial/daily-closing/export', {
        params: { date },
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `daily_closing_report_${date}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      useModalStore.getState().showToast(`تم تصدير تقرير إغلاق يوم ${date} بنجاح.`, 'success')
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('حدث خطأ أثناء تصدير تقرير الإغلاق اليومي.', 'error')
    }
  }

  const handlePrintReport = () => {
    window.print()
  }

  // Check if any critical alert is active
  const hasCriticalAlerts = alerts.revenue_mismatch.mismatch || 
                            alerts.negative_balances.length > 0 || 
                            alerts.duplicate_payments.length > 0 ||
                            alerts.duplicate_wallet_transactions.length > 0;

  return (
    <div className="space-y-6 pb-12 text-right antialiased font-sans">
      
      {/* Printable Report Header */}
      <div className="hidden print:block text-center border-b pb-4 mb-6">
        <h1 className="text-2xl font-black text-slate-900">التقرير المالي والحسابات الختامية للمنصة</h1>
        <p className="text-sm text-slate-600 mt-2">تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')} - الوقت الحالي: {new Date().toLocaleTimeString('ar-EG')}</p>
        <p className="text-xs text-slate-500 mt-1 font-mono">الفلاتر المطبقة: {range === 'custom' ? `من ${startDate} إلى ${endDate}` : `فترة: ${range}`}</p>
      </div>

      {/* Header and Exporters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-brand-card p-6 border border-[var(--border-color)] rounded-3xl print:hidden">
        <div>
          <h2 className="text-xl font-black text-slate-200">التحليلات المالية وتتبع الإيرادات</h2>
          <p className="text-xs text-slate-400 mt-1 font-light font-arabic">نظام الرقابة المالية والحسابات الكامل للمبيعات، أنصبة المعلمين، المسحوبات والعمولات.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600/10 hover:bg-indigo-650 text-indigo-400 hover:text-white border border-indigo-500/20 hover:border-transparent rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileDown className="h-4 w-4" /> <span>تصدير Excel / CSV</span>
          </button>
          <button
            onClick={handlePrintReport}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-650 text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-transparent rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
          { key: 'daily', label: 'التقارير الحسابية اليومية (Daily Closing)' },
          { key: 'teachers', label: 'كشوفات حساب المعلمين' },
          { key: 'students', label: 'حسابات الطلاب ومشترياتهم' },
          { key: 'audit', label: 'سجل الحوكمة والتدقيق الإداري' },
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
            className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-all cursor-pointer animate-pulse"
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
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">تاريخ الانتهاء</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right font-mono"
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
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right font-mono"
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
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">سعر العملية (الحد الأقصى)</label>
            <input
              type="number"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="1000"
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right font-mono"
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
              <option value="refunded">مسترجعة ومعكوسة (Refunded)</option>
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
              
              {/* Financial Verification & Mismatch Panel */}
              <div className={`p-5 rounded-2xl border text-right transition-all ${
                alerts.revenue_mismatch.mismatch 
                  ? 'bg-rose-500/10 border-rose-500/30' 
                  : 'bg-emerald-500/10 border-emerald-500/30'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {alerts.revenue_mismatch.mismatch ? (
                      <ShieldAlert className="h-5 w-5 text-rose-450 animate-bounce" />
                    ) : (
                      <ShieldCheck className="h-5 w-5 text-emerald-450" />
                    )}
                    <span className="text-xs font-black text-slate-200">
                      {alerts.revenue_mismatch.mismatch 
                        ? 'تنبيه: يوجد عدم تطابق في مطابقة إيرادات الحسابات الختامية!' 
                        : 'تطابق القيود المالية: تم التحقق والتدقيق بنجاح.'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">مطابقة الحسابات (Total Payments = Teachers Share + Platform Profit)</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-450 font-sans block">إجمالي مشتريات الطلاب</span>
                    <span className="text-slate-200 font-bold">{(alerts.revenue_mismatch.student_payments || 0).toLocaleString()} ج.م</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 font-sans block">إجمالي حصة المعلمين الكلية</span>
                    <span className="text-slate-200 font-bold">{(alerts.revenue_mismatch.teacher_earnings || 0).toLocaleString()} ج.م</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 font-sans block">إجمالي أرباح وعمولة المنصة</span>
                    <span className="text-slate-200 font-bold">{(alerts.revenue_mismatch.platform_earnings || 0).toLocaleString()} ج.م</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 font-sans block">فارق التسوية</span>
                    <span className={`font-bold ${alerts.revenue_mismatch.mismatch ? 'text-rose-450' : 'text-emerald-450'}`}>
                      {(alerts.revenue_mismatch.difference || 0).toLocaleString()} ج.م
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Dashboard Alerts Panel (Unusual activity detect) */}
              <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                <h5 className="text-xs font-black text-slate-200 mb-4 flex justify-between items-center">
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] animate-pulse">شاشات المراقبة النشطة</span>
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="h-4.5 w-4.5 text-rose-450" />
                    <span>لوحة الرصد والإنذار المبكر للعمليات غير العادية</span>
                  </span>
                </h5>

                {!hasCriticalAlerts && 
                 alerts.large_refunds.length === 0 && 
                 alerts.large_adjustments.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">
                    لا توجد أي معاملات مالية غير عادية أو انحرافات حسابية مسجلة حالياً.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* negative balances */}
                    {alerts.negative_balances.length > 0 && (
                      <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl space-y-2">
                        <span className="font-bold text-rose-400 block">رصيد معلم أصبح سالباً (سحب زائد)</span>
                        {alerts.negative_balances.map((n: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[11px] font-mono">
                            <span className="text-rose-400 font-bold">{n.balance} ج.م</span>
                            <span className="text-slate-300 font-sans">{n.teacher_name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* duplicate payments */}
                    {alerts.duplicate_payments.length > 0 && (
                      <div className="bg-amber-550/5 border border-amber-550/10 p-4 rounded-xl space-y-2">
                        <span className="font-bold text-amber-400 block">عمليات شراء متكررة متطابقة (خلال دقيقتين)</span>
                        {alerts.duplicate_payments.map((dp: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] font-mono leading-relaxed border-b border-slate-800 pb-1">
                            <div className="text-right">
                              <p className="text-slate-350">{dp.product_name}</p>
                              <p className="text-slate-500 text-[9px]">{dp.timestamp} (فارق: {dp.time_diff})</p>
                            </div>
                            <span className="text-slate-300 font-sans font-semibold">{dp.student_name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* duplicate wallet transactions */}
                    {alerts.duplicate_wallet_transactions.length > 0 && (
                      <div className="bg-amber-550/5 border border-amber-550/10 p-4 rounded-xl space-y-2">
                        <span className="font-bold text-amber-450 block">حركات محفظة مكررة مشتبه بها (خلال دقيقتين)</span>
                        {alerts.duplicate_wallet_transactions.map((dw: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] font-mono border-b border-slate-800 pb-1">
                            <div className="text-right">
                              <p className="text-slate-350 font-bold">{dw.amount} ج.م ({dw.type === 'purchase' ? 'خصم' : 'شحن'})</p>
                              <p className="text-slate-500 text-[9px]">{dw.timestamp}</p>
                            </div>
                            <span className="text-slate-300 font-sans">{dw.student_name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* large refunds */}
                    {alerts.large_refunds.length > 0 && (
                      <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-xl space-y-2">
                        <span className="font-bold text-indigo-400 block">عمليات استرجاع مبالغ ضخمة (&gt; 500 ج.م)</span>
                        {alerts.large_refunds.map((r: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] font-mono border-b border-slate-800 pb-1">
                            <div className="text-right">
                              <p className="text-indigo-400 font-bold">{r.amount} ج.م</p>
                              <p className="text-slate-450">{r.product}</p>
                            </div>
                            <span className="text-slate-300 font-sans">{r.student_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

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
                      <span className="text-lg font-black text-slate-100">{(c.val || 0).toLocaleString()} <span className="text-xs font-bold text-slate-450 font-mono">ج.م</span></span>
                      <p className="text-[9px] text-slate-455 mt-1 font-light">{c.desc}</p>
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
                  { title: "مسحوبات قيد الانتظار", val: summary.pending_withdrawals, icon: <Clock className="w-5 h-5 text-amber-400" />, desc: "طلب سحب معلق" },
                  { title: "مسحوبات مكتملة ومحولة", val: summary.completed_withdrawals, icon: <Wallet className="w-5 h-5 text-sky-400" />, desc: "المبالغ المحولة للمدرسين" },
                ].map((c, i) => (
                  <div key={i} className="bg-brand-card border border-[var(--border-color)] p-5 rounded-2xl text-right flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] text-slate-400 font-bold">{c.title}</span>
                      {c.icon}
                    </div>
                    <div className="mt-3">
                      <span className="text-lg font-black text-slate-100">{(c.val || 0).toLocaleString()} <span className="text-xs font-bold text-slate-450 font-mono">ج.م</span></span>
                      <p className="text-[9px] text-slate-455 mt-1 font-light">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
                  <h5 className="text-xs font-black text-slate-200 mb-4 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-normal">الأيام النشطة: {dailyChart.length} يوم</span>
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
              </div>
            </div>
          )}

          {/* TAB 2: DETAILED TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden text-right">
              <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
                <span className="text-xs text-slate-400 font-light">إجمالي العمليات المفلترة: {totalTransactions} عملية</span>
                <h5 className="font-bold text-sm text-slate-200 font-arabic">سجل المدفوعات والعمليات الحسابية (Daily Revenue Timeline)</h5>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-350">
                  <thead className="bg-[rgba(255,255,255,0.01)] text-[10px] uppercase font-bold text-slate-400 border-b border-[var(--border-color)] font-arabic">
                    <tr>
                      <th className="px-4 py-4 text-right">التاريخ والوقت</th>
                      <th className="px-4 py-4 text-right">العملية ID</th>
                      <th className="px-4 py-4 text-right">اسم الطالب</th>
                      <th className="px-4 py-4 text-right">كود الطالب</th>
                      <th className="px-4 py-4 text-right">اسم المعلم</th>
                      <th className="px-4 py-4 text-right">كود المعلم</th>
                      <th className="px-4 py-4 text-right">نوع المنتج</th>
                      <th className="px-4 py-4 text-right">اسم المنتج</th>
                      <th className="px-4 py-4 text-right">الكورس التابع</th>
                      <th className="px-4 py-4 text-right">السعر الأصلي</th>
                      <th className="px-4 py-4 text-right">الخصم</th>
                      <th className="px-4 py-4 text-right">المبلغ المدفوع</th>
                      <th className="px-4 py-4 text-right">نصيب المعلم</th>
                      <th className="px-4 py-4 text-right">نصيب المنصة</th>
                      <th className="px-4 py-4 text-right">طريقة الدفع</th>
                      <th className="px-4 py-4 text-right">معاملة المحفظة ID</th>
                      <th className="px-4 py-4 text-right">الحالة</th>
                      <th className="px-4 py-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] font-light font-mono">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={18} className="py-8 font-sans">
                          <EmptyState type="general" title="لا توجد عمليات بيع مطابقة للفلاتر النشطة حالياً." />
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tr) => (
                        <tr key={tr.id} className="hover:bg-[rgba(255,255,255,0.01)] transition-all">
                          <td className="px-4 py-4 whitespace-nowrap text-slate-400">{tr.created_at}</td>
                          <td className="px-4 py-4 font-bold">#{tr.id}</td>
                          <td className="px-4 py-4 font-bold font-sans text-slate-200">{tr.student.name}</td>
                          <td className="px-4 py-4 text-slate-450">#{tr.student.id}</td>
                          <td className="px-4 py-4 font-sans text-slate-200">{tr.teacher.name}</td>
                          <td className="px-4 py-4 text-slate-455">#{tr.teacher.id}</td>
                          <td className="px-4 py-4 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${tr.product_type === 'Course' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                              {tr.product_type}
                            </span>
                          </td>
                          <td className="px-4 py-4 font-sans font-semibold text-slate-300">{tr.product_name}</td>
                          <td className="px-4 py-4 font-sans text-slate-400">{tr.course_name}</td>
                          <td className="px-4 py-4">{tr.original_price} ج.م</td>
                          <td className="px-4 py-4 text-rose-400">-{tr.discount} ج.م</td>
                          <td className="px-4 py-4 font-bold text-slate-100">{tr.final_paid_amount} ج.م</td>
                          <td className="px-4 py-4 text-emerald-400">{tr.teacher_share} ج.م</td>
                          <td className="px-4 py-4 text-indigo-400">{tr.platform_share} ج.م</td>
                          <td className="px-4 py-4 font-sans text-slate-400 whitespace-nowrap">
                            {tr.payment_method === 'wallet' ? 'رصيد محفظة' : tr.payment_method === 'code' ? 'تفعيل كود' : tr.payment_method}
                          </td>
                          <td className="px-4 py-4">{tr.wallet_transaction_id ? `#${tr.wallet_transaction_id}` : 'N/A'}</td>
                          <td className="px-4 py-4 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${tr.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-455'}`}>
                              {tr.status === 'paid' ? 'مكتملة' : 'مسترجعة'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center font-sans whitespace-nowrap">
                            <button
                              onClick={() => setSelectedTransaction(tr)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-650 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" /> <span>تدقيق</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {lastPage > 1 && (
                <div className="p-4 border-t border-[var(--border-color)] flex justify-between items-center text-xs">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-355 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    السابق
                  </button>
                  <span className="text-slate-400 font-mono">الصفحة {currentPage} من {lastPage}</span>
                  <button
                    disabled={currentPage === lastPage}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-355 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
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
                <h5 className="font-bold text-sm text-slate-200 font-arabic">التقارير اليومية للحسابات (Platform Daily Closing Reports)</h5>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-350">
                  <thead className="bg-[rgba(255,255,255,0.01)] text-[10px] uppercase font-bold text-slate-400 border-b border-[var(--border-color)] font-arabic">
                    <tr>
                      <th className="px-5 py-4 text-right">التاريخ</th>
                      <th className="px-5 py-4 text-right font-sans">الأعلى مبيعاً (مدرس / مادة)</th>
                      <th className="px-5 py-4 text-right font-sans">الكورس / الحزمة الأفضل</th>
                      <th className="px-5 py-4 text-right">المسترجعات اليومية</th>
                      <th className="px-5 py-4 text-right">تفاصيل المبيعات والطلاب</th>
                      <th className="px-5 py-4 text-right">إيرادات المدرسين</th>
                      <th className="px-5 py-4 text-right">أرباح المنصة</th>
                      <th className="px-5 py-4 text-right">إجمالي الإيرادات</th>
                      <th className="px-5 py-4 text-center">التقرير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] font-light font-mono">
                    {dailyReports.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 font-sans">
                          <EmptyState type="general" title="لا توجد تقارير حسابية يومية مسجلة." />
                        </td>
                      </tr>
                    ) : (
                      dailyReports.map((item, i) => (
                        <tr key={i} className="hover:bg-[rgba(255,255,255,0.01)] transition-all">
                          <td className="px-5 py-4 font-bold whitespace-nowrap font-sans text-slate-200">{item.date}</td>
                          <td className="px-5 py-4 font-sans text-slate-300">
                            <p className="font-bold">{item.top_teacher}</p>
                            <p className="text-[10px] text-slate-450">المادة: {item.top_subject}</p>
                          </td>
                          <td className="px-5 py-4 font-sans text-slate-300">
                            <p className="font-bold">{item.top_course}</p>
                            <p className="text-[10px] text-slate-450">الحزمة: {item.top_bundle}</p>
                          </td>
                          <td className="px-5 py-4 text-rose-455 font-bold font-sans">-{item.refunds_amount.toLocaleString()} ج.م</td>
                          <td className="px-5 py-4 font-sans text-slate-400 text-[10px] leading-relaxed">
                            <p>المبيعات: {item.purchases_count} عملية | طلاب جدد: +{item.new_students_count}</p>
                            <p>كورسات: {item.courses_sold} | حزم: {item.bundles_sold} | باقات: {item.monthly_packages_sold} | مراجعات: {item.revision_packages_sold} | درس: {item.standalone_sold}</p>
                          </td>
                          <td className="px-5 py-4 text-emerald-400 font-bold">{item.teachers_earnings.toLocaleString()} ج.م</td>
                          <td className="px-5 py-4 text-indigo-400 font-bold">{item.platform_earnings.toLocaleString()} ج.m</td>
                          <td className="px-5 py-4 font-black text-slate-100 bg-indigo-500/[0.01]">{item.total_revenue.toLocaleString()} ج.م</td>
                          <td className="px-5 py-4 text-center font-sans">
                            <button
                              onClick={() => handleExportDayClosing(item.date)}
                              className="px-2 py-1 bg-slate-800 hover:bg-emerald-650 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                            >
                              <FileDown className="h-3.5 w-3.5" /> <span>تصدير</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: TEACHERS STATEMENT & REVENUE */}
          {activeTab === 'teachers' && (
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden text-right">
              <div className="p-6 border-b border-[var(--border-color)]">
                <h5 className="font-bold text-sm text-slate-200 font-arabic">إيرادات المعلمين الحسابية (اضغط على معلم لعرض كشف الحساب البنكي والقيام بتسوية يدوية)</h5>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-350">
                  <thead className="bg-[rgba(255,255,255,0.01)] text-[10px] uppercase font-bold text-slate-400 border-b border-[var(--border-color)] font-arabic">
                    <tr>
                      <th className="px-6 py-4 text-right">اسم المعلم</th>
                      <th className="px-6 py-4 text-right font-sans">المادة</th>
                      <th className="px-6 py-4 text-right">أرباح اليوم</th>
                      <th className="px-6 py-4 text-right">أرباح هذا الشهر</th>
                      <th className="px-6 py-4 text-right">عدد المبيعات</th>
                      <th className="px-6 py-4 text-right">سحوبات معلقة</th>
                      <th className="px-6 py-4 text-right">مسحوبات مدفوعة</th>
                      <th className="px-6 py-4 text-right">الأكثر مبيعاً</th>
                      <th className="px-6 py-4 text-right">المجموع التراكمي للرصيد</th>
                      <th className="px-6 py-4 text-center">كشف الحساب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] font-light font-mono">
                    {teacherReport.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 font-sans">
                          <EmptyState type="general" title="لا توجد بيانات مدرسين مسجلة." />
                        </td>
                      </tr>
                    ) : (
                      teacherReport.map((item, i) => (
                        <tr key={i} className="hover:bg-[rgba(255,255,255,0.01)] transition-all">
                          <td className="px-6 py-4 font-bold font-sans text-slate-200">{item.teacher.name}</td>
                          <td className="px-6 py-4 font-semibold text-indigo-400 font-sans">{item.teacher.subject}</td>
                          <td className="px-6 py-4 font-bold text-slate-100">{item.today_revenue.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4">{item.month_revenue.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 font-sans font-bold">{item.sales_count} مبيعة</td>
                          <td className="px-6 py-4 text-amber-400 font-bold">{item.pending_payouts.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 text-sky-400">{item.completed_payouts.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 text-slate-400 font-sans">{item.top_selling_products}</td>
                          <td className="px-6 py-4 font-black text-slate-100 bg-indigo-500/[0.01]">{item.total_revenue.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 text-center font-sans">
                            <button
                              onClick={() => fetchTeacherStatement(item.teacher.id)}
                              className="px-2.5 py-1.5 bg-indigo-600/10 hover:bg-indigo-650 text-indigo-400 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                            >
                              <FileText className="h-3.5 w-3.5" /> <span>كشف حساب</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: STUDENT LEDGER TRACKING */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-brand-card border border-[var(--border-color)] p-4 rounded-2xl gap-4 print:hidden">
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
                <h5 className="font-bold text-sm text-slate-200 font-arabic">تتبع مشتريات الطلاب (اضغط على كشف المعاملات لعرض دفتر الأستاذ للطالب)</h5>
              </div>

              <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden text-right">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-slate-350">
                    <thead className="bg-[rgba(255,255,255,0.01)] text-[10px] uppercase font-bold text-slate-400 border-b border-[var(--border-color)] font-arabic">
                      <tr>
                        <th className="px-6 py-4 text-right">اسم الطالب</th>
                        <th className="px-6 py-4 text-right">البريد الإلكتروني</th>
                        <th className="px-6 py-4 text-right">الهاتف المحمول</th>
                        <th className="px-6 py-4 text-right">آخر معاملة شراء</th>
                        <th className="px-6 py-4 text-right">المعلم المفضل</th>
                        <th className="px-6 py-4 text-right">المادة المفضلة</th>
                        <th className="px-6 py-4 text-right">النوع الأفضل</th>
                        <th className="px-6 py-4 text-right">إجمالي المشتريات</th>
                        <th className="px-6 py-4 text-right">إجمالي الإنفاق التراكمي</th>
                        <th className="px-6 py-4 text-center">كشف الحساب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)] font-light font-mono">
                      {studentReport.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 font-sans">
                            <EmptyState type="general" title="لا توجد نتائج بحث مطابقة لحسابات الطلاب." />
                          </td>
                        </tr>
                      ) : (
                        studentReport.map((item, i) => (
                          <tr key={i} className="hover:bg-[rgba(255,255,255,0.01)] transition-all">
                            <td className="px-6 py-4 font-bold font-sans text-slate-200">{item.student.name}</td>
                            <td className="px-6 py-4 font-mono text-slate-355">{item.student.email}</td>
                            <td className="px-6 py-4 font-mono text-slate-355">{item.student.phone || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-sans">{item.last_purchase_date || 'N/A'}</td>
                            <td className="px-6 py-4 text-indigo-400 font-semibold font-sans">{item.favorite_teacher}</td>
                            <td className="px-6 py-4 text-pink-400 font-semibold font-sans">{item.favorite_subject}</td>
                            <td className="px-6 py-4 font-sans">
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] font-bold">
                                {item.favorite_product_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold">{item.purchases_count} عملية</td>
                            <td className="px-6 py-4 font-black text-slate-100 bg-indigo-500/[0.01]">{item.total_spending.toLocaleString()} ج.م</td>
                            <td className="px-6 py-4 text-center font-sans">
                              <button
                                onClick={() => fetchStudentLedger(item.student.id)}
                                className="px-2.5 py-1.5 bg-pink-650/10 hover:bg-pink-650 text-pink-400 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                              >
                                <FileText className="h-3.5 w-3.5" /> <span>دفتر الأستاذ</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {studentLastPage > 1 && (
                  <div className="p-4 border-t border-[var(--border-color)] flex justify-between items-center text-xs print:hidden">
                    <button
                      disabled={studentPage === 1}
                      onClick={() => setStudentPage((p) => p - 1)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-350 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      السابق
                    </button>
                    <span className="text-slate-400 font-mono">الصفحة {studentPage} من {studentLastPage}</span>
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

          {/* TAB 6: AUDIT GOVERNANCE LOGS */}
          {activeTab === 'audit' && (
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden text-right">
              <div className="p-6 border-b border-[var(--border-color)]">
                <h5 className="font-bold text-sm text-slate-200 font-arabic">سجل التدقيق والحوكمة المالية الإدارية (Financial Audit Log)</h5>
                <p className="text-xs text-slate-455 mt-1 font-light">سجل تاريخي دائم لجميع العمليات الإدارية والمالية الحساسة التي تتم على السيرفر.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-350">
                  <thead className="bg-[rgba(255,255,255,0.01)] text-[10px] uppercase font-bold text-slate-400 border-b border-[var(--border-color)] font-arabic">
                    <tr>
                      <th className="px-5 py-4 text-right">تاريخ وتوقيت العملية</th>
                      <th className="px-5 py-4 text-right">اسم المسؤول</th>
                      <th className="px-5 py-4 text-right">نوع الإجراء الحسابي</th>
                      <th className="px-5 py-4 text-right">القيمة السابقة</th>
                      <th className="px-5 py-4 text-right">القيمة الجديدة المحسوبة</th>
                      <th className="px-5 py-4 text-right">سبب التعديل والبيان</th>
                      <th className="px-5 py-4 text-right font-sans">عنوان IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] font-light font-mono">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 font-sans">
                          <EmptyState type="general" title="لا توجد سجلات تدقيق مالي مسجلة حالياً." />
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[rgba(255,255,255,0.01)] transition-all">
                          <td className="px-5 py-4 text-slate-400 whitespace-nowrap">{log.created_at}</td>
                          <td className="px-5 py-4 font-bold font-sans text-slate-200">{log.admin_name}</td>
                          <td className="px-5 py-4 font-sans text-indigo-400 font-bold">{log.action}</td>
                          <td className="px-5 py-4 text-slate-300">{log.previous_value || 'N/A'}</td>
                          <td className="px-5 py-4 text-slate-100 font-bold">{log.new_value || 'N/A'}</td>
                          <td className="px-5 py-4 font-sans text-slate-400">{log.reason || 'N/A'}</td>
                          <td className="px-5 py-4 text-slate-455">{log.ip_address || 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {auditLastPage > 1 && (
                <div className="p-4 border-t border-[var(--border-color)] flex justify-between items-center text-xs">
                  <button
                    disabled={auditPage === 1}
                    onClick={() => setAuditPage((p) => p - 1)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-350 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    السابق
                  </button>
                  <span className="text-slate-400 font-mono">الصفحة {auditPage} من {auditLastPage}</span>
                  <button
                    disabled={auditPage === auditLastPage}
                    onClick={() => setAuditPage((p) => p + 1)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-350 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    التالي
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-right">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <button
                onClick={() => setSelectedTransaction(null)}
                className="p-2 hover:bg-slate-800 text-slate-450 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
              <div>
                <h4 className="font-black text-sm text-slate-100 font-arabic">سلسلة تدقيق تتبع المعاملة (Traceability Audit Trail)</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">رقم المعاملة: #{selectedTransaction.id}</p>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[72vh]">
              <div className="relative border-r border-indigo-500/25 pr-6 mr-3 space-y-5">
                <div className="relative">
                  <span className="absolute -right-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 ring-4 ring-slate-900 text-[8px] text-white font-bold">1</span>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-indigo-400 block font-arabic">بيانات الطالب المحاسبية</span>
                    <div className="text-xs text-slate-300">
                      <p className="font-bold text-slate-200">{selectedTransaction.student.name}</p>
                      <p className="font-mono text-[10px] text-slate-450">كود الطالب ID: #{selectedTransaction.student.id} | هاتف: {selectedTransaction.student.phone || 'N/A'}</p>
                      <p className="font-mono text-[10px] text-slate-450">{selectedTransaction.student.email}</p>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -right-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 ring-4 ring-slate-900 text-[8px] text-white font-bold">2</span>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-indigo-400 block font-arabic">المنتج والحيازة القانونية</span>
                    <div className="text-xs text-slate-350 bg-slate-950/20 border border-slate-800 p-3 rounded-xl flex justify-between items-center">
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[9px] font-bold rounded">{selectedTransaction.product_type}</span>
                      <span className="font-bold text-slate-200">{selectedTransaction.product_name}</span>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -right-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 ring-4 ring-slate-900 text-[8px] text-white font-bold">3</span>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-indigo-400 block font-arabic">الكورس والمادة التابعة</span>
                    <p className="text-xs text-slate-300 font-bold">{selectedTransaction.course_name}</p>
                    {selectedTransaction.bundle_name !== 'N/A' && (
                      <p className="text-[10px] text-slate-450 font-medium">الباقة المشتراة: {selectedTransaction.bundle_name}</p>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -right-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 ring-4 ring-slate-900 text-[8px] text-white font-bold">4</span>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-indigo-400 block font-arabic">المعلم المعتمد والتسوية المادية</span>
                    <div className="text-xs text-slate-300">
                      <p className="font-bold text-slate-200">{selectedTransaction.teacher.name}</p>
                      <p className="text-[10px] text-slate-455">معرف المعلم: #{selectedTransaction.teacher.id} | مادة: {selectedTransaction.teacher.subject}</p>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -right-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 ring-4 ring-slate-900 text-[8px] text-white font-bold">5</span>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-indigo-400 block font-arabic">رابط قيد معاملات المحفظة (Wallet Ledger)</span>
                    <div className="text-xs text-slate-300 bg-slate-950/20 border border-slate-800 p-3 rounded-xl">
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-200">#{selectedTransaction.wallet_transaction_id || 'N/A'}</span>
                        <span className="text-slate-400 font-sans">معرف معاملة المحفظة</span>
                      </div>
                      <div className="flex justify-between font-mono mt-1 text-[10px]">
                        <span className="text-slate-250">{selectedTransaction.payment_method === 'wallet' ? 'رصيد المحفظة الإلكترونية' : 'أكواد شحن ورقية'}</span>
                        <span className="text-slate-400 font-sans">طريقة الخصم والسداد</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -right-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 ring-4 ring-slate-900 text-[8px] text-white font-bold">6</span>
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-indigo-400 block font-arabic">تقسيم العائد والأرباح (Revenue Split)</span>
                    <div className="bg-indigo-950/15 border border-indigo-950/30 p-4 rounded-xl space-y-2 text-xs font-mono text-slate-350">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-200">{selectedTransaction.original_price} ج.م</span>
                        <span className="font-sans">سعر البيع الأساسي</span>
                      </div>
                      <div className="flex justify-between text-rose-455 font-bold">
                        <span>-{selectedTransaction.discount} ج.م</span>
                        <span className="font-sans">الخصومات الممنوحة</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800 pt-2 font-bold text-slate-100">
                        <span>{selectedTransaction.final_paid_amount} ج.م</span>
                        <span className="font-sans">المبلغ النهائي المسدد</span>
                      </div>
                      <div className="flex justify-between text-emerald-450 pt-1">
                        <span>{selectedTransaction.teacher_share} ج.م</span>
                        <span className="font-sans">صافي نصيب المعلم</span>
                      </div>
                      <div className="flex justify-between text-indigo-400">
                        <span>{selectedTransaction.platform_share} ج.م</span>
                        <span className="font-sans">عمولة وصافي ربح المنصة</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-800 font-sans">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block">وقت وتاريخ الشراء</span>
                  <p className="text-slate-300 mt-0.5 font-mono">{selectedTransaction.created_at}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block">وقت تفعيل الكورس</span>
                  <p className="text-slate-300 mt-0.5 font-mono">{selectedTransaction.activation_time}</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/20 flex justify-end">
              <button
                onClick={() => setSelectedTransaction(null)}
                className="px-6 py-2 bg-slate-850 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer font-sans"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Statement Modal */}
      {selectedTeacherStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-opacity print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in duration-150 text-right">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/25">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAdjustForm(!showAdjustForm)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                >
                  <PlusCircle className="h-4 w-4" /> <span>إضافة تسوية مالية يدوية</span>
                </button>
                <button
                  onClick={() => setSelectedTeacherStatement(null)}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-100 font-arabic">كشف الحساب المالي والتسويات (Teacher Statement Ledger)</h4>
                <p className="text-[10px] text-slate-450 font-sans">المعلم: {selectedTeacherStatement.teacher.name} | مادة {selectedTeacherStatement.teacher.subject}</p>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              {showAdjustForm && (
                <form onSubmit={handleTeacherAdjustment} className="bg-slate-950/40 border border-indigo-500/20 p-5 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
                  <h5 className="text-xs font-black text-indigo-400 flex items-center gap-1.5 justify-end">
                    <span>إضافة تسوية رصيد يدوية للمعلم</span>
                    <Coins className="h-4 w-4 text-indigo-400" />
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-right">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">القيمة المالية (موجب لإضافة رصيد، سالب للخصم)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        placeholder="مثال: 150 أو -50"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right font-mono"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">وصف وسبب التسوية (يظهر في كشف الحساب والتدقيق)</label>
                      <input
                        type="text"
                        required
                        value={adjustDescription}
                        onChange={(e) => setAdjustDescription(e.target.value)}
                        placeholder="مثال: مكافأة مالية إضافية للشهر الحالي"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 text-right font-sans"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1 font-sans">
                    <button
                      type="button"
                      onClick={() => setShowAdjustForm(false)}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-350 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isAdjustmentLoading}
                      className="px-5 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isAdjustmentLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                      <span>حفظ وإجراء التسوية</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-3 gap-4 border-b border-slate-800 pb-5 text-center font-mono">
                <div className="bg-slate-950/15 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[9px] font-bold text-slate-455 block font-sans">الرصيد الافتتاحي (Opening Balance)</span>
                  <span className="text-lg font-black text-slate-300 mt-1 block">{selectedTeacherStatement.opening_balance.toLocaleString()} ج.م</span>
                </div>
                <div className="bg-slate-950/15 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[9px] font-bold text-slate-455 block font-sans">إجمالي أرباح ومبيعات الفترة</span>
                  <span className="text-lg font-black text-emerald-400 mt-1 block">+{selectedTeacherStatement.timeline.reduce((acc: number, val: any) => val.type !== 'Withdrawal' && val.amount > 0 ? acc + val.amount : acc, 0).toLocaleString()} ج.م</span>
                </div>
                <div className="bg-slate-950/15 border border-indigo-500/20 p-4 rounded-xl">
                  <span className="text-[9px] font-bold text-indigo-400 block font-sans">الرصيد الحالي المستحق (Current Balance)</span>
                  <span className="text-xl font-black text-indigo-300 mt-1 block">{selectedTeacherStatement.current_balance.toLocaleString()} ج.م</span>
                </div>
              </div>

              <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950/15">
                <div className="p-4 border-b border-slate-800 font-bold text-xs text-slate-300 font-arabic">سجل حركات الحساب المالي (Statement Timeline)</div>
                <div className="overflow-x-auto max-h-[35vh]">
                  <table className="w-full text-xs text-slate-355">
                    <thead className="bg-slate-900 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 font-arabic">
                      <tr>
                        <th className="px-5 py-3 text-right">التاريخ والوقت</th>
                        <th className="px-5 py-3 text-right">نوع الحركة</th>
                        <th className="px-5 py-3 text-right font-sans">بيان المعاملة (الوصف)</th>
                        <th className="px-5 py-3 text-right">القيمة</th>
                        <th className="px-5 py-3 text-right">الرصيد التراكمي المتبقي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-light font-mono">
                      {selectedTeacherStatement.timeline.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center font-sans">
                            <EmptyState type="general" title="لا توجد عمليات مسجلة للمعلم في هذه الفترة." />
                          </td>
                        </tr>
                      ) : (
                        selectedTeacherStatement.timeline.map((event: StatementEvent) => (
                          <tr key={event.id} className="hover:bg-slate-900/40 transition-all">
                            <td className="px-5 py-3 text-slate-400">{event.date}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                                event.type === 'Sale' 
                                  ? 'bg-emerald-500/10 text-emerald-400' 
                                  : event.type === 'Adjustment' 
                                    ? 'bg-indigo-500/10 text-indigo-400' 
                                    : event.type === 'Reversal'
                                      ? 'bg-rose-500/10 text-rose-455'
                                      : 'bg-amber-500/10 text-amber-400'
                              }`}>
                                {event.type === 'Sale' ? 'عملية بيع' : event.type === 'Adjustment' ? 'تسوية يدوية' : event.type === 'Reversal' ? 'عكس معاملة' : 'سحب مستحقات'}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-sans text-slate-350">{event.description}</td>
                            <td className={`px-5 py-3 font-bold ${event.amount >= 0 ? 'text-emerald-450' : 'text-rose-455'}`}>
                              {event.amount >= 0 ? '+' : ''}{event.amount.toLocaleString()} ج.م
                            </td>
                            <td className="px-5 py-3 font-bold text-slate-200">{event.running_balance.toLocaleString()} ج.م</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/20 flex justify-end font-sans">
              <button
                onClick={() => setSelectedTeacherStatement(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer"
              >
                إغلاق كشف الحساب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student purchase ledger modal */}
      {selectedStudentLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-opacity print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in duration-150 text-right">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/25">
              <button
                onClick={() => setSelectedStudentLedger(null)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
              <div>
                <h4 className="font-black text-sm text-slate-100 font-arabic">دفتر أستاذ مشتريات الطالب (Student Purchase Ledger)</h4>
                <p className="text-[10px] text-slate-450 font-sans">الطالب: {selectedStudentLedger.student.name} | بريد الكتروني: {selectedStudentLedger.student.email}</p>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4 border-b border-slate-800 pb-5 text-center font-mono">
                <div className="bg-slate-950/15 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[9px] font-bold text-slate-455 block font-sans">عدد العمليات الكلي</span>
                  <span className="text-lg font-black text-slate-300 mt-1 block">{selectedStudentLedger.ledger.length} عملية</span>
                </div>
                <div className="bg-slate-950/15 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[9px] font-bold text-slate-455 block font-sans">إجمالي قيمة المدفوعات والإنفاق</span>
                  <span className="text-lg font-black text-indigo-400 mt-1 block">{(selectedStudentLedger.ledger.reduce((acc: number, val: any) => val.status === 'paid' ? acc + val.amount : acc, 0)).toLocaleString()} ج.م</span>
                </div>
              </div>

              <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950/15">
                <div className="p-4 border-b border-slate-800 font-bold text-xs text-slate-350 font-arabic">سجل الفواتير والمشتريات (Purchase Ledger)</div>
                <div className="overflow-x-auto max-h-[35vh]">
                  <table className="w-full text-xs text-slate-355">
                    <thead className="bg-slate-900 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 font-arabic">
                      <tr>
                        <th className="px-5 py-3 text-right">تاريخ المعاملة</th>
                        <th className="px-5 py-3 text-right">نوع المنتج</th>
                        <th className="px-5 py-3 text-right font-sans">اسم الكورس / المنتج</th>
                        <th className="px-5 py-3 text-right font-sans">المعلم المنسوب</th>
                        <th className="px-5 py-3 text-right">طريقة الدفع</th>
                        <th className="px-5 py-3 text-right">السعر الأصلي</th>
                        <th className="px-5 py-3 text-right">الخصم</th>
                        <th className="px-5 py-3 text-right">المبلغ النهائي المدفوع</th>
                        <th className="px-5 py-3 text-right">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-light font-mono">
                      {selectedStudentLedger.ledger.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center font-sans">
                            <EmptyState type="general" title="لا توجد مشتريات مسجلة لهذا الطالب." />
                          </td>
                        </tr>
                      ) : (
                        selectedStudentLedger.ledger.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-900/40 transition-all">
                            <td className="px-5 py-3 text-slate-400 whitespace-nowrap">{item.date}</td>
                            <td className="px-5 py-3 font-sans">
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] font-bold">
                                {item.product_type}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-sans text-slate-200 font-bold">{item.product_name}</td>
                            <td className="px-5 py-3 font-sans text-slate-300">{item.teacher_name}</td>
                            <td className="px-5 py-3 font-sans text-slate-400">{item.payment_method}</td>
                            <td className="px-5 py-3">{item.original_price} ج.م</td>
                            <td className="px-5 py-3 text-rose-455">-{item.discount} ...</td>
                            <td className="px-5 py-3 font-bold text-slate-100">{item.amount} ج.م</td>
                            <td className="px-5 py-3 font-sans">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${item.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-455'}`}>
                                {item.status === 'paid' ? 'نشطة ومكتملة' : 'مسترجعة ومعكوسة'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/20 flex justify-end font-sans">
              <button
                onClick={() => setSelectedStudentLedger(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer"
              >
                إغلاق دفتر الأستاذ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
