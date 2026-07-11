<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FinancialAuditLog extends Model
{
    use HasFactory;

    protected $table = 'financial_audit_logs';

    protected $fillable = [
        'admin_id',
        'admin_name',
        'action',
        'previous_value',
        'new_value',
        'reason',
        'ip_address',
    ];

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
