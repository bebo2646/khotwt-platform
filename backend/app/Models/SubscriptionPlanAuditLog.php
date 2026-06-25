<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlanAuditLog extends Model
{
    protected $table = 'subscription_plan_audit_logs';

    public $timestamps = false; // only created_at timestamp

    protected $fillable = [
        'plan_id',
        'user_id',
        'action',
        'old_values',
        'new_values'
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    public function plan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
