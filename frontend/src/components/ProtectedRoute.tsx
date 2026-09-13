import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Unauthorized from '../pages/Unauthorized'

interface ProtectedRouteProps {
  children: React.ReactElement
  allowedRoles?: ('admin' | 'teacher' | 'student')[]
  requiredPermission?: string
}

export default function ProtectedRoute({ children, allowedRoles, requiredPermission }: ProtectedRouteProps) {
  const { isLoggedIn, user } = useAuthStore()
  const location = useLocation()

  // 1. If not logged in, redirect directly to Login
  if (!isLoggedIn || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 2. Force change password check
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  // 3. Role validation check
  if (allowedRoles && !allowedRoles.includes(user.role) && !user.is_super_admin && !user.is_super) {
    return <Unauthorized />
  }

  // 4. Permission validation check
  if (requiredPermission && user.role === 'admin') {
    if (!user.is_super_admin && !user.is_super) {
      const permsToCheck = requiredPermission.split(',').map(p => p.trim());
      const userPerms = user.permissions || [];
      const hasAny = permsToCheck.some(reqPerm => {
        if (userPerms.includes(reqPerm)) return true;
        if (reqPerm.startsWith('teacher_activity.') && userPerms.includes('teachers.manage')) return true;
        if (reqPerm.startsWith('student_activity.') && userPerms.includes('students.manage')) return true;
        if (reqPerm === 'platform_presence.view' && (userPerms.includes('teachers.manage') || userPerms.includes('students.manage'))) return true;
        if (reqPerm.startsWith('monthly_exams.') && userPerms.includes('exams.manage')) return true;
        if (reqPerm.startsWith('exam_security.') && userPerms.includes('exams.manage')) return true;
        return false;
      });
      if (!hasAny) {
        return <Unauthorized requiredPermission={requiredPermission} />
      }
    }
  }

  // 5. Sub Admin dashboard redirect check
  if (user.role === 'admin' && !user.is_super_admin && !user.is_super && (location.pathname === '/admin' || location.pathname === '/admin/' || location.pathname === '/admin/dashboard' || location.pathname === '/admin/dashboard/')) {
    const hasPerm = (perm: string) => user.permissions && user.permissions.includes(perm);
    const target = hasPerm('teachers.manage') ? '/admin/teachers'
      : hasPerm('students.manage') ? '/admin/students'
      : hasPerm('courses.manage') ? '/admin/courses'
      : hasPerm('coupons.manage') ? '/admin/codes'
      : hasPerm('reports.view') ? '/admin/reports'
      : hasPerm('admins.manage') ? '/admin/manage'
      : null;

    if (target) {
      return <Navigate to={target} replace />
    }
  }

  return children
}
