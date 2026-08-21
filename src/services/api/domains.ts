/**
 * Domains service.
 *
 * Sync API reads from an in-memory cache kept fresh by syncDomains().
 * Mutations go through the async `*Api` helpers in ./client.
 *
 * Note: `getActiveDomain()` is also exposed as `getActiveDomainSync()`
 * so other sync code (like products.ts) can import it without a cycle.
 */

import { presetDomains } from './seed'
import type { StoreDomain } from './types'
import { getSettings } from './settings'
import {
  fetchDomains, createCustomDomainApi, updateDomainApi, deleteDomainApi, activateDomainApi,
} from './client'

let cache: StoreDomain[] = [...presetDomains] as StoreDomain[]
let loaded = false

function migrateDomain(d: any, preset?: StoreDomain): StoreDomain {
  const p = preset || presetDomains.find(x => x.id === d.id)
  return {
    id: d.id,
    name: d.name || p?.name || 'Custom',
    nameAr: d.nameAr || p?.nameAr || d.name || 'مخصص',
    descriptionAr: d.descriptionAr || p?.descriptionAr || '',
    heroBadge: d.heroBadge || p?.heroBadge || 'COLLECTION 2026',
    heroTitleAr: d.heroTitleAr || p?.heroTitleAr || '',
    heroSubtitleAr: d.heroSubtitleAr || p?.heroSubtitleAr || '',
    heroImage: d.heroImage || p?.heroImage || presetDomains[0].heroImage,
    footerDescriptionAr: d.footerDescriptionAr || p?.footerDescriptionAr || '',
    categories: Array.isArray(d.categories) && d.categories.length ? d.categories : (p?.categories || [{ key: 'general', label: 'General', labelAr: 'عام' }]),
    attributeSchema: Array.isArray(d.attributeSchema) && d.attributeSchema.length ? d.attributeSchema : (p?.attributeSchema || []),
    variantConfig: d.variantConfig && d.variantConfig.sizeOptions ? d.variantConfig : (p?.variantConfig || { hasColor: false, hasSize: false, sizeOptions: [], colorPresets: [] }),
    isPreset: !!d.isPreset
  }
}

export async function syncDomains(): Promise<StoreDomain[]> {
  try {
    const list = await fetchDomains()
    if (list && list.length) {
      // Always refresh presets from local code so schema additions propagate
      const presetIds = new Set(presetDomains.map(p => p.id))
      const customs = list.filter(d => !presetIds.has(d.id))
      cache = [
        ...presetDomains.map(p => {
          const fromServer = list.find(d => d.id === p.id)
          return fromServer ? migrateDomain(fromServer, p) : p
        }),
        ...customs.map(d => migrateDomain(d))
      ]
    } else {
      cache = [...presetDomains] as StoreDomain[]
    }
    loaded = true
    return cache
  } catch {
    loaded = true
    return cache
  }
}

export function ensureDomains(): StoreDomain[] {
  if (!loaded) void syncDomains()
  return cache
}

export function getDomains(): StoreDomain[] { return ensureDomains() }
export function getDomainById(id: string): StoreDomain | undefined {
  return getDomains().find(d => d.id === id)
}

export function getActiveDomain(): StoreDomain {
  const settings = getSettings()
  const domains = getDomains()
  return domains.find(d => d.id === settings.activeDomainId) || domains[0] || presetDomains[0]
}

export const getActiveDomainSync = getActiveDomain

export async function setActiveDomain(id: string): Promise<StoreDomain | null> {
  const domain = getDomainById(id)
  if (!domain) return null
  try {
    const { settings } = await activateDomainApi(id)
    // Settings cache is invalidated on the server side, so refetch
    const { syncSettings } = await import('./settings')
    await syncSettings()
    await syncDomains()
    return getDomainById(id) || null
  } catch (err: any) {
    // Re-throw so the caller (handleActivateDomain in Admin.tsx) can
    // show a toast with the actual error instead of silently failing.
    console.error('[setActiveDomain] failed:', err)
    throw err
  }
}

export async function addDomain(d: StoreDomain): Promise<StoreDomain[]> {
  // Direct create — normally use createCustomDomain instead
  void d
  return cache
}

export async function createCustomDomain(data: Omit<StoreDomain, 'id'>): Promise<StoreDomain> {
  await createCustomDomainApi(data)
  await syncDomains()
  return getDomains().find(d => d.name === data.name && d.nameAr === data.nameAr) || getDomains()[0]
}

export async function updateDomain(id: string, patch: Partial<StoreDomain>): Promise<StoreDomain[]> {
  await updateDomainApi(id, patch)
  await syncDomains()
  await import('./settings').then(m => m.syncSettings())
  return cache
}

export async function deleteDomain(id: string): Promise<StoreDomain[]> {
  const presetIds = new Set(presetDomains.map(p => p.id))
  if (presetIds.has(id)) throw new Error('CANNOT_DELETE_PRESET')
  await deleteDomainApi(id)
  await syncDomains()
  return cache
}

export async function duplicateDomain(id: string): Promise<StoreDomain | null> {
  const orig = getDomainById(id)
  if (!orig) return null
  const copy: Omit<StoreDomain, 'id'> = {
    ...orig,
    name: orig.name + ' Copy',
    nameAr: orig.nameAr + ' - نسخة',
    categories: orig.categories.map(c => ({ ...c })),
    attributeSchema: orig.attributeSchema.map(a => ({ ...a, options: a.options ? [...a.options] : undefined })),
    variantConfig: { ...orig.variantConfig, sizeOptions: [...orig.variantConfig.sizeOptions], colorPresets: orig.variantConfig.colorPresets.map(c => ({ ...c })) },
    isPreset: false,
  }
  return await createCustomDomain(copy)
}
