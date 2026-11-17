<?php

namespace App\Http\Controllers;

use App\Models\TelegramProcessedUpdate;
use App\Models\TelegramSupportTicket;
use App\Models\TelegramUser;
use App\Services\TelegramAdminDashboardService;
use App\Services\TelegramAdminService;
use App\Services\TelegramAdminUpdateProcessor;
use App\Services\TelegramService;
use App\Services\TelegramSupportService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Exception;

class TelegramAdminWebhookController extends Controller
{
    protected TelegramAdminUpdateProcessor $processor;

    public function __construct(TelegramAdminUpdateProcessor $processor)
    {
        $this->processor = $processor;
    }

    /**
     * Handle incoming official Telegram Admin Webhook update.
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        // 1. Enforce POST method only
        if (!$request->isMethod('post')) {
            return response()->json(['error' => 'Method Not Allowed'], 405);
        }

        // 2. Strict validation of X-Telegram-Bot-Api-Secret-Token
        $configuredSecret = config('services.admin_telegram.webhook_secret') 
            ?: (env('ADMIN_TELEGRAM_WEBHOOK_SECRET') ?: config('services.telegram.webhook_secret'));
        $incomingSecret = (string) $request->header('X-Telegram-Bot-Api-Secret-Token');

        if (empty($configuredSecret) || empty($incomingSecret) || !hash_equals($configuredSecret, $incomingSecret)) {
            Log::warning('TelegramAdminWebhookController: Unauthorized admin webhook request blocked', [
                'ip' => $request->ip(),
                'has_secret_header' => !empty($incomingSecret),
            ]);
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $payload = $request->all();
        $updateId = $payload['update_id'] ?? null;

        if (!$updateId || !is_numeric($updateId)) {
            return response()->json(['error' => 'Invalid update_id'], 400);
        }

        $updateId = (int) $updateId;

        // 3. Transactional Outbox Pattern & Atomic Deduplication for Admin Bot
        try {
            $updateRecord = DB::transaction(function () use ($updateId, $payload) {
                $existing = TelegramProcessedUpdate::where('bot_type', TelegramProcessedUpdate::BOT_ADMIN)
                    ->where('update_id', $updateId)
                    ->lockForUpdate()
                    ->first();
                if ($existing) {
                    return $existing;
                }

                $chatId = $payload['message']['chat']['id'] 
                    ?? ($payload['callback_query']['message']['chat']['id'] ?? null);
                $telegramUserId = $payload['message']['from']['id'] 
                    ?? ($payload['callback_query']['from']['id'] ?? null);

                return TelegramProcessedUpdate::create([
                    'bot_type' => TelegramProcessedUpdate::BOT_ADMIN,
                    'update_id' => $updateId,
                    'chat_id' => $chatId,
                    'telegram_user_id' => $telegramUserId,
                    'status' => TelegramProcessedUpdate::STATUS_PENDING,
                    'payload' => $payload,
                ]);
            });

            // If already processed, drop duplicate immediately
            if ($updateRecord->isProcessed()) {
                Log::info("TelegramAdminWebhookController: Update [{$updateId}] already processed, dropping duplicate.");
                return response()->json(['ok' => true, 'duplicate' => true], 200);
            }

            // If in-flight and recently active, skip duplicate dispatch
            if ($updateRecord->isProcessing() && $updateRecord->updated_at && $updateRecord->updated_at->diffInSeconds(now()) < 60) {
                Log::info("TelegramAdminWebhookController: Update [{$updateId}] is currently in-flight, skipping duplicate dispatch.");
                return response()->json(['ok' => true, 'duplicate' => true], 200);
            }

            // 4. Reliable Direct Processing via TelegramAdminUpdateProcessor
            $updateRecord->markAsProcessing();
            try {
                $this->processor->process($payload);
                $updateRecord->markAsProcessed();
            } catch (\Throwable $jobEx) {
                $updateRecord->markAsFailed($jobEx->getMessage());
                Log::error("TelegramAdminWebhookController: Processing exception for update [{$updateId}]", [
                    'error' => $jobEx->getMessage(),
                ]);
            }

            return response()->json(['ok' => true], 200);
        } catch (Exception $e) {
            Log::error("TelegramAdminWebhookController: Failed to handle webhook update [{$updateId}]", [
                'error' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    /**
     * Diagnostic & Setup verification endpoint (Secured with APP_KEY hash).
     */
    public function verifyAndSetup(Request $request): JsonResponse
    {
        // 1. Strict Authorization check using APP_KEY hash
        $expectedKey = hash('sha256', (string) config('app.key'));
        $incomingKey = (string) $request->header('X-Platform-Setup-Key');

        if (empty($incomingKey) || !hash_equals($expectedKey, $incomingKey)) {
            return response()->json(['error' => 'Unauthorized: Invalid Setup Key'], 403);
        }

        // 2. Read Railway environment variables
        $adminToken = config('services.admin_telegram.bot_token') ?: env('ADMIN_TELEGRAM_BOT_TOKEN');
        $adminUsername = config('services.admin_telegram.bot_username') ?: env('ADMIN_TELEGRAM_BOT_USERNAME');
        $adminSecret = config('services.admin_telegram.webhook_secret') ?: env('ADMIN_TELEGRAM_WEBHOOK_SECRET');
        $adminIds = config('services.admin_telegram.admin_ids') ?: (env('ADMIN_TELEGRAM_IDS') ?: config('services.telegram.admin_ids'));

        $varStatus = [
            'ADMIN_TELEGRAM_BOT_TOKEN' => !empty($adminToken),
            'ADMIN_TELEGRAM_BOT_USERNAME' => !empty($adminUsername),
            'ADMIN_TELEGRAM_WEBHOOK_SECRET' => !empty($adminSecret),
            'ADMIN_TELEGRAM_IDS' => !empty($adminIds),
        ];

        if (empty($adminToken) || empty($adminUsername)) {
            return response()->json([
                'status' => 'FAIL',
                'message' => 'ADMIN_TELEGRAM_BOT_TOKEN or ADMIN_TELEGRAM_BOT_USERNAME is missing from Railway environment.',
                'variables' => $varStatus,
            ], 422);
        }

        // 3. getMe on Admin Bot (STRICT: using dedicated admin token)
        $adminBot = new TelegramAdminService($adminToken);
        $getMe = $adminBot->getMe();
        $isGetMeOk = $getMe['ok'] ?? false;
        $botIdentity = $getMe['result'] ?? [];

        $actualUsername = $botIdentity['username'] ?? '';
        $expectedCleanUsername = ltrim((string) $adminUsername, '@');
        $usernameMatch = strcasecmp($actualUsername, $expectedCleanUsername) === 0;

        // 4 & 5. Register Admin Webhook
        $targetUrl = 'https://khotwt-platform-production.up.railway.app/api/telegram/admin-webhook';
        $setWebhookResult = $adminBot->setWebhook($targetUrl, $adminSecret, false);

        // 6. getWebhookInfo for Admin Bot
        $adminWebhookInfo = $adminBot->getWebhookInfo();

        // 8. getWebhookInfo for Student/User Bot
        $userBot = TelegramService::forUserBot();
        $userWebhookInfo = $userBot->getWebhookInfo();
        $userWebhookUrl = $userWebhookInfo['result']['url'] ?? '';
        $userWebhookOk = ($userWebhookUrl === 'https://khotwt-platform-production.up.railway.app/api/telegram/webhook');

        // 7. Test Admin Dashboard for Admin ID 5219463485
        $dashboardService = app(TelegramAdminDashboardService::class);
        $isAdminAuthorized = $dashboardService->isAdmin(5219463485);

        // Optional: Dispatch test start update internally if requested
        $dashboardDispatched = false;
        if ($request->boolean('dispatch_admin_dashboard') && $isAdminAuthorized) {
            try {
                $telegramAdminUser = TelegramUser::firstOrCreate(
                    ['telegram_user_id' => 5219463485],
                    [
                        'telegram_chat_id' => 5219463485,
                        'admin_chat_id' => 5219463485,
                        'first_name' => 'Eng. Belal',
                        'role' => 'admin',
                    ]
                );
                $dashboardService->showAdminDashboard($telegramAdminUser);
                $dashboardDispatched = true;
            } catch (\Throwable $e) {
                Log::warning('Failed to dispatch test admin dashboard: ' . $e->getMessage());
            }
        }

        // 9. Test complaint notification to admin bot if requested
        $complaintAlertDispatched = false;
        if ($request->boolean('test_complaint_alert')) {
            try {
                $dummyTicket = new TelegramSupportTicket([
                    'ticket_code' => 'TEST-' . rand(1000, 9999),
                    'category' => 'general',
                    'category_name' => 'اختبار النظام الإداري',
                    'subject' => 'شكوى تجريبية للتحقق من وصول الإشعارات',
                    'status' => 'open',
                ]);
                $dummyTicket->id = 999999;
                
                $dummyUser = new TelegramUser([
                    'telegram_user_id' => 123456789,
                    'first_name' => 'طالب تجريبي',
                    'role' => 'student',
                    'phone' => '01000000000',
                ]);

                $supportService = app(TelegramSupportService::class);
                $supportService->notifyAdminNewTicket($dummyTicket, $dummyUser, "هذه رسالة اختبارية للتأكد من وصول إشعار الشكوى إلى بوت الإدارة.");
                $complaintAlertDispatched = true;
            } catch (\Throwable $e) {
                Log::warning('Failed to test complaint alert: ' . $e->getMessage());
            }
        }

        return response()->json([
            'status' => 'SUCCESS',
            'variables' => $varStatus,
            'admin_bot' => [
                'get_me_ok' => $isGetMeOk,
                'name' => $botIdentity['first_name'] ?? null,
                'username' => $actualUsername ? '@' . $actualUsername : null,
                'username_matches' => $usernameMatch,
                'is_bot' => $botIdentity['is_bot'] ?? false,
                'webhook_registration' => $setWebhookResult['description'] ?? (($setWebhookResult['ok'] ?? false) ? 'OK' : 'FAILED'),
                'webhook_url' => $adminWebhookInfo['result']['url'] ?? null,
                'pending_updates' => $adminWebhookInfo['result']['pending_update_count'] ?? 0,
            ],
            'user_bot' => [
                'webhook_url' => $userWebhookUrl,
                'is_intact' => $userWebhookOk,
                'pending_updates' => $userWebhookInfo['result']['pending_update_count'] ?? 0,
            ],
            'admin_test' => [
                'admin_id' => 5219463485,
                'is_authorized' => $isAdminAuthorized,
                'dashboard_dispatched' => $dashboardDispatched,
            ],
            'complaint_alert_dispatched' => $complaintAlertDispatched,
        ]);
    }
}
