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
        // 1. Separate conversation state and admin chat on telegram_users
        Schema::table('telegram_users', function (Blueprint $table) {
            if (!Schema::hasColumn('telegram_users', 'admin_chat_id')) {
                $table->bigInteger('admin_chat_id')->nullable()->after('telegram_chat_id')->index();
            }
            if (!Schema::hasColumn('telegram_users', 'admin_conversation_state')) {
                $table->string('admin_conversation_state', 100)->nullable()->after('state_payload');
            }
            if (!Schema::hasColumn('telegram_users', 'admin_state_payload')) {
                $table->json('admin_state_payload')->nullable()->after('admin_conversation_state');
            }
            if (!Schema::hasColumn('telegram_users', 'admin_last_interaction_at')) {
                $table->timestamp('admin_last_interaction_at')->nullable()->after('admin_state_payload');
            }
        });

        // 2. Separate bot updates isolation on telegram_processed_updates
        Schema::table('telegram_processed_updates', function (Blueprint $table) {
            if (!Schema::hasColumn('telegram_processed_updates', 'bot_type')) {
                $table->string('bot_type', 30)->default('user')->after('update_id')->index();
            }
        });

        // PostgreSQL specific: drop global unique on update_id and create composite unique (bot_type, update_id)
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE telegram_processed_updates DROP CONSTRAINT IF EXISTS telegram_processed_updates_update_id_key;');
            DB::statement('DROP INDEX IF EXISTS telegram_processed_updates_update_id_key;');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS telegram_processed_updates_bot_update_unique ON telegram_processed_updates (bot_type, update_id);');
        } else {
            Schema::table('telegram_processed_updates', function (Blueprint $table) {
                $table->unique(['bot_type', 'update_id'], 'tg_bot_update_unique');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS telegram_processed_updates_bot_update_unique;');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS telegram_processed_updates_update_id_key ON telegram_processed_updates (update_id);');
        }

        Schema::table('telegram_processed_updates', function (Blueprint $table) {
            if (Schema::hasColumn('telegram_processed_updates', 'bot_type')) {
                $table->dropColumn('bot_type');
            }
        });

        Schema::table('telegram_users', function (Blueprint $table) {
            $cols = [];
            foreach (['admin_chat_id', 'admin_conversation_state', 'admin_state_payload', 'admin_last_interaction_at'] as $col) {
                if (Schema::hasColumn('telegram_users', $col)) {
                    $cols[] = $col;
                }
            }
            if (!empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
