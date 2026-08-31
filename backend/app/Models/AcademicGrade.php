<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademicGrade extends Model
{
    protected $table = 'academic_grades';

    protected $fillable = [
        'stage_id',
        'name',
        'slug',
        'short_code',
        'order',
        'is_active',
    ];

    protected $casts = [
        'stage_id' => 'integer',
        'order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function stage(): BelongsTo
    {
        return $this->belongsTo(AcademicStage::class, 'stage_id');
    }

    public function courses(): HasMany
    {
        return $this->hasMany(Course::class, 'grade', 'slug');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('order', 'asc');
    }
}
