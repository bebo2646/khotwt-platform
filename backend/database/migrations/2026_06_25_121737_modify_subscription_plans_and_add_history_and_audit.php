<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Create or Modify subscription_plans table
        if (!Schema::hasTable('subscription_plans')) {
            Schema::create('subscription_plans', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique()->nullable();
                $table->text('description')->nullable();
                $table->decimal('price', 10, 2)->default(0.00);
                $table->string('currency')->default('EGP');
                $table->integer('duration_in_days')->default(30);
                $table->integer('max_courses')->nullable();
                $table->integer('max_storage_gb')->default(0);
                $table->integer('included_codes')->default(0);
                $table->boolean('featured')->default(false);
                $table->boolean('active')->default(true);
                $table->integer('sort_order')->default(0);
                $table->string('badge_text')->nullable();
                $table->string('color_theme')->nullable();
                $table->timestamps();
            });
        } else {
            Schema::table('subscription_plans', function (Blueprint $table) {
                if (!Schema::hasColumn('subscription_plans', 'slug')) {
                    $table->string('slug')->unique()->nullable();
                }
                if (!Schema::hasColumn('subscription_plans', 'description')) {
                    $table->text('description')->nullable();
                }
                if (!Schema::hasColumn('subscription_plans', 'price')) {
                    $table->decimal('price', 10, 2)->default(0.00);
                }
                if (!Schema::hasColumn('subscription_plans', 'currency')) {
                    $table->string('currency')->default('EGP');
                }
                if (!Schema::hasColumn('subscription_plans', 'duration_in_days')) {
                    $table->integer('duration_in_days')->default(30);
                }
                if (!Schema::hasColumn('subscription_plans', 'max_courses')) {
                    $table->integer('max_courses')->nullable();
                }
                if (!Schema::hasColumn('subscription_plans', 'max_storage_gb')) {
                    $table->integer('max_storage_gb')->default(0);
                }
                if (!Schema::hasColumn('subscription_plans', 'included_codes')) {
                    $table->integer('included_codes')->default(0);
                }
                if (!Schema::hasColumn('subscription_plans', 'featured')) {
                    $table->boolean('featured')->default(false);
                }
                if (!Schema::hasColumn('subscription_plans', 'active')) {
                    $table->boolean('active')->default(true);
                }
                if (!Schema::hasColumn('subscription_plans', 'sort_order')) {
                    $table->integer('sort_order')->default(0);
                }
                if (!Schema::hasColumn('subscription_plans', 'badge_text')) {
                    $table->string('badge_text')->nullable();
                }
                if (!Schema::hasColumn('subscription_plans', 'color_theme')) {
                    $table->string('color_theme')->nullable();
                }
            });

            // Populate the new columns from old columns if they exist
            $plans = DB::table('subscription_plans')->get();
            foreach ($plans as $plan) {
                $updates = [];
                
                // Copy price_egp to price
                if (isset($plan->price_egp) && $plan->price == 0.00) {
                    $updates['price'] = $plan->price_egp;
                }
                // Copy duration_days to duration_in_days
                if (isset($plan->duration_days) && $plan->duration_in_days == 30) {
                    $updates['duration_in_days'] = $plan->duration_days;
                }
                // Copy video_storage_gb to max_storage_gb
                if (isset($plan->video_storage_gb) && $plan->max_storage_gb == 0) {
                    $updates['max_storage_gb'] = $plan->video_storage_gb;
                }
                // Copy student_codes to included_codes
                if (isset($plan->student_codes) && $plan->included_codes == 0) {
                    $updates['included_codes'] = $plan->student_codes;
                }
                // Copy is_popular to featured
                if (isset($plan->is_popular)) {
                    $updates['featured'] = (bool)$plan->is_popular;
                }
                // Generate slug if empty
                if (empty($plan->slug)) {
                    $updates['slug'] = Str::slug($plan->name);
                }

                if (!empty($updates)) {
                    DB::table('subscription_plans')->where('id', $plan->id)->update($updates);
                }
            }
        }

        // 2. Create subscription_plan_price_history table
        if (!Schema::hasTable('subscription_plan_price_history')) {
            Schema::create('subscription_plan_price_history', function (Blueprint $table) {
                $table->id();
                $table->foreignId('plan_id')->constrained('subscription_plans')->onDelete('cascade');
                $table->decimal('old_price', 10, 2);
                $table->decimal('new_price', 10, 2);
                $table->foreignId('changed_by')->constrained('users')->onDelete('cascade');
                $table->timestamp('created_at')->useCurrent();
            });
        }

        // 3. Create subscription_plan_audit_logs table
        if (!Schema::hasTable('subscription_plan_audit_logs')) {
            Schema::create('subscription_plan_audit_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('plan_id')->constrained('subscription_plans')->onDelete('cascade');
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->string('action'); // 'create', 'update', 'delete', 'toggle_active', 'reorder'
                $table->json('old_values')->nullable();
                $table->json('new_values')->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subscription_plan_audit_logs');
        Schema::dropIfExists('subscription_plan_price_history');

        if (Schema::hasTable('subscription_plans')) {
            Schema::table('subscription_plans', function (Blueprint $table) {
                $columns = [
                    'slug', 'description', 'price', 'currency', 'duration_in_days',
                    'max_courses', 'max_storage_gb', 'included_codes', 'featured',
                    'active', 'sort_order', 'badge_text', 'color_theme'
                ];
                foreach ($columns as $column) {
                    if (Schema::hasColumn('subscription_plans', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
