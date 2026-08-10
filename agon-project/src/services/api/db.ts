export type ID = string

export const STORAGE_KEYS = {
  PRODUCTS: 'lumiere_products_v2',
  ORDERS: 'lumiere_orders_v2',
  WILAYAS: 'lumiere_wilayas_v2',
  SETTINGS: 'lumiere_settings_v2',
  DOMAINS: 'lumiere_domains_v3',
} as const

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch { return fallback }
}
export function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data))
}
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7)
}
