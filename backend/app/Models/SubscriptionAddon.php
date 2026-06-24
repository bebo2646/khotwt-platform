<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionAddon extends Model
{
    protected $fillable = [
        'teacher_subscription_id',
        'type', // 'storage', 'codes'
        'amount',
        'price_egp',
    ];

    public function subscription()
    {
        return $this->belongsTo(TeacherSubscription::class, 'teacher_subscription_id');
    }
}
