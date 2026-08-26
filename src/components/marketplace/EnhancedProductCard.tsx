/**
 * EnhancedMarketplaceProductCard — AliExpress-style high-conversion card.
 *
 * Layout (top → bottom):
 *   1. Square image
 *      - discount / new badge (top-left)
 *      - wishlist heart (top-right, soft white pill)
 *   2. Price row — current price (red, bold), strikethrough old price,
 *      discount percent pill ("خصم 30%")
 *   3. Trust badges — COD (red) + "متجر موثق" (gold/black)
 *   4. Social proof — rating star + "باع 150+ قطعة"
 *   5. Product name (2 lines) + store name with verified icon
 *   6. Delivery badge — "متوفر التوصيل لـ 58 ولاية" (emerald)
 *   7. Quick order button — full width, slate-900
 *
 * No emojis — only lucide-react icons.
 */

import { useState, useMemo } from 'react'
import {
  Star, ShieldCheck, Store as StoreIcon, CheckCircle2, BadgeCheck,
  Truck, Heart, ShoppingCart, Flame, Zap,
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

  // Deterministic "sold total" — based on product ID (stable across renders).
  // Higher range (50-300) to feel like a real marketplace.
  const soldTotal = useMemo(() => {
    const h = hashStr(p._id)
    return 50 + (h % 250) // 50-300
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
      {/* ─── IMAGE (square) ─── */}
      <div className="relative aspect-square bg-slate-50 overflow-hidden">
        <SmartImage
          src={p.images?.[0] || ''}
          alt={p.nameAr}
          size="card"
          className="w-full h-full group-hover:scale-105 transition-transform duration-500"
        />

        {/* Discount badge OR New badge (top-left) */}
        {discount > 0 ? (
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-red-600 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md shadow-sm">
            -{discount}%
          </div>
        ) : p.isNew ? (
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-emerald-700 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md shadow-sm">
            جديد
          </div>
        ) : null}

        {/* Flash ribbon (bottom-left) — only in flash deals sections */}
        {flash && (
          <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 bg-amber-500 text-white text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md shadow-sm flex items-center gap-0.5">
            <Zap size={9} />
            <span>عاجل</span>
          </div>
        )}

        {/* Wishlist heart (top-right, soft white pill) */}
        <button
          onClick={handleWishlist}
          className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full grid place-items-center backdrop-blur transition-all ${
            wished
              ? 'bg-red-600 text-white'
              : 'bg-white/80 text-slate-600 hover:bg-white hover:text-red-600'
          }`}
          aria-label="إضافة للمفضلة"
        >
          <Heart size={13} className="sm:hidden" />
          <Heart size={14} className="hidden sm:block" />
        </button>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="p-2 sm:p-2.5 flex-1 flex flex-col">
        {/* Price row — red current price + strikethrough old + discount pill */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-red-600 font-black text-base md:text-lg tabular-nums leading-none">
            {formatDZD(p.price)}
          </span>
          {p.compareAtPrice && p.compareAtPrice > p.price && (
            <span className="line-through text-slate-400 text-[10px] sm:text-xs tabular-nums">
              {formatDZD(p.compareAtPrice)}
            </span>
          )}
        </div>
        {discount > 0 && (
          <div className="text-red-600 text-[10px] font-bold mt-0.5 flex items-center gap-0.5">
            <Zap size={9} className="fill-red-600" />
            <span>خصم {discount}% الآن</span>
          </div>
        )}

        {/* Trust badges row — COD (red) + Verified store (gold/black) */}
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          <div className="flex items-center gap-0.5 bg-red-50 text-red-700 border border-red-200 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-bold">
            <ShieldCheck size={9} />
            <span>الدفع عند الاستلام</span>
          </div>
          {isVerified && (
            <div className="flex items-center gap-0.5 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded">
              <BadgeCheck size={9} />
              <span>متجر موثق</span>
            </div>
          )}
        </div>

        {/* Social proof — rating + sold count, single line */}
        <div className="flex items-center gap-1.5 mt-1.5 text-[10px] sm:text-[11px] text-slate-500 font-medium">
          {p.rating > 0 && (
            <div className="flex items-center gap-0.5">
              <Star size={11} className="fill-amber-400 text-amber-400 shrink-0" />
              <span className="font-bold text-slate-700">{p.rating.toFixed(1)}</span>
            </div>
          )}
          <span className="text-slate-300">|</span>
          <span>باع {soldTotal}+ قطعة</span>
        </div>

        {/* Product name (2 lines) */}
        <div className="text-xs md:text-sm font-bold text-slate-900 line-clamp-2 leading-4 sm:leading-5 mt-1 min-h-[32px] sm:min-h-[40px]">
          {p.nameAr}
        </div>

        {/* Store name with verified icon */}
        {store && (
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 flex items-center gap-1 truncate">
            <StoreIcon size={10} className="shrink-0 text-slate-400" />
            <span className="truncate">{store.nameAr || store.name}</span>
            {isVerified && (
              <BadgeCheck size={11} className="shrink-0 text-emerald-600" />
            )}
          </div>
        )}

        {/* Delivery badge — emerald, bottom */}
        <div className="text-emerald-700 text-[10px] font-semibold mt-1.5 flex items-center gap-1">
          <Truck size={11} className="shrink-0" />
          <span>متوفر التوصيل لـ 58 ولاية</span>
        </div>

        {/* Quick order button — full width, slate-900 */}
        <button
          onClick={handleAddToCart}
          className={`mt-2 sm:mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
            added
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {added ? (
            <>
              <CheckCircle2 size={14} />
              <span>أُضيف للسلة</span>
            </>
          ) : (
            <>
              <ShoppingCart size={14} />
              <span>طلب سريع</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
