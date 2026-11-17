<?php

namespace App\Http\Controllers;

use App\Models\TelegramProcessedUpdate;
use App\Jobs\ProcessTelegramUpdateJob;
use App\Services\TelegramUpdateProcessor;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Exception;

class TelegramWebhookController extends Controller
{
    protected TelegramUpdateProcessor $processor;

    public function __construct(TelegramUpdateProcessor $processor)
    {
        $this->processor = $processor;
    }

    /**
     * Handle incoming official Telegram Webhook update.
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        // 1. Enforce POST method only
        if (!$request->isMethod('post')) {
            return response()->json(['error' => 'Method Not Allowed'], 405);
        }

        // 2. Strict validation of X-Telegram-Bot-Api-Secret-Token
        $configuredSecret = config('services.telegram.webhook_secret');
        $incomingSecret = (string) $request->header('X-Telegram-Bot-Api-Secret-Token');

        if (empty($configuredSecret) || empty($incomingSecret) || !hash_equals($configuredSecret, $incomingSecret)) {
            Log::warning('TelegramWebhookController: Unauthorized webhook request blocked', [
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

        // 3. Transactional Outbox Pattern & Atomic Deduplication
        try {
            $updateRecord = DB::transaction(function () use ($updateId, $payload) {
                $existing = TelegramProcessedUpdate::where('update_id', $updateId)->lockForUpdate()->first();
                if ($existing) {
                    return $existing;
                }

                $chatId = $payload['message']['chat']['id'] 
                    ?? ($payload['callback_query']['message']['chat']['id'] ?? null);
                $telegramUserId = $payload['message']['from']['id'] 
                    ?? ($payload['callback_query']['from']['id'] ?? null);

                return TelegramProcessedUpdate::create([
                    'update_id' => $updateId,
                    'chat_id' => $chatId,
                    'telegram_user_id' => $telegramUserId,
                    'status' => TelegramProcessedUpdate::STATUS_PENDING,
                    'payload' => $payload,
                ]);
            });

            // If already processed, drop duplicate immediately
            if ($updateRecord->isProcessed()) {
                Log::info("TelegramWebhookController: Update [{$updateId}] already processed, dropping duplicate.");
                return response()->json(['ok' => true, 'duplicate' => true], 200);
            }

            // If in-flight and recently active, skip duplicate dispatch
            if ($updateRecord->isProcessing() && $updateRecord->updated_at && $updateRecord->updated_at->diffInSeconds(now()) < 60) {
                Log::info("TelegramWebhookController: Update [{$updateId}] is currently in-flight, skipping duplicate dispatch.");
                return response()->json(['ok' => true, 'duplicate' => true], 200);
            }

            // 4. Reliable Dispatching
            if (config('queue.default') === 'sync') {
                $job = new ProcessTelegramUpdateJob($updateRecord->id);
                $job->handle($this->processor);
            } else {
                ProcessTelegramUpdateJob::dispatch($updateRecord->id);
            }

            return response()->json(['ok' => true], 200);

        } catch (Exception $e) {
            Log::error("TelegramWebhookController: Exception processing update [{$updateId}]", [
                'error' => $e->getMessage(),
            ]);
            // Return 200 so Telegram does not get stuck in infinite retry loops if payload is corrupted
            return response()->json(['ok' => false, 'error' => 'Internal processing error'], 200);
        }
    }
}
