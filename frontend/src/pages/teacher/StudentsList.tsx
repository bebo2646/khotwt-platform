import React from 'react'
import API from '../../services/api'
import { Users, Search, CheckCircle, Play, Award, Clock, ArrowLeft, Loader2, X } from 'lucide-react'
import EmptyState from '../../components/EmptyState'

interface EnrollmentDetail {
  id: number
  course: {
    title: string
  }
}

interface StudentItem {
  id: number
  name: string
  email: string
  phone: string
  enrollments: EnrollmentDetail[]
}

interface AttemptItem {
  id: number
  score: number | null
  status: 'started' | 'submitted' | 'graded'
  created_at: string
  exam: {
    title: string
    type: 'quiz' | 'homework' | 'monthly_exam'
    max_score: number
  }
}

interface StudentAnalytics {
  student: {
    name: string
    email: string
    phone: string
  }
  progress: {
    total_videos: number
    completed_videos: number
    completion_rate: number
    watch_time_minutes: number
  }
  exam_attempts: AttemptItem[]
  last_activity: string
}

export default function StudentsList() {
  const [students, setStudents] = React.useState<StudentItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')

  // Drawer / Single Student analytics states
  const [selectedStudentId, setSelectedStudentId] = React.useState<number | null>(null)
  const [analytics, setAnalytics] = React.useState<StudentAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = React.useState(false)
  const [studentLimits, setStudentLimits] = React.useState<any[]>([])

  React.useEffect(() => {
    API.get('/teacher/students')
      .then((res) => {
        setStudents(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const handleOpenAnalytics = (studentId: number) => {
    setSelectedStudentId(studentId)
    setAnalyticsLoading(true)
    setAnalytics(null)
    setStudentLimits([])

    API.get(`/teacher/students/${studentId}/analytics`)
      .then((res) => {
        setAnalytics(res.data)
      })
      .catch((err) => console.error(err))

    API.get(`/teacher/student-course-limits?student_id=${studentId}`)
      .then((res) => {
        setStudentLimits(res.data || [])
      })
      .catch((err) => console.error(err))
      .finally(() => setAnalyticsLoading(false))
  }

  // Filter students based on search
  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.phone.includes(searchQuery)
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black">إحصائيات الطلاب والنشاط</h1>
          <p className="text-sm text-slate-400 font-light mt-1">تتبع نسبة حضور ومتابعة ومذاكرة جميع الطلاب المقيدين بموادك الدراسية</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            className="w-full bg-brand-card border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-2.5 text-xs focus:outline-none focus:border-brand-primary"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          type="students"
          title="لا يوجد طلاب مسجلون"
          description={searchQuery ? "لم نعثر على طلاب يطابقون خيارات البحث." : "لم يقم أي طالب بالاشتراك في كورساتك بعد."}
        />
      ) : (
        /* Students Table Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Students list cards */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 shadow-sm overflow-hidden">
              <h3 className="font-bold text-base border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-primary" />
                <span>قائمة الطلاب المقيدين ({filteredStudents.length})</span>
              </h3>

              <div className="divide-y divide-[var(--border-color)] max-h-[500px] overflow-y-auto pr-1">
                {filteredStudents.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => handleOpenAnalytics(st.id)}
                    className={`flex justify-between items-center py-4 cursor-pointer hover:bg-[rgba(255,255,255,0.01)] transition-colors ${
                      selectedStudentId === st.id ? 'bg-brand-primary/5' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm sm:text-base">{st.name}</h4>
                      <div className="text-[10px] text-slate-400 font-light flex flex-wrap gap-2">
                        <span>هاتف: {st.phone}</span>
                        <span>•</span>
                        <span>البريد: {st.email}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-full text-[9px] font-semibold">
                        {st.enrollments[0]?.course.title || 'كورس غير مسمى'}
                      </span>
                      <span className="text-[10px] text-slate-500 hover:underline">عرض التقارير ←</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Student Detailed Analytics Panel */}
          <div className="md:col-span-1">
            <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl shadow-sm min-h-[400px] flex flex-col justify-center relative overflow-hidden">
              
              {analyticsLoading && (
                <div className="absolute inset-0 bg-brand-card/85 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
                    <span className="text-xs text-slate-400 font-light">جاري جلب إحصائيات الطالب...</span>
                  </div>
                </div>
              )}

              {analytics ? (
                <div className="space-y-6 text-right">
                  
                  {/* Close button */}
                  <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
                    <h3 className="font-black text-sm sm:text-base">تقارير الطالب الدراسية</h3>
                    <button onClick={() => setAnalytics(null)} className="p-1 hover:bg-slate-800 rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Student details */}
                  <div className="space-y-1 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] p-4 rounded-2xl">
                    <div className="font-bold text-sm">{analytics.student.name}</div>
                    <div className="text-[10px] text-slate-400 font-light">هاتف: {analytics.student.phone}</div>
                    <div className="text-[10px] text-slate-400 font-light">آخر نشاط بالمنصة: {analytics.last_activity}</div>
                  </div>

                  {/* Watch progress indicators */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-2xl text-center space-y-1">
                      <div className="text-[10px] text-slate-400 font-medium">نسبة إتمام الفيديوهات</div>
                      <div className="text-lg font-black text-brand-primary">{analytics.progress.completion_rate}%</div>
                      <div className="text-[9px] text-slate-500 font-light">شاهد {analytics.progress.completed_videos} من {analytics.progress.total_videos} فيديو</div>
                    </div>

                    <div className="p-4 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-2xl text-center space-y-1">
                      <div className="text-[10px] text-slate-400 font-medium">إجمالي المشاهدة</div>
                      <div className="text-lg font-black text-brand-primary">{analytics.progress.watch_time_minutes}</div>
                      <div className="text-[9px] text-slate-500 font-light">دقيقة دراسية كاملة</div>
                    </div>
                  </div>

                  {/* Remaining Course Views (Teacher View Only) */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs">حدود مشاهدات الكورسات المتبقية:</h4>
                    {studentLimits.length === 0 ? (
                      <div className="text-[10px] text-slate-500 font-light mr-2">لا توجد قيود مفروضة على المشاهدة حالياً أو لم يتم استهلاك أي مشاهدات.</div>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {studentLimits.map((lim: any) => (
                          <div key={lim.id} className="flex justify-between items-center p-3 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl text-xs">
                            <div className="space-y-0.5 text-right">
                              <div className="font-bold text-[var(--text-color)]">{lim.course_title}</div>
                              <div className="text-[9px] text-slate-500">تم استهلاك {lim.views_used} مشاهدة</div>
                            </div>
                            <div className="text-left shrink-0">
                              <span className="px-2 py-0.5 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-full text-[9px] font-bold">
                                المتبقي: {lim.remaining} / {lim.max_allowed}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Exam scores */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs">درجات الاختبارات والواجبات:</h4>
                    
                    {analytics.exam_attempts.length === 0 ? (
                      <div className="text-center p-6 border border-dashed border-[var(--border-color)] rounded-2xl text-slate-500 text-xs font-light">
                        لم يقم الطالب بتسليم أي واجبات أو امتحانات بعد.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {analytics.exam_attempts.map((attempt) => {
                          const isGraded = attempt.status === 'graded'
                          const isQuiz = attempt.exam.type === 'quiz'
                          
                          return (
                            <div key={attempt.id} className="flex justify-between items-center p-3 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl text-xs">
                              <div className="space-y-0.5">
                                <div className="font-bold">{attempt.exam.title}</div>
                                <div className="text-[9px] text-slate-500">{isQuiz ? 'كويز سريع' : 'واجب منزلي'}</div>
                              </div>
                              
                              <div className="font-black text-slate-300">
                                {isGraded ? `${attempt.score} / ${attempt.exam.max_score}` : 'قيد التصحيح'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="text-center py-20 text-slate-500 font-light text-xs space-y-2">
                  <p>الرجاء النقر على اسم الطالب في الجدول الأيمن لعرض تقاريره المفصلة هنا.</p>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

    </div>
  )
}
