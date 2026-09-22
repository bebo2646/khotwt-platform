import React from 'react'
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Users,
  Package,
  BarChart3,
  Video,
  Sparkles,
  KeyRound,
  Wallet,
  Layers,
} from 'lucide-react'

export interface DashboardNavItem {
  id: string
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  priority: number // 1 = highest priority (stays visible first), higher number = lower priority (moves to dropdown first)
}

/**
 * Teacher Navigation Items and Priorities:
 * Priority 1: الرئيسية - Core dashboard hub (Highest priority, stays visible)
 * Priority 2: كورساتي - Primary course management
 * Priority 3: الامتحانات الشهرية - Critical assessment and exams
 * Priority 4: الطلاب - Student roster and monitoring
 * Priority 5: الكورسات المجمعة - Course bundles
 * Priority 6: تقرير الأرباح - Revenue and earnings analytics
 * Priority 7: إدارة الفيديوهات - Video library management
 * Priority 8: اشتراكي - Teacher subscription package details
 * Priority 9: تغيير المرور - Security settings (First to overflow into profile menu)
 */
export const TEACHER_NAV_ITEMS: DashboardNavItem[] = [
  { id: 'teacher-dashboard', to: '/teacher/dashboard', label: 'الرئيسية', icon: LayoutDashboard, priority: 1 },
  { id: 'teacher-courses', to: '/teacher/courses', label: 'كورساتي', icon: BookOpen, priority: 2 },
  { id: 'teacher-bundles', to: '/teacher/bundles', label: 'الكورسات المجمعة', icon: Package, priority: 5 },
  { id: 'teacher-monthly-exams', to: '/teacher/monthly-exams', label: 'الامتحانات الشهرية', icon: ClipboardList, priority: 3 },
  { id: 'teacher-students', to: '/teacher/students', label: 'الطلاب', icon: Users, priority: 4 },
  { id: 'teacher-revenue', to: '/teacher/revenue', label: 'تقرير الأرباح', icon: BarChart3, priority: 6 },
  { id: 'teacher-subscription', to: '/teacher/subscription', label: 'اشتراكي', icon: Sparkles, priority: 8 },
  { id: 'teacher-videos', to: '/teacher/videos', label: 'إدارة الفيديوهات', icon: Video, priority: 7 },
  { id: 'teacher-password', to: '/change-password', label: 'تغيير المرور', icon: KeyRound, priority: 9 },
]

/**
 * Student Navigation Items and Priorities:
 * Priority 1: الرئيسية - Student home / dashboard
 * Priority 2: كورساتي - My enrolled courses
 * Priority 3: الامتحانات - Available exams and tests
 * Priority 4: المحفظة - Wallet & balance
 * Priority 5: الأقسام - Course departments / browsing (First to overflow into profile menu)
 */
export const STUDENT_NAV_ITEMS: DashboardNavItem[] = [
  { id: 'student-dashboard', to: '/student/dashboard', label: 'الرئيسية', icon: LayoutDashboard, priority: 1 },
  { id: 'student-courses', to: '/student/courses', label: 'كورساتي', icon: BookOpen, priority: 2 },
  { id: 'student-exams', to: '/exams', label: 'الامتحانات', icon: ClipboardList, priority: 3 },
  { id: 'student-wallet', to: '/student/wallet', label: 'المحفظة', icon: Wallet, priority: 4 },
  { id: 'student-departments', to: '/departments', label: 'الأقسام', icon: Layers, priority: 5 },
]
