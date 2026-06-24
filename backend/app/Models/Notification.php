<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = [
        'title',
        'message',
        'recipient_type', // 'all', 'students', 'teachers', 'specific_teacher', 'specific_student'
        'recipient_id',
        'sender_id',
        'important',
        'send_to_admin',
    ];

    protected $casts = [
        'important' => 'boolean',
        'send_to_admin' => 'boolean',
    ];

    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function reads()
    {
        return $this->hasMany(NotificationRead::class);
    }
}
