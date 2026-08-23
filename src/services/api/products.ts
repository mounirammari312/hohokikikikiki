/**
 * Products service — PER-TENANT cache.
 *
 * The cache is keyed by the active store's slug/storeId so that
 * switching stores NEVER shows the previous store's products.
 * No spinner, no loading screen — the page reads from localStorage
 * instantly (if available) and silently refreshes from the API.
 */

import type { Product } from './types'
import { getActiveDomainSync } from './domains'
import {
  fetchProducts, createProductApi, updateProductApi, deleteProductApi,
  duplicateProductApi, toggleProductFlagApi,
} from './client'

// ─── Per-tenant cache ────────────────────────────────────────────────────────
// Map<tenantKey, Product[]> — each store has its own cache entry.
// tenantKey = storeId or slug from URL.
const cacheMap = new Map<string, Product[]>()
const loadedSet = new Set<string>()

function getTenantKey(): string {
  if (typeof window === 'undefined') return 'default'
  const urlParams = new URLSearchParams(window.location.search)
  // الاعتماد حصراً على معرّف المتجر الموجود في الرابط لمنع تسريب كاش المتاجر السابقة
  return urlParams.get('store') || urlParams.get('storeId') || 'default'
}




/** Get the cached products for the CURRENT tenant. */
export function getProducts(): Product[] {
  const key = getTenantKey()
  return cacheMap.get(key) || []
}

export function getProductById(id: string): Product | undefined {
  return getProducts().find(p => p._id === id)
}

export function searchProducts(q: string): Product[] {
  if (!q) return getProducts()
  const s = q.toLowerCase()
  return getProducts().filter(p =>
    p.name.toLowerCase().includes(s) ||
    p.nameAr.includes(q) ||
    p.category.includes(s as any)
  )
}

export function getProductsByCategory(cat: string): Product[] {
  return getProducts().filter(p => p.category === cat)
}

/** Background-load products from the API for the current tenant. */
export async function syncProducts(): Promise<Product[]> {
  const key = getTenantKey()
  try {
    const list = await fetchProducts()
    cacheMap.set(key, list)
    loadedSet.add(key)
    return list
  } catch {
    loadedSet.add(key)
    return cacheMap.get(key) || []
  }
}

/** Backwards-compat: kick off the sync. */
export function ensureProducts(): Product[] {
  const key = getTenantKey()
  if (!loadedSet.has(key)) void syncProducts()
  return cacheMap.get(key) || []
}

/** Clear ALL tenant caches. */
export function clearProductsCache(): void {
  cacheMap.clear()
  loadedSet.clear()
}

// ─── Mutations (update cache + return fresh list) ──────────────────────────

export async function addProduct(data: Omit<Product,'_id'|'createdAt'> & Partial<Pick<Product,'_id'|'createdAt'>>): Promise<Product> {
  const key = getTenantKey()
  const list = await createProductApi(data)
  cacheMap.set(key, list)
  return list.find(p => p.nameAr === data.nameAr && p.price === data.price) || list[0]
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product[]> {
  const key = getTenantKey()
  const list = await updateProductApi(id, patch)
  cacheMap.set(key, list)
  return list
}

export async function deleteProduct(id: string): Promise<Product[]> {
  const key = getTenantKey()
  const list = await deleteProductApi(id)
  cacheMap.set(key, list)
  return list
}

export async function duplicateProduct(id: string): Promise<Product[]> {
  const key = getTenantKey()
  const list = await duplicateProductApi(id)
  cacheMap.set(key, list)
  return list
}

export async function toggleProductFlag(id: string, flag: 'isFeatured' | 'isNew'): Promise<Product[]> {
  const key = getTenantKey()
  const list = await toggleProductFlagApi(id, flag)
  cacheMap.set(key, list)
  return list
}
