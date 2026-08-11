/**
 * Wilayas service.
 *
 * Sync API reads from an in-memory cache kept fresh by syncWilayas().
 * Mutations go through the async `*Api` helpers in ./client.
 */

import { seedWilayas } from './seed'
import type { WilayaRate } from './types'
import { fetchWilayas, updateWilayaRateApi, addWilayaApi } from './client'

let cache: WilayaRate[] = [...seedWilayas] as WilayaRate[]
let loaded = false

export async function syncWilayas(): Promise<WilayaRate[]> {
  try {
    const list = await fetchWilayas()
    cache = list.length ? list : cache
    loaded = true
    return cache
  } catch {
    loaded = true
    return cache
  }
}

export function ensureWilayas(): WilayaRate[] {
  // Kick off the sync if not started yet (best-effort)
  if (!loaded) void syncWilayas()
  return cache
}

export function getWilayas(): WilayaRate[] {
  return ensureWilayas()
}

export function getWilayaByCode(code: string): WilayaRate | undefined {
  return getWilayas().find(w => w.code === code)
}

export function getWilayaByNameAr(nameAr: string): WilayaRate | undefined {
  return getWilayas().find(w => w.nameAr === nameAr)
}

export async function updateWilayaRate(code: string, data: Partial<WilayaRate>): Promise<WilayaRate[]> {
  const list = await updateWilayaRateApi(code, data)
  cache = list
  return list
}

export async function addWilaya(w: WilayaRate): Promise<WilayaRate[]> {
  const list = await addWilayaApi(w)
  cache = list
  return list
}
