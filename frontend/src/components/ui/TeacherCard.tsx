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
      <span className="absolute top-3.5 left-3.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-black rounded-full flex items-center gap-1 z-10 backdrop-blur-md">
        <span>🟢</span>
        <span>أونلاين</span>
      </span>
    );
  } else if (teaching_mode === 'center') {
    teachingModeBadge = (
      <span className="absolute top-3.5 left-3.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-400 font-black rounded-full flex items-center gap-1 z-10 backdrop-blur-md">
        <span>🏫</span>
        <span>سنتر</span>
      </span>
    );
  } else if (teaching_mode === 'both') {
    teachingModeBadge = (
      <span className="absolute top-3.5 left-3.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 text-[10px] text-purple-400 font-black rounded-full flex items-center gap-1 z-10 backdrop-blur-md">
        <span>🟣</span>
        <span>أونلاين + سنتر</span>
      </span>
    );
  }

  return (
    <motion.div 
      whileHover={{ y: -5, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative group bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 text-center space-y-4 hover:border-brand-primary/40 hover:shadow-xl hover:shadow-[0_0_30px_var(--glow-color)] transition-all duration-300 flex flex-col justify-between h-full"
    >
      {teachingModeBadge}
      <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none group-hover:bg-brand-primary/20 transition-all"></div>
      
      <div className="space-y-4 flex flex-col items-center w-full relative z-10">
        {/* Avatar */}
        <div className="h-24 w-24 rounded-full border-2 border-slate-700/60 group-hover:border-brand-primary transition-all duration-300 overflow-hidden bg-brand-surface shadow-lg relative shrink-0">
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
        <div className="space-y-2 w-full">
          <h3 className="font-black text-base text-foreground group-hover:text-brand-primary transition-colors duration-200">
            {name}
          </h3>
          <div>
            <span className="inline-block px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 text-[11px] text-brand-primary font-black rounded-full shadow-sm">
              مدرس {displaySubject}
            </span>
          </div>
          
          {experience && (
            <div className="text-[11px] text-slate-300 font-bold px-3 py-1 bg-slate-900/60 border border-slate-800 rounded-lg inline-block shadow-sm mt-1">
              {experience}
            </div>
          )}
          
          {bio && (
            <p className="text-xs text-text-secondary font-medium leading-relaxed mt-2 line-clamp-2 min-h-[36px] opacity-90">
              {bio}
            </p>
          )}
        </div>
      </div>

      {/* Stats and Action */}
      <div className="mt-4 pt-4 border-t border-[var(--border-color)] w-full space-y-3.5 relative z-10">
        {studentsCount !== undefined ? (
          <div className="grid grid-cols-2 gap-2 text-[11px] text-text-secondary font-black bg-slate-900/30 p-2.5 rounded-2xl border border-slate-800/60">
            <div className="space-y-0.5 border-l border-slate-800">
              <div className="text-foreground text-sm font-black text-brand-primary">{coursesCount}</div>
              <div className="text-[10px] opacity-80">كورسات مفعّلة</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-foreground text-sm font-black text-emerald-400">{studentsCount}</div>
              <div className="text-[10px] opacity-80">طالب نشط</div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-text-secondary font-black text-center bg-slate-900/30 p-2 rounded-xl border border-slate-800/60">
            عدد الكورسات المتاحة: <span className="text-foreground">{coursesCount}</span>
          </div>
        )}

        <Link 
          to={`/teacher/${slug || id}`} 
          className="block w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-center rounded-xl text-xs font-black shadow-md shadow-brand-primary/20 hover:shadow-brand-primary/40 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          عرض الملف الشخصي
        </Link>
      </div>
    </motion.div>
  )
}
