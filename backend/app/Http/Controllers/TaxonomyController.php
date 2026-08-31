<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\AcademicStage;
use App\Models\AcademicGrade;
use App\Models\Course;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class TaxonomyController extends Controller
{
    /**
     * Get entire public taxonomy (Active Departments, Stages with Grades, and flat Grades).
     */
    public function getTaxonomy()
    {
        $departments = Department::active()->get();
        $stages = AcademicStage::active()->with(['activeGrades'])->get();
        $grades = AcademicGrade::active()->with('stage')->get();

        return response()->json([
            'departments' => $departments,
            'stages' => $stages,
            'grades' => $grades,
        ]);
    }

    /**
     * Get active departments list with stats.
     */
    public function getDepartments()
    {
        $departments = Department::active()->get()->map(function ($dept) {
            $isSchool = ($dept->slug === 'school' || $dept->slug === 'general_education');

            // Count published courses
            $coursesCount = Course::where('is_published', true)
                ->where(function ($q) use ($dept, $isSchool) {
                    $q->where('category', $dept->slug);
                    if ($isSchool) {
                        $q->orWhereNull('category');
                    }
                })->count();

            // Count active teachers
            $teachersCount = User::where('role', 'teacher')
                ->where('status', 'active')
                ->where(function ($q) use ($dept, $isSchool) {
                    $q->where('category', $dept->slug);
                    if ($isSchool) {
                        $q->orWhereNull('category');
                    }
                    $q->orWhereHas('courses', function ($cq) use ($dept, $isSchool) {
                        $cq->where('is_published', true)
                           ->where(function ($sq) use ($dept, $isSchool) {
                               $sq->where('category', $dept->slug);
                               if ($isSchool) {
                                   $sq->orWhereNull('category');
                               }
                           });
                    });
                })->count();

            return [
                'id' => $dept->id,
                'name' => $dept->name,
                'slug' => $dept->slug,
                'description' => $dept->description,
                'icon' => $dept->icon,
                'badge' => $dept->badge,
                'order' => $dept->order,
                'is_active' => $dept->is_active,
                'courses_count' => $coursesCount,
                'teachers_count' => $teachersCount,
            ];
        });

        return response()->json($departments);
    }

    /**
     * Get specific department details with relevant courses, teachers, and stages.
     */
    public function getDepartmentBySlug($slug, Request $request)
    {
        $dept = Department::where('slug', $slug)->first();
        if (!$dept) {
            // Check fallback for general_education / school
            if ($slug === 'school' || $slug === 'general_education') {
                $dept = Department::whereIn('slug', ['school', 'general_education'])->first();
            }
        }

        if (!$dept) {
            return response()->json(['message' => 'القسم غير موجود'], 404);
        }

        $isSchool = ($dept->slug === 'school' || $dept->slug === 'general_education');

        // Courses query for this department
        $coursesQuery = Course::with(['teacher' => function($q) {
                $q->select('id', 'name', 'avatar', 'subject', 'slug');
            }])
            ->withCount(['units', 'lessons'])
            ->where('is_published', true)
            ->where(function ($q) use ($dept, $isSchool) {
                $q->where('category', $dept->slug);
                if ($isSchool) {
                    $q->orWhereNull('category');
                }
            });

        // Filter by grade if passed
        if ($request->has('grade') && !empty($request->grade)) {
            $coursesQuery->where('grade', $request->grade);
        }

        // Filter by search query if passed
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $coursesQuery->where(function ($q) use ($search) {
                $q->where('title', 'ilike', "%{$search}%")
                  ->orWhere('description', 'ilike', "%{$search}%")
                  ->orWhereHas('teacher', function ($tq) use ($search) {
                      $tq->where('name', 'ilike', "%{$search}%");
                  });
            });
        }

        $courses = $coursesQuery->orderBy('created_at', 'desc')->get();

        // Teachers query for this department
        $teachersQuery = User::where('role', 'teacher')
            ->where('status', 'active')
            ->where(function ($q) use ($dept, $isSchool) {
                $q->where('category', $dept->slug);
                if ($isSchool) {
                    $q->orWhereNull('category');
                }
            })
            ->withCount(['courses as published_courses_count' => function ($query) {
                $query->where('is_published', true);
            }]);

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $teachersQuery->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('subject', 'ilike', "%{$search}%")
                  ->orWhere('bio', 'ilike', "%{$search}%");
            });
        }

        $teachers = $teachersQuery->orderBy('id', 'asc')->get();

        // Stages for school department filtering
        $stages = $isSchool ? AcademicStage::active()->with(['activeGrades'])->get() : [];

        return response()->json([
            'department' => $dept,
            'courses' => $courses,
            'teachers' => $teachers,
            'stages' => $stages,
            'courses_count' => $courses->count(),
            'teachers_count' => $teachers->count(),
        ]);
    }

    /**
     * Get active academic stages with grades.
     */
    public function getAcademicStages()
    {
        $stages = AcademicStage::active()->with('activeGrades')->get();
        return response()->json($stages);
    }

    /**
     * Get active academic grades.
     */
    public function getAcademicGrades()
    {
        $grades = AcademicGrade::active()->with('stage')->get();
        return response()->json($grades);
    }

    /* =========================================================================
     * ADMIN TAXONOMY MANAGEMENT ENDPOINTS
     * ========================================================================= */

    /**
     * Admin: List all departments.
     */
    public function listDepartmentsAdmin()
    {
        $departments = Department::orderBy('order', 'asc')->get()->map(function ($dept) {
            $isSchool = ($dept->slug === 'school' || $dept->slug === 'general_education');

            $dept->courses_count = Course::where(function ($q) use ($dept, $isSchool) {
                $q->where('category', $dept->slug);
                if ($isSchool) {
                    $q->orWhereNull('category');
                }
            })->count();

            $dept->teachers_count = User::where('role', 'teacher')
                ->where(function ($q) use ($dept, $isSchool) {
                    $q->where('category', $dept->slug);
                    if ($isSchool) {
                        $q->orWhereNull('category');
                    }
                })->count();

            return $dept;
        });

        return response()->json($departments);
    }

    /**
     * Admin: Create a new department.
     */
    public function createDepartment(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:departments,slug',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:255',
            'badge' => 'nullable|string|max:255',
            'order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']) ?: 'dept_' . time();
            $originalSlug = $validated['slug'];
            $count = 1;
            while (Department::where('slug', $validated['slug'])->exists()) {
                $validated['slug'] = $originalSlug . '_' . $count++;
            }
        }

        $validated['order'] = $validated['order'] ?? (Department::max('order') + 1);
        $validated['is_active'] = $validated['is_active'] ?? true;

        $department = Department::create($validated);

        return response()->json([
            'message' => 'تم إنشاء القسم بنجاح',
            'department' => $department,
        ], 201);
    }

    /**
     * Admin: Update department.
     */
    public function updateDepartment(Request $request, $id)
    {
        $department = Department::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:departments,slug,' . $id,
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:255',
            'badge' => 'nullable|string|max:255',
            'order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $department->update($validated);

        return response()->json([
            'message' => 'تم تحديث القسم بنجاح',
            'department' => $department,
        ]);
    }

    /**
     * Admin: Delete department.
     */
    public function deleteDepartment($id)
    {
        $department = Department::findOrFail($id);

        $isSchool = ($department->slug === 'school' || $department->slug === 'general_education');
        $coursesCount = Course::where('category', $department->slug)->count();

        if ($coursesCount > 0 && !$isSchool) {
            return response()->json([
                'message' => "لا يمكن حذف القسم لوجود {$coursesCount} كورس مرتبط به. يرجى نقل أو تعديل الكورسات أولاً.",
            ], 422);
        }

        $department->delete();

        return response()->json([
            'message' => 'تم حذف القسم بنجاح',
        ]);
    }

    /**
     * Admin: Toggle department active status.
     */
    public function toggleDepartmentStatus($id)
    {
        $department = Department::findOrFail($id);
        $department->is_active = !$department->is_active;
        $department->save();

        return response()->json([
            'message' => 'تم تغيير حالة القسم بنجاح',
            'is_active' => $department->is_active,
            'department' => $department,
        ]);
    }

    /**
     * Admin: List all academic stages with grades.
     */
    public function listAcademicStagesAdmin()
    {
        $stages = AcademicStage::orderBy('order', 'asc')
            ->with(['grades' => function($q) {
                $q->orderBy('order', 'asc');
            }])
            ->get();

        return response()->json($stages);
    }

    /**
     * Admin: Create academic stage.
     */
    public function createAcademicStage(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:academic_stages,slug',
            'order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']) ?: 'stage_' . time();
            $originalSlug = $validated['slug'];
            $count = 1;
            while (AcademicStage::where('slug', $validated['slug'])->exists()) {
                $validated['slug'] = $originalSlug . '_' . $count++;
            }
        }

        $validated['order'] = $validated['order'] ?? (AcademicStage::max('order') + 1);
        $validated['is_active'] = $validated['is_active'] ?? true;

        $stage = AcademicStage::create($validated);
        $stage->load('grades');

        return response()->json([
            'message' => 'تم إنشاء المرحلة الدراسية بنجاح',
            'stage' => $stage,
        ], 201);
    }

    /**
     * Admin: Update academic stage.
     */
    public function updateAcademicStage(Request $request, $id)
    {
        $stage = AcademicStage::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:academic_stages,slug,' . $id,
            'order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $stage->update($validated);
        $stage->load('grades');

        return response()->json([
            'message' => 'تم تحديث المرحلة الدراسية بنجاح',
            'stage' => $stage,
        ]);
    }

    /**
     * Admin: Delete academic stage.
     */
    public function deleteAcademicStage($id)
    {
        $stage = AcademicStage::findOrFail($id);
        $stage->delete();

        return response()->json([
            'message' => 'تم حذف المرحلة الدراسية وصفوفها بنجاح',
        ]);
    }

    /**
     * Admin: Toggle stage active status.
     */
    public function toggleAcademicStageStatus($id)
    {
        $stage = AcademicStage::findOrFail($id);
        $stage->is_active = !$stage->is_active;
        $stage->save();

        return response()->json([
            'message' => 'تم تغيير حالة المرحلة الدراسية بنجاح',
            'is_active' => $stage->is_active,
            'stage' => $stage,
        ]);
    }

    /**
     * Admin: List all academic grades.
     */
    public function listAcademicGradesAdmin(Request $request)
    {
        $query = AcademicGrade::with('stage')->orderBy('order', 'asc');

        if ($request->has('stage_id') && !empty($request->stage_id)) {
            $query->where('stage_id', $request->stage_id);
        }

        $grades = $query->get();

        return response()->json($grades);
    }

    /**
     * Admin: Create academic grade.
     */
    public function createAcademicGrade(Request $request)
    {
        $validated = $request->validate([
            'stage_id' => 'required|exists:academic_stages,id',
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:academic_grades,slug',
            'short_code' => 'nullable|string|max:50',
            'order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']) ?: 'grade_' . time();
            $originalSlug = $validated['slug'];
            $count = 1;
            while (AcademicGrade::where('slug', $validated['slug'])->exists()) {
                $validated['slug'] = $originalSlug . '_' . $count++;
            }
        }

        $validated['order'] = $validated['order'] ?? (AcademicGrade::where('stage_id', $validated['stage_id'])->max('order') + 1);
        $validated['is_active'] = $validated['is_active'] ?? true;

        $grade = AcademicGrade::create($validated);
        $grade->load('stage');

        return response()->json([
            'message' => 'تم إضافة الصف الدراسي بنجاح',
            'grade' => $grade,
        ], 201);
    }

    /**
     * Admin: Update academic grade.
     */
    public function updateAcademicGrade(Request $request, $id)
    {
        $grade = AcademicGrade::findOrFail($id);

        $validated = $request->validate([
            'stage_id' => 'required|exists:academic_stages,id',
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:academic_grades,slug,' . $id,
            'short_code' => 'nullable|string|max:50',
            'order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $grade->update($validated);
        $grade->load('stage');

        return response()->json([
            'message' => 'تم تحديث الصف الدراسي بنجاح',
            'grade' => $grade,
        ]);
    }

    /**
     * Admin: Delete academic grade.
     */
    public function deleteAcademicGrade($id)
    {
        $grade = AcademicGrade::findOrFail($id);
        $grade->delete();

        return response()->json([
            'message' => 'تم حذف الصف الدراسي بنجاح',
        ]);
    }

    /**
     * Admin: Toggle grade active status.
     */
    public function toggleAcademicGradeStatus($id)
    {
        $grade = AcademicGrade::findOrFail($id);
        $grade->is_active = !$grade->is_active;
        $grade->save();

        return response()->json([
            'message' => 'تم تغيير حالة الصف الدراسي بنجاح',
            'is_active' => $grade->is_active,
            'grade' => $grade,
        ]);
    }
}
