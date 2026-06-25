# Subscription Plans Management System Report

This document details the implementation of the fully dynamic Subscription Plans Management system for the Khatwat (خطواتك) platform.

## 1. Database Changes

We modified the database schema to support fully dynamic, editable subscription plans and log all history/audit events.

*   **`subscription_plans` table updates:**
    *   Added `slug` (`string`, unique, nullable) to allow customizable plan routes/references.
    *   Added `description` (`text`, nullable) for displaying features and details.
    *   Added `price` (`decimal`, 10,2) to replace hardcoded Egyptian Pounds.
    *   Added `currency` (`string`, default 'EGP') to allow multi-currency plans.
    *   Added `duration_in_days` (`integer`, default 30) for flexible renewal periods.
    *   Added `max_courses` (`integer`, nullable) to restrict course creations if needed.
    *   Added `max_storage_gb` (`integer`) to replace the hardcoded `video_storage_gb` column.
    *   Added `included_codes` (`integer`) to replace the hardcoded `student_codes` column.
    *   Added `featured` (`boolean`) to replace `is_popular` for emphasizing selected packages.
    *   Added `active` (`boolean`, default true) to activate/deactivate packages.
    *   Added `sort_order` (`integer`, default 0) to allow reordering packages.
    *   Added `badge_text` (`string`, nullable) for badges (e.g., "أفضل توفير").
    *   Added `color_theme` (`string`, nullable) for choosing card highlights (e.g., `indigo`, `rose`, `emerald`).
*   **`subscription_plan_price_history` table (New):**
    *   `id` (Primary Key)
    *   `plan_id` (Foreign Key referencing `subscription_plans`)
    *   `old_price` (`decimal`, 10,2)
    *   `new_price` (`decimal`, 10,2)
    *   `changed_by` (Foreign Key referencing `users` admin ID)
    *   `created_at` (`timestamp`)
*   **`subscription_plan_audit_logs` table (New):**
    *   `id` (Primary Key)
    *   `plan_id` (Foreign Key referencing `subscription_plans`)
    *   `user_id` (Foreign Key referencing `users` who made the change)
    *   `action` (`string`, e.g. `create`, `update`, `delete`, `toggle_active`, `reorder`)
    *   `old_values` (`json`, nullable)
    *   `new_values` (`json`, nullable)
    *   `created_at` (`timestamp`)

## 2. API Changes

We updated the routing and controller logic to handle administrative tasks and secure them under Super Admin and Custom Admin role permissions.

*   **Route Definitions ([routes/api.php](file:///D:/manst%20ellem/backend/routes/api.php)):**
    *   `GET /api/admin/subscription-plans` - List plans sorted by `sort_order` (viewable by custom admins).
    *   `POST /api/admin/subscription-plans` - Create a new plan (requires permission).
    *   `PUT /api/admin/subscription-plans/{id}` - Edit a plan (requires permission).
    *   `DELETE /api/admin/subscription-plans/{id}` - Delete a plan (restricted if active subscribers are present).
    *   `POST /api/admin/subscription-plans/{id}/toggle` - Activate/Deactivate plan.
    *   `POST /api/admin/subscription-plans/reorder` - Set plan sort order.
    *   `GET /api/admin/subscription-plans/{id}/price-history` - Get price history log.
    *   `GET /api/admin/subscription-plans/{id}/audit-logs` - Get audit log entries.
*   **Controller Implementation ([SubscriptionController.php](file:///D:/manst%20ellem/backend/app/Http/Controllers/SubscriptionController.php)):**
    *   Implemented detailed validation rules for plan fields.
    *   Added authorization checks validating the user is either a Super Admin or has the `subscription_plans.edit` permission.
    *   Implemented safety check on deletion: prevents deleting a plan if there are teachers with active subscriptions on it.
    *   Implemented price history logging that compares existing price with new price and saves changes automatically.
    *   Implemented audit log recorder compiling old vs new column states.
*   **Dynamic Permissions System ([permissions.php](file:///D:/manst%20ellem/backend/config/permissions.php) & [AdminController.php](file:///D:/manst%20ellem/backend/app/Http/Controllers/AdminController.php)):**
    *   Added `'subscription_plans.edit'` to the permission config list.
    *   Updated `listAllPermissions` to auto-sync defined config keys with the database dynamically.

## 3. Model Compatibility & Accessors

To prevent breaking existing backend code, APIs, and verification scripts, we implemented custom accessors and mutators in the [SubscriptionPlan.php](file:///D:/manst%20ellem/backend/app/Models/SubscriptionPlan.php) model:

*   `price_egp` maps to `price`
*   `video_storage_gb` maps to `max_storage_gb`
*   `student_codes` maps to `included_codes`
*   `duration_days` maps to `duration_in_days`
*   `is_popular` maps to `featured`
*   The mutators automatically set values on **both** the new and old attributes, ensuring database fields stay in sync.

## 4. Frontend Changes

We built a beautiful, fully functional admin interface matching platform aesthetics:

*   **Plans Page Component ([SubscriptionPlans.tsx](file:///D:/manst%20ellem/frontend/src/pages/admin/SubscriptionPlans.tsx)):**
    *   Displays cards for all plans including storage, codes, price, and courses.
    *   Supports reordering using micro-animated up/down reorder buttons.
    *   Supports inline toggle switch to activate/deactivate plans instantly.
    *   **Price Change Confirmation Modal:** Triggers a dialog informing the admin that price changes only apply to new/renewed subscriptions, asking them to explicitly confirm before saving.
    *   **Price History side drawer:** Visualizes all historical pricing transitions.
    *   **Audit logs side drawer:** Details what fields were modified, showing their old and new values clearly.
*   **Navigation & Routing:**
    *   Lazy-loaded the route in [App.tsx](file:///D:/manst%20ellem/frontend/src/App.tsx).
    *   Registered "إدارة الباقات" in [Navbar.tsx](file:///D:/manst%20ellem/frontend/src/components/Navbar.tsx) under the admin sections.

## 5. Pricing Updates & Safety Protections

1.  **Existing subscriptions:**
    When a teacher subscribes to a plan or upgrades, the platform calculates pricing using the package details at that exact moment. The final price and billing terms are written to the `teacher_subscriptions`, `subscription_requests`, and `subscription_payments` records. 
    Consequently, modifying a plan price in `subscription_plans` will **NOT** affect already purchased subscriptions.
2.  **Delete Protection:**
    A plan cannot be deleted if any teacher has an active or expiring subscription using it. The admin is instead prompted to deactivate (disable) the plan, which hides it from new buyers while preserving existing teacher subscriptions.

## 6. Migration Steps

To deploy the new changes, run:
```bash
php artisan migrate
```
The migration will automatically create the new tables, add columns to `subscription_plans`, copy data from old columns to the new ones, and generate slugs for all seeded plans.
