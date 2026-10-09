import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Eye, 
  EyeOff, 
  Check, 
  RotateCcw, 
  Save, 
  X, 
  Users, 
  Shield, 
  Lock, 
  Unlock, 
  Sliders, 
  CheckSquare, 
  Square, 
  Loader2, 
  Info 
} from 'lucide-react'
import API from '../services/api'
import { useModalStore } from '../store/modalStore'
import { useAuthStore } from '../store/authStore'

interface VisibilitySettings {
  show_score: boolean
  show_student_answers: boolean
  show_correct_answers: boolean
  show_explanations: boolean
}

interface StudentOverrideItem {
  id: number
  student_id: number
  show_score: boolean | null
  show_student_answers: boolean | null
  show_correct_answers: boolean | null
  show_explanations: boolean | null
  student?: {
    id: number
    name: string
    email?: string
    phone?: string
  }
}

interface AttemptItemMinimal {
  student_id?: number
  id?: number
  student?: {
    id?: number
    name: string
    email?: string
  }
}

interface StudentVisibilityParticipant {
  id: number
  student_id: number
  name: string
  email?: string
  phone?: string
  status?: string
  latest_status?: string
  score?: number | null
  max_score?: number
  attempts_count?: number
  last_attempt_at?: string | null
  has_override?: boolean
  override?: StudentOverrideItem | null
}

interface ExamVisibilityModalProps {
  isOpen: boolean
  onClose: () => void
  examId: number
  examTitle: string
  attempts?: AttemptItemMinimal[]
  endpointPrefix?: string
  onUpdated?: () => void
}

export default function ExamVisibilityModal({
  isOpen,
  onClose,
  examId,
  examTitle,
  attempts = [],
  endpointPrefix,
  onUpdated,
}: ExamVisibilityModalProps) {
  const { showToast } = useModalStore()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const basePrefix = endpointPrefix || (isAdmin ? '/admin/exams' : '/teacher/exams')

  const [loading, setLoading] = useState(true)
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [examDefaults, setExamDefaults] = useState<VisibilitySettings>({
    show_score: true,
    show_student_answers: true,
    show_correct_answers: true,
    show_explanations: true,
  })

  const [overrides, setOverrides] = useState<Record<number, StudentOverrideItem>>({})
  const [apiStudents, setApiStudents] = useState<StudentVisibilityParticipant[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null)
  const [studentForm, setStudentForm] = useState<{
    show_score: boolean
    show_student_answers: boolean
    show_correct_answers: boolean
    show_explanations: boolean
  }>({
    show_score: true,
    show_student_answers: true,
    show_correct_answers: true,
    show_explanations: true,
  })
  const [savingStudentOverride, setSavingStudentOverride] = useState(false)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // Fetch visibility data
  const fetchData = async () => {
    if (!examId) return
    setLoading(true)
    try {
      const res = await API.get(`${basePrefix}/${examId}/visibility`)
      if (res.data.defaults) {
        setExamDefaults(res.data.defaults)
      }
      const overrideMap: Record<number, StudentOverrideItem> = {}
      if (Array.isArray(res.data.overrides)) {
        res.data.overrides.forEach((ov: StudentOverrideItem) => {
          overrideMap[ov.student_id] = ov
        })
      }
      setOverrides(overrideMap)

      if (Array.isArray(res.data.students)) {
        setApiStudents(res.data.students)
      }
    } catch (err: any) {
      console.error('Failed to load visibility settings:', err)
      showToast(err.response?.data?.message || 'تعذر تحميل إعدادات ظهور النتيجة.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchData()
      setSelectedStudentIds([])
      setEditingStudentId(null)
    }
  }, [isOpen, examId])

  // Support ESC to close the modal
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Save exam defaults
  const handleSaveDefaults = async () => {
    setSavingDefaults(true)
    try {
      await API.put(`${basePrefix}/${examId}/visibility`, examDefaults)
      showToast('تم حفظ الإعدادات الافتراضية للامتحان بنجاح.', 'success')
      fetchData()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'فشل تحديث الإعدادات الافتراضية.', 'error')
    } finally {
      setSavingDefaults(false)
    }
  }

  // Save individual student override
  const handleSaveStudentOverride = async () => {
    if (!editingStudentId) return
    setSavingStudentOverride(true)
    try {
      await API.put(`${basePrefix}/${examId}/student-visibility/${editingStudentId}`, studentForm)
      showToast('تم تعيين إعدادات النتيجة المخصصة للطالب بنجاح.', 'success')
      setEditingStudentId(null)
      fetchData()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'فشل حفظ تخصيص الطالب.', 'error')
    } finally {
      setSavingStudentOverride(false)
    }
  }

  // Reset student override to default
  const handleResetStudentOverride = async (studentId: number) => {
    try {
      await API.delete(`${basePrefix}/${examId}/student-visibility/${studentId}`)
      showToast('تمت استعادة الإعدادات الافتراضية للطالب.', 'success')
      fetchData()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'فشل استعادة الإعدادات الافتراضية.', 'error')
    }
  }

  // Bulk Apply
  const handleBulkApply = async (settings: Partial<VisibilitySettings> | 'reset') => {
    if (selectedStudentIds.length === 0) {
      showToast('يرجى تحديد طالب واحد على الأقل.', 'warning')
      return
    }

    setBulkProcessing(true)
    try {
      const payload: any = {
        student_ids: selectedStudentIds,
      }
      if (settings === 'reset') {
        payload.reset_to_default = true
      } else {
        Object.assign(payload, settings)
      }

      const res = await API.post(`${basePrefix}/${examId}/bulk-student-visibility`, payload)
      showToast(res.data.message || 'تم تحديث الإعدادات للطلاب المحددين بنجاح.', 'success')
      setSelectedStudentIds([])
      fetchData()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'فشل تطبيق الإعدادات المجمعة.', 'error')
    } finally {
      setBulkProcessing(false)
    }
  }

  // Compile list of unique students from API students, prop attempts, and overrides
  const studentMap = new Map<number, {
    id: number
    name: string
    email?: string
    phone?: string
    status?: string
    score?: number | null
    max_score?: number
    attempts_count?: number
  }>()

  // 1. From API students (primary source from backend)
  apiStudents.forEach((st) => {
    studentMap.set(st.id, {
      id: st.id,
      name: st.name,
      email: st.email,
      phone: st.phone,
      status: st.status || st.latest_status,
      score: st.score,
      max_score: st.max_score,
      attempts_count: st.attempts_count,
    })
  })

  // 2. From prop attempts (if passed from parent)
  attempts.forEach((a) => {
    const sId = a.student_id || a.student?.id
    if (sId && a.student) {
      const existing = studentMap.get(sId)
      if (!existing) {
        studentMap.set(sId, {
          id: sId,
          name: a.student.name,
          email: a.student.email,
        })
      }
    }
  })

  // 3. From overrides (if any student has an override)
  Object.values(overrides).forEach((ov) => {
    if (ov.student && !studentMap.has(ov.student_id)) {
      studentMap.set(ov.student_id, {
        id: ov.student_id,
        name: ov.student.name,
        email: ov.student.email,
        phone: ov.student.phone,
      })
    }
  })

  const uniqueStudents = Array.from(studentMap.values())

  const toggleSelectStudent = (sId: number) => {
    setSelectedStudentIds((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === uniqueStudents.length) {
      setSelectedStudentIds([])
    } else {
      setSelectedStudentIds(uniqueStudents.map((s) => s.id))
    }
  }

  const openStudentEdit = (studentId: number) => {
    const ov = overrides[studentId]
    setStudentForm({
      show_score: ov && ov.show_score !== null ? ov.show_score : examDefaults.show_score,
      show_student_answers: ov && ov.show_student_answers !== null ? ov.show_student_answers : examDefaults.show_student_answers,
      show_correct_answers: ov && ov.show_correct_answers !== null ? ov.show_correct_answers : examDefaults.show_correct_answers,
      show_explanations: ov && ov.show_explanations !== null ? ov.show_explanations : examDefaults.show_explanations,
    })
    setEditingStudentId(studentId)
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto" 
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {/* Modal Dialog (Backdrop removed: underlying page remains fully visible) */}
      <div 
        className="relative bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-7 max-w-3xl w-full space-y-6 shadow-2xl shadow-black/80 overflow-y-auto max-h-[92vh] z-10 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-indigo-400" />
              <h3 className="font-black text-base sm:text-lg text-white">التحكم في ظهور النتيجة والحلول النموذجية</h3>
            </div>
            <p className="text-xs text-slate-400 font-medium">امتحان: <span className="text-indigo-300 font-bold">{examTitle}</span></p>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            title="إغلاق (Esc)"
            aria-label="إغلاق النافذة"
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 mt-2 font-bold">جاري تحميل إعدادات الرؤية...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Section 1: Exam Default Settings */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-200">الإعدادات الافتراضية للامتحان</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">تُطبّق على جميع الطلاب ما لم يتم تخصيص إعدادات فردية لطالب محدد.</p>
                </div>
                <button
                  type="button"
                  disabled={savingDefaults}
                  onClick={handleSaveDefaults}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingDefaults ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>حفظ الافتراضي</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* 1. Show score */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer select-none hover:border-slate-700 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 block">إظهار درجة الطالب والنسبة</span>
                    <span className="text-[10px] text-slate-400 block">عرض المجموع والدرجة بعد التسليم</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={examDefaults.show_score}
                    onChange={(e) => setExamDefaults((prev) => ({ ...prev, show_score: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                  />
                </label>

                {/* 2. Show student answers */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer select-none hover:border-slate-700 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 block">إظهار إجابات الطالب المسجلة</span>
                    <span className="text-[10px] text-slate-400 block">عرض الإجابات التي اختارها الطالب</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={examDefaults.show_student_answers}
                    onChange={(e) => setExamDefaults((prev) => ({ ...prev, show_student_answers: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                  />
                </label>

                {/* 3. Show correct answers */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer select-none hover:border-slate-700 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 block">إظهار الإجابات النموذجية الصحيحة</span>
                    <span className="text-[10px] text-slate-400 block">كشف الحل النموذجي الصحيح لكل سؤال</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={examDefaults.show_correct_answers}
                    onChange={(e) => setExamDefaults((prev) => ({ ...prev, show_correct_answers: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                  />
                </label>

                {/* 4. Show explanations */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer select-none hover:border-slate-700 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 block">إظهار الشرح والتوضيحات</span>
                    <span className="text-[10px] text-slate-400 block">عرض الملاحظات التوضيحية لخطوات الحل</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={examDefaults.show_explanations}
                    onChange={(e) => setExamDefaults((prev) => ({ ...prev, show_explanations: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                  />
                </label>
              </div>
            </div>

            {/* Section 2: Student-specific Overrides & Bulk Controls */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-400" />
                  <h4 className="text-sm font-black text-slate-200">التحكم الفردي والمجمع لكل طالب ({uniqueStudents.length})</h4>
                </div>

                {/* Bulk Actions Menu */}
                {selectedStudentIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-indigo-300">محدد ({selectedStudentIds.length}):</span>
                    <button
                      type="button"
                      disabled={bulkProcessing}
                      onClick={() => handleBulkApply({ show_score: false, show_student_answers: false, show_correct_answers: false, show_explanations: false })}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-[10px] transition-all cursor-pointer"
                    >
                      حجب النتيجة بالكامل 🔒
                    </button>
                    <button
                      type="button"
                      disabled={bulkProcessing}
                      onClick={() => handleBulkApply({ show_score: true, show_student_answers: false, show_correct_answers: false, show_explanations: false })}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-[10px] transition-all cursor-pointer"
                    >
                      إظهار الدرجة فقط
                    </button>
                    <button
                      type="button"
                      disabled={bulkProcessing}
                      onClick={() => handleBulkApply({ show_score: true, show_student_answers: true, show_correct_answers: true, show_explanations: true })}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-[10px] transition-all cursor-pointer"
                    >
                      إظهار كل شيء 🔓
                    </button>
                    <button
                      type="button"
                      disabled={bulkProcessing}
                      onClick={() => handleBulkApply('reset')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] transition-all cursor-pointer"
                    >
                      استعادة الافتراضي 🔄
                    </button>
                  </div>
                )}
              </div>

              {/* Students Table */}
              {uniqueStudents.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-xs text-slate-400">
                  لم يسجل أي طالب تسليمات أو محاولات لهذا الامتحان بعد لتخصيص نتائجهم.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="p-3 w-10">
                          <button type="button" onClick={toggleSelectAll} className="p-0.5 cursor-pointer">
                            {selectedStudentIds.length === uniqueStudents.length ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                        </th>
                        <th className="p-3 font-bold">اسم الطالب</th>
                        <th className="p-3 font-bold text-center">حالة الرؤية</th>
                        <th className="p-3 font-bold text-center">الدرجة</th>
                        <th className="p-3 font-bold text-center">الإجابات</th>
                        <th className="p-3 font-bold text-center">النموذجية</th>
                        <th className="p-3 font-bold text-center">الشرح</th>
                        <th className="p-3 font-bold text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {uniqueStudents.map((st) => {
                        const ov = overrides[st.id]
                        const isOverridden = ov && (
                          ov.show_score !== null ||
                          ov.show_student_answers !== null ||
                          ov.show_correct_answers !== null ||
                          ov.show_explanations !== null
                        )

                        const effectiveScore = ov && ov.show_score !== null ? ov.show_score : examDefaults.show_score
                        const effectiveAnswers = ov && ov.show_student_answers !== null ? ov.show_student_answers : examDefaults.show_student_answers
                        const effectiveCorrect = ov && ov.show_correct_answers !== null ? ov.show_correct_answers : examDefaults.show_correct_answers
                        const effectiveExpl = ov && ov.show_explanations !== null ? ov.show_explanations : examDefaults.show_explanations

                        const isSelected = selectedStudentIds.includes(st.id)

                        return (
                          <tr key={st.id} className={`hover:bg-slate-800/30 transition-colors ${isSelected ? 'bg-indigo-950/20' : ''}`}>
                            <td className="p-3">
                              <button type="button" onClick={() => toggleSelectStudent(st.id)} className="p-0.5 cursor-pointer">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-600" />
                                )}
                              </button>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-white text-xs">{st.name}</div>
                              {st.email && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{st.email}</div>}
                              {st.status && (
                                <div className="text-[10px] mt-1 flex items-center gap-1.5 flex-wrap">
                                  {st.status === 'graded' ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-semibold text-[9px]">
                                      تم التصحيح {st.score !== null ? `(${st.score}/${st.max_score ?? '—'})` : ''}
                                    </span>
                                  ) : st.status === 'submitted' ? (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/20 text-amber-400 font-semibold text-[9px]">
                                      تم التسليم (بانتظار الرصد)
                                    </span>
                                  ) : st.status === 'started' ? (
                                    <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/20 text-sky-400 font-semibold text-[9px]">
                                      بدأ الاختبار (قيد الحل)
                                    </span>
                                  ) : st.status === 'terminated_for_cheating' ? (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/20 text-rose-400 font-semibold text-[9px]">
                                      مخالفة غش ⚠️
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold text-[9px]">{st.status}</span>
                                  )}
                                  {st.attempts_count && st.attempts_count > 1 ? (
                                    <span className="text-[9px] text-slate-500">({st.attempts_count} محاولات)</span>
                                  ) : null}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {isOverridden ? (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-[10px]">
                                  تخصيص مخصص ⚙️
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold text-[10px]">
                                  افتراضي
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">{effectiveScore ? '🟢 ظاهرة' : '🔒 محجوبة'}</td>
                            <td className="p-3 text-center">{effectiveAnswers ? '🟢 ظاهرة' : '🔒 محجوبة'}</td>
                            <td className="p-3 text-center">{effectiveCorrect ? '🟢 ظاهرة' : '🔒 محجوبة'}</td>
                            <td className="p-3 text-center">{effectiveExpl ? '🟢 ظاهر' : '🔒 محجوب'}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openStudentEdit(st.id)}
                                  className="px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 font-bold text-[10px] transition-colors cursor-pointer"
                                >
                                  تعديل
                                </button>
                                {isOverridden && (
                                  <button
                                    type="button"
                                    onClick={() => handleResetStudentOverride(st.id)}
                                    title="استعادة الافتراضي"
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sub-modal: Edit individual student override */}
            {editingStudentId !== null && (
              <div className="p-4 sm:p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-indigo-200">
                    تخصيص ظهور النتيجة للطالب: {studentMap.get(editingStudentId)?.name}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingStudentId(null)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer select-none">
                    <span className="text-xs font-bold text-slate-200">إظهار درجة الطالب والنسبة</span>
                    <input
                      type="checkbox"
                      checked={studentForm.show_score}
                      onChange={(e) => setStudentForm((prev) => ({ ...prev, show_score: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer select-none">
                    <span className="text-xs font-bold text-slate-200">إظهار إجابات الطالب المسجلة</span>
                    <input
                      type="checkbox"
                      checked={studentForm.show_student_answers}
                      onChange={(e) => setStudentForm((prev) => ({ ...prev, show_student_answers: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer select-none">
                    <span className="text-xs font-bold text-slate-200">إظهار الإجابات النموذجية الصحيحة</span>
                    <input
                      type="checkbox"
                      checked={studentForm.show_correct_answers}
                      onChange={(e) => setStudentForm((prev) => ({ ...prev, show_correct_answers: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer select-none">
                    <span className="text-xs font-bold text-slate-200">إظهار الشرح والتوضيحات</span>
                    <input
                      type="checkbox"
                      checked={studentForm.show_explanations}
                      onChange={(e) => setStudentForm((prev) => ({ ...prev, show_explanations: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-indigo-500/20">
                  <button
                    type="button"
                    onClick={() => setEditingStudentId(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={savingStudentOverride}
                    onClick={handleSaveStudentOverride}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                  >
                    {savingStudentOverride ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>حفظ التخصيص للطالب</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  )
}
