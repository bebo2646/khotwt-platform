<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Notification;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class NotificationDeletionTest extends TestCase
{
    use DatabaseTransactions;

    public function test_delete_notification_requires_authentication(): void
    {
        $response = $this->deleteJson('/api/admin/notifications/1');
        $response->assertStatus(401);
    }

    public function test_delete_notification_requires_admin(): void
    {
        $student = User::factory()->create([
            'role' => 'student',
            'status' => 'active'
        ]);

        $response = $this->actingAs($student)
                         ->deleteJson('/api/admin/notifications/1');

        $response->assertStatus(403);
    }

    public function test_admin_can_delete_single_notification(): void
    {
        $admin = User::create([
            'name' => 'Admin Test',
            'email' => 'admin_test_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        $notification = Notification::create([
            'title' => 'Test Title',
            'message' => 'Test Message',
            'recipient_type' => 'all'
        ]);

        $response = $this->actingAs($admin)
                         ->deleteJson("/api/admin/notifications/{$notification->id}");

        $response->assertStatus(200)
                 ->assertJson(['message' => 'تم حذف الإشعار بنجاح']);

        $this->assertNull(Notification::find($notification->id));
    }

    public function test_admin_can_bulk_delete_notifications(): void
    {
        $admin = User::create([
            'name' => 'Admin Test',
            'email' => 'admin_test_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        $notif1 = Notification::create([
            'title' => 'Test 1',
            'message' => 'Msg 1',
            'recipient_type' => 'all'
        ]);

        $notif2 = Notification::create([
            'title' => 'Test 2',
            'message' => 'Msg 2',
            'recipient_type' => 'all'
        ]);

        $response = $this->actingAs($admin)
                         ->deleteJson('/api/admin/notifications', [
                             'ids' => [$notif1->id, $notif2->id]
                         ]);

        $response->assertStatus(200)
                 ->assertJson(['message' => 'تم حذف الإشعارات المحددة بنجاح']);

        $this->assertNull(Notification::find($notif1->id));
        $this->assertNull(Notification::find($notif2->id));
    }

    public function test_admin_can_delete_all_notifications(): void
    {
        $admin = User::create([
            'name' => 'Admin Test',
            'email' => 'admin_test_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        Notification::create([
            'title' => 'Test 1',
            'message' => 'Msg 1',
            'recipient_type' => 'all'
        ]);

        $response = $this->actingAs($admin)
                         ->deleteJson('/api/admin/notifications');

        $response->assertStatus(200)
                 ->assertJson(['message' => 'تم حذف جميع الإشعارات بنجاح']);

        $this->assertEquals(0, Notification::count());
    }
}
