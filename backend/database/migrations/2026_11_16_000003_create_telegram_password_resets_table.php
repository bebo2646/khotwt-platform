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
        Schema::create('telegram_password_resets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('telegram_user_id')->nullable()->index();
            $table->bigInteger('telegram_chat_id')->index();
            $table->string('verified_phone', 30)->index();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at')->index();
            $table->timestamp('used_at')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();

            $table->index(['token_hash', 'used_at', 'expires_at'], 'tg_pw_resets_hash_used_exp_idx');
            $table->index(['telegram_chat_id', 'created_at'], 'tg_pw_resets_chat_created_idx');
            $table->index(['user_id', 'created_at'], 'tg_pw_resets_user_created_idx');
            $table->index(['verified_phone', 'created_at'], 'tg_pw_resets_phone_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('telegram_password_resets');
    }
};
