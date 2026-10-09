import React from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
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
  Layers,
  ShieldAlert,
  Calendar,
  DollarSign,
  Image as ImageIcon,
  X,
  RefreshCw
} from 'lucide-react'

export interface QuestionOption {
  text: string
  image_url?: string | null
}

export interface Question {
  id?: number
  text: string
  image_url?: string | null
  type: 'mcq' | 'true_false' | 'essay'
  options: (string | QuestionOption)[]
  correct_answer: string
  score: number
}

export const normalizeOption = (opt: any): QuestionOption => {
  if (!opt) return { text: '', image_url: null }
  if (typeof opt === 'string') return { text: opt, image_url: null }
  return {
    text: typeof opt.text === 'string' ? opt.text : '',
    image_url: typeof opt.image_url === 'string' ? opt.image_url : null
  }
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
  course_id?: number | null
  package_id?: number | null
  matching_package_id?: number | null
  is_locked?: boolean
}

const MONTHS_LIST = [
  'شهر سبتمبر',
  'شهر أكتوبر',
  'شهر نوفمبر',
  'شهر ديسمبر',
  'شهر يناير',
  'شهر فبراير',
  'شهر مارس',
  'شهر أبريل',
  'شهر مايو',
]

const GRADES_LIST = [
  { value: 'first_secondary', label: 'الصف الأول الثانوي' },
  { value: 'second_secondary', label: 'الصف الثاني الثانوي' },
  { value: 'third_secondary', label: 'الصف الثالث الثانوي' },
  { value: 'third_prep', label: 'الصف الثالث الإعدادي' },
  { value: 'second_prep', label: 'الصف الثاني الإعدادي' },
  { value: 'first_prep', label: 'الصف الأول الإعدادي' },
]

const STAGES_LIST = [
  'المرحلة الثانوية',
  'المرحلة الإعدادية',
  'المرحلة الابتدائية',
  'تعليم عام / جامعي',
]

export default function ExamBuilder() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isEdit = !!id

  const initialContext = (searchParams.get('context') === 'monthly_standalone' || searchParams.get('type') === 'monthly_exam')
    ? 'monthly_standalone'
    : 'course'

  const [assessmentContext, setAssessmentContext] = React.useState<'course' | 'monthly_standalone'>(initialContext)
  const isMonthlyStandalone = assessmentContext === 'monthly_standalone'

  // Courses & Lessons lists
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [lessons, setLessons] = React.useState<LessonItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Form Fields
  const [title, setTitle] = React.useState('')
  const [type, setType] = React.useState<'quiz' | 'homework' | 'monthly_exam'>(isMonthlyStandalone ? 'monthly_exam' : 'quiz')
  const [timeLimit, setTimeLimit] = React.useState(isMonthlyStandalone ? '60' : '')
  const [maxScore, setMaxScore] = React.useState('20')
  const [courseId, setCourseId] = React.useState('')
  const [lessonId, setLessonId] = React.useState('')
  const [isPaid, setIsPaid] = React.useState(isMonthlyStandalone)
  const [price, setPrice] = React.useState('50')

  // Standalone Monthly Exam fields
  const [month, setMonth] = React.useState('شهر أكتوبر')
  const [stage, setStage] = React.useState('المرحلة الثانوية')
  const [grade, setGrade] = React.useState('third_secondary')
  const [subject, setSubject] = React.useState('الكيمياء')
  const [description, setDescription] = React.useState('')
  const [allowedViolations, setAllowedViolations] = React.useState(3)
  const [enableFullscreen, setEnableFullscreen] = React.useState(true)
  const [enableAntiTabSwitching, setEnableAntiTabSwitching] = React.useState(true)
  const [enableCopyProtection, setEnableCopyProtection] = React.useState(true)
  const [randomizeQuestions, setRandomizeQuestions] = React.useState(true)
  const [randomizeOptions, setRandomizeOptions] = React.useState(true)
  const [isPublished, setIsPublished] = React.useState(true)

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

  // Result Visibility Settings
  const [showScore, setShowScore] = React.useState(true)
  const [showStudentAnswers, setShowStudentAnswers] = React.useState(true)
  const [showCorrectAnswers, setShowCorrectAnswers] = React.useState(true)
  const [showExplanations, setShowExplanations] = React.useState(true)

  // Questions State
  const [questions, setQuestions] = React.useState<Question[]>([
    {
      text: 'السؤال الأول؟',
      image_url: null,
      type: 'mcq',
      options: ['خيار أ', 'خيار ب', 'خيار ج', 'خيار د'].map(normalizeOption),
      correct_answer: 'خيار أ',
      score: 1
    }
  ])
  const [activeQuestionIdx, setActiveQuestionIdx] = React.useState(0)
  const [uploadingTarget, setUploadingTarget] = React.useState<string | null>(null)
  const questionImageInputRef = React.useRef<HTMLInputElement | null>(null)

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
      let exam: any = null
      try {
        const res = await API.get(`/teacher/exams/${examId}`)
        exam = res.data
      } catch (e) {
        const res = await API.get(`/teacher/monthly-exams/${examId}`)
        exam = res.data
      }

      if (!exam) return

      setTitle(exam.title || '')
      setDescription(exam.description || '')

      const isStandaloneExam = exam.type === 'monthly_exam' || !exam.lesson_id
      if (isStandaloneExam) {
        setAssessmentContext('monthly_standalone')
        setType('monthly_exam')
        setMonth(exam.month || 'شهر أكتوبر')
        setStage(exam.stage || 'المرحلة الثانوية')
        setGrade(exam.grade || 'third_secondary')
        setSubject(exam.subject || '')
        setAllowedViolations(exam.allowed_violations || 3)
        setEnableFullscreen(exam.enable_fullscreen !== false)
        setEnableAntiTabSwitching(exam.enable_anti_tab_switching !== false)
        setEnableCopyProtection(exam.enable_copy_protection !== false)
        setRandomizeQuestions(exam.randomize_questions !== false)
        setRandomizeOptions(exam.randomize_options !== false)
        setIsPublished(exam.is_published !== false)
      } else {
        setAssessmentContext('course')
        setType(exam.type || 'quiz')
      }
      
      setTimeLimit(exam.time_limit_minutes ? exam.time_limit_minutes.toString() : '')
      setMaxScore(exam.max_score ? exam.max_score.toString() : '20')
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

      setShowScore(exam.show_score !== false)
      setShowStudentAnswers(exam.show_student_answers !== false)
      setShowCorrectAnswers(exam.show_correct_answers !== false)
      setShowExplanations(exam.show_explanations !== false)

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
          id: q.id,
          text: q.text || '',
          image_url: q.image_url || null,
          type: q.type,
          options: (q.options || ['', '', '', '']).map(normalizeOption),
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
      image_url: null,
      type: qType,
      options: qType === 'mcq'
        ? ['', '', '', ''].map(normalizeOption)
        : (qType === 'true_false' ? ['صح', 'خطأ'].map(normalizeOption) : []),
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
    updateQuestionOptionText(optIdx, value)
  }

  const updateQuestionOptionText = (optIdx: number, text: string) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx !== activeQuestionIdx) return q
      const newOptions = [...q.options].map(normalizeOption)
      while (newOptions.length <= optIdx) {
        newOptions.push({ text: '', image_url: null })
      }
      newOptions[optIdx] = { ...newOptions[optIdx], text }
      return { ...q, options: newOptions }
    }))
  }

  const updateQuestionOptionImage = (optIdx: number, imageUrl: string | null) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx !== activeQuestionIdx) return q
      const newOptions = [...q.options].map(normalizeOption)
      while (newOptions.length <= optIdx) {
        newOptions.push({ text: '', image_url: null })
      }
      newOptions[optIdx] = { ...newOptions[optIdx], image_url: imageUrl }
      return { ...q, options: newOptions }
    }))
  }

  // Upload an image file for a question or choice
  const handleUploadImageFile = async (file: File): Promise<string | null> => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      useModalStore.getState().showToast('يرجى اختيار صورة بصيغة JPEG أو PNG أو WebP.', 'warning')
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      useModalStore.getState().showToast('حجم الصورة كبير جداً (أكثر من 5 ميجابايت).', 'warning')
      return null
    }

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await API.post('/teacher/exams/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return res.data.url
    } catch (err: any) {
      // Fallback to /upload
      try {
        const fallbackForm = new FormData()
        fallbackForm.append('file', file)
        const fRes = await API.post('/upload', fallbackForm, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        return fRes.data.url
      } catch (fErr: any) {
        console.error('Image upload failed', err, fErr)
        useModalStore.getState().showToast(err.response?.data?.message || 'فشل رفع الصورة.', 'error')
        return null
      }
    }
  }

  const handleQuestionImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingTarget('question')
    try {
      const url = await handleUploadImageFile(file)
      if (url) {
        updateQuestionField('image_url', url)
        useModalStore.getState().showToast('تم إرفاق صورة السؤال بنجاح!', 'success')
      }
    } finally {
      setUploadingTarget(null)
    }
  }

  const handleRemoveQuestionImage = (url?: string | null) => {
    if (url) {
      API.post('/teacher/exams/delete-image', { url }).catch(() => {})
    }
    updateQuestionField('image_url', null)
    useModalStore.getState().showToast('تم حذف صورة السؤال.', 'info')
  }

  const handleChoiceImageSelect = async (optIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingTarget(`opt-${optIdx}`)
    try {
      const url = await handleUploadImageFile(file)
      if (url) {
        updateQuestionOptionImage(optIdx, url)
        useModalStore.getState().showToast(`تم إرفاق صورة الخيار (${['أ', 'ب', 'ج', 'د'][optIdx] || optIdx + 1}) بنجاح!`, 'success')
      }
    } finally {
      setUploadingTarget(null)
    }
  }

  const handleRemoveChoiceImage = (optIdx: number, url?: string | null) => {
    if (url) {
      API.post('/teacher/exams/delete-image', { url }).catch(() => {})
    }
    updateQuestionOptionImage(optIdx, null)
    useModalStore.getState().showToast(`تم حذف صورة الخيار (${['أ', 'ب', 'ج', 'د'][optIdx] || optIdx + 1}).`, 'info')
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

    e.target.value = ''

    const fileName = file.name.toLowerCase()
    if (fileName.endsWith('.doc')) {
      useModalStore.getState().showToast('يرجى حفظ ملف Word بصيغة الحديثة (.docx). ملفات .doc القديمة غير مدعومة.', 'warning')
      return
    }

    if (!fileName.endsWith('.docx')) {
      useModalStore.getState().showToast('يرجى اختيار ملف Word بصيغة (.docx) فقط.', 'warning')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      useModalStore.getState().showToast('حجم الملف كبير جداً (أكثر من 20 ميجابايت).', 'warning')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setImportingWord(true)
    try {
      const res = await API.post('/teacher/exams/import-word', formData)

      if (res.data && res.data.length > 0) {
        const parsed: Question[] = res.data.map((q: any) => ({
          text: q.text || '',
          image_url: q.image_url || null,
          type: q.type || 'mcq',
          options: (q.options || ['', '', '', '']).map(normalizeOption),
          correct_answer: q.correct_answer || '',
          score: q.score || 1
        }))
        setQuestions(prev => [...prev, ...parsed])
        useModalStore.getState().showToast(`تم استيراد عدد (${parsed.length}) سؤال بنجاح مع الصور المضمنة من ملف Word!`, 'success')
      } else {
        useModalStore.getState().showToast('لم نجد أسئلة متطابقة بالصيغة المطلوبة في الملف.', 'warning')
      }
    } catch (err: any) {
      console.error(err)
      const msg = err.response?.data?.message || 'حدث خطأ أثناء قراءة ملف الوورد.'
      useModalStore.getState().showToast(msg, 'error')
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
        const targetOpt = q.options[letterMap[correctAns]]
        if (targetOpt) {
          correctAns = typeof targetOpt === 'string' ? targetOpt : (targetOpt.text || targetOpt.image_url || correctAns)
        }
      }

      return {
        ...q,
        image_url: null,
        type,
        options: finalOptions.map(normalizeOption),
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
      useModalStore.getState().showToast(isMonthlyStandalone ? 'يرجى إدخال عنوان الامتحان الشهري أولاً.' : 'يرجى إدخال عنوان الاختبار أولاً.', 'warning')
      return
    }

    if (questions.length === 0) {
      useModalStore.getState().showToast('يجب إضافة سؤال واحد على الأقل قبل الحفظ.', 'warning')
      return
    }

    // Check if each question has at least text or image
    const emptyQuestion = questions.find(q => !q.text?.trim() && !q.image_url)
    if (emptyQuestion) {
      useModalStore.getState().showToast('يجب أن يحتوي كل سؤال على نص أو صورة توضيحية على الأقل.', 'warning')
      return
    }

    // Check if MCQ questions have correct answers
    const invalidMcq = questions.find(q => q.type === 'mcq' && !q.correct_answer)
    if (invalidMcq) {
      useModalStore.getState().showToast(`السؤال "${(invalidMcq.text || 'السؤال').slice(0, 30)}..." يحتاج إلى تحديد الإجابة الصحيحة.`, 'warning')
      return
    }

    // Branch 1: Standalone Monthly Exam
    if (isMonthlyStandalone) {
      if (!grade) {
        useModalStore.getState().showToast('الرجاء اختيار الصف الدراسي.', 'warning')
        return
      }
      if (!subject.trim()) {
        useModalStore.getState().showToast('الرجاء إدخال اسم المادة الدراسية.', 'warning')
        return
      }

      setSaving(true)
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        type: 'monthly_exam',
        month,
        stage,
        grade,
        subject: subject.trim(),
        time_limit_minutes: timeLimit ? Number(timeLimit) : 60,
        max_score: Number(maxScore) || 20,
        passing_score: Number(passingScore) || Math.round((Number(maxScore) || 20) * 0.5),
        price: isPaid ? Number(price) : 0.00,
        is_paid: isPaid,
        is_published: isPublished,
        is_active: true,
        allowed_violations: Number(allowedViolations) || 3,
        enable_fullscreen: enableFullscreen,
        enable_anti_tab_switching: enableAntiTabSwitching,
        enable_copy_protection: enableCopyProtection,
        randomize_questions: randomizeQuestions,
        randomize_options: randomizeOptions,
        show_score: showScore,
        show_student_answers: showStudentAnswers,
        show_correct_answers: showCorrectAnswers,
        show_explanations: showExplanations,
        questions: questions.map(q => ({
          text: q.text || '',
          image_url: q.image_url || null,
          type: q.type,
          options: q.type === 'mcq'
            ? (q.options || []).map(opt => {
                const norm = normalizeOption(opt)
                return { text: norm.text, image_url: norm.image_url }
              })
            : (q.type === 'true_false' ? ['صح', 'خطأ'] : null),
          correct_answer: q.correct_answer,
          score: Number(q.score) || 1
        }))
      }

      try {
        if (isEdit && id) {
          await API.put(`/teacher/monthly-exams/${id}`, payload)
          useModalStore.getState().showToast('تم تعديل وحفظ الامتحان الشهري بنجاح.', 'success')
        } else {
          await API.post('/teacher/monthly-exams', payload)
          useModalStore.getState().showToast('تم إنشاء وحفظ الامتحان الشهري بنجاح مع كافة الأسئلة.', 'success')
        }
        navigate('/teacher/monthly-exams')
      } catch (err: any) {
        console.error(err)
        const msg = err.response?.data?.message || 'حدث خطأ أثناء حفظ الامتحان الشهري.'
        useModalStore.getState().showToast(msg, 'error')
      } finally {
        setSaving(false)
      }
      return
    }

    // Branch 2: Course / Lesson Quiz / Homework
    if (!lessonId) {
      useModalStore.getState().showToast('الرجاء اختيار الدرس / المحاضرة المرتبطة.', 'warning')
      return
    }

    setSaving(true)
    const payload = {
      title: title.trim(),
      type: type === 'monthly_exam' ? 'quiz' : type,
      time_limit_minutes: timeLimit ? Number(timeLimit) : null,
      max_score: Number(maxScore) || 20,
      lesson_id: Number(lessonId),
      is_paid: isPaid,
      price: isPaid ? Number(price) : 0.00,
      questions: questions.map(q => ({
        text: q.text || '',
        image_url: q.image_url || null,
        type: q.type,
        options: q.type === 'mcq'
          ? (q.options || []).map(opt => {
              const norm = normalizeOption(opt)
              return { text: norm.text, image_url: norm.image_url }
            })
          : (q.type === 'true_false' ? ['صح', 'خطأ'] : null),
        correct_answer: q.correct_answer,
        score: Number(q.score) || 1
      })),
      
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

      // Result Visibility Settings
      show_score: showScore,
      show_student_answers: showStudentAnswers,
      show_correct_answers: showCorrectAnswers,
      show_explanations: showExplanations,
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
        <div className="flex items-center gap-4 w-full md:w-auto flex-grow max-w-3xl">
          <button 
            onClick={() => navigate(isMonthlyStandalone ? '/teacher/monthly-exams' : '/teacher/exams')}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer shrink-0"
            title="رجوع"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          
          <div className="flex-grow flex items-center gap-2">
            <input 
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isMonthlyStandalone ? "أدخل عنوان الامتحان الشهري (مثال: امتحان الكيمياء الشامل لشهر أكتوبر)..." : "أدخل عنوان الاختبار المتميز هنا..."}
              className="bg-transparent text-lg md:text-xl font-black text-slate-100 placeholder-slate-500 focus:outline-none w-full border-b border-transparent focus:border-brand-primary transition-all pb-0.5"
            />
            <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
              isMonthlyStandalone 
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}>
              {isMonthlyStandalone ? 'امتحان شهري مستقل' : 'اختبار للدرس'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0">
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
                <span>{isEdit ? 'تعديل وحفظ التغييرات' : (isMonthlyStandalone ? 'حفظ ونشر الامتحان الشهري' : 'حفظ ونشر الاختبار')}</span>
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
                    <span className="text-xs truncate block">{q.text || (q.image_url ? '[سؤال مصور]' : '[بدون نص]')}</span>
                    {q.image_url && (
                      <span className="text-brand-primary shrink-0" title="سؤال يحتوي على صورة">
                        <ImageIcon className="h-3 w-3" />
                      </span>
                    )}
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
                accept=".docx"
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
                
                {/* Question Text & Image Editor */}
                <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-5 shadow-sm">
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
                      value={activeQuestion.text}
                      onChange={(e) => updateQuestionField('text', e.target.value)}
                      placeholder="اكتب نص السؤال هنا بالتفصيل (أو أرفق صورة للسؤال بالأسفل)..."
                      className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-brand-primary transition-all font-medium leading-relaxed"
                    />
                  </div>

                  {/* Question Image Attachment */}
                  <div className="pt-3 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <ImageIcon className="h-4 w-4 text-brand-primary" />
                        <span>صورة توضيحية للسؤال (اختياري / يدعم JPEG, PNG, WebP)</span>
                      </label>
                      <input
                        type="file"
                        ref={questionImageInputRef}
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleQuestionImageSelect}
                        className="hidden"
                      />
                      {!activeQuestion.image_url ? (
                        <button
                          type="button"
                          onClick={() => questionImageInputRef.current?.click()}
                          disabled={uploadingTarget === 'question'}
                          className="px-3.5 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {uploadingTarget === 'question' ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>جاري رفع الصورة...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-3.5 w-3.5" />
                              <span>إرفاق صورة للسؤال</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => questionImageInputRef.current?.click()}
                            disabled={uploadingTarget === 'question'}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>استبدال الصورة</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestionImage(activeQuestion.image_url)}
                            className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>حذف الصورة</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {activeQuestion.image_url && (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 p-2 max-w-md group">
                        <img
                          src={activeQuestion.image_url}
                          alt={`صورة السؤال ${activeQuestionIdx + 1}`}
                          className="w-full max-h-64 object-contain rounded-xl"
                        />
                        <a
                          href={activeQuestion.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur text-slate-300 hover:text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Eye className="h-3 w-3" />
                          <span>عرض بالحجم الكامل</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Question details configurations */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">نوع السؤال</label>
                      <select
                        value={activeQuestion.type}
                        onChange={(e) => {
                          const val = e.target.value as any
                          updateQuestionField('type', val)
                          if (val === 'true_false') {
                            updateQuestionField('options', ['صح', 'خطأ'].map(normalizeOption))
                            updateQuestionField('correct_answer', 'صح')
                          } else if (val === 'mcq') {
                            updateQuestionField('options', ['', '', '', ''].map(normalizeOption))
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
                          {activeQuestion.options.map((rawOpt, oIdx) => {
                            const opt = normalizeOption(rawOpt)
                            const label = opt.text || (opt.image_url ? `[خيار مصور ${oIdx + 1}]` : `الخيار ${oIdx + 1}`)
                            const value = opt.text || opt.image_url || String(oIdx)
                            return <option key={oIdx} value={value}>{`(${['أ', 'ب', 'ج', 'د'][oIdx]}) ${label}`}</option>
                          })}
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
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-sm font-black text-slate-200 flex items-center gap-2">
                          <HelpCircle className="h-4.5 w-4.5 text-brand-primary" />
                          <span>تحديد خيارات الإجابة الأربعة</span>
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          يمكن أن يكون الخيار نصاً، صورة فقط، أو نصاً وصورة معاً. انقر على أيقونة الصورة لإرفاق صورة لأي خيار.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {[0, 1, 2, 3].map((optIdx) => {
                        const opt = normalizeOption(activeQuestion.options[optIdx])
                        const choiceValue = opt.text || opt.image_url || String(optIdx)
                        const isCorrect = Boolean(
                          (opt.text && opt.text === activeQuestion.correct_answer) ||
                          (opt.image_url && opt.image_url === activeQuestion.correct_answer) ||
                          (String(optIdx) === activeQuestion.correct_answer)
                        )
                        const isUploadingThis = uploadingTarget === `opt-${optIdx}`

                        return (
                          <div 
                            key={optIdx}
                            className={`p-3.5 border rounded-2xl transition-all space-y-2.5 ${
                              isCorrect 
                                ? 'border-brand-success bg-brand-success/5 shadow-sm shadow-emerald-500/5' 
                                : 'border-slate-800 bg-slate-950/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-xl shrink-0 ${
                                isCorrect ? 'bg-brand-success text-white' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {['أ', 'ب', 'ج', 'د'][optIdx]}
                              </span>
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => updateQuestionOptionText(optIdx, e.target.value)}
                                placeholder={opt.image_url ? `نص البديل ${optIdx + 1} (اختياري مع الصورة)` : `نص البديل ${optIdx + 1}`}
                                className="bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none flex-grow"
                              />

                              {/* Upload Choice Image Trigger */}
                              <input
                                type="file"
                                id={`choice-image-input-${optIdx}`}
                                accept="image/jpeg,image/png,image/webp"
                                onChange={(e) => handleChoiceImageSelect(optIdx, e)}
                                className="hidden"
                              />
                              <label
                                htmlFor={`choice-image-input-${optIdx}`}
                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-brand-primary rounded-lg transition-colors cursor-pointer shrink-0"
                                title="إرفاق / تغيير صورة لهذا الخيار"
                              >
                                {isUploadingThis ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
                                ) : (
                                  <ImageIcon className="h-4 w-4" />
                                )}
                              </label>

                              {/* Set Correct Answer Button */}
                              {(opt.text || opt.image_url) && (
                                <button
                                  type="button"
                                  onClick={() => updateQuestionField('correct_answer', choiceValue)}
                                  className={`text-[9px] font-bold px-2 py-1 rounded transition-colors shrink-0 ${
                                    isCorrect ? 'bg-brand-success text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                  }`}
                                >
                                  {isCorrect ? 'إجابة صحيحة' : 'تعيين كصحيحة'}
                                </button>
                              )}
                            </div>

                            {/* Attached Choice Image Thumbnail Preview */}
                            {opt.image_url && (
                              <div className="flex items-center gap-2.5 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                                <img
                                  src={opt.image_url}
                                  alt={`صورة الخيار ${optIdx + 1}`}
                                  className="w-12 h-12 object-contain rounded-lg bg-black/50 border border-slate-800 shrink-0"
                                />
                                <div className="flex-grow min-w-0">
                                  <span className="text-[10px] text-slate-300 block truncate font-medium">صورة الخيار مرفقة</span>
                                  <a
                                    href={opt.image_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[9px] text-brand-primary hover:underline"
                                  >
                                    معاينة كاملة
                                  </a>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <label
                                    htmlFor={`choice-image-input-${optIdx}`}
                                    className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded cursor-pointer"
                                    title="استبدال صورة الخيار"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveChoiceImage(optIdx, opt.image_url)}
                                    className="p-1 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                                    title="حذف صورة الخيار"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
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

                    <p className="text-sm font-bold text-slate-100">{activeQuestion.text || (activeQuestion.image_url ? '' : 'مثال على نص السؤال سيظهر هنا...')}</p>

                    {activeQuestion.image_url && (
                      <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900/40 p-2 max-w-md">
                        <img
                          src={activeQuestion.image_url}
                          alt="معاينة صورة السؤال"
                          className="w-full max-h-56 object-contain rounded-lg"
                        />
                      </div>
                    )}

                    {activeQuestion.type === 'mcq' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {activeQuestion.options.map((rawOpt, oIdx) => {
                          const opt = normalizeOption(rawOpt)
                          const isCorrect = Boolean(
                            (opt.text && opt.text === activeQuestion.correct_answer) ||
                            (opt.image_url && opt.image_url === activeQuestion.correct_answer) ||
                            (String(oIdx) === activeQuestion.correct_answer)
                          )
                          return (
                            <div 
                              key={oIdx}
                              className={`p-3.5 border rounded-xl text-xs font-medium transition-all space-y-2 ${
                                isCorrect 
                                  ? 'border-brand-primary bg-brand-primary/5 text-slate-100' 
                                  : 'border-slate-800 text-slate-400 bg-slate-900/40'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-brand-primary shrink-0">{['أ', 'ب', 'ج', 'د'][oIdx]})</span>
                                <span className="truncate">{opt.text || (opt.image_url ? '[خيار مصور]' : `بديل اختياري ${oIdx + 1}`)}</span>
                              </div>
                              {opt.image_url && (
                                <div className="rounded-lg overflow-hidden border border-slate-800 bg-black/40 p-1">
                                  <img
                                    src={opt.image_url}
                                    alt={`خيار ${oIdx + 1}`}
                                    className="max-h-24 w-full object-contain rounded"
                                  />
                                </div>
                              )}
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
                                  : 'border-slate-800 text-slate-400 bg-slate-900/40'
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
                
                {/* Context Switcher (if not editing an existing exam) */}
                {!isEdit && (
                  <div className="bg-brand-card border border-[var(--border-color)] p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div>
                      <span className="text-xs font-black text-slate-200 block">سياق ونوع الاختبار:</span>
                      <span className="text-[11px] text-slate-400">حدد ما إذا كان هذا الاختبار كويز/واجب يتبع درساً محدداً، أو امتحاناً شهرياً مستقلاً يُباع كمنتج منفصل.</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAssessmentContext('course')
                          setType('quiz')
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          !isMonthlyStandalone ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        اختبار تابع لدرس
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAssessmentContext('monthly_standalone')
                          setType('monthly_exam')
                          setCourseId('')
                          setLessonId('')
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          isMonthlyStandalone ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        امتحان شهري مستقل
                      </button>
                    </div>
                  </div>
                )}

                {/* STANDALONE MONTHLY EXAM CONFIGURATION */}
                {isMonthlyStandalone ? (
                  <>
                    {/* Standalone Basic Details */}
                    <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-6 shadow-sm">
                      <h4 className="text-base font-black text-slate-200 border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
                        <Calendar className="h-4.5 w-4.5 text-indigo-400" />
                        <span>بيانات الامتحان الشهري المستقل:</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1.5">الشهر الدراسي</label>
                          <select
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                          >
                            {MONTHS_LIST.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1.5">المرحلة الدراسية</label>
                          <select
                            value={stage}
                            onChange={(e) => setStage(e.target.value)}
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                          >
                            {STAGES_LIST.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1.5">الصف الدراسي</label>
                          <select
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                          >
                            {GRADES_LIST.map((g) => (
                              <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1.5">المادة الدراسية</label>
                          <input
                            type="text"
                            required
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="مثال: الكيمياء أو الفيزياء"
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1.5">الوقت المحدد (بالدقائق)</label>
                          <input
                            type="number"
                            min="1"
                            max="300"
                            value={timeLimit}
                            onChange={(e) => setTimeLimit(e.target.value)}
                            placeholder="60"
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none text-center font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1.5">الدرجة الكلية القصوى</label>
                          <input
                            type="number"
                            disabled
                            value={maxScore}
                            placeholder="20"
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-500 focus:outline-none text-center font-bold"
                          />
                          <span className="text-[9px] text-slate-500 mt-1 block">تُحسب تلقائياً من مجموع درجات الأسئلة</span>
                        </div>

                        <div className="md:col-span-3">
                          <label className="text-xs font-semibold text-slate-300 block mb-1.5">وصف وملاحظات الامتحان للطلاب (اختياري)</label>
                          <textarea
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="توجيهات وملاحظات للطلاب قبل بدء الامتحان الشهري..."
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl p-3 text-xs text-slate-200 focus:outline-none leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Standalone Independent Pricing */}
                    <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
                      <div className="border-b border-[var(--border-color)] pb-3">
                        <h4 className="text-base font-black text-slate-200 flex items-center gap-2">
                          <DollarSign className="h-4.5 w-4.5 text-emerald-400" />
                          <span>تسعير الامتحان المستقل (منتج منفصل):</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1">
                          الامتحان الشهري منتج مستقل تماماً لا يتبع أي كورس، ولا يُضاف سعره لكورس، ولا يُفتح تلقائياً بشراء أي كورس.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1.5">نوع التسعير</label>
                          <select
                            value={isPaid ? 'paid' : 'free'}
                            onChange={(e) => setIsPaid(e.target.value === 'paid')}
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                          >
                            <option value="paid">مدفوع بشكل مستقل (Paid)</option>
                            <option value="free">مجاني لجميع الطلاب (Free)</option>
                          </select>
                        </div>

                        {isPaid && (
                          <div>
                            <label className="text-xs font-semibold text-slate-300 block mb-1.5">سعر الامتحان (بالجنيه المصري)</label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={price}
                              onChange={(e) => setPrice(e.target.value)}
                              placeholder="مثال: 50"
                              className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none text-center font-black text-emerald-400"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Standalone Anti-Cheat & Security Settings */}
                    <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
                      <h4 className="text-base font-black text-slate-200 border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
                        <ShieldAlert className="h-4.5 w-4.5 text-amber-400" />
                        <span>إعدادات المراقبة الذكية ومكافحة الغش:</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <label className="flex items-center gap-3 p-3.5 border border-[var(--border-color)] rounded-2xl bg-slate-950/20 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={enableFullscreen}
                            onChange={(e) => setEnableFullscreen(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-950"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-200">وضع ملء الشاشة الإجباري</div>
                            <div className="text-[10px] text-slate-400">إلزام الطالب بفتح الامتحان في وضع ملء الشاشة</div>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-3.5 border border-[var(--border-color)] rounded-2xl bg-slate-950/20 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={enableAntiTabSwitching}
                            onChange={(e) => setEnableAntiTabSwitching(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-950"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-200">منع مغادرة التبويب</div>
                            <div className="text-[10px] text-slate-400">احتساب مخالفة وتنبيه عند التبديل لنافذة أخرى</div>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-3.5 border border-[var(--border-color)] rounded-2xl bg-slate-950/20 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={enableCopyProtection}
                            onChange={(e) => setEnableCopyProtection(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-950"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-200">منع النسخ وتحديد النصوص</div>
                            <div className="text-[10px] text-slate-400">تعطيل تحديد الأسئلة أو نسخها خارج المنصة</div>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-3.5 border border-[var(--border-color)] rounded-2xl bg-slate-950/20 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={randomizeQuestions}
                            onChange={(e) => setRandomizeQuestions(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-950"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-200">خلط ترتيب الأسئلة</div>
                            <div className="text-[10px] text-slate-400">ترتيب عشوائي للأسئلة لكل طالب</div>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-3.5 border border-[var(--border-color)] rounded-2xl bg-slate-950/20 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={randomizeOptions}
                            onChange={(e) => setRandomizeOptions(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-950"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-200">خلط ترتيب الخيارات (MCQ)</div>
                            <div className="text-[10px] text-slate-400">ترتيب عشوائي للبدائل داخل كل سؤال</div>
                          </div>
                        </label>

                        <div className="p-3.5 border border-[var(--border-color)] rounded-2xl bg-slate-950/20 flex flex-col justify-center">
                          <label className="text-xs font-bold text-slate-200 block mb-1">الحد الأقصى للمخالفات</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={allowedViolations}
                            onChange={(e) => setAllowedViolations(Number(e.target.value) || 3)}
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none text-center font-bold"
                          />
                          <div className="text-[10px] text-slate-500 mt-1">يتم إنهاء وسحب الامتحان تلقائياً عند تجاوزه</div>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1.5">نسبة درجة النجاح (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={passingScore}
                            onChange={(e) => setPassingScore(e.target.value)}
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none text-center font-bold"
                          />
                        </div>

                        <label className="flex items-center gap-3 p-3.5 border border-[var(--border-color)] rounded-2xl bg-slate-950/20 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isPublished}
                            onChange={(e) => setIsPublished(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-950"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-200">نشر الامتحان للطلاب</div>
                            <div className="text-[10px] text-slate-400">ظهور الامتحان في صفحة الامتحانات الشهرية</div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </>
                ) : (
                  /* COURSE LESSON ASSESSMENT CONFIGURATION */
                  <>
                    {/* Meta details */}
                    <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-6 shadow-sm">
                      <h4 className="text-base font-black text-slate-200 border-b border-[var(--border-color)] pb-3">إعدادات الاختبار الأساسية:</h4>
                      
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
                      <h4 className="text-base font-black text-slate-200 border-b border-[var(--border-color)] pb-3">سعر وتصنيف الاختبار:</h4>
                      
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

                      {/* Attempts & Passing score (only for quiz) */}
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
                    </div>
                  </>
                )}

                  {/* Standard deadline setting for Homework if not scheduled */}
                  {!isMonthlyStandalone && type === 'homework' && !enableSchedule && (
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

                  {/* RESULT VISIBILITY SETTINGS */}
                  <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
                    <div className="border-b border-[var(--border-color)] pb-3">
                      <h4 className="text-base font-black text-slate-200 flex items-center gap-2">
                        <Eye className="h-4.5 w-4.5 text-brand-primary" />
                        <span>إعدادات ظهور نتيجة الاختبار للطلاب:</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        تحكم فيما يمكن للطالب رؤيته مباشرة بعد الانتهاء من أداء الاختبار أو الواجب.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <label className="flex items-center gap-3 p-3.5 border border-[var(--border-color)] rounded-2xl bg-slate-950/20 cursor-pointer select-none hover:border-slate-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={showScore}
                          onChange={(e) => setShowScore(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-950 cursor-pointer"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-200">إظهار الدرجة والنسبة المئوية</div>
                          <div className="text-[10px] text-slate-400">السماح للطالب بمعرفة درجته وترتيبه بعد التسليم</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 border border-[var(--border-color)] rounded-2xl bg-slate-950/20 cursor-pointer select-none hover:border-slate-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={showStudentAnswers}
                          onChange={(e) => setShowStudentAnswers(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-950 cursor-pointer"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-200">إظهار إجابات الطالب المسلمة</div>
                          <div className="text-[10px] text-slate-400">عرض الإجابات التي قام الطالب باختيارها أثناء الحل</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 border border-[var(--border-color)] rounded-2xl bg-slate-950/20 cursor-pointer select-none hover:border-slate-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={showCorrectAnswers}
                          onChange={(e) => setShowCorrectAnswers(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-950 cursor-pointer"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-200">إظهار نموذج الإجابة الصحيحة</div>
                          <div className="text-[10px] text-slate-400">توضيح الإجابة الصحيحة والخيارات السليمة لكل سؤال</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 border border-[var(--border-color)] rounded-2xl bg-slate-950/20 cursor-pointer select-none hover:border-slate-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={showExplanations}
                          onChange={(e) => setShowExplanations(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-brand-primary focus:ring-brand-primary bg-slate-950 cursor-pointer"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-200">إظهار شرح وتفسير الأسئلة</div>
                          <div className="text-[10px] text-slate-400">عرض التفسير والتعليل النموذجي المرفق بالأسئلة</div>
                        </div>
                      </label>
                    </div>
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
