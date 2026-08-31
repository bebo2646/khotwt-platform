<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    protected $table = 'departments';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'icon',
        'badge',
        'order',
        'is_active',
    ];

    protected $casts = [
        'order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function courses(): HasMany
    {
        return $this->hasMany(Course::class, 'category', 'slug');
    }

    public function teachers(): HasMany
    {
        return $this->hasMany(User::class, 'category', 'slug')->where('role', 'teacher');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('order', 'asc');
    }
}
