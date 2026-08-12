/**
 * SuperAdmin — platform-wide dashboard at /super-admin.
 *
 * Only accessible to MerchantUser with role === 'super_admin'.
 *
 * Routing note: this component handles BOTH /super-admin AND
 * /super-admin/login — when the user isn't authenticated, it renders
 * an inline login form instead of redirecting. This avoids the
 * "stuck on loading" bug where a redirect loop + missing data fetch
 * left the page forever in the loading state.
 *
 * Lets the platform owner:
 *   - View all TenantStore documents on the platform
 *   - Toggle store status (active / suspended / expired)
 *   - Change a store's plan (free_trial / starter / pro / vip)
 *   - View platform-wide stats (store count, user count, order count, etc.)
 *   - View all merchant users
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import {
  superAdminListStores, superAdminListUsers, superAdminStats, superAdminUpdateStore,
} from '../services/api/client'
import type { TenantStore, MerchantUser, StorePlan, StoreStatus } from '../services/api/types'
import {
  Store, Users, ShoppingBag, TrendingUp, Crown, Check,
  Pause, Play, LogOut, ExternalLink, RefreshCw, LogIn, AlertCircle, Loader2, Zap,
} from 'lucide-react'

const PLANS: StorePlan[] = ['free_trial', 'starter', 'pro', 'vip']
const STATUSES: StoreStatus[] = ['active', 'suspended', 'expired']

const planLabels: Record<StorePlan, string> = {
  free_trial: 'تجريبي', starter: 'ستارتر', pro: 'برو', vip: 'VIP',
}
const statusLabels: Record<StoreStatus, { label: string; color: string }> = {
  active: { label: 'نشط', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  suspended: { label: 'موقوف', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  expired: { label: 'منتهي', color: 'bg-red-100 text-red-700 border-red-200' },
}

export default function SuperAdmin() {
  const { user, login: tenantLogin, logout, refreshUser } = useTenant()
  const nav = useNavigate()

  // Two independent loading flags:
  //   authChecked: have we confirmed whether the user is logged in? (from cached user OR /api/auth/me)
  //   dataLoading: are we fetching the dashboard data (stores/users/stats)?
  const [authChecked, setAuthChecked] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [stores, setStores] = useState<TenantStore[]>([])
  const [users, setUsers] = useState<MerchantUser[]>([])
  const [stats, setStats] = useState<any>(null)
  const [tab, setTab] = useState<'stores' | 'users' | 'stats'>('stores')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)

  // ─── Step 1: confirm auth state on mount ────────────────────────────
  // We need to know if the user is logged in (and is a super_admin)
  // before deciding to render the login form vs. the dashboard. The
  // cached user from localStorage is the fast path; if there's a token
  // we also re-validate it against /api/auth/me so a logged-in super
  // admin doesn't have to re-login on every page refresh.
  useEffect(() => {
    let cancelled = false
    async function checkAuth() {
      // If the cached user is already a super_admin, we're done — no
      // need to hit the network.
      if (user?.role === 'super_admin') {
        if (!cancelled) setAuthChecked(true)
        return
      }
      // If there's no token, there's nothing to validate — show the login form.
      const token = typeof window !== 'undefined' ? localStorage.getItem('lumiere_saas_token') : null
      if (!token) {
        if (!cancelled) setAuthChecked(true)
        return
      }
      // Otherwise, refresh the user from the API. The TenantContext's
      // refreshUser() will update the `user` state — we just wait a tick
      // and re-check.
      try {
        await refreshUser()
      } catch {
        // network error — fall back to whatever cached user we have
      }
      if (!cancelled) setAuthChecked(true)
    }
    void checkAuth()
    return () => { cancelled = true }
  }, [])  // run once on mount

  // ─── Step 2: fetch dashboard data once we know the user is a super_admin ─
  const refresh = async () => {
    setDataLoading(true)
    setDataError(null)
    try {
      const [s, u, st] = await Promise.all([
        superAdminListStores(),
        superAdminListUsers(),
        superAdminStats(),
      ])
      setStores(s)
      setUsers(u)
      setStats(st)
    } catch (err: any) {
      console.error('super-admin refresh failed:', err)
      const msg = err?.body?.error || err?.message || 'NETWORK_ERROR'
      setDataError(msg === 'UNAUTHORIZED' ? 'انتهت الجلسة — سجّل الدخول مجدداً' : `فشل تحميل البيانات: ${msg}`)
      // If we got 401, the user's session is invalid — log them out so
      // the login form shows on the next render.
      if (msg === 'UNAUTHORIZED' || err?.status === 401) {
        logout()
      }
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => {
    // Only fetch data once we've confirmed the user is a super_admin.
    if (authChecked && user?.role === 'super_admin') {
      void refresh()
    }
  }, [authChecked, user?.role])

  // ─── Step 3: handle store status/plan updates ──────────────────────
  const handleUpdateStore = async (id: string, patch: Partial<TenantStore>) => {
    setUpdatingId(id)
    try {
      await superAdminUpdateStore(id, patch)
      await refresh()
    } catch (err: any) {
      console.error('update store failed:', err)
      const msg = err?.body?.error || err?.message || 'UNKNOWN'
      setDataError(`فشل تحديث المتجر: ${msg}`)
    } finally {
      setUpdatingId(null)
    }
  }

  // ─── Render: loading screen (only while auth is being confirmed) ────
  // IMPORTANT: this is a SHORT, bounded wait — just the time it takes
  // to check localStorage + (maybe) hit /api/auth/me. If the API is
  // unreachable, refreshUser() swallows the error and we proceed to
  // the login form. This is what prevents the "stuck on loading" bug.
  if (!authChecked) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FFFCF8]">
        <div className="text-center">
          <Loader2 size={28} className="animate-spin text-[#C9A96A] mx-auto" />
          <div className="text-sm text-[#9A8A6B] mt-3">جاري التحقق من الجلسة…</div>
        </div>
      </div>
    )
  }

  // ─── Render: login form (when not authenticated as super_admin) ────
  if (!user || user.role !== 'super_admin') {
    return <SuperAdminLogin
      onLogin={async (email, password) => {
        await tenantLogin(email, password)
        // After a successful login, refreshUser picks up the new token,
        // and the data-fetch effect will fire on the next render.
        await refreshUser()
      }}
      onBackHome={() => nav('/')}
    />
  }

  // ─── Render: dashboard ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FFFCF8]">
      {/* Top bar */}
      <header className="bg-[#1A1A1E] text-white">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#A02A5B] to-[#7A1F44] grid place-items-center">
              <Crown size={18} className="text-white" />
            </div>
            <div>
              <div className="font-extrabold text-sm">LUMIÈRE SaaS — Super Admin</div>
              <div className="text-[10px] text-white/50">لوحة تحكم المنصة</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => void refresh()} disabled={dataLoading} className="w-9 h-9 rounded-full bg-white/10 grid place-items-center hover:bg-white/20 transition disabled:opacity-50" title="تحديث">
              <RefreshCw size={14} className={dataLoading ? 'animate-spin' : ''} />
            </button>
            <span className="text-xs text-white/70 hidden sm:inline">{user.email}</span>
            <button onClick={() => { logout(); nav('/') }} className="text-xs bg-white/10 px-3 py-2 rounded-full hover:bg-white/20 flex items-center gap-1.5">
              <LogOut size={12} /> خروج
            </button>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {dataError && (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1">{dataError}</span>
            <button onClick={() => setDataError(null)} className="text-red-400 hover:text-red-700">×</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
        <div className="flex gap-2 mb-6">
          {([
            ['stores', 'المتاجر', Store],
            ['users', 'التجار', Users],
            ['stats', 'الإحصائيات', TrendingUp],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition ${
                tab === k ? 'bg-[#1A1A1E] text-white' : 'bg-white border border-[#EDE6D8] text-[#1A1A1E] hover:bg-[#F5EFE6]'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Stats cards (always visible at top) */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Store} label="إجمالي المتاجر" value={stats.storeCount} color="#C9A96A" />
            <StatCard icon={Users} label="إجمالي التجار" value={stats.userCount} color="#A02A5B" />
            <StatCard icon={ShoppingBag} label="إجمالي المنتجات" value={stats.productCount} color="#8D6E3A" />
            <StatCard icon={TrendingUp} label="إجمالي الطلبات" value={stats.orderCount} color="#1A1A1E" />
          </div>
        )}

        {/* Data loading indicator (overlay, not full-screen) */}
        {dataLoading && (
          <div className="text-center py-8 text-sm text-[#9A8A6B] flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> جاري تحميل البيانات…
          </div>
        )}

        {/* Stores tab */}
        {tab === 'stores' && !dataLoading && (
          <div className="bg-white border border-[#EDE6D8] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#FFFCF8] text-[#7A6F5A] text-xs">
                  <tr>
                    <th className="text-right p-3 font-bold">المتجر</th>
                    <th className="text-right p-3 font-bold">السلاج</th>
                    <th className="text-right p-3 font-bold">النطاق المخصص</th>
                    <th className="text-right p-3 font-bold">الحالة</th>
                    <th className="text-right p-3 font-bold">الخطة</th>
                    <th className="text-right p-3 font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map(s => (
                    <tr key={s._id} className="border-t border-[#EDE6D8] hover:bg-[#FFFCF8]">
                      <td className="p-3">
                        <div className="font-bold text-[#1A1A1E]">{s.name}</div>
                        <div className="text-xs text-[#9A8A6B]">{s.nameAr}</div>
                      </td>
                      <td className="p-3 text-xs font-mono text-[#A02A5B]">{s.slug}</td>
                      <td className="p-3 text-xs text-[#7A6F5A]">{s.customDomain || '—'}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${statusLabels[s.status].color}`}>
                          {statusLabels[s.status].label}
                        </span>
                      </td>
                      <td className="p-3">
                        <select
                          value={s.plan}
                          disabled={updatingId === s._id}
                          onChange={e => handleUpdateStore(s._id, { plan: e.target.value as StorePlan })}
                          className="text-xs font-bold border border-[#EDE6D8] rounded-full px-2 py-1 bg-white outline-none"
                        >
                          {PLANS.map(p => <option key={p} value={p}>{planLabels[p]}</option>)}
                        </select>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {s.status === 'active' ? (
                            <button
                              onClick={() => handleUpdateStore(s._id, { status: 'suspended' })}
                              disabled={updatingId === s._id}
                              title="إيقاف المتجر"
                              className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 text-amber-700 grid place-items-center hover:bg-amber-100"
                            >
                              <Pause size={12} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStore(s._id, { status: 'active' })}
                              disabled={updatingId === s._id}
                              title="تفعيل المتجر"
                              className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 grid place-items-center hover:bg-emerald-100"
                            >
                              <Play size={12} />
                            </button>
                          )}
                          <a
                            href={`/?store=${s.slug}&storeId=${s._id}`}
                            target="_blank"
                            rel="noreferrer"
                            title="زيارة المتجر"
                            className="w-7 h-7 rounded-full bg-[#1A1A1E] text-white grid place-items-center hover:bg-black"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stores.length === 0 && (
              <div className="text-center py-12 text-[#9A8A6B] text-sm">لا توجد متاجر بعد</div>
            )}
          </div>
        )}

        {/* Users tab */}
        {tab === 'users' && !dataLoading && (
          <div className="bg-white border border-[#EDE6D8] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#FFFCF8] text-[#7A6F5A] text-xs">
                  <tr>
                    <th className="text-right p-3 font-bold">الاسم</th>
                    <th className="text-right p-3 font-bold">البريد</th>
                    <th className="text-right p-3 font-bold">الهاتف</th>
                    <th className="text-right p-3 font-bold">الدور</th>
                    <th className="text-right p-3 font-bold">المتاجر</th>
                    <th className="text-right p-3 font-bold">تاريخ التسجيل</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} className="border-t border-[#EDE6D8] hover:bg-[#FFFCF8]">
                      <td className="p-3 font-bold text-[#1A1A1E]">{u.fullName}</td>
                      <td className="p-3 text-xs text-[#7A6F5A]">{u.email}</td>
                      <td className="p-3 text-xs text-[#7A6F5A]" dir="ltr">{u.phone || '—'}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          u.role === 'super_admin' ? 'bg-[#A02A5B] text-white' : 'bg-[#FFFBF0] text-[#8D6E3A] border border-[#F0D9A8]'
                        }`}>
                          {u.role === 'super_admin' ? 'مدير عام' : 'تاجر'}
                        </span>
                      </td>
                      <td className="p-3 text-xs">{u.storeIds?.length || 0} متجر</td>
                      <td className="p-3 text-xs text-[#9A8A6B]">{new Date(u.createdAt).toLocaleDateString('ar-DZ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && (
              <div className="text-center py-12 text-[#9A8A6B] text-sm">لا يوجد تجار بعد</div>
            )}
          </div>
        )}

        {/* Stats tab */}
        {tab === 'stats' && !dataLoading && stats && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
              <h3 className="font-bold text-[#1A1A1E] mb-4">المتاجر حسب الحالة</h3>
              <div className="space-y-2">
                {STATUSES.map(st => (
                  <div key={st} className="flex items-center justify-between">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${statusLabels[st].color}`}>
                      {statusLabels[st].label}
                    </span>
                    <span className="font-extrabold text-lg text-[#1A1A1E]">{stats.storesByStatus?.[st] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
              <h3 className="font-bold text-[#1A1A1E] mb-4">المتاجر حسب الخطة</h3>
              <div className="space-y-2">
                {PLANS.map(p => (
                  <div key={p} className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#FFFBF0] text-[#8D6E3A] border border-[#F0D9A8]">
                      {planLabels[p]}
                    </span>
                    <span className="font-extrabold text-lg text-[#1A1A1E]">{stats.storesByPlan?.[p] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state (data loaded but nothing to show) */}
        {tab === 'stats' && !dataLoading && !stats && (
          <div className="text-center py-12 text-[#9A8A6B] text-sm">لا توجد إحصائيات بعد</div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Inline Super Admin Login Form
// ═══════════════════════════════════════════════════════════════════════════

function SuperAdminLogin({
  onLogin,
  onBackHome,
}: {
  onLogin: (email: string, password: string) => Promise<void>
  onBackHome: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(email, password)
      // The parent component will re-render to the dashboard on success
      // (no manual navigation needed — `user` from useTenant() updates).
    } catch (err: any) {
      const msg = err?.message
      if (msg === 'INVALID_CREDENTIALS') {
        setError('البريد أو كلمة المرور غير صحيحة')
      } else if (msg === 'LOGIN_FAILED' || msg === 'Failed to fetch') {
        setError('تعذّر الاتصال بالخادم — تأكد من تشغيل الـ API وإعداد MONGODB_URI')
      } else {
        setError(msg || 'فشل تسجيل الدخول')
      }
    } finally {
      setLoading(false)
    }
  }

  // Quick demo login — fills the form + submits with the default
  // super admin credentials. Useful for mobile testing where typing
  // a long email + password is tedious.
  const handleQuickDemo = async () => {
    setError('')
    setLoading(true)
    try {
      await onLogin('admin@lumiere.saas', 'admin12345')
    } catch (err: any) {
      const msg = err?.message
      if (msg === 'INVALID_CREDENTIALS') {
        setError('حساب المدير العام غير موجود — تأكد من تهيئة قاعدة البيانات (MONGODB_URI)')
      } else if (msg === 'LOGIN_FAILED' || msg === 'Failed to fetch') {
        setError('تعذّر الاتصال بالخادم — تأكد من تشغيل الـ API وإعداد MONGODB_URI')
      } else {
        setError(msg || 'فشل الدخول التجريبي')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[#FFFCF8] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#A02A5B] to-[#7A1F44] grid place-items-center mx-auto">
            <Crown size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#1A1A1E] mt-3">دخول المدير العام</h1>
          <p className="text-sm text-[#7A6F5A] mt-1">لوحة تحكم منصة LUMIÈRE SaaS</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-[#EDE6D8] shadow-lg space-y-3">
          <div>
            <label className="text-xs font-bold text-[#7A6F5A]">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@lumiere.saas"
              dir="ltr"
              className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A02A5B]"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#7A6F5A]">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A02A5B]"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-l from-[#A02A5B] to-[#7A1F44] text-white py-3 rounded-xl font-bold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {loading ? 'جاري الدخول...' : 'دخول المدير العام'}
          </button>

          {/* Quick demo login — uses the default super admin account
              created by seed-runner.ts on first DB init. */}
          <button
            type="button"
            onClick={handleQuickDemo}
            disabled={loading}
            className="w-full bg-[#FFFBF0] border border-[#F0D9A8] text-[#8D6E3A] py-2.5 rounded-xl font-bold hover:bg-[#FFF3E0] transition text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Zap size={12} /> دخول تجريبي سريع (admin@lumiere.saas)
          </button>
        </form>

        <div className="mt-4 text-center">
          <button onClick={onBackHome} className="text-xs text-[#9A8A6B] hover:text-[#1A1A1E]">
            ← العودة للصفحة الرئيسية
          </button>
        </div>

        <div className="mt-3 text-center text-[11px] text-[#9A8A6B] bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl p-2">
          <b>الحساب الافتراضي:</b><br />
          admin@lumiere.saas / admin12345
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4">
      <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: color + '20' }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="font-extrabold text-2xl text-[#1A1A1E] mt-2">{value}</div>
      <div className="text-xs text-[#9A8A6B]">{label}</div>
    </div>
  )
}
