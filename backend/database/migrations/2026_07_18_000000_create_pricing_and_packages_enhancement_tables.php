<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Activation Code Packages
        Schema::create('activation_code_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->integer('number_of_codes');
            $table->decimal('price_per_code', 10, 2);
            $table->decimal('total_price', 10, 2);
            $table->boolean('active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // 2. Storage Packages
        Schema::create('storage_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->integer('storage_gb');
            $table->decimal('price', 10, 2);
            $table->boolean('active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // 3. Add checkout extensions to subscription_requests table
        Schema::table('subscription_requests', function (Blueprint $table) {
            $table->integer('duration_days')->nullable();
            $table->unsignedBigInteger('activation_code_package_id')->nullable();
            $table->unsignedBigInteger('storage_package_id')->nullable();
            $table->decimal('total_price', 10, 2)->nullable();

            $table->foreign('activation_code_package_id')->references('id')->on('activation_code_packages')->onDelete('set null');
            $table->foreign('storage_package_id')->references('id')->on('storage_packages')->onDelete('set null');
        });

        // 4. Seed default packages
        $codePackages = [
            [
                'name' => '50 Codes',
                'number_of_codes' => 50,
                'price_per_code' => 15.00,
                'total_price' => 750.00,
                'active' => true,
                'sort_order' => 1,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
            [
                'name' => '100 Codes',
                'number_of_codes' => 100,
                'price_per_code' => 14.00,
                'total_price' => 1400.00,
                'active' => true,
                'sort_order' => 2,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
            [
                'name' => '250 Codes',
                'number_of_codes' => 250,
                'price_per_code' => 13.00,
                'total_price' => 3250.00,
                'active' => true,
                'sort_order' => 3,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
            [
                'name' => '500 Codes',
                'number_of_codes' => 500,
                'price_per_code' => 12.00,
                'total_price' => 6000.00,
                'active' => true,
                'sort_order' => 4,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
            [
                'name' => '1000+ Codes',
                'number_of_codes' => 1000,
                'price_per_code' => 10.00,
                'total_price' => 10000.00,
                'active' => true,
                'sort_order' => 5,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
        ];

        $storagePackages = [
            [
                'name' => '+10 GB',
                'storage_gb' => 10,
                'price' => 100.00,
                'active' => true,
                'sort_order' => 1,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
            [
                'name' => '+25 GB',
                'storage_gb' => 25,
                'price' => 220.00,
                'active' => true,
                'sort_order' => 2,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
            [
                'name' => '+50 GB',
                'storage_gb' => 50,
                'price' => 400.00,
                'active' => true,
                'sort_order' => 3,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
            [
                'name' => '+100 GB',
                'storage_gb' => 100,
                'price' => 750.00,
                'active' => true,
                'sort_order' => 4,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
        ];

        DB::table('activation_code_packages')->insert($codePackages);
        DB::table('storage_packages')->insert($storagePackages);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscription_requests', function (Blueprint $table) {
            $table->dropForeign(['activation_code_package_id']);
            $table->dropForeign(['storage_package_id']);
            $table->dropColumn(['duration_days', 'activation_code_package_id', 'storage_package_id', 'total_price']);
        });

        Schema::dropIfExists('storage_packages');
        Schema::dropIfExists('activation_code_packages');
    }
};
