<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignDelivery extends Model
{
    use HasFactory;

    protected $table = 'campaign_deliveries';

    protected $fillable = [
        'campaign_id',
        'telegram_account_id', // References telegram_users.id (internal DB ID)
        'status', // pending, sent, failed, clicked, converted
        'error_message',
        'sent_at',
        'clicked_at',
        'converted_at',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'clicked_at' => 'datetime',
        'converted_at' => 'datetime',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(MarketingCampaign::class, 'campaign_id');
    }

    public function telegramUser(): BelongsTo
    {
        return $this->belongsTo(TelegramUser::class, 'telegram_account_id');
    }
}
