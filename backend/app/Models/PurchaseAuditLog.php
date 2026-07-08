<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PurchaseAuditLog extends Model
{
    use HasFactory;

    protected $table = 'purchase_audit_logs';

    protected $fillable = [
        'user_id',
        'action',
        'details',
        'ip_address',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
