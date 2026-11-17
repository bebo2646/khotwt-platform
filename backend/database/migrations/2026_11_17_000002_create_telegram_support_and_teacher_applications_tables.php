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
        // 1. Support Tickets
        Schema::create('telegram_support_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_code', 30)->unique();
            $table->bigInteger('telegram_user_id')->index();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('category', 50);
            $table->string('category_name', 100);
            $table->string('status', 20)->default('open')->index(); // open, in_progress, closed
            $table->string('subject', 255)->nullable();
            $table->string('last_reply_by', 20)->default('user'); // user, admin
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        // 2. Support Messages / Replies
        Schema::create('telegram_support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('telegram_support_tickets')->cascadeOnDelete();
            $table->string('sender_type', 20); // user, admin
            $table->bigInteger('sender_telegram_id');
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('message_text');
            $table->boolean('is_internal_note')->default(false);
            $table->timestamps();
        });

        // 3. Teacher Applications via Telegram
        Schema::create('teacher_applications', function (Blueprint $table) {
            $table->id();
            $table->bigInteger('telegram_user_id')->index();
            $table->string('name', 255);
            $table->string('phone', 50)->index();
            $table->string('email', 255)->index();
            $table->string('subject', 255);
            $table->json('grades');
            $table->text('center_details')->nullable();
            $table->string('status', 20)->default('pending')->index(); // pending, approved, rejected
            $table->text('rejection_reason')->nullable();
            $table->foreignId('created_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->bigInteger('reviewed_by_telegram_id')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });

        // 4. Telegram User Activity Tracking (DAU/MAU)
        Schema::create('telegram_user_activity', function (Blueprint $table) {
            $table->id();
            $table->bigInteger('telegram_user_id')->index();
            $table->string('action', 100);
            $table->date('activity_date')->index();
            $table->timestamps();

            $table->unique(['telegram_user_id', 'activity_date', 'action'], 'tg_user_act_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('telegram_user_activity');
        Schema::dropIfExists('teacher_applications');
        Schema::dropIfExists('telegram_support_messages');
        Schema::dropIfExists('telegram_support_tickets');
    }
};
