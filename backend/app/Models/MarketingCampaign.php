<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class MarketingCampaign extends Model
{
    use HasFactory;

    protected $table = 'marketing_campaigns';

    protected $fillable = [
        'title',
        'description',
        'image_url',
        'offer_type',
        'discount_value',
        'target_audience',
        'target_packages',
        'target_courses',
        'target_plans',
        'max_uses',
        'used_count',
        'max_recipients',
        'start_date',
        'end_date',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
        'target_audience' => 'array',
        'target_packages' => 'array',
        'target_courses' => 'array',
        'target_plans' => 'array',
        'max_uses' => 'integer',
        'used_count' => 'integer',
        'max_recipients' => 'integer',
        'start_date' => 'date',
        'end_date' => 'date',
        'is_active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function giftCodes(): HasMany
    {
        return $this->hasMany(GiftCode::class, 'campaign_id');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(CampaignDelivery::class, 'campaign_id');
    }

    public function isRunning(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $today = Carbon::today();

        if ($this->start_date && $today->lt($this->start_date)) {
            return false;
        }

        if ($this->end_date && $today->gt($this->end_date)) {
            return false;
        }

        if ($this->max_uses !== null && $this->used_count >= $this->max_uses) {
            return false;
        }

        return true;
    }
}
