/**
 * SuperAdmin — platform-wide dashboard at /super-admin.
 *
 * Only accessible to MerchantUser with role === 'super_admin'.
 * Lets the platform owner:
 *   - View all TenantStore documents on the platform
 *   - Toggle store status (active / suspended / expired)
 *   - Change a store's plan (free_trial / starter / pro / vip)
 *   - View platform-wide stats (store count, user count, order count, etc.)
 *   - View all merchant users
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import {
  superAdminListStores, superAdminListUsers, superAdminStats, superAdminUpdateStore,
} from '../services/api/client'
import type { TenantStore, MerchantUser, StorePlan, StoreStatus } from '../services/api/types'
import {
  Store, Users, ShoppingBag, TrendingUp, Crown, AlertCircle, Check, X,
  Pause, Play, Star, LogOut, ExternalLink, RefreshCw,
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
  const { user, logout, loading: tenantLoading } = useTenant()
  const nav = useNavigate()
  const [stores, setStores] = useState<TenantStore[]>([])
  const [users, setUsers] = useState<MerchantUser[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stores' | 'users' | 'stats'>('stores')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!tenantLoading) {
      if (!user) nav('/super-admin/login')
      else if (user.role !== 'super_admin') nav('/')
    }
  }, [user, tenantLoading, nav])

  const refresh = async () => {
    setLoading(true)
    try {
      const [s, u, st] = await Promise.all([
        superAdminListStores(), superAdminListUsers(), superAdminStats(),
      ])
      setStores(s); setUsers(u); setStats(st)
    } catch (err) {
      console.error('super-admin refresh failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'super_admin') void refresh()
  }, [user])

  const handleUpdateStore = async (id: string, patch: Partial<TenantStore>) => {
    setUpdatingId(id)
    try {
      await superAdminUpdateStore(id, patch)
      await refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingId(null)
    }
  }

  if (tenantLoading || loading) {
    return <div className="min-h-screen grid place-items-center text-[#9A8A6B]">جاري التحميل…</div>
  }
  if (!user || user.role !== 'super_admin') return null

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
            <button onClick={refresh} className="w-9 h-9 rounded-full bg-white/10 grid place-items-center hover:bg-white/20 transition" title="تحديث">
              <RefreshCw size={14} />
            </button>
            <span className="text-xs text-white/70">{user.email}</span>
            <button onClick={() => { logout(); nav('/') }} className="text-xs bg-white/10 px-3 py-2 rounded-full hover:bg-white/20 flex items-center gap-1.5">
              <LogOut size={12} /> خروج
            </button>
          </div>
        </div>
      </header>

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

        {/* Stores tab */}
        {tab === 'stores' && (
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
                            href={`https://${s.slug}.${((import.meta as any).env?.VITE_PLATFORM_APEX || 'lumiere.saas')}/?storeId=${s._id}`}
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
        {tab === 'users' && (
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
          </div>
        )}

        {/* Stats tab */}
        {tab === 'stats' && stats && (
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
