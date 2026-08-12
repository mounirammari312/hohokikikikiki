/**
 * Storage helpers — legacy compatibility shim.
 *
 * The app now uses MongoDB (via Vercel Serverless API routes) instead of
 * LocalStorage. These helpers are kept only for backwards compatibility
 * with any code that still imports them. They read/write to localStorage
 * but the canonical source of truth is now the API.
 *
 * New code should import the async helpers from ./client.ts instead.
 */

export type ID = string

export const STORAGE_KEYS = {
  PRODUCTS: 'lumiere_products_v3',
  ORDERS: 'lumiere_orders_v3',
  WILAYAS: 'lumiere_wilayas_v3',
  SETTINGS: 'lumiere_settings_v3',
  DOMAINS: 'lumiere_domains_v3',
} as const

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch { return fallback }
}

export function save<T>(key: string, data: T) {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(data))
  } catch {}
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
