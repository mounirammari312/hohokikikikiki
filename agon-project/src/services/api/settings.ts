import { STORAGE_KEYS, load, save } from './db'
import type { StoreSettings } from './types'
import { defaultSettings } from './seed'

function migrate(s: any): StoreSettings {
  const merged = { ...defaultSettings, ...(s||{}) } as StoreSettings
  // ensure activeDomainId exists
  if(!merged.activeDomainId) merged.activeDomainId = defaultSettings.activeDomainId
  return merged
}

export function getSettings(): StoreSettings {
  const raw = load<any>(STORAGE_KEYS.SETTINGS, defaultSettings)
  const merged = migrate(raw)
  if(JSON.stringify(raw) !== JSON.stringify(merged)) save(STORAGE_KEYS.SETTINGS, merged)
  return merged
}
export function saveSettings(s: StoreSettings){ save(STORAGE_KEYS.SETTINGS, s); return s }
export function updateSettings(patch: Partial<StoreSettings>): StoreSettings {
  const cur = getSettings()
  const next = { ...cur, ...patch }
  save(STORAGE_KEYS.SETTINGS, next)
  return next
}
