import React from 'react'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { 
  BookOpen, 
  Search, 
  Eye, 
  Trash2, 
  X, 
  Loader2, 
  Video, 
  FileText, 
  HelpCircle, 
  User, 
  GraduationCap, 
  CheckCircle2, 
  AlertTriangle,
  Settings
} from 'lucide-react'
import EmptyState from '../../components/EmptyState'

interface CourseItem {
  id: number
  title: string
  description: string
  cover_image: string
  price: string
  grade: string
  subject: string
  is_published: boolean
  students_count: number
  is_bundle?: boolean | number | string
  teacher: {
    id: number
    name: string
    avatar?: string
  }
}

const SUBJECTS_TRANSLATION: Record<string, string> = {
  chemistry: 'الكيمياء',
  physics: 'الفيزياء',
  integrated_science: 'علوم متكاملة',
  biology: 'الأحياء',
  math: 'الرياضيات',
  science: 'العلوم',
  arabic: 'اللغة العربية',
  english: 'اللغة الإنجليزية',
}

const GRADES_TRANSLATION: Record<string, string> = {
  first_preparatory: 'الصف الأول الإعدادي',
  second_preparatory: 'الصف الثاني الإعدادي',
  third_preparatory: 'الصف الثالث الإعدادي',
  first_secondary: 'الصف الأول الثانوي',
  second_secondary: 'الصف الثاني الثانوي',
  third_secondary: 'الصف الثالث الثانوي',
}

export default function CoursesList() {
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedGrade, setSelectedGrade] = React.useState('all')
  const [selectedSubject, setSelectedSubject] = React.useState('all')

  // Detailed view of syllabus structure
  const [viewCourse, setViewCourse] = React.useState<CourseItem | null>(null)
  const [courseDetails, setCourseDetails] = React.useState<any>(null)
  const [loadingDetails, setLoadingDetails] = React.useState(false)

  // Course deletion
  const [deleteCourseItem, setDeleteCourseItem] = React.useState<CourseItem | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // Course view limits
  const [limitModalCourse, setLimitModalCourse] = React.useState<any>(null)
  const [limitEnabledOverride, setLimitEnabledOverride] = React.useState<string>('inherit')
  const [limitMaxViews, setLimitMaxViews] = React.useState<number | string>('')
  const [savingLimit, setSavingLimit] = React.useState(false)

  const handleOpenLimitModal = async (course: any) => {
    setLimitModalCourse(course)
    try {
      const res = await API.get(`/admin/course-view-limits-config/${course.id}`)
      const { view_limit_enabled, max_views } = res.data
      
      if (view_limit_enabled === null || view_limit_enabled === undefined) {
        setLimitEnabledOverride('inherit')
      } else if (view_limit_enabled) {
        setLimitEnabledOverride('enable')
      } else {
        setLimitEnabledOverride('disable')
      }
      
      setLimitMaxViews(max_views !== null && max_views !== undefined ? max_views : '')
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل إعدادات قيود المشاهدة.', 'error')
    }
  }

  const handleSaveLimitConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!limitModalCourse) return
    setSavingLimit(true)
    try {
      let val: boolean | null = null
      if (limitEnabledOverride === 'enable') val = true
      if (limitEnabledOverride === 'disable') val = false

      await API.post(`/admin/course-view-limits-config/${limitModalCourse.id}`, {
        view_limit_enabled: val,
        max_views: limitMaxViews !== '' ? parseInt(limitMaxViews as string) : null,
      })
      useModalStore.getState().showToast('تم حفظ قيود مشاهدة الكورس بنجاح.', 'success')
      setLimitModalCourse(null)
    } catch (err: any) {
      console.error(err)
      useModalStore.getState().showToast(err.response?.data?.message || 'فشل حفظ قيود المشاهدة.', 'error')
    } finally {
      setSavingLimit(false)
    }
  }

  const fetchCourses = () => {
    setLoading(true)
    API.get('/admin/courses')
      .then((res) => {
        setCourses(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  React.useEffect(() => {
    fetchCourses()
  }, [])

  const handleViewDetails = async (course: CourseItem) => {
    setViewCourse(course)
    setLoadingDetails(true)
    setCourseDetails(null)
    try {
      const res = await API.get(`/courses/${course.id}`)
      setCourseDetails(res.data)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('حدث خطأ أثناء تحميل تفاصيل الكورس.', 'error')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleDeleteCourse = async () => {
    if (!deleteCourseItem) return
    setDeleting(true)
    try {
      await API.delete(`/admin/courses/${deleteCourseItem.id}`)
      useModalStore.getState().showToast('تم حذف الكورس بنجاح.', 'success')
      setDeleteCourseItem(null)
      fetchCourses()
    } catch (err: any) {
      console.error(err)
      const errorMsg = err.response?.data?.message || 'حدث خطأ أثناء محاولة حذف الكورس.'
      useModalStore.getState().showToast(errorMsg, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const filteredCourses = courses.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.teacher.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesGrade = selectedGrade === 'all' || c.grade === selectedGrade
    const matchesSubject = selectedSubject === 'all' || c.subject === selectedSubject
    return matchesSearch && matchesGrade && matchesSubject
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 text-right" dir="rtl">
      
      {/* Title Bar & Filters */}
      <div className="flex flex-col gap-6 border-b border-[var(--border-color)] pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-100">إدارة الكورسات والمناهج</h1>
          <p className="text-sm text-slate-400 font-light mt-1">تصفح كافة المناهج والشروحات العلمية، وراجع محتوى الوحدات والدروس والامتحانات المرفوعة.</p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-brand-card p-4 rounded-2xl border border-[var(--border-color)]">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الكورس أو المدرس..."
              className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {/* Grade Filter */}
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">كل المراحل الدراسية</option>
              {Object.entries(GRADES_TRANSLATION).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>

            {/* Subject Filter */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">كل المواد التعليمية</option>
              {Object.entries(SUBJECTS_TRANSLATION).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin h-8 w-8 text-brand-primary" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <EmptyState
          type="courses"
          title="لا يوجد كورسات متاحة"
          description={searchQuery || selectedGrade !== 'all' || selectedSubject !== 'all' ? "لم نعثر على كورسات تطابق خيارات التصفية الحالية." : "لا تتوفر كورسات مسجلة على قاعدة البيانات حالياً."}
        />
      ) : (
        /* Courses Grid Table */
        <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead>
                <tr className="bg-[rgba(255,255,255,0.01)] border-b border-[var(--border-color)] text-slate-400">
                  <th className="p-4 sm:p-6 font-semibold">الكورس</th>
                  <th className="p-4 sm:p-6 font-semibold">المعلم</th>
                  <th className="p-4 sm:p-6 font-semibold">المادة والتخصص</th>
                  <th className="p-4 sm:p-6 font-semibold">المرحلة</th>
                  <th className="p-4 sm:p-6 font-semibold">السعر</th>
                  <th className="p-4 sm:p-6 font-semibold">المشتركون</th>
                  <th className="p-4 sm:p-6 font-semibold">الحالة</th>
                  <th className="p-4 sm:p-6 font-semibold">خيارات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] text-slate-300">
                {filteredCourses.map((c) => (
                  <tr key={c.id} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                    
                    {/* Cover & Title */}
                    <td className="p-4 sm:p-6 font-bold">
                      <div className="flex items-center gap-3">
                        <img
                          src={c.cover_image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100'}
                          alt={c.title}
                          className="h-10 w-16 object-cover rounded border border-[var(--border-color)] bg-slate-800"
                        />
                        <div className="text-slate-200 line-clamp-1 flex items-center gap-1.5 flex-wrap">
                          <span>{c.title}</span>
                          {(c.is_bundle === true || c.is_bundle === 1 || c.is_bundle === '1') && (
                            <span className="px-2 py-0.5 bg-brand-primary/15 border border-brand-primary/30 rounded text-[9px] font-bold text-brand-primary shrink-0">
                              📦 كورس مجمع
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Teacher Name */}
                    <td className="p-4 sm:p-6 font-medium text-slate-300">
                      {c.teacher.name}
                    </td>

                    {/* Subject */}
                    <td className="p-4 sm:p-6 font-semibold text-brand-primary">
                      {SUBJECTS_TRANSLATION[c.subject] || c.subject}
                    </td>

                    {/* Grade */}
                    <td className="p-4 sm:p-6 text-slate-400 text-xs font-light">
                      {GRADES_TRANSLATION[c.grade] || c.grade}
                    </td>

                    {/* Price */}
                    <td className="p-4 sm:p-6 font-bold text-emerald-500">
                      {parseFloat(c.price) === 0 ? 'مجاني' : `${c.price} ج.م`}
                    </td>

                    {/* Students Subscribed */}
                    <td className="p-4 sm:p-6 font-bold text-slate-300">
                      {c.students_count} طالب
                    </td>

                    {/* Status */}
                    <td className="p-4 sm:p-6 whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center h-6 min-h-[24px] max-h-[24px] w-fit px-2.5 rounded-full text-[10px] font-semibold border whitespace-nowrap leading-none shrink-0 text-center ${
                        c.is_published 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-brand-success'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                      }`}>
                        {c.is_published ? 'منشور للطلاب' : 'مسودة معلم'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 sm:p-6">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(c)}
                          className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                          title="عرض المنهج والدروس"
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={() => handleOpenLimitModal(c)}
                          className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-400 cursor-pointer"
                          title="حدود مشاهدة الكورس"
                        >
                          <Settings className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={() => setDeleteCourseItem(c)}
                          className="p-1.5 hover:bg-rose-500/10 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="حذف الكورس"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODALS & OVERLAYS
          ========================================================================== */}

      {/* 1. Syllabus View Audit Modal */}
      {viewCourse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/10 z-40" onClick={() => setViewCourse(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 max-w-3xl w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] z-50 text-right">
            
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-200">تدقيق محتوى منهج الكورس</h3>
                <p className="text-[11px] text-slate-400 font-light mt-0.5">{viewCourse.title} - إعداد {viewCourse.teacher.name}</p>
              </div>
              <button 
                onClick={() => setViewCourse(null)} 
                className="p-1.5 hover:bg-slate-800 rounded-xl cursor-pointer text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin h-8 w-8 text-brand-primary" />
              </div>
            ) : courseDetails ? (
              <div className="space-y-6">
                
                {/* General Header Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold block">الوحدات الدراسية</span>
                    <div className="text-base font-black text-brand-primary">{courseDetails.units?.length || 0} وحدة</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold block">الباقات الشهرية</span>
                    <div className="text-base font-black text-slate-200">{courseDetails.packages?.length || 0} باقة</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold block">سعر الكورس</span>
                    <div className="text-base font-black text-emerald-500">{viewCourse.price} ج.م</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold block">الطلاب المسجلون</span>
                    <div className="text-base font-black text-slate-200">{viewCourse.students_count} طالب</div>
                  </div>
                </div>

                {/* Course curriculum hierarchy */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-200">فهرس المحاضرات والملفات الدراسية:</h4>
                  
                  {courseDetails.units?.length === 0 ? (
                    <div className="text-center py-8 border border-slate-850 rounded-2xl text-xs text-slate-400 font-light">لا توجد وحدات دراسية مضافة بعد.</div>
                  ) : (
                    <div className="space-y-4">
                      {courseDetails.units.map((unit: any) => (
                        <div key={unit.id} className="bg-slate-900 border border-slate-850 p-4 rounded-2xl space-y-3">
                          <h5 className="text-xs font-black text-slate-100 bg-slate-950/60 p-2.5 rounded-lg border-r-4 border-brand-primary">
                            الوحـدة: {unit.title}
                          </h5>

                          {unit.lessons?.length === 0 ? (
                            <div className="text-[10px] text-slate-500 font-light mr-4">لا توجد محاضرات في هذه الوحدة.</div>
                          ) : (
                            <div className="space-y-3 mr-4">
                              {unit.lessons.map((lesson: any) => (
                                <div key={lesson.id} className="border border-slate-800 bg-slate-950/20 p-4 rounded-xl space-y-3">
                                  <div className="flex justify-between items-center">
                                    <h6 className="text-xs font-bold text-slate-200">{lesson.title}</h6>
                                    {lesson.is_locked && (
                                      <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">مقيد بالتقدم</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-light leading-normal">{lesson.description}</p>

                                  {/* Lesson Materials Auditing */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                    
                                    {/* Video list */}
                                    <div className="bg-slate-900/60 p-3 rounded-xl space-y-2 border border-slate-850">
                                      <span className="text-[9px] text-slate-400 font-bold block flex items-center gap-1">
                                        <Video className="h-3 w-3 text-brand-primary" />
                                        فيديو الشرح ({lesson.videos?.length || 0})
                                      </span>
                                      {lesson.videos?.map((vid: any) => (
                                        <div key={vid.id} className="space-y-1">
                                          <div className="text-[10px] text-slate-200 font-bold line-clamp-1">{vid.title}</div>
                                          {vid.bunny_embed_url && (
                                            <a 
                                              href={vid.bunny_embed_url} 
                                              target="_blank" 
                                              rel="noreferrer" 
                                              className="text-[9px] text-brand-primary hover:underline block"
                                            >
                                              رابط الفيديو المشغل
                                            </a>
                                          )}
                                        </div>
                                      ))}
                                    </div>

                                    {/* PDF list */}
                                    <div className="bg-slate-900/60 p-3 rounded-xl space-y-2 border border-slate-850">
                                      <span className="text-[9px] text-slate-400 font-bold block flex items-center gap-1">
                                        <FileText className="h-3 w-3 text-brand-primary" />
                                        مذكرات وملخصات ({lesson.pdfs?.length || 0})
                                      </span>
                                      {lesson.pdfs?.map((pdf: any) => (
                                        <div key={pdf.id} className="space-y-1">
                                          <div className="text-[10px] text-slate-200 font-bold line-clamp-1">{pdf.title}</div>
                                          {pdf.file_path && (
                                            <a 
                                              href={pdf.file_path} 
                                              target="_blank" 
                                              rel="noreferrer" 
                                              className="text-[9px] text-brand-primary hover:underline block font-mono"
                                            >
                                              تحميل الملف المرفق
                                            </a>
                                          )}
                                        </div>
                                      ))}
                                    </div>

                                    {/* Exams (Quizzes & Homeworks) */}
                                    <div className="bg-slate-900/60 p-3 rounded-xl space-y-2 border border-slate-850">
                                      <span className="text-[9px] text-slate-400 font-bold block flex items-center gap-1">
                                        <HelpCircle className="h-3 w-3 text-brand-primary" />
                                        الاختبارات والواجب ({lesson.exams?.length || 0})
                                      </span>
                                      {lesson.exams?.map((exam: any) => (
                                        <div key={exam.id} className="space-y-1">
                                          <div className="text-[10px] text-slate-200 font-bold line-clamp-1">{exam.title}</div>
                                          <span className="text-[8px] font-bold text-slate-500 bg-slate-950 p-1 py-0.5 rounded">
                                            {exam.type === 'homework' ? 'واجب منزلي' : exam.type === 'quiz' ? 'كويز سريع' : 'امتحان شامل'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 2. Delete Course Modal */}
      {deleteCourseItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/10 z-40" onClick={() => setDeleteCourseItem(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl z-50 text-right">
            <h3 className="text-lg font-black text-slate-200 flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              <span>تأكيد حذف الكورس</span>
            </h3>
            
            <p className="text-xs text-slate-300 font-light leading-relaxed">
              هل أنت متأكد من رغبتك في حذف الكورس <span className="font-bold text-rose-500">"{deleteCourseItem.title}"</span> بشكل نهائي؟ 
              هذا الإجراء سيحذف كافة المحاضرات، الملفات، الامتحانات، واشتراكات الطلاب التابعة له ولا يمكن استرجاعها.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCourseItem(null)}
                className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl text-slate-300 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteCourse}
                disabled={deleting}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'جاري الحذف...' : 'تأكيد الحذف النهائي'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Course Limit Override Modal */}
      {limitModalCourse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/70 z-40" onClick={() => setLimitModalCourse(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl z-50 text-right font-sans" dir="rtl">
            <h3 className="text-lg font-black text-slate-200 flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <Settings className="h-5 w-5 text-indigo-400" />
              <span>قيود مشاهدة الكورس: {limitModalCourse.title}</span>
            </h3>
            
            <form onSubmit={handleSaveLimitConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">حالة قيود المشاهدة للكورس:</label>
                <select
                  className="w-full px-4 py-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                  value={limitEnabledOverride}
                  onChange={(e) => setLimitEnabledOverride(e.target.value)}
                >
                  <option value="inherit">يرث الإعداد العام للمنصة (افتراضي)</option>
                  <option value="enable">تفعيل قيود المشاهدة دائماً لهذا الكورس</option>
                  <option value="disable">إلغاء قيود المشاهدة دائماً (مشاهدة غير محدودة)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">الحد الأقصى لعدد المشاهدات (اكتب -1 لغير محدود):</label>
                <input
                  type="number"
                  min={-1}
                  placeholder="اتركه فارغاً للافتراضي، أو اكتب -1 لمشاهدة غير محدودة"
                  className="w-full px-4 py-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-primary font-mono text-left"
                  value={limitMaxViews}
                  onChange={(e) => setLimitMaxViews(e.target.value)}
                />
                <p className="text-[10px] text-slate-500 mt-1">الحد الأقصى لعدد مرات مشاهدة الكورس لكل طالب مشترك (اكتب -1 لتجعل الكورس غير محدود المشاهدات).</p>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setLimitModalCourse(null)}
                  className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl text-slate-300 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingLimit}
                  className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingLimit ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
