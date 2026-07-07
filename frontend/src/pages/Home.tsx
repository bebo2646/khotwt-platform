import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import API from '../services/api'
import { BookOpen, Users, Award, ChevronDown, Sparkles, HelpCircle, ArrowRight, Play, CheckCircle, ChevronLeft, ArrowUpRight } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { useAuthStore } from '../store/authStore'
import { motion } from 'framer-motion'
import CourseCard from '../components/ui/CourseCard'
import TeacherCard from '../components/ui/TeacherCard'
import SEO from '../components/SEO'

interface HomeStats {
  teachers_count: number
  courses_count: number
  students_count: number
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
  enable_discount?: boolean
  discount_type?: 'percentage' | 'fixed' | null
  discount_value?: number | null
  final_price?: number | null
  teacher: {
    name: string
    avatar?: string
    subject: string
  }
}

interface TeacherItem {
  id: number
  name: string
  subject: string
  avatar?: string
  experience: string
  bio: string
  students_count?: number
  slug?: string
  published_courses_count?: number
}

const GRADES = [
  { key: 'first_preparatory', val: 'الصف الأول الإعدادي' },
  { key: 'second_preparatory', val: 'الصف الثاني الإعدادي' },
  { key: 'third_preparatory', val: 'الصف الثالث الإعدادي' },
  { key: 'first_secondary', val: 'الصف الأول الثانوي' },
  { key: 'second_secondary', val: 'الصف الثاني الثانوي' },
  { key: 'third_secondary', val: 'الصف الثالث الثانوي' },
]

const SUBJECTS_TRANSLATION: Record<string, string> = {
  chemistry: 'الكيمياء',
  physics: 'الفيزياء',
  biology: 'الأحياء',
  math: 'الرياضيات',
  science: 'العلوم',
  arabic: 'اللغة العربية',
  english: 'اللغة الإنجليزية',
}

export default function Home() {
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuthStore()
  
  // States
  const [stats, setStats] = React.useState<HomeStats | null>(null)
  const [featuredCourses, setFeaturedCourses] = React.useState<CourseItem[]>([])
  const [popularTeachers, setPopularTeachers] = React.useState<TeacherItem[]>([])
  const [loading, setLoading] = React.useState(true)

  // Cascading Filter States
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

  // Cascade 1: Grade -> Subjects
  const handleGradeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const grade = e.target.value
    setSelectedGrade(grade)
    setSelectedSubject('')
    setFilteredTeachers([])
    setSelectedTeacherId('')
    setFilterResults([])
    setSubjects([])

    if (!grade) return

    setFilterLoading(true)
    try {
      const res = await API.get(`/filter/subjects?grade=${grade}`)
      setSubjects(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setFilterLoading(false)
    }
  }

  // Cascade 2: Subject -> Teachers
  const handleSubjectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subject = e.target.value
    setSelectedSubject(subject)
    setFilteredTeachers([])
    setSelectedTeacherId('')
    setFilterResults([])

    if (!subject) return

    setFilterLoading(true)
    try {
      const res = await API.get(`/filter/teachers?grade=${selectedGrade}&subject=${subject}`)
      setFilteredTeachers(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setFilterLoading(false)
    }
  }

  // Cascade 3: Teacher -> Courses
  const handleTeacherChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teacherId = e.target.value
    setSelectedTeacherId(teacherId)
    setFilterResults([])

    if (!teacherId) return

    setFilterLoading(true)
    try {
      const res = await API.get(`/courses?grade=${selectedGrade}&subject=${selectedSubject}&teacher_id=${teacherId}`)
      setFilterResults(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setFilterLoading(false)
    }
  }

  return (
    <div className="bg-background text-foreground space-y-28 pb-24 overflow-x-hidden font-sans">
      <SEO 
        title="الرئيسية | أول خطوة نحو النجاح"
        description="خطوتك هي أول خطوة نحو النجاح، منصة تعليمية حديثة توفر محاضرات تفاعلية واختبارات ومتابعة مستمرة للطلاب في جميع المراحل الثانوية والإعدادية."
        keywords="خطوتك, منصة خطوتك, منصة تعليمية, شرح ثانوية عامة, كورسات كيمياء, كورسات فيزياء, امتحانات اونلاين"
        schema={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": "https://elm-platform.com/#website",
              "url": "https://elm-platform.com",
              "name": "منصة خطوتك التعليمية",
              "description": "منصة تعليمية حديثة لطلاب المرحلة الثانوية والإعدادية"
            },
            {
              "@type": "Organization",
              "@id": "https://elm-platform.com/#organization",
              "name": "منصة خطوتك التعليمية",
              "url": "https://elm-platform.com",
              "logo": "https://elm-platform.com/favicon.ico",
              "image": "https://elm-platform.com/og-image.jpg",
              "description": "خطوتك هي أول خطوة نحو النجاح، منصة تعليمية حديثة توفر محاضرات تفاعلية واختبارات ومتابعة مستمرة للطلاب في جميع المراحل الثانوية والإعدادية."
            }
          ]
        }}
      />
      
      {/* Decorative Blur Spheres & Particles (SaaS Glassmorphism Background) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <motion.div
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -40, 50, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[-5%] left-[-5%] w-[450px] h-[450px] bg-brand-primary/15 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{
            x: [0, -60, 40, 0],
            y: [0, 50, -50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[20%] right-[-5%] w-[550px] h-[550px] bg-brand-accent/10 rounded-full blur-[130px]"
        />
        
        {/* Floating SaaS particles */}
        <motion.div 
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[15%] left-[20%] w-3 h-3 bg-brand-primary/30 rounded-full"
        />
        <motion.div 
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[25%] right-[25%] w-4 h-4 bg-brand-accent/20 rounded-full"
        />
        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] left-[10%] w-2 h-2 bg-brand-primary/40 rounded-full"
        />
      </div>

      {/* 1. Hero Section */}
      <section className="relative pt-24 pb-12 sm:pt-32 sm:pb-20 overflow-hidden">
        {/* Soft radial background glow for rich depth */}
        <div className="absolute top-0 right-1/4 left-1/4 h-[500px] bg-brand-primary/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>
        <div className="max-w-7xl mx-auto px-4 text-center space-y-10">
          
          {/* Rebranded Premium Badge */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-bold hover:bg-brand-primary/15 transition-all cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-brand-primary animate-pulse" />
            <span>خطوتك هي أول خطوة في طريق النجاح 🚀</span>
          </motion.div>

          {/* Heading */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-7xl font-black tracking-tight leading-[1.15] max-w-5xl mx-auto text-foreground"
          >
            ابدأ رحلتك التعليمية الذكية وتفوق مع <span className="bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(99,102,241,0.55)]">خطوتك</span>
          </motion.h1>

          {/* Rebranded Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-base sm:text-lg text-slate-400 max-w-4xl mx-auto font-normal leading-relaxed"
          >
            منصة تعليمية حديثة تجمع أفضل المعلمين والدورات والاختبارات التفاعلية في مكان واحد، لتمنحك تجربة تعليمية ذكية تساعدك على التفوق وتحقيق أهدافك الأكاديمية بثقة. تعلم بذكاء، تابع تقدمك، اختبر نفسك، وحقق أفضل النتائج مع تجربة تعليمية مصممة خصيصًا لطلاب المرحلة الإعدادية والثانوية.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-wrap justify-center gap-5 pt-4"
          >
            <Link to="/courses" className="px-8 py-4 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-2xl font-bold shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/40 active:scale-95 transition-all text-sm flex items-center gap-2 cursor-pointer">
              <span>تصفح كل الكورسات</span>
              <ChevronLeft className="h-4.5 w-4.5" />
            </Link>
            <a href="#advanced-filter" className="px-8 py-4 bg-brand-card hover:bg-brand-surface border border-[var(--border-color)] rounded-2xl font-bold hover:border-brand-primary/30 active:scale-95 transition-all text-sm text-current flex items-center gap-2">
              <span>ابحث بمعلمك المفضل</span>
              <ChevronDown className="h-4 w-4" />
            </a>
          </motion.div>

          {/* Stats Bar */}
          {stats && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto pt-16"
            >
              
              <div className="p-6 bg-brand-card border border-[var(--border-color)] rounded-3xl flex items-center gap-4 text-right hover:border-brand-primary/30 transition-all group shadow-sm hover:shadow-[0_8px_30px_rgba(99,102,241,0.08)]">
                <div className="p-4 bg-brand-primary/10 text-brand-primary rounded-2xl group-hover:bg-brand-primary group-hover:text-white transition-all">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-2xl font-black">{stats.students_count}+</div>
                  <div className="text-xs text-slate-400 font-light mt-0.5">طالب يدرس معنا</div>
                </div>
              </div>

              <div className="p-6 bg-brand-card border border-[var(--border-color)] rounded-3xl flex items-center gap-4 text-right hover:border-brand-accent/30 transition-all group shadow-sm hover:shadow-[0_8px_30px_rgba(6,182,212,0.08)]">
                <div className="p-4 bg-brand-accent/10 text-brand-accent rounded-2xl group-hover:bg-brand-accent group-hover:text-white transition-all">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-2xl font-black">{stats.courses_count}+</div>
                  <div className="text-xs text-slate-400 font-light mt-0.5">محاضرة وكورس مسجل</div>
                </div>
              </div>

              <div className="p-6 bg-brand-card border border-[var(--border-color)] rounded-3xl flex items-center gap-4 text-right hover:border-brand-primary/30 transition-all group shadow-sm hover:shadow-[0_8px_30px_rgba(99,102,241,0.08)]">
                <div className="p-4 bg-brand-primary/10 text-brand-primary rounded-2xl group-hover:bg-brand-primary group-hover:text-white transition-all">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-2xl font-black">{stats.teachers_count}+</div>
                  <div className="text-xs text-slate-400 font-light mt-0.5">معلم معتمد وصاحب خبرة</div>
                </div>
              </div>

            </motion.div>
          )}
        </div>
      </section>

      {/* 2. Cascading Filter Section */}
      <section id="advanced-filter" className="max-w-7xl mx-auto px-4 scroll-mt-24">
        <div className="bg-brand-card border border-[var(--border-color)] rounded-[36px] p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-[var(--primary-color)]/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="max-w-3xl mb-10 text-right">
            <h2 className="text-2xl sm:text-3xl font-black">ابحث عن دروسك ومراجعاتك</h2>
            <p className="text-sm text-slate-400 font-light mt-1">اختر صفك الدراسي ثم المادة العلمية وسيظهر لك المدرسون والدروس المتاحة للشراء فوراً</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Grade Selector */}
            <div className="space-y-2 text-right">
              <label className="text-xs font-semibold text-slate-300">الصف الدراسي</label>
              <div className="relative">
                <select
                  value={selectedGrade}
                  onChange={handleGradeChange}
                  className="w-full bg-brand-surface border border-[var(--border-color)] rounded-2xl px-4 py-4 appearance-none focus:outline-none focus:border-[var(--primary-color)] text-xs font-medium cursor-pointer"
                >
                  <option value="">اختر الصف الدراسي...</option>
                  {GRADES.map((g) => (
                    <option key={g.key} value={g.key}>{g.val}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-slate-500" />
              </div>
            </div>

            {/* Subject Selector */}
            <div className="space-y-2 text-right">
              <label className="text-xs font-semibold text-slate-300">المادة المقررة</label>
              <div className="relative">
                <select
                  value={selectedSubject}
                  onChange={handleSubjectChange}
                  disabled={!selectedGrade || subjects.length === 0}
                  className="w-full bg-brand-surface border border-[var(--border-color)] rounded-2xl px-4 py-4 appearance-none focus:outline-none focus:border-[var(--primary-color)] disabled:opacity-40 text-xs font-medium cursor-pointer"
                >
                  <option value="">{subjects.length === 0 ? 'حدد الصف الدراسي أولاً...' : 'اختر المادة العلمية...'}</option>
                  {subjects.map((sub) => (
                    <option key={sub} value={sub}>{SUBJECTS_TRANSLATION[sub] || sub}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-slate-500" />
              </div>
            </div>

            {/* Teacher Selector */}
            <div className="space-y-2 text-right">
              <label className="text-xs font-semibold text-slate-300">معلم المادة</label>
              <div className="relative">
                <select
                  value={selectedTeacherId}
                  onChange={handleTeacherChange}
                  disabled={!selectedSubject || filteredTeachers.length === 0}
                  className="w-full bg-brand-surface border border-[var(--border-color)] rounded-2xl px-4 py-4 appearance-none focus:outline-none focus:border-[var(--primary-color)] disabled:opacity-40 text-xs font-medium cursor-pointer"
                >
                  <option value="">{filteredTeachers.length === 0 ? 'حدد المادة العلمية أولاً...' : 'اختر اسم المدرس...'}</option>
                  {filteredTeachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-slate-500" />
              </div>
            </div>

          </div>

          {/* Filtering States / Results */}
          {filterLoading && (
            <div className="mt-12 flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-color)]"></div>
            </div>
          )}

          {!filterLoading && filterResults.length > 0 && (
            <div className="mt-12 space-y-6 text-right">
              <h3 className="text-lg font-bold border-b border-slate-800 pb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-[var(--primary-color)]" />
                <span>المحاضرات والمراجعات المتاحة:</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {filterResults.map((course) => (
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
                  />
                ))}
              </div>
            </div>
          )}

          {!filterLoading && selectedTeacherId && filterResults.length === 0 && (
            <div className="mt-8">
              <EmptyState type="courses" title="لا يوجد كورسات متاحة حالياً" description="هذا المعلم لم يقم بنشر أي كورسات لهذه المرحلة حالياً." />
            </div>
          )}
        </div>
      </section>

      {/* 3. Featured Courses */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 text-right">
          <div>
            <h2 className="text-2xl sm:text-4xl font-black">أحدث الحصص والمراجعات</h2>
            <p className="text-sm text-slate-400 font-light mt-1">اشترك الآن in أحدث الشروحات التعليمية وتابع مع معلمك فوراً</p>
          </div>
          <Link to="/courses" className="text-xs font-bold text-[var(--primary-color)] hover:text-[var(--primary-hover)] flex items-center gap-1 border border-[var(--primary-color)]/20 hover:border-[var(--primary-color)]/50 p-2.5 px-4 rounded-xl transition-all">
            <span>استعراض كل المنهج</span>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </div>

        {featuredCourses.length === 0 ? (
          <EmptyState type="courses" title="لا توجد كورسات معروضة" description="لم يتم نشر أي كورسات في المنصة حتى الآن." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {featuredCourses.map((course) => (
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
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Popular Teachers Grid */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="text-center space-y-3 mb-16">
          <h2 className="text-2xl sm:text-4xl font-black">هيئة التدريس ونخبة المدرسين</h2>
          <p className="text-sm text-slate-400 font-light max-w-lg mx-auto">معلمون متميزون ذوو خبرة طويلة لتبسيط المناهج وشرح كافة التفاصيل</p>
        </div>

        {popularTeachers.length === 0 ? (
          <EmptyState type="teachers" title="لا يوجد معلمون مسجلون" description="يرجى مراجعة لوحة تحكم الأدمن لإضافة معلمين جدد للمنصة." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {popularTeachers.map((teacher) => (
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
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. FAQs Section */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="text-center space-y-3 mb-16">
          <div className="p-3 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-2xl w-fit mx-auto">
            <HelpCircle className="h-6 w-6" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-black">هل لديك أي استفسار؟</h2>
          <p className="text-sm text-slate-400 font-light">نصائح وإجابات عن طريقة الشراء والدراسة وشحن رصيد المحفظة</p>
        </div>

        <div className="space-y-5">
          <FAQItem
            question="كيف يمكنني شحن محفظتي لشراء الكورسات؟"
            answer="يمكنك شحن محفظتك بسهولة من خلال شراء أكواد الشحن المسبقة الدفع من المكاتب المعتمدة أو عن طريق المشرفين، وإدخال الكود في صفحة 'المحفظة' داخل لوحة التحكم لتفعيل رصيدك فوراً."
          />
          <FAQItem
            question="هل يمكنني الاشتراك in أجزاء معينة فقط من الكورس؟"
            answer="نعم، تتيح المنصة إمكانية الاشتراك في الكورس بالكامل، أو شراء 'الباقات الشهرية' المحددة التي ينشئها المدرس مثل (باقة شهر أكتوبر، باقة شهر نوفمبر، باقة المراجعة النهائية) بأسعار خاصة."
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

      {/* 6. CTA / Bottom Section */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="bg-gradient-to-br from-brand-primary/20 to-brand-card border border-[var(--border-color)] rounded-[40px] p-8 sm:p-16 text-center space-y-6 relative overflow-hidden shadow-2xl">
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-brand-accent/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <h2 className="text-3xl sm:text-5xl font-black max-w-2xl mx-auto leading-tight">
            ابدأ طريقك الدراسي نحو التفوق والتميز الآن!
          </h2>
          <p className="text-sm sm:text-base text-slate-400 font-light max-w-lg mx-auto">
            سجل حسابك كطالب مجاناً، واشحن محفظتك وابدأ بحضور شروحات المدرسين الأفضل في تخصصاتهم.
          </p>
          <div className="pt-4">
            <Link to="/register" className="px-10 py-4.5 bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white rounded-2xl font-bold shadow-lg shadow-[var(--primary-color)]/25 text-sm glow-btn cursor-pointer inline-block">
              أنشئ حسابك المجاني اليوم
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
    <div className="border border-[var(--border-color)] bg-brand-card/30 rounded-2xl overflow-hidden transition-all duration-300">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-right font-bold text-sm sm:text-base cursor-pointer text-current hover:text-white"
      >
        <span>{question}</span>
        <ChevronDown className={`h-5 w-5 text-[var(--primary-color)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`transition-all duration-300 overflow-hidden ${open ? 'max-h-40 border-t border-[var(--border-color)] bg-brand-surface/10' : 'max-h-0'}`}>
        <p className="p-6 text-xs sm:text-sm text-slate-400 leading-relaxed font-light">{answer}</p>
      </div>
    </div>
  )
}
