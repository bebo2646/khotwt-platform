# Subscription Plans Deactivation & Caching Debug Report

This report documents the root cause, fixes, and auditing performed to address the inconsistency where deactivated plans (`active = false`) still appeared on the Teacher Plans pages.

## 1. Root Cause Analysis

*   **API Query Leakage:**
    The endpoint `/api/teacher/subscription` (which is shared by the teacher Plans and Subscription pages) returned plans using `SubscriptionPlan::orderBy('sort_order', 'asc')->get()`. Since there was no check on the `active` column status, all deactivated plans were returned.
*   **Missing Endpoints:**
    There was no dedicated `GET /subscription-plans` route for public or teacher plans retrieval, meaning any cache invalidation or independent plans fetching was impossible without fetching the entire subscription payload.
*   **Mass Assignment Block on Tests:**
    In our backward compatibility implementation, the legacy attributes (`student_codes`, etc.) were missing from the Eloquent model `$fillable` array. This caused updates in verification scripts (such as `$plan->update(['student_codes' => 1])`) to be silently discarded. This bypassed the capacity enforcement validations and caused tests to fail with wallet credit errors.
*   **Missing Stale Cache Checks:**
    The frontend did not have checks to verify if plans fetched from state or local contexts included inactive entries.

## 2. Implemented Fix & Auditing Actions

### A. Backend API Fixes

1.  **Teacher Subscription Endpoint Check:**
    Updated `getTeacherSubscriptionSelf` in [SubscriptionController.php](file:///D:/manst%20ellem/backend/app/Http/Controllers/SubscriptionController.php) to query only active plans:
    ```php
    'plans' => SubscriptionPlan::where('active', true)->orderBy('sort_order', 'asc')->get()
    ```
2.  **Dedicated Public plans endpoint:**
    Created and registered `GET /subscription-plans` (implemented in `listPlansPublic`) returning only active plans:
    ```php
    public function listPlansPublic(Request $request)
    {
        return response()->json([
            'plans' => SubscriptionPlan::where('active', true)
                ->orderBy('sort_order', 'asc')
                ->get(),
            'settings' => $this->getSettings()
        ]);
    }
    ```
3.  **Upgrade Request Protection Check:**
    Added protection in `requestUpgradeSelf` rejecting requests for deactivated plans:
    ```php
    if (!$plan->active) {
        return response()->json(['message' => 'عذراً، خطة الاشتراك المطلوبة غير مفعلة حالياً ولا يمكن الترقية إليها.'], 400);
    }
    ```
4.  **Request Approval Protection Check:**
    Added protection in `handleSubscriptionRequest` to reject approvals of requests for plans that have since been deactivated:
    ```php
    if (!$plan->active) {
        return response()->json(['message' => 'عذراً، خطة الاشتراك المطلوبة غير مفعلة حالياً ولا يمكن تفعيلها للترقية.'], 400);
    }
    ```

### B. Frontend Caching & Validation Fixes

1.  **Stale Cache Verification & Auto-Refetch:**
    Added a `useEffect` hook in both [Plans.tsx](file:///D:/manst%20ellem/frontend/src/pages/teacher/Plans.tsx) and [Subscription.tsx](file:///D:/manst%20ellem/frontend/src/pages/teacher/Subscription.tsx) to verify the plans. If an inactive plan is detected in the state or cache, it filters them out and triggers an automatic refetch from the API to heal the cache.
2.  **Display Filtering:**
    Filtered pricing cards using `.filter(p => p.active)` on both teacher pages to prevent inactive plans from rendering.
3.  **Visible to Teachers Badge in Admin panel:**
    Added an emerald/rose badge on [SubscriptionPlans.tsx](file:///D:/manst%20ellem/frontend/src/pages/admin/SubscriptionPlans.tsx) indicating "مرئية للمعلمين" (Visible to teachers) or "غير نشطة / مخفية" (Inactive / Hidden) based on the plan's activation state.

### C. Database Seeder & Duplication Audit

1.  Ran database queries verifying that no duplicates exist in the `subscription_plans` table.
2.  Verified that seeder scripts check for existing plans before executing, preventing duplicates.

## 3. Verified Files list

*   **Backend Routing:** [routes/api.php](file:///D:/manst%20ellem/backend/routes/api.php) (Added public endpoints)
*   **Controller:** [SubscriptionController.php](file:///D:/manst%20ellem/backend/app/Http/Controllers/SubscriptionController.php) (Filtered queries and added request checks)
*   **Model:** [SubscriptionPlan.php](file:///D:/manst%20ellem/backend/app/Models/SubscriptionPlan.php) (Added backward compatible `$fillable` columns)
*   **Teacher Views:** [Plans.tsx](file:///D:/manst%20ellem/frontend/src/pages/teacher/Plans.tsx) and [Subscription.tsx](file:///D:/manst%20ellem/frontend/src/pages/teacher/Subscription.tsx) (Auto-invalidation & display filtering)
*   **Admin Dashboard:** [SubscriptionPlans.tsx](file:///D:/manst%20ellem/frontend/src/pages/admin/SubscriptionPlans.tsx) (Added visibility badges)
