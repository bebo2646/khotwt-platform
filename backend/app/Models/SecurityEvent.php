<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class SecurityEvent extends Model
{
    protected $table = 'security_events';

    protected $fillable = [
        'user_id',
        'event_type',
        'severity', // info, low, medium, high, critical
        'ip_address',
        'user_agent',
        'method',
        'path',
        'status_code',
        'request_id',
        'session_identifier',
        'resource_type',
        'resource_id',
        'metadata',
        'occurred_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'occurred_at' => 'datetime',
        'status_code' => 'integer',
        'resource_id' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function scopeToday($query)
    {
        return $query->whereDate('occurred_at', Carbon::today());
    }

    public function scopeSeverity($query, string $severity)
    {
        return $query->where('severity', $severity);
    }

    public function scopeHighSeverity($query)
    {
        return $query->whereIn('severity', ['high', 'critical']);
    }

    public function scopeForIp($query, string $ip)
    {
        return $query->where('ip_address', $ip);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }
}
