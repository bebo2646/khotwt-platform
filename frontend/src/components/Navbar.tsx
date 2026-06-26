import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { Sun, Moon, LogOut, Menu, X, Wallet, User as UserIcon, BookOpen, Settings, Bell, Check, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import API from '../services/api'

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

  const isAdmin = isLoggedIn && user && (user.role === 'admin');
  const linksCollapseClass = isAdmin ? 'hidden 2xl:flex' : 'hidden lg:flex';
  const mobileToggleCollapseClass = isAdmin ? 'flex 2xl:hidden' : 'flex lg:hidden';
  const authCollapseClass = isAdmin ? 'hidden 2xl:flex' : 'hidden lg:flex';
  const mobileMenuCollapseClass = isAdmin ? '2xl:hidden' : 'lg:hidden';
  const notifDropdownClass = isAdmin
    ? 'fixed 2xl:absolute top-16 2xl:top-auto left-4 right-4 2xl:left-auto 2xl:right-0 mt-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[99] text-right backdrop-blur-lg transition-all duration-300 2xl:w-[380px]'
    : 'fixed lg:absolute top-16 lg:top-auto left-4 right-4 lg:left-auto lg:right-0 mt-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[99] text-right backdrop-blur-lg transition-all duration-300 lg:w-[380px]';

  // Notifications States & Logic
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [notifications, setNotifications] = React.useState<any[]>([])
  const [showNotifDropdown, setShowNotifDropdown] = React.useState(false)
  const [activeImportant, setActiveImportant] = React.useState<any>(null)
  const notifRef = React.useRef<HTMLDivElement>(null)
  const dismissedNotifsRef = React.useRef<number[]>([])

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

  const fetchNotifications = async () => {
    if (!isLoggedIn || user?.must_change_password) return
    try {
      const countRes = await API.get('/notifications/unread-count')
      setUnreadCount(countRes.data.unread_count)

      const notifRes = await API.get('/notifications')
      setNotifications(notifRes.data.slice(0, 5))

      // Check for first unseen important notification to display as popup
      const importantUnseen = notifRes.data.find(
        (n: any) => n.important && n.is_seen != true && !dismissedNotifsRef.current.includes(n.id)
      )
      if (importantUnseen) {
        setActiveImportant(importantUnseen)
        
        // Mark as seen immediately in DB so it never pops up again
        API.post(`/notifications/${importantUnseen.id}/seen`).catch(err => 
          console.error('Failed to auto-seen notification:', err)
        )
        
        // Also add to local session dismissed ref to prevent duplicate triggers before polling/state updates complete
        dismissedNotifsRef.current.push(importantUnseen.id)
        
        // Update local state list immediately so the UI reflects the seen status
        setNotifications(prev => prev.map(item => item.id === importantUnseen.id ? { ...item, is_seen: true } : item))
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err)
    }
  }

  const handleDismissImportant = async (markRead: boolean) => {
    if (!activeImportant) return
    const notifId = activeImportant.id
    
    // Add to session dismissed list immediately
    dismissedNotifsRef.current.push(notifId)
    setActiveImportant(null)
    
    try {
      // Always mark as seen in the database so it never shows again
      await API.post(`/notifications/${notifId}/seen`)
      
      // Update local notifications list
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_seen: true } : n))

      if (markRead) {
        await API.post(`/notifications/${notifId}/read`)
        setUnreadCount(prev => Math.max(0, prev - 1))
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n))
      }
    } catch (err) {
      console.error('Failed to dismiss important notification', err)
    }
  }

  React.useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [isLoggedIn])

  const handleMarkAsRead = async (id: number) => {
    try {
      await API.post(`/notifications/${id}/read`)
      setUnreadCount(prev => Math.max(0, prev - 1))
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await API.post('/notifications/read-all')
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error(err)
    }
  }

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
          <Link to="/" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">الرئيسية</Link>
          <Link to="/courses" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">الكورسات</Link>
          <Link to="/teachers" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">المعلمون</Link>
        </>
      )
    }

    if (user.role === 'admin') {
      const isSuper = !!user.is_super_admin || !!user.is_super;
      const hasPerm = (perm: string) => isSuper || (!!user.permissions && user.permissions.includes(perm));

      return (
        <>
          <Link to="/admin/dashboard" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">الرئيسية</Link>
          {hasPerm('teachers.manage') && (
            <Link to="/admin/teachers" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">المعلمون</Link>
          )}
          {hasPerm('students.manage') && (
            <Link to="/admin/students" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">الطلاب</Link>
          )}
          {hasPerm('courses.manage') && (
            <Link to="/admin/courses" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">الكورسات</Link>
          )}
          {hasPerm('coupons.manage') && (
            <Link to="/admin/codes" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">أكواد الشحن</Link>
          )}
          {hasPerm('reports.view') && (
            <Link to="/admin/reports" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">التقارير</Link>
          )}
          <Link to="/admin/notifications" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">إرسال الإشعارات</Link>

          <Link to="/admin/subscriptions/requests" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">طلبات الاشتراكات</Link>
          <Link to="/admin/subscription-plans" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">إدارة الباقات</Link>
          <Link to="/admin/bunny" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">إحصائيات Bunny</Link>
          {hasPerm('admins.manage') && (
            
            <Link to="/admin/manage" className="hover:text-brand-primary font-bold text-xs xl:text-sm text-amber-500 transition-colors whitespace-nowrap shrink-0">الصلاحيات</Link>

          )}
        </>
      )
    }

    if (user.role === 'teacher') {
      return (
        <>
          <Link to="/teacher/dashboard" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">الرئيسية</Link>
          <Link to="/teacher/courses" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">كورساتي</Link>
          <Link to="/teacher/students" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">الطلاب</Link>
          <Link to="/teacher/revenue" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">تقرير الأرباح</Link>
          <Link to="/teacher/subscription" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">اشتراكي</Link>
          <Link to="/teacher/videos" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">إدارة الفيديوهات</Link>
          <Link to="/change-password" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">الملف الشخصي</Link>
        </>
      )
    }

    // Default Student role
    return (
      <>
        <Link to="/student/dashboard" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">الرئيسية</Link>
        <Link to="/student/courses" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">كورساتي</Link>
        <Link to="/student/wallet" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">المحفظة</Link>
        <Link to="/student/profile" className="hover:text-brand-primary font-semibold text-xs xl:text-sm transition-colors whitespace-nowrap shrink-0">الملف الشخصي</Link>
      </>
    )
  }

  return (
    <nav className="sticky top-0 z-50 glass border-b border-[var(--border-color)] transition-colors duration-300 w-full max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between h-16 w-full min-w-0">
          
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
          <div className={`${linksCollapseClass} flex-row flex-nowrap items-center justify-center gap-4 xl:gap-6 2xl:gap-8 py-1 mx-6 flex-1 min-w-0`}>
            {renderNavLinks()}
          </div>

          {/* User Controls & Mobile Toggle */}
          <div className="flex items-center gap-4 lg:gap-5 shrink-0">
            
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
                  <div 
                    className={notifDropdownClass}
                    style={{
                      maxHeight: '70vh',
                      overflowY: 'auto',
                      wordBreak: 'break-word'
                    }}
                  >
                    <div className="flex justify-between items-center pb-2.5 border-b border-[var(--border-color)] mb-3">
                      <span className="text-xs font-black text-[var(--text-color)]">آخر التنبيهات والرسائل</span>
                      {unreadCount > 0 && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAllAsRead();
                          }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer font-bold"
                        >
                          تحديد الكل كمقروء
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-xs text-[var(--text-secondary)]">لا توجد إشعارات جديدة حالياً.</div>
                    ) : (
                      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                        {notifications.map(n => {
                          const nType = getNotificationType(n.title, n.message);
                          
                          // Style based on notification type
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
                          }[nType];

                          return (
                            <div 
                              key={n.id} 
                              onClick={() => {
                                handleMarkAsRead(n.id);
                                setShowNotifDropdown(false);
                                
                                // Dynamic navigation based on content keywords
                                const text = (n.title + ' ' + n.message).toLowerCase();
                                if (user?.role === 'teacher') {
                                  if (text.includes('اشتراك') || text.includes('باقة') || text.includes('ترقية') || text.includes('شحن') || text.includes('مساحة')) {
                                    navigate('/teacher/subscription');
                                  } else {
                                    navigate('/teacher/dashboard');
                                  }
                                } else if (user?.role === 'student') {
                                  if (text.includes('محفظة') || text.includes('شحن') || text.includes('رصيد')) {
                                    navigate('/student/wallet');
                                  } else {
                                    navigate('/student/courses');
                                  }
                                } else if (user?.role === 'admin') {
                                  if (text.includes('معلم') || text.includes('اشتراك')) {
                                    navigate('/admin/teachers');
                                  } else {
                                    navigate('/admin/dashboard');
                                  }
                                }
                              }}
                              className={`p-3 rounded-2xl border text-right cursor-pointer transition-all duration-200 flex gap-3 items-start relative group hover:scale-[1.01] ${
                                n.is_read 
                                  ? 'bg-[var(--bg-color)]/20 border-[var(--border-color)] text-[var(--text-secondary)]' 
                                  : 'bg-indigo-500/5 border-indigo-500/15 text-[var(--text-color)] font-bold shadow-sm shadow-indigo-500/5'
                              }`}
                            >
                              <div className={`p-2 rounded-xl border shrink-0 ${typeStyles.bg}`}>
                                {typeStyles.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2 mb-0.5">
                                  <span className="text-[11px] font-black whitespace-normal break-words">{n.title}</span>
                                  {!n.is_read && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1" />
                                  )}
                                </div>
                                <p className="text-[10px] text-[var(--text-secondary)] font-normal leading-relaxed whitespace-normal break-words">{n.message}</p>
                                <span className="text-[8px] text-[var(--text-secondary)] font-light mt-1 block">
                                  {new Date(n.created_at).toLocaleDateString('ar-EG', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
            <div className={`${authCollapseClass} items-center gap-3`}>
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
            <div className={`${mobileToggleCollapseClass}`}>
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
        <div className={`${mobileMenuCollapseClass} glass border-b border-[var(--border-color)] px-4 pt-2 pb-4 space-y-3 max-h-[calc(100vh-4.5rem)] overflow-y-auto`}>
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

      {/* Important Notification Modal Popup */}
      {activeImportant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-right" dir="rtl">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            {/* Modal Icon and Header */}
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 animate-pulse">
                <Bell className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] bg-indigo-500 text-white font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    إعلان هام منصة خطواتك
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {new Date(activeImportant.created_at).toLocaleString('ar-EG')}
                  </span>
                </div>
                <h3 className="text-sm font-black text-[var(--text-color)] mt-2">{activeImportant.title}</h3>
              </div>
            </div>

            {/* Modal Message */}
            <div className="bg-[var(--bg-color)]/40 border border-[var(--border-color)] p-4 rounded-2xl mb-6 max-h-[200px] overflow-y-auto">
              <p className="text-xs font-semibold text-[var(--text-color)]/90 leading-relaxed whitespace-pre-wrap">
                {activeImportant.message}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleDismissImportant(false)}
                className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer"
              >
                إغلاق
              </button>
              <button
                onClick={() => handleDismissImportant(true)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl active:scale-95 transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/15"
              >
                <CheckCircle className="w-4 h-4" />
                تحديد كمقروء
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
