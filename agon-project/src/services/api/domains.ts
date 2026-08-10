import { STORAGE_KEYS, load, save, generateId } from './db'
import type { StoreDomain } from './types'
import { presetDomains } from './seed'
import { getSettings, saveSettings } from './settings'

function migrateDomain(d: any, preset?: StoreDomain): StoreDomain {
  const p = preset || presetDomains.find(x=> x.id===d.id)
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
    categories: Array.isArray(d.categories) && d.categories.length ? d.categories : (p?.categories || [{key:'general', label:'General', labelAr:'عام'}]),
    attributeSchema: Array.isArray(d.attributeSchema) && d.attributeSchema.length ? d.attributeSchema : (p?.attributeSchema || []),
    variantConfig: d.variantConfig && d.variantConfig.sizeOptions ? d.variantConfig : (p?.variantConfig || { hasColor:false, hasSize:false, sizeOptions:[], colorPresets:[] }),
    isPreset: !!d.isPreset
  }
}

export function ensureDomains(): StoreDomain[] {
  const existing = load<StoreDomain[] | any[] | null>(STORAGE_KEYS.DOMAINS, null)
  if (existing && existing.length) {
    // migrate each
    let changed = false
    const migrated = existing.map((d:any)=>{
      const preset = presetDomains.find(p=> p.id===d.id)
      const m = migrateDomain(d, preset)
      if(JSON.stringify(d) !== JSON.stringify(m)) changed=true
      return m
    })
    // ensure presets present
    const ids = new Set(migrated.map(d=>d.id))
    presetDomains.forEach(p=>{
      if(!ids.has(p.id)){ migrated.push({...p}); changed=true }
    })
    // also update preset domains to latest definition (force update presets to keep schema fresh)
    for(let i=0;i<migrated.length;i++){
      const preset = presetDomains.find(p=> p.id===migrated[i].id && migrated[i].isPreset)
      if(preset){
        // if stored preset lacks new fields, overwrite with fresh preset but keep id
        const fresh = migrateDomain(preset, preset)
        // keep active state but update schema fields
        migrated[i] = {...fresh}
        changed=true
      }
    }
    if(changed) save(STORAGE_KEYS.DOMAINS, migrated)
    return migrated
  }
  save(STORAGE_KEYS.DOMAINS, presetDomains)
  return presetDomains
}

export function getDomains(): StoreDomain[] { return ensureDomains() }
export function getDomainById(id:string): StoreDomain | undefined { return getDomains().find(d=>d.id===id) }

export function getActiveDomain(): StoreDomain {
  const settings = getSettings()
  const domains = getDomains()
  return domains.find(d=>d.id===settings.activeDomainId) || domains[0]
}

export function setActiveDomain(id:string): StoreDomain | null {
  const domain = getDomainById(id)
  if(!domain) return null
  const s = getSettings()
  const next = {
    ...s,
    activeDomainId: domain.id,
    storeName: domain.name,
    storeNameAr: domain.nameAr,
    heroBadge: domain.heroBadge,
    heroTitleAr: domain.heroTitleAr,
    heroSubtitleAr: domain.heroSubtitleAr,
    footerDescriptionAr: domain.footerDescriptionAr,
  }
  saveSettings(next as any)
  return domain
}

export function addDomain(d: StoreDomain): StoreDomain[] {
  const list = getDomains()
  list.push(d)
  save(STORAGE_KEYS.DOMAINS, list)
  return list
}

export function updateDomain(id:string, patch: Partial<StoreDomain>): StoreDomain[] {
  const list = getDomains()
  const idx = list.findIndex(d=>d.id===id)
  if(idx>=0){
    list[idx] = { ...list[idx], ...patch, id } as StoreDomain
    save(STORAGE_KEYS.DOMAINS, list)
    const active = getSettings().activeDomainId
    if(active===id){
      const s = getSettings()
      saveSettings({
        ...s,
        storeName: list[idx].name,
        storeNameAr: list[idx].nameAr,
        heroBadge: list[idx].heroBadge,
        heroTitleAr: list[idx].heroTitleAr,
        heroSubtitleAr: list[idx].heroSubtitleAr,
        footerDescriptionAr: list[idx].footerDescriptionAr,
      } as any)
    }
  }
  return list
}

export function deleteDomain(id:string): StoreDomain[] {
  const presetIds = new Set(presetDomains.map(p=>p.id))
  if(presetIds.has(id)) throw new Error('CANNOT_DELETE_PRESET')
  const list = getDomains().filter(d=>d.id!==id)
  save(STORAGE_KEYS.DOMAINS, list)
  const active = getSettings().activeDomainId
  if(active===id){
    setActiveDomain(list[0].id)
  }
  return list
}

export function duplicateDomain(id:string): StoreDomain | null {
  const orig = getDomainById(id)
  if(!orig) return null
  const copy: StoreDomain = {
    ...orig,
    id: 'domain_' + generateId(),
    name: orig.name + ' Copy',
    nameAr: orig.nameAr + ' - نسخة',
    categories: orig.categories.map(c=> ({...c})),
    attributeSchema: orig.attributeSchema.map(a=> ({...a, options: a.options? [...a.options]: undefined})),
    variantConfig: { ...orig.variantConfig, sizeOptions:[...orig.variantConfig.sizeOptions], colorPresets: orig.variantConfig.colorPresets.map(c=>({...c})) },
    isPreset: false,
  }
  addDomain(copy)
  return copy
}

export function createCustomDomain(data: Omit<StoreDomain, 'id'>): StoreDomain {
  const d: StoreDomain = {
    id: 'domain_' + generateId(),
    name: data.name,
    nameAr: data.nameAr,
    descriptionAr: data.descriptionAr,
    heroBadge: data.heroBadge,
    heroTitleAr: data.heroTitleAr,
    heroSubtitleAr: data.heroSubtitleAr,
    heroImage: data.heroImage,
    footerDescriptionAr: data.footerDescriptionAr,
    categories: data.categories,
    attributeSchema: data.attributeSchema || [],
    variantConfig: data.variantConfig || { hasColor:false, hasSize:false, sizeOptions:[], colorPresets:[] },
    isPreset: false,
  }
  addDomain(d)
  return d
}
