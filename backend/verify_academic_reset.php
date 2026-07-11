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
use App\Models\Enrollment;
use App\Models\TeacherEarning;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\VideoProgress;
use Illuminate\Support\Facades\DB;

echo "# Academic Year Reset DB Verification Report\n\n";

DB::beginTransaction();

try {
    echo "## 1. Seeding Mock Data for Verification...\n";
    
    // Create Teacher
    $teacher = User::create([
        'name' => 'E2E Reset Teacher',
        'email' => 'teacher_reset_' . uniqid() . '@platform.com',
        'password' => bcrypt('password123'),
        'role' => 'teacher',
        'status' => 'active',
    ]);

    // Create Course
    $course = Course::create([
        'teacher_id' => $teacher->id,
        'title' => 'E2E Chemistry Course',
        'description' => 'Test',
        'price' => 200,
        'grade' => 'third_secondary',
        'subject' => 'chemistry',
        'is_published' => true,
    ]);

    // Create Students
    for ($i = 1; $i <= 3; $i++) {
        $student = User::create([
            'name' => "E2E Reset Student $i",
            'email' => "student_reset_{$i}_" . uniqid() . "@platform.com",
            'password' => bcrypt('password123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        // Add Wallet balance
        $wallet = Wallet::create([
            'student_id' => $student->id,
            'balance' => 150.00,
        ]);

        WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'student_id' => $student->id,
            'amount' => 150.00,
            'type' => 'deposit',
            'status' => 'completed',
        ]);

        // Create Enrollment
        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
        ]);

        // Add Earnings
        TeacherEarning::create([
            'teacher_id' => $teacher->id,
            'amount' => 200.00,
            'course_id' => $course->id,
            'student_id' => $student->id,
            'source' => 'direct_purchase',
            'status' => 'completed',
        ]);
    }

    echo "- Pre-Reset Student Count: " . User::where('role', 'student')->count() . "\n";
    echo "- Pre-Reset Enrollment Count: " . Enrollment::count() . "\n";
    echo "- Pre-Reset Total Wallets Balance: " . Wallet::sum('balance') . " EGP\n";
    echo "- Pre-Reset Teacher Earnings: " . TeacherEarning::sum('amount') . " EGP\n\n";

    echo "## 2. Triggering Academic Year Reset...\n";
    
    $adminController = app(\App\Http\Controllers\AdminController::class);
    $request = new \Illuminate\Http\Request();
    $request->merge(['confirmation' => 'RESET ACADEMIC YEAR']);
    
    $response = $adminController->resetAcademicYear($request);
    
    echo "- Reset Response Message: " . json_decode($response->getContent(), true)['message'] . "\n\n";

    echo "## 3. Post-Reset Database Assertions...\n";
    
    $postStudentCount = User::where('role', 'student')->count();
    $postEnrollments = Enrollment::count();
    $postWallets = Wallet::count();
    $postEarnings = TeacherEarning::count();
    $postTeacherCount = User::where('role', 'teacher')->count();
    $postCourseCount = Course::count();
    
    echo "- **Total Students** (Expected: 0): $postStudentCount (" . ($postStudentCount === 0 ? "✅ PASS" : "❌ FAIL") . ")\n";
    echo "- **Total Enrollments** (Expected: 0): $postEnrollments (" . ($postEnrollments === 0 ? "✅ PASS" : "❌ FAIL") . ")\n";
    echo "- **Wallet Balances Count** (Expected: 0): $postWallets (" . ($postWallets === 0 ? "✅ PASS" : "❌ FAIL") . ")\n";
    echo "- **Teacher Earnings Count** (Expected: 0): $postEarnings (" . ($postEarnings === 0 ? "✅ PASS" : "❌ FAIL") . ")\n";
    
    echo "\n## 4. Educational Content Integrity Assertions...\n";
    echo "- **Teacher accounts preserved**: $postTeacherCount (" . ($postTeacherCount > 0 ? "✅ PASS" : "❌ FAIL") . ")\n";
    echo "- **Courses preserved**: $postCourseCount (" . ($postCourseCount > 0 ? "✅ PASS" : "❌ FAIL") . ")\n";

} catch (\Exception $e) {
    echo "❌ DB VERIFICATION CRASHED: " . $e->getMessage() . "\n";
} finally {
    DB::rollBack();
    echo "\n🛡️ Transaction rolled back. DB cleaned successfully.\n";
}
