<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminActivityLog extends Model
{
    protected $fillable = [
        'admin_name',
        'action_type',
        'deleted_count',
        'ip_address',
    ];
}
