import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import API from '../../services/api'
import {
  Users,
  UserCheck,
  Activity,
  Clock,
  BookOpen,
  PlayCircle,
  FileText,
  Search,
  RefreshCw,
  Laptop,
  Smartphone,
  Tablet,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Radio,
  Layers,
  Sparkles,
  ShieldCheck,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Globe,
  LogIn,
  LogOut,
  Sliders,
  FolderOpen
} from 'lucide-react'

interface TeacherActivityLogItem {
  id: number
  teacher_id: number
  event_type: string
  event_name: string
  description: string
  course_id: number | null
  unit_id: number | null
  lesson_id: number | null
  video_id: number | null
  exam_id: number | null
  metadata: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  session_identifier: string | null
  occurred_at: string
  teacher?: {
    id: number
    name: string
    email: string
    phone?: string
    avatar?: string | null
    subject?: string
    status?: string
  }
  course?: { id: number; title: string }
  unit?: { id: number; title: string }
  lesson?: { id: number; title: string }
  video?: { id: number; title: string }
  exam?: { id: number; title: string; type?: string }
}

interface TeacherSessionItem {
  id: number
  teacher_id: number
  session_identifier: string
  ip_address: string | null
  user_agent: string | null
  device_type: 'desktop' | 'mobile' | 'tablet' | string | null
  browser: string | null
  current_page: string | null
  current_action: string | null
  started_at: string
  last_activity_at: string
  ended_at: string | null
  is_active: boolean
  duration_seconds: number
  duration_human?: string
  teacher?: {
    id: number
    name: string
    email: string
    phone?: string
    avatar?: string | null
    subject?: string
  }
}

interface PlatformPresenceData {
  threshold_minutes: number
  total_online: number
  students_online: number
  teachers_online: number
  timestamp: string
  active_teachers: Array<{
    id: number
    name: string
    email: string
    avatar?: string | null
    subject?: string
    current_page?: string | null
    current_action?: string | null
    device_type?: string | null
    browser?: string | null
    ip_address?: string | null
    started_at?: string
    last_activity_at?: string
    duration_seconds?: number
    duration_human?: string
  }>
  active_students: Array<{
    id: number
    name: string
    email: string
    phone?: string
    avatar?: string | null
    grade?: string
    student_type?: string
    ip_address?: string | null
    browser?: string | null
    device_type?: string | null
    last_activity_at?: string
    duration_human?: string
  }>
}

interface TeacherStatsData {
  active_teachers_now: number
  teachers_active_today: number
  total_sessions_today: number
  courses_modified_today: number
  lessons_created_today: number
  videos_uploaded_today: number
  exams_created_today: number
  grading_actions_today: number
}

interface TeacherProfileData {
  teacher: {
    id: number
    name: string
    email: string
    phone?: string
    subject?: string
    status?: string
    avatar?: string | null
    is_online: boolean
    current_action?: string | null
    current_page?: string | null
    last_activity_at?: string | null
    created_at?: string
  }
  summary: {
    total_actions: number
    today_actions: number
    total_sessions: number
    courses_count: number
    exams_count: number
    videos_count: number
  }
  recent_sessions: TeacherSessionItem[]
  recent_activities: TeacherActivityLogItem[]
  domain_breakdown: Record<string, number>
}

export default function TeacherActivity() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTeacherId = searchParams.get('teacher_id')

  // Main Tabs: 'activities' | 'sessions' | 'platform'
  const [activeTab, setActiveTab] = useState<'activities' | 'sessions' | 'platform'>('activities')

  // Presence & Stats
  const [presence, setPresence] = useState<PlatformPresenceData | null>(null)
  const [stats, setStats] = useState<TeacherStatsData | null>(null)
  const [loadingPresence, setLoadingPresence] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Activities Log Tab state
  const [logs, setLogs] = useState<TeacherActivityLogItem[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Activities Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Sessions Tab state
  const [sessions, setSessions] = useState<TeacherSessionItem[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | 'active' | 'ended'>('active')
  const [sessionsPage, setSessionsPage] = useState(1)
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1)

  // Teacher Profile / Details Modal state
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(
    initialTeacherId ? parseInt(initialTeacherId, 10) : null
  )
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfileData | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [modalTab, setModalTab] = useState<'timeline' | 'sessions'>('timeline')

  // Expanded metadata item
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)

  // 1. Fetch Platform Presence & Aggregate Stats
  const fetchPresenceAndStats = useCallback(async () => {
    try {
      const [presenceRes, statsRes] = await Promise.all([
        API.get('/admin/platform/presence'),
        API.get('/admin/teacher-activity/stats'),
      ])
      setPresence(presenceRes.data)
      setStats(statsRes.data)
    } catch (err) {
      console.error('Failed to fetch teacher activity stats:', err)
    } finally {
      setLoadingPresence(false)
    }
  }, [])

  // 2. Fetch Activities Logs
  const fetchLogs = useCallback(async (page = 1) => {
    setLoadingLogs(true)
    try {
      const params: Record<string, any> = {
        page,
        per_page: 25,
      }
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (selectedCategory !== 'all') params.category = selectedCategory
      if (filterDateFrom) params.start_date = filterDateFrom
      if (filterDateTo) params.end_date = filterDateTo

      const res = await API.get('/admin/teacher-activity', { params })
      const resData = res.data
      setLogs(resData.data || [])
      setCurrentPage(resData.current_page || 1)
      setTotalPages(resData.last_page || 1)
      setTotalCount(resData.total || 0)
    } catch (err) {
      console.error('Failed to fetch teacher logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }, [searchQuery, selectedCategory, filterDateFrom, filterDateTo])

  // 3. Fetch Sessions
  const fetchSessions = useCallback(async (page = 1) => {
    setLoadingSessions(true)
    try {
      const params: Record<string, any> = {
        page,
        per_page: 20,
      }
      if (sessionStatusFilter !== 'all') params.status = sessionStatusFilter

      const res = await API.get('/admin/teacher-activity/sessions', { params })
      const resData = res.data
      setSessions(resData.data || [])
      setSessionsPage(resData.current_page || 1)
      setSessionsTotalPages(resData.last_page || 1)
    } catch (err) {
      console.error('Failed to fetch teacher sessions:', err)
    } finally {
      setLoadingSessions(false)
    }
  }, [sessionStatusFilter])

  // 4. Fetch Detailed Teacher Profile
  const fetchTeacherProfile = useCallback(async (teacherId: number) => {
    setLoadingProfile(true)
    try {
      const res = await API.get(`/admin/teachers/${teacherId}/activity`)
      setTeacherProfile(res.data)
    } catch (err) {
      console.error('Failed to fetch teacher profile:', err)
      setTeacherProfile(null)
    } finally {
      setLoadingProfile(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchPresenceAndStats()
    fetchLogs(1)
  }, [fetchPresenceAndStats, fetchLogs])

  // React to tab changes
  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions(1)
    }
  }, [activeTab, fetchSessions])

  // Auto-refresh interval (every 20s for presence & active list)
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchPresenceAndStats()
    }, 20000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchPresenceAndStats])

  // Handle URL teacher_id param
  useEffect(() => {
    if (selectedTeacherId) {
      fetchTeacherProfile(selectedTeacherId)
    }
  }, [selectedTeacherId, fetchTeacherProfile])

  const openTeacherModal = (teacherId: number) => {
    setSelectedTeacherId(teacherId)
    setSearchParams({ teacher_id: teacherId.toString() })
  }

  const closeTeacherModal = () => {
    setSelectedTeacherId(null)
    setTeacherProfile(null)
    setSearchParams({})
  }

  // Format relative timestamp
  const formatTimeAgo = (isoString?: string | null) => {
    if (!isoString) return 'غير محدد'
    const date = new Date(isoString)
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (diffSeconds < 60) return 'الآن'
    if (diffSeconds < 3600) return `منذ ${Math.floor(diffSeconds / 60)} دقيقة`
    if (diffSeconds < 86400) return `منذ ${Math.floor(diffSeconds / 3600)} ساعة`
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Device icon helper
  const renderDeviceIcon = (deviceType?: string | null) => {
    const d = (deviceType || '').toLowerCase()
    if (d.includes('mobile') || d.includes('phone')) return <Smartphone className="w-4 h-4 text-emerald-400" />
    if (d.includes('tablet') || d.includes('ipad')) return <Tablet className="w-4 h-4 text-blue-400" />
    return <Laptop className="w-4 h-4 text-brand-primary" />
  }

  // Category Icon & Color Helper
  const getEventBadge = (eventType: string) => {
    if (eventType.includes('course')) {
      return {
        icon: <BookOpen className="w-4 h-4 text-amber-400" />,
        bg: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
        label: 'كورس ومناهج',
      }
    }
    if (eventType.includes('unit')) {
      return {
        icon: <FolderOpen className="w-4 h-4 text-amber-300" />,
        bg: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
        label: 'وحدة دراسية',
      }
    }
    if (eventType.includes('video')) {
      return {
        icon: <PlayCircle className="w-4 h-4 text-rose-400" />,
        bg: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
        label: 'فيديو ومحاضرة',
      }
    }
    if (eventType.includes('exam')) {
      return {
        icon: <FileText className="w-4 h-4 text-cyan-400" />,
        bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
        label: 'اختبار وأسئلة',
      }
    }
    if (eventType.includes('grade') || eventType.includes('answer')) {
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
        label: 'تصحيح ودرجات',
      }
    }
    if (eventType.includes('revenue') || eventType.includes('payout')) {
      return {
        icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
        bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
        label: 'مالية ومبيعات',
      }
    }
    if (eventType.includes('login') || eventType.includes('session')) {
      return {
        icon: <LogIn className="w-4 h-4 text-indigo-400" />,
        bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300',
        label: 'جلسة عمل',
      }
    }
    return {
      icon: <Activity className="w-4 h-4 text-slate-400" />,
      bg: 'bg-slate-800 border-slate-700 text-slate-300',
      label: 'نشاط إداري',
    }
  }

  const categoryOptions = [
    { key: 'all', label: 'كافة الأنشطة' },
    { key: 'courses', label: 'الكورسات والوحدات' },
    { key: 'lessons', label: 'الدروس' },
    { key: 'videos', label: 'الفيديوهات' },
    { key: 'exams', label: 'الامتحانات وبنك الأسئلة' },
    { key: 'grading', label: 'التصحيح والدرجات' },
    { key: 'finance', label: 'الماليات والمبيعات' },
    { key: 'auth', label: 'الجلسات والدخول' },
  ]

  return (
    <div className="space-y-6 pb-12">
      {/* =========================================================================
          Header & Controls
          ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 shadow-sm">
        <div className="space-y-1 text-right">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
                <span>سجل ومراقبة نشاط المعلمين</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>مراقبة حية</span>
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                تتبع لحظي لتواجد المعلمين، مراقبة التعديلات والإجراءات الأكاديمية ("بيعمل إيه حالياً؟")، وتدقيق الجلسات
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-center">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="تحديث تلقائي كل 20 ثانية"
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>{autoRefresh ? 'تحديث تلقائي: نشط' : 'تحديث تلقائي: متوقف'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchPresenceAndStats()
              if (activeTab === 'activities') fetchLogs(currentPage)
              if (activeTab === 'sessions') fetchSessions(sessionsPage)
            }}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="تحديث البيانات الآن"
          >
            <RefreshCw className={`w-4 h-4 ${loadingPresence ? 'animate-spin text-brand-primary' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          Presence & Global Activity Cards
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Platform Online */}
        <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">إجمالي المتواجدين الآن</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-100 font-mono">
              {presence?.total_online ?? 0}
            </span>
            <span className="text-xs text-slate-400">مستخدم نشط</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>نشاط مؤكد خلال آخر 5 دقائق</span>
          </div>
        </div>

        {/* Card 2: Teachers Online */}
        <div className="bg-brand-card border border-brand-primary/30 rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-brand-primary">معلمون متواجدون الآن</span>
            <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-brand-primary font-mono">
              {presence?.teachers_online ?? stats?.active_teachers_now ?? 0}
            </span>
            <span className="text-xs text-slate-400">معلم متصل</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span>إجمالي المعلمين النشطين اليوم:</span>
            <strong className="text-slate-200 font-mono">{stats?.teachers_active_today ?? 0}</strong>
          </div>
        </div>

        {/* Card 3: Students Online */}
        <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">طلاب متواجدون الآن</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-indigo-300 font-mono">
              {presence?.students_online ?? 0}
            </span>
            <span className="text-xs text-slate-400">طالب متصل</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span>نسبة تواجد المعلمين:</span>
            <strong className="text-slate-200 font-mono">
              {presence?.total_online && presence.total_online > 0
                ? `${Math.round(((presence.teachers_online || 0) / presence.total_online) * 100)}%`
                : '0%'}
            </strong>
          </div>
        </div>

        {/* Card 4: Actions Today */}
        <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">تعديلات المحتوى اليوم</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-300 font-mono">
              {(stats?.courses_modified_today ?? 0) +
                (stats?.lessons_created_today ?? 0) +
                (stats?.videos_uploaded_today ?? 0) +
                (stats?.exams_created_today ?? 0)}
            </span>
            <span className="text-xs text-slate-400">إجراء تعليمي</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
            <span>جلسات العمل اليوم:</span>
            <strong className="text-slate-200 font-mono">{stats?.total_sessions_today ?? 0}</strong>
          </div>
        </div>
      </div>

      {/* =========================================================================
          LIVE ACTIVE TEACHERS CARDS ("بيعمل إيه حالياً؟")
          ========================================================================= */}
      <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="text-base font-black text-slate-100">
              المعلمون المتواجدون على المنصة الآن ({presence?.active_teachers?.length ?? 0})
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            عتبة التواجد: نشاط مؤكد خلال آخر 5 دقائق
          </span>
        </div>

        {presence?.active_teachers && presence.active_teachers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {presence.active_teachers.map((teacher) => (
              <div
                key={teacher.id}
                className="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-brand-primary/40 rounded-2xl p-4 transition-all space-y-3 relative group"
              >
                {/* Teacher Top Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-primary font-black text-base shrink-0">
                      {teacher.avatar ? (
                        <img
                          src={teacher.avatar}
                          alt={teacher.name}
                          className="w-full h-full rounded-xl object-cover"
                        />
                      ) : (
                        teacher.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100 hover:text-brand-primary transition-colors">
                        {teacher.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        {teacher.subject && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {teacher.subject}
                          </span>
                        )}
                        <span>{teacher.email}</span>
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>متصل الآن</span>
                  </span>
                </div>

                {/* Real-time Current Action ("بيعمل إيه حالياً؟") */}
                <div className="bg-slate-950/80 border border-brand-primary/20 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-brand-primary flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>بيعمل إيه حالياً؟</span>
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {formatTimeAgo(teacher.last_activity_at)}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-200 line-clamp-2">
                    {teacher.current_action || 'يتصفح المنصة'}
                  </p>
                  {teacher.current_page && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span>الصفحة:</span>
                      <strong className="text-slate-300">{teacher.current_page}</strong>
                    </div>
                  )}
                </div>

                {/* Session & Device Meta */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1" title={teacher.device_type || 'سطح المكتب'}>
                      {renderDeviceIcon(teacher.device_type)}
                      <span className="text-[10px]">{teacher.browser || 'ويب'}</span>
                    </span>
                    {teacher.ip_address && (
                      <span className="font-mono text-[10px] text-slate-500">{teacher.ip_address}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] font-mono">{teacher.duration_human || 'جلسة نشطة'}</span>
                  </div>
                </div>

                {/* View Details Button */}
                <button
                  onClick={() => openTeacherModal(teacher.id)}
                  className="w-full py-2 bg-slate-800 hover:bg-brand-primary hover:text-white text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>عرض السجل الزمني والتفاصيل</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400 space-y-2 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
            <UserCheck className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-xs font-bold text-slate-300">لا يوجد معلمون متصلون في آخر 5 دقائق</p>
            <p className="text-[11px] text-slate-500">
              يتم تحديث التواجد تلقائياً عند قيام أي معلم بتسجيل الدخول أو إجراء أي نشاط.
            </p>
          </div>
        )}
      </div>

      {/* =========================================================================
          Navigation Tabs: Activities Feed vs Sessions vs Platform View
          ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
        <button
          onClick={() => setActiveTab('activities')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'activities'
              ? 'bg-brand-primary text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>سجل العمليات والأحداث</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800/80 text-slate-300 font-mono">
            {totalCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'sessions'
              ? 'bg-brand-primary text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>جلسات عمل المعلمين</span>
        </button>

        <button
          onClick={() => setActiveTab('platform')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'platform'
              ? 'bg-brand-primary text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>التواجد اللحظي الشامل (معلمون وطلاب)</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: ACTIVITIES FEED
          ========================================================================= */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLogs(1)}
                  placeholder="بحث باسم المعلم، البريد، وصف العملية، أو عنوان الكورس/الاختبار..."
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-brand-primary"
                  title="من تاريخ"
                />
                <span className="text-slate-500">إلى</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-brand-primary"
                  title="إلى تاريخ"
                />
                <button
                  onClick={() => fetchLogs(1)}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  تصفية
                </button>
              </div>
            </div>

            {/* Category Chips */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800/80">
              {categoryOptions.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => {
                    setSelectedCategory(cat.key)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat.key
                      ? 'bg-brand-primary text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activities List */}
          {loadingLogs ? (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-brand-primary" />
              <p className="text-xs">جاري استرجاع سجل الأنشطة والعمليات...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2 bg-brand-card rounded-2xl border border-[var(--border-color)]">
              <Activity className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-bold text-slate-300">لا توجد سجلات تطابق شروط البحث</p>
              <p className="text-xs text-slate-500">جرّب تغيير فئة النشاط أو نطاق التاريخ.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((item) => {
                const badge = getEventBadge(item.event_type)
                const isExpanded = expandedLogId === item.id

                return (
                  <div
                    key={item.id}
                    className="bg-brand-card border border-[var(--border-color)] hover:border-slate-700 rounded-2xl p-4 transition-all space-y-3 text-right"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Teacher and Action */}
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => item.teacher?.id && openTeacherModal(item.teacher.id)}
                          className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold text-sm shrink-0 cursor-pointer hover:bg-brand-primary hover:text-white transition-colors"
                          title="عرض ملف المعلم"
                        >
                          {item.teacher?.name ? item.teacher.name.charAt(0) : 'م'}
                        </button>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => item.teacher?.id && openTeacherModal(item.teacher.id)}
                              className="font-bold text-sm text-slate-100 hover:text-brand-primary transition-colors cursor-pointer"
                            >
                              {item.teacher?.name || `معلم #${item.teacher_id}`}
                            </button>
                            {item.teacher?.subject && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({item.teacher.subject})
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                            >
                              {badge.icon}
                              <span>{badge.label}</span>
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-200">{item.event_name}</h4>
                          {item.description && (
                            <p className="text-xs text-slate-400">{item.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Occurred Time & Client Info */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between text-xs text-slate-400 gap-1 shrink-0">
                        <span className="font-bold text-slate-300 font-mono" title={item.occurred_at}>
                          {formatTimeAgo(item.occurred_at)}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                          {item.ip_address && <span>IP: {item.ip_address}</span>}
                          {item.metadata && Object.keys(item.metadata).length > 0 && (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : item.id)}
                              className="text-brand-primary hover:underline cursor-pointer"
                            >
                              {isExpanded ? 'إخفاء التفاصيل' : 'تفاصيل إضافية'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Context Chips (Course, Unit, Lesson, Video, Exam) */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
                      {item.course && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-amber-400" />
                          <span>الكورس: {item.course.title}</span>
                        </span>
                      )}
                      {item.unit && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                          <FolderOpen className="w-3 h-3 text-amber-300" />
                          <span>الوحدة: {item.unit.title}</span>
                        </span>
                      )}
                      {item.lesson && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-blue-400" />
                          <span>الدرس: {item.lesson.title}</span>
                        </span>
                      )}
                      {item.video && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                          <PlayCircle className="w-3 h-3 text-rose-400" />
                          <span>الفيديو: {item.video.title}</span>
                        </span>
                      )}
                      {item.exam && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-cyan-400" />
                          <span>الامتحان: {item.exam.title}</span>
                        </span>
                      )}
                    </div>

                    {/* Metadata JSON Inspector */}
                    {isExpanded && item.metadata && (
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 overflow-x-auto space-y-1">
                        <span className="text-[10px] text-slate-500 block font-bold">
                          بيانات تفصيلية للحدث (Metadata):
                        </span>
                        <pre className="text-[11px] text-brand-primary leading-relaxed whitespace-pre-wrap">
                          {JSON.stringify(item.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-xs text-slate-400">
                    صفحة <strong className="text-slate-200">{currentPage}</strong> من{' '}
                    <strong className="text-slate-200">{totalPages}</strong> (إجمالي: {totalCount})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage <= 1}
                      onClick={() => fetchLogs(currentPage - 1)}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => fetchLogs(currentPage + 1)}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: SESSIONS LIST
          ========================================================================= */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
            <button
              onClick={() => setSessionStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                sessionStatusFilter === 'active'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              الجلسات النشطة الآن
            </button>
            <button
              onClick={() => setSessionStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                sessionStatusFilter === 'all'
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              كافة الجلسات
            </button>
            <button
              onClick={() => setSessionStatusFilter('ended')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                sessionStatusFilter === 'ended'
                  ? 'bg-slate-800 text-slate-200'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              الجلسات المنتهية
            </button>
          </div>

          {loadingSessions ? (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-brand-primary" />
              <p className="text-xs">جاري استرجاع جلسات المعلمين...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2 bg-brand-card rounded-2xl border border-[var(--border-color)]">
              <Clock className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-bold text-slate-300">لا توجد جلسات تطابق التصفية الحالية</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-brand-card border border-[var(--border-color)] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-right"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold text-sm shrink-0">
                      {session.teacher?.name ? session.teacher.name.charAt(0) : 'م'}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => session.teacher?.id && openTeacherModal(session.teacher.id)}
                          className="font-bold text-sm text-slate-100 hover:text-brand-primary transition-colors cursor-pointer"
                        >
                          {session.teacher?.name || `معلم #${session.teacher_id}`}
                        </button>
                        {session.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>نشطة الآن</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                            <span>منتهية</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                        <span>الصفحة: {session.current_page || 'لوحة التحكم'}</span>
                        {session.current_action && <span>الإجراء: {session.current_action}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
                    <div className="flex items-center gap-1.5">
                      {renderDeviceIcon(session.device_type)}
                      <span>{session.browser || 'غير محدد'}</span>
                    </div>
                    {session.ip_address && <span>IP: {session.ip_address}</span>}
                    <div className="text-left">
                      <span className="block text-slate-300 font-bold">
                        المدة: {session.duration_human || `${Math.round(session.duration_seconds / 60)} دقيقة`}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        بدأت: {formatTimeAgo(session.started_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Sessions Pagination */}
              {sessionsTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-xs text-slate-400">
                    صفحة <strong className="text-slate-200">{sessionsPage}</strong> من{' '}
                    <strong className="text-slate-200">{sessionsTotalPages}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={sessionsPage <= 1}
                      onClick={() => fetchSessions(sessionsPage - 1)}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      disabled={sessionsPage >= sessionsTotalPages}
                      onClick={() => fetchSessions(sessionsPage + 1)}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: PLATFORM VIEW (COMBINED STUDENTS & TEACHERS)
          ========================================================================= */}
      {activeTab === 'platform' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Teachers Column */}
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-brand-primary" />
                  <h3 className="font-black text-sm text-slate-100">
                    المعلمون النشطون الآن ({presence?.active_teachers?.length ?? 0})
                  </h3>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono">متصلون</span>
              </div>

              {presence?.active_teachers && presence.active_teachers.length > 0 ? (
                <div className="space-y-3">
                  {presence.active_teachers.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-right"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-slate-200">{t.name}</h4>
                        <p className="text-[11px] text-brand-primary">{t.current_action || 'يتصفح المنصة'}</p>
                      </div>
                      <div className="text-left font-mono text-[10px] text-slate-400">
                        <span>{t.duration_human}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-6">لا يوجد معلمون متصلون حالياً</p>
              )}
            </div>

            {/* Students Column */}
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-black text-sm text-slate-100">
                    الطلاب النشطون الآن ({presence?.active_students?.length ?? 0})
                  </h3>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono">متصلون</span>
              </div>

              {presence?.active_students && presence.active_students.length > 0 ? (
                <div className="space-y-3">
                  {presence.active_students.map((st) => (
                    <div
                      key={st.id}
                      className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-right"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-slate-200">{st.name}</h4>
                        <p className="text-[11px] text-slate-400">
                          {st.grade || 'طالب'} | {st.student_type === 'center' ? 'سنتر' : 'أونلاين'}
                        </p>
                      </div>
                      <div className="text-left font-mono text-[10px] text-slate-400">
                        <span>{formatTimeAgo(st.last_activity_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-6">لا يوجد طلاب متصلون حالياً</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TEACHER AUDIT & ACTIVITY PROFILE MODAL
          IMPORTANT: Absolutely NO dark backdrop overlay (pointer-events-none outer, pointer-events-auto dialog)
          ========================================================================= */}
      {selectedTeacherId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto pointer-events-none">
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[92vh] overflow-y-auto space-y-6 shadow-2xl z-50 text-right scrollbar-thin scrollbar-thumb-slate-800 pointer-events-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-100">
                    ملف وسجل التدقيق الزمني للمعلم
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    معرف المعلم: #{selectedTeacherId}
                  </span>
                </div>
              </div>
              <button
                onClick={closeTeacherModal}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="إغلاق (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingProfile ? (
              <div className="py-24 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-brand-primary" />
                <p className="text-xs">جاري استرجاع سجل المعلم والإحصائيات...</p>
              </div>
            ) : teacherProfile ? (
              <div className="space-y-6">
                {/* Teacher Identity Card */}
                <div className="bg-slate-900/60 border border-[var(--border-color)] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary text-xl font-black shrink-0">
                      {teacherProfile.teacher.name.charAt(0)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-black text-base text-slate-100">
                          {teacherProfile.teacher.name}
                        </h4>
                        {teacherProfile.teacher.is_online ? (
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
                        <span>المادة: {teacherProfile.teacher.subject || 'غير محدد'}</span>
                        <span>البريد: {teacherProfile.teacher.email}</span>
                        {teacherProfile.teacher.phone && <span>الهاتف: {teacherProfile.teacher.phone}</span>}
                      </div>
                      {teacherProfile.teacher.current_action && (
                        <div className="text-[11px] text-brand-primary font-bold">
                          الإجراء الحالي: {teacherProfile.teacher.current_action}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">إجمالي العمليات</span>
                    <span className="text-lg font-black text-slate-100 font-mono">
                      {teacherProfile.summary.total_actions}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">عمليات اليوم</span>
                    <span className="text-lg font-black text-brand-primary font-mono">
                      {teacherProfile.summary.today_actions}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">إجمالي الجلسات</span>
                    <span className="text-lg font-black text-indigo-400 font-mono">
                      {teacherProfile.summary.total_sessions}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">الكورسات</span>
                    <span className="text-lg font-black text-amber-300 font-mono">
                      {teacherProfile.summary.courses_count}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">الفيديوهات</span>
                    <span className="text-lg font-black text-rose-400 font-mono">
                      {teacherProfile.summary.videos_count}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 block">الامتحانات</span>
                    <span className="text-lg font-black text-cyan-400 font-mono">
                      {teacherProfile.summary.exams_count}
                    </span>
                  </div>
                </div>

                {/* Modal Sub-Tabs */}
                <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
                  <button
                    onClick={() => setModalTab('timeline')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      modalTab === 'timeline'
                        ? 'bg-brand-primary text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    السجل الزمني للأحداث ({teacherProfile.recent_activities.length})
                  </button>
                  <button
                    onClick={() => setModalTab('sessions')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      modalTab === 'sessions'
                        ? 'bg-brand-primary text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    جلسات العمل الأخيرة ({teacherProfile.recent_sessions.length})
                  </button>
                </div>

                {/* Sub-Tab 1: Timeline */}
                {modalTab === 'timeline' && (
                  <div className="space-y-3">
                    {teacherProfile.recent_activities.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8">لا توجد أنشطة مسجلة لهذا المعلم</p>
                    ) : (
                      teacherProfile.recent_activities.map((act) => {
                        const badge = getEventBadge(act.event_type)
                        return (
                          <div
                            key={act.id}
                            className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-right space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg}`}
                              >
                                {badge.icon}
                                <span>{badge.label}</span>
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                {formatTimeAgo(act.occurred_at)}
                              </span>
                            </div>
                            <h5 className="font-bold text-xs text-slate-200">{act.event_name}</h5>
                            {act.description && (
                              <p className="text-xs text-slate-400">{act.description}</p>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}

                {/* Sub-Tab 2: Sessions */}
                {modalTab === 'sessions' && (
                  <div className="space-y-3">
                    {teacherProfile.recent_sessions.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8">لا توجد جلسات سابقة مسجلة</p>
                    ) : (
                      teacherProfile.recent_sessions.map((sess) => (
                        <div
                          key={sess.id}
                          className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs text-right font-mono"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {renderDeviceIcon(sess.device_type)}
                              <span className="text-slate-200 font-bold">{sess.browser || 'ويب'}</span>
                              {sess.is_active && (
                                <span className="text-emerald-400 text-[10px] font-bold">نشطة الآن</span>
                              )}
                            </div>
                            <span className="text-slate-400 text-[11px]">
                              بدأت: {formatTimeAgo(sess.started_at)}
                            </span>
                          </div>
                          <div className="text-left">
                            <span className="text-slate-300 font-bold block">
                              المدة: {sess.duration_human || `${Math.round(sess.duration_seconds / 60)} دقيقة`}
                            </span>
                            <span className="text-slate-500 text-[10px]">IP: {sess.ip_address}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
