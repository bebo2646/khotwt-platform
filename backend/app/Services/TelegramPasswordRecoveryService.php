<?php

namespace App\Services;

use App\Models\TelegramUser;
use App\Models\TelegramPasswordReset;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Carbon\Carbon;

class TelegramPasswordRecoveryService
{
    protected TelegramService $telegramService;

    public function __construct(TelegramService $telegramService)
    {
        $this->telegramService = $telegramService;
    }

    /**
     * Process phone-based password recovery attempt.
     */
    public function processRecoveryContact(TelegramUser $telegramUser, array $contact): array
    {
        $chatId = $telegramUser->telegram_chat_id;
        $fromId = $telegramUser->telegram_user_id;

        // 1. Anti-Spoofing: contact must belong to the sender
        $contactUserId = $contact['user_id'] ?? null;
        if (!$contactUserId || (int)$contactUserId !== (int)$fromId) {
            Log::warning('TelegramPasswordRecovery: Contact spoofing attempt detected', [
                'sender_telegram_id' => $fromId,
                'contact_telegram_id' => $contactUserId,
            ]);

            return [
                'success' => false,
                'error_code' => 'SPOOFED_CONTACT',
                'user_message' => "❌ <b>فشل التحقق الأمني:</b> يجب مشاركة بطاقة جهة الاتصال الخاصة بحسابك فقط عبر الزر الرسمي بالأسفل، ولا يمكن تحويل أو إرسال جهة اتصال شخص آخر.",
            ];
        }

        // 2. Rate Limiting: Max 3 recovery requests per 15 minutes per Telegram user
        $rateLimitKey = 'tg_recovery:' . $fromId;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 3)) {
            $secondsRemaining = RateLimiter::availableIn($rateLimitKey);
            $minutesRemaining = ceil($secondsRemaining / 60);

            Log::warning('TelegramPasswordRecovery: Rate limit exceeded', [
                'telegram_user_id' => $fromId,
                'seconds_remaining' => $secondsRemaining,
            ]);

            return [
                'success' => false,
                'error_code' => 'RATE_LIMITED',
                'user_message' => "⏳ <b>تجاوزت الحد المسموح من المحاولات:</b> يرجى الانتظار لمدة <b>{$minutesRemaining} دقيقة</b> قبل محاولة استعادة كلمة المرور مرة أخرى لحماية حسابك.",
            ];
        }

        RateLimiter::hit($rateLimitKey, 15 * 60);

        // 3. Normalize phone number
        $rawPhone = $contact['phone_number'] ?? '';
        $normalizedPhone = TelegramPhoneService::normalize($rawPhone);
        $searchVariants = TelegramPhoneService::getSearchVariants($rawPhone);

        // 4. Query user strictly by users.phone (NEVER parent_phone)
        $user = User::whereIn('phone', $searchVariants)->first();

        // 5. Security: Strictly exclude Admin from public recovery
        if ($user && $user->role === 'admin') {
            Log::warning('TelegramPasswordRecovery: Admin recovery attempted via public Telegram bot (BLOCKED)', [
                'user_id' => $user->id,
                'telegram_user_id' => $fromId,
            ]);

            return [
                'success' => false,
                'error_code' => 'ADMIN_BLOCKED',
                'user_message' => "⚠️ <b>حساب إداري:</b> لا يمكن استعادة الحسابات الإدارية عبر بوت تيليجرام. يرجى التواصل مع إدارة النظام التقنية مباشرة.",
            ];
        }

        // 6. Security: Cross-Telegram Link Protection
        if ($user) {
            $existingLink = TelegramUser::where('user_id', $user->id)
                ->where('is_linked', true)
                ->first();

            if ($existingLink && (int)$existingLink->telegram_user_id !== (int)$fromId) {
                Log::warning('TelegramPasswordRecovery: Cross-Telegram recovery blocked', [
                    'user_id' => $user->id,
                    'requesting_telegram_id' => $fromId,
                    'linked_telegram_id' => $existingLink->telegram_user_id,
                ]);

                return [
                    'success' => false,
                    'error_code' => 'CROSS_LINKED',
                    'user_message' => "⚠️ <b>حساب مرتبط مسبقاً:</b> هذا الحساب مرتبط بالفعل بحساب Telegram آخر مختلف. لحماية الحساب من أي تلاعب، يرجى التواصل مع الدعم الفني للمنصة لاستعادة الوصول.",
                ];
            }
        }

        // 7. Generic message if user not found or not active
        if (!$user || $user->status !== 'active') {
            Log::info('TelegramPasswordRecovery: User not found or inactive for verified phone', [
                'telegram_user_id' => $fromId,
                'found' => (bool)$user,
            ]);

            return [
                'success' => false,
                'error_code' => 'USER_NOT_ELIGIBLE',
                'user_message' => "❌ لم يتم العثور على حساب طالب أو معلم نشط مسجل برقم الهاتف هذا، أو أن الحساب غير مؤهل للاستعادة عبر تيليجرام.\n\nيرجى التأكد من الرقم المسجل على المنصة أو مراجعة الدعم الفني.",
            ];
        }

        // 8. Generate secure single-use reset token
        $plainToken = bin2hex(random_bytes(32)); // 64 hex characters
        $tokenHash = hash('sha256', $plainToken);
        $expiresAt = Carbon::now()->addMinutes(15);

        DB::transaction(function () use ($user, $fromId, $chatId, $normalizedPhone, $tokenHash, $expiresAt) {
            // Invalidate any existing unused tokens for this user
            TelegramPasswordReset::where('user_id', $user->id)
                ->whereNull('used_at')
                ->update(['used_at' => Carbon::now()]);

            TelegramPasswordReset::create([
                'user_id' => $user->id,
                'telegram_user_id' => $fromId,
                'telegram_chat_id' => $chatId,
                'verified_phone' => $normalizedPhone,
                'token_hash' => $tokenHash,
                'expires_at' => $expiresAt,
            ]);
        });

        // 9. Build secure frontend reset link with fragment identifier (#token=...)
        $baseUrl = TelegramService::getFrontendUrl('reset-password');
        $resetUrl = "{$baseUrl}#token={$plainToken}";

        $message = "🔐 <b>رابط إعادة تعيين كلمة المرور — منصة خطوتك</b>\n\n" .
            "أهلاً بك يا <b>{$user->name}</b>.\n" .
            "تم التحقق بنجاح من رقم هاتفك المسجل في الحساب.\n\n" .
            "اضغط على الرابط التالي لتغيير كلمة المرور:\n" .
            "<a href=\"{$resetUrl}\">🔗 اضغط هنا لتعيين كلمة مرور جديدة</a>\n\n" .
            "⚠️ <b>تنبيهات أمنية هامة:</b>\n" .
            "• الرابط صالح للاستخدام <b>لمرة واحدة فقط</b>.\n" .
            "• صلاحية الرابط تنتهي خلال <b>15 دقيقة</b>.\n" .
            "• لن يطلب منك فريق خطوتك كلمة المرور داخل محادثة تيليجرام مطلقاً.\n" .
            "• إذا لم تطلب هذا الرمز، يرجى تجاهل الرسالة والتواصل مع الدعم.";

        $this->telegramService->sendMessage($chatId, $message);

        return [
            'success' => true,
            'user' => $user,
            'reset_url' => $resetUrl,
            'user_message' => $message,
        ];
    }
}
