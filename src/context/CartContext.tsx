/**
 * CartContext — fully per-store scoped.
 *
 * The cart is stored under `amugar_cart__<storeSlug>` so that items
 * added in Store A NEVER appear in Store B's cart. When the user
 * navigates to a different store (?store=xxx changes), the cart is
 * reloaded from the new store's key.
 *
 * IMPORTANT: We do NOT write to any legacy global key. The old
 * `amugar_cart` key is only read ONCE on first load (migration for
 * the default store) and then never touched again. This prevents
 * cross-store cart leakage which was causing wrong-store orders.
 */

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

function getVariantLabel(v?: Variant){
  if(!v) return undefined
  const parts=[]
  if(v.colorAr || v.color) parts.push(v.colorAr || v.color || '')
  if(v.size) parts.push(v.size)
  return parts.filter(Boolean).join(' • ')
}

/** Get the per-store localStorage key for the cart.
 *  Combines `?store=` and `?storeId=` to form a unique key per store.
 *  If neither is present, uses 'default'. */
function getCartKey(): string {
  try {
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('store') || params.get('storeId') || 'default'
    return `amugar_cart__${slug}`
  } catch {
    return 'amugar_cart__default'
  }
}

export function CartProvider({children}:{children:React.ReactNode}){
  const [items, setItems] = useState<CartItem[]>([])

  // Load cart from the per-store key on mount AND whenever the
  // URL's ?store= / ?storeId= param changes.
  useEffect(() => {
    const loadCart = () => {
      try {
        const key = getCartKey()
        const stored = localStorage.getItem(key)
        if (stored) {
          setItems(JSON.parse(stored))
          return
        }
        // One-time migration: if the per-store key doesn't exist but
        // the legacy global key does, copy it (ONLY for 'default' store).
        if (key === 'amugar_cart__default') {
          const legacy = localStorage.getItem('amugar_cart')
          if (legacy) {
            const parsed = JSON.parse(legacy)
            setItems(parsed)
            localStorage.setItem(key, legacy)
            return
          }
        }
        setItems([])
      } catch {
        setItems([])
      }
    }

    // Load on mount
    loadCart()

    // Reload whenever the URL changes (popstate covers back/forward;
    // we also poll location.search every 500ms to catch pushState
    // changes from React Router <Link> clicks that don't fire popstate).
    let lastSearch = window.location.search
    const interval = setInterval(() => {
      if (window.location.search !== lastSearch) {
        lastSearch = window.location.search
        loadCart()
      }
    }, 500)

    window.addEventListener('popstate', loadCart)
    return () => {
      window.removeEventListener('popstate', loadCart)
      clearInterval(interval)
    }
  }, [])

  // Persist to the per-store key ONLY (no legacy global key — that
  // was the source of cross-store cart leakage).
  useEffect(()=>{
    try {
      localStorage.setItem(getCartKey(), JSON.stringify(items))
    } catch {}
  },[items])

  const addToCart=(p:Product, qty=1, variantId?: string)=>{
    const variant = variantId ? p.variants?.find(v=> v.id===variantId) : undefined
    if(p.variants?.length && !variantId){
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
