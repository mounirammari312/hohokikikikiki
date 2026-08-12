/**
 * Settings service.
 *
 * Sync API reads from an in-memory cache kept fresh by syncSettings().
 * Mutations go through the async `*Api` helpers in ./client.
 */

import { defaultSettings } from './seed'
import type { StoreSettings } from './types'
import { fetchSettings, saveSettingsApi, updateSettingsApi } from './client'

let cache: StoreSettings = { ...defaultSettings }
let loaded = false

export async function syncSettings(): Promise<StoreSettings> {
  try {
    const s = await fetchSettings()
    if (s) cache = s
    loaded = true
    return cache
  } catch {
    loaded = true
    return cache
  }
}

export function getSettings(): StoreSettings {
  if (!loaded) void syncSettings()
  return cache
}

export async function saveSettings(s: StoreSettings): Promise<StoreSettings> {
  const next = await saveSettingsApi(s)
  cache = next
  return next
}

export async function updateSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const next = await updateSettingsApi(patch)
  cache = next
  return next
}

// Sync-compat shims for UI code that doesn't await
export function saveSettingsSync(s: StoreSettings) { void saveSettings(s) }
export function updateSettingsSync(patch: Partial<StoreSettings>) { void updateSettings(patch) }
