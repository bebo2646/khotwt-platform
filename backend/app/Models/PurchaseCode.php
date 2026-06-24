<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PurchaseCode extends Model
{
    use HasFactory;

    protected $table = 'purchase_codes';

    protected $fillable = [
        'code',
        'type', // wallet, course
        'amount',
        'course_id',
        'package_id',
        'teacher_id',
        'is_redeemed',
        'redeemed_by',
        'redeemed_at',
        'expires_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'is_redeemed' => 'boolean',
        'redeemed_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function package()
    {
        return $this->belongsTo(Package::class);
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function redeemedBy()
    {
        return $this->belongsTo(User::class, 'redeemed_by');
    }
}
