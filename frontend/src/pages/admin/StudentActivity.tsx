import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import API from '../../services/api'
import {
  Activity,
  Users,
  Clock,
  BookOpen,
  PlayCircle,
  ClipboardCheck,
  ShoppingCart,
  Search,
  RefreshCw,
  Laptop,
  Smartphone,
  Tablet,
  User,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Flame,
  Radio,
  Layers,
  FileText,
  ShieldAlert,
  Lock,
  AlertTriangle
} from 'lucide-react'
import { useModalStore } from '../../store/modalStore'

interface ActivityLogItem {
  id: number
  student_id: number
  event_type: string
  event_name: string
  description: string
  ip_address: string | null
  user_agent: string | null
  device_type: 'desktop' | 'mobile' | 'tablet' | null
  browser: string | null
  course_id: number | null
  bundle_id: number | null
  lesson_id: number | null
  video_id: number | null
  exam_id: number | null
  attempt_id: number | null
  metadata: Record<string, any> | null
  occurred_at: string
  student?: {
    id: number
    name: string
    email: string
    phone: string
    avatar?: string | null
    student_type?: string
  }
  course?: { id: number; title: string }
  bundle?: { id: number; title: string }
  lesson?: { id: number; title: string }
  video?: { id: number; title: string }
  exam?: { id: number; title: string; type: string }
}

interface SessionItem {
  id: number
  student_id: number
  session_identifier: string
  ip_address: string | null
  user_agent: string | null
  device_type: 'desktop' | 'mobile' | 'tablet' | null
  browser: string | null
  started_at: string
  last_activity_at: string
  ended_at: string | null
  is_active: boolean
  duration_seconds: number
  student?: {
    id: number
    name: string
    email: string
    phone: string
    avatar?: string | null
    student_type?: string
  }
}

interface GlobalStats {
  active_students_now: number
  students_active_today: number
  total_sessions_today: number
  total_lesson_opens_today: number
  total_video_activity_today: number
  total_assessment_activity_today: number
  total_purchases_today: number
}

interface StudentProfileData {
  student: {
    id: number
    name: string
    email: string
    phone: string
    parent_phone?: string
    grade?: string
    student_type?: string
    status?: string
    avatar?: string | null
    created_at?: string
    is_online: boolean
    last_activity: string
    last_activity_iso?: string | null
  }
  stats_today: {
    courses_accessed: number
    lessons_opened: number
    videos_watched: number
    assessments_submitted: number
  }
  lifetime: {
    total_video_watch_seconds: number
    total_video_watch_minutes: number
    total_video_watch_hours: number
    distinct_courses_accessed: number
    exam_attempts: number
  }
  timeline: {
    data: ActivityLogItem[]
    current_page: number
    last_page: number
    total: number
  }
}

export default function StudentActivity() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStudentId = searchParams.get('student_id')

  // Tabs: 'activities' | 'sessions'
  const [activeTab, setActiveTab] = useState<'activities' | 'sessions'>('activities')

  // Global aggregate stats
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [recentFeed, setRecentFeed] = useState<ActivityLogItem[]>([])
  const [loadingStats, setLoadingStats] = useState(true)

  // Activity logs table state
  const [logs, setLogs] = useState<ActivityLogItem[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Filters for activities
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEventType, setSelectedEventType] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Sessions table state
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | 'active' | 'ended'>('active')
  const [sessionSearch, setSessionSearch] = useState('')
  const [sessionsPage, setSessionsPage] = useState(1)
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1)

  // Student Profile / Timeline modal
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    initialStudentId ? parseInt(initialStudentId) : null
  )
  const [studentProfile, setStudentProfile] = useState<StudentProfileData | null>(null)
  const [loadingStudentProfile, setLoadingStudentProfile] = useState(false)
  const [studentTimelinePage, setStudentTimelinePage] = useState(1)
  const [studentTimelineFilter, setStudentTimelineFilter] = useState('all')
  const [studentModalTab, setStudentModalTab] = useState<'activity' | 'security'>('activity')
  const [studentSecurityEvents, setStudentSecurityEvents] = useState<any[]>([])
  const [loadingStudentSecurity, setLoadingStudentSecurity] = useState(false)

  const fetchStudentSecurity = useCallback(async (studentId: number) => {
    try {
      setLoadingStudentSecurity(true)
      const res = await API.get(`/admin/students/${studentId}/security-events`)
      setStudentSecurityEvents(res.data.events?.data || [])
    } catch (err) {
      console.error('Failed to load student security events:', err)
    } finally {
      setLoadingStudentSecurity(false)
    }
  }, [])

  // Metadata detail modal
  const [inspectLog, setInspectLog] = useState<ActivityLogItem | null>(null)

  // Auto-refresh interval toggle
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 1. Fetch Global Stats & Recent Feed
  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true)
      const res = await API.get('/admin/student-activity/stats')
      if (res.data?.stats) {
        setStats(res.data.stats)
      }
      if (res.data?.recent_feed) {
        setRecentFeed(res.data.recent_feed)
      }
    } catch (err) {
      console.error('Failed to load activity statistics:', err)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  // 2. Fetch Paginated Activity Logs
  const fetchLogs = useCallback(async (page = 1) => {
    try {
      setLoadingLogs(true)
      const params: Record<string, any> = {
        page,
        per_page: 25,
      }
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (selectedEventType !== 'all') params.event_type = selectedEventType
      if (filterDateFrom) params.date_from = filterDateFrom
      if (filterDateTo) params.date_to = filterDateTo

      const res = await API.get('/admin/student-activity', { params })
      if (res.data?.data) {
        setLogs(res.data.data)
        setCurrentPage(res.data.current_page || 1)
        setTotalPages(res.data.last_page || 1)
        setTotalCount(res.data.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch activity logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }, [searchQuery, selectedEventType, filterDateFrom, filterDateTo])

  // 3. Fetch Paginated Sessions
  const fetchSessions = useCallback(async (page = 1) => {
    try {
      setLoadingSessions(true)
      const params: Record<string, any> = {
        page,
        per_page: 20,
      }
      if (sessionStatusFilter !== 'all') params.status = sessionStatusFilter
      if (sessionSearch.trim()) params.search = sessionSearch.trim()

      const res = await API.get('/admin/student-sessions', { params })
      if (res.data?.data) {
        setSessions(res.data.data)
        setSessionsPage(res.data.current_page || 1)
        setSessionsTotalPages(res.data.last_page || 1)
      }
    } catch (err) {
      console.error('Failed to fetch student sessions:', err)
    } finally {
      setLoadingSessions(false)
    }
  }, [sessionStatusFilter, sessionSearch])

  // 4. Fetch Student Profile & Timeline
  const fetchStudentProfile = useCallback(async (studentId: number, page = 1) => {
    try {
      setLoadingStudentProfile(true)
      const params: Record<string, any> = {
        page,
        per_page: 20,
      }
      if (studentTimelineFilter !== 'all') params.event_type = studentTimelineFilter

      const res = await API.get(`/admin/students/${studentId}/activity`, { params })
      setStudentProfile(res.data)
    } catch (err) {
      console.error('Failed to load student activity profile:', err)
      useModalStore.getState().showToast('تعذر تحميل سجل نشاط الطالب.', 'error')
    } finally {
      setLoadingStudentProfile(false)
    }
  }, [studentTimelineFilter])

  // Initial load
  useEffect(() => {
    fetchStats()
    fetchLogs(1)
  }, [fetchStats, fetchLogs])

  // Auto-refresh stats and logs every 45s if enabled
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchStats()
      if (activeTab === 'activities') {
        fetchLogs(currentPage)
      } else {
        fetchSessions(sessionsPage)
      }
    }, 45000)
    return () => clearInterval(interval)
  }, [autoRefresh, activeTab, currentPage, sessionsPage, fetchStats, fetchLogs, fetchSessions])

  // Load sessions when switching to tab
  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions(1)
    }
  }, [activeTab, fetchSessions])

  // Load student profile if student_id is set
  useEffect(() => {
    if (selectedStudentId) {
      fetchStudentProfile(selectedStudentId, studentTimelinePage)
    } else {
      setStudentProfile(null)
    }
  }, [selectedStudentId, studentTimelinePage, fetchStudentProfile])

  // Helper to open student modal
  const handleOpenStudent = (id: number) => {
    setSelectedStudentId(id)
    setStudentTimelinePage(1)
    setSearchParams({ student_id: id.toString() })
  }

  const handleCloseStudentModal = () => {
    setSelectedStudentId(null)
    setStudentProfile(null)
    setSearchParams({})
  }

  // Format helpers
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatSeconds = (totalSecs: number) => {
    if (!totalSecs || totalSecs <= 0) return '0 ث'
    const h = Math.floor(totalSecs / 3600)
    const m = Math.floor((totalSecs % 3600) / 60)
    const s = totalSecs % 60
    if (h > 0) return `${h} س و ${m} د`
    if (m > 0) return `${m} د و ${s} ث`
    return `${s} ثوانٍ`
  }

  // Event category badge color
  const getEventBadge = (type: string) => {
    if (type === 'login' || type === 'session_started') {
      return { bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', label: 'تسجيل دخول' }
    }
    if (type === 'logout' || type === 'session_ended') {
      return { bg: 'bg-slate-500/10 border-slate-500/20 text-slate-400', label: 'تسجيل خروج' }
    }
    if (type === 'failed_login') {
      return { bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400', label: 'دخول فاشل' }
    }
    if (type.startsWith('course_') || type.startsWith('bundle_')) {
      return { bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400', label: 'كورس / باقة' }
    }
    if (type.startsWith('lesson_')) {
      return { bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400', label: 'فتح درس' }
    }
    if (type.startsWith('video_')) {
      return { bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400', label: 'فيديو' }
    }
    if (type.startsWith('exam_') || type.startsWith('quiz_') || type.startsWith('homework_')) {
      return { bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400', label: 'اختبار / واجب' }
    }
    if (type.includes('purchase')) {
      return { bg: 'bg-purple-500/10 border-purple-500/20 text-purple-400', label: 'شراء / اشتراك' }
    }
    if (type === 'anti_cheat_violation') {
      return { bg: 'bg-rose-600/10 border-rose-600/30 text-rose-300 font-black', label: 'مخالفة أمان' }
    }
    return { bg: 'bg-slate-700/20 border-slate-700/30 text-slate-300', label: 'نشاط' }
  }

  // Device icon helper
  const renderDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-3.5 h-3.5 text-slate-400" />
      case 'tablet':
        return <Tablet className="w-3.5 h-3.5 text-slate-400" />
      default:
        return <Laptop className="w-3.5 h-3.5 text-slate-400" />
    }
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto text-right" dir="rtl">
      
      {/* =========================================================================
          Header & Controls
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
              <Activity className="w-6 h-6" />
            </div>
            <span>سجل ومراقبة نشاط الطلاب</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            متابعة دقيقة وتدقيق زمني لنشاط الطلاب الفعلي، حضور الجلسات، فتح الدروس، مشاهدة الفيديوهات، والامتحانات.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchStats()
              if (activeTab === 'activities') fetchLogs(currentPage)
              else fetchSessions(sessionsPage)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-card hover:bg-slate-800 border border-[var(--border-color)] text-xs text-slate-200 rounded-xl transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats || loadingLogs || loadingSessions ? 'animate-spin text-brand-primary' : ''}`} />
            <span>تحديث الآن</span>
          </button>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 border text-xs rounded-xl transition-colors cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                : 'bg-brand-card border-[var(--border-color)] text-slate-400'
            }`}
            title="تحديث تلقائي كل 45 ثانية"
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>{autoRefresh ? 'تحديث تلقائي: مفعّل' : 'تحديث تلقائي: معطل'}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          Global Aggregate Metrics Cards
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
        
        {/* 1. Active Now */}
        <div className="bg-brand-card border border-emerald-500/30 rounded-2xl p-4 relative overflow-hidden shadow-lg shadow-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300">متواجدون الآن</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-400">
              {stats?.active_students_now ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-light">طالب</span>
          </div>
          <span className="text-[10px] text-emerald-400/70 block mt-1">نشاط خلال 5 دقائق</span>
        </div>

        {/* 2. Active Today */}
        <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold text-slate-300">نشطون اليوم</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-100">
              {stats?.students_active_today ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-light">طالب</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">تفاعلوا اليوم</span>
        </div>

        {/* 3. Total Sessions Today */}
        <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold text-slate-300">جلسات اليوم</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-100">
              {stats?.total_sessions_today ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-light">جلسة</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">جلسات تسجيل الدخول</span>
        </div>

        {/* 4. Lesson Opens Today */}
        <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold text-slate-300">فتح الدروس</span>
            <BookOpen className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-100">
              {stats?.total_lesson_opens_today ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-light">مرة</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">دروس تمت مراجعتها</span>
        </div>

        {/* 5. Video Activity Today */}
        <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold text-slate-300">نشاط الفيديو</span>
            <PlayCircle className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-100">
              {stats?.total_video_activity_today ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-light">حدث</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">بدء وإكمال فيديوهات</span>
        </div>

        {/* 6. Assessment Activity Today */}
        <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold text-slate-300">الامتحانات والواجبات</span>
            <ClipboardCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-100">
              {stats?.total_assessment_activity_today ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-light">محاولة</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">بدء وتسليم</span>
        </div>

        {/* 7. Purchases Today */}
        <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold text-slate-300">المشتريات اليوم</span>
            <ShoppingCart className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-purple-400">
              {stats?.total_purchases_today ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-light">عملية</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">اشتراكات ناجحة</span>
        </div>

      </div>

      {/* =========================================================================
          Live Stream / Recent Activities Ticker
          ========================================================================= */}
      {recentFeed.length > 0 && (
        <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3 border-b border-[var(--border-color)] pb-2">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>آخر الأحداث الجارية فورياً على المنصة</span>
            </span>
            <span className="text-[11px] text-slate-400">آخر 15 حدث</span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
            {recentFeed.map((item) => {
              const badge = getEventBadge(item.event_type)
              return (
                <div
                  key={item.id}
                  onClick={() => item.student_id && handleOpenStudent(item.student_id)}
                  className="shrink-0 bg-slate-900/60 hover:bg-slate-900 border border-[var(--border-color)] hover:border-brand-primary/40 rounded-xl p-3 min-w-[240px] max-w-[280px] cursor-pointer transition-all space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 truncate">
                      {item.student?.name || 'طالب'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                    <span>{formatDateTime(item.occurred_at).split(',')[1] || formatDateTime(item.occurred_at)}</span>
                    <span className="text-brand-primary hover:underline">عرض الملف &larr;</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          Primary Tabs Switcher
          ========================================================================= */}
      <div className="flex border-b border-[var(--border-color)] gap-4">
        <button
          onClick={() => setActiveTab('activities')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'activities'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>سجل النشاطات والأحداث ({totalCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>تتبع الجلسات المباشرة والأجهزة</span>
        </button>
      </div>

      {/* =========================================================================
          Tab 1: Activities Log View
          ========================================================================= */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          
          {/* Filters Card */}
          <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث بالطالب، الهاتف، البريد..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLogs(1)}
                  className="w-full bg-slate-900/60 border border-[var(--border-color)] rounded-xl pr-9 pl-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Event Type Filter */}
              <div>
                <select
                  value={selectedEventType}
                  onChange={(e) => {
                    setSelectedEventType(e.target.value)
                  }}
                  className="w-full bg-slate-900/60 border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                >
                  <option value="all">جميع أنواع الأحداث</option>
                  <option value="auth">🔐 تسجيل الدخول والجلسات</option>
                  <option value="course">📚 تصفح الكورسات والدروس</option>
                  <option value="video">🎥 مشاهدات الفيديو</option>
                  <option value="assessment">📝 الامتحانات والواجبات</option>
                  <option value="purchase">💳 المشتريات والاشتراكات</option>
                  <option value="security">🛡️ الأمان ومكافحة الغش</option>
                </select>
              </div>

              {/* Date From */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 whitespace-nowrap">من:</span>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full bg-slate-900/60 border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Date To */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 whitespace-nowrap">إلى:</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full bg-slate-900/60 border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                />
              </div>

            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)] text-xs">
              <span className="text-slate-400 font-light">
                إجمالي النتائج: <strong className="text-slate-200">{totalCount}</strong> حدث مسجل
              </span>
              <div className="flex gap-2">
                {(searchQuery || selectedEventType !== 'all' || filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedEventType('all')
                      setFilterDateFrom('')
                      setFilterDateTo('')
                      fetchLogs(1)
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    إعادة ضبط الفلاتر
                  </button>
                )}
                <button
                  onClick={() => fetchLogs(1)}
                  className="px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  تطبيق الفلترة
                </button>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl overflow-hidden">
            {loadingLogs ? (
              <div className="py-20 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-brand-primary" />
                <p className="text-xs">جاري تحميل سجل النشاطات...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Activity className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-bold text-slate-300">لا توجد نشاطات مسجلة</p>
                <p className="text-xs text-slate-500">لم يتم العثور على أي أحداث تطابق محددات البحث الحالية.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right divide-y divide-[var(--border-color)]">
                  <thead className="bg-slate-900/50 text-slate-400">
                    <tr>
                      <th className="p-3.5 sm:p-4 font-bold">الطالب</th>
                      <th className="p-3.5 sm:p-4 font-bold">الحدث</th>
                      <th className="p-3.5 sm:p-4 font-bold">التفاصيل والوصف</th>
                      <th className="p-3.5 sm:p-4 font-bold">السياق المرتبط</th>
                      <th className="p-3.5 sm:p-4 font-bold">الجهاز وعنوان IP</th>
                      <th className="p-3.5 sm:p-4 font-bold">التوقيت</th>
                      <th className="p-3.5 sm:p-4 font-bold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] text-slate-300">
                    {logs.map((item) => {
                      const badge = getEventBadge(item.event_type)
                      return (
                        <tr key={item.id} className="hover:bg-slate-900/30 transition-colors">
                          
                          {/* Student */}
                          <td className="p-3.5 sm:p-4 whitespace-nowrap">
                            {item.student ? (
                              <button
                                onClick={() => handleOpenStudent(item.student_id)}
                                className="flex items-center gap-2 text-right hover:text-brand-primary transition-colors cursor-pointer group"
                              >
                                <div className="w-8 h-8 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                                  {item.student.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-200 group-hover:text-brand-primary">
                                    {item.student.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {item.student.phone || item.student.email}
                                  </div>
                                </div>
                              </button>
                            ) : (
                              <span className="text-slate-500">طالب محذوف (#{item.student_id})</span>
                            )}
                          </td>

                          {/* Event Badge */}
                          <td className="p-3.5 sm:p-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </td>

                          {/* Description */}
                          <td className="p-3.5 sm:p-4 max-w-xs sm:max-w-sm">
                            <p className="text-slate-200 font-medium leading-relaxed">
                              {item.description}
                            </p>
                            {/* Metadata quick pill */}
                            {item.metadata?.percentage !== undefined && (
                              <div className="mt-1 flex items-center gap-2">
                                <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-cyan-500 h-1.5 rounded-full"
                                    style={{ width: `${Math.min(100, item.metadata.percentage)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-cyan-400 font-bold font-mono">
                                  {item.metadata.percentage}% ({formatSeconds(item.metadata.watched_seconds)})
                                </span>
                              </div>
                            )}
                            {item.metadata?.score !== undefined && (
                              <span className="inline-block mt-1 text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                الدرجة: {item.metadata.score} {item.metadata.max_score ? `/ ${item.metadata.max_score}` : ''}
                              </span>
                            )}
                          </td>

                          {/* Context: Course / Bundle / Lesson / Exam */}
                          <td className="p-3.5 sm:p-4 whitespace-nowrap text-[11px]">
                            <div className="space-y-1">
                              {item.bundle && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold text-[10px]">
                                  <Layers className="w-3 h-3" />
                                  <span>باقة: {item.bundle.title}</span>
                                </div>
                              )}
                              {item.course && (
                                <div className="text-slate-300 font-semibold truncate max-w-[180px]">
                                  {item.course.title}
                                </div>
                              )}
                              {item.lesson && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                                  درس: {item.lesson.title}
                                </div>
                              )}
                              {item.exam && (
                                <div className="text-[10px] text-amber-400 truncate max-w-[180px]">
                                  امتحان: {item.exam.title}
                                </div>
                              )}
                              {!item.course && !item.bundle && !item.lesson && !item.exam && (
                                <span className="text-slate-500">-</span>
                              )}
                            </div>
                          </td>

                          {/* Device & IP */}
                          <td className="p-3.5 sm:p-4 whitespace-nowrap text-[11px] text-slate-400 font-mono">
                            <div className="flex items-center gap-1.5">
                              {renderDeviceIcon(item.device_type)}
                              <span>{item.browser || 'متصفح'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {item.ip_address || 'IP غير مسجل'}
                            </div>
                          </td>

                          {/* Timestamp */}
                          <td className="p-3.5 sm:p-4 whitespace-nowrap text-[11px] text-slate-400">
                            {formatDateTime(item.occurred_at)}
                          </td>

                          {/* Inspect Modal Trigger */}
                          <td className="p-3.5 sm:p-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => setInspectLog(item)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                              title="فحص التفاصيل التقنية"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>

                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Server-side Pagination Footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-[var(--border-color)] text-xs text-slate-400">
                <span>
                  صفحة <strong className="text-slate-200">{currentPage}</strong> من{' '}
                  <strong className="text-slate-200">{totalPages}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => fetchLogs(currentPage - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-[var(--border-color)] disabled:opacity-40 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>السابق</span>
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => fetchLogs(currentPage + 1)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-[var(--border-color)] disabled:opacity-40 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                  >
                    <span>التالي</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          Tab 2: Live & Recent Sessions View
          ========================================================================= */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          
          {/* Sessions Filter */}
          <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-400">تصفية الجلسات:</span>
              <div className="flex bg-slate-900/60 p-1 rounded-xl border border-[var(--border-color)]">
                <button
                  onClick={() => setSessionStatusFilter('active')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    sessionStatusFilter === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  الجلسات النشطة الآن
                </button>
                <button
                  onClick={() => setSessionStatusFilter('ended')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    sessionStatusFilter === 'ended'
                      ? 'bg-slate-800 text-slate-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  الجلسات المنتهية
                </button>
                <button
                  onClick={() => setSessionStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    sessionStatusFilter === 'all'
                      ? 'bg-slate-800 text-slate-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  الكل
                </button>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="بحث بالطالب أو الهاتف..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchSessions(1)}
                className="w-full bg-slate-900/60 border border-[var(--border-color)] rounded-xl pr-9 pl-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          {/* Sessions Table */}
          <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl overflow-hidden">
            {loadingSessions ? (
              <div className="py-20 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-brand-primary" />
                <p className="text-xs">جاري تحميل جلسات الطلاب...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Radio className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-bold text-slate-300">لا توجد جلسات مطابقة</p>
                <p className="text-xs text-slate-500">لا توجد جلسات مسجلة تطابق محددات التصفية الحالية.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right divide-y divide-[var(--border-color)]">
                  <thead className="bg-slate-900/50 text-slate-400">
                    <tr>
                      <th className="p-3.5 sm:p-4 font-bold">الطالب</th>
                      <th className="p-3.5 sm:p-4 font-bold">حالة الجلسة</th>
                      <th className="p-3.5 sm:p-4 font-bold">الجهاز والمتصفح</th>
                      <th className="p-3.5 sm:p-4 font-bold">عنوان IP</th>
                      <th className="p-3.5 sm:p-4 font-bold">بداية الجلسة</th>
                      <th className="p-3.5 sm:p-4 font-bold">آخر نشاط (Heartbeat)</th>
                      <th className="p-3.5 sm:p-4 font-bold">مدة الجلسة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] text-slate-300">
                    {sessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-slate-900/30 transition-colors">
                        
                        {/* Student */}
                        <td className="p-3.5 sm:p-4 whitespace-nowrap">
                          {sess.student ? (
                            <button
                              onClick={() => handleOpenStudent(sess.student_id)}
                              className="flex items-center gap-2 text-right hover:text-brand-primary transition-colors cursor-pointer group"
                            >
                              <div className="w-8 h-8 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold text-xs shrink-0">
                                {sess.student.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-200 group-hover:text-brand-primary">
                                  {sess.student.name}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {sess.student.phone || sess.student.email}
                                </div>
                              </div>
                            </button>
                          ) : (
                            <span className="text-slate-500">طالب (#{sess.student_id})</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3.5 sm:p-4 whitespace-nowrap">
                          {sess.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span>متواجد الآن</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                              <span>منتهية</span>
                            </span>
                          )}
                        </td>

                        {/* Device */}
                        <td className="p-3.5 sm:p-4 whitespace-nowrap text-slate-300">
                          <div className="flex items-center gap-2">
                            {renderDeviceIcon(sess.device_type)}
                            <span className="capitalize">{sess.device_type || 'Desktop'}</span>
                            <span className="text-[10px] text-slate-500">({sess.browser || 'متصفح'})</span>
                          </div>
                        </td>

                        {/* IP Address */}
                        <td className="p-3.5 sm:p-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                          {sess.ip_address || 'غير محدد'}
                        </td>

                        {/* Started At */}
                        <td className="p-3.5 sm:p-4 whitespace-nowrap text-slate-400 text-[11px]">
                          {formatDateTime(sess.started_at)}
                        </td>

                        {/* Last Activity */}
                        <td className="p-3.5 sm:p-4 whitespace-nowrap text-slate-400 text-[11px]">
                          {formatDateTime(sess.last_activity_at)}
                        </td>

                        {/* Duration */}
                        <td className="p-3.5 sm:p-4 whitespace-nowrap font-mono text-emerald-400 font-bold">
                          {formatSeconds(sess.duration_seconds)}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sessions Pagination */}
            {sessionsTotalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-[var(--border-color)] text-xs text-slate-400">
                <span>
                  صفحة <strong className="text-slate-200">{sessionsPage}</strong> من{' '}
                  <strong className="text-slate-200">{sessionsTotalPages}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={sessionsPage <= 1}
                    onClick={() => fetchSessions(sessionsPage - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-[var(--border-color)] disabled:opacity-40 hover:bg-slate-800 text-slate-200 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>السابق</span>
                  </button>
                  <button
                    disabled={sessionsPage >= sessionsTotalPages}
                    onClick={() => fetchSessions(sessionsPage + 1)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-[var(--border-color)] disabled:opacity-40 hover:bg-slate-800 text-slate-200 cursor-pointer"
                  >
                    <span>التالي</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          Student Activity Profile Modal (Timeline & Analytics)
          ========================================================================= */}
      {selectedStudentId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={handleCloseStudentModal} />
          
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[92vh] overflow-y-auto space-y-6 shadow-2xl z-50 text-right scrollbar-thin scrollbar-thumb-slate-800">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-100">
                    ملف نشاط الطالب الزمني والتدقيق
                  </h3>
                  <span className="text-xs text-slate-400">
                    معرف الطالب: #{selectedStudentId}
                  </span>
                </div>
              </div>
              <button
                onClick={handleCloseStudentModal}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingStudentProfile ? (
              <div className="py-24 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-brand-primary" />
                <p className="text-xs">جاري استرجاع سجل الطالب وإحصائياته...</p>
              </div>
            ) : studentProfile ? (
              <div className="space-y-6">
                
                {/* Profile Identity Card */}
                <div className="bg-slate-900/60 border border-[var(--border-color)] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary text-xl font-black shrink-0">
                      {studentProfile.student.name.charAt(0)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-black text-base text-slate-100">
                          {studentProfile.student.name}
                        </h4>
                        {studentProfile.student.is_online ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                            <span>متواجد الآن</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                            <span>غير متواجد</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                        <span>الهاتف: {studentProfile.student.phone || 'غير مسجل'}</span>
                        <span>ولي الأمر: {studentProfile.student.parent_phone || 'غير مسجل'}</span>
                        <span>البريد: {studentProfile.student.email}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        المرحلة: <strong className="text-slate-200">{studentProfile.student.grade || 'غير محدد'}</strong> | آخر نشاط:{' '}
                        <strong className="text-brand-primary">{studentProfile.student.last_activity}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-Tabs Switch */}
                <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
                  <button
                    onClick={() => setStudentModalTab('activity')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      studentModalTab === 'activity'
                        ? 'bg-brand-primary text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    النشاط الأكاديمي والتعليمي
                  </button>
                  <button
                    onClick={() => {
                      setStudentModalTab('security')
                      if (selectedStudentId) fetchStudentSecurity(selectedStudentId)
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      studentModalTab === 'security'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>سجل الأمان والتحذيرات ({studentSecurityEvents.length})</span>
                  </button>
                </div>

                {studentModalTab === 'security' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-200 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                        <span>سجل التحذيرات والأمان المرتبطة بالطالب</span>
                      </h4>
                      <button
                        onClick={() => selectedStudentId && fetchStudentSecurity(selectedStudentId)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>تحديث</span>
                      </button>
                    </div>

                    {loadingStudentSecurity ? (
                      <div className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 mx-auto animate-spin text-brand-primary" />
                        <span className="text-xs mt-2 block">جاري تحميل الأحداث الأمنية...</span>
                      </div>
                    ) : studentSecurityEvents.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-[var(--border-color)]">
                        لم يتم تسجيل أي محاولات دخول مشبوهة أو مخالفات أمان لهذا الطالب.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {studentSecurityEvents.map((sec) => (
                          <div
                            key={sec.id}
                            className="p-3.5 bg-slate-900/40 border border-red-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                  sec.severity === 'high' || sec.severity === 'critical'
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {sec.severity}
                                </span>
                                <span className="font-mono font-bold text-white">{sec.event_type}</span>
                                <span className="text-slate-500 font-mono">Status: {sec.status_code}</span>
                              </div>
                              <p className="text-slate-300">{sec.description || 'طلب مشبوه مسجل'}</p>
                              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                                <span>IP: {sec.ip_address}</span>
                                <span>Path: {sec.path}</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {formatDateTime(sec.occurred_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                {/* Metrics Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-slate-900/40 border border-[var(--border-color)] rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">دروس اليوم</span>
                    <span className="text-lg font-black text-slate-200 mt-1 block">
                      {studentProfile.stats_today.lessons_opened}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-[var(--border-color)] rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">فيديوهات اليوم</span>
                    <span className="text-lg font-black text-slate-200 mt-1 block">
                      {studentProfile.stats_today.videos_watched}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-[var(--border-color)] rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">امتحانات اليوم</span>
                    <span className="text-lg font-black text-slate-200 mt-1 block">
                      {studentProfile.stats_today.assessments_submitted}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-[var(--border-color)] rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">كورسات فتحت اليوم</span>
                    <span className="text-lg font-black text-slate-200 mt-1 block">
                      {studentProfile.stats_today.courses_accessed}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-[var(--border-color)] rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">إجمالي وقت الفيديو</span>
                    <span className="text-lg font-black text-cyan-400 mt-1 block">
                      {studentProfile.lifetime.total_video_watch_hours > 0
                        ? `${studentProfile.lifetime.total_video_watch_hours} س`
                        : `${studentProfile.lifetime.total_video_watch_minutes} د`}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-[var(--border-color)] rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">إجمالي محاولات الاختبارات</span>
                    <span className="text-lg font-black text-amber-400 mt-1 block">
                      {studentProfile.lifetime.exam_attempts}
                    </span>
                  </div>
                </div>

                {/* Student Timeline Header & Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[var(--border-color)]">
                  <h4 className="text-sm font-black text-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-brand-primary" />
                    <span>الخط الزمني لأنشطة الطالب ({studentProfile.timeline.total})</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <select
                      value={studentTimelineFilter}
                      onChange={(e) => {
                        setStudentTimelineFilter(e.target.value)
                        setStudentTimelinePage(1)
                      }}
                      className="bg-slate-900 border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                    >
                      <option value="all">جميع النشاطات</option>
                      <option value="auth">تسجيل الدخول</option>
                      <option value="course">الكورسات والدروس</option>
                      <option value="video">مشاهدات الفيديو</option>
                      <option value="assessment">الامتحانات والواجبات</option>
                      <option value="purchase">المشتريات</option>
                      <option value="security">مخالفات الأمان</option>
                    </select>
                  </div>
                </div>

                {/* Timeline Items List */}
                <div className="space-y-3">
                  {studentProfile.timeline.data.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      لا توجد أحداث مسجلة لهذا الطالب في هذا القسم.
                    </div>
                  ) : (
                    studentProfile.timeline.data.map((item) => {
                      const badge = getEventBadge(item.event_type)
                      return (
                        <div
                          key={item.id}
                          className="bg-slate-900/30 hover:bg-slate-900/60 border border-[var(--border-color)] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${badge.bg}`}>
                                {badge.label}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-200">
                                {item.description}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                                {item.bundle && (
                                  <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                                    من خلال باقة: {item.bundle.title}
                                  </span>
                                )}
                                {item.course && <span>كورس: {item.course.title}</span>}
                                {item.lesson && <span>درس: {item.lesson.title}</span>}
                                {item.exam && <span>امتحان: {item.exam.title}</span>}
                                {item.ip_address && <span className="font-mono text-slate-500">IP: {item.ip_address}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="text-left sm:text-right shrink-0 text-[11px] text-slate-400 font-mono">
                            {formatDateTime(item.occurred_at)}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Timeline Pagination */}
                {studentProfile.timeline.last_page > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] text-xs text-slate-400">
                    <span>
                      صفحة {studentTimelinePage} من {studentProfile.timeline.last_page}
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={studentTimelinePage <= 1}
                        onClick={() => setStudentTimelinePage((p) => p - 1)}
                        className="px-3 py-1 rounded-lg bg-slate-900 border border-[var(--border-color)] disabled:opacity-40 hover:bg-slate-800 text-slate-200 cursor-pointer"
                      >
                        السابق
                      </button>
                      <button
                        disabled={studentTimelinePage >= studentProfile.timeline.last_page}
                        onClick={() => setStudentTimelinePage((p) => p + 1)}
                        className="px-3 py-1 rounded-lg bg-slate-900 border border-[var(--border-color)] disabled:opacity-40 hover:bg-slate-800 text-slate-200 cursor-pointer"
                      >
                        التالي
                      </button>
                    </div>
                  </div>
                )}
                </>
              )}

              </div>
            ) : null}

          </div>
        </div>
      )}

      {/* =========================================================================
          Metadata Technical Inspector Modal
          ========================================================================= */}
      {inspectLog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={() => setInspectLog(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl z-50 text-right">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-primary" />
                <span>البيانات التقنية للحدث #{inspectLog.id}</span>
              </h3>
              <button
                onClick={() => setInspectLog(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">نوع الحدث:</span>
                <span className="font-mono text-slate-200 font-bold">{inspectLog.event_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">User-Agent:</span>
                <p className="font-mono text-[11px] text-slate-300 bg-slate-950 p-2 rounded-xl break-all">
                  {inspectLog.user_agent || 'غير متوفر'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">البيانات الإضافية (Metadata JSON):</span>
                <pre className="font-mono text-[11px] text-emerald-400 bg-slate-950 p-3 rounded-xl overflow-x-auto max-h-48 text-left" dir="ltr">
                  {JSON.stringify(inspectLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
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
