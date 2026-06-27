import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { Sun, Moon, LogOut, Menu, X, Wallet, User as UserIcon, BookOpen, Settings, Bell, Check, CheckCircle, AlertTriangle, AlertCircle, ChevronDown } from 'lucide-react'
import API from '../services/api'
import { useNotifications } from '../context/NotificationContext'
import { NotificationDropdown } from './NotificationDropdown'
import { UserProfileDropdown } from './UserProfileDropdown'

const getNotificationType = (title: string, message: string): 'success' | 'warning' | 'error' | 'info' => {
  const text = (title + ' ' + message).toLowerCase()
  if (text.includes('خطأ') || text.includes('فشل') || text.includes('رفض') || text.includes('منتهي') || text.includes('انتهى') || text.includes('error') || text.includes('fail') || text.includes('reject')) {
    return 'error'
  }
  if (text.includes('تنبيه') || text.includes('تحذير') || text.includes('قريبا') || text.includes('شارف') || text.includes('warning') || text.includes('alert')) {
    return 'warning'
  }
  if (text.includes('نجاح') || text.includes('تم ') || text.includes('تفعيل') || text.includes('موافقة') || text.includes('سداد') || text.includes('دفع') || text.includes('success')) {
    return 'success'
  }
  return 'info'
}

export default function Navbar() {
  const { isLoggedIn, user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  // Notifications States & Logic (consumed from global context)
  const { unreadCount } = useNotifications()
  const [showNotifDropdown, setShowNotifDropdown] = React.useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = React.useState(false)
  const notifRef = React.useRef<HTMLDivElement>(null)
  const profileDropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false)
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
    setMobileMenuOpen(false)
  }

  const getHomePath = () => {
    if (!isLoggedIn || !user) return '/'
    if (user.role === 'admin') return '/admin/dashboard'
    if (user.role === 'teacher') return '/teacher/dashboard'
    if (user.role === 'student') return '/student/dashboard'
    return '/'
  }

  const isLinkActive = (path: string) => {
    return window.location.pathname === path
  }

  const navLink = (to: string, label: string) => {
    const active = isLinkActive(to)
    return (
      <Link 
        to={to} 
        className={`font-black text-xs transition-all duration-300 relative py-1.5 px-3 rounded-lg whitespace-nowrap shrink-0 ${
          active 
            ? 'text-brand-primary bg-brand-primary/5 border border-brand-primary/10' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)]/60 border border-transparent'
        }`}
      >
        {label}
      </Link>
    )
  }

  // Define navigation links based on user role
  const renderNavLinks = () => {
    if (!isLoggedIn || !user) {
      return (
        <>
          {navLink("/", "الرئيسية")}
          {navLink("/courses", "الكورسات")}
          {navLink("/teachers", "المعلمون")}
        </>
      )
    }

    if (user.role === 'admin') {
      const isSuper = !!user.is_super_admin || !!user.is_super;
      const hasPerm = (perm: string) => isSuper || (!!user.permissions && user.permissions.includes(perm));

      return (
        <>
          {navLink("/admin/dashboard", "الرئيسية")}
          {hasPerm('teachers.manage') && navLink("/admin/teachers", "المعلمون")}
          {hasPerm('students.manage') && navLink("/admin/students", "الطلاب")}
          {hasPerm('courses.manage') && navLink("/admin/courses", "الكورسات")}
          {hasPerm('coupons.manage') && navLink("/admin/codes", "أكواد الشحن")}
          {hasPerm('reports.view') && navLink("/admin/reports", "التقارير")}
          {navLink("/admin/notifications", "إرسال الإشعارات")}
          {navLink("/admin/subscriptions/requests", "طلبات الاشتراكات")}
          {navLink("/admin/subscription-plans", "إدارة الباقات")}
          {navLink("/admin/bunny", "إحصائيات Bunny")}
          {hasPerm('admins.manage') && navLink("/admin/manage", "الصلاحيات")}
        </>
      )
    }

    if (user.role === 'teacher') {
      return (
        <>
          {navLink("/teacher/dashboard", "الرئيسية")}
          {navLink("/teacher/courses", "كورساتي")}
          {navLink("/teacher/students", "الطلاب")}
          {navLink("/teacher/revenue", "تقرير الأرباح")}
          {navLink("/teacher/subscription", "اشتراكي")}
          {navLink("/teacher/videos", "إدارة الفيديوهات")}
          {navLink("/change-password", "تغيير المرور")}
        </>
      )
    }

    // Default Student role
    return (
      <>
        {navLink("/student/dashboard", "الرئيسية")}
        {navLink("/student/courses", "كورساتي")}
        {navLink("/student/wallet", "المحفظة")}
      </>
    )
  }

  return (
    <nav className="sticky top-0 z-50 glass border-b border-[var(--border-color)] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-8 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between h-[72px]">
          
          {/* Logo Section */}
          <div className="flex items-center shrink-0">
            <Link to={getHomePath()} className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <img 
                src="/logo.png" 
                alt="شعار خطوتك" 
                className="h-9 w-9 object-contain shrink-0"
              />
              <span className="text-2xl font-black tracking-wider text-brand-primary bg-clip-text">خطوتك</span>
            </Link>
          </div>

          {/* Centered Navigation Links */}
          <div className="hidden md:flex flex-row flex-nowrap items-center justify-center gap-6 xl:gap-8 overflow-x-auto xl:overflow-x-visible whitespace-nowrap scrollbar-none py-1 mx-6 flex-1">
            {renderNavLinks()}
          </div>

          {/* User Controls & Mobile Toggle */}
          <div className="flex items-center gap-4 lg:gap-5">
            
            {/* Notifications Bell */}
            {isLoggedIn && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className="p-2 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] border border-[var(--border-color)] cursor-pointer text-current relative transition-all duration-200"
                  title="الإشعارات"
                  aria-label="الإشعارات"
                >
                  <Bell className="h-5 w-5 text-indigo-400" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -left-1 bg-rose-500 text-white font-bold text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full border border-zinc-950 animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifDropdown && (
                  <NotificationDropdown onClose={() => setShowNotifDropdown(false)} alignRight={true} />
                )}
              </div>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] border border-[var(--border-color)] cursor-pointer text-current"
              title="تغيير المظهر"
              aria-label="تغيير المظهر"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              {isLoggedIn && user ? (
                <div className="flex items-center gap-4">
                  {user.role === 'student' && user.wallet && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/20 rounded-full text-brand-primary text-xs font-semibold">
                      <Wallet className="h-3.5 w-3.5" />
                      <span>{user.wallet.balance} ج.م</span>
                    </div>
                  )}
                  
                  <div className="relative" ref={profileDropdownRef}>
                    <button
                      data-profile-toggle="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProfileDropdown(!showProfileDropdown);
                      }}
                      className="flex items-center gap-2 px-3.5 py-1.5 bg-[rgba(255,255,255,0.03)] border border-[var(--border-color)] rounded-xl text-sm transition cursor-pointer"
                    >
                      {user.avatar ? (
                        <img src={user.avatar} alt="Avatar" className="w-6.5 h-6.5 rounded-lg object-cover" />
                      ) : (
                        <div className="w-6.5 h-6.5 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-[10px] uppercase">
                          {user.name.slice(0, 2)}
                        </div>
                      )}
                      <span className="font-semibold text-xs text-[var(--text-secondary)]">{user.name}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </button>
                    
                    {showProfileDropdown && (
                      <UserProfileDropdown onClose={() => setShowProfileDropdown(false)} />
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <Link to="/login" className="px-4 py-2 text-sm font-medium border border-[var(--border-color)] rounded-lg hover:bg-[rgba(255,255,255,0.05)]">تسجيل دخول</Link>
                  <Link to="/register" className="px-4 py-2 text-sm font-medium bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg glow-btn">حساب جديد</Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md hover:bg-[rgba(255,255,255,0.05)] border border-[var(--border-color)] text-current"
                aria-label="القائمة الجانبية"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden glass border-b border-[var(--border-color)] px-4 pt-2 pb-4 space-y-3">
          <div className="flex flex-col gap-3">
            {renderNavLinks()}
          </div>
          <hr className="border-[var(--border-color)]" />
          <div className="flex flex-col gap-3">
            {isLoggedIn && user ? (
              <div className="space-y-3 py-1 text-right w-full">
                {/* User info row */}
                <div className="flex items-center gap-3 pb-2 border-b border-[var(--border-color)]">
                  {user.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="w-9 h-9 rounded-xl object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-xs uppercase border border-indigo-500/20">
                      {user.name.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black truncate">{user.name}</div>
                    <span className="text-[10px] text-indigo-400 font-bold">{user.role === 'teacher' ? 'معلم معتمد' : 'طالب'}</span>
                  </div>
                </div>
                
                {user.role === 'student' && user.wallet && (
                  <div className="flex justify-between items-center px-3 py-1.5 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
                    <span className="text-[10px] text-[var(--text-secondary)]">رصيد المحفظة</span>
                    <span className="text-xs font-black text-brand-primary">{user.wallet.balance} ج.م</span>
                  </div>
                )}

                {/* Navigation links */}
                <div className="flex flex-col gap-1">
                  <Link
                    to={user.role === 'student' ? '/student/profile' : '/teacher/dashboard'}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-color)]/60 rounded-xl transition"
                  >
                    <span>الملف الشخصي</span>
                  </Link>
                  <Link
                    to={user.role === 'student' ? '/student/dashboard' : '/teacher/subscription'}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-color)]/60 rounded-xl transition"
                  >
                    <span>لوحة التحكم الخاصة بي</span>
                  </Link>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full py-2 text-center text-sm font-medium border border-[var(--border-color)] rounded-lg">تسجيل دخول</Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="w-full py-2 text-center text-sm font-medium bg-brand-primary text-white rounded-lg">إنشاء حساب</Link>
              </>
            )}
          </div>
        </div>
      )}

    </nav>
  )
}
