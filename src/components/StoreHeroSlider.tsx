/**
 * StoreHeroSlider — Cinematic auto-rotating product hero for the
 * merchant storefront.
 *
 * Mirrors the marketplace's BannerCarousel behaviour but is scoped to
 * a single merchant's catalog. Each slide:
 *   - Uses the real product image as a full-bleed background
 *   - Soft cinematic gradient overlay (light — image stays visible)
 *   - Surfaces: product name, current price (DZD) + strikethrough old,
 *     discount badge, store badge, single CTA → product detail page
 *
 * Features:
 *   - Auto-rotation every 5s (pauses on hover / touch)
 *   - Pill indicators (modern, minimal)
 *   - Swipe support on touch devices
 *   - No emojis — only lucide-react icons
 *
 * Falls back to a single static slide (domain hero image + hero text)
 * when the store has no products yet — so the hero never looks broken.
 */

import { useEffect, useState, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, ShieldCheck,
} from 'lucide-react'
import type { Product } from '../services/api/types'
import type { StoreDomain, StoreSettings } from '../services/api/types'
import { formatDZD } from '../lib/utils'
import { SmartImage } from './SmartImage'

interface Props {
  /** Merchant's products (featured ones are preferred for the hero). */
  products: Product[]
  /** The merchant's active domain (for hero text fallback). */
  domain: StoreDomain
  /** The merchant's settings (for store name + free shipping threshold). */
  store: StoreSettings
  /** Query string (?store=slug) to preserve tenant context across links. */
  storeQuery: string
  className?: string
  /** Auto-advance interval in ms (default: 5000). */
  intervalMs?: number
}

const DEFAULT_INTERVAL = 5000

export function StoreHeroSlider({
  products,
  domain,
  store,
  storeQuery,
  className = '',
  intervalMs = DEFAULT_INTERVAL,
}: Props) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)

  // Pick the hero slides: prefer featured products with images,
  // fall back to the first 6 products, then to a single domain-hero slide.
  const slides = useMemo(() => {
    const withImages = products.filter(p => p.images && p.images.length > 0)
    const featured = withImages.filter(p => p.isFeatured)
    const pool = featured.length >= 2 ? featured : withImages
    return pool.slice(0, 6)
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

  // ─── Empty state: no products → single static slide with domain hero ───
  if (slides.length === 0) {
    return (
      <div
        className={`relative rounded-2xl overflow-hidden min-h-[280px] md:min-h-[400px] flex ${className}`}
      >
        {domain.heroImage && (
          <div className="absolute inset-0">
            <SmartImage
              src={domain.heroImage}
              alt={domain.heroTitleAr}
              size="hero"
              eager
              className="w-full h-full object-cover"
            />
          </div>
        )}
        {!domain.heroImage && (
          <div className="absolute inset-0 bg-gradient-to-l from-slate-900 via-slate-800 to-slate-700" />
        )}
        {/* Soft gradient overlay (light — image stays visible) */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-slate-950/60 to-transparent" />

        <div className="relative z-10 p-5 md:p-10 flex flex-col justify-center max-w-[560px]">
          <span className="inline-flex w-fit items-center gap-2 bg-white/10 backdrop-blur border border-white/20 text-white rounded-full px-3 py-1 text-xs tracking-widest">
            {domain.heroBadge}
          </span>
          <h1 className="text-2xl md:text-4xl font-extrabold leading-tight text-white mt-3" style={{ whiteSpace: 'pre-line' }}>
            {domain.heroTitleAr}
          </h1>
          <p className="text-white/80 mt-3 leading-6 text-sm md:text-base line-clamp-2">{domain.heroSubtitleAr}</p>
          {store.enableCod && (
            <div className="inline-flex w-fit items-center gap-1.5 mt-3 bg-emerald-50/90 backdrop-blur text-emerald-700 rounded-full px-2.5 py-1 text-[10px] font-bold">
              <ShieldCheck size={11} />
              <span>الدفع عند الاستلام</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const current = slides[idx]
  const hasDiscount = !!current.compareAtPrice && current.compareAtPrice > current.price
  const discountPct = hasDiscount
    ? Math.round(((current.compareAtPrice! - current.price) / current.compareAtPrice!) * 100)
    : 0

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-slate-900 min-h-[280px] md:min-h-[400px] ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides */}
      <div className="absolute inset-0">
        {slides.map((p, i) => {
          const active = i === idx
          const img = p.images?.[0]
          const isDiscount = !!p.compareAtPrice && p.compareAtPrice > p.price
          return (
            <div
              key={p._id}
              className={`absolute inset-0 transition-opacity duration-700 ${active ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}
              aria-hidden={!active}
            >
              {/* Background product image */}
              {img && (
                <div className="absolute inset-0">
                  <SmartImage
                    src={img}
                    alt={p.nameAr || p.name}
                    size="hero"
                    eager={i === 0}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Soft cinematic gradient overlay (LIGHT — image stays visible) */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
              <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-slate-950/60 to-transparent" />

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-center p-5 md:p-10">
                {/* Top row: discount + store badge */}
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  {isDiscount && (
                    <span className="inline-flex items-center gap-1 bg-emerald-600 text-white rounded-full px-2.5 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold">
                      خصم {Math.round(((p.compareAtPrice! - p.price) / p.compareAtPrice!) * 100)}%
                    </span>
                  )}
                  {store.enableCod && (
                    <span className="inline-flex items-center gap-1 bg-white/10 backdrop-blur border border-white/20 rounded-full px-2.5 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold text-white">
                      <BadgeCheck size={11} className="text-emerald-400" />
                      <span>الدفع عند الاستلام</span>
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
                  <Link
                    to={`/product/${p._id}${storeQuery}`}
                    className="inline-flex items-center gap-1.5 bg-white text-slate-900 px-4 py-2 md:px-5 md:py-2.5 rounded-full text-[11px] md:text-sm font-bold hover:bg-slate-100 transition shadow-sm"
                  >
                    اكتشف المنتج
                    <ArrowLeft size={14} />
                  </Link>
                </div>
              </div>
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
