/**
 * Settings service.
 *
 * Sync API reads from an in-memory cache kept fresh by syncSettings().
 * Mutations go through the async `*Api` helpers in ./client.
 *
 * Pub/sub: `subscribeSettings(cb)` lets React components re-render when
 * the cache is updated (either by the same tab via saveSettings, or by
 * another tab via the `storage` event). This is what makes the
 * storefront reflect dashboard edits without a manual page refresh.
 */

import { defaultSettings } from './seed'
import type { StoreSettings } from './types'
import { fetchSettings, saveSettingsApi, updateSettingsApi } from './client'

let cache: StoreSettings = { ...defaultSettings }
let loaded = false

// ─── Pub/Sub ───────────────────────────────────────────────────────────────
const subscribers = new Set<() => void>()

/** Subscribe to settings changes. Returns an unsubscribe function. */
export function subscribeSettings(fn: () => void): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

function notifySettingsChanged() {
  subscribers.forEach(fn => {
    try { fn() } catch {}
  })
}

// Listen for cross-tab `storage` events (fired when another tab writes
// to localStorage). When the settings cache key changes, re-sync from
// the server so this tab picks up the new value.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'lumiere_settings_v3') {
      void syncSettings().then(() => notifySettingsChanged())
    }
  })
  // Also listen for the synthetic same-tab storage event dispatched by
  // client.ts `primeCache()` after a successful saveSettings. Without
  // this, the merchant's storefront wouldn't refresh until they reload.
  // (The native `storage` event does NOT fire in the same tab that
  // made the change — only in other tabs.)
}

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
  // Notify same-tab subscribers (e.g. the storefront header / footer /
  // home page) that the settings have changed so they can re-render
  // with the new values. Cross-tab subscribers are notified via the
  // `storage` event listener above.
  notifySettingsChanged()
  return next
}

export async function updateSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const next = await updateSettingsApi(patch)
  cache = next
  notifySettingsChanged()
  return next
}

// Sync-compat shims for UI code that doesn't await
export function saveSettingsSync(s: StoreSettings) { void saveSettings(s) }
export function updateSettingsSync(patch: Partial<StoreSettings>) { void updateSettings(patch) }
