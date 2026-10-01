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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function getPlatformData() {
  let teachers = [];
  let courses = [];
  let departments = [
    { id: 1, name: 'التعليم المدرسي (إعدادي وثانوي)', slug: 'school', description: 'شروحات المناهج لصفوف الإعدادية والثانوية مع نخبة كبار المدرسين.', badge: 'مناهج معتمدة' },
    { id: 2, name: 'البرمجة والتكنولوجيا', slug: 'tech', description: 'تعلم تطوير الويب، التطبيقات، والذكاء الاصطناعي من الصفر حتى الاحتراف.', badge: 'مهارات المستقبل' },
    { id: 3, name: 'التجارة وإدارة الأعمال', slug: 'business', description: 'المحاسبة، ريادة الأعمال، التسويق الإلكتروني، وإدارة المشروعات.', badge: 'سوق العمل' },
    { id: 4, name: 'التصميم والفنون الرقمية', slug: 'design', description: 'الجرافيك، تجربة المستخدم UI/UX، المونتاج وتحرير الفيديو.', badge: 'إبداع تقني' },
    { id: 5, name: 'اللغات والترجمة', slug: 'languages', description: 'إتقان اللغة الإنجليزية، الألمانية، الفرنسية، والمحادثة العملية.', badge: 'تواصل عالمي' }
  ];

  // Try local first, then railway
  try {
    teachers = await fetchJSON('http://127.0.0.1:8000/api/teachers');
  } catch (e) {
    try {
      teachers = await fetchJSON(`${API_URL}/teachers`);
    } catch (err) {
      console.warn('[Prerender] Could not fetch teachers, using fallback.');
    }
  }

  try {
    courses = await fetchJSON('http://127.0.0.1:8000/api/courses');
  } catch (e) {
    try {
      courses = await fetchJSON(`${API_URL}/courses`);
    } catch (err) {
      console.warn('[Prerender] Could not fetch courses, using fallback.');
    }
  }

  // Ensure arrays
  teachers = Array.isArray(teachers) ? teachers : (teachers?.teachers || []);
  courses = Array.isArray(courses) ? courses : (courses?.courses || []);

  return { teachers, courses, departments };
}

function renderGlobalNav() {
  return `
    <header class="w-full bg-slate-950/90 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md" dir="rtl">
      <div class="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        <div class="flex items-center gap-8">
          <a href="/" class="flex items-center gap-3 group" title="الصفحة الرئيسية لمنصة خطوتك">
            <span class="text-2xl font-black bg-gradient-to-r from-brand-primary via-indigo-500 to-brand-secondary bg-clip-text text-transparent">خطوتك</span>
            <span class="text-[11px] font-bold text-slate-400 border border-slate-700/60 px-2 py-0.5 rounded-full hidden sm:inline-block">المنصة التعليمية</span>
          </a>
          <nav class="hidden md:flex items-center gap-6 text-sm font-bold text-slate-300" aria-label="القائمة الرئيسية">
            <a href="/" class="hover:text-brand-primary transition-colors">الرئيسية</a>
            <a href="/courses" class="hover:text-brand-primary transition-colors">الكورسات والمراجعات</a>
            <a href="/teachers" class="hover:text-brand-primary transition-colors">نخبة المعلمين</a>
            <a href="/monthly-exams" class="hover:text-brand-primary transition-colors">الامتحانات الشهرية</a>
            <a href="/departments" class="hover:text-brand-primary transition-colors">المجالات والمسارات</a>
          </nav>
        </div>
        <div class="flex items-center gap-3">
          <a href="/login" class="px-4 py-2 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition-colors">تسجيل الدخول</a>
          <a href="/register" class="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-brand-primary/20">انضم مجاناً</a>
        </div>
      </div>
    </header>
  `;
}

function renderGlobalFooter() {
  return `
    <footer class="w-full bg-slate-950 border-t border-slate-800 text-slate-400 pt-16 pb-12 mt-20" dir="rtl">
      <div class="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div class="space-y-4">
          <span class="text-2xl font-black text-white">خطوتك</span>
          <p class="text-xs sm:text-sm leading-relaxed text-slate-400">
            خطوتك هي منصتك التعليمية المتكاملة نحو التفوق والنجاح الأكاديمي. شروحات تفاعلية بأعلى جودة مع حماية كاملة للمحتوى ونظام امتحانات ذكي.
          </p>
        </div>
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-white">روابط سريعة</h3>
          <ul class="space-y-2 text-xs">
            <li><a href="/" class="hover:text-brand-primary transition-colors">الرئيسية</a></li>
            <li><a href="/courses" class="hover:text-brand-primary transition-colors">تصفح الكورسات</a></li>
            <li><a href="/teachers" class="hover:text-brand-primary transition-colors">دليل المعلمين</a></li>
            <li><a href="/monthly-exams" class="hover:text-brand-primary transition-colors">بنك الامتحانات</a></li>
          </ul>
        </div>
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-white">المراحل والمواد</h3>
          <ul class="space-y-2 text-xs">
            <li><a href="/grade-1-secondary" class="hover:text-brand-primary transition-colors">الصف الأول الثانوي</a></li>
            <li><a href="/grade-2-secondary" class="hover:text-brand-primary transition-colors">الصف الثاني الثانوي</a></li>
            <li><a href="/grade-3-secondary" class="hover:text-brand-primary transition-colors">الصف الثالث الثانوي (الثانوية العامة)</a></li>
            <li><a href="/chemistry" class="hover:text-brand-primary transition-colors">مادة الكيمياء</a></li>
            <li><a href="/physics" class="hover:text-brand-primary transition-colors">مادة الفيزياء</a></li>
          </ul>
        </div>
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-white">الأمان والمساعدة</h3>
          <ul class="space-y-2 text-xs">
            <li><a href="/login" class="hover:text-brand-primary transition-colors">بوابة الطلاب والمعلمين</a></li>
            <li><a href="/register" class="hover:text-brand-primary transition-colors">إنشاء حساب جديد</a></li>
            <li><span class="text-slate-500">حماية الفيديوهات عبر Bunny Stream</span></li>
            <li><span class="text-slate-500">نظام فحص الغش المتقدم للمنصة</span></li>
          </ul>
        </div>
      </div>
      <div class="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500">
        جميع الحقوق محفوظة &copy; ${new Date().getFullYear()} منصة خطوتك التعليمية (Khotwtak Platform).
      </div>
    </footer>
  `;
}

function renderHomePage(data) {
  const { teachers, courses, departments } = data;

  return `
    ${renderGlobalNav()}
    <main class="w-full text-right" dir="rtl">
      
      <!-- 1. Hero Section -->
      <section class="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div class="lg:col-span-8 space-y-6">
            <div class="inline-flex items-center gap-2 px-3.5 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-black rounded-full">
              <span>🚀 بوابتك الأولى للتعليم الإلكتروني الحديث</span>
            </div>
            <h1 class="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-tight">
              خطوتك - منصة تعليمية متكاملة للطلاب
              <span class="block text-2xl sm:text-4xl mt-3 font-extrabold bg-gradient-to-r from-brand-primary via-indigo-500 to-brand-secondary bg-clip-text text-transparent">
                استكشف شغفك، اكتسب مهاراتك، واصنع مستقبلك
              </span>
            </h1>
            <p class="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl">
              منصة تعليمية رائدة تجمع شروحات المرحلة المدرسية (الإعدادية والثانوية) مع نخبة كبار موجهي ومعلمي المواد، إلى جانب دورات البرمجة والذكاء الاصطناعي، إدارة الأعمال، والتصميم، بأعلى معايير الجودة والحماية وبواجهة سهلة الاستخدام.
            </p>

            <div class="flex flex-wrap gap-2 pt-2">
              ${departments.map(d => `
                <a href="/courses?category=${d.slug}" class="px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300 hover:text-brand-primary hover:border-brand-primary transition-all">
                  ${escapeHtml(d.name)}
                </a>
              `).join('')}
            </div>

            <div class="flex flex-wrap gap-4 pt-4">
              <a href="/courses" class="px-8 py-3.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-black text-sm shadow-lg shadow-brand-primary/25 transition-all">
                تصفح الكورسات والمحاضرات
              </a>
              <a href="/teachers" class="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white rounded-xl font-black text-sm transition-all">
                تعرف على المعلمين والخبراء
              </a>
            </div>
          </div>

          <div class="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 class="text-xl font-black text-white border-b border-slate-800 pb-3">إحصائيات منصة خطوتك</h2>
            <div class="grid grid-cols-2 gap-4">
              <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                <span class="text-2xl font-black text-brand-primary block">${teachers.length || 7}+</span>
                <span class="text-xs text-slate-400">معلم وخبير معتمد</span>
              </div>
              <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                <span class="text-2xl font-black text-emerald-400 block">${courses.length || 10}+</span>
                <span class="text-xs text-slate-400">كورس دراسي متاح</span>
              </div>
              <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                <span class="text-2xl font-black text-indigo-400 block">100%</span>
                <span class="text-xs text-slate-400">فيديوهات محمية بدقة HD</span>
              </div>
              <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                <span class="text-2xl font-black text-amber-400 block">فوري</span>
                <span class="text-xs text-slate-400">تصحيح الامتحانات التفاعلية</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Departments Section -->
      <section class="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800/80">
        <div class="text-center space-y-2 mb-12">
          <h2 class="text-2xl sm:text-4xl font-black text-white">اختر المجال الذي يناسب طموحك</h2>
          <p class="text-xs sm:text-sm text-slate-400">مسارات تعليمية متخصصة ومصممة لتغطية متطلباتك الدراسية والمهنية</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          ${departments.map(d => `
            <article class="p-6 bg-slate-900/60 border border-slate-800 hover:border-brand-primary/40 rounded-2xl transition-all">
              <h3 class="text-lg font-black text-white mb-2">${escapeHtml(d.name)}</h3>
              <p class="text-xs text-slate-400 leading-relaxed mb-4">${escapeHtml(d.description)}</p>
              <a href="/courses?category=${d.slug}" class="text-xs font-black text-brand-primary hover:underline">استكشف الكورسات المتاحة &larr;</a>
            </article>
          `).join('')}
        </div>
      </section>

      <!-- 3. Featured Courses -->
      <section class="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800/80">
        <div class="flex justify-between items-center mb-10">
          <div>
            <h2 class="text-2xl sm:text-4xl font-black text-white">أحدث الكورسات والمراجعات المتاحة</h2>
            <p class="text-xs sm:text-sm text-slate-400">اشترك الآن في أحدث الشروحات التعليمية وتابع مع معلمك فوراً</p>
          </div>
          <a href="/courses" class="text-xs font-black text-brand-primary hover:underline">عرض جميع الكورسات (${courses.length}) &larr;</a>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          ${courses.map(c => `
            <article class="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-brand-primary/40 transition-all flex flex-col justify-between">
              <div>
                <a href="/course/${c.slug || c.id}" class="block aspect-video w-full bg-slate-800 overflow-hidden">
                  <img src="${c.cover_image || '/og-image.jpg'}" alt="غلاف كورس ${escapeHtml(c.title)}" class="w-full h-full object-cover" loading="lazy" />
                </a>
                <div class="p-5 space-y-3">
                  <span class="text-[11px] font-bold text-brand-primary block">${escapeHtml(c.subject || 'المادة')}</span>
                  <h3 class="font-black text-lg text-white">
                    <a href="/course/${c.slug || c.id}" class="hover:text-brand-primary transition-colors">${escapeHtml(c.title)}</a>
                  </h3>
                  <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed">${escapeHtml(c.description || 'كورس تعليمي تفاعلي يغطي كامل تفاصيل المنهج مع اختبارات دورية ومتابعة مستمرة.')}</p>
                </div>
              </div>
              <div class="p-5 pt-0 flex items-center justify-between border-t border-slate-800/60 mt-4">
                <span class="text-sm font-black text-white">${c.price ? `${c.price} ج.م` : 'مجاناً'}</span>
                <a href="/course/${c.slug || c.id}" class="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs font-bold transition-all">
                  تفاصيل الكورس
                </a>
              </div>
            </article>
          `).join('')}
        </div>
      </section>

      <!-- 4. Featured Teachers -->
      <section class="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800/80">
        <div class="flex justify-between items-center mb-10">
          <div>
            <h2 class="text-2xl sm:text-4xl font-black text-white">نخبة المعلمين والخبراء</h2>
            <p class="text-xs sm:text-sm text-slate-400">تواصل وتعلم مع أفضل المعلمين المعتمدين والمتميزين بالجمهورية</p>
          </div>
          <a href="/teachers" class="text-xs font-black text-brand-primary hover:underline">دليل كل المعلمين &larr;</a>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          ${teachers.slice(0, 8).map(t => `
            <article class="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center hover:border-brand-primary/40 transition-all space-y-3">
              <a href="/teacher/${encodeURIComponent(String(t.slug || t.id))}" class="block w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-brand-primary/30">
                <img src="${t.avatar || '/og-image.jpg'}" alt="صورة المعلم ${escapeHtml(t.name)}" class="w-full h-full object-cover" loading="lazy" />
              </a>
              <h3 class="font-black text-base text-white">
                <a href="/teacher/${encodeURIComponent(String(t.slug || t.id))}" class="hover:text-brand-primary transition-colors">${escapeHtml(t.name)}</a>
              </h3>
              <p class="text-xs text-brand-primary font-bold">مدرس ${escapeHtml(t.subject || 'المادة')}</p>
              <p class="text-xs text-slate-400 line-clamp-2">${escapeHtml(t.bio || t.experience || 'خبرة متميزة في تدريس المناهج وشرح المراجعات النهائية.')}</p>
              <a href="/teacher/${encodeURIComponent(String(t.slug || t.id))}" class="inline-block px-4 py-1.5 bg-slate-800 hover:bg-brand-primary text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all">
                الملف الشخصي
              </a>
            </article>
          `).join('')}
        </div>
      </section>

      <!-- 5. Platform Advantages -->
      <section class="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800/80">
        <div class="text-center space-y-2 mb-12">
          <h2 class="text-2xl sm:text-4xl font-black text-white">تجربة تعليمية متكاملة بأسلوب حديث</h2>
          <p class="text-xs sm:text-sm text-slate-400">مميزات صممت خصيصاً لتوفير بيئة تعليمية ذكية، آمنة ومريحة</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <h3 class="text-base font-bold text-white">محاضرات وحماية عالية</h3>
            <p class="text-xs text-slate-400 leading-relaxed">بث فيديو فائق الجودة عبر Bunny Stream مع حماية ضد تسجيل الشاشة وتتبع التقدم بالثانية.</p>
          </div>
          <div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <h3 class="text-base font-bold text-white">امتحانات وتصحيح فوري</h3>
            <p class="text-xs text-slate-400 leading-relaxed">اختبارات دورية مع تقييم درجات فوري وملاحظات مخصصة من المعلم لتطوير مستواك.</p>
          </div>
          <div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <h3 class="text-base font-bold text-white">محفظة وشحن بالأكواد</h3>
            <p class="text-xs text-slate-400 leading-relaxed">شحن رصيد سهل وسريع عبر أكواد الشحن المسبقة أو المحافظ الإلكترونية لشراء الكورسات فوراً.</p>
          </div>
          <div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <h3 class="text-base font-bold text-white">نخبة المعلمين والخبراء</h3>
            <p class="text-xs text-slate-400 leading-relaxed">تعلم على يد كبار معلمي وموجهي المواد المعتمدين مع إتاحة قنوات تواصل وطرح الأسئلة.</p>
          </div>
        </div>
      </section>

      <!-- 6. FAQ Section -->
      <section class="max-w-4xl mx-auto px-4 py-16 border-t border-slate-800/80">
        <div class="text-center space-y-2 mb-10">
          <h2 class="text-2xl sm:text-4xl font-black text-white">الأسئلة الشائعة والاستفسارات</h2>
          <p class="text-xs sm:text-sm text-slate-400">إجابات وافية على كافة استفسارات الطلاب وأولياء الأمور حول المنصة</p>
        </div>
        <div class="space-y-4">
          <article class="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <h3 class="font-black text-base text-white">هل تقتصر منصة خطوتك على التعليم المدرسي فقط؟</h3>
            <p class="text-xs sm:text-sm text-slate-400 leading-relaxed">لا، منصة خطوتك منصة تعليمية متكاملة تتيح لك الالتحاق بكورسات المناهج المدرسية (الإعدادية والثانوية) بالإضافة إلى مجالات البرمجة والتكنولوجيا، التجارة والأعمال، التصميم، واللغات.</p>
          </article>
          <article class="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <h3 class="font-black text-base text-white">كيف يمكنني شحن محفظتي لشراء الكورسات؟</h3>
            <p class="text-xs sm:text-sm text-slate-400 leading-relaxed">يمكنك شحن محفظتك بسهولة من خلال شراء أكواد الشحن المسبقة الدفع من المكاتب المعتمدة أو عن طريق المشرفين، وإدخال الكود في صفحة المحفظة داخل لوحة التحكم لتفعيل رصيدك فوراً.</p>
          </article>
          <article class="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <h3 class="font-black text-base text-white">كيف أتابع نسبة تقدمي ومشاهدة الفيديوهات؟</h3>
            <p class="text-xs sm:text-sm text-slate-400 leading-relaxed">تحتوي المنصة على نظام ذكي يتتبع تقدمك بدقة، ويخزن آخر موضع مشاهدة في الفيديو بالثانية، بحيث يظهر لك زر متابعة المشاهدة للرجوع تلقائياً إلى المحاضرة بنفس الموضع الذي وقفت عنده.</p>
          </article>
        </div>
      </section>

    </main>
    ${renderGlobalFooter()}
  `;
}

function renderCourseDetailPage(course, units = []) {
  const teacher = course.teacher || {};
  const priceDisplay = course.price ? `${course.price} ج.م` : 'مجاناً';

  return `
    ${renderGlobalNav()}
    <main class="w-full text-right" dir="rtl">
      <section class="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
        
        <!-- Breadcrumb -->
        <nav class="text-xs text-slate-400 flex items-center gap-2 mb-6" aria-label="مسار التصفح">
          <a href="/" class="hover:text-white">الرئيسية</a>
          <span>/</span>
          <a href="/courses" class="hover:text-white">الكورسات</a>
          <span>/</span>
          <span class="text-brand-primary font-bold">${escapeHtml(course.title)}</span>
        </nav>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div class="lg:col-span-8 space-y-8">
            <div class="space-y-4">
              <span class="px-3 py-1 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-full text-xs font-bold inline-block">
                ${escapeHtml(course.subject || 'المادة الدراسية')}
              </span>
              <h1 class="text-2xl sm:text-4xl font-black text-white leading-tight">
                ${escapeHtml(course.title)}
              </h1>
              <p class="text-xs sm:text-sm text-slate-400">
                المرحلة الدراسية: <span class="text-white font-bold">${escapeHtml(course.grade || 'المرحلة العامة')}</span>
              </p>
            </div>

            <!-- About the Course -->
            <div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <h2 class="text-lg font-black text-white">تفاصيل ومحتوى الكورس</h2>
              <p class="text-sm text-slate-300 leading-relaxed">
                ${escapeHtml(course.description || 'كورس تعليمي شامل يغطي جميع أجزاء المنهج بأسلوب تدريس حديث وتطبيقات عملية مع اختبارات متابعة أسبوعية.')}
              </p>
            </div>

            <!-- Syllabus / Units -->
            <div class="space-y-4">
              <h2 class="text-xl font-black text-white">منهج ومحتوى المحاضرات</h2>
              ${units.length > 0 ? units.map(u => `
                <div class="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                  <h3 class="text-base font-black text-brand-primary">${escapeHtml(u.title || 'الوحدة الدراسية')}</h3>
                  <ul class="space-y-2 text-xs text-slate-300 pr-4">
                    ${(u.lessons || []).map(l => `
                      <li class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 bg-brand-primary rounded-full"></span>
                        <span>${escapeHtml(l.title)}</span>
                      </li>
                    `).join('')}
                  </ul>
                </div>
              `).join('') : `
                <p class="text-xs text-slate-500">يتضمن الكورس شروحات مكثفة واختبارات وتقييمات تفاعلية مستمرة.</p>
              `}
            </div>
          </div>

          <!-- Sidebar -->
          <div class="lg:col-span-4 space-y-6">
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
              <img src="${course.cover_image || '/og-image.jpg'}" alt="غلاف كورس ${escapeHtml(course.title)}" class="w-full aspect-video rounded-2xl object-cover" />
              
              <div class="flex items-baseline justify-between border-b border-slate-800 pb-4">
                <span class="text-xs text-slate-400">سعر الاشتراك:</span>
                <span class="text-2xl font-black text-white">${priceDisplay}</span>
              </div>

              <div class="space-y-3 pt-2">
                <a href="/login" class="block w-full py-3.5 bg-brand-primary hover:bg-brand-primary/90 text-white text-center rounded-xl font-bold text-sm shadow-lg shadow-brand-primary/20 transition-all">
                  اشترك الآن في الكورس
                </a>
              </div>

              ${teacher.name ? `
                <div class="pt-4 border-t border-slate-800 flex items-center gap-3">
                  <img src="${teacher.avatar || '/og-image.jpg'}" alt="صورة المعلم ${escapeHtml(teacher.name)}" class="w-12 h-12 rounded-full object-cover border border-slate-700" />
                  <div>
                    <span class="text-[11px] text-slate-400 block">المعلم:</span>
                    <a href="/teacher/${encodeURIComponent(String(teacher.slug || teacher.id))}" class="text-sm font-bold text-white hover:text-brand-primary transition-colors">
                      ${escapeHtml(teacher.name)}
                    </a>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

      </section>
    </main>
    ${renderGlobalFooter()}
  `;
}

function renderTeacherProfilePage(teacher, teacherCourses = []) {
  return `
    ${renderGlobalNav()}
    <main class="w-full text-right" dir="rtl">
      <section class="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
        
        <!-- Breadcrumb -->
        <nav class="text-xs text-slate-400 flex items-center gap-2 mb-6" aria-label="مسار التصفح">
          <a href="/" class="hover:text-white">الرئيسية</a>
          <span>/</span>
          <a href="/teachers" class="hover:text-white">المعلمون</a>
          <span>/</span>
          <span class="text-brand-primary font-bold">${escapeHtml(teacher.name)}</span>
        </nav>

        <div class="bg-slate-900 border border-slate-800 rounded-3xl p-8 mb-12">
          <div class="flex flex-col sm:flex-row items-center gap-6">
            <img src="${teacher.avatar || '/og-image.jpg'}" alt="صورة المعلم ${escapeHtml(teacher.name)}" class="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-brand-primary/20" />
            <div class="space-y-2 text-center sm:text-right">
              <span class="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-xs font-bold inline-block">
                مدرس ${escapeHtml(teacher.subject || 'المادة')}
              </span>
              <h1 class="text-2xl sm:text-4xl font-black text-white">الأستاذ ${escapeHtml(teacher.name)}</h1>
              <p class="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                ${escapeHtml(teacher.bio || teacher.experience || 'أحد أبرز المعلمين والخبراء المعتمدين على منصة خطوتك التعليمية.')}
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <h2 class="text-xl sm:text-2xl font-black text-white">الكورسات والمحاضرات المتاحة للمعلم</h2>
          ${teacherCourses.length > 0 ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              ${teacherCourses.map(c => `
                <article class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-brand-primary/40 transition-all">
                  <a href="/course/${c.slug || c.id}" class="block aspect-video bg-slate-800">
                    <img src="${c.cover_image || '/og-image.jpg'}" alt="غلاف كورس ${escapeHtml(c.title)}" class="w-full h-full object-cover" />
                  </a>
                  <div class="p-5 space-y-2">
                    <h3 class="font-bold text-base text-white">
                      <a href="/course/${c.slug || c.id}" class="hover:text-brand-primary">${escapeHtml(c.title)}</a>
                    </h3>
                    <p class="text-xs text-slate-400 line-clamp-2">${escapeHtml(c.description || '')}</p>
                    <a href="/course/${c.slug || c.id}" class="inline-block pt-2 text-xs font-bold text-brand-primary">عرض تفاصيل الكورس &larr;</a>
                  </div>
                </article>
              `).join('')}
            </div>
          ` : `
            <p class="text-xs text-slate-500">لا توجد كورسات معروضة حالياً لهذا المعلم.</p>
          `}
        </div>

      </section>
    </main>
    ${renderGlobalFooter()}
  `;
}

function injectIntoHtml(templateHtml, options) {
  const { title, description, canonicalUrl, ogType = 'website', ogImage = '/og-image.jpg', schemaJson, bodyContent } = options;

  let html = templateHtml;

  // Replace Title
  const titleTag = `<title>${escapeHtml(title)}</title>`;
  html = html.replace(/<title>.*?<\/title>/i, titleTag);

  // Replace or inject Description
  const descMeta = `<meta name="description" content="${escapeHtml(description)}" />`;
  if (html.includes('name="description"')) {
    html = html.replace(/<meta name="description" content=".*?" \/>/i, descMeta);
  } else {
    html = html.replace('</head>', `  ${descMeta}\n  </head>`);
  }

  // Replace or inject Canonical URL
  const canonicalTag = `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`;
  if (html.includes('rel="canonical"')) {
    html = html.replace(/<link rel="canonical" href=".*?" \/>/i, canonicalTag);
  } else {
    html = html.replace('</head>', `  ${canonicalTag}\n  </head>`);
  }

  // Replace og:title & og:description & og:url
  html = html.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = html.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
  html = html.replace(/<meta property="og:type" content=".*?" \/>/i, `<meta property="og:type" content="${escapeHtml(ogType)}" />`);
  if (ogImage) {
    const fullImg = ogImage.startsWith('http') ? ogImage : `${HOST}${ogImage}`;
    html = html.replace(/<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${escapeHtml(fullImg)}" />`);
  }

  // Replace twitter tags
  html = html.replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);

  // Inject Schema JSON-LD if provided
  if (schemaJson) {
    const scriptTag = `\n    <script type="application/ld+json" data-schema="seo">\n${JSON.stringify(schemaJson, null, 2)}\n    </script>\n`;
    html = html.replace('</head>', `${scriptTag}  </head>`);
  }

  // Inject bodyContent into <div id="root"></div>
  if (bodyContent) {
    html = html.replace('<div id="root"></div>', `<div id="root">${bodyContent}</div>`);
  }

  return html;
}

function writePage(distDir, routePath, htmlContent) {
  let targetPath;
  if (routePath === '' || routePath === '/') {
    targetPath = path.join(distDir, 'index.html');
  } else {
    const cleanRoute = routePath.replace(/^\//, '');
    const dir = path.join(distDir, cleanRoute);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    targetPath = path.join(dir, 'index.html');
  }

  fs.writeFileSync(targetPath, htmlContent, 'utf8');
}

async function runPrerender() {
  console.log('[Prerender] Starting build-time static HTML generation for Vercel/SEO...');
  const distDir = path.resolve(__dirname, '../dist');
  const templatePath = path.join(distDir, 'index.html');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`[Prerender] Template index.html not found at: ${templatePath}`);
  }

  const baseHtml = fs.readFileSync(templatePath, 'utf8');
  const platformData = await getPlatformData();
  const { teachers, courses } = platformData;

  console.log(`[Prerender] Fetched platform data: ${courses.length} courses, ${teachers.length} teachers.`);

  // 1. Homepage (/)
  const homeSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": `${HOST}/#organization`,
        "name": "منصة خطوتك التعليمية",
        "url": HOST,
        "logo": `${HOST}/favicon.ico`,
        "description": "منصة تعليمية متكاملة لطلاب المراحل المدرسية ومجالات التكنولوجيا والأعمال واللغات."
      },
      {
        "@type": "WebSite",
        "@id": `${HOST}/#website`,
        "url": HOST,
        "name": "منصة خطوتك",
        "publisher": { "@id": `${HOST}/#organization` }
      }
    ]
  };

  const homeHtml = injectIntoHtml(baseHtml, {
    title: 'خطوتك | أول خطوة في طريق نجاحك',
    description: 'خطوتك هي منصتك التعليمية المتكاملة نحو التفوق والنجاح. محاضرات تفاعلية، اختبارات دورية، ومتابعة ذكية مع نخبة كبار المعلمين والخبراء في مصر والوطن العربي.',
    canonicalUrl: `${HOST}/`,
    ogType: 'website',
    schemaJson: homeSchema,
    bodyContent: renderHomePage(platformData)
  });
  writePage(distDir, '/', homeHtml);
  console.log('[Prerender] Generated Homepage -> dist/index.html');

  // 2. Courses Catalog (/courses)
  const coursesCatalogContent = `
    ${renderGlobalNav()}
    <main class="w-full text-right max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16" dir="rtl">
      <div class="mb-8">
        <h1 class="text-3xl sm:text-5xl font-black text-white">كورسات ومراجعات المنصة</h1>
        <p class="text-xs sm:text-sm text-slate-400 mt-2">تصفح أقوى الكورسات والشروحات في مختلف المواد والمجالات مع نخبة المعلمين</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        ${courses.map(c => `
          <article class="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-brand-primary/40 transition-all flex flex-col justify-between">
            <a href="/course/${c.slug || c.id}" class="block aspect-video bg-slate-800">
              <img src="${c.cover_image || '/og-image.jpg'}" alt="غلاف كورس ${escapeHtml(c.title)}" class="w-full h-full object-cover" />
            </a>
            <div class="p-5 space-y-3">
              <span class="text-xs font-bold text-brand-primary block">${escapeHtml(c.subject || 'المادة')}</span>
              <h2 class="font-black text-lg text-white">
                <a href="/course/${c.slug || c.id}" class="hover:text-brand-primary">${escapeHtml(c.title)}</a>
              </h2>
              <p class="text-xs text-slate-400 line-clamp-2">${escapeHtml(c.description || '')}</p>
            </div>
            <div class="p-5 pt-0 border-t border-slate-800/60 flex items-center justify-between mt-4">
              <span class="text-sm font-black text-white">${c.price ? `${c.price} ج.م` : 'مجاناً'}</span>
              <a href="/course/${c.slug || c.id}" class="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">عرض الكورس</a>
            </div>
          </article>
        `).join('')}
      </div>
    </main>
    ${renderGlobalFooter()}
  `;
  const coursesSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "كورسات ومراجعات منصة خطوتك التعليمية",
    "description": "قائمة الكورسات والمحاضرات التعليمية المتاحة على منصة خطوتك",
    "itemListElement": courses.map((c, idx) => ({
      "@type": "ListItem",
      "position": idx + 1,
      "url": `${HOST}/course/${encodeURIComponent(String(c.slug || c.id))}`,
      "name": c.title
    }))
  };

  const coursesHtml = injectIntoHtml(baseHtml, {
    title: 'كورسات ومراجعات المنصة | منصة خطوتك',
    description: 'تصفح أقوى الكورسات التعليمية والمراجعات الشاملة لجميع المراحل المدرسية ومجالات التكنولوجيا والأعمال واللغات على منصة خطوتك.',
    canonicalUrl: `${HOST}/courses`,
    schemaJson: coursesSchema,
    bodyContent: coursesCatalogContent
  });
  writePage(distDir, '/courses', coursesHtml);
  console.log('[Prerender] Generated Courses Catalog -> dist/courses/index.html');

  // 3. Teachers Catalog (/teachers)
  const teachersCatalogContent = `
    ${renderGlobalNav()}
    <main class="w-full text-right max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16" dir="rtl">
      <div class="mb-8">
        <h1 class="text-3xl sm:text-5xl font-black text-white">نخبة المعلمين والخبراء</h1>
        <p class="text-xs sm:text-sm text-slate-400 mt-2">تعرف على الكوادر التعليمية المعتمدة وشروحاتهم ومؤهلاتهم في مختلف التخصصات</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        ${teachers.map(t => `
          <article class="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center hover:border-brand-primary/40 transition-all space-y-3">
            <a href="/teacher/${encodeURIComponent(String(t.slug || t.id))}" class="block w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-brand-primary/30">
              <img src="${t.avatar || '/og-image.jpg'}" alt="صورة المعلم ${escapeHtml(t.name)}" class="w-full h-full object-cover" />
            </a>
            <h2 class="font-black text-base text-white">
              <a href="/teacher/${encodeURIComponent(String(t.slug || t.id))}" class="hover:text-brand-primary">${escapeHtml(t.name)}</a>
            </h2>
            <p class="text-xs text-brand-primary font-bold">مدرس ${escapeHtml(t.subject || 'المادة')}</p>
            <p class="text-xs text-slate-400 line-clamp-2">${escapeHtml(t.bio || t.experience || '')}</p>
            <a href="/teacher/${encodeURIComponent(String(t.slug || t.id))}" class="inline-block px-4 py-1.5 bg-slate-800 hover:bg-brand-primary text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all">
              الملف الشخصي
            </a>
          </article>
        `).join('')}
      </div>
    </main>
    ${renderGlobalFooter()}
  `;
  const teachersSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "نخبة المعلمين والخبراء على منصة خطوتك",
    "description": "دليل المعلمين والمدربين المعتمدين على منصة خطوتك",
    "itemListElement": teachers.map((t, idx) => ({
      "@type": "ListItem",
      "position": idx + 1,
      "url": `${HOST}/teacher/${encodeURIComponent(String(t.slug || t.id))}`,
      "name": t.name
    }))
  };

  const teachersHtml = injectIntoHtml(baseHtml, {
    title: 'نخبة المعلمين والخبراء | منصة خطوتك',
    description: 'دليل نخبة المعلمين والخبراء المعتمدين على منصة خطوتك. تصفح ملفاتهم الشخصية والمواد التي يدرسونها وكورساتهم المتاحة.',
    canonicalUrl: `${HOST}/teachers`,
    schemaJson: teachersSchema,
    bodyContent: teachersCatalogContent
  });
  writePage(distDir, '/teachers', teachersHtml);
  console.log('[Prerender] Generated Teachers Catalog -> dist/teachers/index.html');

  // 4. Individual Course Pages
  for (const c of courses) {
    let units = [];
    try {
      const detail = await fetchJSON(`http://127.0.0.1:8000/api/courses/${c.id}`);
      units = detail?.units || [];
    } catch (e) {
      try {
        const detail = await fetchJSON(`${API_URL}/courses/${c.id}`);
        units = detail?.units || [];
      } catch (err) {}
    }

    const courseCanonical = `${HOST}/course/${encodeURIComponent(String(c.slug || c.id))}`;
    const courseSchema = {
      "@context": "https://schema.org",
      "@type": "Course",
      "name": c.title,
      "description": c.description || `كورس ${c.title} على منصة خطوتك التعليمية`,
      "provider": {
        "@type": "Organization",
        "name": "منصة خطوتك",
        "sameAs": HOST
      },
      "instructor": {
        "@type": "Person",
        "name": c.teacher?.name || "معلم منصة خطوتك"
      },
      "offers": {
        "@type": "Offer",
        "price": c.price || "0",
        "priceCurrency": "EGP",
        "availability": "https://schema.org/InStock"
      }
    };

    const courseHtml = injectIntoHtml(baseHtml, {
      title: `${c.title} | منصة خطوتك`,
      description: c.description || `سجل الآن في كورس ${c.title} مع ${c.teacher?.name || 'نخبة المعلمين'} على منصة خطوتك. شروحات واختبارات تفاعلية مستمرة.`,
      canonicalUrl: courseCanonical,
      ogType: 'article',
      ogImage: c.cover_image,
      schemaJson: courseSchema,
      bodyContent: renderCourseDetailPage(c, units)
    });

    writePage(distDir, `/course/${c.id}`, courseHtml);
    if (c.slug && String(c.slug) !== String(c.id)) {
      writePage(distDir, `/course/${c.slug}`, courseHtml);
    }
    console.log(`[Prerender] Generated Course Page -> /course/${c.id}`);
  }

  // 5. Individual Teacher Pages
  for (const t of teachers) {
    const slug = t.slug || t.id;
    const teacherCanonical = `${HOST}/teacher/${encodeURIComponent(String(slug))}`;
    const teacherCourses = courses.filter(c => c.teacher?.name === t.name || c.teacher_id === t.id);

    const teacherSchema = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": t.name,
      "jobTitle": `مدرس ${t.subject || 'المادة'}`,
      "description": t.bio || t.experience || `الأستاذ ${t.name} مدرس ${t.subject || 'المادة'} على منصة خطوتك`,
      "url": teacherCanonical
    };

    const teacherHtml = injectIntoHtml(baseHtml, {
      title: `الأستاذ ${t.name} | منصة خطوتك`,
      description: `تعرف على الأستاذ ${t.name}، مدرس ${t.subject || 'المادة'} على منصة خطوتك. تصفح الكورسات والمحاضرات المتاحة وسجل مع معلمك فوراً.`,
      canonicalUrl: teacherCanonical,
      ogType: 'profile',
      ogImage: t.avatar,
      schemaJson: teacherSchema,
      bodyContent: renderTeacherProfilePage(t, teacherCourses)
    });

    writePage(distDir, `/teacher/${t.id}`, teacherHtml);
    if (t.slug && String(t.slug) !== String(t.id)) {
      writePage(distDir, `/teacher/${t.slug}`, teacherHtml);
    }
    console.log(`[Prerender] Generated Teacher Page -> /teacher/${slug}`);
  }

  // 6. Monthly Exams Catalog (/monthly-exams & /exams)
  const examsContent = `
    ${renderGlobalNav()}
    <main class="w-full text-right max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16" dir="rtl">
      <div class="mb-8">
        <h1 class="text-3xl sm:text-5xl font-black text-white">الامتحانات الشهرية والتقييمات التفاعلية</h1>
        <p class="text-xs sm:text-sm text-slate-400 mt-2">اختبر مستواك مع بنك الامتحانات الشهرية الإلكترونية وتعرف على درجتك وتصحيح إجاباتك فوراً</p>
      </div>
      <div class="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4">
        <h2 class="text-xl font-bold text-white">بنك الامتحانات الإلكترونية</h2>
        <p class="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
          توفر منصة خطوتك نظام امتحانات ذكي مع حماية ضد الغش ورصد دقيق لزمن الإجابة وتصحيح فوري لأسئلة الاختيار من متعدد مع مراجعة المعلم للأسئلة المقالية.
        </p>
        <div class="pt-4">
          <a href="/login" class="px-6 py-3 bg-brand-primary text-white rounded-xl text-sm font-bold shadow-md hover:bg-brand-primary/90 transition-all">
            سجل دخولك لبدء الامتحان
          </a>
        </div>
      </div>
    </main>
    ${renderGlobalFooter()}
  `;
  const examsHtml = injectIntoHtml(baseHtml, {
    title: 'الامتحانات الشهرية والتقييمات | منصة خطوتك',
    description: 'امتحانات إلكترونية دورية وتقييمات تفاعلية لطلاب المراحل الثانوية والإعدادية على منصة خطوتك مع تصحيح فوري.',
    canonicalUrl: `${HOST}/monthly-exams`,
    bodyContent: examsContent
  });
  writePage(distDir, '/monthly-exams', examsHtml);
  writePage(distDir, '/exams', examsHtml);
  console.log('[Prerender] Generated Monthly Exams -> dist/monthly-exams/index.html');

  // 7. Core Subject & Grade Landing Pages
  const landingPages = [
    { route: '/chemistry', title: 'كورسات مادة الكيمياء | منصة خطوتك', desc: 'أقوى كورسات وشروحات مادة الكيمياء للمرحلة الثانوية مع كبار الأساتذة والموجهين.' },
    { route: '/physics', title: 'كورسات مادة الفيزياء | منصة خطوتك', desc: 'أقوى كورسات وشروحات مادة الفيزياء للمرحلة الثانوية مع كبار الأساتذة والموجهين.' },
    { route: '/arabic', title: 'كورسات اللغة العربية | منصة خطوتك', desc: 'شروحات النحو والبلاغة والأدب للثانوية العامة مع نخبة أساتذة اللغة العربية.' },
    { route: '/grade-1-secondary', title: 'كورسات الصف الأول الثانوي | منصة خطوتك', desc: 'شروحات وامتحانات جميع مواد الصف الأول الثانوي على منصة خطوتك.' },
    { route: '/grade-2-secondary', title: 'كورسات الصف الثاني الثانوي | منصة خطوتك', desc: 'شروحات وامتحانات جميع مواد الصف الثاني الثانوي على منصة خطوتك.' },
    { route: '/grade-3-secondary', title: 'كورسات الصف الثالث الثانوي (الثانوية العامة) | منصة خطوتك', desc: 'أقوى المراجعات والكورسات التأسيسية لطلاب الثانوية العامة في مصر.' },
    { route: '/login', title: 'تسجيل الدخول | منصة خطوتك', desc: 'تسجيل دخول الطلاب والمعلمين إلى لوحة التحكم بمنصة خطوتك التعليمية.' },
    { route: '/register', title: 'إنشاء حساب جديد | منصة خطوتك', desc: 'أنشئ حسابك كطالب مجاناً على منصة خطوتك وابدأ رحلتك التعليمية نحو التفوق.' },
  ];

  for (const lp of landingPages) {
    const lpHtml = injectIntoHtml(baseHtml, {
      title: lp.title,
      description: lp.desc,
      canonicalUrl: `${HOST}${lp.route}`,
      bodyContent: `
        ${renderGlobalNav()}
        <main class="w-full text-right max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16" dir="rtl">
          <h1 class="text-3xl sm:text-5xl font-black text-white mb-4">${escapeHtml(lp.title.split('|')[0].trim())}</h1>
          <p class="text-sm text-slate-300 leading-relaxed max-w-2xl mb-8">${escapeHtml(lp.desc)}</p>
          <div class="flex gap-4">
            <a href="/courses" class="px-6 py-3 bg-brand-primary text-white rounded-xl text-sm font-bold">تصفح الكورسات</a>
            <a href="/register" class="px-6 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold">حساب جديد</a>
          </div>
        </main>
        ${renderGlobalFooter()}
      `
    });
    writePage(distDir, lp.route, lpHtml);
    console.log(`[Prerender] Generated Landing Page -> ${lp.route}`);
  }

  console.log('[Prerender] All public static pages pre-rendered successfully for Vercel and SEO crawlers!');
}

runPrerender().catch((err) => {
  console.error('[Prerender] Fatal error during static prerendering:', err);
  process.exit(1);
});
