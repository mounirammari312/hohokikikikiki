/**
 * ProductCard — AliExpress-style compact card for the merchant storefront.
 *
 * Mirrors the marketplace's EnhancedMarketplaceProductCard design so the
 * whole platform has ONE consistent product-card pattern:
 *   - Square image (object-contain on slate-50 bg)
 *   - Discount / new badge (top-left)
 *   - Wishlist heart (top-right, soft white pill)
 *   - Red current price + strikethrough old price + discount %
 *   - COD badge (red) + discount %
 *   - Social proof (rating star + "باع X+ قطعة")
 *   - Product name (2 lines, bold slate-800)
 *   - Delivery badge ("توصيل 69 ولاية", emerald)
 *
 * The whole card is clickable → routes to the product detail page.
 * No floating "Quick Order" button (keeps the image clean).
 *
 * Theme colors: the card uses the merchant's theme via CSS variables
 * (--color-primary, --color-secondary) for the price/discount accents
 * ONLY when the merchant has customized them. Default palette is the
 * neutral slate + red price + emerald COD used in the marketplace.
 */

import { Link, useLocation } from 'react-router-dom'
import { Heart, Star, ShieldCheck, Truck, Zap, BadgeCheck } from 'lucide-react'
import type { Product } from '../services/api/types'
import { formatDZD } from '../lib/utils'
import { useWishlist } from '../context/WishlistContext'
import { useCart } from '../context/CartContext'
import { useState, useMemo } from 'react'
import { SmartImage } from './SmartImage'

interface Props {
  p: Product
  index?: number
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

export default function ProductCard({ p, index = 0 }: Props) {
  const discount = p.compareAtPrice && p.compareAtPrice > p.price
    ? Math.round((1 - p.price / p.compareAtPrice) * 100)
    : 0

  const { toggle, isWished } = useWishlist()
  const { addToCart } = useCart()
  const [toast, setToast] = useState<string | null>(null)
  const wished = isWished(p._id)

  // Preserve ?store= or ?storeId= across routing
  const location = useLocation()
  const urlParams = new URLSearchParams(location.search)
  const storeSlug = urlParams.get('store')
  const storeId = urlParams.get('storeId')
  const storeQuery = storeSlug
    ? `?store=${encodeURIComponent(storeSlug)}`
    : storeId
      ? `?storeId=${encodeURIComponent(storeId)}`
      : ''

  // Stock status
  const stock = typeof p.stock === 'number' ? p.stock : 10
  const outOfStock = stock <= 0
  const lowStock = stock > 0 && stock <= 5

  // First 4 cards load eagerly with high priority for LCP
  const isAboveTheFold = index < 4

  // Deterministic "sold total" — based on product ID (stable across renders).
  const soldTotal = useMemo(() => {
    const h = hashStr(p._id)
    return 30 + (h % 200) // 30-230
  }, [p._id])

  const handleWish = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const added = toggle(p)
    setToast(added ? 'تمت الإضافة للرغبات' : 'تمت الإزالة من الرغبات')
    setTimeout(() => setToast(null), 1800)
  }

  const mainImage = (p.images && p.images.length > 0 && p.images[0]) ? p.images[0] : ''
  const ratingValue = typeof p.rating === 'number' ? p.rating.toFixed(1) : '4.8'
  const reviewsCount = typeof p.reviewsCount === 'number' ? p.reviewsCount : 0

  return (
    <div
      className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md hover:border-slate-300 transition-all cursor-pointer text-right h-full flex flex-col"
    >
      {toast && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}

      <Link
        to={`/product/${p._id}${storeQuery}`}
        className="block relative aspect-square bg-slate-50 overflow-hidden p-2"
      >
        <SmartImage
          src={mainImage}
          alt={p.nameAr || p.name || 'منتج'}
          size="card"
          eager={isAboveTheFold}
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

        {/* Stock banners (center-top) — only when out/low */}
        {outOfStock && (
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded-full z-10">نفذت الكمية</span>
        )}
        {!outOfStock && lowStock && (
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full z-10">باقي {stock} قطع</span>
        )}

        {/* Wishlist heart (top-right, soft white pill) */}
        <button
          type="button"
          onClick={handleWish}
          aria-label="wishlist"
          className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full grid place-items-center backdrop-blur transition-all ${
            wished
              ? 'bg-red-600 text-white'
              : 'bg-white/80 text-slate-600 hover:bg-white hover:text-red-600'
          }`}
        >
          <Heart size={13} className={wished ? 'fill-white' : ''} />
        </button>
      </Link>

      <div className="p-2 flex-1 flex flex-col">
        {/* Price row — red current price + strikethrough old */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-red-600 font-black text-sm md:text-base tabular-nums leading-none">
            {formatDZD(p.price || 0)}
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
              <span className="font-bold text-slate-700">{ratingValue}</span>
              {reviewsCount > 0 && <span className="hidden sm:inline">({reviewsCount})</span>}
            </div>
          )}
          <span className="text-slate-300">|</span>
          <span>باع {soldTotal}+ قطعة</span>
        </div>

        {/* Product name (2 lines) */}
        <Link to={`/product/${p._id}${storeQuery}`} className="block mt-1">
          <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-4 hover:text-slate-900 transition-colors min-h-[32px]">
            {p.nameAr || p.name}
          </h3>
        </Link>

        {/* Inline stock status */}
        {outOfStock && (
          <div className="mt-1 text-[10px] font-bold text-red-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600" /> نفذت الكمية
          </div>
        )}
        {!outOfStock && lowStock && (
          <div className="mt-1 text-[10px] font-bold text-amber-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> باقي {stock} قطع فقط
          </div>
        )}

        {/* Tier Pricing hint (compact) */}
        {Array.isArray(p.tierPricing) && p.tierPricing.length > 0 && p.tierPricing[0] && (
          <div className="mt-1 text-[10px] font-bold text-slate-600 flex items-center gap-1">
            <BadgeCheck size={10} className="text-emerald-600 shrink-0" />
            <span>وفّر حتى {p.tierPricing[p.tierPricing.length - 1].discountPercent}% عند شراء {p.tierPricing[p.tierPricing.length - 1].minQty} قطع</span>
          </div>
        )}

        {/* Delivery badge — emerald, bottom */}
        <div className="text-emerald-700 text-[10px] font-semibold mt-1 flex items-center gap-1">
          <Truck size={11} className="shrink-0" />
          <span>توصيل 69 ولاية</span>
        </div>
      </div>
    </div>
  )
}
