<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use App\Models\Course;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('courses', 'slug')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->string('slug')->nullable()->unique();
            });
        }

        // Generate slugs for existing courses
        $courses = Course::all();
        foreach ($courses as $course) {
            $slug = $this->makeArabicSlug($course->title);
            
            // Ensure uniqueness
            $originalSlug = $slug;
            $counter = 1;
            while (Course::where('slug', $slug)->exists()) {
                $slug = $originalSlug . '-' . $counter;
                $counter++;
            }

            $course->slug = $slug;
            $course->save();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('courses', 'slug')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->dropColumn('slug');
            });
        }
    }

    /**
     * Generate an SEO friendly slug supporting Arabic characters.
     */
    private function makeArabicSlug(string $string): string
    {
        // Replace non letter or digits by -
        $text = preg_replace('~[^\pL\d]+~u', '-', $string);
        // Remove unwanted characters
        $text = preg_replace('~[^-\w\pL\d]+~u', '', $text);
        // Trim
        $text = trim($text, '-');
        // Remove duplicate -
        $text = preg_replace('~-+~', '-', $text);
        // Lowercase
        $text = mb_strtolower($text, 'UTF-8');
        
        if (empty($text)) {
            return 'course-' . Str::random(5);
        }
        return $text;
    }
};
