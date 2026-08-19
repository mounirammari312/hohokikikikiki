/**
 * TenantContext — the client-side mirror of the server's
 * `resolveTenant()` middleware.
 *
 * On app mount (and on every `hostname` change), we figure out which
 * TenantStore the current page belongs to by inspecting:
 *
 *   1. ?store=<slug> query param   (used on vercel.app + localhost
 *                                    where subdomains aren't available)
 *   2. ?storeId=<id> query param   (used by dashboard + super-admin)
 *   3. Subdomain `slug.amugar.saas` (production with wildcard DNS)
 *   4. Custom domain `mystore.com`  (production with custom domains)
 *
 * If none match, we treat the page as the bare platform host (SaaS landing).
 *
 * The session token (for merchant auth) lives in localStorage and is
 * also attached as `x-merchant-token` on every API call.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { TenantStore, MerchantUser } from '../services/api/types'
import { getSettings } from '../services/api/settings'

// Apex domain that identifies the platform itself. Subdomains of this
// are treated as tenant slugs. Configure via VITE_PLATFORM_APEX env.
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

// We keep the token under a SINGLE canonical localStorage key
// (`amugar_token`). The legacy `amugar_saas_token` key is migrated
// away once on app mount (see TenantProvider initializer below) and
// then removed — keeping both keys in sync caused confusion when one
// got cleared but not the other.
const TOKEN_KEY = 'amugar_token'
const TOKEN_KEY_LEGACY = 'amugar_saas_token'
const USER_KEY = 'amugar_saas_user'
const ACTIVE_STORE_KEY = 'amugar_saas_active_store'
const ACTIVE_SLUG_KEY = 'amugar_saas_active_slug'

/** Read the stored session token (or null).
 *  Only the canonical key is checked — the legacy key is migrated
 *  away once on mount (see TenantProvider) and not consulted here. */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch { return null }
}

/** Read the cached merchant user (or null). */
function getCachedUser(): MerchantUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/**
 * Extract the would-be tenant slug from the current hostname.
 * Returns null when on the platform apex (no tenant).
 *
 * Examples:
 *   demo.amugar.saas → 'demo'
 *   mystore.com       → null (custom domain — handled separately)
 *   amugar.saas      → null (platform apex)
 *   localhost         → null (no subdomain)
 */
function detectTenantSlugFromHost(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname.toLowerCase()
  if (host.endsWith('.' + PLATFORM_APEX)) {
    const slug = host.slice(0, -1 * (PLATFORM_APEX.length + 1))
    if (slug && slug !== 'www') return slug
  }
  return null
}

/**
 * Is the current host the platform itself (no tenant via subdomain)?
 *
 * Note: on vercel.app / localhost we ALWAYS return true here because
 * subdomains aren't usable — the tenant (if any) is provided via the
 * `?store=<slug>` query param, which is resolved separately by
 * `resolveTenant()` below.
 */
export function isPlatformHostNow(): boolean {
  if (typeof window === 'undefined') return true
  const host = window.location.hostname.toLowerCase()
  return PLATFORM_HOSTS.has(host) || host.endsWith('.vercel.app')
}

/**
 * Detect if the current URL has a tenant context via `?store=slug`
 * (used on vercel.app / localhost). Returns the slug or null.
 */
function detectTenantSlugFromQuery(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const s = params.get('store')
  return s ? s.toLowerCase().trim() : null
}

/** Detect explicit storeId from `?storeId=` query param. */
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

  // One-time migration: copy the legacy `amugar_saas_token` to the
  // canonical `amugar_token` key if the canonical key is empty. This
  // keeps existing logged-in sessions working after the key cleanup.
  useEffect(() => {
    try {
      if (!localStorage.getItem(TOKEN_KEY) && localStorage.getItem(TOKEN_KEY_LEGACY)) {
        localStorage.setItem(TOKEN_KEY, localStorage.getItem(TOKEN_KEY_LEGACY)!)
        localStorage.removeItem(TOKEN_KEY_LEGACY)
      }
    } catch {}
  }, [])

  // Resolve the tenant based on the current URL/hostname.
  // Resolution order (mirrors the server's resolveTenant in api/lib/tenant.ts):
  //   1. ?storeId= explicit query → use directly
  //   2. ?store=slug query → cache slug, server resolves it via x-store-slug header
  //   3. subdomain slug.amugar.saas → cache slug
  //   4. cached active slug from localStorage (from previous registration)
  //   5. nothing → platform host (SaaS landing)
  const resolveTenant = useCallback(async () => {
    const platformHost = isPlatformHostNow()
    setIsPlatformHost(platformHost)

    // Check URL tenant sources
    const explicitStoreId = detectStoreIdFromQuery()
    const slugFromQuery = detectTenantSlugFromQuery()
    const slugFromHost = detectTenantSlugFromHost()

    // If an explicit store query is present in the URL, prioritize it over cached localStorage!
    const hasExplicitUrlTenant = !!explicitStoreId || !!slugFromQuery || !!slugFromHost

    let cachedSlug: string | null = null
    let cachedStoreId: string | null = null
    if (!hasExplicitUrlTenant) {
      try {
        cachedSlug = localStorage.getItem(ACTIVE_SLUG_KEY)
        cachedStoreId = localStorage.getItem(ACTIVE_STORE_KEY)
      } catch {}
    }

    const resolvedStoreId = explicitStoreId || cachedStoreId
    const resolvedSlug = slugFromQuery || slugFromHost || cachedSlug

    if (explicitStoreId) {
      setStoreId(explicitStoreId)
      setStoreSlug(resolvedSlug)
      setIsPlatformHost(false)
    } else if (resolvedSlug) {
      // When resolving by slug, clear explicit storeId so client.ts uses x-store-slug header
      setStoreId(null)
      setStoreSlug(resolvedSlug)
      setIsPlatformHost(false)
    } else if (resolvedStoreId) {
      setStoreId(resolvedStoreId)
      setStoreSlug(resolvedSlug)
      setIsPlatformHost(false)
    } else if (platformHost) {
      setStoreId(null)
      setStoreSlug(null)
      setStore(null)
    } else {
      setStoreId(null)
      setStoreSlug(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void resolveTenant()
    // Re-resolve if the user navigates to a different hostname (e.g.
    // switches between subdomains) OR changes the query params.
    const onPop = () => void resolveTenant()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [resolveTenant])

  // ─── Auth ──────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    // IMPORTANT: use authLogin() from client.ts (not raw fetch) so the
    // CSRF token is auto-fetched + sent. The raw fetch was bypassing
    // the CSRF layer entirely, causing "CSRF_TOKEN_INVALID" on every login.
    try {
      const { authLogin } = await import('../services/api/client')
      const { user, token, storeIds } = await authLogin(email, password)
      // Save the token under the canonical key only. The legacy
      // `amugar_saas_token` key is no longer written (it was the source
      // of stale-token bugs where one code path cleared it and another
      // didn't).
      try {
        localStorage.setItem(TOKEN_KEY, token)
        localStorage.setItem(USER_KEY, JSON.stringify(user))
      } catch {}
      setUser(user)
      // If the merchant has stores, attach the first one as the active
      // storeId so subsequent dashboard calls are scoped correctly.
      if (storeIds && storeIds.length && !storeId) {
        setStoreId(storeIds[0])
        try { localStorage.setItem(ACTIVE_STORE_KEY, storeIds[0]) } catch {}
      }
    } catch (err: any) {
      // Network error / timeout — throw a clear error so the login form
      // can display a helpful message instead of hanging forever.
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new Error('انتهت مهلة الاتصال — حاول مرة أخرى')
      }
      // apiFetch errors have a .body with the server response.
      // Show the actual message (not just the error code) so the user
      // knows what went wrong.
      const errMsg = err?.body?.message || err?.body?.error || err?.message || 'LOGIN_FAILED'
      throw new Error(errMsg)
    }
  }, [storeId])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY)
      // Also clear any leftover legacy key from older sessions.
      localStorage.removeItem(TOKEN_KEY_LEGACY)
      localStorage.removeItem(USER_KEY)
    } catch {}
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = getToken()
    if (!token) { setUser(null); return }
    try {
      const res = await fetch('/api/auth/me', {
        // Send the token as `Authorization: Bearer <token>` (the standard
        // format). The server's `extractToken()` also accepts
        // `x-merchant-token` for backwards-compat, but Bearer is the
        // canonical way going forward.
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-merchant-token': token,  // legacy fallback
        },
        // Use an explicit timeout via AbortController so a hung API
        // never blocks the loading state forever.
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) { logout(); return }
      const data = await res.json()
      const user = data.user
      // Cache + set the user. If the server returned storeIds, cache
      // the first one as the active store too.
      try { localStorage.setItem(USER_KEY, JSON.stringify(user)) } catch {}
      setUser(user)
      if (data.storeIds && data.storeIds.length && !storeId) {
        setStoreId(data.storeIds[0])
        try { localStorage.setItem(ACTIVE_STORE_KEY, data.storeIds[0]) } catch {}
      }
    } catch {
      // network error / timeout — keep cached user (if any) so the
      // dashboard can still try to render with stale data.
    }
  }, [logout, storeId])

  // Refresh user on mount + when token changes
  useEffect(() => {
    if (getToken()) {
      void refreshUser()
    } else {
      // No token — make sure we don't sit in the loading state forever.
      setUser(null)
    }
    // Safety net: force loading=false after a short delay even if
    // refreshUser() never resolves (e.g. slow network, hung request).
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [refreshUser])

  // ─── Apply theme colors as CSS variables on <html> ────────────────
  // Whenever the active store changes (or the settings cache updates),
  // mirror the merchant's chosen palette into CSS custom properties so
  // components that DON'T receive the `store` object (ProductCard,
  // Header cart button, etc.) can still use the tenant's colors via
  // `var(--color-primary)` etc. Defaults match `defaultSettings` and
  // are also declared in src/index.css.
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

/** Set the active storeId (e.g. when a merchant switches between their stores). */
export function setActiveStoreId(id: string) {
  // This is a hack — we expose it as a free function so client.ts can
  // call it without going through React context. The TenantProvider
  // picks up the change on next render via the storeId state setter.
  // For simplicity, we just dispatch a popstate event so the resolver
  // runs again with the new ?storeId= query param.
  const url = new URL(window.location.href)
  url.searchParams.set('storeId', id)
  window.history.replaceState(null, '', url.toString())
  try { localStorage.setItem(ACTIVE_STORE_KEY, id) } catch {}
  window.dispatchEvent(new PopStateEvent('popstate'))
}
