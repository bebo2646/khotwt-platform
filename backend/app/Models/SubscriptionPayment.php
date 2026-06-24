<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPayment extends Model
{
    protected $fillable = [
        'teacher_subscription_id',
        'amount',
        'payment_status', // Paid, Pending, Unpaid
        'payment_date',
        'admin_id',
        'admin_name',
        'notes',
    ];

    protected $casts = [
        'payment_date' => 'datetime',
    ];

    public function subscription()
    {
        return $this->belongsTo(TeacherSubscription::class, 'teacher_subscription_id');
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
