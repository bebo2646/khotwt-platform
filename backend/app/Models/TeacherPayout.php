<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class TeacherPayout extends Model
{
    use HasFactory;

    protected $table = 'teacher_payouts';

    protected $fillable = [
        'teacher_id',
        'amount',
        'status',
        'payout_date',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payout_date' => 'datetime',
    ];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function earnings()
    {
        return $this->hasMany(TeacherEarning::class, 'payout_id');
    }
}
