import React, { useState, useEffect } from 'react'
import API from '../../services/api'
import { 
  Send, Users, BookOpen, User, Bell, CheckCircle, 
  AlertCircle, MessageSquare, Clipboard, Calendar, Trash2
} from 'lucide-react'
import { useModalStore } from '../../store/modalStore'

interface SelectorUser {
  id: number
  name: string
  email: string
}

interface PastNotification {
  id: number
  title: string
  message: string
  recipient_type: string
  recipient_id: number | null
  recipient?: { name: string }
  created_at: string
}

export default function Notifications() {
  // Form states
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [recipientType, setRecipientType] = useState<string>('all')
  const [recipientId, setRecipientId] = useState<string>('')
  const [important, setImportant] = useState(false)
  const [sendToAdmin, setSendToAdmin] = useState(false)
  
  // Searchable states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<SelectorUser | null>(null)

  // Lists
  const [teachers, setTeachers] = useState<SelectorUser[]>([])
  const [students, setStudents] = useState<SelectorUser[]>([])
  const [pastNotifications, setPastNotifications] = useState<PastNotification[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [sending, setSending] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [deleting, setDeleting] = useState(false)

  // Feedback states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Reset searchable fields when recipient type changes
  useEffect(() => {
    setRecipientId('')
    setSelectedUser(null)
    setSearchQuery('')
  }, [recipientType])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loadNotifications = async () => {
    try {
      const res = await API.get('/notifications?admin_view=true') // Reuse universal endpoint with admin view flag
      setPastNotifications(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  // Load User Lists for selectors
  const loadSelectors = async () => {
    try {
      setLoadingLists(true)
      const res = await API.get('/admin/notifications/users')
      setTeachers(res.data.teachers || [])
      setStudents(res.data.students || [])
    } catch (err) {
      console.error(err)
      showToast('فشل تحميل قوائم المستخدمين للمحددات.', 'error')
    } finally {
      setLoadingLists(false)
    }
  }

  useEffect(() => {
    loadSelectors()
    loadNotifications()
  }, [])

  // Handle Send Form
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      showToast('يرجى ملء جميع الحقول المطلوبة.', 'error')
      return
    }

    if ((recipientType === 'specific_teacher' || recipientType === 'specific_student') && !recipientId) {
      showToast('يرجى اختيار المستخدم المحدد لتوجيه الإشعار إليه.', 'error')
      return
    }

    try {
      setSending(true)
      await API.post('/admin/notifications/send', {
        title,
        message,
        recipient_type: recipientType,
        recipient_id: recipientId ? Number(recipientId) : null,
        important,
        send_to_admin: sendToAdmin,
      })

      showToast('تم إرسال الإشعار وتوزيعه بنجاح على الفئات المحددة.', 'success')
      setTitle('')
      setMessage('')
      setRecipientId('')
      setSelectedUser(null)
      setSearchQuery('')
      setImportant(false)
      setSendToAdmin(false)
      loadNotifications()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل إرسال الإشعار.', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }

  const handleToggleSelectAll = () => {
    if (selectedIds.length === pastNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pastNotifications.map(n => n.id));
    }
  }

  const handleDeleteSingle = (id: number) => {
    useModalStore.getState().showConfirm({
      title: 'حذف الإشعار',
      description: 'هل أنت متأكد من رغبتك في حذف هذا الإشعار بشكل نهائي من النظام؟ لا يمكن التراجع عن هذا الإجراء.',
      type: 'delete',
      confirmText: 'نعم، احذف',
      cancelText: 'إلغاء',
      onConfirm: async () => {
        try {
          setDeleting(true)
          await API.delete(`/admin/notifications/${id}`)
          useModalStore.getState().showToast('تم حذف الإشعار بنجاح.', 'success')
          setPastNotifications(prev => prev.filter(n => n.id !== id))
          setSelectedIds(prev => prev.filter(item => item !== id))
        } catch (err: any) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف الإشعار.', 'error')
        } finally {
          setDeleting(false)
        }
      }
    })
  }

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    useModalStore.getState().showConfirm({
      title: 'حذف الإشعارات المحددة',
      description: `هل أنت متأكد من رغبتك في حذف ${selectedIds.length} إشعارات محددة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`,
      type: 'delete',
      confirmText: 'نعم، احذف المحدد',
      cancelText: 'إلغاء',
      onConfirm: async () => {
        try {
          setDeleting(true)
          await API.delete('/admin/notifications', { data: { ids: selectedIds } })
          useModalStore.getState().showToast('تم حذف الإشعارات المحددة بنجاح.', 'success')
          setPastNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)))
          setSelectedIds([])
        } catch (err: any) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف الإشعارات المحددة.', 'error')
        } finally {
          setDeleting(false)
        }
      }
    })
  }

  const handleDeleteAll = () => {
    useModalStore.getState().showConfirm({
      title: 'حذف جميع الإشعارات',
      description: 'هل أنت متأكد من رغبتك في مسح كافة سجلات الإشعارات من النظام بشكل كامل ونهائي؟',
      type: 'delete',
      confirmText: 'نعم، احذف الكل',
      cancelText: 'إلغاء',
      onConfirm: async () => {
        try {
          setDeleting(true)
          await API.delete('/admin/notifications')
          useModalStore.getState().showToast('تم مسح جميع الإشعارات بنجاح.', 'success')
          setPastNotifications([])
          setSelectedIds([])
        } catch (err: any) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف جميع الإشعارات.', 'error')
        } finally {
          setDeleting(false)
        }
      }
    })
  }

  // Translate type
  const getRecipientTypeLabel = (type: string) => {
    switch (type) {
      case 'all': return 'جميع مستخدمي المنصة'
      case 'students': return 'جميع الطلاب'
      case 'teachers': return 'جميع المعلمين'
      case 'specific_teacher': return 'معلم محدد'
      case 'specific_student': return 'طالب محدد'
      default: return type
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-right font-sans" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 left-5 z-50 px-6 py-3.5 rounded-xl border shadow-xl flex items-center gap-3 transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/30' : 'bg-rose-950/90 text-rose-400 border-rose-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 animate-in slide-in-from-right duration-350">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-color)] flex items-center gap-3">
          <Bell className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          مركز الإشعارات العام
        </h1>
        <p className="text-[var(--text-secondary)] text-xs mt-1">
          قم بإنشاء وإرسال الإشعارات والرسائل التنبيهية لطلاب ومعلمي المنصة بشكل فوري ومستهدف.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Notification Form Card */}
        <div className="lg:col-span-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 backdrop-blur-md h-fit">
          <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            إرسال إشعار جديد
          </h2>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1.5 font-semibold">عنوان الإشعار</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="أدخل عنواناً جذاباً..."
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1.5 font-semibold">مضمون الرسالة</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب تفاصيل الإشعار هنا..."
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition resize-none"
              ></textarea>
            </div>

            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1.5 font-semibold">فئة المستلمين</label>
              <select
                value={recipientType}
                onChange={(e) => {
                  setRecipientType(e.target.value)
                  setRecipientId('')
                }}
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="all">جميع المستخدمين (طلاب ومعلمين)</option>
                <option value="students">جميع الطلاب</option>
                <option value="teachers">جميع المعلمين</option>
                <option value="specific_teacher">معلم محدد</option>
                <option value="specific_student">طالب محدد</option>
              </select>
            </div>

            {recipientType === 'specific_teacher' && (
              <div className="space-y-2">
                <label className="text-xs text-[var(--text-secondary)] block font-semibold">المعلم المستهدف</label>
                {selectedUser ? (
                  <div className="flex justify-between items-center bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-color)]">{selectedUser.name}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">{selectedUser.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        setRecipientId('');
                      }}
                      className="text-[10px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-350 hover:underline cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث باسم المعلم أو البريد..."
                      className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition"
                    />
                    {searchQuery.trim().length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl max-h-40 overflow-y-auto shadow-xl divide-y divide-[var(--border-color)]">
                        {teachers
                          .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.email.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(t => (
                            <div
                              key={t.id}
                              onClick={() => {
                                setSelectedUser(t);
                                setRecipientId(t.id.toString());
                                setSearchQuery('');
                              }}
                              className="p-3 text-right text-xs hover:bg-indigo-500/10 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-color)]"
                            >
                              <div>{t.name}</div>
                              <div className="text-[10px] text-[var(--text-secondary)]/70 font-light">{t.email}</div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {recipientType === 'specific_student' && (
              <div className="space-y-2">
                <label className="text-xs text-[var(--text-secondary)] block font-semibold">الطالب المستهدف</label>
                {selectedUser ? (
                  <div className="flex justify-between items-center bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-color)]">{selectedUser.name}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">{selectedUser.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        setRecipientId('');
                      }}
                      className="text-[10px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-350 hover:underline cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث باسم الطالب أو البريد..."
                      className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition"
                    />
                    {searchQuery.trim().length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl max-h-40 overflow-y-auto shadow-xl divide-y divide-[var(--border-color)]">
                        {students
                          .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.email.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setSelectedUser(s);
                                setRecipientId(s.id.toString());
                                setSearchQuery('');
                              }}
                              className="p-3 text-right text-xs hover:bg-indigo-500/10 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-color)]"
                            >
                              <div>{s.name}</div>
                              <div className="text-[10px] text-[var(--text-secondary)]/70 font-light">{s.email}</div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notification Priority Option */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-color)]">
              <label className="text-xs text-[var(--text-secondary)] block font-semibold">أولوية الإشعار (Priority)</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    checked={!important}
                    onChange={() => setImportant(false)}
                    className="accent-indigo-600"
                  />
                  <span>عادي (Normal)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    checked={important}
                    onChange={() => setImportant(true)}
                    className="accent-indigo-600"
                  />
                  <span className="text-rose-600 dark:text-rose-400 font-bold">هام جداً (نافذة منبثقة فورية)</span>
                </label>
              </div>
            </div>

            {/* Send to Admin Option */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-color)]">
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendToAdmin}
                  onChange={(e) => setSendToAdmin(e.target.checked)}
                  className="accent-indigo-600 rounded border-[var(--border-color)]"
                />
                <span>إرسال نسخة إلى حسابي (المسؤول المرسل)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3 mt-2 bg-gradient-to-r from-brand-primary to-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-indigo-500/10 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'جاري إرسال الإشعار...' : 'إرسال الإشعار الآن'}
            </button>
          </form>
        </div>

        {/* Sent Notifications History Card */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 backdrop-blur-md flex flex-col">
          <h2 className="text-lg font-bold text-[var(--text-color)] flex items-center gap-2 mb-2">
            <Clipboard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            سجل الإشعارات المرسلة
          </h2>
          <p className="text-[var(--text-secondary)] text-xs mb-6">
            استعرض آخر الإشعارات التي تم بثها وتوزيعها على مستخدمي النظام.
          </p>

          {pastNotifications.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-color)]/20 p-3.5 rounded-2xl border border-[var(--border-color)] mb-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={pastNotifications.length > 0 && selectedIds.length === pastNotifications.length}
                  onChange={handleToggleSelectAll}
                  className="w-4.5 h-4.5 rounded border-[var(--border-color)] text-indigo-600 accent-indigo-600 cursor-pointer"
                />
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  {selectedIds.length > 0 ? `تم تحديد ${selectedIds.length} إشعار` : 'تحديد الكل'}
                </span>
              </div>
              <div className="flex gap-2">
                {selectedIds.length > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/20 text-[10px] font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف المحدد</span>
                  </button>
                )}
                <button
                  onClick={handleDeleteAll}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-xl shadow-md hover:shadow-rose-550/10 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 animate-in fade-in duration-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف كافة السجلات</span>
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto flex-grow max-h-[500px] overflow-y-auto pr-1">
            {pastNotifications.length === 0 ? (
              <div className="bg-[var(--bg-color)]/20 p-16 rounded-xl border border-dashed border-[var(--border-color)] text-center flex flex-col justify-center items-center">
                <Bell className="w-12 h-12 text-[var(--text-secondary)]/40 mb-3" />
                <p className="text-[var(--text-secondary)]/60 text-xs">لا توجد إشعارات مرسلة في السجل بعد.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pastNotifications.map(notif => (
                  <div key={notif.id} className="bg-[var(--bg-color)]/30 border border-[var(--border-color)] p-5 rounded-2xl flex items-start gap-4 transition-all hover:bg-[var(--bg-color)]/40 relative group">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(notif.id)}
                      onChange={() => handleToggleSelect(notif.id)}
                      className="w-4.5 h-4.5 rounded border-[var(--border-color)] text-indigo-600 accent-indigo-600 mt-1 cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                        <h3 className="text-sm font-extrabold text-[var(--text-color)] flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                          {notif.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                            فئة: {getRecipientTypeLabel(notif.recipient_type)}
                          </span>
                          <button
                            onClick={() => handleDeleteSingle(notif.id)}
                            disabled={deleting}
                            className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/10 hover:border-rose-500/20 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                            title="حذف الإشعار"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[var(--text-color)]/80 text-xs leading-relaxed mb-3">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]/70 pt-2.5 border-t border-[var(--border-color)]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(notif.created_at).toLocaleString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
