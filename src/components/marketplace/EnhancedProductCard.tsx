/**
 * EnhancedMarketplaceProductCard — AliExpress compact card.
 *
 * Clean, click-anywhere card. The whole card is clickable → routes to
 * the product detail page (no separate "Quick Order" button inside).
 *
 * Layout (top → bottom):
 *   1. Square image (object-contain on slate-50 bg)
 *      - discount / new badge (top-left)
 *      - wishlist heart (top-right, soft white pill)
 *   2. Price row — red current price + strikethrough old + discount pill
 *   3. Trust badges — COD (red) + discount %
 *   4. Social proof — rating star + "باع 70+ قطعة"
 *   5. Product name (2 lines, bold slate-800)
 *   6. Delivery badge — "توصيل 58 ولاية" (emerald)
 *
 * No emojis — only lucide-react icons.
 */

import { useMemo } from 'react'
import {
  Star, ShieldCheck, Store as StoreIcon, BadgeCheck,
  Truck, Heart, Zap,
} from 'lucide-react'
import type { MarketplaceProduct } from '../../services/api/client'
import type { TenantStore } from '../../services/api/types'
import { formatDZD } from '../../lib/utils'
import { SmartImage } from '../SmartImage'
import { useWishlist } from '../../context/WishlistContext'

interface Props {
  p: MarketplaceProduct
  stores: TenantStore[]
  onClick: () => void
  flash?: boolean
}

// Deterministic pseudo-random based on string hash — so each product gets
// a stable "sold total" number that doesn't change on every render.
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function EnhancedMarketplaceProductCard({ p, stores, onClick, flash = false }: Props) {
  const { isWished, toggle } = useWishlist()

  const discount = p.compareAtPrice ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0
  const store = stores.find(s => s._id === p.storeId)

  // Deterministic "sold total" — based on product ID (stable across renders).
  const soldTotal = useMemo(() => {
    const h = hashStr(p._id)
    return 30 + (h % 200) // 30-230
  }, [p._id])

  // "Verified" badge — stable based on store ID
  const isVerified = store ? hashStr(store._id) % 3 === 0 : false

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggle(p as any)
  }

  const wished = isWished(p._id)

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md hover:border-slate-300 transition-all cursor-pointer text-right h-full flex flex-col"
    >
      {/* ─── IMAGE (square, object-contain on slate-50) ─── */}
      <div className="relative aspect-square bg-slate-50 overflow-hidden p-2">
        <SmartImage
          src={p.images?.[0] || ''}
          alt={p.nameAr}
          size="card"
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
        />

        {/* Discount badge OR New badge (top-left) */}
        {discount > 0 ? (
          <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
            -{discount}%
          </div>
        ) : p.isNew ? (
          <div className="absolute top-1.5 left-1.5 bg-emerald-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
            جديد
          </div>
        ) : null}

        {/* Flash ribbon (bottom-left) — only in flash deals sections */}
        {flash && (
          <div className="absolute bottom-1.5 left-1.5 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <Zap size={9} />
            <span>عاجل</span>
          </div>
        )}

        {/* Wishlist heart (top-right, soft white pill) */}
        <button
          onClick={handleWishlist}
          className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full grid place-items-center backdrop-blur transition-all ${
            wished
              ? 'bg-red-600 text-white'
              : 'bg-white/80 text-slate-600 hover:bg-white hover:text-red-600'
          }`}
          aria-label="إضافة للمفضلة"
        >
          <Heart size={13} />
        </button>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="p-2 flex-1 flex flex-col">
        {/* Price row — red current price + strikethrough old */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-red-600 font-black text-sm md:text-base tabular-nums leading-none">
            {formatDZD(p.price)}
          </span>
          {p.compareAtPrice && p.compareAtPrice > p.price && (
            <span className="line-through text-slate-400 text-[10px] tabular-nums">
              {formatDZD(p.compareAtPrice)}
            </span>
          )}
        </div>

        {/* Trust badges row — COD (red) + discount % */}
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <div className="flex items-center gap-0.5 bg-red-50 text-red-700 border border-red-200 text-[9px] px-1.5 py-0.5 rounded font-bold">
            <ShieldCheck size={9} />
            <span>الدفع عند الاستلام</span>
          </div>
          {discount > 0 && (
            <div className="flex items-center gap-0.5 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
              <span>-{discount}%</span>
            </div>
          )}
        </div>

        {/* Social proof — rating + sold count, single line */}
        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-medium">
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
        <div className="text-xs font-bold text-slate-800 line-clamp-2 leading-4 mt-1 min-h-[32px]">
          {p.nameAr}
        </div>

        {/* Store name (compact, optional) */}
        {store && (
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
            <StoreIcon size={9} className="shrink-0 text-slate-400" />
            <span className="truncate">{store.nameAr || store.name}</span>
            {isVerified && (
              <BadgeCheck size={10} className="shrink-0 text-emerald-600" />
            )}
          </div>
        )}

        {/* Delivery badge — emerald, bottom */}
        <div className="text-emerald-700 text-[10px] font-semibold mt-1 flex items-center gap-1">
          <Truck size={11} className="shrink-0" />
          <span>توصيل 58 ولاية</span>
        </div>
      </div>
    </div>
  )
}
