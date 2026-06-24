<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\NotificationRead;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class NotificationService
{
    /**
     * Send a notification to specific recipients.
     */
    public function sendNotification($title, $message, $recipientType, $recipientId = null, $senderId = null, $important = false, $sendToAdmin = false)
    {
        $senderId = $senderId ?? (auth()->check() ? auth()->id() : null);

        // Save to database
        $notification = Notification::create([
            'title' => $title,
            'message' => $message,
            'recipient_type' => $recipientType, // all, students, teachers, specific_teacher, specific_student
            'recipient_id' => $recipientId,
            'sender_id' => $senderId,
            'important' => $important,
            'send_to_admin' => $sendToAdmin,
        ]);

        return $notification;
    }

    /**
     * Get notifications visible to a specific user.
     */
    public function getNotificationsForUser(User $user)
    {
        $query = Notification::query();

        // Exclude own notifications unless send_to_admin is true
        $query->where(function ($q) use ($user) {
            $q->whereNull('sender_id')
              ->orWhere('sender_id', '!=', $user->id)
              ->orWhere('send_to_admin', true);
        });

        $query->where(function ($q) use ($user) {
            // Global notifications
            $q->where('recipient_type', 'all');

            // Role-specific notifications
            if ($user->isStudent()) {
                $q->orWhere('recipient_type', 'students')
                  ->orWhere(function ($sub) use ($user) {
                      $sub->where('recipient_type', 'specific_student')
                          ->where('recipient_id', $user->id);
                  });
            } elseif ($user->isTeacher()) {
                $q->orWhere('recipient_type', 'teachers')
                  ->orWhere(function ($sub) use ($user) {
                      $sub->where('recipient_type', 'specific_teacher')
                          ->where('recipient_id', $user->id);
                  });
            } elseif ($user->isAdmin()) {
                // Admins see all notifications
                $q->orWhere('recipient_type', 'teachers')
                  ->orWhere('recipient_type', 'students');
            }
        });

        // Add read status
        return $query->leftJoin('notification_reads', function ($join) use ($user) {
                $join->on('notifications.id', '=', 'notification_reads.notification_id')
                     ->where('notification_reads.user_id', '=', $user->id);
            })
            ->select(
                'notifications.*', 
                DB::raw('notification_reads.read_at is not null as is_read'),
                DB::raw('coalesce(notification_reads.is_seen, false) as is_seen'),
                'notification_reads.seen_at'
            )
            ->orderBy('notifications.created_at', 'desc')
            ->get();
    }

    /**
     * Get the unread notification count for a user.
     */
    public function getUnreadCountForUser(User $user)
    {
        $query = Notification::query();

        // Exclude own notifications unless send_to_admin is true
        $query->where(function ($q) use ($user) {
            $q->whereNull('sender_id')
              ->orWhere('sender_id', '!=', $user->id)
              ->orWhere('send_to_admin', true);
        });

        $query->where(function ($q) use ($user) {
            $q->where('recipient_type', 'all');

            if ($user->isStudent()) {
                $q->orWhere('recipient_type', 'students')
                  ->orWhere(function ($sub) use ($user) {
                      $sub->where('recipient_type', 'specific_student')
                          ->where('recipient_id', $user->id);
                  });
            } elseif ($user->isTeacher()) {
                $q->orWhere('recipient_type', 'teachers')
                  ->orWhere(function ($sub) use ($user) {
                      $sub->where('recipient_type', 'specific_teacher')
                          ->where('recipient_id', $user->id);
                  });
            }
        });

        // Exclude read notifications
        $query->whereNotExists(function ($subQuery) use ($user) {
            $subQuery->select(DB::raw(1))
                ->from('notification_reads')
                ->whereColumn('notification_reads.notification_id', 'notifications.id')
                ->where('notification_reads.user_id', $user->id);
        });

        return $query->count();
    }

    /**
     * Mark a specific notification as read for a user.
     */
    public function markAsRead(User $user, $notificationId)
    {
        $exists = NotificationRead::where('notification_id', $notificationId)
            ->where('user_id', $user->id)
            ->exists();

        if (!$exists) {
            NotificationRead::create([
                'notification_id' => $notificationId,
                'user_id' => $user->id,
                'read_at' => Carbon::now(),
            ]);
        }

        return true;
    }

    /**
     * Mark all visible notifications as read for a user.
     */
    public function markAllAsRead(User $user)
    {
        $notifications = $this->getNotificationsForUser($user);

        foreach ($notifications as $notification) {
            if (!$notification->is_read) {
                NotificationRead::create([
                    'notification_id' => $notification->id,
                    'user_id' => $user->id,
                    'read_at' => Carbon::now(),
                ]);
            }
        }

        return true;
    }

    /**
     * Mark a specific notification as seen (dismissed) for a user.
     */
    public function markAsSeen(User $user, $notificationId)
    {
        $read = NotificationRead::where('notification_id', $notificationId)
            ->where('user_id', $user->id)
            ->first();

        if ($read) {
            $read->update([
                'is_seen' => true,
                'seen_at' => Carbon::now(),
            ]);
        } else {
            NotificationRead::create([
                'notification_id' => $notificationId,
                'user_id' => $user->id,
                'is_seen' => true,
                'seen_at' => Carbon::now(),
            ]);
        }

        return true;
    }
}
