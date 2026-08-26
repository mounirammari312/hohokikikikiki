/**
 * BannerCarousel — Mega Super Deals box (AliExpress/Temu style).
 *
 * Refactored from a cinematic single-product hero into a high-density
 * "Super Deals" box that surfaces 2-3 discounted products at once,
 * with a live countdown timer + a bold red gradient + clear CTAs.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │  عروض السوبر · خصومات حتى 60%               │
 *   │  ينتهي العرض خلال:  [08][24][12]            │
 *   │  ┌─────┐  ┌─────┐  ┌─────┐                  │
 *   │  │ P1  │  │ P2  │  │ P3  │                  │
 *   │  │price│  │price│  │price│                  │
 *   │  │ CTA │  │ CTA │  │ CTA │                  │
 *   │  └─────┘  └─────┘  └─────┘                  │
 *   └─────────────────────────────────────────────┘
 *
 * Empty state: when no products are passed, renders a neutral slate
 * placeholder (no "coming soon" copy — reads as intentional + on-brand).
 *
 * No emojis — only lucide-react icons.
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Clock, ArrowLeft, ShieldCheck, BadgeCheck,
} from 'lucide-react'
import type { MarketplaceProduct } from '../../services/api/client'
import type { TenantStore } from '../../services/api/types'
import { formatDZD } from '../../lib/utils'
import { SmartImage } from '../SmartImage'
import { CountdownTimer } from './CountdownTimer'

interface Props {
  /**
   * Featured / discounted products to show inside the deals box.
   * We display up to 3 (mobile: 2) — the rest are ignored.
   */
  products?: MarketplaceProduct[]
  /** Stores list (for resolving each product's store name + slug). */
  stores?: TenantStore[]
  className?: string
}

export function BannerCarousel({
  products = [],
  stores = [],
  className = '',
}: Props) {
  const navigate = useNavigate()

  // Pick the top 3 discounted products (highest discount % first),
  // falling back to the first 3 if none have discounts.
  const slides = useMemo(() => {
    const withDiscount = products.filter(
      p => p.compareAtPrice && p.compareAtPrice > p.price
    )
    const sorted = [...withDiscount].sort((a, b) => {
      const da = a.compareAtPrice ? (a.compareAtPrice - a.price) / a.compareAtPrice : 0
      const db = b.compareAtPrice ? (b.compareAtPrice - b.price) / b.compareAtPrice : 0
      return db - da
    })
    if (sorted.length >= 2) return sorted.slice(0, 3)
    // Not enough discounted products → fill with any available products
    return products.slice(0, 3)
  }, [products])

  const resolveStore = (p: MarketplaceProduct) => stores.find(s => s._id === p.storeId)

  const goToProduct = (p: MarketplaceProduct) => {
    const store = resolveStore(p)
    if (store?.slug) {
      navigate(`/product/${p._id}?store=${encodeURIComponent(store.slug)}`)
    } else if (p.storeId) {
      navigate(`/product/${p._id}?storeId=${encodeURIComponent(p.storeId)}`)
    } else {
      navigate(`/product/${p._id}`)
    }
  }

  // ─── Empty state (no products at all) ──────────────────────────────
  if (slides.length === 0) {
    return (
      <div
        className={`relative rounded-3xl overflow-hidden bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-xl ${className}`}
      >
        <div className="relative p-4 md:p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur grid place-items-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg md:text-xl font-extrabold leading-tight">
                عروض السوبر
              </h2>
              <p className="text-white/70 text-[10px] sm:text-xs">خصومات حتى 60% — لفترة محدودة</p>
            </div>
          </div>
          <div className="mt-3 text-white/80 text-xs sm:text-sm">
            الدفع عند الاستلام، توصيل لـ 58 ولاية، ومنتجات أصلية معتمدة
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative rounded-3xl overflow-hidden bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-xl ${className}`}
    >
      {/* Decorative soft blobs (no rainbow — kept within the red family) */}
      <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-56 h-56 bg-rose-900/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-3 sm:p-4 md:p-6">
        {/* Top row: title + countdown */}
        <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white/20 backdrop-blur grid place-items-center shrink-0">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base md:text-lg font-extrabold leading-tight">
                عروض السوبر
              </h2>
              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-white/80">
                <span className="bg-white/20 backdrop-blur rounded px-1.5 py-0.5 font-bold">
                  خصومات حتى 60%
                </span>
              </div>
            </div>
          </div>

          {/* Countdown timer — top-right */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-white/80 font-medium">
              <Clock size={11} />
              <span className="hidden sm:inline">ينتهي العرض خلال:</span>
              <span className="sm:hidden">ينتهي خلال:</span>
            </div>
            <CountdownTimer hours={8} compact className="text-xs" />
          </div>
        </div>

        {/* Mini product cards — 2 on mobile, 3 on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          {slides.map(p => {
            const store = resolveStore(p)
            const img = Array.isArray(p.images) ? p.images[0] : p.images
            const isDiscount = !!p.compareAtPrice && p.compareAtPrice > p.price
            const discountPct = isDiscount
              ? Math.round(((p.compareAtPrice! - p.price) / p.compareAtPrice!) * 100)
              : 0
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => goToProduct(p)}
                className="bg-white rounded-xl sm:rounded-2xl p-2 sm:p-2.5 text-right hover:shadow-lg transition-all hover:-translate-y-0.5 flex flex-col"
                aria-label={`عرض ${p.nameAr || p.name}`}
              >
                {/* Image */}
                <div className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden mb-1.5">
                  {img ? (
                    <SmartImage
                      src={img}
                      alt={p.nameAr || p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center bg-slate-100">
                      <Zap size={20} className="text-slate-300" />
                    </div>
                  )}
                  {isDiscount && (
                    <div className="absolute top-1 left-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                      -{discountPct}%
                    </div>
                  )}
                </div>

                {/* Price (red) + strikethrough old */}
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="text-red-600 font-black text-xs sm:text-sm tabular-nums leading-none">
                    {formatDZD(p.price)}
                  </span>
                  {isDiscount && (
                    <span className="line-through text-slate-400 text-[9px] tabular-nums">
                      {formatDZD(p.compareAtPrice!)}
                    </span>
                  )}
                </div>

                {/* Store badge */}
                {store && (
                  <div className="flex items-center gap-0.5 mt-1 text-[9px] text-slate-500 truncate">
                    <BadgeCheck size={9} className="text-emerald-600 shrink-0" />
                    <span className="truncate">{store.nameAr || store.name}</span>
                  </div>
                )}

                {/* CTA — embedded "اطلب الآن" */}
                <div className="mt-1.5 bg-slate-900 text-white text-center text-[10px] sm:text-[11px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1">
                  <span>اطلب الآن</span>
                  <ArrowLeft size={11} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Trust strip — bottom */}
        <div className="mt-3 flex items-center gap-3 text-[10px] sm:text-xs text-white/80">
          <div className="flex items-center gap-1">
            <ShieldCheck size={11} />
            <span>الدفع عند الاستلام</span>
          </div>
          <span className="text-white/40">|</span>
          <div className="flex items-center gap-1">
            <BadgeCheck size={11} />
            <span>متاجر موثقة</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Legacy compat: re-export the banner type for any old imports ─────────
export type { MarketplaceBanner } from '../../services/api/client'
