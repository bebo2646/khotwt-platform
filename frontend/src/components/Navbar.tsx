import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { Sun, Moon, LogOut, Menu, X, Wallet, User as UserIcon, BookOpen, Settings, Bell, Check, CheckCircle, AlertTriangle, AlertCircle, ChevronDown } from 'lucide-react'
import API from '../services/api'
import { ensureHttps } from '../utils/urls'
import { useNotifications } from '../context/NotificationContext'
import { NotificationDropdown } from './NotificationDropdown'
import { UserProfileDropdown } from './UserProfileDropdown'
import { AnimatePresence, motion } from 'framer-motion'
import { TEACHER_NAV_ITEMS, STUDENT_NAV_ITEMS } from './navigation/dashboardNavConfig'
import { useResponsiveNav } from '../hooks/useResponsiveNav'

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
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [isScrolled, setIsScrolled] = React.useState(false)

  // Scroll detection
  React.useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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

  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.documentElement.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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

  // Determine active configuration for Teacher or Student
  const activeRoleConfig = React.useMemo(() => {
    if (!isLoggedIn || !user) return null
    if (user.role === 'teacher') return TEACHER_NAV_ITEMS
    if (user.role === 'student') return STUDENT_NAV_ITEMS
    return null
  }, [isLoggedIn, user])

  // Shared responsive navigation engine
  const {
    visibleItems,
    overflowItems,
    hasActiveOverflow,
    containerRef: responsiveNavContainerRef,
    measureContainerRef,
  } = useResponsiveNav({
    items: activeRoleConfig || [],
    currentPath: location.pathname,
    safetyBuffer: 12,
  })

  const isLinkActive = (path: string) => {
    if (path === '/' || path === '/teacher/dashboard' || path === '/student/dashboard') {
      return location.pathname === path
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const navLink = (to: string, label: string, key?: string) => {
    const active = isLinkActive(to)
    return (
      <Link 
        key={key || to}
        to={to} 
        onClick={() => setMobileMenuOpen(false)}
        className={`font-black text-xs transition-all duration-200 relative py-2 px-3.5 rounded-xl whitespace-nowrap shrink-0 border ${
          active 
            ? 'text-brand-primary bg-brand-primary/10 border-brand-primary/25 shadow-[0_0_15px_var(--glow-color)]' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--border-color)]/20 border-transparent hover:border-[var(--border-color)]'
        }`}
      >
        {label}
      </Link>
    )
  }

  // Desktop navigation links renderer: Adapts to available width
  const renderDesktopNavLinks = () => {
    if (!isLoggedIn || !user) {
      return (
        <>
          {navLink("/", "الرئيسية")}
          {navLink("/departments", "الأقسام")}
          {navLink("/courses", "الكورسات")}
          {navLink("/teachers", "المعلمون")}
          {navLink("/exams", "الامتحانات")}
        </>
      )
    }

    if (activeRoleConfig) {
      return (
        <>
          {visibleItems.map((item) => navLink(item.to, item.label, item.id))}
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
          {hasPerm('exams.manage') && navLink("/admin/monthly-exams", "الامتحانات الشهرية")}
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

    return null
  }

  // Mobile drawer links renderer: Always renders ALL links for the user
  const renderMobileNavLinks = () => {
    if (!isLoggedIn || !user) {
      return (
        <>
          {navLink("/", "الرئيسية")}
          {navLink("/departments", "الأقسام")}
          {navLink("/courses", "الكورسات")}
          {navLink("/teachers", "المعلمون")}
          {navLink("/exams", "الامتحانات")}
        </>
      )
    }

    if (user.role === 'teacher') {
      return (
        <>
          {TEACHER_NAV_ITEMS.map((item) => navLink(item.to, item.label, `mob-${item.id}`))}
        </>
      )
    }

    if (user.role === 'student') {
      return (
        <>
          {STUDENT_NAV_ITEMS.map((item) => navLink(item.to, item.label, `mob-${item.id}`))}
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
          {hasPerm('exams.manage') && navLink("/admin/monthly-exams", "الامتحانات الشهرية")}
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

    return null
  }

  return (
    <>
      {/* High-definition emblem rendering styles for Khotwt brand lockup */}
      <style dangerouslySetInnerHTML={{ __html: `
        .khotwt-emblem-box {
          position: relative !important;
          overflow: hidden !important;
          flex-shrink: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 25px !important;
          height: 40px !important;
        }
        @media (min-width: 640px) {
          .khotwt-emblem-box {
            width: 29px !important;
            height: 46px !important;
          }
        }
        .khotwt-emblem-asset {
          position: absolute !important;
          max-width: none !important;
          pointer-events: none !important;
          user-select: none !important;
          width: 104px !important;
          height: 104px !important;
          top: -19px !important;
          left: -39px !important;
          right: auto !important;
          filter: drop-shadow(0 0 1.2px rgba(255,255,255,0.45)) !important;
        }
        @media (min-width: 640px) {
          .khotwt-emblem-asset {
            width: 117px !important;
            height: 117px !important;
            top: -21px !important;
            left: -44px !important;
            right: auto !important;
          }
        }
        html.light-theme .khotwt-emblem-asset {
          filter: none !important;
        }
        .khotwt-drawer-emblem-box {
          position: relative !important;
          overflow: hidden !important;
          flex-shrink: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 22px !important;
          height: 35px !important;
        }
        .khotwt-drawer-emblem-asset {
          position: absolute !important;
          max-width: none !important;
          pointer-events: none !important;
          user-select: none !important;
          width: 89px !important;
          height: 89px !important;
          top: -16px !important;
          left: -33px !important;
          right: auto !important;
          filter: drop-shadow(0 0 1px rgba(255,255,255,0.4)) !important;
        }
        html.light-theme .khotwt-drawer-emblem-asset {
          filter: none !important;
        }
      `}} />

      <nav className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-300 ${
        isScrolled 
          ? 'bg-[var(--bg-color)]/95 border-b border-[var(--border-color)] shadow-sm backdrop-blur-xl py-0' 
          : 'bg-[var(--bg-color)]/80 border-b border-[var(--border-color)] backdrop-blur-md py-1'
      }`}>
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[70px]">
          
          {/* Logo Section */}
          <div className="flex items-center shrink-0">
            <Link to={getHomePath()} className="flex items-center gap-2.5 sm:gap-3 hover:opacity-95 transition-opacity">
              <div className="khotwt-emblem-box" aria-hidden="true">
                <img 
                  src="/logo.png" 
                  alt="شعار خطوتك" 
                  className="khotwt-emblem-asset"
                />
              </div>
              <span className="text-[27px] sm:text-[31px] font-black tracking-tight text-[var(--text-color)] select-none leading-none">
                <span className="text-brand-primary">خطو</span>تك
              </span>
            </Link>
          </div>

          {/* Centered Navigation Links */}
          <div 
            ref={activeRoleConfig ? responsiveNavContainerRef : undefined}
            className="hidden md:flex flex-row flex-nowrap items-center justify-center gap-2 lg:gap-3 overflow-hidden whitespace-nowrap py-1 mx-2 lg:mx-4 flex-1 min-w-0"
          >
            {renderDesktopNavLinks()}
          </div>

          {/* User Controls & Mobile Toggle */}
          <div className="flex items-center gap-3 lg:gap-4 shrink-0">
            
            {/* Notifications Bell */}
            {isLoggedIn && (
              <div className="relative shrink-0" ref={notifRef}>
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setShowNotifDropdown(!showNotifDropdown);
                  }}
                  onClick={(e) => e.preventDefault()}
                  className="w-10 h-10 rounded-xl bg-[var(--surface-bg)] hover:bg-[var(--border-color)]/30 border border-[var(--border-color)] flex items-center justify-center shrink-0 cursor-pointer text-[var(--text-color)] relative transition-all duration-200"
                  title="الإشعارات"
                  aria-label="الإشعارات"
                >
                  <Bell className="h-5 w-5 text-brand-primary stroke-[2]" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full border border-[var(--bg-color)] animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifDropdown && (
                    <NotificationDropdown onClose={() => setShowNotifDropdown(false)} alignRight={true} />
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl bg-[var(--surface-bg)] hover:bg-[var(--border-color)]/30 border border-[var(--border-color)] flex items-center justify-center shrink-0 cursor-pointer text-[var(--text-color)] transition-all"
              title="تغيير المظهر"
              aria-label="تغيير المظهر"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400 stroke-[2]" /> : <Moon className="h-5 w-5 text-brand-primary stroke-[2]" />}
            </button>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              {isLoggedIn && user ? (
                <div className="flex items-center gap-3">
                  {user.role === 'student' && user.wallet && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/20 rounded-full text-brand-primary text-xs font-bold shadow-sm shrink-0">
                      <Wallet className="h-3.5 w-3.5 shrink-0" />
                      <span className="whitespace-nowrap">{user.wallet.balance} ج.م</span>
                    </div>
                  )}
                  
                  <div className="relative shrink-0" ref={profileDropdownRef}>
                    <button
                      data-profile-toggle="true"
                      onClick={(e) => {
                        e.preventDefault();
                        const nextState = !showProfileDropdown;
                        setShowProfileDropdown(nextState);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-bg)] hover:bg-[var(--border-color)]/30 border rounded-xl text-sm transition cursor-pointer text-foreground shrink-0 ${
                        hasActiveOverflow
                          ? 'border-brand-primary/40 bg-brand-primary/5 shadow-[0_0_12px_rgba(109,93,252,0.15)]'
                          : 'border-[var(--border-color)]'
                      }`}
                      aria-expanded={showProfileDropdown}
                      aria-haspopup="menu"
                      title={hasActiveOverflow ? 'توجد صفحات نشطة في القائمة' : 'قائمة المستخدم'}
                    >
                      {user.avatar ? (
                        <img src={ensureHttps(user.avatar)} alt="Avatar" className="w-6.5 h-6.5 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-6.5 h-6.5 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-[10px] uppercase shrink-0">
                          {user.name.slice(0, 2)}
                        </div>
                      )}
                      <span className="font-bold text-xs text-[var(--text-secondary)] max-w-[100px] sm:max-w-[130px] lg:max-w-[160px] truncate select-none">
                        {user.name}
                      </span>
                      {hasActiveOverflow && (
                        <span
                          className="w-2 h-2 rounded-full bg-brand-primary shrink-0 animate-pulse"
                          title="الصفحة الحالية متوفرة في القائمة"
                        />
                      )}
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform duration-200 ${
                          showProfileDropdown ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    
                    {showProfileDropdown && (
                      <UserProfileDropdown
                        onClose={() => setShowProfileDropdown(false)}
                        overflowItems={activeRoleConfig ? overflowItems : undefined}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <Link to="/login" className="px-4 py-2 text-xs font-bold border border-[var(--border-color)] rounded-xl hover:bg-[var(--surface-bg)] text-foreground transition-all">تسجيل دخول</Link>
                  <Link to="/register" className="px-4.5 py-2 text-xs font-bold bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl shadow-md shadow-brand-primary/20 active:scale-95 transition-all">حساب جديد</Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-10 h-10 rounded-xl bg-[var(--surface-bg)] hover:bg-[var(--border-color)]/30 border border-[var(--border-color)] flex items-center justify-center shrink-0 text-[var(--text-color)] cursor-pointer transition-all"
                aria-label="القائمة الجانبية"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5 text-[var(--text-color)] stroke-[2]" />
                ) : (
                  <Menu className="h-5 w-5 text-[var(--text-color)] stroke-[2]" />
                )}
              </button>
            </div>

          </div>
        </div>
      </div>

    </nav>

    {/* Hidden Off-Screen Measurement Container for Precise Responsive Calculations */}
    {activeRoleConfig && (
      <div
        ref={measureContainerRef}
        aria-hidden="true"
        className="invisible fixed pointer-events-none flex flex-row flex-nowrap"
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          visibility: 'hidden',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {activeRoleConfig.map((item) => (
          <span
            key={item.id}
            data-measure-id={item.id}
            className="font-black text-xs py-2 px-3.5 rounded-xl whitespace-nowrap shrink-0 border border-transparent inline-block"
          >
            {item.label}
          </span>
        ))}
      </div>
    )}

    {/* Mobile Menu Drawer */}
    <AnimatePresence>
      {mobileMenuOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-[999] md:hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
          />
          
          {/* Drawer */}
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 h-screen w-[min(340px,85vw)] bg-[var(--surface-bg)] border-r border-[var(--border-color)] shadow-[0_0_30px_rgba(0,0,0,0.3)] z-[1000] md:hidden flex flex-col justify-between p-6 overflow-y-auto text-right text-[var(--text-color)]"
            dir="rtl"
          >
            {/* Top part: Header + Navigation */}
            <div className="flex flex-col flex-1">
              {/* Header */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2.5">
                  <div className="khotwt-drawer-emblem-box" aria-hidden="true">
                    <img 
                      src="/logo.png" 
                      alt="شعار خطوتك" 
                      className="khotwt-drawer-emblem-asset" 
                    />
                  </div>
                  <span className="text-lg font-black tracking-tight text-[var(--text-color)] select-none">
                    <span className="text-brand-primary">خطو</span>تك
                  </span>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-9 h-9 rounded-xl bg-[var(--surface-bg)] hover:bg-[var(--border-color)]/50 border border-[var(--border-color)] text-[var(--text-color)] flex items-center justify-center shrink-0 cursor-pointer transition-all"
                  aria-label="إغلاق القائمة"
                >
                  <X className="w-5 h-5 text-[var(--text-color)] stroke-[2]" />
                </button>
              </div>
              
              {/* Navigation Links */}
              <div className="flex flex-col gap-3">
                {renderMobileNavLinks()}
              </div>
            </div>
            
            {/* Bottom part: User Card / Login Actions */}
            <div className="mt-8 pt-4 border-t border-[var(--border-color)]">
              {isLoggedIn && user ? (
                <div className="w-full space-y-4">
                  {/* User Card */}
                  <div className="px-4 py-3 bg-[var(--surface-bg)] rounded-[18px] border border-[var(--border-color)] flex items-center gap-3">
                    {user.avatar ? (
                      <img 
                        src={ensureHttps(user.avatar)} 
                        alt="Avatar" 
                        className="w-10 h-10 rounded-xl object-cover border border-[var(--border-color)]" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 font-black flex items-center justify-center text-sm border border-indigo-500/20 uppercase shrink-0">
                        {user.name.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-black text-[var(--text-color)] truncate">{user.name}</h4>
                      <span className="text-[10px] text-indigo-400 font-bold mt-0.5 block">
                        {user.role === 'teacher' ? 'معلم معتمد' : user.role === 'admin' ? 'مدير النظام' : 'طالب'}
                      </span>
                    </div>
                  </div>

                  {user.role === 'student' && user.wallet && (
                    <div className="flex justify-between items-center px-4 py-3 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
                      <span className="text-xs text-[var(--text-secondary)]">رصيد المحفظة</span>
                      <span className="text-sm font-black text-brand-primary">{user.wallet.balance} ج.م</span>
                    </div>
                  )}
                  
                  {/* Profile Action Link */}
                  <Link
                    to={user.role === 'student' ? '/student/profile' : user.role === 'teacher' ? '/teacher/dashboard' : '/admin/dashboard'}
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center gap-2.5 px-3 h-11 text-xs font-bold rounded-[12px] bg-[var(--surface-bg)] hover:bg-[var(--border-color)]/30 border border-[var(--border-color)] text-[var(--text-color)] transition-all cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-brand-primary shrink-0" />
                    <span>الملف الشخصي</span>
                  </Link>
                  
                  {/* Logout Button */}
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                      navigate('/login', { replace: true });
                    }}
                    className="w-full flex items-center justify-center gap-3 px-3 h-11 text-xs font-black rounded-[12px] text-rose-500 hover:text-white hover:bg-rose-500/10 transition-all cursor-pointer border-none bg-transparent"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full py-2.5 text-center text-xs font-bold border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-color)]/30">تسجيل دخول</Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="w-full py-2.5 text-center text-xs font-bold bg-brand-primary text-white rounded-xl shadow-md">إنشاء حساب</Link>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  </>
)
}
