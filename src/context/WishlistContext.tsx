/**
 * WishlistContext — fully per-store scoped.
 *
 * The wishlist is stored under `amugar_wishlist__<storeSlug>` so that
 * items added in Store A NEVER appear in Store B. When the user
 * navigates to a different store (?store=xxx changes), the wishlist
 * is reloaded from the new store's key.
 *
 * IMPORTANT: We do NOT write to any legacy global key. The old
 * `amugar_wishlist` key is only read ONCE on first load (migration)
 * and then never touched again. This prevents cross-store leakage.
 */

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

/** Get the per-store localStorage key for the wishlist.
 *  Combines `?store=` and `?storeId=` to form a unique key per store.
 *  If neither is present, uses 'default'. */
function getWishlistKey(): string {
  try {
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('store') || params.get('storeId') || 'default'
    return `amugar_wishlist__${slug}`
  } catch {
    return 'amugar_wishlist__default'
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Product[]>([])

  // Load wishlist from the per-store key on mount AND whenever the
  // URL's ?store= / ?storeId= param changes.
  useEffect(() => {
    const loadWishlist = () => {
      try {
        const key = getWishlistKey()
        const stored = localStorage.getItem(key)
        if (stored) {
          setItems(JSON.parse(stored))
          return
        }
        // One-time migration: if the per-store key doesn't exist but
        // the legacy global key does, copy it (ONLY for 'default' store).
        if (key === 'amugar_wishlist__default') {
          const legacy = localStorage.getItem('amugar_wishlist')
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
    loadWishlist()

    // Reload whenever the URL changes (popstate covers back/forward;
    // we also poll location.search every 500ms to catch pushState
    // changes from React Router <Link> clicks that don't fire popstate).
    let lastSearch = window.location.search
    const interval = setInterval(() => {
      if (window.location.search !== lastSearch) {
        lastSearch = window.location.search
        loadWishlist()
      }
    }, 500)

    window.addEventListener('popstate', loadWishlist)
    return () => {
      window.removeEventListener('popstate', loadWishlist)
      clearInterval(interval)
    }
  }, [])

  // Persist to the per-store key ONLY (no legacy global key — that
  // was the source of cross-store leakage).
  useEffect(() => {
    try {
      localStorage.setItem(getWishlistKey(), JSON.stringify(items))
    } catch {}
  }, [items])

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

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(x => x._id !== id))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return (
    <Ctx.Provider value={{ items, toggle, isWished, count: items.length, remove, clear }}>
      {children}
    </Ctx.Provider>
  )
}

export const useWishlist = () => useContext(Ctx)
