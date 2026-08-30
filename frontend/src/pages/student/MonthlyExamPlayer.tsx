import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  ShieldAlert, 
  Maximize2, 
  Minimize2, 
  Send, 
  HelpCircle, 
  AlertTriangle,
  FileText
} from 'lucide-react'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import SEO from '../../components/SEO'

interface QuestionItem {
  id: number
  text: string
  type: 'mcq' | 'true_false' | 'essay'
  options?: string[] | null
  score: number
}

interface ExamInfo {
  id: number
  title: string
  description?: string
  type: string
  time_limit_minutes: number
  max_score: number
  passing_score?: number
  allowed_violations: number
  enable_fullscreen: boolean
  enable_anti_tab_switching: boolean
  enable_copy_protection: boolean
}

export default function MonthlyExamPlayer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useModalStore()

  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<ExamInfo | null>(null)
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [attemptId, setAttemptId] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  
  // Timer & Violations
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number | null>(null)
  const [violationsCount, setViolationsCount] = useState(0)
  const [isTerminated, setIsTerminated] = useState(false)
  const [terminationMessage, setTerminationMessage] = useState('')

  // UI state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Start / Resume Attempt
  useEffect(() => {
    const startAttempt = async () => {
      setLoading(true)
      try {
        const res = await API.post(`/monthly-exams/${id}/start`)
        const data = res.data
        setAttemptId(data.attempt_id)
        setExam(data.exam)
        setQuestions(data.questions || [])
        setTimeRemainingSeconds(data.time_remaining_seconds)
        setViolationsCount(data.violations_count || 0)

        // Populate saved answers if any
        if (data.saved_answers) {
          const initialAnswers: Record<number, string> = {}
          Object.values(data.saved_answers).forEach((ans: any) => {
            if (ans.question_id && ans.answer_text !== null) {
              initialAnswers[ans.question_id] = ans.answer_text
            }
          })
          setAnswers(initialAnswers)
        }

        // Request Fullscreen if enabled
        if (data.exam?.enable_fullscreen && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {})
        }
      } catch (err: any) {
        console.error('Failed to start monthly exam:', err)
        const msg = err.response?.data?.message || 'تعذر بدء الامتحان.'
        showToast(msg, 'error')
        if (err.response?.data?.terminated) {
          navigate(`/monthly-exams/${id}/results`, { replace: true })
        } else {
          navigate('/monthly-exams', { replace: true })
        }
      } finally {
        setLoading(false)
      }
    }

    startAttempt()
  }, [id])

  // Timer Countdown Effect
  useEffect(() => {
    if (timeRemainingSeconds === null || timeRemainingSeconds <= 0 || isTerminated) return

    const interval = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          handleAutoSubmit('time_expired')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeRemainingSeconds, isTerminated])

  // Anti-Cheat: Visibility change & Blur listeners
  useEffect(() => {
    if (!exam?.enable_anti_tab_switching || isTerminated || loading) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch')
      }
    }

    const handleBlur = () => {
      logViolation('window_blur')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [exam, isTerminated, loading])

  // Anti-Cheat: Copy/Paste/Context Menu Protection
  useEffect(() => {
    if (!exam?.enable_copy_protection || isTerminated || loading) return

    const preventAction = (e: Event) => {
      e.preventDefault()
      logViolation('copy_paste_attempt')
    }

    document.addEventListener('contextmenu', preventAction)
    document.addEventListener('copy', preventAction)
    document.addEventListener('cut', preventAction)
    document.addEventListener('paste', preventAction)

    return () => {
      document.removeEventListener('contextmenu', preventAction)
      document.removeEventListener('copy', preventAction)
      document.removeEventListener('cut', preventAction)
      document.removeEventListener('paste', preventAction)
    }
  }, [exam, isTerminated, loading])

  // Log Violation to Backend
  const logViolation = async (violationType: string) => {
    if (isTerminated) return
    try {
      const res = await API.post(`/monthly-exams/${id}/log-violation`, {
        violation_type: violationType,
        time_remaining_seconds: timeRemainingSeconds,
      })

      const newCount = res.data?.violations_count || violationsCount + 1
      setViolationsCount(newCount)

      if (res.data?.terminated) {
        setIsTerminated(true)
        setTerminationMessage(res.data?.message || 'تم إنهاء الامتحان تلقائياً بسبب تجاوز حد المخالفات المسموح.')
        showToast('تم حرمانك من الامتحان بسبب مخالفة قواعد المراقبة.', 'error')
      } else {
        showToast(`تنبيه: تم تسجيل مخالفة (${newCount}/${exam?.allowed_violations || 3}).`, 'warning')
      }
    } catch (err) {
      console.error('Failed to log violation:', err)
    }
  }

  // Handle Answer Selection & Auto-save
  const handleAnswerSelect = (questionId: number, answerText: string) => {
    if (isTerminated) return
    setAnswers((prev) => ({ ...prev, [questionId]: answerText }))

    // Debounced or direct draft save
    API.post(`/monthly-exams/${id}/save-draft`, {
      question_id: questionId,
      answer_text: answerText,
    }).catch((err) => console.error('Failed to save draft:', err))
  }

  // Submit Attempt
  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const res = await API.post(`/monthly-exams/${id}/submit`, {
        answers: answers,
      })
      showToast(res.data?.message || 'تم تسليم الامتحان بنجاح!', 'success')
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
      navigate(`/monthly-exams/${id}/results`, { replace: true })
    } catch (err: any) {
      console.error('Failed to submit exam:', err)
      const msg = err.response?.data?.message || 'تعذر تسليم الامتحان.'
      showToast(msg, 'error')
    } finally {
      setIsSubmitting(false)
      setShowSubmitModal(false)
    }
  }

  // Auto-submit on timer expiry
  const handleAutoSubmit = async (reason: string) => {
    showToast('انتهى الوقت المحدد للامتحان. جاري التسليم التلقائي...', 'info')
    handleSubmit()
  }

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remSecs = secs % 60
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-300">جاري إعداد بيئة الامتحان الآمنة...</p>
        </div>
      </div>
    )
  }

  if (isTerminated) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white">تم إنهاء الامتحان تلقائياً</h2>
          <p className="text-xs text-rose-300 leading-relaxed">
            {terminationMessage || 'لقد تم إنهاء محاولتك وتجميدها بسبب رصد مخالفات متعددة لنظام المراقبة (مثل مغادرة الصفحة أو محاولة النسخ).'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate(`/monthly-exams/${id}/results`, { replace: true })}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
            >
              الانتقال لصفحة التقرير
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const answeredCount = Object.keys(answers).length
  const totalQuestions = questions.length

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col select-none">
      <SEO title={`امتحان: ${exam?.title || 'الامتحان الشهري'}`} />

      {/* Top Fixed Header */}
      <header className="bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40">
        
        {/* Exam Title & Subject */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black text-white line-clamp-1">{exam?.title}</h1>
            <div className="text-[11px] text-slate-400">
              السؤال {currentQuestionIndex + 1} من {totalQuestions} • تم حل ({answeredCount} من {totalQuestions})
            </div>
          </div>
        </div>

        {/* Center: Timer */}
        {timeRemainingSeconds !== null && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm sm:text-base font-black border ${
            timeRemainingSeconds < 300 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse' 
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
          }`}>
            <Clock className="w-4 h-4" />
            <span>{formatTime(timeRemainingSeconds)}</span>
          </div>
        )}

        {/* Left: Anti-cheat Violations & Finish Button */}
        <div className="flex items-center gap-3">
          {violationsCount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>مخالفات: {violationsCount}/{exam?.allowed_violations || 3}</span>
            </div>
          )}

          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>تسليم الامتحان</span>
          </button>
        </div>
      </header>

      {/* Main Examination Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-between">
        
        {currentQuestion ? (
          <div className="space-y-6">
            
            {/* Question Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
              
              {/* Question Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold">
                  سؤال رقم {currentQuestionIndex + 1}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  الدرجة: <span className="text-indigo-300">{currentQuestion.score}</span>
                </span>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg font-bold text-slate-100 leading-relaxed">
                {currentQuestion.text}
              </div>

              {/* Question Options */}
              {currentQuestion.type === 'mcq' && currentQuestion.options && (
                <div className="grid grid-cols-1 gap-3 pt-2">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = answers[currentQuestion.id] === option
                    return (
                      <button
                        key={idx}
                        onClick={() => handleAnswerSelect(currentQuestion.id, option)}
                        className={`w-full text-right p-4 rounded-2xl border text-sm font-bold transition-all duration-200 flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-500/10'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-900/60'
                        }`}
                      >
                        <span>{option}</span>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-700 bg-slate-900'
                        }`}>
                          {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* True / False Options */}
              {currentQuestion.type === 'true_false' && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  {['صح', 'خطأ'].map((option) => {
                    const isSelected = answers[currentQuestion.id] === option
                    return (
                      <button
                        key={option}
                        onClick={() => handleAnswerSelect(currentQuestion.id, option)}
                        className={`p-4 rounded-2xl border text-sm font-black transition-all flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <span>{option}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Essay Text Area */}
              {currentQuestion.type === 'essay' && (
                <div className="pt-2">
                  <textarea
                    rows={6}
                    placeholder="اكتب إجابتك النموذجية هنا بالتفصيل..."
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed"
                  />
                </div>
              )}

            </div>

            {/* Questions Quick Pagination Strip */}
            <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-none">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentQuestionIndex
                const isAnswered = !!answers[q.id]
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`w-9 h-9 rounded-xl font-bold text-xs shrink-0 transition-all border ${
                      isCurrent
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20 scale-105'
                        : isAnswered
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>

          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">لا يوجد سؤال معروض.</div>
        )}

        {/* Bottom Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800 mt-6">
          <button
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 font-bold text-xs transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            <span>السابق</span>
          </button>

          {currentQuestionIndex < totalQuestions - 1 ? (
            <button
              onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-lg shadow-indigo-600/20"
            >
              <span>التالي</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-colors shadow-lg shadow-emerald-600/20"
            >
              <Send className="w-4 h-4" />
              <span>مراجعة وتسليم الامتحان</span>
            </button>
          )}
        </div>

      </main>

      {/* Submit Confirmation Modal */}
      <AnimatePresence>
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-right"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-lg font-black text-white">تأكيد تسليم الامتحان</h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  {answeredCount} / {totalQuestions} تم حلها
                </span>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <p>هل أنت متأكد من رغبتك في إنهاء وتسليم هذا الامتحان؟</p>
                {answeredCount < totalQuestions && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>تنبيه: لديك {totalQuestions - answeredCount} أسئلة متبقية لم تقم بالإجابة عليها بعد.</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>تأكيد التسليم الآن</span>
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => setShowSubmitModal(false)}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
                >
                  العودة للمتابعة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
