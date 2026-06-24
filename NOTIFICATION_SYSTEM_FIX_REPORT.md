# NOTIFICATION_SYSTEM_FIX_REPORT

This report documents the architectural improvements and bug fixes implemented to ensure correct notification behavior, popup modals, admin exclusion rules, and persistence.

---

## 1. Files Changed

### Backend (Laravel)
- **Model**: `App\Models\Notification` - Configured `$fillable` and `$casts` for `important` and `send_to_admin` flags.
- **Model**: `App\Models\NotificationRead` - Added `is_seen` and `seen_at` fields to store user-specific modal dismissals.
- **Service**: `App\Services\NotificationService` - Refactored:
  - `sendNotification`: Appended `important` and `send_to_admin` to notification payload.
  - `getNotificationsForUser`: Configured filtering to exclude the creator (`sender_id`) of the notification unless `send_to_admin` is explicitly `true` (resolves admin receiving self-notifications). Query left-joins `notification_reads` to dynamically resolve `is_read` and `is_seen` flags.
  - `getUnreadCountForUser`: Mirrored exclude-sender and permissions logic to calculate precise bell badge badge counts.
  - `markAsSeen`: Newly added method to write seen state (`is_seen = true` and timestamp) to `notification_reads`.
- **Controller**: `App\Http\Controllers\SubscriptionController` - Added API routes handlers for:
  - `sendNotification` (updated to accept priority checkboxes: `important`, `send_to_admin`).
  - `markNotificationAsSeen` (links to `/api/notifications/{id}/seen`).
- **Routes**: `routes/api.php` - Exposed the POST endpoint `/api/notifications/{id}/seen`.

### Frontend (React/TypeScript)
- **Component**: `src/components/Navbar.tsx` - Updated fetching and display logic:
  - Checks for first unseen important notification using `!n.is_seen` instead of `!n.is_read`.
  - Diminishes polling frequency conflicts and prevents modal looping by using a React `useRef` to locally track dismissed IDs inside the current session.
  - Links dismissal clicks (either "Close" or "Mark as read") to trigger the POST `/notifications/{id}/seen` API, preventing the popup from reopening.
- **Page**: `src/pages/admin/Notifications.tsx` - Added:
  - UI inputs for "Important Notification" (`important`) and "Send to Admin" (`send_to_admin`).
  - API call updates to send these flags correctly during notification dispatch.

---

## 2. Database Changes

We created the `notification_reads` table to store individual read and seen states:
- `id` (Primary Key)
- `notification_id` (Foreign Key -> notifications)
- `user_id` (Foreign Key -> users)
- `read_at` (Timestamp, nullable)
- `is_seen` (Boolean, default false)
- `seen_at` (Timestamp, nullable)
- `created_at` & `updated_at`

Additionally, the `notifications` table has the following flags:
- `important` (Boolean, default false)
- `send_to_admin` (Boolean, default false)

---

## 3. APIs Changed

| Endpoint | Method | Payload | Description |
|---|---|---|---|
| `/api/admin/notifications/send` | POST | `title`, `message`, `recipient_type`, `recipient_id`, `important`, `send_to_admin` | Broadcasts normal or popup alert notifications. |
| `/api/notifications/{id}/seen` | POST | None | Persists seen status (`is_seen = true`) for target user, permanently dismissing popups. |
| `/api/notifications` | GET | None | Retrieves user-scoped notifications annotated with dynamic `is_seen` and `is_read` fields. |

---

## 4. Verification Checklists & Test Cases

### Test Case 1: Send Normal Notification
- **Action**: Admin sends notification with `important: false`.
- **Expected Outcome**:
  - Target users receive the notification inside the notifications dropdown center.
  - Navbar bell badge increments.
  - No popup/modal alert is shown on screen.
  - The admin who sent the notification does not receive it in their inbox (unless `send_to_admin: true` was set).

### Test Case 2: Send Important Notification (Modal Popup)
- **Action**: Admin sends notification with `important: true`.
- **Expected Outcome**:
  - Target users receive a modal alert popup immediately with Title, Message, "Close" button, and "Mark as read" button.
  - Clicking "Close" or "Mark as read" calls the `seen` API.
  - The popup closes and **never reappears** on refreshes or subsequent polling intervals.

### Test Case 3: Offline Persistence
  - User receives the popup immediately upon login.
  - Closing the popup marks it seen in the DB. It does not display again.

---

## 5. Sender Admin Targeting Exclusion Fix (June 2026)

### Issue
Previously, the universal `/api/notifications` endpoint returned **all** notifications (including notifications sent by the admin themselves) when queried by an administrator. This caused the admin who dispatched an important notification to receive it immediately in their own navbar and trigger the popup modal alert.

### Resolution
1. **Controller Filtering**: In `SubscriptionController.php`, the universal `getUserNotifications` endpoint was refactored to support a query parameter:
   - When fetching past logs for display in the admin management dashboard, the frontend requests `GET /api/notifications?admin_view=true`. This retains the history list of all sent notifications.
   - For all other requests (such as the automatic navbar inbox count and important notification polling), it utilizes the standard `NotificationService::getNotificationsForUser` which filters notifications.
2. **Notification Service Exclusion Rule**: The query automatically checks `sender_id != $user->id` unless `send_to_admin` is explicitly set to `true`. This prevents self-notifications and modal popup loops on the sender's screen.
3. **Frontend Implementation**: The `loadNotifications` function in `frontend/src/pages/admin/Notifications.tsx` was updated to append `?admin_view=true` to correctly preserve the administrative sent history view.

