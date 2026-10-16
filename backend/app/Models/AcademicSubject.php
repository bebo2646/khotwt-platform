<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademicSubject extends Model
{
    protected $table = 'academic_subjects';

    protected $fillable = [
        'name',
        'slug',
        'sector',
        'stage_id',
        'grade_id',
        'order',
        'is_active',
    ];

    protected $casts = [
        'stage_id' => 'integer',
        'grade_id' => 'integer',
        'order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function stage(): BelongsTo
    {
        return $this->belongsTo(AcademicStage::class, 'stage_id');
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(AcademicGrade::class, 'grade_id');
    }

    public function courses(): HasMany
    {
        return $this->hasMany(Course::class, 'subject', 'slug');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('order', 'asc');
    }

    public function scopeSchool($query)
    {
        return $query->where('sector', 'school');
    }

    public function scopeUniversity($query)
    {
        return $query->where('sector', 'university');
    }
}
