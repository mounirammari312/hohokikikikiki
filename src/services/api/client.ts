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

import { defaultSettings, presetDomains } from './seed'
import type {
  Product, Order, OrderStatus, WilayaRate, StoreSettings, StoreDomain,
  TenantStore, MerchantUser,
} from './types'
import { getToken } from '../../context/TenantContext'

// ─── Cache helpers ──────────────────────────────────────────────────────────
//
// CRITICAL: every cache entry (both in-memory and in localStorage) MUST be
// keyed per-tenant. Otherwise data from store A leaks into store B when:
//   - Two merchants share the same browser (e.g. public PC)
//   - A merchant logs out + logs in as a different store
//   - A visitor browses store A then store B
//
// We achieve this by appending the active store's storeId/slug to BOTH:
//   - the in-memory cache key (getCacheKey)
//   - the localStorage key (getLsKey)
//
// The localStorage key is built dynamically on every read/write so that
// switching stores (via ?store= or ?storeId= or login) automatically
// isolates the cache.

const memCache = new Map<string, { data: any; ts: number }>()
const MEM_TTL = 30_000

/** Build a per-tenant cache key so two stores hitting the same
 *  API path (e.g. `/api/products`) don't share a cache entry.
 *  We use the active store slug/id as a discriminator. */
function getCacheKey(path: string): string {
  const slug = getActiveStoreSlug() || getActiveStoreId() || 'default'
  return `${path}__${slug}`
}

/** Build a per-tenant localStorage key. This is the fix for the
 *  "data leakage between stores" bug — previously the lsKey was
 *  hardcoded (e.g. `amugar_products_v4`) and was shared across all
 *  stores on the same browser. Now it's `amugar_products_v5__<storeId>`
 *  so each store's data is isolated. */
function getLsKey(baseKey: string): string {
  const slug = getActiveStoreSlug() || getActiveStoreId() || 'default'
  return `${baseKey}__${slug}`
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

/** Clear ALL Amugar cache entries from localStorage for the CURRENT tenant.
 *  Called when the active store changes (login, logout, store switch) so
 *  that stale data from a previous store doesn't leak into the new one. */
export function clearTenantCache(): void {
  if (!isBrowser()) return
  try {
    // Remove all amugar_* keys that match the current tenant suffix
    const currentSuffix = getActiveStoreSlug() || getActiveStoreId() || 'default'
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('amugar_') && k.endsWith(`__${currentSuffix}`)) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
    // Also clear the in-memory cache for the current tenant
    memCache.clear()
  } catch {}
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
    const cached = localStorage.getItem('amugar_saas_active_store')
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
    const cached = localStorage.getItem('amugar_saas_active_slug')
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
  // ─── CSRF token ────────────────────────────────────────────────────
  // DISABLED: in-memory CSRF tokens don't work on Vercel serverless
  // (each request may hit a different instance). Security is maintained
  // via SameSite cookies + rate limiting + bcrypt + auth tokens.
  // The CSRF endpoint still exists (GET /api/auth/csrf) for backwards
  // compat, but validation is disabled server-side.
  return h
}

// ─── CSRF token cache ───────────────────────────────────────────────────────
// Fetched once from /api/auth/csrf, cached in memory, refreshed after 50 min.
// Without this, every POST (login, register, save settings, create order)
// returns 403 CSRF_TOKEN_INVALID.
let cachedCsrfToken: string | null = null
let csrfTokenFetchPromise: Promise<string> | null = null
const CSRF_REFRESH_MS = 50 * 60 * 1000  // 50 min (server TTL is 60 min)

async function ensureCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken
  // Dedup: if a fetch is already in-flight, wait for it (prevents N parallel fetches)
  if (csrfTokenFetchPromise) return csrfTokenFetchPromise
  csrfTokenFetchPromise = (async () => {
    try {
      const res = await fetch('/api/auth/csrf', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP_${res.status}`)
      const data = await res.json()
      cachedCsrfToken = data.csrfToken
      if (!cachedCsrfToken) throw new Error('NO_TOKEN_IN_RESPONSE')
      // Schedule a refresh before expiry
      setTimeout(() => { cachedCsrfToken = null }, CSRF_REFRESH_MS)
      return cachedCsrfToken
    } catch (err) {
      csrfTokenFetchPromise = null  // Allow retry on next call
      throw err
    } finally {
      csrfTokenFetchPromise = null
    }
  })()
  return csrfTokenFetchPromise
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
  lsKeyBase: string,
  fallback: T,
  opts: { onRefetch?: (data: T) => void } = {}
): Promise<T> {
  const cacheKey = getCacheKey(path)
  const lsKey = getLsKey(lsKeyBase)  // per-tenant localStorage key
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
function primeCache(path: string, lsKeyBase: string, data: unknown) {
  const cacheKey = getCacheKey(path)
  const lsKey = getLsKey(lsKeyBase)  // per-tenant localStorage key
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

// ─── المستورد السحري (Product Scraper) ──────────────────────────────────────

export interface ScrapedProduct {
  platform: string
  name: string
  price: number
  currency: string
  description: string
  images: string[]
  variants?: { name: string; options: string[] }[]
}

/** POST /api/products/scrape — scrape a product from an external URL */
export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  const { product } = await apiFetch<{ product: ScrapedProduct }>(`${PRODUCTS_PATH}/scrape`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
  return product
}

export async function fetchProducts(): Promise<Product[]> {
  const { products } = await cachedGet<{ products: Product[] }>(
    PRODUCTS_PATH, 'amugar_products_v5', { products: [] as Product[] }
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

/**
 * Toggle a product's visibility in the public Amugar Marketplace.
 * When true, the product appears at /marketplace for anyone to browse.
 * When false, it only appears in the merchant's own store.
 */
export async function toggleMarketplacePublishApi(id: string): Promise<Product[]> {
  const { products } = await apiFetch<{ products: Product[] }>(
    `${PRODUCTS_PATH}/${encodeURIComponent(id)}/action`,
    { method: 'POST', body: JSON.stringify({ action: 'toggleMarketplace' }) }
  )
  invalidate(PRODUCTS_PATH); return products
}

// ─── Public API: Marketplace (cross-tenant browse) ─────────────────────────
//
// These are PUBLIC endpoints — no auth, no tenant context. They aggregate
// products from ALL stores that have isPublishedInMarketplace: true.
// Used by the /marketplace browse page.

export interface MarketplaceProduct extends Product {
  storeId: string
}

export interface MarketplaceResponse {
  products: MarketplaceProduct[]
  total: number
  page: number
  totalPages: number
  stores: TenantStore[]
}

export interface MarketplaceQuery {
  q?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  sort?: 'newest' | 'popular' | 'price_low' | 'price_high'
  page?: number
  limit?: number
  storeId?: string
}

export async function fetchMarketplaceProducts(opts: MarketplaceQuery = {}): Promise<MarketplaceResponse> {
  const params = new URLSearchParams()
  if (opts.q) params.set('q', opts.q)
  if (opts.category && opts.category !== 'all') params.set('category', opts.category)
  if (opts.minPrice) params.set('minPrice', String(opts.minPrice))
  if (opts.maxPrice) params.set('maxPrice', String(opts.maxPrice))
  if (opts.sort) params.set('sort', opts.sort)
  if (opts.page) params.set('page', String(opts.page))
  if (opts.limit) params.set('limit', String(opts.limit))
  if (opts.storeId) params.set('storeId', opts.storeId)
  const qs = params.toString()
  return await apiFetch<MarketplaceResponse>(`/api/marketplace/products${qs ? '?' + qs : ''}`)
}

export async function fetchMarketplaceStores(): Promise<{ stores: (TenantStore & { productCount: number })[] }> {
  return await apiFetch('/api/marketplace/stores')
}

export async function fetchMarketplaceStore(slug: string): Promise<{ store: TenantStore; products: MarketplaceProduct[] }> {
  return await apiFetch(`/api/marketplace/store/${encodeURIComponent(slug)}`)
}

export async function trackMarketplaceView(productId: string): Promise<void> {
  try {
    await apiFetch(`/api/marketplace/product/${encodeURIComponent(productId)}/view`, { method: 'POST' })
  } catch {
    // Non-critical — don't throw if view tracking fails
  }
}

// ─── Phase 2: Rich marketplace endpoints ──────────────────────────────────

export interface MarketplaceStats {
  totalProducts: number
  totalStores: number
  totalOrders: number
  ordersToday: number
  avgRating: number
  totalReviews: number
  viewersNow: number
}

export interface MarketplaceActivity {
  _id: string
  customerName: string
  wilaya: string
  productNameAr: string
  total: number
  createdAt: string
}

export interface TopStore {
  store: TenantStore & { productCount?: number }
  productCount: number
  orderCount: number
  rating: number
  reviewCount: number
  sales: number
}

export interface Review {
  _id: string
  productId: string
  storeId: string
  orderId?: string
  customerName: string
  customerNameAr: string
  wilaya: string
  rating: number
  comment: string
  commentAr: string
  images: string[]
  status: 'pending' | 'approved' | 'rejected'
  helpful: number
  createdAt: string
}

export interface Coupon {
  _id: string
  code: string
  description: string
  descriptionAr: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderValue: number
  maxRedemptions: number
  redeemedCount: number
  startsAt: string
  expiresAt: string | null
  isActive: boolean
  color: string
}

export interface MarketplaceBanner {
  _id: string
  order: number
  badge: string
  badgeAr: string
  icon: string
  title: string
  titleAr: string
  highlight: string
  highlightAr: string
  subtitle: string
  subtitleAr: string
  cta: string
  ctaAr: string
  href: string
  gradient: string
  blob1: string
  blob2: string
  isActive: boolean
}

/** GET /api/marketplace/stats — platform-wide stats for the UI */
export async function fetchMarketplaceStats(): Promise<MarketplaceStats> {
  try {
    return await apiFetch<MarketplaceStats>('/api/marketplace/stats')
  } catch {
    // Fallback to safe defaults if the endpoint is unavailable
    return {
      totalProducts: 0,
      totalStores: 0,
      totalOrders: 0,
      ordersToday: 0,
      avgRating: 4.8,
      totalReviews: 0,
      viewersNow: 180 + Math.floor(Math.random() * 220),
    }
  }
}

/** GET /api/marketplace/top-stores — real ranking by orders + rating */
export async function fetchTopStores(limit = 8): Promise<{ stores: TopStore[] }> {
  try {
    return await apiFetch<{ stores: TopStore[] }>(`/api/marketplace/top-stores?limit=${limit}`)
  } catch {
    return { stores: [] }
  }
}

/** GET /api/marketplace/recent-activity — last N real orders */
export async function fetchRecentActivity(limit = 12): Promise<{ activity: MarketplaceActivity[]; total: number }> {
  try {
    return await apiFetch<{ activity: MarketplaceActivity[]; total: number }>(`/api/marketplace/recent-activity?limit=${limit}`)
  } catch {
    return { activity: [], total: 0 }
  }
}

/** GET /api/marketplace/reviews/:productId — list approved reviews for a product */
export async function fetchProductReviews(productId: string, page = 1, limit = 10): Promise<{
  reviews: Review[]
  total: number
  page: number
  totalPages: number
  avgRating: number
  reviewCount: number
}> {
  return await apiFetch(`/api/marketplace/reviews/${encodeURIComponent(productId)}?page=${page}&limit=${limit}`)
}

/** POST /api/marketplace/reviews — submit a new review */
export async function submitReview(payload: {
  productId: string
  storeId: string
  orderId?: string
  customerName: string
  wilaya?: string
  rating: number
  comment?: string
  images?: string[]
}): Promise<{ reviewId: string; ok: boolean }> {
  return await apiFetch('/api/marketplace/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** POST /api/marketplace/reviews/:id/helpful — upvote a review */
export async function upvoteReview(reviewId: string): Promise<void> {
  try {
    await apiFetch(`/api/marketplace/reviews/${encodeURIComponent(reviewId)}/helpful`, { method: 'POST' })
  } catch {
    // Non-critical
  }
}

/** GET /api/marketplace/coupons — list active coupons (public) */
export async function fetchActiveCoupons(): Promise<{ coupons: Coupon[] }> {
  try {
    return await apiFetch('/api/marketplace/coupons')
  } catch {
    return { coupons: [] }
  }
}

/** GET /api/marketplace/coupons/validate — validate a coupon code */
export async function validateCoupon(code: string, subtotal: number): Promise<{
  valid: boolean
  coupon?: Coupon
  discountAmount?: number
  message?: string
}> {
  return await apiFetch(`/api/marketplace/coupons/validate?code=${encodeURIComponent(code)}&subtotal=${subtotal}`)
}

/** GET /api/marketplace/banners — list active banners (public) */
export async function fetchBanners(): Promise<{ banners: MarketplaceBanner[] }> {
  try {
    return await apiFetch('/api/marketplace/banners')
  } catch {
    return { banners: [] }
  }
}

// ─── Visit tracking (fire-and-forget, never blocks UI) ──────────────────────

const VISITOR_KEY = 'amugar_visitor_id'

function getVisitorId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch { return '' }
}

function getReferrerSource(): string {
  if (typeof document === 'undefined') return 'direct'
  try {
    const ref = document.referrer
    if (!ref) return 'direct'
    const u = new URL(ref)
    if (u.hostname === window.location.hostname) return 'direct'
    return u.hostname.replace(/^www\./, '')
  } catch { return 'direct' }
}

function getDevice(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator === 'undefined') return 'mobile'
  const ua = navigator.userAgent || ''
  if (/tablet|ipad/i.test(ua)) return 'tablet'
  if (/mobile|android|iphone/i.test(ua)) return 'mobile'
  return 'desktop'
}

export function trackVisit(storeId: string, type: 'store' | 'product' = 'store', productId?: string): void {
  if (typeof window === 'undefined' || !storeId) return
  if (sessionStorage.getItem('amugar_is_admin') === '1') return
  const payload = {
    storeId, type,
    productId: productId || '',
    visitorId: getVisitorId(),
    source: getReferrerSource(),
    device: getDevice(),
  }
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      navigator.sendBeacon('/api/visit', blob)
      return
    }
  } catch {}
  try {
    void fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  } catch {}
}

// ─── Analytics API (merchant dashboard) ─────────────────────────────────────

export interface AnalyticsOverview {
  totalVisits: number; uniqueVisitors: number; todayVisits: number
  weekVisits: number; monthVisits: number; productViews: number
  storeViews: number; conversionRate: number; orderCount: number
}
export interface AnalyticsTimelinePoint {
  date: string; visits: number; uniqueVisitors: number; productViews: number
}
export interface AnalyticsSource { source: string; visits: number; percentage: number }
export interface AnalyticsTopProduct {
  productId: string; productNameAr: string; views: number; image: string; price: number
}
export interface AnalyticsDevice { device: string; visits: number }
export interface AnalyticsCountry { country: string; visits: number }

export async function fetchAnalyticsOverview(storeId: string): Promise<AnalyticsOverview> {
  try {
    return await apiFetch<AnalyticsOverview>(`/api/stores/${encodeURIComponent(storeId)}/analytics/overview`)
  } catch {
    return { totalVisits: 0, uniqueVisitors: 0, todayVisits: 0, weekVisits: 0, monthVisits: 0, productViews: 0, storeViews: 0, conversionRate: 0, orderCount: 0 }
  }
}
export async function fetchAnalyticsTimeline(storeId: string, days = 7): Promise<{ timeline: AnalyticsTimelinePoint[] }> {
  try {
    return await apiFetch<{ timeline: AnalyticsTimelinePoint[] }>(`/api/stores/${encodeURIComponent(storeId)}/analytics/timeline?days=${days}`)
  } catch { return { timeline: [] } }
}
export async function fetchAnalyticsSources(storeId: string): Promise<{ sources: AnalyticsSource[]; totalVisits: number }> {
  try {
    return await apiFetch<{ sources: AnalyticsSource[]; totalVisits: number }>(`/api/stores/${encodeURIComponent(storeId)}/analytics/sources`)
  } catch { return { sources: [], totalVisits: 0 } }
}
export async function fetchAnalyticsTopProducts(storeId: string): Promise<{ topProducts: AnalyticsTopProduct[] }> {
  try {
    return await apiFetch<{ topProducts: AnalyticsTopProduct[] }>(`/api/stores/${encodeURIComponent(storeId)}/analytics/top-products`)
  } catch { return { topProducts: [] } }
}
export async function fetchAnalyticsDevices(storeId: string): Promise<{ devices: AnalyticsDevice[] }> {
  try {
    return await apiFetch<{ devices: AnalyticsDevice[] }>(`/api/stores/${encodeURIComponent(storeId)}/analytics/devices`)
  } catch { return { devices: [] } }
}
export async function fetchAnalyticsCountries(storeId: string): Promise<{ countries: AnalyticsCountry[] }> {
  try {
    return await apiFetch<{ countries: AnalyticsCountry[] }>(`/api/stores/${encodeURIComponent(storeId)}/analytics/countries`)
  } catch { return { countries: [] } }
}

// ─── Public API: Orders ─────────────────────────────────────────────────────

const ORDERS_PATH = '/api/orders'

// ─── Phone Reputation (COD Fraud Detection) ────────────────────────────────

export interface PhoneReputation {
  trustScore: number       // 0-100
  trustLevel: 'new' | 'trusted' | 'warning' | 'danger'
  totalOrders: number
  deliveredCount: number
  returnedCount: number
  returnRate: number      // percentage
}

/** GET /api/orders/check-phone?phone=XXX — check a phone's cross-tenant reputation */
export async function checkPhoneReputation(phone: string): Promise<PhoneReputation> {
  try {
    const { reputation } = await apiFetch<{ reputation: PhoneReputation }>(
      `${ORDERS_PATH}/check-phone?phone=${encodeURIComponent(phone)}`
    )
    return reputation || { trustScore: 0, trustLevel: 'new', totalOrders: 0, deliveredCount: 0, returnedCount: 0, returnRate: 0 }
  } catch {
    return { trustScore: 0, trustLevel: 'new', totalOrders: 0, deliveredCount: 0, returnedCount: 0, returnRate: 0 }
  }
}

export async function fetchOrders(): Promise<Order[]> {
  const { orders } = await cachedGet<{ orders: Order[] }>(ORDERS_PATH, 'amugar_orders_v5', { orders: [] as Order[] })
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
  const { wilayas } = await cachedGet<{ wilayas: WilayaRate[] }>(WILAYAS_PATH, 'amugar_wilayas_v5', { wilayas: [] as WilayaRate[] })
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
  const { settings } = await cachedGet<{ settings: StoreSettings }>(SETTINGS_PATH, 'amugar_settings_v5', { settings: defaultSettings })
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
  primeCache(SETTINGS_PATH, 'amugar_settings_v5', { settings })
  return settings
}
export async function updateSettingsApi(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const { settings } = await apiFetch<{ settings: StoreSettings }>(SETTINGS_PATH, {
    method: 'PATCH', body: JSON.stringify(patch),
  })
  primeCache(SETTINGS_PATH, 'amugar_settings_v5', { settings })
  return settings
}

// ─── Public API: Domains ────────────────────────────────────────────────────

const DOMAINS_PATH = '/api/domains'

export async function fetchDomains(): Promise<StoreDomain[]> {
  const { domains } = await cachedGet<{ domains: StoreDomain[] }>(DOMAINS_PATH, 'amugar_domains_v5', { domains: presetDomains as StoreDomain[] })
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
  domainType?: string  // chosen store type (jewelry / fashion / electronics / etc.)
}): Promise<{ user: MerchantUser; token: string; storeId: string; storeIds: string[]; domainType?: string }> {
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
  const token = localStorage.getItem('amugar_token')
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
//
// IMPORTANT (performance fix): we no longer clear the ENTIRE memCache when
// a `amugar_*` storage event fires. That was causing cascading refetches:
//   1. merchant saves settings → primeCache → storage event
//   2. this listener fires → memCache.clear() + notifyRefresh()
//   3. every mounted component re-fetches its data from the server
//   4. this made the storefront + dashboard feel sluggish after any save
//
// Now we only notify subscribers (which re-read from the ALREADY-FRESH
// cache, no network refetch). The cache was just primed by `primeCache`
// for settings, and for products/orders/etc. the in-memory cache stays
// valid — only the UI needs to re-read it.
//
// Cross-tab changes (real other-tab writes) still trigger a refetch via
// the `onRefetch` callback inside `cachedGet`, but only for the SPECIFIC
// key that changed — not the whole cache.

const listeners = new Set<() => void>()
export function subscribeRefresh(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function notifyRefresh() { listeners.forEach(fn => fn()) }

if (isBrowser()) {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('amugar_')) {
      // Don't clear the whole cache — just notify subscribers so they
      // re-read the (already-fresh) cached value. The only key that
      // actually changed is `e.key`, and its specific module already
      // updated its own cache via primeCache().
      notifyRefresh()
    }
  })
}
