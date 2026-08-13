import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Product, Variant } from '../services/api/types'
import { Tracking } from '../services/tracking'
import { calcItemTotal } from '../lib/utils'

export interface CartItem { product: Product; qty: number; variantId?: string; variant?: Variant; variantLabel?: string }

interface CartCtx {
  items: CartItem[]
  addToCart: (p: Product, qty?: number, variantId?: string) => void
  updateQty: (id: string, qty: number, variantId?: string) => void
  removeItem: (id:string, variantId?: string)=>void
  clear: ()=>void
  totalQty: number
  subtotal: number
  discount: number
  total: number
}

const Ctx = createContext<CartCtx>(null as any)

/** Per-store cart key. Caches the cart under
 *  `lumiere_cart__<slug>` so carts don't leak across stores on
 *  vercel.app / localhost (where multiple stores share the same
 *  origin). Falls back to `'default'` when no store context is set. */
function getCartKey() {
  try {
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('store') || params.get('storeId') || 'default'
    return `lumiere_cart__${slug}`
  } catch {
    return 'lumiere_cart__default'
  }
}

function getVariantLabel(v?: Variant){
  if(!v) return undefined
  const parts=[]
  if(v.colorAr || v.color) parts.push(v.colorAr || v.color || '')
  if(v.size) parts.push(v.size)
  return parts.filter(Boolean).join(' • ')
}

export function CartProvider({children}:{children:React.ReactNode}){
  const [items, setItems] = useState<CartItem[]>(()=>{
    try {
      const key = getCartKey()
      const stored = localStorage.getItem(key)
      if (stored) return JSON.parse(stored)
      // Backwards-compat: fall back to the legacy global key so existing
      // carts aren't lost on the first load after this change.
      const legacy = localStorage.getItem('lumiere_cart')
      return legacy ? JSON.parse(legacy) : []
    } catch { return [] }
  })

  // Persist the cart to BOTH the per-store key (new) AND the legacy
  // global key (so existing carts aren't lost for users who later
  // visit a different store from the same browser).
  useEffect(()=>{
    try {
      const key = getCartKey()
      localStorage.setItem(key, JSON.stringify(items))
      // Also write to the legacy key for backwards compat.
      localStorage.setItem('lumiere_cart', JSON.stringify(items))
    } catch {}
  },[items])

  // Reload the cart from the new per-store key whenever the URL's
  // ?store= / ?storeId= param changes (e.g. when the user switches
  // stores on the same origin).
  useEffect(()=>{
    const onPop = () => {
      try {
        const stored = localStorage.getItem(getCartKey())
        setItems(stored ? JSON.parse(stored) : [])
      } catch { setItems([]) }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const addToCart=(p:Product, qty=1, variantId?: string)=>{
    const variant = variantId ? p.variants?.find(v=> v.id===variantId) : undefined
    if(p.variants?.length && !variantId){
      // if product has variants, require selection? For cart button without selection, pick first available
      const first = p.variants.find(v=> (v.stock||0) >0) || p.variants[0]
      if(first){
        variantId = first.id
      }
    }
    const v = variant || (variantId ? p.variants?.find(x=> x.id===variantId) : undefined)
    const label = getVariantLabel(v)
    setItems(prev=>{
      const key = p._id + '::' + (variantId||'')
      const found = prev.find(i=> (i.product._id + '::' + (i.variantId||''))===key)
      if(found) return prev.map(i=> (i.product._id + '::' + (i.variantId||''))===key ? {...i, qty: i.qty+qty}:i)
      return [...prev, {product:p, qty, variantId, variant: v, variantLabel: label}]
    })
    const unitPrice = p.price + (v?.priceAdjustment||0)
    Tracking.addToCart(p._id, qty, unitPrice*qty)
  }
  const updateQty=(id:string, qty:number, variantId?: string)=>{
    const key = id + '::' + (variantId||'')
    if(qty<=0) return setItems(prev=>prev.filter(i=> (i.product._id + '::' + (i.variantId||''))!==key))
    setItems(prev=>prev.map(i=> (i.product._id + '::' + (i.variantId||''))===key ? {...i,qty}:i))
  }
  const removeItem=(id:string, variantId?: string)=>{
    const key = id + '::' + (variantId||'')
    setItems(prev=>prev.filter(i=> (i.product._id + '::' + (i.variantId||''))!==key))
  }
  const clear=()=> setItems([])

  // calc with variant priceAdjustment
  let subtotal=0
  let discount=0
  let total=0
  items.forEach(i=>{
    const unit = i.product.price + (i.variant?.priceAdjustment||0)
    subtotal += unit * i.qty
    const {discountAmount, total:t}=calcItemTotal(unit, i.qty, i.product.tierPricing)
    discount+=discountAmount
    total+=t
  })
  if(items.length===0){ total=0; discount=0; subtotal=0 }

  return <Ctx.Provider value={{items, addToCart, updateQty, removeItem, clear, totalQty: items.reduce((a,b)=>a+b.qty,0), subtotal, discount, total}}>{children}</Ctx.Provider>
}
export const useCart=()=> useContext(Ctx)
