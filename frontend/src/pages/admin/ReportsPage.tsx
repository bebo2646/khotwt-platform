import React from 'react'
import API from '../../services/api'
import { FileDown, RefreshCw, BarChart2, DollarSign, BookOpen, AlertCircle, KeyRound } from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import { useModalStore } from '../../store/modalStore'

interface SalesLog {
  id: number
  amount: string
  description: string
  created_at: string
  wallet: {
    student: {
      name: string
    }
  }
}

interface MonthlySale {
  month: string
  total: string
}

interface TeacherRevenue {
  teacher_name: string
  total_revenue: string
}

interface RefundLog {
  id: number
  student: { name: string } | null
  course: { title: string } | null
  package: { title: string } | null
  amount: string
  admin: { name: string } | null
  created_at: string
}

interface WalletAdjustmentLog {
  id: number
  admin_name: string
  action_type: string
  created_at: string
  ip_address: string | null
}

interface CodeUsage {
  id: number
  code: string
  redeemed_by?: { name: string } | null
  redeemedBy?: { name: string } | null
  course: { title: string } | null
  package: { title: string } | null
  redeemed_at: string
}

export default function ReportsPage() {
  const [sales, setSales] = React.useState<SalesLog[]>([])
  const [monthlySales, setMonthlySales] = React.useState<MonthlySale[]>([])
  const [teacherRevenue, setTeacherRevenue] = React.useState<TeacherRevenue[]>([])
  const [refundLogs, setRefundLogs] = React.useState<RefundLog[]>([])
  const [walletAdjustments, setWalletAdjustments] = React.useState<WalletAdjustmentLog[]>([])
  const [codeUsages, setCodeUsages] = React.useState<CodeUsage[]>([])
  const [activeTab, setActiveTab] = React.useState<'sales' | 'refunds' | 'adjustments' | 'codes'>('sales')
  const [loading, setLoading] = React.useState(true)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const res = await API.get('/admin/reports')
      console.log('[Reports Response]:', res.data)
      setSales(res.data.sales || [])
      setMonthlySales(res.data.monthly_sales || [])
      setTeacherRevenue(res.data.teacher_revenue || [])
      setRefundLogs(res.data.refund_logs || [])
      setWalletAdjustments(res.data.wallet_adjustments || [])
      setCodeUsages(res.data.code_usages || [])
    } catch (err) {
      console.error('[Reports Response Error]:', err)
      useModalStore.getState().showToast('فشل تحميل التقارير المالية والتحليلات.', 'error')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchReports()
  }, [])

  const handleDownloadCSV = () => {
    if (sales.length === 0) return

    const headers = 'المعرف,القيمة المالية,تفاصيل العملية,التاريخ,الطالب\n'
    const rows = sales.map((s) => `${s.id},${s.amount},"${s.description}",${new Date(s.created_at).toLocaleDateString('ar-EG')},"${s.wallet.student.name}"\n`)
    
    const csvContent = '\uFEFF' + headers + rows.join('')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `elm_billing_report_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black">التقارير المالية والمبيعات</h1>
          <p className="text-sm text-slate-400 font-light mt-1">تتبع إيرادات المنصة الإجمالية، ونسب توزيع أرباح المعلمين وسجل الفواتير</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchReports}
            className="p-2.5 bg-brand-card hover:bg-slate-800 border border-[var(--border-color)] rounded-xl text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={handleDownloadCSV}
            disabled={sales.length === 0}
            className="px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <FileDown className="h-4.5 w-4.5" /> <span>تصدير المبيعات لـ CSV</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Log table col */}
          <div className="lg:col-span-2 space-y-6 text-right" dir="rtl">
            
            {/* Tabs Selector */}
            <div className="flex flex-wrap gap-2 border-b border-[var(--border-color)] pb-3">
              <button
                onClick={() => setActiveTab('sales')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'sales'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                💳 الفواتير والمبيعات ({sales.length})
              </button>
              <button
                onClick={() => setActiveTab('refunds')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'refunds'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                🔄 سجل الاسترجاع ({refundLogs.length})
              </button>
              <button
                onClick={() => setActiveTab('adjustments')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'adjustments'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚖️ تعديلات المحفظة ({walletAdjustments.length})
              </button>
              <button
                onClick={() => setActiveTab('codes')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'codes'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                🔑 استخدام الأكواد ({codeUsages.length})
              </button>
            </div>

            {/* Sales transactions list */}
            {activeTab === 'sales' && (
              <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
                <h3 className="font-bold text-base border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-brand-primary" />
                  <span>سجل المبيعات والفواتير الأخير</span>
                </h3>

                {sales.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-light text-xs">لا يوجد أي مبيعات مسجلة حالياً.</div>
                ) : (
                  <div className="divide-y divide-[var(--border-color)] max-h-[450px] overflow-y-auto pr-1">
                    {sales.map((tx) => (
                      <div key={tx.id} className="flex justify-between items-center py-3.5">
                        <div className="space-y-0.5">
                          <div className="font-bold text-xs sm:text-sm">{tx.description}</div>
                          <div className="text-[10px] text-slate-400 font-light flex gap-2">
                            <span>المشتري: {tx.wallet.student.name}</span>
                            <span>•</span>
                            <span>{new Date(tx.created_at).toLocaleString('ar-EG')}</span>
                          </div>
                        </div>
                        <div className="font-black text-xs sm:text-sm text-brand-primary">{tx.amount} ج.م</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Refunds list */}
            {activeTab === 'refunds' && (
              <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
                <h3 className="font-bold text-base border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-brand-primary animate-spin-hover" />
                  <span>سجل الاسترجاع وعمليات إلغاء الاشتراك (Refund System)</span>
                </h3>

                {refundLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-light text-xs">لا توجد أي عمليات استرداد مسجلة.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-[rgba(255,255,255,0.01)] border-b border-[var(--border-color)] text-slate-400 font-bold">
                          <th className="p-3">الطالب</th>
                          <th className="p-3">العنصر الملغى</th>
                          <th className="p-3 text-center">القيمة المستردة</th>
                          <th className="p-3 text-center">المسؤول</th>
                          <th className="p-3 text-center">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-color)] text-slate-350">
                        {refundLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-[rgba(255,255,255,0.005)] transition-colors">
                            <td className="p-3 font-semibold text-slate-200">{log.student?.name || 'طالب محذوف'}</td>
                            <td className="p-3">
                              {log.package ? (
                                <span className="text-amber-400 font-semibold">[باقة] {log.package.title}</span>
                              ) : log.course ? (
                                <span className="text-emerald-400 font-semibold">[كورس] {log.course.title}</span>
                              ) : (
                                <span className="text-slate-400">عنصر محذوف</span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-brand-primary">{log.amount} ج.م</td>
                            <td className="p-3 text-center text-slate-400 font-medium">{log.admin?.name || 'مسؤول'}</td>
                            <td className="p-3 text-center text-slate-450 font-light">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Wallet Adjustments list */}
            {activeTab === 'adjustments' && (
              <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
                <h3 className="font-bold text-base border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-brand-primary" />
                  <span>سجل تعديلات المحفظة الإدارية (شحن / سحب)</span>
                </h3>

                {walletAdjustments.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-light text-xs">لا توجد عمليات تعديل يدوي للمحافظ مسجلة.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-[rgba(255,255,255,0.01)] border-b border-[var(--border-color)] text-slate-400 font-bold">
                          <th className="p-3">المسؤول</th>
                          <th className="p-3">الإجراء والتفاصيل</th>
                          <th className="p-3 text-center">التاريخ</th>
                          <th className="p-3 text-center">عنوان الـ IP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-color)] text-slate-350">
                        {walletAdjustments.map((log) => (
                          <tr key={log.id} className="hover:bg-[rgba(255,255,255,0.005)] transition-colors">
                            <td className="p-3 font-semibold text-slate-200">{log.admin_name}</td>
                            <td className="p-3 text-slate-300 font-medium">{log.action_type}</td>
                            <td className="p-3 text-center text-slate-400">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                            <td className="p-3 text-center text-slate-500 font-mono text-[10px]">{log.ip_address || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Code Usages list */}
            {activeTab === 'codes' && (
              <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
                <h3 className="font-bold text-base border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-brand-primary" />
                  <span>سجل تفعيل الكوبونات وأكواد الشراء المستعملة</span>
                </h3>

                {codeUsages.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-light text-xs">لا يوجد أي أكواد مستعملة حالياً.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-[rgba(255,255,255,0.01)] border-b border-[var(--border-color)] text-slate-400 font-bold">
                          <th className="p-3">الكود المستعمل</th>
                          <th className="p-3">الطالب</th>
                          <th className="p-3">الارتباط والتفعيل</th>
                          <th className="p-3 text-center">تاريخ التفعيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-color)] text-slate-350">
                        {codeUsages.map((log) => (
                          <tr key={log.id} className="hover:bg-[rgba(255,255,255,0.005)] transition-colors">
                            <td className="p-3 font-bold font-mono text-brand-primary select-all">{log.code}</td>
                            <td className="p-3 font-semibold text-slate-200">
                              {log.redeemedBy?.name || log.redeemed_by?.name || 'طالب'}
                            </td>
                            <td className="p-3">
                              {log.package ? (
                                <span className="text-amber-400 font-semibold">[باقة] {log.package.title}</span>
                              ) : log.course ? (
                                <span className="text-emerald-400 font-semibold">[كورس] {log.course.title}</span>
                              ) : (
                                <span className="text-slate-400">شحن رصيد المحفظة عام</span>
                              )}
                            </td>
                            <td className="p-3 text-center text-slate-400">{new Date(log.redeemed_at).toLocaleString('ar-EG')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Aggregates Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Monthly sales log summaries */}
            <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
              <h3 className="font-bold text-base border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-brand-primary" />
                <span>المبيعات الشهرية:</span>
              </h3>

              {monthlySales.length === 0 ? (
                <div className="text-center py-6 text-slate-500 font-light text-xs">لا يوجد مبيعات بعد.</div>
              ) : (
                <div className="space-y-3">
                  {monthlySales.map((m) => (
                    <div key={m.month} className="flex justify-between items-center p-3.5 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-xl text-xs">
                      <span className="font-semibold">{m.month}</span>
                      <span className="font-black text-brand-primary">{Number(m.total).toFixed(2)} ج.م</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Teacher revenue split calculations */}
            <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
              <h3 className="font-bold text-base border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-brand-primary" />
                <span>إيرادات المعلمين المحققة:</span>
              </h3>

              {teacherRevenue.length === 0 ? (
                <div className="text-center py-6 text-slate-500 font-light text-xs">لا يوجد أرباح مسجلة للمعلمين بعد.</div>
              ) : (
                <div className="space-y-3">
                  {teacherRevenue.map((t) => (
                    <div key={t.teacher_name} className="flex justify-between items-center p-3.5 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-xl text-xs">
                      <span className="font-semibold">{t.teacher_name}</span>
                      <span className="font-black text-brand-success">{Number(t.total_revenue).toFixed(2)} ج.م</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  )
}
