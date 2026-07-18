import React, { useState, useEffect } from 'react'
import API from '../../services/api'
import { Plus, Check, AlertCircle, Pencil, Trash, Play, Pause, Code, DollarSign, Layers } from 'lucide-react'

export default function ActivationCodePackagesManager() {
  const [packages, setPackages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPkg, setEditingPkg] = useState<any | null>(null)
  
  const [name, setName] = useState('')
  const [numberOfCodes, setNumberOfCodes] = useState(50)
  const [pricePerCode, setPricePerCode] = useState(15)
  const [totalPrice, setTotalPrice] = useState(750)
  const [active, setActive] = useState(true)
  const [sortOrder, setSortOrder] = useState(0)

  // Toast Alert State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Auto calculate total price when codes or rate change
  useEffect(() => {
    setTotalPrice(numberOfCodes * pricePerCode)
  }, [numberOfCodes, pricePerCode])

  const fetchPackages = async () => {
    try {
      setLoading(true)
      const res = await API.get('/admin/activation-code-packages')
      setPackages(res.data || [])
    } catch (err: any) {
      console.error(err)
      setError('فشل تحميل باقات الأكواد.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  const handleOpenCreate = () => {
    setEditingPkg(null)
    setName('50 كود')
    setNumberOfCodes(50)
    setPricePerCode(15)
    setTotalPrice(750)
    setActive(true)
    setSortOrder(packages.length + 1)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (pkg: any) => {
    setEditingPkg(pkg)
    setName(pkg.name)
    setNumberOfCodes(pkg.number_of_codes)
    setPricePerCode(Number(pkg.price_per_code))
    setTotalPrice(Number(pkg.total_price))
    setActive(pkg.active !== false && pkg.active !== 0)
    setSortOrder(pkg.sort_order || 0)
    setIsFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name,
      number_of_codes: numberOfCodes,
      price_per_code: pricePerCode,
      total_price: totalPrice,
      active,
      sort_order: sortOrder,
    }

    try {
      if (editingPkg) {
        await API.put(`/admin/activation-code-packages/${editingPkg.id}`, payload)
        showToast('تم تحديث حزمة الأكواد بنجاح.', 'success')
      } else {
        await API.post('/admin/activation-code-packages', payload)
        showToast('تم إنشاء حزمة الأكواد بنجاح.', 'success')
      }
      setIsFormOpen(false)
      fetchPackages()
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || 'فشل حفظ حزمة الأكواد.', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الحزمة؟')) return
    try {
      await API.delete(`/admin/activation-code-packages/${id}`)
      showToast('تم حذف حزمة الأكواد بنجاح.', 'success')
      fetchPackages()
    } catch (err: any) {
      console.error(err)
      showToast('فشل حذف حزمة الأكواد.', 'error')
    }
  }

  const handleToggleStatus = async (id: number) => {
    try {
      await API.post(`/admin/activation-code-packages/${id}/toggle`, {})
      showToast('تم تغيير حالة الحزمة بنجاح.', 'success')
      fetchPackages()
    } catch (err: any) {
      console.error(err)
      showToast('فشل تغيير حالة الحزمة.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 left-5 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl border text-sm font-extrabold shadow-lg animate-in fade-in slide-in-from-top-4 duration-305 ${
          toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-405' : 'bg-rose-500/15 border-rose-500/30 text-rose-405'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-800 rounded-2xl">
        <div>
          <h2 className="text-sm font-black text-slate-200">إدارة باقات أكواد تفعيل الطلاب</h2>
          <p className="text-[10px] text-slate-400 mt-1">تحديد أسعار الأكواد المخفضة لشحن حسابات المعلمين</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إنشاء باقة جديدة</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold">
          {error}
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
          لا توجد باقات أكواد تفعيل حالياً.
        </div>
      ) : (
        <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl overflow-hidden">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-bold">
              <tr>
                <th className="p-3.5">الترتيب</th>
                <th className="p-3.5">اسم الباقة</th>
                <th className="p-3.5">عدد الأكواد</th>
                <th className="p-3.5">سعر الكود الواحد</th>
                <th className="p-3.5">السعر الإجمالي</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5 text-left">العمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-350">
              {packages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-slate-900/10 transition-colors">
                  <td className="p-3.5 font-semibold">{pkg.sort_order}</td>
                  <td className="p-3.5 font-bold text-slate-200">{pkg.name}</td>
                  <td className="p-3.5 font-medium">{pkg.number_of_codes} كود</td>
                  <td className="p-3.5 font-medium text-emerald-450">{Number(pkg.price_per_code).toFixed(2)} ج.م</td>
                  <td className="p-3.5 font-black text-emerald-400">{Number(pkg.total_price).toFixed(2)} ج.م</td>
                  <td className="p-3.5">
                    {pkg.active ? (
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">نشط</span>
                    ) : (
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-450 rounded-md border border-slate-700/50">معطل</span>
                    )}
                  </td>
                  <td className="p-3.5 text-left flex justify-end gap-2">
                    <button
                      onClick={() => handleToggleStatus(pkg.id)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        pkg.active 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' 
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                      title={pkg.active ? 'تعطيل الباقة' : 'تفعيل الباقة'}
                    >
                      {pkg.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleOpenEdit(pkg)}
                      className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-all cursor-pointer"
                      title="تعديل الباقة"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(pkg.id)}
                      className="p-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-500/20 rounded-lg transition-all cursor-pointer"
                      title="حذف الباقة"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Dialog/Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-right" dir="rtl">
            <h3 className="text-base font-black text-slate-200 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>{editingPkg ? 'تعديل حزمة أكواد تفعيل' : 'إنشاء حزمة أكواد تفعيل جديدة'}</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">اسم الباقة (مثال: 50 كود)</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">عدد الأكواد بالحزمة</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={numberOfCodes}
                    onChange={(e) => setNumberOfCodes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">سعر الكود الواحد (ج.م)</label>
                  <input
                    type="number"
                    required
                    min={0.1}
                    step={0.01}
                    value={pricePerCode}
                    onChange={(e) => setPricePerCode(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">السعر الإجمالي للباقة (محسوب تلقائياً)</label>
                <div className="relative">
                  <input
                    type="number"
                    readOnly
                    value={totalPrice}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 focus:outline-none font-bold"
                  />
                  <span className="absolute left-3.5 top-2.5 text-[10px] text-slate-500 font-bold">ج.م</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">الترتيب في العرض</label>
                  <input
                    type="number"
                    min={0}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1.5">حالة الباقة</label>
                  <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setActive(true)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center cursor-pointer transition ${
                        active ? 'bg-indigo-600 text-white' : 'text-slate-500'
                      }`}
                    >
                      مفعّلة
                    </button>
                    <button
                      type="button"
                      onClick={() => setActive(false)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center cursor-pointer transition ${
                        !active ? 'bg-indigo-600 text-white' : 'text-slate-500'
                      }`}
                    >
                      معطلة
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer"
                >
                  حفظ البيانات
                </button>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
