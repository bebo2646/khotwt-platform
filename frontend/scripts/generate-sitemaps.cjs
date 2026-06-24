const fs = require('fs');
const path = require('path');
const https = require('https');

const HOST = 'https://elm-platform.com';
const API_URL = 'https://khotwt-platform-production.up.railway.app/api';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch JSON, status code: ${res.statusCode}`));
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

  const staticPages = [
    '',
    '/teachers',
    '/courses',
    '/login',
    '/register',
    '/chemistry',
    '/physics',
    '/arabic',
    '/grade-1-secondary',
    '/grade-2-secondary',
    '/grade-3-secondary'
  ];

  const subjects = ['chemistry', 'physics', 'biology', 'math', 'science', 'arabic', 'english'];
  subjects.forEach(subject => {
    staticPages.push(`/subject/${subject}`);
    staticPages.push(`/subjects/${subject}`);
  });

  const grades = ['first-preparatory', 'second-preparatory', 'third-preparatory', 'first-secondary', 'second-secondary', 'third-secondary'];
  grades.forEach(grade => {
    staticPages.push(`/grade/${grade}`);
    staticPages.push(`/stages/${grade}`);
  });

  // 1. Generate main sitemap.xml
  let mainXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  mainXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  staticPages.forEach(page => {
    mainXml += '  <url>\n';
    mainXml += `    <loc>${HOST}${page}</loc>\n`;
    mainXml += '    <changefreq>daily</changefreq>\n';
    mainXml += `    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n`;
    mainXml += '  </url>\n';
  });
  mainXml += '</urlset>\n';

  const publicDir = path.join(__dirname, '../public');
  
  // Ensure the public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), mainXml);
  console.log('[Sitemap Generator] Generated static sitemap.xml');

  // 2. Fetch and generate sitemap-teachers.xml
  let teachersXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  teachersXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  try {
    const responseData = await fetchJSON(`${API_URL}/teachers`);
    const teacherList = Array.isArray(responseData) ? responseData : (responseData.teachers || []);
    console.log(`[Sitemap Generator] Fetched ${teacherList.length} teachers.`);
    teacherList.forEach(t => {
      const slug = t.slug || `teacher-${t.id}`;
      // Add both legacy and SEO-friendly routes
      teachersXml += '  <url>\n';
      teachersXml += `    <loc>${HOST}/teacher/${slug}</loc>\n`;
      teachersXml += '    <changefreq>weekly</changefreq>\n';
      teachersXml += '    <priority>0.9</priority>\n';
      teachersXml += '  </url>\n';
      teachersXml += '  <url>\n';
      teachersXml += `    <loc>${HOST}/teachers/${slug}</loc>\n`;
      teachersXml += '    <changefreq>weekly</changefreq>\n';
      teachersXml += '    <priority>0.9</priority>\n';
      teachersXml += '  </url>\n';
    });
  } catch (err) {
    console.warn('[Sitemap Generator] Failed to fetch teachers from API, generating empty fallback. Error:', err.message);
  }
  teachersXml += '</urlset>\n';
  fs.writeFileSync(path.join(publicDir, 'sitemap-teachers.xml'), teachersXml);
  console.log('[Sitemap Generator] Generated sitemap-teachers.xml');

  // 3. Fetch and generate sitemap-courses.xml
  let coursesXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  coursesXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  try {
    const responseData = await fetchJSON(`${API_URL}/courses`);
    const courseList = Array.isArray(responseData) ? responseData : [];
    console.log(`[Sitemap Generator] Fetched ${courseList.length} courses.`);
    courseList.forEach(c => {
      const slug = c.slug || `course-${c.id}`;
      // Add both legacy and SEO-friendly routes
      coursesXml += '  <url>\n';
      coursesXml += `    <loc>${HOST}/course/${slug}</loc>\n`;
      coursesXml += '    <changefreq>weekly</changefreq>\n';
      coursesXml += '    <priority>0.9</priority>\n';
      coursesXml += '  </url>\n';
      coursesXml += '  <url>\n';
      coursesXml += `    <loc>${HOST}/courses/${slug}</loc>\n`;
      coursesXml += '    <changefreq>weekly</changefreq>\n';
      coursesXml += '    <priority>0.9</priority>\n';
      coursesXml += '  </url>\n';
    });
  } catch (err) {
    console.warn('[Sitemap Generator] Failed to fetch courses from API, generating empty fallback. Error:', err.message);
  }
  coursesXml += '</urlset>\n';
  fs.writeFileSync(path.join(publicDir, 'sitemap-courses.xml'), coursesXml);
  console.log('[Sitemap Generator] Generated sitemap-courses.xml');

  console.log('[Sitemap Generator] Sitemap generation completed successfully!');
}

generate().catch(err => {
  console.error('[Sitemap Generator] Fatal error generating sitemaps:', err);
  process.exit(1);
});
