/**
 * BannerCarousel — Cinematic Dynamic Hero slider.
 *
 * Restored to the cinematic single-product hero (replacing the red
 * "Super Deals" countdown box that was briefly tried). Each slide
 * uses the real product image as a full-bleed background with a soft
 * cinematic gradient overlay, and surfaces:
 *   - Product name
 *   - Current price (DZD) + strikethrough original price
 *   - Store name with verified badge
 *   - Single elegant CTA that routes to the product detail page
 *
 * Features:
 *   - Auto-rotation every 5s (pauses on hover / touch)
 *   - Pill indicators (modern, minimal)
 *   - Swipe support on touch devices
 *   - No emojis — only lucide-react icons
 *   - Strict monochrome palette (slate-950 base, white text, emerald COD accent)
 */

import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, ShieldCheck, ArrowLeft, BadgeCheck,
} from 'lucide-react'
import type { MarketplaceProduct } from '../../services/api/client'
import type { TenantStore } from '../../services/api/types'
import { formatDZD } from '../../lib/utils'
import { SmartImage } from '../SmartImage'

interface Props {
  /**
   * Featured / trending products to rotate through. If empty or omitted,
   * the component renders a neutral placeholder (no broken layout).
   */
  products?: MarketplaceProduct[]
  /**
   * The list of stores (used to resolve each product's store name + slug
   * for the verified badge + CTA routing).
   */
  stores?: TenantStore[]
  /** Optional auto-advance interval in ms (default: 5000). */
  intervalMs?: number
  className?: string
}

const DEFAULT_INTERVAL = 5000

export function BannerCarousel({
  products = [],
  stores = [],
  intervalMs = DEFAULT_INTERVAL,
  className = '',
}: Props) {
  const navigate = useNavigate()
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)

  // Pre-compute the slide list: take the first 6 products. We do NOT
  // filter out products without images — instead, each slide handles a
  // missing image gracefully with a neutral slate background + the
  // product name still shown. This prevents the "coming soon" empty
  // state from appearing when the store has products but the images
  // array happens to be empty (e.g. during upload / network delay).
  const slides = useMemo(() => {
    return products.slice(0, 6)
  }, [products])

  // Reset index if the slide list shrinks below the current index
  useEffect(() => {
    if (idx >= slides.length) setIdx(0)
  }, [slides.length, idx])

  // Auto-rotation
  useEffect(() => {
    if (paused || slides.length <= 1) return
    const id = setInterval(() => {
      setIdx(i => (i + 1) % slides.length)
    }, intervalMs)
    return () => clearInterval(id)
  }, [paused, slides.length, intervalMs])

  const go = (i: number) => {
    if (slides.length === 0) return
    setIdx(((i % slides.length) + slides.length) % slides.length)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) go(idx + (dx > 0 ? -1 : 1))
    touchStartX.current = null
  }

  // Resolve the store for a given product (used for verified badge + CTA)
  const resolveStore = (p: MarketplaceProduct) => {
    return stores.find(s => s._id === p.storeId)
  }

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

  // ─── Empty state (no products yet) ───────────────────────────────────
  // Shown only when the marketplace truly has zero products. The copy
  // is brand-neutral (no "coming soon" — that reads as broken/empty).
  // Instead we surface the platform's value proposition so the hero
  // still looks intentional even before products exist.
  if (slides.length === 0) {
    return (
      <div
        className={`relative rounded-2xl overflow-hidden bg-slate-900 ${className}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="relative h-[200px] sm:h-[280px] md:h-[380px] flex items-center">
          <div className="absolute inset-0 bg-gradient-to-l from-slate-950 via-slate-900 to-slate-800" />
          <div className="relative px-6 sm:px-10 md:px-14 text-right">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1 text-[10px] sm:text-xs font-bold text-white/80 mb-3">
              <ShieldCheck size={12} className="text-emerald-400" />
              <span>متاجر جزائرية موثّقة</span>
            </div>
            <h2 className="text-white text-lg sm:text-2xl md:text-4xl font-extrabold tracking-tight leading-tight">
              تسوّق من أفضل المتاجر الجزائرية
            </h2>
            <p className="text-white/70 text-[11px] sm:text-sm md:text-base mt-2 max-w-md leading-5 md:leading-6">
              الدفع عند الاستلام، توصيل لكل الولايات، ومنتجات أصلية معتمدة
            </p>
          </div>
        </div>
      </div>
    )
  }

  const current = slides[idx]
  const currentStore = resolveStore(current)
  const hasDiscount = !!current.compareAtPrice && current.compareAtPrice > current.price
  const discountPct = hasDiscount
    ? Math.round(((current.compareAtPrice! - current.price) / current.compareAtPrice!) * 100)
    : 0

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-slate-900 ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides */}
      <div className="relative h-[200px] sm:h-[280px] md:h-[380px]">
        {slides.map((p, i) => {
          const active = i === idx
          const store = resolveStore(p)
          const img = Array.isArray(p.images) ? p.images[0] : p.images
          const isDiscount = !!p.compareAtPrice && p.compareAtPrice > p.price
          return (
            <div
              key={p._id}
              className={`absolute inset-0 transition-opacity duration-700 ${active ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}
              aria-hidden={!active}
            >
              {/* Background image — only render if a real image URL exists.
                  When the product has no image, we skip the <SmartImage>
                  and the slate-900 base bg shows through (clean, no broken img). */}
              {img && (
                <div className="absolute inset-0">
                  <SmartImage
                    src={img}
                    alt={p.nameAr || p.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Soft cinematic gradient overlay (RTL → from right).
                  Lightened significantly so the product image stays visible
                  across the full width. Only the right ~45% gets a readable
                  scrim for the text; the left half stays bright. */}
              <div className="absolute inset-0 bg-gradient-to-l from-slate-950/85 via-slate-950/40 to-transparent" />
              {/* Subtle bottom-up scrim so the pill indicators + CTA stay legible
                  without darkening the whole image. */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent" />

              {/* Content */}
              <button
                type="button"
                onClick={() => goToProduct(p)}
                className="relative h-full w-full flex flex-col justify-center p-4 sm:p-6 md:p-10 text-right"
                aria-label={`عرض ${p.nameAr || p.name}`}
              >
                {/* Top row: discount pill + store badge */}
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  {isDiscount && (
                    <span className="inline-flex items-center gap-1 bg-emerald-600 text-white rounded-full px-2.5 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold">
                      خصم {Math.round(((p.compareAtPrice! - p.price) / p.compareAtPrice!) * 100)}%
                    </span>
                  )}
                  {store && (
                    <span className="inline-flex items-center gap-1 bg-white/10 backdrop-blur border border-white/20 rounded-full px-2.5 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold text-white">
                      <BadgeCheck size={11} className="text-emerald-400" />
                      <span className="truncate max-w-[120px] md:max-w-none">
                        {store.nameAr || store.name}
                      </span>
                    </span>
                  )}
                </div>

                {/* Product name */}
                <h2 className="text-white text-base sm:text-xl md:text-3xl font-extrabold leading-tight line-clamp-2 max-w-md md:max-w-xl">
                  {p.nameAr || p.name}
                </h2>

                {/* Price row */}
                <div className="flex items-baseline gap-2 mt-2 md:mt-3">
                  <span className="text-white text-lg sm:text-2xl md:text-4xl font-extrabold tracking-tight tabular-nums">
                    {formatDZD(p.price)}
                  </span>
                  {isDiscount && (
                    <span className="text-white/50 text-xs sm:text-sm md:text-base line-through tabular-nums">
                      {formatDZD(p.compareAtPrice!)}
                    </span>
                  )}
                </div>

                {/* CTA */}
                <div className="mt-3 md:mt-5">
                  <span className="inline-flex items-center gap-1.5 bg-white text-slate-900 px-4 py-2 md:px-5 md:py-2.5 rounded-full text-[11px] md:text-sm font-bold hover:bg-slate-100 transition shadow-sm">
                    اكتشف المنتج
                    <ArrowLeft size={14} />
                  </span>
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {/* Arrows (desktop only) */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => go(idx - 1)}
            className="hidden md:grid absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 backdrop-blur hover:bg-white/20 text-white place-items-center transition border border-white/15"
            aria-label="السابق"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => go(idx + 1)}
            className="hidden md:grid absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 backdrop-blur hover:bg-white/20 text-white place-items-center transition border border-white/15"
            aria-label="التالي"
          >
            <ChevronLeft size={18} />
          </button>
        </>
      )}

      {/* Pill indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
              aria-label={`شريحة ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Legacy compat: re-export the banner type for any old imports ─────────
export type { MarketplaceBanner } from '../../services/api/client'
