import React from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { ensureHttps } from '../../utils/urls'

interface PackageCardProps {
  id: number
  title: string
  description?: string
  price: string | number
  discount?: string | number
  originalLessonsTotal?: string | number
  lessonsCount: number
  courseId: number
  courseTitle: string
  courseSubject: string
  teacherName: string
  teacherAvatar?: string
  packageThumbnail?: string
  coverImage?: string
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

export default function PackageCard({
  id,
  title,
  description,
  price,
  discount,
  originalLessonsTotal,
  lessonsCount,
  courseId,
  courseTitle,
  courseSubject,
  teacherName,
  teacherAvatar,
  packageThumbnail,
  coverImage,
}: PackageCardProps) {
  const displaySubject = SUBJECTS_TRANSLATION[courseSubject] || courseSubject
  const formattedPrice = price === '0.00' || price === 0 || price === '0' ? 'مجاني' : `${price} ج.م`

  return (
    <div className="relative group bg-brand-card border border-border-color rounded-3xl overflow-hidden shadow-md hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(34,197,94,0.15)] hover:border-brand-primary/40 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-full text-right">
      {/* Thumbnail area */}
      <div className="aspect-video w-full bg-brand-surface relative overflow-hidden">
        <img 
          src={ensureHttps(packageThumbnail) || ensureHttps(coverImage) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} 
          alt={title} 
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" 
        />
        
        {/* Subject Overlay Badge */}
        <div className="absolute top-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md text-white rounded-full text-[10px] font-black tracking-wide border border-white/10">
          {displaySubject}
        </div>

        {/* Package Label Overlay */}
        <div className="absolute top-3 left-3 px-3 py-1 bg-amber-500/90 text-black rounded-full text-[10px] font-black shadow-md">
          باقة مجمعة
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          {/* Teacher Details */}
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-xs font-black text-brand-primary overflow-hidden shrink-0">
              {teacherAvatar ? (
                <img src={ensureHttps(teacherAvatar)} alt={teacherName} className="object-cover w-full h-full" />
              ) : (
                teacherName.charAt(0)
              )}
            </div>
            <span className="text-xs text-text-secondary font-bold hover:text-brand-primary transition-colors">{teacherName}</span>
          </div>

          {/* Title and description */}
          <div className="space-y-1">
            <h3 className="font-black text-base text-foreground group-hover:text-brand-primary transition-colors duration-200 line-clamp-1 leading-normal">
              {title}
            </h3>
            <p className="text-xs text-text-secondary font-semibold line-clamp-2 leading-relaxed min-h-[2rem]">
              {description || "اشتراك شهري مخصص لمجموعة من الدروس بسعر مخفض."}
            </p>
          </div>
        </div>

        {/* Lessons count and course info */}
        <div className="w-full space-y-2 pt-2 border-t border-border-color/60 text-xs text-text-secondary font-semibold">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-text-secondary/70" />
            <span>عدد المحاضرات المشمولة: {lessonsCount} محاضرة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
            <span className="line-clamp-1">كورس: {courseTitle}</span>
          </div>
        </div>
      </div>
      
      {/* Pricing and Action Footer */}
      <div className="p-6 pt-0 border-t border-border-color/50 bg-brand-surface/20 flex items-center justify-between gap-4">
        <span className="text-base font-black text-brand-primary">
          {formattedPrice}
        </span>
        <Link 
          to={`/course/${courseId}`} 
          className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-lg hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all duration-200"
        >
          عرض الباقة
        </Link>
      </div>
    </div>
  )
}
