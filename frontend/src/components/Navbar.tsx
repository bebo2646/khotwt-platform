import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { Sun, Moon, LogOut, Menu, X, Wallet, User as UserIcon, BookOpen, Settings, Bell, Check, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import API from '../services/api'
import { useNotifications } from '../context/NotificationContext'
import { NotificationDropdown } from './NotificationDropdown'

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
  const notifRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
    setMobileMenuOpen(false)
  }

  const getHomePath = () => {
    if (!isLoggedIn || !user) return '/'
    if (user.role === 'admin') return '/admin/dashboard'
    if (user.role === 'teacher') return '/teacher/dashboard'
    if (user.role === 'student') return '/student/dashboard'
    return '/'
  }

  // Define navigation links based on user role
  const renderNavLinks = () => {
    if (!isLoggedIn || !user) {
      return (
        <>
          <Link to="/" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">الرئيسية</Link>
          <Link to="/courses" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">الكورسات</Link>
          <Link to="/teachers" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">المعلمون</Link>
        </>
      )
    }

    if (user.role === 'admin') {
      const isSuper = !!user.is_super_admin || !!user.is_super;
      const hasPerm = (perm: string) => isSuper || (!!user.permissions && user.permissions.includes(perm));

      return (
        <>
          <Link to="/admin/dashboard" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">الرئيسية</Link>
          {hasPerm('teachers.manage') && (
            <Link to="/admin/teachers" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">المعلمون</Link>
          )}
          {hasPerm('students.manage') && (
            <Link to="/admin/students" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">الطلاب</Link>
          )}
          {hasPerm('courses.manage') && (
            <Link to="/admin/courses" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">الكورسات</Link>
          )}
          {hasPerm('coupons.manage') && (
            <Link to="/admin/codes" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">أكواد الشحن</Link>
          )}
          {hasPerm('reports.view') && (
            <Link to="/admin/reports" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">التقارير</Link>
          )}
          <Link to="/admin/notifications" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">إرسال الإشعارات</Link>

          <Link to="/admin/subscriptions/requests" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">طلبات الاشتراكات</Link>
          <Link to="/admin/subscription-plans" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">إدارة الباقات</Link>
          <Link to="/admin/bunny" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">إحصائيات Bunny</Link>
          {hasPerm('admins.manage') && (
            
            <Link to="/admin/manage" className="hover:text-brand-primary font-bold text-sm text-amber-500 transition-colors whitespace-nowrap shrink-0">الصلاحيات</Link>

          )}
        </>
      )
    }

    if (user.role === 'teacher') {
      return (
        <>
          <Link to="/teacher/dashboard" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">الرئيسية</Link>
          <Link to="/teacher/courses" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">كورساتي</Link>
          <Link to="/teacher/students" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">الطلاب</Link>
          <Link to="/teacher/revenue" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">تقرير الأرباح</Link>
          <Link to="/teacher/subscription" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">اشتراكي</Link>
          <Link to="/teacher/videos" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">إدارة الفيديوهات</Link>
          <Link to="/change-password" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">الملف الشخصي</Link>
        </>
      )
    }

    // Default Student role
    return (
      <>
        <Link to="/student/dashboard" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">الرئيسية</Link>
        <Link to="/student/courses" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">كورساتي</Link>
        <Link to="/student/wallet" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">المحفظة</Link>
        <Link to="/student/profile" className="hover:text-brand-primary font-medium text-sm transition-colors whitespace-nowrap shrink-0">الملف الشخصي</Link>
      </>
    )
  }

  return (
    <nav className="sticky top-0 z-50 glass border-b border-[var(--border-color)] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-8 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between h-16">
          
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
                  
                  <div className="flex items-center gap-2 px-3 py-1 bg-[rgba(255,255,255,0.03)] border border-[var(--border-color)] rounded-lg text-sm">
                    <UserIcon className="h-4 w-4 text-brand-primary" />
                    <span className="font-semibold text-xs">{user.name}</span>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>خروج</span>
                  </button>
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
              <>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-400">المستخدم:</span>
                  <span className="text-sm font-bold">{user.name}</span>
                </div>
                {user.role === 'student' && user.wallet && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400">رصيد المحفظة:</span>
                    <span className="text-sm font-bold text-brand-primary">{user.wallet.balance} ج.م</span>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  <span>تسجيل خروج</span>
                </button>
              </>
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
