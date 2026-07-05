<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable([
    'enabled_by',
    'enabled_at',
    'disabled_at',
    'duration',
    'message',
])]
class MaintenanceLog extends Model
{
    protected $table = 'maintenance_logs';

    protected $casts = [
        'enabled_at' => 'datetime',
        'disabled_at' => 'datetime',
        'duration' => 'integer',
    ];

    public function admin()
    {
        return $this->belongsTo(User::class, 'enabled_by');
    }
}
