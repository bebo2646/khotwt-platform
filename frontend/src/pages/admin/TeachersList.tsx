import React from 'react'
import { Link } from 'react-router-dom'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { useAuthStore } from '../../store/authStore'
import { 
  Plus, 
  Check, 
  Edit3, 
  ShieldAlert, 
  ShieldCheck, 
  KeyRound, 
  CheckSquare, 
  X, 
  Copy, 
  CheckCircle2, 
  Trash2, 
  Eye, 
  Loader2, 
  AlertTriangle,
  BookOpen,
  Award,
  Search,
  Filter,
  MoreVertical,
  DollarSign,
  HardDrive,
  Users
} from 'lucide-react'
import EmptyState from '../../components/EmptyState'

interface TeacherItem {
  id: number
  name: string
  email: string
  phone: string
  subject: string
  experience: string
  bio: string
  status: 'active' | 'disabled'
  courses_count: number
  grades: string[]
  avatar?: string
  students_count: number
  discounted_courses_count: number
  teacher_subscription?: {
    id: number
    plan?: {
      id: number
      name: string
      video_storage_gb: number
      student_codes: number
    }
    billing_period: 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
    start_date: string
    end_date: string
    status: string
    used_storage_bytes: number
    total_storage_gb: number
    remaining_storage_gb: number
    total_codes: number
    remaining_codes: number
    remaining_days: number
    storage_percentage: number
    payment_status: string
    final_price?: number | string
  }
}

const SUBJECTS_TRANSLATION: Record<string, string> = {
  chemistry: 'الكيمياء',
  physics: 'الفيزياء',
  biology: 'الأحياء',
  math: 'الرياضيات',
  science: 'العلوم',
  arabic: 'اللغة العربية',
  english: 'اللغة الإنجليزية',
}

const SUBJECTS = [
  { key: 'chemistry', val: 'الكيمياء' },
  { key: 'physics', val: 'الفيزياء' },
  { key: 'biology', val: 'الأحياء' },
  { key: 'math', val: 'الرياضيات' },
  { key: 'science', val: 'العلوم' },
  { key: 'arabic', val: 'اللغة العربية' },
  { key: 'english', val: 'اللغة الإنجليزية' },
]

const GRADES = [
  { key: 'first_preparatory', val: 'الأول الإعدادي' },
  { key: 'second_preparatory', val: 'الثاني الإعدادي' },
  { key: 'third_preparatory', val: 'الثالث الإعدادي' },
  { key: 'first_secondary', val: 'الأول الثانوي' },
  { key: 'second_secondary', val: 'الثاني الثانوي' },
  { key: 'third_secondary', val: 'الثالث الثانوي' },
]

const FIELD_TRANSLATIONS: Record<string, string> = {
  name: 'الاسم الكامل',
  phone: 'رقم الهاتف',
  subject: 'المادة العلمية',
  experience: 'الخبرة المهنية',
  grades: 'المراحل الدراسية',
  avatar: 'الصورة الشخصية',
  bio: 'النبذة التعريفية',
  status: 'حالة الحساب',
}

export default function TeachersList() {
  const { user } = useAuthStore()
  const [teachers, setTeachers] = React.useState<TeacherItem[]>([])
  const [loading, setLoading] = React.useState(true)
  
  // Filters & Dropdowns State
  const [searchTerm, setSearchTerm] = React.useState('')
  const [selectedSubject, setSelectedSubject] = React.useState('')
  const [selectedPlan, setSelectedPlan] = React.useState('')
  const [selectedPaymentStatus, setSelectedPaymentStatus] = React.useState('')
  const [selectedSubStatus, setSelectedSubStatus] = React.useState('')
  const [activeDropdownTeacherId, setActiveDropdownTeacherId] = React.useState<number | null>(null)
  const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number, left: number, isAbove: boolean } | null>(null)
  const [activeTeacher, setActiveTeacher] = React.useState<any>(null)
  const [dropdownSource, setDropdownSource] = React.useState<'desktop' | 'mobile'>('desktop')

  const handleDropdownToggle = (e: React.MouseEvent<HTMLButtonElement>, teacher: any, source: 'desktop' | 'mobile') => {
    e.stopPropagation();
    if (activeDropdownTeacherId === teacher.id) {
      setActiveDropdownTeacherId(null);
      setDropdownPosition(null);
      setActiveTeacher(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = source === 'desktop' ? 260 : 210;
      const menuWidth = 192;
      
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let topVal = rect.bottom + 8;
      let isAbove = false;
      
      if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
        topVal = rect.top - menuHeight - 8;
        isAbove = true;
      }
      
      let leftVal = rect.right - menuWidth;
      
      if (leftVal < 16) {
        leftVal = 16;
      }
      if (leftVal + menuWidth > window.innerWidth - 16) {
        leftVal = window.innerWidth - menuWidth - 16;
      }
      
      setDropdownPosition({ top: topVal, left: leftVal, isAbove });
      setActiveDropdownTeacherId(teacher.id);
      setActiveTeacher(teacher);
      setDropdownSource(source);
    }
  };

  React.useEffect(() => {
    const handleScrollOrResize = () => {
      setActiveDropdownTeacherId(null);
      setDropdownPosition(null);
      setActiveTeacher(null);
    };

    if (activeDropdownTeacherId) {
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeDropdownTeacherId]);
  
  // Bulk delete states
  const [showBulkDeleteModal, setShowBulkDeleteModal] = React.useState(false)
  const [confirmPhrase, setConfirmPhrase] = React.useState('')
  const [bulkDeleting, setBulkDeleting] = React.useState(false)
  const [errorCourses, setErrorCourses] = React.useState<any[]>([])

  // Modals & triggers
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [showCredentialsPopup, setShowCredentialsPopup] = React.useState<any>(null) // { email, password }
  const [editTeacher, setEditTeacher] = React.useState<TeacherItem | null>(null)

  // New Management Modals
  const [resetPasswordTeacher, setResetPasswordTeacher] = React.useState<TeacherItem | null>(null)
  const [newPasswordVal, setNewPasswordVal] = React.useState('')
  const [resettingPassword, setResettingPassword] = React.useState(false)

  const [deleteTeacherItem, setDeleteTeacherItem] = React.useState<TeacherItem | null>(null)
  const [deleteActionType, setDeleteActionType] = React.useState<'delete_all' | 'transfer'>('delete_all')
  const [transferTeacherId, setTransferTeacherId] = React.useState<string>('')
  const [deletingTeacher, setDeletingTeacher] = React.useState(false)

  const [viewTeacherItem, setViewTeacherItem] = React.useState<TeacherItem | null>(null)
  const [teacherProfileData, setTeacherProfileData] = React.useState<any>(null)
  const [loadingProfile, setLoadingProfile] = React.useState(false)

  // Add/Edit Form Inputs
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [subject, setSubject] = React.useState('')
  const [experience, setExperience] = React.useState('')
  const [bio, setBio] = React.useState('')
  const [selectedGrades, setSelectedGrades] = React.useState<string[]>([])
  const [status, setStatus] = React.useState<'active' | 'disabled'>('active')
  const [avatar, setAvatar] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  
  const [saving, setSaving] = React.useState(false)

  const fetchTeachers = () => {
    setLoading(true)
    API.get('/admin/teachers')
      .then((res) => {
        setTeachers(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  React.useEffect(() => {
    fetchTeachers()
  }, [])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const res = await API.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      setAvatar(res.data.url)
      useModalStore.getState().showToast('تم رفع الصورة بنجاح.', 'success')
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل رفع الصورة. تأكد من حجم ونوع الملف.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleGradeToggle = (gradeKey: string) => {
    setSelectedGrades((prev) => {
      if (prev.includes(gradeKey)) {
        return prev.filter((g) => g !== gradeKey)
      } else {
        return [...prev, gradeKey]
      }
    })
  }

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedGrades.length === 0) {
      useModalStore.getState().showToast('يجب تحديد مرحلة دراسية واحدة على الأقل.', 'warning')
      return
    }

    setSaving(true)
    const payload = {
      name,
      phone,
      subject,
      experience,
      bio,
      grades: selectedGrades,
      status,
      avatar,
    }

    try {
      if (editTeacher) {
        await API.put(`/admin/teachers/${editTeacher.id}`, payload)
        useModalStore.getState().showToast('تم تعديل بيانات المعلم بنجاح.', 'success')
        setEditTeacher(null)
        setShowAddForm(false)
        clearForm()
        fetchTeachers()
      } else {
        const res = await API.post('/admin/teachers', payload)
        // Show generated credentials popup
        setShowCredentialsPopup({
          email: res.data.generated_email,
          password: res.data.temporary_password,
        })
        setShowAddForm(false)
        clearForm()
        fetchTeachers()
      }
    } catch (err: any) {
      console.error("Teacher Save Validation Error Details:", err)
      if (err.response?.data?.errors) {
        const errors = err.response.data.errors
        const errorMsg = Object.entries(errors)
          .map(([field, msgs]: any) => {
            const translatedField = FIELD_TRANSLATIONS[field] || field
            return `- ${translatedField}: ${msgs.join(', ')}`
          })
          .join('\n')
        useModalStore.getState().showAlert({
          title: 'خطأ في الحقول المعبأة',
          description: `فشل حفظ المعلم بسبب أخطاء في الحقول التالية:\n${errorMsg}`,
          type: 'error'
        })
      } else if (err.response?.data?.message) {
        useModalStore.getState().showToast(`فشل الحفظ: ${err.response.data.message}`, 'error')
      } else {
        useModalStore.getState().showToast('خطأ في تعبئة البيانات. يرجى التأكد من ملء جميع الحقول المطلوبة بالشكل الصحيح.', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleEditClick = (t: TeacherItem) => {
    setEditTeacher(t)
    setName(t.name)
    setPhone(t.phone)
    setSubject(t.subject)
    setExperience(t.experience)
    setBio(t.bio)
    setSelectedGrades(t.grades || [])
    setStatus(t.status)
    setAvatar(t.avatar || '')
    setShowAddForm(true)
  }

  // Admin resets teacher password by inputting the new password
  const handleResetPasswordClick = (t: TeacherItem) => {
    setResetPasswordTeacher(t)
    setNewPasswordVal('')
  }

  const submitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordTeacher) return
    if (newPasswordVal.length < 6) {
      useModalStore.getState().showToast('يجب أن تكون كلمة المرور من 6 أحرف على الأقل.', 'error')
      return
    }

    setResettingPassword(true)
    try {
      await API.post(`/admin/teachers/${resetPasswordTeacher.id}/reset-password`, {
        password: newPasswordVal
      })
      useModalStore.getState().showToast('تم إعادة تعيين كلمة مرور المعلم بنجاح.', 'success')
      setResetPasswordTeacher(null)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل إعادة تعيين كلمة المرور.', 'error')
    } finally {
      setResettingPassword(false)
    }
  }

  // Toggle user status (Disable / Enable)
  const handleToggleStatus = (t: TeacherItem) => {
    const isEnabling = t.status !== 'active'
    useModalStore.getState().showConfirm({
      title: 'تغيير حالة حساب المعلم',
      description: `هل أنت متأكد من ${isEnabling ? 'تفعيل' : 'تعطيل'} حساب المعلم "${t.name}"؟`,
      confirmText: isEnabling ? 'تفعيل الحساب' : 'تعطيل الحساب',
      cancelText: 'إلغاء',
      type: 'warning',
      onConfirm: async () => {
        try {
          if (isEnabling) {
            await API.post(`/admin/users/${t.id}/enable`)
          } else {
            await API.post(`/admin/users/${t.id}/disable`)
          }
          useModalStore.getState().showToast('تم تغيير حالة حساب المعلم بنجاح.', 'success')
          fetchTeachers()
        } catch (err) {
          console.error(err)
          useModalStore.getState().showToast('فشل تغيير حالة الحساب.', 'error')
        }
      }
    })
  }

  // View teacher profile & courses details
  const handleViewTeacherClick = async (t: TeacherItem) => {
    setViewTeacherItem(t)
    setLoadingProfile(true)
    setTeacherProfileData(null)
    try {
      const res = await API.get(`/teachers/${t.id}`)
      setTeacherProfileData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingProfile(false)
    }
  }

  // Handle teacher deletion
  const handleDeleteTeacherClick = (t: TeacherItem) => {
    setDeleteTeacherItem(t)
    setDeleteActionType('delete_all')
    setTransferTeacherId('')
  }

  const submitDeleteTeacher = async () => {
    if (!deleteTeacherItem) return
    setDeletingTeacher(true)
    try {
      const payload: any = {}
      if (deleteTeacherItem.courses_count > 0) {
        payload.action = deleteActionType
        if (deleteActionType === 'transfer') {
          if (!transferTeacherId) {
            useModalStore.getState().showToast('الالرجاء اختيار المعلم لنقل الكورسات إليه.', 'warning')
            setDeletingTeacher(false)
            return
          }
          payload.transfer_to_teacher_id = Number(transferTeacherId)
        }
      }

      await API.delete(`/admin/teachers/${deleteTeacherItem.id}`, { data: payload })
      useModalStore.getState().showToast('تم حذف حساب المعلم بنجاح.', 'success')
      setDeleteTeacherItem(null)
      fetchTeachers()
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل حذف حساب المعلم.', 'error')
    } finally {
      setDeletingTeacher(false)
    }
  }

  const clearForm = () => {
    setName('')
    setPhone('')
    setSubject('')
    setExperience('')
    setBio('')
    setSelectedGrades([])
    setStatus('active')
    setAvatar('')
  }

  const filteredTeachers = React.useMemo(() => {
    return teachers.filter((t) => {
      const matchName = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        t.phone.includes(searchTerm);
      const matchSubject = !selectedSubject || t.subject === selectedSubject;
      
      const planName = t.teacher_subscription?.plan?.name || 'Starter';
      const matchPlan = !selectedPlan || planName.toLowerCase() === selectedPlan.toLowerCase();
      
      const payStatus = t.teacher_subscription?.payment_status || 'Pending';
      const matchPayment = !selectedPaymentStatus || payStatus.toLowerCase() === selectedPaymentStatus.toLowerCase();
      
      const subStatus = t.teacher_subscription?.status || 'Active';
      const matchSub = !selectedSubStatus || subStatus.toLowerCase() === selectedSubStatus.toLowerCase();
      
      return matchName && matchSubject && matchPlan && matchPayment && matchSub;
    });
  }, [teachers, searchTerm, selectedSubject, selectedPlan, selectedPaymentStatus, selectedSubStatus]);

  const revenueThisMonth = React.useMemo(() => {
    return teachers.reduce((sum, t) => {
      const sub = t.teacher_subscription;
      if (sub && sub.payment_status?.toLowerCase() === 'paid') {
        return sum + (Number(sub.final_price) || 0);
      }
      return sum;
    }, 0);
  }, [teachers]);

  const teachersNearExpiry = React.useMemo(() => {
    return teachers.filter((t) => {
      const sub = t.teacher_subscription;
      if (!sub) return false;
      return sub.status?.toLowerCase() === 'active' && sub.remaining_days <= 7 && sub.remaining_days > 0;
    }).length;
  }, [teachers]);

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-right" dir="rtl">
      
      {/* Title bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 border-b border-[var(--border-color)] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-[var(--text-color)]">إدارة حسابات المعلمين</h1>
            {user?.role === 'admin' && (user?.is_super_admin || user?.is_super) && (
              <button
                onClick={() => {
                  setShowBulkDeleteModal(true);
                  setErrorCourses([]);
                  setConfirmPhrase('');
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-lg shadow-red-600/10 hover:shadow-red-600/20"
              >
                <span>🗑 حذف جميع المعلمين</span>
              </button>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)] font-light mt-1">أنشئ حسابات للمعلمين، عطل صلاحياتهم، أعد تعيين كلمات مرورهم، أو احذف حساباتهم بالكامل.</p>
        </div>
        <Link
          to="/admin/teachers/create"
          className="px-6 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[var(--primary-color)]/20 w-fit transition-all"
        >
          <Plus className="h-4.5 w-4.5" /> <span>إضافة معلم جديد</span>
        </Link>
      </div>

      {/* Statistics Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* Total Teachers Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)] font-medium">إجمالي المعلمين</span>
            <h3 className="text-2xl font-black text-[var(--text-color)]">{teachers.length}</h3>
          </div>
          <div className="p-3 bg-[var(--primary-color)]/10 rounded-xl">
            <Users className="w-6 h-6 text-[var(--primary-color)]" />
          </div>
        </div>

        {/* Active Teachers Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)] font-medium">المعلمين النشطين</span>
            <h3 className="text-2xl font-black text-[var(--success-color)]">{teachers.filter(t => t.status === 'active').length}</h3>
          </div>
          <div className="p-3 bg-[var(--success-color)]/10 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-[var(--success-color)]" />
          </div>
        </div>

        {/* Expired Subscriptions Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)] font-medium">اشتراكات منتهية</span>
            <h3 className="text-2xl font-black text-[var(--danger-color)]">{teachers.filter(t => t.teacher_subscription?.status?.toLowerCase() === 'expired').length}</h3>
          </div>
          <div className="p-3 bg-[var(--danger-color)]/10 rounded-xl">
            <ShieldAlert className="w-6 h-6 text-[var(--danger-color)]" />
          </div>
        </div>

        {/* Revenue This Month Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)] font-medium">إيرادات هذا الشهر</span>
            <h3 className="text-2xl font-black text-[var(--success-color)]">{revenueThisMonth.toFixed(2)} ج.م</h3>
          </div>
          <div className="p-3 bg-[var(--success-color)]/10 rounded-xl">
            <DollarSign className="w-6 h-6 text-[var(--success-color)]" />
          </div>
        </div>

        {/* Teachers Near Expiry Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)] font-medium">مدرسين أوشك اشتراكهم على الانتهاء</span>
            <h3 className="text-2xl font-black text-[var(--warning-color)]">{teachersNearExpiry}</h3>
          </div>
          <div className="p-3 bg-[var(--warning-color)]/10 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-[var(--warning-color)]" />
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl space-y-4 shadow-sm">
        <h4 className="text-xs font-bold text-[var(--text-color)] flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-[var(--primary-color)]" />
          تصفية وفلترة قائمة المعلمين
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث باسم المعلم، البريد، الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl pr-9 pl-4 py-2.5 text-xs focus:outline-none text-[var(--text-color)]"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          </div>

          {/* Subject Filter */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-[var(--text-color)]"
          >
            <option value="">كل التخصصات والمواد</option>
            {SUBJECTS.map((s) => (
              <option key={s.key} value={s.key}>{s.val}</option>
            ))}
          </select>

          {/* Plan Filter */}
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-[var(--text-color)]"
          >
            <option value="">كل باقات الاشتراك</option>
            <option value="starter">Starter</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="academy">Academy</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-[var(--text-color)]"
          >
            <option value="">حالة السداد الفاتورة</option>
            <option value="paid">مدفوعة (Paid)</option>
            <option value="pending">معلقة (Pending)</option>
            <option value="unpaid">غير مدفوعة (Unpaid)</option>
          </select>

          {/* Subscription Status Filter */}
          <select
            value={selectedSubStatus}
            onChange={(e) => setSelectedSubStatus(e.target.value)}
            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-[var(--text-color)]"
          >
            <option value="">حالة الاشتراك بالباقة</option>
            <option value="active">نشط (Active)</option>
            <option value="expiring soon">يوشك على الانتهاء</option>
            <option value="expired">منتهي (Expired)</option>
            <option value="suspended">موقف (Suspended)</option>
          </select>

          {/* Reset button */}
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedSubject('');
              setSelectedPlan('');
              setSelectedPaymentStatus('');
              setSelectedSubStatus('');
            }}
            className="px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] hover:border-[var(--text-secondary)] text-[var(--text-color)] text-xs font-bold rounded-xl cursor-pointer transition-all"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      </div>

      {/* Teachers Catalog Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin h-8 w-8 text-[var(--primary-color)]" />
        </div>
      ) : filteredTeachers.length === 0 ? (
        <EmptyState
          type="teachers"
          title="لا يوجد معلمون يطابقون خيارات البحث"
          description="تأكد من خيارات الفلترة المحددة أو ابدأ بإضافة معلم جديد."
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[var(--bg-color)]/20 border-b border-[var(--border-color)] text-[var(--text-secondary)] text-[10px] sm:text-xs">
                    <th className="p-4 font-bold">المعلم</th>
                    <th className="p-4 font-bold">التخصص والهاتف</th>
                    <th className="p-4 font-bold">الباقة الحالية</th>
                    <th className="p-4 font-bold">دورة الدفع</th>
                    <th className="p-4 font-bold">حالة الاشتراك</th>
                    <th className="p-4 font-bold">حالة السداد</th>
                    <th className="p-4 font-bold">الطلاب النشطون</th>
                    <th className="p-4 font-bold">السعة المتبقية</th>
                    <th className="p-4 font-bold">التخزين</th>
                    <th className="p-4 font-bold">الخصومات</th>
                    <th className="p-4 font-bold text-center">خيارات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {filteredTeachers.map((t: any) => {
                    const planName = t.teacher_subscription?.plan?.name || 'Starter';
                    const billing = t.teacher_subscription?.billing_period === 'annual' ? 'سنوي' : t.teacher_subscription?.billing_period === 'semi_annual' ? 'نصف سنوي' : t.teacher_subscription?.billing_period === 'quarterly' ? '3 أشهر' : 'شهري';
                    const subStatus = t.teacher_subscription?.status || 'Active';
                    const payStatus = t.teacher_subscription?.payment_status || 'Pending';
                    const remainingDays = t.teacher_subscription ? t.teacher_subscription.remaining_days : 0;
                    const totalCodes = t.teacher_subscription ? t.teacher_subscription.total_codes : 50;
                    const usedCodes = t.teacher_subscription ? t.teacher_subscription.used_codes : 0;
                    const remainingCodes = t.teacher_subscription ? t.teacher_subscription.remaining_codes : 50;
                    const totalStorage = t.teacher_subscription ? t.teacher_subscription.total_storage_gb : 10;
                    const usedStorageGb = t.teacher_subscription ? (t.teacher_subscription.used_storage_bytes / (1024 * 1024 * 1024)).toFixed(2) : '0.00';
                    const storagePct = t.teacher_subscription ? t.teacher_subscription.storage_percentage : 0;

                    return (
                      <tr key={t.id} className="hover:bg-[var(--bg-color)]/20 transition-colors text-xs">
                        {/* Avatar & Name */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={t.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                              alt={t.name}
                              className="h-10 w-10 object-cover rounded-full border border-[var(--border-color)] bg-slate-800"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
                              }}
                            />
                            <div className="space-y-0.5 text-right">
                              <div className="text-[var(--text-color)] font-bold">{t.name}</div>
                              <div className="text-[10px] text-[var(--text-secondary)] font-light">{t.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Subject & Phone */}
                        <td className="p-4">
                          <div className="font-bold text-[var(--primary-color)]">{SUBJECTS_TRANSLATION[t.subject] || t.subject}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] font-light mt-0.5">{t.phone}</div>
                        </td>

                        {/* Current Plan */}
                        <td className="p-4 font-bold text-[var(--text-color)]">
                          {planName}
                        </td>

                        {/* Billing Cycle */}
                        <td className="p-4 text-[var(--text-color)] font-medium">
                          {billing}
                        </td>

                        {/* Subscription Status badge */}
                        <td className="p-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-bold border ${
                            subStatus.toLowerCase() === 'active'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-[var(--success-color)]'
                              : subStatus.toLowerCase() === 'expiring soon'
                              ? 'bg-amber-500/10 border-amber-500/20 text-[var(--warning-color)]'
                              : 'bg-rose-500/10 border-rose-500/20 text-[var(--danger-color)]'
                          }`}>
                            {subStatus === 'Active' ? 'نشط' : subStatus === 'Expired' ? 'منتهي' : subStatus === 'Suspended' ? 'موقف' : subStatus}
                          </span>
                        </td>

                        {/* Payment Status badge */}
                        <td className="p-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-bold border ${
                            payStatus.toLowerCase() === 'paid'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-[var(--success-color)]'
                              : payStatus.toLowerCase() === 'pending'
                              ? 'bg-amber-500/10 border-amber-500/20 text-[var(--warning-color)]'
                              : 'bg-rose-500/10 border-rose-500/20 text-[var(--danger-color)]'
                          }`}>
                            {payStatus === 'Paid' ? 'مدفوعة' : payStatus === 'Pending' ? 'معلقة' : 'غير مدفوعة'}
                          </span>
                        </td>

                        {/* Active Students */}
                        <td className="p-4 font-bold text-[var(--text-color)]">
                          {usedCodes} طالب
                        </td>

                        {/* Remaining Capacity */}
                        <td className="p-4">
                          <div>
                            <span className="font-bold text-[var(--text-color)]">{remainingCodes}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] font-light"> من {totalCodes}</span>
                          </div>
                        </td>

                        {/* Storage */}
                        <td className="p-4">
                          <div className="space-y-1 w-24">
                            <div className="flex justify-between text-[9px] text-[var(--text-secondary)]">
                              <span>{usedStorageGb} GB</span>
                              <span>من {totalStorage}</span>
                            </div>
                            <div className="w-full bg-[var(--bg-color)] rounded-full h-1">
                              <div 
                                className="bg-[var(--primary-color)] h-1 rounded-full animate-pulse-glow" 
                                style={{ width: `${Math.min(100, storagePct || 0)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Discount Status */}
                        <td className="p-4">
                          {t.discounted_courses_count > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] border font-bold bg-emerald-500/10 border-emerald-500/20 text-brand-success">
                              مفعل ({t.discounted_courses_count})
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] border font-bold bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-secondary)]">
                              غير نشط
                            </span>
                          )}
                        </td>

                        {/* Actions menu dropdown */}
                        <td className="p-4">
                          <div className="flex justify-center">
                            <button
                              onClick={(e) => handleDropdownToggle(e, t, 'desktop')}
                              className="p-2 hover:bg-[var(--bg-color)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-color)] cursor-pointer transition-all"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Responsive Grid View */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:hidden">
            {filteredTeachers.map((t: any) => {
              const planName = t.teacher_subscription?.plan?.name || 'Starter';
              const billing = t.teacher_subscription?.billing_period === 'annual' ? 'سنوي' : t.teacher_subscription?.billing_period === 'semi_annual' ? 'نصف سنوي' : t.teacher_subscription?.billing_period === 'quarterly' ? '3 أشهر' : 'شهري';
              const subStatus = t.teacher_subscription?.status || 'Active';
              const payStatus = t.teacher_subscription?.payment_status || 'Pending';
              const remainingDays = t.teacher_subscription ? t.teacher_subscription.remaining_days : 0;
              const totalCodes = t.teacher_subscription ? t.teacher_subscription.total_codes : 50;
              const usedCodes = t.teacher_subscription ? t.teacher_subscription.used_codes : 0;
              const totalStorage = t.teacher_subscription ? t.teacher_subscription.total_storage_gb : 10;
              const usedStorageGb = t.teacher_subscription ? (t.teacher_subscription.used_storage_bytes / (1024 * 1024 * 1024)).toFixed(2) : '0.00';
              const storagePct = t.teacher_subscription ? t.teacher_subscription.storage_percentage : 0;

              return (
                <div key={t.id} className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-6 space-y-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-4">
                    <img
                      src={t.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                      alt={t.name}
                      className="h-14 w-14 object-cover rounded-full border border-[var(--border-color)] bg-slate-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
                      }}
                    />
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-[var(--text-color)]">{t.name}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">{t.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-[var(--primary-color)]/10 text-[var(--primary-color)] px-2 py-0.5 rounded font-bold">
                          {SUBJECTS_TRANSLATION[t.subject] || t.subject}
                        </span>
                        <button
                          onClick={() => handleToggleStatus(t)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                            t.status === 'active'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-brand-success'
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                          }`}
                        >
                          {t.status === 'active' ? 'نشط' : 'معطل'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border-color)] pt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[var(--text-secondary)] block">الباقة:</span>
                      <span className="font-bold text-[var(--text-color)]">{planName} ({billing})</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)] block">تاريخ الانتهاء:</span>
                      <span className="font-bold text-[var(--text-color)]">
                        {t.teacher_subscription?.end_date ? new Date(t.teacher_subscription.end_date).toLocaleDateString('ar-EG') : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)] block">الحالة / السداد:</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          subStatus.toLowerCase() === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-[var(--success-color)]' : 'bg-rose-500/10 border-rose-500/20 text-[var(--danger-color)]'
                        }`}>
                          {subStatus === 'Active' ? 'نشط' : subStatus}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          payStatus.toLowerCase() === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20 text-[var(--success-color)]' : 'bg-amber-500/10 border-amber-500/20 text-[var(--warning-color)]'
                        }`}>
                          {payStatus === 'Paid' ? 'مدفوعة' : payStatus}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)] block">المتبقي:</span>
                      <span className="font-bold text-[var(--warning-color)]">{remainingDays} يوم</span>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border-color)] pt-3 space-y-2.5 text-xs">
                    {/* Student Capacity */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-[var(--text-secondary)]">
                        <span>الطلاب النشطون: <strong className="text-[var(--text-color)]">{usedCodes}</strong></span>
                        <span>سعة الأكواد: {totalCodes}</span>
                      </div>
                      <div className="w-full bg-[var(--bg-color)] rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-[var(--primary-color)] h-1.5 rounded-full" 
                          style={{ width: `${Math.min(100, (usedCodes / totalCodes) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Video Storage */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-[var(--text-secondary)]">
                        <span>الفيديو المستخدم: <strong className="text-[var(--text-color)]">{usedStorageGb} GB</strong></span>
                        <span>السعة: {totalStorage} GB</span>
                      </div>
                      <div className="w-full bg-[var(--bg-color)] rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-1.5 rounded-full" 
                          style={{ width: `${Math.min(100, storagePct)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions mobile panel dropdown */}
                  <div className="border-t border-[var(--border-color)] pt-3 flex flex-wrap gap-2 justify-end relative">
                    <button
                      onClick={() => handleViewTeacherClick(t)}
                      className="px-2.5 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg text-xs font-bold hover:bg-[var(--border-color)] transition-all cursor-pointer"
                    >
                      عرض الملف
                    </button>
                    <button
                      onClick={() => handleEditClick(t)}
                      className="px-2.5 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg text-xs font-bold hover:bg-[var(--border-color)] transition-all cursor-pointer"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={(e) => handleDropdownToggle(e, t, 'mobile')}
                      className="px-2.5 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-xs font-bold hover:bg-[var(--border-color)] transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>المزيد</span>
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ==========================================================================
          MODALS & OVERLAYS
          ========================================================================== */}

      {/* 1. Add/Edit Teacher Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/20" onClick={() => setShowAddForm(false)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-lg font-black border-b border-[var(--border-color)] pb-3 text-slate-200">
              {editTeacher ? 'تعديل بيانات المعلم' : 'إضافة حساب معلم جديد'}
            </h3>
            
            <form onSubmit={handleSaveTeacher} className="space-y-4 text-right">
              
              {/* Profile Image Upload */}
              <div className="space-y-2">
                <label className="text-xs font-semibold block text-slate-300">الصورة الشخصية</label>
                <div className="flex items-center gap-4 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] p-4 rounded-2xl">
                  <div className="relative h-16 w-16 shrink-0 rounded-full border border-[var(--border-color)] overflow-hidden bg-slate-800 flex items-center justify-center">
                    {avatar ? (
                      <img src={avatar} alt="Avatar Preview" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-light">لا توجد صورة</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="text-xs text-slate-400 file:ml-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer"
                    />
                  </div>
                  {uploading && <div className="text-xs text-brand-primary animate-pulse font-bold">جاري الرفع...</div>}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">اسم المعلم بالكامل</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أ. محمد علي..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">رقم الهاتف</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">المادة العلمية المقررة</label>
                <select
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-slate-200"
                >
                  <option value="">اختر المادة العلمية...</option>
                  {SUBJECTS.map((s) => (
                    <option key={s.key} value={s.key}>{s.val}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">خبرة المدرس وسنوات التدريس</label>
                <input
                  type="text"
                  required
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="مثال: خبرة 10 سنوات بوزارة التربية والتعليم..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">نبذة تعريفية للملف (Bio)</label>
                <textarea
                  rows={2}
                  value={bio || ''}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="نبذة مبسطة تظهر للطلاب في الملف التعريفي للمدرس..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl p-4 text-xs focus:outline-none text-slate-200"
                />
              </div>

              {/* Grades checkbox list */}
              <div className="space-y-2">
                <label className="text-xs font-semibold block text-slate-300">اختر المراحل الدراسية التي يدرسها المعلم:</label>
                <div className="grid grid-cols-2 gap-2 border border-[var(--border-color)] p-4 rounded-2xl bg-[rgba(0,0,0,0.05)]">
                  {GRADES.map((g) => {
                    const isChecked = selectedGrades.includes(g.key)
                    return (
                      <button
                        type="button"
                        key={g.key}
                        onClick={() => handleGradeToggle(g.key)}
                        className={`p-2.5 text-center text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'border-brand-primary bg-brand-primary/5 text-slate-100'
                            : 'border-[var(--border-color)] text-slate-400 hover:bg-[rgba(255,255,255,0.02)]'
                        }`}
                      >
                        {g.val}
                      </button>
                    )
                  })}
                </div>
              </div>

              {editTeacher && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">حالة الحساب</label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-slate-200"
                  >
                    <option value="active">نشط ومفعل</option>
                    <option value="disabled">معطل وموقوف</option>
                  </select>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl cursor-pointer text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ البيانات'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 2. Admin resets teacher password modal */}
      {resetPasswordTeacher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/20" onClick={() => setResetPasswordTeacher(null)} />
          <form onSubmit={submitResetPassword} className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl z-10">
            <h3 className="text-lg font-black text-slate-200 flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <KeyRound className="h-5 w-5 text-brand-primary" />
              <span>إعادة تعيين كلمة المرور</span>
            </h3>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              اكتب كلمة المرور الجديدة للمعلم <span className="font-bold text-brand-primary">"{resetPasswordTeacher.name}"</span>. 
              سيتم فرض تغيير كلمة المرور عليه في تسجيل الدخول القادم.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">كلمة المرور الجديدة</label>
              <input
                type="text"
                required
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                placeholder="••••••"
                className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-primary font-mono text-left"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResetPasswordTeacher(null)}
                className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl cursor-pointer text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={resettingPassword}
                className="px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {resettingPassword ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Delete Teacher Modal with Warning & Options */}
      {deleteTeacherItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/20" onClick={() => setDeleteTeacherItem(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-lg font-black text-slate-200 flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              <span>تأكيد حذف حساب المعلم</span>
            </h3>

            <p className="text-xs text-slate-300 font-light leading-relaxed">
              هل أنت متأكد من رغبتك في حذف حساب المعلم <span className="font-bold text-rose-500">"{deleteTeacherItem.name}"</span>؟ هذا الإجراء لا يمكن التراجع عنه.
            </p>

            {/* Warn if teacher has courses */}
            {deleteTeacherItem.courses_count > 0 && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl space-y-4">
                <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  <span>تنبيه: هذا المعلم لديه {deleteTeacherItem.courses_count} كورسات مرتبطة!</span>
                </div>
                <p className="text-[10px] text-slate-400 font-light leading-normal">
                  يرجى تحديد الإجراء المناسب للتعامل مع هذه الكورسات قبل حذف المعلم:
                </p>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input 
                      type="radio" 
                      name="delete_action"
                      checked={deleteActionType === 'delete_all'}
                      onChange={() => setDeleteActionType('delete_all')}
                      className="accent-brand-primary"
                    />
                    <span>حذف المعلم وكافة الكورسات المرتبطة به.</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input 
                      type="radio" 
                      name="delete_action"
                      checked={deleteActionType === 'transfer'}
                      onChange={() => setDeleteActionType('transfer')}
                      className="accent-brand-primary"
                    />
                    <span>نقل الكورسات إلى معلم آخر ثم حذف الحساب.</span>
                  </label>
                </div>

                {deleteActionType === 'transfer' && (
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[10px] font-bold text-slate-300 block">اختر المعلم البديل لنقل الكورسات إليه:</label>
                    <select
                      value={transferTeacherId}
                      onChange={(e) => setTransferTeacherId(e.target.value)}
                      className="w-full bg-slate-950 border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="">اختر المعلم البديل...</option>
                      {teachers
                        .filter((t) => t.id !== deleteTeacherItem.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>{t.name} ({SUBJECTS_TRANSLATION[t.subject] || t.subject})</option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTeacherItem(null)}
                className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl text-slate-300 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={submitDeleteTeacher}
                disabled={deletingTeacher}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {deletingTeacher ? 'جاري الحذف...' : 'تأكيد الحذف النهائي'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. View Teacher Profile & Courses Modal */}
      {viewTeacherItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/20" onClick={() => setViewTeacherItem(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-2xl w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] z-10 text-right">
            
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-lg font-black text-slate-200">تفاصيل حساب المعلم ومراجعة الكورسات</h3>
              <button 
                onClick={() => setViewTeacherItem(null)} 
                className="p-1.5 hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {loadingProfile ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin h-8 w-8 text-brand-primary" />
              </div>
            ) : teacherProfileData ? (
              <div className="space-y-6">
                
                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-[rgba(255,255,255,0.005)] border border-[var(--border-color)] p-5 rounded-2xl">
                  <img
                    src={teacherProfileData.teacher.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                    alt={teacherProfileData.teacher.name}
                    className="h-16 w-16 object-cover rounded-full border border-brand-primary bg-slate-800"
                  />
                  <div className="space-y-1 text-center sm:text-right">
                    <h4 className="font-black text-base text-slate-200">{teacherProfileData.teacher.name}</h4>
                    <div className="text-xs text-brand-primary font-bold">مدرس {SUBJECTS_TRANSLATION[teacherProfileData.teacher.subject] || teacherProfileData.teacher.subject}</div>
                    <div className="text-[10px] text-slate-400">{teacherProfileData.teacher.email} | {teacherProfileData.teacher.phone}</div>
                  </div>
                </div>

                {/* Bio & Experience */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">الخبرة المهنية</span>
                    <p className="text-xs text-slate-200 leading-relaxed font-light">{teacherProfileData.teacher.experience || 'لا توجد بيانات خبرة مضافة.'}</p>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">النبذة التعريفية (Bio)</span>
                    <p className="text-xs text-slate-300 leading-relaxed font-light">{teacherProfileData.teacher.bio || 'لا توجد نبذة مضافة.'}</p>
                  </div>
                </div>

                {/* Courses Listing */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <BookOpen className="h-4 w-4 text-brand-primary" />
                    <span>الكورسات المسجلة باسم المعلم:</span>
                  </h4>

                  {teacherProfileData.courses.length === 0 ? (
                    <div className="text-center py-6 border border-slate-800 rounded-xl text-xs text-slate-400 font-light">لا توجد كورسات مضافة بعد.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {teacherProfileData.courses.map((course: any) => (
                        <div key={course.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
                          <img 
                            src={course.cover_image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200'} 
                            alt={course.title} 
                            className="w-14 h-10 object-cover rounded shrink-0 bg-slate-800"
                          />
                          <div>
                            <h5 className="font-bold text-xs text-slate-200 line-clamp-1">{course.title}</h5>
                            <div className="flex gap-2 items-center text-[9px] text-slate-400 font-light mt-1">
                              <span>السعر: {course.price} ج.م</span>
                              <span>•</span>
                              <span className="text-brand-primary font-bold">
                                {course.is_published ? 'منشور' : 'مسودة'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="text-center py-6 text-xs text-rose-400 font-light">فشل تحميل البيانات.</div>
            )}

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setViewTeacherItem(null)}
                className="px-6 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Generated Credentials Popup Modal */}
      {showCredentialsPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/20" onClick={() => setShowCredentialsPopup(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl text-center z-10">
            
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-full inline-block mb-2 text-brand-primary">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
            </div>

            <h3 className="text-lg font-black text-slate-200">تم إنشاء بيانات الدخول!</h3>
            
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              انسخ البريد الإلكتروني وكلمة المرور المؤقتة التالية وأرسلها للمعلم لتسجيل دخوله وتغيير كلمته الشخصية.
            </p>

            <div className="space-y-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] p-4 rounded-2xl text-xs text-right font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 select-none">البريد:</span>
                <span className="font-bold select-all text-slate-100">{showCredentialsPopup.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 select-none">كلمة المرور:</span>
                <span className="font-bold select-all text-brand-primary">{showCredentialsPopup.password}</span>
              </div>
            </div>

            <button
              onClick={() => setShowCredentialsPopup(null)}
              className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              موافق (إغلاق)
            </button>

          </div>
        </div>
      )}

      {/* 5. Bulk Delete Teachers Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/20" onClick={() => { if (!bulkDeleting) setShowBulkDeleteModal(false); }} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-lg font-black text-red-500 flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
              <span>تأكيد الإجراء الخطير: حذف جميع المعلمين</span>
            </h3>
            <div className="text-xs text-slate-300 font-bold leading-relaxed bg-red-500/10 p-4 border border-red-500/20 rounded-2xl">
              ⚠️ سيتم حذف جميع المعلمين نهائياً.
            </div>
            
            {/* Warning Box if courses exist */}
            {errorCourses.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-xl space-y-2 text-right">
                <div className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  <span>لا يمكن الحذف لوجود الكورسات النشطة التالية:</span>
                </div>
                <ul className="text-[10px] text-slate-300 list-disc list-inside space-y-1">
                  {errorCourses.map((c) => (
                    <li key={c.id}>
                      كورس: <span className="font-bold">{c.title}</span> (المعلم: {c.teacher_name})
                    </li>
                  ))}
                </ul>
                <p className="text-[9px] text-slate-400 font-light mt-1">
                  * لحذف المعلمين، يجب نقل هذه الكورسات أو حذفها أولاً.
                </p>
              </div>
            )}

            <p className="text-xs text-slate-400 font-light leading-relaxed">
              * سيتم حذف جميع حسابات المعلمين بالكامل.<br/>
              * سيتم حذف ملفاتهم الشخصية وعروض المواد بالكامل.<br/>
              * سيتم تصفير جميع الصلاحيات المعطاة لهم.<br/>
              * <strong>لن يتم حذف</strong> حسابات الطلاب أو المديرين.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                اكتب <span className="font-mono text-red-400 font-black">"DELETE TEACHERS"</span> للتأكيد.
              </label>
              <input
                type="text"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="DELETE TEACHERS"
                disabled={bulkDeleting}
                className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-red-500 text-center font-black placeholder:font-light"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setConfirmPhrase('');
                  setErrorCourses([]);
                }}
                className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl cursor-pointer text-slate-300 transition-all hover:bg-slate-800"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={confirmPhrase !== 'DELETE TEACHERS' || bulkDeleting || errorCourses.length > 0}
                onClick={async () => {
                  setBulkDeleting(true);
                  try {
                    await API.post('/admin/bulk/teachers');
                    useModalStore.getState().showToast('تم حذف جميع المعلمين بنجاح وبشكل آمن.', 'success');
                    setShowBulkDeleteModal(false);
                    setConfirmPhrase('');
                    fetchTeachers();
                  } catch (err: any) {
                    console.error(err);
                    if (err.response?.data?.error_type === 'courses_exist') {
                      setErrorCourses(err.response.data.courses || []);
                      useModalStore.getState().showToast('تنبيه: لا يمكن حذف المعلمين لوجود كورسات نشطة.', 'warning');
                    } else {
                      useModalStore.getState().showToast(err.response?.data?.message || 'فشل تنفيذ عملية الحذف.', 'error');
                    }
                  } finally {
                    setBulkDeleting(false);
                  }
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-lg shadow-red-600/10 hover:shadow-red-600/20"
              >
                {bulkDeleting ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <span>تأكيد الحذف النهائي</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Dropdown Menu */}
      {activeDropdownTeacherId && dropdownPosition && activeTeacher && (
        <>
          {/* Backdrop for click away */}
          <div 
            className="fixed inset-0 z-40 bg-transparent" 
            onClick={() => {
              setActiveDropdownTeacherId(null);
              setDropdownPosition(null);
              setActiveTeacher(null);
            }} 
          />
          <div 
            style={{ 
              position: 'fixed', 
              top: `${dropdownPosition.top}px`, 
              left: `${dropdownPosition.left}px`,
              width: '192px'
            }}
            className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl py-2 shadow-2xl z-50 text-right animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {dropdownSource === 'desktop' ? (
              <>
                <Link
                  to={`/admin/teachers/${activeTeacher.id}/subscription`}
                  onClick={() => {
                    setActiveDropdownTeacherId(null);
                    setDropdownPosition(null);
                    setActiveTeacher(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[var(--text-color)] hover:bg-[var(--bg-color)] transition-all"
                >
                  <Award className="w-3.5 h-3.5 text-indigo-500" />
                  <span>عرض وإدارة الاشتراك</span>
                </Link>
                <button
                  onClick={() => {
                    handleEditClick(activeTeacher);
                    setActiveDropdownTeacherId(null);
                    setDropdownPosition(null);
                    setActiveTeacher(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[var(--text-color)] hover:bg-[var(--bg-color)] transition-all text-right cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                  <span>تعديل بيانات المعلم</span>
                </button>
                <Link
                  to={`/admin/teachers/${activeTeacher.id}/subscription?tab=payments`}
                  onClick={() => {
                    setActiveDropdownTeacherId(null);
                    setDropdownPosition(null);
                    setActiveTeacher(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[var(--text-color)] hover:bg-[var(--bg-color)] transition-all"
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  <span>سجل الدفع والفواتير</span>
                </Link>
                <Link
                  to={`/admin/teachers/${activeTeacher.id}/subscription?tab=usage`}
                  onClick={() => {
                    setActiveDropdownTeacherId(null);
                    setDropdownPosition(null);
                    setActiveTeacher(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[var(--text-color)] hover:bg-[var(--bg-color)] transition-all"
                >
                  <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                  <span>تفاصيل الاستهلاك</span>
                </Link>
                <button
                  onClick={() => {
                    handleResetPasswordClick(activeTeacher);
                    setActiveDropdownTeacherId(null);
                    setDropdownPosition(null);
                    setActiveTeacher(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[var(--text-color)] hover:bg-[var(--bg-color)] transition-all text-right cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-purple-500" />
                  <span>إعادة تعيين كلمة المرور</span>
                </button>
                <div className="border-t border-[var(--border-color)] my-1" />
                <button
                  onClick={() => {
                    handleDeleteTeacherClick(activeTeacher);
                    setActiveDropdownTeacherId(null);
                    setDropdownPosition(null);
                    setActiveTeacher(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[var(--danger-color)] hover:bg-[var(--danger-color)]/5 transition-all text-right cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[var(--danger-color)]" />
                  <span>حذف حساب المعلم</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to={`/admin/teachers/${activeTeacher.id}/subscription`}
                  onClick={() => {
                    setActiveDropdownTeacherId(null);
                    setDropdownPosition(null);
                    setActiveTeacher(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-[var(--text-color)] hover:bg-[var(--bg-color)] transition-all"
                >
                  <Award className="w-3.5 h-3.5 text-indigo-500" />
                  <span>إدارة الاشتراك</span>
                </Link>
                <Link
                  to={`/admin/teachers/${activeTeacher.id}/subscription?tab=payments`}
                  onClick={() => {
                    setActiveDropdownTeacherId(null);
                    setDropdownPosition(null);
                    setActiveTeacher(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-[var(--text-color)] hover:bg-[var(--bg-color)] transition-all"
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  <span>سجل الدفع</span>
                </Link>
                <Link
                  to={`/admin/teachers/${activeTeacher.id}/subscription?tab=usage`}
                  onClick={() => {
                    setActiveDropdownTeacherId(null);
                    setDropdownPosition(null);
                    setActiveTeacher(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-[var(--text-color)] hover:bg-[var(--bg-color)] transition-all"
                >
                  <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                  <span>الاستهلاك</span>
                </Link>
                <button
                  onClick={() => {
                    handleResetPasswordClick(activeTeacher);
                    setActiveDropdownTeacherId(null);
                    setDropdownPosition(null);
                    setActiveTeacher(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-[var(--text-color)] hover:bg-[var(--bg-color)] transition-all text-right cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-purple-500" />
                  <span>كلمة المرور</span>
                </button>
                <button
                  onClick={() => {
                    handleDeleteTeacherClick(activeTeacher);
                    setActiveDropdownTeacherId(null);
                    setDropdownPosition(null);
                    setActiveTeacher(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-[var(--danger-color)] hover:bg-[var(--danger-color)]/5 transition-all text-right cursor-pointer border-t border-[var(--border-color)] mt-1"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[var(--danger-color)]" />
                  <span>حذف المعلم</span>
                </button>
              </>
            )}
          </div>
        </>
      )}

    </div>
  )
}
