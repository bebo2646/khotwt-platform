<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademicStage extends Model
{
    protected $table = 'academic_stages';

    protected $fillable = [
        'name',
        'slug',
        'sector',
        'order',
        'is_active',
    ];

    protected $casts = [
        'order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function grades(): HasMany
    {
        return $this->hasMany(AcademicGrade::class, 'stage_id')->orderBy('order', 'asc');
    }

    public function activeGrades(): HasMany
    {
        return $this->hasMany(AcademicGrade::class, 'stage_id')->where('is_active', true)->orderBy('order', 'asc');
    }

    public function subjects(): HasMany
    {
        return $this->hasMany(AcademicSubject::class, 'stage_id')->orderBy('order', 'asc');
    }

    public function activeSubjects(): HasMany
    {
        return $this->hasMany(AcademicSubject::class, 'stage_id')->where('is_active', true)->orderBy('order', 'asc');
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
