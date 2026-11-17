<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelegramSupportMessage extends Model
{
    protected $table = 'telegram_support_messages';

    protected $fillable = [
        'ticket_id',
        'sender_type', // user, admin
        'sender_telegram_id',
        'sender_user_id',
        'message_text',
        'is_internal_note',
    ];

    protected $casts = [
        'is_internal_note' => 'boolean',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(TelegramSupportTicket::class, 'ticket_id');
    }

    public function senderUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }
}
