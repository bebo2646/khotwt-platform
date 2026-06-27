# Khotwt Platform - Universal Production Audit Report (PASS 1)

This report details the DevOps, security, database, dependency, and code quality audit of the Khotwt Educational Platform. No code changes have been made in this pass. All findings are categorized by severity.

---

## 1. Executive Summary

The Khotwt platform is built using a modern stack: **React (Vite/TypeScript)** on the frontend and **Laravel 13** on the backend. Production hosting is targeted at **Railway** (backend/database) and **Vercel/Netlify** (frontend), using **PostgreSQL (Neon)** as the primary database and **Bunny Stream** for video hosting.

### Key Strengths
* **Secure Direct Video Uploads:** Video binary files upload directly to Bunny Stream via signed signatures, bypassing Laravel entirely to prevent backend resource exhaustion.
* **Modern Stack:** The Laravel 13 framework and React 19 are clean, up-to-date, and leverage native type safety.
* **0 Vulnerabilities:** Both `npm audit` and `composer audit` reports returned 0 security vulnerabilities.

### Primary Risks
* **Lack of Automated Testing Executability:** The local PHP environment lacks the `pdo_sqlite` driver. The PHPUnit test suite is configured to use in-memory SQLite, which prevents tests from running locally without environment adjustments. **Manual verification is required before production deployment.**
* **Insecure Webhook Signature Fallback:** The Bunny Stream webhook signature check is completely bypassed if the webhook secret is empty or unconfigured, allowing easy spoofing of video processing states in production if improperly configured.
* **Database-Specific Compatibility Lock:** Raw database queries utilize PostgreSQL-specific `TO_CHAR` functions, which break testing on SQLite and restrict database portability.
* **Starter Subscription Inconsistency:** Code to dynamically initialize a "Starter" subscription for teachers is duplicated across four locations with inconsistent duration settings (30 days vs. 1 year).

---

## 2. Security Audit (Highest Priority)

### Critical & High Issues
No Critical or High vulnerabilities were found. Both package auditors reported 0 vulnerabilities.

### Medium Issues

| Severity | File | Line(s) | Problem | Why it matters | Suggested Fix |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Medium** | `backend/app/Http/Controllers/BunnyWebhookController.php` | 21-34 | Insecure Webhook Signature Bypassing | If the webhook secret is empty or missing, signature verification is silently bypassed. A malicious actor could spoof video status and size updates. | Require the webhook secret on production; fail-safe by rejecting unsigned requests when the environment is not `local`. |
| **Medium** | `backend/routes/api.php` | 42-43 | Missing Rate Limiting on Auth Routes | `/login` and `/register` do not have the `throttle` middleware, leaving them vulnerable to brute-force attacks. | Apply Laravel's `throttle:login` rate-limiting middleware to auth routes. |
| **Medium** | `backend/routes/api.php` | 28-39 | Exposed Unprotected Debug Route | `/debug/bunny-config` is exposed publicly and returns configuration status details. | Remove the route or restrict it behind the `role:admin` or environment middleware. |

### Low Issues

| Severity | File | Line(s) | Problem | Why it matters | Suggested Fix |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Low** | `backend/.env.example` | 24-28 | Comments containing database credentials | The file contains commented-out database credentials (`DB_PASSWORD=npg_...`) which may resemble active development credentials. | Clean up comments and replace active placeholders with dummy strings (e.g. `your_db_password`). |
| **Low** | `frontend/src/services/api.ts` | 13-25 | Tokens stored in `localStorage` | Plain-text storage of `auth_token` and `session_token` in `localStorage` is vulnerable to XSS-based token theft. | Document the risk or transition to HTTP-only cookies with same-site protection for session persistence. |

---

## 3. Dependency Audit

All dependencies are clean with zero vulnerabilities reported. The following patch/minor upgrades are recommended to align with stable releases:

### Frontend Outdated Packages (npm)
| Package | Current | Latest | Vulnerabilities | Recommendation |
| :--- | :---: | :---: | :---: | :--- |
| `@vitejs/plugin-react` | `6.0.2` | `6.0.3` | None | Upgrade (Patch) |
| `axios` | `1.18.0` | `1.18.1` | None | Upgrade (Patch) |
| `eslint` | `10.5.0` | `10.6.0` | None | Upgrade (Patch) |
| `framer-motion` | `12.40.0` | `12.42.0` | None | Upgrade (Minor) |
| `globals` | `17.6.0` | `17.7.0` | None | Upgrade (Minor) |
| `react-hook-form` | `7.79.0` | `7.80.0` | None | Upgrade (Minor) |
| `recharts` | `3.8.1` | `3.9.0` | None | Upgrade (Minor) |
| `typescript-eslint` | `8.61.1` | `8.62.0` | None | Upgrade (Minor) |
| `vite` | `8.0.16` | `8.1.0` | None | Upgrade (Minor) |

> [!NOTE]
> `lucide-react` is outdated (current `0.468.0`, latest `1.21.0`), but upgrading is a **Major** upgrade (from 0.x to 1.x) and is skipped to avoid breaking icon imports.

### Backend Outdated Packages (Composer)
| Package | Current | Latest | Vulnerabilities | Recommendation |
| :--- | :---: | :---: | :---: | :--- |
| `laravel/framework` | `13.16.1` | `13.17.0` | None | Upgrade (Patch/Minor) |
| `laravel/pao` | `1.1.1` | `1.1.2` | None | Upgrade (Patch) |

> [!NOTE]
> `phpunit/phpunit` is at version `12.5.30` (latest `13.2.1`). This is a **Major** upgrade and is skipped to maintain test suite compatibility.

---

## 4. Environment & Deployment Audit

* **Frontend Variable Mismatch:** `VITE_BUNNY_CDN_HOSTNAME` and `VITE_BUNNY_LIBRARY_ID` are present in `frontend/.env` but are completely missing from `frontend/.env.production` and empty in `frontend/.env.example`.
* **CI/CD Integration:** No `.github/workflows` folder exists. Deployments rely entirely on Railway/Vercel continuous integration hooks.

---

## 5. Database Audit

| Table | Issue | Risk | Suggested Fix |
| :--- | :--- | :--- | :--- |
| **All Tables** | Missing explicit indexes on foreign key columns (e.g. `teacher_id` in `courses`, `course_id` in `units`, etc.) | Performance degradation and full table scans on joins as the dataset grows. | Add database indexes to referencing foreign keys in a new migration. |
| **AdminActivityLog** / **WalletTransactions** / **Enrollments** | Raw query usage of `TO_CHAR` | Restricts database compatibility to PostgreSQL, causing sqlite-based unit tests to fail with "no such function" errors. | Refactor raw dates to standard Eloquent formatting or database-agnostic functions (e.g. SQL-standard formatted queries). |

---

## 6. API Audit

| Endpoint | Issue | Risk | Fix |
| :--- | :--- | :--- | :--- |
| `/api/debug/bunny-config` | Publicly accessible configuration check. | Exposes config completeness information. | Wrap in `role:admin` middleware or remove. |
| `/api/login` / `/api/register` | No rate limiting applied. | Brute force or account creation spam. | Apply Sanctum rate-limiter middleware. |

---

## 7. File Upload Audit (Bunny Stream)

* **Direct Uploads:** Functioning correctly. Binary files upload directly using signed tokens to avoid Laravel thread lockups.
* **Webhook Health:** Signatures are checked correctly *only if* the webhook secret is configured.
* **Storage Limits:** Validations verify teacher storage limits prior to issuing signed upload tokens.

---

## 8. Duplicated Logic & Refactoring

### Dynamic "Starter" Subscription Initialization
The logic to initialize a teacher subscription under the default "Starter" plan is duplicated:
1. `CheckSubscriptionActive` middleware (adds **30 days**).
2. `StudentController::checkTeacherCapacity` (adds **30 days**).
3. `SubscriptionController::getTeacherSubscription` (adds **1 year**).
4. `SubscriptionController::getTeacherSubscriptionSelf` (adds **1 year**).

* **Risk:** Inconsistent database entries and business logic rules depending on which route initializes the subscription first.
* **Fix:** Consolidate subscription creation into a central helper or service method.

### Missing Timeouts on HTTP Requests
External calls (YouTube metadata scrap in `TeacherController` and Bunny API calls in services) lack explicit execution timeouts.
* **Risk:** Slow API connections or service outages can lock PHP-FPM worker processes, leading to gateway timeouts.
* **Fix:** Add a default timeout (e.g., `->timeout(5)`) to all HTTP calls.

---

## 9. Quick Health Checks

* **Local Test Suite Executability:** Running `php artisan test` fails with `could not find driver` because `pdo_sqlite` is not enabled in the local PHP environment.
* **Manual Verification Required:** Because automated tests cannot be executed locally, all changes must undergo manual verification before production deployment.

---

## 10. Recommended Fix Order

If approved, fixes will be applied during PASS 2 in the following order:

1. **Step 1: Security Fixes**
   * Secure `BunnyWebhookController` signature verification in non-local environments.
   * Apply rate limiting to Auth routes (`/login`, `/register`).
   * Protect `/api/debug/bunny-config`.
2. **Step 2: Dependency Upgrades**
   * Apply minor and patch upgrades to frontend and backend packages.
3. **Step 3: Safe Cleanups & Bug Fixes**
   * Centralize the default "Starter" subscription creation logic with consistent 30-day boundaries.
   * Add timeouts (`->timeout(5)`) to all external HTTP requests.
   * Clean up commented PostgreSQL credentials in `.env.example`.
   * Add missing `VITE_BUNNY` keys to `frontend/.env.production` and `frontend/.env.example`.
4. **Step 4: Database Improvements**
   * Create database migration to index high-traffic foreign keys.

---

**Please review this audit report. I will proceed with PASS 2 only after your approval.**
