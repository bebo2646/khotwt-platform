<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if (!Schema::hasColumn('courses', 'last_content_updated_at')) {
                $table->timestamp('last_content_updated_at')->nullable()->after('updated_at');
            }
        });

        // Initialize existing courses' last_content_updated_at with updated_at
        try {
            DB::table('courses')
                ->whereNull('last_content_updated_at')
                ->update([
                    'last_content_updated_at' => DB::raw('COALESCE(updated_at, created_at, NOW())')
                ]);
        } catch (\Throwable $t) {
            // Ignore if in test env or fresh table
        }
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if (Schema::hasColumn('courses', 'last_content_updated_at')) {
                $table->dropColumn('last_content_updated_at');
            }
        });
    }
};
