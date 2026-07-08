import React from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import API from '../services/api'
import { useAuthStore } from '../store/authStore'
import { ChevronDown, Play, FileText, CheckCircle, Lock, Wallet, Calendar, ArrowRight, Video, BookOpen } from 'lucide-react'
import SEO from '../components/SEO'
import PurchaseModal from '../components/PurchaseModal'
import { getCourseDisplayPrice } from '../utils/pricing'

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
    id: number
    name: string
    avatar?: string
    subject: string
    slug?: string
  }
}

interface LessonItem {
  id: number
  title: string
  description: string
  order: number
  videos_count: number
  pdfs_count: number
  exams_count: number
}

interface UnitItem {
  id: number
  title: string
  order: number
  lessons: LessonItem[]
}

interface PackageItem {
  id: number
  title: string
  price: string
  description?: string
  cover_image?: string
  package_thumbnail?: string
  lessons_count?: number
  original_lessons_total?: number
  discount?: number
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

interface LastWatched {
  video_id: number
  video_title: string
  lesson_title: string
  last_position_seconds: number
  formatted_time: string
}

export default function CourseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isLoggedIn, user, updateUser } = useAuthStore()

  // States
  const [course, setCourse] = React.useState<CourseItem | null>(null)
  const [units, setUnits] = React.useState<UnitItem[]>([])
  const [packages, setPackages] = React.useState<PackageItem[]>([])
  const [isEnrolled, setIsEnrolled] = React.useState(false)
  const [lastWatched, setLastWatched] = React.useState<LastWatched | null>(null)
  const [availabilityMessage, setAvailabilityMessage] = React.useState<string | null>(null)
  
  const [loading, setLoading] = React.useState(true)
  const [purchasing, setPurchasing] = React.useState(false)
  const [purchaseError, setPurchaseError] = React.useState<string | null>(null)
  const [purchaseSuccess, setPurchaseSuccess] = React.useState<string | null>(null)
  
  // Purchase Modal States
  const [purchaseModalOpen, setPurchaseModalOpen] = React.useState(false)
  const [purchaseTarget, setPurchaseTarget] = React.useState<{ type: 'course' | 'package', itemId: number | string, title: string, price: string | number } | null>(null)
  
  // Accordion state (maps unit_id to boolean)
  const [expandedUnits, setExpandedUnits] = React.useState<Record<number, boolean>>({})

  const fetchDetails = React.useCallback(() => {
    API.get(`/courses/${id}`)
      .then((res) => {
        setCourse(res.data.course)
        setUnits(res.data.units || [])
        setPackages(res.data.packages || [])
        setIsEnrolled(res.data.is_enrolled || false)
        setLastWatched(res.data.last_watched || null)
        setAvailabilityMessage(res.data.availability_message || null)

        // Expand the first unit by default
        if (res.data.units.length > 0) {
          setExpandedUnits({ [res.data.units[0].id]: true })
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [id])

  React.useEffect(() => {
    fetchDetails()
  }, [fetchDetails, isLoggedIn])

  const toggleUnit = (unitId: number) => {
    setExpandedUnits((prev) => ({
      ...prev,
      [unitId]: !prev[unitId]
    }))
  }

  // Buy Full Course Flow
  const handleBuyCourse = async () => {
    if (!isLoggedIn) {
      // Direct redirect to login page (carrying state to return)
      navigate('/login', { state: { from: { pathname: `/course/${id}` } } })
      return
    }

    if (!course) return

    const pricing = getCourseDisplayPrice(course)
    setPurchaseTarget({
      type: 'course',
      itemId: course.id,
      title: course.title,
      price: pricing.finalPrice,
    })
    setPurchaseModalOpen(true)
  }

  // Buy Package Flow
  const handleBuyPackage = async (packageId: number) => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: { pathname: `/course/${id}` } } })
      return
    }

    const pkg = packages.find(p => p.id === packageId)
    if (!pkg) return

    setPurchaseTarget({
      type: 'package',
      itemId: pkg.id,
      title: pkg.title,
      price: pkg.price,
    })
    setPurchaseModalOpen(true)
  }

  const handlePurchaseSuccess = (newBalance: number) => {
    setIsEnrolled(true)
    if (user) {
      updateUser({
        wallet: {
          ...user.wallet,
          id: user.wallet?.id || 0,
          balance: newBalance.toFixed(2)
        }
      })
    }
    fetchDetails()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold">عذراً، هذا الكورس غير متوفر حالياً.</h2>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <SEO 
        title={`${course.title}`}
        description={`${course.description || `كورس ومحاضرات مادة ${SUBJECTS_TRANSLATION[course.subject] || course.subject} لطلاب ${GRADES_TRANSLATION[course.grade] || course.grade} مع الأستاذ ${course.teacher.name} على منصة خطوتك.`}`}
        keywords={`${course.title}, كورس ${SUBJECTS_TRANSLATION[course.subject] || course.subject}, ${course.teacher.name}, منصة خطوتك`}
        ogImage={course.cover_image}
        schema={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Course",
              "name": course.title,
              "description": course.description,
              "provider": {
                "@type": "EducationalOrganization",
                "name": "خطوتك",
                "url": "https://elm-platform.com"
              },
              "hasCourseInstance": {
                "@type": "CourseInstance",
                "courseMode": "online",
                "instructor": {
                  "@type": "Person",
                  "name": course.teacher.name,
                  "image": course.teacher.avatar ? (course.teacher.avatar.startsWith('http') ? course.teacher.avatar : `https://elm-platform.com${course.teacher.avatar}`) : undefined
                }
              },
              "offers": {
                "@type": "Offer",
                "price": getCourseDisplayPrice(course).finalPrice,
                "priceCurrency": "EGP",
                "category": "Paid"
              }
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
                  "name": "الكورسات",
                  "item": "https://elm-platform.com/courses"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": course.title,
                  "item": typeof window !== 'undefined' ? window.location.href : `https://elm-platform.com/courses/${course.slug || course.id}`
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
        <Link to="/courses" className="hover:text-brand-primary transition-colors">الكورسات</Link>
        <span>/</span>
        <span className="text-slate-200 font-bold truncate max-w-[250px]">{course.title}</span>
      </nav>
      
      {/* 1. Header Hero Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 bg-brand-card border border-[var(--border-color)] p-8 sm:p-12 rounded-3xl relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-primary/5 rounded-full blur-3xl -z-10" />

        {/* Info Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link 
              to={`/subject/${course.subject}`}
              className="px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-semibold rounded-full hover:bg-brand-primary/20 transition-all"
            >
              {SUBJECTS_TRANSLATION[course.subject] || course.subject}
            </Link>
            <Link 
              to={`/grade/${course.grade.replace('_', '-')}`}
              className="px-3 py-1 bg-slate-500/10 border border-slate-500/20 text-slate-300 text-xs font-semibold rounded-full hover:bg-slate-500/20 transition-all"
            >
              {GRADES_TRANSLATION[course.grade] || course.grade}
            </Link>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black leading-snug">{course.title}</h1>
          <p className="text-sm text-slate-300 font-light leading-relaxed">{course.description}</p>

          {/* Teacher row */}
          <div className="flex items-center gap-3 p-4 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-2xl w-fit">
            <div className="h-10 w-10 rounded-full bg-slate-800 border overflow-hidden">
              <img 
                src={course.teacher.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${course.teacher.name}`} 
                alt={course.teacher.name} 
                className="object-cover w-full h-full" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${course.teacher.name}`
                }}
              />
            </div>
            <div>
              <div className="text-xs text-slate-400">مدرس المادة:</div>
              <Link to={`/teacher/${course.teacher.slug || course.teacher.id}`} className="text-sm font-bold text-slate-100 hover:text-brand-primary transition-colors">
                {course.teacher.name}
              </Link>
            </div>
          </div>
        </div>

        {/* Purchase Column */}
        <div className="bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] p-8 rounded-2xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="text-xs text-slate-400">سعر الكورس بالكامل:</div>
            {(() => {
              const pricing = getCourseDisplayPrice(course)
              return pricing.hasDiscount ? (
                <div className="flex flex-col gap-1 select-none">
                  {/* Original Price */}
                  <span className="text-sm text-slate-500 line-through font-semibold">
                    {pricing.formattedOriginalPrice}
                  </span>
                  {/* Discount Badge + Final Price */}
                  <div className="flex items-center gap-2">
                    <span className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-[#10B981] to-[#34D399] bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(16,185,129,0.15)] hover:scale-[1.03] hover:drop-shadow-[0_0_15px_rgba(52,211,153,0.4)] transition-all duration-300 inline-block font-sans">
                      {pricing.formattedFinalPrice}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/25 text-xs font-bold shadow-[0_0_12px_rgba(16,185,129,0.15)] shrink-0">
                      {pricing.discountText}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="select-none">
                  <span className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-[#10B981] to-[#34D399] bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(16,185,129,0.15)] hover:scale-[1.03] hover:drop-shadow-[0_0_15px_rgba(52,211,153,0.4)] transition-all duration-300 inline-block font-sans">
                    {pricing.formattedOriginalPrice}
                  </span>
                </div>
              )
            })()}
            <p className="text-xs text-slate-500 font-light">يمنحك الاشتراك وصولاً فورياً مدى الحياة لجميع دروس وامتحانات الكورس.</p>
          </div>

          {purchaseError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
              {purchaseError}
            </div>
          )}

          {purchaseSuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-brand-success text-xs rounded-xl">
              {purchaseSuccess}
            </div>
          )}

          {isEnrolled ? (
            <div className="space-y-3">
              <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-brand-success text-center text-sm font-bold rounded-xl">
                مشترك بالفعل في هذا الكورس
              </div>
              <button
                onClick={() => {
                  if (units.length > 0 && units[0].lessons.length > 0) {
                    navigate(`/student/lessons/${units[0].lessons[0].id}`)
                  }
                }}
                className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-center text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>دخول الكورس</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleBuyCourse}
              disabled={purchasing}
              className="w-full py-3.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-center text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50"
            >
              {purchasing ? 'جاري التحويل...' : 'اشترك الآن'}
            </button>
          )}
        </div>

      </div>

      {/* 2. Resume Watching Panel (آخر مشاهدة) */}
      {isEnrolled && lastWatched && (
        <div className="p-6 bg-brand-primary/5 border border-brand-primary/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1.5 text-center sm:text-right">
            <span className="px-2.5 py-0.5 bg-brand-primary/10 border border-brand-primary/20 rounded-full text-[10px] font-bold text-brand-primary">
              آخر مشاهدة
            </span>
            <h3 className="font-bold text-sm sm:text-base pt-1">
              {lastWatched.lesson_title} - {lastWatched.video_title}
            </h3>
            <p className="text-xs text-slate-400 font-light">توقفت عند الدقيقة {lastWatched.formatted_time}</p>
          </div>
          <button
            onClick={() => navigate(`/student/lessons/${units[0].lessons[0].id}?play=${lastWatched.video_id}`)}
            className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            [ متابعة المشاهدة ]
          </button>
        </div>
      )}

      {/* 3. Monthly Packages Section */}
      {!isEnrolled && packages.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">أو اشترك في باقة شهرية محددة:</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg) => {
              const thumbnailToUse = pkg.package_thumbnail || pkg.cover_image || course?.cover_image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500';
              return (
                <div key={pkg.id} className="relative group bg-brand-card border border-border-color rounded-3xl overflow-hidden shadow-md hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(34,197,94,0.15)] hover:border-brand-primary/40 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-full text-right">
                  
                  {/* Thumbnail area */}
                  <div className="aspect-video w-full bg-brand-surface relative overflow-hidden">
                    <img 
                      src={thumbnailToUse} 
                      alt={pkg.title} 
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" 
                    />
                    
                    {/* Subject Overlay Badge */}
                    <div className="absolute top-3 right-3 px-3 py-1 bg-black/80 text-white rounded-full text-[10px] font-black tracking-wide border border-white/10">
                      {SUBJECTS_TRANSLATION[course?.subject || ''] || course?.subject || ''}
                    </div>

                    {/* Package Label Overlay */}
                    <div className="absolute top-3 left-3 px-3 py-1 bg-amber-500/90 text-black rounded-full text-[10px] font-black shadow-md">
                      باقة مجمعة
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
                    <div className="space-y-3 text-right">
                      {/* Teacher Details */}
                      <div className="flex items-center gap-2.5 justify-start">
                        <div className="h-7 w-7 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-xs font-black text-brand-primary overflow-hidden shrink-0">
                          {course?.teacher?.avatar ? (
                            <img src={course.teacher.avatar} alt={course.teacher.name} className="object-cover w-full h-full" />
                          ) : (
                            course?.teacher?.name?.charAt(0) || ''
                          )}
                        </div>
                        <span className="text-xs text-text-secondary font-bold hover:text-brand-primary transition-colors">{course?.teacher?.name}</span>
                      </div>

                      {/* Title and description */}
                      <div className="space-y-1">
                        <h3 className="font-black text-base text-foreground group-hover:text-brand-primary transition-colors duration-200 line-clamp-1 leading-normal text-right">
                          {pkg.title}
                        </h3>
                        <p className="text-xs text-text-secondary font-semibold line-clamp-2 leading-relaxed min-h-[2rem] text-right">
                          {pkg.description || "اشتراك شهري مخصص لمجموعة من الدروس بسعر مخفض."}
                        </p>
                      </div>
                    </div>

                    {/* Lessons count */}
                    <div className="w-full space-y-2 pt-2 border-t border-border-color/60 text-xs text-text-secondary font-semibold text-right">
                      <div className="flex items-center gap-1.5 justify-start">
                        <BookOpen className="h-3.5 w-3.5 text-text-secondary/70" />
                        <span>عدد المحاضرات المشمولة: {pkg.lessons_count || 0} محاضرة</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Action Footer */}
                  <div className="p-6 pt-0 border-t border-border-color/50 bg-brand-surface/20 flex items-center justify-between gap-4">
                    <span className="text-base font-black text-brand-primary">
                      {pkg.price === '0.00' || pkg.price === '0' || Number(pkg.price) === 0 ? 'مجاني' : `${pkg.price} ج.م`}
                    </span>
                    <button
                      onClick={() => handleBuyPackage(pkg.id)}
                      disabled={purchasing}
                      className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-lg hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all duration-200"
                    >
                      شراء الباقة
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Curriculum Accordion Structure */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">منهج ومحتوى الكورس:</h2>

        {availabilityMessage ? (
          <div className="bg-amber-500/10 border border-amber-500/30 p-8 rounded-3xl flex flex-col items-center text-center gap-3 max-w-xl mx-auto shadow-md">
            <span className="text-3xl">🏫</span>
            <h3 className="font-black text-sm sm:text-base text-amber-500">هذا الكورس مخصص لطلاب السنتر</h3>
            <p className="text-xs text-slate-300 font-light leading-relaxed">{availabilityMessage}</p>
          </div>
        ) : units.length === 0 ? (
          <div className="text-center p-12 border border-[var(--border-color)] rounded-2xl text-slate-400 text-sm font-light">
            لم يقم المدرس بنشر أي وحدات دراسية لهذا الكورس حتى الآن.
          </div>
        ) : (
          <div className="space-y-4">
            {units.map((unit) => {
              const isExpanded = !!expandedUnits[unit.id]
              return (
                <div key={unit.id} className="border border-[var(--border-color)] bg-brand-card rounded-2xl overflow-hidden transition-all duration-300">
                  
                  {/* Unit Title Header */}
                  <button
                    onClick={() => toggleUnit(unit.id)}
                    className="w-full flex items-center justify-between p-6 text-right font-bold text-sm sm:text-base cursor-pointer hover:bg-[rgba(255,255,255,0.01)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-400">الوحدة {unit.order}</span>
                      <span>{unit.title}</span>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-brand-primary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Lessons list details */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border-color)] bg-[rgba(0,0,0,0.1)] divide-y divide-[var(--border-color)]">
                      {unit.lessons.length === 0 ? (
                        <div className="p-6 text-xs text-slate-500 font-light text-center">لا توجد محاضرات في هذه الوحدة حالياً.</div>
                      ) : (
                        unit.lessons.map((lesson) => {
                          const LessonContent = (
                            <div className="flex items-center justify-between p-6">
                              <div className="space-y-1">
                                <h4 className="font-bold text-xs sm:text-sm text-slate-200">{lesson.title}</h4>
                                {lesson.description && (
                                  <p className="text-[10px] sm:text-xs text-slate-400 font-light line-clamp-1 leading-relaxed">
                                    {lesson.description}
                                  </p>
                                )}
                              </div>
                              
                              {/* Video, PDF counts or lock */}
                              <div className="flex items-center gap-4">
                                <div className="hidden sm:flex items-center gap-3 text-slate-400 text-xs font-light">
                                  {lesson.videos_count > 0 && (
                                    <span className="flex items-center gap-1"><Play className="h-3.5 w-3.5 text-brand-primary" /> {lesson.videos_count} فيديو</span>
                                  )}
                                  {lesson.pdfs_count > 0 && (
                                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-brand-primary" /> {lesson.pdfs_count} ملخص</span>
                                  )}
                                </div>
                                
                                {isEnrolled ? (
                                  <CheckCircle className="h-5 w-5 text-brand-success shrink-0" />
                                ) : (
                                  <Lock className="h-4 w-4 text-slate-500 shrink-0" />
                                )}
                              </div>
                            </div>
                          )

                          return isEnrolled ? (
                            <Link key={lesson.id} to={`/student/lessons/${lesson.id}`} className="block hover:bg-brand-primary/5 transition-colors">
                              {LessonContent}
                            </Link>
                          ) : (
                            <div key={lesson.id} className="opacity-80">
                              {LessonContent}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        )}
      </div>

      {purchaseTarget && (
        <PurchaseModal
          isOpen={purchaseModalOpen}
          onClose={() => {
            setPurchaseModalOpen(false)
            setPurchaseTarget(null)
          }}
          onSuccess={handlePurchaseSuccess}
          title={purchaseTarget.title}
          price={purchaseTarget.price}
          type={purchaseTarget.type}
          itemId={purchaseTarget.itemId}
          walletBalance={parseFloat(user?.wallet?.balance || '0.00')}
        />
      )}
    </div>
  )
}
