import React from 'react'
import API from '../../services/api'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { SafeResponsiveContainer } from '../../components/ui/SafeResponsiveContainer'
import { Users, GraduationCap, BookOpen, Coins, BarChart3, Clock, AlertCircle, Package, Edit3, Trash2, Check, HardDrive, Settings, Shield, TrendingUp } from 'lucide-react'
import { useModalStore } from '../../store/modalStore'
import { useAuthStore } from '../../store/authStore'

interface MonthlyChartItem {
  month: string
  total: string
}

interface StatsData {
  total_teachers: number
  total_students: number
  total_courses: number
  total_enrollments: number
  total_revenue: string
  monthly_revenue: string
  gross_revenue?: string | number
  refunded_revenue?: string | number
  net_revenue?: string | number
  gross_monthly_revenue?: string | number
  refunded_monthly_revenue?: string | number
  net_monthly_revenue?: string | number
  recent_transactions: any[]
  monthly_chart: MonthlyChartItem[]
  
  // Teacher Subscription metrics
  sub_lifetime_revenue?: number
  sub_current_month_revenue?: number
  sub_previous_month_revenue?: number
  sub_today_revenue?: number
  sub_pending_revenue?: number
  sub_refunded_revenue?: number
  sub_growth_percentage?: number
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = React.useState<StatsData | null>(null)
  const [packages, setPackages] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  // Maintenance states (Super Admin)
  const [maintenanceMode, setMaintenanceMode] = React.useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = React.useState('')
  const [maintenanceEta, setMaintenanceEta] = React.useState('')
  const [savingSettings, setSavingSettings] = React.useState(false)

  // Package admin states
  const [showPackageForm, setShowPackageForm] = React.useState(false)
  const [editPackageMode, setEditPackageMode] = React.useState<any | null>(null)
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

  const fetchPackages = async () => {
    try {
      const res = await API.get('/admin/packages')
      setPackages(res.data)
    } catch (err) {
      console.error('[Dashboard Packages Fetch Error]:', err)
      useModalStore.getState().showToast('حدث خطأ أثناء تحميل الباقات.', 'error')
    }
  }

  React.useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true)
      try {
        // Load stats
        try {
          const statsRes = await API.get('/admin/dashboard')
          if (import.meta.env.DEV) {
            console.log('[Dashboard Response]:', statsRes.data)
          }
          setStats(statsRes.data)
        } catch (statsErr) {
          console.error('[Dashboard Response Error]:', statsErr)
          useModalStore.getState().showToast('فشل تحميل إحصائيات لوحة التحكم.', 'error')
          // Fallback stats to allow rendering
          setStats({
            total_teachers: 0,
            total_students: 0,
            total_courses: 0,
            total_enrollments: 0,
            total_revenue: '0.00',
            monthly_revenue: '0.00',
            recent_transactions: [],
            monthly_chart: [],
            sub_lifetime_revenue: 0,
            sub_current_month_revenue: 0,
            sub_previous_month_revenue: 0,
            sub_today_revenue: 0,
            sub_pending_revenue: 0,
            sub_refunded_revenue: 0,
            sub_growth_percentage: 0,
          })
        }

        // Load packages
        try {
          const pkgsRes = await API.get('/admin/packages')
          if (import.meta.env.DEV) {
            console.log('[Packages Response]:', pkgsRes.data)
          }
          setPackages(pkgsRes.data)
        } catch (pkgsErr) {
          console.error('[Packages Response Error]:', pkgsErr)
          useModalStore.getState().showToast('فشل تحميل الباقات المجمعة.', 'error')
        }
      } catch (err) {
        console.error('[Dashboard Loader Error]:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDashboardData()
  }, [])

  React.useEffect(() => {
    if (user?.is_super_admin || user?.is_super) {
      const fetchMaintenanceSettings = async () => {
        try {
          const res = await API.get('/admin/maintenance-settings')
          if (res.data) {
            setMaintenanceMode(res.data.maintenance_mode)
            setMaintenanceMessage(res.data.maintenance_message || '')
            setMaintenanceEta(res.data.maintenance_eta || '')
          }
        } catch (err) {
          console.error('[Maintenance Fetch Error]:', err)
        }
      }
      fetchMaintenanceSettings()
    }
  }, [user])

  // Synchronize maintenance state changes in real-time across layout components
  React.useEffect(() => {
    const handleSyncUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setMaintenanceMode(!!detail)
    }
    window.addEventListener('elm_maintenance_updated', handleSyncUpdate)
    return () => window.removeEventListener('elm_maintenance_updated', handleSyncUpdate)
  }, [])

  const saveMaintenanceSettings = async (mode: boolean, msg: string, etaStr: string) => {
    setSavingSettings(true)
    try {
      const res = await API.post('/admin/maintenance-settings', {
        maintenance_mode: mode,
        maintenance_message: msg,
        maintenance_eta: etaStr,
      })
      
      setMaintenanceMode(res.data.settings.maintenance_mode)
      setMaintenanceMessage(res.data.settings.maintenance_message || '')
      setMaintenanceEta(res.data.settings.maintenance_eta || '')
      
      useModalStore.getState().showToast('تم تحديث حالة وضع الصيانة', 'success')
      
      // Dispatch event to sync banner
      window.dispatchEvent(new CustomEvent('elm_maintenance_updated', { detail: res.data.settings.maintenance_mode }))
    } catch (err: any) {
      console.error(err)
      useModalStore.getState().showToast(err.response?.data?.message || 'فشل تحديث وضع الصيانة.', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleMaintenanceToggle = () => {
    if (savingSettings) return
    const nextState = !maintenanceMode
    if (nextState) {
      useModalStore.getState().showConfirm({
        title: 'تفعيل وضع الصيانة',
        description: 'سيؤدي تفعيل وضع الصيانة إلى قطع الاتصال فوراً عن جميع الطلاب والمعلمين المسجلين في المنصة. هل ترغب في المتابعة؟',
        confirmText: 'نعم، قم بالتفعيل',
        cancelText: 'إلغاء',
        type: 'delete',
        onConfirm: () => saveMaintenanceSettings(true, maintenanceMessage, maintenanceEta)
      })
    } else {
      saveMaintenanceSettings(false, maintenanceMessage, maintenanceEta)
    }
  }

  const handleSaveMaintenanceSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingSettings) return
    await saveMaintenanceSettings(maintenanceMode, maintenanceMessage, maintenanceEta)
  }


  const handleEditPackageClick = async (pkg: any) => {
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
      await API.put(`/admin/packages/${editPackageMode.id}`, {
        title: packageTitle,
        price: packagePrice || '0.00',
        description: packageDesc,
        cover_image: packageCoverImage,
        package_thumbnail: packageThumbnail,
        lesson_ids: selectedLessons,
      })
      useModalStore.getState().showToast('تم تعديل الباقة بنجاح.', 'success')
      setShowPackageForm(false)
      setEditPackageMode(null)
      setPackageTitle('')
      setPackagePrice('')
      setPackageDesc('')
      setPackageCoverImage('')
      setPackageThumbnail('')
      fetchPackages()
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تعديل الباقة.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeletePackage = (packageId: number) => {
    console.log("Deleting package:", packageId);
    useModalStore.getState().showConfirm({
      title: 'حذف الباقة المجمعة (مسؤول المنصة)',
      description: 'هل أنت متأكد من حذف هذه الباقة كمسؤول للموقع؟ سيتم إلغاء تفعيل الباقة للطلاب الجدد فوراً.',
      confirmText: 'حذف الباقة نهائياً',
      cancelText: 'إلغاء',
      type: 'delete',
      onConfirm: async () => {
        setLoading(true)
        try {
          const res = await API.delete(`/admin/packages/${packageId}`)
          console.log("Delete response:", res);
          
          // Update local packages state immediately
          setPackages(prev => prev.filter(pkg => pkg.id !== packageId))
          
          fetchPackages()
          useModalStore.getState().showToast(res.data.message || 'تم حذف الباقة بنجاح.', 'success')
        } catch (err: any) {
          console.error(err)
          useModalStore.getState().showToast(err.response?.data?.message || 'فشل حذف الباقة.', 'error')
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

  const chartData = React.useMemo(() => {
    if (!stats || !stats.monthly_chart || stats.monthly_chart.length === 0) {
      return [
        { name: 'لا توجد مبيعات', value: 0 }
      ]
    }
    return stats.monthly_chart.map((item) => {
      const parts = item.month.split('-')
      const year = parts[0]
      const monthNum = parseInt(parts[1], 10)
      const monthsArabic = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
      const monthName = monthsArabic[monthNum - 1] || item.month
      return {
        name: `${monthName} ${year}`,
        value: parseFloat(item.total)
      }
    })
  }, [stats])

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-black">التحليلات ومبيعات المنصة</h1>
        <p className="text-sm text-slate-400 font-light mt-1">عرض أداء المنصة الإجمالي وأرباح المعلمين وحركة شحن الأكواد</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          
          {/* Revenue */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-[20px] space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-secondary)] font-semibold">إحصائيات المبيعات والأرباح</span>
              <div className="p-2.5 bg-emerald-500/10 text-brand-primary rounded-2xl">
                <Coins className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-2 text-right">
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] block font-medium">صافي الأرباح (Net)</span>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {Number(stats.net_revenue ?? stats.total_revenue).toFixed(2)} ج.م
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-color)]">
                <div>
                  <span className="text-[9px] text-[var(--text-secondary)] block">الإجمالي (Gross)</span>
                  <span className="text-xs font-bold text-[var(--text-secondary)]">{Number(stats.gross_revenue ?? stats.total_revenue).toFixed(2)} ج.م</span>
                </div>
                <div>
                  <span className="text-[9px] text-[var(--text-secondary)] block">المسترجع (Refund)</span>
                  <span className="text-xs font-bold text-red-500">{Number(stats.refunded_revenue ?? 0).toFixed(2)} ج.م</span>
                </div>
              </div>
              <div className="text-[9px] text-[var(--text-secondary)] pt-1">
                صافي الشهر: {Number(stats.net_monthly_revenue ?? stats.monthly_revenue).toFixed(2)} ج.م
              </div>
            </div>
          </div>

          {/* Subscription Revenue */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-[20px] space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-secondary)] font-semibold">إيرادات اشتراكات المعلمين</span>
              <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                <Shield className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-2 text-right">
              <div>
                <div className="flex justify-between items-center">
                  {stats.sub_growth_percentage !== undefined && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      stats.sub_growth_percentage >= 0 
                        ? 'bg-emerald-500/10 text-emerald-500' 
                        : 'bg-rose-500/10 text-rose-500'
                    }`}>
                      {stats.sub_growth_percentage >= 0 ? '+' : ''}{Number(stats.sub_growth_percentage).toFixed(1)}%
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--text-secondary)] block font-medium">الإيراد الكلي (Lifetime)</span>
                </div>
                <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                  {Number(stats.sub_lifetime_revenue ?? 0).toFixed(2)} ج.م
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-color)]">
                <div>
                  <span className="text-[8px] text-[var(--text-secondary)] block">الشهر الحالي</span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]">{Number(stats.sub_current_month_revenue ?? 0).toFixed(1)} ج.م</span>
                </div>
                <div>
                  <span className="text-[8px] text-[var(--text-secondary)] block">الشهر السابق</span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]">{Number(stats.sub_previous_month_revenue ?? 0).toFixed(1)} ج.م</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-[var(--border-color)] text-[8px]">
                <div>
                  <span className="text-[8px] text-slate-500 block">اليوم</span>
                  <span className="font-semibold text-emerald-500">{Number(stats.sub_today_revenue ?? 0).toFixed(0)} ج.م</span>
                </div>
                <div>
                  <span className="text-[8px] text-slate-500 block">معلق</span>
                  <span className="font-semibold text-amber-500">{Number(stats.sub_pending_revenue ?? 0).toFixed(0)} ج.م</span>
                </div>
                <div>
                  <span className="text-[8px] text-slate-500 block">مسترجع</span>
                  <span className="font-semibold text-rose-500">{Number(stats.sub_refunded_revenue ?? 0).toFixed(0)} ج.م</span>
                </div>
              </div>
            </div>
          </div>

          {/* Students */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-[20px] space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-secondary)] font-semibold">الطلاب المسجلون</span>
              <div className="p-2.5 bg-emerald-500/10 text-brand-primary rounded-2xl">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-black">{stats.total_students}</div>
              <div className="text-[10px] text-[var(--text-secondary)] font-light">طالب نشط بالمنصة</div>
            </div>
          </div>

          {/* Teachers */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-[20px] space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-secondary)] font-semibold">أعضاء هيئة التدريس</span>
              <div className="p-2.5 bg-emerald-500/10 text-brand-primary rounded-2xl">
                <GraduationCap className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-black">{stats.total_teachers}</div>
              <div className="text-[10px] text-[var(--text-secondary)] font-light">معلم معتمد وصاحب كورس</div>
            </div>
          </div>

          {/* Enrollments */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-[20px] space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--text-secondary)] font-semibold">الاشتراكات بالكورسات</span>
              <div className="p-2.5 bg-emerald-500/10 text-brand-primary rounded-2xl">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-black">{stats.total_enrollments}</div>
              <div className="text-[10px] text-[var(--text-secondary)] font-light">عملية تفعيل واشتراك كاملة</div>
            </div>
          </div>

        </div>
      )}

      {/* Charts & Transactions details grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Revenue Area Chart */}
        <div className="lg:col-span-2 bg-brand-card border border-[var(--border-color)] p-8 rounded-3xl space-y-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-primary" />
              <span>معدل نمو الإيرادات والمبيعات</span>
            </h3>
            <span className="text-xs text-slate-400">آخر 6 أشهر</span>
          </div>

          <div className="w-full overflow-x-auto max-w-full">
            <SafeResponsiveContainer height={256}>
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E333D" vertical={false} />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#1B1E24', borderColor: '#2E333D', direction: 'rtl' }} />
                <Area type="monotone" dataKey="value" stroke="#16A34A" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </SafeResponsiveContainer>
          </div>
        </div>

        {/* Recent ledger transactions */}
        <div className="lg:col-span-1 bg-brand-card border border-[var(--border-color)] p-8 rounded-3xl space-y-6 shadow-sm flex flex-col justify-between">
          <h3 className="font-bold text-base border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand-primary" />
            <span>آخر العمليات النشطة:</span>
          </h3>

          {stats && stats.recent_transactions.length === 0 ? (
            <div className="text-center py-20 text-slate-500 font-light text-xs">لا توجد عمليات مسجلة بالمنصة.</div>
          ) : (
            <div className="space-y-4 overflow-y-auto max-h-60 pr-1 text-xs">
              {stats?.recent_transactions.map((tx: any) => (
                <div key={tx.id} className="flex justify-between items-center p-3.5 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-2xl">
                  <div className="space-y-0.5">
                    <div className="font-bold">{tx.description}</div>
                    <div className="text-[9px] text-slate-500">{tx.wallet.student.name}</div>
                  </div>
                  <div className={`font-black ${tx.type === 'purchase' ? 'text-rose-500' : 'text-brand-success'}`}>
                    {tx.type === 'purchase' ? '-' : '+'}{tx.amount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Monthly Packages Section (Admin View) */}
      {packages && (
        <div className="space-y-6 pt-12 border-t border-[var(--border-color)]">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-brand-primary" />
              <span>إجمالي الباقات المجمعة النشطة بالمنصة</span>
            </h2>
            <p className="text-xs text-slate-400 font-light mt-1">إشراف كامل على باقات الاشتراكات الشهرية وتعديل أو حذف أي باقة وتتبع أعداد المشتركين</p>
          </div>

          {packages.length === 0 ? (
            <div className="bg-brand-card border border-[var(--border-color)] p-12 text-center rounded-3xl text-slate-500 font-light text-sm">
              لا توجد باقات مجمعة منشأة بالمنصة حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div key={pkg.id} className="bg-brand-card border border-border-color rounded-3xl overflow-hidden hover:border-brand-primary/30 hover:shadow-xl transition-all duration-300 group flex flex-col justify-between shadow-md">
                  {/* Thumbnail area */}
                  <div className="aspect-video bg-brand-surface relative overflow-hidden">
                    <img 
                      src={pkg.package_thumbnail || pkg.cover_image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} 
                      alt={pkg.title} 
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute top-3 right-3 px-3 py-1 bg-black/80 text-white rounded-full text-[10px] font-black border border-white/10">
                      باقة مجمعة
                    </div>
                  </div>

                  <div className="p-6 space-y-4 flex-grow flex flex-col justify-between">
                    <div className="space-y-2 text-right">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-base text-foreground group-hover:text-brand-primary transition-colors">{pkg.title}</h3>
                          <span className="text-[10px] text-text-secondary font-light block mt-0.5">المعلم: {pkg.course?.teacher?.name}</span>
                          <span className="text-[9px] text-slate-500 font-light block">الكورس: {pkg.course?.title}</span>
                        </div>
                        <span className="text-xs font-bold text-brand-success bg-brand-success/10 px-2 py-1 rounded-lg shrink-0">
                          {pkg.price} ج.م
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] text-text-secondary font-light pt-2 text-right">
                        <div>عدد الكورسات: 1</div>
                        <div>عدد المحاضرات: {pkg.lessons?.length || pkg.lessons_count || 0}</div>
                        <div className="col-span-2">عدد المشتركين: {pkg.enrollments_count || 0} طالباً</div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-border-color">
                      <button
                        onClick={() => handleEditPackageClick(pkg)}
                        className="flex-1 py-2 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white border border-brand-primary/10 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Edit3 className="h-4 w-4" /> <span>تعديل</span>
                      </button>
                      <button
                        onClick={() => {
                          console.log("Delete button clicked", pkg.id);
                          handleDeletePackage(pkg.id);
                        }}
                        className="flex-1 py-2 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/10 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
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

      {/* Package Edit Form Modal (Admin View) */}
      {showPackageForm && editPackageMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/10 z-40" onClick={() => { setShowPackageForm(false); setEditPackageMode(null); }} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] z-50 text-right">
            <h3 className="text-lg font-black border-b border-[var(--border-color)] pb-3">تعديل الباقة المجمعة (مدير النظام)</h3>
            
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

      {/* Platform Settings (Super Admin Only) */}
      {(user?.is_super_admin || user?.is_super) && (
        <div className="space-y-6 pt-12 border-t border-[var(--border-color)] text-right">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-400" />
              <span>إعدادات المنصة (المشرف العام)</span>
            </h2>
            <p className="text-xs text-slate-400 font-light mt-1">
              التحكم في حالة تشغيل المنصة العامة وتفعيل وضع الصيانة لجميع المستخدمين عدا الإدارة.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-brand-card border border-border-color p-8 rounded-3xl space-y-6 shadow-sm">
              <h3 className="font-bold text-base flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
                <span>وضع الصيانة (Maintenance Mode)</span>
              </h3>
              
              <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <span className="text-xs text-slate-400">حالة وضع الصيانة الحالية</span>
                
                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full ${maintenanceMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span className="text-lg font-black tracking-wide">
                    {maintenanceMode ? 'ON (نشط)' : 'OFF (معطل)'}
                  </span>
                </div>

                {/* Beautiful Switch Button */}
                <button
                  type="button"
                  onClick={handleMaintenanceToggle}
                  disabled={savingSettings}
                  className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                    maintenanceMode ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      maintenanceMode ? '-translate-x-8' : 'translate-x-0'
                    }`}
                  />
                </button>

                {/* Preview Button */}
                <button
                  type="button"
                  onClick={() => window.open('/maintenance', '_blank')}
                  className="mt-4 px-4 py-2 border border-[var(--border-color)] hover:border-slate-500 text-slate-300 text-xs font-bold rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                >
                  معاينة صفحة الصيانة
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-brand-card border border-border-color p-8 rounded-3xl shadow-sm">
              <form onSubmit={handleSaveMaintenanceSettings} className="space-y-6 text-right">
                <h3 className="font-bold text-base border-b border-[var(--border-color)] pb-3">
                  <span>إعدادات رسالة ووقت الصيانة</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Custom Message */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold block text-slate-300">رسالة مخصصة تظهر للطلاب (اختياري)</label>
                    <textarea
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      disabled={savingSettings}
                      placeholder="مثال: يتم إضافة مميزات جديدة..."
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-indigo-500/50 min-h-[80px] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Estimated Time */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold block text-slate-300">الوقت المتوقع للانتهاء (اختياري)</label>
                    <input
                      type="text"
                      value={maintenanceEta}
                      onChange={(e) => setMaintenanceEta(e.target.value)}
                      disabled={savingSettings}
                      placeholder="مثال: سيتم الانتهاء خلال ساعة"
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-[var(--border-color)]">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-950/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingSettings ? 'جاري حفظ الإعدادات...' : 'حفظ إعدادات الصيانة'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
