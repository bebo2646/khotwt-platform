import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Download, RefreshCw, X, Bell } from 'lucide-react'

// Restored and verified PWA install prompt logic matching original specifications exactly
export default function PWAManager() {
  const [showSplash, setShowSplash] = useState(true)
  const [renderSplash, setRenderSplash] = useState(true)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(
    window.location.search.includes('simulate-install=true')
  )
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(
    window.location.search.includes('simulate-update=true')
  )
  const [isOffline, setIsOffline] = useState(
    !navigator.onLine || window.location.search.includes('simulate-offline=true')
  )

  // 1. Splash Screen Timer (1.5 seconds)
  useEffect(() => {
    let unmountTimer: any = null
    const timer = setTimeout(() => {
      // Keep splash active if simulating splash
      if (!window.location.search.includes('simulate-splash=true')) {
        setShowSplash(false)
        unmountTimer = setTimeout(() => {
          setRenderSplash(false)
        }, 550)
      }
    }, 1500)
    return () => {
      clearTimeout(timer)
      if (unmountTimer) clearTimeout(unmountTimer)
    }
  }, [])

  // 2. Offline Status Listener
  useEffect(() => {
    const handleOnline = () => {
      if (!window.location.search.includes('simulate-offline=true')) {
        setIsOffline(false)
      }
    }
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Scroll Lock & Cleanup Logic for Splash Screen and Offline mode
  useEffect(() => {
    if (showSplash || isOffline) {
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
  }, [showSplash, isOffline]);

  // 3. Service Worker Registration & Update Detection
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register service worker in production builds or standard dev configurations
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          setSwRegistration(reg)
          if (import.meta.env.DEV) {
            console.log('[PWA] Service Worker registered successfully')
          }

          // Architecture ready for future push notifications
          preparePushNotifications(reg)

          // Check for updates periodically
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true)
                }
              })
            }
          })
        })
        .catch((err) => {
          console.error('[PWA] Service Worker registration failed:', err)
        })

      // Reload the page when active service worker changes
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          window.location.reload()
        }
      })
    }
  }, [])

  // 4. Install Prompt Listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      
      // Show install banner if not dismissed in the current session
      const isDismissed = sessionStorage.getItem('pwa-install-dismissed')
      if (!isDismissed) {
        setShowInstallBanner(true)
      }
    }

    const handleAppInstalled = () => {
      if (import.meta.env.DEV) {
        console.log('[PWA] Application was installed successfully')
      }
      setDeferredPrompt(null)
      setShowInstallBanner(false)
      sessionStorage.setItem('pwa-install-dismissed', 'true')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // 5. Push Notifications Prep Logic
  const preparePushNotifications = (reg: ServiceWorkerRegistration) => {
    if (import.meta.env.DEV) {
      console.log('[PWA Push] Notification architecture is ready for future integration.')
    }
  }

  // Handle Install Action
  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (import.meta.env.DEV) {
      console.log(`[PWA] Install user choice outcome: ${outcome}`)
    }
    setDeferredPrompt(null)
    setShowInstallBanner(false)
  }

  // Handle Install Dismissal
  const handleInstallDismiss = () => {
    setShowInstallBanner(false)
    sessionStorage.setItem('pwa-install-dismissed', 'true')
  }

  // Handle Update Action
  const handleUpdateClick = () => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
    } else {
      window.location.reload()
    }
  }

  // Handle Offline Retry
  const handleRetryOnline = () => {
    const online = navigator.onLine
    setIsOffline(!online)
    if (online) {
      window.location.reload()
    }
  }

  return (
    <>
      {/* Splash Screen */}
      {renderSplash && (
        <div
          style={{
            pointerEvents: showSplash ? 'auto' : 'none',
            opacity: showSplash ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
          }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[var(--bg-color)] text-[var(--text-color)] select-none"
        >
          <div className="flex flex-col items-center text-center space-y-5 px-4">
            {/* Premium Glow Logo Circle */}
            <div className="relative flex items-center justify-center w-28 h-28 rounded-[2rem] bg-gradient-to-tr from-[var(--primary-color)] to-[var(--secondary-color)] shadow-[0_0_50px_rgba(99,102,241,0.4)] mb-2 overflow-hidden border border-[var(--border-color)]">
              <div className="absolute inset-0.5 rounded-[1.9rem] bg-[var(--bg-color)] flex items-center justify-center">
                <img 
                  src="/logo.png" 
                  alt="خطوتك" 
                  className="w-16 h-16 object-contain"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <h1 className="text-4xl font-black tracking-wider text-[var(--text-color)]">
                خطوتك
              </h1>
              <p className="text-[var(--text-secondary)] text-base font-medium tracking-wide">
                أول خطوة نحو النجاح
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Offline Overlay */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            key="offline-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            style={{ pointerEvents: isOffline ? 'auto' : 'none' }}
            className="fixed inset-0 z-[99998] flex flex-col items-center justify-center bg-[var(--bg-color)]/98 text-[var(--text-color)] p-6 text-center select-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 120 }}
              className="max-w-md w-full bg-[var(--card-bg)] border border-[var(--border-color)] p-8 rounded-3xl shadow-2xl flex flex-col items-center space-y-6"
            >
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
                <WifiOff className="w-10 h-10 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-[var(--text-color)]">أنت غير متصل بالإنترنت حالياً</h2>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  يرجى التحقق من اتصالك بالشبكة والضغط على زر المحاولة للعودة للمنصة.
                </p>
              </div>

              <button
                onClick={handleRetryOnline}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[var(--primary-color)] to-[var(--secondary-color)] text-white font-bold hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:brightness-110 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-5 h-5" />
                إعادة المحاولة
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && !showSplash && !isOffline && (deferredPrompt || window.location.search.includes('simulate-install=true')) && (
          <motion.div
            key="pwa-install-banner"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50, pointerEvents: 'none' }}
            style={{ pointerEvents: showInstallBanner ? 'auto' : 'none' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed bottom-[90px] left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:max-w-md z-[999] md:z-[9999] bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-3xl shadow-2xl flex flex-col gap-4 text-[var(--text-color)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 items-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--primary-color)]/10 flex items-center justify-center border border-[var(--primary-color)]/20 text-[var(--primary-color)] shrink-0">
                  <Download className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-base text-[var(--text-color)]">تثبيت تطبيق خطوتك</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-normal">
                    ثبت تطبيق خطوتك على جهازك للوصول السريع.
                  </p>
                </div>
              </div>
              <button 
                onClick={handleInstallDismiss}
                className="text-[var(--text-secondary)] hover:text-[var(--text-color)] p-1 hover:bg-[var(--border-color)] rounded-xl transition-all cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleInstallClick}
                className="flex-1 py-2.5 px-4 rounded-xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary-hover transition-all text-center cursor-pointer"
              >
                تثبيت الآن
              </button>
              <button
                onClick={handleInstallDismiss}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--border-color)] hover:brightness-110 text-[var(--text-color)] text-sm font-medium transition-all text-center cursor-pointer"
              >
                لاحقاً
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Service Worker Update Banner */}
      <AnimatePresence>
        {updateAvailable && !showSplash && !isOffline && (
          <motion.div
            key="sw-update-banner"
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, pointerEvents: 'none' }}
            style={{ pointerEvents: updateAvailable ? 'auto' : 'none' }}
            className="fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-md z-[99999] bg-[var(--card-bg)] border border-[var(--primary-color)]/40 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 text-[var(--text-color)]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--primary-color)]/10 flex items-center justify-center border border-[var(--primary-color)]/20 text-[var(--primary-color)] shrink-0">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <p className="text-sm font-bold text-[var(--text-color)]">
                يوجد تحديث جديد للتطبيق
              </p>
            </div>
            <button
              onClick={handleUpdateClick}
              className="py-1.5 px-4 rounded-xl bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white text-xs font-black transition-all shrink-0 cursor-pointer"
            >
              تحديث الآن
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
