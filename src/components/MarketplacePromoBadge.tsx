/**
 * MarketplacePromoBadge — AliExpress-style rotating content capsule.
 *
 * A fixed squircle (rounded-square) in the bottom-left corner that
 * rotates through 3 promotional slides automatically, mimicking the
 * AliExpress floating badge that cycles between text + image content.
 *
 * Slides (each shows for 3 seconds, then cross-fades to the next):
 *   1. Text: "أفضل العروض" (Best Offers) — red bg, white text, 2 lines
 *   2. Text: "تسوق الآن" (Shop Now) — red bg, white text
 *   3. Product image thumbnail — red bg, white card with product photo
 *
 * Design (matches AliExpress 1:1):
 *   - Square with rounded corners (squircle) — w-16 h-16
 *   - Vibrant red background (#FF4D4F / red-500)
 *   - White text, centered, bold
 *   - Small grey X dismiss button below the squircle
 *   - Smooth cross-fade transitions between slides (opacity)
 *   - Pops in on mount (scale + fade)
 *
 * Click → /marketplace
 */

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'

// ─── Slide definitions ────────────────────────────────────────────────────
// Each slide is either a text slide or an image slide. The capsule
// rotates through them automatically.

type Slide =
  | { type: 'text'; line1: string; line2?: string }
  | { type: 'image'; src: string; label: string }

const SLIDES: Slide[] = [
  { type: 'text', line1: 'أفضل', line2: 'العروض' },
  { type: 'text', line1: 'تسوق', line2: 'الآن' },
  { type: 'text', line1: 'متاجر', line2: 'موثقة' },
  { type: 'image', src: '/marketplace-promo.webp', label: 'عروض الماركت بلايس' },
]

const SLIDE_DURATION = 2000 // 2 seconds per slide (faster, more dynamic)

export function MarketplacePromoBadge() {
  const [slideIdx, setSlideIdx] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-rotate slides
  useEffect(() => {
    if (dismissed) return

    const cycle = () => {
      setSlideIdx(prev => (prev + 1) % SLIDES.length)
      timerRef.current = setTimeout(cycle, SLIDE_DURATION)
    }
    timerRef.current = setTimeout(cycle, SLIDE_DURATION)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [dismissed])

  // Manual dismiss (X button) — hides the badge for the current session.
  // We use sessionStorage (not localStorage) so it reappears on the next
  // visit/page-load, keeping the promotion visible across sessions but
  // not annoying within a single browsing session.
  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try { sessionStorage.setItem('amugar_promo_dismissed', '1') } catch {}
    setDismissed(true)
  }

  // Check sessionStorage on mount
  useEffect(() => {
    try {
      if (sessionStorage.getItem('amugar_promo_dismissed') === '1') {
        setDismissed(true)
      }
    } catch {}
  }, [])

  if (dismissed) return null

  const currentSlide = SLIDES[slideIdx]

  return (
    <div className="fixed bottom-40 left-4 z-40 flex flex-col items-center">
      {/* ─── Squircle capsule (clickable → /marketplace) ─── */}
      <Link
        to="/marketplace"
        className="relative w-16 h-16 rounded-2xl bg-red-500 shadow-xl overflow-hidden grid place-items-center active:scale-95 transition-transform"
        aria-label="تصفح Amugar Marketplace"
      >
        {/* Slides layer (absolute, cross-fade) */}
        {SLIDES.map((slide, i) => {
          const isActive = i === slideIdx
          return (
            <div
              key={i}
              className={`absolute inset-0 grid place-items-center transition-opacity duration-500 ${
                isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {slide.type === 'text' ? (
                <div className="text-center px-1">
                  <div className="text-white font-black text-sm leading-tight">
                    {slide.line1}
                  </div>
                  {slide.line2 && (
                    <div className="text-white font-black text-sm leading-tight">
                      {slide.line2}
                    </div>
                  )}
                </div>
              ) : (
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  <img
                    src={slide.src}
                    alt={slide.label}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Subtle pulse glow to draw attention (like AliExpress) */}
        <div className="absolute inset-0 rounded-2xl ring-2 ring-red-400/50 animate-pulse pointer-events-none" />
      </Link>

      {/* ─── Dismiss X button (below the squircle, like AliExpress) ─── */}
      <button
        onClick={dismiss}
        className="mt-1 w-5 h-5 rounded-full bg-white/80 backdrop-blur grid place-items-center shadow-sm hover:bg-white transition"
        aria-label="إخفاء"
      >
        <X size={11} className="text-slate-600" />
      </button>
    </div>
  )
}
