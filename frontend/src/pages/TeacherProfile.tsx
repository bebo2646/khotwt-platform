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
  subject: string
  avatar?: string
  experience: string
  bio: string
  grades?: string[]
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

export default function TeacherProfile() {
  const { id } = useParams()
  
  const [teacher, setTeacher] = React.useState<TeacherItem | null>(null)
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [packages, setPackages] = React.useState<PackageItem[]>([])
  const [stats, setStats] = React.useState({ courses_count: 0, students_count: 0 })
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<'courses' | 'packages'>('courses')

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
        title={`${teacher.name} | مدرس ${SUBJECTS_TRANSLATION[teacher.subject] || teacher.subject}`}
        description={`تعلم ال${SUBJECTS_TRANSLATION[teacher.subject] || teacher.subject} مع ${teacher.name} من خلال محاضرات واختبارات تفاعلية ومتابعة مستمرة على منصة خطوتك.`}
        keywords={`${teacher.name}, مدرس ${SUBJECTS_TRANSLATION[teacher.subject] || teacher.subject}, كورسات ${teacher.name}, منصة خطوتك`}
        ogImage={teacher.avatar}
        schema={{
          "@context": "https://schema.org",
          "@type": "Person",
          "name": teacher.name,
          "jobTitle": `مدرس ${SUBJECTS_TRANSLATION[teacher.subject] || teacher.subject}`,
          "image": teacher.avatar ? (teacher.avatar.startsWith('http') ? teacher.avatar : `${window.location.origin}${teacher.avatar}`) : `${window.location.origin}/og-image.jpg`,
          "url": window.location.href,
          "description": teacher.bio || `صفحة المدرس الشخصية على منصة خطوتك`
        }}
      />
      
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
              <p className="text-sm font-bold">
                <Link to={`/subject/${teacher.subject}`} className="text-brand-primary hover:underline transition-all">
                  مدرس {SUBJECTS_TRANSLATION[teacher.subject] || teacher.subject}
                </Link>
              </p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {courses.map((course) => (
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
                enableDiscount={course.enable_discount}
                discountType={course.discount_type}
                discountValue={course.discount_value}
                finalPrice={course.final_price}
              />
            ))}
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
