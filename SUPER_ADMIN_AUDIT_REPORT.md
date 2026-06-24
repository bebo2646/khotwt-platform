# Super Admin System Audit & Security Report

**Prepared for:** Platform Owner
**Date:** June 19, 2026
**OS Platform:** Windows / PostgreSQL
**System Scope:** Elm Educational Platform (منصة عِلْم)

---

## 1. Executive Summary
This audit report has been compiled in response to a request to implement a proper **Super Admin Architecture** and investigate the creation of duplicate admin accounts in the database.

A full audit of the database was performed. The core findings indicate that:
1. `belal@admin.com` is verified as the primary and intended Super Admin, now properly flagged with the newly introduced `is_super_admin = true` attribute.
2. Numerous duplicate admin accounts (`super_admin_***@test.com`, `sec_admin_***@test.com`) exist in the database.
3. The root cause of these duplicate accounts has been identified as a **testing suite configuration issue** where feature tests run queries on the live/development database without database transactions/rollbacks enabled.

---

## 2. Complete Admin Accounts List
Below is the complete list of administrator accounts found in the database.

### A. Active Super Admin (Primary)
* **Account Name:** بلال الأدمن
* **Email:** `belal@admin.com`
* **Account ID:** 1
* **Super Admin Flag (`is_super_admin`):** `true`
* **Legacy Super Flag (`is_super`):** `true`
* **Assigned Modules & Permissions:** Full access bypass enabled. Explicitly has all 10 system permissions:
  - `users.view` (View Users)
  - `users.create` (Create Users)
  - `users.edit` (Edit Users)
  - `users.delete` (Delete Users)
  - `teachers.manage` (Manage Teachers)
  - `students.manage` (Manage Students)
  - `courses.manage` (Manage Courses)
  - `coupons.manage` (Manage Recharge Codes)
  - `reports.view` (View Reports)
  - `admins.manage` (Manage Admins & Permissions)
* **Status:** Active
* **Created At:** 2026-06-19 11:38:11

### B. List of Test / Duplicate Accounts (Pending Approval for Cleanup)
These accounts were generated programmatically and should be deleted safely.

| ID | Name | Email | Legacy Super (`is_super`) | New Super (`is_super_admin`) | Permissions | Status | Created At |
|---|---|---|---|---|---|---|---|
| **12** | Super Admin | `super_admin@test.com` | Yes | No | `null` | Active | 2026-06-19 18:35:37 |
| **19** | Secondary Admin | `sec_admin_253@test.com` | No | No | `null` | Active | 2026-06-19 18:47:17 |
| **20** | Super Admin | `super_admin_835@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:17 |
| **23** | Super Admin | `super_admin_479@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:18 |
| **25** | Super Admin | `super_admin_684@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:18 |
| **27** | Super Admin | `super_admin_843@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:18 |
| **28** | Secondary Admin | `sec_admin_381@test.com` | No | No | `null` | Active | 2026-06-19 18:47:31 |
| **29** | Super Admin | `super_admin_299@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:31 |
| **32** | Super Admin | `super_admin_229@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:31 |
| **34** | Super Admin | `super_admin_394@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:31 |
| **36** | Super Admin | `super_admin_225@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:31 |
| **37** | Secondary Admin | `sec_admin_123@test.com` | No | No | `null` | Active | 2026-06-19 18:47:36 |
| **38** | Super Admin | `super_admin_666@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:37 |
| **41** | Super Admin | `super_admin_828@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:37 |
| **43** | Super Admin | `super_admin_825@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:37 |
| **45** | Super Admin | `super_admin_966@test.com` | Yes | No | `null` | Active | 2026-06-19 18:47:37 |
| **48** | Secondary Admin | `sec_admin_755@test.com` | No | No | `null` | Active | 2026-06-19 18:57:39 |
| **49** | Super Admin | `super_admin_384@test.com` | Yes | No | `null` | Active | 2026-06-19 18:57:40 |
| **52** | Super Admin | `super_admin_295@test.com` | Yes | No | `null` | Active | 2026-06-19 18:57:40 |
| **54** | Super Admin | `super_admin_987@test.com` | Yes | No | `null` | Active | 2026-06-19 18:57:40 |
| **56** | Super Admin | `super_admin_957@test.com` | Yes | No | `null` | Active | 2026-06-19 18:57:40 |
| **59** | Secondary Admin | `sec_admin_780@test.com` | No | No | `null` | Active | 2026-06-19 18:58:21 |
| **60** | Super Admin | `super_admin_668@test.com` | Yes | No | `null` | Active | 2026-06-19 18:58:21 |
| **63** | Super Admin | `super_admin_378@test.com` | Yes | No | `null` | Active | 2026-06-19 18:58:21 |
| **65** | Super Admin | `super_admin_922@test.com` | Yes | No | `null` | Active | 2026-06-19 18:58:21 |
| **67** | Super Admin | `super_admin_146@test.com` | Yes | No | `null` | Active | 2026-06-19 18:58:21 |
| **68** | Super Admin | `super_admin_672@test.com` | Yes | No | `null` | Active | 2026-06-19 18:58:21 |
| **70** | Restricted Admin | `rest_admin_848@test.com` | No | No | `["students.manage"]` | Active | 2026-06-19 18:58:21 |
| **72** | Secondary Admin | `sec_admin_972@test.com` | No | No | `null` | Active | 2026-06-19 18:58:36 |
| **73** | Super Admin | `super_admin_977@test.com` | Yes | No | `null` | Active | 2026-06-19 18:58:36 |
| **76** | Super Admin | `super_admin_400@test.com` | Yes | No | `null` | Active | 2026-06-19 18:58:36 |
| **78** | Super Admin | `super_admin_532@test.com` | Yes | No | `null` | Active | 2026-06-19 18:58:36 |
| **80** | Super Admin | `super_admin_540@test.com` | Yes | No | `null` | Active | 2026-06-19 18:58:36 |
| **81** | Super Admin | `super_admin_101@test.com` | Yes | No | `null` | Active | 2026-06-19 18:58:36 |
| **83** | Restricted Admin | `rest_admin_937@test.com` | No | No | `["students.manage"]` | Active | 2026-06-19 18:58:36 |

---

## 3. Analysis of Duplicate Admin Creation
### The Root Cause:
Laravel's test suites (`BulkDeleteTest.php` and `YearResetTest.php`) execute unit/feature tests using factories or manual Eloquent insertions on the active database connection (`manst_ellem`).
* **The Bug:** These test classes lacked the `Illuminate\Foundation\Testing\DatabaseTransactions` or `Illuminate\Foundation\Testing\RefreshDatabase` traits.
* **The Result:** The test users generated for mock requests and authorization checks were written to the persistent database and never rolled back, polluting the administrator list.

### Fixes Applied:
1. Updated both `BulkDeleteTest.php` and `YearResetTest.php` to include `use DatabaseTransactions;`.
2. Wrapped all tests to roll back automatically, meaning no future test execution will leave mock data in the database.
3. Updated test configurations to set `is_super_admin = true` on generated mock Super Admins. All 13 tests now pass cleanly with zero database side-effects.

---

## 4. Security Risks & Mitigation Controls

| Security Risk | Severity | Implemented Control / Fix |
|---|---|---|
| **Multiple Super Admins** | **High** | Replaced the legacy `is_super` flag with `is_super_admin`. Added database schema migration and set `is_super_admin = true` for `belal@admin.com` only. All other users default to `false`. |
| **Sub Admin Access to Admin CRUD** | **High** | Restricted `listAdmins`, `createAdmin`, `updateAdmin`, `deleteAdmin`, and `toggleAdminStatus` in `AdminController.php` to check `is_super_admin` only. Sub admins are rejected with `403 Forbidden`. |
| **Sub Admin Editing/Deleting Super Admin** | **High** | Added explicit backend validation guards in `updateAdmin`, `deleteAdmin`, and `toggleAdminStatus` to return `403` if any sub admin tries to edit, delete, or deactivate the Super Admin. |
| **Bypassing Frontend Routing Restrictions** | **Medium** | Replaced simple dashboard redirects. If an unauthorized administrator or user enters a forbidden route, the frontend renders a dedicated **403 Access Denied** page displaying: *"You do not have permission to access this page."* |
| **Stale Database Test Admins** | **Medium** | Configured tests with transactions. A cleanup query (pending your approval below) will remove all programmatically generated test rows safely. |

---

## 5. Cleanup Execution Plan (Awaiting Approval)
Once you review this report, we will run the database cleanup. The following query will safely purge all duplicate test admins, keeping **only** `belal@admin.com` as the Super Admin:

```sql
DELETE FROM users 
WHERE role = 'admin' 
  AND email != 'belal@admin.com';
```

---
> [!IMPORTANT]
> **Action Required:** Please review this audit report. Once you approve the cleanup, I will execute the script to purge the duplicate test admin accounts from the database.
