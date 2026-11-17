<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\TelegramService;
use App\Services\TelegramAdminService;

class TelegramWebhookInfoCommand extends Command
{
    protected $signature = 'telegram:webhook-info {--bot=user : Target bot: user or admin}';

    protected $description = 'Get current Telegram Webhook status and diagnostic info';

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

        $info = $telegram->getWebhookInfo();

        if (!($info['ok'] ?? false)) {
            $this->error('Failed to get webhook info: ' . ($info['description'] ?? 'Unknown error'));
            return Command::FAILURE;
        }

        $result = $info['result'] ?? [];
        $botLabel = $isAdmin ? 'Admin Bot' : 'User Bot';

        $this->info("Telegram Webhook Info for {$botLabel}:");
        $this->table(
            ['Key', 'Value'],
            [
                ['URL', $result['url'] ?? 'None (Not set)'],
                ['Has Custom Certificate', ($result['has_custom_certificate'] ?? false) ? 'Yes' : 'No'],
                ['Pending Update Count', $result['pending_update_count'] ?? 0],
                ['Last Error Date', isset($result['last_error_date']) ? date('Y-m-d H:i:s', $result['last_error_date']) : 'None'],
                ['Last Error Message', $result['last_error_message'] ?? 'None'],
                ['Max Connections', $result['max_connections'] ?? 40],
            ]
        );

        return Command::SUCCESS;
    }
}
