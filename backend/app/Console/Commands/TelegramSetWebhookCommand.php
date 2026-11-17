<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\TelegramService;
use App\Services\TelegramAdminService;

class TelegramSetWebhookCommand extends Command
{
    protected $signature = 'telegram:set-webhook 
                            {--bot=user : Target bot: user or admin}
                            {--url= : Full public HTTPS webhook URL} 
                            {--drop-pending : Drop all pending updates}';

    protected $description = 'Register the official Telegram Webhook URL with Secret Token';

    public function handle(): int
    {
        $botType = strtolower((string) $this->option('bot'));
        $isAdmin = ($botType === 'admin');

        $telegram = $isAdmin ? TelegramService::forAdminBot() : TelegramService::forUserBot();

        if (!$telegram->isConfigured()) {
            $tokenVar = $isAdmin ? 'ADMIN_TELEGRAM_BOT_TOKEN' : 'TELEGRAM_BOT_TOKEN';
            $this->error("{$tokenVar} is not configured in .env");
            return Command::FAILURE;
        }

        $appUrl = rtrim(config('app.url'), '/');
        $defaultPath = $isAdmin ? '/api/telegram/admin-webhook' : '/api/telegram/webhook';
        $url = $this->option('url') ?: "{$appUrl}{$defaultPath}";

        if (!str_starts_with($url, 'https://')) {
            $this->warn("Warning: Telegram Webhook requires HTTPS in production. Provided URL: {$url}");
        }

        $secretToken = $isAdmin 
            ? (config('services.admin_telegram.webhook_secret') ?: env('ADMIN_TELEGRAM_WEBHOOK_SECRET'))
            : (config('services.telegram.webhook_secret') ?: env('TELEGRAM_WEBHOOK_SECRET'));

        $dropPending = (bool) $this->option('drop-pending');

        $botLabel = $isAdmin ? 'Admin Bot' : 'User Bot';
        $this->info("Registering webhook for {$botLabel}: {$url}");
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
