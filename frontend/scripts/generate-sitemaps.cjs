const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const HOST = process.env.VITE_SITE_URL || 'https://khotwtak.com';
const API_URL = process.env.VITE_API_URL || process.env.API_URL || 'https://khotwt-platform-production.up.railway.app/api';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`API HTTP ${res.statusCode} (${url})`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => reject(err));
  });
}

async function generate() {
  console.log('[Sitemap Generator] Starting sitemap generation...');

  // Only real, non-duplicate, canonical public pages
  const staticPages = [
    { loc: '', changefreq: 'daily', priority: '1.0' },
    { loc: '/courses', changefreq: 'daily', priority: '0.9' },
    { loc: '/teachers', changefreq: 'daily', priority: '0.9' },
    { loc: '/monthly-exams', changefreq: 'weekly', priority: '0.8' },
    { loc: '/departments', changefreq: 'weekly', priority: '0.8' },
    { loc: '/chemistry', changefreq: 'weekly', priority: '0.8' },
    { loc: '/physics', changefreq: 'weekly', priority: '0.8' },
    { loc: '/arabic', changefreq: 'weekly', priority: '0.8' },
    { loc: '/grade-1-secondary', changefreq: 'weekly', priority: '0.8' },
    { loc: '/grade-2-secondary', changefreq: 'weekly', priority: '0.8' },
    { loc: '/grade-3-secondary', changefreq: 'weekly', priority: '0.8' },
    { loc: '/login', changefreq: 'monthly', priority: '0.5' },
    { loc: '/register', changefreq: 'monthly', priority: '0.6' },
  ];

  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Generate main sitemap.xml
  let mainXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  mainXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  staticPages.forEach((page) => {
    mainXml += '  <url>\n';
    mainXml += `    <loc>${HOST}${page.loc}</loc>\n`;
    mainXml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    mainXml += `    <priority>${page.priority}</priority>\n`;
    mainXml += '  </url>\n';
  });
  mainXml += '</urlset>\n';

  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), mainXml);
  console.log('[Sitemap Generator] Generated clean static sitemap.xml (no duplicates)');

  // 2. Fetch and generate sitemap-teachers.xml
  let teachersXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  teachersXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  try {
    let responseData = null;
    try {
      responseData = await fetchJSON('http://127.0.0.1:8000/api/teachers');
    } catch (e) {
      responseData = await fetchJSON(`${API_URL}/teachers`);
    }

    const teacherList = Array.isArray(responseData) ? responseData : (responseData?.teachers || []);
    console.log(`[Sitemap Generator] Fetched ${teacherList.length} teachers.`);
    const seenSlugs = new Set();

    teacherList.forEach((t) => {
      const slug = t.slug || t.id;
      if (!slug || seenSlugs.has(String(slug))) return;
      seenSlugs.add(String(slug));

      teachersXml += '  <url>\n';
      teachersXml += `    <loc>${HOST}/teacher/${encodeURIComponent(String(slug))}</loc>\n`;
      teachersXml += '    <changefreq>weekly</changefreq>\n';
      teachersXml += '    <priority>0.85</priority>\n';
      teachersXml += '  </url>\n';
    });
  } catch (err) {
    console.warn('[Sitemap Generator] Failed to fetch teachers from API, generating empty fallback. Error:', err.message);
  }
  teachersXml += '</urlset>\n';
  fs.writeFileSync(path.join(publicDir, 'sitemap-teachers.xml'), teachersXml);
  console.log('[Sitemap Generator] Generated clean sitemap-teachers.xml');

  // 3. Fetch and generate sitemap-courses.xml
  let coursesXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  coursesXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  try {
    let responseData = null;
    try {
      responseData = await fetchJSON('http://127.0.0.1:8000/api/courses');
    } catch (e) {
      responseData = await fetchJSON(`${API_URL}/courses`);
    }

    const courseList = Array.isArray(responseData) ? responseData : (responseData?.courses || []);
    console.log(`[Sitemap Generator] Fetched ${courseList.length} courses.`);
    const seenSlugs = new Set();

    courseList.forEach((c) => {
      const slug = c.slug || c.id;
      if (!slug || seenSlugs.has(String(slug))) return;
      seenSlugs.add(String(slug));

      coursesXml += '  <url>\n';
      coursesXml += `    <loc>${HOST}/course/${encodeURIComponent(String(slug))}</loc>\n`;
      coursesXml += '    <changefreq>weekly</changefreq>\n';
      coursesXml += '    <priority>0.85</priority>\n';
      coursesXml += '  </url>\n';
    });
  } catch (err) {
    console.warn('[Sitemap Generator] Failed to fetch courses from API, generating empty fallback. Error:', err.message);
  }
  coursesXml += '</urlset>\n';
  fs.writeFileSync(path.join(publicDir, 'sitemap-courses.xml'), coursesXml);
  console.log('[Sitemap Generator] Generated clean sitemap-courses.xml');

  console.log('[Sitemap Generator] Sitemap generation completed successfully!');
}

generate().catch((err) => {
  console.error('[Sitemap Generator] Fatal error generating sitemaps:', err);
  process.exit(1);
});
