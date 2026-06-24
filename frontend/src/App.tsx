import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import { useThemeStore } from './store/themeStore'
import { useAuthStore } from './store/authStore'
import { ModalProvider } from './components/ui/ConfirmModal'
import { useModalStore } from './store/modalStore'
import WhatsAppButton from './components/WhatsAppButton'
import PWAManager from './components/PWAManager'
import API from './services/api'
import AnalyticsTracker from './components/AnalyticsTracker'
import RobotsTracker from './components/RobotsTracker'


// Public Pages (Lazy Loaded)
const Home = React.lazy(() => import('./pages/Home'))
const Login = React.lazy(() => import('./pages/Login'))
const Register = React.lazy(() => import('./pages/Register'))
const Courses = React.lazy(() => import('./pages/Courses'))
const CourseDetail = React.lazy(() => import('./pages/CourseDetail'))
const Teachers = React.lazy(() => import('./pages/Teachers'))
const TeacherProfile = React.lazy(() => import('./pages/TeacherProfile'))
const ChangePassword = React.lazy(() => import('./pages/ChangePassword'))
const NotFound = React.lazy(() => import('./pages/NotFound'))
const ServerError = React.lazy(() => import('./pages/ServerError'))

// Student Pages (Lazy Loaded)
const StudentDashboard = React.lazy(() => import('./pages/student/Dashboard'))
const EnrolledCourses = React.lazy(() => import('./pages/student/EnrolledCourses'))
const WalletPage = React.lazy(() => import('./pages/student/WalletPage'))
const ExamResults = React.lazy(() => import('./pages/student/ExamResults'))
const LessonViewer = React.lazy(() => import('./pages/student/LessonViewer'))
const ExamPlayer = React.lazy(() => import('./pages/student/ExamPlayer'))
const ProfileDashboard = React.lazy(() => import('./pages/student/ProfileDashboard'))

// Teacher Pages (Lazy Loaded)
const TeacherDashboard = React.lazy(() => import('./pages/teacher/Dashboard'))
const ManageCourses = React.lazy(() => import('./pages/teacher/ManageCourses'))
const StudentsList = React.lazy(() => import('./pages/teacher/StudentsList'))
const ExamsManager = React.lazy(() => import('./pages/teacher/ExamsManager'))
const ExamBuilder = React.lazy(() => import('./pages/teacher/ExamBuilder'))
const RevenueReport = React.lazy(() => import('./pages/teacher/RevenueReport'))
const TeacherSubscriptionPage = React.lazy(() => import('./pages/teacher/Subscription'))
const TeacherPlansPage = React.lazy(() => import('./pages/teacher/Plans'))

// Admin Pages (Lazy Loaded)
const AdminDashboard = React.lazy(() => import('./pages/admin/Dashboard'))
const AdminTeachersList = React.lazy(() => import('./pages/admin/TeachersList'))
const AdminCreateTeacher = React.lazy(() => import('./pages/admin/CreateTeacher'))
const AdminStudentsList = React.lazy(() => import('./pages/admin/StudentsList'))
const AdminCoursesList = React.lazy(() => import('./pages/admin/CoursesList'))
const PurchaseCodes = React.lazy(() => import('./pages/admin/PurchaseCodes'))
const ReportsPage = React.lazy(() => import('./pages/admin/ReportsPage'))
const AdminManagement = React.lazy(() => import('./pages/admin/AdminManagement'))
const AdminTeacherSubscription = React.lazy(() => import('./pages/admin/TeacherSubscription'))
const AdminNotifications = React.lazy(() => import('./pages/admin/Notifications'))
const AdminSubscriptionRequests = React.lazy(() => import('./pages/admin/SubscriptionRequests'))

// Main Layout Wrapper
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  )
}

function App() {
  const initTheme = useThemeStore((state) => state.initTheme)
  const navigateRef = React.useRef<any>(null)
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn)

  React.useEffect(() => {
    // Load default theme (Dark)
    initTheme()

    // Listen for force password change events from API interceptor
    const handleForcePasswordChange = () => {
      if (window.location.pathname === '/change-password') {
        return // Already on change password page, do nothing
      }
      useModalStore.getState().showAlert({
        title: 'تنبيه أمني هام',
        description: 'يجب تغيير كلمة المرور المؤقتة الممنوحة لك للمتابعة.',
        type: 'warning',
        buttonText: 'تغيير كلمة المرور الآن',
        onConfirm: () => {
          window.location.href = '/change-password'
        }
      })
    }

    window.addEventListener('elm_must_change_password', handleForcePasswordChange)

    const handleSessionInvalid = () => {
      useAuthStore.getState().logout()
      window.location.href = '/login?session_invalid=true'
    }

    window.addEventListener('elm_session_invalid', handleSessionInvalid)

    return () => {
      window.removeEventListener('elm_must_change_password', handleForcePasswordChange)
      window.removeEventListener('elm_session_invalid', handleSessionInvalid)
    }
  }, [initTheme])

  // Poll session state every 10 seconds while logged in
  React.useEffect(() => {
    let intervalId: any = null

    if (isLoggedIn) {
      intervalId = setInterval(async () => {
        try {
          const res = await API.get('/auth/check-session')
          if (res.data && res.data.valid === false) {
            useAuthStore.getState().logout()
            window.location.href = '/login?session_invalid=true'
          }
        } catch (err: any) {
          if (err.response && err.response.status === 401) {
            useAuthStore.getState().logout()
            window.location.href = '/login?session_invalid=true'
          }
        }
      }, 10000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isLoggedIn])

  return (
    <Router>
      <AnalyticsTracker />
      <RobotsTracker />
      <ModalProvider />
      <React.Suspense fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-brand-primary">
          <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <Routes>
        
        {/* ==========================================================================
            Public Scope Routes
            ========================================================================== */}
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/login" element={<Layout><Login /></Layout>} />
        <Route path="/register" element={<Layout><Register /></Layout>} />
        <Route path="/courses" element={<Layout><Courses /></Layout>} />
        <Route path="/course/:id" element={<Layout><CourseDetail /></Layout>} />
        <Route path="/courses/:id" element={<Layout><CourseDetail /></Layout>} />
        <Route path="/teachers" element={<Layout><Teachers /></Layout>} />
        <Route path="/teacher/:id" element={<Layout><TeacherProfile /></Layout>} />
        <Route path="/teachers/:id" element={<Layout><TeacherProfile /></Layout>} />
        <Route path="/stages/:gradeId" element={<Layout><Courses /></Layout>} />
        
        {/* SEO Search Landing Pages */}
        <Route path="/subject/:subjectId" element={<Layout><Courses /></Layout>} />
        <Route path="/grade/:gradeId" element={<Layout><Courses /></Layout>} />
        <Route path="/chemistry" element={<Layout><Courses subjectDefault="chemistry" /></Layout>} />
        <Route path="/physics" element={<Layout><Courses subjectDefault="physics" /></Layout>} />
        <Route path="/arabic" element={<Layout><Courses subjectDefault="arabic" /></Layout>} />
        <Route path="/grade-1-secondary" element={<Layout><Courses gradeDefault="first_secondary" /></Layout>} />
        <Route path="/grade-2-secondary" element={<Layout><Courses gradeDefault="second_secondary" /></Layout>} />
        <Route path="/grade-3-secondary" element={<Layout><Courses gradeDefault="third_secondary" /></Layout>} />

        {/* Change Password (any auth role) */}
        <Route path="/change-password" element={
          <ProtectedRoute>
            <Layout><ChangePassword /></Layout>
          </ProtectedRoute>
        } />

        {/* ==========================================================================
            Student Protected Scope Routes
            ========================================================================== */}
        <Route path="/student/dashboard" element={
          <ProtectedRoute allowedRoles={['student']}>
            <Layout><StudentDashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/student/courses" element={
          <ProtectedRoute allowedRoles={['student']}>
            <Layout><EnrolledCourses /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/student/wallet" element={
          <ProtectedRoute allowedRoles={['student']}>
            <Layout><WalletPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/student/results" element={
          <ProtectedRoute allowedRoles={['student']}>
            <Layout><ExamResults /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/student/exams/:id/result" element={
          <ProtectedRoute allowedRoles={['student']}>
            <Layout><ExamResults /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/student/profile" element={
          <ProtectedRoute allowedRoles={['student']}>
            <Layout><ProfileDashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/student/lessons/:id" element={
          <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
            <Layout><LessonViewer /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/student/exams/:id" element={
          <ProtectedRoute allowedRoles={['student']}>
            <ExamPlayer />
          </ProtectedRoute>
        } />

        {/* ==========================================================================
            Teacher Protected Scope Routes
            ========================================================================== */}
        <Route path="/teacher" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><TeacherDashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/teacher/dashboard" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><TeacherDashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/teacher/subscription" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><TeacherSubscriptionPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/teacher/plans" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><TeacherPlansPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/teacher/courses" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><ManageCourses /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/teacher/students" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><StudentsList /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/teacher/exams" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><ExamsManager /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/teacher/exams/create" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><ExamBuilder /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/teacher/exams/edit/:id" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><ExamBuilder /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/teacher/revenue" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><RevenueReport /></Layout>
          </ProtectedRoute>
        } />

        {/* ==========================================================================
            Admin Protected Scope Routes
            ========================================================================== */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout><AdminDashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/dashboard" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout><AdminDashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/teachers" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="teachers.manage">
            <Layout><AdminTeachersList /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/teachers/create" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="teachers.manage">
            <Layout><AdminCreateTeacher /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/teachers/:id/subscription" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="teachers.manage">
            <Layout><AdminTeacherSubscription /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/notifications" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout><AdminNotifications /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/subscriptions/requests" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout><AdminSubscriptionRequests /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/students" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="students.manage">
            <Layout><AdminStudentsList /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/courses" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="courses.manage">
            <Layout><AdminCoursesList /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/codes" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="coupons.manage">
            <Layout><PurchaseCodes /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/reports" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="reports.view">
            <Layout><ReportsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/manage" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="admins.manage">
            <Layout><AdminManagement /></Layout>
          </ProtectedRoute>
        } />

        {/* Fallback Catch-all */}
        <Route path="/500" element={<Layout><ServerError /></Layout>} />
        <Route path="*" element={<Layout><NotFound /></Layout>} />

        </Routes>
      </React.Suspense>
      <WhatsAppButton />
      <PWAManager />
    </Router>
  )
}

export default App
