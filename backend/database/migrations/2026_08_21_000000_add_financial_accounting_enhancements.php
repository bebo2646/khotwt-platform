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
        // 1. Add fields to payment_histories
        Schema::table('payment_histories', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_histories', 'exam_id')) {
                $table->foreignId('exam_id')->nullable()->after('lesson_id')->constrained('exams')->onDelete('set null');
            }
            if (!Schema::hasColumn('payment_histories', 'original_price')) {
                $table->decimal('original_price', 10, 2)->nullable()->after('amount');
            }
            if (!Schema::hasColumn('payment_histories', 'discount_amount')) {
                $table->decimal('discount_amount', 10, 2)->default(0.00)->after('original_price');
            }
            if (!Schema::hasColumn('payment_histories', 'commission_rate')) {
                $table->decimal('commission_rate', 5, 2)->nullable()->after('discount_amount');
            }
        });

        // 2. Add exam_id to teacher_earnings
        Schema::table('teacher_earnings', function (Blueprint $table) {
            if (!Schema::hasColumn('teacher_earnings', 'exam_id')) {
                $table->foreignId('exam_id')->nullable()->after('lesson_id')->constrained('exams')->onDelete('set null');
            }
        });

        // 3. Add exam_id to platform_earnings
        Schema::table('platform_earnings', function (Blueprint $table) {
            if (!Schema::hasColumn('platform_earnings', 'exam_id')) {
                $table->foreignId('exam_id')->nullable()->after('lesson_id')->constrained('exams')->onDelete('set null');
            }
        });

        // 4. Add exam_id to refund_logs
        Schema::table('refund_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('refund_logs', 'exam_id')) {
                $table->foreignId('exam_id')->nullable()->after('lesson_id')->constrained('exams')->onDelete('set null');
            }
        });

        // 5. Normalize existing teacher_payouts status from 'paid' to 'completed' safely
        if (Schema::hasTable('teacher_payouts')) {
            DB::statement("UPDATE teacher_payouts SET status = 'completed' WHERE status = 'paid'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('refund_logs', function (Blueprint $table) {
            if (Schema::hasColumn('refund_logs', 'exam_id')) {
                $table->dropForeign(['exam_id']);
                $table->dropColumn('exam_id');
            }
        });

        Schema::table('platform_earnings', function (Blueprint $table) {
            if (Schema::hasColumn('platform_earnings', 'exam_id')) {
                $table->dropForeign(['exam_id']);
                $table->dropColumn('exam_id');
            }
        });

        Schema::table('teacher_earnings', function (Blueprint $table) {
            if (Schema::hasColumn('teacher_earnings', 'exam_id')) {
                $table->dropForeign(['exam_id']);
                $table->dropColumn('exam_id');
            }
        });

        Schema::table('payment_histories', function (Blueprint $table) {
            if (Schema::hasColumn('payment_histories', 'exam_id')) {
                $table->dropForeign(['exam_id']);
                $table->dropColumn('exam_id');
            }
            if (Schema::hasColumn('payment_histories', 'original_price')) {
                $table->dropColumn('original_price');
            }
            if (Schema::hasColumn('payment_histories', 'discount_amount')) {
                $table->dropColumn('discount_amount');
            }
            if (Schema::hasColumn('payment_histories', 'commission_rate')) {
                $table->dropColumn('commission_rate');
            }
        });
    }
};
