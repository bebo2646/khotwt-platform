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
        Schema::create('telegram_processed_updates', function (Blueprint $table) {
            $table->id();
            // External Telegram update_id guaranteed unique
            $table->unsignedBigInteger('update_id')->unique();
            $table->bigInteger('chat_id')->nullable()->index();
            $table->unsignedBigInteger('telegram_user_id')->nullable()->index();
            // Outbox / Lifecycle status: pending, processing, processed, failed
            $table->string('status', 30)->default('pending')->index();
            $table->json('payload')->nullable();
            $table->integer('attempts')->default(0);
            $table->text('error_message')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['update_id', 'status'], 'tg_updates_id_status_idx');
            $table->index(['status', 'created_at'], 'tg_updates_status_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('telegram_processed_updates');
    }
};
