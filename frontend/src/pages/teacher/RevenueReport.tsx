import React from 'react'
import API from '../../services/api'
import { Wallet, Calendar, Filter, BookOpen, Package, Clock, TrendingUp, CreditCard, Award, CheckCircle, Download, Search, ArrowUpDown, User, Hash, FileSpreadsheet, AlertCircle, X } from 'lucide-react'
import { useModalStore } from '../../store/modalStore'

interface SummaryData {
  total_revenue: number
  revenue_today: number
  revenue_this_month: number
  revenue_this_year: number
  gross_revenue?: number
  refunded_revenue?: number
  net_revenue?: number
}

interface TransactionBreakdown {
  student_name: string
  purchase_type: 'Course' | 'Bundle' | 'Lesson' | 'Exam' | 'Other'
  item_name: string
  amount_paid: number
  purchase_date: string
  payment_source: string
}

interface DetailPurchase {
  student_name: string
  amount_paid: number
  purchase_date: string
}

interface BundleDetail {
  bundle_name: string
  purchases: DetailPurchase[]
}

interface LessonDetail {
  lesson_name: string
  purchases: DetailPurchase[]
}

interface LedgerItem {
  transaction_id: string
  student_name: string
  type: string
  item_name: string
  amount: number
  date: string
  status: string
}

interface RevenueData {
  summary: SummaryData
  breakdown: TransactionBreakdown[]
  bundle_details: BundleDetail[]
  lesson_details: LessonDetail[]
  ledger: LedgerItem[]
}

const TYPE_TRANSLATION: Record<string, string> = {
  Course: 'كورس كامل',
  Bundle: 'باقة مجمعة',
  Lesson: 'محاضرة منفردة',
  Exam: 'امتحان مدفوع',
  Other: 'أخرى',
}

export default function RevenueReport() {
  const [data, setData] = React.useState<RevenueData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [activeTab, setActiveTab] = React.useState<'ledger' | 'breakdown' | 'bundles' | 'lessons'>('ledger')
  
  // Refunds modal states & sorting
  const [showRefundsModal, setShowRefundsModal] = React.useState(false)
  const [refundSearch, setRefundSearch] = React.useState('')
  const [refundFilterCourse, setRefundFilterCourse] = React.useState('all')
  const [refundFilterType, setRefundFilterType] = React.useState('all')
  const [refundSortField, setRefundSortField] = React.useState<'refund_date' | 'refunded_amount'>('refund_date')
  const [refundSortOrder, setRefundSortOrder] = React.useState<'asc' | 'desc'>('desc')
  const [refundPage, setRefundPage] = React.useState(1)

  // Memoized Filtered Refunds
  const filteredRefunds = React.useMemo(() => {
    const list = (data as any)?.refunds || [];
    return list.filter((ref: any) => {
      const matchesSearch = 
        ref.student_name.toLowerCase().includes(refundSearch.toLowerCase()) ||
        ref.transaction_id.toLowerCase().includes(refundSearch.toLowerCase());
      
      const matchesItem = refundFilterCourse === 'all' || ref.item_name === refundFilterCourse;
      const matchesType = refundFilterType === 'all' || ref.purchase_type === refundFilterType;

      return matchesSearch && matchesItem && matchesType;
    }).sort((a: any, b: any) => {
      let valA = a[refundSortField];
      let valB = b[refundSortField];

      if (refundSortField === 'refund_date') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return refundSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return refundSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, refundSearch, refundFilterCourse, refundFilterType, refundSortField, refundSortOrder]);

  const itemsPerPage = 8;
  const totalPages = Math.ceil(filteredRefunds.length / itemsPerPage);
  const paginatedRefunds = React.useMemo(() => {
    const startIndex = (refundPage - 1) * itemsPerPage;
    return filteredRefunds.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRefunds, refundPage]);

  // Unique item names for filters
  const uniqueRefundItems = React.useMemo(() => {
    const list = (data as any)?.refunds || [];
    return Array.from(new Set(list.map((r: any) => r.item_name))) as string[];
  }, [data]);

  const handleExportCSV = () => {
    if (!filteredRefunds.length) return;
    const headers = [
      'Transaction ID',
      'Student Name',
      'Student ID',
      'Item Name',
      'Type',
      'Original Amount',
      'Refunded Amount',
      'Purchase Date',
      'Refund Date',
      'Reason',
      'Status',
      'Payment Method'
    ];

    const rows = filteredRefunds.map((ref: any) => [
      ref.transaction_id,
      ref.student_name,
      ref.student_id || '-',
      ref.item_name,
      ref.purchase_type === 'Bundle' ? 'باقة مجمعة' : 'كورس كامل',
      ref.original_amount,
      ref.refunded_amount,
      ref.purchase_date || '-',
      ref.refund_date,
      ref.refund_reason || '-',
      ref.status,
      ref.payment_method
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\ufeff" 
      + [headers.join(','), ...rows.map((e: any[]) => e.map((val: any) => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `refunds_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleRefundSort = (field: 'refund_date' | 'refunded_amount') => {
    if (refundSortField === field) {
      setRefundSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setRefundSortField(field);
      setRefundSortOrder('desc');
    }
  };

  const grossRevenueVal = data?.summary.gross_revenue || data?.summary.total_revenue || 0;
  const currentTotalRefunded = filteredRefunds.reduce((sum: number, r: any) => sum + r.refunded_amount, 0);

  const summaryStats = {
    count: filteredRefunds.length,
    amount: currentTotalRefunded,
    net: grossRevenueVal - currentTotalRefunded,
    rate: grossRevenueVal > 0 ? ((currentTotalRefunded / grossRevenueVal) * 100) : 0
  };

  const fetchRevenueData = () => {
    setLoading(true)
    let url = `/teacher/revenue-report?filter=${filter}`
    if (filter === 'custom' && startDate && endDate) {
      url += `&start_date=${startDate}&end_date=${endDate}`
    }

    API.get(url)
      .then((res) => {
        setData(res.data)
      })
      .catch((err) => {
        console.error(err)
        useModalStore.getState().showToast('فشل تحميل تقارير المبيعات والمالية.', 'error')
      })
      .finally(() => setLoading(false))
  }

  React.useEffect(() => {
    if (filter !== 'custom') {
      fetchRevenueData()
    }
  }, [filter])

  const handleApplyCustomFilter = (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate) {
      useModalStore.getState().showToast('يرجى اختيار تاريخ البداية والنهاية أولاً.', 'warning')
      return
    }
    fetchRevenueData()
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
          <span className="text-xs text-slate-400 font-medium">جاري إعداد التقارير المالية...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-10 text-right" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3 justify-start">
            <Wallet className="h-8 w-8 text-brand-primary" />
            <span>الحساب المالي والتقارير المالية</span>
          </h1>
          <p className="text-sm text-slate-400 font-light mt-1">تتبع مبيعات كورساتك، باقاتك الشهرية، والمحاضرات المفردة بدقة متناهية</p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2.5 items-center justify-start bg-brand-card/40 border border-[var(--border-color)] p-2 rounded-2xl">
          <button 
            onClick={() => setFilter('all')} 
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${filter === 'all' ? 'bg-brand-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            الكل
          </button>
          <button 
            onClick={() => setFilter('today')} 
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${filter === 'today' ? 'bg-brand-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            اليوم
          </button>
          <button 
            onClick={() => setFilter('week')} 
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${filter === 'week' ? 'bg-brand-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            هذا الأسبوع
          </button>
          <button 
            onClick={() => setFilter('month')} 
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${filter === 'month' ? 'bg-brand-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            هذا الشهر
          </button>
          <button 
            onClick={() => setFilter('custom')} 
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${filter === 'custom' ? 'bg-brand-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            فترة مخصصة
          </button>
        </div>
      </div>

      {/* Custom Date Form */}
      {filter === 'custom' && (
        <form onSubmit={handleApplyCustomFilter} className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl grid grid-cols-1 sm:grid-cols-3 gap-4 items-end animate-fadeIn">
          <div className="space-y-1.5 text-right">
            <label className="text-xs font-semibold text-slate-300">من تاريخ</label>
            <input 
              type="date" 
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div className="space-y-1.5 text-right">
            <label className="text-xs font-semibold text-slate-300">إلى تاريخ</label>
            <input 
              type="date" 
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
            />
          </div>
          <button 
            type="submit" 
            className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-brand-primary/10 cursor-pointer"
          >
            تطبيق الفلترة
          </button>
        </form>
      )}

      {/* Revenue Breakdown Statistics */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-bold">إجمالي المبيعات (Gross Revenue)</span>
            <div className="text-2xl font-black text-slate-200">
              {(data.summary.gross_revenue ?? data.summary.total_revenue).toFixed(2)} ج.م
            </div>
            <p className="text-[10px] text-slate-500 font-light">مجموع عمليات الشراء قبل خصم الاسترجاع</p>
          </div>
          <div 
            onClick={() => setShowRefundsModal(true)}
            className="space-y-1 md:border-r border-slate-800 md:pr-6 cursor-pointer hover:bg-slate-900/10 p-2.5 rounded-2xl transition-all border border-transparent hover:border-red-500/10 group text-right"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold">المبالغ المسترجعة (Refunded Revenue)</span>
              <span className="text-[9px] text-red-400 font-black opacity-0 group-hover:opacity-100 transition-opacity">التفاصيل 🔍</span>
            </div>
            <div className="text-2xl font-black text-red-500">
              {(data.summary.refunded_revenue ?? 0).toFixed(2)} ج.م
            </div>
            <p className="text-[10px] text-slate-500 font-light">إجمالي الاشتراكات التي تم استرجاعها للطلاب (اضغط للتفاصيل)</p>
          </div>
          <div className="space-y-1 md:border-r border-slate-800 md:pr-6">
            <span className="text-xs text-slate-400 font-bold">صافي الأرباح (Net Revenue)</span>
            <div className="text-2xl font-black text-emerald-400">
              {(data.summary.net_revenue ?? data.summary.total_revenue).toFixed(2)} ج.م
            </div>
            <p className="text-[10px] text-slate-500 font-light">الأرباح الفعلية المحققة بعد خصم المسترجع</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card: Total */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 hover:border-brand-primary/20 transition-all shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold">إجمالي الأرباح الكلية</span>
              <div className="p-2.5 bg-emerald-500/10 text-brand-success rounded-2xl">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-brand-success">
                {data.summary.total_revenue.toFixed(2)} ج.م
              </div>
              <p className="text-[10px] text-slate-500 font-light">تراكمي المبيعات لجميع المنتجات المشحونة</p>
            </div>
          </div>

          {/* Card: Today */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 hover:border-brand-primary/20 transition-all shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold">أرباح اليوم</span>
              <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-2xl">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-brand-primary">
                {data.summary.revenue_today.toFixed(2)} ج.م
              </div>
              <p className="text-[10px] text-slate-500 font-light">مبيعات تمت خلال الـ 24 ساعة الماضية</p>
            </div>
          </div>

          {/* Card: Month */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 hover:border-brand-primary/20 transition-all shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold">مبيعات الشهر الحالي</span>
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-indigo-400">
                {data.summary.revenue_this_month.toFixed(2)} ج.م
              </div>
              <p className="text-[10px] text-slate-500 font-light">إجمالي مبيعات هذا الشهر الحالي</p>
            </div>
          </div>

          {/* Card: Year */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 hover:border-brand-primary/20 transition-all shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold">أرباح هذا العام</span>
              <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-2xl">
                <Award className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-amber-500">
                {data.summary.revenue_this_year.toFixed(2)} ج.م
              </div>
              <p className="text-[10px] text-slate-500 font-light">تراكمي مبيعات العام الميلادي الجاري</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-[var(--border-color)]">
        <div className="flex gap-8 justify-start">
          <button 
            onClick={() => setActiveTab('ledger')}
            className={`pb-4 text-sm font-black transition-all border-b-2 cursor-pointer ${activeTab === 'ledger' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            دفتر الأستاذ المالي (Ledger)
          </button>
          <button 
            onClick={() => setActiveTab('breakdown')}
            className={`pb-4 text-sm font-black transition-all border-b-2 cursor-pointer ${activeTab === 'breakdown' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            تحليل المبيعات والتفاصيل
          </button>
          <button 
            onClick={() => setActiveTab('bundles')}
            className={`pb-4 text-sm font-black transition-all border-b-2 cursor-pointer ${activeTab === 'bundles' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            أرباح الباقات المجمعة
          </button>
          <button 
            onClick={() => setActiveTab('lessons')}
            className={`pb-4 text-sm font-black transition-all border-b-2 cursor-pointer ${activeTab === 'lessons' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            أرباح المحاضرات المنفردة
          </button>
        </div>
      </div>

      {/* Tabs Content */}
      {data && !loading && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* TAB 1: Ledger Table */}
          {activeTab === 'ledger' && (
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-[var(--border-color)]">
                <h3 className="font-black text-base">دفتر الأستاذ للمعاملات الناجحة</h3>
                <p className="text-xs text-slate-400 font-light mt-0.5">جدول متكامل بجميع حركات شراء الطلاب المباشرة وأكواد الشحن</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[rgba(255,255,255,0.02)] border-b border-[var(--border-color)] text-slate-300 font-bold">
                      <th className="p-4">رقم المعاملة (ID)</th>
                      <th className="p-4">اسم الطالب</th>
                      <th className="p-4">نوع الشراء</th>
                      <th className="p-4">المنتج / البند</th>
                      <th className="p-4">المبلغ المدفوع</th>
                      <th className="p-4">تاريخ الشراء</th>
                      <th className="p-4">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {data.ledger.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 font-light">لا توجد حركات شراء مطابقة للفلترة المدخلة حالياً.</td>
                      </tr>
                    ) : (
                      data.ledger.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-300">{item.transaction_id}</td>
                          <td className="p-4 font-semibold text-slate-200">{item.student_name}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                              item.type === 'Course' ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' :
                              item.type === 'Bundle' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                              item.type === 'Lesson' ? 'bg-sky-500/10 border-sky-500/20 text-sky-500' :
                              'bg-purple-500/10 border-purple-500/20 text-purple-500'
                            }`}>
                              {TYPE_TRANSLATION[item.type] || item.type}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-slate-300">{item.item_name}</td>
                          <td className={`p-4 font-bold ${item.status === 'مسترجع' ? 'text-red-500' : 'text-emerald-400'}`}>
                            {item.status === 'مسترجع' ? '-' : ''}{item.amount.toFixed(2)} ج.م
                          </td>
                          <td className="p-4 text-slate-400 font-light">{item.date}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-success bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle className="h-3 w-3" />
                              <span>{item.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Revenue Breakdown */}
          {activeTab === 'breakdown' && (
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-[var(--border-color)]">
                <h3 className="font-black text-base">تحليل مبيعات الطلاب التفصيلي</h3>
                <p className="text-xs text-slate-400 font-light mt-0.5">تفصيل كامل لحركة الشراء، شاملة مصدر الدفع المستخدم للعملية</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[rgba(255,255,255,0.02)] border-b border-[var(--border-color)] text-slate-300 font-bold">
                      <th className="p-4">اسم الطالب</th>
                      <th className="p-4">نوع الشراء</th>
                      <th className="p-4">اسم المنتج</th>
                      <th className="p-4">القيمة المدفوعة</th>
                      <th className="p-4">تاريخ المعاملة</th>
                      <th className="p-4">مصدر الدفع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {data.breakdown.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 font-light">لا توجد عمليات مبيعات مسجلة في هذه الفترة.</td>
                      </tr>
                    ) : (
                      data.breakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                          <td className="p-4 font-semibold text-slate-200">{item.student_name}</td>
                          <td className="p-4">
                            <span className="font-bold text-slate-300">
                              {TYPE_TRANSLATION[item.purchase_type] || item.purchase_type}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-slate-200">{item.item_name}</td>
                          <td className="p-4 font-black text-slate-200">{item.amount_paid.toFixed(2)} ج.م</td>
                          <td className="p-4 text-slate-400 font-light">{item.purchase_date}</td>
                          <td className="p-4 text-slate-300">
                            <span className="inline-flex items-center gap-1.5">
                              <CreditCard className="h-3.5 w-3.5 text-brand-primary" />
                              <span>{item.payment_source}</span>
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Bundle/Package Revenue */}
          {activeTab === 'bundles' && (
            <div className="space-y-6">
              {data.bundle_details.length === 0 ? (
                <div className="bg-brand-card border border-[var(--border-color)] p-12 text-center rounded-3xl text-slate-500 font-light text-xs">
                  لا توجد باقات مجمعة مسجلة المبيعات خلال الفترة المحددة.
                </div>
              ) : (
                data.bundle_details.map((bundle, idx) => {
                  const totalBundleSales = bundle.purchases.reduce((acc, curr) => acc + curr.amount_paid, 0)
                  return (
                    <div key={idx} className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
                      <div className="p-6 border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] flex justify-between items-center">
                        <div>
                          <h3 className="font-black text-base flex items-center gap-2">
                            <Package className="h-5 w-5 text-amber-500" />
                            <span>باقة: {bundle.bundle_name}</span>
                          </h3>
                          <p className="text-[10px] text-slate-400 font-light mt-0.5">الطلاب المشتركون بالباقة خلال الفترة المحددة</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-semibold block">إجمالي أرباح الباقة</span>
                          <span className="text-base font-black text-brand-success">{totalBundleSales.toFixed(2)} ج.م</span>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-[rgba(255,255,255,0.02)] border-b border-[var(--border-color)] text-slate-400 font-bold">
                              <th className="p-4">اسم الطالب المشترك</th>
                              <th className="p-4">تاريخ الاشتراك</th>
                              <th className="p-4">المبلغ المدفوع</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-color)]">
                            {bundle.purchases.map((p, pIdx) => (
                              <tr key={pIdx} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                                <td className="p-4 font-semibold text-slate-200">{p.student_name}</td>
                                <td className="p-4 text-slate-400 font-light">{p.purchase_date}</td>
                                <td className="p-4 font-bold text-slate-200">{p.amount_paid.toFixed(2)} ج.م</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* TAB 4: Lesson Revenue */}
          {activeTab === 'lessons' && (
            <div className="space-y-6">
              {data.lesson_details.length === 0 ? (
                <div className="bg-brand-card border border-[var(--border-color)] p-12 text-center rounded-3xl text-slate-500 font-light text-xs">
                  لا توجد مبيعات محاضرات منفصلة مسجلة خلال الفترة المحددة.
                </div>
              ) : (
                data.lesson_details.map((lesson, idx) => {
                  const totalLessonSales = lesson.purchases.reduce((acc, curr) => acc + curr.amount_paid, 0)
                  return (
                    <div key={idx} className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
                      <div className="p-6 border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] flex justify-between items-center">
                        <div>
                          <h3 className="font-black text-base flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-sky-500" />
                            <span>محاضرة: {lesson.lesson_name}</span>
                          </h3>
                          <p className="text-[10px] text-slate-400 font-light mt-0.5">الطلاب المشتركون بالمحاضرة منفردة</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-semibold block">إجمالي أرباح المحاضرة</span>
                          <span className="text-base font-black text-brand-success">{totalLessonSales.toFixed(2)} ج.م</span>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-[rgba(255,255,255,0.02)] border-b border-[var(--border-color)] text-slate-400 font-bold">
                              <th className="p-4">اسم الطالب المشترك</th>
                              <th className="p-4">تاريخ الاشتراك</th>
                              <th className="p-4">المبلغ المدفوع</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-color)]">
                            {lesson.purchases.map((p, pIdx) => (
                              <tr key={pIdx} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                                <td className="p-4 font-semibold text-slate-200">{p.student_name}</td>
                                <td className="p-4 text-slate-400 font-light">{p.purchase_date}</td>
                                <td className="p-4 font-bold text-slate-200">{p.amount_paid.toFixed(2)} ج.م</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

        </div>
      )}

      {/* Detailed Refunds Modal Overlay */}
      {showRefundsModal && data && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in text-right">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-slate-950/20 text-right">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                  <Wallet className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-100">سجل وإحصائيات المبيعات المسترجعة</h3>
                  <p className="text-[10px] text-slate-500 font-light font-semibold">تفاصيل وتقارير الاشتراكات المستردة للطلاب</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRefundsModal(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right">
              
              {/* Stat Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">إجمالي عدد المرتجعات</span>
                  <span className="text-xl font-black text-slate-200">{summaryStats.count} عملية</span>
                </div>
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">إجمالي المبالغ المسترجعة</span>
                  <span className="text-xl font-black text-red-500">{summaryStats.amount.toFixed(2)} ج.م</span>
                </div>
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">صافي الإيراد بعد الاسترجاع</span>
                  <span className="text-xl font-black text-emerald-400">{summaryStats.net.toFixed(2)} ج.م</span>
                </div>
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">معدل الاسترجاع</span>
                  <span className="text-xl font-black text-amber-500">{summaryStats.rate.toFixed(2)}%</span>
                </div>
              </div>

              {/* Filters Header */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-end bg-slate-950/15 p-4.5 rounded-2xl border border-[var(--border-color)] text-right">
                
                {/* Search & Select Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto md:flex-1 text-right">
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-bold text-slate-450">بحث (اسم الطالب / المعاملة)</label>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="ابحث هنا..."
                        value={refundSearch}
                        onChange={(e) => { setRefundSearch(e.target.value); setRefundPage(1); }}
                        className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl pr-9 pl-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                      />
                      <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    </div>
                  </div>

                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-bold text-slate-450">تصفية حسب الكورس / الباقة</label>
                    <select
                      value={refundFilterCourse}
                      onChange={(e) => { setRefundFilterCourse(e.target.value); setRefundPage(1); }}
                      className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                    >
                      <option value="all">كل الكورسات والباقات</option>
                      {uniqueRefundItems.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-bold text-slate-450">نوع الشراء</label>
                    <select
                      value={refundFilterType}
                      onChange={(e) => { setRefundFilterType(e.target.value); setRefundPage(1); }}
                      className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                    >
                      <option value="all">كل الأنواع</option>
                      <option value="Course">كورس كامل</option>
                      <option value="Bundle">باقة مجمعة</option>
                    </select>
                  </div>
                </div>

                {/* CSV Button */}
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-all shadow-md shadow-emerald-500/10"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>تصدير Excel / CSV</span>
                </button>
              </div>

              {/* Refunds Table */}
              <div className="border border-[var(--border-color)] bg-slate-950/20 rounded-2xl overflow-hidden text-right">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/30 border-b border-[var(--border-color)] text-slate-450 font-bold">
                        <th className="p-4">رقم المعاملة</th>
                        <th className="p-4">الطالب</th>
                        <th className="p-4">الكورس / الباقة</th>
                        <th className="p-4 cursor-pointer hover:bg-slate-900/40 select-none" onClick={() => toggleRefundSort('refunded_amount')}>
                          <div className="flex items-center gap-1">
                            <span>القيمة المسترجعة</span>
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </th>
                        <th className="p-4 cursor-pointer hover:bg-slate-900/40 select-none" onClick={() => toggleRefundSort('refund_date')}>
                          <div className="flex items-center gap-1">
                            <span>تاريخ الاسترجاع</span>
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </th>
                        <th className="p-4">تفاصيل الشراء الأصلي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/50">
                      {paginatedRefunds.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500 font-light">
                            لا توجد أي معاملات مسترجعة تطابق الفلترة الحالية.
                          </td>
                        </tr>
                      ) : (
                        paginatedRefunds.map((ref: any) => (
                          <tr key={ref.transaction_id} className="hover:bg-slate-900/10 text-slate-300 transition-colors">
                            <td className="p-4 font-mono text-[10px] text-slate-400">{ref.transaction_id}</td>
                            <td className="p-4">
                              <div className="font-bold text-slate-100">{ref.student_name}</div>
                              <div className="text-[10px] text-slate-500 font-light font-semibold">كود الطالب: {ref.student_id || '-'}</div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-slate-250">{ref.item_name}</span>
                              <span className={`mr-2 px-2 py-0.5 rounded text-[8px] font-black ${
                                ref.purchase_type === 'Bundle' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                              }`}>
                                {ref.purchase_type === 'Bundle' ? 'باقة' : 'كورس'}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-red-400">
                              {ref.refunded_amount.toFixed(2)} ج.م
                            </td>
                            <td className="p-4 font-light text-[10px]" dir="ltr">
                              {ref.refund_date}
                            </td>
                            <td className="p-4 space-y-1">
                              <div className="text-[10px] text-slate-450 font-semibold">سعر الشراء: {ref.original_amount.toFixed(2)} ج.م</div>
                              {ref.purchase_date && (
                                <div className="text-[9px] text-slate-500 font-light font-semibold">تاريخ الشراء: {ref.purchase_date}</div>
                              )}
                              <div className="text-[9px] text-red-500/70 font-semibold">السبب: {ref.refund_reason || '-'}</div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-[var(--border-color)] flex justify-between items-center bg-slate-950/10">
                    <span className="text-[10px] text-slate-500 font-semibold">
                      صفحة {refundPage} من {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={refundPage === 1}
                        onClick={() => setRefundPage(prev => Math.max(1, prev - 1))}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 rounded-lg font-bold text-[10px] cursor-pointer"
                      >
                        السابق
                      </button>
                      <button
                        disabled={refundPage === totalPages}
                        onClick={() => setRefundPage(prev => Math.min(totalPages, prev + 1))}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 rounded-lg font-bold text-[10px] cursor-pointer"
                      >
                        التالي
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-[var(--border-color)] bg-slate-950/20 text-left">
              <button
                onClick={() => setShowRefundsModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
