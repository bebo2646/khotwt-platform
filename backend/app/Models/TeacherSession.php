<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Carbon\Carbon;

class TeacherSession extends Model
{
    use HasFactory;

    protected $table = 'teacher_sessions';

    protected $fillable = [
        'teacher_id',
        'session_identifier',
        'ip_address',
        'user_agent',
        'device_type',
        'browser',
        'current_page',
        'current_action',
        'started_at',
        'last_activity_at',
        'ended_at',
        'is_active',
        'duration_seconds',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'ended_at' => 'datetime',
        'is_active' => 'boolean',
        'duration_seconds' => 'integer',
    ];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    /**
     * Scope for sessions active now (heartbeat within $minutes threshold).
     */
    public function scopeActiveNow($query, int $minutes = 5)
    {
        return $query->where('is_active', true)
            ->where('last_activity_at', '>=', Carbon::now()->subMinutes($minutes));
    }

    /**
     * Scope for sessions active today.
     */
    public function scopeToday($query)
    {
        return $query->whereDate('started_at', Carbon::today())
            ->orWhereDate('last_activity_at', Carbon::today());
    }
}
