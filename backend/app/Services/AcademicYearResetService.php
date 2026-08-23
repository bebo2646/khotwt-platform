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
        if (!$adminUser->is_super_admin && !$adminUser->is_super && !$adminUser->hasPermission('academic_year.initialize')) {
            return [
                'success' => false,
                'status' => 403,
                'message' => 'عذراً، ليس لديك الصلاحية المطلوبة (academic_year.initialize) لتهيئة السنة الدراسية الجديدة.',
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

            // 5. Execute destructive reset inside a database transaction
            $affectedCounts = DB::transaction(function () use ($adminUser, $ipAddress, $archiveFileName) {
                $counts = [];

                // 5.1. Retrieve student IDs
                $studentIds = DB::table('users')->where('role', 'student')->pluck('id')->toArray();
                $counts['students_count'] = count($studentIds);

                // 5.2. Delete Exam Interactions: student_answers -> student_exams
                if (Schema::hasTable('student_answers')) {
                    $counts['student_answers'] = DB::table('student_answers')->delete();
                }
                if (Schema::hasTable('student_exams')) {
                    $counts['student_exams'] = DB::table('student_exams')->delete();
                }

                // 5.3. Delete Exam Purchases
                if (Schema::hasTable('exam_purchases')) {
                    $counts['exam_purchases'] = DB::table('exam_purchases')->delete();
                }

                // 5.4. Delete Student Learning Progress & View Sessions
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

                // 5.5. Delete Course & Bundle Enrollments
                if (Schema::hasTable('enrollments')) {
                    $counts['enrollments'] = DB::table('enrollments')->delete();
                }

                // 5.6. Delete Operational Financial Records
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

                // 5.7. Delete Student Wallets & Wallet Transactions
                if (Schema::hasTable('wallet_transactions')) {
                    $counts['wallet_transactions'] = DB::table('wallet_transactions')->delete();
                }
                if (Schema::hasTable('wallets')) {
                    $counts['wallets'] = DB::table('wallets')->delete();
                }

                // 5.8. Delete Notifications: notification_reads before notifications
                if (Schema::hasTable('notification_reads')) {
                    $counts['notification_reads'] = DB::table('notification_reads')->delete();
                }
                if (Schema::hasTable('notifications')) {
                    $counts['notifications'] = DB::table('notifications')->delete();
                }

                // 5.9. Reset Purchase Codes usage linkage
                if (Schema::hasTable('purchase_codes')) {
                    $counts['purchase_codes_reset'] = DB::table('purchase_codes')->update([
                        'is_redeemed' => false,
                        'redeemed_by' => null,
                        'redeemed_at' => null,
                    ]);
                }

                // 5.10. Delete Sessions and Personal Access Tokens for students
                if (!empty($studentIds)) {
                    if (Schema::hasTable('sessions')) {
                        DB::table('sessions')->whereIn('user_id', $studentIds)->delete();
                    }
                    if (Schema::hasTable('personal_access_tokens')) {
                        DB::table('personal_access_tokens')
                            ->whereIn('tokenable_id', $studentIds)
                            ->where('tokenable_type', 'App\\Models\\User')
                            ->delete();
                    }
                }
                if (Schema::hasTable('sessions')) {
                    DB::table('sessions')->whereNull('user_id')->delete();
                }
                if (Schema::hasTable('password_reset_tokens')) {
                    DB::table('password_reset_tokens')->delete();
                }

                // 5.11. Delete Student Accounts
                $counts['deleted_students'] = DB::table('users')->where('role', 'student')->delete();

                // 5.12. Record Activity & Financial Audit Logs
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
                        'new_value' => 'Clean Academic Year Initialized (0.00 EGP Balances)',
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

            return [
                'success' => true,
                'status' => 200,
                'message' => 'تمت تهيئة السنة الدراسية الجديدة بنجاح! تم أرشفة السجلات المالية التاريخية، وتصفير الأرصدة والاشتراكات، والاحتفاظ بكافة المعلمين والكورسات والمحتوى التعليمي.',
                'archive_file' => $archiveFileName,
                'affected_counts' => $affectedCounts,
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
     * Create and verify a complete JSON financial archive.
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
            ];

            $dump = [
                'metadata' => [
                    'archive_type' => 'academic_year_financial_backup',
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
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
