<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\TelegramLinkToken;
use App\Models\TelegramUser;
use App\Models\TelegramPasswordReset;
use App\Models\User;
use App\Services\TelegramService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Carbon\Carbon;

class TelegramAccountController extends Controller
{
    protected TelegramService $telegramService;

    public function __construct(TelegramService $telegramService)
    {
        $this->telegramService = $telegramService;
    }

    /**
     * Generate a short-lived, single-use Deep Link token to link Telegram to Khotwtk account.
     * Route: POST /api/telegram/link-token (auth:sanctum)
     */
    public function generateLinkToken(Request $request): JsonResponse
    {
        $user = $request->user();

        // Rate limit: max 5 tokens per 10 minutes per user
        $rateLimitKey = 'tg_link_token:' . $user->id;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 5)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);
            return response()->json([
                'success' => false,
                'message' => "تجاوزت الحد المسموح. يرجى الانتظار {$seconds} ثانية قبل طلب رمز جديد.",
            ], 429);
        }
        RateLimiter::hit($rateLimitKey, 600);

        // Generate cryptographically secure 64-char token
        $plainToken = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $plainToken);
        $expiresAt = Carbon::now()->addMinutes(15);

        // Invalidate previous unused link tokens for this user
        TelegramLinkToken::where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => Carbon::now()]);

        // Create new link token
        TelegramLinkToken::create([
            'user_id' => $user->id,
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt,
            'ip_address' => $request->ip(),
        ]);

        $botUsername = config('services.telegram.bot_username', 'khatwtk_edu_bot');
        $botUsername = ltrim($botUsername, '@');
        $deepLink = "https://t.me/{$botUsername}?start=link_{$plainToken}";
        $webLink = "https://web.telegram.org/a/#?tgaddr=" . urlencode("resolve?domain={$botUsername}&start=link_{$plainToken}");

        return response()->json([
            'success' => true,
            'deep_link' => $deepLink,
            'web_link' => $webLink,
            'expires_at' => $expiresAt->toIso8601String(),
            'expires_in_seconds' => 900,
        ]);
    }

    /**
     * Unlink Telegram account from Khotwtk user.
     * Route: POST /api/telegram/unlink (auth:sanctum)
     */
    public function unlinkAccount(Request $request): JsonResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($user) {
            $linkedAccounts = TelegramUser::where('user_id', $user->id)
                ->where('is_linked', true)
                ->get();

            foreach ($linkedAccounts as $account) {
                $account->update([
                    'is_linked' => false,
                    'user_id' => null,
                    'role' => 'guest',
                ]);

                // Send courtesy notification to Telegram user
                try {
                    $this->telegramService->sendMessage(
                        $account->telegram_chat_id,
                        "ℹ️ تم إلغاء ربط حساب خطوتك بهذا المعرف بناءً على طلبك من إعدادات المنصة.\nيمكنك إعادة الربط في أي وقت لاحقاً."
                    );
                } catch (\Exception $e) {
                    Log::warning('Failed to send Telegram unlinking notification: ' . $e->getMessage());
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'تم إلغاء ربط حساب Telegram بنجاح.',
        ]);
    }

    /**
     * Get current Telegram link status for authenticated user.
     * Route: GET /api/telegram/status (auth:sanctum)
     */
    public function getLinkStatus(Request $request): JsonResponse
    {
        $user = $request->user();

        $activeLink = TelegramUser::where('user_id', $user->id)
            ->where('is_linked', true)
            ->first();

        return response()->json([
            'is_linked' => (bool)$activeLink,
            'telegram_username' => $activeLink?->telegram_username,
            'linked_at' => $activeLink?->linked_at?->toIso8601String(),
        ]);
    }

    /**
     * Complete password reset using the verified Telegram token.
     * Route: POST /api/telegram/reset-password (Public)
     */
    public function resetPassword(Request $request): JsonResponse
    {
        // Rate limit: max 5 requests per minute per IP
        $rateLimitKey = 'tg_reset_pw_ip:' . $request->ip();
        if (RateLimiter::tooManyAttempts($rateLimitKey, 5)) {
            return response()->json([
                'success' => false,
                'message' => 'عدد محاولات كبير جداً. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.',
            ], 429);
        }
        RateLimiter::hit($rateLimitKey, 60);

        $request->validate([
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ], [
            'token.required' => 'رمز إعادة التعيين مطلوب.',
            'password.required' => 'كلمة المرور الجديدة مطلوبة.',
            'password.min' => 'يجب ألا تقل كلمة المرور عن 8 أحرف.',
            'password.confirmed' => 'تأكيد كلمة المرور غير متطابق.',
        ]);

        $tokenHash = hash('sha256', $request->token);
        $resetRecord = TelegramPasswordReset::where('token_hash', $tokenHash)->first();

        if (!$resetRecord || !$resetRecord->isValid()) {
            return response()->json([
                'success' => false,
                'message' => 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد عبر البوت.',
            ], 422);
        }

        DB::transaction(function () use ($resetRecord, $request) {
            // 1. Mark token as used immediately
            $resetRecord->update([
                'used_at' => Carbon::now(),
                'ip_address' => $request->ip(),
                'user_agent' => substr((string)$request->userAgent(), 0, 500),
            ]);

            // 2. Update user's password
            $user = $resetRecord->user;
            $user->password = Hash::make($request->password);
            $user->save();

            // 3. Invalidate active Sanctum tokens (force re-login everywhere)
            if (method_exists($user, 'tokens')) {
                $user->tokens()->delete();
            }

            // 4. Send security notification to Telegram chat
            try {
                $this->telegramService->sendMessage(
                    $resetRecord->telegram_chat_id,
                    "🔒 <b>تم تغيير كلمة مرور حسابك بنجاح!</b>\n\nتم تحديث كلمة المرور لحسابك في منصة خطوتك.\n\n⚠️ إذا لم تكن أنت من قام بهذا الإجراء، يرجى التواصل فوراً مع الدعم الفني لحماية حسابك."
                );
            } catch (\Exception $e) {
                Log::warning('TelegramAccountController: Notification after PW reset failed: ' . $e->getMessage());
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بحسابك.',
        ]);
    }

    /**
     * Verify whether a reset token is valid before rendering frontend reset form.
     * Route: POST /api/telegram/verify-reset-token (Public)
     */
    public function verifyResetToken(Request $request): JsonResponse
    {
        $token = (string) $request->input('token');

        if (empty($token)) {
            return response()->json(['valid' => false]);
        }

        $tokenHash = hash('sha256', $token);
        $resetRecord = TelegramPasswordReset::where('token_hash', $tokenHash)->first();

        return response()->json([
            'valid' => $resetRecord && $resetRecord->isValid(),
        ]);
    }
}
