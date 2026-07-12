<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\DB;

class Lesson extends Model
{
    use HasFactory;

    protected $fillable = [
        'unit_id',
        'title',
        'description',
        'order',
        'price',
        'duration_seconds',
        'duration_text',
    ];

    protected $casts = [
        'price' => 'decimal:2',
    ];

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }

    public function videos()
    {
        return $this->hasMany(Video::class);
    }

    public function pdfs()
    {
        return $this->hasMany(Pdf::class);
    }

    public function exams()
    {
        return $this->hasMany(Exam::class);
    }

    public function packages()
    {
        return $this->belongsToMany(Package::class, 'package_lessons');
    }

    public function isLockedForStudent($studentId)
    {
        if (!$studentId) {
            return false;
        }

        // Get the course ID
        $courseId = $this->unit->course_id;

        // Package and standalone access validation (including null course_id enrollments)
        $enrollments = Enrollment::where('student_id', $studentId)
            ->where(function($query) use ($courseId) {
                $query->where('course_id', $courseId)
                    ->orWhereIn('course_id', function($sub) use ($courseId) {
                        $sub->select('parent_id')
                            ->from('course_bundle_items')
                            ->where('child_id', $courseId);
                    })
                    ->orWhereIn('package_id', function($sub) use ($courseId) {
                        $sub->select('id')->from('packages')->where('course_id', $courseId);
                    })
                    ->orWhereIn('lesson_id', function($sub) use ($courseId) {
                        $sub->select('lessons.id')
                            ->from('lessons')
                            ->join('units', 'lessons.unit_id', '=', 'units.id')
                            ->where('units.course_id', $courseId);
                    });
            })
            ->get();

        if ($enrollments->isEmpty()) {
            return true; // Not enrolled at all
        }

        $hasFullCourse = $enrollments->contains(fn($e) => is_null($e->package_id) && is_null($e->lesson_id));
        if (!$hasFullCourse) {
            $hasLessonEnrollment = $enrollments->contains(fn($e) => $e->lesson_id === $this->id);
            if (!$hasLessonEnrollment) {
                $enrolledPackageIds = $enrollments->pluck('package_id')->filter()->toArray();
                $isInPackage = DB::table('package_lessons')
                    ->where('lesson_id', $this->id)
                    ->whereIn('package_id', $enrolledPackageIds)
                    ->exists();

                if (!$isInPackage) {
                    return true; // Locked because it is not in the purchased package(s) and not purchased individually
                }
            }
            return false; // Standalone or package/bundle purchases bypass course-level sequential locking
        }

        // Get all lessons of this course, sorted by unit.order, then lesson.order, then lesson.id
        $lessons = Lesson::select('lessons.id')
            ->join('units', 'lessons.unit_id', '=', 'units.id')
            ->where('units.course_id', $courseId)
            ->orderBy('units.order')
            ->orderBy('lessons.order')
            ->orderBy('lessons.id')
            ->get();

        // Find index of current lesson
        $currentIndex = $lessons->search(function ($item) {
            return $item->id === $this->id;
        });

        // If it's the first lesson, it is never locked
        if ($currentIndex === false || $currentIndex === 0) {
            return false;
        }

        // Previous lesson
        $prevLessonId = $lessons[$currentIndex - 1]->id;
        $prevLesson = Lesson::with(['videos', 'exams'])->find($prevLessonId);

        // Check if all videos in previous lesson are completed
        $videoIds = $prevLesson->videos->pluck('id');
        if ($videoIds->count() > 0) {
            $completedVideosCount = VideoProgress::where('student_id', $studentId)
                ->whereIn('video_id', $videoIds)
                ->where('completed', true)
                ->count();

            if ($completedVideosCount < $videoIds->count()) {
                return true;
            }
        }

        // Check if all homework exams in previous lesson are submitted
        $homeworkIds = $prevLesson->exams->where('type', 'homework')->pluck('id');
        if ($homeworkIds->count() > 0) {
            $submittedHomeworkCount = StudentExam::where('student_id', $studentId)
                ->whereIn('exam_id', $homeworkIds)
                ->whereIn('status', ['submitted', 'graded'])
                ->count();

            if ($submittedHomeworkCount < $homeworkIds->count()) {
                return true;
            }
        }

        return false;
    }
}
