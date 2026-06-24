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
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'used_storage_bytes' => 'integer',
        'used_codes' => 'integer',
        'discount_percentage' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'final_price' => 'decimal:2',
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

    public function getExtraStorageGbAttribute()
    {
        return $this->addons()->where('type', 'storage')->sum('amount');
    }

    public function getExtraCodesAttribute()
    {
        return $this->addons()->where('type', 'codes')->sum('amount');
    }

    public function getTotalStorageGbAttribute()
    {
        $planStorage = $this->plan ? $this->plan->video_storage_gb : 0;
        return $planStorage + $this->getExtraStorageGbAttribute();
    }

    public function getTotalStorageBytesAttribute()
    {
        return $this->getTotalStorageGbAttribute() * 1024 * 1024 * 1024;
    }

    public function getTotalCodesAttribute()
    {
        $planCodes = $this->plan ? $this->plan->student_codes : 0;
        return $planCodes + $this->getExtraCodesAttribute();
    }

    public function getRemainingStorageBytesAttribute()
    {
        $totalBytes = $this->getTotalStorageBytesAttribute();
        $usedBytes = $this->used_storage_bytes;
        return max(0, $totalBytes - $usedBytes);
    }

    public function getRemainingStorageGbAttribute()
    {
        return round($this->getRemainingStorageBytesAttribute() / (1024 * 1024 * 1024), 2);
    }

    public function getRemainingCodesAttribute()
    {
        return max(0, $this->getTotalCodesAttribute() - $this->used_codes);
    }

    public function getStoragePercentageAttribute()
    {
        $totalBytes = $this->getTotalStorageBytesAttribute();
        if ($totalBytes <= 0) return 0;
        return min(100, round(($this->used_storage_bytes / $totalBytes) * 100, 1));
    }
}
