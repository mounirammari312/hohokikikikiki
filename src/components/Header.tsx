/**
 * Header — Single-row sticky capsule header for the merchant storefront.
 *
 * Mirrors the marketplace's header pattern so the whole platform has ONE
 * consistent header design:
 *   - Announcement bar (slim, merchant's secondary color)
 *   - Single row:
 *       RIGHT  → Store name (cormorant wordmark, merchant's primary color)
 *       CENTER → Capsule search (flex-1, rounded-full, embedded button)
 *       LEFT   → Wishlist + Cart (compact cluster)
 *   - Mobile menu drawer (hamburger) for navigation links
 *
 * The merchant's theme colors (--color-primary, --color-secondary) are
 * preserved for the wordmark + announcement bar + cart button, but the
 * search capsule uses the neutral slate palette for consistency with
 * the marketplace.
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShoppingBag, Search, Menu, X, Heart } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { getSettings, syncSettings, subscribeSettings } from '../services/api/settings'
import { useTenant } from '../context/TenantContext'

export default function Header() {
  const { totalQty } = useCart()
  const { count: wishCount } = useWishlist()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [store, setStore] = useState(() => getSettings())

  const nav = useNavigate()
  const location = useLocation()
  const { storeId, storeSlug } = useTenant()
  const urlParams = new URLSearchParams(location.search)
  const activeSlug = storeSlug || urlParams.get('store')
  const activeId = storeId || urlParams.get('storeId')
  const storeQuery = activeSlug ? `?store=${encodeURIComponent(activeSlug)}` : (activeId ? `?storeId=${encodeURIComponent(activeId)}` : '')

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) {
      const params = new URLSearchParams()
      params.set('q', q.trim())
      if (activeSlug) params.set('store', activeSlug)
      else if (activeId) params.set('storeId', activeId)
      nav(`/shop?${params.toString()}`)
      setOpen(false)
    }
  }

  useEffect(() => {
    void syncSettings().then(() => setStore(getSettings()))
  }, [storeId, storeSlug])

  useEffect(() => {
    const unsub = subscribeSettings(() => setStore(getSettings()))
    return unsub
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
      {/* Announcement bar — slim, merchant's secondary color */}
      {store.announcement && (
        <div
          className="text-[11px] py-1.5 text-center tracking-widest px-3 relative overflow-hidden"
          style={{ background: store.secondaryColor || '#1A1A1E', color: store.primaryColor || '#C9A96A' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent pointer-events-none" />
          <span className="relative line-clamp-1">{store.announcement}</span>
        </div>
      )}

      {/* Single row: store name + capsule search + wishlist/cart */}
      <div className="px-3 md:px-6 py-2.5 flex items-center gap-2">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="md:hidden w-9 h-9 rounded-xl bg-slate-100 grid place-items-center shrink-0 active:scale-95 hover:bg-slate-200 transition"
          aria-label="menu"
        >
          {open ? <X size={18} className="text-slate-700" /> : <Menu size={18} className="text-slate-700" />}
        </button>

        {/* Store name (far right) — cormorant wordmark */}
        <Link to={`/${storeQuery}`} className="flex items-center gap-2 shrink-0 group">
          <div
            className="cormorant text-lg md:text-xl font-bold tracking-[0.18em] leading-none transition-colors"
            style={{ color: store.primaryColor || '#1A1A1E' }}
          >
            {store.storeName}
          </div>
          {store.enableRoseEdition && (
            <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-[#A02A5B] shadow-[0_0_6px_rgba(160,42,91,0.6)]"></span>
          )}
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-semibold text-slate-700 shrink-0">
          <Link to={`/${storeQuery}`} className="hover:text-slate-900 transition">الرئيسية</Link>
          <Link to={`/shop${storeQuery}`} className="hover:text-slate-900 transition">المتجر</Link>
          <a
            href={`/${storeQuery}#collection`}
            onClick={e => {
              e.preventDefault()
              if (window.location.pathname === '/') {
                document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' })
              } else {
                nav(`/${storeQuery}#collection`)
              }
            }}
            className="hover:text-slate-900 transition"
          >
            الكولكشن
          </a>
        </nav>

        {/* Capsule search — single dominant element */}
        <form onSubmit={onSearch} className="flex-1 min-w-0 max-w-[420px] mx-auto">
          <div className="flex items-center gap-2 bg-slate-100 rounded-full pr-3 pl-1 py-1 border border-slate-200 focus-within:border-slate-400 focus-within:bg-white transition">
            <Search size={15} className="text-slate-400 shrink-0 ms-1" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="ابحث في المتجر..."
              className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-slate-400 py-1"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="text-slate-400 hover:text-slate-700 transition shrink-0"
                aria-label="مسح البحث"
              >
                <X size={15} />
              </button>
            )}
            <button
              type="submit"
              className="shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white grid place-items-center hover:bg-slate-800 active:scale-95 transition"
              aria-label="بحث"
            >
              <Search size={14} />
            </button>
          </div>
        </form>

        {/* Wishlist (desktop) */}
        <Link
          to={`/wishlist${storeQuery}`}
          className="hidden md:flex relative w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 items-center justify-center transition shrink-0"
          aria-label="wishlist"
        >
          <Heart size={16} className={`transition ${wishCount > 0 ? 'fill-red-600 text-red-600' : 'text-slate-700'}`} />
          {wishCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full grid place-items-center">
              {wishCount}
            </span>
          )}
        </Link>

        {/* Cart */}
        <Link
          to={`/cart${storeQuery}`}
          className="relative w-9 h-9 md:w-10 md:h-10 rounded-full grid place-items-center shrink-0 transition active:scale-95"
          style={{ background: store.secondaryColor || '#1A1A1E' }}
          aria-label="cart"
        >
          <ShoppingBag size={16} className="text-white" />
          {totalQty > 0 && (
            <span
              className="absolute -top-1 -right-1 text-white text-[10px] font-bold w-5 h-5 rounded-full grid place-items-center border-2 border-white"
              style={{ background: store.primaryColor || '#C9A96A' }}
            >
              {totalQty}
            </span>
          )}
        </Link>
      </div>

      {/* Mobile menu drawer */}
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
          <form onSubmit={onSearch} className="flex items-center bg-slate-100 rounded-full px-3 py-2 border border-slate-200 focus-within:border-slate-400">
            <Search size={16} className="text-slate-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="ابحث..."
              className="flex-1 outline-none px-2 text-sm bg-transparent"
            />
          </form>
          <Link onClick={() => setOpen(false)} to={`/${storeQuery}`} className="block py-2 font-semibold text-slate-800">الرئيسية</Link>
          <Link onClick={() => setOpen(false)} to={`/shop${storeQuery}`} className="block py-2 font-semibold text-slate-800">المتجر</Link>
          <Link onClick={() => setOpen(false)} to={`/wishlist${storeQuery}`} className="block py-2 font-semibold text-slate-800 flex items-center gap-2">
            <Heart size={16} /> الرغبات {wishCount > 0 && `(${wishCount})`}
          </Link>
          <Link onClick={() => setOpen(false)} to={`/cart${storeQuery}`} className="block py-2 font-semibold text-slate-800">السلة ({totalQty})</Link>
          <div className="text-xs text-slate-500 border-t border-slate-200 pt-3">{store.phone} • {store.email}</div>
        </div>
      )}
    </header>
  )
}
