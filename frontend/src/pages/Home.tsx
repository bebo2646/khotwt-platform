import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import API from '../services/api'
import { 
  BookOpen, 
  Users, 
  Award, 
  ChevronDown, 
  Sparkles, 
  HelpCircle, 
  ArrowRight, 
  Play, 
  CheckCircle, 
  ChevronLeft, 
  ArrowUpRight,
  ShieldCheck,
  Video,
  Wallet,
  Zap,
  GraduationCap,
  Search,
  Filter,
  CheckCircle2,
  SlidersHorizontal,
  Flame,
  Star,
  Code,
  TrendingUp,
  Palette,
  Globe,
  Share2,
  Briefcase,
  Layers
} from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { useAuthStore } from '../store/authStore'
import { motion, AnimatePresence } from 'framer-motion'
import CourseCard from '../components/ui/CourseCard'
import TeacherCard from '../components/ui/TeacherCard'
import SEO from '../components/SEO'
import EducationalHeroBackground from '../components/ui/EducationalHeroBackground'
import { useTaxonomyStore } from '../store/taxonomyStore'

interface HomeStats {
  teachers_count: number
  courses_count: number
  students_count: number
  lessons_count?: number
  courses_and_lessons_count?: number
}

interface CourseItem {
  id: number
  title: string
  slug?: string
  description: string
  cover_image: string
  price: string
  grade: string
  subject: string
  category?: string
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
  child_courses?: Array<{ id: number; title: string; price?: number | string; final_price?: number | string }>
  bundle_original_price?: number | string | null
  bundle_savings?: number | string | null
}

interface TeacherItem {
  id: number
  name: string
  subject: string
  category?: string
  avatar?: string
  experience: string
  bio: string
  students_count?: number
  slug?: string
  published_courses_count?: number
  teaching_mode?: 'online' | 'center' | 'both'
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
  ecommerce: 'التجارة الإلكترونية',
  project_mgmt: 'إدارة المشاريع',
  accounting: 'المحاسبة والمالية',
  entrepreneurship: 'ريادة الأعمال',
  ui_ux: 'تصميم الواجهات UI/UX',
  graphic_design: 'التصميم الجرافيكي',
  motion_graphics: 'المونتاج والموشن جرافيك',
  english_business: 'الإنجليزية للأعمال',
  freelancing: 'العمل الحر',
}

const CATEGORY_ICONS: Record<string, any> = {
  school: GraduationCap,
  programming: Code,
  business: TrendingUp,
  design: Palette,
  languages: Globe,
  marketing: Share2,
  skills: Briefcase,
}

const formatStatCount = (count?: number | null) => {
  const rounded = Math.max(10, Math.ceil(Number(count || 0) / 10) * 10)
  return `+${rounded.toLocaleString()}`
}

export default function Home() {
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuthStore()
  const { departments, grades, fetchTaxonomy } = useTaxonomyStore()

  React.useEffect(() => {
    fetchTaxonomy()
  }, [fetchTaxonomy])
  
  // States
  const [stats, setStats] = React.useState<HomeStats | null>(null)
  const [featuredCourses, setFeaturedCourses] = React.useState<CourseItem[]>([])
  const [popularTeachers, setPopularTeachers] = React.useState<TeacherItem[]>([])
  const [loading, setLoading] = React.useState(true)

  // Multi-Category Cascading Filter States
  const [selectedCategory, setSelectedCategory] = React.useState('all')
  const [selectedGrade, setSelectedGrade] = React.useState('')
  const [subjects, setSubjects] = React.useState<string[]>([])
  const [selectedSubject, setSelectedSubject] = React.useState('')
  const [filteredTeachers, setFilteredTeachers] = React.useState<TeacherItem[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = React.useState('')
  const [filterResults, setFilterResults] = React.useState<CourseItem[]>([])
  const [filterLoading, setFilterLoading] = React.useState(false)

  // Redirect if logged in
  React.useEffect(() => {
    if (isLoggedIn && user) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else if (user.role === 'teacher') {
        navigate('/teacher/dashboard', { replace: true })
      } else if (user.role === 'student') {
        navigate('/student/dashboard', { replace: true })
      }
    }
  }, [isLoggedIn, user, navigate])

  // Fetch initial home data
  React.useEffect(() => {
    API.get('/home')
      .then((res) => {
        setStats(res.data.stats)
        setFeaturedCourses(res.data.featured_courses)
        setPopularTeachers(res.data.popular_teachers)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  // Handle Category Selection
  const handleCategorySelect = async (catKey: string) => {
    setSelectedCategory(catKey)
    setSelectedGrade('')
    setSelectedSubject('')
    setFilteredTeachers([])
    setSelectedTeacherId('')
    setFilterResults([])
    setSubjects([])

    if (catKey === 'all') return

    // If it's a non-school category, fetch subjects/specializations automatically
    if (catKey !== 'school') {
      setFilterLoading(true)
      try {
        const res = await API.get(`/filter/subjects?category=${catKey}`)
        const fetchedSubs = Array.isArray(res.data) ? res.data : []
        setSubjects(fetchedSubs)
      } catch (err) {
        console.error(err)
      } finally {
        setFilterLoading(false)
      }
    }
  }

  // Cascade 1: Grade -> Subjects (for School Category)
  const fetchSubjectsForGrade = async (grade: string) => {
    setSelectedGrade(grade)
    setSelectedSubject('')
    setFilteredTeachers([])
    setSelectedTeacherId('')
    setFilterResults([])
    setSubjects([])

    if (!grade) return

    setFilterLoading(true)
    try {
      const res = await API.get(`/filter/subjects?grade=${grade}&category=${selectedCategory}`)
      setSubjects(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setFilterLoading(false)
    }
  }

  // Cascade 2: Subject -> Teachers
  const fetchTeachersForSubject = async (subject: string) => {
    setSelectedSubject(subject)
    setFilteredTeachers([])
    setSelectedTeacherId('')
    setFilterResults([])

    if (!subject) return

    setFilterLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedGrade) params.set('grade', selectedGrade)
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
      if (subject) params.set('subject', subject)

      const res = await API.get(`/filter/teachers?${params.toString()}`)
      setFilteredTeachers(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setFilterLoading(false)
    }
  }

  // Cascade 3: Teacher -> Courses
  const fetchCoursesForTeacher = async (teacherId: string) => {
    setSelectedTeacherId(teacherId)
    setFilterResults([])

    if (!teacherId) return

    setFilterLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedGrade) params.set('grade', selectedGrade)
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
      if (selectedSubject) params.set('subject', selectedSubject)
      params.set('teacher_id', teacherId)

      const res = await API.get(`/courses?${params.toString()}`)
      setFilterResults(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setFilterLoading(false)
    }
  }

  const safeFeaturedCourses = Array.isArray(featuredCourses) ? featuredCourses : []
  const safePopularTeachers = Array.isArray(popularTeachers) ? popularTeachers : []
  const safeSubjects = Array.isArray(subjects) ? subjects : []
  const safeFilteredTeachers = Array.isArray(filteredTeachers) ? filteredTeachers : []
  const safeFilterResults = Array.isArray(filterResults) ? filterResults : []

  return (
    <div className="bg-background text-foreground space-y-24 pb-20 overflow-x-hidden font-sans relative z-0 text-right" dir="rtl">
      <SEO 
        title="الرئيسية | منصة خطوتك التعليمية متعددة المجالات"
        description="خطوتك هي منصتك الشاملة للتعلم في مصر والعالم العربي: مناهج مرحلة التعليم المدرسي، البرمجة والتكنولوجيا، التجارة والأعمال، التصميم، اللغات، والتسويق الرقمي."
        keywords="خطوتك, منصة خطوتك, منصة تعليمية, شرح ثانوية عامة, تعلم البرمجة, كورسات تصميم, كورسات تجارة وأعمال"
        schema={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": "https://elm-platform.com/#website",
              "url": "https://elm-platform.com",
              "name": "منصة خطوتك التعليمية",
              "description": "منصة تعليمية متعددة المجالات: مناهج دراسية، برمجة، أعمال، تصميم ولغات"
            },
            {
              "@type": "Organization",
              "@id": "https://elm-platform.com/#organization",
              "name": "منصة خطوتك التعليمية",
              "url": "https://elm-platform.com",
              "logo": "https://elm-platform.com/favicon.ico",
              "image": "https://elm-platform.com/og-image.jpg",
              "description": "خطوتك منصة تعليمية متكاملة تتيح الاستكشاف والالتحاق بكورسات التعليم المدرسي والبرمجة والأعمال والتصميم مع النخبة."
            }
          ]
        }}
      />
      
      {/* Animated Ambient Background */}
      <EducationalHeroBackground />

      {/* =========================================================================
          1. HERO EXPERIENCE: MULTI-CATEGORY ART-DIRECTED COMPOSITION
         ========================================================================= */}
      <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden z-10">
        
        <div className="absolute top-1/4 right-1/2 translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-tr from-brand-primary/20 via-brand-secondary/15 to-transparent rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse"></div>
        
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Top Ticker Bar */}
          <motion.div 
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center mb-8"
          >
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[var(--surface-bg)] border border-[var(--border-color)] text-xs font-black shadow-sm backdrop-blur-md">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
              </span>
              <span className="text-[var(--text-secondary)]">منصة خطوتك 2.0 • منصة تعلّم شاملة في المناهج المدرسية، البرمجة، الأعمال والمهارات</span>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
          </motion.div>

          {/* Main Hero Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 xl:gap-16 items-center">
            
            {/* Right Side: Primary Messaging & CTAs */}
            <div className="lg:col-span-7 space-y-8 text-right">
              
              <motion.div 
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="space-y-4"
              >
                <h1 className="text-4xl sm:text-6xl xl:text-7xl font-black tracking-tight leading-[1.15] text-foreground">
                  استكشف شغفك، اكتسب مهاراتك، واصنع مستقبلك مع <span className="bg-gradient-to-r from-brand-primary via-indigo-500 to-brand-secondary bg-clip-text text-transparent drop-shadow-sm">خطوتك</span>
                </h1>
                
                <p className="text-base sm:text-xl text-[var(--text-secondary)] font-medium leading-relaxed max-w-2xl">
                  منصة تعليمية مصممة لكل متعلم شغوف: تجمع لك دروس المرحلة المدرسية (الإعدادية والثانوية) إلى جانب مجالات البرمجة والتكنولوجيا، التجارة والأعمال، التصميم، واللغات مع نخبة الخبراء.
                </p>
              </motion.div>

              {/* Category Badges Pills preview in Hero */}
              <div className="flex flex-wrap gap-2 pt-1">
                {departments.filter(d => d.is_active).map((cat) => (
                  <button
                    key={cat.id || cat.slug}
                    onClick={() => {
                      handleCategorySelect(cat.slug)
                      const el = document.getElementById('advanced-filter')
                      if (el) el.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[var(--surface-bg)] hover:bg-brand-primary/10 border border-[var(--border-color)] hover:border-brand-primary/40 text-xs font-bold text-[var(--text-secondary)] hover:text-brand-primary transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="flex flex-wrap gap-4 pt-2"
              >
                <Link 
                  to="/courses" 
                  className="px-8 py-4 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-2xl font-black text-sm shadow-xl shadow-brand-primary/25 hover:shadow-brand-primary/40 active:scale-95 transition-all flex items-center gap-2.5 group cursor-pointer"
                >
                  <span>تصفح الكورسات والمجالات</span>
                  <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                </Link>

                <a 
                  href="#categories-explore" 
                  className="px-8 py-4 bg-[var(--surface-bg)] hover:bg-[var(--border-color)]/20 border border-[var(--border-color)] rounded-2xl font-black text-sm text-[var(--text-color)] hover:border-brand-primary/40 active:scale-95 transition-all flex items-center gap-2.5 shadow-sm"
                >
                  <Layers className="h-4.5 w-4.5 text-brand-primary" />
                  <span>استكشف المجالات</span>
                </a>
              </motion.div>

              {/* Trust Badges */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="pt-4 flex flex-wrap items-center gap-6 border-t border-[var(--border-color)] text-xs font-bold text-[var(--text-muted)]"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
                  <span>فيديوهات محمية بدقة HD</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 text-indigo-500" />
                  <span>امتحانات وتدريبات تفاعلية</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4.5 w-4.5 text-amber-500" />
                  <span>تفعيل فوري بالأكواد والمحفظة</span>
                </div>
              </motion.div>

            </div>

            {/* Left Side: Original Stats Block */}
            <div className="lg:col-span-5 relative">
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="relative bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[32px] p-6 sm:p-8 shadow-xl space-y-6 overflow-hidden backdrop-blur-xl"
              >
                <div className="absolute top-0 left-0 w-48 h-48 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4">
                  <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-black">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-foreground">أرقامنا بتتكلم</h3>
                    <p className="text-xs text-[var(--text-muted)] font-medium">إحصائيات حية ومباشرة من قاعدة بيانات المنصة</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Card 1: Students */}
                  <div className="p-5 bg-[var(--bg-color)]/60 border border-[var(--border-color)] rounded-2xl flex items-center gap-4 text-right hover:border-brand-primary/30 transition-all group">
                    <div className="p-3.5 bg-brand-primary/10 text-brand-primary rounded-2xl group-hover:bg-brand-primary group-hover:text-white transition-all shrink-0">
                      <Users className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-sm text-[var(--text-color)]">الطلاب المستفيدون</span>
                        {loading ? (
                          <div className="h-8 w-12 bg-[var(--border-color)]/50 animate-pulse rounded-lg" />
                        ) : (
                          <span className="text-2xl font-black text-brand-primary">{formatStatCount(stats?.students_count)}</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] font-normal mt-0.5">طالب يدرس ويتفوق معنا عبر المنصة</p>
                    </div>
                  </div>

                  {/* Card 2: Courses & Lectures */}
                  <div className="p-5 bg-[var(--bg-color)]/60 border border-[var(--border-color)] rounded-2xl flex items-center gap-4 text-right hover:border-brand-secondary/30 transition-all group">
                    <div className="p-3.5 bg-brand-secondary/10 text-brand-secondary rounded-2xl group-hover:bg-brand-secondary group-hover:text-white transition-all shrink-0">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-sm text-[var(--text-color)]">الكورسات والمحاضرات</span>
                        {loading ? (
                          <div className="h-8 w-12 bg-[var(--border-color)]/50 animate-pulse rounded-lg" />
                        ) : (
                          <span className="text-2xl font-black text-brand-secondary">
                            {formatStatCount(stats?.courses_and_lessons_count ?? (Number(stats?.courses_count || 0) + Number(stats?.lessons_count || 0)))}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] font-normal mt-0.5">محاضرة وكورس مسجل وشروحات شاملة</p>
                    </div>
                  </div>

                  {/* Card 3: Teachers */}
                  <div className="p-5 bg-[var(--bg-color)]/60 border border-[var(--border-color)] rounded-2xl flex items-center gap-4 text-right hover:border-emerald-500/30 transition-all group">
                    <div className="p-3.5 bg-emerald-500/10 text-emerald-500 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all shrink-0">
                      <Award className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-sm text-[var(--text-color)]">نخبة المعلمين والخبراء</span>
                        {loading ? (
                          <div className="h-8 w-12 bg-[var(--border-color)]/50 animate-pulse rounded-lg" />
                        ) : (
                          <span className="text-2xl font-black text-emerald-500">{formatStatCount(stats?.teachers_count)}</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] font-normal mt-0.5">معلم وخبير معتمد في مختلف التخصصات</p>
                    </div>
                  </div>
                </div>

              </motion.div>

            </div>

          </div>

        </div>

      </section>

      {/* =========================================================================
          2. MULTI-CATEGORY TRACKS SHOWCASE (#categories-explore)
         ========================================================================= */}
      <section id="categories-explore" className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-black rounded-full">
            <Layers className="h-3.5 w-3.5 text-brand-primary" />
            <span>مجالات التعلم بالمنصة</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-foreground">اختر المجال الذي يناسب طموحك</h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium leading-relaxed">
            منصة خطوتك تجمع لك المناهج التعليمية والمهارات الحديثة في بيئة رقمية واحدة
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {departments.filter(d => d.is_active).map((cat) => {
            const IconComp = CATEGORY_ICONS[cat.slug] || GraduationCap
            const isActive = selectedCategory === cat.slug
            return (
              <button
                key={cat.id || cat.slug}
                onClick={() => {
                  handleCategorySelect(cat.slug)
                  const el = document.getElementById('advanced-filter')
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                }}
                className={`p-6 rounded-2xl border text-right transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4 group relative overflow-hidden ${
                  isActive
                    ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20 scale-[1.02]'
                    : 'bg-[var(--card-bg)] hover:bg-[var(--surface-bg)] border-[var(--border-color)] hover:border-brand-primary/40 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 group-hover:bg-brand-primary group-hover:text-white'
                  }`}>
                    <IconComp className="h-6 w-6" />
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                    isActive
                      ? 'bg-white/20 text-white border-white/30'
                      : 'bg-[var(--surface-bg)] text-[var(--text-muted)] border-[var(--border-color)]'
                  }`}>
                    {cat.badge || 'مسار تعليمي'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className={`font-black text-lg transition-colors ${isActive ? 'text-white' : 'text-foreground group-hover:text-brand-primary'}`}>{cat.name}</h3>
                  <p className={`text-xs font-medium leading-relaxed ${isActive ? 'text-white/90' : 'text-[var(--text-muted)]'}`}>
                    {cat.description}
                  </p>
                </div>

                <div className={`pt-2 flex items-center gap-1.5 text-xs font-black group-hover:translate-x-[-4px] transition-transform ${
                  isActive ? 'text-white' : 'text-brand-primary'
                }`}>
                  <span>استكشف الكورسات</span>
                  <ChevronLeft className="h-4 w-4" />
                </div>
              </button>
            )
          })}
        </div>

      </section>

      {/* =========================================================================
          3. CATEGORY-AWARE DISCOVERY STUDIO (#advanced-filter)
         ========================================================================= */}
      <section id="advanced-filter" className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        
        <div className="bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-[32px] p-6 sm:p-10 shadow-xl relative overflow-hidden space-y-8">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[var(--border-color)] pb-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-black rounded-full">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>محرك الاكتشاف التفاعلي</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-foreground">استكشف الكورسات والمعلمين حسب المجال</h2>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">حدد المجال والتخصص لمشاهدة المدرسين الشارحين والدروس المتاحة للالتحاق بها</p>
            </div>
            
            {(selectedCategory !== 'all' || selectedGrade || selectedSubject || selectedTeacherId) && (
              <button 
                onClick={() => {
                  setSelectedCategory('all')
                  setSelectedGrade('')
                  setSelectedSubject('')
                  setFilteredTeachers([])
                  setSelectedTeacherId('')
                  setFilterResults([])
                  setSubjects([])
                }}
                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0"
              >
                إعادة ضبط الفلاتر 🔄
              </button>
            )}
          </div>

          {/* Step 0: Category Tabs */}
          <div className="space-y-3">
            <label className="text-xs font-black text-[var(--text-color)] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-primary text-white text-[10px] flex items-center justify-center font-black">1</span>
              <span>اختر المجال التعليمي:</span>
            </label>
            
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => handleCategorySelect('all')}
                className={`px-4 py-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-brand-primary text-white border-brand-primary shadow-md'
                    : 'bg-[var(--bg-color)] hover:bg-[var(--surface-bg)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-brand-primary/30'
                }`}
              >
                🌐 جميع المجالات
              </button>

              {departments.filter(d => d.is_active).map((cat) => {
                const isActive = selectedCategory === cat.slug
                return (
                  <button
                    key={cat.id || cat.slug}
                    onClick={() => handleCategorySelect(cat.slug)}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      isActive
                        ? 'bg-brand-primary text-white border-brand-primary shadow-md'
                        : 'bg-[var(--bg-color)] hover:bg-[var(--surface-bg)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-brand-primary/30'
                    }`}
                  >
                    {cat.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step 1: Grade Selector (ONLY for School Category or All) */}
          {(selectedCategory === 'all' || selectedCategory === 'school') && (
            <div className="space-y-3 pt-2">
              <label className="text-xs font-black text-[var(--text-color)] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center font-black">2</span>
                <span>اختر الصف الدراسي (التعليم المدرسي):</span>
              </label>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {grades.filter(g => g.is_active).map((g) => {
                  const isActive = selectedGrade === g.slug
                  return (
                    <button
                      key={g.id || g.slug}
                      onClick={() => fetchSubjectsForGrade(g.slug)}
                      className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between min-h-[5.5rem] relative overflow-hidden group ${
                        isActive
                          ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20 scale-[1.02]'
                          : 'bg-[var(--bg-color)] hover:bg-[var(--surface-bg)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-brand-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        {g.short_code ? (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                            isActive
                              ? 'bg-white/20 text-white border-white/30'
                              : 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'
                          }`}>
                            {g.short_code}
                          </span>
                        ) : <span />}
                      </div>
                      <span className={`text-xs font-black leading-snug ${isActive ? 'text-white' : 'text-[var(--text-color)] group-hover:text-brand-primary'}`}>
                        {g.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Specialization / Subject Chips (Shows when Category or Grade selected) */}
          <AnimatePresence>
            {(selectedGrade || (selectedCategory !== 'all' && selectedCategory !== 'school')) && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-2"
              >
                <label className="text-xs font-black text-[var(--text-color)] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-secondary text-white text-[10px] flex items-center justify-center font-black">
                    {selectedCategory === 'school' ? '3' : '2'}
                  </span>
                  <span>اختر المادة / التخصص:</span>
                </label>

                {safeSubjects.length === 0 && !filterLoading ? (
                  <div className="p-4 bg-[var(--bg-color)]/60 border border-[var(--border-color)] rounded-2xl text-xs text-[var(--text-muted)]">
                    جاري تحميل التخصصات المتاحة لهذا المجال...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {safeSubjects.map((sub) => {
                      const isActive = selectedSubject === sub
                      return (
                        <button
                          key={sub}
                          onClick={() => fetchTeachersForSubject(sub)}
                          className={`px-4 py-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                            isActive
                              ? 'bg-brand-secondary text-white border-brand-secondary shadow-md'
                              : 'bg-[var(--bg-color)] hover:bg-[var(--surface-bg)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-brand-secondary/30'
                          }`}
                        >
                          {SUBJECTS_TRANSLATION[sub] || sub}
                        </button>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 3: Teachers Options (Renders when Subject selected) */}
          <AnimatePresence>
            {selectedSubject && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-2"
              >
                <label className="text-xs font-black text-[var(--text-color)] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-black">
                    {selectedCategory === 'school' ? '4' : '3'}
                  </span>
                  <span>اختر المعلم / الخبير:</span>
                </label>

                {safeFilteredTeachers.length === 0 && !filterLoading ? (
                  <div className="p-4 bg-[var(--bg-color)]/60 border border-[var(--border-color)] rounded-2xl text-xs text-[var(--text-muted)]">
                    لا يوجد معلمون مسجلون لهذا التخصص حالياً.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {safeFilteredTeachers.map((t) => {
                      const isActive = selectedTeacherId === t.id.toString()
                      return (
                        <button
                          key={t.id}
                          onClick={() => fetchCoursesForTeacher(t.id.toString())}
                          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
                            isActive
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                              : 'bg-[var(--bg-color)] hover:bg-[var(--surface-bg)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-brand-primary/40'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-[var(--surface-bg)] border border-[var(--border-color)] flex items-center justify-center font-black text-xs shrink-0 overflow-hidden text-brand-primary">
                            {t.avatar ? (
                              <img src={t.avatar} alt={t.name} className="w-full h-full object-cover" />
                            ) : (
                              t.name.charAt(0)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black truncate">{t.name}</h4>
                            <span className="text-[10px] opacity-80 block truncate">{t.subject}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filtering Indicator & Results Grid */}
          {filterLoading && (
            <div className="py-12 flex justify-center items-center gap-3">
              <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-[var(--text-muted)]">جاري تجميع الكورسات والمحاضرات...</span>
            </div>
          )}

          {!filterLoading && safeFilterResults.length > 0 && (
            <div className="space-y-6 pt-6 border-t border-[var(--border-color)]">
              <h3 className="text-lg font-black flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span>الكورسات والمحتوى المتاح ({safeFilterResults.length}):</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {safeFilterResults.map((course) => (
                  <CourseCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    description={course.description}
                    coverImage={course.cover_image}
                    price={course.price}
                    subject={course.subject}
                    teacherName={course.teacher?.name || ''}
                    teacherAvatar={course.teacher?.avatar}
                    slug={course.slug}
                    enableDiscount={course.enable_discount === true}
                    discountType={course.discount_type ?? undefined}
                    discountValue={course.discount_value ?? undefined}
                    finalPrice={course.final_price ?? undefined}
                    availability={course.availability}
                    lessonsCount={course.lessons_count}
                    isBundle={course.is_bundle === true || course.is_bundle === 1 || course.is_bundle === '1'}
                    childCourses={course.child_courses}
                    bundleOriginalPrice={course.bundle_original_price}
                    bundleSavings={course.bundle_savings}
                  />
                ))}
              </div>
            </div>
          )}

          {!filterLoading && selectedTeacherId && safeFilterResults.length === 0 && (
            <div className="py-8">
              <EmptyState type="courses" title="لا يوجد كورسات متاحة حالياً" description="هذا المعلم لم يقم بنشر أي كورسات لهذا التخصص حالياً." />
            </div>
          )}

        </div>

      </section>

      {/* =========================================================================
          4. EDITORIAL STORYBOARD ("لماذا منصة خطوتك هي الخيار الأول؟")
         ========================================================================= */}
      <section className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-black rounded-full">
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            <span>مميزات وتفوق المنصة</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-foreground">تجربة تعليمية متكاملة بأسلوب حديث</h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium leading-relaxed">
            صممت المنصة لتقديم أرقى مستويات الشرح والمتابعة المستمرة للطالب وأولياء الأمور في جميع المجالات.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl space-y-4 hover:border-brand-primary/40 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-black group-hover:bg-brand-primary group-hover:text-white transition-all">
              <Video className="h-6 w-6" />
            </div>
            <h3 className="font-black text-base text-[var(--text-color)]">محاضرات وحماية عالية</h3>
            <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
              فيديوهات بدقة HD محمية بسيرفرات Bunny CDN السريعة مع حفظ موضع الوقوف التلقائي.
            </p>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl space-y-4 hover:border-brand-secondary/40 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-brand-secondary/10 border border-brand-secondary/20 flex items-center justify-center text-brand-secondary font-black group-hover:bg-brand-secondary group-hover:text-white transition-all">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="font-black text-base text-[var(--text-color)]">امتحانات وتصحيح فوري</h3>
            <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
              اختبارات MCQ وتدريبات تفاعلية مع تصحيح تلقائي وعرض الدرجة والملاحظات مباشرة.
            </p>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl space-y-4 hover:border-emerald-500/40 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-black group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <Wallet className="h-6 w-6" />
            </div>
            <h3 className="font-black text-base text-[var(--text-color)]">محفظة وشحن بالأكواد</h3>
            <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
              نظام محفظة ذكي يتيح لك شحن رصيدك فوراً عبر أكواد الشحن المسبقة الدفع بسهولة.
            </p>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl space-y-4 hover:border-amber-500/40 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-black group-hover:bg-amber-500 group-hover:text-white transition-all">
              <Award className="h-6 w-6" />
            </div>
            <h3 className="font-black text-base text-[var(--text-color)]">نخبة المعلمين والخبراء</h3>
            <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
              معلمون وخبراء متميزون في مجالاتهم لتبسيط الشرح وتأهيل الطالب للتفوق.
            </p>
          </div>

        </div>

      </section>

      {/* =========================================================================
          5. FEATURED COURSES SHOWCASE
         ========================================================================= */}
      <section className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 border-b border-[var(--border-color)] pb-6">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-4xl font-black text-foreground">أحدث الكورسات والمراجعات</h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">اشترك الآن في أحدث الشروحات التعليمية وتابع مع معلمك فوراً</p>
          </div>
          
          <Link 
            to="/courses" 
            className="text-xs font-black text-brand-primary hover:text-brand-primary-hover flex items-center gap-1.5 border border-brand-primary/20 hover:border-brand-primary/40 px-4 py-2.5 rounded-xl transition-all shrink-0"
          >
            <span>استعراض كل الكورسات</span>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </div>

        {safeFeaturedCourses.length === 0 ? (
          <EmptyState type="courses" title="لا توجد كورسات معروضة حالياً" description="لم يتم نشر أي كورسات في المنصة حتى الآن." />
        ) : (
          <div className={
            safeFeaturedCourses.length === 1
              ? "max-w-md mx-auto"
              : safeFeaturedCourses.length === 2
              ? "grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto gap-6 lg:gap-8"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
          }>
            {safeFeaturedCourses.map((course) => (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                description={course.description}
                coverImage={course.cover_image}
                price={course.price}
                subject={course.subject}
                teacherName={course.teacher.name}
                teacherAvatar={course.teacher.avatar}
                slug={course.slug}
                enableDiscount={course.enable_discount === true}
                discountType={course.discount_type ?? undefined}
                discountValue={course.discount_value ?? undefined}
                finalPrice={course.final_price ?? undefined}
                availability={course.availability}
                lessonsCount={course.lessons_count}
                isBundle={course.is_bundle === true || course.is_bundle === 1 || course.is_bundle === '1'}
                childCourses={course.child_courses}
                bundleOriginalPrice={course.bundle_original_price}
                bundleSavings={course.bundle_savings}
              />
            ))}
          </div>
        )}

      </section>

      {/* =========================================================================
          6. FACULTY SHOWCASE ("هيئة التدريس والخبراء")
         ========================================================================= */}
      <section className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center space-y-3 max-w-xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-4xl font-black text-foreground">هيئة التدريس والنخبة</h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">معلمون وخبراء متميزون في مختلف التخصصات لمساعدتك في رحلة التعلم</p>
        </div>

        {safePopularTeachers.length === 0 ? (
          <EmptyState type="teachers" title="لا يوجد معلمون مسجلون" description="يرجى مراجعة لوحة تحكم الأدمن لإضافة معلمين جدد للمنصة." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {safePopularTeachers.map((teacher) => (
              <TeacherCard
                key={teacher.id}
                id={teacher.id}
                name={teacher.name}
                subject={teacher.subject}
                avatar={teacher.avatar}
                experience={teacher.experience}
                bio={teacher.bio}
                studentsCount={teacher.students_count}
                coursesCount={teacher.published_courses_count || 0}
                slug={teacher.slug}
                teaching_mode={teacher.teaching_mode}
              />
            ))}
          </div>
        )}

      </section>

      {/* =========================================================================
          7. FAQS SECTION
         ========================================================================= */}
      <section className="max-w-4xl mx-auto px-4">
        
        <div className="text-center space-y-3 mb-14">
          <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-2xl w-fit mx-auto border border-brand-primary/20">
            <HelpCircle className="h-6 w-6" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-foreground">الأسئلة الشائعة والاستفسارات</h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">إجابات توضيحية حول طريقة الشراء والشحن والدراسة بالمنصة</p>
        </div>

        <div className="space-y-4">
          <FAQItem
            question="هل تقتصر منصة خطوتك على التعليم المدرسي فقط؟"
            answer="لا، منصة خطوتك منصة تعليمية متكاملة تتيح لك الالتحاق بكورسات المناهج المدرسية (الإعدادية والثانوية) بالإضافة إلى مجالات البرمجة والتكنولوجيا، التجارة والأعمال، التصميم، واللغات."
          />
          <FAQItem
            question="كيف يمكنني شحن محفظتي لشراء الكورسات؟"
            answer="يمكنك شحن محفظتك بسهولة من خلال شراء أكواد الشحن المسبقة الدفع من المكاتب المعتمدة أو عن طريق المشرفين، وإدخال الكود في صفحة 'المحفظة' داخل لوحة التحكم لتفعيل رصيدك فوراً."
          />
          <FAQItem
            question="كيف أتابع نسبة تقدمي ومشاهدة الفيديوهات؟"
            answer="تحتوي المنصة على نظام ذكي يتتبع تقدمك بدقة، ويخزن آخر موضع مشاهدة في الفيديو بالثانية، بحيث يظهر لك زر 'متابعة المشاهدة' للرجوع تلقائياً إلى المحاضرة بنفس الموضع الذي وقفت عنده."
          />
          <FAQItem
            question="ما هو نظام الامتحانات وكيف يتم تصحيحها؟"
            answer="توفر المنصة اختبارات اختيار من متعدد (MCQ) وصح وخطأ يتم تصحيحها وحساب الدرجات لها تلقائياً وفورياً. أما الواجبات المفتوحة والأسئلة المقالية فيقوم المدرس بمراجعتها وتصحيحها يدوياً ووضع ملاحظاته ودرجتك عليها."
          />
        </div>

      </section>

      {/* =========================================================================
          8. BOTTOM HIGH-IMPACT CALL-TO-ACTION
         ========================================================================= */}
      <section className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="bg-gradient-to-br from-brand-primary/10 via-[var(--surface-bg)] to-brand-secondary/10 border border-[var(--border-color)] rounded-[32px] p-8 sm:p-16 text-center space-y-6 relative overflow-hidden shadow-xl">
          
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none"></div>

          <h2 className="text-3xl sm:text-5xl font-black max-w-2xl mx-auto leading-tight text-foreground">
            ابدأ رحلتك التعليمية نحو التميز واحتراف المهارات الآن!
          </h2>
          
          <p className="text-xs sm:text-base text-[var(--text-secondary)] font-medium max-w-lg mx-auto leading-relaxed">
            سجل حسابك كطالب مجاناً، واشحن محفظتك وابدأ بحضور شروحات المعلمين والخبراء الأفضل في مجالاتهم.
          </p>

          <div className="pt-4">
            <Link 
              to="/register" 
              className="px-10 py-4.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-2xl font-black shadow-xl shadow-brand-primary/30 text-sm active:scale-95 transition-all inline-block cursor-pointer"
            >
              أنشئ حسابك المجاني اليوم 🚀
            </Link>
          </div>

        </div>

      </section>

    </div>
  )
}

// Sub Component for FAQs accordion item
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="border border-[var(--border-color)] bg-[var(--surface-bg)] rounded-2xl overflow-hidden transition-all duration-300 shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-right font-black text-sm sm:text-base cursor-pointer text-foreground hover:text-brand-primary transition-colors"
      >
        <span>{question}</span>
        <ChevronDown className={`h-5 w-5 text-brand-primary transition-transform duration-300 shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[var(--border-color)] bg-[var(--bg-color)]/50"
          >
            <p className="p-5 text-xs sm:text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
