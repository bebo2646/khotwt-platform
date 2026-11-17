<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class GiftCode extends Model
{
    use HasFactory;

    protected $table = 'gift_codes';

    protected $fillable = [
        'code',
        'campaign_id',
        'target_roles', // Array of roles: e.g. ['student'], ['student', 'teacher'], ['doctor'], ['all']
        'gift_type',
        'benefit_value',
        'applicable_course_id',
        'applicable_plan_id',
        'max_redemptions',
        'redemptions_count',
        'is_multi_use',
        'expires_at',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'target_roles' => 'array',
        'benefit_value' => 'decimal:2',
        'max_redemptions' => 'integer',
        'redemptions_count' => 'integer',
        'is_multi_use' => 'boolean',
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(MarketingCampaign::class, 'campaign_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function applicableCourse(): BelongsTo
    {
        return $this->belongsTo(Course::class, 'applicable_course_id');
    }

    public function applicablePlan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'applicable_plan_id');
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(GiftCodeRedemption::class, 'gift_code_id');
    }

    public function isAvailable(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        if ($this->expires_at && Carbon::now()->gt($this->expires_at)) {
            return false;
        }

        if ($this->max_redemptions !== null && $this->redemptions_count >= $this->max_redemptions) {
            return false;
        }

        return true;
    }

    /**
     * Authoritative backend validation for multi-role targeting eligibility.
     * Supports targeting:
     * - 'all': any authenticated platform user
     * - 'student': school & university students
     * - 'teacher': school teachers (users with role=teacher and category!=university)
     * - 'doctor': university professors/doctors (users with role=teacher and category=university)
     * - Any combination thereof in array e.g. ['student', 'teacher']
     */
    public function isEligibleForUser(User $user): bool
    {
        if (!$this->isAvailable()) {
            return false;
        }

        $roles = is_array($this->target_roles) ? $this->target_roles : ['all'];

        if (in_array('all', $roles, true)) {
            return true;
        }

        if ($user->isStudent() && in_array('student', $roles, true)) {
            return true;
        }

        if ($user->isTeacher()) {
            $isUniversityDoctor = ($user->category === 'university');
            if ($isUniversityDoctor && in_array('doctor', $roles, true)) {
                return true;
            }
            if (!$isUniversityDoctor && in_array('teacher', $roles, true)) {
                return true;
            }
        }

        return false;
    }
}
