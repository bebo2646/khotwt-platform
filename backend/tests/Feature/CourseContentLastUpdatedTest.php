<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Video;
use App\Models\Exam;
use App\Models\Question;
use App\Models\SubscriptionPlan;
use App\Models\TeacherSubscription;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Carbon\Carbon;

class CourseContentLastUpdatedTest extends TestCase
{
    use DatabaseTransactions;

    private $teacher;
    private $course;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::create([
            'name' => 'Teacher Content Timestamp Test',
            'email' => 'teacher_content_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'physics',
            'grades' => ['first_secondary']
        ]);

        $plan = SubscriptionPlan::firstOrCreate(['name' => 'Starter'], [
            'price' => 0,
            'max_students' => 1000,
            'max_storage_bytes' => 1000000000,
            'max_courses' => 100,
            'max_codes' => 1000,
        ]);

        TeacherSubscription::create([
            'teacher_id' => $this->teacher->id,
            'plan_id' => $plan->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(365)->toDateString(),
            'status' => 'Active',
            'used_storage_bytes' => 0,
            'used_codes' => 0,
            'billing_period' => 'monthly',
        ]);

        $this->course = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'Physics 101 Test Course',
            'description' => 'Course description',
            'price' => 100.00,
            'grade' => 'first_secondary',
            'subject' => 'physics',
            'is_published' => true,
        ]);
    }

    public function test_creating_course_sets_initial_last_content_updated_at()
    {
        $this->assertNotNull($this->course->last_content_updated_at);
        $this->assertEquals(
            now()->format('Y-m-d H:i'),
            Carbon::parse($this->course->last_content_updated_at)->format('Y-m-d H:i')
        );
    }

    public function test_modifying_course_meaningful_fields_updates_last_content_updated_at()
    {
        // Freeze past time
        $past = Carbon::now()->subDays(5);
        Course::where('id', $this->course->id)->update(['last_content_updated_at' => $past]);

        // Act: modify course title and price
        $this->course->fresh()->update([
            'title' => 'Updated Physics Title ' . uniqid(),
            'price' => 150.00,
        ]);

        $fresh = $this->course->fresh();
        $this->assertTrue(Carbon::parse($fresh->last_content_updated_at)->greaterThan($past));
    }

    public function test_adding_unit_and_lesson_updates_course_last_content_updated_at()
    {
        $past = Carbon::now()->subDays(5);
        Course::where('id', $this->course->id)->update(['last_content_updated_at' => $past]);

        $unit = Unit::create([
            'course_id' => $this->course->id,
            'title' => 'Unit 1: Mechanics',
            'order' => 1,
        ]);

        $freshAfterUnit = $this->course->fresh();
        $this->assertTrue(Carbon::parse($freshAfterUnit->last_content_updated_at)->greaterThan($past));

        // Reset to past
        Course::where('id', $this->course->id)->update(['last_content_updated_at' => $past]);

        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => 'Lesson 1: Vectors',
            'order' => 1,
        ]);

        $freshAfterLesson = $this->course->fresh();
        $this->assertTrue(Carbon::parse($freshAfterLesson->last_content_updated_at)->greaterThan($past));
    }

    public function test_deleting_lesson_updates_course_last_content_updated_at()
    {
        $unit = Unit::create([
            'course_id' => $this->course->id,
            'title' => 'Unit 1: Mechanics',
            'order' => 1,
        ]);

        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => 'Lesson To Delete',
            'order' => 1,
        ]);

        $past = Carbon::now()->subDays(5);
        Course::where('id', $this->course->id)->update(['last_content_updated_at' => $past]);

        $lesson->delete();

        $fresh = $this->course->fresh();
        $this->assertTrue(Carbon::parse($fresh->last_content_updated_at)->greaterThan($past));
    }

    public function test_adding_and_deleting_video_updates_course_last_content_updated_at()
    {
        $unit = Unit::create([
            'course_id' => $this->course->id,
            'title' => 'Unit 1: Mechanics',
            'order' => 1,
        ]);

        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => 'Lesson with Video',
            'order' => 1,
        ]);

        $past = Carbon::now()->subDays(5);
        Course::where('id', $this->course->id)->update(['last_content_updated_at' => $past]);

        $video = Video::create([
            'lesson_id' => $lesson->id,
            'title' => 'Mechanics Video Part 1',
            'bunny_video_id' => 'bunny-vid-123',
            'bunny_stream_id' => '766707',
            'duration_seconds' => 300,
        ]);

        $freshAfterVideo = $this->course->fresh();
        $this->assertTrue(Carbon::parse($freshAfterVideo->last_content_updated_at)->greaterThan($past));

        // Delete video
        Course::where('id', $this->course->id)->update(['last_content_updated_at' => $past]);
        $video->delete();

        $freshAfterDelete = $this->course->fresh();
        $this->assertTrue(Carbon::parse($freshAfterDelete->last_content_updated_at)->greaterThan($past));
    }

    public function test_background_polling_video_status_does_not_update_last_content_updated_at()
    {
        $unit = Unit::create([
            'course_id' => $this->course->id,
            'title' => 'Unit 1: Mechanics',
            'order' => 1,
        ]);

        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => 'Lesson with Polling Video',
            'order' => 1,
        ]);

        $video = Video::create([
            'lesson_id' => $lesson->id,
            'title' => 'Mechanics Video Part 2',
            'bunny_video_id' => 'bunny-vid-456',
            'bunny_stream_id' => '766707',
            'bunny_status' => 0,
            'bunny_size_bytes' => 0,
        ]);

        // Set last_content_updated_at to a known fixed past time
        $past = Carbon::now()->subHours(2)->startOfSecond();
        Course::where('id', $this->course->id)->update(['last_content_updated_at' => $past]);

        // Simulate background polling worker updating bunny_status and bunny_size_bytes
        $video->update([
            'bunny_status' => 4, // Finished
            'bunny_size_bytes' => 104857600,
        ]);

        $fresh = $this->course->fresh();
        // last_content_updated_at MUST remain identical to $past
        $this->assertEquals(
            $past->toDateTimeString(),
            Carbon::parse($fresh->last_content_updated_at)->toDateTimeString()
        );
    }

    public function test_adding_exam_and_questions_updates_course_last_content_updated_at()
    {
        $unit = Unit::create([
            'course_id' => $this->course->id,
            'title' => 'Unit 1: Mechanics',
            'order' => 1,
        ]);

        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => 'Lesson with Quiz',
            'order' => 1,
        ]);

        $past = Carbon::now()->subDays(5);
        Course::where('id', $this->course->id)->update(['last_content_updated_at' => $past]);

        $exam = Exam::create([
            'lesson_id' => $lesson->id,
            'teacher_id' => $this->teacher->id,
            'title' => 'Mechanics Quiz',
            'type' => 'quiz',
            'max_score' => 10,
        ]);

        $freshAfterExam = $this->course->fresh();
        $this->assertTrue(Carbon::parse($freshAfterExam->last_content_updated_at)->greaterThan($past));

        // Add questions
        Course::where('id', $this->course->id)->update(['last_content_updated_at' => $past]);

        $question = Question::create([
            'exam_id' => $exam->id,
            'text' => 'What is velocity?',
            'type' => 'mcq',
            'score' => 5,
        ]);

        $freshAfterQuestion = $this->course->fresh();
        $this->assertTrue(Carbon::parse($freshAfterQuestion->last_content_updated_at)->greaterThan($past));
    }

    public function test_legacy_course_fallback_to_updated_at_when_null()
    {
        // Bypass model hooks using DB raw query to set last_content_updated_at to null
        \Illuminate\Support\Facades\DB::table('courses')
            ->where('id', $this->course->id)
            ->update(['last_content_updated_at' => null]);

        $fresh = Course::find($this->course->id);
        // The accessor should return updated_at
        $this->assertNotNull($fresh->last_content_updated_at);
        $this->assertEquals(
            Carbon::parse($fresh->updated_at)->toDateTimeString(),
            Carbon::parse($fresh->last_content_updated_at)->toDateTimeString()
        );
    }
}
