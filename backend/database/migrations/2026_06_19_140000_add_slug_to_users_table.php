<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use App\Models\User;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'slug')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('slug')->nullable()->unique();
            });
        }

        // Generate slugs for existing teachers
        $teachers = User::where('role', 'teacher')->get();
        foreach ($teachers as $teacher) {
            $slugName = str_replace('أ. ', '', $teacher->name);
            $slugName = str_replace('مستر ', '', $slugName);
            $slug = Str::slug($slugName);
            if (empty($slug)) {
                // Fallback translations/transliterations for Arabic names
                if (str_contains($teacher->name, 'محمد أحمد')) {
                    $slug = 'mohamed-ahmed';
                } elseif (str_contains($teacher->name, 'خالد محمود')) {
                    $slug = 'khaled-mahmoud';
                } elseif (str_contains($teacher->name, 'جمال عبد الناصر')) {
                    $slug = 'gamal-abdel-nasser';
                } else {
                    $slug = 'teacher-' . $teacher->id;
                }
            }

            // Ensure unique slug
            $originalSlug = $slug;
            $counter = 1;
            while (User::where('slug', $slug)->exists()) {
                $slug = $originalSlug . '-' . $counter;
                $counter++;
            }

            $teacher->slug = $slug;
            $teacher->save();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('users', 'slug')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('slug');
            });
        }
    }
};
