/**
 * MerchantLogin — login screen for merchant dashboard at /admin.
 *
 * Replaces the old password-only AdminGuard with proper email/password
 * authentication backed by MerchantUser + bcrypt (or PLAIN: for dev).
 *
 * On success, the merchant is redirected to the dashboard. The session
 * token + user are cached by TenantContext.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import { Store, LogIn } from 'lucide-react'

export default function MerchantLogin() {
  const { login } = useTenant()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      // After login, redirect to dashboard (which is the same /admin route,
      // but now the user is authenticated so the dashboard renders).
      nav('/admin')
    } catch (err: any) {
      setError(err?.message === 'INVALID_CREDENTIALS' ? 'البريد أو كلمة المرور غير صحيحة' : (err?.message || 'فشل تسجيل الدخول'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1A1A1E] grid place-items-center mx-auto">
            <Store size={24} className="text-[#C9A96A]" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#1A1A1E] mt-3">دخول التاجر</h1>
          <p className="text-sm text-[#7A6F5A] mt-1">سجّلي الدخول للوصول إلى لوحة تحكم متجرك</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-[#EDE6D8] shadow-lg space-y-3">
          <div>
            <label className="text-xs font-bold text-[#7A6F5A]">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@store.com"
              dir="ltr"
              className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#7A6F5A]">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]"
              required
            />
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A1A1E] text-white py-3 rounded-xl font-bold hover:bg-black transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn size={16} />
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
        <div className="mt-4 text-center text-xs text-[#9A8A6B]">
          ليس لديك حساب؟ <a href="/" className="text-[#A02A5B] font-bold hover:underline">أنشئ متجرك الآن</a>
        </div>
        <div className="mt-3 text-center text-[11px] text-[#9A8A6B] bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl p-2">
          <b>للتجربة:</b> admin@lumiere.saas / admin12345
        </div>
      </div>
    </div>
  )
}
