import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { useNotifications } from '../context/NotificationContext'
import { NotificationDropdown } from './NotificationDropdown'
import { NotificationToast } from './NotificationToast'
import { AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Ticket,
  BarChart3,
  Bell,
  Settings,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Search,
  Sun,
  Moon,
  LogOut,
  Layers,
  ShieldAlert,
  Tv,
  ChevronLeft,
  UserCheck
} from 'lucide-react'

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { unreadCount } = useNotifications()

  // Layout States
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  
  const notifRef = React.useRef<HTMLDivElement>(null)
  const profileRef = React.useRef<HTMLDivElement>(null)

  // Auto-close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])

  // Handle click outside dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // Determine Current Page Title dynamically
  const getPageTitle = () => {
    const path = location.pathname
    if (path.startsWith('/admin/dashboard')) return 'لوحة التحكم العامة'
    if (path.startsWith('/admin/teachers/create')) return 'إضافة معلم جديد'
    if (path.startsWith('/admin/teachers') && path.includes('subscription')) return 'تعديل اشتراك المعلم'
    if (path.startsWith('/admin/teachers')) return 'إدارة شؤون المعلمين'
    if (path.startsWith('/admin/students')) return 'إدارة حسابات الطلاب'
    if (path.startsWith('/admin/courses')) return 'إدارة الكورسات والمناهج'
    if (path.startsWith('/admin/subscriptions/requests')) return 'طلبات اشتراكات المعلمين'
    if (path.startsWith('/admin/codes')) return 'إدارة أكواد الشحن'
    if (path.startsWith('/admin/reports')) return 'التقارير المالية والمبيعات'
    if (path.startsWith('/admin/notifications')) return 'إرسال الإشعارات الجماعية'
    if (path.startsWith('/admin/subscription-plans')) return 'إعدادات باقات الاشتراك'
    if (path.startsWith('/admin/bunny')) return 'إحصائيات مساحات تخزين Bunny Stream'
    if (path.startsWith('/admin/manage')) return 'إدارة صلاحيات المشرفين'
    return 'لوحة الإدارة'
  }

  const isSuper = !!user?.is_super_admin || !!user?.is_super
  const hasPerm = (perm: string) => isSuper || (!!user?.permissions && user.permissions.includes(perm))

  // Navigation Definitions
  const navGroups = [
    {
      label: 'الرئيسية',
      items: [
        {
          label: 'لوحة التحكم',
          path: '/admin/dashboard',
          icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
          visible: true
        }
      ]
    },
    {
      label: 'المستخدمين والمحتوى',
      items: [
        {
          label: 'المعلمون',
          path: '/admin/teachers',
          icon: <Users className="w-5 h-5 shrink-0" />,
          visible: hasPerm('teachers.manage')
        },
        {
          label: 'الطلاب',
          path: '/admin/students',
          icon: <GraduationCap className="w-5 h-5 shrink-0" />,
          visible: hasPerm('students.manage')
        },
        {
          label: 'الكورسات',
          path: '/admin/courses',
          icon: <BookOpen className="w-5 h-5 shrink-0" />,
          visible: hasPerm('courses.manage')
        }
      ]
    },
    {
      label: 'العمليات المالية',
      items: [
        {
          label: 'طلبات الاشتراكات',
          path: '/admin/subscriptions/requests',
          icon: <ClipboardList className="w-5 h-5 shrink-0" />,
          visible: true
        },
        {
          label: 'أكواد الشحن',
          path: '/admin/codes',
          icon: <Ticket className="w-5 h-5 shrink-0" />,
          visible: hasPerm('coupons.manage')
        },
        {
          label: 'التقارير المالية',
          path: '/admin/reports',
          icon: <BarChart3 className="w-5 h-5 shrink-0" />,
          visible: hasPerm('reports.view')
        }
      ]
    },
    {
      label: 'التواصل والربط',
      items: [
        {
          label: 'الإشعارات',
          path: '/admin/notifications',
          icon: <Bell className="w-5 h-5 shrink-0" />,
          visible: true
        }
      ]
    }
  ]

  const settingsSubmenu = [
    {
      label: 'إدارة الباقات',
      path: '/admin/subscription-plans',
      icon: <Layers className="w-4 h-4 shrink-0" />,
      visible: true
    },
    {
      label: 'إحصائيات Bunny',
      path: '/admin/bunny',
      icon: <Tv className="w-4 h-4 shrink-0" />,
      visible: true
    },
    {
      label: 'صلاحيات المشرفين',
      path: '/admin/manage',
      icon: <ShieldAlert className="w-4 h-4 shrink-0" />,
      visible: hasPerm('admins.manage')
    }
  ]

  const isRouteActive = (path: string) => {
    if (path === '/admin/dashboard') {
      return location.pathname === '/admin' || location.pathname === '/admin/dashboard'
    }
    return location.pathname.startsWith(path)
  }

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[var(--surface-bg)] border-l border-[var(--border-color)] select-none transition-all duration-300">
      {/* Sidebar Header Logo */}
      <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} px-6 h-16 border-b border-[var(--border-color)]`}>
        {!sidebarCollapsed ? (
          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-lg font-black text-indigo-400">خطوتك</span>
          </Link>
        ) : (
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
        )}
        
        {/* Collapse Button for desktop */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] cursor-pointer"
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Navigation Group Items */}
      <div className="flex-1 overflow-y-auto py-5 px-4 space-y-6 scrollbar-none">
        {navGroups.map((group, gIdx) => {
          const visibleItems = group.items.filter(i => i.visible)
          if (visibleItems.length === 0) return null

          return (
            <div key={gIdx} className="space-y-2">
              {!sidebarCollapsed && (
                <span className="px-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block">
                  {group.label}
                </span>
              )}
              <div className="space-y-1">
                {visibleItems.map((item, iIdx) => {
                  const active = isRouteActive(item.path)
                  return (
                    <Link
                      key={iIdx}
                      to={item.path}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        active 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' 
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)]/60 border border-transparent hover:border-[var(--border-color)]'
                      } ${sidebarCollapsed ? 'justify-center' : ''}`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      {item.icon}
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Settings Group */}
        <div className="space-y-2">
          {!sidebarCollapsed && (
            <span className="px-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block">
              النظام والإعدادات
            </span>
          )}
          <div className="space-y-1">
            {!sidebarCollapsed ? (
              <>
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)]/60 border border-transparent hover:border-[var(--border-color)] cursor-pointer`}
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 shrink-0" />
                    <span>إعدادات المنصة</span>
                  </div>
                  {settingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {settingsOpen && (
                  <div className="mr-4 pr-3 border-r border-[var(--border-color)] mt-1 space-y-1 animate-slide-down">
                    {settingsSubmenu.filter(s => s.visible).map((subItem, sIdx) => {
                      const active = isRouteActive(subItem.path)
                      return (
                        <Link
                          key={sIdx}
                          to={subItem.path}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                            active 
                              ? 'text-indigo-400 bg-indigo-500/5' 
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-color)]'
                          }`}
                        >
                          {subItem.icon}
                          <span>{subItem.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              settingsSubmenu.filter(s => s.visible).map((subItem, sIdx) => {
                const active = isRouteActive(subItem.path)
                return (
                  <Link
                    key={sIdx}
                    to={subItem.path}
                    className={`flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 ${
                      active 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)]/60'
                    }`}
                    title={subItem.label}
                  >
                    {subItem.icon}
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Logout Footer Button */}
      <div className="p-4 border-t border-[var(--border-color)]">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-rose-500 hover:text-white hover:bg-rose-600/10 cursor-pointer ${
            sidebarCollapsed ? 'justify-center' : ''
          }`}
          title={sidebarCollapsed ? 'تسجيل الخروج' : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!sidebarCollapsed && <span>تسجيل الخروج</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen w-full bg-[var(--bg-color)] text-[var(--text-color)] overflow-x-hidden" dir="rtl">
      
      {/* 1. Desktop Sidebar */}
      <aside 
        className={`hidden lg:block fixed right-0 top-0 bottom-0 z-45 transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-[280px]'
        }`}
      >
        {renderSidebarContent()}
      </aside>

      {/* 2. Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          />
          {/* Drawer Body */}
          <aside className="relative flex flex-col w-[280px] max-w-xs h-full bg-[var(--surface-bg)] border-l border-[var(--border-color)] animate-slide-in-right z-10">
            <button 
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute left-4 top-4 p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="h-full pt-4">
              {renderSidebarContent()}
            </div>
          </aside>
        </div>
      )}

      {/* 3. Main Content Wrapper */}
      <div 
        className={`flex flex-col flex-1 w-full min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pr-20' : 'lg:pr-[280px]'
        }`}
      >
        
        {/* Top Header: Fixed height 72px */}
        <header 
          className={`sticky top-0 left-0 right-0 z-[1000] w-full flex items-center justify-between h-[72px] px-6 border-b transition-all duration-300 ${
            theme === 'light'
              ? 'bg-white border-b-[#e5e7eb] text-[#0f172a] shadow-[0_4px_20px_rgba(0,0,0,0.04)]'
              : 'bg-[var(--card-bg)]/85 border-b-[var(--border-color)] text-[var(--text-color)] backdrop-blur-[20px] dark:bg-[#080c18]/85'
          }`}
        >
          {/* Right Side: Mobile Menu Button (Hamburger) & Page Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden flex items-center justify-center p-2 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-black text-[var(--text-color)]">{getPageTitle()}</h1>
          </div>

          {/* Left Side: Header Controls */}
          <div className="flex items-center gap-3">
            {/* Search Input (Desktop) */}
            <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-[var(--surface-bg)] rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] focus-within:border-indigo-500/50 transition">
              <Search className="w-4 h-4" />
              <input 
                type="text" 
                placeholder="بحث..." 
                className="bg-transparent border-none text-xs text-[var(--text-color)] placeholder-[var(--text-muted)] outline-none w-48 font-semibold"
              />
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-[var(--surface-bg)] hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] transition cursor-pointer"
              title={theme === 'dark' ? 'الوضع المضيء' : 'الوضع المظلم'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notification Bell Dropdown wrapper */}
            <div className="relative" ref={notifRef}>
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setShowNotifDropdown(!showNotifDropdown);
                }}
                onClick={(e) => e.preventDefault()}
                className="p-2.5 rounded-xl bg-[var(--surface-bg)] hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] transition relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-3 h-3 bg-indigo-500 text-[9px] font-black text-white flex items-center justify-center rounded-full animate-bounce-subtle">
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

            {/* Profile Dropdown wrapper */}
            <div className="relative" ref={profileRef}>
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setShowProfileMenu(!showProfileMenu);
                }}
                onClick={(e) => e.preventDefault()}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-[var(--surface-bg)] border border-transparent hover:border-[var(--border-color)] transition cursor-pointer"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-400 font-bold flex items-center justify-center uppercase">
                    {user?.name?.slice(0, 2)}
                  </div>
                )}
                <span className="hidden sm:inline text-xs font-semibold text-[var(--text-secondary)]">{user?.name}</span>
              </button>

              {showProfileMenu && (
                <div className="absolute left-0 mt-3 w-48 bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] z-50 py-1.5 animate-slide-down">
                  <div className="px-4 py-2 border-b border-[var(--border-color)]">
                    <span className="block text-xs font-bold text-[var(--text-color)] truncate">{user?.name}</span>
                    <span className="block text-[10px] text-indigo-400 mt-0.5 capitalize">مدير النظام</span>
                  </div>
                  <Link 
                    to="/change-password" 
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)]/60"
                  >
                    <UserCheck className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span>تغيير كلمة المرور</span>
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-rose-500 hover:text-white hover:bg-rose-600/10 border-none bg-transparent cursor-pointer text-right"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 4. Page Content area */}
        <main className="flex-1 w-full p-6 sm:p-8 md:p-10 max-w-[1600px] mx-auto overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Notifications Popups */}
      <NotificationToast />
    </div>
  )
}
