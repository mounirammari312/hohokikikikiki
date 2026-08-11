/**
 * Client-side fetch layer for the LUMIÈRE store API.
 *
 * All client-side data access goes through this module. It:
 *  - Calls the Vercel Serverless API routes (/api/products, /api/orders, …)
 *  - Caches GET responses in memory + localStorage so the UI feels instant
 *    on repeat visits (and so the page renders something even if the API
 *    is briefly unreachable).
 *  - Falls back to the old LocalStorage-only seed data when the API is
 *    unreachable (e.g. running `vite dev` without the serverless backend).
 *
 * IMPORTANT: All mutation functions (POST/PUT/DELETE) bypass the cache
 * and invalidate affected queries so the next GET refetches fresh data.
 */

import { seedProducts, seedWilayas, defaultSettings, presetDomains } from './seed'
import type {
  Product, Order, OrderItem, OrderStatus, WilayaRate, StoreSettings, StoreDomain,
} from './types'

// ─── Cache helpers ──────────────────────────────────────────────────────────

const memCache = new Map<string, { data: any; ts: number }>()
const MEM_TTL = 30_000 // 30 seconds — short enough to feel live, long enough to avoid refetching on every render

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function lsGet<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function lsSet(key: string, data: unknown) {
  if (!isBrowser()) return
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // Quota exceeded — drop oldest cached collection
  }
}

// ─── Fetch helpers ──────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit, timeoutMs = 9000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(path, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
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

/** Cached GET with localStorage fallback. Returns the cached value
 *  immediately if available, then refetches in the background and
 *  triggers `onRefetch` if the data changed. */
async function cachedGet<T>(
  path: string,
  lsKey: string,
  fallback: T,
  opts: { onRefetch?: (data: T) => void } = {}
): Promise<T> {
  // 1) Memory cache hit?
  const mem = memCache.get(path)
  const now = Date.now()
  if (mem && now - mem.ts < MEM_TTL) {
    // Still kick off a background refresh if data is more than 10s old
    if (now - mem.ts > 10_000) {
      apiFetch<T>(path).then(fresh => {
        memCache.set(path, { data: fresh, ts: Date.now() })
        lsSet(lsKey, fresh)
        opts.onRefetch?.(fresh)
      }).catch(() => {})
    }
    return mem.data
  }

  // 2) Try the API
  try {
    const fresh = await apiFetch<T>(path)
    memCache.set(path, { data: fresh, ts: Date.now() })
    lsSet(lsKey, fresh)
    return fresh
  } catch (err) {
    // 3) Fall back to localStorage, then to the in-memory fallback
    const cached = lsGet<T | null>(lsKey, null)
    if (cached) {
      memCache.set(path, { data: cached, ts: now })
      return cached
    }
    if (mem?.data) return mem.data
    return fallback
  }
}

function invalidate(path: string) {
  memCache.delete(path)
}

// ─── Public API: Products ───────────────────────────────────────────────────

const PRODUCTS_PATH = '/api/products'

export async function fetchProducts(): Promise<Product[]> {
  const { products } = await cachedGet<{ products: Product[] }>(
    PRODUCTS_PATH,
    'lumiere_products_v3',
    { products: seedProducts as Product[] }
  )
  return products || []
}

export async function fetchProductById(id: string): Promise<Product | undefined> {
  // Use the list cache when possible to avoid an extra round trip
  const list = await fetchProducts()
  return list.find(p => p._id === id)
}

export async function createProductApi(data: any): Promise<Product[]> {
  const { products } = await apiFetch<{ products: Product[] }>(PRODUCTS_PATH, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  invalidate(PRODUCTS_PATH)
  return products
}

export async function updateProductApi(id: string, patch: any): Promise<Product[]> {
  const { products } = await apiFetch<{ products: Product[] }>(`${PRODUCTS_PATH}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
  invalidate(PRODUCTS_PATH)
  return products
}

export async function deleteProductApi(id: string): Promise<Product[]> {
  const { products } = await apiFetch<{ products: Product[] }>(`${PRODUCTS_PATH}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  invalidate(PRODUCTS_PATH)
  return products
}

export async function duplicateProductApi(id: string): Promise<Product[]> {
  const { products } = await apiFetch<{ products: Product[] }>(
    `${PRODUCTS_PATH}/${encodeURIComponent(id)}/action`,
    { method: 'POST', body: JSON.stringify({ action: 'duplicate' }) }
  )
  invalidate(PRODUCTS_PATH)
  return products
}

export async function toggleProductFlagApi(id: string, flag: 'isFeatured' | 'isNew'): Promise<Product[]> {
  const action = flag === 'isFeatured' ? 'toggleFeatured' : 'toggleNew'
  const { products } = await apiFetch<{ products: Product[] }>(
    `${PRODUCTS_PATH}/${encodeURIComponent(id)}/action`,
    { method: 'POST', body: JSON.stringify({ action }) }
  )
  invalidate(PRODUCTS_PATH)
  return products
}

// ─── Public API: Orders ─────────────────────────────────────────────────────

const ORDERS_PATH = '/api/orders'

export async function fetchOrders(): Promise<Order[]> {
  const { orders } = await cachedGet<{ orders: Order[] }>(
    ORDERS_PATH,
    'lumiere_orders_v3',
    { orders: [] as Order[] }
  )
  return orders || []
}

export async function fetchOrderByNumber(orderNumber: string): Promise<Order | undefined> {
  try {
    const { order } = await apiFetch<{ order: Order }>(
      `${ORDERS_PATH}/${encodeURIComponent(orderNumber)}`
    )
    return order
  } catch {
    // Fallback: search the cached list
    const list = await fetchOrders()
    return list.find(o => o.orderNumber === orderNumber)
  }
}

export async function createOrderApi(data: any): Promise<Order> {
  const { order } = await apiFetch<{ order: Order }>(ORDERS_PATH, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  invalidate(ORDERS_PATH)
  return order
}

export async function updateOrderStatusApi(id: string, status: OrderStatus): Promise<Order[]> {
  const { orders } = await apiFetch<{ orders: Order[] }>(
    `${ORDERS_PATH}/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify({ status }) }
  )
  invalidate(ORDERS_PATH)
  return orders
}

export async function deleteOrderApi(id: string): Promise<Order[]> {
  const { orders } = await apiFetch<{ orders: Order[] }>(
    `${ORDERS_PATH}/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  )
  invalidate(ORDERS_PATH)
  return orders
}

// ─── Public API: Wilayas ────────────────────────────────────────────────────

const WILAYAS_PATH = '/api/wilayas'

export async function fetchWilayas(): Promise<WilayaRate[]> {
  const { wilayas } = await cachedGet<{ wilayas: WilayaRate[] }>(
    WILAYAS_PATH,
    'lumiere_wilayas_v3',
    { wilayas: seedWilayas as WilayaRate[] }
  )
  return wilayas || []
}

export async function updateWilayaRateApi(code: string, data: Partial<WilayaRate>): Promise<WilayaRate[]> {
  const { wilayas } = await apiFetch<{ wilayas: WilayaRate[] }>(
    `${WILAYAS_PATH}?code=${encodeURIComponent(code)}`,
    { method: 'PATCH', body: JSON.stringify(data) }
  )
  invalidate(WILAYAS_PATH)
  return wilayas
}

export async function addWilayaApi(data: WilayaRate): Promise<WilayaRate[]> {
  const { wilayas } = await apiFetch<{ wilayas: WilayaRate[] }>(WILAYAS_PATH, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  invalidate(WILAYAS_PATH)
  return wilayas
}

// ─── Public API: Settings ───────────────────────────────────────────────────

const SETTINGS_PATH = '/api/settings'

export async function fetchSettings(): Promise<StoreSettings> {
  const { settings } = await cachedGet<{ settings: StoreSettings }>(
    SETTINGS_PATH,
    'lumiere_settings_v3',
    { settings: defaultSettings }
  )
  return settings || defaultSettings
}

export async function saveSettingsApi(data: StoreSettings): Promise<StoreSettings> {
  const { settings } = await apiFetch<{ settings: StoreSettings }>(SETTINGS_PATH, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  invalidate(SETTINGS_PATH)
  return settings
}

export async function updateSettingsApi(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const { settings } = await apiFetch<{ settings: StoreSettings }>(SETTINGS_PATH, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  invalidate(SETTINGS_PATH)
  return settings
}

// ─── Public API: Domains ────────────────────────────────────────────────────

const DOMAINS_PATH = '/api/domains'

export async function fetchDomains(): Promise<StoreDomain[]> {
  const { domains } = await cachedGet<{ domains: StoreDomain[] }>(
    DOMAINS_PATH,
    'lumiere_domains_v3',
    { domains: presetDomains as StoreDomain[] }
  )
  return domains || (presetDomains as StoreDomain[])
}

export async function createCustomDomainApi(data: Omit<StoreDomain, 'id'>): Promise<StoreDomain[]> {
  const { domains } = await apiFetch<{ domains: StoreDomain[] }>(DOMAINS_PATH, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  invalidate(DOMAINS_PATH)
  return domains
}

export async function updateDomainApi(id: string, patch: Partial<StoreDomain>): Promise<StoreDomain[]> {
  const { domains } = await apiFetch<{ domains: StoreDomain[] }>(
    `${DOMAINS_PATH}?id=${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(patch) }
  )
  invalidate(DOMAINS_PATH)
  // Settings may have been patched too
  invalidate(SETTINGS_PATH)
  return domains
}

export async function deleteDomainApi(id: string): Promise<StoreDomain[]> {
  const { domains } = await apiFetch<{ domains: StoreDomain[] }>(
    `${DOMAINS_PATH}?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  )
  invalidate(DOMAINS_PATH)
  invalidate(SETTINGS_PATH)
  return domains
}

export async function activateDomainApi(id: string): Promise<{ domain: StoreDomain; settings: StoreSettings }> {
  const result = await apiFetch<{ domain: StoreDomain; settings: StoreSettings }>(
    `${DOMAINS_PATH}/activate`,
    { method: 'POST', body: JSON.stringify({ id }) }
  )
  invalidate(DOMAINS_PATH)
  invalidate(SETTINGS_PATH)
  return result
}

// ─── Sync subscription (for cross-tab refresh) ──────────────────────────────

const listeners = new Set<() => void>()

export function subscribeRefresh(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notifyRefresh() {
  listeners.forEach(fn => fn())
}

// When another tab updates data, the storage event fires → invalidate + notify
if (isBrowser()) {
  window.addEventListener('storage', (e) => {
    if (!e.key) return
    if (e.key.startsWith('lumiere_')) {
      memCache.clear()
      notifyRefresh()
    }
  })
}

/** Force-invalidate all caches and notify subscribers to refetch. */
export function invalidateAll() {
  memCache.clear()
  notifyRefresh()
}
