export interface CategoryDefinition {
  key: string
  name: string
  iconName: string
  description: string
  badge: string
  specializations: { key: string; name: string }[]
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    key: 'school',
    name: 'التعليم المدرسي',
    iconName: 'GraduationCap',
    description: 'شروحات المناهج الدراسية لجميع مراحل الثانوية والإعدادية',
    badge: 'التعليم الأكاديمي',
    specializations: [
      { key: 'chemistry', name: 'الكيمياء' },
      { key: 'physics', name: 'الفيزياء' },
      { key: 'integrated_science', name: 'علوم متكاملة' },
      { key: 'biology', name: 'الأحياء' },
      { key: 'math', name: 'الرياضيات' },
      { key: 'science', name: 'العلوم' },
      { key: 'arabic', name: 'اللغة العربية' },
      { key: 'english', name: 'اللغة الإنجليزية' },
    ]
  },
  {
    key: 'programming',
    name: 'البرمجة والتكنولوجيا',
    iconName: 'Code',
    description: 'تعلم تطوير المواقع، التطبيقات، الذكاء الاصطناعي والأمن السيبراني',
    badge: 'تقنية وتطوير',
    specializations: [
      { key: 'web_dev', name: 'تطوير المواقع (Web Dev)' },
      { key: 'frontend', name: 'تطوير الواجهات (Frontend)' },
      { key: 'backend', name: 'تطوير الخلفيات (Backend)' },
      { key: 'mobile_dev', name: 'تطبيقات الموبايل (Flutter/React Native)' },
      { key: 'python_ai', name: 'بايثون والذكاء الاصطناعي' },
      { key: 'cybersecurity', name: 'الأمن السيبراني' },
    ]
  },
  {
    key: 'business',
    name: 'التجارة والأعمال',
    iconName: 'TrendingUp',
    description: 'إدارة المشاريع، التجارة الإلكترونية، التسويق والمحاسبة',
    badge: 'أعمال واستثمار',
    specializations: [
      { key: 'ecommerce', name: 'التجارة الإلكترونية' },
      { key: 'project_mgmt', name: 'إدارة المشاريع' },
      { key: 'accounting', name: 'المحاسبة والإدارة المالية' },
      { key: 'entrepreneurship', name: 'ريادة الأعمال' },
    ]
  },
  {
    key: 'design',
    name: 'التصميم والإبداع',
    iconName: 'Palette',
    description: 'تصميم الواجهات UI/UX، الجرافيك، المونتاج والموشن جرافيك',
    badge: 'فنون وتصميم',
    specializations: [
      { key: 'ui_ux', name: 'تصميم واجهات المستخدم (UI/UX)' },
      { key: 'graphic_design', name: 'التصميم الجرافيكي' },
      { key: 'motion_graphics', name: 'المونتاج والموشن جرافيك' },
      { key: '3d_modeling', name: 'النمذجة ثلاثية الأبعاد' },
    ]
  },
  {
    key: 'languages',
    name: 'اللغات والترجمة',
    iconName: 'Globe',
    description: 'تطوير مهارات المحادثة بالإنجليزية، الألمانية، الفرنسية واختبارات الآيلتس',
    badge: 'لغات عالمية',
    specializations: [
      { key: 'english_business', name: 'الإنجليزية للأعمال' },
      { key: 'german', name: 'اللغة الألمانية' },
      { key: 'french', name: 'اللغة الفرنسية' },
      { key: 'ielts_toefl', name: 'تحضير الآيلتس والتوفل' },
    ]
  },
  {
    key: 'marketing',
    name: 'التسويق الرقمي',
    iconName: 'Share2',
    description: 'إعلانات السوشيال ميديا، تحسين محركات البحث SEO وصناعة المحتوى',
    badge: 'تسويق ونمو',
    specializations: [
      { key: 'social_media', name: 'التسويق عبر السوشيال ميديا' },
      { key: 'seo', name: 'سيو وتحسين محركات البحث' },
      { key: 'digital_ads', name: 'الإعلانات الممولة' },
    ]
  },
  {
    key: 'skills',
    name: 'المهارات المهنية',
    iconName: 'Briefcase',
    description: 'مهارات التواصل، العمل الحر، الإلقاء وإدارة الوقت',
    badge: 'تطوير ذاتي',
    specializations: [
      { key: 'freelancing', name: 'العمل الحر (Freelancing)' },
      { key: 'soft_skills', name: 'مهارات التواصل' },
      { key: 'public_speaking', name: 'الإلقاء والخطابة' },
    ]
  }
]

export const CategoriesConfig = {
  CATEGORIES,
  getCategoryByKey(key: string): CategoryDefinition | undefined {
    return CATEGORIES.find(c => c.key === key)
  },
  getCategoryName(key?: string): string {
    if (!key || key === 'school' || key === 'general_education') return 'التعليم المدرسي'
    const cat = CATEGORIES.find(c => c.key === key)
    return cat ? cat.name : key
  }
}
