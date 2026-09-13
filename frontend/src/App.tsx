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
import TeacherActivityTracker from './components/TeacherActivityTracker'
import { NotificationProvider } from './context/NotificationContext'
import { AdminLayout } from './components/AdminLayout'
import { NotificationToast } from './components/NotificationToast'
import { ThemeProvider } from './context/ThemeContext'
import { useConfigStore } from './store/configStore'
import ErrorBoundary from './components/ErrorBoundary'


// Public Pages (Lazy Loaded)
const Home = React.lazy(() => import('./pages/Home'))
const Login = React.lazy(() => import('./pages/Login'))
const Register = React.lazy(() => import('./pages/Register'))
const Courses = React.lazy(() => import('./pages/Courses'))
const CourseDetail = React.lazy(() => import('./pages/CourseDetail'))
const MonthlyExams = React.lazy(() => import('./pages/MonthlyExams'))
const Departments = React.lazy(() => import('./pages/Departments'))
const DepartmentDetail = React.lazy(() => import('./pages/DepartmentDetail'))
const Teachers = React.lazy(() => import('./pages/Teachers'))
const TeacherProfile = React.lazy(() => import('./pages/TeacherProfile'))
const ChangePassword = React.lazy(() => import('./pages/ChangePassword'))
const NotFound = React.lazy(() => import('./pages/NotFound'))
const ServerError = React.lazy(() => import('./pages/ServerError'))
const Maintenance = React.lazy(() => import('./pages/Maintenance'))
const PendingApproval = React.lazy(() => import('./pages/PendingApproval'))
const RejectedAccount = React.lazy(() => import('./pages/RejectedAccount'))

// Student Pages (Lazy Loaded)
const StudentDashboard = React.lazy(() => import('./pages/student/Dashboard'))
const EnrolledCourses = React.lazy(() => import('./pages/student/EnrolledCourses'))
const WalletPage = React.lazy(() => import('./pages/student/WalletPage'))
const ExamResults = React.lazy(() => import('./pages/student/ExamResults'))
const MonthlyExamResults = React.lazy(() => import('./pages/student/MonthlyExamResults'))
const LessonViewer = React.lazy(() => import('./pages/student/LessonViewer'))
const ExamPlayer = React.lazy(() => import('./pages/student/ExamPlayer'))
const MonthlyExamPlayer = React.lazy(() => import('./pages/student/MonthlyExamPlayer'))
const ProfileDashboard = React.lazy(() => import('./pages/student/ProfileDashboard'))
const PdfViewerPage = React.lazy(() => import('./pages/student/PdfViewerPage'))

// Teacher Pages (Lazy Loaded)
const TeacherDashboard = React.lazy(() => import('./pages/teacher/Dashboard'))
const ManageCourses = React.lazy(() => import('./pages/teacher/ManageCourses'))
const StudentsList = React.lazy(() => import('./pages/teacher/StudentsList'))
const ExamsManager = React.lazy(() => import('./pages/teacher/ExamsManager'))
const ExamBuilder = React.lazy(() => import('./pages/teacher/ExamBuilder'))
const RevenueReport = React.lazy(() => import('./pages/teacher/RevenueReport'))
const TeacherSubscriptionPage = React.lazy(() => import('./pages/teacher/Subscription'))
const TeacherPlansPage = React.lazy(() => import('./pages/teacher/Plans'))
const TeacherVideosManager = React.lazy(() => import('./pages/teacher/VideosManager'))
const ManageBundles = React.lazy(() => import('./pages/teacher/ManageBundles'))

// Admin Pages (Lazy Loaded)
const AdminDashboard = React.lazy(() => import('./pages/admin/Dashboard'))
const AdminTeachersList = React.lazy(() => import('./pages/admin/TeachersList'))
const AdminCreateTeacher = React.lazy(() => import('./pages/admin/CreateTeacher'))
const AdminStudentsList = React.lazy(() => import('./pages/admin/StudentsList'))
const StudentActivity = React.lazy(() => import('./pages/admin/StudentActivity'))
const TeacherActivity = React.lazy(() => import('./pages/admin/TeacherActivity'))
const AdminCoursesList = React.lazy(() => import('./pages/admin/CoursesList'))
const MonthlyExamsManagement = React.lazy(() => import('./pages/admin/MonthlyExamsManagement'))
const PurchaseCodes = React.lazy(() => import('./pages/admin/PurchaseCodes'))
const ReportsPage = React.lazy(() => import('./pages/admin/ReportsPage'))
const AdminFinancialAnalytics = React.lazy(() => import('./pages/admin/FinancialAnalytics'))
const AdminManagement = React.lazy(() => import('./pages/admin/AdminManagement'))
const AdminTeacherSubscription = React.lazy(() => import('./pages/admin/TeacherSubscription'))
const AdminNotifications = React.lazy(() => import('./pages/admin/Notifications'))
const AdminSubscriptionRequests = React.lazy(() => import('./pages/admin/SubscriptionRequests'))
const AdminSubscriptionPlans = React.lazy(() => import('./pages/admin/SubscriptionPlans'))
const AdminBunnyDashboard = React.lazy(() => import('./pages/admin/BunnyDashboard'))
const AdminPayouts = React.lazy(() => import('./pages/admin/Payouts'))
const PendingStudents = React.lazy(() => import('./pages/admin/PendingStudents'))
const PlatformSettings = React.lazy(() => import('./pages/admin/PlatformSettings'))
const AdminTaxonomyManagement = React.lazy(() => import('./pages/admin/TaxonomyManagement'))
const AdminSecurityMonitoring = React.lazy(() => import('./pages/admin/SecurityMonitoring'))

// Main Layout Wrapper
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen w-full pt-[72px]">
      <Navbar />
      <main className="flex-grow w-full">
        {children}
      </main>
      <Footer />
      <NotificationToast />
    </div>
  )
}

function App() {
  const initTheme = useThemeStore((state) => state.initTheme)
  const navigateRef = React.useRef<any>(null)
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn)
  const user = useAuthStore((state) => state.user)
  const [isMaintenanceOn, setIsMaintenanceOn] = React.useState(false)

  const handleDisableMaintenance = async () => {
    try {
      await API.post('/admin/maintenance-settings', {
        maintenance_mode: false,
        maintenance_message: '',
        maintenance_eta: ''
      })
      setIsMaintenanceOn(false)
      useModalStore.getState().showToast('تم إلغاء تفعيل وضع الصيانة بنجاح.', 'success')
      window.location.reload()
    } catch (err) {
      console.error('Error disabling maintenance from banner', err)
      useModalStore.getState().showToast('فشل إلغاء تفعيل وضع الصيانة.', 'error')
    }
  }

  // Maintenance check & client kick-out (run once on load/auth change)
  React.useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const data = await useConfigStore.getState().fetchConfig()
        const isMaint = !!data?.maintenance

        if (isMaint) {
          const currentUser = useAuthStore.getState().user
          if (currentUser && !currentUser.is_super_admin && !currentUser.is_super) {
            sessionStorage.setItem('maintenance_message', data.maintenance_message || '')
            sessionStorage.setItem('maintenance_eta', data.maintenance_eta || '')
            useAuthStore.getState().logout()
            window.location.href = '/maintenance'
          }
        }
      } catch (err) {
        console.error('Error in App global maintenance check', err)
      }
    }

    checkMaintenance()
  }, [])

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

  // Student presence heartbeat (every 90s + throttled on focus)
  React.useEffect(() => {
    if (!isLoggedIn || user?.role !== 'student') return

    let lastSent = 0
    const sendHeartbeat = () => {
      const now = Date.now()
      // Throttle: don't send if sent within the last 45 seconds
      if (now - lastSent < 45000) return
      lastSent = now
      API.post('/student/activity/heartbeat', {}).catch(() => {})
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 90000)
    window.addEventListener('focus', sendHeartbeat)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', sendHeartbeat)
    }
  }, [isLoggedIn, user?.role])

  // Handle orientation change and resize events to prevent height/layout bugs (e.g. vh bugs on iOS)
  React.useEffect(() => {
    const handleViewportChange = () => {
      // 1. Recalculate 1vh height helper to bypass iOS Safari vh address bar bug
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);

      // 2. Set custom attribute to let CSS know current orientation if needed
      const isLandscape = window.innerWidth > window.innerHeight;
      document.documentElement.setAttribute('data-orientation', isLandscape ? 'landscape' : 'portrait');
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    
    // Initial call
    handleViewportChange();

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, []);

  // One-time reset / clear of stale packages and subscription plans caches
  React.useEffect(() => {
    localStorage.removeItem('packages');
    localStorage.removeItem('subscription-packages');
    localStorage.removeItem('subscription-plans');
    sessionStorage.clear();
  }, []);

  // Check session state (heartbeat) every 10 minutes while logged in
  React.useEffect(() => {
    let intervalId: any = null

    if (isLoggedIn) {
      intervalId = setInterval(async () => {
        if (document.hidden) return // Skip heartbeat if tab is hidden
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
      }, 600000) // 10 minutes
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isLoggedIn])

  return (
    <Router>
      <ThemeProvider>
        <NotificationProvider>
          <AnalyticsTracker />
          <RobotsTracker />
          <TeacherActivityTracker />
          <ModalProvider />
      <React.Suspense fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-brand-primary">
          <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <ErrorBoundary>
        <Routes>
        
        {/* ==========================================================================
            Public Scope Routes
            ========================================================================== */}
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/login" element={<Layout><Login /></Layout>} />
        <Route path="/register" element={<Layout><Register /></Layout>} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/rejected-account" element={<RejectedAccount />} />
        <Route path="/courses" element={<Layout><Courses /></Layout>} />
        <Route path="/course/:id" element={<Layout><CourseDetail /></Layout>} />
        <Route path="/courses/:id" element={<Layout><CourseDetail /></Layout>} />
        <Route path="/departments" element={<Layout><Departments /></Layout>} />
        <Route path="/departments/:slug" element={<Layout><DepartmentDetail /></Layout>} />
        <Route path="/exams" element={<Layout><MonthlyExams /></Layout>} />
        <Route path="/monthly-exams" element={<Layout><MonthlyExams /></Layout>} />
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
        <Route path="/monthly-exams/:id/player" element={
          <ProtectedRoute allowedRoles={['student']}>
            <MonthlyExamPlayer />
          </ProtectedRoute>
        } />
        <Route path="/monthly-exams/:id/results" element={
          <ProtectedRoute allowedRoles={['student']}>
            <Layout><MonthlyExamResults /></Layout>
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
        <Route path="/student/pdf/:pdfId" element={
          <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
            <PdfViewerPage />
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
        <Route path="/teacher/bundles" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><ManageBundles /></Layout>
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
        <Route path="/teacher/monthly-exams" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><MonthlyExamsManagement /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/teacher/videos" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Layout><TeacherVideosManager /></Layout>
          </ProtectedRoute>
        } />

        {/* ==========================================================================
            Admin Protected Scope Routes
            ========================================================================== */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="dashboard.view">
            <AdminLayout><AdminDashboard /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/dashboard" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="dashboard.view">
            <AdminLayout><AdminDashboard /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/teachers" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="teachers.manage">
            <AdminLayout><AdminTeachersList /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/teachers/create" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="teachers.manage">
            <AdminLayout><AdminCreateTeacher /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/teachers/:id/subscription" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="teacher_subscriptions.manage">
            <AdminLayout><AdminTeacherSubscription /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/notifications" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="notifications.send">
            <AdminLayout><AdminNotifications /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/subscriptions/requests" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="subscription_requests.manage">
            <AdminLayout><AdminSubscriptionRequests /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/subscription-plans" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="subscription_plans.manage">
            <AdminLayout><AdminSubscriptionPlans /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/payouts" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="payouts.manage">
            <AdminLayout><AdminPayouts /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/students" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="students.manage">
            <AdminLayout><AdminStudentsList /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/student-activity" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="student_activity.view,students.manage">
            <AdminLayout><StudentActivity /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/teacher-activity" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="teacher_activity.view,teachers.manage">
            <AdminLayout><TeacherActivity /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/security" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="admins.manage">
            <AdminLayout><AdminSecurityMonitoring /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/courses" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="courses.manage">
            <AdminLayout><AdminCoursesList /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/monthly-exams" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="exams.manage">
            <AdminLayout><MonthlyExamsManagement /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/codes" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="coupons.manage">
            <AdminLayout><PurchaseCodes /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/reports" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="reports.view">
            <AdminLayout><ReportsPage /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/financial" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="reports.view">
            <AdminLayout><AdminFinancialAnalytics /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/bunny" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="bunny.view">
            <AdminLayout><AdminBunnyDashboard /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/manage" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="admins.manage">
            <AdminLayout><AdminManagement /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/students/pending" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="students.pending">
            <AdminLayout><PendingStudents /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="settings.manage">
            <AdminLayout><PlatformSettings /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/taxonomy" element={
          <ProtectedRoute allowedRoles={['admin']} requiredPermission="settings.manage">
            <AdminLayout><AdminTaxonomyManagement /></AdminLayout>
          </ProtectedRoute>
        } />

        {/* Fallback Catch-all */}
        <Route path="/500" element={<Layout><ServerError /></Layout>} />
        <Route path="*" element={<Layout><NotFound /></Layout>} />

        </Routes>
        </ErrorBoundary>
      </React.Suspense>
      <WhatsAppButton />
      <PWAManager />
      </NotificationProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App
