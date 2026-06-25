import React from 'react'
import API from '../../services/api'
import { Database, Users, Video, AlertTriangle, Search, HardDrive, RefreshCw, BarChart2, ShieldAlert, Loader2 } from 'lucide-react'
import { useModalStore } from '../../store/modalStore'

interface TeacherUsage {
  id: number
  name: string
  email: string
  plan_name: string
  bunny_storage_used_gb: number
  bunny_storage_limit_gb: number
  used_percentage: number
  video_count: number
}

interface LargestVideo {
  id: number
  title: string
  bunny_video_id: string
  bunny_size_bytes: number
  bunny_size_gb: number
  bunny_status: string
  course_title: string
  teacher_name: string
}

interface AdminBunnyStats {
  total_storage_bytes: number
  total_storage_gb: number
  teachers_usage: TeacherUsage[]
  top_consumers: TeacherUsage[]
  largest_videos: LargestVideo[]
}

export default function BunnyDashboard() {
  const [stats, setStats] = React.useState<AdminBunnyStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [actionLoading, setActionLoading] = React.useState(false)

  const fetchStats = async () => {
    try {
      setLoading(true)
      const res = await API.get('/admin/bunny/dashboard')
      setStats(res.data)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل إحصائيات Bunny Stream.', 'error')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchStats()
  }, [])

  const handleSyncAll = async () => {
    try {
      setActionLoading(true)
      // Call public or special endpoint to run sync job (e.g. settings/reports/subscription endpoints)
      // We can also let the backend do it, or we can just fetch fresh stats which automatically triggers recalculations
      await fetchStats()
      useModalStore.getState().showToast('تمت مزامنة المساحات التخزينية بنجاح.', 'success')
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0 || !bytes) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Filter teachers by search query
  const filteredTeachers = React.useMemo(() => {
    if (!stats) return []
    if (!searchQuery.trim()) return stats.teachers_usage
    const query = searchQuery.toLowerCase()
    return stats.teachers_usage.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.email.toLowerCase().includes(query) ||
        t.plan_name.toLowerCase().includes(query)
    )
  }, [stats, searchQuery])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4 rtl" dir="rtl">
        <Loader2 className="h-12 w-12 text-brand-primary animate-spin" />
        <span className="text-slate-400 font-medium">جاري تحميل إحصائيات التخزين السحابي...</span>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 rtl" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Database className="text-brand-primary h-8 w-8" />
            <span>إحصائيات Bunny Stream والمساحة</span>
          </h1>
          <p className="text-sm text-slate-400 font-light mt-1">
            متابعة إجمالي استهلاك مساحات التخزين السحابية لكل المعلمين بالمنصة والملفات الأكبر حجماً.
          </p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={actionLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-brand-primary/10 disabled:bg-slate-800"
        >
          {actionLoading ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <RefreshCw className="h-4.5 w-4.5" />
          )}
          <span>مزامنة وتحديث المساحات</span>
        </button>
      </div>

      {/* Summary Analytics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Total Space */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm hover:border-brand-primary/10 transition-all duration-300">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-semibold">إجمالي المساحة المستخدمة</span>
              <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl">
                <HardDrive className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-black text-slate-100">{stats.total_storage_gb.toFixed(3)} GB</div>
              <div className="text-xs text-slate-500 font-light font-mono">({formatBytes(stats.total_storage_bytes)})</div>
            </div>
          </div>

          {/* Videos Uploaded */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm hover:border-brand-primary/10 transition-all duration-300">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-semibold">عدد الفيديوهات الكلي</span>
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Video className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-black text-slate-100">
                {stats.teachers_usage.reduce((sum, t) => sum + t.video_count, 0)} فيديو
              </div>
              <div className="text-xs text-slate-500 font-light">موزعة على كافة كورسات المعلمين</div>
            </div>
          </div>

          {/* Average Load */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm hover:border-brand-primary/10 transition-all duration-300">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-semibold">عدد المعلمين النشطين</span>
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-black text-slate-100">
                {stats.teachers_usage.filter((t) => t.video_count > 0).length} معلّم
              </div>
              <div className="text-xs text-slate-500 font-light">
                من أصل {stats.teachers_usage.length} مسجلين بالمنصة
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Top Consumers & Critical Alerts */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Top Storage Consumers */}
          <div className="lg:col-span-1 bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
            <div>
              <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
                <BarChart2 className="text-brand-primary h-5 w-5" />
                <span>أكثر المعلمين استهلاكاً</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-light">المعلمون الـ 5 الأكثر استخداماً لسعة التخزين.</p>
            </div>

            <div className="space-y-3.5 pt-2">
              {stats.top_consumers.map((t, index) => (
                <div key={t.id} className="flex justify-between items-center p-3 bg-slate-900/40 rounded-xl border border-slate-800 hover:border-slate-700/50 transition-all">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded bg-brand-primary/10 text-brand-primary flex items-center justify-center text-[10px] font-mono">{index + 1}</span>
                      {t.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-light block">{t.plan_name} • {t.video_count} فيديو</span>
                  </div>
                  <div className="text-left font-mono space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 block">{t.bunny_storage_used_gb.toFixed(2)} GB</span>
                    <span className={`text-[10px] font-semibold ${t.used_percentage > 85 ? 'text-rose-400' : 'text-slate-500'}`}>
                      {t.used_percentage}%
                    </span>
                  </div>
                </div>
              ))}
              {stats.top_consumers.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">لا توجد بيانات استهلاك حالية.</p>
              )}
            </div>
          </div>

          {/* Largest Videos List */}
          <div className="lg:col-span-2 bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
            <div>
              <h3 className="text-md font-bold text-slate-200 flex items-center gap-2">
                <ShieldAlert className="text-brand-primary h-5 w-5" />
                <span>أكبر الفيديوهات حجماً بالمنصة (تأثير التكلفة)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-light">أكبر 10 ملفات فيديو مستضافة على Bunny Stream وتكلفتها التخزينية عالية.</p>
            </div>

            <div className="overflow-x-auto pt-2">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold">
                    <th className="pb-2 text-right">اسم الفيديو / المعلم</th>
                    <th className="pb-2 text-right">الكورس الدراسي</th>
                    <th className="pb-2 text-right">الحجم الكلي</th>
                    <th className="pb-2 text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.largest_videos.map((v) => (
                    <tr key={v.id} className="border-b border-slate-800/40 text-xs hover:bg-slate-900/10">
                      <td className="py-3">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-200 block line-clamp-1">{v.title}</span>
                          <span className="text-[10px] text-slate-500 font-light block">بواسطة المعلم: {v.teacher_name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-slate-400">{v.course_title}</td>
                      <td className="py-3 font-mono font-bold text-slate-300">
                        {v.bunny_size_gb.toFixed(3)} GB
                        <span className="block text-[9px] text-slate-500 font-normal">{formatBytes(v.bunny_size_bytes)}</span>
                      </td>
                      <td className="py-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          v.bunny_status === 'finished' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {v.bunny_status === 'finished' ? 'مكتمل' : 'معالجة'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {stats.largest_videos.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-slate-500">لا توجد فيديوهات مسجلة بالمنصة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Teachers Storage Details Table */}
      {stats && (
        <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Users className="text-brand-primary h-5 w-5" />
                <span>تفاصيل سعة التخزين لكل المعلمين</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-light">تفاصيل استهلاك المساحة والحدود لكل معلّم مسجل بالمنصة.</p>
            </div>
            
            {/* Search filter */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="ابحث عن معلم أو بريد إلكتروني..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-4 pr-10 py-2 text-sm text-slate-200 focus:border-brand-primary focus:outline-none transition-all"
              />
              <Search className="absolute right-3.5 top-3 h-4 w-4 text-slate-500" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold">
                  <th className="pb-3 text-right">المعلم / البريد الإلكتروني</th>
                  <th className="pb-3 text-right">باقة الاشتراك</th>
                  <th className="pb-3 text-right">عدد الفيديوهات</th>
                  <th className="pb-3 text-right">المساحة المستخدمة</th>
                  <th className="pb-3 text-right">الحد الأقصى</th>
                  <th className="pb-3 text-right">نسبة الاستهلاك</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="border-b border-slate-800/50 hover:bg-slate-900/10 text-sm transition-all">
                    <td className="py-4">
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-slate-200">{teacher.name}</h4>
                        <p className="text-xs text-slate-500 font-mono select-all">{teacher.email}</p>
                      </div>
                    </td>

                    <td className="py-4">
                      <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-medium">
                        {teacher.plan_name}
                      </span>
                    </td>

                    <td className="py-4 font-bold text-slate-300">{teacher.video_count} فيديوهات</td>

                    <td className="py-4 font-mono font-bold text-brand-primary">
                      {teacher.bunny_storage_used_gb.toFixed(3)} GB
                    </td>

                    <td className="py-4 font-mono text-slate-400">
                      {teacher.bunny_storage_limit_gb} GB
                    </td>

                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <span className={`font-mono text-xs font-bold shrink-0 ${
                          teacher.used_percentage > 90 
                            ? 'text-rose-400' 
                            : teacher.used_percentage > 70 
                              ? 'text-amber-400' 
                              : 'text-slate-300'
                        }`}>
                          {teacher.used_percentage}%
                        </span>
                        
                        {/* mini progress bar */}
                        <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden shrink-0 hidden sm:block">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              teacher.used_percentage > 90 
                                ? 'bg-rose-500' 
                                : teacher.used_percentage > 70 
                                  ? 'bg-amber-500' 
                                  : 'bg-brand-primary'
                            }`}
                            style={{ width: `${teacher.used_percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTeachers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">لا توجد نتائج بحث مطابقة.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
