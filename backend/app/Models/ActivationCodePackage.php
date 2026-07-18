<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ActivationCodePackage extends Model
{
    use HasFactory;

    protected $table = 'activation_code_packages';

    protected $fillable = [
        'name',
        'number_of_codes',
        'price_per_code',
        'total_price',
        'active',
        'sort_order',
    ];

    protected $casts = [
        'number_of_codes' => 'integer',
        'price_per_code' => 'decimal:2',
        'total_price' => 'decimal:2',
        'active' => 'boolean',
        'sort_order' => 'integer',
    ];
}
