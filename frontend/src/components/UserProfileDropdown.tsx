import React, { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { User, Settings, LogOut, ChevronDown } from 'lucide-react'

interface UserProfileDropdownProps {
  onClose: () => void
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({ onClose }) => {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on route change
  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        menuRef.current && 
        !menuRef.current.contains(target) &&
        !target.closest('[data-profile-toggle="true"]')
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  if (!user) return null

  const handleLogoutClick = () => {
    logout()
    onClose()
    navigate('/login', { replace: true })
  }

  // Role translations
  const roleText = user.role === 'teacher' ? 'معلم معتمد' : user.role === 'admin' ? 'مدير النظام' : 'طالب'
  
  // Profile path determination
  const profilePath = user.role === 'student' ? '/student/profile' : user.role === 'teacher' ? '/teacher/dashboard' : '/admin/dashboard'

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="قائمة الملف الشخصي"
      className="absolute left-0 lg:left-auto lg:right-0 mt-3.5 w-[260px] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[18px] shadow-[0_10px_35px_rgba(0,0,0,0.15)] z-[9999] py-2.5 animate-scale-up text-right transition-all duration-200"
    >
      {/* User Info Header Section */}
      <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center gap-3">
        {user.avatar ? (
          <img 
            src={user.avatar} 
            alt="Avatar" 
            className="w-10 h-10 rounded-xl object-cover border border-[var(--border-color)]" 
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 font-black flex items-center justify-center text-sm border border-indigo-500/20 uppercase">
            {user.name.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-black text-[var(--text-color)] truncate">{user.name}</h4>
          <span className="text-[10px] text-indigo-400 font-bold mt-0.5 block">{roleText}</span>
        </div>
      </div>

      {/* Menu Options List */}
      <div className="px-2 py-1.5 space-y-1">
        <Link
          to={profilePath}
          role="menuitem"
          className="flex items-center gap-3 px-3 h-11 text-xs font-bold rounded-[12px] text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)]/50 transition-colors cursor-pointer"
        >
          <User className="w-4 h-4 text-indigo-400" />
          <span>الملف الشخصي</span>
        </Link>
      </div>

      <div className="h-px bg-[var(--border-color)] my-1.5" />

      {/* Logout Section */}
      <div className="px-2">
        <button
          onClick={handleLogoutClick}
          role="menuitem"
          className="w-full flex items-center gap-3 px-3 h-11 text-xs font-black rounded-[12px] text-rose-500 hover:text-white hover:bg-rose-500/10 transition-all cursor-pointer text-right border-none bg-transparent"
        >
          <LogOut className="w-4 h-4 text-rose-500" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  )
}
