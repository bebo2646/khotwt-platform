<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Courses
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('cover_image')->nullable();
            $table->decimal('price', 10, 2)->default(0.00);
            $table->string('grade'); // first_preparatory, third_secondary, etc.
            $table->string('subject'); // physics, chemistry, etc.
            $table->boolean('is_published')->default(true);
            $table->boolean('enable_discount')->default(false);
            $table->string('discount_type')->nullable(); // 'percentage', 'fixed'
            $table->decimal('discount_value', 10, 2)->nullable();
            $table->timestamps();
        });

        // 2. Units
        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
            $table->string('title');
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        // 3. Lessons
        Schema::create('lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('unit_id')->constrained('units')->onDelete('cascade');
            $table->string('title');
            $table->text('description')->nullable();
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        // 4. Monthly Packages
        Schema::create('packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
            $table->string('title'); // e.g. Month 1, Month 2, Final Revision
            $table->decimal('price', 10, 2)->default(0.00);
            $table->timestamps();
        });

        // 5. Package Lessons (Many to many mapping)
        Schema::create('package_lessons', function (Blueprint $table) {
            $table->foreignId('package_id')->constrained('packages')->onDelete('cascade');
            $table->foreignId('lesson_id')->constrained('lessons')->onDelete('cascade');
            $table->primary(['package_id', 'lesson_id']);
        });

        // 6. Videos
        Schema::create('videos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_id')->constrained('lessons')->onDelete('cascade');
            $table->string('title');
            $table->string('bunny_stream_id')->nullable();
            $table->string('bunny_embed_url')->nullable();
            $table->integer('duration_seconds')->default(0);
            $table->timestamps();
        });

        // 7. PDFs
        Schema::create('pdfs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_id')->constrained('lessons')->onDelete('cascade');
            $table->string('title');
            $table->string('file_path');
            $table->timestamps();
        });

        // 8. Exams (Quiz, Homework, Monthly Exam)
        Schema::create('exams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_id')->constrained('lessons')->onDelete('cascade');
            $table->string('title');
            $table->string('type'); // quiz, homework, monthly_exam
            $table->integer('time_limit_minutes')->nullable(); // null means untimed
            $table->integer('max_score')->default(100);
            
            // Advanced Exam settings
            $table->date('start_date')->nullable();
            $table->string('start_time')->nullable();
            $table->date('end_date')->nullable();
            $table->string('end_time')->nullable();
            $table->integer('max_attempts')->default(1);
            $table->integer('passing_score')->default(50);

            // Homework specific settings
            $table->date('open_date')->nullable();
            $table->date('close_date')->nullable();
            $table->timestamp('submission_deadline')->nullable();
            
            $table->timestamps();
        });

        // 9. Questions
        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained('exams')->onDelete('cascade');
            $table->text('text');
            $table->string('type'); // mcq, true_false, essay
            $table->json('options')->nullable(); // For mcq: ["Option A", "Option B", ...]
            $table->text('correct_answer')->nullable(); // Correct option or standard answer
            $table->integer('score')->default(1);
            $table->timestamps();
        });

        // 10. Student Exams (Attempts)
        Schema::create('student_exams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('exam_id')->constrained('exams')->onDelete('cascade');
            $table->integer('score')->nullable();
            $table->string('status')->default('submitted'); // started, submitted, graded
            $table->text('teacher_feedback')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('graded_at')->nullable();
            $table->timestamps();
        });

        // 11. Student Answers
        Schema::create('student_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_exam_id')->constrained('student_exams')->onDelete('cascade');
            $table->foreignId('question_id')->constrained('questions')->onDelete('cascade');
            $table->text('answer_text');
            $table->boolean('is_correct')->default(false);
            $table->integer('score')->default(0);
            $table->timestamps();
        });

        // 12. Wallets
        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->decimal('balance', 10, 2)->default(0.00);
            $table->timestamps();
        });

        // 13. Wallet Transactions
        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wallet_id')->constrained('wallets')->onDelete('cascade');
            $table->string('type'); // recharge, purchase, refund
            $table->decimal('amount', 10, 2);
            $table->string('description')->nullable();
            $table->string('reference_id')->nullable(); // e.g. purchase reference or code id
            $table->timestamps();
        });

        // 14. Purchase Codes (Admin creates)
        Schema::create('purchase_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('type'); // wallet, course
            $table->decimal('amount', 10, 2)->default(0.00); // balance for wallet code
            $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('cascade'); // for course code
            $table->foreignId('teacher_id')->nullable()->constrained('users')->onDelete('cascade'); // teacher specific code
            $table->boolean('is_redeemed')->default(false);
            $table->foreignId('redeemed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('redeemed_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // 15. Enrollments
        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
            $table->foreignId('package_id')->nullable()->constrained('packages')->onDelete('cascade');
            $table->timestamp('enrolled_at')->useCurrent();
            $table->timestamps();
        });

        // 16. Video Progresses
        Schema::create('video_progresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('video_id')->constrained('videos')->onDelete('cascade');
            $table->integer('watched_seconds')->default(0);
            $table->decimal('watched_percentage', 5, 2)->default(0.00);
            $table->boolean('completed')->default(false);
            $table->integer('last_position_seconds')->default(0);
            $table->integer('views_count')->default(1);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('video_progresses');
        Schema::dropIfExists('enrollments');
        Schema::dropIfExists('purchase_codes');
        Schema::dropIfExists('wallet_transactions');
        Schema::dropIfExists('wallets');
        Schema::dropIfExists('student_answers');
        Schema::dropIfExists('student_exams');
        Schema::dropIfExists('questions');
        Schema::dropIfExists('exams');
        Schema::dropIfExists('pdfs');
        Schema::dropIfExists('videos');
        Schema::dropIfExists('package_lessons');
        Schema::dropIfExists('packages');
        Schema::dropIfExists('lessons');
        Schema::dropIfExists('units');
        Schema::dropIfExists('courses');
    }
};
