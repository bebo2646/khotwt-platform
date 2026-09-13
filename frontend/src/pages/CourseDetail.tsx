import React from 'react'
import { useParams, useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom'
import API from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useModalStore } from '../store/modalStore'
import { ChevronDown, Play, FileText, CheckCircle, Lock, Wallet, Calendar, ArrowRight, ArrowLeft, Video, BookOpen, HelpCircle, ClipboardList, Clock, Eye, Award, X } from 'lucide-react'
import SEO from '../components/SEO'
import { checkExamAvailability } from '../utils/exam'
import PurchaseModal from '../components/PurchaseModal'
import { getCourseDisplayPrice } from '../utils/pricing'
import LessonViewer from './student/LessonViewer'
import ExamPlayer from './student/ExamPlayer'
import ExamResults from './student/ExamResults'
import { formatDurationArabic, formatWatchedTimeArabic } from '../utils/video'
import { useTaxonomyStore } from '../store/taxonomyStore'

interface CourseItem {
  id: number
  title: string
  slug?: string
  description: string
  cover_image: string
  price: string
  grade: string
  subject: string
  availability?: 'online' | 'center' | 'both'
  is_bundle?: boolean
  enable_discount?: boolean
  discount_type?: 'percentage' | 'fixed' | null
  discount_value?: number | null
  final_price?: number | null
  bundle_original_price?: number | string | null
  bundle_savings?: number | string | null
  teacher: {
    id: number
    name: string
    avatar?: string
    subject: string
    slug?: string
  }
}

interface VideoDetail {
  id: number
  title: string
  duration_seconds?: number
  duration_text?: string
  is_locked: boolean
  video_url?: string | null
  bunny_id?: string | null
  progress?: {
    views_used: number
    watched_seconds: number
    watched_percentage: number
    completed: boolean
    last_position_seconds: number
    last_watched_at: string | null
    views_allowed: number
    views_remaining: number
    status: string
  }
}

interface PdfDetail {
  id: number
  title: string
  is_locked: boolean
  file_path?: string | null
  page_count?: number | null
  file_size?: string | null
  progress?: {
    open_count: number
    last_opened_at: string | null
    status: string
  }
}

interface ExamDetail {
  id: number
  title: string
  type: 'quiz' | 'homework' | 'monthly_exam'
  is_locked: boolean
  time_limit_minutes?: number | null
  homework_type?: string
  questions_count?: number
  max_score?: number
  passing_score?: number
  max_attempts?: number
  open_date?: string | null
  close_date?: string | null
  progress?: {
    attempts_used: number
    attempts_remaining: number
    last_attempt_status: string | null
    score: number | null
    status: string
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
  is_locked: boolean
  videos?: VideoDetail[]
  pdfs?: PdfDetail[]
  exams?: ExamDetail[]
  course_id?: number | null
  package_id?: number | null
  matching_package_id?: number | null
}

interface UnitItem {
  id: number
  title: string
  order: number
  lessons: LessonItem[]
  child_course_id?: number | null
  child_course_title?: string | null
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
  integrated_science: 'علوم متكاملة',
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
  const location = useLocation()
  const { isLoggedIn, user, updateUser } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const packageId = searchParams.get('package_id')
  const lessonId = searchParams.get('lesson_id')
  const videoId = searchParams.get('video_id')
  const pdfId = searchParams.get('pdf_id')
  const examId = searchParams.get('exam_id')
  const showResult = searchParams.get('show_result') === 'true'

  // States
  const [course, setCourse] = React.useState<CourseItem | null>(null)
  const [units, setUnits] = React.useState<UnitItem[]>([])
  const [childCourses, setChildCourses] = React.useState<any[]>([])
  const [packages, setPackages] = React.useState<PackageItem[]>([])
  const [isEnrolled, setIsEnrolled] = React.useState(false)
  const [lastWatched, setLastWatched] = React.useState<LastWatched | null>(null)
  const [availabilityMessage, setAvailabilityMessage] = React.useState<string | null>(null)
  const [viewLimitExceeded, setViewLimitExceeded] = React.useState(false)
  const [viewLimitMessage, setViewLimitMessage] = React.useState<string | null>(null)
  const [viewLimitDetails, setViewLimitDetails] = React.useState<any>(null)
  const [rechargeCode, setRechargeCode] = React.useState('')
  const [redeemingCode, setRedeemingCode] = React.useState(false)
  
  const [loading, setLoading] = React.useState(true)
  const [purchasing, setPurchasing] = React.useState(false)
  const [purchaseError, setPurchaseError] = React.useState<string | null>(null)
  const [purchaseSuccess, setPurchaseSuccess] = React.useState<string | null>(null)
  
  // Purchase Modal States
  const [purchaseModalOpen, setPurchaseModalOpen] = React.useState(false)
  const [purchaseTarget, setPurchaseTarget] = React.useState<{ type: 'course' | 'package', itemId: number | string, title: string, price: string | number } | null>(null)
  
  // Accordion state (maps unit_id to boolean)
  const [expandedUnits, setExpandedUnits] = React.useState<Record<number, boolean>>({})
  const viewerRef = React.useRef<HTMLDivElement | null>(null)

  // Expanded content items (maps 'video-id', 'pdf-id', or 'exam-id' to boolean)
  const [expandedContentItems, setExpandedContentItems] = React.useState<Record<string, boolean>>({})

  const toggleContentItem = (key: string) => {
    setExpandedContentItems((prev) => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const renderStatusBadge = (status: string, type: 'video' | 'pdf' | 'exam' | 'homework') => {
    let label = '';
    let colorClass = '';

    switch (status) {
      case 'completed':
      case 'submitted':
        label = type === 'video' ? 'مكتمل' : (type === 'pdf' ? 'تم فتحه' : 'تم التسليم');
        colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
        break;
      case 'in_progress':
        label = type === 'video' ? 'قيد المشاهدة' : 'جاري الحل';
        colorClass = 'bg-amber-500/10 text-amber-400 border-amber-500/25';
        break;
      case 'graded':
        label = type === 'homework' ? 'تم التصحيح' : 'تمت المراجعة';
        colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/25';
        break;
      case 'expired':
        label = type === 'video' ? 'منتهي المشاهدات' : 'انتهى الموعد';
        colorClass = 'bg-slate-500/10 text-slate-400 border-slate-500/25';
        break;
      case 'not_started':
      default:
        label = 'لم يبدأ';
        colorClass = 'bg-rose-500/10 text-rose-400 border-rose-500/25';
        break;
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${colorClass} shrink-0`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <span>{label}</span>
      </span>
    );
  }

  const renderLessonsList = (unitLessons: any[]) => {
    if (!unitLessons || unitLessons.length === 0) {
      return (
        <div className="p-5 text-xs text-slate-500 font-light text-center">لا توجد محاضرات في هذه الوحدة حالياً.</div>
      )
    }

    return unitLessons.map((lesson: any) => {
      const hasContent = (lesson.videos && lesson.videos.length > 0) ||
                         (lesson.pdfs && lesson.pdfs.length > 0) ||
                         (lesson.exams && lesson.exams.length > 0);
      
      return (
        <div key={lesson.id} className="p-5 space-y-4 transition-all hover:bg-slate-900/10">
          {/* Lesson Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-xs sm:text-sm text-slate-200 text-right">{lesson.title}</h4>
              {lesson.description && (
                <p className="text-[10px] sm:text-xs text-slate-400 font-light leading-relaxed text-right">
                  {lesson.description}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (!isEnrolled) {
                    useModalStore.getState().showToast("هذا الكورس مقيد حالياً. يرجى الشراء أو الاشتراك لفتح المحتوى.", "warning");
                  } else {
                    if (lesson.videos && lesson.videos.length > 0) {
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set('video_id', lesson.videos[0].id.toString());
                        next.set('lesson_id', lesson.id.toString());
                        next.delete('pdf_id');
                        next.delete('exam_id');
                        next.delete('show_result');
                        return next;
                      });
                    } else if (lesson.pdfs && lesson.pdfs.length > 0) {
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set('pdf_id', lesson.pdfs[0].id.toString());
                        next.set('lesson_id', lesson.id.toString());
                        next.delete('video_id');
                        next.delete('exam_id');
                        next.delete('show_result');
                        return next;
                      });
                    } else if (lesson.exams && lesson.exams.length > 0) {
                      const ex = lesson.exams[0];
                      const isFinished = ex.progress?.status === 'completed' || ex.progress?.status === 'graded' || ex.progress?.status === 'submitted' || (ex.progress?.attempts_remaining !== undefined && ex.progress.attempts_remaining <= 0);
                      if (isFinished) {
                        navigate(`/student/exams/${ex.id}/result?course_id=${course?.id}`);
                      } else {
                        checkExamAvailability(ex.id).then((allowed) => {
                          if (allowed) {
                            navigate(`/student/exams/${ex.id}?course_id=${course?.id}`);
                          }
                        })
                      }
                    }
                  }
                }}
                className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1 shrink-0 border ${
                  !isEnrolled 
                    ? "bg-slate-800/40 text-slate-500 border-slate-700/50 hover:bg-slate-800/60"
                    : "bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white border border-brand-primary/20 hover:border-brand-primary/45"
                }`}
              >
                <span>{!isEnrolled ? "بدء الدراسة 🔒" : "بدء الدراسة"}</span>
                <ArrowLeft className="h-3 w-3" />
              </button>
              {isEnrolled && (
                !lesson.is_locked ? (
                  <CheckCircle className="h-5 w-5 text-brand-success shrink-0" />
                ) : (
                  <Lock className="h-4 w-4 text-slate-500 shrink-0" />
                )
              )}
            </div>
          </div>

          {/* Lesson Contents Nested List */}
          {hasContent && (
            <div className="mr-2 sm:mr-4 pr-2 sm:pr-4 border-r border-[var(--border-color)] space-y-4 pt-2 text-right">
              {/* Videos */}
              {lesson.videos && lesson.videos.map((vid: any) => (
                <div key={vid.id} className="border border-slate-900 bg-slate-950/20 hover:bg-slate-900/10 rounded-2xl p-4.5 space-y-3.5 transition-all duration-300">
                  
                  {/* Video Header / Trigger */}
                  <div 
                    onClick={() => toggleContentItem(`video-${vid.id}`)}
                    className="flex items-center justify-between text-[11px] sm:text-xs text-slate-300 hover:text-slate-100 transition-colors cursor-pointer select-none font-sans"
                  >
                    <div className="flex items-center gap-2.5">
                      <Play className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                      <span className="font-semibold text-slate-200">▶ مشاهدة الفيديو: {vid.title}</span>
                      {(vid.duration_seconds || vid.duration_text) && (
                        <span className="text-[10px] text-slate-500">({formatDurationArabic(vid.duration_seconds || 0)})</span>
                      )}
                      {!vid.is_locked && vid.progress && renderStatusBadge(vid.progress.status, 'video')}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (vid.is_locked) {
                            useModalStore.getState().showToast("هذا الكورس مقيد حالياً. يرجى الشراء أو الاشتراك لفتح المحتوى.", "warning");
                          } else {
                            setSearchParams((prev) => {
                              const next = new URLSearchParams(prev);
                              next.set('video_id', vid.id.toString());
                              next.set('lesson_id', lesson.id.toString());
                              next.delete('pdf_id');
                              next.delete('exam_id');
                              next.delete('show_result');
                              return next;
                            });
                          }
                        }}
                        className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer border ${
                          vid.is_locked
                            ? "bg-slate-800/40 text-slate-500 border-slate-700/50 hover:bg-slate-800/60"
                            : "bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white border border-brand-primary/20 hover:border-brand-primary/45"
                        }`}
                      >
                        {vid.is_locked ? "تشغيل 🔒" : "تشغيل"}
                      </button>
                      <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${expandedContentItems[`video-${vid.id}`] ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Video Info Panel */}
                  {expandedContentItems[`video-${vid.id}`] && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 bg-slate-950/60 border border-[var(--border-color)] rounded-xl text-[11px] sm:text-xs text-slate-300 animate-slide-down">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">⏳ مدة الفيديو:</span>
                        <span className="font-bold text-slate-100">{formatDurationArabic(vid.duration_seconds || 0)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{(!vid.progress || vid.progress.views_allowed === -1) ? '👁️ عدد المشاهدات:' : '👁️ المشاهدات المسموح بها:'}</span>
                        <span className="font-bold text-slate-100 text-right">
                          {(!vid.progress || vid.progress.views_allowed === -1) ? 'غير محدود' : vid.progress.views_allowed}
                        </span>
                      </div>
                      <div className={`flex items-center gap-2 ${(!vid.progress || vid.progress.views_allowed === -1) ? 'hidden' : ''}`}>
                        <span className="text-slate-500">📈 المشاهدات المستخدمة:</span>
                        <span className="font-bold text-slate-100">{vid.progress?.views_used || 0}</span>
                      </div>
                      <div className={`flex items-center gap-2 ${(!vid.progress || vid.progress.views_allowed === -1) ? 'hidden' : ''}`}>
                        <span className="text-slate-500">🔐 المشاهدات المتبقية:</span>
                        <span className="font-bold text-slate-100 text-right">
                          {(!vid.progress || vid.progress.views_allowed === -1) ? 'غير محدود' : vid.progress?.views_remaining || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">⏱️ إجمالي وقت المشاهدة:</span>
                        <span className="font-bold text-slate-100">{formatWatchedTimeArabic(vid.progress?.watched_seconds || 0)}</span>
                      </div>
                      {vid.progress?.last_watched_at && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">📅 آخر مشاهدة:</span>
                          <span className="font-bold text-slate-100 truncate" title={new Date(vid.progress.last_watched_at).toLocaleString('ar-EG')}>
                            {new Date(vid.progress.last_watched_at).toLocaleDateString('ar-EG')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {expandedContentItems[`video-${vid.id}`] && vid.is_locked && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2 animate-slide-down text-right" dir="rtl">
                      <Lock className="h-4 w-4 shrink-0 text-rose-500" />
                      <span className="font-semibold">هذا المحتوى مقيد حالياً. يرجى الشراء أو الاشتراك لفتح المحتوى. / This course is currently restricted. Purchase or enroll to unlock the content.</span>
                    </div>
                  )}
                </div>
              ))}

              {/* PDFs */}
              {lesson.pdfs && lesson.pdfs.map((pdf: any) => (
                <div key={pdf.id} className="border border-slate-900 bg-slate-950/20 hover:bg-slate-900/10 rounded-2xl p-4.5 space-y-3.5 transition-all duration-300">
                  
                  {/* PDF Header / Trigger */}
                  <div 
                    onClick={() => toggleContentItem(`pdf-${pdf.id}`)}
                    className="flex items-center justify-between text-[11px] sm:text-xs text-slate-300 hover:text-slate-100 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="font-semibold text-slate-200">📄 فتح الملف: {pdf.title}</span>
                      {!pdf.is_locked && pdf.progress && pdf.progress.status !== 'not_started' && renderStatusBadge(pdf.progress.status, 'pdf')}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pdf.is_locked) {
                            useModalStore.getState().showToast("هذا الكورس مقيد حالياً. يرجى الشراء أو الاشتراك لفتح المحتوى.", "warning");
                          } else {
                            setSearchParams((prev) => {
                              const next = new URLSearchParams(prev);
                              next.set('pdf_id', pdf.id.toString());
                              next.set('lesson_id', lesson.id.toString());
                              next.delete('video_id');
                              next.delete('exam_id');
                              next.delete('show_result');
                              return next;
                            });
                          }
                        }}
                        className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer border ${
                          pdf.is_locked
                            ? "bg-slate-800/40 text-slate-500 border-slate-700/50 hover:bg-slate-800/60"
                            : "bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-emerald-500/45"
                        }`}
                      >
                        {pdf.is_locked ? "عرض الملف 🔒" : "عرض الملف"}
                      </button>
                      <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${expandedContentItems[`pdf-${pdf.id}`] ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* PDF Info Panel */}
                  {expandedContentItems[`pdf-${pdf.id}`] && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 bg-slate-950/60 border border-[var(--border-color)] rounded-xl text-[11px] sm:text-xs text-slate-300 animate-slide-down">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">📖 عدد الصفحات:</span>
                        <span className="font-bold text-slate-100">{pdf.page_count || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">💾 حجم الملف:</span>
                        <span className="font-bold text-slate-100">{pdf.file_size || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">👁️ عدد مرات الفتح:</span>
                        <span className="font-bold text-slate-100">{pdf.progress?.open_count || 0}</span>
                      </div>
                      {pdf.progress?.last_opened_at && (
                        <div className="flex items-center gap-2 col-span-1 sm:col-span-2 lg:col-span-1">
                          <span className="text-slate-500">📅 آخر مرة تم فتحه:</span>
                          <span className="font-bold text-slate-100" title={new Date(pdf.progress.last_opened_at).toLocaleString('ar-EG')}>
                            {new Date(pdf.progress.last_opened_at).toLocaleDateString('ar-EG')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {expandedContentItems[`pdf-${pdf.id}`] && pdf.is_locked && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2 animate-slide-down text-right" dir="rtl">
                      <Lock className="h-4 w-4 shrink-0 text-rose-500" />
                      <span className="font-semibold">هذا المحتوى مقيد حالياً. يرجى الشراء أو الاشتراك لفتح المحتوى. / This course is currently restricted. Purchase or enroll to unlock the content.</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Exams */}
              {lesson.exams && lesson.exams.map((ex: any) => {
                const isHomework = ex.type === 'homework';
                return (
                  <div key={ex.id} className="border border-slate-900 bg-slate-950/20 hover:bg-slate-900/10 rounded-2xl p-4.5 space-y-3.5 transition-all duration-300">
                    
                    {/* Exam Header / Trigger */}
                    <div 
                      onClick={() => toggleContentItem(`exam-${ex.id}`)}
                      className="flex items-center justify-between text-[11px] sm:text-xs text-slate-300 hover:text-slate-100 transition-colors cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        {isHomework ? (
                          <ClipboardList className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        ) : (
                          <HelpCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-200">
                          {isHomework ? "📝 الواجب: " : "🧪 الامتحان: "} {ex.title}
                        </span>
                        {!ex.is_locked && ex.progress && renderStatusBadge(ex.progress.status, isHomework ? 'homework' : 'exam')}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ex.is_locked) {
                              useModalStore.getState().showToast("هذا الكورس مقيد حالياً. يرجى الشراء أو الاشتراك لفتح المحتوى.", "warning");
                            } else {
                              const isFinished = ex.progress?.status === 'completed' || ex.progress?.status === 'graded' || ex.progress?.status === 'submitted' || (ex.progress?.attempts_remaining !== undefined && ex.progress.attempts_remaining <= 0);
                              if (isFinished) {
                                navigate(`/student/exams/${ex.id}/result?course_id=${course?.id}`);
                              } else {
                                checkExamAvailability(ex.id).then((allowed) => {
                                  if (allowed) {
                                    navigate(`/student/exams/${ex.id}?course_id=${course?.id}`);
                                  }
                                })
                              }
                            }
                          }}
                          className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer border ${
                            ex.is_locked
                              ? "bg-slate-800/40 text-slate-500 border-slate-700/50 hover:bg-slate-800/60"
                              : (ex.progress?.status === 'completed' || ex.progress?.status === 'graded' || ex.progress?.status === 'submitted' || (ex.progress?.attempts_remaining !== undefined && ex.progress.attempts_remaining <= 0))
                              ? "bg-brand-success/10 hover:bg-brand-success text-brand-success hover:text-white border-brand-success/20 hover:border-brand-success/45"
                              : "bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white border-amber-500/20 hover:border-amber-500/45"
                          }`}
                        >
                          {ex.is_locked ? "ابدأ الآن 🔒" : ((ex.progress?.status === 'completed' || ex.progress?.status === 'graded' || ex.progress?.status === 'submitted' || (ex.progress?.attempts_remaining !== undefined && ex.progress.attempts_remaining <= 0)) ? 'عرض النتيجة' : (ex.progress?.status === 'in_progress' ? 'استكمال' : 'ابدأ الآن'))}
                        </button>
                        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${expandedContentItems[`exam-${ex.id}`] ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {expandedContentItems[`exam-${ex.id}`] && (
                      <div className="p-4 bg-slate-950/60 border border-[var(--border-color)] rounded-2xl text-[11px] sm:text-xs text-slate-300 animate-slide-down space-y-3.5">
                        
                        {/* Section 1: General Exam Metadata */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">⏱️ مدة الامتحان:</span>
                            <span className="font-bold text-slate-100">
                              {ex.time_limit_minutes || ex.duration_minutes ? `${ex.time_limit_minutes || ex.duration_minutes} دقيقة` : 'Unlimited'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">❓ عدد الأسئلة:</span>
                            <span className="font-bold text-slate-100">
                              {ex.questions_count !== undefined ? `${ex.questions_count} سؤال` : '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">🏆 الدرجة الكلية:</span>
                            <span className="font-bold text-slate-100">
                              {ex.max_score !== undefined ? `${ex.max_score} درجة` : '-'}
                            </span>
                          </div>

                          {/* Start / End Schedule Times */}
                          {(() => {
                            const startD = ex.open_date || ex.start_date;
                            const startT = ex.open_time || ex.start_time || '00:00';
                            const endD = ex.close_date || ex.end_date;
                            const endT = ex.close_time || ex.end_time || '23:59';

                            return (
                              <>
                                {startD && (
                                  <div className="flex items-center gap-2 col-span-1">
                                    <span className="text-slate-500">📅 يبدأ في:</span>
                                    <span className="font-bold text-slate-100" dir="ltr">
                                      {startD} {startT.substring(0, 5)}
                                    </span>
                                  </div>
                                )}
                                {endD && (
                                  <div className="flex items-center gap-2 col-span-1">
                                    <span className="text-slate-500">📅 ينتهي في:</span>
                                    <span className="font-bold text-slate-100" dir="ltr">
                                      {endD} {endT.substring(0, 5)}
                                    </span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* Section 2: Student Attempt Details */}
                        {ex.attempts_count > 0 && (
                          <div className="pt-3 border-t border-slate-900/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">🔄 المحاولات المستخدمة:</span>
                              <span className="font-bold text-slate-100">
                                {ex.attempts_count} / {ex.max_attempts}
                              </span>
                            </div>

                            {ex.last_attempt && (
                              <div className="flex items-center gap-2 col-span-1 sm:col-span-2 lg:col-span-1">
                                <span className="text-slate-500">🕒 آخر محاولة:</span>
                                <span className="font-bold text-slate-100">
                                  {new Date(ex.last_attempt.submitted_at || ex.last_attempt.created_at).toLocaleString('ar-EG', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            )}

                            {ex.max_attempts > 1 && ex.best_attempt && ex.best_attempt.score !== null && (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500">🎯 أفضل درجة:</span>
                                <span className="font-bold text-slate-100">
                                  {ex.best_attempt.score} / {ex.max_score}
                                </span>
                              </div>
                            )}

                            {/* Status and Anti-cheat status lock */}
                            {ex.last_attempt && (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500">📊 الحالة الحالية:</span>
                                <span className="font-bold">
                                  {(() => {
                                    if (ex.last_attempt.is_suspicious) {
                                      return <span className="text-rose-400 font-bold">Locked (مغلق ومحجوب تلقائياً)</span>;
                                    }
                                    
                                    const status = ex.last_attempt.status;
                                    if (status === 'graded') {
                                      const score = ex.last_attempt.score ?? 0;
                                      const passScore = ex.passing_score ?? (ex.max_score * 0.5);
                                      return score >= passScore 
                                        ? <span className="text-emerald-400 font-bold">Passed (ناجح)</span>
                                        : <span className="text-rose-400 font-bold">Failed (راسب)</span>;
                                    }
                                    if (status === 'submitted') {
                                      return <span className="text-amber-400 font-bold">Awaiting Review (بانتظار التصحيح)</span>;
                                    }
                                    return <span className="text-slate-350">{status}</span>;
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        {expandedContentItems[`exam-${ex.id}`] && ex.is_locked && (
                       <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2 animate-slide-down text-right" dir="rtl">
                         <Lock className="h-4 w-4 shrink-0 text-rose-500" />
                         <span className="font-semibold">هذا المحتوى مقيد حالياً. يرجى الشراء أو الاشتراك لفتح المحتوى. / This course is currently restricted. Purchase or enroll to unlock the content.</span>
                       </div>
                     )}
                   </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  }

  const fetchDetails = React.useCallback(() => {
    const params = new URLSearchParams()
    if (packageId) params.append('package_id', packageId)
    if (lessonId) params.append('lesson_id', lessonId)

    console.log({
        pathname: location.pathname,
        paramsId: id,
        search: searchParams.toString(),
        currentCourse: course?.id
    });

    API.get(`/courses/${id}?${params.toString()}`)
      .then((res) => {
        setCourse(res.data.course)
        console.log("Course after update:", res.data.course.id);
        setUnits(res.data.units || [])
        setChildCourses(res.data.child_courses || [])
        setPackages(res.data.packages || [])
        setIsEnrolled(res.data.is_enrolled || false)
        setLastWatched(res.data.last_watched || null)
        setAvailabilityMessage(res.data.availability_message || null)
        setViewLimitExceeded(res.data.view_limit_exceeded || false)
        setViewLimitMessage(res.data.view_limit_message || null)
        setViewLimitDetails(res.data.view_limit_details || null)

        // Closed by default (do not auto-expand the first unit)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [id, packageId, lessonId])

  const handleRedeemRechargeCode = async () => {
    if (!rechargeCode.trim()) return
    setRedeemingCode(true)
    try {
      const res = await API.post('/wallet/redeem', { code: rechargeCode })
      useModalStore.getState().showToast(res.data.message || 'تم شحن الكود بنجاح!', 'success')
      setRechargeCode('')
      fetchDetails()
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'كود غير صالح أو منتهي الصلاحية.'
      useModalStore.getState().showAlert({
        title: 'فشل التفعيل',
        description: errorMsg,
        type: 'error'
      })
    } finally {
      setRedeemingCode(false)
    }
  }

  React.useEffect(() => {
    fetchDetails()
  }, [fetchDetails, isLoggedIn])

  React.useEffect(() => {
    if (videoId || pdfId) {
      const handleScroll = () => {
        if (viewerRef.current) {
          viewerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };

      // Trigger scroll immediately and at staggered intervals to prevent layout shift offset issues
      handleScroll();
      const t1 = setTimeout(handleScroll, 100);
      const t2 = setTimeout(handleScroll, 300);
      const t3 = setTimeout(handleScroll, 600);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [videoId, pdfId])

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

  const displayUnitsCount = units.length;

  const displayLessonsCount = units.reduce((acc: number, u: any) => acc + (u.lessons ? u.lessons.length : 0), 0);

  const displayVideosCount = units.reduce((acc: number, u: any) => 
    acc + (u.lessons ? u.lessons.reduce((lAcc: number, l: any) => lAcc + (l.videos ? l.videos.length : (l.videos_count || 0)), 0) : 0), 0
  );

  const displayPdfsCount = units.reduce((acc: number, u: any) => 
    acc + (u.lessons ? u.lessons.reduce((lAcc: number, l: any) => lAcc + (l.pdfs ? l.pdfs.length : (l.pdfs_count || 0)), 0) : 0), 0
  );

  const displayExamsCount = units.reduce((acc: number, u: any) => 
    acc + (u.lessons ? u.lessons.reduce((lAcc: number, l: any) => lAcc + (l.exams ? l.exams.length : (l.exams_count || 0)), 0) : 0), 0
  );


  const getActiveVideoTitle = () => {
    if (videoId) {
      for (const unit of units) {
        if (unit.lessons) {
          for (const lesson of unit.lessons) {
            const foundVid = lesson.videos?.find((v: any) => v.id === Number(videoId));
            if (foundVid) return foundVid.title;
          }
        }
      }
    }
    return 'عارض المحاضرة النشطة';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <SEO 
        title={`${course.title}`}
        description={`${course.description || `كورس ومحاضرات مادة ${SUBJECTS_TRANSLATION[course.subject] || course.subject} لطلاب ${useTaxonomyStore.getState().getGradeName(course.grade) || course.grade} مع الأستاذ ${course.teacher.name} على منصة خطوتك.`}`}
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

      {/* Dynamic Content Viewer Area */}
      {isEnrolled && (videoId || pdfId) && (
        <div ref={viewerRef} className="space-y-4 text-right my-8 scroll-mt-24" dir="rtl">
          
          {/* Viewer Header */}
          <div className="flex justify-between items-center bg-brand-card border border-[var(--border-color)] p-4.5 rounded-3xl shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
              </span>
              <span className="font-black text-sm text-slate-100">{getActiveVideoTitle()}</span>
            </div>
            <button
              onClick={() => {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('video_id');
                  next.delete('pdf_id');
                  next.delete('exam_id');
                  next.delete('lesson_id');
                  next.delete('show_result');
                  return next;
                });
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <X className="h-4 w-4" />
              <span>إغلاق العارض</span>
            </button>
          </div>

          {/* Embedded Viewer Element */}
          <div className="w-full bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-6">
            {videoId && (
              <LessonViewer
                overrideLessonId={Number(lessonId)}
                overrideCourseId={course?.id}
                isEmbedded={true}
                initialVideoId={Number(videoId)}
                onClose={() => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete('video_id');
                    next.delete('pdf_id');
                    next.delete('exam_id');
                    next.delete('lesson_id');
                    next.delete('show_result');
                    return next;
                  });
                }}
              />
            )}

            {pdfId && (
              <LessonViewer
                overrideLessonId={Number(lessonId)}
                overrideCourseId={course?.id}
                isEmbedded={true}
                initialPdfId={Number(pdfId)}
                onClose={() => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete('video_id');
                    next.delete('pdf_id');
                    next.delete('exam_id');
                    next.delete('lesson_id');
                    next.delete('show_result');
                    return next;
                  });
                }}
              />
            )}

            {/* Exam Player and Results are now rendered in dedicated pages, so they are not rendered inline here */}
            {/* Checked and redirected to full page */}
          </div>
        </div>
      )}


      
      {/* 1. Header Hero Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 bg-brand-card border border-[var(--border-color)] p-8 sm:p-10 rounded-3xl relative overflow-hidden shadow-xl text-right" dir="rtl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-primary/5 rounded-full blur-3xl -z-10" />

        {/* Info Column */}
        <div className="lg:col-span-2 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-semibold rounded-full">
                {SUBJECTS_TRANSLATION[course.subject] || course.subject}
              </span>
              <span className="px-3 py-1 bg-slate-500/10 border border-slate-500/20 text-slate-300 text-xs font-semibold rounded-full">
                {GRADES_TRANSLATION[course.grade] || course.grade}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                isEnrolled 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-sm' 
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/25 shadow-sm'
              }`}>
                {isEnrolled ? '✓ مشترك في الكورس' : '🔒 غير مشترك'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black leading-snug">{course.title}</h1>
            <p className="text-sm text-slate-300 font-light leading-relaxed">{course.description}</p>
          </div>

          {course.is_bundle && childCourses.length > 0 && (
            <div className="p-4 bg-slate-900/40 border border-[var(--border-color)] rounded-2xl space-y-2">
              <div className="text-xs font-black text-brand-primary flex items-center gap-1.5">
                <span>📦</span>
                <span>الكورسات المتضمنة في هذه الباقة ({childCourses.length}):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {childCourses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800 text-xs">
                    <span className="font-bold text-slate-200">{c.title}</span>
                    <span className="text-slate-400 font-semibold">{c.final_price || c.price} ج.م</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6 border-t border-[var(--border-color)]">
            <div className="p-4 bg-slate-900/30 border border-[var(--border-color)] rounded-2xl text-center">
              <span className="text-[10px] text-slate-400 block font-bold mb-1">الأسابيع (الوحدات)</span>
              <span className="text-sm sm:text-base font-black text-slate-200">{displayUnitsCount}</span>
            </div>
            <div className="p-4 bg-slate-900/30 border border-[var(--border-color)] rounded-2xl text-center">
              <span className="text-[10px] text-slate-400 block font-bold mb-1">المحاضرات</span>
              <span className="text-sm sm:text-base font-black text-slate-200">{displayLessonsCount}</span>
            </div>
            <div className="p-4 bg-slate-900/30 border border-[var(--border-color)] rounded-2xl text-center">
              <span className="text-[10px] text-slate-400 block font-bold mb-1">الفيديوهات</span>
              <span className="text-sm sm:text-base font-black text-slate-200">{displayVideosCount}</span>
            </div>
            <div className="p-4 bg-slate-900/30 border border-[var(--border-color)] rounded-2xl text-center">
              <span className="text-[10px] text-slate-400 block font-bold mb-1">الملفات (PDF)</span>
              <span className="text-sm sm:text-base font-black text-slate-200">{displayPdfsCount}</span>
            </div>
            <div className="p-4 bg-slate-900/30 border border-[var(--border-color)] rounded-2xl text-center">
              <span className="text-[10px] text-slate-400 block font-bold mb-1">الامتحانات والواجبات</span>
              <span className="text-sm sm:text-base font-black text-slate-200">{displayExamsCount}</span>
            </div>
          </div>

          {/* Teacher and Features Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-4">
            <div className="flex items-center gap-3 p-3 bg-slate-900/40 border border-[var(--border-color)] rounded-2xl">
              <div className="h-10 w-10 rounded-full bg-slate-800 border overflow-hidden">
                <img 
                  src={course.teacher.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${course.teacher.name}`} 
                  alt={course.teacher.name} 
                  className="object-cover w-full h-full" 
                />
              </div>
              <div>
                <div className="text-[10px] text-slate-400">مدرس المادة</div>
                <div className="text-xs font-bold text-slate-200">{course.teacher.name}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 text-[10px] sm:text-xs text-slate-400 font-semibold">
              <span className="flex items-center gap-1">🎥 محاضرات مسجلة</span>
              <span className="text-slate-700">•</span>
              <span className="flex items-center gap-1">📄 ملخصات PDF</span>
              <span className="text-slate-700">•</span>
              <span className="flex items-center gap-1">🧪 اختبارات تفاعلية</span>
              <span className="text-slate-700">•</span>
              <span className="flex items-center gap-1">⚡ تصحيح تلقائي</span>
            </div>
          </div>
        </div>

        {/* Purchase & Cover Column */}
        <div className="bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] p-6 rounded-3xl flex flex-col justify-between space-y-6">
          {/* Cover Image */}
          <div className="aspect-video w-full rounded-2xl overflow-hidden border border-[var(--border-color)] shadow-inner">
            <img 
              src={course.cover_image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} 
              alt={course.title} 
              className="object-cover w-full h-full" 
            />
          </div>

          <div className="space-y-4">
            <div className="text-xs text-slate-400">
              {course.is_bundle ? 'سعر الباقة المجمعة:' : 'سعر الاشتراك للكورس بالكامل:'}
            </div>
            {(() => {
              const standardPricing = getCourseDisplayPrice(course)
              const numFinalPrice = Number(course.final_price || course.price || 0)
              const numBundleOriginal = Number(course.bundle_original_price || (childCourses.length > 0 ? childCourses.reduce((acc, c) => acc + Number(c.final_price || c.price || 0), 0) : 0))
              const numBundleSavings = Number(course.bundle_savings || Math.max(0, numBundleOriginal - numFinalPrice))
              const isBundleWithSavings = course.is_bundle && numBundleOriginal > numFinalPrice && numBundleOriginal > 0

              const pricing = isBundleWithSavings ? {
                hasDiscount: true,
                discountText: `وفر ${Math.round(numBundleSavings)} ج.م`,
                formattedOriginalPrice: `${numBundleOriginal} ج.م`,
                formattedFinalPrice: `${numFinalPrice} ج.م`,
              } : standardPricing

              return pricing.hasDiscount ? (
                <div className="flex flex-col gap-1 select-none">
                  {/* Original Price */}
                  <span className="text-sm text-slate-500 line-through font-semibold">
                    {pricing.formattedOriginalPrice}
                  </span>
                  {/* Discount Badge + Final Price */}
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-extrabold text-[#10B981]">
                      {pricing.formattedFinalPrice}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/25 text-[10px] font-bold shadow-[0_0_12px_rgba(16,185,129,0.15)] shrink-0">
                      {pricing.discountText}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="select-none">
                  <span className="text-3xl font-extrabold text-[#10B981]">
                    {pricing.formattedOriginalPrice}
                  </span>
                </div>
              )
            })()}
            <p className="text-[10px] text-slate-500 font-light leading-relaxed">يمنحك الاشتراك وصولاً فورياً مدى الحياة لجميع دروس وامتحانات الكورس ومتابعة المحاضرات.</p>
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
            <div className="space-y-4">
              <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-brand-success text-center text-sm font-bold rounded-xl">
                مشترك بالفعل في هذا الكورس
              </div>

              {/* View limit details counter */}
              {viewLimitDetails && viewLimitDetails.limit_enabled && (
                <div className="p-4 bg-slate-900/30 border border-[var(--border-color)] rounded-2xl text-right space-y-1">
                  <span className="text-[10px] text-slate-400 block">المشاهدات المتبقية:</span>
                  <span className="text-sm font-black text-brand-primary">
                    {viewLimitDetails.is_unlimited ? 'غير محدود' : `${viewLimitDetails.remaining_views ?? viewLimitDetails.remaining} من ${viewLimitDetails.total_allowed_views ?? viewLimitDetails.max_views}`}
                  </span>
                </div>
              )}

              {/* Locked view limit block & recharge code */}
              {viewLimitExceeded && (
                <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-center space-y-3">
                  <span className="text-xs text-rose-400 font-bold block">لقد استنفدت جميع المشاهدات المتاحة.</span>
                  
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={rechargeCode}
                      onChange={(e) => setRechargeCode(e.target.value)}
                      placeholder="أدخل كود الشحن..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] focus:outline-none focus:border-brand-primary text-center font-mono font-bold text-slate-200"
                    />
                    <button
                      onClick={handleRedeemRechargeCode}
                      disabled={redeemingCode}
                      className="w-full py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      {redeemingCode ? 'جاري التفعيل...' : 'تفعيل الكود'}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  const curriculumEl = document.getElementById('curriculum-section');
                  if (curriculumEl) {
                    curriculumEl.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    navigate(`/course/${course.slug || course.id}`);
                  }
                }}
                disabled={viewLimitExceeded}
                className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-center text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
      {isEnrolled && lastWatched && !viewLimitExceeded && (
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
            onClick={() => {
              if (course.is_bundle) {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  let foundLessonId = units[0].lessons[0].id;
                  for (const unit of units) {
                    for (const lesson of unit.lessons) {
                      if (lesson.videos && lesson.videos.some((v: any) => v.id === lastWatched.video_id)) {
                        foundLessonId = lesson.id;
                        break;
                      }
                    }
                  }
                  next.set('lesson_id', foundLessonId.toString());
                  next.set('video_id', lastWatched.video_id.toString());
                  next.delete('pdf_id');
                  next.delete('exam_id');
                  next.delete('show_result');
                  return next;
                });
              } else {
                navigate(`/student/lessons/${units[0].lessons[0].id}?course_id=${course.id}&play=${lastWatched.video_id}`)
              }
            }}
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
      <div id="curriculum-section" className="space-y-4 text-right scroll-mt-6" dir="rtl">
        <h2 className="text-xl font-bold">منهج ومحتوى الكورس:</h2>

        {viewLimitExceeded ? (
          <div className="bg-rose-500/10 border border-rose-500/30 p-8 rounded-3xl flex flex-col items-center text-center gap-3 max-w-xl mx-auto shadow-md">
            <span className="text-3xl">⚠️</span>
            <h3 className="font-black text-sm sm:text-base text-rose-500">تم نفاد مشاهدات الكورس</h3>
            <p className="text-xs text-slate-300 font-light leading-relaxed">
              {viewLimitMessage || 'لقد انتهى عدد مرات مشاهدة هذا الكورس. يرجى شراء كود جديد لاستعادة الوصول.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {!isEnrolled && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-3xl flex flex-col items-center text-center gap-2 max-w-xl mx-auto shadow-md">
                <span className="text-2xl">🔒</span>
                <h3 className="font-black text-sm sm:text-base text-amber-500">
                  {course.availability === 'center' ? 'الكورس مخصص لطلاب السنتر ومقيد حالياً' : 'محتوى مقيد'}
                </h3>
                <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                  هذا الكورس مقيد حالياً. يرجى الشراء أو الاشتراك لفتح المحتوى.
                </p>
                <p className="text-[11px] text-slate-400 font-light">
                  This course is currently restricted. Purchase or enroll to unlock the content.
                </p>
              </div>
            )}

            {units.length === 0 ? (
              <div className="text-center p-12 border border-[var(--border-color)] rounded-2xl text-slate-400 text-sm font-light">
                لم يقم المدرس بنشر أي وحدات دراسية لهذا الكورس حتى الآن.
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  let lastChildCourseId: number | null = null;
                  return units.map((unit) => {
                    const showCourseHeader = unit.child_course_id && unit.child_course_id !== lastChildCourseId;
                    if (unit.child_course_id) {
                      lastChildCourseId = unit.child_course_id;
                    }
                    const isExpanded = course.is_bundle ? (expandedUnits[unit.id] !== false) : !!expandedUnits[unit.id]

                    return (
                      <div key={unit.id} className="space-y-4">
                        {showCourseHeader && (
                          <div className="pt-8 pb-3 border-b border-[var(--border-color)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">📚</span>
                              <h3 className="text-base font-black text-foreground">
                                كورس: <span className="text-brand-primary">{unit.child_course_title}</span>
                              </h3>
                            </div>
                          </div>
                        )}
                        
                        <div className="border border-[var(--border-color)] bg-brand-card rounded-3xl overflow-hidden transition-all duration-300">
                          {/* Unit Title Header */}
                          <button
                            onClick={() => toggleUnit(unit.id)}
                            className="w-full flex items-center justify-between p-6 text-right font-bold text-sm sm:text-base cursor-pointer hover:bg-slate-900/10 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 bg-brand-primary/10 text-brand-primary text-xs font-black rounded-lg">الأسبوع {unit.order}</span>
                              <span className="text-slate-100 font-black">{unit.title}</span>
                            </div>
                            <ChevronDown className={`h-5 w-5 text-brand-primary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Lessons list details */}
                          {isExpanded && (
                            <div className="border-t border-[var(--border-color)] bg-slate-950/20 divide-y divide-slate-900/40">
                              {renderLessonsList(unit.lessons)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
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