import React from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { Plus, Edit3, Trash2, BookOpen, Check, Loader2, ArrowLeft, Image as ImageIcon, FolderOpen } from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import { getCourseDisplayPrice } from '../../utils/pricing'

interface CourseItem {
  id: number
  title: string
  description: string
  cover_image: string
  price: string
  grade: string
  subject: string
  is_published: boolean
  is_bundle: boolean
  enable_discount?: boolean
  discount_type?: 'percentage' | 'fixed'
  discount_value?: string
  students_count?: number
}

export default function ManageBundles() {
  const navigate = useNavigate()
  const [bundles, setBundles] = React.useState<CourseItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  
  // Modal states
  const [showForm, setShowForm] = React.useState(false)
  const [editMode, setEditMode] = React.useState<CourseItem | null>(null)
  
  // Form states
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [coverImage, setCoverImage] = React.useState('')
  const [grade, setGrade] = React.useState('باقة مجمعة')
  const [subject, setSubject] = React.useState('الفيزياء')
  const [price, setPrice] = React.useState('')
  const [enableDiscount, setEnableDiscount] = React.useState(false)
  const [discountType, setDiscountType] = React.useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = React.useState('')
  const [isPublished, setIsPublished] = React.useState(true)
  
  // File upload state
  const [uploadingCover, setUploadingCover] = React.useState(false)
  const [isDragOver, setIsDragOver] = React.useState(false)

  const loadBundledCourses = async () => {
    setLoading(true)
    try {
      const res = await API.get('/teacher/courses')
      // Only keep courses where is_bundle === true (or 1)
      setBundles(res.data.filter((c: any) => c.is_bundle === true || c.is_bundle === 1 || c.is_bundle === '1'))
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل الكورسات المجمعة.', 'error')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadBundledCourses()
  }, [])

  const handleCreateNewClick = () => {
    setEditMode(null)
    setTitle('')
    setDescription('')
    setCoverImage('')
    setGrade('باقة مجمعة')
    setSubject('الفيزياء')
    setPrice('')
    setEnableDiscount(false)
    setDiscountType('percentage')
    setDiscountValue('')
    setIsPublished(true)
    setShowForm(true)
  }

  const handleEditClick = (course: CourseItem) => {
    setEditMode(course)
    setTitle(course.title)
    setDescription(course.description || '')
    setCoverImage(course.cover_image || '')
    setGrade(course.grade)
    setSubject(course.subject)
    setPrice(course.price)
    setEnableDiscount(!!course.enable_discount)
    setDiscountType(course.discount_type || 'percentage')
    setDiscountValue(course.discount_value || '')
    setIsPublished(!!course.is_published)
    setShowForm(true)
  }

  const handleDeleteClick = (courseId: number) => {
    useModalStore.getState().showConfirm({
      title: 'حذف الكورس المجمع',
      description: 'هل أنت متأكد من حذف هذا الكورس المجمع نهائياً؟ سيتم إلغاء تجميع الكورسات وبيعها، ولكن الطلاب المشتركون بالفعل سيحتفظون بالوصول.',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      type: 'delete',
      onConfirm: async () => {
        setLoading(true)
        try {
          await API.delete(`/teacher/courses/${courseId}`)
          useModalStore.getState().showToast('تم حذف الكورس المجمع بنجاح.', 'success')
          loadBundledCourses()
        } catch (err) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف الكورس المجمع.', 'error')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleCoverUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    setUploadingCover(true)
    try {
      const res = await API.post('/teacher/videos/signed-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setCoverImage(res.data.url)
      useModalStore.getState().showToast('تم رفع الصورة بنجاح.', 'success')
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل رفع الصورة.', 'error')
    } finally {
      setUploadingCover(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleCoverUpload(file)
    }
  }

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      useModalStore.getState().showToast('يرجى كتابة عنوان الكورس المجمع.', 'warning')
      return
    }

    setActionLoading(true)
    try {
      const payload = {
        title,
        description,
        cover_image: coverImage,
        grade,
        subject,
        price: price || '0.00',
        enable_discount: enableDiscount,
        discount_type: discountType,
        discount_value: discountValue || null,
        is_published: isPublished,
        is_bundle: true
      }

      let courseId: number

      if (editMode) {
        await API.put(`/teacher/courses/${editMode.id}`, payload)
        courseId = editMode.id
        useModalStore.getState().showToast('تم تعديل تفاصيل الكورس المجمع بنجاح.', 'success')
        setShowForm(false)
        loadBundledCourses()
      } else {
        const res = await API.post('/teacher/courses', payload)
        courseId = res.data.id
        useModalStore.getState().showToast('تم إنشاء الكورس المجمع بنجاح. جاري توجيهك لربط الكورسات القائمة...', 'success')
        setShowForm(false)
        // Redirect to the course details editor immediately with the course preselected
        navigate(`/teacher/courses?course_id=${courseId}`)
      }
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('حدث خطأ أثناء حفظ الكورس المجمع.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 text-right" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-100">إدارة الكورسات المجمعة</h1>
          <p className="text-sm text-slate-400 font-light mt-1">أنشئ كورسات مجمعة مستقلة تحتوي على كورس كامل أو أكثر مع أسعار وتفاصيل مخصصة.</p>
        </div>
        <button
          onClick={handleCreateNewClick}
          className="px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-primary/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" /> <span>➕ إنشاء كورس مجمع جديد</span>
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
          title="لا توجد كورسات مجمعة بعد"
          description="يمكنك إنشاء كورس مجمع جديد لتجميع كورسات كاملة وبيعها كمنتج مستقل بسعر خاص."
          actionButton={
            <button
              onClick={handleCreateNewClick}
              className="px-6 py-3 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
            >
              أنشئ أول كورس مجمع
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {bundles.map((course) => (
            <div 
              key={course.id} 
              className={`bg-brand-card border rounded-3xl overflow-hidden flex flex-col justify-between transition-all group ${
                course.is_published ? 'border-[var(--border-color)] hover:border-brand-primary/30' : 'border-slate-800 opacity-60'
              }`}
            >
              <div>
                {/* Cover Preview */}
                <div className="aspect-video bg-slate-900 relative overflow-hidden border-b border-[var(--border-color)]">
                  <img 
                    src={course.cover_image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} 
                    alt={course.title} 
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform" 
                  />
                  <div className="absolute top-3 right-3 px-3 py-1 bg-black/80 rounded-full text-xs font-semibold text-brand-primary">
                    كورس مجمع
                  </div>
                  <div className="absolute top-3 left-3 px-2 py-0.5 bg-brand-success/15 border border-brand-success/30 rounded-lg text-[10px] font-bold text-brand-success">
                    {course.price} ج.م
                  </div>
                </div>

                {/* Details */}
                <div className="p-6 space-y-3">
                  <div className="space-y-1">
                    <h3 className="font-black text-base text-slate-100 group-hover:text-brand-primary transition-colors truncate">{course.title}</h3>
                    <p className="text-xs text-slate-400 font-light line-clamp-2 min-h-[2rem] leading-relaxed">{course.description}</p>
                  </div>

                  <div className="flex gap-2 items-center flex-wrap pt-2 border-t border-[var(--border-color)]/20 text-[10px] text-slate-400">
                    <span className="bg-slate-850 px-2 py-0.5 rounded">{course.grade}</span>
                    <span className="bg-slate-850 px-2 py-0.5 rounded">{course.subject}</span>
                    <span>•</span>
                    <span>{course.students_count || 0} طالب</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 pt-0 border-t border-[var(--border-color)]/20 mt-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => navigate(`/teacher/courses?course_id=${course.id}`)}
                  className="flex-grow py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-[var(--border-color)]"
                >
                  <FolderOpen className="h-4 w-4 text-brand-primary" />
                  <span>تعديل المحتوى والربط</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditClick(course)}
                    className="p-2.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer border border-[var(--border-color)]"
                    title="تعديل التفاصيل"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(course.id)}
                    className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all cursor-pointer border border-rose-550/20"
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Course Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto bg-slate-950/80">
          <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-2xl w-full space-y-6 shadow-2xl relative text-right animate-scale-up" dir="rtl">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
              <h3 className="text-xl font-black text-slate-100">
                {editMode ? 'تعديل تفاصيل الكورس المجمع' : 'إنشاء كورس مجمع جديد'}
              </h3>
              <button 
                onClick={() => setShowForm(false)} 
                className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-5">
              
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-350">عنوان الكورس المجمع</label>
                <input 
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: باقة الفيزياء للترم الأول 2027"
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-350">وصف قصير</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف مميزات الكورس المجمع والمواد المشمولة به..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary h-24 resize-none"
                />
              </div>

              {/* Cover Image */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-350">صورة غلاف الكورس المجمع</label>
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                    isDragOver ? 'border-brand-primary bg-brand-primary/5' : 'border-[var(--border-color)]'
                  }`}
                >
                  {uploadingCover ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <Loader2 className="h-8 w-8 text-brand-primary animate-spin" />
                      <span className="text-xs text-slate-400">جاري رفع الصورة...</span>
                    </div>
                  ) : coverImage ? (
                    <div className="space-y-3">
                      <div className="aspect-video max-w-xs mx-auto rounded-lg overflow-hidden border border-[var(--border-color)]">
                        <img src={coverImage} alt="غلاف الكورس" className="w-full h-full object-cover" />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setCoverImage('')}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        إزالة الغلاف
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ImageIcon className="h-8 w-8 text-slate-650 mx-auto" />
                      <div className="text-xs text-slate-400 font-light">اسحب الصورة وأفلتها هنا أو اضغط للاختيار</div>
                      <label className="inline-block px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-200 border border-[var(--border-color)] rounded-xl text-xs font-bold cursor-pointer transition-all">
                        <span>اختر صورة الغلاف</span>
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleCoverUpload(file)
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Grade and Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-355">السنة الدراسية (الفرقة)</label>
                  <div className="w-full bg-slate-905/30 border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-400 select-none">
                    {editMode ? grade : 'سيتم تحديدها تلقائياً عند ربط الكورسات'}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-355">المادة الدراسية</label>
                  <input 
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="مثال: الفيزياء، الكيمياء..."
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Pricing & Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-color)]/20">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-355">سعر البيع (ج.م)</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none text-left"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                    <input 
                      type="checkbox"
                      checked={enableDiscount}
                      onChange={(e) => setEnableDiscount(e.target.checked)}
                      className="rounded border-slate-700 text-brand-primary focus:ring-brand-primary"
                    />
                    <span>تفعيل نسبة خصم خاصة</span>
                  </label>
                </div>
              </div>

              {/* Discount Details */}
              {enableDiscount && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-900/10 border border-[var(--border-color)]/40 rounded-2xl animate-slide-down">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-355">نوع الخصم</label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                      className="w-full bg-slate-950 border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="percentage">نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت (ج.م)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-355">قيمة الخصم</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'percentage' ? 'مثال: 15' : 'مثال: 50'}
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              {/* Status Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                  <input 
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="rounded border-slate-700 text-brand-primary focus:ring-brand-primary"
                  />
                  <span>نشر الكورس المجمع وتفعيله للبيع مباشرة</span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border-color)]">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="px-5 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <span>{editMode ? 'حفظ التعديلات' : 'التالي: ربط الكورسات'}</span>
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
