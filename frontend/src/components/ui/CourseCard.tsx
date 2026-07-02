import React from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { getCourseDisplayPrice } from '../../utils/pricing'
import { ensureHttps } from '../../utils/urls'

interface CourseCardProps {
  id: number
  title: string
  description?: string
  coverImage: string
  price: string | number
  subject: string
  teacherName: string
  teacherAvatar?: string
  isSubscribed?: boolean
  progressPercentage?: number
  lessonsCount?: number
  slug?: string
  enableDiscount?: boolean
  discountType?: 'percentage' | 'fixed'
  discountValue?: string | number
  finalPrice?: string | number
  grade?: string
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

const GRADES_MAP: Record<string, string> = {
  first_preparatory: 'الصف الأول الإعدادي',
  second_preparatory: 'الصف الثاني الإعدادي',
  third_preparatory: 'الصف الثالث الإعدادي',
  first_secondary: 'الصف الأول الثانوي',
  second_secondary: 'الصف الثاني الثانوي',
  third_secondary: 'الصف الثالث الثانوي',
}

export default function CourseCard({
  id,
  title,
  description,
  coverImage,
  price,
  subject,
  teacherName,
  teacherAvatar,
  isSubscribed = false,
  progressPercentage,
  lessonsCount,
  slug,
  enableDiscount = false,
  discountType = 'percentage',
  discountValue = 0,
  finalPrice = 0,
  grade,
}: CourseCardProps) {
  const pricing = getCourseDisplayPrice({
    price,
    enable_discount: enableDiscount,
    discount_type: discountType,
    discount_value: discountValue,
    final_price: finalPrice,
  })
  
  return (
    <div 
      className="relative group bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-md hover:shadow-xl hover:border-brand-primary/30 transition-all duration-300 ease-in-out flex flex-col justify-between h-full hover:shadow-[0_0_30px_var(--glow-color)] course-card"
    >
      {/* Thumbnail area */}
      <div className="aspect-video w-full bg-brand-surface relative overflow-hidden">
        <img 
          src={ensureHttps(coverImage) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} 
          alt={title} 
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" 
        />
        
        {/* Subject & Grade Overlay Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end z-10">
          <div className="px-3 py-1 bg-black/80 text-white rounded-full text-[10px] font-black tracking-wide border border-white/10">
            {SUBJECTS_TRANSLATION[subject] || subject}
          </div>
          {grade && (
            <div className="px-3 py-1 bg-indigo-700 text-white rounded-full text-[10px] font-black tracking-wide border border-indigo-500/25 shadow-md">
              {GRADES_MAP[grade] || grade}
            </div>
          )}
        </div>

        {/* Subscription Status Overlay */}
        {isSubscribed && (
          <div className="absolute top-3 left-3 px-3 py-1 bg-brand-primary text-white rounded-full text-[10px] font-black shadow-md flex items-center gap-1 z-10">
            <CheckCircle className="h-3 w-3" />
            <span>مشترك</span>
          </div>
        )}
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
            <h3 className="font-black text-base text-foreground group-hover:text-brand-primary transition-colors duration-200 line-clamp-2 min-h-[48px] leading-snug">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-text-secondary font-semibold line-clamp-2 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Progress or Lessons count */}
        {isSubscribed && progressPercentage !== undefined && (
          <div className="w-full space-y-2 pt-2 border-t border-[var(--border-color)]">
            <div className="flex justify-between items-center text-[10px] font-bold text-text-secondary">
              <span>الإنجاز بالكورس:</span>
              <span className="text-brand-primary font-black">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-gradient-to-r from-brand-primary to-[var(--accent-color)] h-full rounded-full"
              ></motion.div>
            </div>
          </div>
        )}

        {lessonsCount !== undefined && !isSubscribed && (
          <div className="flex items-center gap-1.5 text-[10px] text-text-secondary font-bold pt-2 border-t border-[var(--border-color)]">
            <BookOpen className="h-3.5 w-3.5 text-text-secondary/70" />
            <span>عدد المحاضرات: {lessonsCount}</span>
          </div>
        )}
      </div>

      {/* Pricing and Action Footer */}
      <div className="course-card-footer bg-brand-surface/20">
        {isSubscribed ? (
          <>
            <div className="price-box">
              <span className="discount-badge invisible pointer-events-none select-none" aria-hidden="true">&nbsp;</span>
              <span className="old-price invisible pointer-events-none select-none" aria-hidden="true">&nbsp;</span>
              <span className="new-price text-xs font-bold" style={{ background: 'none', color: 'var(--text-secondary)', WebkitTextFillColor: 'initial', WebkitBackgroundClip: 'unset', backgroundClip: 'unset' }}>
                تم الشراء
              </span>
            </div>
            <Link 
              to={`/course/${slug || id}`} 
              className="w-[130px] h-[40px] flex items-center justify-center bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-lg transition-all duration-200 cursor-pointer shrink-0"
            >
              <span>متابعة التعليم</span>
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 mr-1" />
            </Link>
          </>
        ) : (
          <>
            <div className="price-box">
              {pricing.hasDiscount ? (
                <span className="discount-badge">
                  {discountType === 'percentage' ? `خصم ${discountValue}%` : `خصم ${discountValue} ج.م`}
                </span>
              ) : (
                <span className="discount-badge invisible pointer-events-none select-none" aria-hidden="true">&nbsp;</span>
              )}
              
              {pricing.hasDiscount ? (
                <span className="old-price">
                  {pricing.formattedOriginalPrice}
                </span>
              ) : (
                <span className="old-price invisible pointer-events-none select-none" aria-hidden="true">&nbsp;</span>
              )}
              
              <span className="new-price">
                {pricing.hasDiscount ? pricing.formattedFinalPrice : pricing.formattedOriginalPrice}
              </span>
            </div>
            
            <Link 
              to={`/course/${slug || id}`} 
              className="w-[130px] h-[40px] flex items-center justify-center bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-lg hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all duration-200 cursor-pointer shrink-0"
            >
              اشترك الآن
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
