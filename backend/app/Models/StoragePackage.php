<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StoragePackage extends Model
{
    use HasFactory;

    protected $table = 'storage_packages';

    protected $fillable = [
        'name',
        'storage_gb',
        'price',
        'active',
        'sort_order',
    ];

    protected $casts = [
        'storage_gb' => 'integer',
        'price' => 'decimal:2',
        'active' => 'boolean',
        'sort_order' => 'integer',
    ];
}
