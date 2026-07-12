<?php

namespace App\Services;

use App\Models\Enrollment;
use App\Models\Course;
use App\Models\Lesson;
use Illuminate\Support\Facades\DB;

class StudentAccessService
{
    /**
     * Resolves the active Enrollment record that grants the student access.
     * This checks direct enrollment in the course/package/lesson first,
     * and falls back to check parent bundle enrollments if it's a child course.
     */
    public static function resolveEnrollmentContext($studentId, $courseId, $packageId = null, $lessonId = null)
    {
        if (!$studentId) {
            return null;
        }

        // 1. Direct course enrollment
        if ($courseId) {
            $enrollment = Enrollment::where('student_id', $studentId)
                ->where('course_id', $courseId)
                ->whereNull('package_id')
                ->whereNull('lesson_id')
                ->first();
            if ($enrollment) {
                return $enrollment;
            }
        }

        // 2. Parent bundle enrollment (if course is requested)
        if ($courseId) {
            $parentBundleIds = DB::table('course_bundle_items')
                ->where('child_id', $courseId)
                ->pluck('parent_id')
                ->toArray();
            if (!empty($parentBundleIds)) {
                $enrollment = Enrollment::where('student_id', $studentId)
                    ->whereIn('course_id', $parentBundleIds)
                    ->whereNull('package_id')
                    ->whereNull('lesson_id')
                    ->first();
                if ($enrollment) {
                    return $enrollment;
                }
            }
        }

        // 3. Package enrollment
        if ($packageId) {
            $enrollment = Enrollment::where('student_id', $studentId)
                ->where('package_id', $packageId)
                ->first();
            if ($enrollment) {
                return $enrollment;
            }
        }

        // 4. Lesson enrollment
        if ($lessonId) {
            $enrollment = Enrollment::where('student_id', $studentId)
                ->where('lesson_id', $lessonId)
                ->first();
            if ($enrollment) {
                return $enrollment;
            }
        }

        // 5. If only lessonId is passed, resolve its unit's course
        if ($lessonId && !$courseId) {
            $lesson = Lesson::with('unit')->find($lessonId);
            if ($lesson && $lesson->unit) {
                return self::resolveEnrollmentContext($studentId, $lesson->unit->course_id, null, $lessonId);
            }
        }

        return null;
    }

    /**
     * Resolves the subscription context keys (course_id, package_id, lesson_id)
     * that should be used as the single source of truth (SSOT) to track progress.
     */
    public static function resolveProgressContext($studentId, $courseId, $packageId = null, $lessonId = null)
    {
        $enrollment = self::resolveEnrollmentContext($studentId, $courseId, $packageId, $lessonId);
        if ($enrollment) {
            return [
                'course_id' => $enrollment->course_id,
                'package_id' => $enrollment->package_id,
                'lesson_id' => $enrollment->lesson_id,
            ];
        }

        // Fallback context keys if no enrollment exists (visitor/unauthorized)
        return [
            'course_id' => $courseId,
            'package_id' => $packageId,
            'lesson_id' => $lessonId,
        ];
    }

    /**
     * Check if student is authorized to access the course/package/lesson.
     */
    public static function hasAccess($studentId, $courseId, $packageId = null, $lessonId = null)
    {
        return self::resolveEnrollmentContext($studentId, $courseId, $packageId, $lessonId) !== null;
    }
}
