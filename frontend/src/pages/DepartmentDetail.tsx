import React from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  GraduationCap, 
  Code, 
  TrendingUp, 
  Palette, 
  Globe, 
  Share2, 
  Briefcase, 
  BookOpen, 
  Users, 
  ArrowRight, 
  Search,
  Filter,
  Sparkles,
  Layers,
  Compass
} from 'lucide-react'
import API from '../services/api'
import SEO from '../components/SEO'
import CourseCard from '../components/ui/CourseCard'
import TeacherCard from '../components/ui/TeacherCard'
import { useTaxonomyStore, type Department, type AcademicStage } from '../store/taxonomyStore'

const ICON_COMPONENTS: Record<string, any> = {
  GraduationCap,
  Code,
  TrendingUp,
  Palette,
  Globe,
  Share2,
  Briefcase,
  BookOpen,
  Users,
  Sparkles,
  Layers,
  Compass
}

export default function DepartmentDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { getDepartment } = useTaxonomyStore()

  const [loading, setLoading] = React.useState(true)
  const [department, setDepartment] = React.useState<Department | null>(null)
  const [courses, setCourses] = React.useState<any[]>([])
  const [teachers, setTeachers] = React.useState<any[]>([])
  const [stages, setStages] = React.useState<AcademicStage[]>([])
  
  // View & Filter States
  const [activeTab, setActiveTab] = React.useState<'courses' | 'teachers'>('courses')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedGrade, setSelectedGrade] = React.useState('')
  const [selectedStage, setSelectedStage] = React.useState('')

  const fetchDepartmentData = React.useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const res = await API.get(`/departments/${slug}`)
      setDepartment(res.data.department)
      setCourses(Array.isArray(res.data.courses) ? res.data.courses : [])
      setTeachers(Array.isArray(res.data.teachers) ? res.data.teachers : [])
      setStages(Array.isArray(res.data.stages) ? res.data.stages : [])
    } catch (err: any) {
      console.error('Failed to fetch department details:', err)
      // Fallback from store if available
      const storeDept = getDepartment(slug)
      if (storeDept) {
        setDepartment(storeDept)
      }
    } finally {
      setLoading(false)
    }
  }, [slug, getDepartment])

  React.useEffect(() => {
    fetchDepartmentData()
  }, [fetchDepartmentData])

  const isSchool = slug === 'school' || slug === 'general_education'

  // Filter courses
  const filteredCourses = courses.filter((course) => {
    const matchSearch = 
      course.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.teacher?.name?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchGrade = !selectedGrade || course.grade === selectedGrade
    return matchSearch && matchGrade
  })

  // Filter teachers
  const filteredTeachers = teachers.filter((teacher) => {
    const matchSearch = 
      teacher.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teacher.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teacher.bio?.toLowerCase().includes(searchQuery.toLowerCase())

    return matchSearch
  })

  const getIconComponent = (iconName?: string) => {
    if (!iconName) return GraduationCap
    return ICON_COMPONENTS[iconName] || GraduationCap
  }

  const IconComp = getIconComponent(department?.icon)

  // Extract available grades from stages if school department
  const availableGrades = React.useMemo(() => {
    if (!stages || stages.length === 0) return []
    if (selectedStage) {
      const stage = stages.find(s => s.slug === selectedStage || String(s.id) === selectedStage)
      return stage?.active_grades || stage?.grades || []
    }
    return stages.flatMap(s => s.active_grades || s.grades || [])
  }, [stages, selectedStage])

  if (loading && !department) {
    return (
      <div className="min-h-screen bg-background py-16 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-bold text-slate-300">جاري تحميل بيانات القسم...</span>
        </div>
      </div>
    )
  }

  if (!department && !loading) {
    return (
      <div className="min-h-screen bg-background py-16 flex items-center justify-center text-right" dir="rtl">
        <div className="bg-brand-card border border-border-color rounded-3xl p-10 max-w-md text-center space-y-6">
          <Layers className="h-16 w-16 text-rose-500 mx-auto" />
          <h2 className="text-xl font-black text-foreground">القسم المطلوب غير موجود</h2>
          <p className="text-xs text-slate-400">يرجى التأكد من الرابط أو تصفح الأقسام المتاحة على المنصة.</p>
          <Link
            to="/departments"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white text-xs font-black rounded-2xl shadow-lg"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لجميع الأقسام</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-10 space-y-12 text-right" dir="rtl">
      <SEO 
        title={`${department?.name || 'القسم'} | منصة خطوتك`}
        description={department?.description || `تصفح كورسات ومعلمي قسم ${department?.name} على منصة خطوتك التعليمية.`}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* ====================================
            1. BREADCRUMBS & HERO BANNER
            ==================================== */}
        <div className="space-y-4">
          {/* Breadcrumb back */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Link to="/" className="hover:text-brand-primary transition-colors">الرئيسية</Link>
            <span>/</span>
            <Link to="/departments" className="hover:text-brand-primary transition-colors">الأقسام</Link>
            <span>/</span>
            <span className="text-brand-primary">{department?.name}</span>
          </div>

          {/* Hero Banner */}
          <div className="relative rounded-3xl overflow-hidden border border-border-color bg-gradient-to-br from-[var(--card-bg)]/90 via-[var(--bg-color)]/95 to-[var(--card-bg)]/90 p-8 sm:p-10 md:p-12 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-start sm:items-center gap-6 relative z-10">
              <div className="p-5 rounded-3xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-xl shrink-0">
                <IconComp className="h-10 w-10 sm:h-12 sm:w-12" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-4xl font-black text-foreground">{department?.name}</h1>
                  {department?.badge && (
                    <span className="px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-[10px] font-black rounded-full">
                      {department.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-300 font-light max-w-2xl leading-relaxed">
                  {department?.description || 'استكشف المناهج والكورسات مع نخبة من أفضل المعلمين المتخصصين في هذا المجال.'}
                </p>
              </div>
            </div>

            {/* Quick Stats Badges */}
            <div className="flex items-center gap-4 shrink-0 relative z-10 w-full md:w-auto justify-start md:justify-end">
              <div className="px-5 py-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-0.5 shadow-md">
                <span className="text-[10px] text-slate-400 font-bold block">الكورسات المتاحة</span>
                <span className="text-xl font-black text-brand-primary">{courses.length}</span>
              </div>
              <div className="px-5 py-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-0.5 shadow-md">
                <span className="text-[10px] text-slate-400 font-bold block">نخبة المعلمين</span>
                <span className="text-xl font-black text-accent">{teachers.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ====================================
            2. TABS & CONTROLS STUDIO
            ==================================== */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl shadow-lg">
          
          {/* Tabs Switcher */}
          <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('courses')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeTab === 'courses'
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>الكورسات والمحتوى ({filteredCourses.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('teachers')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeTab === 'teachers'
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>المعلمون والخبراء ({filteredTeachers.length})</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'courses' ? 'ابحث باسم الكورس أو المدرس...' : 'ابحث باسم المعلم أو التخصص...'}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-xs font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-primary"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* ====================================
            3. SCHOOL STAGES & GRADES FILTER (For School Dept)
            ==================================== */}
        {isSchool && activeTab === 'courses' && stages.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black text-slate-300">
              <Filter className="w-4 h-4 text-brand-primary" />
              <span>تصفية حسب المرحلة والصف الدراسي:</span>
            </div>

            {/* Stages Pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedStage('')
                  setSelectedGrade('')
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                  !selectedStage && !selectedGrade
                    ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                جميع المراحل
              </button>

              {stages.map((stg) => (
                <button
                  key={stg.id || stg.slug}
                  onClick={() => {
                    setSelectedStage(stg.slug)
                    setSelectedGrade('')
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                    selectedStage === stg.slug
                      ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {stg.name}
                </button>
              ))}
            </div>

            {/* Grades Pills */}
            {availableGrades.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/60">
                <button
                  onClick={() => setSelectedGrade('')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    !selectedGrade
                      ? 'bg-accent/20 text-accent border-accent/30'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  جميع الصفوف
                </button>

                {availableGrades.map((grd) => (
                  <button
                    key={grd.id || grd.slug}
                    onClick={() => setSelectedGrade(grd.slug)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      selectedGrade === grd.slug
                        ? 'bg-brand-primary/20 text-brand-primary border-brand-primary/30 font-black'
                        : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {grd.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====================================
            4. ACTIVE TAB CONTENT
            ==================================== */}
        <AnimatePresence mode="wait">
          {activeTab === 'courses' ? (
            <motion.div
              key="courses-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {filteredCourses.length === 0 ? (
                <div className="bg-brand-card border border-border-color rounded-3xl p-12 text-center space-y-4">
                  <BookOpen className="h-12 w-12 text-slate-500 mx-auto" />
                  <h3 className="text-lg font-black text-foreground">لا توجد كورسات متاحة حالياً في هذا القسم</h3>
                  <p className="text-xs text-slate-400">سيتم إضافة كورسات جديدة قريباً من قبل المعلمين المعتمدين.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      coverImage={course.cover_image}
                      price={course.price}
                      subject={course.subject}
                      teacherName={course.teacher?.name || ''}
                      teacherAvatar={course.teacher?.avatar}
                      enableDiscount={course.enable_discount}
                      discountType={course.discount_type}
                      discountValue={course.discount_value}
                      finalPrice={course.final_price}
                      grade={course.grade}
                      availability={course.availability}
                      lessonsCount={course.lessons_count}
                      isBundle={course.is_bundle}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="teachers-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {filteredTeachers.length === 0 ? (
                <div className="bg-brand-card border border-border-color rounded-3xl p-12 text-center space-y-4">
                  <Users className="h-12 w-12 text-slate-500 mx-auto" />
                  <h3 className="text-lg font-black text-foreground">لا يوجد معلمون في هذا القسم حالياً</h3>
                  <p className="text-xs text-slate-400">يمكنك استكشاف معلمي الأقسام الأخرى على المنصة.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTeachers.map((teacher) => (
                    <TeacherCard
                      key={teacher.id}
                      id={teacher.id}
                      name={teacher.name}
                      subject={teacher.subject}
                      avatar={teacher.avatar}
                      experience={teacher.experience}
                      coursesCount={teacher.published_courses_count || teacher.courses_count || 0}
                      teaching_mode={teacher.teaching_mode}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
