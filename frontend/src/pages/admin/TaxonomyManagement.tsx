import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  BookOpen,
  Users,
  Search,
  Code,
  TrendingUp,
  Palette,
  Globe,
  Share2,
  Briefcase,
  Sparkles,
  AlertTriangle,
  FolderTree,
  ChevronRight,
  ArrowUpDown
} from 'lucide-react'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { useTaxonomyStore } from '../../store/taxonomyStore'
import SEO from '../../components/SEO'

const PRESET_ICONS = [
  { name: 'GraduationCap', label: 'قبعة تخرج (تعليم)' },
  { name: 'Code', label: 'كود وبرمجة' },
  { name: 'TrendingUp', label: 'أعمال واستثمار' },
  { name: 'Palette', label: 'تصميم وفنون' },
  { name: 'Globe', label: 'لغات وترجمة' },
  { name: 'Share2', label: 'تسويق وتواصل' },
  { name: 'Briefcase', label: 'مهارات ووظائف' },
  { name: 'BookOpen', label: 'كتاب ومناهج' },
  { name: 'Sparkles', label: 'إبداع وتميز' },
  { name: 'Layers', label: 'طبقات عامة' },
]

export default function TaxonomyManagement() {
  const { showToast, showAlert } = useModalStore()
  const { fetchTaxonomy: refreshGlobalTaxonomy } = useTaxonomyStore()

  const [activeTab, setActiveTab] = useState<'departments' | 'stages' | 'grades'>('departments')
  const [loading, setLoading] = useState(true)

  // Data states
  const [departments, setDepartments] = useState<any[]>([])
  const [stages, setStages] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all')

  // Modals state
  const [deptModalOpen, setDeptModalOpen] = useState(false)
  const [stageModalOpen, setStageModalOpen] = useState(false)
  const [gradeModalOpen, setGradeModalOpen] = useState(false)

  const [editingDept, setEditingDept] = useState<any | null>(null)
  const [editingStage, setEditingStage] = useState<any | null>(null)
  const [editingGrade, setEditingGrade] = useState<any | null>(null)

  // Forms data
  const [deptForm, setDeptForm] = useState({
    name: '',
    slug: '',
    description: '',
    icon: 'GraduationCap',
    badge: '',
    order: 0,
    is_active: true
  })

  const [stageForm, setStageForm] = useState({
    name: '',
    slug: '',
    order: 0,
    is_active: true
  })

  const [gradeForm, setGradeForm] = useState({
    stage_id: '',
    name: '',
    slug: '',
    short_code: '',
    order: 0,
    is_active: true
  })

  const [submitting, setSubmitting] = useState(false)

  // Load all taxonomy data
  const loadData = async () => {
    setLoading(true)
    try {
      const [deptRes, stageRes, gradeRes] = await Promise.all([
        API.get('/admin/departments'),
        API.get('/admin/academic-stages'),
        API.get('/admin/academic-grades')
      ])
      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : [])
      setStages(Array.isArray(stageRes.data) ? stageRes.data : [])
      setGrades(Array.isArray(gradeRes.data) ? gradeRes.data : [])
      refreshGlobalTaxonomy(true)
    } catch (err: any) {
      console.error('Error loading taxonomy data:', err)
      showToast('فشل تحميل بيانات الهيكلية والأقسام.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  /* =========================================================================
   * DEPARTMENT ACTIONS
   * ========================================================================= */
  const openCreateDept = () => {
    setEditingDept(null)
    setDeptForm({
      name: '',
      slug: '',
      description: '',
      icon: 'GraduationCap',
      badge: '',
      order: departments.length + 1,
      is_active: true
    })
    setDeptModalOpen(true)
  }

  const openEditDept = (dept: any) => {
    setEditingDept(dept)
    setDeptForm({
      name: dept.name,
      slug: dept.slug,
      description: dept.description || '',
      icon: dept.icon || 'GraduationCap',
      badge: dept.badge || '',
      order: dept.order ?? 0,
      is_active: !!dept.is_active
    })
    setDeptModalOpen(true)
  }

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deptForm.name.trim()) {
      showToast('يرجى إدخال اسم القسم.', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (editingDept) {
        await API.put(`/admin/departments/${editingDept.id}`, deptForm)
        showToast('تم تحديث القسم بنجاح.', 'success')
      } else {
        await API.post('/admin/departments', deptForm)
        showToast('تم إنشاء القسم الجديد بنجاح.', 'success')
      }
      setDeptModalOpen(false)
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'حدث خطأ أثناء حفظ بيانات القسم.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleDept = async (dept: any) => {
    try {
      await API.post(`/admin/departments/${dept.id}/toggle`)
      showToast(`تم ${dept.is_active ? 'تعطيل' : 'تفعيل'} القسم بنجاح.`, 'success')
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast('فشل تعديل حالة القسم.', 'error')
    }
  }

  const handleDeleteDept = (dept: any) => {
    showAlert({
      title: `حذف قسم "${dept.name}"`,
      description: 'هل أنت متأكد من حذف هذا القسم نهائياً؟',
      type: 'warning',
      buttonText: 'نعم، احذف',
      onConfirm: async () => {
        try {
          await API.delete(`/admin/departments/${dept.id}`)
          showToast('تم حذف القسم بنجاح.', 'success')
          loadData()
        } catch (err: any) {
          console.error(err)
          showToast(err.response?.data?.message || 'فشل حذف القسم.', 'error')
        }
      }
    })
  }

  /* =========================================================================
   * ACADEMIC STAGE ACTIONS
   * ========================================================================= */
  const openCreateStage = () => {
    setEditingStage(null)
    setStageForm({
      name: '',
      slug: '',
      order: stages.length + 1,
      is_active: true
    })
    setStageModalOpen(true)
  }

  const openEditStage = (stg: any) => {
    setEditingStage(stg)
    setStageForm({
      name: stg.name,
      slug: stg.slug,
      order: stg.order ?? 0,
      is_active: !!stg.is_active
    })
    setStageModalOpen(true)
  }

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stageForm.name.trim()) {
      showToast('يرجى إدخال اسم المرحلة الدراسية.', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (editingStage) {
        await API.put(`/admin/academic-stages/${editingStage.id}`, stageForm)
        showToast('تم تحديث المرحلة الدراسية بنجاح.', 'success')
      } else {
        await API.post('/admin/academic-stages', stageForm)
        showToast('تم إضافة المرحلة الدراسية بنجاح.', 'success')
      }
      setStageModalOpen(false)
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'حدث خطأ أثناء حفظ المرحلة.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStage = async (stg: any) => {
    try {
      await API.post(`/admin/academic-stages/${stg.id}/toggle`)
      showToast(`تم ${stg.is_active ? 'تعطيل' : 'تفعيل'} المرحلة بنجاح.`, 'success')
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast('فشل تعديل حالة المرحلة.', 'error')
    }
  }

  const handleDeleteStage = (stg: any) => {
    showAlert({
      title: `حذف المرحلة "${stg.name}"`,
      description: 'تحذير: سيتم أيضاً حذف جميع الصفوف الدراسية التابعة لهذه المرحلة.',
      type: 'warning',
      buttonText: 'نعم، احذف المرحلة',
      onConfirm: async () => {
        try {
          await API.delete(`/admin/academic-stages/${stg.id}`)
          showToast('تم حذف المرحلة الدراسية بنجاح.', 'success')
          loadData()
        } catch (err: any) {
          console.error(err)
          showToast(err.response?.data?.message || 'فشل حذف المرحلة.', 'error')
        }
      }
    })
  }

  /* =========================================================================
   * ACADEMIC GRADE ACTIONS
   * ========================================================================= */
  const openCreateGrade = () => {
    setEditingGrade(null)
    const defaultStageId = stages[0]?.id ? String(stages[0].id) : ''
    setGradeForm({
      stage_id: defaultStageId,
      name: '',
      slug: '',
      short_code: '',
      order: grades.length + 1,
      is_active: true
    })
    setGradeModalOpen(true)
  }

  const openEditGrade = (grd: any) => {
    setEditingGrade(grd)
    setGradeForm({
      stage_id: String(grd.stage_id),
      name: grd.name,
      slug: grd.slug,
      short_code: grd.short_code || '',
      order: grd.order ?? 0,
      is_active: !!grd.is_active
    })
    setGradeModalOpen(true)
  }

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gradeForm.name.trim() || !gradeForm.stage_id) {
      showToast('يرجى تحديد المرحلة وإدخال اسم الصف الدراسي.', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (editingGrade) {
        await API.put(`/admin/academic-grades/${editingGrade.id}`, gradeForm)
        showToast('تم تحديث الصف الدراسي بنجاح.', 'success')
      } else {
        await API.post('/admin/academic-grades', gradeForm)
        showToast('تم إضافة الصف الدراسي بنجاح.', 'success')
      }
      setGradeModalOpen(false)
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'حدث خطأ أثناء حفظ الصف الدراسي.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleGrade = async (grd: any) => {
    try {
      await API.post(`/admin/academic-grades/${grd.id}/toggle`)
      showToast(`تم ${grd.is_active ? 'تعطيل' : 'تفعيل'} الصف الدراسي بنجاح.`, 'success')
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast('فشل تعديل حالة الصف الدراسي.', 'error')
    }
  }

  const handleDeleteGrade = (grd: any) => {
    showAlert({
      title: `حذف الصف "${grd.name}"`,
      description: 'هل أنت متأكد من حذف هذا الصف الدراسي؟',
      type: 'warning',
      buttonText: 'نعم، احذف',
      onConfirm: async () => {
        try {
          await API.delete(`/admin/academic-grades/${grd.id}`)
          showToast('تم حذف الصف الدراسي بنجاح.', 'success')
          loadData()
        } catch (err: any) {
          console.error(err)
          showToast(err.response?.data?.message || 'فشل حذف الصف الدراسي.', 'error')
        }
      }
    })
  }

  // Filter lists
  const filteredDepartments = departments.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (d.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredStages = stages.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredGrades = grades.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || (g.short_code || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchStage = selectedStageFilter === 'all' || String(g.stage_id) === selectedStageFilter
    return matchSearch && matchStage
  })

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <SEO 
        title="إدارة هيكلية المنصة والأقسام | لوحة الإدارة"
        description="إدارة الأقسام والتصنيفات والمراحل والصفوف الدراسية لمنصة خطوتك التعليمية."
      />

      {/* Header Banner */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-black">
            <FolderTree className="w-4 h-4" />
            <span>هيكلية المنصة والتصنيفات المركزية</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">إدارة الأقسام والمراحل الدراسية</h1>
          <p className="text-xs text-slate-400 font-light max-w-xl">
            تحكم كامل في الأقسام الرئيسية، المراحل التعليمية، والصفوف الدراسية وتحديثها فورياً في كافة واجهات الطلاب والمعلمين.
          </p>
        </div>

        {/* Quick Tab Add Action Button */}
        <div className="shrink-0 relative z-10 w-full sm:w-auto">
          {activeTab === 'departments' && (
            <button
              onClick={openCreateDept}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-black rounded-2xl shadow-lg shadow-brand-primary/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قسم جديد</span>
            </button>
          )}

          {activeTab === 'stages' && (
            <button
              onClick={openCreateStage}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-black rounded-2xl shadow-lg shadow-brand-primary/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مرحلة دراسية</span>
            </button>
          )}

          {activeTab === 'grades' && (
            <button
              onClick={openCreateGrade}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-black rounded-2xl shadow-lg shadow-brand-primary/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة صف دراسي جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 p-3 rounded-2xl">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none p-1">
          <button
            onClick={() => setActiveTab('departments')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'departments'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>الأقسام الرئيسية ({departments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('stages')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'stages'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>المراحل الدراسية ({stages.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('grades')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'grades'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>الصفوف الدراسية ({grades.length})</span>
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-3">
          {activeTab === 'grades' && (
            <div className="relative w-44">
              <select
                value={selectedStageFilter}
                onChange={(e) => setSelectedStageFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-brand-primary cursor-pointer appearance-none"
              >
                <option value="all">جميع المراحل</option>
                {stages.map((stg) => (
                  <option key={stg.id} value={String(stg.id)}>{stg.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs font-bold text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-primary"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Main Table / Grid Content */}
      {loading ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-16 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-slate-400 font-bold">جاري تحميل البيانات...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ================================================================
              1. DEPARTMENTS TAB
              ================================================================ */}
          {activeTab === 'departments' && (
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-black text-slate-400">
                      <th className="p-4">الترتيب</th>
                      <th className="p-4">القسم والاسم</th>
                      <th className="p-4">المعرف (Slug)</th>
                      <th className="p-4">الشارة (Badge)</th>
                      <th className="p-4">الكورسات والمحتوى</th>
                      <th className="p-4">المعلمون</th>
                      <th className="p-4 text-center">الحالة</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-semibold text-slate-300">
                    {filteredDepartments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-slate-500 font-mono font-bold">#{dept.order}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                              <Layers className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-black text-foreground block">{dept.name}</span>
                              <span className="text-[10px] text-slate-400 font-light block max-w-xs truncate">{dept.description || 'بدون وصف'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-indigo-400">{dept.slug}</td>
                        <td className="p-4">
                          {dept.badge ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-black border border-slate-700">
                              {dept.badge}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{dept.courses_count || 0} كورس</span>
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                            <Users className="w-3.5 h-3.5 text-brand-primary" />
                            <span>{dept.teachers_count || 0} معلم</span>
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleDept(dept)}
                            className="cursor-pointer inline-flex items-center transition-transform active:scale-95"
                            title={dept.is_active ? 'تعطيل القسم' : 'تفعيل القسم'}
                          >
                            {dept.is_active ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                                نشط
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-black">
                                معطل
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditDept(dept)}
                              className="p-2 rounded-lg bg-slate-800/80 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-400 transition-colors cursor-pointer"
                              title="تعديل"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDept(dept)}
                              className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              2. STAGES TAB
              ================================================================ */}
          {activeTab === 'stages' && (
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-black text-slate-400">
                      <th className="p-4">الترتيب</th>
                      <th className="p-4">المرحلة الدراسية</th>
                      <th className="p-4">المعرف (Slug)</th>
                      <th className="p-4">عدد الصفوف التابعة</th>
                      <th className="p-4 text-center">الحالة</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-semibold text-slate-300">
                    {filteredStages.map((stg) => (
                      <tr key={stg.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-slate-500 font-mono font-bold">#{stg.order}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-accent/10 text-accent border border-accent/20">
                              <GraduationCap className="w-4 h-4" />
                            </div>
                            <span className="font-black text-foreground">{stg.name}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-indigo-400">{stg.slug}</td>
                        <td className="p-4">
                          <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg border border-slate-700">
                            {stg.grades?.length || 0} صفوف
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleStage(stg)}
                            className="cursor-pointer inline-flex items-center transition-transform active:scale-95"
                          >
                            {stg.is_active ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                                نشطة
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-black">
                                معطلة
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditStage(stg)}
                              className="p-2 rounded-lg bg-slate-800/80 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-400 transition-colors cursor-pointer"
                              title="تعديل"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteStage(stg)}
                              className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              3. GRADES TAB
              ================================================================ */}
          {activeTab === 'grades' && (
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-black text-slate-400">
                      <th className="p-4">الترتيب</th>
                      <th className="p-4">الصف الدراسي</th>
                      <th className="p-4">المرحلة التابع لها</th>
                      <th className="p-4">المعرف (Slug)</th>
                      <th className="p-4">الكود المختصر</th>
                      <th className="p-4 text-center">الحالة</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-semibold text-slate-300">
                    {filteredGrades.map((grd) => (
                      <tr key={grd.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-slate-500 font-mono font-bold">#{grd.order}</td>
                        <td className="p-4">
                          <span className="font-black text-foreground">{grd.name}</span>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-lg bg-brand-primary/10 text-brand-primary border border-brand-primary/20 text-[11px] font-bold">
                            {grd.stage?.name || 'غير محدد'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-indigo-400">{grd.slug}</td>
                        <td className="p-4 font-bold text-slate-400">
                          {grd.short_code ? (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                              {grd.short_code}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleGrade(grd)}
                            className="cursor-pointer inline-flex items-center transition-transform active:scale-95"
                          >
                            {grd.is_active ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                                نشط
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-black">
                                معطل
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditGrade(grd)}
                              className="p-2 rounded-lg bg-slate-800/80 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-400 transition-colors cursor-pointer"
                              title="تعديل"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteGrade(grd)}
                              className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ================================================================
          MODAL: ADD / EDIT DEPARTMENT
          ================================================================ */}
      <AnimatePresence>
        {deptModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl text-right"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-lg font-black text-foreground">
                  {editingDept ? 'تعديل بيانات القسم' : 'إضافة قسم تعليمي جديد'}
                </h3>
                <button
                  onClick={() => setDeptModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveDept} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم القسم (باللغة العربية) *</label>
                  <input
                    type="text"
                    required
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    placeholder="مثال: الذكاء الاصطناعي وعلوم البيانات"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">المعرف الإنجليزي (Slug)</label>
                    <input
                      type="text"
                      value={deptForm.slug}
                      onChange={(e) => setDeptForm({ ...deptForm, slug: e.target.value })}
                      placeholder="مثال: ai_data_science"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">أيقونة القسم</label>
                    <select
                      value={deptForm.icon}
                      onChange={(e) => setDeptForm({ ...deptForm, icon: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary cursor-pointer"
                    >
                      {PRESET_ICONS.map((ic) => (
                        <option key={ic.name} value={ic.name}>{ic.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">شارة القسم (Badge)</label>
                    <input
                      type="text"
                      value={deptForm.badge}
                      onChange={(e) => setDeptForm({ ...deptForm, badge: e.target.value })}
                      placeholder="مثال: تقنية وتطوير"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">ترتيب العرض</label>
                    <input
                      type="number"
                      value={deptForm.order}
                      onChange={(e) => setDeptForm({ ...deptForm, order: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">وصف القسم</label>
                  <textarea
                    rows={3}
                    value={deptForm.description}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                    placeholder="نبذة توضيحية عن المحتوى والمهارات التي يقدمها هذا القسم..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="dept_active"
                    checked={deptForm.is_active}
                    onChange={(e) => setDeptForm({ ...deptForm, is_active: e.target.checked })}
                    className="rounded border-slate-700 text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="dept_active" className="text-xs font-bold text-slate-200 cursor-pointer">
                    تفعيل القسم وعرضه فورياً للطلاب والمعلمين
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDeptModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'جاري الحفظ...' : editingDept ? 'حفظ التعديلات' : 'إضافة القسم'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================================================
          MODAL: ADD / EDIT ACADEMIC STAGE
          ================================================================ */}
      <AnimatePresence>
        {stageModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl text-right"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-lg font-black text-foreground">
                  {editingStage ? 'تعديل المرحلة الدراسية' : 'إضافة مرحلة دراسية جديدة'}
                </h3>
                <button
                  onClick={() => setStageModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveStage} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المرحلة (مثال: المرحلة الابتدائية) *</label>
                  <input
                    type="text"
                    required
                    value={stageForm.name}
                    onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                    placeholder="مثال: المرحلة الابتدائية"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">المعرف الإنجليزي (Slug)</label>
                    <input
                      type="text"
                      value={stageForm.slug}
                      onChange={(e) => setStageForm({ ...stageForm, slug: e.target.value })}
                      placeholder="مثال: primary"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">ترتيب العرض</label>
                    <input
                      type="number"
                      value={stageForm.order}
                      onChange={(e) => setStageForm({ ...stageForm, order: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="stage_active"
                    checked={stageForm.is_active}
                    onChange={(e) => setStageForm({ ...stageForm, is_active: e.target.checked })}
                    className="rounded border-slate-700 text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="stage_active" className="text-xs font-bold text-slate-200 cursor-pointer">
                    تفعيل المرحلة الدراسية
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setStageModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'جاري الحفظ...' : editingStage ? 'حفظ التعديلات' : 'إضافة المرحلة'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================================================
          MODAL: ADD / EDIT ACADEMIC GRADE
          ================================================================ */}
      <AnimatePresence>
        {gradeModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl text-right"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-lg font-black text-foreground">
                  {editingGrade ? 'تعديل الصف الدراسي' : 'إضافة صف دراسي جديد'}
                </h3>
                <button
                  onClick={() => setGradeModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveGrade} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">المرحلة الدراسية التابع لها *</label>
                  <select
                    required
                    value={gradeForm.stage_id}
                    onChange={(e) => setGradeForm({ ...gradeForm, stage_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary cursor-pointer"
                  >
                    <option value="">اختر المرحلة الدراسية</option>
                    {stages.map((stg) => (
                      <option key={stg.id} value={String(stg.id)}>{stg.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم الصف الدراسي *</label>
                  <input
                    type="text"
                    required
                    value={gradeForm.name}
                    onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })}
                    placeholder="مثال: الصف الأول الابتدائي"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">المعرف (Slug)</label>
                    <input
                      type="text"
                      value={gradeForm.slug}
                      onChange={(e) => setGradeForm({ ...gradeForm, slug: e.target.value })}
                      placeholder="مثال: first_primary"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">الكود المختصر</label>
                    <input
                      type="text"
                      value={gradeForm.short_code}
                      onChange={(e) => setGradeForm({ ...gradeForm, short_code: e.target.value })}
                      placeholder="مثال: ١ب"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">ترتيب العرض</label>
                  <input
                    type="number"
                    value={gradeForm.order}
                    onChange={(e) => setGradeForm({ ...gradeForm, order: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="grade_active"
                    checked={gradeForm.is_active}
                    onChange={(e) => setGradeForm({ ...gradeForm, is_active: e.target.checked })}
                    className="rounded border-slate-700 text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="grade_active" className="text-xs font-bold text-slate-200 cursor-pointer">
                    تفعيل الصف الدراسي
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setGradeModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'جاري الحفظ...' : editingGrade ? 'حفظ التعديلات' : 'إضافة الصف'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
