<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class IpSecurityBlock extends Model
{
    protected $table = 'ip_security_blocks';

    protected $fillable = [
        'ip_address',
        'failed_attempts',
        'first_attempt_at',
        'last_attempt_at',
        'blocked_at',
        'blocked_until',
        'is_blocked',
        'reason',
        'last_identifier',
        'user_agent',
    ];

    protected $casts = [
        'failed_attempts' => 'integer',
        'first_attempt_at' => 'datetime',
        'last_attempt_at' => 'datetime',
        'blocked_at' => 'datetime',
        'blocked_until' => 'datetime',
        'is_blocked' => 'boolean',
    ];

    /**
     * Check if the IP block is active right now.
     */
    public function isCurrentlyBlocked(): bool
    {
        if (!$this->is_blocked) {
            return false;
        }

        if ($this->blocked_until && Carbon::now()->gte($this->blocked_until)) {
            // Block duration has expired
            return false;
        }

        return true;
    }

    /**
     * Remaining seconds of block.
     */
    public function remainingBlockedSeconds(): int
    {
        if (!$this->isCurrentlyBlocked() || !$this->blocked_until) {
            return 0;
        }

        return max(0, Carbon::now()->diffInSeconds($this->blocked_until, false));
    }

    /**
     * Remaining minutes of block.
     */
    public function remainingBlockedMinutes(): int
    {
        $secs = $this->remainingBlockedSeconds();
        return (int) ceil($secs / 60);
    }

    /**
     * Unblock this IP and reset counters.
     */
    public function unblock(): void
    {
        $this->update([
            'is_blocked' => false,
            'failed_attempts' => 0,
            'blocked_at' => null,
            'blocked_until' => null,
            'reason' => null,
        ]);
    }

    /**
     * Scope: Currently active blocks.
     */
    public function scopeCurrentlyBlocked($query)
    {
        return $query->where('is_blocked', true)
                     ->where('blocked_until', '>', Carbon::now());
    }
}
