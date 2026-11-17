<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TelegramUserActivity extends Model
{
    protected $table = 'telegram_user_activity';

    protected $fillable = [
        'telegram_user_id',
        'action',
        'activity_date',
    ];

    protected $casts = [
        'activity_date' => 'date',
    ];

    public static function recordActivity(int|string $telegramUserId, string $action = 'interaction'): void
    {
        try {
            $today = date('Y-m-d');
            self::firstOrCreate(
                [
                    'telegram_user_id' => $telegramUserId,
                    'activity_date' => $today,
                    'action' => $action,
                ]
            );
        } catch (\Throwable $e) {
            // Silently ignore unique race conditions
        }
    }
}
