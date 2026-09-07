import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  AlertTriangle,
  FileText,
  Check
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

  // Core Exam State
  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<ExamInfo | null>(null)
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [attemptId, setAttemptId] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})

  // Server-Authoritative Timer & Skew Synchronization
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [clockSkewMs, setClockSkewMs] = useState<number>(0)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number | null>(null)
  const [violationsCount, setViolationsCount] = useState(0)
  const [isTerminated, setIsTerminated] = useState(false)
  const [terminationMessage, setTerminationMessage] = useState('')

  // UI & Question Navigation State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [essayDraftText, setEssayDraftText] = useState('')

  // Mutable Refs to eliminate Stale Closures in event listeners and callbacks
  const isTerminatedRef = useRef(false)
  const isSubmittingRef = useRef(false)
  const timeRemainingRef = useRef<number | null>(null)
  const allowedViolationsRef = useRef<number>(3)
  const lastViolationTimeRef = useRef<number>(0)
  const lastViolationTypeRef = useRef<string>('')
  const isFullscreenActiveRef = useRef<boolean>(false)
  const examRef = useRef<ExamInfo | null>(null)

  // Sync state into refs
  useEffect(() => {
    isTerminatedRef.current = isTerminated
  }, [isTerminated])

  useEffect(() => {
    isSubmittingRef.current = isSubmitting
  }, [isSubmitting])

  useEffect(() => {
    timeRemainingRef.current = timeRemainingSeconds
  }, [timeRemainingSeconds])

  useEffect(() => {
    if (exam) {
      examRef.current = exam
      allowedViolationsRef.current = exam.allowed_violations || 3
    }
  }, [exam])

  // Question navigation strip ref for auto-scrolling
  const navStripRef = useRef<HTMLDivElement>(null)

  // Fullscreen Helpers (Cross-browser and mobile safe)
  const enterFullscreenSafe = async () => {
    try {
      const el = document.documentElement as any
      if (el.requestFullscreen) {
        await el.requestFullscreen()
        setIsFullscreen(true)
        isFullscreenActiveRef.current = true
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen()
        setIsFullscreen(true)
        isFullscreenActiveRef.current = true
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen()
        setIsFullscreen(true)
        isFullscreenActiveRef.current = true
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen()
        setIsFullscreen(true)
        isFullscreenActiveRef.current = true
      }
    } catch (err) {
      console.warn('Fullscreen request rejected or not supported on this platform:', err)
    }
  }

  const exitFullscreenSafe = async () => {
    try {
      const doc = document as any
      if (doc.exitFullscreen) {
        await doc.exitFullscreen()
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen()
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen()
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen()
      }
      setIsFullscreen(false)
      isFullscreenActiveRef.current = false
    } catch (err) {
      console.warn('Failed to exit fullscreen:', err)
    }
  }

  const toggleFullscreen = () => {
    const doc = document as any
    const isFull = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    )
    if (!isFull) {
      enterFullscreenSafe()
    } else {
      exitFullscreenSafe()
    }
  }

  // 1. Start / Resume Attempt from Backend
  useEffect(() => {
    let isMounted = true

    const startAttempt = async () => {
      setLoading(true)
      try {
        const res = await API.post(`/monthly-exams/${id}/start`)
        if (!isMounted) return
        const data = res.data

        setAttemptId(data.attempt_id)
        setExam(data.exam)
        setQuestions(data.questions || [])
        setViolationsCount(data.violations_count || 0)

        // Calculate authoritative server clock skew
        const serverTimeMs = data.server_now ? new Date(data.server_now).getTime() : Date.now()
        const clientTimeMs = Date.now()
        const skew = serverTimeMs - clientTimeMs
        setClockSkewMs(skew)

        // Store authoritative expires_at
        if (data.expires_at) {
          setExpiresAt(data.expires_at)
          const currentServerTime = clientTimeMs + skew
          const targetExpiresTime = new Date(data.expires_at).getTime()
          const initialRemaining = Math.max(0, Math.floor((targetExpiresTime - currentServerTime) / 1000))
          setTimeRemainingSeconds(initialRemaining)
        } else if (typeof data.time_remaining_seconds === 'number') {
          setTimeRemainingSeconds(Math.floor(data.time_remaining_seconds))
        }

        // Populate existing saved answers
        if (data.saved_answers) {
          const initialAnswers: Record<number, string> = {}
          Object.values(data.saved_answers).forEach((ans: any) => {
            if (ans.question_id && ans.answer_text !== null && ans.answer_text !== undefined) {
              initialAnswers[ans.question_id] = ans.answer_text
            }
          })
          setAnswers(initialAnswers)
        }

        // Request Fullscreen if configured
        if (data.exam?.enable_fullscreen) {
          setTimeout(() => {
            enterFullscreenSafe()
          }, 300)
        }
      } catch (err: any) {
        if (!isMounted) return
        console.error('Failed to start monthly exam:', err)
        const msg = err.response?.data?.message || 'تعذر بدء الامتحان.'
        showToast(msg, 'error')
        if (err.response?.data?.terminated) {
          navigate(`/monthly-exams/${id}/results`, { replace: true })
        } else {
          navigate('/monthly-exams', { replace: true })
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    startAttempt()

    return () => {
      isMounted = false
    }
  }, [id, navigate, showToast])

  // 2. Server-Authoritative Timer Countdown (No drift, No reset on refresh)
  useEffect(() => {
    if (!expiresAt || isTerminated) return

    const tick = () => {
      const currentServerTimeMs = Date.now() + clockSkewMs
      const targetTimeMs = new Date(expiresAt).getTime()
      const remaining = Math.max(0, Math.floor((targetTimeMs - currentServerTimeMs) / 1000))
      setTimeRemainingSeconds(remaining)

      if (remaining <= 0) {
        handleAutoSubmit('time_expired')
      }
    }

    // Initial immediate calculation
    tick()

    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, clockSkewMs, isTerminated])

  // 3. Keep question navigation pill centered in view on navigation
  useEffect(() => {
    if (navStripRef.current) {
      const activePill = navStripRef.current.children[currentQuestionIndex] as HTMLElement | undefined
      if (activePill) {
        activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }

    // Sync essay text when navigating
    const currQ = questions[currentQuestionIndex]
    if (currQ && currQ.type === 'essay') {
      setEssayDraftText(answers[currQ.id] || '')
    }
  }, [currentQuestionIndex, questions, answers])

  const VIOLATION_DEDUPE_MS = 2000

  // 4. Log Anti-Cheat Violation with Correlated Event Deduplication
  const logViolation = useCallback(async (violationType: string, meta?: any) => {
    if (isTerminatedRef.current || isSubmittingRef.current) return

    const now = Date.now()
    const correlatedTypes = ['tab_switch', 'window_blur', 'focus_loss', 'visibility_hidden', 'fullscreen_exit']

    // Debounce correlated events within 2000ms
    if (
      now - lastViolationTimeRef.current < VIOLATION_DEDUPE_MS &&
      (lastViolationTypeRef.current === violationType ||
        (correlatedTypes.includes(lastViolationTypeRef.current) && correlatedTypes.includes(violationType)))
    ) {
      return
    }

    lastViolationTimeRef.current = now
    lastViolationTypeRef.current = violationType

    try {
      const res = await API.post(`/monthly-exams/${id}/log-violation`, {
        violation_type: violationType,
        time_remaining_seconds: timeRemainingRef.current,
        metadata: meta || {}
      })

      const data = res.data
      const newCount = data?.violations_count ?? (violationsCount + 1)
      setViolationsCount(newCount)

      if (data?.terminated) {
        isTerminatedRef.current = true
        setIsTerminated(true)
        setTerminationMessage(data?.message || 'تم إنهاء الامتحان تلقائياً وتجميد المحاولة لتجاوز الحد الأقصى للمخالفات.')
        showToast('تم حرمانك من الامتحان بسبب مخالفة قواعد المراقبة والأمان.', 'error')
        exitFullscreenSafe()
      } else {
        const allowed = data?.allowed_violations || allowedViolationsRef.current || 3
        showToast(`تنبيه أمان: تم تسجيل مخالفة مراقبة (${newCount}/${allowed}).`, 'warning')
      }
    } catch (err: any) {
      console.error('Failed to log violation:', err)
      if (err.response?.data?.terminated) {
        isTerminatedRef.current = true
        setIsTerminated(true)
        setTerminationMessage(err.response?.data?.message || 'تم إنهاء الامتحان بسبب مخالفات نظام المراقبة.')
      }
    }
  }, [id, showToast, violationsCount])

  // 5. Anti-Cheat: Visibility Change & Window Blur
  useEffect(() => {
    if (!exam?.enable_anti_tab_switching || isTerminated || loading) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch')
      }
    }

    const handleBlur = () => {
      // Avoid false positive blur when interacting with inputs
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        return
      }
      logViolation('window_blur')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [exam?.enable_anti_tab_switching, isTerminated, loading, logViolation])

  // 6. Anti-Cheat: Fullscreen Change Listener
  useEffect(() => {
    if (!exam?.enable_fullscreen || isTerminated || loading) return

    const handleFullscreenChange = () => {
      const doc = document as any
      const isCurrentlyFullscreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      )

      setIsFullscreen(isCurrentlyFullscreen)

      if (isCurrentlyFullscreen) {
        isFullscreenActiveRef.current = true
      } else {
        // Only trigger violation if student was previously in fullscreen mode
        if (isFullscreenActiveRef.current) {
          isFullscreenActiveRef.current = false
          logViolation('fullscreen_exit')
        }
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [exam?.enable_fullscreen, isTerminated, loading, logViolation])

  // 7. Anti-Cheat: Copy/Paste/Context Menu Protection
  useEffect(() => {
    if (!exam?.enable_copy_protection || isTerminated || loading) return

    const preventAction = (e: Event) => {
      e.preventDefault()
      logViolation('copy_paste_attempt')
    }

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    document.addEventListener('contextmenu', preventContextMenu)
    document.addEventListener('copy', preventAction)
    document.addEventListener('cut', preventAction)
    document.addEventListener('paste', preventAction)

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu)
      document.removeEventListener('copy', preventAction)
      document.removeEventListener('cut', preventAction)
      document.removeEventListener('paste', preventAction)
    }
  }, [exam?.enable_copy_protection, isTerminated, loading, logViolation])

  // 8. Prevent Accidental Page Close / Reload
  useEffect(() => {
    if (isTerminated || loading) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isTerminated, loading])

  // 9. Answer Selection with Instant Visual Feedback & Safe Auto-Advance
  const handleAnswerSelect = async (questionId: number, answerText: string) => {
    if (isTerminated || isSubmitting) return

    const previousAnswer = answers[questionId]

    // If already selected and not currently saving, advance to next question if available
    if (previousAnswer === answerText && savingQuestionId !== questionId) {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))
      }
      return
    }

    // 1. Optimistic UI update: instantly select and highlight answer on tap
    setAnswers((prev) => ({ ...prev, [questionId]: answerText }))
    setSavingQuestionId(questionId)

    try {
      // 2. Persist answer to backend draft asynchronously
      await API.post(`/monthly-exams/${id}/save-draft`, {
        question_id: questionId,
        answer_text: answerText,
      })

      // 3. Auto-advance logic:
      // Smoothly advance only upon successful save, only if not final question,
      // and only if student is still on this question
      setTimeout(() => {
        setCurrentQuestionIndex((prev) => {
          const currentQ = questions[prev]
          if (currentQ && currentQ.id === questionId && prev < questions.length - 1) {
            return prev + 1
          }
          return prev
        })
      }, 160)
    } catch (err: any) {
      console.error('Failed to save answer:', err)
      // 4. Safe rollback on save failure: revert to previous answer
      setAnswers((prev) => {
        const next = { ...prev }
        if (previousAnswer !== undefined) {
          next[questionId] = previousAnswer
        } else {
          delete next[questionId]
        }
        return next
      })

      const errorMsg = err.response?.data?.message || 'تعذر حفظ الإجابة في المسودة. يرجى إعادة المحاولة.'
      showToast(errorMsg, 'error')

      if (err.response?.data?.terminated) {
        isTerminatedRef.current = true
        setIsTerminated(true)
        setTerminationMessage(err.response?.data?.message || 'تم إنهاء الامتحان وتجميد المحاولة.')
      }
    } finally {
      setSavingQuestionId((current) => (current === questionId ? null : current))
    }
  }

  // 10. Save Essay Answer
  const handleSaveEssay = async (questionId: number, text: string) => {
    if (isTerminated || isSubmitting || savingQuestionId !== null) return

    setSavingQuestionId(questionId)
    try {
      await API.post(`/monthly-exams/${id}/save-draft`, {
        question_id: questionId,
        answer_text: text,
      })
      setAnswers((prev) => ({ ...prev, [questionId]: text }))
      showToast('تم حفظ الإجابة المقالية بنجاح.', 'success')

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))
      }
    } catch (err: any) {
      console.error('Failed to save essay answer:', err)
      showToast('تعذر حفظ الإجابة المقالية.', 'error')
      if (err.response?.data?.terminated) {
        isTerminatedRef.current = true
        setIsTerminated(true)
      }
    } finally {
      setSavingQuestionId(null)
    }
  }

  // 11. Exam Submission
  const handleSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      const res = await API.post(`/monthly-exams/${id}/submit`, {
        answers: answers,
      })

      showToast(res.data?.message || 'تم تسليم الامتحان بنجاح!', 'success')
      exitFullscreenSafe()
      navigate(`/monthly-exams/${id}/results`, { replace: true })
    } catch (err: any) {
      console.error('Failed to submit exam:', err)
      if (err.response?.data?.already_submitted || err.response?.data?.terminated) {
        navigate(`/monthly-exams/${id}/results`, { replace: true })
        return
      }
      const msg = err.response?.data?.message || err.message || 'تعذر تسليم الامتحان. يرجى المحاولة مرة أخرى.'
      showToast(msg, 'error')
    } finally {
      setIsSubmitting(false)
      setShowSubmitModal(false)
    }
  }

  // 12. Auto-Submit on Expiry
  const handleAutoSubmit = useCallback(async (reason: string) => {
    if (isSubmitting) return
    showToast('انتهى الوقت المحدد للامتحان. جاري التسليم التلقائي وحفظ الإجابات...', 'info')
    await handleSubmit()
  }, [answers, id, isSubmitting])

  // Format Time Helper (Always whole numbers MM:SS, never decimal floats)
  const formatTime = (secs: number | null | undefined) => {
    const totalSecs = Math.max(0, Math.floor(Number(secs) || 0))
    const mins = Math.floor(totalSecs / 60)
    const remSecs = totalSecs % 60
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="p-4 rounded-3xl bg-brand-primary/10 border border-brand-primary/20 inline-block">
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
          </div>
          <p className="text-sm font-black text-slate-200">جاري إعداد بيئة الامتحان والاتصال بالخادم...</p>
        </div>
      </div>
    )
  }

  if (isTerminated) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-brand-card border border-rose-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white">تم إنهاء الامتحان تلقائياً</h2>
          <p className="text-xs text-rose-300 leading-relaxed">
            {terminationMessage || 'لقد تم إنهاء محاولتك وتجميدها بسبب رصد مخالفات متكررة لنظام المراقبة والأمان (مثل مغادرة شاشة الامتحان أو محاولة النسخ).'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate(`/monthly-exams/${id}/results`, { replace: true })}
              className="w-full py-3 rounded-2xl bg-brand-primary hover:bg-brand-primary-hover text-white font-bold text-xs transition-colors shadow-lg shadow-brand-primary/20 cursor-pointer"
            >
              الانتقال لتقرير النتيجة
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const answeredCount = Object.keys(answers).length
  const totalQuestions = questions.length
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1
  const isFirstQuestion = currentQuestionIndex === 0
  const isUrgentTimer = timeRemainingSeconds !== null && timeRemainingSeconds < 300 // < 5 minutes

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col select-none font-sans" dir="rtl">
      <SEO title={`امتحان: ${exam?.title || 'الامتحان الشهري'}`} />

      {/* =========================================================================
          HEADER (Server-authoritative timer, progress, violations, submit)
          ========================================================================= */}
      <header className="bg-brand-card/90 border-b border-[var(--border-color)] backdrop-blur-md px-3.5 sm:px-8 py-3 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Exam Title & Live Progress */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black text-white truncate max-w-[150px] sm:max-w-xs md:max-w-sm">
                {exam?.title}
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
                <span className="font-bold text-brand-primary font-mono">{currentQuestionIndex + 1}</span>
                <span>من</span>
                <span className="font-bold text-slate-200 font-mono">{totalQuestions}</span>
                <span className="hidden sm:inline text-slate-600">•</span>
                <span className="hidden sm:inline">
                  تم حل <strong className="text-emerald-400 font-mono">{answeredCount}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Center: Server-Authoritative Timer */}
          {timeRemainingSeconds !== null && (
            <div
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl font-mono text-xs sm:text-sm font-black border transition-colors shrink-0 ${
                isUrgentTimer
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse shadow-lg shadow-rose-500/10'
                  : 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary'
              }`}
              title="الوقت المتبقي للامتحان وفق توقيت الخادم"
            >
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="tracking-wider">{formatTime(timeRemainingSeconds)}</span>
            </div>
          )}

          {/* Left Actions: Anti-cheat Violations & Finish Button */}
          <div className="flex items-center gap-2 shrink-0">
            {violationsCount > 0 && (
              <div className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] sm:text-xs font-bold">
                <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="hidden sm:inline">مخالفات:</span>
                <span className="font-mono">{violationsCount}/{exam?.allowed_violations || 3}</span>
              </div>
            )}

            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer shrink-0"
              title="تسليم وإنهاء الامتحان"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تسليم الامتحان</span>
              <span className="sm:hidden">تسليم</span>
            </button>
          </div>

        </div>
      </header>

      {/* =========================================================================
          MAIN QUESTION AREA
          ========================================================================= */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3.5 sm:p-6 md:p-8 flex flex-col justify-between">
        
        {currentQuestion ? (
          <div className="space-y-4 sm:space-y-6">
            
            {/* Question Card */}
            <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 text-right">
              
              {/* Question Meta Strip */}
              <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3.5">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-black">
                    السؤال رقم {currentQuestionIndex + 1}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {currentQuestion.type === 'mcq'
                      ? 'اختيار من متعدد'
                      : currentQuestion.type === 'true_false'
                      ? 'صح أم خطأ'
                      : 'سؤال مقالي'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-300 font-bold bg-slate-900/80 px-2.5 py-1 rounded-xl border border-[var(--border-color)]">
                  <span>الدرجة:</span>
                  <span className="text-brand-primary font-mono font-black">{currentQuestion.score}</span>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg md:text-xl font-bold text-slate-100 leading-relaxed select-text">
                {currentQuestion.text}
              </div>

              {/* MCQ Options List */}
              {currentQuestion.type === 'mcq' && currentQuestion.options && (
                <div className="grid grid-cols-1 gap-3 pt-2">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = answers[currentQuestion.id] === option
                    const isSavingThis = savingQuestionId === currentQuestion.id

                    return (
                      <button
                        key={idx}
                        disabled={isSubmitting || isTerminated}
                        onClick={() => handleAnswerSelect(currentQuestion.id, option)}
                        className={`w-full text-right p-4 sm:p-4.5 rounded-2xl border text-xs sm:text-sm font-bold transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-brand-primary/15 border-brand-primary text-white shadow-lg shadow-brand-primary/10 ring-1 ring-brand-primary/40'
                            : 'bg-slate-900/60 border-[var(--border-color)] hover:border-slate-600 text-slate-200 hover:bg-slate-900/90'
                        }`}
                      >
                        <span className="leading-normal">{option}</span>
                        
                        {/* Radio Check Indicator */}
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors relative ${
                            isSelected
                              ? 'border-brand-primary bg-brand-primary text-white'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {isSelected && !isSavingThis && <Check className="w-3 h-3 stroke-[3]" />}
                          {isSavingThis && isSelected && (
                            <Loader2 className="w-3 h-3 animate-spin text-white" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* True / False Options */}
              {currentQuestion.type === 'true_false' && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2">
                  {['صح', 'خطأ'].map((option) => {
                    const isSelected = answers[currentQuestion.id] === option
                    const isSavingThis = savingQuestionId === currentQuestion.id

                    return (
                      <button
                        key={option}
                        disabled={isSubmitting || isTerminated}
                        onClick={() => handleAnswerSelect(currentQuestion.id, option)}
                        className={`p-4 sm:p-5 rounded-2xl border text-sm sm:text-base font-black transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-brand-primary/20 border-brand-primary text-brand-primary ring-1 ring-brand-primary/40 shadow-lg shadow-brand-primary/10'
                            : 'bg-slate-900/60 border-[var(--border-color)] hover:border-slate-600 text-slate-200 hover:bg-slate-900'
                        }`}
                      >
                        {isSelected && !isSavingThis && <Check className="w-4 h-4" />}
                        {isSavingThis && isSelected && (
                          <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                        )}
                        <span>{option}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Essay Question Text Area */}
              {currentQuestion.type === 'essay' && (
                <div className="space-y-3 pt-2">
                  <textarea
                    rows={5}
                    placeholder="اكتب إجابتك النموذجية وشرحك هنا بالتفصيل..."
                    value={essayDraftText}
                    onChange={(e) => setEssayDraftText(e.target.value)}
                    onBlur={() => {
                      if (essayDraftText.trim() && essayDraftText !== answers[currentQuestion.id]) {
                        handleSaveEssay(currentQuestion.id, essayDraftText.trim())
                      }
                    }}
                    className="w-full bg-slate-950/80 border border-[var(--border-color)] rounded-2xl p-4 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-primary transition-colors leading-relaxed"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      سيتم حفظ إجابتك تلقائياً عند الانتقال للسؤال التالي.
                    </span>
                    <button
                      disabled={savingQuestionId !== null || !essayDraftText.trim()}
                      onClick={() => handleSaveEssay(currentQuestion.id, essayDraftText.trim())}
                      className="px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {savingQuestionId === currentQuestion.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>حفظ الإجابة</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Quick Question Navigation Strip */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>فهرس الأسئلة:</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-brand-primary inline-block" />
                    <span>الحالي</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span>تم حله</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
                    <span>متبقي</span>
                  </span>
                </div>
              </div>

              <div
                ref={navStripRef}
                className="flex items-center gap-2 overflow-x-auto py-2 px-1 scrollbar-none"
              >
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentQuestionIndex
                  const isAnswered = !!answers[q.id]
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`w-9 h-9 rounded-2xl font-mono text-xs shrink-0 transition-all border cursor-pointer ${
                        isCurrent
                          ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/30 scale-105 font-black ring-2 ring-brand-primary/50'
                          : isAnswered
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                          : 'bg-slate-900 border-[var(--border-color)] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                      title={`سؤال رقم ${idx + 1} (${isAnswered ? 'تمت الإجابة' : 'لم تتم الإجابة'})`}
                    >
                      {idx + 1}
                    </button>
                  )
                })}
              </div>
            </div>

          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">لا يوجد سؤال معروض.</div>
        )}

        {/* =========================================================================
            BOTTOM NAVIGATION
            ========================================================================= */}
        <div className="flex items-center justify-between gap-3 pt-5 border-t border-[var(--border-color)] mt-6">
          
          <button
            disabled={isFirstQuestion}
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 rounded-2xl bg-slate-900 border border-[var(--border-color)] hover:bg-slate-800 disabled:opacity-30 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
            <span>السابق</span>
          </button>

          {!isLastQuestion ? (
            <button
              onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
              className="flex items-center gap-1.5 sm:gap-2 px-5 sm:px-7 py-2.5 rounded-2xl bg-brand-primary hover:bg-brand-primary-hover text-white font-bold text-xs transition-colors shadow-lg shadow-brand-primary/20 cursor-pointer"
            >
              <span>التالي</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-5 sm:px-7 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>مراجعة وتسليم الامتحان</span>
            </button>
          )}

        </div>

      </main>

      {/* =========================================================================
          SUBMIT CONFIRMATION MODAL
          ========================================================================= */}
      <AnimatePresence>
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-right font-sans"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                <h3 className="text-base sm:text-lg font-black text-white">تأكيد تسليم الامتحان</h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 font-mono">
                  {answeredCount} / {totalQuestions} تم حلها
                </span>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <p>هل أنت متأكد من رغبتك في تسليم الامتحان الآن وإنهاء المحاولة؟</p>
                {answeredCount < totalQuestions && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span className="leading-relaxed">
                      تنبيه: لديك <strong className="font-mono font-bold text-amber-200">{totalQuestions - answeredCount}</strong> أسئلة متبقية لم تقم بالإجابة عليها بعد.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التسليم ورصد الدرجة...</span>
                    </>
                  ) : (
                    <span>تأكيد التسليم الآن</span>
                  )}
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => setShowSubmitModal(false)}
                  className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
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
