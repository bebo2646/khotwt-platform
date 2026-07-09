<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeacherSubscription extends Model
{
    protected $fillable = [
        'teacher_id',
        'plan_id',
        'start_date',
        'end_date',
        'status', // Active, Expiring Soon, Expired, Suspended
        'used_storage_bytes',
        'used_codes',
        'billing_period',
        'billing_cycle',
        'discount_percentage',
        'discount_amount',
        'final_price',
        'allocated_storage_from_sales',
        'auto_expand_storage',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'used_storage_bytes' => 'integer',
        'used_codes' => 'integer',
        'discount_percentage' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'final_price' => 'decimal:2',
        'allocated_storage_from_sales' => 'float',
        'auto_expand_storage' => 'boolean',
    ];

    protected $appends = [
        'extra_storage_gb',
        'extra_codes',
        'total_storage_gb',
        'total_codes',
        'remaining_storage_gb',
        'remaining_codes',
        'storage_percentage',
    ];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function plan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }

    public function addons()
    {
        return $this->hasMany(SubscriptionAddon::class, 'teacher_subscription_id');
    }

    public function payments()
    {
        return $this->hasMany(SubscriptionPayment::class, 'teacher_subscription_id');
    }

    public function resourceOverride()
    {
        return $this->hasOne(TeacherResourceOverride::class, 'teacher_id', 'teacher_id');
    }

    // Accessors
    public function getUsedCodesAttribute()
    {
        $courseIds = \App\Models\Course::where('teacher_id', $this->teacher_id)->pluck('id');
        return \App\Models\Enrollment::whereIn('course_id', $courseIds)
            ->join('users', 'enrollments.student_id', '=', 'users.id')
            ->where('users.status', 'active')
            ->where('users.role', 'student')
            ->distinct('enrollments.student_id')
            ->count('enrollments.student_id');
    }

    public function getUsedStorageBytesAttribute()
    {
        return (int) \App\Models\Video::whereHas('lesson.unit.course', function ($q) {
            $q->where('teacher_id', $this->teacher_id);
        })->sum('storage_size');
    }

    public function getExtraStorageGbAttribute()
    {
        $addonSum = (float) ($this->addons()->where('type', 'storage')->sum('amount') ?? 0);
        $overrideStorage = $this->resourceOverride ? (float) $this->resourceOverride->extra_storage_gb : 0;
        $salesStorage = (float) ($this->allocated_storage_from_sales ?? 0);
        return $addonSum + $overrideStorage + $salesStorage;
    }

    public function getExtraCodesAttribute()
    {
        $addonSum = (int) ($this->addons()->where('type', 'codes')->sum('amount') ?? 0);
        $overrideCodes = $this->resourceOverride ? (int) $this->resourceOverride->extra_student_codes : 0;
        return $addonSum + $overrideCodes;
    }

    public function getIncludedStorageGbAttribute()
    {
        if (!$this->plan) return 0.0;
        return $this->plan->billing_type === 'revenue_sharing'
            ? (float) $this->plan->default_storage_gb
            : (float) $this->plan->video_storage_gb;
    }

    public function getIncludedCodesAttribute()
    {
        if (!$this->plan) return 0;
        if ($this->plan->codes_limit_type === 'unlimited') {
            return null;
        }
        return (int) ($this->plan->max_codes_limit ?? $this->plan->student_codes ?? 0);
    }

    public function getTotalStorageGbAttribute()
    {
        return $this->getIncludedStorageGbAttribute() + $this->getExtraStorageGbAttribute();
    }

    public function getTotalStorageBytesAttribute()
    {
        return $this->getTotalStorageGbAttribute() * 1024 * 1024 * 1024;
    }

    public function getTotalCodesAttribute()
    {
        $included = $this->getIncludedCodesAttribute();
        if (is_null($included)) {
            return null;
        }
        return $included + $this->getExtraCodesAttribute();
    }

    public function getRemainingStorageBytesAttribute()
    {
        $totalBytes = $this->getTotalStorageBytesAttribute();
        $usedBytes = $this->used_storage_bytes;
        return max(0, $totalBytes - $usedBytes);
    }

    public function getRemainingStorageGbAttribute()
    {
        $usedGb = round($this->used_storage_bytes / (1024 * 1024 * 1024), 2);
        return max(0, round($this->getTotalStorageGbAttribute() - $usedGb, 2));
    }

    public function getRemainingCodesAttribute()
    {
        $total = $this->getTotalCodesAttribute();
        if (is_null($total)) {
            return null;
        }
        return max(0, $total - $this->used_codes);
    }

    public function getStoragePercentageAttribute()
    {
        $totalGb = $this->getTotalStorageGbAttribute();
        if ($totalGb <= 0) return 0;
        $usedGb = $this->used_storage_bytes / (1024 * 1024 * 1024);
        return min(100, round(($usedGb / $totalGb) * 100, 1));
    }

    public function getGracePeriodDays()
    {
        $settings = \App\Models\PlatformSetting::first();
        return $settings ? (int)$settings->grace_period_days : 7;
    }

    public function calculateStatusDetails()
    {
        $today = \Carbon\Carbon::today();
        $endDate = \Carbon\Carbon::parse($this->end_date);
        
        $graceDays = $this->getGracePeriodDays();
        $graceEndDate = $endDate->copy()->addDays($graceDays);
        
        $status = 'Active';
        if ($today->gt($endDate)) {
            if ($today->lte($graceEndDate)) {
                $status = 'Grace Period';
            } else {
                $status = 'Expired';
            }
        }
        
        // Persist status if necessary
        if ($this->status !== $status && $this->exists) {
            $this->status = $status;
            $this->save();
        }
        
        $remainingActiveDays = max(0, $today->diffInDays($endDate, false));
        $remainingGraceDays = 0;
        if ($today->gt($endDate) && $today->lte($graceEndDate)) {
            $remainingGraceDays = max(0, $today->diffInDays($graceEndDate, false));
        }

        return [
            'status' => $status,
            'remaining_days' => $remainingActiveDays,
            'grace_period_days' => $graceDays,
            'remaining_grace_days' => $remainingGraceDays,
            'is_active' => ($status === 'Active'),
            'is_grace' => ($status === 'Grace Period'),
            'is_expired' => ($status === 'Expired'),
        ];
    }
}
