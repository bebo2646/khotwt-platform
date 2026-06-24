<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionRequest extends Model
{
    protected $fillable = [
        'teacher_id',
        'type', // 'plan_upgrade', 'extra_storage', 'extra_codes'
        'requested_plan_id',
        'amount',
        'status', // Pending, Approved, Rejected
        'billing_period',
        'billing_cycle',
        'discount_percentage',
        'discount_amount',
        'final_price',
        'admin_response',
    ];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function requestedPlan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'requested_plan_id');
    }
}
