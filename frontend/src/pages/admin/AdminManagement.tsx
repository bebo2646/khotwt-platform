import React from 'react'
import API from '../../services/api'
import { Plus, Shield, Trash2, Edit2, UserCheck, UserX, RefreshCw, Lock, Mail, User, CheckSquare, Square } from 'lucide-react'
import { useModalStore } from '../../store/modalStore'
import { useAuthStore } from '../../store/authStore'

interface AdminUser {
  id: number
  name: string
  email: string
  role: string
  is_super: boolean
  is_super_admin: boolean
  permissions: string[] | null
  status: 'active' | 'disabled'
}

const ALL_PERMISSIONS = [
  { key: 'users.view', label: 'عرض المستخدمين (users.view)' },
  { key: 'users.create', label: 'إنشاء مستخدمين (users.create)' },
  { key: 'users.edit', label: 'تعديل مستخدمين (users.edit)' },
  { key: 'users.delete', label: 'حذف مستخدمين (users.delete)' },
  { key: 'teachers.manage', label: 'إدارة المعلمين (teachers.manage)' },
  { key: 'students.manage', label: 'إدارة الطلاب (students.manage)' },
  { key: 'courses.manage', label: 'إدارة الكورسات والباقات (courses.manage)' },
  { key: 'coupons.manage', label: 'إدارة أكواد الشحن (coupons.manage)' },
  { key: 'reports.view', label: 'عرض التقارير والمبيعات (reports.view)' },
  { key: 'admins.manage', label: 'إدارة المشرفين والصلاحيات (admins.manage)' }
]

export default function AdminManagement() {
  const { user } = useAuthStore()
  const isSuperAdmin = !!user?.is_super_admin || !!user?.is_super

  const [admins, setAdmins] = React.useState<AdminUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingAdmin, setEditingAdmin] = React.useState<AdminUser | null>(null)
  
  // Audit logs state
  const [logs, setLogs] = React.useState<any[]>([])
  const [logsLoading, setLogsLoading] = React.useState(false)

  // Form fields
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>([])
  
  const showAlert = useModalStore((state) => state.showAlert)
  const showConfirm = useModalStore((state) => state.showConfirm)

  const fetchAdmins = () => {
    setLoading(true)
    API.get('/admin/manage')
      .then((res) => {
        setAdmins(res.data)
      })
      .catch((err) => {
        console.error(err)
        showAlert({
          title: 'خطأ في التحميل',
          description: err.response?.data?.message || 'فشل تحميل قائمة المشرفين. تأكد من أنك تملك صلاحية مشرف عام.',
          type: 'error'
        })
      })
      .finally(() => setLoading(false))
  }

  const fetchLogs = () => {
    setLogsLoading(true)
    API.get('/admin/logs')
      .then((res) => {
        setLogs(res.data)
      })
      .catch((err) => {
        console.error(err)
      })
      .finally(() => setLogsLoading(false))
  }

  const [activeTab, setActiveTab] = React.useState<'admins' | 'sessions'>('admins')
  const [sessions, setSessions] = React.useState<any[]>([])
  const [sessionsLoading, setSessionsLoading] = React.useState(false)

  const fetchSessions = () => {
    setSessionsLoading(true)
    API.get('/admin/active-sessions')
      .then((res) => {
        setSessions(res.data)
      })
      .catch((err) => {
        console.error(err)
        showAlert({
          title: 'خطأ في التحميل',
          description: err.response?.data?.message || 'فشل تحميل قائمة الجلسات النشطة.',
          type: 'error'
        })
      })
      .finally(() => setSessionsLoading(false))
  }

  const handleForceLogout = (sessionUser: any) => {
    showConfirm({
      title: 'إنهاء الجلسة',
      description: `هل أنت متأكد من رغبتك في تسجيل خروج المستخدم "${sessionUser.name}" من جهازه الحالي؟`,
      type: 'warning',
      onConfirm: () => {
        API.post(`/admin/active-sessions/${sessionUser.id}/logout`)
          .then((res) => {
            showAlert({ title: 'تم إنهاء الجلسة', description: res.data.message || 'تم تسجيل خروج المستخدم.', type: 'success' })
            fetchSessions()
          })
          .catch((err) => {
            showAlert({
              title: 'فشلت العملية',
              description: err.response?.data?.message || 'لا يمكن إنهاء جلسة هذا المستخدم.',
              type: 'error'
            })
          })
      }
    })
  }

  const handleForceLogoutAll = () => {
    showConfirm({
      title: 'إنهاء كافة الجلسات',
      description: '⚠️ هل أنت متأكد من رغبتك في تسجيل خروج جميع المستخدمين النشطين (طلاب ومعلمين ومشرفين) من كافة الأجهزة دفعة واحدة؟ (سيتم استثنائك أنت كمسؤول حالي)',
      type: 'delete',
      onConfirm: () => {
        API.post('/admin/active-sessions/logout-all')
          .then((res) => {
            showAlert({ title: 'تم إنهاء الجميع', description: res.data.message || 'تم تسجيل خروج كافة المستخدمين.', type: 'success' })
            fetchSessions()
          })
          .catch((err) => {
            showAlert({
              title: 'فشلت العملية',
              description: err.response?.data?.message || 'لا يمكن إتمام هذه العملية.',
              type: 'error'
            })
          })
      }
    })
  }

  React.useEffect(() => {
    fetchAdmins()
    fetchLogs()
    fetchSessions()
  }, [])

  const handleOpenCreate = () => {
    setEditingAdmin(null)
    setName('')
    setEmail('')
    setPassword('')
    setSelectedPermissions([])
    setFormOpen(true)
  }

  const handleOpenEdit = (admin: AdminUser) => {
    setEditingAdmin(admin)
    setName(admin.name)
    setEmail(admin.email)
    setPassword('')
    setSelectedPermissions(admin.permissions || [])
    setFormOpen(true)
  }

  const togglePermission = (permKey: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    )
  }

  const selectAllPermissions = () => {
    setSelectedPermissions(ALL_PERMISSIONS.map((p) => p.key))
  }

  const clearAllPermissions = () => {
    setSelectedPermissions([])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !email) {
      showAlert({ title: 'تنبيه', description: 'يرجى ملء جميع الحقول المطلوبة.', type: 'warning' })
      return
    }

    if (!editingAdmin && !password) {
      showAlert({ title: 'تنبيه', description: 'يرجى إدخال كلمة المرور للمشرف الجديد.', type: 'warning' })
      return
    }

    const payload = {
      name,
      email,
      password: password || undefined,
      permissions: selectedPermissions
    }

    const request = editingAdmin
      ? API.put(`/admin/manage/${editingAdmin.id}`, payload)
      : API.post('/admin/manage', payload)

    request
      .then((res) => {
        showAlert({
          title: 'نجاح العملية',
          description: res.data.message || 'تم حفظ بيانات المشرف بنجاح.',
          type: 'success'
        })
        setFormOpen(false)
        fetchAdmins()
        fetchLogs()
      })
      .catch((err) => {
        showAlert({
          title: 'فشلت العملية',
          description: err.response?.data?.message || 'حدث خطأ أثناء حفظ البيانات.',
          type: 'error'
        })
      })
  }

  const handleDelete = (admin: AdminUser) => {
    showConfirm({
      title: 'تأكيد الحذف',
      description: `هل أنت متأكد من رغبتك في حذف حساب المشرف "${admin.name}" بشكل نهائي؟`,
      type: 'delete',
      onConfirm: () => {
        API.delete(`/admin/manage/${admin.id}`)
          .then((res) => {
            showAlert({ title: 'تم الحذف', description: res.data.message || 'تم حذف المشرف بنجاح.', type: 'success' })
            fetchAdmins()
            fetchLogs()
          })
          .catch((err) => {
            showAlert({
              title: 'فشل الحذف',
              description: err.response?.data?.message || 'لا يمكن إتمام عملية الحذف.',
              type: 'error'
            })
          })
      }
    })
  }

  const handleToggleStatus = (admin: AdminUser) => {
    API.post(`/admin/manage/${admin.id}/toggle`)
      .then((res) => {
        showAlert({ title: 'تحديث الحالة', description: res.data.message || 'تم تغيير حالة الحساب بنجاح.', type: 'success' })
        fetchAdmins()
        fetchLogs()
      })
      .catch((err) => {
        showAlert({
          title: 'فشل التحديث',
          description: err.response?.data?.message || 'لا يمكن تعديل حالة حساب هذا المشرف.',
          type: 'error'
        })
      })
  }

  const handleYearReset = () => {
    showConfirm({
      title: 'تهيئة السنة الجديدة',
      description: '⚠️ سيتم حذف جميع البيانات الدراسية الخاصة بالسنة الحالية. هل أنت متأكد؟',
      type: 'delete',
      onConfirm: async () => {
        setLoading(true)
        try {
          const res = await API.post('/admin/reset-year')
          showAlert({
            title: 'تمت التهيئة بنجاح',
            description: res.data.message || 'تم حذف كافة اشتراكات ومحاولات وتقارير السنة الدراسية بنجاح.',
            type: 'success'
          })
          fetchAdmins()
          fetchLogs()
        } catch (err: any) {
          console.error(err)
          showAlert({
            title: 'فشلت التهيئة',
            description: err.response?.data?.message || 'حدث خطأ أثناء محاولة تهيئة السنة الدراسية.',
            type: 'error'
          })
        } finally {
          setLoading(false)
        }
      }
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Shield className="h-8 w-8 text-brand-primary" />
            <span>إدارة الصلاحيات والمشرفين</span>
          </h1>
          <p className="text-sm text-slate-400 font-light mt-1">
            بصفتك مشرفاً عاماً، يمكنك إنشاء وتعديل المشرفين وتخصيص صلاحيات الوصول بدقة تامة.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchAdmins}
            className="p-2.5 bg-brand-card hover:bg-slate-800 border border-[var(--border-color)] rounded-xl text-slate-400 hover:text-slate-200 transition-all duration-200"
          >
            <RefreshCw className="h-4.5 w-4.5" />
          </button>
          {isSuperAdmin && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-200"
            >
              <Plus className="h-4.5 w-4.5" />
              <span>إضافة مشرف جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-[var(--border-color)] gap-2 mb-8">
        <button
          onClick={() => setActiveTab('admins')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'admins'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          المشرفون وصلاحيات الوصول
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          الأجهزة والجلسات النشطة ({sessions.length})
        </button>
      </div>

      {activeTab === 'admins' ? (
        loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
          </div>
        ) : (
          <div className="space-y-12">
          {admins.length === 0 ? (
            <div className="bg-brand-card border border-[var(--border-color)] p-12 text-center rounded-3xl text-slate-400">
              لا يوجد مشرفين آخرين مسجلين في النظام.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className={`bg-brand-card border rounded-3xl p-6 relative flex flex-col justify-between shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                    admin.status === 'disabled' ? 'border-red-500/30 opacity-75' : 'border-[var(--border-color)] hover:border-brand-primary/45'
                  }`}
                >
                  <div>
                    {/* Status badges */}
                    <div className="absolute top-6 left-6 flex items-center gap-1.5">
                      {admin.is_super_admin ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-500">
                          مشرف عام
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-500">
                          مشرف مخصص
                        </span>
                      )}
                      
                      {admin.status === 'disabled' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-red-500/10 border border-red-500/30 text-red-500">
                          معطل
                        </span>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4 mb-4">
                      <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="font-bold text-sm text-slate-100">{admin.name}</h3>
                        <p className="text-xs text-slate-400 font-light flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span>{admin.email}</span>
                        </p>
                      </div>
                    </div>

                    {/* Permissions list */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-300">صلاحيات الوصول:</h4>
                      {admin.is_super_admin ? (
                        <p className="text-xs text-amber-500/80 font-light">
                          يمتلك صلاحيات الوصول الكاملة وغير المشروطة للمشرف العام الرئيسي.
                        </p>
                      ) : !admin.permissions || admin.permissions.length === 0 ? (
                        <p className="text-xs text-red-400 font-light">لا توجد أي صلاحيات مخصصة له حالياً.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {admin.permissions.map((p) => (
                            <span
                              key={p}
                              className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  {isSuperAdmin && (
                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--border-color)]">
                      {!admin.is_super_admin && (
                        <>
                          <button
                            onClick={() => handleToggleStatus(admin)}
                            title={admin.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                            className={`p-2 rounded-xl border transition-all duration-200 ${
                              admin.status === 'active'
                                ? 'bg-red-500/5 text-red-400 border-red-500/10 hover:bg-red-500/10'
                                : 'bg-green-500/5 text-green-400 border-green-500/10 hover:bg-green-500/10'
                            }`}
                          >
                            {admin.status === 'active' ? <UserX className="h-4.5 w-4.5" /> : <UserCheck className="h-4.5 w-4.5" />}
                          </button>
                          <button
                            onClick={() => handleDelete(admin)}
                            title="حذف الحساب"
                            className="p-2 bg-red-500/5 hover:bg-red-500/10 text-red-400 border border-red-500/10 rounded-xl transition-all duration-200"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleOpenEdit(admin)}
                        disabled={admin.is_super_admin && admin.id !== admins[0]?.id}
                        className="p-2 bg-brand-primary/5 hover:bg-brand-primary/10 text-brand-primary border border-brand-primary/10 rounded-xl flex items-center gap-1 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none transition-all duration-200"
                      >
                        <Edit2 className="h-4.5 w-4.5" />
                        <span>تعديل</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Year Reset Section */}
          {isSuperAdmin && (
            <div className="bg-brand-card border border-red-500/20 p-6 sm:p-8 rounded-3xl space-y-4 shadow-md bg-gradient-to-br from-red-500/5 to-transparent relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1 bg-red-500 h-full" />
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-right">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                    <span>تهيئة المنصة للسنة الجديدة</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-light max-w-2xl leading-relaxed">
                    هذا الإجراء يقوم بحذف كافة الاشتراكات الدراسية، المحاولات، ونسب مشاهدة الفيديوهات، والتقارير المالية، لإعداد المنصة لاستقبال دفعة طلاب جديدة.
                    سيتم الاحتفاظ بحسابات المعلمين والطلاب والمديرين والمحتوى التعليمي (الكورسات والمحاضرات).
                  </p>
                </div>

                <button
                  onClick={handleYearReset}
                  className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-lg shadow-red-600/10 shrink-0 self-end sm:self-center"
                >
                  تهيئة السنة الجديدة
                </button>
              </div>
            </div>
          )}

          {/* System Audit Logs Section */}
          {isSuperAdmin && (
            <div className="bg-brand-card border border-[var(--border-color)] p-6 sm:p-8 rounded-3xl space-y-6 shadow-md">
              <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
                <div>
                  <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                    <span>سجل مراقبة النظام والعمليات (Audit Logs)</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-light mt-1">
                    سجل تفصيلي لكافة العمليات الإدارية الحساسة التي تمت على المنصة.
                  </p>
                </div>
                <button
                  onClick={fetchLogs}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                  <span>تحديث السجل</span>
                </button>
              </div>

              {logsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  لا توجد سجلات نشاط متاحة حالياً.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold">
                        <th className="pb-3 pt-1 px-4">التاريخ والوقت</th>
                        <th className="pb-3 pt-1 px-4">المسؤول</th>
                        <th className="pb-3 pt-1 px-4">نوع الإجراء</th>
                        <th className="pb-3 pt-1 px-4">عنوان IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-slate-355">
                      {logs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-900/40 transition-colors border-b border-slate-800/20">
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                            {new Date(log.created_at).toLocaleString('ar-EG')}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-200">{log.admin_name}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                              log.action_type.includes('Deleted') 
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                : log.action_type.includes('Created') 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {log.action_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">{log.ip_address}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-brand-card border border-[var(--border-color)] p-6 sm:p-8 rounded-3xl space-y-6 shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[var(--border-color)]">
              <div>
                <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                  <span>إدارة الأجهزة والجلسات النشطة</span>
                </h3>
                <p className="text-xs text-slate-400 font-light mt-1">
                  يمكنك مراقبة جميع الأجهزة المتصلة بالنظام حالياً، وإنهاء جلسات المستخدمين في حال وجود نشاط مشبوه أو لتسجيل خروجهم إجبارياً.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchSessions}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                  <span>تحديث الجلسات</span>
                </button>
                {sessions.length > 0 && (
                  <button
                    onClick={handleForceLogoutAll}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-lg shadow-rose-600/10"
                  >
                    إنهاء كافة الجلسات النشطة
                  </button>
                )}
              </div>
            </div>

            {sessionsLoading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                لا توجد جلسات نشطة مسجلة حالياً في النظام.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold">
                      <th className="pb-3 pt-1 px-4">المستخدم</th>
                      <th className="pb-3 pt-1 px-4">الدور</th>
                      <th className="pb-3 pt-1 px-4">معلومات الجهاز / المتصفح</th>
                      <th className="pb-3 pt-1 px-4">آخر نشاط</th>
                      <th className="pb-3 pt-1 px-4 text-left">التحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-300">
                    {sessions.map((session: any) => {
                      const isCurrentUser = session.id === user?.id;
                      return (
                        <tr key={session.id} className="hover:bg-slate-900/40 transition-colors border-b border-slate-800/20">
                          <td className="py-4 px-4 font-semibold text-slate-100">
                            <div>{session.name}</div>
                            <div className="text-[10px] text-slate-400 font-light mt-0.5">{session.email}</div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                              session.role === 'admin' 
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                                : session.role === 'teacher' 
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {session.role === 'admin' ? 'مدير' : session.role === 'teacher' ? 'معلم' : 'طالب'}
                            </span>
                          </td>
                          <td className="py-4 px-4 max-w-xs truncate font-mono text-[10px] text-slate-400" title={session.device_id}>
                            {session.device_id || 'غير معروف'}
                          </td>
                          <td className="py-4 px-4 font-mono text-[10px] text-slate-400">
                            {session.last_activity ? new Date(session.last_activity).toLocaleString('ar-EG') : 'غير متوفر'}
                          </td>
                          <td className="py-4 px-4 text-left">
                            <button
                              onClick={() => handleForceLogout(session)}
                              disabled={isCurrentUser}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                                isCurrentUser
                                  ? 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed opacity-50'
                                  : 'bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 cursor-pointer shadow-md'
                              }`}
                            >
                              {isCurrentUser ? 'جلستك الحالية' : 'إنهاء الجلسة'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal/Overlay Form */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in rtl">
          <div className="bg-brand-card border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl relative">
            
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Shield className="h-6 w-6 text-brand-primary" />
                <span>{editingAdmin ? `تعديل صلاحيات: ${editingAdmin.name}` : 'إضافة مشرف جديد مخصص'}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-light">
                تأكد من تخصيص الصلاحيات المناسبة لمهامه الإدارية فقط لضمان سلامة المنصة.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-right">
              {/* Inputs name, email, password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">الاسم بالكامل *</label>
                  <div className="relative">
                    <User className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="أدخل الاسم"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-900 border border-[var(--border-color)] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">البريد الإلكتروني *</label>
                  <div className="relative">
                    <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="name@admin.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-900 border border-[var(--border-color)] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  {editingAdmin ? 'كلمة المرور (اتركها فارغة لعدم التعديل)' : 'كلمة المرور *'}
                </label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    required={!editingAdmin}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-900 border border-[var(--border-color)] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* Permissions checkboxes grid */}
              {(!editingAdmin || !editingAdmin.is_super_admin) && (
                <div className="space-y-3 pt-3 border-t border-[var(--border-color)]">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-300">تعيين الصلاحيات:</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllPermissions}
                        className="text-[10px] text-brand-primary font-bold hover:underline"
                      >
                        تحديد الكل
                      </button>
                      <span className="text-[10px] text-slate-500">|</span>
                      <button
                        type="button"
                        onClick={clearAllPermissions}
                        className="text-[10px] text-slate-400 font-bold hover:underline"
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900/50 p-4 border border-[var(--border-color)] rounded-2xl max-h-[220px] overflow-y-auto">
                    {ALL_PERMISSIONS.map((perm) => {
                      const isSelected = selectedPermissions.includes(perm.key)
                      return (
                        <div
                          key={perm.key}
                          onClick={() => togglePermission(perm.key)}
                          className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer text-xs transition-all duration-200 select-none ${
                            isSelected
                              ? 'bg-brand-primary/10 border-brand-primary/30 text-slate-100 font-semibold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4.5 w-4.5 text-brand-primary shrink-0" />
                          ) : (
                            <Square className="h-4.5 w-4.5 text-slate-600 shrink-0" />
                          )}
                          <span className="truncate">{perm.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold transition-all duration-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold transition-all duration-200"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
