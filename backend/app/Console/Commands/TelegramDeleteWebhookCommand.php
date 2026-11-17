<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\TelegramService;

class TelegramDeleteWebhookCommand extends Command
{
    protected $signature = 'telegram:delete-webhook {--drop-pending : Drop all pending updates}';

    protected $description = 'Remove the Telegram Webhook registration';

    public function handle(TelegramService $telegram): int
    {
        if (!$telegram->isConfigured()) {
            $this->error('TELEGRAM_BOT_TOKEN is not configured in .env');
            return Command::FAILURE;
        }

        $dropPending = (bool) $this->option('drop-pending');
        $result = $telegram->deleteWebhook($dropPending);

        if ($result['ok'] ?? false) {
            $this->info("✅ Webhook removed successfully: " . ($result['description'] ?? 'OK'));
            return Command::SUCCESS;
        }

        $this->error("❌ Failed to delete webhook: " . ($result['description'] ?? 'Unknown error'));
        return Command::FAILURE;
    }
}
