<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'price',
        'currency',
        'duration_in_days',
        'max_courses',
        'max_storage_gb',
        'included_codes',
        'featured',
        'active',
        'sort_order',
        'badge_text',
        'color_theme',
        'durationType',
        'discountPercentage',
        'finalPrice',
        'isActive',
        // Legacy fields for backward compatibility
        'video_storage_gb',
        'student_codes',
        'price_egp',
        'duration_days',
        'is_popular',
        'billing_options',
        // New flexible columns
        'billing_type',
        'commission_percentage',
        'default_storage_gb',
        'codes_limit_type',
        'max_codes_limit',
        'most_popular',
        'recommended',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'duration_in_days' => 'integer',
        'max_courses' => 'integer',
        'max_storage_gb' => 'float',
        'included_codes' => 'integer',
        'featured' => 'boolean',
        'active' => 'boolean',
        'sort_order' => 'integer',
        'durationType' => 'string',
        'discountPercentage' => 'decimal:2',
        'finalPrice' => 'decimal:2',
        'isActive' => 'boolean',
        'billing_options' => 'array',
        'commission_percentage' => 'decimal:2',
        'default_storage_gb' => 'float',
        'max_codes_limit' => 'integer',
        'most_popular' => 'boolean',
        'recommended' => 'boolean',
    ];

    public function subscriptions()
    {
        return $this->hasMany(TeacherSubscription::class, 'plan_id');
    }

    public function priceHistory()
    {
        return $this->hasMany(SubscriptionPlanPriceHistory::class, 'plan_id');
    }

    public function auditLogs()
    {
        return $this->hasMany(SubscriptionPlanAuditLog::class, 'plan_id');
    }

    /**
     * Backward compatibility Accessors & Mutators
     */
    public function getPriceEgpAttribute()
    {
        return $this->price;
    }

    public function setPriceEgpAttribute($value)
    {
        $this->attributes['price'] = $value;
        $this->attributes['price_egp'] = $value;
    }

    public function getVideoStorageGbAttribute()
    {
        return $this->max_storage_gb;
    }

    public function setVideoStorageGbAttribute($value)
    {
        $this->attributes['max_storage_gb'] = $value;
        $this->attributes['video_storage_gb'] = $value;
    }

    public function getStudentCodesAttribute()
    {
        return $this->included_codes;
    }

    public function setStudentCodesAttribute($value)
    {
        $this->attributes['included_codes'] = $value;
        $this->attributes['student_codes'] = $value;
    }

    public function getDurationDaysAttribute()
    {
        return $this->duration_in_days;
    }

    public function setDurationDaysAttribute($value)
    {
        $this->attributes['duration_in_days'] = $value;
        $this->attributes['duration_days'] = $value;
    }

    public function getIsPopularAttribute()
    {
        return $this->featured;
    }

    public function setIsPopularAttribute($value)
    {
        $this->attributes['featured'] = (bool)$value;
        $this->attributes['is_popular'] = (bool)$value;
    }

    public function getIsTrialAttribute()
    {
        return $this->slug === 'starter' || $this->slug === 'free' || $this->price == 0;
    }
}
