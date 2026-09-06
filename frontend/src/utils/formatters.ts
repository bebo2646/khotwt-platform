/**
 * Centralized formatting and translation utilities for Khotwt Platform.
 * Converts raw backend enum/slug values (e.g. 'third_secondary', 'first_prep', 'physics')
 * into user-facing Arabic labels.
 */

import { useTaxonomyStore } from '../store/taxonomyStore'

export const GRADE_LABELS: Record<string, string> = {
  // Secondary Stage (المرحلة الثانوية)
  third_secondary: 'الصف الثالث الثانوي',
  third_sec: 'الصف الثالث الثانوي',
  '3rd_secondary': 'الصف الثالث الثانوي',
  '3_secondary': 'الصف الثالث الثانوي',
  sec_3: 'الصف الثالث الثانوي',
  secondary_3: 'الصف الثالث الثانوي',

  second_secondary: 'الصف الثاني الثانوي',
  second_sec: 'الصف الثاني الثانوي',
  '2nd_secondary': 'الصف الثاني الثانوي',
  '2_secondary': 'الصف الثاني الثانوي',
  sec_2: 'الصف الثاني الثانوي',
  secondary_2: 'الصف الثاني الثانوي',

  first_secondary: 'الصف الأول الثانوي',
  first_sec: 'الصف الأول الثانوي',
  '1st_secondary': 'الصف الأول الثانوي',
  '1_secondary': 'الصف الأول الثانوي',
  sec_1: 'الصف الأول الثانوي',
  secondary_1: 'الصف الأول الثانوي',

  secondary: 'المرحلة الثانوية',

  // Preparatory Stage (المرحلة الإعدادية)
  third_preparatory: 'الصف الثالث الإعدادي',
  third_prep: 'الصف الثالث الإعدادي',
  '3rd_prep': 'الصف الثالث الإعدادي',
  '3_prep': 'الصف الثالث الإعدادي',
  prep_3: 'الصف الثالث الإعدادي',

  second_preparatory: 'الصف الثاني الإعدادي',
  second_prep: 'الصف الثاني الإعدادي',
  '2nd_prep': 'الصف الثاني الإعدادي',
  '2_prep': 'الصف الثاني الإعدادي',
  prep_2: 'الصف الثاني الإعدادي',

  first_preparatory: 'الصف الأول الإعدادي',
  first_prep: 'الصف الأول الإعدادي',
  '1st_prep': 'الصف الأول الإعدادي',
  '1_prep': 'الصف الأول الإعدادي',
  prep_1: 'الصف الأول الإعدادي',

  preparatory: 'المرحلة الإعدادية',
  prep: 'المرحلة الإعدادية',

  // Primary Stage (المرحلة الابتدائية)
  sixth_primary: 'الصف السادس الابتدائي',
  '6th_primary': 'الصف السادس الابتدائي',
  primary_6: 'الصف السادس الابتدائي',

  fifth_primary: 'الصف الخامس الابتدائي',
  '5th_primary': 'الصف الخامس الابتدائي',
  primary_5: 'الصف الخامس الابتدائي',

  fourth_primary: 'الصف الرابع الابتدائي',
  '4th_primary': 'الصف الرابع الابتدائي',
  primary_4: 'الصف الرابع الابتدائي',

  third_primary: 'الصف الثالث الابتدائي',
  '3rd_primary': 'الصف الثالث الابتدائي',
  primary_3: 'الصف الثالث الابتدائي',

  second_primary: 'الصف الثاني الابتدائي',
  '2nd_primary': 'الصف الثاني الابتدائي',
  primary_2: 'الصف الثاني الابتدائي',

  first_primary: 'الصف الأول الابتدائي',
  '1st_primary': 'الصف الأول الابتدائي',
  primary_1: 'الصف الأول الابتدائي',

  primary: 'المرحلة الابتدائية',
}

export const SUBJECT_LABELS: Record<string, string> = {
  chemistry: 'الكيمياء',
  physics: 'الفيزياء',
  biology: 'الأحياء',
  integrated_science: 'علوم متكاملة',
  science: 'العلوم',
  math: 'الرياضيات',
  mathematics: 'الرياضيات',
  pure_math: 'رياضيات بحتة',
  applied_math: 'رياضيات تطبيقية',
  arabic: 'اللغة العربية',
  english: 'اللغة الإنجليزية',
  french: 'اللغة الفرنسية',
  german: 'اللغة الألمانية',
  italian: 'اللغة الإيطالية',
  geology: 'الجيولوجيا والعلوم البيئية',
  history: 'التاريخ',
  geography: 'الجغرافيا',
  philosophy: 'الفلسفة والمنطق',
  psychology: 'علم النفس والاجتماع',
  all: 'جميع المواد الدراسية',
}

export const EXAM_STATUS_LABELS: Record<string, string> = {
  started: 'جاري الحل',
  submitted: 'تم التسليم',
  graded: 'تم التصحيح',
  timed_out: 'انتهى الوقت',
  terminated: 'تم الإنهاء (مخالفة)',
}

/**
 * Formats a raw grade slug or enum into its canonical Arabic name.
 * e.g., 'third_secondary' -> 'الصف الثالث الثانوي'
 * e.g., 'third_prep' -> 'الصف الثالث الإعدادي'
 */
export function formatGradeName(grade?: string | null): string {
  if (!grade) return ''
  const trimmed = grade.trim()
  if (!trimmed) return ''

  // Already in Arabic or contains Arabic characters
  if (/[\u0600-\u06FF]/.test(trimmed)) {
    return trimmed
  }

  const normalized = trimmed.toLowerCase().replace(/[\s-]+/g, '_')
  if (GRADE_LABELS[normalized]) {
    return GRADE_LABELS[normalized]
  }

  // Fallback to taxonomy store if loaded
  try {
    const fromTaxonomy = useTaxonomyStore.getState().getGradeName(trimmed)
    if (fromTaxonomy && fromTaxonomy !== trimmed && /[\u0600-\u06FF]/.test(fromTaxonomy)) {
      return fromTaxonomy
    }
  } catch {
    // Ignore store access errors outside react lifecycle
  }

  return GRADE_LABELS[normalized] || trimmed
}

/**
 * Formats a raw subject slug or enum into its Arabic name.
 * e.g., 'biology' -> 'الأحياء'
 * e.g., 'الأحياء' -> 'الأحياء'
 */
export function formatSubjectName(subject?: string | null): string {
  if (!subject) return ''
  const trimmed = subject.trim()
  if (!trimmed) return ''

  // Already contains Arabic characters
  if (/[\u0600-\u06FF]/.test(trimmed)) {
    return trimmed
  }

  const normalized = trimmed.toLowerCase().replace(/[\s-]+/g, '_')
  return SUBJECT_LABELS[normalized] || trimmed
}

/**
 * Formats an exam attempt status into Arabic.
 */
export function formatExamStatus(status?: string | null): string {
  if (!status) return ''
  const normalized = status.trim().toLowerCase()
  return EXAM_STATUS_LABELS[normalized] || status
}
