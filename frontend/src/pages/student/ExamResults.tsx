import React from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import API from '../../services/api'
import { Calendar, HelpCircle, CheckCircle2, Clock, AlertCircle, ChevronDown, Check, X, Award, Percent, BookOpen, Star, Sparkles, User, Play, Trophy } from 'lucide-react'
import EmptyState from '../../components/EmptyState'

interface AnswerItem {
  id: number
  answer_text: string
  is_correct: boolean
  question_id: number
  question: {
    id: number
    text: string
    type: 'mcq' | 'true_false' | 'essay'
    options: string[] | null
    correct_answer: string
    score: number
  }
}

interface AttemptItem {
  id: number
  score: number | null
  status: 'started' | 'submitted' | 'graded'
  teacher_feedback: string | null
  submitted_at: string
  created_at: string
  graded_at: string | null
  rank?: number | null
  total_participants?: number | null
  exam: {
    id: number
    title: string
    type: 'quiz' | 'homework' | 'monthly_exam'
    max_score: number
    time_limit_minutes?: number | null
    lesson: {
      unit: {
        course: {
          title: string
        }
      }
    }
  }
  answers: AnswerItem[]
}

const TYPE_TRANSLATION: Record<string, string> = {
  quiz: 'اختبار قصير',
  homework: 'واجب منزلي',
  monthly_exam: 'امتحان شهري',
}

interface ExamResultsProps {
  overrideExamId?: number
}

export default function ExamResults({ overrideExamId }: ExamResultsProps = {}) {
  const { id: routeId } = useParams()
  const id = overrideExamId ? overrideExamId.toString() : routeId
  const [attempts, setAttempts] = React.useState<AttemptItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedAttempt, setSelectedAttempt] = React.useState<AttemptItem | null>(null)

  React.useEffect(() => {
    API.get('/student/results')
      .then((res) => {
        setAttempts(res.data)
        if (res.data.length > 0) {
          if (id) {
            const specificAttempt = res.data.find((a: AttemptItem) => a.exam.id === Number(id))
            if (specificAttempt) {
              setSelectedAttempt(specificAttempt)
              return
            }
          }
          setSelectedAttempt(res.data[0])
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-primary"></div>
        <span className="text-xs text-slate-400 font-bold animate-pulse">جاري تحميل نتائجك...</span>
      </div>
    )
  }

  if (attempts.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <EmptyState
          type="exams"
          title="لا توجد نتائج اختبارات حالياً"
          description="لم تقم بتسليم أو حل أي اختبارات أو واجبات دراسية بالمنصة بعد."
        />
      </div>
    )
  }

  // Statistics calculation for selected attempt
  const isGraded = selectedAttempt?.status === 'graded'
  const maxScore = selectedAttempt?.exam.max_score || 100
  const score = selectedAttempt?.score || 0
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0

  // Calculate grade text
  let gradeText = 'ضعيف'
  let gradeColor = 'text-rose-500 bg-rose-500/10 border-rose-500/20'
  let badgeLabel = 'مستمر في المحاولة ✊'
  let badgeIcon = '🥉'

  if (percent >= 90) {
    gradeText = 'ممتاز'
    gradeColor = 'text-brand-success bg-emerald-500/10 border-emerald-500/20'
    badgeLabel = 'البطل الذهبي 🏆'
    badgeIcon = '🥇'
  } else if (percent >= 80) {
    gradeText = 'جيد جداً'
    gradeColor = 'text-brand-primary bg-brand-primary/10 border-brand-primary/20'
    badgeLabel = 'الفارس الفضي 🥈'
    badgeIcon = '🥈'
  } else if (percent >= 65) {
    gradeText = 'جيد'
    gradeColor = 'text-brand-primary bg-brand-primary/5 border-brand-primary/10'
    badgeLabel = 'المكافح البرونزي 🥉'
    badgeIcon = '🥉'
  } else if (percent >= 50) {
    gradeText = 'مقبول'
    gradeColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20'
    badgeLabel = 'ناجح ومتفوق 💫'
    badgeIcon = '✨'
  }

  // Pass/Fail calculations
  const passed = percent >= 50
  const statusText = passed ? 'ناجح 🎉' : 'راسب ⚠️'

  // MCQ counts
  const correctCount = selectedAttempt?.answers.filter(a => a.is_correct).length || 0
  const wrongCount = selectedAttempt?.answers.filter(a => !a.is_correct && a.question.type !== 'essay').length || 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 text-right" dir="rtl">
      
      {/* Title */}
      <div className="border-b border-border-color pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-100 flex items-center gap-2">
            <span>نتائج وتقييمات اختباراتي</span>
          </h1>
          <p className="text-sm text-slate-400 font-light mt-1">تتبع درجاتك في الكويزات، والواجبات المنزلية، والامتحانات الشهرية</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Selected Attempt Details (70%) */}
        <div className="lg:col-span-8 space-y-8">
          <AnimatePresence mode="wait">
            {selectedAttempt && (
              <motion.div
                key={selectedAttempt.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-8"
              >
                {/* Top Score Card */}
                <div className="bg-brand-card border border-border-color p-8 rounded-[32px] relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
                  
                  {/* Glow Effects */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>
                  
                  {/* Left: Score Text & Title */}
                  <div className="space-y-4 text-center md:text-right relative z-10 flex-1">
                    <div className="space-y-2">
                      <span className="text-xs font-black text-brand-primary uppercase tracking-wider block">
                        {selectedAttempt.exam.lesson.unit.course.title}
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-100">{selectedAttempt.exam.title}</h2>
                      <span className="px-3.5 py-1.5 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-full text-[10px] font-black inline-block mt-2">
                        {TYPE_TRANSLATION[selectedAttempt.exam.type] || selectedAttempt.exam.type}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs pt-1">
                      <span className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Calendar className="h-4.5 w-4.5 text-slate-400" />
                        <span>تاريخ التسليم: {new Date(selectedAttempt.submitted_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </span>
                    </div>

                    {/* Teacher Feedback banner */}
                    {selectedAttempt.teacher_feedback && (
                      <div className="p-5 bg-brand-surface border border-border-color rounded-2xl max-w-xl shadow-sm mt-4 text-right">
                        <span className="text-xs font-black text-brand-primary block mb-1.5">ملاحظة وتوجيه مصحح المادة:</span>
                        <p className="text-xs text-slate-300 font-semibold leading-relaxed">{selectedAttempt.teacher_feedback}</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Highly Prominent Score Card / Widget */}
                  <div className="flex flex-col items-center shrink-0 relative z-10 bg-brand-surface/95 border border-border-color p-8 rounded-[24px] w-full md:w-64 shadow-lg">
                    
                    {isGraded ? (
                      <div className="w-full text-center flex flex-col items-center">
                        <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block mb-1">النتيجة النهائية</span>
                        
                        {/* Huge percentage */}
                        <motion.div 
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 120 }}
                          className={`text-6xl font-black tracking-tight drop-shadow-sm ${passed ? 'text-brand-success' : 'text-rose-500'}`}
                        >
                          {percent.toFixed(0)}%
                        </motion.div>
                        
                        {/* Score Fraction */}
                        <div className="text-xs font-black text-slate-300 mt-3 px-3.5 py-1.5 bg-brand-card border border-border-color rounded-full">
                          حصلت على {score} من {maxScore} درجة
                        </div>

                        {/* Large Success/Fail Badge */}
                        <div className={`px-6 py-2.5 rounded-xl text-xs font-black border w-full text-center mt-5 shadow-sm ${
                          passed 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                        }`}>
                          حالة التقييم: {statusText}
                        </div>

                        {/* Performance Medal Badge */}
                        <div className="text-xs font-black text-slate-200 flex items-center justify-center gap-2 bg-brand-card border border-border-color px-4 py-2.5 rounded-xl shadow-sm mt-3 w-full">
                          <span className="text-base leading-none">{badgeIcon}</span>
                          <span>{badgeLabel}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Clock className="h-10 w-10 text-amber-500 animate-pulse mx-auto mb-3" />
                        <div className="text-sm font-bold text-amber-500 animate-pulse">الاختبار قيد التصحيح حالياً</div>
                        <p className="text-[10px] text-slate-400 font-light mt-1 max-w-[180px] leading-relaxed">يرجى الانتظار حتى يقوم المدرس بمراجعة إجاباتك المقالية ورصد درجتك.</p>
                      </div>
                    )}
                    
                  </div>

                </div>

                {/* Middle: Statistics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  
                  {/* Stat 1: Percent */}
                  <div className="bg-brand-card border border-border-color p-5 rounded-2xl text-center space-y-1.5 hover:border-brand-primary/20 transition-all shadow-sm">
                    <span className="text-[10px] text-slate-400 font-bold block">النسبة المئوية</span>
                    <div className="text-3xl font-black text-brand-primary">{isGraded ? `${percent.toFixed(0)}%` : '-'}</div>
                  </div>

                  {/* Stat 2: Corrects */}
                  <div className="bg-brand-card border border-border-color p-5 rounded-2xl text-center space-y-1.5 hover:border-brand-primary/20 transition-all shadow-sm">
                    <span className="text-[10px] text-slate-400 font-bold block">إجابات صحيحة</span>
                    <div className="text-2xl font-black text-brand-success">{correctCount}</div>
                  </div>

                  {/* Stat 3: Wrongs */}
                  <div className="bg-brand-card border border-border-color p-5 rounded-2xl text-center space-y-1.5 hover:border-brand-primary/20 transition-all shadow-sm">
                    <span className="text-[10px] text-slate-400 font-bold block">إجابات خاطئة</span>
                    <div className="text-2xl font-black text-rose-500">{wrongCount}</div>
                  </div>

                  {/* Stat 4: Time Spent */}
                  <div className="bg-brand-card border border-border-color p-5 rounded-2xl text-center space-y-1.5 hover:border-brand-primary/20 transition-all shadow-sm">
                    <span className="text-[10px] text-slate-400 font-bold block">الوقت المستغرق</span>
                    <div className="text-sm font-black text-slate-200 pt-1">
                      {(() => {
                        if (!selectedAttempt?.created_at || !selectedAttempt?.submitted_at) return 'غير متوفر'
                        const start = new Date(selectedAttempt.created_at).getTime()
                        const end = new Date(selectedAttempt.submitted_at).getTime()
                        const diffSecs = Math.max(0, Math.floor((end - start) / 1000))
                        const mins = Math.floor(diffSecs / 60)
                        const secs = diffSecs % 60
                        
                        return (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black shadow-sm justify-center">
                            <span>⏱️</span>
                            <span>
                              {mins > 0 ? `${mins} دقيقة ${secs} ثانية` : `${secs} ثانية`}
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Stat 5: Rank */}
                  <div className="bg-brand-card border border-border-color p-5 rounded-2xl text-center space-y-1.5 hover:border-brand-primary/20 transition-all shadow-sm">
                    <span className="text-[10px] text-slate-400 font-bold block">الترتيب بالمنصة</span>
                    <div className="text-sm font-black text-amber-500 pt-1">
                      {selectedAttempt.rank ? `#${selectedAttempt.rank} من ${selectedAttempt.total_participants}` : 'قيد التدقيق'}
                    </div>
                  </div>

                  {/* Stat 6: Pass/Fail Status */}
                  <div className="bg-brand-card border border-border-color p-5 rounded-2xl text-center space-y-1.5 hover:border-brand-primary/20 transition-all shadow-sm">
                    <span className="text-[10px] text-slate-400 font-bold block">النتيجة</span>
                    <div className={`text-base font-black pt-1 ${passed ? 'text-brand-success' : 'text-rose-500'}`}>
                      {statusText}
                    </div>
                  </div>

                </div>

                {/* Bottom: Question Review Section */}
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-200 flex items-center gap-1.5">
                    <BookOpen className="h-4.5 w-4.5 text-brand-primary" />
                    <span>مراجعة ورقة الإجابات النموذجية:</span>
                  </h3>

                  <div className="space-y-4">
                    {selectedAttempt.answers && selectedAttempt.answers.length > 0 ? (
                      selectedAttempt.answers.map((ans, aIdx) => {
                        const isMcqOrTf = ans.question.type !== 'essay'
                        return (
                          <motion.div 
                            whileHover={{ y: -2, borderRightColor: "var(--primary-color)" }}
                            key={ans.id} 
                            className="bg-brand-card border border-border-color p-6 rounded-2xl space-y-4 relative hover:shadow-lg transition-all border-r-4 border-r-transparent"
                          >
                            
                            {/* Top indicator row */}
                            <div className="flex justify-between items-start gap-4">
                              <div className="font-bold text-xs sm:text-sm text-slate-200">
                                <span className="text-brand-primary font-black">السؤال {aIdx + 1}: </span>
                                <span className="font-semibold leading-relaxed block mt-1">{ans.question.text}</span>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black shrink-0 border ${
                                ans.is_correct 
                                  ? 'bg-emerald-500/10 text-brand-success border-emerald-500/20' 
                                  : isMcqOrTf 
                                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                                    : 'bg-slate-500/10 text-slate-455 border-slate-500/20'
                              }`}>
                                {ans.is_correct ? 'إجابة صحيحة' : isMcqOrTf ? 'إجابة خاطئة' : 'بانتظار تقييم المعلم'}
                              </span>
                            </div>

                            {/* Student answer choices */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-4 mt-2 border-t border-border-color/40">
                              
                              {/* Selected Student Answer */}
                              <div className="space-y-1">
                                <span className="text-slate-400 text-[10px] block">إجابتك المختارة:</span>
                                <div className={`font-bold flex items-center gap-1.5 ${
                                  ans.is_correct ? 'text-brand-success' : isMcqOrTf ? 'text-rose-500' : 'text-slate-200'
                                }`}>
                                  {ans.is_correct ? (
                                    <Check className="h-4.5 w-4.5 shrink-0" />
                                  ) : isMcqOrTf ? (
                                    <X className="h-4.5 w-4.5 shrink-0" />
                                  ) : null}
                                  <span>{ans.answer_text || '(لم تجب)'}</span>
                                </div>
                              </div>

                              {/* Standard Model Answer */}
                              {isMcqOrTf && !ans.is_correct && (
                                <div className="space-y-1">
                                  <span className="text-slate-400 text-[10px] block">الإجابة الصحيحة النموذجية:</span>
                                  <div className="font-bold text-brand-success flex items-center gap-1.5">
                                    <Check className="h-4.5 w-4.5 shrink-0" />
                                    <span>{ans.question.correct_answer}</span>
                                  </div>
                                </div>
                              )}

                            </div>

                          </motion.div>
                        )
                      })
                    ) : (
                      <div className="text-center py-8 bg-brand-card border border-border-color rounded-2xl text-xs text-slate-400 font-light">
                        لم يتم تسجيل حلول تفصيلية لهذه المحاولة بعد.
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Scrollable Attempts Sidebar (30%) */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-24">
          <h3 className="text-sm font-black text-slate-200 flex items-center gap-1.5">
            <Award className="h-4.5 w-4.5 text-brand-primary" />
            <span>قائمة تسليماتي الأخيرة:</span>
          </h3>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {attempts.map((attempt) => {
              const active = selectedAttempt?.id === attempt.id
              const graded = attempt.status === 'graded'
              return (
                <button
                  type="button"
                  key={attempt.id}
                  onClick={() => setSelectedAttempt(attempt)}
                  className={`w-full text-right p-4 rounded-2xl border transition-all cursor-pointer block space-y-2 relative overflow-hidden ${
                    active 
                      ? 'bg-brand-primary/10 border-brand-primary text-slate-100 shadow-lg shadow-brand-primary/5' 
                      : 'bg-brand-card border-border-color text-slate-350 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[9px] text-slate-400 font-bold max-w-[150px] truncate">{attempt.exam.lesson.unit.course.title}</span>
                    <span className={`px-2.5 py-0.5 rounded text-[8px] font-black ${
                      graded ? 'bg-emerald-500/15 text-brand-success border border-emerald-500/20' : 'bg-amber-500/15 text-amber-500 border border-amber-500/20'
                    }`}>
                      {graded ? 'صحح' : 'قيد التدقيق'}
                    </span>
                  </div>

                  <h4 className="font-bold text-xs sm:text-sm line-clamp-1">{attempt.exam.title}</h4>

                  <div className="flex justify-between items-center text-[10px] text-slate-550 pt-2.5 border-t border-border-color/50">
                    <span>{new Date(attempt.submitted_at).toLocaleDateString('ar-EG')}</span>
                    {graded ? (
                      <span className="font-black text-brand-primary bg-background/55 px-2 py-0.5 rounded border border-border-color">{attempt.score} / {attempt.exam.max_score}</span>
                    ) : (
                      <span>في المراجعة</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

      </div>

    </div>
  )
}
