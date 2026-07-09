<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable([
    'maintenance_mode',
    'maintenance_message',
    'maintenance_eta',
    'require_student_approval',
    'auto_delete_rejected_accounts',
    'view_limit_enabled',
    'default_max_views',
    'video_threshold_seconds',
    'grace_period_days',
])]
class PlatformSetting extends Model
{
    protected $table = 'platform_settings';

    protected $casts = [
        'maintenance_mode' => 'boolean',
        'require_student_approval' => 'boolean',
        'auto_delete_rejected_accounts' => 'boolean',
        'view_limit_enabled' => 'boolean',
        'default_max_views' => 'integer',
        'video_threshold_seconds' => 'integer',
        'grace_period_days' => 'integer',
    ];
}
