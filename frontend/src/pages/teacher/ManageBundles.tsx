import React from 'react'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { Plus, Edit3, Trash2, BookOpen, ChevronDown, Check, Loader2, Eye, ArrowRight, ArrowLeft, Image } from 'lucide-react'
import EmptyState from '../../components/EmptyState'

interface BundleItem {
  id: number
  title: string
  price: string
  description: string
  package_thumbnail?: string
  cover_image?: string
  type: string
  is_active: boolean
  lessons?: any[]
  lessons_count?: number
  enrollments_count?: number
}

interface CourseItem {
  id: number
  title: string
  subject: string
}

export default function ManageBundles() {
  const [bundles, setBundles] = React.useState<BundleItem[]>([])
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [showForm, setShowForm] = React.useState(false)
  
  // Step workflow: 1 = Choose Courses, 2 = Choose Lessons, 3 = Bundle Info
  const [step, setStep] = React.useState(1)
  
  // Selection states
  const [selectedCourseIds, setSelectedCourseIds] = React.useState<number[]>([])
  const [courseDetails, setCourseDetails] = React.useState<any[]>([]) // Detailed lessons from selected courses
  const [selectedLessonIds, setSelectedLessonIds] = React.useState<number[]>([])
  
  // Form states
  const [editMode, setEditMode] = React.useState<BundleItem | null>(null)
  const [bundleTitle, setBundleTitle] = React.useState('')
  const [bundlePrice, setBundlePrice] = React.useState('')
  const [bundleDesc, setBundleDesc] = React.useState('')
  const [bundleThumbnail, setBundleThumbnail] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)

  const [uploadingThumbnail, setUploadingThumbnail] = React.useState(false)
  const [isDragOver, setIsDragOver] = React.useState(false)

  // Fetch bundles and courses
  const loadData = async () => {
    setLoading(true)
    try {
      const [bundlesRes, coursesRes] = await Promise.all([
        API.get('/teacher/packages'),
        API.get('/teacher/courses')
      ])
      // Filter only type 'bundle'
      setBundles(bundlesRes.data.filter((pkg: any) => pkg.type === 'bundle'))
      setCourses(coursesRes.data)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل البيانات.', 'error')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadData()
  }, [])

  // Load lessons when courses are selected and teacher advances to Step 2
  const handleLoadLessonsForStep2 = async () => {
    if (selectedCourseIds.length === 0) {
      useModalStore.getState().showToast('يرجى اختيار كورس واحد على الأقل للمتابعة.', 'warning')
      return
    }
    setActionLoading(true)
    try {
      const details = await Promise.all(
        selectedCourseIds.map(async (cId) => {
          const res = await API.get(`/courses/${cId}`)
          return {
            courseId: cId,
            courseTitle: res.data.course.title,
            units: res.data.units || []
          }
        })
      )
      setCourseDetails(details)
      setStep(2)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل المحاضرات الخاصة بالكورسات المحددة.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateNewClick = () => {
    setEditMode(null)
    setBundleTitle('')
    setBundlePrice('')
    setBundleDesc('')
    setBundleThumbnail('')
    setIsActive(true)
    setSelectedCourseIds([])
    setSelectedLessonIds([])
    setCourseDetails([])
    setStep(1)
    setShowForm(true)
  }

  const handleEditClick = async (bundle: BundleItem) => {
    setEditMode(bundle)
    setBundleTitle(bundle.title)
    setBundlePrice(bundle.price)
    setBundleDesc(bundle.description || '')
    setBundleThumbnail(bundle.package_thumbnail || '')
    setIsActive(bundle.is_active)
    
    // Find courses of the lessons in the bundle
    const lessonIds = bundle.lessons ? bundle.lessons.map(l => l.id) : []
    setSelectedLessonIds(lessonIds)
    
    // Pre-select courses that these lessons belong to
    const courseIds = new Set<number>()
    if (bundle.lessons) {
      bundle.lessons.forEach(l => {
        if (l.unit && l.unit.course_id) {
          courseIds.add(l.unit.course_id)
        }
      })
    }
    const selectedIds = Array.from(courseIds)
    setSelectedCourseIds(selectedIds)
    
    setActionLoading(true)
    try {
      const details = await Promise.all(
        selectedIds.map(async (cId) => {
          const res = await API.get(`/courses/${cId}`)
          return {
            courseId: cId,
            courseTitle: res.data.course.title,
            units: res.data.units || []
          }
        })
      )
      setCourseDetails(details)
      setStep(1) // Start edit at step 1 in case they want to adjust courses
      setShowForm(true)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل تفاصيل الباقة للتعديل.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteClick = (bundleId: number) => {
    useModalStore.getState().showConfirm({
      title: 'حذف الباقة المجمعة',
      description: 'هل أنت متأكد من حذف هذه الباقة المجمعة نهائياً؟ لن يتمكن طلاب جدد من الاشتراك بها ولكن الطلاب المشتركون بالفعل سيحتفظون بالوصول.',
      confirmText: 'حذف الباقة',
      cancelText: 'إلغاء',
      type: 'delete',
      onConfirm: async () => {
        setLoading(true)
        try {
          await API.delete(`/teacher/packages/${bundleId}`)
          useModalStore.getState().showToast('تم حذف الباقة بنجاح.', 'success')
          loadData()
        } catch (err) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف الباقة.', 'error')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleToggleActive = async (bundle: BundleItem) => {
    try {
      const updatedStatus = !bundle.is_active
      await API.put(`/teacher/packages/${bundle.id}`, {
        title: bundle.title,
        price: bundle.price,
        description: bundle.description,
        package_thumbnail: bundle.package_thumbnail,
        type: 'bundle',
        is_active: updatedStatus,
        lesson_ids: bundle.lessons ? bundle.lessons.map(l => l.id) : []
      })
      useModalStore.getState().showToast(updatedStatus ? 'تم تنشيط الباقة بنجاح.' : 'تم إلغاء تنشيط الباقة.', 'success')
      loadData()
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تعديل حالة الباقة.', 'error')
    }
  }

  const toggleCourseSelection = (cId: number) => {
    setSelectedCourseIds(prev => 
      prev.includes(cId) ? prev.filter(id => id !== cId) : [...prev, cId]
    )
  }

  const toggleLessonSelection = (lId: number) => {
    setSelectedLessonIds(prev => 
      prev.includes(lId) ? prev.filter(id => id !== lId) : [...prev, lId]
    )
  }

  const handleSaveBundle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bundleTitle.trim()) {
      useModalStore.getState().showToast('يرجى كتابة عنوان للباقة.', 'warning')
      return
    }
    if (selectedLessonIds.length === 0) {
      useModalStore.getState().showToast('يرجى اختيار درس واحد على الأقل للباقة.', 'warning')
      return
    }

    setActionLoading(true)
    try {
      const payload = {
        title: bundleTitle,
        price: bundlePrice || '0.00',
        description: bundleDesc,
        package_thumbnail: bundleThumbnail,
        type: 'bundle',
        is_active: isActive,
        lesson_ids: selectedLessonIds,
      }

      if (editMode) {
        await API.put(`/teacher/packages/${editMode.id}`, payload)
        useModalStore.getState().showToast('تم تعديل الباقة المجمعة بنجاح.', 'success')
      } else {
        await API.post('/teacher/packages', payload)
        useModalStore.getState().showToast('تم إنشاء الباقة المجمعة بنجاح.', 'success')
      }

      setShowForm(false)
      loadData()
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('حدث خطأ أثناء حفظ الباقة.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-100">إدارة الباقات المجمعة</h1>
          <p className="text-sm text-slate-400 font-light mt-1">أنشئ باقات دراسية مستقلة تحتوي على دروس من كورسات مختلفة مع أسعار وتفاصيل مخصصة.</p>
        </div>
        <button
          onClick={handleCreateNewClick}
          className="px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-primary/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" /> <span>بناء باقة مجمعة جديدة</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
        </div>
      ) : bundles.length === 0 ? (
        <EmptyState
          type="courses"
          title="لا توجد باقات مجمعة بعد"
          description="يمكنك إنشاء باقة مجمعة جديدة لتجميع دروس مختلفة من عدة كورسات وبيعها كمنتج مستقل بسعر خاص."
          actionButton={
            <button
              onClick={handleCreateNewClick}
              className="px-6 py-3 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-lg"
            >
              أنشئ أول باقة مجمعة
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {bundles.map((pkg) => (
            <div 
              key={pkg.id} 
              className={`bg-brand-card border rounded-3xl overflow-hidden flex flex-col justify-between transition-all group ${
                pkg.is_active ? 'border-[var(--border-color)] hover:border-brand-primary/30' : 'border-slate-800 opacity-60'
              }`}
            >
              <div>
                {/* Cover Preview */}
                <div className="aspect-video bg-slate-900 relative overflow-hidden border-b border-[var(--border-color)]">
                  <img 
                    src={pkg.package_thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} 
                    alt={pkg.title} 
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform" 
                  />
                  <div className="absolute top-3 right-3 px-3 py-1 bg-black/80 rounded-full text-xs font-semibold text-brand-primary">
                    باقة مجمعة
                  </div>
                  <div className="absolute top-3 left-3 px-2 py-0.5 bg-brand-success/15 border border-brand-success/30 rounded-lg text-[10px] font-bold text-brand-success">
                    {pkg.price} ج.م
                  </div>
                </div>

                <div className="p-6 space-y-4 text-right">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold bg-slate-850 px-2 py-1 rounded-md">
                      📝 {pkg.lessons_count || pkg.lessons?.length || 0} دروس مشمولة
                    </span>
                    <button
                      onClick={() => handleToggleActive(pkg)}
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full border transition-all ${
                        pkg.is_active 
                          ? 'bg-brand-success/10 text-brand-success border-brand-success/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}
                    >
                      {pkg.is_active ? 'نشطة (اضغط للتعطيل)' : 'معطلة (اضغط للتنشيط)'}
                    </button>
                  </div>
                  
                  <h3 className="font-bold text-base text-slate-200 line-clamp-1 group-hover:text-brand-primary transition-colors">{pkg.title}</h3>
                  <p className="text-xs text-slate-400 font-light line-clamp-2 leading-relaxed">{pkg.description || 'لا يوجد وصف لهذه الباقة.'}</p>
                  
                  <div className="text-[10px] text-slate-500 border-t border-[var(--border-color)]/30 pt-3">
                    👥 عدد المشتركين بالباقة حالياً: <span className="font-bold text-slate-300">{pkg.enrollments_count || 0}</span> طالب
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="px-6 pb-6 pt-3 flex gap-2.5">
                <button
                  onClick={() => window.open(`/course/bundle-${pkg.id}?preview=true`, '_blank')}
                  className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Eye className="h-3.5 w-3.5" /> <span>معاينة</span>
                </button>
                <button
                  onClick={() => handleEditClick(pkg)}
                  className="flex-grow py-2 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Edit3 className="h-3.5 w-3.5" /> <span>تعديل</span>
                </button>
                <button
                  onClick={() => handleDeleteClick(pkg.id)}
                  className="py-2 px-3.5 bg-red-500/10 hover:bg-red-650 text-red-500 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center"
                  title="حذف الباقة"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bundle Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="fixed inset-0 bg-transparent" onClick={() => { if (!actionLoading) setShowForm(false) }} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-2xl w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] z-10 text-right">
            
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
              <h3 className="text-lg font-black text-slate-100">
                {editMode ? `تعديل الباقة: ${editMode.title}` : 'بناء باقة مجمعة جديدة'}
              </h3>
              
              {/* Step indicator */}
              <div className="flex gap-2">
                <span className={`h-2 w-8 rounded-full transition-all ${step >= 1 ? 'bg-brand-primary' : 'bg-slate-800'}`} />
                <span className={`h-2 w-8 rounded-full transition-all ${step >= 2 ? 'bg-brand-primary' : 'bg-slate-800'}`} />
                <span className={`h-2 w-8 rounded-full transition-all ${step >= 3 ? 'bg-brand-primary' : 'bg-slate-800'}`} />
              </div>
            </div>

            {/* STEP 1: Select Courses */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-200">الخطوة 1: اختر الكورسات الدراسية المشمولة</h4>
                  <p className="text-xs text-slate-400">حدد كورس واحد أو أكثر لاستيراد المحاضرات والدروس منها.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto p-1 bg-black/10 rounded-2xl border border-[var(--border-color)] p-4">
                  {courses.length === 0 ? (
                    <div className="col-span-2 text-center py-8 text-xs text-slate-500">لا توجد كورسات مضافة بعد لإنشاء باقة.</div>
                  ) : (
                    courses.map((course) => {
                      const isSelected = selectedCourseIds.includes(course.id)
                      return (
                        <button
                          type="button"
                          key={course.id}
                          onClick={() => toggleCourseSelection(course.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border text-right transition-all ${
                            isSelected 
                              ? 'border-brand-primary bg-brand-primary/5 text-slate-100 font-bold' 
                              : 'border-[var(--border-color)] text-slate-450 hover:bg-[rgba(255,255,255,0.01)]'
                          }`}
                        >
                          <span className="text-xs">{course.title}</span>
                          <span className={`h-4.5 w-4.5 rounded-md border flex items-center justify-center ${
                            isSelected ? 'bg-brand-primary border-brand-primary' : 'border-slate-700'
                          }`}>
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                  <button 
                    type="button" 
                    onClick={() => setShowForm(false)} 
                    className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="button"
                    onClick={handleLoadLessonsForStep2}
                    disabled={selectedCourseIds.length === 0 || actionLoading}
                    className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>جاري تحميل الدروس...</span>
                      </>
                    ) : (
                      <>
                        <span>التالي: اختيار المحاضرات</span>
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Choose Lessons */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-200">الخطوة 2: اختر المحاضرات والدروس لتضمينها بالباقة</h4>
                  <p className="text-xs text-slate-400">اختر الدروس المحددة التي سيحصل عليها الطالب عند شراء الباقة.</p>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto bg-black/10 rounded-2xl border border-[var(--border-color)] p-4">
                  {courseDetails.map((details) => (
                    <div key={details.courseId} className="space-y-2 border-b border-[var(--border-color)]/20 pb-4 last:border-0 last:pb-0">
                      <h5 className="font-bold text-xs text-brand-primary bg-brand-primary/5 px-2 py-1 rounded-md inline-block">
                        📚 كورس: {details.courseTitle}
                      </h5>
                      
                      {details.units.length === 0 ? (
                        <div className="text-[10px] text-slate-500 py-1 pr-3">لا توجد وحدات أو دروس مضافة في هذا الكورس.</div>
                      ) : (
                        details.units.map((unit: any) => (
                          <div key={unit.id} className="pr-4 space-y-1">
                            <div className="text-[11px] font-bold text-slate-355">📁 وحدة: {unit.title}</div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-3 pt-1">
                              {unit.lessons.length === 0 ? (
                                <div className="col-span-2 text-[10px] text-slate-500">لا توجد محاضرات في هذه الوحدة.</div>
                              ) : (
                                unit.lessons.map((lesson: any) => {
                                  const isChecked = selectedLessonIds.includes(lesson.id)
                                  return (
                                    <button
                                      type="button"
                                      key={lesson.id}
                                      onClick={() => toggleLessonSelection(lesson.id)}
                                      className={`flex items-center justify-between p-2 rounded-lg border text-right transition-colors ${
                                        isChecked 
                                          ? 'border-brand-primary bg-brand-primary/5 text-slate-100 font-bold' 
                                          : 'border-[var(--border-color)] text-slate-450 hover:bg-[rgba(255,255,255,0.01)]'
                                      }`}
                                    >
                                      <span className="text-[11px]">{lesson.title}</span>
                                      <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                        isChecked ? 'bg-brand-primary border-brand-primary' : 'border-slate-700'
                                      }`}>
                                        {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                                      </span>
                                    </button>
                                  )
                                })
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-[var(--border-color)]">
                  <button 
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>رجوع للخطوة 1</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      if (selectedLessonIds.length === 0) {
                        useModalStore.getState().showToast('يرجى اختيار درس واحد على الأقل للمتابعة.', 'warning')
                        return
                      }
                      setStep(3)
                    }}
                    className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1 cursor-pointer"
                  >
                    <span>التالي: تفاصيل الباقة السعرية</span>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Bundle Info */}
            {step === 3 && (
              <form onSubmit={handleSaveBundle} className="space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-200">الخطوة 3: حدد معلومات الباقة وسعر البيع</h4>
                  <p className="text-xs text-slate-400">أدخل تفاصيل تسويقية مخصصة مع السعر المناسب للباقة.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-350 block">عنوان الباقة المجمعة</label>
                    <input
                      type="text"
                      required
                      value={bundleTitle}
                      onChange={(e) => setBundleTitle(e.target.value)}
                      placeholder="مثال: باقة المراجعة النهائية في الفيزياء..."
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-350 block">سعر الباقة المستقلة (ج.م)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={bundlePrice}
                      onChange={(e) => setBundlePrice(e.target.value)}
                      placeholder="مثال: 150.00"
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-350 block">وصف الباقة المجمعة</label>
                    <textarea
                      value={bundleDesc}
                      onChange={(e) => setBundleDesc(e.target.value)}
                      placeholder="صف الباقة والمميزات التي سيحصل عليها الطالب..."
                      rows={3}
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none resize-none"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-350 block">رابط غلاف الباقة (اختياري)</label>
                    <input
                      type="text"
                      value={bundleThumbnail}
                      onChange={(e) => setBundleThumbnail(e.target.value)}
                      placeholder="رابط الصورة أو اتركها فارغة لاستخدام الصورة الافتراضية"
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                      dir="ltr"
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <label className="text-xs font-semibold text-slate-350 block">تحميل صورة غلاف الباقة (تحميل مباشر)</label>
                    
                    <div 
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={async (e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const formData = new FormData();
                          formData.append('file', file);
                          setUploadingThumbnail(true);
                          try {
                            const res = await API.post('/upload', formData, {
                              headers: { 'Content-Type': 'multipart/form-data' },
                            });
                            setBundleThumbnail(res.data.url);
                            useModalStore.getState().showToast('تم رفع صورة الباقة بنجاح.', 'success');
                          } catch (err) {
                            useModalStore.getState().showToast('فشل الرفع.', 'error');
                          } finally {
                            setUploadingThumbnail(false);
                          }
                        }
                      }}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                        isDragOver ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-800 bg-slate-900/10'
                      }`}
                    >
                      {bundleThumbnail ? (
                        <div className="space-y-3">
                          <img src={bundleThumbnail} alt="Preview" className="h-28 mx-auto rounded-xl object-cover aspect-video border border-slate-850" />
                          <button 
                            type="button" 
                            onClick={() => setBundleThumbnail('')}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black"
                          >
                            إزالة الصورة
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <span className="text-[10px] text-slate-400 block">اسحب صورة الغلاف وأفلتها هنا، أو اضغط على الزر أدناه</span>
                          <label className="inline-block px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow shadow-brand-primary/10">
                            <span>اختر صورة</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const formData = new FormData();
                                  formData.append('file', file);
                                  setUploadingThumbnail(true);
                                  try {
                                    const res = await API.post('/upload', formData, {
                                      headers: { 'Content-Type': 'multipart/form-data' },
                                    });
                                    setBundleThumbnail(res.data.url);
                                    useModalStore.getState().showToast('تم رفع صورة الباقة بنجاح.', 'success');
                                  } catch (err) {
                                    useModalStore.getState().showToast('فشل الرفع.', 'error');
                                  } finally {
                                    setUploadingThumbnail(false);
                                  }
                                }
                              }}
                            />
                          </label>
                          {uploadingThumbnail && (
                            <div className="text-[10px] text-brand-primary animate-pulse font-bold">جاري رفع الصورة...</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center justify-between p-4 bg-slate-900/10 border border-[var(--border-color)] rounded-2xl">
                    <div>
                      <h5 className="text-xs font-bold text-slate-200">حالة الباقة المجمعة</h5>
                      <p className="text-[10px] text-slate-400">حدد ما إذا كانت الباقة نشطة ومعروضة للبيع الفوري للطلاب.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isActive} 
                        onChange={(e) => setIsActive(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full rtl:peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-[var(--border-color)]">
                  <button 
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>رجوع للخطوة 2</span>
                  </button>

                  <button 
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>جاري حفظ الباقة...</span>
                      </>
                    ) : (
                      <span>{editMode ? 'حفظ التعديلات ونشر الباقة' : 'حفظ ونشر الباقة المجمعة'}</span>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
