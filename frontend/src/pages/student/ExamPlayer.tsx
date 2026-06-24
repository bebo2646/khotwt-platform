import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  AlertCircle, 
  X,
  Sparkles
} from 'lucide-react'
import { ExamSkeleton } from '../../components/ui/Skeleton'

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
  type: 'quiz' | 'homework' | 'monthly_exam'
  time_limit_minutes: number | null
  max_score: number
  allowed_violations?: number
  auto_submit_on_violation?: boolean
  enable_fullscreen?: boolean
  enable_anti_tab_switching?: boolean
  enable_copy_protection?: boolean
}

export default function ExamPlayer() {
  const { id } = useParams()
  const navigate = useNavigate()

  // States
  const [exam, setExam] = React.useState<ExamInfo | null>(null)
  const [questions, setQuestions] = React.useState<QuestionItem[]>([])
  const [attemptId, setAttemptId] = React.useState<number | null>(null)
  
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [isStarted, setIsStarted] = React.useState(false)
  const [violationCount, setViolationCount] = React.useState(0)
  
  // Current active question index
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0)
  
  // Answers state (key: question_id, value: answer_text)
  const [answers, setAnswers] = React.useState<Record<number, string>>({})
  
  // Timer state (seconds)
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null)

  React.useEffect(() => {
    API.get(`/exams/${id}`)
      .then((res) => {
        setExam(res.data.exam)
        setQuestions(res.data.questions)
        setAttemptId(res.data.attempt_id)
        
        // Initialize timer if set
        if (res.data.exam.time_limit_minutes) {
          setTimeLeft(res.data.exam.time_limit_minutes * 60)
        }
      })
      .catch((err) => {
        console.error(err)
        useModalStore.getState().showToast('فشل تحميل بيانات الامتحان. ربما لست مشتركاً بالكورس أو انتهت الصلاحية.', 'error')
        navigate(-1)
      })
      .finally(() => setLoading(false))
  }, [id])

  // Count down timer ticks
  React.useEffect(() => {
    if (!isStarted || timeLeft === null) return
    if (timeLeft <= 0) {
      handleAutoSubmit()
      return
    }

    const interval = setTimeout(() => {
      setTimeLeft(timeLeft - 1)
    }, 1000)

    return () => clearTimeout(interval)
  }, [timeLeft, isStarted])

  // Anti-cheating monitoring listeners
  React.useEffect(() => {
    if (!isStarted || !exam) return

    const handleVisibilityChange = () => {
      if (document.hidden && exam.enable_anti_tab_switching) {
        registerViolation('tab_switch')
      }
    }

    const handleBlur = () => {
      if (exam.enable_anti_tab_switching) {
        registerViolation('window_blur')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [isStarted, exam])

  // Fullscreen change listener
  React.useEffect(() => {
    if (!isStarted || !exam?.enable_fullscreen) return

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        registerViolation('fullscreen_exit')
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [isStarted, exam])

  // Copy protection selection and contextmenu
  React.useEffect(() => {
    if (!isStarted || !exam?.enable_copy_protection) return

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      registerViolation('copy_attempt')
    }

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault()
      registerViolation('paste_attempt')
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      registerViolation('right_click_attempt')
    }

    const handleSelectStart = (e: Event) => {
      e.preventDefault()
    }

    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('selectstart', handleSelectStart)

    return () => {
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('selectstart', handleSelectStart)
    }
  }, [isStarted, exam])

  const startExam = async () => {
    setIsStarted(true)
    if (exam?.enable_fullscreen) {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen()
        }
      } catch (err) {
        console.error('Failed to enter fullscreen:', err)
      }
    }
  }

  const registerViolation = async (type: string) => {
    if (!exam || !attemptId) return

    try {
      const res = await API.post(`/exams/${exam.id}/log-violation`, {
        attempt_id: attemptId,
        violation_type: type
      })

      const newCount = res.data.violation_count
      setViolationCount(newCount)

      const allowed = exam.allowed_violations ?? 3
      const remaining = allowed - newCount

      if (res.data.status === 'submitted') {
        useModalStore.getState().showAlert({
          title: 'تم إنهاء الامتحان تلقائياً',
          description: 'تم تسليم الامتحان لتجاوز الحد الأقصى للمخالفات المسموح بها.',
          type: 'error',
          buttonText: 'الذهاب لصفحة النتائج',
          onConfirm: () => {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {})
            }
            navigate(`/student/exams/${exam.id}/result`)
          }
        })
      } else if (remaining === 1) {
        useModalStore.getState().showAlert({
          title: 'تحذير أخير ⚠️',
          description: 'تحذير أخير. أي محاولة أخرى لمغادرة شاشة الامتحان ستؤدي إلى إنهاء الاختبار وتثبيت درجاتك الحالية!',
          type: 'warning',
          buttonText: 'فهمت وموافق'
        })
      } else if (remaining > 0) {
        useModalStore.getState().showToast(
          `تم اكتشاف مغادرة شاشة الامتحان أو مخالفة شروط الاختبار. متبقي ${remaining} محاولة فقط.`,
          'warning'
        )
      }
    } catch (err) {
      console.error('Failed to log violation:', err)
    }
  }

  const handleOptionSelect = (questionId: number, optionVal: string) => {
    setAnswers((prev) => {
      const currentVal = prev[questionId]
      if (currentVal === optionVal) {
        const next = { ...prev }
        delete next[questionId]
        return next
      } else {
        return {
          ...prev,
          [questionId]: optionVal
        }
      }
    })
  }

  const handleEssayChange = (questionId: number, textVal: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: textVal,
    }))
  }

  const handleAutoSubmit = () => {
    useModalStore.getState().showAlert({
      title: 'انتهى الوقت المحدد للاختبار',
      description: 'انتهى الوقت المحدد للاختبار! سيتم تسليم إجاباتك الحالية تلقائياً.',
      type: 'warning',
      buttonText: 'موافق',
      onConfirm: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        }
        submitExamAnswers()
      }
    })
  }

  const submitExamAnswers = async () => {
    if (!attemptId) return
    
    setSubmitting(true)
    try {
      await API.post(`/exams/${exam?.id}/submit`, {
        attempt_id: attemptId,
        answers: answers,
      })
      
      useModalStore.getState().showToast('تم تسليم إجاباتك بنجاح!', 'success')
      navigate(`/student/exams/${exam?.id}/result`)
    } catch (err: any) {
      console.error(err)
      const errorMsg = err.response?.data?.message || 'حدث خطأ أثناء إرسال الإجابات. يرجى المحاولة مجدداً.'
      useModalStore.getState().showToast(errorMsg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleManualSubmit = () => {
    const totalQuestions = questions.length
    const answeredCount = questions.filter(q => isAnswered(q.id)).length
    const remaining = totalQuestions - answeredCount
    
    const confirmMsg = `الأسئلة المجابة: ${answeredCount} / ${totalQuestions}\nالأسئلة المتبقية: ${remaining}\n\nهل أنت متأكد من تسليم الإجابات وإنهاء الاختبار؟`
    
    useModalStore.getState().showConfirm({
      title: 'إنهاء وتسليم الامتحان',
      description: confirmMsg,
      confirmText: 'نعم، تسليم الامتحان',
      cancelText: 'تراجع ومتابعة الحل',
      type: 'question',
      onConfirm: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        }
        submitExamAnswers()
      }
    })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handleExit = () => {
    useModalStore.getState().showConfirm({
      title: 'تأكيد الخروج من الامتحان',
      description: 'سيتم حفظ تقدمك الحالي تلقائياً، لكن المؤقت سيستمر في العد التنازلي.',
      confirmText: 'خروج من الامتحان',
      cancelText: 'متابعة الامتحان',
      type: 'warning',
      onConfirm: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        }
        navigate(-1)
      }
    })
  }

  if (loading) {
    return <ExamSkeleton />
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 text-center">
        <h2 className="text-xl font-bold text-slate-200">عذراً، لم نعثر على معلومات الامتحان المطلوب أو لا توجد أسئلة مضافة.</h2>
        <button onClick={() => navigate(-1)} className="mt-4 px-6 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl cursor-pointer">
          العودة للخلف
        </button>
      </div>
    )
  }

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-right font-sans" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-brand-card border border-border-color rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl"></div>
          
          <div className="space-y-4">
            <h1 className="text-2xl font-black text-foreground flex items-center gap-3">
              <span className="p-3 bg-brand-primary/10 text-brand-primary rounded-2xl border border-brand-primary/20 shrink-0">
                <AlertCircle className="h-6 w-6" />
              </span>
              <span>تعليمات الامتحان: {exam.title}</span>
            </h1>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              يرجى قراءة التعليمات التالية والالتزام بها لتفادي استبعاد إجاباتك أو إلغاء الامتحان تلقائياً:
            </p>
          </div>

          <div className="bg-background/50 border border-border-color rounded-2xl p-6 space-y-3 text-xs text-slate-350 font-semibold leading-relaxed">
            <ul className="space-y-3.5 list-disc list-inside">
              <li>يمنع فتح أي تبويب آخر أثناء الامتحان.</li>
              <li>يمنع تصغير المتصفح أثناء الامتحان.</li>
              <li>يمنع الانتقال إلى نافذة أخرى.</li>
              <li>يمنع نسخ أو لصق المحتوى.</li>
              <li>سيتم تسجيل أي محاولة غش من خلال أنظمة المراقبة الذكية.</li>
              <li>عند تجاوز الحد المسموح من المخالفات سيتم إنهاء الامتحان تلقائياً وحفظ تقدمك الحالي كإجابة نهائية.</li>
            </ul>
          </div>

          <div className="flex gap-4 items-center justify-end pt-4">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-brand-surface hover:bg-background border border-border-color text-slate-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
            >
              العودة للخلف
            </button>
            <button
              onClick={startExam}
              className="px-8 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-brand-primary/15 cursor-pointer"
            >
              أوافق على الشروط وأبدأ الامتحان
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const isAnswered = (qId: number) => answers[qId] !== undefined && answers[qId]?.trim() !== ''
  const answeredQuestionsCount = questions.filter(q => isAnswered(q.id)).length
  const progressPercent = questions.length > 0 ? Math.round((answeredQuestionsCount / questions.length) * 100) : 0

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between select-none" dir="rtl">
      
      {/* 1. Header Section */}
      <header className="bg-brand-surface border-b border-border-color px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleExit}
            className="p-2.5 bg-brand-card hover:bg-background border border-border-color text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
            title="خروج من الامتحان"
          >
            <X className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-base font-black text-slate-100 line-clamp-1">{exam.title}</h1>
            <span className="text-[10px] text-brand-primary font-bold">
              {exam.type === 'quiz' ? 'إختبار قصير' : exam.type === 'homework' ? 'واجب منزلي' : 'امتحان شهري'}
            </span>
          </div>
        </div>

        {/* Timer */}
        {timeLeft !== null && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 font-bold text-sm shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <Clock className="h-4 w-4 animate-pulse" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}
      </header>

      {/* 2. Main Body with Navigation Sidebar */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* Left: Current Question Content */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Progress bar */}
          <div className="bg-brand-card border border-border-color p-4 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
              <span>الأسئلة المجابة: {answeredQuestionsCount} من {questions.length}</span>
              <span>{progressPercent}% مكتمل</span>
            </div>
            <div className="w-full bg-background rounded-full h-2 overflow-hidden border border-border-color">
              <motion.div 
                className="bg-brand-primary h-full rounded-full" 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Question Box with AnimatePresence transition */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="bg-brand-card border border-border-color p-6 sm:p-8 rounded-3xl space-y-6 min-h-[300px] flex flex-col justify-between shadow-2xl"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <span className="px-3.5 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-bold rounded-lg shrink-0">
                    درجة السؤال: {currentQuestion.score}
                  </span>
                  <span className="text-xs text-slate-400 font-light">
                    {currentQuestion.type === 'mcq' ? 'اختر إجابة واحدة' : currentQuestion.type === 'true_false' ? 'صح أم خطأ' : 'اكتب إجابة مقالية'}
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-100 leading-relaxed pt-2">
                  {currentQuestion.text}
                </h2>
              </div>

              {/* Answer Options */}
              <div className="pt-6">
                {/* MCQ Options */}
                {currentQuestion.type === 'mcq' && currentQuestion.options && (
                  <div className="grid grid-cols-1 gap-3">
                    {currentQuestion.options.map((opt, oIdx) => {
                      const isSelected = answers[currentQuestion.id] === opt
                      return (
                        <motion.button
                          type="button"
                          key={oIdx}
                          onClick={() => handleOptionSelect(currentQuestion.id, opt)}
                          whileTap={{ scale: 0.99 }}
                          className={`w-full p-4 border rounded-2xl text-right text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'border-brand-primary bg-brand-primary/10 text-slate-100 shadow-lg shadow-brand-primary/5'
                              : 'border-border-color bg-background/50 text-slate-350 hover:border-slate-400 hover:bg-background'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`h-5.5 w-5.5 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-black ${
                              isSelected ? 'border-brand-primary bg-brand-primary text-slate-950' : 'border-border-color text-slate-500'
                            }`}>
                              {['أ', 'ب', 'ج', 'د'][oIdx] || oIdx + 1}
                            </span>
                            <span>{opt}</span>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                )}

                {/* True/False Choices */}
                {currentQuestion.type === 'true_false' && (
                  <div className="flex gap-4">
                    {['صح', 'خطأ'].map((opt, oIdx) => {
                      const isSelected = answers[currentQuestion.id] === opt
                      return (
                        <motion.button
                          type="button"
                          key={oIdx}
                          onClick={() => handleOptionSelect(currentQuestion.id, opt)}
                          whileTap={{ scale: 0.98 }}
                          className={`flex-1 py-4 border rounded-2xl text-center text-sm font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'border-brand-primary bg-brand-primary/10 text-slate-100 shadow-lg'
                              : 'border-border-color bg-background/50 text-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {opt}
                        </motion.button>
                      )
                    })}
                  </div>
                )}

                {/* Essay Textarea */}
                {currentQuestion.type === 'essay' && (
                  <div>
                    <textarea
                      rows={6}
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleEssayChange(currentQuestion.id, e.target.value)}
                      placeholder="اكتب إجابتك النموذجية بالتفصيل هنا..."
                      className="w-full bg-background/50 border border-border-color rounded-2xl p-4 text-sm focus:outline-none focus:border-brand-primary text-slate-150 leading-relaxed text-right"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: Question Navigation Matrix Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-24">
          <div className="bg-brand-card border border-border-color p-6 rounded-3xl space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-slate-200">خارطة التنقل بالامتحان</h3>
            
            {/* Grid numbers */}
            <div className="grid grid-cols-5 gap-2.5 pt-2">
              {questions.map((q, idx) => {
                const active = idx === currentQuestionIndex
                const answered = isAnswered(q.id)
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-9.5 w-9.5 rounded-xl text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500 ring-offset-4 ring-offset-[var(--card-bg)] shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                        : answered
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold'
                        : 'bg-background/60 border border-slate-700 text-slate-500 hover:border-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-border-color space-y-2 text-[10px] text-slate-400 font-light">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 bg-blue-600 rounded-full"></span>
                <span>السؤال الحالي</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full"></span>
                <span>تمت الإجابة عليه</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 bg-background border border-slate-700 rounded-full"></span>
                <span>غير محلول</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* 3. Action Footer Buttons */}
      <footer className="bg-brand-surface border-t border-border-color px-6 py-4 flex items-center justify-between sticky bottom-0 z-50">
        <div className="flex gap-3">
          <button
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2.5 bg-brand-card hover:bg-background border border-border-color text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
            <span>السابق</span>
          </button>
          
          <button
            onClick={handleNext}
            disabled={currentQuestionIndex === questions.length - 1}
            className="px-4 py-2.5 bg-brand-card hover:bg-background border border-border-color text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
          >
            <span>التالي</span>
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={handleManualSubmit}
          disabled={submitting}
          className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-lg shadow-brand-primary/20 cursor-pointer disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>جاري التسليم...</span>
            </>
          ) : (
            <span>إنهاء وتسليم الامتحان</span>
          )}
        </button>
      </footer>

    </div>
  )
}
