<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\AcademicStage;
use App\Models\AcademicGrade;
use App\Models\AcademicSubject;
use App\Models\Course;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class TaxonomyController extends Controller
{
    /**
     * Get entire public taxonomy (Active Departments, Stages with Grades and Subjects, and flat Grades and Subjects).
     */
    public function getTaxonomy()
    {
        $departments = Department::active()->get();
        $stages = AcademicStage::active()->with(['activeGrades', 'activeSubjects'])->get();
        $grades = AcademicGrade::active()->with(['stage', 'activeSubjects'])->get();
        $subjects = AcademicSubject::active()->with(['stage', 'grade'])->get();

        return response()->json([
            'departments' => $departments,
            'stages' => $stages,
            'grades' => $grades,
            'subjects' => $subjects,
        ]);
    }

    /**
     * Get active academic subjects filtered optionally by sector, stage_id, or grade_id.
     */
    public function getAcademicSubjects(Request $request)
    {
        $query = AcademicSubject::active()->with(['stage', 'grade']);

        if ($request->has('sector') && !empty($request->sector)) {
            $query->where('sector', $request->sector);
        }

        if ($request->has('stage_id') && !empty($request->stage_id)) {
            $query->where(function($q) use ($request) {
                $q->where('stage_id', $request->stage_id)
                  ->orWhereNull('stage_id');
            });
        }

        if ($request->has('grade_id') && !empty($request->grade_id)) {
            $query->where(function($q) use ($request) {
                $q->where('grade_id', $request->grade_id)
                  ->orWhereNull('grade_id');
            });
        }

        return response()->json($query->orderBy('order', 'asc')->get());
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
     * Admin: List all academic stages with grades and subjects.
     */
    public function listAcademicStagesAdmin(Request $request)
    {
        $query = AcademicStage::orderBy('order', 'asc')
            ->with(['grades' => function($q) {
                $q->orderBy('order', 'asc');
            }, 'subjects' => function($q) {
                $q->orderBy('order', 'asc');
            }]);

        if ($request->has('sector') && !empty($request->sector)) {
            $query->where('sector', $request->sector);
        }

        $stages = $query->get();

        return response()->json($stages);
    }

    /**
     * Admin: Create academic stage / faculty.
     */
    public function createAcademicStage(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:academic_stages,slug',
            'sector' => 'nullable|string|in:school,university',
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

        $validated['sector'] = $validated['sector'] ?? 'school';
        $validated['order'] = $validated['order'] ?? (AcademicStage::where('sector', $validated['sector'])->max('order') + 1);
        $validated['is_active'] = $validated['is_active'] ?? true;

        $stage = AcademicStage::create($validated);
        $stage->load(['grades', 'subjects']);

        return response()->json([
            'message' => 'تم إنشاء المرحلة / الكلية بنجاح',
            'stage' => $stage,
        ], 201);
    }

    /**
     * Admin: Update academic stage / faculty.
     */
    public function updateAcademicStage(Request $request, $id)
    {
        $stage = AcademicStage::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:academic_stages,slug,' . $id,
            'sector' => 'nullable|string|in:school,university',
            'order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $stage->update($validated);
        $stage->load(['grades', 'subjects']);

        return response()->json([
            'message' => 'تم تحديث المرحلة / الكلية بنجاح',
            'stage' => $stage,
        ]);
    }

    /**
     * Admin: Delete academic stage / faculty.
     */
    public function deleteAcademicStage($id)
    {
        $stage = AcademicStage::with(['grades', 'subjects'])->findOrFail($id);
        $gradeSlugs = $stage->grades->pluck('slug')->toArray();

        // Check if courses are linked to any grade of this stage
        $coursesCount = Course::whereIn('grade', $gradeSlugs)->count();

        // Check if teachers are linked
        $teachersCount = 0;
        foreach ($gradeSlugs as $slug) {
            $teachersCount += User::where('role', 'teacher')->whereJsonContains('grades', $slug)->count();
        }

        if ($coursesCount > 0 || $teachersCount > 0) {
            return response()->json([
                'message' => "لا يمكن حذف هذه المرحلة/الكلية لوجود {$coursesCount} كورس و {$teachersCount} معلم/دكتور مرتبط بها. يرجى نقل أو تعديل البيانات أولاً.",
            ], 422);
        }

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
     * Admin: List all academic grades / university years.
     */
    public function listAcademicGradesAdmin(Request $request)
    {
        $query = AcademicGrade::with(['stage', 'subjects'])->orderBy('order', 'asc');

        if ($request->has('stage_id') && !empty($request->stage_id)) {
            $query->where('stage_id', $request->stage_id);
        }

        if ($request->has('sector') && !empty($request->sector)) {
            $sector = $request->sector;
            $query->whereHas('stage', function($q) use ($sector) {
                $q->where('sector', $sector);
            });
        }

        $grades = $query->get();

        return response()->json($grades);
    }

    /**
     * Admin: Create academic grade / university year.
     */
    public function createAcademicGrade(Request $request)
    {
        $validated = $request->validate([
            'stage_id' => 'required|exists:academic_stages,id',
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:academic_grades,slug',
            'short_code' => 'nullable|string|max:50',
            'level_type' => 'nullable|string|in:grade,university_year',
            'specialization' => 'nullable|string|max:255',
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

        $stage = AcademicStage::find($validated['stage_id']);
        if (empty($validated['level_type'])) {
            $validated['level_type'] = ($stage && $stage->sector === 'university') ? 'university_year' : 'grade';
        }

        $validated['order'] = $validated['order'] ?? (AcademicGrade::where('stage_id', $validated['stage_id'])->max('order') + 1);
        $validated['is_active'] = $validated['is_active'] ?? true;

        $grade = AcademicGrade::create($validated);
        $grade->load(['stage', 'subjects']);

        return response()->json([
            'message' => 'تم إضافة الصف الدراسي / الفرقة بنجاح',
            'grade' => $grade,
        ], 201);
    }

    /**
     * Admin: Update academic grade / university year.
     */
    public function updateAcademicGrade(Request $request, $id)
    {
        $grade = AcademicGrade::findOrFail($id);

        $validated = $request->validate([
            'stage_id' => 'required|exists:academic_stages,id',
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:academic_grades,slug,' . $id,
            'short_code' => 'nullable|string|max:50',
            'level_type' => 'nullable|string|in:grade,university_year',
            'specialization' => 'nullable|string|max:255',
            'order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $grade->update($validated);
        $grade->load(['stage', 'subjects']);

        return response()->json([
            'message' => 'تم تحديث الصف الدراسي / الفرقة بنجاح',
            'grade' => $grade,
        ]);
    }

    /**
     * Admin: Delete academic grade / university year.
     */
    public function deleteAcademicGrade($id)
    {
        $grade = AcademicGrade::findOrFail($id);

        // Check if courses are linked to this grade
        $coursesCount = Course::where('grade', $grade->slug)->count();

        // Check if teachers are linked
        $teachersCount = User::where('role', 'teacher')->whereJsonContains('grades', $grade->slug)->count();

        if ($coursesCount > 0 || $teachersCount > 0) {
            return response()->json([
                'message' => "لا يمكن حذف هذا الصف/الفرقة لوجود {$coursesCount} كورس و {$teachersCount} معلم/دكتور مرتبط به. يرجى تعديل أو نقل البيانات أولاً.",
            ], 422);
        }

        $grade->delete();

        return response()->json([
            'message' => 'تم حذف الصف الدراسي / الفرقة بنجاح',
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
            'message' => 'تم تغيير حالة الصف الدراسي / الفرقة بنجاح',
            'is_active' => $grade->is_active,
            'grade' => $grade,
        ]);
    }

    /* =========================================================================
     * ACADEMIC SUBJECTS CRUD
     * ========================================================================= */

    /**
     * Admin: List all academic subjects.
     */
    public function listAcademicSubjectsAdmin(Request $request)
    {
        $query = AcademicSubject::with(['stage', 'grade'])->orderBy('order', 'asc');

        if ($request->has('sector') && !empty($request->sector)) {
            $query->where('sector', $request->sector);
        }

        if ($request->has('stage_id') && !empty($request->stage_id)) {
            $query->where('stage_id', $request->stage_id);
        }

        if ($request->has('grade_id') && !empty($request->grade_id)) {
            $query->where('grade_id', $request->grade_id);
        }

        $subjects = $query->get()->map(function ($subj) {
            $subj->courses_count = Course::where('subject', $subj->slug)->orWhere('subject', $subj->name)->count();
            return $subj;
        });

        return response()->json($subjects);
    }

    /**
     * Admin: Create academic subject.
     */
    public function createAcademicSubject(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:academic_subjects,slug',
            'sector' => 'nullable|string|in:school,university',
            'stage_id' => 'nullable|exists:academic_stages,id',
            'grade_id' => 'nullable|exists:academic_grades,id',
            'order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']) ?: 'subj_' . time();
            $originalSlug = $validated['slug'];
            $count = 1;
            while (AcademicSubject::where('slug', $validated['slug'])->exists()) {
                $validated['slug'] = $originalSlug . '_' . $count++;
            }
        }

        $validated['sector'] = $validated['sector'] ?? 'school';
        $validated['order'] = $validated['order'] ?? (AcademicSubject::where('sector', $validated['sector'])->max('order') + 1);
        $validated['is_active'] = $validated['is_active'] ?? true;

        $subject = AcademicSubject::create($validated);
        $subject->load(['stage', 'grade']);

        return response()->json([
            'message' => 'تم إنشاء المادة الدراسية بنجاح',
            'subject' => $subject,
        ], 201);
    }

    /**
     * Admin: Update academic subject.
     */
    public function updateAcademicSubject(Request $request, $id)
    {
        $subject = AcademicSubject::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:academic_subjects,slug,' . $id,
            'sector' => 'nullable|string|in:school,university',
            'stage_id' => 'nullable|exists:academic_stages,id',
            'grade_id' => 'nullable|exists:academic_grades,id',
            'order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $subject->update($validated);
        $subject->load(['stage', 'grade']);

        return response()->json([
            'message' => 'تم تحديث المادة الدراسية بنجاح',
            'subject' => $subject,
        ]);
    }

    /**
     * Admin: Delete academic subject.
     */
    public function deleteAcademicSubject($id)
    {
        $subject = AcademicSubject::findOrFail($id);

        // Check if courses are linked to this subject
        $coursesCount = Course::where('subject', $subject->slug)->orWhere('subject', $subject->name)->count();

        // Check if teachers teach this subject
        $teachersCount = User::where('role', 'teacher')
            ->where(function ($q) use ($subject) {
                $q->where('subject', 'like', "%{$subject->slug}%")
                  ->orWhere('subject', 'like', "%{$subject->name}%");
            })->count();

        if ($coursesCount > 0 || $teachersCount > 0) {
            return response()->json([
                'message' => "لا يمكن حذف هذه المادة لوجود {$coursesCount} كورس و {$teachersCount} معلم/دكتور مرتبط بها. يرجى نقل أو تعديل الكورسات والمعلمين أولاً.",
            ], 422);
        }

        $subject->delete();

        return response()->json([
            'message' => 'تم حذف المادة الدراسية بنجاح',
        ]);
    }

    /**
     * Admin: Toggle academic subject active status.
     */
    public function toggleAcademicSubjectStatus($id)
    {
        $subject = AcademicSubject::findOrFail($id);
        $subject->is_active = !$subject->is_active;
        $subject->save();

        return response()->json([
            'message' => 'تم تغيير حالة المادة الدراسية بنجاح',
            'is_active' => $subject->is_active,
            'subject' => $subject,
        ]);
    }
}
