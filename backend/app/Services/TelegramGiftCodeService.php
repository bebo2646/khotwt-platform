<?php

namespace App\Services;

use App\Models\User;
use App\Models\GiftCode;
use App\Models\GiftCodeRedemption;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\Enrollment;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class TelegramGiftCodeService
{
    /**
     * Redeem a gift code for an authenticated user with multi-role eligibility check.
     */
    public function redeem(User $user, string $rawCode): array
    {
        $codeString = strtoupper(trim($rawCode));

        $giftCode = GiftCode::where('code', $codeString)->first();

        if (!$giftCode) {
            return [
                'success' => false,
                'message' => '❌ كود الهدية غير موجود. يرجى التأكد من كتابة الكود بشكل صحيح.',
            ];
        }

        if (!$giftCode->isAvailable()) {
            return [
                'success' => false,
                'message' => '⚠️ هذا الكود منتهي الصلاحية أو استنفد الحد الأقصى لمرات الاستخدام.',
            ];
        }

        if (!$giftCode->isEligibleForUser($user)) {
            return [
                'success' => false,
                'message' => '🚫 هذا الكود غير مخصص لفئتك الحالية على المنصة.',
            ];
        }

        // Check if user already redeemed this code
        $alreadyRedeemed = GiftCodeRedemption::where('gift_code_id', $giftCode->id)
            ->where('user_id', $user->id)
            ->exists();

        if ($alreadyRedeemed) {
            return [
                'success' => false,
                'message' => 'ℹ️ لقد قمت باستخدام هذا الكود مسبقاً لحسابك.',
            ];
        }

        return DB::transaction(function () use ($giftCode, $user) {
            $benefitMessage = '';

            // Apply benefit based on gift_type
            if ($giftCode->gift_type === 'wallet_credit' || empty($giftCode->gift_type)) {
                $amount = (float) $giftCode->benefit_value;
                $wallet = Wallet::firstOrCreate(['student_id' => $user->id], ['balance' => 0.00]);
                
                WalletTransaction::create([
                    'wallet_id' => $wallet->id,
                    'type' => 'recharge',
                    'amount' => $amount,
                    'description' => "شحن رصيد هدية عبر Telegram ({$giftCode->code})",
                    'reference_id' => 'tg_gift_' . $giftCode->id,
                ]);

                $benefitMessage = "تم إضافة رصيد بقيمة <b>{$amount} ج.م</b> إلى محفظتك بنجاح!";
            } elseif ($giftCode->gift_type === 'course_access' && $giftCode->applicable_course_id) {
                Enrollment::firstOrCreate([
                    'student_id' => $user->id,
                    'course_id' => $giftCode->applicable_course_id,
                ], [
                    'enrolled_at' => Carbon::now(),
                ]);

                $courseTitle = $giftCode->applicableCourse ? $giftCode->applicableCourse->title : 'الكورس';
                $benefitMessage = "تم تفعيل اشتراكك في كورس <b>{$courseTitle}</b> بنجاح!";
            } else {
                $benefitMessage = "تم تفعيل مزايا الكود لحسابك بنجاح!";
            }

            // Record redemption
            GiftCodeRedemption::create([
                'gift_code_id' => $giftCode->id,
                'user_id' => $user->id,
                'redeemed_amount' => $giftCode->benefit_value,
                'redeemed_at' => Carbon::now(),
            ]);

            // Increment redemption count
            $giftCode->increment('redemptions_count');
            if ($giftCode->max_redemptions !== null && $giftCode->redemptions_count >= $giftCode->max_redemptions) {
                $giftCode->update(['is_active' => false]);
            }

            return [
                'success' => true,
                'message' => "🎉 <b>مبروك! تم تفعيل كود الهدية:</b>\n\n{$benefitMessage}",
            ];
        });
    }
}
