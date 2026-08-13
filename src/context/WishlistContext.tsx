import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Product } from '../services/api/types'

interface WishlistCtx {
  items: Product[]
  toggle: (p: Product) => boolean
  isWished: (id: string) => boolean
  count: number
  remove: (id: string) => void
  clear: () => void
}

const Ctx = createContext<WishlistCtx>(null as any)

/** Per-store wishlist key. Caches the wishlist under
 *  `lumiere_wishlist__<slug>` so wishlists don't leak across stores
 *  on vercel.app / localhost. Falls back to `'default'` when no
 *  store context is set. */
function getWishlistKey() {
  try {
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('store') || params.get('storeId') || 'default'
    return `lumiere_wishlist__${slug}`
  } catch {
    return 'lumiere_wishlist__default'
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Product[]>(() => {
    try {
      const key = getWishlistKey()
      const stored = localStorage.getItem(key)
      if (stored) return JSON.parse(stored)
      // Backwards-compat: fall back to the legacy global key.
      const legacy = localStorage.getItem('lumiere_wishlist')
      return legacy ? JSON.parse(legacy) : []
    } catch { return [] }
  })

  // Persist to BOTH the per-store key (new) AND the legacy global key.
  useEffect(() => {
    try {
      const key = getWishlistKey()
      localStorage.setItem(key, JSON.stringify(items))
      localStorage.setItem('lumiere_wishlist', JSON.stringify(items))
    } catch {}
  }, [items])

  // Reload the wishlist when the store in the URL changes.
  useEffect(() => {
    const onPop = () => {
      try {
        const stored = localStorage.getItem(getWishlistKey())
        setItems(stored ? JSON.parse(stored) : [])
      } catch { setItems([]) }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // sync across tabs (uses the legacy key so existing tabs keep working)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'lumiere_wishlist' && e.newValue) {
        try { setItems(JSON.parse(e.newValue)) } catch {}
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const isWished = useCallback((id: string) => items.some(x => x._id === id), [items])

  const toggle = useCallback((p: Product) => {
    const exists = items.some(x => x._id === p._id)
    if (exists) {
      setItems(prev => prev.filter(x => x._id !== p._id))
      return false
    } else {
      setItems(prev => [...prev, p])
      return true
    }
  }, [items])

  const remove = useCallback((id: string) => setItems(prev => prev.filter(x => x._id !== id)), [])
  const clear = useCallback(() => setItems([]), [])

  return <Ctx.Provider value={{ items, toggle, isWished, count: items.length, remove, clear }}>{children}</Ctx.Provider>
}
export const useWishlist = () => useContext(Ctx)
