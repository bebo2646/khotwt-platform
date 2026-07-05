<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable([
    'maintenance_mode',
    'maintenance_message',
    'maintenance_eta',
])]
class PlatformSetting extends Model
{
    protected $table = 'platform_settings';

    protected $casts = [
        'maintenance_mode' => 'boolean',
    ];
}
