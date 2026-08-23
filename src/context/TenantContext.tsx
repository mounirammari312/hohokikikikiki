/**
 * TenantContext — Client-side mirror of server resolveTenant logic.
 * Handles subdomains, query params (?store=, ?storeId=), direct paths (/store/:slug),
 * and platform apex domain resolution.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { TenantStore, MerchantUser } from '../services/api/types'
import { getSettings } from '../services/api/settings'

// النطاق الأساسي للمنصة
const PLATFORM_APEX = (
  (import.meta as any).env?.VITE_PLATFORM_APEX ||
  'amugar.saas'
).toLowerCase()

const PLATFORM_HOSTS = new Set([
  'localhost', '127.0.0.1',
  PLATFORM_APEX,
  'www.' + PLATFORM_APEX,
])

interface TenantCtx {
  /** Resolved storeId for the current hostname (or null on platform host). */
  storeId: string | null
  /** Resolved slug (when available — useful for display + URL building). */
  storeSlug: string | null
  /** The resolved TenantStore document (fetched from /api/stores). */
  store: TenantStore | null
  /** True when the user is on the bare platform domain (no tenant context). */
  isPlatformHost: boolean
  /** Loading state while the store is being resolved. */
  loading: boolean
  /** Current logged-in merchant (null if not logged in). */
  user: MerchantUser | null
  /** Login: POST /api/auth/login, store token, fetch user. */
  login: (email: string, password: string) => Promise<void>
  /** Logout: clear token + user. */
  logout: () => void
  /** Refresh the current user from /api/auth/me. */
  refreshUser: () => Promise<void>
}

const Ctx = createContext<TenantCtx>(null as any)

const TOKEN_KEY = 'amugar_token'
const TOKEN_KEY_LEGACY = 'amugar_saas_token'
const USER_KEY = 'amugar_saas_user'
const ACTIVE_STORE_KEY = 'amugar_saas_active_store'
const ACTIVE_SLUG_KEY = 'amugar_saas_active_slug'

/** قراءة التوكن المخزن */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch { return null }
}

/** قراءة بيانات التاجر المخزنة */
function getCachedUser(): MerchantUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** استخراج النطاق الفرعي من اسم المضيف */
function detectTenantSlugFromHost(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname.toLowerCase()
  if (host.endsWith('.' + PLATFORM_APEX)) {
    const slug = host.slice(0, -1 * (PLATFORM_APEX.length + 1))
    if (slug && slug !== 'www') return slug
  }
  return null
}

/** التحقق هل المضيف الحالي هو المنصة العامة */
export function isPlatformHostNow(): boolean {
  if (typeof window === 'undefined') return true
  const host = window.location.hostname.toLowerCase()
  return PLATFORM_HOSTS.has(host) || host.endsWith('.vercel.app')
}

/** استخراج اسم المتجر من ?store= */
function detectTenantSlugFromQuery(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const s = params.get('store')
  return s ? s.toLowerCase().trim() : null
}

/** استخراج اسم المتجر من المسار المباشر /store/:slug */
function detectTenantSlugFromPath(): string | null {
  if (typeof window === 'undefined') return null
  const pathname = window.location.pathname
  const match = pathname.match(/^\/store\/([a-zA-Z0-9_-]+)/i)
  return match ? match[1].toLowerCase().trim() : null
}

/** استخراج معرف المتجر من ?storeId= */
function detectStoreIdFromQuery(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const s = params.get('storeId')
  return s ? s.trim() : null
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeSlug, setStoreSlug] = useState<string | null>(null)
  const [store, setStore] = useState<TenantStore | null>(null)
  const [isPlatformHost, setIsPlatformHost] = useState(true)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<MerchantUser | null>(() => getCachedUser())

  // نقل التوكن القديم إن وجد
  useEffect(() => {
    try {
      if (!localStorage.getItem(TOKEN_KEY) && localStorage.getItem(TOKEN_KEY_LEGACY)) {
        localStorage.setItem(TOKEN_KEY, localStorage.getItem(TOKEN_KEY_LEGACY)!)
        localStorage.removeItem(TOKEN_KEY_LEGACY)
      }
    } catch {}
  }, [])

  // تحديد هوية المتجر بدقة وفصل الذاكرة عن المنصة العامة
  const resolveTenant = useCallback(async () => {
    const platformHost = isPlatformHostNow()

    const explicitStoreId = detectStoreIdFromQuery()
    const slugFromQuery = detectTenantSlugFromQuery()
    const slugFromPath = detectTenantSlugFromPath()
    const slugFromHost = detectTenantSlugFromHost()

    const directSlug = slugFromPath || slugFromQuery || slugFromHost

    if (explicitStoreId) {
      setStoreId(explicitStoreId)
      setStoreSlug(directSlug)
      setIsPlatformHost(false)
    } else if (directSlug) {
      setStoreId(null)
      setStoreSlug(directSlug)
      setIsPlatformHost(false)
    } else if (platformHost) {
      // البقاء كمنصة رئيسية دائماً عند عدم وجود طلب صريح لمتجر
      setStoreId(null)
      setStoreSlug(null)
      setStore(null)
      setIsPlatformHost(true)
    } else {
      setStoreId(null)
      setStoreSlug(null)
      setIsPlatformHost(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void resolveTenant()
    const onPop = () => void resolveTenant()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [resolveTenant])

  // ─── المصادقة والجلسات ──────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    try {
      const { authLogin } = await import('../services/api/client')
      const { user, token, storeIds } = await authLogin(email, password)
      try {
        localStorage.setItem(TOKEN_KEY, token)
        localStorage.setItem(USER_KEY, JSON.stringify(user))
      } catch {}
      setUser(user)
      if (storeIds && storeIds.length && !storeId) {
        setStoreId(storeIds[0])
        try { localStorage.setItem(ACTIVE_STORE_KEY, storeIds[0]) } catch {}
      }
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new Error('انتهت مهلة الاتصال — حاول مرة أخرى')
      }
      const errMsg = err?.body?.message || err?.body?.error || err?.message || 'LOGIN_FAILED'
      throw new Error(errMsg)
    }
  }, [storeId])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_KEY_LEGACY)
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(ACTIVE_STORE_KEY)
      localStorage.removeItem(ACTIVE_SLUG_KEY)
    } catch {}
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = getToken()
    if (!token) { setUser(null); return }
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-merchant-token': token,
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) { logout(); return }
      const data = await res.json()
      const user = data.user
      try { localStorage.setItem(USER_KEY, JSON.stringify(user)) } catch {}
      setUser(user)
      if (data.storeIds && data.storeIds.length && !storeId) {
        setStoreId(data.storeIds[0])
        try { localStorage.setItem(ACTIVE_STORE_KEY, data.storeIds[0]) } catch {}
      }
    } catch {}
  }, [logout, storeId])

  useEffect(() => {
    if (getToken()) {
      void refreshUser()
      const t = setTimeout(() => setLoading(false), 600)
      return () => clearTimeout(t)
    } else {
      setUser(null)
      setLoading(false)
    }
  }, [refreshUser])

  // ─── تطبيق ألوان المتجر على متغيرات CSS ────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined') return
    const s: any = getSettings()
    const root = document.documentElement
    root.style.setProperty('--color-primary', s.primaryColor || '#C9A96A')
    root.style.setProperty('--color-secondary', s.secondaryColor || '#1A1A1E')
    root.style.setProperty('--color-bg', s.bgColor || '#FFFCF8')
    root.style.setProperty('--color-card', s.cardBgColor || '#FFFFFF')
    root.style.setProperty('--color-text', s.textColor || '#1A1A1E')
    root.style.setProperty('--color-accent', s.accentColor || '#A02A5B')
  }, [storeId, storeSlug, loading])

  return (
    <Ctx.Provider value={{
      storeId, storeSlug, store, isPlatformHost, loading,
      user, login, logout, refreshUser,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTenant() {
  return useContext(Ctx)
}

export function setActiveStoreId(id: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('storeId', id)
  window.history.replaceState(null, '', url.toString())
  try { localStorage.setItem(ACTIVE_STORE_KEY, id) } catch {}
  window.dispatchEvent(new PopStateEvent('popstate'))
}

