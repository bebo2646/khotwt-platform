import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ensureHttps } from '../../utils/urls'

export interface TeacherCardProps {
  id: number
  name: string
  subject: string
  avatar?: string
  experience?: string
  bio?: string
  coursesCount?: number
  studentsCount?: number
  slug?: string
  teaching_mode?: string
  className?: string
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
  french: 'اللغة الفرنسية',
  german: 'اللغة الألمانية',
  history: 'التاريخ',
  geography: 'الجغرافيا',
  philosophy: 'الفلسفة والمنطق',
  psychology: 'علم النفس والاجتماع',
  geology: 'الجيولوجيا',
}

export default function TeacherCard({
  id,
  name,
  subject,
  avatar,
  experience,
  bio,
  coursesCount = 0,
  studentsCount,
  slug,
  teaching_mode,
  className = '',
}: TeacherCardProps) {
  const displaySubject = subject
    ? subject.split(',').map((s) => SUBJECTS_TRANSLATION[s.trim()] || s.trim()).join(' و ')
    : ''

  let teachingModeBadge = null
  if (teaching_mode === 'online') {
    teachingModeBadge = (
      <span
        style={{
          backgroundColor: 'var(--teacher-badge-online-bg)',
          color: 'var(--teacher-badge-online-text)',
          borderColor: 'var(--teacher-badge-online-border)',
        }}
        className="teacher-theme-transition absolute top-3.5 right-3.5 px-3 py-1 border text-[11px] font-black rounded-full shadow-sm flex items-center gap-1.5 backdrop-blur-md z-10"
      >
        <span
          style={{ backgroundColor: 'var(--teacher-badge-online-pulse)' }}
          className="w-2 h-2 rounded-full animate-pulse"
        />
        <span>أونلاين</span>
      </span>
    )
  } else if (teaching_mode === 'center') {
    teachingModeBadge = (
      <span
        style={{
          backgroundColor: 'var(--teacher-badge-center-bg)',
          color: 'var(--teacher-badge-center-text)',
          borderColor: 'var(--teacher-badge-center-border)',
        }}
        className="teacher-theme-transition absolute top-3.5 right-3.5 px-3 py-1 border text-[11px] font-black rounded-full shadow-sm flex items-center gap-1.5 backdrop-blur-md z-10"
      >
        <span>🏫</span>
        <span>سنتر</span>
      </span>
    )
  } else if (teaching_mode === 'both') {
    teachingModeBadge = (
      <span
        style={{
          backgroundColor: 'var(--teacher-badge-both-bg)',
          color: 'var(--teacher-badge-both-text)',
          borderColor: 'var(--teacher-badge-both-border)',
        }}
        className="teacher-theme-transition absolute top-3.5 right-3.5 px-3 py-1 border text-[11px] font-black rounded-full shadow-sm flex items-center gap-1.5 backdrop-blur-md z-10"
      >
        <span
          style={{ backgroundColor: 'var(--teacher-badge-both-dot)' }}
          className="w-2 h-2 rounded-full"
        />
        <span>أونلاين + سنتر</span>
      </span>
    )
  }

  const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'Teacher')}&backgroundColor=6d5dfc,8b5cf6,4338ca,312e81&textColor=ffffff&fontSize=42`

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      data-teacher-id={id}
      style={{
        backgroundColor: 'var(--teacher-card-bg)',
        borderColor: 'var(--teacher-card-border)',
        boxShadow: 'var(--teacher-card-shadow)',
      }}
      className={`teacher-theme-transition group relative rounded-[26px] border hover:shadow-[0_16px_36px_rgba(109,93,252,0.18)] transition-all duration-300 flex flex-col justify-between overflow-hidden h-[440px] sm:h-[465px] w-full select-none ${className}`}
      dir="rtl"
    >
      {/* 1. Large Portrait Image Area with Soft Brand Gradient */}
      <div
        style={{ background: 'var(--teacher-card-header-bg)' }}
        className="teacher-theme-transition relative w-full h-[230px] sm:h-[250px] overflow-hidden shrink-0"
      >
        {teachingModeBadge}
        <img
          src={ensureHttps(avatar) || fallbackAvatar}
          alt={name}
          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = fallbackAvatar
          }}
          loading="lazy"
        />
        {/* Subtle soft gradient overlay at bottom of image */}
        <div
          style={{ background: 'var(--teacher-card-img-overlay)' }}
          className="teacher-theme-transition absolute inset-0 pointer-events-none"
        />
      </div>

      {/* 2. Middle Content Area */}
      <div
        style={{ backgroundColor: 'var(--teacher-card-bg)' }}
        className="teacher-theme-transition p-4 sm:p-5 flex flex-col justify-between flex-grow text-center space-y-2.5"
      >
        <div className="space-y-2">
          {/* Teacher Name */}
          <h3
            style={{ color: 'var(--teacher-card-name)' }}
            className="teacher-theme-transition font-black text-lg sm:text-xl group-hover:!text-[#6D5DFC] transition-colors duration-200 line-clamp-1"
          >
            {name}
          </h3>

          {/* Teacher Subject / Specialization */}
          <div className="flex justify-center">
            <span
              style={{
                backgroundColor: 'var(--teacher-spec-bg)',
                borderColor: 'var(--teacher-spec-border)',
                color: 'var(--teacher-spec-text)',
              }}
              className="teacher-theme-transition inline-block px-3.5 py-1 border text-xs sm:text-[13px] font-black rounded-full shadow-xs"
            >
              مدرس {displaySubject || 'المادة'}
            </span>
          </div>

          {/* Secondary Info / Metadata with strong contrast */}
          <div className="flex items-center justify-center gap-2 text-xs sm:text-[13px] font-bold min-h-[20px]">
            {coursesCount > 0 && (
              <span style={{ color: 'var(--teacher-meta-primary)' }} className="teacher-theme-transition font-black">
                {coursesCount} كورس متاح
              </span>
            )}
            {coursesCount > 0 && experience && (
              <span style={{ color: 'var(--teacher-meta-dot)' }} className="teacher-theme-transition font-black">
                •
              </span>
            )}
            {experience && (
              <span style={{ color: 'var(--teacher-meta-secondary)' }} className="teacher-theme-transition">
                {experience}
              </span>
            )}
            {!coursesCount && !experience && bio && (
              <span style={{ color: 'var(--teacher-meta-secondary)' }} className="teacher-theme-transition line-clamp-1 font-bold">
                {bio}
              </span>
            )}
            {studentsCount !== undefined && studentsCount > 0 && (
              <>
                <span style={{ color: 'var(--teacher-meta-dot)' }} className="teacher-theme-transition font-black">
                  •
                </span>
                <span style={{ color: 'var(--teacher-meta-students)' }} className="teacher-theme-transition font-black">
                  {studentsCount} طالب
                </span>
              </>
            )}
          </div>
        </div>

        {/* 3. CTA Button - Brand Primary Purple with High Contrast */}
        <div className="pt-2">
          <Link
            to={`/teacher/${slug || id}`}
            data-testid="cta-profile-button"
            style={{
              backgroundColor: 'var(--teacher-cta-bg)',
              color: 'var(--teacher-cta-text)',
              boxShadow: 'var(--teacher-cta-shadow)',
            }}
            className="teacher-theme-transition block w-full py-2.5 sm:py-3 hover:!bg-[#5B4AE3] text-center rounded-xl text-xs sm:text-sm font-black active:scale-98 transition-all duration-200 cursor-pointer"
          >
            عرض الملف الشخصي
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
