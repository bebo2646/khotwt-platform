<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeacherResourceOverride extends Model
{
    protected $table = 'teacher_resource_overrides';

    protected $fillable = [
        'teacher_id',
        'extra_storage_gb',
        'extra_student_codes',
        'created_by',
        'updated_by',
    ];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
