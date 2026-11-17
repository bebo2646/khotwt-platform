<?php

namespace App\Services;

use App\Models\TelegramUser;
use App\Models\GuardianStudentRelation;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class TelegramGuardianService
{
    /**
     * Link a guardian Telegram user to students whose parent_phone matches the verified contact.
     */
    public function linkGuardianByParentPhone(TelegramUser $guardianUser, string $phone): array
    {
        $variants = TelegramPhoneService::getSearchVariants($phone);

        // Find students registered with this parent_phone
        $students = User::where('role', 'student')
            ->where(function ($q) use ($variants) {
                $q->whereIn('parent_phone', $variants);
            })
            ->get();

        if ($students->isEmpty()) {
            return [
                'success' => false,
                'count' => 0,
                'students' => collect(),
                'message' => 'لم يتم العثور على أي حساب طالب مسجل به رقم هاتف ولي الأمر هذا كـ parent_phone على المنصة.',
            ];
        }

        return DB::transaction(function () use ($guardianUser, $students, $phone) {
            $linkedStudents = collect();

            foreach ($students as $student) {
                $relation = GuardianStudentRelation::updateOrCreate(
                    [
                        'guardian_telegram_account_id' => $guardianUser->id,
                        'student_user_id' => $student->id,
                    ],
                    [
                        'verified_phone' => $phone,
                        'status' => 'active',
                        'linked_at' => Carbon::now(),
                    ]
                );
                $linkedStudents->push($student);
            }

            // Update guardian role if not already student or teacher
            if ($guardianUser->role === 'guest' || $guardianUser->role === 'guardian') {
                $guardianUser->update([
                    'role' => 'guardian',
                    'phone' => $phone,
                ]);
            }

            return [
                'success' => true,
                'count' => $linkedStudents->count(),
                'students' => $linkedStudents,
                'message' => 'تم ربط حساب ولي الأمر بالطلاب بنجاح.',
            ];
        });
    }

    /**
     * Get all active students linked to this guardian.
     */
    public function getLinkedStudents(TelegramUser $guardianUser): Collection
    {
        $studentIds = GuardianStudentRelation::where('guardian_telegram_account_id', $guardianUser->id)
            ->where('status', 'active')
            ->pluck('student_user_id');

        return User::whereIn('id', $studentIds)->get();
    }

    /**
     * Check if a guardian is actively authorized to view data for a specific student.
     */
    public function canAccessStudent(TelegramUser $guardianUser, int $studentId): bool
    {
        return GuardianStudentRelation::where('guardian_telegram_account_id', $guardianUser->id)
            ->where('student_user_id', $studentId)
            ->where('status', 'active')
            ->exists();
    }

    /**
     * Unlink a guardian from a specific student independently.
     */
    public function unlinkStudent(TelegramUser $guardianUser, int $studentId): bool
    {
        $relation = GuardianStudentRelation::where('guardian_telegram_account_id', $guardianUser->id)
            ->where('student_user_id', $studentId)
            ->first();

        if (!$relation) {
            return false;
        }

        $relation->update(['status' => 'revoked']);

        // Check if any active student relations remain
        $hasRemainingActive = GuardianStudentRelation::where('guardian_telegram_account_id', $guardianUser->id)
            ->where('status', 'active')
            ->exists();

        if (!$hasRemainingActive && $guardianUser->role === 'guardian') {
            $guardianUser->update(['role' => 'guest']);
        }

        return true;
    }
}
