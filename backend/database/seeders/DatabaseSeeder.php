<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Package;
use App\Models\Video;
use App\Models\Pdf;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Wallet;
use App\Models\PurchaseCode;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 0. Seed Plans if not present
        if (\DB::table('subscription_plans')->count() === 0) {
            $plans = [
                [
                    'id' => 1,
                    'name' => 'Starter',
                    'video_storage_gb' => 10,
                    'student_codes' => 50,
                    'price_egp' => 199.00,
                    'created_at' => Carbon::now(),
                    'updated_at' => Carbon::now(),
                ],
                [
                    'id' => 2,
                    'name' => 'Basic',
                    'video_storage_gb' => 25,
                    'student_codes' => 100,
                    'price_egp' => 399.00,
                    'created_at' => Carbon::now(),
                    'updated_at' => Carbon::now(),
                ],
                [
                    'id' => 3,
                    'name' => 'Pro',
                    'video_storage_gb' => 50,
                    'student_codes' => 250,
                    'price_egp' => 699.00,
                    'created_at' => Carbon::now(),
                    'updated_at' => Carbon::now(),
                ],
                [
                    'id' => 4,
                    'name' => 'Academy',
                    'video_storage_gb' => 100,
                    'student_codes' => 500,
                    'price_egp' => 1199.00,
                    'created_at' => Carbon::now(),
                    'updated_at' => Carbon::now(),
                ],
            ];
            \DB::table('subscription_plans')->insert($plans);
        }

        // 1. Seed Admin
        $admin = User::firstOrCreate(
            ['email' => 'belal@admin.com'],
            [
                'name' => 'بلال الأدمن',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'phone' => '01011112222',
                'status' => 'active',
                'is_super' => true,
                'is_super_admin' => true,
                'permissions' => array_keys((require base_path('config/permissions.php'))['permissions'] ?? []),
            ]
        );

        // 2. Seed Teachers
        $teacher = User::firstOrCreate(
            ['email' => 'mohamed@teacher.com'],
            [
                'name' => 'أ. محمد أحمد',
                'password' => Hash::make('password'),
                'role' => 'teacher',
                'phone' => '01012345678',
                'subject' => 'chemistry',
                'grades' => ['third_secondary', 'second_secondary'],
                'experience' => 'خبرة 12 عاماً في تدريس الكيمياء للمرحلة الثانوية.',
                'bio' => 'مدرس أول كيمياء للثانوية العامة، أسلوب مبسط وشرح شامل لكل جزئيات المنهج مع تدريبات أسبوعية.',
                'must_change_password' => false,
                'status' => 'active',
            ]
        );

        // Assign Starter subscription to mohamed@teacher.com if not exists
        if (\DB::table('teacher_subscriptions')->where('teacher_id', $teacher->id)->count() === 0) {
            \DB::table('teacher_subscriptions')->insert([
                'teacher_id' => $teacher->id,
                'plan_id' => 1,
                'start_date' => Carbon::now()->toDateString(),
                'end_date' => Carbon::now()->addYear()->toDateString(),
                'status' => 'Active',
                'billing_period' => 'monthly',
                'used_storage_bytes' => 0,
                'used_codes' => 0,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);
        }

        $teacher2 = User::firstOrCreate(
            ['email' => 'khaled@teacher.com'],
            [
                'name' => 'أ. خالد محمود',
                'password' => Hash::make('password'),
                'role' => 'teacher',
                'phone' => '01087654321',
                'subject' => 'physics',
                'grades' => ['third_secondary', 'first_secondary'],
                'experience' => 'خبرة 10 سنوات في الفيزياء العامة والخاصة.',
                'bio' => 'فيزياء الثانوية العامة بأسلوب عملي تفاعلي لحل أصعب المسائل.',
                'must_change_password' => false,
                'status' => 'active',
            ]
        );

        // Assign Starter subscription to khaled@teacher.com if not exists
        if (\DB::table('teacher_subscriptions')->where('teacher_id', $teacher2->id)->count() === 0) {
            \DB::table('teacher_subscriptions')->insert([
                'teacher_id' => $teacher2->id,
                'plan_id' => 1,
                'start_date' => Carbon::now()->toDateString(),
                'end_date' => Carbon::now()->addYear()->toDateString(),
                'status' => 'Active',
                'billing_period' => 'monthly',
                'used_storage_bytes' => 0,
                'used_codes' => 0,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);
        }

        // 3. Seed Students
        $student = User::firstOrCreate(
            ['email' => 'student@student.com'],
            [
                'name' => 'أحمد علي طالب',
                'password' => Hash::make('password'),
                'role' => 'student',
                'phone' => '01234567890',
                'status' => 'active',
            ]
        );

        // Create student wallet with initial balance if not exists
        Wallet::firstOrCreate(
            ['student_id' => $student->id],
            ['balance' => 150.00]
        );

        // 4. Seed Course for Teacher 1 (Chemistry)
        $course = Course::firstOrCreate(
            ['teacher_id' => $teacher->id, 'title' => 'الكيمياء العضوية للثانوية العامة 2026'],
            [
                'description' => 'كورس كامل لشرح الباب الخامس في منهج الكيمياء (الكيمياء العضوية) للثانوية العامة المصرية. يغطي الكورس الألكانات، الألكينات، الألكاينات، المركبات الحلقية، والتفاعلات الكيميائية العضوية بالتفصيل.',
                'cover_image' => 'https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?auto=format&fit=crop&q=80&w=1000',
                'price' => 50.00,
                'grade' => 'third_secondary',
                'subject' => 'chemistry',
                'is_published' => true,
            ]
        );

        // Course for Teacher 2 (Physics)
        $course2 = Course::firstOrCreate(
            ['teacher_id' => $teacher2->id, 'title' => 'الكهربية التيارية للثانوية العامة'],
            [
                'description' => 'شرح الباب الأول في الفيزياء (الكهرباء التيارية وقانون أوم وقانونا كيرشوف) مع حل بنك أسئلة الوزارة ونماذج الامتحانات.',
                'cover_image' => 'https://images.unsplash.com/photo-1517148818476-75ff57ae8b98?auto=format&fit=crop&q=80&w=1000',
                'price' => 60.00,
                'grade' => 'third_secondary',
                'subject' => 'physics',
                'is_published' => true,
            ]
        );

        // 5. Units and Lessons for Chemistry Course
        $unit = Unit::firstOrCreate(
            ['course_id' => $course->id, 'title' => 'الوحدة الأولى: الهيدروكربونات'],
            ['order' => 1]
        );

        $lesson1 = Lesson::firstOrCreate(
            ['unit_id' => $unit->id, 'title' => 'المحاضرة 1: مقدمة الكيمياء العضوية ونظرية القوى الحيوية'],
            [
                'description' => 'في هذه المحاضرة نتعلم الفرق بين المركبات العضوية وغير العضوية، ونظرية برازيليوس ودور فونيل في هدمها بتحضير اليوريا.',
                'order' => 1,
                'price' => 50.00,
            ]
        );

        $lesson2 = Lesson::firstOrCreate(
            ['unit_id' => $unit->id, 'title' => 'المحاضرة 2: الألكانات وتسمية الأيوباك (IUPAC)'],
            [
                'description' => 'دراسة السلسلة المتجانسة للألكانات وقواعد تسمية المركبات العضوية حسب نظام الأيوباك العالمي بالتفصيل.',
                'order' => 2,
                'price' => 40.00,
            ]
        );

        // Contents for Lesson 1
        Video::firstOrCreate(
            ['lesson_id' => $lesson1->id, 'bunny_stream_id' => 'bunny-stream-vid-101'],
            [
                'title' => 'شرح مقدمة الكيمياء العضوية وتجربة فولر',
                'bunny_embed_url' => 'https://iframe.mediadelivery.net/embed/224522/d74ff7e1-88f1-4db5-9e67-ea26c3619be9',
                'duration_seconds' => 780, // 13 minutes
            ]
        );

        Pdf::firstOrCreate(
            ['lesson_id' => $lesson1->id, 'file_path' => '/storage/pdfs/chemistry_lesson_1.pdf'],
            ['title' => 'ملخص المحاضرة الأولى (PDF)']
        );

        $exam1 = Exam::firstOrCreate(
            ['lesson_id' => $lesson1->id, 'title' => 'اختبار المحاضرة الأولى السريع'],
            [
                'type' => 'quiz',
                'time_limit_minutes' => 10,
                'max_score' => 25,
            ]
        );

        Question::firstOrCreate(
            ['exam_id' => $exam1->id, 'text' => 'من هو العالم الذي دمر نظرية القوى الحيوية بتحضير اليوريا في المختبر؟'],
            [
                'type' => 'mcq',
                'options' => ['برازيليوس', 'فولر', 'دالتون', 'أفوكادرو'],
                'correct_answer' => 'فولر',
                'score' => 10,
            ]
        );

        Question::firstOrCreate(
            ['exam_id' => $exam1->id, 'text' => 'اليوريا مركب عضوي يتكون في بول الثدييات.'],
            [
                'type' => 'true_false',
                'options' => ['صح', 'خطأ'],
                'correct_answer' => 'صح',
                'score' => 5,
            ]
        );

        Question::firstOrCreate(
            ['exam_id' => $exam1->id, 'text' => 'قارن بين المركبات العضوية والمركبات غير العضوية من حيث درجة الانصهار والغليان والتوصيل الكهربي.'],
            [
                'type' => 'essay',
                'score' => 10,
            ]
        );

        // Contents for Lesson 2
        Video::firstOrCreate(
            ['lesson_id' => $lesson2->id, 'bunny_stream_id' => 'bunny-stream-vid-102'],
            [
                'title' => 'شرح قواعد تسمية الألكانات بالأيوباك',
                'bunny_embed_url' => 'https://iframe.mediadelivery.net/embed/224522/e74ff7e1-88f1-4db5-9e67-ea26c3619be9',
                'duration_seconds' => 1240, // ~20 minutes
            ]
        );

        $exam2 = Exam::firstOrCreate(
            ['lesson_id' => $lesson2->id, 'title' => 'الواجب المنزلي: تسمية الألكانات وتفاعلات الاحتراق'],
            [
                'type' => 'homework',
                'max_score' => 20,
            ]
        );

        Question::firstOrCreate(
            ['exam_id' => $exam2->id, 'text' => 'اكتب الاسم الصحيح للمركب التالي طبقاً لنظام الأيوباك: 2-إيثيل بروبان مع تعليل الإجابة.'],
            [
                'type' => 'essay',
                'score' => 20,
            ]
        );

        // 6. Packages
        $package = Package::firstOrCreate(
            ['course_id' => $course->id, 'title' => 'باقة شهر أكتوبر (البداية القوية)'],
            [
                'teacher_id' => $teacher->id,
                'price' => 80.00,
                'description' => 'كورس البداية القوية في الكيمياء العضوية. تشمل هذه الباقة المحاضرة الأولى والثانية كاملتين مع اختباراتهم والواجب المنزلي بسعر مخفض، موفراً 10 جنيهات كاملة عن شراء المحاضرات بشكل منفرد.',
                'cover_image' => 'https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?auto=format&fit=crop&q=80&w=1000',
            ]
        );
        $package->lessons()->sync([$lesson1->id, $lesson2->id]);

        // 7. Purchase Codes
        PurchaseCode::firstOrCreate(
            ['code' => 'ELM-WALLET100'],
            [
                'type' => 'wallet',
                'amount' => 100.00,
                'is_redeemed' => false,
                'expires_at' => Carbon::now()->addMonths(6),
            ]
        );

        PurchaseCode::firstOrCreate(
            ['code' => 'ELM-CHEMISTRY'],
            [
                'type' => 'course',
                'course_id' => $course->id,
                'teacher_id' => $teacher->id,
                'is_redeemed' => false,
                'expires_at' => Carbon::now()->addMonths(6),
            ]
        );

        // 8. Standalone Monthly Exam
        $monthlyExam = Exam::firstOrCreate(
            ['title' => 'امتحان الكيمياء الشامل لشهر أكتوبر 2026', 'type' => 'monthly_exam'],
            [
                'description' => 'امتحان شامل يحاكي مواصفات امتحان نهاية العام على الألكانات والألكينات مع نظام منع الغش الذكي.',
                'month' => 'شهر أكتوبر',
                'stage' => 'المرحلة الثانوية',
                'grade' => 'third_secondary',
                'subject' => 'الكيمياء',
                'teacher_id' => $teacher->id,
                'time_limit_minutes' => 60,
                'max_score' => 40,
                'passing_score' => 20,
                'price' => 30.00,
                'is_paid' => true,
                'is_published' => true,
                'is_active' => true,
                'allowed_violations' => 3,
                'enable_fullscreen' => true,
                'enable_anti_tab_switching' => true,
                'enable_copy_protection' => true,
                'randomize_questions' => true,
                'randomize_options' => true,
            ]
        );

        Question::firstOrCreate(
            ['exam_id' => $monthlyExam->id, 'text' => 'ما هو ناتج إضافة بروميد الهيدروجين (HBr) إلى البروبين طبقاً لقاعدة ماركونيكوف؟'],
            [
                'type' => 'mcq',
                'options' => ['2-برومو بروبان', '1-برومو بروبان', '1,2-ثنائي برومو بروبان', 'بروبانال'],
                'correct_answer' => '2-برومو بروبان',
                'score' => 20,
            ]
        );

        Question::firstOrCreate(
            ['exam_id' => $monthlyExam->id, 'text' => 'الصيغة العامة للألكانات غير الحلقية هي CnH2n+2.'],
            [
                'type' => 'true_false',
                'correct_answer' => 'صح',
                'score' => 20,
            ]
        );
    }
}
