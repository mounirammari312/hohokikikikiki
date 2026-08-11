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

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Product[]>(() => {
    try { return JSON.parse(localStorage.getItem('lumiere_wishlist') || '[]') } catch { return [] }
  })

  useEffect(() => { localStorage.setItem('lumiere_wishlist', JSON.stringify(items)) }, [items])

  // sync across tabs
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
