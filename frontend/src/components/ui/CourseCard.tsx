import React from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { getCourseDisplayPrice } from '../../utils/pricing'

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
}: CourseCardProps) {
  const pricing = getCourseDisplayPrice({
    price,
    enable_discount: enableDiscount,
    discount_type: discountType,
    discount_value: discountValue,
    final_price: finalPrice,
  })
  
  return (
    <motion.div 
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative group bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-md hover:shadow-xl hover:border-brand-primary/30 transition-all duration-300 flex flex-col justify-between h-full hover:shadow-[0_0_30px_var(--glow-color)]"
    >
      {/* Thumbnail area */}
      <div className="aspect-video w-full bg-brand-surface relative overflow-hidden">
        <img 
          src={coverImage || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} 
          alt={title} 
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" 
        />
        
        {/* Subject Overlay Badge */}
        <div className="absolute top-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md text-white rounded-full text-[10px] font-black tracking-wide border border-white/10">
          {SUBJECTS_TRANSLATION[subject] || subject}
        </div>

        {/* Subscription Status Overlay */}
        {isSubscribed && (
          <div className="absolute top-3 left-3 px-3 py-1 bg-brand-primary text-white rounded-full text-[10px] font-black shadow-md flex items-center gap-1">
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
                <img src={teacherAvatar} alt={teacherName} className="object-cover w-full h-full" />
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
      <div className="p-6 pt-0 border-t border-[var(--border-color)] bg-brand-surface/20 flex items-center justify-between gap-4">
        {isSubscribed ? (
          <>
            <span className="text-xs text-text-secondary font-bold">تم الشراء</span>
            <Link 
              to={`/course/${slug || id}`} 
              className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-lg transition-all duration-200 flex items-center gap-1 cursor-pointer"
            >
              <span>متابعة التعليم</span>
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            </Link>
          </>
        ) : (
          <>
            {pricing.hasDiscount ? (
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-[10px] line-through text-text-secondary/70">{pricing.formattedOriginalPrice}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-black text-emerald-500">{pricing.formattedFinalPrice}</span>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[7px] font-black px-1 py-0.5 rounded scale-90">
                    {pricing.discountText}
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-base font-black text-brand-primary">{pricing.formattedOriginalPrice}</span>
            )}
            <Link 
              to={`/course/${slug || id}`} 
              className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-lg hover:shadow-[0_0_15px_rgba(22,196,127,0.3)] transition-all duration-200 cursor-pointer"
            >
              اشترك الآن
            </Link>
          </>
        )}
      </div>
    </motion.div>
  )
}
