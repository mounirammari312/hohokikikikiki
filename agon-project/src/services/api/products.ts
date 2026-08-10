import { STORAGE_KEYS, load, save, generateId } from './db'
import type { Product } from './types'
import { seedProducts } from './seed'
import { getActiveDomain } from './domains'

function migrateProduct(p:any): Product {
  return {
    _id: p._id,
    sku: p.sku,
    name: p.name, nameAr: p.nameAr,
    description: p.description || '', descriptionAr: p.descriptionAr || '',
    price: Number(p.price) || 0, compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : undefined,
    images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
    category: p.category,
    material: p.material || '', materialAr: p.materialAr || '',
    rating: Number(p.rating) || 4.8, reviewsCount: Number(p.reviewsCount) || 0,
    stock: Number(p.stock) || 0,
    isFeatured: !!p.isFeatured, isNew: !!p.isNew,
    attributes: p.attributes || {},
    variants: Array.isArray(p.variants) ? p.variants : [],
    tierPricing: Array.isArray(p.tierPricing) ? p.tierPricing : [],
    createdAt: p.createdAt || new Date().toISOString(),
    domainId: p.domainId || undefined,
  }
}

export function ensureProducts(): Product[] {
  const existing = load<any[] | null>(STORAGE_KEYS.PRODUCTS, null)
  if (!existing || !existing.length) {
    save(STORAGE_KEYS.PRODUCTS, seedProducts)
    return seedProducts
  }
  let changed=false
  const migrated = existing.map((p:any)=>{
    const m = migrateProduct(p)
    if(JSON.stringify(p)!==JSON.stringify(m)) changed=true
    return m
  })
  const existingIds = new Set(migrated.map(p=> p._id))
  const missing = seedProducts.filter(p=> !existingIds.has(p._id))
  let finalList = migrated
  if(missing.length){
    finalList = [...migrated, ...missing]
    changed=true
  }
  if(changed) save(STORAGE_KEYS.PRODUCTS, finalList)
  return finalList
}
export function getProducts(): Product[] { return ensureProducts() }
export function getProductById(id: string): Product | undefined { return getProducts().find(p=>p._id===id) }
export function searchProducts(q: string): Product[] {
  if(!q) return getProducts()
  const s = q.toLowerCase()
  return getProducts().filter(p=> p.name.toLowerCase().includes(s) || p.nameAr.includes(q) || p.category.includes(s as any))
}
export function getProductsByCategory(cat:string): Product[] {
  if(cat==='all') return getProducts()
  return getProducts().filter(p=> p.category===cat)
}
export function updateProductStock(id:string, delta:number){
  const prods = getProducts()
  const idx = prods.findIndex(p=>p._id===id)
  if(idx>=0){ prods[idx].stock = Math.max(0, prods[idx].stock + delta); save(STORAGE_KEYS.PRODUCTS, prods)}
}

export function addProduct(data: Omit<Product,'_id'|'createdAt'> & Partial<Pick<Product,'_id'|'createdAt'>>): Product {
  const prods = getProducts()
  const activeDomain = (()=>{ try{ return getActiveDomain() }catch{return null}})()
  const newProd: Product = {
    _id: data._id || 'prod_' + generateId(),
    sku: data.sku || `LUM-${data.category?.[0]?.toUpperCase() || 'X'}-${String(prods.length+1).padStart(3,'0')}`,
    name: data.name,
    nameAr: data.nameAr,
    description: data.description,
    descriptionAr: data.descriptionAr,
    price: Number(data.price),
    compareAtPrice: data.compareAtPrice ? Number(data.compareAtPrice) : undefined,
    images: data.images?.filter(Boolean) || [],
    category: data.category,
    material: data.material,
    materialAr: data.materialAr,
    rating: Number(data.rating) || 4.8,
    reviewsCount: Number(data.reviewsCount) || 0,
    stock: Number(data.stock) || 0,
    isFeatured: !!data.isFeatured,
    isNew: !!data.isNew,
    attributes: data.attributes || {},
    variants: (data.variants || []).map(v=> ({...v, id: v.id || 'var_' + generateId()})),
    tierPricing: data.tierPricing || [],
    createdAt: new Date().toISOString(),
    domainId: data.domainId || activeDomain?.id || undefined,
  }
  // compute stock from variants if variants have stock
  if(newProd.variants && newProd.variants.length){
    const vs = newProd.variants.reduce((a,b)=> a + (Number(b.stock)||0), 0)
    if(vs>0) newProd.stock = vs
  }
  if(!newProd.images.length) throw new Error('IMAGES_REQUIRED')
  if(!newProd.nameAr || !newProd.price) throw new Error('VALIDATION_ERROR')
  if(!newProd.category) throw new Error('VALIDATION_ERROR')
  prods.unshift(newProd)
  save(STORAGE_KEYS.PRODUCTS, prods)
  return newProd
}

export function updateProduct(id: string, patch: Partial<Product>): Product[] {
  const prods = getProducts()
  const idx = prods.findIndex(p=>p._id===id)
  if(idx>=0){
    const prev = prods[idx]
    const next: Product = { ...prev, ...patch, _id: id } as Product
    if(patch.price !== undefined) next.price = Number(patch.price)
    if(patch.compareAtPrice !== undefined) next.compareAtPrice = patch.compareAtPrice ? Number(patch.compareAtPrice) : undefined
    if(patch.stock !== undefined) next.stock = Number(patch.stock)
    if(patch.rating !== undefined) next.rating = Number(patch.rating)
    if(patch.reviewsCount !== undefined) next.reviewsCount = Number(patch.reviewsCount)
    if(patch.variants){
      next.variants = patch.variants.map(v=> ({...v, id: v.id || 'var_' + generateId()}))
      const vs = next.variants.reduce((a,b)=> a + (Number(b.stock)||0), 0)
      if(vs>0) next.stock = vs
    }
    if(patch.attributes) next.attributes = { ...patch.attributes }
    prods[idx]= next
    save(STORAGE_KEYS.PRODUCTS, prods)
  }
  return prods
}

export function deleteProduct(id: string): Product[] {
  const prods = getProducts().filter(p=>p._id!==id)
  save(STORAGE_KEYS.PRODUCTS, prods)
  return prods
}

export function duplicateProduct(id: string): Product | null {
  const orig = getProductById(id)
  if(!orig) return null
  const copy = { ...orig, _id: 'prod_' + generateId(), sku: orig.sku + '-COPY', name: orig.name + ' Copy', nameAr: orig.nameAr + ' - نسخة', createdAt: new Date().toISOString(), variants: orig.variants?.map(v=> ({...v, id: 'var_' + generateId()})) }
  const prods = getProducts()
  prods.unshift(copy)
  save(STORAGE_KEYS.PRODUCTS, prods)
  return copy
}

export function toggleProductFlag(id: string, flag: 'isFeatured' | 'isNew'): Product[] {
  const p = getProductById(id)
  if(!p) return getProducts()
  return updateProduct(id, { [flag]: !p[flag] } as any)
}
