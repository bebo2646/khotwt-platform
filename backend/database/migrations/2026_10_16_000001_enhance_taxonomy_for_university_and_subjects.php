<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add sector to academic_stages
        if (Schema::hasTable('academic_stages') && !Schema::hasColumn('academic_stages', 'sector')) {
            Schema::table('academic_stages', function (Blueprint $table) {
                $table->string('sector')->default('school')->after('slug');
            });
        }

        // 2. Add level_type & specialization to academic_grades
        if (Schema::hasTable('academic_grades')) {
            if (!Schema::hasColumn('academic_grades', 'level_type')) {
                Schema::table('academic_grades', function (Blueprint $table) {
                    $table->string('level_type')->default('grade')->after('short_code');
                });
            }
            if (!Schema::hasColumn('academic_grades', 'specialization')) {
                Schema::table('academic_grades', function (Blueprint $table) {
                    $table->string('specialization')->nullable()->after('level_type');
                });
            }
        }

        // 3. Create academic_subjects table
        if (!Schema::hasTable('academic_subjects')) {
            Schema::create('academic_subjects', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->string('sector')->default('school'); // 'school', 'university'
                $table->foreignId('stage_id')->nullable()->constrained('academic_stages')->onDelete('set null');
                $table->foreignId('grade_id')->nullable()->constrained('academic_grades')->onDelete('set null');
                $table->integer('order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });

            // Seed canonical default school subjects
            $now = now();
            $defaultSchoolSubjects = [
                ['name' => 'الكيمياء', 'slug' => 'chemistry', 'sector' => 'school', 'order' => 1, 'is_active' => true],
                ['name' => 'الفيزياء', 'slug' => 'physics', 'sector' => 'school', 'order' => 2, 'is_active' => true],
                ['name' => 'علوم متكاملة', 'slug' => 'integrated_science', 'sector' => 'school', 'order' => 3, 'is_active' => true],
                ['name' => 'الأحياء', 'slug' => 'biology', 'sector' => 'school', 'order' => 4, 'is_active' => true],
                ['name' => 'الرياضيات', 'slug' => 'math', 'sector' => 'school', 'order' => 5, 'is_active' => true],
                ['name' => 'العلوم', 'slug' => 'science', 'sector' => 'school', 'order' => 6, 'is_active' => true],
                ['name' => 'اللغة العربية', 'slug' => 'arabic', 'sector' => 'school', 'order' => 7, 'is_active' => true],
                ['name' => 'اللغة الإنجليزية', 'slug' => 'english', 'sector' => 'school', 'order' => 8, 'is_active' => true],
            ];

            foreach ($defaultSchoolSubjects as $sub) {
                $sub['created_at'] = $now;
                $sub['updated_at'] = $now;
                DB::table('academic_subjects')->insert($sub);
            }
        }

        // 4. Ensure University department exists in departments
        if (Schema::hasTable('departments')) {
            $uniDept = DB::table('departments')->where('slug', 'university')->first();
            if (!$uniDept) {
                $maxOrder = DB::table('departments')->max('order') ?: 0;
                DB::table('departments')->insert([
                    'name' => 'التعليم الجامعي',
                    'slug' => 'university',
                    'description' => 'كورسات ومحاضرات أكاديمية مخصصة للكليات والمعاهد والفرق الجامعية المختلفة',
                    'icon' => 'GraduationCap',
                    'badge' => 'التعليم الجامعي',
                    'order' => $maxOrder + 1,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // 5. Update existing university stages if any
        if (Schema::hasTable('academic_stages')) {
            DB::table('academic_stages')
                ->where('slug', 'faclty')
                ->orWhere('name', 'like', '%جامع%')
                ->orWhere('name', 'like', '%كلية%')
                ->update(['sector' => 'university']);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('academic_subjects');

        if (Schema::hasTable('academic_grades')) {
            Schema::table('academic_grades', function (Blueprint $table) {
                if (Schema::hasColumn('academic_grades', 'specialization')) {
                    $table->dropColumn('specialization');
                }
                if (Schema::hasColumn('academic_grades', 'level_type')) {
                    $table->dropColumn('level_type');
                }
            });
        }

        if (Schema::hasTable('academic_stages')) {
            Schema::table('academic_stages', function (Blueprint $table) {
                if (Schema::hasColumn('academic_stages', 'sector')) {
                    $table->dropColumn('sector');
                }
            });
        }
    }
};
