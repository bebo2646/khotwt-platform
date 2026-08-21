<?php

namespace App\Services;

use App\Models\User;
use App\Models\TeacherSubscription;
use App\Models\TeacherEarning;
use App\Models\PlatformEarning;
use App\Models\PaymentHistory;
use App\Models\PurchaseAuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class RevenueSharingService
{
    /**
     * Process a purchase or code activation, split revenue, and record financials.
     */
    public static function handlePurchase(
        $studentId,
        $teacherId,
        $amount,
        $courseId = null,
        $packageId = null,
        $lessonId = null,
        $purchaseCodeId = null,
        $paymentMethod = 'wallet',
        $examId = null,
        $originalPrice = null,
        $discountAmount = 0.00
    ) {
        $amount = (float)$amount;
        if ($amount <= 0) {
            // Still log free items as zero earnings records for completeness
            $amount = 0.00;
        }

        try {
            DB::beginTransaction();

            $subscription = TeacherSubscription::where('teacher_id', $teacherId)->with('plan')->first();
            
            $commissionPercent = 0.00;
            $isRevenueShare = false;
            $autoExpand = false;

            if ($subscription && $subscription->plan) {
                if ($subscription->plan->billing_type === 'revenue_sharing') {
                    $commissionPercent = (float)($subscription->plan->commission_percentage ?? 20.00);
                    $isRevenueShare = true;
                    $autoExpand = (bool)($subscription->auto_expand_storage ?? true);
                }
            }

            $platformAmount = round($amount * ($commissionPercent / 100), 2);
            $teacherAmount = round($amount - $platformAmount, 2);

            $storedOriginalPrice = $originalPrice !== null ? (float)$originalPrice : $amount;
            $storedDiscountAmount = (float)$discountAmount;

            // 1. Create Teacher Earning record
            $teacherEarning = TeacherEarning::create([
                'teacher_id' => $teacherId,
                'amount' => $teacherAmount,
                'course_id' => $courseId,
                'package_id' => $packageId,
                'lesson_id' => $lessonId,
                'exam_id' => $examId,
                'purchase_code_id' => $purchaseCodeId,
                'student_id' => $studentId,
                'source' => $purchaseCodeId ? 'code_activation' : 'direct_purchase',
                'status' => 'pending', // Pending payout
            ]);

            // 2. Create Platform Earning record
            $platformEarning = PlatformEarning::create([
                'teacher_id' => $teacherId,
                'amount' => $platformAmount,
                'course_id' => $courseId,
                'package_id' => $packageId,
                'lesson_id' => $lessonId,
                'exam_id' => $examId,
                'purchase_code_id' => $purchaseCodeId,
                'student_id' => $studentId,
                'source' => $purchaseCodeId ? 'code_activation' : 'direct_purchase',
            ]);

            // 3. Create Payment History record with price snapshot
            $paymentHistory = PaymentHistory::create([
                'student_id' => $studentId,
                'teacher_id' => $teacherId,
                'amount' => $amount,
                'original_price' => $storedOriginalPrice,
                'discount_amount' => $storedDiscountAmount,
                'commission_rate' => $commissionPercent,
                'course_id' => $courseId,
                'package_id' => $packageId,
                'lesson_id' => $lessonId,
                'exam_id' => $examId,
                'purchase_code_id' => $purchaseCodeId,
                'payment_method' => $paymentMethod,
                'status' => 'paid',
            ]);

            // 4. Create Audit Log
            $student = User::find($studentId);
            $teacher = User::find($teacherId);
            $actionStr = $purchaseCodeId 
                ? "تفعيل كود شراء بقيمة {$amount} ج.م" 
                : "شراء مباشر من المحفظة بقيمة {$amount} ج.م";

            PurchaseAuditLog::create([
                'user_id' => $studentId,
                'action' => $actionStr,
                'details' => json_encode([
                    'student_name' => $student ? $student->name : 'Unknown',
                    'teacher_name' => $teacher ? $teacher->name : 'Unknown',
                    'amount' => $amount,
                    'original_price' => $storedOriginalPrice,
                    'discount_amount' => $storedDiscountAmount,
                    'commission_percent' => $commissionPercent,
                    'platform_share' => $platformAmount,
                    'teacher_share' => $teacherAmount,
                    'course_id' => $courseId,
                    'package_id' => $packageId,
                    'lesson_id' => $lessonId,
                    'exam_id' => $examId,
                    'purchase_code_id' => $purchaseCodeId,
                ], JSON_UNESCAPED_UNICODE),
                'ip_address' => request()->ip(),
            ]);

            // 5. Storage Auto-expansion logic
            if ($isRevenueShare && $autoExpand && $amount > 0) {
                // Growth rate: 0.1 GB for every 10 EGP of purchase (1 GB for every 100 EGP)
                $gbIncrease = $amount * 0.01;
                $subscription->increment('allocated_storage_from_sales', $gbIncrease);
                
                Log::info("Storage auto-expanded for Teacher ID {$teacherId} by {$gbIncrease} GB due to sale of amount {$amount}.");
            }

            DB::commit();
            return true;
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Error in RevenueSharingService::handlePurchase: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'params' => func_get_args()
            ]);
            return false;
        }
    }
}
