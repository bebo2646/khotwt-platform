import { create } from 'zustand'
import API from '../services/api'

export interface Department {
  id: number
  name: string
  slug: string
  description?: string
  icon?: string
  badge?: string
  order: number
  is_active: boolean
  courses_count?: number
  teachers_count?: number
}

export interface AcademicStage {
  id: number
  name: string
  slug: string
  order: number
  is_active: boolean
  grades?: AcademicGrade[]
  active_grades?: AcademicGrade[]
}

export interface AcademicGrade {
  id: number
  stage_id: number
  name: string
  slug: string
  short_code?: string
  order: number
  is_active: boolean
  stage?: AcademicStage
}

interface TaxonomyState {
  departments: Department[]
  stages: AcademicStage[]
  grades: AcademicGrade[]
  isLoading: boolean
  isLoaded: boolean
  fetchTaxonomy: (force?: boolean) => Promise<void>
  getDepartment: (slug?: string) => Department | undefined
  getDepartmentName: (slug?: string) => string
  getGrade: (slug?: string) => AcademicGrade | undefined
  getGradeName: (slug?: string) => string
  getStage: (slug?: string) => AcademicStage | undefined
  getStageName: (slug?: string) => string
  getGradesForStage: (stageSlugOrId: string | number) => AcademicGrade[]
}

const FALLBACK_DEPARTMENTS: Department[] = [
  {
    id: 1,
    name: 'التعليم المدرسي',
    slug: 'school',
    description: 'شروحات ومناهج دراسية متكاملة لجميع المراحل التعليمية مع نخبة من أفضل المعلمين',
    icon: 'GraduationCap',
    badge: 'التعليم الأكاديمي',
    order: 1,
    is_active: true
  },
  {
    id: 2,
    name: 'البرمجة والتكنولوجيا',
    slug: 'programming',
    description: 'تعلم تطوير المواقع، التطبيقات، الذكاء الاصطناعي، قواعد البيانات والأمن السيبراني',
    icon: 'Code',
    badge: 'تقنية وتطوير',
    order: 2,
    is_active: true
  },
  {
    id: 3,
    name: 'التجارة والأعمال',
    slug: 'business',
    description: 'إدارة المشاريع، التجارة الإلكترونية، التسويق، المحاسبة وريادة الأعمال',
    icon: 'TrendingUp',
    badge: 'أعمال واستثمار',
    order: 3,
    is_active: true
  },
  {
    id: 4,
    name: 'التصميم والإبداع',
    slug: 'design',
    description: 'تصميم الواجهات وتجربة المستخدم UI/UX، الجرافيك، المونتاج والموشن جرافيك',
    icon: 'Palette',
    badge: 'فنون وتصميم',
    order: 4,
    is_active: true
  },
  {
    id: 5,
    name: 'اللغات والترجمة',
    slug: 'languages',
    description: 'تطوير مهارات المحادثة واللغات الإنجليزية، الألمانية، الفرنسية واختبارات الآيلتس والتوفل',
    icon: 'Globe',
    badge: 'لغات عالمية',
    order: 5,
    is_active: true
  },
  {
    id: 6,
    name: 'التسويق الرقمي',
    slug: 'marketing',
    description: 'إعلانات السوشيال ميديا، تحسين محركات البحث SEO، وصناعة وإدارة المحتوى الرقمي',
    icon: 'Share2',
    badge: 'تسويق ونمو',
    order: 6,
    is_active: true
  },
  {
    id: 7,
    name: 'المهارات المهنية',
    slug: 'skills',
    description: 'مهارات التواصل، العمل الحر، القيادة، الإلقاء وإدارة الوقت وبناء السيرة الذاتية',
    icon: 'Briefcase',
    badge: 'تطوير ذاتي',
    order: 7,
    is_active: true
  }
]

const FALLBACK_STAGES: AcademicStage[] = [
  { id: 1, name: 'المرحلة الابتدائية', slug: 'primary', order: 1, is_active: true },
  { id: 2, name: 'المرحلة الإعدادية', slug: 'preparatory', order: 2, is_active: true },
  { id: 3, name: 'المرحلة الثانوية', slug: 'secondary', order: 3, is_active: true }
]

const FALLBACK_GRADES: AcademicGrade[] = [
  { id: 1, stage_id: 1, name: 'الصف الأول الابتدائي', slug: 'first_primary', short_code: '١ب', order: 1, is_active: true },
  { id: 2, stage_id: 1, name: 'الصف الثاني الابتدائي', slug: 'second_primary', short_code: '٢ب', order: 2, is_active: true },
  { id: 3, stage_id: 1, name: 'الصف الثالث الابتدائي', slug: 'third_primary', short_code: '٣ب', order: 3, is_active: true },
  { id: 4, stage_id: 1, name: 'الصف الرابع الابتدائي', slug: 'fourth_primary', short_code: '٤ب', order: 4, is_active: true },
  { id: 5, stage_id: 1, name: 'الصف الخامس الابتدائي', slug: 'fifth_primary', short_code: '٥ب', order: 5, is_active: true },
  { id: 6, stage_id: 1, name: 'الصف السادس الابتدائي', slug: 'sixth_primary', short_code: '٦ب', order: 6, is_active: true },
  { id: 7, stage_id: 2, name: 'الصف الأول الإعدادي', slug: 'first_preparatory', short_code: '١إ', order: 1, is_active: true },
  { id: 8, stage_id: 2, name: 'الصف الثاني الإعدادي', slug: 'second_preparatory', short_code: '٢إ', order: 2, is_active: true },
  { id: 9, stage_id: 2, name: 'الصف الثالث الإعدادي', slug: 'third_preparatory', short_code: '٣إ', order: 3, is_active: true },
  { id: 10, stage_id: 3, name: 'الصف الأول الثانوي', slug: 'first_secondary', short_code: '١ث', order: 1, is_active: true },
  { id: 11, stage_id: 3, name: 'الصف الثاني الثانوي', slug: 'second_secondary', short_code: '٢ث', order: 2, is_active: true },
  { id: 12, stage_id: 3, name: 'الصف الثالث الثانوي', slug: 'third_secondary', short_code: '٣ث', order: 3, is_active: true },
]

export const useTaxonomyStore = create<TaxonomyState>((set, get) => ({
  departments: FALLBACK_DEPARTMENTS,
  stages: FALLBACK_STAGES,
  grades: FALLBACK_GRADES,
  isLoading: false,
  isLoaded: false,

  fetchTaxonomy: async (force = false) => {
    const state = get()
    if (state.isLoaded && !force) return

    set({ isLoading: true })
    try {
      const res = await API.get('/taxonomy')
      const data = res.data
      set({
        departments: Array.isArray(data.departments) && data.departments.length > 0 ? data.departments : FALLBACK_DEPARTMENTS,
        stages: Array.isArray(data.stages) && data.stages.length > 0 ? data.stages : FALLBACK_STAGES,
        grades: Array.isArray(data.grades) && data.grades.length > 0 ? data.grades : FALLBACK_GRADES,
        isLoading: false,
        isLoaded: true
      })
    } catch (err) {
      console.error('Failed to fetch taxonomy from backend:', err)
      set({ isLoading: false, isLoaded: true })
    }
  },

  getDepartment: (slug?: string) => {
    if (!slug) return undefined
    const { departments } = get()
    if (slug === 'general_education') slug = 'school'
    return departments.find(d => d.slug === slug)
  },

  getDepartmentName: (slug?: string) => {
    if (!slug || slug === 'school' || slug === 'general_education') return 'التعليم المدرسي'
    const { departments } = get()
    const found = departments.find(d => d.slug === slug)
    return found ? found.name : slug
  },

  getGrade: (slug?: string) => {
    if (!slug) return undefined
    const { grades } = get()
    return grades.find(g => g.slug === slug)
  },

  getGradeName: (slug?: string) => {
    if (!slug) return ''
    const { grades } = get()
    const found = grades.find(g => g.slug === slug)
    if (found) return found.name

    // Common fallback mappings
    const fallbacks: Record<string, string> = {
      first_primary: 'الصف الأول الابتدائي',
      second_primary: 'الصف الثاني الابتدائي',
      third_primary: 'الصف الثالث الابتدائي',
      fourth_primary: 'الصف الرابع الابتدائي',
      fifth_primary: 'الصف الخامس الابتدائي',
      sixth_primary: 'الصف السادس الابتدائي',
      first_preparatory: 'الصف الأول الإعدادي',
      second_preparatory: 'الصف الثاني الإعدادي',
      third_preparatory: 'الصف الثالث الإعدادي',
      first_secondary: 'الصف الأول الثانوي',
      second_secondary: 'الصف الثاني الثانوي',
      third_secondary: 'الصف الثالث الثانوي',
    }
    return fallbacks[slug] || slug
  },

  getStage: (slug?: string) => {
    if (!slug) return undefined
    const { stages } = get()
    return stages.find(s => s.slug === slug)
  },

  getStageName: (slug?: string) => {
    if (!slug) return ''
    const { stages } = get()
    const found = stages.find(s => s.slug === slug)
    if (found) return found.name
    const fallbacks: Record<string, string> = {
      primary: 'المرحلة الابتدائية',
      preparatory: 'المرحلة الإعدادية',
      secondary: 'المرحلة الثانوية',
    }
    return fallbacks[slug] || slug
  },

  getGradesForStage: (stageSlugOrId: string | number) => {
    const { stages, grades } = get()
    let stageId: number | undefined

    if (typeof stageSlugOrId === 'number') {
      stageId = stageSlugOrId
    } else {
      const stage = stages.find(s => s.slug === stageSlugOrId)
      stageId = stage?.id
    }

    if (stageId) {
      return grades.filter(g => g.stage_id === stageId && g.is_active)
    }

    return grades.filter(g => g.is_active)
  }
}))
