# Subscription Migration Report

Generated on: 2026-06-22 21:51:30

| Teacher Name | Teacher ID | Current Plan | New Assigned Plan | Active Students | Storage (GB) | Status | Notes |
|--------------|------------|--------------|-------------------|-----------------|--------------|--------|-------|
| مستر جمعة العيادي | 217 | None | Free Trial | 0 | 0 GB | Assigned | Auto-assigned new plan due to missing subscription records |
| ىنمؤ نمئءى | 229 | None | Free Trial | 0 | 0 GB | Assigned | Auto-assigned new plan due to missing subscription records |
| بابلا | 219 | None | Free Trial | 1 | 0 GB | Assigned | Auto-assigned new plan due to missing subscription records |
| ىنمؤ نمئءى | 230 | Starter | Starter | 0 | 0 GB | Kept | Existing subscription updated with live usage metrics |
| بللبلب | 220 | Starter | Starter | 1 | 0 GB | Kept | Existing subscription updated with live usage metrics |
| يلايب | 226 | Basic | Basic | 0 | 0 GB | Kept | Existing subscription updated with live usage metrics |
| نةبنسي | 227 | None | Free Trial | 0 | 0 GB | Assigned | Auto-assigned new plan due to missing subscription records |
| ىنمؤ نمئءى | 228 | Starter | Starter | 0 | 0 GB | Kept | Existing subscription updated with live usage metrics |

## Potential Issues / Audit Risks

* **Used Codes Exceeding Thresholds:** Some teachers with 'None' might have code usage that exceeds the free trial parameters (e.g. ID: 217 has 10 codes used but fits in Free Trial safely).
* **Bunny Stream Sync Warnings:** Video storage measurements are pulled from database logs and should be verified periodically with Bunny Stream API.
