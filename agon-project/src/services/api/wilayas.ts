import { STORAGE_KEYS, load, save } from './db'
import type { WilayaRate } from './types'
import { seedWilayas } from './seed'

export function ensureWilayas(): WilayaRate[]{
  const existing = load<WilayaRate[] | null>(STORAGE_KEYS.WILAYAS, null)
  if(existing && existing.length) return existing
  save(STORAGE_KEYS.WILAYAS, seedWilayas)
  return seedWilayas
}
export function getWilayas(): WilayaRate[]{ return ensureWilayas() }
export function getWilayaByCode(code:string){ return getWilayas().find(w=>w.code===code) }
export function getWilayaByNameAr(nameAr:string){ return getWilayas().find(w=>w.nameAr===nameAr)}
export function updateWilayaRate(code:string, data: Partial<WilayaRate>){
  const list = getWilayas()
  const idx = list.findIndex(w=>w.code===code)
  if(idx>=0){ list[idx] = {...list[idx], ...data} as WilayaRate; save(STORAGE_KEYS.WILAYAS, list)}
  return list
}
export function addWilaya(w: WilayaRate){
  const list = getWilayas(); list.push(w); save(STORAGE_KEYS.WILAYAS, list); return list
}
