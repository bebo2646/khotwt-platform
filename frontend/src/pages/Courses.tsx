import React from 'react'
import { useSearchParams, useParams, useNavigate, Link } from 'react-router-dom'
import API from '../services/api'
import { Search, ChevronDown, GraduationCap } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import CourseCard from '../components/ui/CourseCard'
import PackageCard from '../components/ui/PackageCard'
import SEO from '../components/SEO'
import { useAuthStore } from '../store/authStore'

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
}

const GRADES = [
  { key: 'first_preparatory', val: 'الصف الأول الإعدادي' },
  { key: 'second_preparatory', val: 'الصف الثاني الإعدادي' },
  { key: 'third_preparatory', val: 'الصف الثالث الإعدادي' },
  { key: 'first_secondary', val: 'الصف الأول الثانوي' },
  { key: 'second_secondary', val: 'الصف الثاني الثانوي' },
  { key: 'third_secondary', val: 'الصف الثالث الثانوي' },
]

const SUBJECTS = [
  { key: 'chemistry', val: 'الكيمياء' },
  { key: 'physics', val: 'الفيزياء' },
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
  const { subjectId, gradeId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [packages, setPackages] = React.useState<any[]>([])
  const [recommendedCourses, setRecommendedCourses] = React.useState<CourseItem[]>([])
  const [loading, setLoading] = React.useState(true)
  
  const studentGradeKey = user?.grades?.[0] || ''
  const studentGradeVal = GRADES.find(g => g.key === studentGradeKey)?.val || ''
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

  const searchQuery = searchParams.get('search') || ''

  React.useEffect(() => {
    setLoading(true)
    const params = `grade=${resolvedGrade}&subject=${resolvedSubject}&search=${searchQuery}`
    
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
  }, [resolvedGrade, resolvedSubject, searchQuery, user])

  // Dynamic SEO Tag Info
  const seoInfo = React.useMemo(() => {
    const gradeText = GRADES.find(g => g.key === resolvedGrade)?.val
    const subjectText = SUBJECTS.find(s => s.key === resolvedSubject)?.val
    
    let title = 'تصفح الكورسات والمحاضرات'
    let description = 'استكشف المناهج والشروحات العلمية المتوفرة على منصة خطوتك للمرحلتين الإعدادية والثانوية مع نخبة من أفضل الأساتذة.'
    
    if (gradeText && subjectText) {
      title = `كورسات مادة ${subjectText} - ${gradeText} | منصة خطوتك`
      description = `شروحات ومحاضرات مادة ${subjectText} لطلاب ${gradeText} على منصة خطوتك التعليمية. ابدأ التفوق اليوم.`
    } else if (gradeText) {
      title = `كورسات ${gradeText} | منصة خطوتك`
      description = `شروحات ومناهج دراسية متكاملة لطلاب ${gradeText} على منصة خطوتك التعليمية مع نخبة من الموجهين والمعلمين.`
    } else if (subjectText) {
      title = `كورسات مادة ${subjectText} | منصة خطوتك`
      description = `شروحات ومحاضرات مادة ${subjectText} لجميع الصفوف الإعدادية والثانوية على منصة خطوتك التعليمية.`
    }
    
    return { title, description }
  }, [resolvedGrade, resolvedSubject])

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
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <SEO 
        title={seoInfo.title}
        description={seoInfo.description}
      />
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black">كورسات ومراجعات المنصة</h1>
        <p className="text-sm text-text-secondary font-light mt-1">تصفح المحتوى الدراسي المتاح واشترك مباشرة</p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-brand-card border border-border-color p-4 rounded-2xl">
        
        {/* Dropdowns */}
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          {/* Grade */}
          <div className="relative w-full sm:w-56">
            <select
              value={resolvedGrade}
              onChange={handleGradeFilterChange}
              className="w-full bg-brand-surface border border-border-color rounded-xl px-4 py-2.5 appearance-none focus:outline-none focus:border-brand-primary text-xs font-semibold"
            >
              <option value="">جميع الصفوف الدراسية</option>
              {GRADES.map((g) => (
                <option key={g.key} value={g.key}>{g.val}</option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-slate-400" />
          </div>

          {/* Subject */}
          <div className="relative w-full sm:w-48">
            <select
              value={resolvedSubject}
              onChange={handleSubjectFilterChange}
              className="w-full bg-brand-surface border border-border-color rounded-xl px-4 py-2.5 appearance-none focus:outline-none focus:border-brand-primary text-xs font-semibold"
            >
              <option value="">جميع المواد العلمية</option>
              {SUBJECTS.map((s) => (
                <option key={s.key} value={s.key}>{s.val}</option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-slate-400" />
          </div>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchChange} className="w-full md:w-80 flex gap-2">
          <div className="relative w-full">
            <input
              type="text"
              name="search-input"
              defaultValue={searchQuery}
              placeholder="ابحث باسم الكورس..."
              className="w-full bg-brand-surface border border-border-color rounded-xl pr-10 pl-4 py-2.5 text-xs focus:outline-none focus:border-brand-primary"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold cursor-pointer">
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
