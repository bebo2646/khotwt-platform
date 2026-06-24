<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Wallet extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'balance',
    ];

    protected $casts = [
        'balance' => 'decimal:2',
    ];

    public function getBalanceAttribute($value)
    {
        $recharges = $this->transactions()->whereIn('type', ['recharge', 'refund'])->sum('amount');
        $purchases = $this->transactions()->where('type', 'purchase')->sum('amount');
        return max(0.00, $recharges - $purchases);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function transactions()
    {
        return $this->hasMany(WalletTransaction::class);
    }
}
