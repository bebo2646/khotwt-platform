<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PublicController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\TeacherController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\MonthlyExamsController;
use App\Http\Controllers\TaxonomyController;
use App\Http\Controllers\StudentActivityController;
use App\Http\Controllers\SecurityMonitoringController;

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/
Route::get('/home', [PublicController::class, 'home']);
Route::get('/public/statistics', [PublicController::class, 'statistics']);
Route::get('/teachers', [PublicController::class, 'teachers']);
Route::get('/teachers/{teacher}', [PublicController::class, 'teacherProfile']);
Route::get('/courses', [PublicController::class, 'courses']);
Route::get('/courses/{course}', [PublicController::class, 'courseDetail']);
Route::get('/packages', [PublicController::class, 'packages']);
Route::get('/monthly-exams', [MonthlyExamsController::class, 'index']);
Route::get('/monthly-exams/{id}', [MonthlyExamsController::class, 'show']);

// Platform Taxonomy (Dynamic Departments, Stages, Grades)
Route::get('/taxonomy', [TaxonomyController::class, 'getTaxonomy']);
Route::get('/departments', [TaxonomyController::class, 'getDepartments']);
Route::get('/departments/{slug}', [TaxonomyController::class, 'getDepartmentBySlug']);
Route::get('/academic-stages', [TaxonomyController::class, 'getAcademicStages']);
Route::get('/academic-grades', [TaxonomyController::class, 'getAcademicGrades']);

// Cascading Filter
Route::get('/filter/subjects', [PublicController::class, 'filterSubjects']);
Route::get('/filter/teachers', [PublicController::class, 'filterTeachers']);
Route::get('/config', [PublicController::class, 'config']);
Route::get('/debug/bunny-config', function () {
    $libraryId = config('services.bunny.library_id');
    $apiKey = config('services.bunny.api_key');
    $cdnHost = config('services.bunny.cdn_hostname');

    return response()->json([
        'configured' => !empty($libraryId) && !empty($apiKey),
        'library_id_exists' => !empty($libraryId),
        'api_key_exists' => !empty($apiKey),
        'cdn_hostname_exists' => !empty($cdnHost),
    ]);
});

// Authentication
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/auth/delete-rejected-account', [AuthController::class, 'deleteRejectedAccount']);

// Bunny Webhook
Route::post('/bunny/webhook', [\App\Http\Controllers\BunnyWebhookController::class, 'handle']);

/*
|--------------------------------------------------------------------------
| Authenticated Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'verify_session'])->group(function () {
    
    // Auth actions that ignore must_change_password restriction (like changing the password or logging out)
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/auth/check-session', [AuthController::class, 'checkSession']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::post('/upload', [UploadController::class, 'upload']);
    Route::get('/subscription-plans', [SubscriptionController::class, 'listPlansPublic']);

    // Routes that enforce must_change_password check
    Route::middleware('must_change_password')->group(function () {

        Route::get('/notifications', [SubscriptionController::class, 'getUserNotifications']);
        Route::get('/notifications/unread-count', [SubscriptionController::class, 'getUnreadCount']);
        Route::post('/notifications/{id}/read', [SubscriptionController::class, 'markNotificationAsRead']);
        Route::post('/notifications/{id}/seen', [SubscriptionController::class, 'markNotificationAsSeen']);
        Route::post('/notifications/read-all', [SubscriptionController::class, 'markAllNotificationsAsRead']);

        /*
         * Student Enrolled Scope
         */
        Route::middleware('role:student')->group(function () {
            Route::get('/student/dashboard', [StudentController::class, 'dashboard']);
            Route::get('/student/recommended-courses', [StudentController::class, 'recommendedCourses']);
            Route::get('/student/profile-stats', [StudentController::class, 'profileStats']);
            Route::get('/student/courses', [StudentController::class, 'enrolledCourses']);
            Route::get('/student/wallet', [StudentController::class, 'wallet']);
            Route::post('/wallet/redeem', [StudentController::class, 'redeemCode']);
            Route::post('/courses/{course}/subscribe', [StudentController::class, 'subscribeCourse']);
            Route::post('/packages/{package}/subscribe', [StudentController::class, 'subscribePackage']);
            Route::post('/lessons/{lesson}/subscribe', [StudentController::class, 'subscribeLesson']);
            Route::get('/student/lessons/{lesson}', [StudentController::class, 'lessonDetail']);
            Route::get('/student/courses/{course}/lessons/{lesson}', [StudentController::class, 'lessonDetailInCourse']);
            Route::get('/student/packages/{package}/lessons/{lesson}', [StudentController::class, 'lessonDetailInPackage']);
            Route::post('/videos/{video}/progress', [StudentController::class, 'updateVideoProgress']);
            Route::post('/pdfs/{pdf}/view', [StudentController::class, 'viewPdf']);
            Route::get('/student/pdfs/{pdf}', [StudentController::class, 'getPdfDetails']);
            Route::get('/exams/{exam}', [StudentController::class, 'startExam']);
            Route::get('/exams/{exam}/check-availability', [StudentController::class, 'checkAvailability']);
            Route::post('/exams/{exam}/submit', [StudentController::class, 'submitExam']);
            Route::post('/exams/{exam}/save-draft', [StudentController::class, 'saveDraftExam']);
            Route::post('/exams/{exam}/log-violation', [StudentController::class, 'logViolation']);
            Route::post('/exams/{exam}/purchase', [StudentController::class, 'purchaseExam']);
            Route::get('/student/results', [StudentController::class, 'examResults']);
            Route::post('/student/profile/update', [StudentController::class, 'updateProfile']);

            // Standalone Monthly Exams Student Actions
            Route::post('/monthly-exams/{id}/purchase', [MonthlyExamsController::class, 'purchase']);
            Route::post('/monthly-exams/{id}/start', [MonthlyExamsController::class, 'start']);
            Route::post('/monthly-exams/{id}/save-draft', [MonthlyExamsController::class, 'saveDraft']);
            Route::post('/monthly-exams/{id}/log-violation', [MonthlyExamsController::class, 'logViolation']);
            Route::post('/monthly-exams/{id}/submit', [MonthlyExamsController::class, 'submit']);
            Route::get('/monthly-exams/{id}/results', [MonthlyExamsController::class, 'results']);

            // Student Activity & Presence Heartbeat
            Route::post('/student/activity/heartbeat', [StudentActivityController::class, 'heartbeat']);
            Route::post('/student/heartbeat', [StudentActivityController::class, 'heartbeat']);
            Route::post('/student/activity/log', [StudentActivityController::class, 'logClientActivity']);
        });

        /*
         * Teacher Dashboard Scope
         */
        Route::middleware('role:teacher')->group(function () {
            Route::get('/teacher/dashboard', [TeacherController::class, 'dashboard']);
            Route::post('/teacher/profile/update', [TeacherController::class, 'updateProfile']);
            Route::get('/teacher/revenue-report', [TeacherController::class, 'revenueReport']);
            Route::get('/teacher/courses', [TeacherController::class, 'courses']);
            Route::get('/teacher/exams', [TeacherController::class, 'listExams']);
            Route::get('/teacher/exams/{exam}', [TeacherController::class, 'getExam']);
            Route::get('/teacher/exams/{exam}/attempts', [TeacherController::class, 'examAttempts']);
            Route::get('/teacher/exams/{exam}/report', [TeacherController::class, 'examReport']);
            Route::get('/teacher/monthly-exams', [MonthlyExamsController::class, 'adminList']);
            Route::get('/teacher/monthly-exams/{id}', [MonthlyExamsController::class, 'adminShow']);
            Route::post('/teacher/monthly-exams', [MonthlyExamsController::class, 'adminStore']);
            Route::put('/teacher/monthly-exams/{id}', [MonthlyExamsController::class, 'adminUpdate']);
            Route::delete('/teacher/monthly-exams/{id}', [MonthlyExamsController::class, 'adminDestroy']);
            Route::post('/teacher/monthly-exams/attempts/{attemptId}/unlock-answers', [MonthlyExamsController::class, 'unlockAnswers']);
            Route::get('/teacher/students', [TeacherController::class, 'students']);
            Route::get('/teacher/students/{student}/analytics', [TeacherController::class, 'studentAnalytics']);

            // Teacher Subscription routes (always accessible)
            Route::get('/teacher/subscription', [SubscriptionController::class, 'getTeacherSubscriptionSelf']);
            Route::post('/teacher/subscription/upgrade-request', [SubscriptionController::class, 'requestUpgradeSelf']);
            Route::get('/teacher/activation-code-packages', [SubscriptionController::class, 'listActivationCodePackagesPublic']);
            Route::get('/teacher/storage-packages', [SubscriptionController::class, 'listStoragePackagesPublic']);
            Route::get('/teacher/storage', [TeacherController::class, 'getStorageStats']);
            Route::get('/teacher/videos', [TeacherController::class, 'listVideos']);
            Route::get('/teacher/student-course-limits', [TeacherController::class, 'getStudentCourseLimits']);

            // Content creation / uploads protected by active subscription
            Route::middleware('subscription.active')->group(function () {
                Route::post('/teacher/courses', [TeacherController::class, 'createCourse']);
                Route::put('/teacher/courses/{course}', [TeacherController::class, 'updateCourse']);
                Route::delete('/teacher/courses/{course}', [TeacherController::class, 'deleteCourse']);
                Route::post('/teacher/courses/{course}/link-courses', [TeacherController::class, 'linkBundleCourses']);
                Route::post('/teacher/courses/{course}/units', [TeacherController::class, 'addUnit']);
                Route::put('/teacher/units/{unit}', [TeacherController::class, 'updateUnit']);
                Route::delete('/teacher/units/{unit}', [TeacherController::class, 'deleteUnit']);
                Route::put('/teacher/courses/{course}/units/{unit}', [TeacherController::class, 'updateUnit']);
                Route::delete('/teacher/courses/{course}/units/{unit}', [TeacherController::class, 'deleteUnit']);
                Route::post('/teacher/units/{unit}/lessons', [TeacherController::class, 'addLesson']);
                Route::put('/teacher/lessons/{lesson}', [TeacherController::class, 'updateLesson']);
                Route::delete('/teacher/lessons/{lesson}', [TeacherController::class, 'deleteLesson']);
                Route::post('/teacher/lessons/{lesson}/video', [TeacherController::class, 'addVideo']);
                Route::post('/teacher/videos/{video}/replace', [TeacherController::class, 'replaceVideo']);
                Route::post('/teacher/videos/signed-upload', [TeacherController::class, 'generateSignedUpload']);
                Route::post('/teacher/videos/detect-duration', [TeacherController::class, 'detectVideoDurationUrl']);
                Route::put('/teacher/videos/{video}', [TeacherController::class, 'updateVideo']);
                Route::delete('/teacher/videos/{video}', [TeacherController::class, 'deleteVideo']);
                Route::post('/teacher/lessons/{lesson}/pdf', [TeacherController::class, 'addPdf']);
                Route::put('/teacher/pdfs/{pdf}', [TeacherController::class, 'updatePdf']);
                Route::delete('/teacher/pdfs/{pdf}', [TeacherController::class, 'deletePdf']);
                Route::post('/teacher/courses/{course}/packages', [TeacherController::class, 'createPackage']);
                Route::get('/teacher/packages', [TeacherController::class, 'listPackages']);
                Route::post('/teacher/packages', [TeacherController::class, 'createPackageNew']);
                Route::put('/teacher/packages/{package}', [TeacherController::class, 'updatePackage']);
                Route::delete('/teacher/packages/{package}', [TeacherController::class, 'deletePackage']);
                Route::post('/teacher/lessons/{lesson}/exam', [TeacherController::class, 'addExam']);
                Route::post('/teacher/exams/import-word', [TeacherController::class, 'importQuestionsFromWord']);
                Route::put('/teacher/exams/{exam}', [TeacherController::class, 'updateExam']);
                Route::delete('/teacher/exams/{exam}', [TeacherController::class, 'deleteExam']);
                Route::post('/teacher/attempts/{attempt}/grade', [TeacherController::class, 'gradeAttempt']);
            });
        });

        /*
         * Administrator Scope
         */
        Route::middleware('role:admin')->group(function () {
            // Dashboard
            Route::middleware('permission:dashboard.view')->group(function () {
                Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);
                Route::get('/admin/video-views-analytics', [AdminController::class, 'getVideoViewsAnalytics']);
            });

            // Bunny storage stats
            Route::middleware('permission:bunny.view')->get('/admin/bunny/dashboard', [AdminController::class, 'bunnyDashboard']);

            // Academic Year Initialization
            Route::middleware('permission:academic_year.initialize')->post('/admin/reset-year', [AdminController::class, 'resetYear']);

            // Active Sessions Management (under admins.manage)
            Route::middleware('permission:admins.manage')->group(function () {
                Route::get('/admin/active-sessions', [AdminController::class, 'listActiveSessions']);
                Route::post('/admin/active-sessions/logout-all', [AdminController::class, 'forceLogoutAllSessions']);
                Route::post('/admin/active-sessions/{id}/logout', [AdminController::class, 'forceLogoutSession']);
                Route::get('/admin/logs', [AdminController::class, 'activityLogs']);

                // Security & Threat Monitoring
                Route::get('/admin/security/stats', [SecurityMonitoringController::class, 'stats']);
                Route::get('/admin/security/events', [SecurityMonitoringController::class, 'index']);
                Route::get('/admin/security/blocked-ips', [SecurityMonitoringController::class, 'blockedIps']);
                Route::post('/admin/security/unblock-ip', [SecurityMonitoringController::class, 'unblockIp']);
            });

            // Teachers Management
            Route::middleware('permission:teachers.manage')->group(function () {
                Route::get('/admin/teachers', [AdminController::class, 'listTeachers']);
                Route::post('/admin/teachers', [AdminController::class, 'createTeacher']);
                Route::put('/admin/teachers/{teacher}', [AdminController::class, 'updateTeacher']);
                Route::post('/admin/teachers/{teacher}/reset-password', [AdminController::class, 'resetTeacherPassword']);
                Route::delete('/admin/teachers/{id}', [AdminController::class, 'deleteTeacher']);
                Route::post('/admin/bulk/teachers', [AdminController::class, 'bulkDeleteTeachers']);
            });

            // Teacher Subscriptions & Resource overrides
            Route::middleware('permission:teacher_subscriptions.manage')->group(function () {
                Route::get('/admin/teachers/{id}/subscription', [SubscriptionController::class, 'getTeacherSubscription']);
                Route::post('/admin/teachers/{id}/subscription/plan', [SubscriptionController::class, 'updateTeacherPlan']);
                Route::post('/admin/teachers/{id}/subscription/renew', [SubscriptionController::class, 'renewSubscription']);
                Route::post('/admin/teachers/{id}/subscription/addons', [SubscriptionController::class, 'addSubscriptionAddon']);
                Route::post('/admin/teachers/{id}/subscription/payments', [SubscriptionController::class, 'confirmSubscriptionPayment']);
                Route::get('/admin/teachers-resources-summary', [SubscriptionController::class, 'getTeachersResourcesSummary']);
                Route::get('/admin/teachers/{id}/resources', [SubscriptionController::class, 'getTeacherResourceOverrides']);
                Route::put('/admin/teachers/{id}/resources', [SubscriptionController::class, 'updateTeacherResourceOverrides']);
                Route::delete('/admin/teachers/{id}/resources', [SubscriptionController::class, 'deleteTeacherResourceOverrides']);
            });

            // Subscription Requests
            Route::middleware('permission:subscription_requests.manage')->group(function () {
                Route::get('/admin/subscriptions/requests', [SubscriptionController::class, 'getSubscriptionRequests']);
                Route::post('/admin/subscriptions/requests/{id}/action', [SubscriptionController::class, 'handleSubscriptionRequest']);
            });

            // Subscription Plans management CRUD
            Route::middleware('permission:subscription_plans.manage')->group(function () {
                Route::get('/admin/subscription-plans', [SubscriptionController::class, 'listPlansAdmin']);
                Route::post('/admin/subscription-plans', [SubscriptionController::class, 'createPlan']);
                Route::put('/admin/subscription-plans/{id}', [SubscriptionController::class, 'updatePlan']);
                Route::delete('/admin/subscription-plans/{id}', [SubscriptionController::class, 'deletePlan']);
                Route::post('/admin/subscription-plans/{id}/toggle', [SubscriptionController::class, 'togglePlanStatus']);
                Route::post('/admin/subscription-plans/reorder', [SubscriptionController::class, 'reorderPlans']);
                Route::get('/admin/subscription-plans/{id}/price-history', [SubscriptionController::class, 'getPriceHistory']);
                Route::get('/admin/subscription-plans/{id}/audit-logs', [SubscriptionController::class, 'getAuditLogs']);
                Route::post('/admin/subscription-settings', [SubscriptionController::class, 'updateSettings']);

                // Activation Code Packages
                Route::get('/admin/activation-code-packages', [SubscriptionController::class, 'listActivationCodePackagesAdmin']);
                Route::post('/admin/activation-code-packages', [SubscriptionController::class, 'createActivationCodePackage']);
                Route::put('/admin/activation-code-packages/{id}', [SubscriptionController::class, 'updateActivationCodePackage']);
                Route::delete('/admin/activation-code-packages/{id}', [SubscriptionController::class, 'deleteActivationCodePackage']);
                Route::post('/admin/activation-code-packages/{id}/toggle', [SubscriptionController::class, 'toggleActivationCodePackageStatus']);

                // Storage Packages
                Route::get('/admin/storage-packages', [SubscriptionController::class, 'listStoragePackagesAdmin']);
                Route::post('/admin/storage-packages', [SubscriptionController::class, 'createStoragePackage']);
                Route::put('/admin/storage-packages/{id}', [SubscriptionController::class, 'updateStoragePackage']);
                Route::delete('/admin/storage-packages/{id}', [SubscriptionController::class, 'deleteStoragePackage']);
                Route::post('/admin/storage-packages/{id}/toggle', [SubscriptionController::class, 'toggleStoragePackageStatus']);
            });

            // Students Management
            Route::middleware('permission:students.manage')->group(function () {
                Route::get('/admin/students', [AdminController::class, 'listStudents']);
                Route::get('/admin/students/{student}/analytics', [AdminController::class, 'studentAnalytics']);
                Route::get('/admin/student-activity', [StudentActivityController::class, 'index']);
                Route::get('/admin/student-activity/stats', [StudentActivityController::class, 'stats']);
                Route::get('/admin/student-activity/sessions', [StudentActivityController::class, 'sessions']);
                Route::get('/admin/students/{student}/activity', [StudentActivityController::class, 'studentActivity']);
                Route::get('/admin/students/{student}/security-events', [SecurityMonitoringController::class, 'studentSecurityEvents']);
                Route::post('/admin/students/{id}/reset-password', [AdminController::class, 'resetStudentPassword']);
                Route::delete('/admin/students/{id}', [AdminController::class, 'deleteStudent']);
                Route::post('/admin/users/{id}/disable', [AdminController::class, 'disableUser']);
                Route::post('/admin/users/{id}/enable', [AdminController::class, 'enableUser']);
                Route::post('/admin/bulk/students', [AdminController::class, 'bulkDeleteStudents']);
                Route::middleware('permission:academic_year.initialize')->post('/admin/reset-academic-year', [AdminController::class, 'resetAcademicYear']);
                Route::get('/admin/export-database', [AdminController::class, 'exportDatabase']);
                
                // Refund & Wallet control
                Route::get('/admin/students/{student}/enrollments', [AdminController::class, 'studentEnrollments']);
                Route::post('/admin/enrollments/{enrollment}/refund', [AdminController::class, 'refundEnrollment']);
                Route::post('/admin/exam-purchases/{examPurchase}/refund', [AdminController::class, 'refundExamPurchase']);
                Route::post('/admin/students/{student}/wallet/adjust', [AdminController::class, 'adjustStudentWallet']);
                Route::get('/admin/refund-logs', [AdminController::class, 'refundLogs']);
            });

            // Student Registration Approval
            Route::middleware('permission:students.pending')->group(function () {
                Route::get('/admin/pending-students', [AdminController::class, 'getPendingStudents']);
                Route::post('/admin/students/{id}/approve', [AdminController::class, 'approveStudent']);
                Route::post('/admin/students/{id}/reject', [AdminController::class, 'rejectStudent']);
            });

            // Courses Management
            Route::middleware('permission:courses.manage')->group(function () {
                Route::get('/admin/courses', [AdminController::class, 'listCourses']);
                Route::delete('/admin/courses/{id}', [AdminController::class, 'deleteCourse']);
                Route::get('/admin/packages', [AdminController::class, 'listPackages']);
                Route::put('/admin/packages/{package}', [AdminController::class, 'updatePackage']);
                Route::delete('/admin/packages/{package}', [AdminController::class, 'deletePackage']);
            });

            // Monthly Exams Management
            Route::middleware('permission:exams.manage')->group(function () {
                Route::get('/admin/monthly-exams', [MonthlyExamsController::class, 'adminList']);
                Route::get('/admin/monthly-exams/{id}', [MonthlyExamsController::class, 'adminShow']);
                Route::post('/admin/monthly-exams', [MonthlyExamsController::class, 'adminStore']);
                Route::put('/admin/monthly-exams/{id}', [MonthlyExamsController::class, 'adminUpdate']);
                Route::delete('/admin/monthly-exams/{id}', [MonthlyExamsController::class, 'adminDestroy']);
                Route::post('/admin/monthly-exams/attempts/{attemptId}/unlock-answers', [MonthlyExamsController::class, 'unlockAnswers']);
            });

            // Coupons/Codes Management
            Route::middleware('permission:coupons.manage')->group(function () {
                Route::post('/admin/purchase-codes', [AdminController::class, 'generatePurchaseCodes']);
                Route::get('/admin/purchase-codes', [AdminController::class, 'listPurchaseCodes']);
                Route::post('/admin/bulk/codes', [AdminController::class, 'bulkDeleteCodes']);
            });

            // Reports
            Route::middleware('permission:reports.view')->group(function () {
                Route::get('/admin/reports', [AdminController::class, 'reports']);
                Route::get('/admin/subscriptions/reports', [SubscriptionController::class, 'exportReports']);
                Route::get('/admin/financial/dashboard', [\App\Http\Controllers\FinancialController::class, 'dashboard']);
                Route::get('/admin/financial/transactions', [\App\Http\Controllers\FinancialController::class, 'transactions']);
                Route::get('/admin/financial/daily-report', [\App\Http\Controllers\FinancialController::class, 'dailyReport']);
                Route::get('/admin/financial/teachers', [\App\Http\Controllers\FinancialController::class, 'teachersReport']);
                Route::get('/admin/financial/students', [\App\Http\Controllers\FinancialController::class, 'studentsReport']);
                Route::get('/admin/financial/export', [\App\Http\Controllers\FinancialController::class, 'export']);
                Route::post('/admin/financial/teachers/{id}/adjust', [\App\Http\Controllers\FinancialController::class, 'adjustTeacherBalance']);
                Route::get('/admin/financial/teachers/{id}/statement', [\App\Http\Controllers\FinancialController::class, 'teacherStatement']);
                Route::get('/admin/financial/students/{id}/ledger', [\App\Http\Controllers\FinancialController::class, 'studentLedger']);
                Route::get('/admin/financial/audit-logs', [\App\Http\Controllers\FinancialController::class, 'auditLogs']);
                Route::get('/admin/financial/daily-closing/export', [\App\Http\Controllers\FinancialController::class, 'exportDailyClosing']);
            });

            // Admins CRUD (Super Admin restricted inside controller as well)
            Route::middleware('permission:admins.manage')->group(function () {
                Route::get('/admin/permissions', [AdminController::class, 'listAllPermissions']);
                Route::get('/admin/manage', [AdminController::class, 'listAdmins']);
                Route::post('/admin/manage', [AdminController::class, 'createAdmin']);
                Route::put('/admin/manage/{id}', [AdminController::class, 'updateAdmin']);
                Route::delete('/admin/manage/{id}', [AdminController::class, 'deleteAdmin']);
                Route::post('/admin/manage/{id}/toggle', [AdminController::class, 'toggleAdminStatus']);
            });

            // Admin Notifications Management
            Route::middleware('permission:notifications.send')->group(function () {
                Route::post('/admin/notifications', [SubscriptionController::class, 'sendNotification']);
                Route::post('/admin/notifications/send', [SubscriptionController::class, 'sendNotification']);
                Route::delete('/admin/notifications/{id}', [SubscriptionController::class, 'deleteNotification']);
                Route::delete('/admin/notifications', [SubscriptionController::class, 'deleteNotifications']);
                Route::get('/admin/users-selectors', [SubscriptionController::class, 'getUsersForSelectors']);
                Route::get('/admin/notifications/users', [SubscriptionController::class, 'getUsersForSelectors']);
            });

            // Admin Payouts Management
            Route::middleware('permission:payouts.manage')->group(function () {
                Route::get('/admin/payouts', [AdminController::class, 'listPayouts']);
                Route::post('/admin/payouts', [AdminController::class, 'createPayout']);
            });

            // Platform Settings & Taxonomy Management
            Route::middleware('permission:settings.manage')->group(function () {
                Route::get('/admin/enterprise-settings', [AdminController::class, 'getEnterpriseSettings']);
                Route::post('/admin/enterprise-settings', [AdminController::class, 'updateEnterpriseSettings']);
                Route::get('/admin/maintenance-settings', [AdminController::class, 'getMaintenanceSettings']);
                Route::post('/admin/maintenance-settings', [AdminController::class, 'updateMaintenanceSettings']);

                // Departments
                Route::get('/admin/departments', [TaxonomyController::class, 'listDepartmentsAdmin']);
                Route::post('/admin/departments', [TaxonomyController::class, 'createDepartment']);
                Route::put('/admin/departments/{id}', [TaxonomyController::class, 'updateDepartment']);
                Route::delete('/admin/departments/{id}', [TaxonomyController::class, 'deleteDepartment']);
                Route::post('/admin/departments/{id}/toggle', [TaxonomyController::class, 'toggleDepartmentStatus']);

                // Academic Stages
                Route::get('/admin/academic-stages', [TaxonomyController::class, 'listAcademicStagesAdmin']);
                Route::post('/admin/academic-stages', [TaxonomyController::class, 'createAcademicStage']);
                Route::put('/admin/academic-stages/{id}', [TaxonomyController::class, 'updateAcademicStage']);
                Route::delete('/admin/academic-stages/{id}', [TaxonomyController::class, 'deleteAcademicStage']);
                Route::post('/admin/academic-stages/{id}/toggle', [TaxonomyController::class, 'toggleAcademicStageStatus']);

                // Academic Grades
                Route::get('/admin/academic-grades', [TaxonomyController::class, 'listAcademicGradesAdmin']);
                Route::post('/admin/academic-grades', [TaxonomyController::class, 'createAcademicGrade']);
                Route::put('/admin/academic-grades/{id}', [TaxonomyController::class, 'updateAcademicGrade']);
                Route::delete('/admin/academic-grades/{id}', [TaxonomyController::class, 'deleteAcademicGrade']);
                Route::post('/admin/academic-grades/{id}/toggle', [TaxonomyController::class, 'toggleAcademicGradeStatus']);
            });

            // Watch limits (Course view limits per student, Course view limits config)
            Route::middleware('permission:watch_limits.manage')->group(function () {
                Route::get('/admin/student-course-limits', [AdminController::class, 'getStudentCourseLimits']);
                Route::post('/admin/student-course-limits', [AdminController::class, 'updateStudentCourseLimit']);
                Route::get('/admin/course-view-limits-config/{courseId}', [AdminController::class, 'getCourseViewLimitsConfig']);
                Route::post('/admin/course-view-limits-config/{courseId}', [AdminController::class, 'updateCourseViewLimitsConfig']);
            });
            Route::middleware('permission:watch_limits.reset')->group(function () {
                Route::post('/admin/student-course-limits/reset', [AdminController::class, 'resetStudentCourseLimit']);
            });
        });

    });
});

/*
|--------------------------------------------------------------------------
| API Fallback Route (Safe 404 for Unknown Endpoints)
|--------------------------------------------------------------------------
*/
Route::fallback(function (\Illuminate\Http\Request $request) {
    return response()->json([
        'message' => 'نقطة النهاية المطلوبة غير موجودة على المنصة.',
        'code' => 'ENDPOINT_NOT_FOUND',
        'status' => 404,
        'request_id' => \App\Services\SecurityMonitoringService::getRequestId($request),
    ], 404);
});
