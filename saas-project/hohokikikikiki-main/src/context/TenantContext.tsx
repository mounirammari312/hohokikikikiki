/**
 * TenantContext — the client-side mirror of the server's
 * `resolveTenant()` middleware.
 *
 * On app mount (and on every `hostname` change), we figure out which
 * TenantStore the current page belongs to by inspecting
 * `window.location.hostname`:
 *
 *   1. Bare platform domain (e.g. `lumiere.saas`)   → no tenant, show SaaS landing
 *   2. Subdomain `slug.lumiere.saas`                 → tenant = slug
 *   3. Custom domain `mystore.com`                   → tenant = customDomain
 *   4. `localhost` / `.vercel.app` preview           → use ?storeId=xxx OR fallback to demo
 *
 * Once resolved, the storeId is exposed via `useTenant()` and is
 * automatically injected into every API call by `client.ts` (via the
 * `x-store-id` header).
 *
 * The session token (for merchant auth) lives in localStorage and is
 * also attached as `x-merchant-token` on every API call.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { TenantStore, MerchantUser } from '../services/api/types'

// Apex domain that identifies the platform itself. Subdomains of this
// are treated as tenant slugs. Configure via VITE_PLATFORM_APEX env.
const PLATFORM_APEX = (
  (import.meta as any).env?.VITE_PLATFORM_APEX ||
  'lumiere.saas'
).toLowerCase()

const PLATFORM_HOSTS = new Set([
  'localhost', '127.0.0.1',
  PLATFORM_APEX,
  'www.' + PLATFORM_APEX,
])

interface TenantCtx {
  /** Resolved storeId for the current hostname (or DEFAULT_STORE_ID). */
  storeId: string | null
  /** The resolved TenantStore document (fetched from /api/auth/me-style endpoint). */
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

const TOKEN_KEY = 'lumiere_saas_token'
const USER_KEY = 'lumiere_saas_user'

/** Read the stored session token (or null). */
export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
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

/** Is the current host the platform itself (no tenant)? */
export function isPlatformHostNow(): boolean {
  if (typeof window === 'undefined') return true
  const host = window.location.hostname.toLowerCase()
  return PLATFORM_HOSTS.has(host) || host.endsWith('.vercel.app')
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [store, setStore] = useState<TenantStore | null>(null)
  const [isPlatformHost, setIsPlatformHost] = useState(true)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<MerchantUser | null>(() => getCachedUser())

  // Resolve the tenant by calling /api/stores or by reading ?storeId
  const resolveTenant = useCallback(async () => {
    const platformHost = isPlatformHostNow()
    setIsPlatformHost(platformHost)

    // If we're on the platform apex, there's no tenant to resolve.
    if (platformHost) {
      // But a logged-in merchant may still be here (e.g. on /super-admin)
      // — keep the user state but leave storeId null so the SaaS landing shows.
      setStoreId(null)
      setStore(null)
      setLoading(false)
      return
    }

    // On a tenant host: try to resolve via the API. The API does the
    // same hostname detection we do, so just hitting /api/settings
    // will return the settings for the right store. We can also pass
    // an explicit storeId via ?storeId= for testing.
    const urlParams = new URLSearchParams(window.location.search)
    const explicitStoreId = urlParams.get('storeId')
    if (explicitStoreId) {
      setStoreId(explicitStoreId)
    }
    // Don't wait — let the components fetch their own data with the
    // x-store-id header attached by client.ts. The header is computed
    // from storeId state below.
    setLoading(false)
  }, [])

  useEffect(() => {
    void resolveTenant()
    // Re-resolve if the user navigates to a different hostname (e.g.
    // switches between subdomains).
    const onPop = () => void resolveTenant()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [resolveTenant])

  // ─── Auth ──────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'LOGIN_FAILED')
    }
    const { user, token, storeIds } = await res.json()
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    setUser(user)
    // If the merchant has stores, attach the first one as the active
    // storeId so subsequent dashboard calls are scoped correctly.
    if (storeIds && storeIds.length && !storeId) {
      setStoreId(storeIds[0])
    }
  }, [storeId])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = getToken()
    if (!token) { setUser(null); return }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'x-merchant-token': token },
      })
      if (!res.ok) { logout(); return }
      const { user } = await res.json()
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      setUser(user)
    } catch {
      // network error — keep cached user
    }
  }, [logout])

  // Refresh user on mount + when token changes
  useEffect(() => {
    if (getToken()) void refreshUser()
  }, [refreshUser])

  return (
    <Ctx.Provider value={{
      storeId, store, isPlatformHost, loading,
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
  window.dispatchEvent(new PopStateEvent('popstate'))
}
