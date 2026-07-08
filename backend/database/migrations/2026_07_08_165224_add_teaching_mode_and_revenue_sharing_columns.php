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
        // 1. Add fields to users table (Teaching Mode)
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'teaching_mode')) {
                $table->string('teaching_mode')->default('both'); // 'online', 'center', 'both'
            }
        });

        // 2. Add availability to courses table
        Schema::table('courses', function (Blueprint $table) {
            if (!Schema::hasColumn('courses', 'availability')) {
                $table->string('availability')->default('both'); // 'online', 'center', 'both'
            }
        });

        // 3. Add fields to subscription_plans table to support flexible billing types
        Schema::table('subscription_plans', function (Blueprint $table) {
            if (!Schema::hasColumn('subscription_plans', 'billing_type')) {
                $table->string('billing_type')->default('monthly'); // 'monthly', 'revenue_sharing'
            }
            if (!Schema::hasColumn('subscription_plans', 'commission_percentage')) {
                $table->decimal('commission_percentage', 5, 2)->default(20.00);
            }
            if (!Schema::hasColumn('subscription_plans', 'default_storage_gb')) {
                $table->float('default_storage_gb')->default(50.00);
            }
            if (!Schema::hasColumn('subscription_plans', 'codes_limit_type')) {
                $table->string('codes_limit_type')->default('unlimited'); // 'unlimited', 'max'
            }
            if (!Schema::hasColumn('subscription_plans', 'max_codes_limit')) {
                $table->integer('max_codes_limit')->nullable();
            }
        });

        // 4. Add fields to teacher_subscriptions table
        Schema::table('teacher_subscriptions', function (Blueprint $table) {
            if (!Schema::hasColumn('teacher_subscriptions', 'allocated_storage_from_sales')) {
                $table->float('allocated_storage_from_sales')->default(0.00);
            }
            if (!Schema::hasColumn('teacher_subscriptions', 'auto_expand_storage')) {
                $table->boolean('auto_expand_storage')->default(true);
            }
        });

        // 5. Create teacher payouts table
        if (!Schema::hasTable('teacher_payouts')) {
            Schema::create('teacher_payouts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
                $table->decimal('amount', 10, 2);
                $table->string('status')->default('pending'); // 'pending', 'paid'
                $table->timestamp('payout_date')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        // 6. Create teacher earnings table
        if (!Schema::hasTable('teacher_earnings')) {
            Schema::create('teacher_earnings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
                $table->decimal('amount', 10, 2);
                $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('set null');
                $table->foreignId('package_id')->nullable()->constrained('packages')->onDelete('set null');
                $table->foreignId('lesson_id')->nullable()->constrained('lessons')->onDelete('set null');
                $table->foreignId('purchase_code_id')->nullable()->constrained('purchase_codes')->onDelete('set null');
                $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
                $table->string('source'); // 'code_activation', 'direct_purchase'
                $table->string('status')->default('pending'); // 'pending', 'paid'
                $table->foreignId('payout_id')->nullable()->constrained('teacher_payouts')->onDelete('set null');
                $table->timestamps();
            });
        }

        // 7. Create platform earnings table
        if (!Schema::hasTable('platform_earnings')) {
            Schema::create('platform_earnings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
                $table->decimal('amount', 10, 2);
                $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('set null');
                $table->foreignId('package_id')->nullable()->constrained('packages')->onDelete('set null');
                $table->foreignId('lesson_id')->nullable()->constrained('lessons')->onDelete('set null');
                $table->foreignId('purchase_code_id')->nullable()->constrained('purchase_codes')->onDelete('set null');
                $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
                $table->string('source'); // 'code_activation', 'direct_purchase'
                $table->timestamps();
            });
        }

        // 8. Create payment histories table
        if (!Schema::hasTable('payment_histories')) {
            Schema::create('payment_histories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
                $table->decimal('amount', 10, 2);
                $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('set null');
                $table->foreignId('package_id')->nullable()->constrained('packages')->onDelete('set null');
                $table->foreignId('lesson_id')->nullable()->constrained('lessons')->onDelete('set null');
                $table->foreignId('purchase_code_id')->nullable()->constrained('purchase_codes')->onDelete('set null');
                $table->string('payment_method'); // 'code', 'wallet'
                $table->string('status')->default('paid');
                $table->timestamps();
            });
        }

        // 9. Create purchase audit logs table
        if (!Schema::hasTable('purchase_audit_logs')) {
            Schema::create('purchase_audit_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
                $table->string('action');
                $table->text('details')->nullable();
                $table->string('ip_address')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_audit_logs');
        Schema::dropIfExists('payment_histories');
        Schema::dropIfExists('platform_earnings');
        Schema::dropIfExists('teacher_earnings');
        Schema::dropIfExists('teacher_payouts');

        Schema::table('teacher_subscriptions', function (Blueprint $table) {
            $table->dropColumn(['allocated_storage_from_sales', 'auto_expand_storage']);
        });

        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->dropColumn(['billing_type', 'commission_percentage', 'default_storage_gb', 'codes_limit_type', 'max_codes_limit']);
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('availability');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('teaching_mode');
        });
    }
};
