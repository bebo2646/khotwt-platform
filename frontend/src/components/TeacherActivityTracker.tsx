import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import API from '../services/api'

// Helper to determine human-readable page and action from route
function getPageAndActionFromPath(pathname: string): { page: string; action: string } {
  if (pathname === '/teacher' || pathname === '/teacher/dashboard') {
    return { page: 'لوحة التحكم', action: 'استعراض لوحة الإحصائيات' }
  }
  if (pathname.startsWith('/teacher/courses')) {
    return { page: 'إدارة الكورسات', action: 'استعراض وتعديل الكورسات والمناهج' }
  }
  if (pathname.startsWith('/teacher/bundles')) {
    return { page: 'إدارة الباقات', action: 'استعراض وإدارة باقات الاشتراك' }
  }
  if (pathname.startsWith('/teacher/students')) {
    return { page: 'قائمة الطلاب', action: 'متابعة سجلات وإحصائيات الطلاب' }
  }
  if (pathname.startsWith('/teacher/exams/create')) {
    return { page: 'منشئ الاختبارات', action: 'يقوم بإنشاء وتجهيز اختبار جديد' }
  }
  if (pathname.includes('/teacher/exams/edit')) {
    return { page: 'منشئ الاختبارات', action: 'يقوم بتعديل بيانات وأسئلة الاختبار' }
  }
  if (pathname.startsWith('/teacher/exams')) {
    return { page: 'بنك الامتحانات', action: 'استعراض وتجهيز الامتحانات' }
  }
  if (pathname.startsWith('/teacher/monthly-exams')) {
    return { page: 'الامتحانات الشهرية', action: 'إدارة وتصحيح الامتحانات الشهرية' }
  }
  if (pathname.startsWith('/teacher/videos')) {
    return { page: 'مكتبة الفيديوهات', action: 'رفع وإدارة الفيديوهات التعليمية' }
  }
  if (pathname.startsWith('/teacher/revenue')) {
    return { page: 'التقارير المالية', action: 'استعراض تقارير الأرباح والمبيعات' }
  }
  if (pathname.startsWith('/teacher/subscription') || pathname.startsWith('/teacher/plans')) {
    return { page: 'الاشتراك والباقات', action: 'متابعة تفاصيل خطة المعلم' }
  }
  return {
    page: document.title && !document.title.includes('Khotwa') ? document.title : 'لوحة المعلم',
    action: 'تصفح المنصة',
  }
}

/**
 * Global helper to allow any teacher page component to emit real-time action status.
 * e.g. reportTeacherActivity('يقوم برفع فيديو: المحاضرة الثالثة', 'إدارة الكورسات')
 */
export function reportTeacherActivity(action: string, page?: string) {
  try {
    window.dispatchEvent(
      new CustomEvent('elm_teacher_action', {
        detail: { action, page },
      })
    )
  } catch {
    // Ignore in non-browser environments
  }
}

// Attach to window for easy debugging or direct calls
if (typeof window !== 'undefined') {
  ;(window as any).reportTeacherActivity = reportTeacherActivity
}

export default function TeacherActivityTracker() {
  const location = useLocation()
  const { isLoggedIn, user } = useAuthStore()

  const currentActionRef = useRef<string>('في لوحة التحكم')
  const currentPageRef = useRef<string>('لوحة التحكم')
  const lastSentRef = useRef<number>(0)

  // Send heartbeat function
  const sendHeartbeat = (force = false, actionOverride?: string, pageOverride?: string) => {
    if (!isLoggedIn || user?.role !== 'teacher') return

    const now = Date.now()
    // Throttle: don't send if sent within the last 15 seconds unless forced
    if (!force && now - lastSentRef.current < 15000) return
    lastSentRef.current = now

    const action = actionOverride || currentActionRef.current
    const page = pageOverride || currentPageRef.current

    API.post('/teacher/activity/heartbeat', {
      current_page: page,
      current_action: action,
    }).catch(() => {
      // Fail silently to never interrupt user interaction
    })
  }

  // 1. Listen for route changes
  useEffect(() => {
    if (!isLoggedIn || user?.role !== 'teacher') return

    const { page, action } = getPageAndActionFromPath(location.pathname)
    currentPageRef.current = page
    currentActionRef.current = action

    sendHeartbeat(false)
  }, [location.pathname, isLoggedIn, user?.role])

  // 2. Listen for custom specific action dispatches
  useEffect(() => {
    if (!isLoggedIn || user?.role !== 'teacher') return

    const handleCustomAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string; page?: string }>
      if (customEvent.detail) {
        if (customEvent.detail.action) {
          currentActionRef.current = customEvent.detail.action
        }
        if (customEvent.detail.page) {
          currentPageRef.current = customEvent.detail.page
        }
        sendHeartbeat(true, currentActionRef.current, currentPageRef.current)
      }
    }

    window.addEventListener('elm_teacher_action', handleCustomAction)
    return () => {
      window.removeEventListener('elm_teacher_action', handleCustomAction)
    }
  }, [isLoggedIn, user?.role])

  // 3. Heartbeat interval every 60s and on window focus
  useEffect(() => {
    if (!isLoggedIn || user?.role !== 'teacher') return

    const interval = setInterval(() => {
      sendHeartbeat(false)
    }, 60000)

    const handleFocus = () => {
      sendHeartbeat(false)
    }

    window.addEventListener('focus', handleFocus)

    // Initial heartbeat on mount
    sendHeartbeat(true)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isLoggedIn, user?.role])

  return null
}
