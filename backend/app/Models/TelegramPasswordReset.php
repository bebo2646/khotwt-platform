<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class TelegramPasswordReset extends Model
{
    use HasFactory;

    protected $table = 'telegram_password_resets';

    protected $fillable = [
        'user_id',
        'telegram_user_id',
        'telegram_chat_id',
        'verified_phone',
        'token_hash',
        'expires_at',
        'used_at',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'telegram_user_id' => 'integer',
        'telegram_chat_id' => 'integer',
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function isValid(): bool
    {
        return is_null($this->used_at) && $this->expires_at->isFuture();
    }
}
