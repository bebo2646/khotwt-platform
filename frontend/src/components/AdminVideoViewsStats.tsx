import React, { useState, useEffect } from 'react'
import API from '../services/api'
import { Play, Users, Eye, Clock, GraduationCap, ChevronLeft, Award } from 'lucide-react'
import { useModalStore } from '../store/modalStore'

interface VideoStat {
  video_id: number
  video_title: string
  lesson_title: string
  course_title: string
  teacher_name: string
  views_count: number
  total_watch_time_minutes: number
  unique_viewers?: number
  completion_percentage?: number
  average_watch_time_minutes?: number
  last_viewed: string
}

interface CourseStat {
  course_id: number
  course_title: string
  teacher_name: string
  views_count: number
  total_watch_time_minutes: number
}

interface TeacherStat {
  teacher_id: number
  teacher_name: string
  views_count: number
  total_watch_time_minutes: number
}

interface AnalyticsData {
  total_views: number
  unique_student_views: number
  most_watched_lessons: VideoStat[]
  least_watched_lessons: VideoStat[]
  course_statistics: CourseStat[]
  teacher_statistics: TeacherStat[]
}

export default function AdminVideoViewsStats() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'most' | 'least' | 'courses' | 'teachers'>('most')

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        const res = await API.get('/admin/video-views-analytics')
        setData(res.data)
      } catch (err) {
        console.error(err)
        useModalStore.getState().showToast('فشل تحميل إحصائيات مشاهدات الفيديو.', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-[24px] p-8 text-center">
        <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-xs text-slate-400 font-light">جاري تحميل إحصائيات مشاهدات الفيديو...</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Eye className="w-6 h-6 text-indigo-400" />
          إحصائيات تتبع وتحليلات الفيديوهات
        </h2>
        <p className="text-xs text-slate-400 font-light mt-1">
          تفاصيل ونسب مشاهدات المحاضرات والدروس على المنصة.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Views Card */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-6 rounded-[20px] flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold block">إجمالي مشاهدات المحاضرات</span>
            <span className="text-2xl font-black text-indigo-400">{data.total_views} مشاهدة</span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
            <Play className="h-6 w-6" />
          </div>
        </div>

        {/* Unique Students Card */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-6 rounded-[20px] flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold block">الطلاب الفريدون المشاهدون</span>
            <span className="text-2xl font-black text-emerald-400">{data.unique_student_views} طالب</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-[20px] overflow-hidden">
        <div className="flex border-b border-slate-800/80 overflow-x-auto bg-slate-950/20">
          <button
            onClick={() => setActiveTab('most')}
            className={`px-6 py-4.5 text-xs font-black shrink-0 border-b-2 transition-all cursor-pointer ${
              activeTab === 'most' ? 'border-brand-primary text-brand-primary bg-brand-primary/5' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            الدروس الأكثر مشاهدة
          </button>
          <button
            onClick={() => setActiveTab('least')}
            className={`px-6 py-4.5 text-xs font-black shrink-0 border-b-2 transition-all cursor-pointer ${
              activeTab === 'least' ? 'border-brand-primary text-brand-primary bg-brand-primary/5' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            الدروس الأقل مشاهدة
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-6 py-4.5 text-xs font-black shrink-0 border-b-2 transition-all cursor-pointer ${
              activeTab === 'courses' ? 'border-brand-primary text-brand-primary bg-brand-primary/5' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            مشاهدات الكورسات
          </button>
          <button
            onClick={() => setActiveTab('teachers')}
            className={`px-6 py-4.5 text-xs font-black shrink-0 border-b-2 transition-all cursor-pointer ${
              activeTab === 'teachers' ? 'border-brand-primary text-brand-primary bg-brand-primary/5' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            مشاهدات المدرسين
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'most' && (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 text-right">الدرس / الفيديو</th>
                    <th className="pb-3 text-right">الكورس</th>
                    <th className="pb-3 text-right">المعلم</th>
                    <th className="pb-3 text-center">المشاهدات</th>
                    <th className="pb-3 text-center">الطلاب الفريدون</th>
                    <th className="pb-3 text-center">متوسط المشاهدة</th>
                    <th className="pb-3 text-center">نسبة الإكمال</th>
                    <th className="pb-3 text-center">إجمالي الدقائق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {data.most_watched_lessons.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">لا توجد إحصائيات متوفرة حالياً.</td>
                    </tr>
                  ) : (
                    data.most_watched_lessons.map((stat, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/10">
                        <td className="py-3.5">
                          <div className="font-extrabold text-[var(--text-color)]">{stat.video_title}</div>
                          <div className="text-[10px] text-slate-500 font-light mt-0.5">{stat.lesson_title}</div>
                        </td>
                        <td className="py-3.5 text-slate-300">{stat.course_title}</td>
                        <td className="py-3.5 text-slate-300">{stat.teacher_name}</td>
                        <td className="py-3.5 text-center font-bold text-emerald-400">{stat.views_count}</td>
                        <td className="py-3.5 text-center font-bold text-slate-300">{stat.unique_viewers ?? 0}</td>
                        <td className="py-3.5 text-center font-mono text-slate-300">{stat.average_watch_time_minutes ?? 0} د</td>
                        <td className="py-3.5 text-center font-bold text-indigo-400">{stat.completion_percentage ?? 0}%</td>
                        <td className="py-3.5 text-center font-mono">{stat.total_watch_time_minutes} د</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'least' && (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 text-right">الدرس / الفيديو</th>
                    <th className="pb-3 text-right">الكورس</th>
                    <th className="pb-3 text-right">المعلم</th>
                    <th className="pb-3 text-center">المشاهدات</th>
                    <th className="pb-3 text-center">الطلاب الفريدون</th>
                    <th className="pb-3 text-center">متوسط المشاهدة</th>
                    <th className="pb-3 text-center">نسبة الإكمال</th>
                    <th className="pb-3 text-center">إجمالي الدقائق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {data.least_watched_lessons.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">لا توجد إحصائيات متوفرة حالياً.</td>
                    </tr>
                  ) : (
                    data.least_watched_lessons.map((stat, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/10">
                        <td className="py-3.5">
                          <div className="font-extrabold text-[var(--text-color)]">{stat.video_title}</div>
                          <div className="text-[10px] text-slate-500 font-light mt-0.5">{stat.lesson_title}</div>
                        </td>
                        <td className="py-3.5 text-slate-300">{stat.course_title}</td>
                        <td className="py-3.5 text-slate-300">{stat.teacher_name}</td>
                        <td className="py-3.5 text-center font-bold text-rose-400">{stat.views_count}</td>
                        <td className="py-3.5 text-center font-bold text-slate-300">{stat.unique_viewers ?? 0}</td>
                        <td className="py-3.5 text-center font-mono text-slate-300">{stat.average_watch_time_minutes ?? 0} د</td>
                        <td className="py-3.5 text-center font-bold text-indigo-400">{stat.completion_percentage ?? 0}%</td>
                        <td className="py-3.5 text-center font-mono">{stat.total_watch_time_minutes} د</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 text-right">الكورس</th>
                    <th className="pb-3 text-right">المعلم</th>
                    <th className="pb-3 text-center">إجمالي المشاهدات</th>
                    <th className="pb-3 text-center">إجمالي الدقائق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {data.course_statistics.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">لا توجد إحصائيات متوفرة حالياً.</td>
                    </tr>
                  ) : (
                    data.course_statistics.map((stat, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/10">
                        <td className="py-3.5 font-extrabold text-[var(--text-color)]">{stat.course_title}</td>
                        <td className="py-3.5 text-slate-300">{stat.teacher_name}</td>
                        <td className="py-3.5 text-center font-bold text-indigo-400">{stat.views_count}</td>
                        <td className="py-3.5 text-center font-mono">{stat.total_watch_time_minutes} د</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'teachers' && (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 text-right">المعلم</th>
                    <th className="pb-3 text-center">إجمالي مشاهدات فيديوهاته</th>
                    <th className="pb-3 text-center">إجمالي الدقائق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {data.teacher_statistics.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-500">لا توجد إحصائيات متوفرة حالياً.</td>
                    </tr>
                  ) : (
                    data.teacher_statistics.map((stat, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/10">
                        <td className="py-3.5 font-extrabold text-[var(--text-color)]">{stat.teacher_name}</td>
                        <td className="py-3.5 text-center font-bold text-sky-400">{stat.views_count}</td>
                        <td className="py-3.5 text-center font-mono">{stat.total_watch_time_minutes} د</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
