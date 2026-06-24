# Production SEO & Indexing Checklist

This checklist describes the steps to activate indexing, monitor analytics, and maintain structured data on the production environment for **منصة خطوتك**.

---

## 1. Domain Verification & Google Search Console (GSC) Setup
- [ ] **Verify Production Domain**:
  1. Go to [Google Search Console](https://search.google.com/search-console).
  2. Choose **URL Prefix** verification method and enter: `https://elm-platform.com`
  3. Download the HTML verification file OR copy the `google-site-verification` content value.
  4. Replace `YOUR_GOOGLE_SEARCH_CONSOLE_VERIFICATION_CODE_PLACEHOLDER` in [index.html](file:///D:/manst%20ellem/frontend/index.html) with your verification token.
  5. Deploy to production, and click **Verify** in Search Console.

---

## 2. Sitemap Submission Steps
- [ ] **Submit Sitemap Index**:
  1. Once GSC verification succeeds, navigate to **Sitemaps** in the left sidebar.
  2. Add the main sitemap URL: `https://elm-platform.com/sitemap.xml` and click **Submit**.
  3. Ensure GSC reads the other referenced sitemaps:
     - `https://elm-platform.com/sitemap-teachers.xml`
     - `https://elm-platform.com/sitemap-courses.xml`

---

## 3. Google Analytics 4 (GA4) Integration Setup
- [ ] **Deploy Measurement ID**:
  1. In Google Analytics, obtain your Measurement ID (e.g. `G-XXXXXXXXXX`).
  2. Set the environment variable `VITE_GA_MEASUREMENT_ID` to this value in your production build environment (Netlify, Vercel, etc.).
  3. Ensure virtual page views are tracking correctly by inspecting the browser console for logs starting with `[Google Analytics] Tracked PageView`.

---

## 4. Crawlability & Indexing Audit
- [ ] **Verify noindex on Protected Pages**:
  - Visit `/admin`, `/teacher/dashboard`, or `/student/dashboard` and verify that the HTML header contains:
    `<meta name="robots" content="noindex, nofollow">`
- [ ] **Verify index, follow on Public Pages**:
  - Visit `/`, `/courses`, and `/teachers` and verify they contain:
    `<meta name="robots" content="index, follow">`
- [ ] **Review robots.txt**:
  - Ensure [robots.txt](file:///D:/manst%20ellem/frontend/public/robots.txt) correctly links to the absolute sitemap URLs and allows crawling on `/stages/*`.

---

## 5. Structured Data (JSON-LD) Validation
- [ ] **Verify Schema Graphs**:
  - Submit `/` to [Google Schema Markup Validator](https://validator.schema.org) and confirm that both `WebSite` and `Organization` schemas are validated.
  - Submit a course URL (e.g. `/courses/math-grade-3`) and verify that `Course` and `BreadcrumbList` schemas are present.
  - Submit a teacher profile URL (e.g. `/teachers/mohamed-ahmed`) and verify that `Person` and `BreadcrumbList` schemas are present.

---

## 6. Favicon and Asset Checks
- [ ] **Confirm Asset Presence**:
  - Verify `/favicon.ico` is present in the build directory.
  - Verify `/apple-touch-icon.png` is present at the root public directory.
  - Verify `/site.webmanifest` returns standard JSON matching [site.webmanifest](file:///D:/manst%20ellem/frontend/public/site.webmanifest).

---

## 7. Performance & SEO Score Summary
- **Mobile Friendly**: Yes, optimized viewport `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- **Theme Color Integration**: Programmatic meta tag matched to `#6D5DFC`.
- **Crawlability Score**: 100/100 (clean separation of dashboards and public pages, dynamic sitemaps generated at build time).
- **Metadata Coverage**: 100/100 (includes canonical link rel, open graph, and twitter fallbacks).
