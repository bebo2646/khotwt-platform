import React, { useState, useEffect, useCallback } from 'react'
import API from '../../services/api'
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Copy,
  Clock,
  Globe,
  Terminal,
  Server,
  UserX,
} from 'lucide-react'
import { useModalStore } from '../../store/modalStore'

interface SecurityStats {
  events_today_count: number
  unauthorized_today_count: number
  unknown_routes_today_count: number
  rate_limits_today_count: number
  high_severity_today_count: number
  active_blocked_ips_count: number
  total_blocked_ips_count: number
  severity_breakdown: {
    low: number
    medium: number
    high: number
    critical: number
  }
  recent_high_priority: any[]
  top_ips: { ip_address: string; count: number }[]
}

interface SecurityEventItem {
  id: number
  event_type: string
  event_name?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  ip_address: string
  http_method: string
  path: string
  status_code: number
  user_id?: number | null
  user?: {
    id: number
    name: string
    email: string
    phone?: string
    role: string
  } | null
  request_id?: string | null
  metadata?: any
  occurred_at: string
}

interface BlockedIpItem {
  id: number
  ip_address: string
  failed_attempts: number
  is_blocked: boolean
  is_currently_blocked?: boolean
  blocked_at: string | null
  blocked_until: string | null
  remaining_minutes?: number
  reason: string | null
  last_identifier: string | null
  user_agent: string | null
  created_at: string
  updated_at: string
}

export default function SecurityMonitoring() {
  const { showToast } = useModalStore()

  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [events, setEvents] = useState<SecurityEventItem[]>([])
  const [blockedIps, setBlockedIps] = useState<BlockedIpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [unblockingIp, setUnblockingIp] = useState<string | null>(null)

  // Pagination & Filtering
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalEvents, setTotalEvents] = useState(0)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [statusCodeFilter, setStatusCodeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal State
  const [selectedEvent, setSelectedEvent] = useState<SecurityEventItem | null>(null)

  // Fetch Summary Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await API.get('/admin/security/stats')
      setStats(res.data)
    } catch (err) {
      console.error('Failed to load security stats', err)
    }
  }, [])

  // Fetch Blocked IPs
  const fetchBlockedIps = useCallback(async () => {
    try {
      const res = await API.get('/admin/security/blocked-ips?status=blocked')
      setBlockedIps(res.data.data || [])
    } catch (err) {
      console.error('Failed to load blocked IPs', err)
    }
  }, [])

  // Fetch Paginated Security Events
  const fetchEvents = useCallback(async (page = 1) => {
    setEventsLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('per_page', '20')
      if (severityFilter !== 'all') params.append('severity', severityFilter)
      if (eventTypeFilter !== 'all') params.append('event_type', eventTypeFilter)
      if (statusCodeFilter) params.append('status_code', statusCodeFilter)
      if (searchQuery.trim()) params.append('search', searchQuery.trim())

      const res = await API.get(`/admin/security/events?${params.toString()}`)
      setEvents(res.data.data || [])
      setCurrentPage(res.data.current_page || 1)
      setTotalPages(res.data.last_page || 1)
      setTotalEvents(res.data.total || 0)
    } catch (err) {
      console.error('Failed to load security events', err)
    } finally {
      setEventsLoading(false)
    }
  }, [severityFilter, eventTypeFilter, statusCodeFilter, searchQuery])

  // Initial Load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchStats(), fetchBlockedIps(), fetchEvents(1)])
      setLoading(false)
    }
    init()
  }, [fetchStats, fetchBlockedIps, fetchEvents])

  // Polling: Auto refresh stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats()
      fetchBlockedIps()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchStats, fetchBlockedIps])

  // Handle Unblock Action
  const handleUnblock = async (ip: string) => {
    if (!confirm(`هل أنت متأكد من إلغاء حظر عنوان IP: ${ip}؟`)) return

    setUnblockingIp(ip)
    try {
      await API.post('/admin/security/unblock-ip', { ip_address: ip, reason: 'إلغاء حظر يدوي من قبل المشرف' })
      showToast('تم إلغاء حظر عنوان IP بنجاح.', 'success')
      await Promise.all([fetchBlockedIps(), fetchStats()])
    } catch (err: any) {
      const msg = err.response?.data?.message || 'فشلت عملية إلغاء الحظر.'
      showToast(msg, 'error')
    } finally {
      setUnblockingIp(null)
    }
  }

  // Copy to clipboard
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showToast(`تم نسخ ${label} إلى الحافظة.`, 'success')
  }

  // Severity Styling Helper
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-xs font-black">حرج جداً</span>
      case 'high':
        return <span className="px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-xs font-black">عالي الخطورة</span>
      case 'medium':
        return <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-bold">متوسط</span>
      case 'low':
      default:
        return <span className="px-2.5 py-1 bg-slate-500/20 text-slate-300 border border-slate-500/30 rounded-full text-xs font-medium">منخفض</span>
    }
  }

  // Status Code Styling Helper
  const getStatusCodeBadge = (code: number) => {
    if (code === 429) {
      return <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-md font-mono text-xs font-bold">429 Block</span>
    }
    if (code === 403) {
      return <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-md font-mono text-xs font-bold">403 Forbidden</span>
    }
    if (code === 401) {
      return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md font-mono text-xs font-bold">401 Auth</span>
    }
    if (code === 404) {
      return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md font-mono text-xs font-bold">404 Not Found</span>
    }
    return <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md font-mono text-xs font-bold">{code}</span>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-brand-primary font-black text-sm">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <span>نظام الحماية والمراقبة الاستباقية</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">الأمان ومكافحة التهديدات</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            مراقبة محاولات الاختراق، الهجمات التكرارية (Brute-force)، العناوين المحظورة، والطلبات المشبوهة لحظياً.
          </p>
        </div>

        <button
          onClick={() => {
            fetchStats()
            fetchBlockedIps()
            fetchEvents(currentPage)
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          <span>تحديث البيانات الآن</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Events */}
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">الأحداث اليوم</span>
            <Terminal className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats?.events_today_count ?? 0}</div>
        </div>

        {/* Unauthorized (401/403) */}
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">غير مصرح (401/403)</span>
            <UserX className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{stats?.unauthorized_today_count ?? 0}</div>
        </div>

        {/* Unknown Routes (404) */}
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">مسارات مجهولة (404)</span>
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400">{stats?.unknown_routes_today_count ?? 0}</div>
        </div>

        {/* Rate Limits (429) */}
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">تجاوز المعدل (429)</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400">{stats?.rate_limits_today_count ?? 0}</div>
        </div>

        {/* High Severity */}
        <div className="p-5 bg-slate-900/60 border border-red-500/20 bg-red-500/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-red-400">
            <span className="text-xs font-bold">خطورة عالية</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-400">{stats?.high_severity_today_count ?? 0}</div>
        </div>

        {/* Currently Blocked IPs */}
        <div className="p-5 bg-slate-900/60 border border-purple-500/20 bg-purple-500/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-purple-400">
            <span className="text-xs font-bold">عناوين IP محظورة</span>
            <Lock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400">{stats?.active_blocked_ips_count ?? 0}</div>
        </div>
      </div>

      {/* Blocked IPs Section */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">عناوين IP المحظورة حالياً (Brute-Force Protection)</h2>
              <p className="text-xs text-slate-400">العناوين التي تجاوزت 5 محاولات دخول فاشلة وتم حظرها لمدة 30 دقيقة تلقائياً.</p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full">
            {blockedIps.length} عنوان محظور
          </span>
        </div>

        {blockedIps.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-bold bg-slate-950/40 rounded-2xl border border-slate-800/60 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>لا توجد عناوين IP محظورة حالياً. جميع الطلبات ضمن النطاق الطبيعي.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3 font-bold">عنوان IP</th>
                  <th className="p-3 font-bold">المحاولات الفاشلة</th>
                  <th className="p-3 font-bold">آخر حساب حاول الدخول به</th>
                  <th className="p-3 font-bold">تاريخ الحظر</th>
                  <th className="p-3 font-bold">متبقي على رفع الحظر</th>
                  <th className="p-3 font-bold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {blockedIps.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono font-bold flex items-center gap-2">
                      <span>{b.ip_address}</span>
                      <button
                        onClick={() => handleCopy(b.ip_address, 'عنوان IP')}
                        className="text-slate-500 hover:text-slate-300 transition-colors"
                        title="نسخ IP"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-400 font-bold rounded-md">
                        {b.failed_attempts} محاولات
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400">
                      {b.last_identifier || 'غير محدد'}
                    </td>
                    <td className="p-3 text-slate-400">
                      {b.blocked_at ? new Date(b.blocked_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 bg-amber-500/10 text-amber-400 font-bold rounded-md border border-amber-500/20">
                        {b.remaining_minutes ? `~ ${b.remaining_minutes} دقيقة` : 'أقل من دقيقة'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleUnblock(b.ip_address)}
                        disabled={unblockingIp === b.ip_address}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 mx-auto transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>{unblockingIp === b.ip_address ? 'جاري الفك...' : 'إلغاء الحظر'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Security Events Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-6">
        {/* Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-black text-foreground">سجل الأحداث والطلبات المشبوهة</h2>
              <p className="text-xs text-slate-400">إجمالي الأحداث المسجلة: {totalEvents}</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث بـ IP أو المسار أو المستخدم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') fetchEvents(1)
                  }}
                  className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary"
                />
              </div>

              <button
                onClick={() => fetchEvents(1)}
                className="px-3 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                تطبيق
              </button>
            </div>
          </div>

          {/* Quick Filter Badges */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/60">
            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-bold">الخطورة:</span>
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSeverityFilter(s)
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    severityFilter === s
                      ? 'bg-brand-primary text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {s === 'all' ? 'الكل' : s === 'critical' ? 'حرج' : s === 'high' ? 'عالي' : s === 'medium' ? 'متوسط' : 'منخفض'}
                </button>
              ))}
            </div>

            {/* Event Group Filter */}
            <div className="flex items-center gap-1.5 text-xs mr-4">
              <span className="text-slate-400 font-bold">النوع:</span>
              {[
                { key: 'all', label: 'الكل' },
                { key: 'auth', label: 'المصادقة والدخول' },
                { key: 'routes', label: 'مسارات مجهولة' },
                { key: 'access', label: 'رفض الصلاحيات' },
                { key: 'rate_limit', label: 'معدل الطلبات' },
              ].map((g) => (
                <button
                  key={g.key}
                  onClick={() => {
                    setEventTypeFilter(g.key)
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    eventTypeFilter === g.key
                      ? 'bg-brand-secondary text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Events Table */}
        {eventsLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold">جاري تحميل السجلات الأمنية...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-bold bg-slate-950/40 rounded-2xl border border-slate-800/60">
            لا توجد أحداث أمنية تطابق معايير البحث الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3 font-bold">الخطورة</th>
                  <th className="p-3 font-bold">الحدث</th>
                  <th className="p-3 font-bold">الحالة</th>
                  <th className="p-3 font-bold">المسار (Endpoint)</th>
                  <th className="p-3 font-bold">عنوان IP</th>
                  <th className="p-3 font-bold">المستخدم / المعرف</th>
                  <th className="p-3 font-bold">معرف الطلب (Request ID)</th>
                  <th className="p-3 font-bold">التوقيت</th>
                  <th className="p-3 font-bold text-center">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3">{getSeverityBadge(evt.severity)}</td>
                    <td className="p-3 font-bold text-white">
                      <div className="font-mono text-xs">{evt.event_type}</div>
                      {evt.event_name && <div className="text-[10px] text-slate-400 font-sans">{evt.event_name}</div>}
                    </td>
                    <td className="p-3">{getStatusCodeBadge(evt.status_code)}</td>
                    <td className="p-3 font-mono text-xs text-slate-300 max-w-[200px] truncate" title={evt.path}>
                      <span className="text-slate-500 font-bold ml-1">{evt.http_method}</span>
                      {evt.path}
                    </td>
                    <td className="p-3 font-mono font-bold">
                      <div className="flex items-center gap-1.5">
                        <span>{evt.ip_address}</span>
                        <button
                          onClick={() => handleCopy(evt.ip_address, 'IP')}
                          className="text-slate-500 hover:text-slate-300"
                          title="نسخ"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="p-3">
                      {evt.user ? (
                        <div>
                          <span className="font-bold text-white block">{evt.user.name}</span>
                          <span className="text-[10px] text-slate-400">{evt.user.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">
                          {evt.metadata?.attempted_identifier || 'زائر غير مسجل'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-400">
                      {evt.request_id ? (
                        <div className="flex items-center gap-1">
                          <span className="truncate max-w-[90px]" title={evt.request_id}>
                            {evt.request_id.slice(0, 8)}...
                          </span>
                          <button
                            onClick={() => handleCopy(evt.request_id!, 'Request ID')}
                            className="text-slate-500 hover:text-slate-300"
                            title="نسخ المعرف"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(evt.occurred_at).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="عرض التفاصيل الفنية"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-4 border-t border-slate-800 text-xs">
            <span className="text-slate-400">
              الصفحة {currentPage} من {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchEvents(currentPage - 1)}
                disabled={currentPage <= 1 || eventsLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg disabled:opacity-50 cursor-pointer font-bold"
              >
                السابق
              </button>
              <button
                onClick={() => fetchEvents(currentPage + 1)}
                disabled={currentPage >= totalPages || eventsLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg disabled:opacity-50 cursor-pointer font-bold"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Event Details Inspector Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                {getSeverityBadge(selectedEvent.severity)}
                <h3 className="text-base font-black text-white">تفاصيل الحدث الأمني #{selectedEvent.id}</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-slate-500 font-bold block">نوع الحدث:</span>
                <span className="font-mono text-white font-bold">{selectedEvent.event_type}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-slate-500 font-bold block">حالة الاستجابة (Status):</span>
                <span>{getStatusCodeBadge(selectedEvent.status_code)}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-slate-500 font-bold block">عنوان IP:</span>
                <span className="font-mono text-white font-bold">{selectedEvent.ip_address}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-slate-500 font-bold block">المسار المطلوب:</span>
                <span className="font-mono text-white truncate block">{selectedEvent.path}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1 col-span-2">
                <span className="text-slate-500 font-bold block">Request Correlation ID:</span>
                <span className="font-mono text-emerald-400 text-xs select-all">
                  {selectedEvent.request_id || 'N/A'}
                </span>
              </div>
            </div>

            {/* Sanitized Metadata */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 block">البيانات الفنية المعقمة (Metadata):</span>
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60 dir-ltr text-left">
                {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
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
