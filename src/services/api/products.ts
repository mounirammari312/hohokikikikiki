/**
 * Products service.
 *
 * DEPRECATED SYNC API:
 *   getProducts(), getProductById(), addProduct(), updateProduct(), …
 *   These still exist for backwards-compatibility with the existing UI
 *   (which calls them synchronously in render). They read from an
 *   in-memory cache that is kept fresh by `syncProducts()` (called by
 *   the App on mount and after every mutation).
 *
 * NEW ASYNC API:
 *   Use the `*Api` functions exported from ./client for direct fetch
 *   access. They keep the cache consistent automatically.
 *
 * Migration path: once the UI components are converted to async/await
 * (e.g. via React Query / SWR), the sync shims below can be removed.
 */

import type { Product } from './types'
import { getActiveDomainSync } from './domains'
import {
  fetchProducts, createProductApi, updateProductApi, deleteProductApi,
  duplicateProductApi, toggleProductFlagApi,
} from './client'

// ─── In-memory cache (kept in sync with the API by syncProducts()) ──────────
// IMPORTANT: cache starts EMPTY — we do NOT seed it with seedProducts.
// Previously, the cache was initialized with `[...seedProducts]` (the 18
// jewelry products). This caused merchants to see jewelry products in
// their store before the API returned their (empty) product list.
// Now the cache starts as `[]` — products come ONLY from the API.

let cache: Product[] = []
let loaded = false
const waiting: Array<() => void> = []

/** Clear the products cache — called when the active store changes
 *  to prevent products from store A leaking into store B. */
export function clearProductsCache(): void {
  cache = []
  loaded = false
}

/** Background-load products from the API on app startup. */
export async function syncProducts(): Promise<Product[]> {
  try {
    const list = await fetchProducts()
    cache = list
    loaded = true
    waiting.forEach(fn => fn())
    waiting.length = 0
    return list
  } catch (err) {
    loaded = true // Mark as loaded to unblock waiters (use seed fallback)
    waiting.forEach(fn => fn())
    waiting.length = 0
    return cache
  }
}

/** Backwards-compat: kick off the sync (no-op if already started). */
export function ensureProducts(): Product[] {
  if (!loaded) void syncProducts()
  return cache
}

/** Synchronous accessor — returns cached products (or seed data on first run). */
export function getProducts(): Product[] { return cache }
export function getProductById(id: string): Product | undefined {
  return cache.find(p => p._id === id)
}

export function searchProducts(q: string): Product[] {
  if (!q) return cache
  const s = q.toLowerCase()
  return cache.filter(p =>
    p.name.toLowerCase().includes(s) ||
    p.nameAr.includes(q) ||
    p.category.includes(s as any)
  )
}

export function getProductsByCategory(cat: string): Product[] {
  if (cat === 'all') return cache
  return cache.filter(p => p.category === cat)
}

// ─── Mutations (async — return the updated list) ────────────────────────────

export async function addProduct(data: Omit<Product,'_id'|'createdAt'> & Partial<Pick<Product,'_id'|'createdAt'>>): Promise<Product> {
  const list = await createProductApi(data)
  cache = list
  return list.find(p => p.nameAr === data.nameAr && p.price === data.price) || list[0]
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product[]> {
  const list = await updateProductApi(id, patch)
  cache = list
  return list
}

export async function deleteProduct(id: string): Promise<Product[]> {
  const list = await deleteProductApi(id)
  cache = list
  return list
}

export async function duplicateProduct(id: string): Promise<Product | null> {
  const list = await duplicateProductApi(id)
  cache = list
  // The duplicated product is the most recent one matching the original's name + ' نسخة'
  return list.find(p => p.nameAr.includes('نسخة')) || null
}

export async function toggleProductFlag(id: string, flag: 'isFeatured' | 'isNew'): Promise<Product[]> {
  const list = await toggleProductFlagApi(id, flag)
  cache = list
  return list
}

export function updateProductStock(id: string, delta: number) {
  // Synchronous stock mutation is no longer supported — callers should
  // use updateProduct(id, { stock: newStock }) instead.
  const p = cache.find(x => x._id === id)
  if (p) {
    p.stock = Math.max(0, p.stock + delta)
  }
}

// ─── Sync-compat shims (call the async version, ignore the promise) ─────────
// These exist so the existing UI code that doesn't `await` the result
// still works — the UI reads from `cache` on the next render.

export function addProductSync(data: Parameters<typeof addProduct>[0]) {
  void addProduct(data)
}
export function updateProductSync(id: string, patch: Partial<Product>) {
  void updateProduct(id, patch)
}
export function deleteProductSync(id: string) {
  void deleteProduct(id)
}
