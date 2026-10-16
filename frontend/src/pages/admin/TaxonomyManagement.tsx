import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
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
  FolderTree,
  Book,
  School,
  Building2,
  Award
} from 'lucide-react'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { useTaxonomyStore } from '../../store/taxonomyStore'
import SEO from '../../components/SEO'

const PRESET_ICONS = [
  { name: 'GraduationCap', label: 'قبعة تخرج (تعليم)' },
  { name: 'Building2', label: 'جامعة أو كلية' },
  { name: 'School', label: 'مدرسة' },
  { name: 'Book', label: 'مادة دراسية' },
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

  const [activeTab, setActiveTab] = useState<'departments' | 'stages' | 'grades' | 'subjects'>('departments')
  const [loading, setLoading] = useState(true)

  // Data states
  const [departments, setDepartments] = useState<any[]>([])
  const [stages, setStages] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [sectorFilter, setSectorFilter] = useState<'all' | 'school' | 'university'>('all')
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all')
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all')

  // Modals state
  const [deptModalOpen, setDeptModalOpen] = useState(false)
  const [stageModalOpen, setStageModalOpen] = useState(false)
  const [gradeModalOpen, setGradeModalOpen] = useState(false)
  const [subjectModalOpen, setSubjectModalOpen] = useState(false)

  const [editingDept, setEditingDept] = useState<any | null>(null)
  const [editingStage, setEditingStage] = useState<any | null>(null)
  const [editingGrade, setEditingGrade] = useState<any | null>(null)
  const [editingSubject, setEditingSubject] = useState<any | null>(null)

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
    sector: 'school' as 'school' | 'university',
    order: 0,
    is_active: true
  })

  const [gradeForm, setGradeForm] = useState({
    stage_id: '',
    name: '',
    slug: '',
    short_code: '',
    level_type: 'grade' as 'grade' | 'university_year',
    specialization: '',
    order: 0,
    is_active: true
  })

  const [subjectForm, setSubjectForm] = useState({
    name: '',
    slug: '',
    sector: 'school' as 'school' | 'university',
    stage_id: '',
    grade_id: '',
    order: 0,
    is_active: true
  })

  const [submitting, setSubmitting] = useState(false)

  // Load all taxonomy data
  const loadData = async () => {
    setLoading(true)
    try {
      const [deptRes, stageRes, gradeRes, subjRes] = await Promise.all([
        API.get('/admin/departments'),
        API.get('/admin/academic-stages'),
        API.get('/admin/academic-grades'),
        API.get('/admin/academic-subjects')
      ])
      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : [])
      setStages(Array.isArray(stageRes.data) ? stageRes.data : [])
      setGrades(Array.isArray(gradeRes.data) ? gradeRes.data : [])
      setSubjects(Array.isArray(subjRes.data) ? subjRes.data : [])
      refreshGlobalTaxonomy(true)
    } catch (err: any) {
      console.error('Error loading taxonomy data:', err)
      showToast('فشل تحميل بيانات الهيكلية والتصنيفات.', 'error')
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
   * ACADEMIC STAGE / FACULTY ACTIONS
   * ========================================================================= */
  const openCreateStage = () => {
    setEditingStage(null)
    setStageForm({
      name: '',
      slug: '',
      sector: sectorFilter === 'university' ? 'university' : 'school',
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
      sector: stg.sector || (stg.slug === 'faclty' || stg.name.includes('جامع') ? 'university' : 'school'),
      order: stg.order ?? 0,
      is_active: !!stg.is_active
    })
    setStageModalOpen(true)
  }

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stageForm.name.trim()) {
      showToast('يرجى إدخال اسم المرحلة أو الكلية.', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (editingStage) {
        await API.put(`/admin/academic-stages/${editingStage.id}`, stageForm)
        showToast('تم تحديث المرحلة/الكلية بنجاح.', 'success')
      } else {
        await API.post('/admin/academic-stages', stageForm)
        showToast('تم إضافة المرحلة/الكلية بنجاح.', 'success')
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
      title: `حذف المرحلة / الكلية "${stg.name}"`,
      description: 'تحذير: سيتم التحقق من عدم وجود كورسات أو معلمين مرتبطين بهذه المرحلة قبل الحذف.',
      type: 'warning',
      buttonText: 'نعم، احذف',
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
   * ACADEMIC GRADE / UNIVERSITY YEAR ACTIONS
   * ========================================================================= */
  const openCreateGrade = () => {
    setEditingGrade(null)
    const defaultStage = stages.find(s => selectedStageFilter !== 'all' ? String(s.id) === selectedStageFilter : true) || stages[0]
    const defaultStageId = defaultStage?.id ? String(defaultStage.id) : ''
    const isUni = defaultStage?.sector === 'university' || defaultStage?.slug === 'faclty'

    setGradeForm({
      stage_id: defaultStageId,
      name: '',
      slug: '',
      short_code: '',
      level_type: isUni ? 'university_year' : 'grade',
      specialization: '',
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
      level_type: grd.level_type || 'grade',
      specialization: grd.specialization || '',
      order: grd.order ?? 0,
      is_active: !!grd.is_active
    })
    setGradeModalOpen(true)
  }

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gradeForm.name.trim() || !gradeForm.stage_id) {
      showToast('يرجى تحديد المرحلة وإدخال اسم الصف / الفرقة.', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (editingGrade) {
        await API.put(`/admin/academic-grades/${editingGrade.id}`, gradeForm)
        showToast('تم تحديث الصف / الفرقة بنجاح.', 'success')
      } else {
        await API.post('/admin/academic-grades', gradeForm)
        showToast('تم إضافة الصف الدراسي / الفرقة بنجاح.', 'success')
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
      title: `حذف "${grd.name}"`,
      description: 'هل أنت متأكد من الحذف؟ سيتم التأكد من عدم وجود كورسات أو معلمين مسجلين.',
      type: 'warning',
      buttonText: 'نعم، احذف',
      onConfirm: async () => {
        try {
          await API.delete(`/admin/academic-grades/${grd.id}`)
          showToast('تم حذف الصف / الفرقة بنجاح.', 'success')
          loadData()
        } catch (err: any) {
          console.error(err)
          showToast(err.response?.data?.message || 'فشل حذف الصف الدراسي.', 'error')
        }
      }
    })
  }

  /* =========================================================================
   * ACADEMIC SUBJECT ACTIONS
   * ========================================================================= */
  const openCreateSubject = () => {
    setEditingSubject(null)
    setSubjectForm({
      name: '',
      slug: '',
      sector: sectorFilter === 'university' ? 'university' : 'school',
      stage_id: selectedStageFilter !== 'all' ? selectedStageFilter : '',
      grade_id: selectedGradeFilter !== 'all' ? selectedGradeFilter : '',
      order: subjects.length + 1,
      is_active: true
    })
    setSubjectModalOpen(true)
  }

  const openEditSubject = (subj: any) => {
    setEditingSubject(subj)
    setSubjectForm({
      name: subj.name,
      slug: subj.slug,
      sector: subj.sector || 'school',
      stage_id: subj.stage_id ? String(subj.stage_id) : '',
      grade_id: subj.grade_id ? String(subj.grade_id) : '',
      order: subj.order ?? 0,
      is_active: !!subj.is_active
    })
    setSubjectModalOpen(true)
  }

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subjectForm.name.trim()) {
      showToast('يرجى إدخال اسم المادة الدراسية.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: subjectForm.name.trim(),
        slug: subjectForm.slug.trim() || undefined,
        sector: subjectForm.sector,
        stage_id: subjectForm.stage_id ? Number(subjectForm.stage_id) : null,
        grade_id: subjectForm.grade_id ? Number(subjectForm.grade_id) : null,
        order: Number(subjectForm.order) || 0,
        is_active: subjectForm.is_active
      }

      if (editingSubject) {
        await API.put(`/admin/academic-subjects/${editingSubject.id}`, payload)
        showToast('تم تحديث المادة الدراسية بنجاح.', 'success')
      } else {
        await API.post('/admin/academic-subjects', payload)
        showToast('تم إضافة المادة الدراسية بنجاح.', 'success')
      }
      setSubjectModalOpen(false)
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'حدث خطأ أثناء حفظ المادة.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleSubject = async (subj: any) => {
    try {
      await API.post(`/admin/academic-subjects/${subj.id}/toggle`)
      showToast(`تم ${subj.is_active ? 'تعطيل' : 'تفعيل'} المادة بنجاح.`, 'success')
      loadData()
    } catch (err: any) {
      console.error(err)
      showToast('فشل تعديل حالة المادة.', 'error')
    }
  }

  const handleDeleteSubject = (subj: any) => {
    showAlert({
      title: `حذف المادة "${subj.name}"`,
      description: 'سيتم التأكد من عدم ارتباط أي كورس أو معلم بهذه المادة قبل الحذف.',
      type: 'warning',
      buttonText: 'نعم، احذف',
      onConfirm: async () => {
        try {
          await API.delete(`/admin/academic-subjects/${subj.id}`)
          showToast('تم حذف المادة الدراسية بنجاح.', 'success')
          loadData()
        } catch (err: any) {
          console.error(err)
          showToast(err.response?.data?.message || 'فشل حذف المادة الدراسية.', 'error')
        }
      }
    })
  }

  // Filtered lists
  const filteredDepartments = departments.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredStages = stages.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.slug || '').toLowerCase().includes(searchQuery.toLowerCase())
    const stageSector = s.sector || (s.slug === 'faclty' || s.name.includes('جامع') || s.name.includes('كلية') ? 'university' : 'school')
    const matchSector = sectorFilter === 'all' || stageSector === sectorFilter
    return matchSearch && matchSector
  })

  const filteredGrades = grades.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || (g.short_code || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchStage = selectedStageFilter === 'all' || String(g.stage_id) === selectedStageFilter

    const stage = stages.find(s => s.id === g.stage_id)
    const stageSector = stage?.sector || (stage?.slug === 'faclty' || stage?.name.includes('جامع') ? 'university' : 'school')
    const matchSector = sectorFilter === 'all' || stageSector === sectorFilter

    return matchSearch && matchStage && matchSector
  })

  const filteredSubjects = subjects.filter(sub => {
    const matchSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) || (sub.slug || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchSector = sectorFilter === 'all' || (sub.sector || 'school') === sectorFilter
    const matchStage = selectedStageFilter === 'all' || String(sub.stage_id) === selectedStageFilter
    const matchGrade = selectedGradeFilter === 'all' || String(sub.grade_id) === selectedGradeFilter
    return matchSearch && matchSector && matchStage && matchGrade
  })

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <SEO 
        title="إدارة هيكلية المنصة والتصنيفات | لوحة الإدارة"
        description="إدارة الأقسام والمراحل والصفوف والفرق الجامعية والمواد الدراسية لمنصة خطوتك التعليمية."
      />

      {/* Header Banner */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-black">
            <FolderTree className="w-4 h-4" />
            <span>نظام التصنيفات الشامل (المدرسي والجامعي)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">إدارة الهيكلية والتصنيفات والمواد</h1>
          <p className="text-xs text-slate-400 font-light max-w-xl">
            تحكم كامل ومرن في القطاعات التعليمية، المراحل والصفوف، الكليات والفرق الجامعية، والمواد الدراسية دون الحاجة لتعديل الكود.
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
              <span>إضافة مسار / قسم</span>
            </button>
          )}

          {activeTab === 'stages' && (
            <button
              onClick={openCreateStage}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-black rounded-2xl shadow-lg shadow-brand-primary/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مرحلة أو كلية</span>
            </button>
          )}

          {activeTab === 'grades' && (
            <button
              onClick={openCreateGrade}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-black rounded-2xl shadow-lg shadow-brand-primary/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة صف أو فرقة جامعية</span>
            </button>
          )}

          {activeTab === 'subjects' && (
            <button
              onClick={openCreateSubject}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-black rounded-2xl shadow-lg shadow-brand-primary/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مادة دراسية جديدة</span>
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
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'departments'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>الأقسام والمسارات ({departments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('stages')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'stages'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>المراحل والكليات ({stages.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('grades')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'grades'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>الصفوف والفرق الجامعية ({grades.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('subjects')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'subjects'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Book className="w-4 h-4" />
            <span>المواد الدراسية ({subjects.length})</span>
          </button>
        </div>

        {/* Sector and Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sector Filter Toggle (for stages, grades, and subjects) */}
          {activeTab !== 'departments' && (
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSectorFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  sectorFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setSectorFilter('school')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  sectorFilter === 'school' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                المدرسي
              </button>
              <button
                type="button"
                onClick={() => setSectorFilter('university')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  sectorFilter === 'university' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                الجامعي
              </button>
            </div>
          )}

          {/* Stage Filter */}
          {(activeTab === 'grades' || activeTab === 'subjects') && (
            <div className="relative w-44">
              <select
                value={selectedStageFilter}
                onChange={(e) => setSelectedStageFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-brand-primary cursor-pointer"
              >
                <option value="all">جميع المراحل / الكليات</option>
                {stages
                  .filter(s => sectorFilter === 'all' || (s.sector || 'school') === sectorFilter)
                  .map((stg) => (
                    <option key={stg.id} value={String(stg.id)}>{stg.name}</option>
                  ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الرمز..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs font-bold text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-primary"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Main Table Content */}
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
              2. STAGES / FACULTIES TAB
              ================================================================ */}
          {activeTab === 'stages' && (
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-black text-slate-400">
                      <th className="p-4">الترتيب</th>
                      <th className="p-4">المرحلة الدراسية / الكلية</th>
                      <th className="p-4">القطاع التعليمي</th>
                      <th className="p-4">المعرف (Slug)</th>
                      <th className="p-4">الصفوف أو الفرق التابعة</th>
                      <th className="p-4 text-center">الحالة</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-semibold text-slate-300">
                    {filteredStages.map((stg) => {
                      const isUni = stg.sector === 'university' || stg.slug === 'faclty' || stg.name.includes('جامع') || stg.name.includes('كلية')
                      return (
                        <tr key={stg.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 text-slate-500 font-mono font-bold">#{stg.order}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl border ${
                                isUni ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              }`}>
                                {isUni ? <Building2 className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                              </div>
                              <div>
                                <span className="font-black text-foreground block">{stg.name}</span>
                                <span className="text-[10px] text-slate-400 font-light block">
                                  {isUni ? 'كلية / مؤسسة جامعية' : 'مرحلة مدرسية عامة'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                              isUni ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            }`}>
                              {isUni ? 'تعليم جامعي' : 'تعليم مدرسي'}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-indigo-400">{stg.slug}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                              <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{stg.grades?.length || 0} {isUni ? 'فرق جامعية' : 'صفوف دراسية'}</span>
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleToggleStage(stg)}
                              className="cursor-pointer inline-flex items-center transition-transform active:scale-95"
                              title={stg.is_active ? 'تعطيل' : 'تفعيل'}
                            >
                              {stg.is_active ? (
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
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              3. GRADES / BANDS TAB
              ================================================================ */}
          {activeTab === 'grades' && (
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-black text-slate-400">
                      <th className="p-4">الترتيب</th>
                      <th className="p-4">الصف الدراسي / الفرقة</th>
                      <th className="p-4">المرحلة / الكلية</th>
                      <th className="p-4">النوع / التخصص</th>
                      <th className="p-4">الكود المختصر</th>
                      <th className="p-4">المعرف (Slug)</th>
                      <th className="p-4 text-center">الحالة</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-semibold text-slate-300">
                    {filteredGrades.map((grd) => {
                      const stage = stages.find(s => s.id === grd.stage_id)
                      const isUni = grd.level_type === 'university_year' || stage?.sector === 'university' || stage?.slug === 'faclty'
                      return (
                        <tr key={grd.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 text-slate-500 font-mono font-bold">#{grd.order}</td>
                          <td className="p-4">
                            <span className="font-black text-foreground block">{grd.name}</span>
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">
                              {stage?.name || 'غير محدد'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-0.5">
                              <span className={`text-[10px] font-bold ${isUni ? 'text-emerald-400' : 'text-indigo-400'}`}>
                                {isUni ? 'فرقة جامعية' : 'صف مدرسي'}
                              </span>
                              {grd.specialization && (
                                <span className="text-[10px] text-slate-400 font-light">
                                  {grd.specialization}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded bg-slate-800/70 text-slate-400 text-[10px] font-mono">
                              {grd.short_code || '-'}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-indigo-400">{grd.slug}</td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleToggleGrade(grd)}
                              className="cursor-pointer inline-flex items-center transition-transform active:scale-95"
                              title={grd.is_active ? 'تعطيل' : 'تفعيل'}
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
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              4. SUBJECTS TAB
              ================================================================ */}
          {activeTab === 'subjects' && (
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-black text-slate-400">
                      <th className="p-4">الترتيب</th>
                      <th className="p-4">اسم المادة الدراسية</th>
                      <th className="p-4">القطاع التعليمي</th>
                      <th className="p-4">المرحلة / الكلية</th>
                      <th className="p-4">الصف / الفرقة</th>
                      <th className="p-4">المعرف (Slug)</th>
                      <th className="p-4">الكورسات المرتبطة</th>
                      <th className="p-4 text-center">الحالة</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-semibold text-slate-300">
                    {filteredSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-slate-500 font-light">
                          لا توجد مواد دراسية مضافة حتى الآن. اضغط على «إضافة مادة دراسية جديدة» للبدء.
                        </td>
                      </tr>
                    ) : (
                      filteredSubjects.map((subj) => {
                        const isUni = subj.sector === 'university'
                        const stage = stages.find(s => s.id === subj.stage_id)
                        const grade = grades.find(g => g.id === subj.grade_id)
                        return (
                          <tr key={subj.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 text-slate-500 font-mono font-bold">#{subj.order}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl border ${
                                  isUni ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                }`}>
                                  <Book className="w-4 h-4" />
                                </div>
                                <span className="font-black text-foreground">{subj.name}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                isUni ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              }`}>
                                {isUni ? 'جامعي' : 'مدرسي'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-slate-300 text-xs font-semibold">
                                {stage?.name || 'متاح لجميع المراحل'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-slate-300 text-xs font-semibold">
                                {grade?.name || 'متاح لجميع الصفوف/الفرق'}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-indigo-400">{subj.slug}</td>
                            <td className="p-4">
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                                <span>{subj.courses_count || 0} كورس</span>
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleToggleSubject(subj)}
                                className="cursor-pointer inline-flex items-center transition-transform active:scale-95"
                                title={subj.is_active ? 'تعطيل' : 'تفعيل'}
                              >
                                {subj.is_active ? (
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
                                  onClick={() => openEditSubject(subj)}
                                  className="p-2 rounded-lg bg-slate-800/80 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-400 transition-colors cursor-pointer"
                                  title="تعديل"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSubject(subj)}
                                  className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
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
                  {editingDept ? 'تعديل بيانات القسم' : 'إضافة قسم / مسار جديد'}
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
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم القسم *</label>
                  <input
                    type="text"
                    required
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    placeholder="مثال: التعليم الجامعي، البرمجة والتطوير"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">المعرف الإنجليزي (Slug)</label>
                  <input
                    type="text"
                    value={deptForm.slug}
                    onChange={(e) => setDeptForm({ ...deptForm, slug: e.target.value })}
                    placeholder="مثال: university, school, tech (يترك فارغاً للتوليد التلقائي)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الوصف التعريفي</label>
                  <textarea
                    rows={2}
                    value={deptForm.description}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                    placeholder="وصف مختصر للقسم يظهر للطلاب..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">الشارة (Badge نصي)</label>
                    <input
                      type="text"
                      value={deptForm.badge}
                      onChange={(e) => setDeptForm({ ...deptForm, badge: e.target.value })}
                      placeholder="مثال: جديد، الأكاديمي"
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

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="dept_active"
                    checked={deptForm.is_active}
                    onChange={(e) => setDeptForm({ ...deptForm, is_active: e.target.checked })}
                    className="rounded border-slate-700 text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="dept_active" className="text-xs font-bold text-slate-200 cursor-pointer">
                    تفعيل هذا القسم وإتاحته للجمهور
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
          MODAL: ADD / EDIT ACADEMIC STAGE / FACULTY
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
                  {editingStage ? 'تعديل المرحلة / الكلية' : 'إضافة مرحلة دراسية أو كلية جديدة'}
                </h3>
                <button
                  onClick={() => setStageModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveStage} className="space-y-4">
                {/* Sector Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">القطاع التعليمي التابع له *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStageForm({ ...stageForm, sector: 'school' })}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        stageForm.sector === 'school'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <School className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-xs">التعليم المدرسي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStageForm({ ...stageForm, sector: 'university' })}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        stageForm.sector === 'university'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Building2 className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-xs">التعليم الجامعي / الكليات</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {stageForm.sector === 'university' ? 'اسم الكلية أو المؤسسة الجامعية *' : 'اسم المرحلة الدراسية *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={stageForm.name}
                    onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                    placeholder={stageForm.sector === 'university' ? 'مثال: كلية التجارة، كلية الهندسة' : 'مثال: المرحلة الثانوية، المرحلة الإعدادية'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">المعرف الإنجليزي (Slug)</label>
                  <input
                    type="text"
                    value={stageForm.slug}
                    onChange={(e) => setStageForm({ ...stageForm, slug: e.target.value })}
                    placeholder="مثال: secondary, commerce, law"
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

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="stage_active"
                    checked={stageForm.is_active}
                    onChange={(e) => setStageForm({ ...stageForm, is_active: e.target.checked })}
                    className="rounded border-slate-700 text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="stage_active" className="text-xs font-bold text-slate-200 cursor-pointer">
                    تفعيل هذه المرحلة / الكلية
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
                    {submitting ? 'جاري الحفظ...' : editingStage ? 'حفظ التعديلات' : 'إضافة'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================================================
          MODAL: ADD / EDIT ACADEMIC GRADE / UNIVERSITY YEAR
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
                  {editingGrade ? 'تعديل الصف / الفرقة' : 'إضافة صف دراسي أو فرقة جامعية'}
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
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">المرحلة أو الكلية التابع لها *</label>
                  <select
                    required
                    value={gradeForm.stage_id}
                    onChange={(e) => {
                      const selectedStg = stages.find(s => String(s.id) === e.target.value)
                      const isUni = selectedStg?.sector === 'university' || selectedStg?.slug === 'faclty'
                      setGradeForm({
                        ...gradeForm,
                        stage_id: e.target.value,
                        level_type: isUni ? 'university_year' : 'grade'
                      })
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary cursor-pointer"
                  >
                    <option value="">اختر المرحلة أو الكلية</option>
                    {stages.map((stg) => (
                      <option key={stg.id} value={String(stg.id)}>
                        {stg.name} ({stg.sector === 'university' ? 'جامعي' : 'مدرسي'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم الصف أو الفرقة الدراسية *</label>
                  <input
                    type="text"
                    required
                    value={gradeForm.name}
                    onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })}
                    placeholder={gradeForm.level_type === 'university_year' ? 'مثال: الفرقة الأولى، الفرقة الثانية' : 'مثال: الصف الثالث الثانوي'}
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
                      placeholder="first_secondary"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">الكود المختصر</label>
                    <input
                      type="text"
                      value={gradeForm.short_code}
                      onChange={(e) => setGradeForm({ ...gradeForm, short_code: e.target.value })}
                      placeholder="٣ث / ف١"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الشعبة أو التخصص (اختياري)</label>
                  <input
                    type="text"
                    value={gradeForm.specialization}
                    onChange={(e) => setGradeForm({ ...gradeForm, specialization: e.target.value })}
                    placeholder="مثال: شعبة محاسبة، عام، لغة إنجليزية"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
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
                    تفعيل هذا الصف / الفرقة
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
                    {submitting ? 'جاري الحفظ...' : editingGrade ? 'حفظ التعديلات' : 'إضافة'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================================================================
          MODAL: ADD / EDIT ACADEMIC SUBJECT
          ================================================================ */}
      <AnimatePresence>
        {subjectModalOpen && (
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
                  {editingSubject ? 'تعديل المادة الدراسية' : 'إضافة مادة دراسية جديدة'}
                </h3>
                <button
                  onClick={() => setSubjectModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSubject} className="space-y-4">
                {/* Sector Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">القطاع التعليمي *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSubjectForm({ ...subjectForm, sector: 'school', stage_id: '', grade_id: '' })}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        subjectForm.sector === 'school'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <School className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-xs">تعليم مدرسي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubjectForm({ ...subjectForm, sector: 'university', stage_id: '', grade_id: '' })}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        subjectForm.sector === 'university'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Building2 className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-xs">تعليم جامعي</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المادة الدراسية *</label>
                  <input
                    type="text"
                    required
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    placeholder={subjectForm.sector === 'university' ? 'مثال: محاسبة مالية، القانون التجاري' : 'مثال: الكيمياء، الفيزياء'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">المعرف الإنجليزي (Slug - اختياري)</label>
                  <input
                    type="text"
                    value={subjectForm.slug}
                    onChange={(e) => setSubjectForm({ ...subjectForm, slug: e.target.value })}
                    placeholder="يترك فارغاً للتوليد التلقائي"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary font-mono"
                  />
                </div>

                {/* Stage / Faculty (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {subjectForm.sector === 'university' ? 'الكلية التابع لها (اختياري)' : 'المرحلة الدراسية (اختياري)'}
                  </label>
                  <select
                    value={subjectForm.stage_id}
                    onChange={(e) => setSubjectForm({ ...subjectForm, stage_id: e.target.value, grade_id: '' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary cursor-pointer"
                  >
                    <option value="">عام لجميع {subjectForm.sector === 'university' ? 'الكليات' : 'المراحل'}</option>
                    {stages
                      .filter(s => (s.sector || 'school') === subjectForm.sector)
                      .map((stg) => (
                        <option key={stg.id} value={String(stg.id)}>{stg.name}</option>
                      ))}
                  </select>
                </div>

                {/* Grade / Band (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {subjectForm.sector === 'university' ? 'الفرقة الجامعية المحددة (اختياري)' : 'الصف الدراسي المحدد (اختياري)'}
                  </label>
                  <select
                    value={subjectForm.grade_id}
                    onChange={(e) => setSubjectForm({ ...subjectForm, grade_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary cursor-pointer"
                  >
                    <option value="">عام لجميع {subjectForm.sector === 'university' ? 'الفرق' : 'الصفوف'}</option>
                    {grades
                      .filter(g => subjectForm.stage_id ? String(g.stage_id) === subjectForm.stage_id : true)
                      .map((grd) => (
                        <option key={grd.id} value={String(grd.id)}>{grd.name}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">ترتيب العرض</label>
                  <input
                    type="number"
                    value={subjectForm.order}
                    onChange={(e) => setSubjectForm({ ...subjectForm, order: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="subject_active"
                    checked={subjectForm.is_active}
                    onChange={(e) => setSubjectForm({ ...subjectForm, is_active: e.target.checked })}
                    className="rounded border-slate-700 text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="subject_active" className="text-xs font-bold text-slate-200 cursor-pointer">
                    تفعيل هذه المادة الدراسية
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSubjectModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'جاري الحفظ...' : editingSubject ? 'حفظ التعديلات' : 'إضافة المادة'}
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
