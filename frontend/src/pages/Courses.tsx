import React from 'react'
import { useSearchParams, useParams, useNavigate, Link } from 'react-router-dom'
import API from '../services/api'
import { Search, ChevronDown, GraduationCap } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import CourseCard from '../components/ui/CourseCard'
import PackageCard from '../components/ui/PackageCard'
import SEO from '../components/SEO'
import { useAuthStore } from '../store/authStore'
import { useTaxonomyStore } from '../store/taxonomyStore'

interface CourseItem {
  id: number
  title: string
  description: string
  cover_image: string
  price: string
  grade: string
  subject: string
  enable_discount?: boolean
  discount_type?: 'percentage' | 'fixed' | null
  discount_value?: number | null
  final_price?: number | null
  teacher: {
    name: string
    avatar?: string
    subject: string
  }
  availability?: 'online' | 'center' | 'both'
  lessons_count?: number
  is_bundle?: boolean | number | string
}

const SUBJECTS = [
  { key: 'chemistry', val: 'الكيمياء' },
  { key: 'physics', val: 'الفيزياء' },
  { key: 'integrated_science', val: 'علوم متكاملة' },
  { key: 'biology', val: 'الأحياء' },
  { key: 'math', val: 'الرياضيات' },
  { key: 'science', val: 'العلوم' },
  { key: 'arabic', val: 'اللغة العربية' },
  { key: 'english', val: 'اللغة الإنجليزية' },
]

const GRADE_MAP: Record<string, string> = {
  'first-preparatory': 'first_preparatory',
  'second-preparatory': 'second_preparatory',
  'third-preparatory': 'third_preparatory',
  'first-secondary': 'first_secondary',
  'second-secondary': 'second_secondary',
  'third-secondary': 'third_secondary',
  'first_preparatory': 'first_preparatory',
  'second_preparatory': 'second_preparatory',
  'third_preparatory': 'third_preparatory',
  'first_secondary': 'first_secondary',
  'second_secondary': 'second_secondary',
  'third_secondary': 'third_secondary',
  'grade-1-secondary': 'first_secondary',
  'grade-2-secondary': 'second_secondary',
  'grade-3-secondary': 'third_secondary',
}

const SUBJECT_MAP: Record<string, string> = {
  'chemistry': 'chemistry',
  'physics': 'physics',
  'integrated_science': 'integrated_science',
  'biology': 'biology',
  'math': 'math',
  'science': 'science',
  'arabic': 'arabic',
  'english': 'english',
}

interface CoursesProps {
  subjectDefault?: string
  gradeDefault?: string
}

export default function Courses({ subjectDefault, gradeDefault }: CoursesProps = {}) {
  const { user } = useAuthStore()
  const { departments, stages, grades, fetchTaxonomy, getGradeName, getDepartmentName } = useTaxonomyStore()
  const { subjectId, gradeId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [packages, setPackages] = React.useState<any[]>([])
  const [recommendedCourses, setRecommendedCourses] = React.useState<CourseItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetchTaxonomy()
  }, [fetchTaxonomy])
  
  const studentGradeKey = user?.grades?.[0] || ''
  const studentGradeVal = getGradeName(studentGradeKey)
  const hasGrade = !!studentGradeKey

  // Map and translate route param or prop defaults
  const resolvedGrade = React.useMemo(() => {
    const raw = gradeId || gradeDefault || searchParams.get('grade') || ''
    const mapped = GRADE_MAP[raw.toLowerCase().replace('_', '-')] || GRADE_MAP[raw.toLowerCase()]
    return mapped || raw
  }, [gradeId, gradeDefault, searchParams])

  const resolvedSubject = React.useMemo(() => {
    const raw = subjectId || subjectDefault || searchParams.get('subject') || ''
    const mapped = SUBJECT_MAP[raw.toLowerCase()]
    return mapped || raw
  }, [subjectId, subjectDefault, searchParams])

  const resolvedCategory = searchParams.get('category') || ''
  const searchQuery = searchParams.get('search') || ''

  React.useEffect(() => {
    setLoading(true)
    const params = `grade=${resolvedGrade}&subject=${resolvedSubject}&category=${resolvedCategory}&search=${searchQuery}`
    
    const fetchPromises: Promise<any>[] = [
      API.get(`/courses?${params}`),
      API.get(`/packages?${params}`)
    ]
    
    if (user && user.role === 'student') {
      fetchPromises.push(API.get('/student/recommended-courses'))
    }
    
    Promise.all(fetchPromises)
      .then(([coursesRes, packagesRes, recRes]) => {
        setCourses(coursesRes.data)
        setPackages(packagesRes.data)
        if (recRes) {
          setRecommendedCourses(recRes.data.recommended || [])
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [resolvedGrade, resolvedSubject, resolvedCategory, searchQuery, user])

  // Dynamic SEO Tag Info
  const seoInfo = React.useMemo(() => {
    const gradeText = getGradeName(resolvedGrade)
    const subjectText = SUBJECTS.find(s => s.key === resolvedSubject)?.val
    const categoryText = getDepartmentName(resolvedCategory)
    
    let title = 'تصفح الكورسات والمحاضرات'
    let description = 'استكشف المناهج والشروحات العلمية المتوفرة على منصة خطوتك لجميع المراحل التعليمية والتخصصات مع نخبة من أفضل الأساتذة.'
    
    if (gradeText && subjectText) {
      title = `كورسات مادة ${subjectText} - ${gradeText} | منصة خطوتك`
      description = `شروحات ومحاضرات مادة ${subjectText} لطلاب ${gradeText} على منصة خطوتك التعليمية. ابدأ التفوق اليوم.`
    } else if (gradeText) {
      title = `كورسات ${gradeText} | منصة خطوتك`
      description = `شروحات ومناهج دراسية متكاملة لطلاب ${gradeText} على منصة خطوتك التعليمية مع نخبة من الموجهين والمعلمين.`
    } else if (categoryText && categoryText !== 'التعليم المدرسي') {
      title = `دورات ${categoryText} | منصة خطوتك`
      description = `تصفح دورات وكورسات تخصص ${categoryText} على منصة خطوتك التعليمية.`
    } else if (subjectText) {
      title = `كورسات مادة ${subjectText} | منصة خطوتك`
      description = `شروحات ومحاضرات مادة ${subjectText} لجميع الصفوف على منصة خطوتك التعليمية.`
    }
    
    return { title, description }
  }, [resolvedGrade, resolvedSubject, resolvedCategory, getGradeName, getDepartmentName])

  const handleGradeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (gradeId || subjectId || subjectDefault || gradeDefault) {
      const nextParams = new URLSearchParams()
      if (val) nextParams.set('grade', val)
      if (resolvedSubject) nextParams.set('subject', resolvedSubject)
      if (searchQuery) nextParams.set('search', searchQuery)
      navigate(`/courses?${nextParams.toString()}`)
    } else {
      const nextParams = new URLSearchParams(searchParams)
      if (val) {
        nextParams.set('grade', val)
      } else {
        nextParams.delete('grade')
      }
      setSearchParams(nextParams)
    }
  }

  const handleSubjectFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (gradeId || subjectId || subjectDefault || gradeDefault) {
      const nextParams = new URLSearchParams()
      if (resolvedGrade) nextParams.set('grade', resolvedGrade)
      if (val) nextParams.set('subject', val)
      if (searchQuery) nextParams.set('search', searchQuery)
      navigate(`/courses?${nextParams.toString()}`)
    } else {
      const nextParams = new URLSearchParams(searchParams)
      if (val) {
        nextParams.set('subject', val)
      } else {
        nextParams.delete('subject')
      }
      setSearchParams(nextParams)
    }
  }

  const handleSearchChange = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const searchVal = formData.get('search-input') as string
    
    if (gradeId || subjectId || subjectDefault || gradeDefault) {
      const nextParams = new URLSearchParams()
      if (resolvedGrade) nextParams.set('grade', resolvedGrade)
      if (resolvedSubject) nextParams.set('subject', resolvedSubject)
      if (searchVal) nextParams.set('search', searchVal)
      navigate(`/courses?${nextParams.toString()}`)
    } else {
      const nextParams = new URLSearchParams(searchParams)
      if (searchVal) {
        nextParams.set('search', searchVal)
      } else {
        nextParams.delete('search')
      }
      setSearchParams(nextParams)
    }
  }

  const safeCourses = Array.isArray(courses) ? courses : []
  const safePackages = Array.isArray(packages) ? packages : []
  const safeRecommendedCourses = Array.isArray(recommendedCourses) ? recommendedCourses : []

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10 text-right" dir="rtl">
      <SEO 
        title={seoInfo.title}
        description={seoInfo.description}
      />
      
      {/* Header Banner */}
      <div className="bg-slate-950/80 border border-slate-800 p-8 rounded-[32px] shadow-xl relative overflow-hidden space-y-3">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <span className="px-3.5 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-black rounded-full inline-block">
          📚 دليل المناهج المتاحة
        </span>
        <h1 className="text-3xl sm:text-5xl font-black text-foreground">كورسات ومراجعات المنصة</h1>
        <p className="text-xs sm:text-sm text-slate-300 font-medium">تصفح المحتوى الدراسي المتاح لجميع المراحل واشترك مباشرة في دروس معلميك المفضلين</p>
      </div>

      {/* Filters & Search Studio */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-slate-950/80 border border-slate-800 p-5 rounded-2xl shadow-lg">
        
        {/* Dropdowns */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* Category */}
          <div className="relative w-full sm:w-56">
            <select
              value={resolvedCategory}
              onChange={(e) => {
                const nextParams = new URLSearchParams(searchParams)
                if (e.target.value) {
                  nextParams.set('category', e.target.value)
                } else {
                  nextParams.delete('category')
                }
                setSearchParams(nextParams)
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-brand-primary text-xs font-bold text-slate-200 cursor-pointer"
            >
              <option value="">جميع المجالات التعليمية</option>
              {departments.filter(d => d.is_active).map((dept) => (
                <option key={dept.id || dept.slug} value={dept.slug}>
                  {dept.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-slate-400" />
          </div>

          {/* Grade */}
          <div className="relative w-full sm:w-52">
            <select
              value={resolvedGrade}
              onChange={handleGradeFilterChange}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-brand-primary text-xs font-bold text-slate-200 cursor-pointer"
            >
              <option value="">جميع الصفوف الدراسية</option>
              {grades.filter(g => g.is_active).map((g) => (
                <option key={g.id || g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-slate-400" />
          </div>

          {/* Subject */}
          <div className="relative w-full sm:w-48">
            <select
              value={resolvedSubject}
              onChange={handleSubjectFilterChange}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-brand-primary text-xs font-bold text-slate-200 cursor-pointer"
            >
              <option value="">جميع المواد والتخصصات</option>
              {SUBJECTS.map((s) => (
                <option key={s.key} value={s.key}>{s.val}</option>
              ))}
            </select>
            <ChevronDown className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-slate-400" />
          </div>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchChange} className="w-full lg:w-96 flex gap-2">
          <div className="relative w-full">
            <input
              type="text"
              name="search-input"
              defaultValue={searchQuery}
              placeholder="ابحث باسم الكورس أو المدرس..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-4 py-3 text-xs font-bold text-slate-200 focus:outline-none focus:border-brand-primary placeholder:text-slate-500"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
          <button type="submit" className="px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-md shrink-0 cursor-pointer">
            بحث
          </button>
        </form>

      </div>

      {/* Student Recommendation Section */}
      {user && user.role === 'student' && (
        <div className="space-y-6 pt-4">
          {!hasGrade ? (
            <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl text-center space-y-3 shadow-md flex flex-col items-center justify-center">
              <GraduationCap className="h-10 w-10 text-indigo-400 animate-bounce" />
              <h3 className="text-base font-bold text-slate-200">أكمل ملفك الشخصي لاختيار الكورسات المناسبة لك</h3>
              <Link 
                to="/student/profile" 
                className="px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إكمال الملف الشخصي
              </Link>
            </div>
          ) : (
            safeRecommendedCourses.length > 0 && (
              <div className="space-y-6">
                {/* Banner Section */}
                <div className="p-6 sm:p-8 rounded-3xl text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                  }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_45%)] pointer-events-none"></div>
                  <div className="relative z-10 space-y-2 text-right w-full" dir="rtl">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-[10px] font-black tracking-wider uppercase">
                      ⭐ الكورسات المقترحة لك
                    </span>
                    <h2 className="text-2xl font-black">
                      ✨ كورسات مقترحة لطلاب {studentGradeVal}
                    </h2>
                  </div>
                </div>

                {/* Grid */}
                <div className="bastahalak-grid">
                  {safeRecommendedCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      coverImage={course.cover_image}
                      price={course.price}
                      subject={course.subject}
                      teacherName={course.teacher.name}
                      teacherAvatar={course.teacher.avatar}
                      enableDiscount={course.enable_discount === true}
                      discountType={course.discount_type ?? undefined}
                      discountValue={course.discount_value ?? undefined}
                      finalPrice={course.final_price ?? undefined}
                      grade={course.grade}
                      availability={course.availability}
                      lessonsCount={course.lessons_count}
                      isBundle={course.is_bundle === true || course.is_bundle === 1 || course.is_bundle === '1'}
                    />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
        </div>
      ) : safeCourses.length === 0 && safePackages.length === 0 ? (
        <EmptyState
          type="courses"
          title="لا توجد نتائج بحث مطابقة"
          description="لم نعثر على أي كورسات أو باقات تطابق خيارات التصفية المدخلة حالياً."
        />
      ) : (
        <div className="space-y-12">
          
          {/* Courses Section */}
          {safeCourses.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-xl font-black border-r-4 border-brand-primary pr-3 text-foreground">جميع الكورسات</h2>
              <div className="bastahalak-grid">
                {safeCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    coverImage={course.cover_image}
                    price={course.price}
                    subject={course.subject}
                    teacherName={course.teacher.name}
                    teacherAvatar={course.teacher.avatar}
                    enableDiscount={course.enable_discount === true}
                    discountType={course.discount_type ?? undefined}
                    discountValue={course.discount_value ?? undefined}
                    finalPrice={course.final_price ?? undefined}
                    grade={course.grade}
                    availability={course.availability}
                    lessonsCount={course.lessons_count}
                    isBundle={course.is_bundle === true || course.is_bundle === 1 || course.is_bundle === '1'}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Monthly Packages Section */}
          {safePackages.length > 0 && (
            <div className="space-y-6 pt-8 border-t border-border-color">
              <h2 className="text-xl font-black border-r-4 border-amber-500 pr-3 text-foreground">باقات مجمعة</h2>
              <div className="bastahalak-grid">
                {safePackages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    id={pkg.id}
                    title={pkg.title}
                    description={pkg.description}
                    price={pkg.price}
                    discount={pkg.discount}
                    originalLessonsTotal={pkg.original_lessons_total}
                    lessonsCount={pkg.lessons_count || pkg.lessons?.length || 0}
                    courseId={pkg.course_id}
                    courseTitle={pkg.course?.title || ''}
                    courseSubject={pkg.course?.subject || ''}
                    teacherName={pkg.course?.teacher?.name || ''}
                    teacherAvatar={pkg.course?.teacher?.avatar}
                    packageThumbnail={pkg.package_thumbnail}
                    coverImage={pkg.cover_image}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  )
}
