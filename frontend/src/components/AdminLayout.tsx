import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { useConfigStore } from '../store/configStore'
import { ensureHttps } from '../utils/urls'
import { useNotifications } from '../context/NotificationContext'
import { NotificationDropdown } from './NotificationDropdown'
import { NotificationToast } from './NotificationToast'
import { AnimatePresence } from 'framer-motion'
import API from '../services/api'
import { useModalStore } from '../store/modalStore'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  ClipboardList,
  Ticket,
  BarChart3,
  Bell,
  Settings,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  Layers,
  ShieldAlert,
  Tv,
  ChevronLeft,
  UserCheck,
  AlertTriangle,
  Wallet,
  Coins
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

  // Maintenance mode layout states
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false)

  const checkMaintenance = async () => {
    try {
      const data = await useConfigStore.getState().fetchConfig()
      setIsMaintenanceActive(!!data?.maintenance)
    } catch (err) {
      console.error('Error fetching config in AdminLayout', err)
    }
  }

  const handleDisableMaintenance = async () => {
    try {
      await API.post('/admin/maintenance-settings', {
        maintenance_mode: false,
        maintenance_message: '',
        maintenance_eta: ''
      })
      setIsMaintenanceActive(false)
      useModalStore.getState().showToast('تم إلغاء تفعيل وضع الصيانة بنجاح.', 'success')
      window.dispatchEvent(new CustomEvent('elm_maintenance_updated', { detail: false }))
    } catch (err) {
      console.error('Error disabling maintenance from layout banner', err)
      useModalStore.getState().showToast('فشل إلغاء تفعيل وضع الصيانة.', 'error')
    }
  }

  useEffect(() => {
    checkMaintenance()

    // Listen to custom maintenance state updates (from dashboard switch toggle)
    const handleMaintenanceUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setIsMaintenanceActive(!!detail)
    }
    window.addEventListener('elm_maintenance_updated', handleMaintenanceUpdate)

    return () => {
      window.removeEventListener('elm_maintenance_updated', handleMaintenanceUpdate)
    }
  }, [])

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

  useEffect(() => {
    if (mobileSidebarOpen) {
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
  }, [mobileSidebarOpen]);

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
    if (path.startsWith('/admin/monthly-exams')) return 'إدارة الامتحانات الشهرية'
    if (path.startsWith('/admin/subscriptions/requests')) return 'طلبات اشتراكات المعلمين'
    if (path.startsWith('/admin/codes')) return 'إدارة أكواد الشحن'
    if (path.startsWith('/admin/financial')) return 'التحليلات المالية والأرباح'
    if (path.startsWith('/admin/reports')) return 'التقارير المالية والمبيعات'
    if (path.startsWith('/admin/notifications')) return 'إرسال الإشعارات الجماعية'
    if (path.startsWith('/admin/subscription-plans')) return 'إعدادات باقات الاشتراك'
    if (path.startsWith('/admin/bunny')) return 'إحصائيات مساحات تخزين Bunny Stream'
    if (path.startsWith('/admin/payouts')) return 'إدارة مستحقات ومدفوعات المعلمين'
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
          visible: hasPerm('dashboard.view')
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
          label: 'مراجعة التسجيلات',
          path: '/admin/students/pending',
          icon: <ShieldAlert className="w-5 h-5 shrink-0" />,
          visible: hasPerm('students.pending')
        },
        {
          label: 'الكورسات',
          path: '/admin/courses',
          icon: <BookOpen className="w-5 h-5 shrink-0" />,
          visible: hasPerm('courses.manage')
        },
        {
          label: 'الامتحانات الشهرية',
          path: '/admin/monthly-exams',
          icon: <FileText className="w-5 h-5 shrink-0" />,
          visible: hasPerm('exams.manage')
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
          visible: hasPerm('subscription_requests.manage')
        },
        {
          label: 'أكواد الشحن',
          path: '/admin/codes',
          icon: <Ticket className="w-5 h-5 shrink-0" />,
          visible: hasPerm('coupons.manage')
        },
        {
          label: 'التحليلات المالية',
          path: '/admin/financial',
          icon: <Coins className="w-5 h-5 shrink-0" />,
          visible: hasPerm('reports.view')
        },
        {
          label: 'التقارير المالية',
          path: '/admin/reports',
          icon: <BarChart3 className="w-5 h-5 shrink-0" />,
          visible: hasPerm('reports.view')
        },
        {
          label: 'مستحقات المعلمين',
          path: '/admin/payouts',
          icon: <Wallet className="w-5 h-5 shrink-0" />,
          visible: hasPerm('payouts.manage')
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
          visible: hasPerm('notifications.send')
        }
      ]
    }
  ]

  const settingsSubmenu = [
    {
      label: 'إدارة الباقات',
      path: '/admin/subscription-plans',
      icon: <Layers className="w-4 h-4 shrink-0" />,
      visible: hasPerm('subscription_plans.manage')
    },
    {
      label: 'إحصائيات Bunny',
      path: '/admin/bunny',
      icon: <Tv className="w-4 h-4 shrink-0" />,
      visible: hasPerm('bunny.view')
    },
    {
      label: 'صلاحيات المشرفين',
      path: '/admin/manage',
      icon: <ShieldAlert className="w-4 h-4 shrink-0" />,
      visible: hasPerm('admins.manage')
    },
    {
      label: 'إعدادات المنصة',
      path: '/admin/settings',
      icon: <Settings className="w-4 h-4 shrink-0" />,
      visible: hasPerm('settings.manage')
    }
  ]

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900/90 backdrop-blur-md border-l border-slate-800/80 select-none transition-all duration-300">
      {/* Sidebar Header Logo */}
      <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} px-6 h-16 border-b border-slate-800/80`}>
        {!sidebarCollapsed ? (
          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-black text-brand-primary bg-clip-text">خطوتك</span>
          </Link>
        ) : (
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
        )}
        
        {/* Collapse Button for desktop */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex items-center justify-center w-8 h-8 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[var(--text-secondary)] hover:text-brand-primary hover:border-brand-primary/30 transition-all cursor-pointer"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
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
                <span className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest block">
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
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                        active 
                          ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)]/60 border-transparent hover:border-[var(--border-color)]'
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
        {settingsSubmenu.filter(s => s.visible).length > 0 && (
          <div className="space-y-2">
            {!sidebarCollapsed && (
              <span className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest block">
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
                    <div className="mr-4 pr-3 border-r border-slate-800/80 mt-1 space-y-1 animate-slide-down">
                      {settingsSubmenu.filter(s => s.visible).map((subItem, sIdx) => {
                        const active = isRouteActive(subItem.path)
                        return (
                          <Link
                            key={sIdx}
                            to={subItem.path}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                              active 
                                ? 'text-brand-primary bg-brand-primary/10 border-brand-primary/20' 
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-color)] border-transparent'
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
                      className={`flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 border ${
                        active 
                          ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30 shadow-md' 
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)]/60 border-transparent'
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
        )}
      </div>

      {/* Logout Footer Button */}
      <div className="p-4 border-t border-slate-800/80">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-rose-500 hover:text-white hover:bg-rose-500/10 transition-all cursor-pointer ${
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

  const isRouteActive = (path: string) => {
    if (path === '/admin/dashboard') {
      return location.pathname === '/admin' || location.pathname === '/admin/dashboard'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-[var(--text-color)]" dir="rtl">
      
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
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-[999] transition-opacity duration-300"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
          />
          {/* Drawer Body */}
          <aside className="fixed top-0 right-0 w-[280px] max-w-xs h-full bg-slate-900 border-l border-slate-800 animate-slide-in-right z-[1000] flex flex-col">
            <button 
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute left-4 top-4 p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-[var(--text-secondary)] hover:text-[var(--text-color)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="h-full pt-4">
              {renderSidebarContent()}
            </div>
          </aside>
        </>
      )}

      {/* 3. Main Content Wrapper */}
      <div 
        className={`flex flex-col flex-1 w-full min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pr-20' : 'lg:pr-[280px]'
        }`}
      >
        
        {/* Top Header: Fixed height 72px */}
        <header 
          className={`sticky top-0 z-[1000] w-full flex items-center justify-between h-[72px] px-6 border-b transition-all duration-300 ${
            theme === 'light' ? 'border-b-slate-200 text-slate-900' : 'border-b-slate-800/80 text-slate-100'
          }`}
        >
          {/* Background layer for glassmorphism to avoid stacking context bugs on fixed children */}
          <div className={`absolute inset-0 backdrop-blur-md -z-10 ${
            theme === 'light' ? 'bg-white/80 shadow-sm' : 'bg-slate-950/80'
          }`}></div>
          {/* Right Side: Mobile Menu Button (Hamburger) & Page Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden flex items-center justify-center p-2 rounded-xl bg-slate-900/40 border border-slate-800/80 text-[var(--text-secondary)] hover:text-[var(--text-color)] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-black text-[var(--text-color)]">{getPageTitle()}</h1>
          </div>

          {/* Left Side: Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-900/40 hover:bg-slate-900 border border-slate-800/80 text-[var(--text-secondary)] hover:text-brand-primary hover:border-brand-primary/30 transition-all cursor-pointer"
              title={theme === 'dark' ? 'الوضع المضيء' : 'الوضع المظلم'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>

            {/* Notification Bell Dropdown wrapper */}
            <div className="relative" ref={notifRef}>
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setShowNotifDropdown(!showNotifDropdown);
                }}
                onClick={(e) => e.preventDefault()}
                className="p-2.5 rounded-xl bg-slate-900/40 hover:bg-slate-900 border border-slate-800/80 text-[var(--text-secondary)] hover:text-brand-primary hover:border-brand-primary/30 transition-all relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-rose-500 text-[9px] font-black text-white flex items-center justify-center rounded-full animate-pulse border border-slate-950">
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
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-900/40 border border-transparent hover:border-slate-800/80 transition-all cursor-pointer"
              >
                {user?.avatar ? (
                  <img src={ensureHttps(user.avatar)} alt="Avatar" className="w-8 h-8 rounded-lg object-cover border border-slate-800" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-400 font-bold flex items-center justify-center uppercase border border-indigo-500/20">
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
        <main className="flex-1 w-full p-6 sm:p-8 md:p-10 max-w-[1600px] mx-auto overflow-y-auto space-y-6">
          {isMaintenanceActive && (
            <div className="flex items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/25 text-amber-500 rounded-2xl max-h-[56px] overflow-hidden select-none text-right" dir="rtl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm text-amber-500">وضع الصيانة مفعل حالياً</span>
                  <span className="hidden sm:inline text-xs text-slate-500">|</span>
                  <span className="hidden sm:inline text-[10px] sm:text-xs text-slate-300 font-light">يمكنك متابعة إدارة المنصة بينما الطلاب والمعلمون لا يمكنهم استخدامها.</span>
                </div>
              </div>
              <button
                onClick={handleDisableMaintenance}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[10px] font-black rounded-lg transition-all cursor-pointer shrink-0"
              >
                إلغاء التفعيل
              </button>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Global Notifications Popups */}
      <NotificationToast />
    </div>
  )
}
