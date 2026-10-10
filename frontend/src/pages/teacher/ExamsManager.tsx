import React from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { 
  Plus, 
  Check, 
  Play, 
  Edit3, 
  Trash2, 
  Calendar, 
  ClipboardCheck, 
  Award, 
  AlertCircle, 
  X, 
  Loader2, 
  FileSpreadsheet, 
  Upload, 
  HelpCircle,
  FileText,
  Eye
} from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import ExamVisibilityModal from '../../components/ExamVisibilityModal'
import StudentAttemptReviewModal from '../../components/teacher/StudentAttemptReviewModal'
import { formatSubmissionDateTime } from '../../utils/formatters'

interface CourseItem {
  id: number
  title: string
}

interface LessonItem {
  id: number
  title: string
  unit: {
    course_id: number
  }
  course_id?: number | null
  package_id?: number | null
  matching_package_id?: number | null
  is_locked?: boolean
}

interface ExamItem {
  id: number
  title: string
  type: 'quiz' | 'homework' | 'monthly_exam'
  time_limit_minutes: number | null
  max_score: number
  lesson?: {
    title: string
    unit: {
      course: {
        title: string
      }
    }
  }
}

interface AttemptItem {
  id: number
  student_id?: number
  score: number | null
  status: 'started' | 'submitted' | 'graded'
  teacher_feedback: string | null
  submitted_at: string
  student: {
    id?: number
    name: string
    email?: string
  }
  violation_count?: number
  is_suspicious?: boolean
  answers_unlocked_at?: string | null
  violation_timestamps?: {
    type: string
    time: string
    question_number?: number | null
    question_id?: number | null
    time_remaining?: number | null
    returned?: boolean
  }[]
  answers: {
    id: number
    question_id: number
    answer_text: string
    is_correct: boolean
    score: number
    question: {
      text: string
      image_url?: string | null
      type: string
      score: number
      correct_answer?: string | null
    }
  }[]
}

export default function ExamsManager() {
  const navigate = useNavigate()
  const [exams, setExams] = React.useState<ExamItem[]>([])
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [lessons, setLessons] = React.useState<LessonItem[]>([])
  const [loading, setLoading] = React.useState(true)

  // Attempts & Grader States
  const [selectedExam, setSelectedExam] = React.useState<ExamItem | null>(null)
  const [attempts, setAttempts] = React.useState<AttemptItem[]>([])
  const [attemptsLoading, setAttemptsLoading] = React.useState(false)
  const [reviewAttemptId, setReviewAttemptId] = React.useState<number | null>(null)
  const [isVisibilityModalOpen, setIsVisibilityModalOpen] = React.useState(false)


  const fetchExams = () => {
    setLoading(true)
    API.get('/teacher/exams')
      .then((res) => {
        setExams(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  const fetchCoursesAndLessons = () => {
    API.get('/teacher/courses')
      .then((res) => {
        setCourses(res.data)
        if (res.data.length > 0) {
          API.get(`/courses/${res.data[0].id}`).then((cRes) => {
            const lessonsList: LessonItem[] = cRes.data.units.flatMap((u: any) =>
              u.lessons.map((l: any) => ({
                id: l.id,
                title: l.title,
                unit: { course_id: res.data[0].id }
              }))
            )
            setLessons(lessonsList)
          })
        }
      })
      .catch((err) => console.error(err))
  }

  React.useEffect(() => {
    fetchExams()
    fetchCoursesAndLessons()
  }, [])

  const handleViewAttempts = (exam: ExamItem) => {
    setSelectedExam(exam)
    setAttemptsLoading(true)
    setAttempts([])
    setReviewAttemptId(null)

    API.get(`/teacher/exams/${exam.id}/attempts`)
      .then((res) => {
        setAttempts(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setAttemptsLoading(false))
  }

  const handleOpenGrader = (attempt: AttemptItem) => {
    setReviewAttemptId(attempt.id)
  }

  const handleDeleteExam = (examId: number) => {
    useModalStore.getState().showConfirm({
      title: 'تأكيد حذف الاختبار',
      description: 'هل أنت متأكد من رغبتك في حذف هذا الاختبار نهائياً؟ ستفقد جميع درجات الطلاب المرتبطة به ولا يمكن استرجاعها.',
      type: 'delete',
      onConfirm: async () => {
        try {
          await API.delete(`/teacher/exams/${examId}`)
          useModalStore.getState().showToast('تم حذف الاختبار بنجاح.', 'success')
          setSelectedExam(null)
          fetchExams()
        } catch (err) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف الاختبار.', 'error')
        }
      }
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 text-right" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-100">إدارة الاختبارات والواجبات</h1>
          <p className="text-sm text-slate-400 font-light mt-1">أنشئ اختبارات MCQ، صح وخطأ، واجبات مقالية، وصحح تسليمات الطلاب فورياً.</p>
        </div>
        
        <button
          onClick={() => navigate('/teacher/exams/create')}
          className="px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-primary/20 w-fit"
        >
          <Plus className="h-4.5 w-4.5" /> <span>إنشاء اختبار جديد</span>
        </button>
      </div>

      {/* Grid view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Col 1: Exams List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
            <h3 className="font-bold text-base border-b border-[var(--border-color)] pb-3 flex items-center gap-2 text-slate-200">
              <ClipboardCheck className="h-5 w-5 text-brand-primary" />
              <span>قائمة اختباراتي المقررة:</span>
            </h3>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin h-8 w-8 text-brand-primary" />
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-light text-xs">لا يوجد أي امتحانات حالياً.</div>
            ) : (
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {exams.map((ex) => {
                  const isSelected = selectedExam?.id === ex.id
                  return (
                    <div
                      key={ex.id}
                      onClick={() => handleViewAttempts(ex)}
                      className={`p-4 border rounded-2xl cursor-pointer transition-all flex flex-col gap-2 ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary/5 text-slate-100 font-bold'
                          : 'border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] text-slate-300 hover:border-slate-800'
                      }`}
                    >
                      <div className="font-bold text-sm text-slate-200">{ex.title}</div>
                      
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-light">
                        <span className="px-2 py-0.5 bg-[rgba(255,255,255,0.03)] border border-[var(--border-color)] rounded-full text-brand-primary">
                          {ex.type === 'quiz' ? 'كويز' : ex.type === 'homework' ? 'واجب' : 'امتحان شهري'}
                        </span>
                        <span>الدرجة الكلية: {ex.max_score}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Col 2: Exam attempts list */}
        <div className="lg:col-span-2 space-y-6">
          {selectedExam ? (
            <div className="bg-brand-card border border-[var(--border-color)] p-8 rounded-3xl space-y-6 shadow-sm relative min-h-[350px]">
              
              {attemptsLoading && (
                <div className="absolute inset-0 bg-brand-card/90 flex items-center justify-center z-10 rounded-3xl">
                  <Loader2 className="animate-spin h-10 w-10 text-brand-primary" />
                </div>
              )}

              <div className="border-b border-[var(--border-color)] pb-4 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-400">الاختبار المختار:</span>
                  <h3 className="text-lg font-black text-slate-100">{selectedExam.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsVisibilityModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl transition-all text-xs font-bold cursor-pointer"
                    title="التحكم في ظهور النتائج للطلاب"
                  >
                    <Eye className="h-4 w-4" />
                    <span>ظهور النتائج</span>
                  </button>
                  <button
                    onClick={() => navigate(`/teacher/exams/edit/${selectedExam.id}`)}
                    className="p-2 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl transition-all cursor-pointer"
                    title="تعديل الاختبار"
                  >
                    <Edit3 className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteExam(selectedExam.id)}
                    className="p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all cursor-pointer"
                    title="حذف الاختبار"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Attempts list */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-slate-300">تسليمات وحلول الطلاب:</h4>
                
                {attempts.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-[var(--border-color)] rounded-2xl text-slate-500 text-sm font-light">
                    لا يوجد تسليمات أو حلول مسجلة من الطلاب لهذا الاختبار بعد.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {attempts.map((att) => {
                      const isGraded = att.status === 'graded'
                      return (
                        <div key={att.id} className="flex justify-between items-center p-4 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-2xl">
                          <div className="space-y-1">
                            <div className="font-bold text-sm text-slate-200 flex flex-wrap items-center gap-2">
                              <span>{att.student.name}</span>
                              {att.is_suspicious && (
                                <span className="px-2 py-0.5 bg-rose-500/15 border border-rose-500/20 text-rose-500 rounded text-[9px] font-black animate-pulse">
                                  محاولة مشبوهة ⚠️
                                </span>
                              )}
                              {(att.violation_count ?? 0) > 0 && (
                                <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/20 text-amber-500 rounded text-[9px] font-bold">
                                  مخالفات: {att.violation_count}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-450 font-light flex flex-wrap items-center gap-2 pt-0.5">
                              <span>
                                {formatSubmissionDateTime(att.submitted_at)
                                  ? `التسليم: ${formatSubmissionDateTime(att.submitted_at)}`
                                  : 'لم يتم التسليم بعد (قيد الحل)'}
                              </span>
                              <span>•</span>
                              <span className={isGraded ? 'text-brand-success' : 'text-amber-500'}>
                                {isGraded ? 'تم رصد الدرجة' : 'بانتظار المراجعة والدرجة'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {att.score !== null && att.score !== undefined && (
                              <div className="text-sm font-black text-brand-primary">
                                {att.score} / {selectedExam.max_score}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenGrader(att)}
                              className="px-3.5 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                              <span>{isGraded ? 'مراجعة وتعديل' : 'مراجعة ورصد الدرجة'}</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-brand-card border border-[var(--border-color)] p-12 text-center rounded-3xl text-slate-400">
              يرجى اختيار امتحان من القائمة الجانبية لرؤية تسليمات وحلول الطلاب.
            </div>
          )}
        </div>

      </div>

      {/* ==========================================================================
          OVERLAYS & MODALS
          ========================================================================== */}

      {/* 1. Student Attempt Review & Grading Modal */}
      {selectedExam && (
        <StudentAttemptReviewModal
          isOpen={!!reviewAttemptId}
          onClose={() => setReviewAttemptId(null)}
          attemptId={reviewAttemptId}
          examId={selectedExam.id}
          isMonthlyExam={false}
          onGradeSaved={() => {
            handleViewAttempts(selectedExam)
          }}
        />
      )}

      {/* Exam Result Visibility Control Modal */}
      {selectedExam && (
        <ExamVisibilityModal
          isOpen={isVisibilityModalOpen}
          onClose={() => setIsVisibilityModalOpen(false)}
          examId={selectedExam.id}
          examTitle={selectedExam.title}
          attempts={attempts}
          onUpdated={() => handleViewAttempts(selectedExam)}
        />
      )}

    </div>
  )
}
