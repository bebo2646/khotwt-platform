import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight, 
  ShieldAlert, 
  HelpCircle, 
  FileText, 
  AlertCircle, 
  RotateCcw,
  Sparkles,
  ChevronLeft,
  Loader2
} from 'lucide-react'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import SEO from '../../components/SEO'
import { formatGradeName, formatSubjectName } from '../../utils/formatters'

interface StudentAnswerItem {
  id: number
  question_id: number
  answer_text: string | null
  is_correct: boolean
  score_awarded: number
  question?: {
    id: number
    text: string
    type: string
    options?: string[]
    correct_answer?: string
    explanation?: string
    score: number
  }
}

interface AttemptDetails {
  id: number
  score: number | null
  status: string
  submitted_at: string | null
  graded_at: string | null
  violation_count: number
  cheat_violations_count: number
  submission_reason?: string
  terminated_for_cheating_at?: string | null
  answers_unlocked_at?: string | null
  exam: {
    id: number
    title: string
    description?: string
    time_limit_minutes: number
    max_score: number
    passing_score?: number
    month?: string
    subject?: string
    grade?: string
    teacher?: {
      id: number
      name: string
      avatar?: string
    }
    questions?: Array<{
      id: number
      text: string
      type: string
      options?: string[]
      correct_answer?: string
      explanation?: string
      score: number
    }>
  }
  answers: StudentAnswerItem[]
}

export default function MonthlyExamResults() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useModalStore()

  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState<AttemptDetails | null>(null)
  const [canViewAnswers, setCanViewAnswers] = useState(true)
  const [isTerminated, setIsTerminated] = useState(false)

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true)
      try {
        const res = await API.get(`/monthly-exams/${id}/results`)
        setAttempt(res.data.attempt)
        setCanViewAnswers(res.data.can_view_answers !== false)
        setIsTerminated(!!res.data.is_terminated_for_cheating)
      } catch (err: any) {
        console.error('Failed to load exam results:', err)
        const msg = err.response?.data?.message || 'تعذر تحميل نتائج الامتحان.'
        showToast(msg, 'error')
        navigate('/monthly-exams')
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-brand-primary animate-spin mx-auto" />
          <p className="text-sm font-bold text-[var(--text-secondary)]">جاري تحميل تقرير النتيجة والمراجعة...</p>
        </div>
      </div>
    )
  }

  if (!attempt) return null

  const exam = attempt.exam
  const maxScore = exam.max_score || 100
  const score = attempt.score ?? 0
  const passingScore = exam.passing_score || Math.round(maxScore * 0.5)
  const isPassed = score >= passingScore
  const percentage = Math.round((score / maxScore) * 100)

  // Map answers by question_id
  const answersMap = new Map<number, StudentAnswerItem>()
  attempt.answers?.forEach((a) => {
    answersMap.set(a.question_id, a)
  })

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8 text-right" dir="rtl">
      <SEO title={`تقرير نتيجة: ${exam.title}`} />

      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Back Link */}
        <Link
          to="/monthly-exams"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>العودة لقائمة الامتحانات الشهرية</span>
        </Link>

        {/* Hero Score Card */}
        <div className={`relative overflow-hidden rounded-3xl border p-8 sm:p-10 backdrop-blur-xl shadow-2xl ${
          isTerminated
            ? 'bg-gradient-to-br from-rose-950/60 via-slate-900/90 to-red-950/40 border-rose-500/30'
            : isPassed
            ? 'bg-gradient-to-br from-emerald-950/60 via-slate-900/90 to-teal-950/40 border-emerald-500/30'
            : 'bg-gradient-to-br from-amber-950/60 via-slate-900/90 to-orange-950/40 border-amber-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-right">
            
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-950/60 border border-slate-800 text-xs font-bold" dir="rtl">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {exam.grade ? `${formatGradeName(exam.grade)} • ` : ''}
                  {formatSubjectName(exam.subject)} {exam.month ? `• ${exam.month}` : ''}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{exam.title}</h1>
              
              {isTerminated ? (
                <p className="text-xs sm:text-sm text-rose-300 font-semibold max-w-lg leading-relaxed">
                  تم إنهاء محاولتك وتجميدها بواسطة نظام المراقبة الذكي بسبب رصد تجاوز في عدد المخالفات.
                </p>
              ) : isPassed ? (
                <p className="text-xs sm:text-sm text-emerald-300 font-semibold max-w-lg leading-relaxed">
                  تهانينا! لقد اجتزت الامتحان الشهري بنجاح وتفوق. يمكنك مراجعة الأسئلة والإجابات النموذجية بالأسفل.
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-amber-300 font-semibold max-w-lg leading-relaxed">
                  لم يحالفك الحظ لاجتياز درجة النجاح المطلوبة ({passingScore} درجة). راجع إجاباتك جيداً لتدارك الأخطاء.
                </p>
              )}
            </div>

            {/* Big Score Gauge */}
            <div className="shrink-0 flex flex-col items-center justify-center w-36 h-36 rounded-full bg-slate-950/80 border-2 border-slate-800 shadow-2xl p-4">
              <div className={`text-3xl font-black ${
                isTerminated ? 'text-rose-400' : isPassed ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {percentage}%
              </div>
              <div className="text-[11px] text-slate-400 font-bold mt-1">
                {score} / {maxScore} درجة
              </div>
            </div>

          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-800/80 text-center">
            <div className="p-3 bg-slate-950/40 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">حالة المحاولة</div>
              <div className={`text-xs font-bold mt-1 ${
                isTerminated ? 'text-rose-400' : 'text-slate-200'
              }`}>
                {isTerminated ? 'مخالفة قواعد' : attempt.status === 'graded' ? 'تم التصحيح' : 'قيد المراجعة'}
              </div>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">درجة النجاح</div>
              <div className="text-xs font-bold text-slate-200 mt-1">{passingScore} درجة</div>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">المخالفات المرصودة</div>
              <div className="text-xs font-bold text-rose-400 mt-1">{attempt.cheat_violations_count || attempt.violation_count || 0}</div>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-xl">
              <div className="text-[11px] text-slate-400 font-medium">تاريخ التسليم</div>
              <div className="text-xs font-bold text-slate-200 mt-1">
                {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString('ar-EG') : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Anti-cheat Locked Answers Notice */}
        {!canViewAnswers && (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-400">
              <ShieldAlert className="w-5 h-5" />
              <span>نموذج الإجابات محجوب</span>
            </div>
            <p className="text-xs leading-relaxed text-rose-300">
              تم حجب عرض الإجابات النموذجية الصحيحة لهذا الامتحان تلقائياً بسبب إنهاء محاولتك لمخالفة قواعد المراقبة. يمكن لمعلم المادة أو إدارة المنصة فقط فتح الإجابات للمراجعة لاحقاً.
            </p>
          </div>
        )}

        {/* Question by Question Review */}
        {canViewAnswers && exam.questions && exam.questions.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span>مراجعة الأسئلة والإجابات النموذجية</span>
            </h2>

            <div className="space-y-4">
              {exam.questions.map((q, idx) => {
                const studentAns = answersMap.get(q.id)
                const isCorrect = studentAns?.is_correct
                const scoreAwarded = studentAns?.score_awarded ?? 0

                return (
                  <div 
                    key={q.id}
                    className={`rounded-2xl border p-6 bg-slate-900/70 backdrop-blur-md shadow-lg space-y-4 ${
                      isCorrect 
                        ? 'border-emerald-500/30' 
                        : studentAns?.answer_text 
                        ? 'border-rose-500/30' 
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">سؤال {idx + 1}</span>
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>إجابة صحيحة</span>
                          </span>
                        ) : studentAns?.answer_text ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[11px] font-bold border border-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>إجابة خاطئة</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[11px] font-bold">
                            لم تتم الإجابة
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-bold text-indigo-400">
                        {scoreAwarded} / {q.score} درجة
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-100 leading-relaxed">
                      {q.text}
                    </div>

                    {/* Options list for MCQ */}
                    {q.type === 'mcq' && q.options && (
                      <div className="grid grid-cols-1 gap-2 pt-2">
                        {q.options.map((opt, oIdx) => {
                          const isStudentChoice = studentAns?.answer_text === opt
                          const isCorrectChoice = q.correct_answer === opt

                          let style = 'bg-slate-950/60 border-slate-800 text-slate-300'
                          if (isCorrectChoice) {
                            style = 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-bold'
                          } else if (isStudentChoice && !isCorrect) {
                            style = 'bg-rose-500/20 border-rose-500/60 text-rose-200 font-bold line-through'
                          }

                          return (
                            <div key={oIdx} className={`p-3 rounded-xl border text-xs flex items-center justify-between ${style}`}>
                              <span>{opt}</span>
                              {isCorrectChoice && <span className="text-[10px] font-bold text-emerald-400">الإجابة الصحيحة</span>}
                              {isStudentChoice && !isCorrectChoice && <span className="text-[10px] font-bold text-rose-400">إجابتك</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* True / False display */}
                    {q.type === 'true_false' && (
                      <div className="flex gap-4 pt-2 text-xs">
                        <div className="text-slate-400">
                          إجابتك: <span className={`font-bold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>{studentAns?.answer_text || 'لا يوجد'}</span>
                        </div>
                        <div className="text-slate-400">
                          الإجابة النموذجية: <span className="font-bold text-emerald-400">{q.correct_answer}</span>
                        </div>
                      </div>
                    )}

                    {/* Essay answer display */}
                    {q.type === 'essay' && (
                      <div className="space-y-2 pt-2 text-xs">
                        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                          <div className="text-slate-400 font-semibold mb-1">إجابتك المكتوبة:</div>
                          <div className="text-slate-200">{studentAns?.answer_text || 'لم تتم كتابة إجابة.'}</div>
                        </div>
                        {q.explanation && (
                          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-300">
                            <span className="font-bold">ملاحظات المعلم / التوضيح: </span>
                            <span>{q.explanation}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && q.type !== 'essay' && (
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
                        <span className="font-bold">شرح الحل: </span>
                        <span>{q.explanation}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
