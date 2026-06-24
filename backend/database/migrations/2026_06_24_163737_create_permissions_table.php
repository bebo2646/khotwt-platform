<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('group_key');
            $table->string('group_label');
            $table->string('label_ar');
            $table->timestamps();
        });

        // Seed permissions from config/permissions.php
        $config = require base_path('config/permissions.php');
        $groups = $config['groups'] ?? [];
        $permissions = $config['permissions'] ?? [];

        foreach ($permissions as $key => $details) {
            $groupKey = $details['group'];
            \Illuminate\Support\Facades\DB::table('permissions')->insert([
                'key' => $key,
                'group_key' => $groupKey,
                'group_label' => $groups[$groupKey] ?? $groupKey,
                'label_ar' => $details['label'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('permissions');
    }
};
