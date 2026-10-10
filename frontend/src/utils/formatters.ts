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

/**
 * Safely parses a date input (string, number, Date) ensuring:
 * - Reject null, undefined, empty, 0, "0", or Unix epoch 1970 artifacts.
 * - Auto-detect and convert timestamps in seconds (10 digits) to milliseconds.
 * - Return null for invalid dates or dates in year 1970 or earlier.
 */
export function parseValidDate(dateVal: any): Date | null {
  if (dateVal === null || dateVal === undefined || dateVal === false) return null

  let date: Date
  if (typeof dateVal === 'number') {
    if (dateVal <= 0) return null
    // If timestamp is in seconds (< 10000000000), convert to milliseconds
    date = new Date(dateVal < 10000000000 ? dateVal * 1000 : dateVal)
  } else if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim()
    if (!trimmed || trimmed === '0' || trimmed.startsWith('1970-01-01') || trimmed.startsWith('0000-00-00')) {
      return null
    }
    // Pure numeric string
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed)
      if (num <= 0) return null
      date = new Date(num < 10000000000 ? num * 1000 : num)
    } else {
      date = new Date(trimmed)
    }
  } else if (dateVal instanceof Date) {
    date = dateVal
  } else {
    return null
  }

  if (isNaN(date.getTime()) || date.getFullYear() <= 1970) {
    return null
  }

  return date
}

/**
 * Formats a submission date in Arabic using the 'Africa/Cairo' timezone.
 * Returns null if the date is invalid or not yet submitted.
 * e.g., '١٠ أكتوبر ٢٠٢٦'
 */
export function formatSubmissionDate(dateVal: any): string | null {
  const date = parseValidDate(dateVal)
  if (!date) return null

  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/**
 * Formats a submission date and time in Arabic using the 'Africa/Cairo' timezone.
 * Returns null if the date is invalid or not yet submitted.
 * e.g., '١٠‏/١٠‏/٢٠٢٦، ٠٤:٢٥ ص'
 */
export function formatSubmissionDateTime(dateVal: any): string | null {
  const date = parseValidDate(dateVal)
  if (!date) return null

  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * Calculates and formats the duration between started_at and submitted_at into Arabic.
 * Fallback to duration_minutes if available.
 */
export function formatExamDuration(
  startedAt: any,
  submittedAt: any,
  durationMinutes?: number | null
): string | null {
  const start = parseValidDate(startedAt)
  const end = parseValidDate(submittedAt)

  if (start && end) {
    const diffSec = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
    if (diffSec < 60) {
      return `${diffSec} ثانية`
    }
    const mins = Math.floor(diffSec / 60)
    const secs = diffSec % 60
    if (mins < 60) {
      return secs > 0 ? `${mins} دقيقة و ${secs} ثانية` : `${mins} دقيقة`
    }
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    return remMins > 0 ? `${hours} ساعة و ${remMins} دقيقة` : `${hours} ساعة`
  }

  if (durationMinutes && durationMinutes > 0) {
    if (durationMinutes < 60) {
      return `${durationMinutes} دقيقة`
    }
    const hours = Math.floor(durationMinutes / 60)
    const remMins = durationMinutes % 60
    return remMins > 0 ? `${hours} ساعة و ${remMins} دقيقة` : `${hours} ساعة`
  }

  return null
}
