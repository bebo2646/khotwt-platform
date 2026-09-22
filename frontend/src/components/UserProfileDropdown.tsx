import React, { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { User, LogOut } from 'lucide-react'
import { ensureHttps } from '../utils/urls'
import type { DashboardNavItem } from './navigation/dashboardNavConfig'

export interface UserProfileDropdownProps {
  onClose: () => void
  mobile?: boolean
  overflowItems?: DashboardNavItem[]
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  onClose,
  mobile = false,
  overflowItems = [],
}) => {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.documentElement.style.overflow = ''
    }
  }, [onClose])

  if (!user) return null

  const handleLogoutClick = () => {
    logout()
    onClose()
    navigate('/login', { replace: true })
  }

  // Role translations
  const roleText =
    user.role === 'teacher' ? 'معلم معتمد' : user.role === 'admin' ? 'مدير النظام' : 'طالب'

  // Profile path determination
  const profilePath =
    user.role === 'student'
      ? '/student/profile'
      : user.role === 'teacher'
      ? '/teacher/dashboard'
      : '/admin/dashboard'

  const isLinkActive = (to: string) => {
    if (to === '/' || to === '/teacher/dashboard' || to === '/student/dashboard') {
      return location.pathname === to
    }
    return location.pathname === to || location.pathname.startsWith(to + '/')
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="قائمة الملف الشخصي"
      className={
        mobile
          ? 'relative w-full py-2.5 text-right transition-all duration-200'
          : 'absolute left-0 right-auto mt-3.5 w-[280px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-90px)] overflow-y-auto bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[18px] shadow-[0_10px_35px_rgba(0,0,0,0.15)] z-[9999] py-2.5 animate-scale-up text-right transition-all duration-200'
      }
    >
      {/* User Info Header Section */}
      <div
        className={`px-4 py-3 border-b border-[var(--border-color)] flex items-center gap-3 ${
          mobile ? 'bg-[var(--surface-bg)] rounded-[18px] border border-[var(--border-color)]' : ''
        }`}
      >
        {user.avatar ? (
          <img
            src={ensureHttps(user.avatar)}
            alt="Avatar"
            className="w-10 h-10 rounded-xl object-cover border border-[var(--border-color)] shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 font-black flex items-center justify-center text-sm border border-indigo-500/20 uppercase shrink-0">
            {user.name.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-black text-[var(--text-color)] truncate" title={user.name}>
            {user.name}
          </h4>
          <span className="text-[10px] text-indigo-400 font-bold mt-0.5 block">{roleText}</span>
        </div>
      </div>

      {/* Overflow Navigation Links (When navbar items exceed available space) */}
      {overflowItems && overflowItems.length > 0 && (
        <div className="py-1">
          <div className="px-3 pt-2 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-black text-[var(--text-muted)] tracking-wider">
              روابط إضافية
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              {overflowItems.length}
            </span>
          </div>

          <div className="px-2 py-1 space-y-1 max-h-[220px] overflow-y-auto scrollbar-thin">
            {overflowItems.map((item) => {
              const active = isLinkActive(item.to)
              const Icon = item.icon
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  onClick={onClose}
                  role="menuitem"
                  className={`flex items-center justify-between px-3 h-10 text-xs rounded-[12px] transition-all cursor-pointer ${
                    active
                      ? 'font-black text-brand-primary bg-brand-primary/10 shadow-sm border border-brand-primary/25'
                      : 'font-bold text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--border-color)]/20 border border-transparent hover:border-[var(--border-color)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {Icon && (
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          active ? 'text-brand-primary' : 'text-[var(--text-muted)]'
                        }`}
                      />
                    )}
                    <span className="truncate">{item.label}</span>
                  </div>
                  {active && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0 animate-pulse mr-1"
                      title="نشط"
                    />
                  )}
                </Link>
              )
            })}
          </div>

          <div className="h-px bg-[var(--border-color)] my-1.5" />
        </div>
      )}

      {/* Menu Options List (Account Actions) */}
      <div className="px-2 py-1.5 space-y-1">
        <Link
          to={profilePath}
          onClick={onClose}
          role="menuitem"
          className={`flex items-center justify-between px-3 h-11 text-xs rounded-[12px] transition-colors cursor-pointer ${
            isLinkActive(profilePath)
              ? 'font-black text-brand-primary bg-brand-primary/10 border border-brand-primary/25'
              : 'font-bold text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--border-color)]/20 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>الملف الشخصي</span>
          </div>
          {isLinkActive(profilePath) && (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0 animate-pulse mr-1" />
          )}
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
          <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  )
}
