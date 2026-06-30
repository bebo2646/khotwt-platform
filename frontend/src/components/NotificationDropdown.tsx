import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'
import { useAuthStore } from '../store/authStore'
import { CheckCircle, AlertTriangle, AlertCircle, Bell, Mail } from 'lucide-react'
import { motion } from 'framer-motion'

interface NotificationDropdownProps {
  onClose: () => void
  alignRight?: boolean
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose, alignRight = true }) => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const getNotificationType = (title: string, message: string): 'success' | 'warning' | 'error' | 'info' => {
    const text = (title + ' ' + message).toLowerCase()
    if (text.includes('نجاح') || text.includes('تمت الموافقة') || text.includes('شحن') || text.includes('تفعيل')) return 'success'
    if (text.includes('تنبيه') || text.includes('شارف') || text.includes('أوشك') || text.includes('قريب')) return 'warning'
    if (text.includes('فشل') || text.includes('رفض') || text.includes('عذراً') || text.includes('تجاوزت') || text.includes('خطأ')) return 'error'
    return 'info'
  }

  const handleItemClick = async (n: any) => {
    await markAsRead(n.id)
    onClose()

    // Dynamic navigation based on content keywords
    const text = (n.title + ' ' + n.message).toLowerCase()
    if (user?.role === 'teacher') {
      if (text.includes('اشتراك') || text.includes('باقة') || text.includes('ترقية') || text.includes('شحن') || text.includes('مساحة')) {
        navigate('/teacher/subscription')
      } else {
        navigate('/teacher/dashboard')
      }
    } else if (user?.role === 'student') {
      if (text.includes('محفظة') || text.includes('شحن') || text.includes('رصيد')) {
        navigate('/student/wallet')
      } else {
        navigate('/student/courses')
      }
    } else if (user?.role === 'admin') {
      if (text.includes('معلم') || text.includes('اشتراك') || text.includes('ترقية')) {
        navigate('/admin/teachers')
      } else {
        navigate('/admin/dashboard')
      }
    }
  }

  return (
    <>
      {/* Backdrop for mobile screen overlay */}
      <div 
        className="block md:hidden fixed inset-0 bg-black/35 backdrop-blur-sm z-[9998] transition-opacity duration-300"
        onClick={onClose}
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.2 }}
        className="fixed left-4 right-4 top-[80px] w-auto max-h-[70vh] rounded-[20px] z-[9999] overflow-y-auto bg-[var(--card-bg)] border border-[var(--border-color)] p-4 shadow-[0_15px_50px_rgba(0,0,0,0.5)] text-right backdrop-blur-lg transition-all duration-300 overflow-x-hidden md:absolute md:top-full md:right-0 md:left-auto md:w-96 md:max-h-[500px] md:rounded-3xl md:z-[99] md:mt-2 md:overflow-y-auto"
        style={{
          wordBreak: 'break-word',
        }}
      >
        <div className="flex justify-between items-center pb-2.5 border-b border-[var(--border-color)] mb-3">
          <span className="text-xs font-black text-[var(--text-color)]">آخر التنبيهات والرسائل</span>
          {unreadCount > 0 && (
            <button 
              onClick={(e) => {
                e.stopPropagation()
                markAllAsRead()
              }}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer font-bold bg-transparent border-none p-0"
            >
              تحديد الكل كمقروء
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="py-10 text-center text-xs text-[var(--text-secondary)] flex flex-col items-center gap-2">
            <Mail className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
            <span>لا توجد إشعارات جديدة حالياً.</span>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 select-none scrollbar-none">
            {notifications.map(n => {
              const nType = getNotificationType(n.title, n.message)
              
              const typeStyles = {
                success: {
                  bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                  icon: <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                },
                warning: {
                  bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                  icon: <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                },
                error: {
                  bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
                  icon: <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                },
                info: {
                  bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
                  icon: <Bell className="w-4 h-4 shrink-0 text-indigo-500" />
                }
              }[nType]

              return (
                <div 
                  key={n.id} 
                  onClick={() => handleItemClick(n)}
                  className={`min-h-[72px] p-3 rounded-2xl border text-right cursor-pointer transition-all duration-200 flex gap-3 items-start relative group hover:scale-[1.01] ${
                    n.is_read 
                      ? 'bg-[var(--bg-color)]/20 border-[var(--border-color)] text-[var(--text-secondary)]' 
                      : 'bg-indigo-500/5 border-indigo-500/15 text-[var(--text-color)] font-bold shadow-sm shadow-indigo-500/5'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl ${typeStyles.bg} flex items-center justify-center`}>
                    {typeStyles.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold truncate">{n.title}</h4>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <span className="text-[9px] text-[var(--text-muted)] mt-1.5 block">
                      {new Date(n.created_at).toLocaleDateString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {!n.is_read && (
                    <span className="absolute top-3 left-3 w-1.5 h-1.5 bg-indigo-500 rounded-full group-hover:scale-125 transition-transform" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </>
  )
}
