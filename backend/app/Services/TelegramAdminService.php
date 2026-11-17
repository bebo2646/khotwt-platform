<?php

namespace App\Services;

class TelegramAdminService extends TelegramService
{
    public function __construct(?string $botToken = null)
    {
        // Use ADMIN_TELEGRAM_BOT_TOKEN with safe fallback to user bot token during setup
        $token = $botToken 
            ?: (config('services.admin_telegram.bot_token') 
            ?: (env('ADMIN_TELEGRAM_BOT_TOKEN') 
            ?: config('services.telegram.bot_token')));

        parent::__construct($token);
    }

    /**
     * Get admin bot username.
     */
    public function getBotUsername(): string
    {
        return config('services.admin_telegram.bot_username') 
            ?: (env('ADMIN_TELEGRAM_BOT_USERNAME') 
            ?: 'AdminBot');
    }

    /**
     * Check if dedicated admin bot token is configured.
     */
    public function hasDedicatedToken(): bool
    {
        return !empty(config('services.admin_telegram.bot_token')) 
            || !empty(env('ADMIN_TELEGRAM_BOT_TOKEN'));
    }
}
