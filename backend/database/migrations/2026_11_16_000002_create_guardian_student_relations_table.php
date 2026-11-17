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
        Schema::create('guardian_student_relations', function (Blueprint $table) {
            $table->id();
            // Disambiguated internal DB ID referencing telegram_users.id
            $table->foreignId('guardian_telegram_account_id')->constrained('telegram_users')->cascadeOnDelete();
            $table->foreignId('student_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('verified_phone', 30)->index(); // Phone verified via Telegram Request Contact
            $table->string('status', 30)->default('active'); // active, suspended, revoked
            $table->boolean('notifications_enabled')->default(true);
            $table->boolean('weekly_report_enabled')->default(true);
            $table->timestamp('linked_at')->useCurrent();
            $table->timestamps();

            // Unique constraint: A guardian Telegram account can only link a given student once
            $table->unique(['guardian_telegram_account_id', 'student_user_id'], 'guardian_student_unique_link');
            $table->index(['verified_phone', 'student_user_id'], 'guardian_phone_student_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('guardian_student_relations');
    }
};
