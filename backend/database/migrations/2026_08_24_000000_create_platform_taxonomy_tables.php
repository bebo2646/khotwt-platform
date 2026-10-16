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
        // 1. Departments (Main Platform Taxonomy Categories)
        if (!Schema::hasTable('departments')) {
            Schema::create('departments', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->text('description')->nullable();
                $table->string('icon')->nullable()->default('GraduationCap');
                $table->string('badge')->nullable();
                $table->integer('order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });

            $now = now();
            $departments = [
                [
                    'name' => 'التعليم المدرسي',
                    'slug' => 'school',
                    'description' => 'شروحات ومناهج دراسية متكاملة لجميع المراحل التعليمية مع نخبة من أفضل المعلمين',
                    'icon' => 'GraduationCap',
                    'badge' => 'التعليم الأكاديمي',
                    'order' => 1,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'البرمجة والتكنولوجيا',
                    'slug' => 'programming',
                    'description' => 'تعلم تطوير المواقع، التطبيقات، الذكاء الاصطناعي، قواعد البيانات والأمن السيبراني',
                    'icon' => 'Code',
                    'badge' => 'تقنية وتطوير',
                    'order' => 2,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'التجارة والأعمال',
                    'slug' => 'business',
                    'description' => 'إدارة المشاريع، التجارة الإلكترونية، التسويق، المحاسبة وريادة الأعمال',
                    'icon' => 'TrendingUp',
                    'badge' => 'أعمال واستثمار',
                    'order' => 3,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'التصميم والإبداع',
                    'slug' => 'design',
                    'description' => 'تصميم الواجهات وتجربة المستخدم UI/UX، الجرافيك، المونتاج والموشن جرافيك',
                    'icon' => 'Palette',
                    'badge' => 'فنون وتصميم',
                    'order' => 4,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'اللغات والترجمة',
                    'slug' => 'languages',
                    'description' => 'تطوير مهارات المحادثة واللغات الإنجليزية، الألمانية، الفرنسية واختبارات الآيلتس والتوفل',
                    'icon' => 'Globe',
                    'badge' => 'لغات عالمية',
                    'order' => 5,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'التسويق الرقمي',
                    'slug' => 'marketing',
                    'description' => 'إعلانات السوشيال ميديا، تحسين محركات البحث SEO، وصناعة وإدارة المحتوى الرقمي',
                    'icon' => 'Share2',
                    'badge' => 'تسويق ونمو',
                    'order' => 6,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'المهارات المهنية',
                    'slug' => 'skills',
                    'description' => 'مهارات التواصل، العمل الحر، القيادة، الإلقاء وإدارة الوقت وبناء السيرة الذاتية',
                    'icon' => 'Briefcase',
                    'badge' => 'تطوير ذاتي',
                    'order' => 7,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ];
            DB::table('departments')->insert($departments);
        }

        // 2. Academic Stages
        if (!Schema::hasTable('academic_stages')) {
            Schema::create('academic_stages', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->integer('order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });

            $now = now();
            $stages = [
                [
                    'id' => 1,
                    'name' => 'المرحلة الابتدائية',
                    'slug' => 'primary',
                    'order' => 1,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'id' => 2,
                    'name' => 'المرحلة الإعدادية',
                    'slug' => 'preparatory',
                    'order' => 2,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'id' => 3,
                    'name' => 'المرحلة الثانوية',
                    'slug' => 'secondary',
                    'order' => 3,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ];
            DB::table('academic_stages')->insert($stages);
        }

        // 3. Academic Grades
        if (!Schema::hasTable('academic_grades')) {
            Schema::create('academic_grades', function (Blueprint $table) {
                $table->id();
                $table->foreignId('stage_id')->constrained('academic_stages')->onDelete('cascade');
                $table->string('name');
                $table->string('slug')->unique();
                $table->string('short_code')->nullable();
                $table->integer('order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });

            $now = now();
            $grades = [
                // Primary
                [
                    'stage_id' => 1,
                    'name' => 'الصف الأول الابتدائي',
                    'slug' => 'first_primary',
                    'short_code' => '١ب',
                    'order' => 1,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'stage_id' => 1,
                    'name' => 'الصف الثاني الابتدائي',
                    'slug' => 'second_primary',
                    'short_code' => '٢ب',
                    'order' => 2,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'stage_id' => 1,
                    'name' => 'الصف الثالث الابتدائي',
                    'slug' => 'third_primary',
                    'short_code' => '٣ب',
                    'order' => 3,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'stage_id' => 1,
                    'name' => 'الصف الرابع الابتدائي',
                    'slug' => 'fourth_primary',
                    'short_code' => '٤ب',
                    'order' => 4,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'stage_id' => 1,
                    'name' => 'الصف الخامس الابتدائي',
                    'slug' => 'fifth_primary',
                    'short_code' => '٥ب',
                    'order' => 5,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'stage_id' => 1,
                    'name' => 'الصف السادس الابتدائي',
                    'slug' => 'sixth_primary',
                    'short_code' => '٦ب',
                    'order' => 6,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],

                // Preparatory
                [
                    'stage_id' => 2,
                    'name' => 'الصف الأول الإعدادي',
                    'slug' => 'first_preparatory',
                    'short_code' => '١إ',
                    'order' => 1,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'stage_id' => 2,
                    'name' => 'الصف الثاني الإعدادي',
                    'slug' => 'second_preparatory',
                    'short_code' => '٢إ',
                    'order' => 2,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'stage_id' => 2,
                    'name' => 'الصف الثالث الإعدادي',
                    'slug' => 'third_preparatory',
                    'short_code' => '٣إ',
                    'order' => 3,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],

                // Secondary
                [
                    'stage_id' => 3,
                    'name' => 'الصف الأول الثانوي',
                    'slug' => 'first_secondary',
                    'short_code' => '١ث',
                    'order' => 1,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'stage_id' => 3,
                    'name' => 'الصف الثاني الثانوي',
                    'slug' => 'second_secondary',
                    'short_code' => '٢ث',
                    'order' => 2,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'stage_id' => 3,
                    'name' => 'الصف الثالث الثانوي',
                    'slug' => 'third_secondary',
                    'short_code' => '٣ث',
                    'order' => 3,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ];
            DB::table('academic_grades')->insert($grades);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('academic_grades');
        Schema::dropIfExists('academic_stages');
        Schema::dropIfExists('departments');
    }
};
