<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\SubscriptionPlan;
use App\Models\TeacherSubscription;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class TeacherStarterSubscriptionConsistencyTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private SubscriptionPlan $starterPlan;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin Sub Test',
            'email' => 'admin_sub_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_super_admin' => true,
            'status' => 'active',
        ]);

        $this->starterPlan = SubscriptionPlan::firstOrCreate([
            'name' => 'Starter',
        ], [
            'slug' => 'starter',
            'duration_in_days' => 30,
            'duration_days' => 30,
            'price' => 0,
            'max_storage_gb' => 10,
            'active' => true,
        ]);
    }

    private function createTeacher(): User
    {
        return User::create([
            'name' => 'Teacher Sub Test ' . uniqid(),
            'email' => 'teacher_sub_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'arabic',
            'grades' => ['first_secondary'],
        ]);
    }

    public function test_get_teacher_subscription_admin_creates_30_day_starter(): void
    {
        $teacher = $this->createTeacher();

        $res = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/teachers/{$teacher->id}/subscription");

        $res->assertStatus(200);

        $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->first();
        $this->assertNotNull($subscription);
        $this->assertEquals(Carbon::now()->toDateString(), $subscription->start_date->toDateString());
        $this->assertEquals(Carbon::now()->addDays(30)->toDateString(), $subscription->end_date->toDateString());
        $this->assertEquals('monthly', $subscription->billing_period);
    }

    public function test_get_teacher_subscription_self_creates_30_day_starter(): void
    {
        $teacher = $this->createTeacher();

        $res = $this->actingAs($teacher, 'sanctum')
            ->getJson('/api/teacher/subscription');

        $res->assertStatus(200);

        $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->first();
        $this->assertNotNull($subscription);
        $this->assertEquals(Carbon::now()->toDateString(), $subscription->start_date->toDateString());
        $this->assertEquals(Carbon::now()->addDays(30)->toDateString(), $subscription->end_date->toDateString());
        $this->assertEquals('monthly', $subscription->billing_period);
    }

    public function test_subscription_active_middleware_creates_30_day_starter(): void
    {
        $teacher = $this->createTeacher();

        // Access route protected by subscription.active middleware
        $res = $this->actingAs($teacher, 'sanctum')
            ->postJson('/api/teacher/courses', [
                'title' => 'Test Course Under Starter',
                'grade' => 'first_secondary',
                'subject' => 'arabic',
                'price' => 50,
            ]);

        // Request may pass or fail validation, but middleware executes first
        $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->first();
        $this->assertNotNull($subscription);
        $this->assertEquals(Carbon::now()->toDateString(), $subscription->start_date->toDateString());
        $this->assertEquals(Carbon::now()->addDays(30)->toDateString(), $subscription->end_date->toDateString());
    }
}
