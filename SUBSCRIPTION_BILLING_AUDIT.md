# Subscription Billing Logic Audit

This audit document validates the calculations and UI/database behaviors for all subscription plans across all billing cycles on the Elm Educational Platform (منصة علم).

---

## 1. Dynamic Pricing Formulas

The system dynamically queries discount parameters from `subscription_settings` to compute subscription plans and customizations. 

The baseline monthly prices for each package are:
*   **Starter**: 199.00 EGP
*   **Basic**: 399.00 EGP
*   **Pro**: 699.00 EGP
*   **Academy**: 1199.00 EGP

### Pricing Cycles & Discount Matrix

| Billing Cycle | Formula | Discount Applied |
| :--- | :--- | :--- |
| **Monthly** (1 Month) | `Base Price * 1` | 0% |
| **3 Months** (Quarterly) | `Base Price * 3` | 0% |
| **Semi-Annual** (6 Months)| `(Base Price * 6) * (1 - Discount/100)` | 10% (from `discount_semi_annually`) |
| **Annual** (12 Months) | `(Base Price * 12) * (1 - Discount/100)` | 20% (from `discount_annually`) |

---

## 2. Plan Calculations (Precise Matrix)

The following tables showcase the expected final costs (rounded to 2 decimal places) for every package.

### A. Starter Package (199.00 EGP/month)
*   **Monthly**: `199.00 * 1 = 199.00 EGP` (Discount: 0.00 EGP)
*   **3 Months**: `199.00 * 3 = 597.00 EGP` (Discount: 0.00 EGP)
*   **Semi-Annual**: `(199.00 * 6) * 0.90 = 1074.60 EGP` (Discount: 119.40 EGP)
*   **Annual**: `(199.00 * 12) * 0.80 = 1910.40 EGP` (Discount: 477.60 EGP)

### B. Basic Package (399.00 EGP/month)
*   **Monthly**: `399.00 * 1 = 399.00 EGP` (Discount: 0.00 EGP)
*   **3 Months**: `399.00 * 3 = 1197.00 EGP` (Discount: 0.00 EGP)
*   **Semi-Annual**: `(399.00 * 6) * 0.90 = 2154.60 EGP` (Discount: 239.40 EGP)
*   **Annual**: `(399.00 * 12) * 0.80 = 3830.40 EGP` (Discount: 957.60 EGP)

### C. Pro Package (699.00 EGP/month)
*   **Monthly**: `699.00 * 1 = 699.00 EGP` (Discount: 0.00 EGP)
*   **3 Months**: `699.00 * 3 = 2097.00 EGP` (Discount: 0.00 EGP)
*   **Semi-Annual**: `(699.00 * 6) * 0.90 = 3774.60 EGP` (Discount: 419.40 EGP)
*   **Annual**: `(699.00 * 12) * 0.80 = 6710.40 EGP` (Discount: 1677.60 EGP)

### D. Academy Package (1199.00 EGP/month)
*   **Monthly**: `1199.00 * 1 = 1199.00 EGP` (Discount: 0.00 EGP)
*   **3 Months**: `1199.00 * 3 = 3597.00 EGP` (Discount: 0.00 EGP)
*   **Semi-Annual**: `(1199.00 * 6) * 0.90 = 6474.60 EGP` (Discount: 719.40 EGP)
*   **Annual**: `(1199.00 * 12) * 0.80 = 11510.40 EGP` (Discount: 2877.60 EGP)

---

## 3. Verified Billing Cycle Tests

### Test 1: Monthly Cycle Test (Passed)
*   **Input**: Starter Plan, Monthly Billing.
*   **Base Price**: 199.00 EGP
*   **Discount Percentage**: 0.00%
*   **Discount Amount**: 0.00 EGP
*   **Final Price**: 199.00 EGP
*   **Card Updates**: Card updates immediately showing `199.00 EGP`.
*   **DB Entry**: `billing_cycle = 'monthly'`, `discount_percentage = 0.00`, `discount_amount = 0.00`, `final_price = 199.00`.

### Test 2: 3 Months Cycle Test (Passed)
*   **Input**: Basic Plan, Quarterly Billing (3 Months).
*   **Base Price**: 1197.00 EGP
*   **Discount Percentage**: 0.00%
*   **Discount Amount**: 0.00 EGP
*   **Final Price**: 1197.00 EGP
*   **Card Updates**: Card updates immediately showing `1197.00 EGP`.
*   **DB Entry**: `billing_cycle = 'quarterly'`, `discount_percentage = 0.00`, `discount_amount = 0.00`, `final_price = 1197.00`.

### Test 3: Semi-Annual Cycle Test (Passed)
*   **Input**: Pro Plan, Semi-Annual Billing (6 Months).
*   **Base Price**: 4194.00 EGP
*   **Discount Percentage**: 10.00% (Loaded from settings)
*   **Discount Amount**: 419.40 EGP
*   **Final Price**: 3774.60 EGP
*   **Card Updates**: Card updates immediately showing `3774.60 EGP`.
*   **DB Entry**: `billing_cycle = 'semi_annual'`, `discount_percentage = 10.00`, `discount_amount = 419.40`, `final_price = 3774.60`.

### Test 4: Annual Cycle Test (Passed)
*   **Input**: Academy Plan, Annual Billing (12 Months).
*   **Base Price**: 14388.00 EGP
*   **Discount Percentage**: 20.00% (Loaded from settings)
*   **Discount Amount**: 2877.60 EGP
*   **Final Price**: 11510.40 EGP
*   **Card Updates**: Card updates immediately showing `11510.40 EGP`.
*   **DB Entry**: `billing_cycle = 'annual'`, `discount_percentage = 20.00`, `discount_amount = 2877.60`, `final_price = 11510.40`.

---

## 4. UI/UX Synchronization Checks

1.  **Immediate Plan Cards Re-rendering**: When the Administrator toggles the billing cycle, plan cards dynamically multiply the base monthly cost, fetch the corresponding discount percentage, and re-render.
2.  **Float Integrity**: Premature integer rounding (`Math.round` or integer cast) has been replaced with `float` precision formatting (`.toFixed(2)` in frontend and `round(..., 2)` in backend database insertions).
3.  **Invoice Breakdown alignment**:
    *   **Base price** is printed as `Base * Months`.
    *   **Discount Amount** shows as `Base * (Discount/100)`.
    *   **Final price** displays as `Base - Discount`.
4.  **Impersonation and Access Control**: The Administrator is the only role allowed to choose and update active billing periods. Teachers can only view their active billing cycle read-only.
