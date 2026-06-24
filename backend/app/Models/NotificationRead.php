<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificationRead extends Model
{
    protected $fillable = [
        'notification_id',
        'user_id',
        'read_at',
        'is_seen',
        'seen_at',
    ];

    protected $casts = [
        'read_at' => 'datetime',
        'is_seen' => 'boolean',
        'seen_at' => 'datetime',
    ];

    public function notification()
    {
        return $this->belongsTo(Notification::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
