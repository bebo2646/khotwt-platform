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
        // 1. Subscription Plans Table
        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->integer('video_storage_gb');
            $table->integer('student_codes');
            $table->decimal('price_egp', 10, 2);
            $table->timestamps();
        });

        // 2. Teacher Subscriptions Table
        Schema::create('teacher_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('plan_id')->constrained('subscription_plans')->onDelete('restrict');
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status')->default('Active'); // Active, Expiring Soon, Expired, Suspended
            $table->bigInteger('used_storage_bytes')->default(0);
            $table->integer('used_codes')->default(0);
            $table->timestamps();
        });

        // 3. Subscription Addons Table (Extra storage / codes)
        Schema::create('subscription_addons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_subscription_id')->constrained('teacher_subscriptions')->onDelete('cascade');
            $table->string('type'); // 'storage' or 'codes'
            $table->integer('amount'); // GB for storage, count for codes
            $table->decimal('price_egp', 10, 2);
            $table->timestamps();
        });

        // 4. Subscription Payments Table
        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_subscription_id')->constrained('teacher_subscriptions')->onDelete('cascade');
            $table->decimal('amount', 10, 2);
            $table->string('payment_status')->default('Pending'); // Paid, Pending, Unpaid
            $table->timestamp('payment_date')->nullable();
            $table->foreignId('admin_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('admin_name')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 5. Subscription Upgrade/Addon Requests Table
        Schema::create('subscription_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
            $table->string('type'); // 'plan_upgrade', 'extra_storage', 'extra_codes'
            $table->foreignId('requested_plan_id')->nullable()->constrained('subscription_plans')->onDelete('set null');
            $table->integer('amount')->nullable(); // GB of storage or number of codes requested
            $table->string('status')->default('Pending'); // Pending, Approved, Rejected
            $table->timestamps();
        });

        // 6. Notifications Table
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('message');
            $table->string('recipient_type'); // 'all', 'students', 'teachers', 'specific_teacher', 'specific_student'
            $table->foreignId('recipient_id')->nullable()->constrained('users')->onDelete('cascade');
            $table->boolean('important')->default(false);
            $table->timestamps();
        });

        // 7. Notification Reads Table (for tracking unread notifications)
        Schema::create('notification_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('notification_id')->constrained('notifications')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->timestamp('read_at');
            $table->timestamps();
        });

        // 8. Add storage_size column to videos table to cache Bunny Stream storage size in bytes
        if (Schema::hasTable('videos')) {
            Schema::table('videos', function (Blueprint $table) {
                if (!Schema::hasColumn('videos', 'storage_size')) {
                    $table->bigInteger('storage_size')->default(0);
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('videos')) {
            Schema::table('videos', function (Blueprint $table) {
                if (Schema::hasColumn('videos', 'storage_size')) {
                    $table->dropColumn('storage_size');
                }
            });
        }

        Schema::dropIfExists('notification_reads');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('subscription_requests');
        Schema::dropIfExists('subscription_payments');
        Schema::dropIfExists('subscription_addons');
        Schema::dropIfExists('teacher_subscriptions');
        Schema::dropIfExists('subscription_plans');
    }
};
