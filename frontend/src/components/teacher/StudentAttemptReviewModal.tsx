import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  BookOpen,
  ShieldAlert,
  Unlock,
  Lock,
  Save,
  Loader2,
  Calendar,
  Check,
  User,
  Award,
  FileText,
  HelpCircle,
  Layers
} from 'lucide-react'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { useAuthStore } from '../../store/authStore'
import { ExamImagePreview } from '../ui/ExamImagePreview'
import {
  formatSubmissionDateTime,
  formatExamDuration,
} from '../../utils/formatters'

export interface QuestionReviewItem {
  id: number
  text: string
  image_url?: string | null
  type: 'mcq' | 'true_false' | 'essay' | string
  options?: any[] | null
  correct_answer?: string | null
  explanation?: string | null
  score: number
  is_answered: boolean
  student_answer: string | null
  is_correct: boolean
  score_awarded: number
}

export interface AttemptHistoryItem {
  id: number
  attempt_number: number
  is_current: boolean
  is_latest: boolean
  status: string
  score: number | null
  max_score: number
  percentage: number
  started_at?: string | null
  submitted_at?: string | null
  graded_at?: string | null
  violation_count?: number
  is_suspicious?: boolean
}

export interface AttemptReviewData {
  exam: {
    id: number
    title: string
    type?: string
    max_score: number
    passing_score: number
    time_limit_minutes?: number | null
  }
  student: {
    id?: number
    name: string
    email?: string | null
    phone?: string | null
  }
  attempt: {
    id: number
    status: string
    score: number | null
    max_score: number
    percentage: number
    started_at?: string | null
    submitted_at?: string | null
    graded_at?: string | null
    duration_minutes?: number | null
    duration_seconds?: number | null
    teacher_feedback?: string | null
    auto_submitted?: boolean
    submission_reason?: string | null
    violation_count?: number
    cheat_violations_count?: number
    is_suspicious?: boolean
    is_terminated_for_cheating?: boolean
    terminated_for_cheating_at?: string | null
    answers_unlocked_at?: string | null
    answers_unlocked_by?: number | null
    unlocked_by?: { id: number; name: string } | null
    can_student_view_answers?: boolean
  }
  summary?: {
    total_questions: number
    correct_count: number
    incorrect_count: number
    unanswered_count: number
    needs_grading_count: number
    score: number | null
    max_score: number
    percentage: number
    duration_seconds?: number | null
  }
  questions: QuestionReviewItem[]
  all_attempts?: AttemptHistoryItem[]
  violations?: {
    id: number
    violation_type: string
    time_remaining_seconds?: number | null
    metadata?: any
    created_at?: string | null
  }[]
}

interface StudentAttemptReviewModalProps {
  isOpen: boolean
  onClose: () => void
  attemptId: number | null
  examId: number
  isMonthlyExam?: boolean
  onGradeSaved?: () => void
}

export function StudentAttemptReviewModal({
  isOpen,
  onClose,
  attemptId,
  examId,
  isMonthlyExam = false,
  onGradeSaved,
}: StudentAttemptReviewModalProps) {
  const [currentAttemptId, setCurrentAttemptId] = useState<number | null>(attemptId)
  const [loading, setLoading] = useState(false)
  const [reviewData, setReviewData] = useState<AttemptReviewData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Grading form state
  const [gradedAnswers, setGradedAnswers] = useState<Record<number, number>>({})
  const [gradeScore, setGradeScore] = useState<string>('')
  const [gradeFeedback, setGradeFeedback] = useState<string>('')
  const [savingGrade, setSavingGrade] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [showViolationsList, setShowViolationsList] = useState(false)

  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  // Keep currentAttemptId in sync with prop when modal opens
  useEffect(() => {
    if (attemptId) {
      setCurrentAttemptId(attemptId)
    }
  }, [attemptId])

  // Fetch attempt details
  useEffect(() => {
    if (!isOpen || !currentAttemptId || !examId) return

    setLoading(true)
    setErrorMsg(null)

    const endpoint = isMonthlyExam
      ? (isAdmin
          ? `/admin/monthly-exams/${examId}/attempts/${currentAttemptId}`
          : `/teacher/monthly-exams/${examId}/attempts/${currentAttemptId}`)
      : (isAdmin
          ? `/admin/exams/${examId}/attempts/${currentAttemptId}`
          : `/teacher/exams/${examId}/attempts/${currentAttemptId}`)

    API.get(endpoint)
      .then((res) => {
        const data: AttemptReviewData = res.data
        setReviewData(data)

        // Initialize grade form
        setGradeScore(data.attempt.score !== null ? String(data.attempt.score) : '')
        setGradeFeedback(data.attempt.teacher_feedback || '')

        // Initialize per-question grades
        const grades: Record<number, number> = {}
        data.questions.forEach((q) => {
          grades[q.id] = q.score_awarded ?? 0
        })
        setGradedAnswers(grades)
      })
      .catch((err) => {
        console.error('Failed to load attempt details:', err)
        const msg = err.response?.data?.message || 'تعذر تحميل تفاصيل المحاولة. يرجى المحاولة مرة أخرى.'
        setErrorMsg(msg)
      })
      .finally(() => setLoading(false))
  }, [isOpen, currentAttemptId, examId, isMonthlyExam])

  if (!isOpen) return null

  // Re-calculate suggested total score when essay scores change
  const handleEssayScoreChange = (questionId: number, val: number, maxScore: number) => {
    const clamped = Math.max(0, Math.min(val, maxScore))
    const updated = { ...gradedAnswers, [questionId]: clamped }
    setGradedAnswers(updated)

    // Sum all question scores
    if (reviewData) {
      const sum = reviewData.questions.reduce((acc, q) => {
        const s = q.id === questionId ? clamped : (updated[q.id] ?? q.score_awarded ?? 0)
        return acc + s
      }, 0)
      setGradeScore(String(Math.min(sum, reviewData.exam.max_score)))
    }
  }

  // Handle grade submission
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentAttemptId || !reviewData) return

    setSavingGrade(true)
    try {
      const gradeEndpoint = isAdmin
        ? `/admin/attempts/${currentAttemptId}/grade`
        : `/teacher/attempts/${currentAttemptId}/grade`

      await API.post(gradeEndpoint, {
        score: Number(gradeScore),
        teacher_feedback: gradeFeedback,
        answers: gradedAnswers,
      })

      useModalStore.getState().showToast('تم رصد وتحديث الدرجة بنجاح.', 'success')
      if (onGradeSaved) {
        onGradeSaved()
      }

      // Update local state to reflect graded status
      setReviewData((prev) => {
        if (!prev) return null
        return {
          ...prev,
          attempt: {
            ...prev.attempt,
            status: 'graded',
            score: Number(gradeScore),
            teacher_feedback: gradeFeedback,
          },
        }
      })
    } catch (err: any) {
      console.error('Failed to save grade:', err)
      const msg = err.response?.data?.message || 'تعذر حفظ الدرجة. تحقق من صحة المدخلات.'
      useModalStore.getState().showToast(msg, 'error')
    } finally {
      setSavingGrade(false)
    }
  }

  // Handle unlocking answers for cheating-terminated student
  const handleUnlockAnswers = async () => {
    if (!currentAttemptId) return
    setUnlocking(true)
    try {
      const endpoint = isMonthlyExam
        ? (isAdmin
            ? `/admin/monthly-exams/attempts/${currentAttemptId}/unlock-answers`
            : `/teacher/monthly-exams/attempts/${currentAttemptId}/unlock-answers`)
        : (isAdmin
            ? `/admin/exams/attempts/${currentAttemptId}/unlock-answers`
            : `/teacher/exams/attempts/${currentAttemptId}/unlock-answers`)

      const res = await API.post(endpoint)
      useModalStore.getState().showToast(res.data?.message || 'تم السماح للطالب بمراجعة الإجابات بنجاح.', 'success')

      setReviewData((prev) => {
        if (!prev) return null
        return {
          ...prev,
          attempt: {
            ...prev.attempt,
            can_student_view_answers: true,
            answers_unlocked_at: new Date().toISOString(),
          },
        }
      })
    } catch (err: any) {
      console.error('Failed to unlock answers:', err)
      const msg = err.response?.data?.message || 'تعذر إلغاء قفل الإجابات.'
      useModalStore.getState().showToast(msg, 'error')
    } finally {
      setUnlocking(false)
    }
  }

  // Helper to test if option matches given value
  const isOptionMatched = (option: any, targetVal?: string | null, index?: number): boolean => {
    if (!targetVal || targetVal === '') return false
    const target = targetVal.trim().toLowerCase()

    if (typeof option === 'string') {
      const optStr = option.trim().toLowerCase()
      if (optStr === target) return true
    } else if (typeof option === 'object' && option !== null) {
      if (option.text && option.text.trim().toLowerCase() === target) return true
      if (option.image_url && option.image_url.trim().toLowerCase() === target) return true
      if (option.id !== undefined && String(option.id).trim().toLowerCase() === target) return true
    }

    if (index !== undefined) {
      if (String(index) === target) return true
      const arabicLetters = ['أ', 'ب', 'ج', 'د', 'هـ']
      if (arabicLetters[index] === targetVal.trim()) return true
    }

    return false
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 select-none font-sans" dir="rtl">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-7 max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] text-right text-slate-200 select-text"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-black text-brand-primary flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>طالب:</span>
                </span>
                <span className="text-white font-bold text-sm">
                  {reviewData?.student?.name || 'جاري التحميل...'}
                </span>
                {reviewData?.student?.phone && (
                  <span className="text-slate-400 font-mono text-[11px] bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/60">
                    {reviewData.student.phone}
                  </span>
                )}
                {reviewData?.student?.email && (
                  <span className="text-slate-400 font-mono text-[11px] hidden md:inline">
                    ({reviewData.student.email})
                  </span>
                )}
              </div>

              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-primary shrink-0" />
                <span>{reviewData?.exam?.title || 'مراجعة وتصحيح حلول الطالب'}</span>
              </h2>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-500/30 transition-all cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="overflow-y-auto space-y-6 flex-1 pr-1 pl-1 py-4">
            {loading ? (
              <div className="text-center py-24 space-y-3">
                <Loader2 className="w-10 h-10 text-brand-primary animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-bold">جاري تحميل تفاصيل المحاولة وإجابات الطالب بالكامل...</p>
              </div>
            ) : errorMsg ? (
              <div className="text-center py-16 space-y-3">
                <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                <p className="text-sm font-bold text-slate-200">{errorMsg}</p>
                <button
                  onClick={() => setCurrentAttemptId(currentAttemptId)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-200 transition-colors"
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : !reviewData ? null : (
              <>
                {/* -------------------------------------------------------------
                    Multiple Attempts History Tabs (Requirement 4)
                    ------------------------------------------------------------- */}
                {reviewData.all_attempts && reviewData.all_attempts.length > 1 && (
                  <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                      <Layers className="w-4 h-4 text-brand-primary" />
                      <span>جميع محاولات الطالب لهذا الامتحان ({reviewData.all_attempts.length} محاولات):</span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {reviewData.all_attempts.map((att) => {
                        const isCurrent = att.id === currentAttemptId
                        const formattedSubDate = formatSubmissionDateTime(att.submitted_at)

                        return (
                          <button
                            key={att.id}
                            type="button"
                            onClick={() => setCurrentAttemptId(att.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center gap-2 cursor-pointer ${
                              isCurrent
                                ? 'bg-brand-primary text-slate-950 border-brand-primary shadow-md font-black'
                                : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:border-slate-500 hover:bg-slate-850'
                            }`}
                          >
                            <span>المحاولة #{att.attempt_number}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              isCurrent ? 'bg-black/20 text-slate-950' : 'bg-black/40 text-slate-300'
                            }`}>
                              {att.score ?? 0} / {att.max_score} ({att.percentage}%)
                            </span>
                            {att.is_latest && (
                              <span className={`text-[9px] px-1 rounded font-black ${
                                isCurrent ? 'bg-black/30 text-slate-950' : 'bg-emerald-500/20 text-emerald-300'
                              }`}>
                                الأحدث
                              </span>
                            )}
                            {formattedSubDate && (
                              <span className="text-[9px] opacity-75 hidden sm:inline">
                                • {formattedSubDate}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    Student Performance Summary Card (Requirement 3)
                    ------------------------------------------------------------- */}
                {(() => {
                  const isCheater = reviewData.attempt.is_terminated_for_cheating
                  const score = reviewData.attempt.score ?? 0
                  const maxScore = reviewData.exam.max_score
                  const percentage = reviewData.attempt.percentage
                  const isPassed = percentage >= 50
                  const isGraded = reviewData.attempt.status === 'graded'

                  const subDateStr = formatSubmissionDateTime(reviewData.attempt.submitted_at)
                  const startDateStr = formatSubmissionDateTime(reviewData.attempt.started_at)
                  const durationStr = formatExamDuration(
                    reviewData.attempt.started_at,
                    reviewData.attempt.submitted_at,
                    reviewData.attempt.duration_minutes
                  )

                  const correctCount = reviewData.summary?.correct_count ?? reviewData.questions.filter(q => q.is_correct).length
                  const incorrectCount = reviewData.summary?.incorrect_count ?? reviewData.questions.filter(q => q.is_answered && !q.is_correct && q.type !== 'essay').length
                  const unansweredCount = reviewData.summary?.unanswered_count ?? reviewData.questions.filter(q => !q.is_answered).length
                  const needsGradingCount = reviewData.summary?.needs_grading_count ?? reviewData.questions.filter(q => q.type === 'essay' && !isGraded).length

                  return (
                    <div className={`p-5 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-5 ${
                      isCheater
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : isPassed
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-amber-500/10 border-amber-500/30'
                    }`}>
                      <div className="space-y-2 text-center md:text-right w-full md:w-auto">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-slate-300">
                          <span className="font-bold">المحاولة الحالية: #{reviewData.attempt.id}</span>
                          <span>•</span>
                          <span className="font-bold text-white">
                            {isCheater ? (
                              <span className="text-rose-400">ملغاة لمخالفة المراقبة</span>
                            ) : isGraded ? (
                              <span className="text-emerald-400">تم رصد الدرجة</span>
                            ) : reviewData.attempt.status === 'submitted' ? (
                              <span className="text-amber-400">تم التسليم (بانتظار المراجعة)</span>
                            ) : (
                              <span className="text-sky-400">قيد الحل (لم يتم التسليم بعد)</span>
                            )}
                          </span>
                        </div>

                        {/* Timing info */}
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1 text-[11px] text-slate-300">
                          {startDateStr && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>بدء الامتحان: {startDateStr}</span>
                            </span>
                          )}

                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {subDateStr ? `وقت التسليم: ${subDateStr}` : 'لم يتم التسليم بعد'}
                            </span>
                          </span>

                          {durationStr && (
                            <span className="flex items-center gap-1 font-bold text-brand-primary">
                              <span>مدة الحل: {durationStr}</span>
                            </span>
                          )}
                        </div>

                        {/* Breakdown pills */}
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1 text-[11px]">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>إجابات صحيحة: {correctCount}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                            <XCircle className="w-3 h-3" />
                            <span>إجابات خاطئة: {incorrectCount}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                            <AlertCircle className="w-3 h-3" />
                            <span>لم تُجب: {unansweredCount}</span>
                          </span>
                          {needsGradingCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                              <FileText className="w-3 h-3" />
                              <span>بانتظار تصحيح يدوي: {needsGradingCount}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Total Score Circle / Box */}
                      <div className="shrink-0 text-center bg-slate-950/70 border border-white/10 px-6 py-3.5 rounded-2xl shadow-inner min-w-[130px]">
                        <div className={`text-2xl sm:text-3xl font-black ${
                          isCheater
                            ? 'text-rose-400'
                            : isPassed
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}>
                          {score} / {maxScore}
                        </div>
                        <div className="text-xs font-bold text-slate-300 mt-0.5">
                          النسبة: {percentage}%
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* -------------------------------------------------------------
                    Anti-Cheat Alert & Violations Timeline (if applicable)
                    ------------------------------------------------------------- */}
                {reviewData.attempt.is_terminated_for_cheating && (
                  <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-black text-xs text-rose-300">
                        <ShieldAlert className="w-5 h-5 text-rose-400" />
                        <span>تم قفل الامتحان بواسطة نظام مكافحة الغش ({reviewData.attempt.violation_count || reviewData.attempt.cheat_violations_count || 0} مخالفات)</span>
                      </div>
                      {reviewData.violations && reviewData.violations.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowViolationsList(!showViolationsList)}
                          className="text-[11px] text-rose-300 underline font-bold hover:text-white cursor-pointer"
                        >
                          {showViolationsList ? 'إخفاء سجل المخالفات' : 'عرض سجل المخالفات'}
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] leading-relaxed text-rose-200">
                      السبب المسجل: {reviewData.attempt.submission_reason || 'تجاوز الحد الأقصى لمخالفات النزاهة'}.
                    </p>

                    {showViolationsList && reviewData.violations && reviewData.violations.length > 0 && (
                      <div className="pt-2 border-t border-rose-500/20 space-y-1.5 text-[10px]">
                        {reviewData.violations.map((v, vIdx) => (
                          <div key={v.id || vIdx} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                            <span>مخالفة: <span className="font-bold text-rose-400">{v.violation_type}</span></span>
                            <span>الوقت المتبقي: {v.time_remaining_seconds} ثانية</span>
                            <span>التاريخ: {formatSubmissionDateTime(v.created_at) || '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Unlock action */}
                    {!reviewData.attempt.can_student_view_answers && (
                      <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-rose-300">
                          الإجابات النموذجية محجوبة عن الطالب 🔒
                        </span>
                        <button
                          type="button"
                          disabled={unlocking}
                          onClick={handleUnlockAnswers}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {unlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                          <span>السماح للطالب بعرض الإجابات</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------------------------------------------------
                    Questions Detailed Review List (Requirements 1 & 2)
                    ------------------------------------------------------------- */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-sm text-slate-200 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand-primary" />
                      <span>تفاصيل أسئلة وإجابات الطالب ({reviewData.questions.length} أسئلة):</span>
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {reviewData.questions.map((q, idx) => {
                      const isUnanswered = !q.is_answered
                      const isMcq = q.type === 'mcq'
                      const isTf = q.type === 'true_false'
                      const isEssay = q.type === 'essay'

                      return (
                        <div
                          key={q.id}
                          className={`p-4 sm:p-5 rounded-2xl border bg-slate-950/40 space-y-3.5 transition-colors ${
                            q.is_correct
                              ? 'border-emerald-500/35 bg-emerald-950/5'
                              : isUnanswered
                              ? 'border-amber-500/30 bg-amber-950/5'
                              : isEssay
                              ? 'border-indigo-500/30 bg-indigo-950/5'
                              : 'border-rose-500/35 bg-rose-950/5'
                          }`}
                        >
                          {/* Question Top Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-white">سؤال {idx + 1}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">
                                {isMcq ? 'اختيار من متعدد' : isTf ? 'صواب وخطأ' : 'سؤال مقالي'}
                              </span>

                              {/* Status Badge */}
                              {q.is_correct ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>إجابة صحيحة</span>
                                </span>
                              ) : isUnanswered ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-black border border-amber-500/30">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>لم تتم الإجابة</span>
                                </span>
                              ) : isEssay ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-[10px] font-black border border-indigo-500/30">
                                  <FileText className="w-3 h-3" />
                                  <span>سؤال مقالي</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-black border border-rose-500/30">
                                  <XCircle className="w-3 h-3" />
                                  <span>إجابة خاطئة</span>
                                </span>
                              )}
                            </div>

                            {/* Question Score Awarded */}
                            <div className="text-xs font-black text-brand-primary">
                              الدرجة: {gradedAnswers[q.id] ?? q.score_awarded} / {q.score}
                            </div>
                          </div>

                          {/* Question Text */}
                          <div className="text-xs sm:text-sm font-bold text-slate-100 leading-relaxed">
                            {q.text || (q.image_url ? '[سؤال مصور]' : '')}
                          </div>

                          {/* Question Image (Inline Expand using ExamImagePreview) */}
                          {q.image_url && (
                            <div className="pt-1">
                              <ExamImagePreview
                                src={q.image_url}
                                alt={`صورة السؤال ${idx + 1}`}
                                title={`صورة السؤال ${idx + 1}`}
                              />
                            </div>
                          )}

                          {/* Unanswered Banner */}
                          {isUnanswered && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>ترك الطالب هذا السؤال دون إجابة.</span>
                            </div>
                          )}

                          {/* -------------------------------------------
                              MCQ Options Display with Student & Model Pick
                              ------------------------------------------- */}
                          {isMcq && q.options && Array.isArray(q.options) && (
                            <div className="space-y-2 pt-1">
                              <div className="text-[11px] font-bold text-slate-400">الاختيارات:</div>
                              <div className="grid grid-cols-1 gap-2">
                                {q.options.map((opt, optIdx) => {
                                  const optText = typeof opt === 'object' && opt !== null ? opt.text || '' : String(opt)
                                  const optImageUrl = typeof opt === 'object' && opt !== null ? opt.image_url || null : null

                                  const isStudentChoice = isOptionMatched(opt, q.student_answer, optIdx)
                                  const isCorrectChoice = isOptionMatched(opt, q.correct_answer, optIdx)

                                  let cardStyle = 'bg-slate-900/60 border-slate-800 text-slate-300'
                                  if (isCorrectChoice) {
                                    cardStyle = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500/20'
                                  } else if (isStudentChoice && !q.is_correct) {
                                    cardStyle = 'bg-rose-500/15 border-rose-500/50 text-rose-200 font-bold'
                                  }

                                  return (
                                    <div
                                      key={optIdx}
                                      className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${cardStyle}`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-black shrink-0 ${
                                          isCorrectChoice
                                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                            : isStudentChoice
                                            ? 'bg-rose-500 text-white border-rose-400'
                                            : 'border-slate-700 text-slate-400'
                                        }`}>
                                          {['أ', 'ب', 'ج', 'د', 'هـ'][optIdx] || optIdx + 1}
                                        </span>
                                        <span className="leading-relaxed">{optText}</span>
                                      </div>

                                      {/* Option Image if present */}
                                      {optImageUrl && (
                                        <div className="py-1">
                                          <ExamImagePreview
                                            src={optImageUrl}
                                            alt={`صورة الخيار ${['أ', 'ب', 'ج', 'د'][optIdx] || optIdx + 1}`}
                                            isOption={true}
                                          />
                                        </div>
                                      )}

                                      {/* Indicator Badges */}
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {isCorrectChoice && (
                                          <span className="px-2 py-0.5 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-[10px] font-black flex items-center gap-1">
                                            <Check className="w-3 h-3" />
                                            <span>الإجابة النموذجية الصحيحة</span>
                                          </span>
                                        )}
                                        {isStudentChoice && (
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                            isCorrectChoice
                                              ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400'
                                              : 'bg-rose-500/30 text-rose-200 border-rose-400'
                                          }`}>
                                            {isCorrectChoice ? 'إجابة الطالب (صحيحة)' : 'إجابة الطالب (خاطئة)'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* -------------------------------------------
                              True / False Choices
                              ------------------------------------------- */}
                          {isTf && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                                isUnanswered
                                  ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                                  : q.is_correct
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              }`}>
                                <span className="text-[10px] text-slate-400 block font-bold">إجابة الطالب:</span>
                                <span className="font-black text-sm">{q.student_answer || 'لم يقم بالإجابة'}</span>
                              </div>

                              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-1">
                                <span className="text-[10px] text-emerald-400 block font-bold">الإجابة النموذجية:</span>
                                <span className="font-black text-sm text-emerald-300">{q.correct_answer || 'صح'}</span>
                              </div>
                            </div>
                          )}

                          {/* -------------------------------------------
                              Essay Question Answer & Grading
                              ------------------------------------------- */}
                          {isEssay && (
                            <div className="space-y-3 pt-1">
                              <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1.5">
                                <div className="text-[11px] text-slate-400 font-bold flex items-center justify-between">
                                  <span>إجابة الطالب المكتوبة:</span>
                                  {q.student_answer && (q.student_answer.startsWith('http') || q.student_answer.startsWith('/storage/')) && (
                                    <span className="text-[10px] text-brand-primary">صورة مرفقة</span>
                                  )}
                                </div>

                                {q.student_answer && (q.student_answer.startsWith('http') || q.student_answer.startsWith('/storage/')) ? (
                                  <div className="pt-1">
                                    <ExamImagePreview src={q.student_answer} alt="إجابة الطالب المصورة" />
                                  </div>
                                ) : (
                                  <p className="font-bold text-slate-100 whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
                                    {q.student_answer || '[لم يكتب الطالب أي إجابة]'}
                                  </p>
                                )}
                              </div>

                              {/* Model answer / rubric if available */}
                              {q.correct_answer && (
                                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-xs space-y-1">
                                  <div className="text-[10px] text-emerald-400 font-bold">نموذج الإجابة الإرشادي للمعلم:</div>
                                  <p className="font-bold text-emerald-200 whitespace-pre-wrap">{q.correct_answer}</p>
                                </div>
                              )}

                              {/* Manual score input for this essay question */}
                              <div className="p-3 bg-brand-primary/10 border border-brand-primary/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                                <label className="font-bold text-slate-200">
                                  منح درجة لهذا السؤال المقالي (الحد الأقصى {q.score}):
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={q.score}
                                    step={0.5}
                                    value={gradedAnswers[q.id] ?? ''}
                                    onChange={(e) => handleEssayScoreChange(q.id, Number(e.target.value), q.score)}
                                    placeholder="0"
                                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-center font-black text-brand-primary focus:outline-none focus:border-brand-primary"
                                  />
                                  <span className="text-slate-400 font-bold">/ {q.score}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Model Explanation */}
                          {q.explanation && (
                            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-300 space-y-1">
                              <span className="font-black text-indigo-400 flex items-center gap-1">
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>شرح وتوضيح الإجابة النموذجية:</span>
                              </span>
                              <p className="leading-relaxed whitespace-pre-wrap">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* -------------------------------------------------------------
                    Teacher Grading & Feedback Form (Requirement 2 & 5)
                    ------------------------------------------------------------- */}
                {!isMonthlyExam && (
                  <form onSubmit={handleSaveGrade} className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-4">
                    <h3 className="font-black text-sm text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-brand-primary" />
                      <span>اعتماد ورصد درجة المحاولة:</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300">
                          الدرجة الإجمالية النهائية (من {reviewData.exam.max_score})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={reviewData.exam.max_score}
                          step={0.5}
                          required
                          value={gradeScore}
                          onChange={(e) => setGradeScore(e.target.value)}
                          placeholder={`0 إلى ${reviewData.exam.max_score}`}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300">
                        ملاحظات وتقييم المدرس للطالب (تظهر في صفحة النتيجة):
                      </label>
                      <textarea
                        rows={3}
                        value={gradeFeedback}
                        onChange={(e) => setGradeFeedback(e.target.value)}
                        placeholder="اكتب ملاحظاتك وتوجيهاتك للطالب هنا..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-brand-primary leading-relaxed"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={savingGrade}
                        className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-slate-950 text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-primary/20 disabled:opacity-50"
                      >
                        {savingGrade ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span>حفظ ورصد الدرجة للواجب / الاختبار</span>
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-800 flex justify-between items-center shrink-0">
            <span className="text-[11px] text-slate-400">
              {reviewData ? `معرّف المحاولة: #${reviewData.attempt.id}` : ''}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              إغلاق المراجعة
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default StudentAttemptReviewModal
