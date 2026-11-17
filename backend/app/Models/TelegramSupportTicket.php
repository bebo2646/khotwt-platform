<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TelegramSupportTicket extends Model
{
    protected $table = 'telegram_support_tickets';

    protected $fillable = [
        'ticket_code',
        'telegram_user_id',
        'user_id',
        'category',
        'category_name',
        'status', // open, in_progress, closed
        'subject',
        'last_reply_by', // user, admin
        'closed_at',
    ];

    protected $casts = [
        'closed_at' => 'datetime',
    ];

    public const STATUS_OPEN = 'open';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_CLOSED = 'closed';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function telegramUser(): BelongsTo
    {
        return $this->belongsTo(TelegramUser::class, 'telegram_user_id', 'telegram_user_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(TelegramSupportMessage::class, 'ticket_id')->orderBy('created_at', 'asc');
    }

    public static function generateTicketCode(): string
    {
        do {
            $code = 'TKT-' . date('y') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
        } while (self::where('ticket_code', $code)->exists());

        return $code;
    }
}
