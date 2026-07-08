import React, { useState, useEffect } from 'react'
import API from '../../services/api'
import { Settings, Shield, Play, Save, ToggleLeft, ToggleRight } from 'lucide-react'
import { useModalStore } from '../../store/modalStore'

interface PlatformSettingsData {
  require_student_approval: boolean
  auto_delete_rejected_accounts: boolean
  view_limit_enabled: boolean
  default_max_views: number
  video_threshold_seconds: number
}

export default function PlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettingsData>({
    require_student_approval: false,
    auto_delete_rejected_accounts: false,
    view_limit_enabled: false,
    default_max_views: 10,
    video_threshold_seconds: 300,
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadSettings = async () => {
    try {
      setLoading(true)
      const res = await API.get('/admin/enterprise-settings')
      if (res.data) {
        setSettings({
          require_student_approval: !!res.data.require_student_approval,
          auto_delete_rejected_accounts: !!res.data.auto_delete_rejected_accounts,
          view_limit_enabled: !!res.data.view_limit_enabled,
          default_max_views: parseInt(res.data.default_max_views) || 10,
          video_threshold_seconds: parseInt(res.data.video_threshold_seconds) || 300,
        })
      }
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل إعدادات المنصة.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.post('/admin/enterprise-settings', settings)
      useModalStore.getState().showToast('تم حفظ الإعدادات بنجاح.', 'success')
    } catch (err: any) {
      console.error(err)
      useModalStore.getState().showToast(err.response?.data?.message || 'فشل حفظ الإعدادات.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleField = (field: keyof PlatformSettingsData) => {
    setSettings((prev) => ({
      ...prev,
      [field]: !prev[field],
    }))
  }

  const handleNumberChange = (field: keyof PlatformSettingsData, val: string) => {
    const num = parseInt(val) || 0
    setSettings((prev) => ({
      ...prev,
      [field]: num,
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-brand-primary">
        <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-right font-sans" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-color)] flex items-center gap-3">
          <Settings className="w-7 h-7 text-indigo-400" />
          إعدادات المنصة المتقدمة
        </h1>
        <p className="text-[var(--text-secondary)] text-xs mt-1">
          تعديل إعدادات الموافقة على الطلاب، وحدود مشاهدة المحاضرات للكورسات.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Group 1: Registration Approval */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-6 shadow-xl space-y-6">
          <h2 className="text-base font-extrabold text-[var(--text-color)] border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            نظام مراجعة وتفعيل الطلاب
          </h2>
          
          <div className="flex items-center justify-between gap-4 p-4 bg-[var(--bg-color)]/20 border border-[var(--border-color)] rounded-2xl">
            <div className="space-y-0.5">
              <label className="text-sm font-bold text-[var(--text-color)]">تفعيل نظام مراجعة الطلاب الجدد</label>
              <p className="text-[var(--text-secondary)] text-[10px]">عند تفعيله، لن يتم تنشيط حساب الطالب المسجل تلقائياً حتى يوافق عليه المسؤول.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleField('require_student_approval')}
              className="text-indigo-400 hover:text-indigo-300 transition shrink-0 cursor-pointer"
            >
              {settings.require_student_approval ? (
                <ToggleRight className="w-14 h-8 text-brand-primary" />
              ) : (
                <ToggleLeft className="w-14 h-8 text-slate-500" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 bg-[var(--bg-color)]/20 border border-[var(--border-color)] rounded-2xl">
            <div className="space-y-0.5">
              <label className="text-sm font-bold text-[var(--text-color)]">حذف الحسابات المرفوضة تلقائياً</label>
              <p className="text-[var(--text-secondary)] text-[10px]">إذا تم رفض الحساب، سيتم حذفه مباشرة بدلاً من إبقائه كـ "مرفوض" في قاعدة البيانات.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleField('auto_delete_rejected_accounts')}
              className="text-indigo-400 hover:text-indigo-300 transition shrink-0 cursor-pointer"
            >
              {settings.auto_delete_rejected_accounts ? (
                <ToggleRight className="w-14 h-8 text-brand-primary" />
              ) : (
                <ToggleLeft className="w-14 h-8 text-slate-500" />
              )}
            </button>
          </div>
        </div>

        {/* Group 2: View Limits */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-6 shadow-xl space-y-6">
          <h2 className="text-base font-extrabold text-[var(--text-color)] border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
            <Play className="w-5 h-5 text-sky-400" />
            نظام تتبع وحدود المشاهدات
          </h2>
          
          <div className="flex items-center justify-between gap-4 p-4 bg-[var(--bg-color)]/20 border border-[var(--border-color)] rounded-2xl">
            <div className="space-y-0.5">
              <label className="text-sm font-bold text-[var(--text-color)]">تفعيل قيود المشاهدة افتراضياً للجميع</label>
              <p className="text-[var(--text-secondary)] text-[10px]">عند تفعيله، سيتم تطبيق حد المشاهدات الأقصى افتراضياً على جميع الكورسات ما لم يتم إلغاؤه لكل كورس على حدة.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleField('view_limit_enabled')}
              className="text-indigo-400 hover:text-indigo-300 transition shrink-0 cursor-pointer"
            >
              {settings.view_limit_enabled ? (
                <ToggleRight className="w-14 h-8 text-brand-primary" />
              ) : (
                <ToggleLeft className="w-14 h-8 text-slate-500" />
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[var(--text-color)]">الحد الأقصى الافتراضي لعدد المشاهدات:</label>
              <input
                type="number"
                min={1}
                required
                className="w-full px-4 py-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm focus:outline-none focus:border-brand-primary font-mono text-left"
                value={settings.default_max_views}
                onChange={(e) => handleNumberChange('default_max_views', e.target.value)}
              />
              <p className="text-[var(--text-secondary)] text-[10px] mt-1">العدد الافتراضي للمشاهدات المتاحة للطالب لكل كورس.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[var(--text-color)]">الحد الأدنى لزمن احتساب المشاهدة (بالثواني):</label>
              <input
                type="number"
                min={5}
                required
                className="w-full px-4 py-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-sm focus:outline-none focus:border-brand-primary font-mono text-left"
                value={settings.video_threshold_seconds}
                onChange={(e) => handleNumberChange('video_threshold_seconds', e.target.value)}
              />
              <p className="text-[var(--text-secondary)] text-[10px] mt-1">الزمن الفعلي بالثواني الذي يجب على الطالب مشاهدته ليُسجل الدرس كمشاهدة واحدة (الافتراضي 300 ثانية = 5 دقائق).</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-8 py-3.5 bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-primary/20"
          >
            <Save className="w-5 h-5" />
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </form>
    </div>
  )
}
