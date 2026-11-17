<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class TelegramLinkToken extends Model
{
    use HasFactory;

    protected $table = 'telegram_link_tokens';

    protected $fillable = [
        'user_id',
        'token_hash',
        'expires_at',
        'used_at',
        'ip_address',
    ];

    protected $casts = [
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
