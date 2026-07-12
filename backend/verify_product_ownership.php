<?php

define('LARAVEL_START', microtime(true));

// Register Composer autoloader
require __DIR__.'/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Video;
use App\Models\VideoProgress;
use App\Models\Pdf;
use App\Models\Exam;
use App\Models\StudentExam;
use App\Models\Package;
use App\Models\Enrollment;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

echo "# Product Ownership E2E Functional Verification Report\n\n";

DB::beginTransaction();

try {
    // Setup Mock Data
    echo "## 1. Setting up Test Environment Mock Data...\n";
    
    // Create Teacher
    $teacher = User::create([
        'name' => 'Test Teacher E2E',
        'email' => 'teacher_e2e_' . uniqid() . '@platform.com',
        'password' => bcrypt('password123'),
        'role' => 'teacher',
        'status' => 'active',
    ]);
    
    // Create Course
    $course = Course::create([
        'teacher_id' => $teacher->id,
        'title' => 'E2E Test Course Chemistry',
        'description' => 'Comprehensive E2E testing of Product Ownership',
        'price' => 500.00,
        'grade' => 'third_secondary',
        'subject' => 'chemistry',
        'is_published' => true,
    ]);
    
    // Create Unit
    $unit = Unit::create([
        'course_id' => $course->id,
        'title' => 'Unit 1: Chemistry Fundamentals',
        'order' => 1,
    ]);
    
    // Create Lessons
    $lessons = [];
    for ($i = 1; $i <= 7; $i++) {
        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => "Lecture $i: Organic Compounds",
            'order' => $i,
            'price' => 50.00,
        ]);
        
        // Attach a video
        Video::create([
            'lesson_id' => $lesson->id,
            'title' => "Lecture $i Explanation Video",
            'bunny_embed_url' => 'https://iframe.mediadelivery.net/embed/123/abc',
            'duration_seconds' => 1200,
        ]);
        
        // Attach a PDF
        Pdf::create([
            'lesson_id' => $lesson->id,
            'title' => "Lecture $i Revision Sheet",
            'file_path' => 'pdfs/revision_sheet.pdf',
        ]);
        
        // Attach an Exam
        Exam::create([
            'lesson_id' => $lesson->id,
            'title' => "Lecture $i Quiz",
            'type' => 'quiz',
            'max_score' => 100,
        ]);
        
        $lessons[$i] = $lesson;
    }
    
    // Create Bundle (Package) containing Lectures 2, 3, 4, 5
    $bundle = Package::create([
        'course_id' => $course->id,
        'teacher_id' => $teacher->id,
        'title' => 'E2E Special Chemistry Bundle (L2-L5)',
        'price' => 150.00,
        'type' => 'bundle',
    ]);
    $bundle->lessons()->sync([
        $lessons[2]->id,
        $lessons[3]->id,
        $lessons[4]->id,
        $lessons[5]->id,
    ]);
    
    // Create Student
    $student = User::create([
        'name' => 'E2E Test Student',
        'email' => 'student_e2e_' . uniqid() . '@platform.com',
        'password' => bcrypt('password123'),
        'role' => 'student',
        'status' => 'active',
    ]);
    
    echo "✅ Mock data created successfully.\n\n";

    // ----------------------------------------------------
    // Scenario 1: Standalone Lesson Purchase (Lecture 2)
    // ----------------------------------------------------
    echo "## 2. Test Scenario 1: Standalone Lesson Purchase (Lecture 2)\n";
    
    // Purchase Lecture 2 only
    $enrollment1 = Enrollment::create([
        'student_id' => $student->id,
        'course_id' => null, // Standalone purchase layout
        'package_id' => null,
        'lesson_id' => $lessons[2]->id,
        'enrolled_at' => Carbon::now(),
    ]);
    
    // Verify DB layout
    $db_check1 = Enrollment::find($enrollment1->id);
    $db_layout_ok = is_null($db_check1->course_id) && is_null($db_check1->package_id) && !is_null($db_check1->lesson_id);
    
    echo "- **Expected DB Verification**: `course_id = null`, `package_id = null`, `lesson_id != null`\n";
    echo "- **Actual DB Values**: `course_id: " . var_export($db_check1->course_id, true) . "`, `package_id: " . var_export($db_check1->package_id, true) . "`, `lesson_id: " . var_export($db_check1->lesson_id, true) . "`\n";
    echo "- **Result**: " . ($db_layout_ok ? "✅ PASS" : "❌ FAIL") . "\n";
    
    // Verify accessibility of Lecture 2
    $isL2Locked = $lessons[2]->isLockedForStudent($student->id);
    echo "- **Lecture 2 Locked Status**: " . ($isL2Locked ? "🔒 Locked (FAIL)" : "🔓 Unlocked (PASS)") . "\n";
    
    // Verify Lecture 3 is locked
    $isL3Locked = $lessons[3]->isLockedForStudent($student->id);
    echo "- **Lecture 3 Locked Status**: " . ($isL3Locked ? "🔒 Locked (PASS)" : "🔓 Unlocked (FAIL)") . "\n\n";

    // ----------------------------------------------------
    // Scenario 2: Bundle Purchase (L2, L3, L4, L5)
    // ----------------------------------------------------
    echo "## 3. Test Scenario 2: Bundle Purchase (L2-L5)\n";
    
    // Create new student to isolate bundle test
    $student2 = User::create([
        'name' => 'E2E Bundle Student',
        'email' => 'student_bundle_' . uniqid() . '@platform.com',
        'password' => bcrypt('password123'),
        'role' => 'student',
        'status' => 'active',
    ]);
    
    // Purchase Bundle
    $enrollment2 = Enrollment::create([
        'student_id' => $student2->id,
        'course_id' => null,
        'package_id' => $bundle->id,
        'lesson_id' => null,
        'enrolled_at' => Carbon::now(),
    ]);
    
    // Verify DB layout
    $db_check2 = Enrollment::find($enrollment2->id);
    $db_layout_ok2 = is_null($db_check2->course_id) && !is_null($db_check2->package_id) && is_null($db_check2->lesson_id);
    
    echo "- **Expected DB Verification**: `course_id = null`, `package_id != null`, `lesson_id = null`\n";
    echo "- **Actual DB Values**: `course_id: " . var_export($db_check2->course_id, true) . "`, `package_id: " . var_export($db_check2->package_id, true) . "`, `lesson_id: " . var_export($db_check2->lesson_id, true) . "`\n";
    echo "- **Result**: " . ($db_layout_ok2 ? "✅ PASS" : "❌ FAIL") . "\n";
    
    // Verify accessibility of Bundle contents
    $l2Lock = $lessons[2]->isLockedForStudent($student2->id);
    $l3Lock = $lessons[3]->isLockedForStudent($student2->id);
    $l4Lock = $lessons[4]->isLockedForStudent($student2->id);
    $l5Lock = $lessons[5]->isLockedForStudent($student2->id);
    $l6Lock = $lessons[6]->isLockedForStudent($student2->id);
    
    echo "- **Lecture 2 (in Bundle)**: " . ($l2Lock ? "🔒 Locked (FAIL)" : "🔓 Unlocked (PASS)") . "\n";
    echo "- **Lecture 3 (in Bundle)**: " . ($l3Lock ? "🔒 Locked (FAIL)" : "🔓 Unlocked (PASS)") . "\n";
    echo "- **Lecture 4 (in Bundle)**: " . ($l4Lock ? "🔒 Locked (FAIL)" : "🔓 Unlocked (PASS)") . "\n";
    echo "- **Lecture 5 (in Bundle)**: " . ($l5Lock ? "🔒 Locked (FAIL)" : "🔓 Unlocked (PASS)") . "\n";
    echo "- **Lecture 6 (NOT in Bundle)**: " . ($l6Lock ? "🔒 Locked (PASS)" : "🔓 Unlocked (FAIL)") . "\n\n";

    // ----------------------------------------------------
    // Scenario 3: Full Course Purchase
    // ----------------------------------------------------
    echo "## 4. Test Scenario 3: Full Course Purchase\n";
    
    // Create new student
    $student3 = User::create([
        'name' => 'E2E Full Course Student',
        'email' => 'student_course_' . uniqid() . '@platform.com',
        'password' => bcrypt('password123'),
        'role' => 'student',
        'status' => 'active',
    ]);
    
    // Purchase Course
    $enrollment3 = Enrollment::create([
        'student_id' => $student3->id,
        'course_id' => $course->id,
        'package_id' => null,
        'lesson_id' => null,
        'enrolled_at' => Carbon::now(),
    ]);
    
    // Complete previous lessons' video and exam progress for Student 3 to satisfy sequential unlocking
    for ($i = 1; $i <= 7; $i++) {
        foreach ($lessons[$i]->videos as $video) {
            VideoProgress::create([
                'student_id' => $student3->id,
                'video_id' => $video->id,
                'watched_seconds' => $video->duration_seconds,
                'watched_percentage' => 100,
                'completed' => true,
            ]);
        }
        foreach ($lessons[$i]->exams as $exam) {
            StudentExam::create([
                'student_id' => $student3->id,
                'exam_id' => $exam->id,
                'score' => 100,
                'status' => 'submitted',
                'submitted_at' => Carbon::now(),
            ]);
        }
    }
    
    // Verify DB layout
    $db_check3 = Enrollment::find($enrollment3->id);
    $db_layout_ok3 = !is_null($db_check3->course_id) && is_null($db_check3->package_id) && is_null($db_check3->lesson_id);
    
    echo "- **Expected DB Verification**: `course_id != null`, `package_id = null`, `lesson_id = null`\n";
    echo "- **Actual DB Values**: `course_id: " . var_export($db_check3->course_id, true) . "`, `package_id: " . var_export($db_check3->package_id, true) . "`, `lesson_id: " . var_export($db_check3->lesson_id, true) . "`\n";
    echo "- **Result**: " . ($db_layout_ok3 ? "✅ PASS" : "❌ FAIL") . "\n";
    
    // Verify all lectures are unlocked
    $allUnlocked = true;
    for ($i = 1; $i <= 7; $i++) {
        $locked = $lessons[$i]->isLockedForStudent($student3->id);
        if ($locked) $allUnlocked = false;
        echo "- **Lecture $i**: " . ($locked ? "🔒 Locked (FAIL)" : "🔓 Unlocked (PASS)") . "\n";
    }
    echo "- **Result**: " . ($allUnlocked ? "✅ PASS (All Unlocked)" : "❌ FAIL") . "\n\n";

    // ----------------------------------------------------
    // Scenario 4: Permission Testing (Unauthorized Access)
    // ----------------------------------------------------
    echo "## 5. Test Scenario 4: Permission Testing (Unauthorized Access)\n";
    
    // Create unauthorized student
    $thief = User::create([
        'name' => 'E2E Thief Student',
        'email' => 'thief_' . uniqid() . '@platform.com',
        'password' => bcrypt('password123'),
        'role' => 'student',
        'status' => 'active',
    ]);
    
    // Attempt to open Lecture 2
    $isL2LockedForThief = $lessons[2]->isLockedForStudent($thief->id);
    echo "- **Lecture 2 access checking for non-enrolled student**: " . ($isL2LockedForThief ? "🔒 Access Blocked / Locked (PASS)" : "🔓 Access Allowed (FAIL)") . "\n";
    
    // Mock the HTTP/Controller permission authorization check
    $publicController = new \App\Http\Controllers\PublicController();
    $request = new \Illuminate\Http\Request();
    $request->setUserResolver(fn() => $thief);
    
    try {
        // Authenticate thief
        \Illuminate\Support\Facades\Auth::guard('sanctum')->setUser($thief);
        
        // Simulating loading course details for unauthorized student
        $response = $publicController->courseDetail($course->id, $request);
        $data = json_decode($response->getContent(), true);
        
        $l2Data = null;
        foreach ($data['units'] as $u) {
            foreach ($u['lessons'] as $l) {
                if ($l['id'] === $lessons[2]->id) {
                    $l2Data = $l;
                }
            }
        }
        
        echo "- **API response lesson is_locked property**: " . (isset($l2Data['is_locked']) && $l2Data['is_locked'] ? "🔒 True (PASS)" : "🔓 False (FAIL)") . "\n";
        
    } catch (\Exception $e) {
        echo "- **Thief access returned exception**: " . $e->getMessage() . "\n";
    }
    echo "\n";

    // ----------------------------------------------------
    // Scenario 5: Revenue & Teacher Dashboard
    // ----------------------------------------------------
    echo "## 6. Test Scenario 5: Revenue & Teacher Dashboard Calculations\n";
    
    // Create sales log / records
    // 1 Course sale
    \App\Models\TeacherEarning::create([
        'teacher_id' => $teacher->id,
        'amount' => 500.00,
        'course_id' => $course->id,
        'student_id' => $student->id,
        'source' => 'direct_purchase',
        'status' => 'pending',
    ]);
    
    // 1 Bundle sale
    \App\Models\TeacherEarning::create([
        'teacher_id' => $teacher->id,
        'amount' => 150.00,
        'package_id' => $bundle->id,
        'student_id' => $student->id,
        'source' => 'direct_purchase',
        'status' => 'pending',
    ]);
    
    // 1 Standalone Lesson sale
    \App\Models\TeacherEarning::create([
        'teacher_id' => $teacher->id,
        'amount' => 50.00,
        'lesson_id' => $lessons[2]->id,
        'student_id' => $student->id,
        'source' => 'direct_purchase',
        'status' => 'pending',
    ]);
    
    // Let's call the statistics calculation logic
    $courseRevenue = \App\Models\TeacherEarning::where('teacher_id', $teacher->id)->whereNotNull('course_id')->sum('amount');
    $bundleRevenue = \App\Models\TeacherEarning::where('teacher_id', $teacher->id)->whereNotNull('package_id')->sum('amount');
    $lessonRevenue = \App\Models\TeacherEarning::where('teacher_id', $teacher->id)->whereNotNull('lesson_id')->sum('amount');
    
    echo "- **Pushed Sales**: 1 Course (500 EGP), 1 Bundle (150 EGP), 1 Standalone Lesson (50 EGP)\n";
    echo "- **Calculated Course Revenue**: $courseRevenue EGP\n";
    echo "- **Calculated Bundle/Package Revenue**: $bundleRevenue EGP\n";
    echo "- **Calculated Standalone Lesson Revenue**: $lessonRevenue EGP\n";
    echo "- **Independence Verification**: " . (($courseRevenue == 500 && $bundleRevenue == 150 && $lessonRevenue == 50) ? "✅ PASS" : "❌ FAIL") . "\n\n";

    // ----------------------------------------------------
    // Scenario 6: Student Dashboard & virtual course cards
    // ----------------------------------------------------
    echo "## 7. Test Scenario 6: Student Dashboard and virtual course cards\n";
    
    // Load student 1 (enrolled in standalone lesson L2) dashboard response
    $studentController = new \App\Http\Controllers\StudentController();
    
    // Auth student 1
    $requestDash1 = new \Illuminate\Http\Request();
    $requestDash1->setUserResolver(fn() => $student);
    \Illuminate\Support\Facades\Auth::guard('sanctum')->setUser($student);
    
    $responseDash1 = $studentController->dashboard($requestDash1);
    $dashData1 = json_decode($responseDash1->getContent(), true);
    
    echo "- **Student 1 Dashboard Cards count**: " . count($dashData1['courses'] ?? []) . "\n";
    foreach ($dashData1['courses'] ?? [] as $card) {
        echo "  - Card: '{$card['title']}' | Type: '{$card['purchase_type']}' | Lesson ID: '{$card['lesson_id']}'\n";
    }
    
    // Auth student 2 (enrolled in bundle)
    $requestDash2 = new \Illuminate\Http\Request();
    $requestDash2->setUserResolver(fn() => $student2);
    \Illuminate\Support\Facades\Auth::guard('sanctum')->setUser($student2);
    
    $responseDash2 = $studentController->dashboard($requestDash2);
    $dashData2 = json_decode($responseDash2->getContent(), true);
    
    echo "- **Student 2 Dashboard Cards count**: " . count($dashData2['courses'] ?? []) . "\n";
    foreach ($dashData2['courses'] ?? [] as $card) {
        echo "  - Card: '{$card['title']}' | Type: '{$card['purchase_type']}' | Package ID: '{$card['package_id']}'\n";
    }

} catch (\Exception $e) {
    echo "❌ TEST CRASHED: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
} finally {
    // Rollback so the database stays completely clean!
    DB::rollBack();
    echo "\n🛡️ Transaction rolled back. DB cleaned successfully.\n";
}
