<?php

namespace App\Http\Controllers;

use App\Models\TelegramProcessedUpdate;
use App\Services\TelegramAdminUpdateProcessor;
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
}
