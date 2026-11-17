<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\TelegramService;

class TelegramSetWebhookCommand extends Command
{
    protected $signature = 'telegram:set-webhook 
                            {--url= : Full public HTTPS webhook URL (defaults to APP_URL/api/telegram/webhook)} 
                            {--drop-pending : Drop all pending updates}';

    protected $description = 'Register the official Telegram Webhook URL with Secret Token';

    public function handle(TelegramService $telegram): int
    {
        if (!$telegram->isConfigured()) {
            $this->error('TELEGRAM_BOT_TOKEN is not configured in .env');
            return Command::FAILURE;
        }

        $url = $this->option('url');
        if (!$url) {
            $appUrl = rtrim(config('app.url'), '/');
            $url = "{$appUrl}/api/telegram/webhook";
        }

        if (!str_starts_with($url, 'https://')) {
            $this->warn("Warning: Telegram Webhook requires HTTPS in production. Provided URL: {$url}");
        }

        $secretToken = config('services.telegram.webhook_secret');
        $dropPending = (bool) $this->option('drop-pending');

        $this->info("Registering webhook: {$url}");
        if ($secretToken) {
            $this->info("X-Telegram-Bot-Api-Secret-Token is configured.");
        }

        $result = $telegram->setWebhook($url, $secretToken, $dropPending);

        if ($result['ok'] ?? false) {
            $this->info("✅ Webhook set successfully! Description: " . ($result['description'] ?? 'OK'));
            return Command::SUCCESS;
        }

        $this->error("❌ Failed to set webhook: " . ($result['description'] ?? 'Unknown error'));
        return Command::FAILURE;
    }
}
