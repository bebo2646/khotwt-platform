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
        // 1. Security & Suspicious Request Events
        Schema::create('security_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('event_type', 80); // unknown_route, unauthenticated_request, forbidden_resource, role_access_violation, login_bruteforce_block, etc.
            $table->string('severity', 20)->default('info'); // info, low, medium, high, critical
            $table->string('ip_address', 45);
            $table->text('user_agent')->nullable();
            $table->string('method', 10); // GET, POST, PUT, DELETE, PATCH, etc.
            $table->string('path', 500);
            $table->integer('status_code');
            $table->string('request_id', 64)->nullable()->index();
            $table->string('session_identifier', 128)->nullable()->index();
            $table->string('resource_type', 50)->nullable(); // course, lesson, exam, user, student, etc.
            $table->unsignedBigInteger('resource_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at')->useCurrent();
            $table->timestamps();

            // Performance & Reporting Indexes
            $table->index('user_id');
            $table->index('event_type');
            $table->index('severity');
            $table->index('ip_address');
            $table->index('status_code');
            $table->index('occurred_at');
            $table->index(['severity', 'occurred_at']);
            $table->index(['event_type', 'occurred_at']);
            $table->index(['user_id', 'occurred_at']);
            $table->index(['ip_address', 'occurred_at']);
        });

        // 2. IP Security & Brute-Force Blocks
        Schema::create('ip_security_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('ip_address', 45)->unique();
            $table->integer('failed_attempts')->default(0);
            $table->timestamp('first_attempt_at')->nullable();
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamp('blocked_at')->nullable();
            $table->timestamp('blocked_until')->nullable();
            $table->boolean('is_blocked')->default(false);
            $table->string('reason', 255)->nullable();
            $table->string('last_identifier', 255)->nullable(); // safe username / email (never passwords)
            $table->text('user_agent')->nullable();
            $table->timestamps();

            $table->index(['is_blocked', 'blocked_until']);
            $table->index('ip_address');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ip_security_blocks');
        Schema::dropIfExists('security_events');
    }
};
