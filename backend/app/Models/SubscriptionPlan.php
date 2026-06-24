<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    protected $fillable = ['name', 'video_storage_gb', 'student_codes', 'price_egp'];

    public function subscriptions()
    {
        return $this->hasMany(TeacherSubscription::class, 'plan_id');
    }
}
