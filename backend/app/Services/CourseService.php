<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Package;
use App\Models\Unit;
use App\Models\Lesson;
use Illuminate\Support\Facades\DB;

class CourseService
{
    /**
     * Create course.
     */
    public function createCourse(array $data)
    {
        return Course::create($data);
    }

    /**
     * Update course.
     */
    public function updateCourse(int $id, array $data)
    {
        $course = Course::findOrFail($id);
        $course->update($data);
        return $course;
    }

    /**
     * Delete course.
     */
    public function deleteCourse(int $id)
    {
        $course = Course::findOrFail($id);
        $course->delete();
        return true;
    }

    /**
     * Sync package lessons.
     */
    public function syncPackageLessons(int $packageId, array $lessonIds)
    {
        $package = Package::findOrFail($packageId);
        $package->lessons()->sync($lessonIds);
        return $package;
    }
}
