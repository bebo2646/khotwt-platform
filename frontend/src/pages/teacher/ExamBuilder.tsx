import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import {
  Save,
  ArrowRight,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Settings,
  HelpCircle,
  FileText,
  Upload,
  Loader2,
  Sparkles,
  Layers
} from 'lucide-react'

interface Question {
  id?: number
  text: string
  type: 'mcq' | 'true_false' | 'essay'
  options: string[]
  correct_answer: string
  score: number
}

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
}

export default function ExamBuilder() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  // Courses & Lessons lists
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [lessons, setLessons] = React.useState<LessonItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Form Fields
  const [title, setTitle] = React.useState('')
  const [type, setType] = React.useState<'quiz' | 'homework' | 'monthly_exam'>('quiz')
  const [timeLimit, setTimeLimit] = React.useState('')
  const [maxScore, setMaxScore] = React.useState('20')
  const [courseId, setCourseId] = React.useState('')
  const [lessonId, setLessonId] = React.useState('')
  const [isPaid, setIsPaid] = React.useState(false)
  const [price, setPrice] = React.useState('50')

  // Date/Time settings
  const [startDate, setStartDate] = React.useState('')
  const [startTime, setStartTime] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [endTime, setEndTime] = React.useState('')
  const [maxAttempts, setMaxAttempts] = React.useState('1')
  const [passingScore, setPassingScore] = React.useState('50')

  // Homework specific settings
  const [openDate, setOpenDate] = React.useState('')
  const [closeDate, setCloseDate] = React.useState('')
  const [submissionDeadline, setSubmissionDeadline] = React.useState('')
  const [homeworkType, setHomeworkType] = React.useState<'normal' | 'bubble_sheet'>('normal')
  const [enableSchedule, setEnableSchedule] = React.useState(false)
  const [openTime, setOpenTime] = React.useState('00:00')
  const [closeTime, setCloseTime] = React.useState('23:59')

  // Questions State
  const [questions, setQuestions] = React.useState<Question[]>([
    { text: 'السؤال الأول؟', type: 'mcq', options: ['خيار أ', 'خيار ب', 'خيار ج', 'خيار د'], correct_answer: 'خيار أ', score: 1 }
  ])
  const [activeQuestionIdx, setActiveQuestionIdx] = React.useState(0)

  // Bulk Question Creator State
  const [showBulkCreator, setShowBulkCreator] = React.useState(false)
  const [bulkText, setBulkText] = React.useState('')

  // Word Document Import State
  const [importingWord, setImportingWord] = React.useState(false)

  // Active workspace tab (editor vs settings vs bulk)
  const [activeTab, setActiveTab] = React.useState<'editor' | 'settings' | 'bulk'>('editor')

  // Fetch courses and lessons
  const fetchCoursesAndLessons = async () => {
    try {
      const coursesRes = await API.get('/teacher/courses')
      setCourses(coursesRes.data)
      return coursesRes.data
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل الكورسات.', 'error')
      return []
    }
  }

  // Load lesson options based on selected course
  const handleCourseChange = async (cId: string) => {
    setCourseId(cId)
    setLessonId('')
    if (!cId) {
      setLessons([])
      return
    }

    try {
      const res = await API.get(`/courses/${cId}`)
      const lessonsList: LessonItem[] = res.data.units.flatMap((u: any) =>
        u.lessons.map((l: any) => ({
          id: l.id,
          title: l.title,
          unit: { course_id: Number(cId) }
        }))
      )
      setLessons(lessonsList)
    } catch (err) {
      console.error(err)
    }
  }

  // Load exam details for Edit mode
  const fetchExamDetails = async (examId: string, currentCourses: CourseItem[]) => {
    try {
      const res = await API.get(`/teacher/exams/${examId}`)
      const exam = res.data
      
      setTitle(exam.title)
      setType(exam.type)
      setTimeLimit(exam.time_limit_minutes ? exam.time_limit_minutes.toString() : '')
      setMaxScore(exam.max_score.toString())
      setIsPaid(!!exam.is_paid)
      setPrice(exam.price ? exam.price.toString() : '50')
      
      setStartDate(exam.start_date || '')
      setStartTime(exam.start_time || '')
      setEndDate(exam.end_date || '')
      setEndTime(exam.end_time || '')
      setMaxAttempts(exam.max_attempts ? exam.max_attempts.toString() : '1')
      setPassingScore(exam.passing_score ? exam.passing_score.toString() : '50')
      
      setOpenDate(exam.open_date || '')
      setCloseDate(exam.close_date || '')
      setSubmissionDeadline(exam.submission_deadline || '')
      setHomeworkType(exam.homework_type || 'normal')
      setEnableSchedule(!!exam.enable_schedule)
      setOpenTime(exam.open_time || '00:00')
      setCloseTime(exam.close_time || '23:59')

      if (exam.lesson) {
        setLessonId(exam.lesson.id.toString())
        const courseIdVal = exam.lesson.unit?.course_id?.toString()
        if (courseIdVal) {
          setCourseId(courseIdVal)
          // Load lessons list for this course
          const cRes = await API.get(`/courses/${courseIdVal}`)
          const lessonsList: LessonItem[] = cRes.data.units.flatMap((u: any) =>
            u.lessons.map((l: any) => ({
              id: l.id,
              title: l.title,
              unit: { course_id: Number(courseIdVal) }
            }))
          )
          setLessons(lessonsList)
        }
      }

      if (exam.questions && exam.questions.length > 0) {
        const mappedQuestions = exam.questions.map((q: any) => ({
          text: q.text,
          type: q.type,
          options: q.options || ['', '', '', ''],
          correct_answer: q.correct_answer || '',
          score: q.score || 1
        }))
        setQuestions(mappedQuestions)
        setActiveQuestionIdx(0)
      }
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل بيانات الاختبار.', 'error')
    }
  }

  React.useEffect(() => {
    const init = async () => {
      setLoading(true)
      const currentCourses = await fetchCoursesAndLessons()
      if (isEdit && id) {
        await fetchExamDetails(id, currentCourses)
      }
      setLoading(false)
    }
    init()
  }, [id, isEdit])

  // Recalculate max score when scores change
  React.useEffect(() => {
    const total = questions.reduce((sum, q) => sum + (q.score || 0), 0)
    setMaxScore(total.toString())
  }, [questions])

  // Question manipulation
  const handleAddQuestion = (qType: 'mcq' | 'true_false' | 'essay' = 'mcq') => {
    const newQuestion: Question = {
      text: `سؤال جديد ${questions.length + 1}؟`,
      type: qType,
      options: qType === 'mcq' ? ['', '', '', ''] : (qType === 'true_false' ? ['صح', 'خطأ'] : []),
      correct_answer: qType === 'true_false' ? 'صح' : '',
      score: 1
    }
    setQuestions([...questions, newQuestion])
    setActiveQuestionIdx(questions.length)
  }

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) {
      useModalStore.getState().showToast('يجب أن يحتوي الاختبار على سؤال واحد على الأقل.', 'warning')
      return
    }
    const newQuestions = questions.filter((_, i) => i !== idx)
    setQuestions(newQuestions)
    if (activeQuestionIdx >= newQuestions.length) {
      setActiveQuestionIdx(newQuestions.length - 1)
    }
  }

  const updateQuestionField = (field: keyof Question, value: any) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx !== activeQuestionIdx) return q
      return { ...q, [field]: value }
    }))
  }

  const updateQuestionOption = (optIdx: number, value: string) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx !== activeQuestionIdx) return q
      const newOptions = [...q.options]
      newOptions[optIdx] = value
      return { ...q, options: newOptions }
    }))
  }

  // Rearrange order
  const moveQuestionUp = (idx: number) => {
    if (idx === 0) return
    const newQuestions = [...questions]
    const temp = newQuestions[idx]
    newQuestions[idx] = newQuestions[idx - 1]
    newQuestions[idx - 1] = temp
    setQuestions(newQuestions)
    if (activeQuestionIdx === idx) setActiveQuestionIdx(idx - 1)
    else if (activeQuestionIdx === idx - 1) setActiveQuestionIdx(idx)
  }

  const moveQuestionDown = (idx: number) => {
    if (idx === questions.length - 1) return
    const newQuestions = [...questions]
    const temp = newQuestions[idx]
    newQuestions[idx] = newQuestions[idx + 1]
    newQuestions[idx + 1] = temp
    setQuestions(newQuestions)
    if (activeQuestionIdx === idx) setActiveQuestionIdx(idx + 1)
    else if (activeQuestionIdx === idx + 1) setActiveQuestionIdx(idx)
  }

  // Word file import
  const handleWordFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setImportingWord(true)
    try {
      const res = await API.post('/teacher/exams/import-word', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data && res.data.length > 0) {
        const parsed = res.data.map((q: any) => ({
          text: q.text,
          type: q.type,
          options: q.options || ['', '', '', ''],
          correct_answer: q.correct_answer,
          score: q.score || 1
        }))
        setQuestions(prev => [...prev, ...parsed])
        useModalStore.getState().showToast(`تم استيراد عدد (${parsed.length}) سؤال بنجاح من ملف الوورد!`, 'success')
      } else {
        useModalStore.getState().showToast('لم نجد أسئلة متطابقة بالصيغة المطلوبة في الملف.', 'warning')
      }
    } catch (err: any) {
      console.error(err)
      useModalStore.getState().showToast(err.response?.data?.message || 'حدث خطأ أثناء قراءة ملف الوورد.', 'error')
    } finally {
      setImportingWord(false)
    }
  }

  // Bulk Text Parser
  const handleBulkParse = () => {
    if (!bulkText.trim()) {
      useModalStore.getState().showToast('يرجى كتابة بعض الأسئلة أولاً.', 'warning')
      return
    }

    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    const newQuestions: Question[] = []
    
    let currentQuestion: Partial<Question> | null = null

    lines.forEach(line => {
      // If line is a question text (doesn't start with options or correct answer label)
      const optionMatch = line.match(/^([أبجد])[\s\)\-\.：:]+(.+)$/i)
      const answerMatch = line.match(/^(الإجابة الصحيحة|الاجابة|الإجابة|الحل)[\s：:]+(.+)$/i)

      if (optionMatch) {
        if (currentQuestion && currentQuestion.options) {
          currentQuestion.options.push(optionMatch[2].trim())
        }
      } else if (answerMatch) {
        if (currentQuestion) {
          const rawAns = answerMatch[2].trim()
          // Try to map correct letter to option text if available
          currentQuestion.correct_answer = rawAns
        }
      } else {
        // It's a new question
        if (currentQuestion) {
          newQuestions.push(currentQuestion as Question)
        }
        currentQuestion = {
          text: line,
          type: 'mcq',
          options: [],
          correct_answer: '',
          score: 1
        }
      }
    })

    if (currentQuestion) {
      newQuestions.push(currentQuestion as Question)
    }

    // Clean options and convert to MCQ/TF/Essay based on parsed data
    const finalized = newQuestions.map(q => {
      const isTF = q.options.length === 2 && (q.options.includes('صح') || q.options.includes('خطأ'))
      const type = q.options.length > 0 ? (isTF ? 'true_false' : 'mcq') : 'essay'
      
      let finalOptions = q.options
      if (type === 'mcq' && finalOptions.length < 4) {
        // Pad with empty strings
        while (finalOptions.length < 4) finalOptions.push('')
      }

      // Map correct answer letter A/B/C/D if it was single character
      let correctAns = q.correct_answer
      const letterMap: Record<string, number> = { 'أ': 0, 'ب': 1, 'ج': 2, 'د': 3 }
      if (correctAns.length === 1 && letterMap[correctAns] !== undefined) {
        correctAns = q.options[letterMap[correctAns]] || correctAns
      }

      return {
        ...q,
        type,
        options: finalOptions,
        correct_answer: correctAns
      } as Question
    })

    setQuestions(prev => [...prev, ...finalized])
    setBulkText('')
    setActiveTab('editor')
    useModalStore.getState().showToast(`تم استيراد (${finalized.length}) سؤال بنجاح من المحرر النصي!`, 'success')
  }

  // Save Exam
  const handleSave = async () => {
    if (!title.trim()) {
      useModalStore.getState().showToast('يرجى إدخال عنوان الاختبار أولاً.', 'warning')
      return
    }
    if (!lessonId) {
      useModalStore.getState().showToast('الرجاء اختيار الدرس / المحاضرة المرتبطة.', 'warning')
      return
    }

    setSaving(true)
    const payload = {
      title,
      type,
      time_limit_minutes: timeLimit ? Number(timeLimit) : null,
      max_score: Number(maxScore) || 20,
      lesson_id: Number(lessonId),
      is_paid: isPaid,
      price: isPaid ? Number(price) : 0.00,
      questions,
      
      // Advanced settings
      start_date: startDate || null,
      start_time: startTime || null,
      end_date: endDate || null,
      end_time: endTime || null,
      max_attempts: Number(maxAttempts) || 1,
      passing_score: Number(passingScore) || 50,

      // Scheduling & homework type settings
      homework_type: type === 'homework' ? homeworkType : 'normal',
      enable_schedule: enableSchedule,
      open_time: enableSchedule ? openTime : null,
      close_time: enableSchedule ? closeTime : null,

      // Homework specific settings
      open_date: openDate || null,
      close_date: closeDate || null,
      submission_deadline: submissionDeadline || null,
    }

    try {
      if (isEdit && id) {
        await API.put(`/teacher/exams/${id}`, payload)
        useModalStore.getState().showToast('تم تعديل وحفظ الاختبار بنجاح.', 'success')
      } else {
        await API.post(`/teacher/lessons/${lessonId}/exam`, payload)
        useModalStore.getState().showToast('تم إنشاء ونشر الاختبار بنجاح.', 'success')
      }
      navigate('/teacher/exams')
    } catch (err: any) {
      console.error(err)
      if (err.response?.data?.errors) {
        const errorMsg = Object.entries(err.response.data.errors)
          .map(([f, msgs]: any) => `- ${f}: ${msgs.join(', ')}`)
          .join('\n')
        useModalStore.getState().showAlert({
          title: 'فشل الحفظ',
          description: `أخطاء بالمدخلات:\n${errorMsg}`,
          type: 'error'
        })
      } else {
        useModalStore.getState().showToast('حدث خطأ أثناء حفظ الاختبار. يرجى مراجعة الأسئلة والمدخلات.', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin h-10 w-10 text-brand-primary" />
          <span className="text-xs text-slate-400 font-medium">جاري تحميل بيئة عمل منشئ الامتحانات...</span>
        </div>
      </div>
    )
  }

  const activeQuestion = questions[activeQuestionIdx]

  return (
    <div className="min-h-screen bg-[var(--background-color)] text-right flex flex-col" dir="rtl">
      
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-[var(--border-color)] px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={() => navigate('/teacher/exams')}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          
          <div className="flex-grow">
            <input 
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="أدخل عنوان الاختبار المتميز هنا..."
              className="bg-transparent text-xl font-black text-slate-100 placeholder-slate-500 focus:outline-none w-full border-b border-transparent focus:border-brand-primary transition-all pb-0.5"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <span className="text-xs font-semibold text-slate-400 ml-2 hidden lg:inline">
            الأسئلة: <span className="text-brand-primary font-black">{questions.length}</span> | الدرجة الكلية: <span className="text-emerald-400 font-black">{maxScore}</span>
          </span>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-brand-primary/20 disabled:opacity-50 shrink-0"
          >
            {saving ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                <span>جاري الحفظ والرفع...</span>
              </>
            ) : (
              <>
                <Save className="h-4.5 w-4.5" />
                <span>{isEdit ? 'تعديل وحفظ التغييرات' : 'حفظ ونشر الامتحان'}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* WORKSPACE LAYOUT */}
      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden h-[calc(100vh-80px)]">
        
        {/* SIDEBAR: QUESTION NAVIGATOR */}
        <aside className="w-full lg:w-80 bg-brand-card/30 border-l border-[var(--border-color)] flex flex-col h-1/3 lg:h-full shrink-0">
          <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-brand-card/50">
            <h3 className="font-bold text-xs text-slate-400 tracking-wider">الأسئلة والترتيب</h3>
            <div className="flex gap-1">
              <button 
                onClick={() => handleAddQuestion('mcq')}
                className="p-1.5 hover:bg-slate-800 text-brand-primary rounded-lg transition-all cursor-pointer"
                title="إضافة اختيار من متعدد"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto p-4 space-y-2.5">
            {questions.map((q, idx) => {
              const isActive = idx === activeQuestionIdx
              return (
                <div 
                  key={idx}
                  onClick={() => {
                    setActiveQuestionIdx(idx)
                    setActiveTab('editor')
                  }}
                  className={`group p-3.5 border rounded-2xl cursor-pointer transition-all flex justify-between items-center gap-2 ${
                    isActive 
                      ? 'border-brand-primary bg-brand-primary/5 text-slate-100 font-bold' 
                      : 'border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] text-slate-400 hover:border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`text-[10px] w-5 h-5 flex items-center justify-center rounded-full shrink-0 font-bold ${
                      isActive ? 'bg-brand-primary text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-xs truncate block">{q.text || '[بدون نص]'}</span>
                  </div>

                  {/* Ordering and Manipulation actions */}
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); moveQuestionUp(idx); }}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100"
                      disabled={idx === 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); moveQuestionDown(idx); }}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100"
                      disabled={idx === questions.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRemoveQuestion(idx); }}
                      className="p-1 hover:bg-rose-500/20 rounded text-rose-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-4 border-t border-[var(--border-color)] bg-brand-card/50 grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAddQuestion('mcq')}
              className="py-2 px-3 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> اختياري
            </button>
            <button
              onClick={() => handleAddQuestion('true_false')}
              className="py-2 px-3 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> صح / خطأ
            </button>
            <button
              onClick={() => handleAddQuestion('essay')}
              className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 col-span-2"
            >
              <Plus className="h-3.5 w-3.5" /> سؤال مقالي (واجب)
            </button>
          </div>
        </aside>

        {/* WORKSPACE CENTRAL WORKSPACE */}
        <main className="flex-grow flex flex-col h-2/3 lg:h-full overflow-hidden">
          
          {/* TAB BAR SELECTOR */}
          <div className="bg-slate-900 border-b border-[var(--border-color)] px-6 py-2.5 flex justify-between items-center">
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab('editor')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'editor' ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/20' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="h-4 w-4" /> محرر السؤال
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'settings' ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/20' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings className="h-4 w-4" /> إعدادات الامتحان ونشر الطلاب
              </button>
              <button 
                onClick={() => setActiveTab('bulk')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'bulk' ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/20' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="h-4 w-4" /> المنشئ الذكي والسريع
              </button>
            </div>

            {/* Word Import inside central bar */}
            <div className="relative">
              <input 
                type="file" 
                accept=".docx,.doc" 
                onChange={handleWordFileChange}
                disabled={importingWord}
                className="hidden" 
                id="workspace-word-import"
              />
              <label 
                htmlFor="workspace-word-import"
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer flex items-center gap-1 border border-slate-700 transition-all"
              >
                {importingWord ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>جاري الاستخراج...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    <span>استيراد ملف Word</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* MAIN EDITABLE WORKSPACE */}
          <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-6">
            
            {/* TAB CONTENT: EDITOR */}
            {activeTab === 'editor' && activeQuestion && (
              <div className="space-y-6 max-w-4xl animate-fadeIn">
                
                {/* Question Text Editor */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-brand-primary">تعديل السؤال رقم #{activeQuestionIdx + 1}</span>
                    <span className="text-[10px] bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300 font-semibold">
                      {activeQuestion.type === 'mcq' ? 'اختياري (MCQ)' : (activeQuestion.type === 'true_false' ? 'صح وخطأ' : 'سؤال مقالي (واجب)')}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">نص السؤال</label>
                    <textarea
                      rows={3}
                      required
                      value={activeQuestion.text}
                      onChange={(e) => updateQuestionField('text', e.target.value)}
                      placeholder="اكتب نص السؤال هنا بالتفصيل..."
                      className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-brand-primary transition-all font-medium leading-relaxed"
                    />
                  </div>

                  {/* Question details configurations */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">نوع السؤال</label>
                      <select
                        value={activeQuestion.type}
                        onChange={(e) => {
                          const val = e.target.value as any
                          updateQuestionField('type', val)
                          if (val === 'true_false') {
                            updateQuestionField('options', ['صح', 'خطأ'])
                            updateQuestionField('correct_answer', 'صح')
                          } else if (val === 'mcq') {
                            updateQuestionField('options', ['', '', '', ''])
                            updateQuestionField('correct_answer', '')
                          } else {
                            updateQuestionField('options', [])
                            updateQuestionField('correct_answer', '')
                          }
                        }}
                        className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="mcq">اختياري (MCQ)</option>
                        <option value="true_false">صح وخطأ</option>
                        <option value="essay">مقالي (واجب)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">الإجابة النموذجية (المطابقة)</label>
                      {activeQuestion.type === 'true_false' ? (
                        <select
                          value={activeQuestion.correct_answer}
                          onChange={(e) => updateQuestionField('correct_answer', e.target.value)}
                          className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                        >
                          <option value="صح">صح</option>
                          <option value="خطأ">خطأ</option>
                        </select>
                      ) : activeQuestion.type === 'mcq' ? (
                        <select
                          value={activeQuestion.correct_answer}
                          onChange={(e) => updateQuestionField('correct_answer', e.target.value)}
                          className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                        >
                          <option value="">اختر الإجابة الصحيحة...</option>
                          {activeQuestion.options.map((opt, oIdx) => (
                            <option key={oIdx} value={opt}>{opt || `الخيار ${oIdx + 1}`}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={activeQuestion.correct_answer}
                          onChange={(e) => updateQuestionField('correct_answer', e.target.value)}
                          placeholder="الجواب أو دليل الدرجة"
                          className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">درجة السؤال</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={activeQuestion.score}
                        onChange={(e) => updateQuestionField('score', Math.max(1, Number(e.target.value) || 1))}
                        placeholder="1"
                        className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-205 focus:outline-none text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* MCQ Options Config */}
                {activeQuestion.type === 'mcq' && (
                  <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
                    <h4 className="text-sm font-black text-slate-200 flex items-center gap-2">
                      <HelpCircle className="h-4.5 w-4.5 text-brand-primary" />
                      <span>تحديد خيارات الإجابة الأربعة</span>
                    </h4>
                    <p className="text-[10px] text-slate-400">الرجاء إدخال النصوص الخاصة بالخيارات الأربعة، وتأكيد الإجابة النموذجية منها أعلاه.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[0, 1, 2, 3].map((optIdx) => {
                        const optValue = activeQuestion.options[optIdx] ?? ''
                        const isCorrect = optValue !== '' && optValue === activeQuestion.correct_answer
                        return (
                          <div 
                            key={optIdx}
                            className={`flex items-center gap-3 p-3.5 border rounded-2xl transition-all ${
                              isCorrect 
                                ? 'border-brand-success bg-brand-success/5 shadow-sm shadow-emerald-500/5' 
                                : 'border-slate-800 bg-slate-950/20'
                            }`}
                          >
                            <span className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-xl shrink-0 ${
                              isCorrect ? 'bg-brand-success text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {['أ', 'ب', 'ج', 'د'][optIdx]}
                            </span>
                            <input
                              type="text"
                              required
                              value={optValue}
                              onChange={(e) => updateQuestionOption(optIdx, e.target.value)}
                              placeholder={`نص البديل ${optIdx + 1}`}
                              className="bg-transparent text-xs text-slate-250 placeholder-slate-600 focus:outline-none flex-grow"
                            />
                            {optValue && (
                              <button
                                type="button"
                                onClick={() => updateQuestionField('correct_answer', optValue)}
                                className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${
                                  isCorrect ? 'bg-brand-success text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                {isCorrect ? 'إجابة صحيحة' : 'تعيين كصحيحة'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* LIVE PREVIEW CONTAINER */}
                <div className="bg-brand-card/30 border border-dashed border-[var(--border-color)] p-6 rounded-3xl space-y-4">
                  <h4 className="text-xs font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Eye className="h-4.5 w-4.5" /> معاينة مباشرة (Live Student View)
                  </h4>
                  
                  <div className="p-6 bg-slate-950 border border-slate-900 rounded-2xl space-y-4 text-right">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-brand-primary">سؤال {activeQuestionIdx + 1}</span>
                      <span className="text-[10px] text-slate-500">[{activeQuestion.score} درجات]</span>
                    </div>

                    <p className="text-sm font-bold text-slate-100">{activeQuestion.text || 'مثال على نص السؤال سيظهر هنا...'}</p>

                    {activeQuestion.type === 'mcq' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {activeQuestion.options.map((opt, oIdx) => {
                          const isCorrect = opt !== '' && opt === activeQuestion.correct_answer
                          return (
                            <div 
                              key={oIdx}
                              className={`p-3.5 border rounded-xl text-xs font-medium transition-all ${
                                isCorrect 
                                  ? 'border-brand-primary bg-brand-primary/5 text-slate-100' 
                                  : 'border-slate-800 text-slate-400 bg-slate-900/40'
                              }`}
                            >
                              <span className="ml-2 font-bold">{['أ', 'ب', 'ج', 'د'][oIdx]})</span>
                              {opt || `بديل اختياري ${oIdx + 1}`}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {activeQuestion.type === 'true_false' && (
                      <div className="flex gap-4 pt-2">
                        {['صح', 'خطأ'].map((opt) => {
                          const isCorrect = opt === activeQuestion.correct_answer
                          return (
                            <div 
                              key={opt}
                              className={`px-6 py-2.5 border rounded-xl text-xs font-bold transition-all ${
                                isCorrect 
                                  ? 'border-brand-primary bg-brand-primary/5 text-slate-100' 
                                  : 'border-slate-800 text-slate-450 bg-slate-900/40'
                              }`}
                            >
                              {opt}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {activeQuestion.type === 'essay' && (
                      <div className="pt-2">
                        <textarea 
                          rows={3} 
                          disabled 
                          placeholder="مساحة مخصصة لكتابة إجابة الطالب النصية الحرة..."
                          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-xs text-slate-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT: SETTINGS & PUBLISHING */}
            {activeTab === 'settings' && (
              <div className="space-y-6 max-w-4xl animate-fadeIn">
                
                {/* Meta details */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-6 shadow-sm">
                  <h4 className="text-base font-black text-slate-200 border-b border-[var(--border-color)] pb-3">إعدادات الامتحان الأساسية:</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">نوع الاختبار</label>
                      <select
                        value={type}
                        onChange={(e: any) => setType(e.target.value)}
                        className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-202 focus:outline-none"
                      >
                        <option value="quiz">كويز قصير</option>
                        <option value="homework">واجب منزلي</option>
                        <option value="monthly_exam">امتحان شهري</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">الوقت المحدد (بالدقائق)</label>
                      <input
                        type="number"
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(e.target.value)}
                        placeholder="اتركها فارغة لوقت مفتوح"
                        className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-202 focus:outline-none text-center"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">الدرجة الكلية القصوى</label>
                      <input
                        type="number"
                        disabled
                        value={maxScore}
                        placeholder="20"
                        className="w-full bg-[rgba(0,0,0,0.2)] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-500 focus:outline-none text-center"
                      />
                      <span className="text-[9px] text-slate-500 mt-1 block">تُحسب تلقائياً من درجات الأسئلة</span>
                    </div>
                  </div>

                  {/* Mapping courses/lessons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">الكورس الدراسي</label>
                      <select
                        required
                        value={courseId}
                        onChange={(e) => handleCourseChange(e.target.value)}
                        className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-202 focus:outline-none"
                      >
                        <option value="">اختر الكورس...</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">المحاضرة (الدرس)</label>
                      <select
                        required
                        value={lessonId}
                        onChange={(e) => setLessonId(e.target.value)}
                        disabled={!courseId}
                        className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-202 focus:outline-none disabled:opacity-45"
                      >
                        <option value="">اختر المحاضرة...</option>
                        {lessons.map((l) => (
                          <option key={l.id} value={l.id}>{l.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Paid vs Free Pricing info */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-6 shadow-sm">
                  <h4 className="text-base font-black text-slate-200 border-b border-[var(--border-color)] pb-3">سعر وتصنيف الامتحان:</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">فئة التسعير</label>
                      <select
                        value={isPaid ? 'paid' : 'free'}
                        onChange={(e) => setIsPaid(e.target.value === 'paid')}
                        className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-202 focus:outline-none"
                      >
                        <option value="free">مجاني مع الكورس (Free)</option>
                        <option value="paid">مدفوع بشكل منفصل (Paid)</option>
                      </select>
                    </div>

                    {isPaid && (
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1.5">السعر بالجنيه المصري</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="مثال: 50"
                          className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-202 focus:outline-none text-center"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Advanced Dates & Lock Settings */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-6 shadow-sm">
                  <h4 className="text-base font-black text-slate-200 border-b border-[var(--border-color)] pb-3">إعدادات النشر ومكافحة الغش:</h4>

                  {/* Homework Type selector (only for homework) */}
                  {type === 'homework' && (
                    <div className="bg-slate-900/30 p-5 border border-[var(--border-color)] rounded-2xl space-y-3">
                      <label className="text-xs font-bold text-slate-350 block">نوع الواجب الدراسي</label>
                      <div className="flex gap-6 items-center">
                        <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
                          <input
                            type="radio"
                            name="homework_type"
                            checked={homeworkType === 'normal'}
                            onChange={() => setHomeworkType('normal')}
                            className="accent-brand-primary"
                          />
                          <span>واجب تقليدي (Normal Homework)</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
                          <input
                            type="radio"
                            name="homework_type"
                            checked={homeworkType === 'bubble_sheet'}
                            onChange={() => setHomeworkType('bubble_sheet')}
                            className="accent-brand-primary"
                          />
                          <span>واجب بابل شيت (Bubble Sheet Homework)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Scheduling Section for BOTH Exams & Homeworks */}
                  <div className="bg-slate-900/30 p-5 border border-[var(--border-color)] rounded-2xl space-y-4">
                    <label className="text-xs font-bold text-slate-350 select-none cursor-pointer flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={enableSchedule}
                        onChange={(e) => setEnableSchedule(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-950"
                      />
                      <span>تفعيل جدول المواعيد (Enable Schedule)</span>
                    </label>

                    {enableSchedule && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-450 block">تاريخ الفتح (Open Date)</label>
                          <input
                            type="date"
                            value={openDate}
                            onChange={(e) => setOpenDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none text-right"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-450 block">وقت الفتح (Open Time)</label>
                          <input
                            type="time"
                            value={openTime}
                            onChange={(e) => setOpenTime(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-450 block">تاريخ الإغلاق (Close Date)</label>
                          <input
                            type="date"
                            value={closeDate}
                            onChange={(e) => setCloseDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none text-right"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-450 block">وقت الإغلاق (Close Time)</label>
                          <input
                            type="time"
                            value={closeTime}
                            onChange={(e) => setCloseTime(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Standard date settings for Quiz if not scheduled */}
                  {type !== 'homework' && !enableSchedule && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400">تاريخ البدء</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none text-right"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400">وقت البدء</label>
                          <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400">تاريخ النهاية</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none text-right"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400">وقت النهاية</label>
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attempts & Passing score (only for quiz / monthly_exam) */}
                  {type !== 'homework' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-900/30 p-5 border border-[var(--border-color)] rounded-2xl">
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1.5">الحد الأقصى للمحاولات</label>
                        <input
                          type="number"
                          min="1"
                          value={maxAttempts}
                          onChange={(e) => setMaxAttempts(e.target.value)}
                          className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-202 focus:outline-none text-center"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1.5">درجة النجاح المحددة (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={passingScore}
                          onChange={(e) => setPassingScore(e.target.value)}
                          className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-202 focus:outline-none text-center"
                        />
                      </div>
                    </div>
                  )}

                  {/* Standard deadline setting for Homework if not scheduled */}
                  {type === 'homework' && !enableSchedule && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1.5">تاريخ فتح الواجب</label>
                          <input
                            type="date"
                            value={openDate}
                            onChange={(e) => setOpenDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none text-right"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1.5">تاريخ إغلاق الواجب</label>
                          <input
                            type="date"
                            value={closeDate}
                            onChange={(e) => setCloseDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none text-right"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1.5">موعد التسليم النهائي (Submission Deadline)</label>
                        <input
                          type="datetime-local"
                          value={submissionDeadline}
                          onChange={(e) => setSubmissionDeadline(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none text-right"
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB CONTENT: BULK QUICK CREATOR */}
            {activeTab === 'bulk' && (
              <div className="space-y-6 max-w-4xl animate-fadeIn">
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
                  <h4 className="text-base font-black text-slate-200">المنشئ النصي الذكي والبديل السريع</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-light">
                    قم بكتابة أو لصق الأسئلة مباشرة في المربع أدناه بالتنسيق التالي لسهولة التحويل التلقائي:
                  </p>
                  
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-900 text-slate-400 font-mono text-[10px] text-left leading-relaxed space-y-1" dir="ltr">
                    <div>Question Text here?</div>
                    <div>أ) Option 1</div>
                    <div>ب) Option 2</div>
                    <div>ج) Option 3</div>
                    <div>د) Option 4</div>
                    <div className="text-brand-primary">الإجابة الصحيحة: أ</div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-semibold text-slate-300">أدخل الأسئلة والخيارات مجمعة:</label>
                    <textarea
                      rows={12}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="السؤال الأول هنا؟&#10;أ) خيار 1&#10;ب) خيار 2&#10;الإجابة الصحيحة: أ"
                      className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-primary leading-relaxed"
                    />
                  </div>

                  <button
                    onClick={handleBulkParse}
                    className="px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-primary/10 cursor-pointer"
                  >
                    استخراج الأسئلة وتضمينها
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>

      </div>
    </div>
  )
}
