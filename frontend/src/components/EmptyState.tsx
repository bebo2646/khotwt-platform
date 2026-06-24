import React from 'react'
import { Inbox, BookOpen, UserX, AlertCircle } from 'lucide-react'

interface EmptyStateProps {
  type: 'courses' | 'teachers' | 'students' | 'exams' | 'general'
  title: string
  description?: string
  actionButton?: React.ReactNode
}

export default function EmptyState({ type, title, description, actionButton }: EmptyStateProps) {
  const getIcon = () => {
    switch (type) {
      case 'courses':
        return <BookOpen className="h-16 w-16 text-emerald-600/60" />
      case 'teachers':
      case 'students':
        return <UserX className="h-16 w-16 text-emerald-600/60" />
      case 'exams':
        return <AlertCircle className="h-16 w-16 text-emerald-600/60" />
      default:
        return <Inbox className="h-16 w-16 text-emerald-600/60" />
    }
  }

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 md:p-12 border border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] rounded-2xl max-w-lg mx-auto my-8">
      <div className="p-4 bg-emerald-500/5 rounded-full border border-emerald-500/10 mb-4 animate-bounce">
        {getIcon()}
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 font-light leading-relaxed max-w-sm mb-6">
          {description}
        </p>
      )}
      {actionButton}
    </div>
  )
}
