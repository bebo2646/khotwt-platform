<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GiftCodeRedemption extends Model
{
    use HasFactory;

    protected $table = 'gift_code_redemptions';

    protected $fillable = [
        'gift_code_id',
        'user_id',
        'redeemed_at',
        'ip_address',
        'telegram_chat_id',
        'metadata',
    ];

    protected $casts = [
        'redeemed_at' => 'datetime',
        'telegram_chat_id' => 'integer',
        'metadata' => 'array',
    ];

    public function giftCode(): BelongsTo
    {
        return $this->belongsTo(GiftCode::class, 'gift_code_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
