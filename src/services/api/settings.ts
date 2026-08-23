/**
 * Settings service — PER-TENANT cache.
 *
 * The cache is keyed by the active store's slug/storeId so that
 * switching stores NEVER shows the previous store's settings.
 * No spinner, no loading screen — the page reads from localStorage
 * instantly (if available) and silently refreshes from the API.
 */

import { defaultSettings } from './seed'
import type { StoreSettings } from './types'
import { fetchSettings, saveSettingsApi, updateSettingsApi } from './client'

// ─── Per-tenant cache ────────────────────────────────────────────────────────
const cacheMap = new Map<string, StoreSettings>()
const loadedSet = new Set<string>()

function getTenantKey(): string {
  if (typeof window === 'undefined') return 'default'
  const urlParams = new URLSearchParams(window.location.search)
  // الاعتماد حصراً على معرّف المتجر الموجود في الرابط
  return urlParams.get('store') || urlParams.get('storeId') || 'default'
}


/** Get cached settings for the CURRENT tenant. Falls back to
 *  localStorage (per-tenant key) if the in-memory cache is empty. */
function getCachedSettings(): StoreSettings {
  const key = getTenantKey()
  // 1) In-memory cache
  if (cacheMap.has(key)) return cacheMap.get(key)!
  // 2) localStorage cache (per-tenant)
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`amugar_settings_v5__${key}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.settings) {
          cacheMap.set(key, parsed.settings)
          return parsed.settings
        }
      }
    } catch {}
  }
  // 3) Fallback to defaultSettings (neutral, not jewelry)
  return { ...defaultSettings }
}

export function getSettings(): StoreSettings {
  const key = getTenantKey()
  if (!loadedSet.has(key)) void syncSettings()
  return getCachedSettings()
}

export function isSettingsLoaded(): boolean {
  return loadedSet.has(getTenantKey())
}

export function clearSettingsCache(): void {
  cacheMap.clear()
  loadedSet.clear()
}

// ─── Pub/Sub ───────────────────────────────────────────────────────────────
const subscribers = new Set<() => void>()

export function subscribeSettings(fn: () => void): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

function notifySettingsChanged() {
  subscribers.forEach(fn => { try { fn() } catch {} })
}

export async function syncSettings(): Promise<StoreSettings> {
  const key = getTenantKey()
  try {
    const s = await fetchSettings()
    if (s) {
      cacheMap.set(key, s)
      loadedSet.add(key)
      notifySettingsChanged()
      return s
    }
    loadedSet.add(key)
    return getCachedSettings()
  } catch {
    loadedSet.add(key)
    return getCachedSettings()
  }
}

export async function saveSettings(s: StoreSettings): Promise<StoreSettings> {
  const key = getTenantKey()
  const next = await saveSettingsApi(s)
  cacheMap.set(key, next)
  notifySettingsChanged()
  return next
}

export async function updateSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const key = getTenantKey()
  const next = await updateSettingsApi(patch)
  cacheMap.set(key, next)
  notifySettingsChanged()
  return next
}

// Sync-compat shims
export function saveSettingsSync(s: StoreSettings) { void saveSettings(s) }
export function updateSettingsSync(patch: Partial<StoreSettings>) { void updateSettings(patch) }
