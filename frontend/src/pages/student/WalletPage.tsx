import React from 'react'
import API from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { Wallet, KeyRound, ArrowDownLeft, ArrowUpRight, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

interface TransactionItem {
  id: number
  type: 'recharge' | 'purchase' | 'refund'
  amount: string
  description: string
  created_at: string
}

export default function WalletPage() {
  const { user, updateUser } = useAuthStore()
  
  const [balance, setBalance] = React.useState('0.00')
  const [transactions, setTransactions] = React.useState<TransactionItem[]>([])
  const [loading, setLoading] = React.useState(true)
  
  // Redeem form states
  const [code, setCode] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const transactionsWithRollingBalance = React.useMemo(() => {
    const sorted = [...transactions].reverse();
    let currentBalance = 0;
    const calculated = sorted.map((tx) => {
      const amount = parseFloat(tx.amount) || 0;
      const isCredit = tx.type === 'recharge' || tx.type === 'refund';
      if (isCredit) {
        currentBalance += amount;
      } else {
        currentBalance -= amount;
      }
      return {
        ...tx,
        rollingBalance: currentBalance,
      };
    });
    return calculated.reverse();
  }, [transactions]);

  const fetchWallet = () => {
    API.get('/student/wallet')
      .then((res) => {
        setBalance(res.data.balance)
        setTransactions(res.data.transactions)

        // Update balance in authStore user profile
        if (user) {
          updateUser({
            wallet: {
              id: user.wallet?.id || 0,
              balance: res.data.balance,
            }
          })
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  React.useEffect(() => {
    fetchWallet()
  }, [])

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    
    try {
      const res = await API.post('/wallet/redeem', { code })
      setSuccess(res.data.message)
      setCode('')
      
      // Update balance
      if (res.data.balance) {
        setBalance(res.data.balance)
      }
      
      fetchWallet()
    } catch (err: any) {
      console.error(err)
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message)
      } else {
        setError('كود الشحن المدخل غير صالح أو انتهت صلاحيته.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">
      
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-black">محفظتي الإلكترونية</h1>
        <p className="text-sm text-slate-400 font-light mt-1">اشحن رصيدك لتفعيل الكورسات والباقات الشهرية فوراً</p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Balance Card & Redeem code */}
        <div className="md:col-span-1 space-y-6">
          
          {/* Balance card */}
          <div className="bg-brand-primary p-6 rounded-3xl text-white relative overflow-hidden shadow-lg shadow-brand-primary/20">
            <div className="absolute right-0 bottom-0 translate-y-6 translate-x-6 w-32 h-32 bg-white/5 rounded-full" />
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-emerald-100">الرصيد الحالي</span>
                <Wallet className="h-6 w-6 text-emerald-100" />
              </div>
              <div className="text-3xl font-black">
                {balance} <span className="text-base font-medium">ج.م</span>
              </div>
            </div>
          </div>

          {/* Code redemption */}
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-md">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-primary" />
              <span>شحن المحفظة / تفعيل كورس</span>
            </h3>
            
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              قم بإدخال كود الشحن المكون من 12 رمزاً لتعبئة رصيدك أو تفعيل كورس مشترك به مباشرة.
            </p>

            <form onSubmit={handleRedeem} className="space-y-3">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ELM-XXXXXXXX"
                className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-brand-primary"
              />
              
              <button
                type="submit"
                disabled={submitting || !code.trim()}
                className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري التفعيل...</span>
                  </>
                ) : (
                  <span>تفعيل الكود</span>
                )}
              </button>
            </form>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-brand-success text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

          </div>

        </div>

        {/* Transactions log list */}
        <div className="md:col-span-2 bg-brand-card border border-[var(--border-color)] p-8 rounded-3xl space-y-6 shadow-md flex flex-col">
          <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
            <h3 className="font-bold text-base">سجل المعاملات المالية</h3>
            <button onClick={fetchWallet} className="p-2 hover:bg-[rgba(255,255,255,0.02)] rounded-lg text-slate-400 hover:text-slate-200">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-light text-sm">
              لا توجد أي عمليات شحن أو دفع مسجلة حالياً.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)] bg-background/30">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">العملية</th>
                    <th className="p-4 text-center">المبلغ</th>
                    <th className="p-4 text-left">الرصيد بعد العملية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] text-xs">
                  {transactionsWithRollingBalance.map((tx) => {
                    const isRecharge = tx.type === 'recharge' || tx.type === 'refund'
                    return (
                      <tr key={tx.id} className="hover:bg-[rgba(255,255,255,0.005)] transition-colors">
                        <td className="p-4 text-slate-400 font-light whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleDateString('ar-EG', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="p-4 font-semibold text-slate-200">
                          {tx.description}
                        </td>
                        <td className={`p-4 text-center font-black ${isRecharge ? 'text-brand-success' : 'text-rose-500'}`}>
                          {isRecharge ? '+' : '-'}{Number(tx.amount).toFixed(2)} ج.م
                        </td>
                        <td className="p-4 text-left font-black text-slate-100 whitespace-nowrap">
                          {tx.rollingBalance.toFixed(2)} ج.م
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
