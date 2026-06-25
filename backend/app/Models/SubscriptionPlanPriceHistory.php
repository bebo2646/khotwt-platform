<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlanPriceHistory extends Model
{
    protected $table = 'subscription_plan_price_history';

    public $timestamps = false; // we only store created_at timestamp

    protected $fillable = [
        'plan_id',
        'old_price',
        'new_price',
        'changed_by'
    ];

    protected $casts = [
        'old_price' => 'decimal:2',
        'new_price' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public function plan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
