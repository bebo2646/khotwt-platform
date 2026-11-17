<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

class TelegramService
{
    protected ?string $botToken;
    protected string $apiUrl;

    public function __construct(?string $botToken = null)
    {
        $this->botToken = $botToken ?: config('services.telegram.bot_token');
        $this->apiUrl = 'https://api.telegram.org/bot' . ($this->botToken ?: 'MISSING_TOKEN');
    }

    /**
     * Check if bot token is configured.
     */
    public function isConfigured(): bool
    {
        return !empty($this->botToken);
    }

    /**
     * Standardize and build official frontend URLs safely.
     * Prevents double scheme (https://https://) or missing slashes.
     */
    public static function getFrontendUrl(string $path = ''): string
    {
        $domain = config('services.telegram.official_frontend_domain') ?: env('OFFICIAL_FRONTEND_DOMAIN', 'khotwtk.com');
        $domain = trim($domain);
        $domain = rtrim($domain, '/');

        if (!preg_match('~^https?://~i', $domain)) {
            $baseUrl = 'https://' . $domain;
        } else {
            $baseUrl = $domain;
        }

        if (!empty($path)) {
            $baseUrl .= '/' . ltrim($path, '/');
        }

        return $baseUrl;
    }

    /**
     * Send a text message to a specific chat.
     */
    public function sendMessage(int|string $chatId, string $text, ?array $replyMarkup = null, string $parseMode = 'HTML'): array
    {
        $payload = [
            'chat_id' => $chatId,
            'text' => $text,
            'parse_mode' => $parseMode,
            'disable_web_page_preview' => false,
        ];

        if ($replyMarkup) {
            $payload['reply_markup'] = $replyMarkup;
        }

        return $this->callApi('sendMessage', $payload);
    }

    /**
     * Send a photo with optional caption.
     */
    public function sendPhoto(int|string $chatId, string $photoUrl, string $caption = '', ?array $replyMarkup = null, string $parseMode = 'HTML'): array
    {
        $payload = [
            'chat_id' => $chatId,
            'photo' => $photoUrl,
            'caption' => $caption,
            'parse_mode' => $parseMode,
        ];

        if ($replyMarkup) {
            $payload['reply_markup'] = $replyMarkup;
        }

        return $this->callApi('sendPhoto', $payload);
    }

    /**
     * Set chat action (typing, upload_photo, etc.).
     */
    public function sendChatAction(int|string $chatId, string $action = 'typing'): array
    {
        return $this->callApi('sendChatAction', [
            'chat_id' => $chatId,
            'action' => $action,
        ]);
    }

    /**
     * Register official Telegram webhook.
     */
    public function setWebhook(string $url, ?string $secretToken = null, bool $dropPendingUpdates = false): array
    {
        $payload = [
            'url' => $url,
            'drop_pending_updates' => $dropPendingUpdates,
            'allowed_updates' => ['message', 'callback_query'],
        ];

        if ($secretToken) {
            $payload['secret_token'] = $secretToken;
        }

        return $this->callApi('setWebhook', $payload);
    }

    /**
     * Get webhook diagnostic information.
     */
    public function getWebhookInfo(): array
    {
        return $this->callApi('getWebhookInfo');
    }

    /**
     * Remove official webhook.
     */
    public function deleteWebhook(bool $dropPendingUpdates = false): array
    {
        return $this->callApi('deleteWebhook', [
            'drop_pending_updates' => $dropPendingUpdates,
        ]);
    }

    /**
     * Verify bot token and get bot identity.
     */
    public function getMe(): array
    {
        return $this->callApi('getMe');
    }

    /**
     * Internal caller with error masking and safe logging (zero secrets logged).
     */
    protected function callApi(string $method, array $params = []): array
    {
        if (!$this->isConfigured()) {
            Log::warning("TelegramService: Bot token is not configured. Method [{$method}] not sent.");
            return ['ok' => false, 'description' => 'Bot token not configured'];
        }

        try {
            $response = Http::timeout(10)->post("{$this->apiUrl}/{$method}", $params);
            $data = $response->json();

            if (!$response->successful() || (isset($data['ok']) && !$data['ok'])) {
                Log::error("TelegramService: API call [{$method}] failed", [
                    'status' => $response->status(),
                    'description' => $data['description'] ?? 'Unknown error',
                    'error_code' => $data['error_code'] ?? null,
                ]);
                return $data ?: ['ok' => false, 'description' => 'HTTP request failed'];
            }

            return $data ?: ['ok' => true];
        } catch (Exception $e) {
            Log::error("TelegramService: Exception during [{$method}]", [
                'message' => $e->getMessage(),
            ]);
            return ['ok' => false, 'description' => $e->getMessage()];
        }
    }
}
