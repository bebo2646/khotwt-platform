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

/**
 * Admin Navigation Items and Priorities:
 * Priority 1: الرئيسية - Admin overview dashboard (Highest priority)
 * Priority 2: المعلمون - Teacher management
 * Priority 3: الطلاب - Student management
 * Priority 4: الكورسات - Course management
 * Priority 5: الامتحانات الشهرية - Exam management
 * Priority 6: أكواد الشحن - Coupon and codes
 * Priority 7: التقارير - Financial and usage reports
 * Priority 8: إرسال الإشعارات - Notification dispatch
 * Priority 9: طلبات الاشتراكات - Teacher subscription requests
 * Priority 10: إدارة الباقات - Platform pricing plans
 * Priority 11: إحصائيات Bunny - Bunny Stream analytics
 * Priority 12: الصلاحيات - Role & admin user permissions (First to overflow)
 */
export const ADMIN_NAV_ITEMS: (DashboardNavItem & { permission?: string })[] = [
  { id: 'admin-dashboard', to: '/admin/dashboard', label: 'الرئيسية', icon: LayoutDashboard, priority: 1 },
  { id: 'admin-teachers', to: '/admin/teachers', label: 'المعلمون', icon: Users, priority: 2, permission: 'teachers.manage' },
  { id: 'admin-students', to: '/admin/students', label: 'الطلاب', icon: Users, priority: 3, permission: 'students.manage' },
  { id: 'admin-courses', to: '/admin/courses', label: 'الكورسات', icon: BookOpen, priority: 4, permission: 'courses.manage' },
  { id: 'admin-exams', to: '/admin/monthly-exams', label: 'الامتحانات الشهرية', icon: ClipboardList, priority: 5, permission: 'exams.manage' },
  { id: 'admin-codes', to: '/admin/codes', label: 'أكواد الشحن', icon: KeyRound, priority: 6, permission: 'coupons.manage' },
  { id: 'admin-reports', to: '/admin/reports', label: 'التقارير', icon: BarChart3, priority: 7, permission: 'reports.view' },
  { id: 'admin-notifications', to: '/admin/notifications', label: 'إرسال الإشعارات', icon: Sparkles, priority: 8 },
  { id: 'admin-sub-requests', to: '/admin/subscriptions/requests', label: 'طلبات الاشتراكات', icon: Package, priority: 9 },
  { id: 'admin-plans', to: '/admin/subscription-plans', label: 'إدارة الباقات', icon: Layers, priority: 10 },
  { id: 'admin-bunny', to: '/admin/bunny', label: 'إحصائيات Bunny', icon: Video, priority: 11 },
  { id: 'admin-manage', to: '/admin/manage', label: 'الصلاحيات', icon: KeyRound, priority: 12, permission: 'admins.manage' },
]
