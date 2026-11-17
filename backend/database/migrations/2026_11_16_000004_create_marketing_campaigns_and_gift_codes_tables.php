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
        // 1. Marketing Campaigns Table
        Schema::create('marketing_campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->string('image_url', 500)->nullable();
            $table->string('offer_type', 50); // discount_percentage, discount_fixed, gift_code, bundle_deal, free_trial
            $table->decimal('discount_value', 10, 2)->nullable();
            $table->json('target_audience'); // roles, sectors, stages, grades, plans, subscription_status
            $table->json('target_packages')->nullable();
            $table->json('target_courses')->nullable();
            $table->json('target_plans')->nullable();
            $table->integer('max_uses')->nullable();
            $table->integer('used_count')->default(0);
            $table->integer('max_recipients')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_active', 'start_date', 'end_date'], 'mkt_campaigns_active_dates_idx');
        });

        // 2. Gift Codes Table with multi-role targeting support
        Schema::create('gift_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->foreignId('campaign_id')->nullable()->constrained('marketing_campaigns')->nullOnDelete();
            // Multi-role targeting: JSON array e.g. ["student"], ["student", "teacher"], ["doctor"], ["all"]
            $table->json('target_roles');
            $table->string('gift_type', 50); // wallet_credit, free_course, course_discount, subscription_days, extra_storage_gb, extra_codes
            $table->decimal('benefit_value', 10, 2)->default(0.00);
            $table->foreignId('applicable_course_id')->nullable()->constrained('courses')->nullOnDelete();
            $table->foreignId('applicable_plan_id')->nullable()->constrained('subscription_plans')->nullOnDelete();
            $table->integer('max_redemptions')->default(1);
            $table->integer('redemptions_count')->default(0);
            $table->boolean('is_multi_use')->default(false);
            $table->timestamp('expires_at')->nullable()->index();
            $table->boolean('is_active')->default(true)->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['code', 'is_active', 'expires_at'], 'gift_codes_lookup_idx');
        });

        // 3. Gift Code Redemptions Table (strictly one redemption per user per code)
        Schema::create('gift_code_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gift_code_id')->constrained('gift_codes')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('redeemed_at')->useCurrent();
            $table->string('ip_address', 45)->nullable();
            $table->bigInteger('telegram_chat_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['gift_code_id', 'user_id'], 'gift_code_user_unique');
            $table->index(['user_id', 'redeemed_at'], 'gift_redemptions_user_time_idx');
        });

        // 4. Campaign Deliveries Table with disambiguated telegram_account_id
        Schema::create('campaign_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('marketing_campaigns')->cascadeOnDelete();
            // Disambiguated internal DB ID referencing telegram_users.id
            $table->foreignId('telegram_account_id')->constrained('telegram_users')->cascadeOnDelete();
            $table->string('status', 30)->default('pending'); // pending, sent, failed, clicked, converted
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->timestamp('converted_at')->nullable();
            $table->timestamps();

            $table->index(['campaign_id', 'status'], 'mkt_deliv_camp_status_idx');
            $table->index(['telegram_account_id', 'status'], 'mkt_deliv_tg_acct_status_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('campaign_deliveries');
        Schema::dropIfExists('gift_code_redemptions');
        Schema::dropIfExists('gift_codes');
        Schema::dropIfExists('marketing_campaigns');
    }
};
