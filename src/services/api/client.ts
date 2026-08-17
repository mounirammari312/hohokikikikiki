/**
 * Client-side fetch layer — MULTI-TENANT SaaS version.
 *
 * Every request automatically carries:
 *   - `x-store-id` header — the current tenant (resolved by TenantContext)
 *   - `x-merchant-token` header — the merchant's session token (if logged in)
 *
 * On the platform apex (no tenant), the storefront endpoints fall
 * through to the default demo store on the server, while the SaaS
 * landing page only uses the /api/auth/* and /api/stores/* endpoints
 * which don't require a tenant context.
 */

import { seedProducts, seedWilayas, defaultSettings, presetDomains } from './seed'
import type {
  Product, Order, OrderStatus, WilayaRate, StoreSettings, StoreDomain,
  TenantStore, MerchantUser,
} from './types'
import { getToken } from '../../context/TenantContext'

// ─── Cache helpers ──────────────────────────────────────────────────────────

const memCache = new Map<string, { data: any; ts: number }>()
const MEM_TTL = 30_000

/** Build a per-tenant cache key so two stores hitting the same
 *  API path (e.g. `/api/products`) don't share a cache entry.
 *  We use the active store slug/id as a discriminator. */
function getCacheKey(path: string): string {
  const slug = getActiveStoreSlug() || getActiveStoreId() || 'default'
  return `${path}__${slug}`
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function lsGet<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch { return fallback }
}

function lsSet(key: string, data: unknown) {
  if (!isBrowser()) return
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

// ─── Tenant + auth header injection ──────────────────────────────────────────

function getActiveStoreId(): string | undefined {
  if (!isBrowser()) return undefined
  const urlParams = new URLSearchParams(window.location.search)
  // 1) ?storeId= explicit query — highest priority (dashboard, super-admin)
  const explicitId = urlParams.get('storeId')
  if (explicitId) return explicitId
  // 2) ?store=<slug> query — if present, DON'T fall back to cached storeId.
  //    The server will resolve the slug → storeId via x-store-slug header.
  //    Returning the old cached storeId here would override the URL slug
  //    and cause the wrong store's data to load.
  const slugFromUrl = urlParams.get('store')
  if (slugFromUrl) return undefined  // let the server resolve via x-store-slug
  // 3) No URL tenant → use cached storeId from previous dashboard login
  try {
    const cached = localStorage.getItem('lumiere_saas_active_store')
    if (cached) return cached
  } catch {}
  // 4) Fall back to undefined — the server will resolve via hostname
  return undefined
}

/** Get the ?store= slug from the URL (if any). Used as a fallback for
 *  environments where subdomains aren't available (vercel.app, localhost).
 *
 *  IMPORTANT: if there's a ?store= slug in the URL, we return ONLY that
 *  and ignore the cached slug — so visiting `/?store=my-shop` always
 *  loads `my-shop`'s data, not the previously-cached store's. */
function getActiveStoreSlug(): string | undefined {
  if (!isBrowser()) return undefined
  const urlParams = new URLSearchParams(window.location.search)
  const slugFromUrl = urlParams.get('store')
  if (slugFromUrl) return slugFromUrl
  // No URL slug → fall back to cached slug from a previous registration.
  // But ONLY if there's also no ?storeId= in the URL (because ?storeId=
  // means the user is accessing a specific store directly and we
  // shouldn't send a stale slug header that might confuse the server).
  const explicitStoreId = urlParams.get('storeId')
  if (explicitStoreId) return undefined
  try {
    const cached = localStorage.getItem('lumiere_saas_active_slug')
    if (cached) return cached
  } catch {}
  return undefined
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra || {}),
  }
  // Attach the explicit storeId if available (highest priority on server)
  const sid = getActiveStoreId()
  if (sid) h['x-store-id'] = sid
  // Attach the slug if available (fallback for vercel.app / localhost
  // where subdomains aren't usable — server resolves slug → storeId)
  const slug = getActiveStoreSlug()
  if (slug) h['x-store-slug'] = slug
  // ─── Auth token ──────────────────────────────────────────────────
  // Send the token in BOTH headers so the server (which accepts either)
  // can read it regardless of which `extractToken()` branch runs first.
  // The canonical header is `Authorization: Bearer <token>`; we also
  // send `x-merchant-token` for backwards-compat with older code paths.
  const token = getToken()
  if (token) {
    h['Authorization'] = `Bearer ${token}`
    h['x-merchant-token'] = token
  }
  return h
}

// ─── Fetch helpers ──────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(path, {
      ...init,
      signal: ctrl.signal,
      headers: buildHeaders(init?.headers as Record<string, string> | undefined),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const err: any = new Error(body.error || `HTTP_${res.status}`)
      err.status = res.status
      err.body = body
      throw err
    }
    return await res.json() as T
  } finally {
    clearTimeout(timer)
  }
}

async function cachedGet<T>(
  path: string,
  lsKey: string,
  fallback: T,
  opts: { onRefetch?: (data: T) => void } = {}
): Promise<T> {
  const cacheKey = getCacheKey(path)
  const mem = memCache.get(cacheKey)
  const now = Date.now()
  if (mem && now - mem.ts < MEM_TTL) {
    if (now - mem.ts > 10_000) {
      apiFetch<T>(path).then(fresh => {
        memCache.set(cacheKey, { data: fresh, ts: Date.now() })
        lsSet(lsKey, fresh)
        opts.onRefetch?.(fresh)
      }).catch(() => {})
    }
    return mem.data
  }
  try {
    const fresh = await apiFetch<T>(path)
    memCache.set(cacheKey, { data: fresh, ts: Date.now() })
    lsSet(lsKey, fresh)
    return fresh
  } catch {
    const cached = lsGet<T | null>(lsKey, null)
    if (cached) {
      memCache.set(cacheKey, { data: cached, ts: now })
      return cached
    }
    if (mem?.data) return mem.data
    return fallback
  }
}

function invalidate(path: string) { memCache.delete(getCacheKey(path)) }
export function invalidateAll() { memCache.clear() }

/**
 * Write a fresh value into BOTH the in-memory cache and localStorage,
 * so other tabs get notified via the `storage` event listener below.
 *
 * Used by saveSettingsApi / updateSettingsApi after a successful PUT/PATCH
 * — without this, the storefront in another tab would keep showing the
 * stale cached value until the next server fetch (which may never come
 * if the network is flaky).
 */
function primeCache(path: string, lsKey: string, data: unknown) {
  const cacheKey = getCacheKey(path)
  memCache.set(cacheKey, { data, ts: Date.now() })
  lsSet(lsKey, data)
  // Dispatch a synthetic storage event so the SAME tab also refreshes
  // (the native `storage` event only fires in OTHER tabs). This is the
  // fix for "settings don't update in the storefront after I save them
  // in /admin" — previously the merchant had to refresh the page.
  if (isBrowser()) {
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: lsKey, newValue: JSON.stringify(data) }))
    } catch {}
  }
}

// ─── Public API: Products ───────────────────────────────────────────────────

const PRODUCTS_PATH = '/api/products'

export async function fetchProducts(): Promise<Product[]> {
  const { products } = await cachedGet<{ products: Product[] }>(
    PRODUCTS_PATH, 'lumiere_products_v3', { products: seedProducts as Product[] }
  )
  return products || []
}
export async function fetchProductById(id: string): Promise<Product | undefined> {
  const list = await fetchProducts()
  return list.find(p => p._id === id)
}
export async function createProductApi(data: any): Promise<Product[]> {
  const { products } = await apiFetch<{ products: Product[] }>(PRODUCTS_PATH, {
    method: 'POST', body: JSON.stringify(data),
  })
  invalidate(PRODUCTS_PATH); return products
}
export async function updateProductApi(id: string, patch: any): Promise<Product[]> {
  const { products } = await apiFetch<{ products: Product[] }>(`${PRODUCTS_PATH}/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify(patch),
  })
  invalidate(PRODUCTS_PATH); return products
}
export async function deleteProductApi(id: string): Promise<Product[]> {
  const { products } = await apiFetch<{ products: Product[] }>(`${PRODUCTS_PATH}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  invalidate(PRODUCTS_PATH); return products
}
export async function duplicateProductApi(id: string): Promise<Product[]> {
  const { products } = await apiFetch<{ products: Product[] }>(
    `${PRODUCTS_PATH}/${encodeURIComponent(id)}/action`,
    { method: 'POST', body: JSON.stringify({ action: 'duplicate' }) }
  )
  invalidate(PRODUCTS_PATH); return products
}
export async function toggleProductFlagApi(id: string, flag: 'isFeatured' | 'isNew'): Promise<Product[]> {
  const action = flag === 'isFeatured' ? 'toggleFeatured' : 'toggleNew'
  const { products } = await apiFetch<{ products: Product[] }>(
    `${PRODUCTS_PATH}/${encodeURIComponent(id)}/action`,
    { method: 'POST', body: JSON.stringify({ action }) }
  )
  invalidate(PRODUCTS_PATH); return products
}

// ─── Public API: Orders ─────────────────────────────────────────────────────

const ORDERS_PATH = '/api/orders'

export async function fetchOrders(): Promise<Order[]> {
  const { orders } = await cachedGet<{ orders: Order[] }>(ORDERS_PATH, 'lumiere_orders_v3', { orders: [] as Order[] })
  return orders || []
}
export async function fetchOrderByNumber(orderNumber: string): Promise<Order | undefined> {
  try {
    const { order } = await apiFetch<{ order: Order }>(`${ORDERS_PATH}/${encodeURIComponent(orderNumber)}`)
    return order
  } catch {
    const list = await fetchOrders()
    return list.find(o => o.orderNumber === orderNumber)
  }
}
export async function createOrderApi(data: any): Promise<Order> {
  const { order } = await apiFetch<{ order: Order }>(ORDERS_PATH, {
    method: 'POST', body: JSON.stringify(data),
  })
  invalidate(ORDERS_PATH); return order
}
export async function updateOrderStatusApi(id: string, status: OrderStatus): Promise<Order[]> {
  const { orders } = await apiFetch<{ orders: Order[] }>(`${ORDERS_PATH}/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  })
  invalidate(ORDERS_PATH); return orders
}
export async function deleteOrderApi(id: string): Promise<Order[]> {
  const { orders } = await apiFetch<{ orders: Order[] }>(`${ORDERS_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  invalidate(ORDERS_PATH); return orders
}

// ─── Public API: Wilayas ────────────────────────────────────────────────────

const WILAYAS_PATH = '/api/wilayas'

export async function fetchWilayas(): Promise<WilayaRate[]> {
  const { wilayas } = await cachedGet<{ wilayas: WilayaRate[] }>(WILAYAS_PATH, 'lumiere_wilayas_v3', { wilayas: seedWilayas as WilayaRate[] })
  return wilayas || []
}
export async function updateWilayaRateApi(code: string, data: Partial<WilayaRate>): Promise<WilayaRate[]> {
  const { wilayas } = await apiFetch<{ wilayas: WilayaRate[] }>(`${WILAYAS_PATH}?code=${encodeURIComponent(code)}`, {
    method: 'PATCH', body: JSON.stringify(data),
  })
  invalidate(WILAYAS_PATH); return wilayas
}
export async function addWilayaApi(data: WilayaRate): Promise<WilayaRate[]> {
  const { wilayas } = await apiFetch<{ wilayas: WilayaRate[] }>(WILAYAS_PATH, {
    method: 'POST', body: JSON.stringify(data),
  })
  invalidate(WILAYAS_PATH); return wilayas
}

// ─── Public API: Settings ───────────────────────────────────────────────────

const SETTINGS_PATH = '/api/settings'

export async function fetchSettings(): Promise<StoreSettings> {
  const { settings } = await cachedGet<{ settings: StoreSettings }>(SETTINGS_PATH, 'lumiere_settings_v3', { settings: defaultSettings })
  return settings || defaultSettings
}
export async function saveSettingsApi(data: StoreSettings): Promise<StoreSettings> {
  const { settings } = await apiFetch<{ settings: StoreSettings }>(SETTINGS_PATH, {
    method: 'PUT', body: JSON.stringify(data),
  })
  // Prime BOTH the in-memory cache and localStorage with the fresh
  // value returned by the server, then fire a synthetic `storage` event
  // so the storefront (in this tab AND others) re-renders immediately.
  // This was the root cause of "settings don't update in the store
  // after saving in /admin" — the old code only invalidated the cache,
  // leaving the stale localStorage entry as the fallback for any later
  // failed fetch.
  primeCache(SETTINGS_PATH, 'lumiere_settings_v3', { settings })
  return settings
}
export async function updateSettingsApi(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const { settings } = await apiFetch<{ settings: StoreSettings }>(SETTINGS_PATH, {
    method: 'PATCH', body: JSON.stringify(patch),
  })
  primeCache(SETTINGS_PATH, 'lumiere_settings_v3', { settings })
  return settings
}

// ─── Public API: Domains ────────────────────────────────────────────────────

const DOMAINS_PATH = '/api/domains'

export async function fetchDomains(): Promise<StoreDomain[]> {
  const { domains } = await cachedGet<{ domains: StoreDomain[] }>(DOMAINS_PATH, 'lumiere_domains_v3', { domains: presetDomains as StoreDomain[] })
  return domains || (presetDomains as StoreDomain[])
}
export async function createCustomDomainApi(data: Omit<StoreDomain, 'id'>): Promise<StoreDomain[]> {
  const { domains } = await apiFetch<{ domains: StoreDomain[] }>(DOMAINS_PATH, {
    method: 'POST', body: JSON.stringify(data),
  })
  invalidate(DOMAINS_PATH); return domains
}
export async function updateDomainApi(id: string, patch: Partial<StoreDomain>): Promise<StoreDomain[]> {
  const { domains } = await apiFetch<{ domains: StoreDomain[] }>(`${DOMAINS_PATH}?id=${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(patch),
  })
  invalidate(DOMAINS_PATH); invalidate(SETTINGS_PATH); return domains
}
export async function deleteDomainApi(id: string): Promise<StoreDomain[]> {
  const { domains } = await apiFetch<{ domains: StoreDomain[] }>(`${DOMAINS_PATH}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  invalidate(DOMAINS_PATH); invalidate(SETTINGS_PATH); return domains
}
export async function activateDomainApi(id: string): Promise<{ domain: StoreDomain; settings: StoreSettings }> {
  const result = await apiFetch<{ domain: StoreDomain; settings: StoreSettings }>(`${DOMAINS_PATH}/activate`, {
    method: 'POST', body: JSON.stringify({ id }),
  })
  invalidate(DOMAINS_PATH); invalidate(SETTINGS_PATH); return result
}

// ─── Public API: Auth + Stores (SaaS layer) ─────────────────────────────────

export interface AuthLoginResponse {
  user: MerchantUser
  token: string
  storeIds: string[]
}

export async function authLogin(email: string, password: string): Promise<AuthLoginResponse> {
  const res = await apiFetch<AuthLoginResponse>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  })
  return res
}
export async function authRegister(payload: {
  fullName: string; email: string; password: string; phone?: string
  storeName: string; storeNameAr?: string; slug?: string
}): Promise<{ user: MerchantUser; token: string; storeId: string; storeIds: string[] }> {
  return await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) })
}
export async function authMe(): Promise<{ user: MerchantUser }> {
  return await apiFetch('/api/auth/me')
}

/** Update the merchant's own profile (fullName, phone). Email is NOT editable. */
export async function authUpdateProfile(patch: { fullName?: string; phone?: string }): Promise<{ user: MerchantUser }> {
  return await apiFetch('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/**
 * Change the merchant's password. Requires the current password to be
 * correct. On success, returns a fresh token (the old one is invalidated
 * because it embeds the old password hash).
 */
export async function authChangePassword(currentPassword: string, newPassword: string): Promise<{ user: MerchantUser; token: string }> {
  return await apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function listMyStores(): Promise<TenantStore[]> {
  const { stores } = await apiFetch<{ stores: TenantStore[] }>('/api/stores')
  return stores || []
}
export async function createStoreApi(payload: { name: string; nameAr?: string; slug?: string }): Promise<{ storeId: string; slug: string }> {
  return await apiFetch('/api/stores', { method: 'POST', body: JSON.stringify(payload) })
}
export async function updateStoreApi(id: string, patch: Partial<TenantStore>): Promise<{ store: TenantStore }> {
  return await apiFetch(`/api/stores/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

// ─── Public API: Super-Admin ────────────────────────────────────────────────
// All super-admin functions go through `apiFetch()` which calls
// `buildHeaders()` — that function already attaches the token as both
// `Authorization: Bearer <token>` AND `x-merchant-token: <token>` on
// every request. The explicit `authHeader()` helper below is just a
// safety net: if some future code path bypasses `apiFetch`, the
// super-admin functions will still send the token.
function authHeader(): Record<string, string> {
  if (!isBrowser()) return {}
  const token = localStorage.getItem('lumiere_token')
  if (!token) return {}
  return {
    'Authorization': `Bearer ${token}`,
    'x-merchant-token': token,
  }
}

export async function superAdminListStores(): Promise<TenantStore[]> {
  const { stores } = await apiFetch<{ stores: TenantStore[] }>('/api/super-admin/stores', {
    headers: authHeader(),
  })
  return stores || []
}
export async function superAdminUpdateStore(id: string, patch: Partial<TenantStore>): Promise<{ store: TenantStore }> {
  return await apiFetch(`/api/super-admin/stores/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    headers: authHeader(),
  })
}
export async function superAdminListUsers(): Promise<MerchantUser[]> {
  const { users } = await apiFetch<{ users: MerchantUser[] }>('/api/super-admin/users', {
    headers: authHeader(),
  })
  return users || []
}
export async function superAdminStats(): Promise<{
  storeCount: number; userCount: number; productCount: number; orderCount: number
  storesByStatus: Record<string, number>; storesByPlan: Record<string, number>
}> {
  return await apiFetch('/api/super-admin/stats', {
    headers: authHeader(),
  })
}

// ─── Cross-tab refresh subscription ─────────────────────────────────────────

const listeners = new Set<() => void>()
export function subscribeRefresh(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function notifyRefresh() { listeners.forEach(fn => fn()) }

if (isBrowser()) {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('lumiere_')) {
      memCache.clear()
      notifyRefresh()
    }
  })
}
