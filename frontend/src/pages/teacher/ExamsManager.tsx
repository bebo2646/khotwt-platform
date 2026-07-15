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
  FileText
} from 'lucide-react'
import EmptyState from '../../components/EmptyState'

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
  score: number | null
  status: 'started' | 'submitted' | 'graded'
  teacher_feedback: string | null
  submitted_at: string
  student: {
    name: string
  }
  violation_count?: number
  is_suspicious?: boolean
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
  const [activeAttempt, setActiveAttempt] = React.useState<AttemptItem | null>(null)

  // Grader Form inputs
  const [gradeScore, setGradeScore] = React.useState('')
  const [gradeFeedback, setGradeFeedback] = React.useState('')
  const [gradedAnswers, setGradedAnswers] = React.useState<Record<number, number>>({}) // question_id => score

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
    setActiveAttempt(null)

    API.get(`/teacher/exams/${exam.id}/attempts`)
      .then((res) => {
        setAttempts(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setAttemptsLoading(false))
  }

  const handleOpenGrader = (attempt: AttemptItem) => {
    setActiveAttempt(attempt)
    setGradeScore(attempt.score !== null ? attempt.score.toString() : '')
    setGradeFeedback(attempt.teacher_feedback || '')
    
    const initialGrades: Record<number, number> = {}
    attempt.answers.forEach((ans) => {
      initialGrades[ans.question_id] = ans.score
    })
    setGradedAnswers(initialGrades)
  }

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAttempt || !selectedExam) return

    setAttemptsLoading(true)
    try {
      await API.post(`/teacher/attempts/${activeAttempt.id}/grade`, {
        score: Number(gradeScore),
        teacher_feedback: gradeFeedback,
        answers: gradedAnswers,
      })
      useModalStore.getState().showToast('تم رصد الدرجة للواجب بنجاح.', 'success')
      setActiveAttempt(null)
      handleViewAttempts(selectedExam)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('خطأ أثناء حفظ الدرجة.', 'error')
    } finally {
      setAttemptsLoading(false)
    }
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
                <div className="flex gap-2">
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
                            <div className="text-[10px] text-slate-450 font-light flex gap-2 pt-0.5">
                              <span>التسليم: {new Date(att.submitted_at).toLocaleDateString('ar-EG')}</span>
                              <span>•</span>
                              <span className={isGraded ? 'text-brand-success' : 'text-amber-500'}>
                                {isGraded ? 'تم رصد الدرجة' : 'بانتظار المراجعة والدرجة'}
                              </span>
                            </div>
                          </div>

                          <div>
                            {selectedExam.type === 'homework' || !isGraded ? (
                              <button
                                onClick={() => handleOpenGrader(att)}
                                className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                              >
                                {isGraded ? 'تعديل الدرجة' : 'رصد ودرجة'}
                              </button>
                            ) : (
                              <div className="text-sm font-black text-brand-primary">{att.score} / {selectedExam.max_score}</div>
                            )}
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

      {/* 1. Manual Grader Overlay Panel */}
      {activeAttempt && selectedExam && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-transparent" onClick={() => setActiveAttempt(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] z-10 text-right">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
              <h3 className="font-black text-base text-slate-200">تصحيح إجابات: {activeAttempt.student.name}</h3>
              <button onClick={() => setActiveAttempt(null)} className="p-1 hover:bg-slate-800 rounded cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="space-y-6 text-right">
              
              {/* Anti-cheat report section */}
              {(activeAttempt.violation_count ?? 0) > 0 && (
                <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-500">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>تقرير نظام مراقبة الغش والمخالفات</span>
                    </span>
                    <span>إجمالي المخالفات: {activeAttempt.violation_count}</span>
                  </div>
                  {activeAttempt.violation_timestamps && activeAttempt.violation_timestamps.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[10px] text-slate-400 block font-bold">سجل المخالفات التفصيلي:</span>
                      <div className="space-y-1.5 pr-1 max-h-48 overflow-y-auto" dir="rtl">
                        {activeAttempt.violation_timestamps.map((t, idx) => {
                          const isReturn = t.type === 'returned';
                          const timeStr = new Date(t.time).toLocaleTimeString('ar-EG');
                          const timeRemainingStr = t.time_remaining !== undefined && t.time_remaining !== null 
                            ? `${Math.floor(t.time_remaining / 60)} دقيقة و ${t.time_remaining % 60} ثانية`
                            : null;
                          
                          let violationName = t.type;
                          if (t.type === 'tab_switch') violationName = 'تبديل تبويب المتصفح / مغادرة الصفحة';
                          else if (t.type === 'window_blur') violationName = 'الخروج عن شاشة الامتحان (فقدان التركيز)';
                          else if (t.type === 'fullscreen_exit') violationName = 'الخروج من وضع ملء الشاشة';
                          else if (t.type === 'copy_attempt') violationName = 'محاولة نسخ النص';
                          else if (t.type === 'paste_attempt') violationName = 'محاولة لصق محتوى خارجي';
                          else if (t.type === 'right_click_attempt') violationName = 'محاولة استخدام الزر الأيمن';
                          else if (t.type === 'returned') violationName = 'العودة إلى شاشة الامتحان بعد الخروج';

                          return (
                            <div key={idx} className={`p-2.5 rounded-xl border text-[10px] space-y-1 ${
                              isReturn 
                                ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' 
                                : 'bg-rose-500/5 border-rose-500/10 text-rose-300'
                            }`}>
                              <div className="flex justify-between items-center font-bold">
                                <span>{isReturn ? '🟢' : '🚨'} {violationName}</span>
                                <span className="font-light text-slate-450">{timeStr}</span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-450 pt-0.5 border-t border-slate-900/60">
                                {t.question_number && (
                                  <span>السؤال النشط: {t.question_number}</span>
                                )}
                                {timeRemainingStr && (
                                  <span>الوقت المتبقي: {timeRemainingStr}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Final status summary */}
                      {activeAttempt.is_suspicious && (
                        <div className="pt-2.5 border-t border-rose-500/25 text-[10px] text-rose-450 font-bold space-y-1">
                          <div className="flex items-center gap-1">
                            <span>⚠️</span>
                            <span>الحالة النهائية: تم قفل الامتحان بسبب تجاوز المخالفات المسموح بها.</span>
                          </div>
                          {(() => {
                            const lastViol = activeAttempt.violation_timestamps
                              .filter((t) => t.type !== 'returned')
                              .pop();
                            if (lastViol) {
                              let lastViolName = lastViol.type;
                              if (lastViol.type === 'tab_switch') lastViolName = 'تبديل تبويب المتصفح';
                              else if (lastViol.type === 'window_blur') lastViolName = 'مغادرة شاشة الامتحان';
                              else if (lastViol.type === 'fullscreen_exit') lastViolName = 'الخروج من ملء الشاشة';
                              else if (lastViol.type === 'copy_attempt') lastViolName = 'محاولة نسخ النص';

                              const remStr = lastViol.time_remaining !== undefined && lastViol.time_remaining !== null 
                                ? `${Math.floor(lastViol.time_remaining / 60)} دقيقة و ${lastViol.time_remaining % 60} ثانية`
                                : 'غير متوفر';

                              return (
                                <div className="text-[9px] text-slate-400 font-medium">
                                  <span>سبب القفل الأخير: {lastViolName}</span>
                                  <span className="mx-2">•</span>
                                  <span>الوقت المتبقي عند القفل: {remStr}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Question list student sheet */}
              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                {activeAttempt.answers.map((ans, idx) => {
                  return (
                    <div key={ans.id} className="p-4 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-2xl space-y-3 text-xs sm:text-sm">
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-200">س {idx + 1}: {ans.question.text}</span>
                        <span className="text-slate-400">({ans.question.score} درجات)</span>
                      </div>
                      
                      {/* Student's answer */}
                      <div className="p-3 bg-black/30 border border-slate-800 rounded-xl space-y-1">
                        <div className="text-[10px] text-slate-500">إجابة الطالب:</div>
                        <p className="font-bold text-slate-200">{ans.answer_text || '[لا توجد إجابة]'}</p>
                      </div>

                      {/* Correct Answer */}
                      {ans.question.correct_answer && (
                        <div className="p-3 bg-brand-primary/5 border border-brand-primary/20 rounded-xl space-y-1">
                          <div className="text-[10px] text-brand-primary">الإجابة النموذجية الصحيحة:</div>
                          <p className="font-bold text-brand-primary">{ans.question.correct_answer}</p>
                        </div>
                      )}

                      {/* Essay score input inline */}
                      {ans.question.type === 'essay' && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-semibold text-slate-300">منح الدرجة المحددة:</label>
                          <input
                            type="number"
                            max={ans.question.score}
                            min={0}
                            required
                            value={gradedAnswers[ans.question_id] ?? ''}
                            onChange={(e) => {
                              const val = Number(e.target.value)
                              setGradedAnswers((prev) => ({
                                ...prev,
                                [ans.question_id]: val
                              }))
                            }}
                            placeholder="0"
                            className="w-20 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-lg px-2.5 py-1 text-center text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Total score summary */}
              <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-color)] pt-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">الدرجة الكلية المستحقة</label>
                  <input
                    type="number"
                    max={selectedExam.max_score}
                    min={0}
                    required
                    value={gradeScore}
                    onChange={(e) => setGradeScore(e.target.value)}
                    placeholder={`الحد الأقصى ${selectedExam.max_score}`}
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Feedback */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">ملاحظات وتقييم المدرس</label>
                <textarea
                  rows={3}
                  value={gradeFeedback || ''}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  placeholder="مثال: إجابة ممتازة وخط منظم..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl p-4 text-xs text-slate-200 focus:outline-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
                <button type="button" onClick={() => setActiveAttempt(null)} className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl cursor-pointer">إلغاء</button>
                <button type="submit" className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl cursor-pointer">حفظ ورصد الدرجة</button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
