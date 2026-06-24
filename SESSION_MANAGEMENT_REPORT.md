# SESSION_MANAGEMENT_REPORT

This report documents the design, implementation, database schema, and test cases for the Single Device Login and Active Sessions Management systems.

---

## 1. Files Changed

### Backend (Laravel)
- **Middleware**: `App\Http\Middleware\VerifySessionToken` - Handles checking the incoming `X-Session-Token` header for authenticated requests. If there is a mismatch with the user's saved token, it invalidates the current Sanctum token and returns an HTTP `409 Conflict` response:
  ```json
  {
    "message": "تم تسجيل الدخول من جهاز آخر.",
    "session_invalid": true
  }
  ```
- **Controller**: `App\Http\Controllers\AuthController` - Updated:
  - `login` and `register`: Automatically purges previous Sanctum tokens for the user, generates a new random `session_token`, captures connection metadata (`device_id` as User Agent + IP, and `last_activity`), updates the `users` table, and returns the token in the response payload.
- **Controller**: `App\Http\Controllers\AdminController` - Added session control endpoints:
  - `listActiveSessions`: Lists users with connect sessions, sorted by last activity.
  - `forceLogoutSession`: Logs out a specific user session and clears token fields.
  - `forceLogoutAllSessions`: Force logs out all connect sessions except the invoking admin.
- **Routes**: `routes/api.php` - Hooked middleware `verify_session` into all authenticated requests and registered the active sessions management endpoints in the admin scope.

### Frontend (React/TypeScript)
- **Axios Interceptor**: `src/services/api.ts` - Automatically appends `X-Session-Token` from local storage to outgoing headers. Intercepts HTTP `409 Conflict` responses, purges auth keys from local storage, and dispatches the global event `elm_session_invalid`.
- **Zustand Store**: `src/store/authStore.ts` - Saves the `elm_session_token` parameter to localStorage upon login and deletes it on logout.
- **Global Listener**: `src/App.tsx` - Listens to `elm_session_invalid` event, invokes `logout()` to reset application states, and redirects the user to `/login?session_invalid=true`.
- **Page**: `src/pages/Login.tsx` - Checks the URL parameters on load. If `session_invalid=true`, it displays the required warning message: `"تم تسجيل الدخول من جهاز آخر."`.
- **Page**: `src/pages/admin/AdminManagement.tsx` - Integrated the **Active Sessions** tab dashboard to view connecting devices, update sessions, and force logout individual sessions or disconnect all sessions globally.

---

## 2. Database Changes

The `users` table was enriched with the following columns:
- `session_token` (String, nullable) - Stores the active single session identifier.
- `device_id` (String, nullable) - Stores the User Agent string and IP address.
- `last_activity` (Timestamp, nullable) - Stores the time of the last request.

---

## 3. APIs Changed

| Endpoint | Method | Payload / Headers | Description |
|---|---|---|---|
| `/api/login` | POST | `email`, `password` | Returns `session_token` alongside Sanctum auth token. |
| `/api/register` | POST | `name`, `email`, etc. | Registers and sets initial `session_token`. |
| `/api/admin/active-sessions` | GET | `Authorization` | Lists all connected device sessions. |
| `/api/admin/active-sessions/{id}/logout` | POST | `Authorization` | Terminates and logs out the target user's session. |
| `/api/admin/active-sessions/logout-all` | POST | `Authorization` | Disconnects all active user sessions (except self). |

---

## 4. Verification Checklists & Test Cases

### Test Case 1: Single Device Login Enforcement
- **Action**:
  1. User logs in on Device A. Device A is active and accessing protected API resources (e.g. dashboard).
  2. The same user logs in on Device B.
- **Expected Outcome**:
  - Device B logs in successfully.
  - Immediately, Device A's next API request returns a 409 error.
  - Device A is redirected to the login page.
  - Device A displays the alert box: `"تم تسجيل الدخول من جهاز آخر."`.

### Test Case 2: Admin Force Logout Control
- **Action**:
  1. Admin opens the Permissions and Admins panel (`/admin/manage`).
  2. Clicks on the **Active Sessions** tab.
  3. Clicks "إنهاء الجلسة" (Force Logout) on a connected student or teacher user.
- **Expected Outcome**:
  - The targeted user is disconnected.
  - The next request made by the user fails.
  - The user is redirected to `/login?session_invalid=true` displaying `"تم تسجيل الدخول من جهاز آخر."`.
