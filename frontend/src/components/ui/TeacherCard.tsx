import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ensureHttps } from '../../utils/urls'

interface TeacherCardProps {
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
}: TeacherCardProps) {
  const displaySubject = subject
    ? subject.split(',').map((s) => SUBJECTS_TRANSLATION[s.trim()] || s.trim()).join(' و ')
    : ''

  let teachingModeBadge = null;
  if (teaching_mode === 'online') {
    teachingModeBadge = (
      <span className="absolute top-3 left-3 px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-[9px] text-green-400 font-black rounded-full flex items-center gap-1 z-10">
        <span>🟢</span>
        <span>أونلاين</span>
      </span>
    );
  } else if (teaching_mode === 'center') {
    teachingModeBadge = (
      <span className="absolute top-3 left-3 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-[9px] text-yellow-400 font-black rounded-full flex items-center gap-1 z-10">
        <span>🏫</span>
        <span>سنتر</span>
      </span>
    );
  } else if (teaching_mode === 'both') {
    teachingModeBadge = (
      <span className="absolute top-3 left-3 px-2 py-0.5 bg-purple-500/10 border border-purple-500/30 text-[9px] text-purple-400 font-black rounded-full flex items-center gap-1 z-10">
        <span>🟣</span>
        <span>أونلاين + سنتر</span>
      </span>
    );
  }

  return (
    <motion.div 
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative group bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 text-center space-y-4 hover:border-brand-primary/40 hover:shadow-xl hover:shadow-[0_0_25px_var(--glow-color)] transition-all duration-300 flex flex-col justify-between h-full"
    >
      {teachingModeBadge}
      <div className="absolute top-0 right-0 w-20 h-20 bg-brand-primary/5 rounded-full blur-2xl pointer-events-none"></div>
      
      <div className="space-y-4 flex flex-col items-center w-full">
        {/* Avatar */}
        <div className="h-24 w-24 rounded-full border-2 border-[var(--border-color)] group-hover:border-brand-primary transition-all duration-300 overflow-hidden bg-brand-surface shadow-md relative shrink-0">
          <img 
            src={ensureHttps(avatar) || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`} 
            alt={name} 
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${name}`
            }}
          />
        </div>
        
        {/* Info */}
        <div className="space-y-1">
          <h3 className="font-black text-base text-foreground group-hover:text-brand-primary transition-colors duration-200">
            {name}
          </h3>
          <span className="inline-block px-2.5 py-0.5 bg-brand-primary/10 border border-brand-primary/20 text-[10px] text-brand-primary font-black rounded-full">
            مدرس {displaySubject}
          </span>
          
          {experience && (
            <div className="text-[10px] text-foreground font-bold px-3 py-1 bg-brand-surface border border-[var(--border-color)] rounded-lg inline-block shadow-sm mt-2">
              {experience}
            </div>
          )}
          
          {bio && (
            <p className="text-xs text-text-secondary font-semibold leading-relaxed mt-2 line-clamp-2 h-10">
              {bio}
            </p>
          )}
        </div>
      </div>

      {/* Stats and Action */}
      <div className="mt-6 pt-4 border-t border-[var(--border-color)] w-full space-y-4">
        {studentsCount !== undefined ? (
          <div className="grid grid-cols-2 gap-2 text-[10px] text-text-secondary font-black">
            <div className="space-y-0.5 border-l border-[var(--border-color)]">
              <div className="text-foreground text-sm font-black">{coursesCount}</div>
              <div>كورسات مفعّلة</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-foreground text-sm font-black">{studentsCount}</div>
              <div>طالب نشط</div>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-text-secondary font-black text-right">
            عدد الكورسات: {coursesCount}
          </div>
        )}

        <Link 
          to={`/teacher/${slug || id}`} 
          className="block w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-center rounded-xl text-xs font-black shadow-md hover:shadow-[0_0_12px_rgba(22,196,127,0.25)] transition-all duration-200 cursor-pointer"
        >
          عرض الملف الشخصي
        </Link>
      </div>
    </motion.div>
  )
}
