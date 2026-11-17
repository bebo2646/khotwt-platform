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
        // 1. telegram_users table
        Schema::create('telegram_users', function (Blueprint $table) {
            $table->id(); // Internal DB record ID (telegram_account_id)
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('telegram_user_id')->unique(); // External Telegram User ID (e.g. from.id)
            $table->bigInteger('telegram_chat_id')->index(); // External Telegram Private Chat ID
            $table->string('telegram_username', 100)->nullable();
            $table->string('first_name', 100)->nullable();
            $table->string('last_name', 100)->nullable();
            $table->string('phone', 30)->nullable()->index(); // Verified phone number
            $table->string('role', 30)->nullable()->default('guest'); // student, teacher, doctor, guardian, guest
            $table->boolean('is_linked')->default(false)->index();
            $table->timestamp('linked_at')->nullable();
            $table->timestamp('last_interaction_at')->nullable();
            $table->boolean('marketing_opt_in')->default(true);
            $table->boolean('notifications_enabled')->default(true);
            $table->string('current_conversation_state', 100)->nullable();
            $table->json('state_payload')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_linked'], 'tg_users_user_linked_idx');
            $table->index(['phone', 'is_linked'], 'tg_users_phone_linked_idx');
        });

        // Partial unique index for PostgreSQL: exactly ONE active Telegram link per Khotwtk user
        // Allows unlinking and re-linking cleanly without unique constraint collision on inactive records
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE UNIQUE INDEX unique_active_user_telegram_link ON telegram_users (user_id) WHERE is_linked = true AND user_id IS NOT NULL');
        }

        // 2. telegram_link_tokens table
        Schema::create('telegram_link_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('token_hash', 64)->unique(); // SHA-256 hash of plaintext token
            $table->timestamp('expires_at')->index();
            $table->timestamp('used_at')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['token_hash', 'used_at', 'expires_at'], 'tg_link_tokens_lookup_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS unique_active_user_telegram_link');
        }

        Schema::dropIfExists('telegram_link_tokens');
        Schema::dropIfExists('telegram_users');
    }
};
