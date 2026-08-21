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

// Listen for cross-tab `storage` events (fired when ANOTHER tab writes
// to localStorage). When the settings key changes, parse the new value
// directly from the event's newValue — NO server refetch needed because
// the other tab already fetched it and we trust its result.
//
// IMPORTANT (performance fix): the previous implementation called
// syncSettings() on every storage event, which triggered a server
// round-trip. On a slow connection this made the storefront laggy
// whenever the merchant saved anything. We now parse newValue directly.
//
// For SAME-tab saves, see `saveSettings()` below — it updates `cache`
// synchronously and calls notifySettingsChanged() directly (no event).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'amugar_settings_v3' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue)
        if (parsed && parsed.settings) {
          cache = parsed.settings
          loaded = true
          notifySettingsChanged()
        }
      } catch {
        // Malformed value — ignore, the next getSettings() will refetch.
      }
    }
  })
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
