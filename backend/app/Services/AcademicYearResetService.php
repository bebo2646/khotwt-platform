<?php

namespace App\Services;

use App\Models\User;
use App\Models\AdminActivityLog;
use App\Models\FinancialAuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class AcademicYearResetService
{
    const REQUIRED_CONFIRMATION = 'RESET NEW ACADEMIC YEAR';
    const LOCK_KEY = 'academic_year_reset_lock';
    const LOCK_TTL_SECONDS = 120;

    /**
     * Execute the canonical New Academic Year Reset flow.
     */
    public function executeReset(User $adminUser, string $confirmation, string $ipAddress = '127.0.0.1'): array
    {
        // 1. Authorization check
        if (!$adminUser->is_super_admin && !$adminUser->is_super && !$adminUser->hasPermission('academic_year.initialize') && !$adminUser->hasPermission('academic_year.reset')) {
            return [
                'success' => false,
                'status' => 403,
                'message' => 'عذراً، ليس لديك الصلاحية المطلوبة (academic_year.initialize / academic_year.reset) لتهيئة السنة الدراسية الجديدة.',
            ];
        }

        // 2. Strict confirmation check
        if (trim($confirmation) !== self::REQUIRED_CONFIRMATION) {
            return [
                'success' => false,
                'status' => 422,
                'message' => 'نص تأكيد التهيئة غير صحيح. يرجى كتابة "' . self::REQUIRED_CONFIRMATION . '" بدقة.',
            ];
        }

        // 3. Acquire atomic distributed lock to prevent double-click / concurrency
        $lock = Cache::lock(self::LOCK_KEY, self::LOCK_TTL_SECONDS);
        if (!$lock->get()) {
            return [
                'success' => false,
                'status' => 409,
                'message' => 'عملية تهيئة السنة الدراسية قيد التنفيذ حالياً من قِبل مسؤول آخر. يرجى الانتظار حتى اكتمالها.',
            ];
        }

        try {
            // 4. Generate and verify complete financial archive before any deletion
            $archiveResult = $this->createFinancialArchive($adminUser, $ipAddress);
            if (!$archiveResult['success']) {
                throw new \RuntimeException('فشل إنشاء الأرشيف المالي للعام المنتهي: ' . ($archiveResult['error'] ?? 'خطأ غير معروف'));
            }

            $archiveFilePath = $archiveResult['file_path'];
            $archiveFileName = $archiveResult['file_name'];

            // 5. Count preserved teachers, admins, and content before reset
            $preservedTeachersCount = DB::table('users')->where('role', 'teacher')->count();
            $preservedAdminsCount = DB::table('users')->where(function ($q) {
                $q->where('role', 'admin')->orWhere('role', 'super_admin')->orWhere('is_super_admin', true)->orWhere('is_super', true);
            })->count();
            $preservedCoursesCount = Schema::hasTable('courses') ? DB::table('courses')->count() : 0;
            $preservedExamsCount = Schema::hasTable('exams') ? DB::table('exams')->count() : 0;
            $preservedTeacherLogsCount = Schema::hasTable('teacher_activity_logs') ? DB::table('teacher_activity_logs')->count() : 0;
            $preservedTeacherSessionsCount = Schema::hasTable('teacher_sessions') ? DB::table('teacher_sessions')->count() : 0;

            // 6. Execute destructive reset inside a database transaction
            $affectedCounts = DB::transaction(function () use (
                $adminUser,
                $ipAddress,
                $archiveFileName,
                $preservedTeachersCount,
                $preservedAdminsCount,
                $preservedCoursesCount,
                $preservedExamsCount,
                $preservedTeacherLogsCount,
                $preservedTeacherSessionsCount
            ) {
                $counts = [];

                // 6.1. Retrieve all student user IDs robustly across any role casing/variant
                $studentIds = DB::table('users')
                    ->where(function ($q) {
                        $q->whereRaw("LOWER(TRIM(role)) = 'student'")
                          ->orWhere('role', 'student')
                          ->orWhere('role', 'Student')
                          ->orWhere('role', 'STUDENT')
                          ->orWhereNotIn('role', ['teacher', 'admin', 'super_admin']);
                    })
                    ->where('is_super_admin', false)
                    ->where('is_super', false)
                    ->where(function ($q) {
                        $q->whereNull('role')
                          ->orWhereNotIn('role', ['teacher', 'admin', 'super_admin']);
                    })
                    ->pluck('id')
                    ->toArray();

                $counts['identified_students_count'] = count($studentIds);

                // 6.2. Delete Exam Violations (references student_exams, exams, questions, users)
                if (Schema::hasTable('exam_violations')) {
                    $counts['exam_violations'] = DB::table('exam_violations')->delete();
                }

                // 6.3. Delete Student Answers (references student_exams, questions)
                if (Schema::hasTable('student_answers')) {
                    $counts['student_answers'] = DB::table('student_answers')->delete();
                }

                // 6.4. Delete Student Activity Logs (references student_exams via attempt_id, users via student_id)
                if (Schema::hasTable('student_activity_logs')) {
                    $counts['student_activity_logs'] = DB::table('student_activity_logs')->delete();
                }

                // 6.5. Delete Student Exam Attempts (references users, exams, courses, lessons)
                if (Schema::hasTable('student_exams')) {
                    $counts['student_exams'] = DB::table('student_exams')->delete();
                }

                // 6.6. Delete Exam Purchases (references users, exams)
                if (Schema::hasTable('exam_purchases')) {
                    $counts['exam_purchases'] = DB::table('exam_purchases')->delete();
                }

                // 6.7. Delete Student Learning Progress & View Sessions
                if (Schema::hasTable('video_progresses')) {
                    $counts['video_progresses'] = DB::table('video_progresses')->delete();
                }
                if (Schema::hasTable('student_pdf_progresses')) {
                    $counts['student_pdf_progresses'] = DB::table('student_pdf_progresses')->delete();
                }
                if (Schema::hasTable('video_view_sessions')) {
                    $counts['video_view_sessions'] = DB::table('video_view_sessions')->delete();
                }
                if (Schema::hasTable('student_course_view_limits')) {
                    $counts['student_course_view_limits'] = DB::table('student_course_view_limits')->delete();
                }

                // 6.8. Delete Course & Bundle Enrollments
                if (Schema::hasTable('enrollments')) {
                    $counts['enrollments'] = DB::table('enrollments')->delete();
                }

                // 6.9. Delete Student Sessions (references users)
                if (Schema::hasTable('student_sessions')) {
                    $counts['student_sessions'] = DB::table('student_sessions')->delete();
                }

                // 6.10. Delete Student-Specific Security Events
                if (Schema::hasTable('security_events') && !empty($studentIds)) {
                    $counts['security_events'] = DB::table('security_events')
                        ->whereIn('user_id', $studentIds)
                        ->delete();
                }

                // 6.11. Delete Operational Financial Records
                if (Schema::hasTable('refund_logs')) {
                    $counts['refund_logs'] = DB::table('refund_logs')->delete();
                }
                if (Schema::hasTable('purchase_audit_logs')) {
                    $counts['purchase_audit_logs'] = DB::table('purchase_audit_logs')->delete();
                }
                if (Schema::hasTable('payment_histories')) {
                    $counts['payment_histories'] = DB::table('payment_histories')->delete();
                }
                if (Schema::hasTable('teacher_earnings')) {
                    $counts['teacher_earnings'] = DB::table('teacher_earnings')->delete();
                }
                if (Schema::hasTable('platform_earnings')) {
                    $counts['platform_earnings'] = DB::table('platform_earnings')->delete();
                }
                if (Schema::hasTable('teacher_payouts')) {
                    $counts['teacher_payouts'] = DB::table('teacher_payouts')->delete();
                }
                if (Schema::hasTable('student_teacher_credits')) {
                    $counts['student_teacher_credits'] = DB::table('student_teacher_credits')->delete();
                }

                // 6.12. Delete Student Wallets & Wallet Transactions
                if (Schema::hasTable('wallet_transactions')) {
                    $counts['wallet_transactions'] = DB::table('wallet_transactions')->delete();
                }
                if (Schema::hasTable('wallets')) {
                    $counts['wallets'] = DB::table('wallets')->delete();
                }

                // 6.13. Delete Notifications: notification_reads before notifications
                if (Schema::hasTable('notification_reads')) {
                    $counts['notification_reads'] = DB::table('notification_reads')->delete();
                }
                if (Schema::hasTable('notifications')) {
                    $counts['notifications'] = DB::table('notifications')->delete();
                }

                // 6.14. Reset Purchase Codes usage linkage
                if (Schema::hasTable('purchase_codes')) {
                    $counts['purchase_codes_reset'] = DB::table('purchase_codes')->update([
                        'is_redeemed' => false,
                        'redeemed_by' => null,
                        'redeemed_at' => null,
                    ]);
                }

                // 6.15. Delete Sessions and Personal Access Tokens for students
                if (!empty($studentIds)) {
                    if (Schema::hasTable('sessions')) {
                        DB::table('sessions')->whereIn('user_id', $studentIds)->delete();
                    }
                    if (Schema::hasTable('personal_access_tokens')) {
                        DB::table('personal_access_tokens')
                            ->where('tokenable_type', 'App\Models\User')
                            ->whereIn('tokenable_id', $studentIds)
                            ->delete();
                    }
                }
                if (Schema::hasTable('sessions')) {
                    DB::table('sessions')->whereNull('user_id')->delete();
                }
                if (Schema::hasTable('password_reset_tokens')) {
                    DB::table('password_reset_tokens')->delete();
                }

                // 6.16. Permanently Delete All Student User Accounts
                $counts['deleted_students'] = DB::table('users')
                    ->where(function ($q) use ($studentIds) {
                        $q->whereIn('id', $studentIds)
                          ->orWhereRaw("LOWER(TRIM(role)) = 'student'")
                          ->orWhere('role', 'student')
                          ->orWhere('role', 'Student')
                          ->orWhere('role', 'STUDENT')
                          ->orWhereNotIn('role', ['teacher', 'admin', 'super_admin']);
                    })
                    ->where('is_super_admin', false)
                    ->where('is_super', false)
                    ->where(function ($q) {
                        $q->whereNull('role')
                          ->orWhereNotIn('role', ['teacher', 'admin', 'super_admin']);
                    })
                    ->delete();

                // 6.17. CRITICAL VERIFICATIONS:
                // A) Verify 0 student accounts remain
                $remainingStudents = DB::table('users')
                    ->where(function ($q) {
                        $q->whereRaw("LOWER(TRIM(role)) = 'student'")
                          ->orWhere('role', 'student')
                          ->orWhere('role', 'Student')
                          ->orWhere('role', 'STUDENT')
                          ->orWhereNotIn('role', ['teacher', 'admin', 'super_admin']);
                    })
                    ->where('is_super_admin', false)
                    ->where('is_super', false)
                    ->where(function ($q) {
                        $q->whereNull('role')
                          ->orWhereNotIn('role', ['teacher', 'admin', 'super_admin']);
                    })
                    ->count();

                if ($remainingStudents > 0) {
                    throw new \RuntimeException("تعذر حذف كافة حسابات الطلاب ({$remainingStudents} حساب متبقي). تم التراجع عن العملية لضمان السلامة.");
                }

                // B) Verify 0 student sessions remain
                if (Schema::hasTable('student_sessions') && DB::table('student_sessions')->count() > 0) {
                    throw new \RuntimeException('خطأ: لم يتم تفريغ جدول جلسات الطلاب بالكامل.');
                }

                // C) Verify 0 student activity logs remain
                if (Schema::hasTable('student_activity_logs') && DB::table('student_activity_logs')->count() > 0) {
                    throw new \RuntimeException('خطأ: لم يتم تفريغ سجلات نشاط الطلاب بالكامل.');
                }

                // D) Verify 0 exam violations remain
                if (Schema::hasTable('exam_violations') && DB::table('exam_violations')->count() > 0) {
                    throw new \RuntimeException('خطأ: لم يتم تفريغ جدول مخالفات الامتحانات بالكامل.');
                }

                // E) Verify 0 student exam attempts remain
                if (Schema::hasTable('student_exams') && DB::table('student_exams')->count() > 0) {
                    throw new \RuntimeException('خطأ: لم يتم تفريغ جدول محاولات امتحانات الطلاب بالكامل.');
                }

                // F) VERIFY TEACHERS & ADMINS & CONTENT ARE FULLY PRESERVED
                $currentTeachersCount = DB::table('users')->where('role', 'teacher')->count();
                if ($currentTeachersCount < $preservedTeachersCount) {
                    throw new \RuntimeException('خطأ فادح: تم اكتشاف نقص في عدد حسابات المعلمين أثناء التهيئة. تم التراجع عن العملية فوراً.');
                }

                $currentAdminsCount = DB::table('users')->where(function ($q) {
                    $q->where('role', 'admin')->orWhere('role', 'super_admin')->orWhere('is_super_admin', true)->orWhere('is_super', true);
                })->count();
                if ($currentAdminsCount < $preservedAdminsCount) {
                    throw new \RuntimeException('خطأ فادح: تم اكتشاف نقص في عدد حسابات المشرفين أثناء التهيئة. تم التراجع عن العملية فوراً.');
                }

                $currentCoursesCount = Schema::hasTable('courses') ? DB::table('courses')->count() : 0;
                if ($currentCoursesCount < $preservedCoursesCount) {
                    throw new \RuntimeException('خطأ فادح: تم اكتشاف نقص في عدد الكورسات أثناء التهيئة.');
                }

                $currentExamsCount = Schema::hasTable('exams') ? DB::table('exams')->count() : 0;
                if ($currentExamsCount < $preservedExamsCount) {
                    throw new \RuntimeException('خطأ فادح: تم اكتشاف نقص في عدد الامتحانات أثناء التهيئة.');
                }

                $currentTeacherLogsCount = Schema::hasTable('teacher_activity_logs') ? DB::table('teacher_activity_logs')->count() : 0;
                if ($currentTeacherLogsCount < $preservedTeacherLogsCount) {
                    throw new \RuntimeException('خطأ فادح: تم اكتشاف نقص في سجلات نشاط المعلمين أثناء التهيئة.');
                }

                $currentTeacherSessionsCount = Schema::hasTable('teacher_sessions') ? DB::table('teacher_sessions')->count() : 0;
                if ($currentTeacherSessionsCount < $preservedTeacherSessionsCount) {
                    throw new \RuntimeException('خطأ فادح: تم اكتشاف نقص في جلسات المعلمين أثناء التهيئة.');
                }

                // 6.18. Record Activity & Financial Audit Logs
                AdminActivityLog::create([
                    'admin_name' => $adminUser->name,
                    'action_type' => 'Reset Academic Year',
                    'deleted_count' => $counts['deleted_students'],
                    'ip_address' => $ipAddress,
                ]);

                if (Schema::hasTable('financial_audit_logs')) {
                    FinancialAuditLog::create([
                        'admin_id' => $adminUser->id,
                        'admin_name' => $adminUser->name,
                        'action' => 'academic_year_reset',
                        'previous_value' => 'Active Academic Year Data (Archived to: ' . $archiveFileName . ')',
                        'new_value' => 'Clean Academic Year Initialized (0.00 EGP Balances, 0 Students)',
                        'reason' => 'Admin initiated New Academic Year Reset with confirmation: ' . self::REQUIRED_CONFIRMATION,
                        'ip_address' => $ipAddress,
                    ]);
                }

                return $counts;
            });

            Log::info('Academic Year Reset completed successfully by admin ' . $adminUser->email, [
                'admin_id' => $adminUser->id,
                'archive_file' => $archiveFileName,
                'counts' => $affectedCounts,
            ]);

            $auditReport = [
                'timestamp' => now()->toIso8601String(),
                'admin' => [
                    'id' => $adminUser->id,
                    'name' => $adminUser->name,
                    'email' => $adminUser->email,
                ],
                'archive' => [
                    'file_name' => $archiveFileName,
                    'file_size' => $archiveResult['file_size'] ?? 0,
                    'tables_archived' => count($archiveResult['summary'] ?? []),
                    'details' => $archiveResult['summary'] ?? [],
                ],
                'deleted' => [
                    'students' => $affectedCounts['deleted_students'] ?? 0,
                    'student_sessions' => $affectedCounts['student_sessions'] ?? 0,
                    'student_activity_logs' => $affectedCounts['student_activity_logs'] ?? 0,
                    'student_exams' => $affectedCounts['student_exams'] ?? 0,
                    'student_answers' => $affectedCounts['student_answers'] ?? 0,
                    'exam_violations' => $affectedCounts['exam_violations'] ?? 0,
                    'exam_purchases' => $affectedCounts['exam_purchases'] ?? 0,
                    'enrollments' => $affectedCounts['enrollments'] ?? 0,
                    'video_progresses' => $affectedCounts['video_progresses'] ?? 0,
                    'student_pdf_progresses' => $affectedCounts['student_pdf_progresses'] ?? 0,
                    'video_view_sessions' => $affectedCounts['video_view_sessions'] ?? 0,
                    'student_course_view_limits' => $affectedCounts['student_course_view_limits'] ?? 0,
                    'wallets' => $affectedCounts['wallets'] ?? 0,
                    'wallet_transactions' => $affectedCounts['wallet_transactions'] ?? 0,
                    'financial_records' => ($affectedCounts['payment_histories'] ?? 0) + ($affectedCounts['teacher_earnings'] ?? 0) + ($affectedCounts['platform_earnings'] ?? 0) + ($affectedCounts['teacher_payouts'] ?? 0) + ($affectedCounts['refund_logs'] ?? 0) + ($affectedCounts['purchase_audit_logs'] ?? 0),
                    'notifications' => $affectedCounts['notifications'] ?? 0,
                    'security_events' => $affectedCounts['security_events'] ?? 0,
                ],
                'preserved' => [
                    'teachers' => $preservedTeachersCount,
                    'admins_and_supervisors' => $preservedAdminsCount,
                    'courses' => $preservedCoursesCount,
                    'exams' => $preservedExamsCount,
                    'teacher_activity_logs' => $preservedTeacherLogsCount,
                    'teacher_sessions' => $preservedTeacherSessionsCount,
                ],
            ];

            return [
                'success' => true,
                'status' => 200,
                'message' => 'تمت تهيئة السنة الدراسية الجديدة بنجاح! تم حذف كافة حسابات وسجلات الطلاب السابقة (النشاط، الجلسات، الامتحانات، المحاولات، المخالفات، التقدم، والمشتريات)، وأرشفة السجلات المالية التاريخية، والاحتفاظ بكافة المعلمين والكورسات والمحتوى التعليمي وسجلات المعلمين.',
                'archive_file' => $archiveFileName,
                'affected_counts' => $affectedCounts,
                'audit_report' => $auditReport,
            ];
        } catch (\Throwable $e) {
            Log::error('Academic Year Reset failed with error: ' . $e->getMessage(), [
                'admin_id' => $adminUser->id,
                'exception' => $e,
            ]);

            return [
                'success' => false,
                'status' => 500,
                'message' => 'فشلت عملية تهيئة السنة الدراسية: ' . $e->getMessage(),
            ];
        } finally {
            // Always release lock
            $lock->release();
        }
    }

    /**
     * Create and verify a complete JSON financial & activity archive.
     */
    protected function createFinancialArchive(User $adminUser, string $ipAddress): array
    {
        try {
            $archiveDir = storage_path('app/financial_archives');
            if (!File::exists($archiveDir)) {
                File::makeDirectory($archiveDir, 0755, true);
            }

            $tablesToArchive = [
                'payment_histories',
                'teacher_earnings',
                'platform_earnings',
                'teacher_payouts',
                'wallet_transactions',
                'wallets',
                'student_teacher_credits',
                'refund_logs',
                'purchase_audit_logs',
                'exam_purchases',
                'enrollments',
                'student_exams',
                'student_answers',
                'exam_violations',
                'student_sessions',
                'student_activity_logs',
                'teacher_activity_logs',
                'teacher_sessions',
                'video_progresses',
                'student_pdf_progresses',
                'video_view_sessions',
                'student_course_view_limits',
            ];

            $dump = [
                'metadata' => [
                    'archive_type' => 'academic_year_complete_backup',
                    'timestamp' => now()->toIso8601String(),
                    'year' => (int) date('Y'),
                    'admin_id' => $adminUser->id,
                    'admin_name' => $adminUser->name,
                    'admin_email' => $adminUser->email,
                    'ip_address' => $ipAddress,
                ],
                'summary' => [],
                'tables' => [],
            ];

            foreach ($tablesToArchive as $tableName) {
                if (Schema::hasTable($tableName)) {
                    $rows = DB::table($tableName)->get()->toArray();
                    $dump['tables'][$tableName] = $rows;
                    $dump['summary'][$tableName . '_count'] = count($rows);
                }
            }

            $fileName = 'financial_archive_' . date('Y_m_d_His') . '_' . uniqid() . '.json';
            $filePath = $archiveDir . DIRECTORY_SEPARATOR . $fileName;

            $jsonContent = json_encode($dump, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if ($jsonContent === false) {
                return ['success' => false, 'error' => 'فشل تحويل البيانات إلى تنسيق JSON.'];
            }

            $writtenBytes = File::put($filePath, $jsonContent);
            if ($writtenBytes === false || $writtenBytes <= 0) {
                return ['success' => false, 'error' => 'تعذر كتابة ملف الأرشيف على القرص.'];
            }

            // Verify file existence and readability
            if (!File::exists($filePath) || File::size($filePath) <= 0) {
                return ['success' => false, 'error' => 'فشل التحقق من سلامة ملف الأرشيف بعد إنشائه.'];
            }

            return [
                'success' => true,
                'file_path' => $filePath,
                'file_name' => $fileName,
                'file_size' => $writtenBytes,
                'summary' => $dump['summary'],
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
