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
        // 1. Add refinement columns to subscription_plans
        Schema::table('subscription_plans', function (Blueprint $table) {
            if (!Schema::hasColumn('subscription_plans', 'duration_days')) {
                $table->integer('duration_days')->default(30);
            }
            if (!Schema::hasColumn('subscription_plans', 'is_trial')) {
                $table->boolean('is_trial')->default(false);
            }
            if (!Schema::hasColumn('subscription_plans', 'is_popular')) {
                $table->boolean('is_popular')->default(false);
            }
        });

        // 2. Add columns to purchase_codes
        Schema::table('purchase_codes', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_codes', 'code_type')) {
                $table->string('code_type')->default('wallet'); // wallet, teacher, course
            }
            if (!Schema::hasColumn('purchase_codes', 'credit_amount')) {
                $table->decimal('credit_amount', 10, 2)->default(0.00);
            }
        });

        // 3. Create student_teacher_credits table
        if (!Schema::hasTable('student_teacher_credits')) {
            Schema::create('student_teacher_credits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
                $table->decimal('balance', 10, 2)->default(0.00);
                $table->timestamps();
            });
        }

        // 4. Create subscription_settings table
        if (!Schema::hasTable('subscription_settings')) {
            Schema::create('subscription_settings', function (Blueprint $table) {
                $table->id();
                $table->string('key')->unique();
                $table->text('value')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subscription_settings');
        Schema::dropIfExists('student_teacher_credits');

        Schema::table('purchase_codes', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_codes', 'code_type')) {
                $table->dropColumn('code_type');
            }
            if (Schema::hasColumn('purchase_codes', 'credit_amount')) {
                $table->dropColumn('credit_amount');
            }
        });

        Schema::table('subscription_plans', function (Blueprint $table) {
            if (Schema::hasColumn('subscription_plans', 'duration_days')) {
                $table->dropColumn('duration_days');
            }
            if (Schema::hasColumn('subscription_plans', 'is_trial')) {
                $table->dropColumn('is_trial');
            }
            if (Schema::hasColumn('subscription_plans', 'is_popular')) {
                $table->dropColumn('is_popular');
            }
        });
    }
};
