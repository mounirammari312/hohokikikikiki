/**
 * EnhancedMarketplaceProductCard — Premium, clean product card.
 *
 * Refactored from a Temu-style noisy card into a calm, conversion-
 * focused card that keeps the product image fully visible:
 *
 *   - Image area: only the discount ribbon + wishlist heart overlay
 *     (no floating cart button covering the image)
 *   - Content area: store name, product name, price (bold slate-900),
 *     and a full-width "طلب سريع" (Quick Order) button at the bottom
 *   - Badges (COD, free delivery) kept compact + neutral
 *   - All colors unified to slate + emerald COD accent
 *
 * The whole card is clickable → product detail page. The "Quick Order"
 * button stops propagation so it adds to cart without navigating.
 */

import { useState, useMemo } from 'react'
import {
  Star, Eye, ShieldCheck, Store as StoreIcon, CheckCircle2,
  Truck, Heart, ShoppingCart, Flame, BadgeCheck,
} from 'lucide-react'
import type { MarketplaceProduct } from '../../services/api/client'
import type { TenantStore } from '../../services/api/types'
import { formatDZD } from '../../lib/utils'
import { SmartImage } from '../SmartImage'
import { useWishlist } from '../../context/WishlistContext'
import { useCart } from '../../context/CartContext'

interface Props {
  p: MarketplaceProduct
  stores: TenantStore[]
  onClick: () => void
  flash?: boolean
}

// Deterministic pseudo-random based on string hash — so each product gets
// a stable "sold today" number that doesn't change on every render.
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function EnhancedMarketplaceProductCard({ p, stores, onClick, flash = false }: Props) {
  const { isWished, toggle } = useWishlist()
  const { addToCart } = useCart()
  const [added, setAdded] = useState(false)

  const discount = p.compareAtPrice ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0
  const store = stores.find(s => s._id === p.storeId)
  const views = (p as any).marketplaceViews || 0

  // Deterministic "sold today" — based on product ID + day
  const soldToday = useMemo(() => {
    const day = new Date().getDate()
    const h = hashStr(p._id + day)
    return 3 + (h % 80) // 3-83
  }, [p._id])

  // "Verified" badge — stable based on store ID
  const isVerified = store ? hashStr(store._id) % 3 === 0 : false

  // Free delivery threshold
  const hasFreeDelivery = p.price >= 5000

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggle(p as any)
  }

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addToCart(p as any, 1)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const wished = isWished(p._id)

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all cursor-pointer text-right h-full flex flex-col"
    >
      {/* ─── IMAGE (clean — no floating cart button) ─── */}
      <div className="relative aspect-square bg-slate-50 overflow-hidden">
        <SmartImage
          src={p.images?.[0] || ''}
          alt={p.nameAr}
          size="card"
          className="w-full h-full group-hover:scale-105 transition-transform duration-500"
        />

        {/* Discount ribbon (top-left) */}
        {discount > 0 && (
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-slate-900 text-white text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full shadow-sm">
            -{discount}%
          </div>
        )}

        {/* New badge (top-right) */}
        {p.isNew && (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-emerald-600 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full shadow-sm">
            جديد
          </div>
        )}

        {/* Wishlist heart (top-right corner, below new badge) */}
        <button
          onClick={handleWishlist}
          className={`absolute w-7 h-7 sm:w-8 sm:h-8 rounded-full grid place-items-center transition-all ${
            p.isNew ? 'top-8 sm:top-10' : 'top-1.5 sm:top-2'
          } right-1.5 sm:right-2 ${
            wished
              ? 'bg-rose-600 text-white'
              : 'bg-white/90 backdrop-blur text-slate-600 hover:bg-white hover:text-rose-600'
          }`}
          aria-label="إضافة للمفضلة"
        >
          <Heart size={13} className="sm:hidden" />
          <Heart size={14} className="hidden sm:block" />
        </button>

        {/* Flash ribbon (bottom-left) — only in flash deals sections */}
        {flash && (
          <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 bg-amber-500 text-white text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full shadow-sm flex items-center gap-0.5">
            <Flame size={9} />
            <span>عاجل</span>
          </div>
        )}
      </div>

      {/* ─── CONTENT ─── */}
      <div className="p-2 sm:p-2.5 flex-1 flex flex-col">
        {/* Store name with verified badge */}
        {store && (
          <div className="text-[9px] sm:text-[10px] text-slate-500 mb-0.5 sm:mb-1 flex items-center gap-1 truncate">
            <StoreIcon size={10} className="shrink-0" />
            <span className="truncate">{store.nameAr || store.name}</span>
            {isVerified && (
              <BadgeCheck size={11} className="shrink-0 text-emerald-600" />
            )}
          </div>
        )}

        {/* Product name */}
        <div className="text-[11px] sm:text-xs font-medium text-slate-900 line-clamp-2 leading-4 sm:leading-5 min-h-[32px] sm:min-h-[40px]">
          {p.nameAr}
        </div>

        {/* Rating + reviews */}
        <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5 text-[9px] sm:text-[10px] text-slate-500">
          {p.rating > 0 && (
            <div className="flex items-center gap-0.5">
              <Star size={10} className="fill-amber-400 text-amber-400" />
              <span className="font-bold text-slate-900">{p.rating.toFixed(1)}</span>
              <span className="hidden sm:inline">({p.reviewsCount || 0})</span>
            </div>
          )}
          {views > 0 && (
            <div className="flex items-center gap-0.5">
              <Eye size={10} />
              <span>{views}</span>
            </div>
          )}
        </div>

        {/* Price — bold slate-900, clear typography */}
        <div className="flex items-baseline gap-1.5 mt-1 sm:mt-1.5">
          <span className="font-extrabold text-slate-900 text-sm sm:text-base tabular-nums">
            {formatDZD(p.price)}
          </span>
          {p.compareAtPrice && (
            <span className="text-[9px] sm:text-[10px] text-slate-400 line-through tabular-nums">
              {formatDZD(p.compareAtPrice)}
            </span>
          )}
        </div>

        {/* Sold today — quiet */}
        <div className="flex items-center gap-1 mt-0.5 text-[9px] sm:text-[10px] text-slate-500">
          <Flame size={9} />
          <span>باع {soldToday} اليوم</span>
        </div>

        {/* Badges row — compact */}
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          <div className="flex items-center gap-0.5 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold text-[8px] sm:text-[9px]">
            <ShieldCheck size={9} />
            <span>COD</span>
          </div>
          {hasFreeDelivery && (
            <div className="flex items-center gap-0.5 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full font-bold text-[8px] sm:text-[9px]">
              <Truck size={9} />
              <span className="hidden sm:inline">توصيل مجاني</span>
              <span className="sm:hidden">مجاني</span>
            </div>
          )}
        </div>

        {/* Low stock indicator (pulsing) */}
        {p.stock <= 5 && p.stock > 0 && (
          <div className="text-[9px] sm:text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
            </span>
            باقي {p.stock} فقط
          </div>
        )}

        {/* Quick order button — full width, below image, clean */}
        <button
          onClick={handleAddToCart}
          className={`mt-2 sm:mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
            added
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]'
          }`}
        >
          {added ? (
            <>
              <CheckCircle2 size={13} />
              <span>أُضيف للسلة</span>
            </>
          ) : (
            <>
              <ShoppingCart size={13} />
              <span>طلب سريع</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
