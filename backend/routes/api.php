<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PublicController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\TeacherController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\SubscriptionController;

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/
Route::get('/home', [PublicController::class, 'home']);
Route::get('/teachers', [PublicController::class, 'teachers']);
Route::get('/teachers/{teacher}', [PublicController::class, 'teacherProfile']);
Route::get('/courses', [PublicController::class, 'courses']);
Route::get('/courses/{course}', [PublicController::class, 'courseDetail']);
Route::get('/packages', [PublicController::class, 'packages']);

// Cascading Filter
Route::get('/filter/subjects', [PublicController::class, 'filterSubjects']);
Route::get('/filter/teachers', [PublicController::class, 'filterTeachers']);
Route::get('/config', [PublicController::class, 'config']);

// Authentication
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

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
            Route::get('/student/profile-stats', [StudentController::class, 'profileStats']);
            Route::get('/student/courses', [StudentController::class, 'enrolledCourses']);
            Route::get('/student/wallet', [StudentController::class, 'wallet']);
            Route::post('/wallet/redeem', [StudentController::class, 'redeemCode']);
            Route::post('/courses/{course}/subscribe', [StudentController::class, 'subscribeCourse']);
            Route::post('/packages/{package}/subscribe', [StudentController::class, 'subscribePackage']);
            Route::post('/lessons/{lesson}/subscribe', [StudentController::class, 'subscribeLesson']);
            Route::get('/student/lessons/{lesson}', [StudentController::class, 'lessonDetail']);
            Route::post('/videos/{video}/progress', [StudentController::class, 'updateVideoProgress']);
            Route::get('/exams/{exam}', [StudentController::class, 'startExam']);
            Route::post('/exams/{exam}/submit', [StudentController::class, 'submitExam']);
            Route::post('/exams/{exam}/log-violation', [StudentController::class, 'logViolation']);
            Route::post('/exams/{exam}/purchase', [StudentController::class, 'purchaseExam']);
            Route::get('/student/results', [StudentController::class, 'examResults']);
            Route::post('/student/profile/update', [StudentController::class, 'updateProfile']);
        });

        /*
         * Teacher Dashboard Scope
         */
        Route::middleware('role:teacher')->group(function () {
            Route::get('/teacher/dashboard', [TeacherController::class, 'dashboard']);
            Route::get('/teacher/revenue-report', [TeacherController::class, 'revenueReport']);
            Route::get('/teacher/courses', [TeacherController::class, 'courses']);
            Route::get('/teacher/exams', [TeacherController::class, 'listExams']);
            Route::get('/teacher/exams/{exam}', [TeacherController::class, 'getExam']);
            Route::get('/teacher/exams/{exam}/attempts', [TeacherController::class, 'examAttempts']);
            Route::get('/teacher/students', [TeacherController::class, 'students']);
            Route::get('/teacher/students/{student}/analytics', [TeacherController::class, 'studentAnalytics']);

            // Teacher Subscription routes (always accessible)
            Route::get('/teacher/subscription', [SubscriptionController::class, 'getTeacherSubscriptionSelf']);
            Route::post('/teacher/subscription/upgrade-request', [SubscriptionController::class, 'requestUpgradeSelf']);

            // Content creation / uploads protected by active subscription
            Route::middleware('subscription.active')->group(function () {
                Route::post('/teacher/courses', [TeacherController::class, 'createCourse']);
                Route::put('/teacher/courses/{course}', [TeacherController::class, 'updateCourse']);
                Route::delete('/teacher/courses/{course}', [TeacherController::class, 'deleteCourse']);
                Route::post('/teacher/courses/{course}/units', [TeacherController::class, 'addUnit']);
                Route::post('/teacher/units/{unit}/lessons', [TeacherController::class, 'addLesson']);
                Route::post('/teacher/lessons/{lesson}/video', [TeacherController::class, 'addVideo']);
                Route::post('/teacher/videos/signed-upload', [TeacherController::class, 'generateSignedUpload']);
                Route::post('/teacher/videos/detect-duration', [TeacherController::class, 'detectVideoDurationUrl']);
                Route::put('/teacher/videos/{video}', [TeacherController::class, 'updateVideo']);
                Route::delete('/teacher/videos/{video}', [TeacherController::class, 'deleteVideo']);
                Route::post('/teacher/lessons/{lesson}/pdf', [TeacherController::class, 'addPdf']);
                Route::put('/teacher/pdfs/{pdf}', [TeacherController::class, 'updatePdf']);
                Route::delete('/teacher/pdfs/{pdf}', [TeacherController::class, 'deletePdf']);
                Route::post('/teacher/courses/{course}/packages', [TeacherController::class, 'createPackage']);
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
            Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);
            Route::post('/admin/reset-year', [AdminController::class, 'resetYear']);
            Route::post('/admin/bulk/students', [AdminController::class, 'bulkDeleteStudents']);
            Route::post('/admin/bulk/teachers', [AdminController::class, 'bulkDeleteTeachers']);
            Route::post('/admin/bulk/codes', [AdminController::class, 'bulkDeleteCodes']);

            // Active Sessions Management
            Route::get('/admin/active-sessions', [AdminController::class, 'listActiveSessions']);
            Route::post('/admin/active-sessions/logout-all', [AdminController::class, 'forceLogoutAllSessions']);
            Route::post('/admin/active-sessions/{id}/logout', [AdminController::class, 'forceLogoutSession']);

            // Teachers Management
            Route::middleware('permission:teachers.manage')->group(function () {
                Route::get('/admin/teachers', [AdminController::class, 'listTeachers']);
                Route::post('/admin/teachers', [AdminController::class, 'createTeacher']);
                Route::put('/admin/teachers/{teacher}', [AdminController::class, 'updateTeacher']);
                Route::post('/admin/teachers/{teacher}/reset-password', [AdminController::class, 'resetTeacherPassword']);
                Route::delete('/admin/teachers/{id}', [AdminController::class, 'deleteTeacher']);
            });

            // Students Management
            Route::middleware('permission:students.manage')->group(function () {
                Route::get('/admin/students', [AdminController::class, 'listStudents']);
                Route::get('/admin/students/{student}/analytics', [AdminController::class, 'studentAnalytics']);
                Route::post('/admin/students/{id}/reset-password', [AdminController::class, 'resetStudentPassword']);
                Route::delete('/admin/students/{id}', [AdminController::class, 'deleteStudent']);
                Route::post('/admin/users/{id}/disable', [AdminController::class, 'disableUser']);
                Route::post('/admin/users/{id}/enable', [AdminController::class, 'enableUser']);
                
                // Refund & Wallet control
                Route::get('/admin/students/{student}/enrollments', [AdminController::class, 'studentEnrollments']);
                Route::post('/admin/enrollments/{enrollment}/refund', [AdminController::class, 'refundEnrollment']);
                Route::post('/admin/students/{student}/wallet/adjust', [AdminController::class, 'adjustStudentWallet']);
                Route::get('/admin/refund-logs', [AdminController::class, 'refundLogs']);
            });

            // Courses Management
            Route::middleware('permission:courses.manage')->group(function () {
                Route::get('/admin/courses', [AdminController::class, 'listCourses']);
                Route::delete('/admin/courses/{id}', [AdminController::class, 'deleteCourse']);
                Route::get('/admin/packages', [AdminController::class, 'listPackages']);
                Route::put('/admin/packages/{package}', [AdminController::class, 'updatePackage']);
                Route::delete('/admin/packages/{package}', [AdminController::class, 'deletePackage']);
            });

            // Coupons/Codes Management
            Route::middleware('permission:coupons.manage')->group(function () {
                Route::post('/admin/purchase-codes', [AdminController::class, 'generatePurchaseCodes']);
                Route::get('/admin/purchase-codes', [AdminController::class, 'listPurchaseCodes']);
            });

            // Reports
            Route::middleware('permission:reports.view')->group(function () {
                Route::get('/admin/reports', [AdminController::class, 'reports']);
            });

            // Admin logs (Super Admin only)
            Route::get('/admin/logs', [AdminController::class, 'activityLogs']);

            // Admins CRUD (Super Admin restricted inside controller as well)
            Route::middleware('permission:admins.manage')->group(function () {
                Route::get('/admin/manage', [AdminController::class, 'listAdmins']);
                Route::post('/admin/manage', [AdminController::class, 'createAdmin']);
                Route::put('/admin/manage/{id}', [AdminController::class, 'updateAdmin']);
                Route::delete('/admin/manage/{id}', [AdminController::class, 'deleteAdmin']);
                Route::post('/admin/manage/{id}/toggle', [AdminController::class, 'toggleAdminStatus']);
            });

            // Subscription & Notifications Management
            Route::get('/admin/teachers/{id}/subscription', [SubscriptionController::class, 'getTeacherSubscription']);
            Route::post('/admin/teachers/{id}/subscription/plan', [SubscriptionController::class, 'updateTeacherPlan']);
            Route::post('/admin/teachers/{id}/subscription/addons', [SubscriptionController::class, 'addSubscriptionAddon']);
            Route::post('/admin/teachers/{id}/subscription/payments', [SubscriptionController::class, 'confirmSubscriptionPayment']);
            Route::get('/admin/subscriptions/reports', [SubscriptionController::class, 'exportReports']);
            Route::get('/admin/subscriptions/requests', [SubscriptionController::class, 'getSubscriptionRequests']);
            Route::post('/admin/subscriptions/requests/{id}/action', [SubscriptionController::class, 'handleSubscriptionRequest']);
            Route::put('/admin/subscription-plans/{id}', [SubscriptionController::class, 'updatePlan']);
            Route::post('/admin/subscription-settings', [SubscriptionController::class, 'updateSettings']);
            Route::get('/admin/subscription-plans', [SubscriptionController::class, 'listPlansAdmin']);

            // Admin Notifications Management
            Route::post('/admin/notifications', [SubscriptionController::class, 'sendNotification']);
            Route::post('/admin/notifications/send', [SubscriptionController::class, 'sendNotification']);
            Route::get('/admin/users-selectors', [SubscriptionController::class, 'getUsersForSelectors']);
            Route::get('/admin/notifications/users', [SubscriptionController::class, 'getUsersForSelectors']);
        });

    });
});
