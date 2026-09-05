import React from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { getCourseDisplayPrice } from '../../utils/pricing'
import { ensureHttps } from '../../utils/urls'
import { useAuthStore } from '../../store/authStore'
import { useTaxonomyStore } from '../../store/taxonomyStore'

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
  availability?: 'online' | 'center' | 'both'
  isBundle?: boolean
  childCourses?: Array<{ id: number; title: string; price?: number | string; final_price?: number | string }>
  bundleOriginalPrice?: number | string | null
  bundleSavings?: number | string | null
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
  availability,
  isBundle = false,
  childCourses,
  bundleOriginalPrice,
  bundleSavings,
}: CourseCardProps) {
  const standardPricing = getCourseDisplayPrice({
    price,
    enable_discount: enableDiscount,
    discount_type: discountType,
    discount_value: discountValue,
    final_price: finalPrice,
  })

  const numFinalPrice = Number(finalPrice || price || 0)
  const numBundleOriginal = Number(bundleOriginalPrice || (childCourses ? childCourses.reduce((acc, c) => acc + Number(c.final_price || c.price || 0), 0) : 0))
  const numBundleSavings = Number(bundleSavings || Math.max(0, numBundleOriginal - numFinalPrice))
  const isBundleWithSavings = isBundle && numBundleOriginal > numFinalPrice && numBundleOriginal > 0

  const pricing = isBundleWithSavings ? {
    hasDiscount: true,
    discountText: `وفر ${Math.round(numBundleSavings)} ج.م`,
    formattedOriginalPrice: `${numBundleOriginal} ج.م`,
    formattedFinalPrice: `${numFinalPrice} ج.م`,
  } : standardPricing
  
  return (
    <div 
      className="relative group bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-md hover:shadow-xl hover:border-brand-primary/30 transition-all duration-300 ease-in-out flex flex-col justify-between h-full hover:shadow-[0_0_30px_var(--glow-color)] course-card"
    >
      {/* Thumbnail area */}
      <div className="aspect-video w-full bg-brand-surface relative overflow-hidden group/img">
        <img 
          src={ensureHttps(coverImage) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} 
          alt={title} 
          className="object-cover w-full h-full group-hover/img:scale-105 transition-transform duration-500 ease-out" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-80 group-hover:opacity-60 transition-opacity"></div>
        
        {/* Subject, Grade & Availability Overlay Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end z-10">
          {isBundle && (
            <div className="px-3 py-1 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-full text-[10px] font-black tracking-wide border border-white/20 shadow-lg backdrop-blur-md">
              📦 كورس مجمع
            </div>
          )}
          <div className="px-3 py-1 bg-black/75 backdrop-blur-md text-white rounded-full text-[10px] font-black tracking-wide border border-white/15 shadow-sm">
            {SUBJECTS_TRANSLATION[subject] || subject}
          </div>
          {grade && (
            <div className="px-3 py-1 bg-indigo-600/90 backdrop-blur-md text-white rounded-full text-[10px] font-black tracking-wide border border-indigo-400/30 shadow-sm">
              {useTaxonomyStore.getState().getGradeName(grade) || grade}
            </div>
          )}
          {(() => {
            const user = useAuthStore.getState().user;
            const isOnlineStudent = user?.role === 'student' && user?.student_type === 'online';
            return availability && (
              <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wide border backdrop-blur-md shadow-sm ${
                availability === 'online'
                  ? 'bg-emerald-600/90 text-white border-emerald-400/30'
                  : availability === 'center'
                  ? 'bg-amber-600/90 text-white border-amber-400/30'
                  : 'bg-purple-600/90 text-white border-purple-400/30'
              }`}>
                {availability === 'online' 
                  ? '🟢 أونلاين' 
                  : availability === 'center' 
                    ? (isOnlineStudent ? '🏫 Center Students' : '🏫 سنتر') 
                    : '🟣 أونلاين + سنتر'}
              </div>
            );
          })()}
        </div>

        {/* Subscription Status Overlay */}
        {isSubscribed && (
          <div className="absolute top-3 left-3 px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black shadow-lg flex items-center gap-1.5 z-10 border border-emerald-400/30">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>مشترك</span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          {/* Teacher Details */}
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-xs font-black text-brand-primary overflow-hidden shrink-0 shadow-sm">
              {teacherAvatar ? (
                <img src={ensureHttps(teacherAvatar)} alt={teacherName} className="object-cover w-full h-full" />
              ) : (
                teacherName.charAt(0)
              )}
            </div>
            <span className="text-xs text-text-secondary font-bold hover:text-brand-primary transition-colors">{teacherName}</span>
          </div>

          {/* Title and description */}
          <div className="space-y-1.5">
            <h3 className="font-black text-base text-foreground group-hover:text-brand-primary transition-colors duration-200 line-clamp-2 min-h-[48px] leading-snug">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-text-secondary font-medium line-clamp-2 leading-relaxed opacity-90">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Progress or Lessons count */}
        {isSubscribed && progressPercentage !== undefined && (
          <div className="w-full space-y-2 pt-3 border-t border-[var(--border-color)]">
            <div className="flex justify-between items-center text-[11px] font-bold text-text-secondary">
              <span>نسبة الإنجاز:</span>
              <span className="text-brand-primary font-black">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden p-0.5 border border-slate-700/50">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-gradient-to-r from-brand-primary to-brand-secondary h-full rounded-full"
              ></motion.div>
            </div>
          </div>
        )}

        {isBundle && childCourses && childCourses.length > 0 && (
          <div className="pt-3 border-t border-[var(--border-color)] space-y-1.5 text-right">
            <span className="text-[10px] text-text-secondary font-bold block">
              📦 الكورسات المتضمنة ({childCourses.length}):
            </span>
            <div className="flex flex-wrap gap-1">
              {childCourses.map((c) => (
                <span key={c.id} className="text-[9px] font-bold px-2 py-0.5 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-md">
                  {c.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {lessonsCount !== undefined && !isSubscribed && (
          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary font-bold pt-3 border-t border-[var(--border-color)]">
            <BookOpen className="h-3.5 w-3.5 text-brand-primary" />
            <span>عدد المحاضرات: {lessonsCount}</span>
          </div>
        )}
      </div>

      {/* Pricing and Action Footer */}
      <div className="p-4 bg-brand-surface/40 border-t border-[var(--border-color)] space-y-2.5">
        <div className="flex items-center justify-between gap-3 w-full">
          {isSubscribed ? (
            <>
              <div className="price-box flex flex-col justify-center">
                <span className="text-xs font-bold text-emerald-500">
                  مفعل بحسابك
                </span>
              </div>
              <Link 
                to={`/course/${slug || id}`} 
                className="px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-md shadow-brand-primary/20 hover:shadow-brand-primary/40 active:scale-95 transition-all duration-200 cursor-pointer shrink-0 flex items-center gap-1.5 group/btn"
              >
                <span>دخول الكورس</span>
                <ArrowLeft className="h-3.5 w-3.5 group-hover/btn:-translate-x-1 transition-transform" />
              </Link>
            </>
          ) : (
            <>
              <div className="price-box flex flex-col justify-center">
                {pricing.hasDiscount && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md w-fit mb-0.5">
                    {discountType === 'percentage' ? `خصم ${discountValue}%` : `خصم ${discountValue} ج.م`}
                  </span>
                )}
                
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-black text-foreground">
                    {pricing.hasDiscount ? pricing.formattedFinalPrice : pricing.formattedOriginalPrice}
                  </span>
                  {pricing.hasDiscount && (
                    <span className="text-[11px] text-text-secondary line-through opacity-70">
                      {pricing.formattedOriginalPrice}
                    </span>
                  )}
                </div>
              </div>
              
              <Link 
                to={`/course/${slug || id}`} 
                className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-md shadow-brand-primary/20 hover:shadow-brand-primary/40 active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
              >
                اشترك الآن
              </Link>
            </>
          )}
        </div>
        
        {/* Course Details Button */}
        <Link 
          to={`/course/${slug || id}`} 
          className="w-full py-2 flex items-center justify-center bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/50 hover:border-brand-primary/40 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none"
        >
          عرض تفاصيل الكورس
        </Link>
      </div>
    </div>
  )
}
