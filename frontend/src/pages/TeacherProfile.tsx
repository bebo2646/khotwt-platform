import React from 'react'
import { useParams, Link } from 'react-router-dom'
import API from '../services/api'
import { Award, ShieldCheck, ArrowRight } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import CourseCard from '../components/ui/CourseCard'
import PackageCard from '../components/ui/PackageCard'
import SEO from '../components/SEO'

interface TeacherItem {
  id: number
  name: string
  slug?: string
  subject: string
  avatar?: string
  experience: string
  bio: string
  grades?: string[]
  teaching_mode?: string
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
  availability?: 'online' | 'center' | 'both'
  lessons_count?: number
  is_bundle?: boolean | number | string
}

interface PackageItem {
  id: number
  title: string
  price: string
  course_id: number
  description?: string
  package_thumbnail?: string
  cover_image?: string
  lessons_count?: number
  lessons?: any[]
  course?: {
    title: string
    subject: string
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

const getSubjectTranslation = (subjectStr: string) => {
  if (!subjectStr) return '';
  return subjectStr.split(',').map(s => SUBJECTS_TRANSLATION[s.trim()] || s.trim()).join(' و ');
};

const GRADES_TRANSLATION: Record<string, string> = {
  first_preparatory: 'الصف الأول الإعدادي',
  second_preparatory: 'الصف الثاني الإعدادي',
  third_preparatory: 'الصف الثالث الإعدادي',
  first_secondary: 'الصف الأول الثانوي',
  second_secondary: 'الصف الثاني الثانوي',
  third_secondary: 'الصف الثالث الثانوي',
}

export default function TeacherProfile() {
  const { id } = useParams()
  
  const [teacher, setTeacher] = React.useState<TeacherItem | null>(null)
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [packages, setPackages] = React.useState<PackageItem[]>([])
  const [stats, setStats] = React.useState({ courses_count: 0, students_count: 0 })
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<'courses' | 'packages'>('courses')
  const [courseFilter, setCourseFilter] = React.useState<'all' | 'online' | 'center'>('all')

  const filteredCourses = React.useMemo(() => {
    return courses.filter((course) => {
      if (courseFilter === 'all') return true
      if (courseFilter === 'online') {
        return course.availability === 'online' || course.availability === 'both'
      }
      if (courseFilter === 'center') {
        return course.availability === 'center' || course.availability === 'both'
      }
      return true
    })
  }, [courses, courseFilter])

  React.useEffect(() => {
    setLoading(true)
    API.get(`/teachers/${id}`)
      .then((res) => {
        setTeacher(res.data.teacher)
        setCourses(res.data.courses)
        setPackages(res.data.packages)
        setStats(res.data.statistics)
        
        // Dynamically set page title
        if (res.data.teacher?.name) {
          document.title = `${res.data.teacher.name} | خطوتك`;
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (!teacher) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <EmptyState type="general" title="المعلم غير موجود" description="لم نتمكن من العثور على المعلم المطلوب، قد يكون الحساب معطلاً." />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <SEO 
        title={`${teacher.name} | مدرس ${getSubjectTranslation(teacher.subject)}`}
        description={`تعلم ال${getSubjectTranslation(teacher.subject)} مع ${teacher.name} من خلال محاضرات واختبارات تفاعلية ومتابعة مستمرة على منصة خطوتك.`}
        keywords={`${teacher.name}, مدرس ${getSubjectTranslation(teacher.subject)}, كورسات ${teacher.name}, منصة خطوتك`}
        ogImage={teacher.avatar}
        schema={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Person",
              "name": teacher.name,
              "jobTitle": `مدرس ${getSubjectTranslation(teacher.subject)}`,
              "image": teacher.avatar ? (teacher.avatar.startsWith('http') ? teacher.avatar : `https://elm-platform.com${teacher.avatar}`) : `https://elm-platform.com/og-image.jpg`,
              "url": typeof window !== 'undefined' ? window.location.href : `https://elm-platform.com/teachers/${teacher.slug || teacher.id}`,
              "description": teacher.bio || `صفحة المدرس الشخصية على منصة خطوتك`
            },
            {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "الرئيسية",
                  "item": "https://elm-platform.com"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "المعلمون",
                  "item": "https://elm-platform.com/teachers"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": teacher.name,
                  "item": typeof window !== 'undefined' ? window.location.href : `https://elm-platform.com/teachers/${teacher.slug || teacher.id}`
                }
              ]
            }
          ]
        }}
      />
      
      {/* Visual Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-400 font-medium pb-2 select-none" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-primary transition-colors">الرئيسية</Link>
        <span>/</span>
        <Link to="/teachers" className="hover:text-brand-primary transition-colors">المعلمون</Link>
        <span>/</span>
        <span className="text-slate-200 font-bold truncate max-w-[250px]">{teacher.name}</span>
      </nav>
      
      {/* 1. Header Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-brand-card border border-border-color p-8 sm:p-12 flex flex-col md:flex-row items-center gap-8 shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl -z-10" />
        
        {/* Avatar */}
        <div className="h-28 w-28 rounded-full bg-brand-surface border-2 border-brand-primary/40 overflow-hidden shrink-0">
          <img 
            src={teacher.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${teacher.name}`} 
            alt={teacher.name} 
            className="object-cover w-full h-full" 
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${teacher.name}`
            }}
          />
        </div>

        {/* Info */}
        <div className="space-y-4 text-center md:text-right w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-foreground">{teacher.name}</h1>
                <ShieldCheck className="h-5 w-5 text-brand-primary shrink-0" />
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
                <p className="text-sm font-bold flex flex-wrap gap-1 items-center">
                  {teacher.subject?.split(',').map((subStr, idx) => {
                    const sub = subStr.trim();
                    const isLast = idx === teacher.subject.split(',').length - 1;
                    return (
                      <React.Fragment key={sub}>
                        <Link to={`/subject/${sub}`} className="text-brand-primary hover:underline transition-all">
                          مدرس {SUBJECTS_TRANSLATION[sub] || sub}
                        </Link>
                        {!isLast && <span className="text-slate-400 mx-1">و</span>}
                      </React.Fragment>
                    );
                  })}
                </p>
                {teacher.teaching_mode === 'online' && (
                  <span className="px-2.5 py-0.5 bg-green-500/10 border border-green-500/30 text-[10px] text-green-400 font-black rounded-full flex items-center gap-1">
                    <span>🟢</span>
                    <span>أونلاين</span>
                  </span>
                )}
                {teacher.teaching_mode === 'center' && (
                  <span className="px-2.5 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-[10px] text-yellow-400 font-black rounded-full flex items-center gap-1">
                    <span>🏫</span>
                    <span>سنتر</span>
                  </span>
                )}
                {teacher.teaching_mode === 'both' && (
                  <span className="px-2.5 py-0.5 bg-purple-500/10 border border-purple-500/30 text-[10px] text-purple-400 font-black rounded-full flex items-center gap-1">
                    <span>🟣</span>
                    <span>أونلاين + سنتر</span>
                  </span>
                )}
              </div>
              {teacher.grades && teacher.grades.length > 0 && (
                <div className="flex flex-wrap justify-center md:justify-start gap-1.5 mt-2">
                  {teacher.grades.map((gradeKey) => (
                    <Link 
                      key={gradeKey} 
                      to={`/grade/${gradeKey.replace('_', '-')}`} 
                      className="px-2 py-0.5 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-lg text-[10px] font-semibold hover:bg-brand-primary/20 transition-colors"
                    >
                      {GRADES_TRANSLATION[gradeKey] || gradeKey}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            
            {/* Stats count badges */}
            <div className="flex justify-center md:justify-end gap-6">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-black text-foreground">{stats.courses_count}</div>
                <div className="text-[10px] text-text-secondary">كورسات منشورة</div>
              </div>
              <div className="w-[1px] bg-border-color" />
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-black text-foreground">{stats.students_count}</div>
                <div className="text-[10px] text-text-secondary">طلاب مقيدين</div>
              </div>
            </div>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed font-light max-w-3xl">
            {teacher.bio || 'مرحباً بكم في صفحتي الشخصية. تابعوا معي دروسكم لضمان التفوق والحصول على الدرجات النهائية.'}
          </p>

          <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-text-secondary">
            <Award className="h-4 w-4 text-brand-primary" />
            <span>{teacher.experience}</span>
          </div>
        </div>

      </div>

      {/* 2. Tabs Selector */}
      <div className="flex border-b border-border-color">
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-6 py-3 text-sm font-bold border-b-2 cursor-pointer ${
            activeTab === 'courses' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-foreground'
          }`}
        >
          الكورسات المتاحة ({courses.length})
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-6 py-3 text-sm font-bold border-b-2 cursor-pointer ${
            activeTab === 'packages' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-foreground'
          }`}
        >
          الباقات الشهرية المجمعة ({packages.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'courses' ? (
        courses.length === 0 ? (
          <EmptyState type="courses" title="لا يوجد كورسات منشورة بعد" description="لم يقم المعلم بنشر أي كورسات تفصيلية حتى الآن." />
        ) : (
          <div className="space-y-6">
            
            {/* Filter segmented tabs */}
            <div className="flex justify-center items-center pb-2 border-b border-[var(--border-color)]/30">
              <div className="flex bg-slate-900/80 backdrop-blur-md p-1 border border-slate-800 rounded-2xl gap-1 overflow-x-auto no-scrollbar scroll-smooth max-w-full sm:max-w-md w-auto">
                <button
                  type="button"
                  onClick={() => setCourseFilter('all')}
                  className={`px-6 py-2 rounded-xl text-xs font-black transition-all duration-300 whitespace-nowrap cursor-pointer ${
                    courseFilter === 'all'
                      ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setCourseFilter('online')}
                  className={`px-6 py-2 rounded-xl text-xs font-black transition-all duration-300 whitespace-nowrap cursor-pointer ${
                    courseFilter === 'online'
                      ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  أونلاين
                </button>
                <button
                  type="button"
                  onClick={() => setCourseFilter('center')}
                  className={`px-6 py-2 rounded-xl text-xs font-black transition-all duration-300 whitespace-nowrap cursor-pointer ${
                    courseFilter === 'center'
                      ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  سنتر
                </button>
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <EmptyState 
                type="courses" 
                title={
                  courseFilter === 'online' 
                    ? "لا توجد كورسات أونلاين" 
                    : "لا توجد كورسات سنتر"
                } 
                description={
                  courseFilter === 'online' 
                    ? "لم يتم نشر أي كورسات متوفرة للمشاهدة أونلاين لهذا المعلم بعد." 
                    : "لم يتم نشر أي كورسات مخصصة لطلاب السنتر لهذا المعلم بعد."
                } 
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {filteredCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    description={course.description}
                    coverImage={course.cover_image}
                    price={course.price}
                    subject={course.subject}
                    teacherName={teacher.name}
                    teacherAvatar={teacher.avatar}
                    slug={course.slug}
                    enableDiscount={course.enable_discount === true}
                    discountType={course.discount_type ?? undefined}
                    discountValue={course.discount_value ?? undefined}
                    finalPrice={course.final_price ?? undefined}
                    availability={course.availability}
                    lessonsCount={course.lessons_count}
                    isBundle={course.is_bundle === true || course.is_bundle === 1 || course.is_bundle === '1'}
                  />
                ))}
              </div>
            )}
          </div>
        )
      ) : (
        packages.length === 0 ? (
          <EmptyState type="courses" title="لا يوجد باقات حالياً" description="لا تتوفر باقات مجمعة لهذا المعلم حالياً." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                id={pkg.id}
                title={pkg.title}
                description={pkg.description}
                price={pkg.price}
                lessonsCount={pkg.lessons_count || pkg.lessons?.length || 0}
                courseId={pkg.course_id}
                courseTitle={pkg.course?.title || ''}
                courseSubject={pkg.course?.subject || teacher.subject}
                teacherName={teacher.name}
                teacherAvatar={teacher.avatar}
                packageThumbnail={pkg.package_thumbnail}
                coverImage={pkg.cover_image}
              />
            ))}
          </div>
        )
      )}

    </div>
  )
}
