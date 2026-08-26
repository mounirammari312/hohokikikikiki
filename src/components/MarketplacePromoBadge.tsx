/**
 * MarketplacePromoBadge — AliExpress-style animated GIF capsule.
 *
 * Uses the real AliExpress promotional GIF (200×200, animated) as the
 * capsule content. The GIF is live + animated — no manual slide rotation
 * needed. We just wrap it in a rounded squircle + add a white bottom bar
 * with an X dismiss button (exactly like the AliExpress original).
 *
 * Layout (matches AliExpress 1:1):
 *   ┌──────────────────┐
 *   │                  │
 *   │   Animated GIF   │  ← rounded-2xl, overflow-hidden
 *   │   (200×200)      │
 *   │                  │
 *   ├──────────────────┤
 *   │     [X]          │  ← white bar at the bottom with dismiss button
 *   └──────────────────┘
 *
 * Position: bottom-left, above the WhatsApp floating button.
 * Click on the GIF → /marketplace
 * Click on X → dismiss for the current session (sessionStorage).
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'

export function MarketplacePromoBadge() {
  const [dismissed, setDismissed] = useState(false)

  // Check sessionStorage on mount — dismissed badges stay hidden for the
  // current browsing session but reappear on the next visit.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('amugar_promo_dismissed') === '1') {
        setDismissed(true)
      }
    } catch {}
  }, [])

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try { sessionStorage.setItem('amugar_promo_dismissed', '1') } catch {}
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="fixed bottom-40 md:bottom-40 left-4 z-50 flex flex-col items-center">
      {/* ─── Capsule container (GIF + white bar with X) ─── */}
      <div className="relative w-16 h-20 rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col">
        {/* Animated GIF — fills the top portion, clickable → /marketplace */}
        <Link
          to="/marketplace"
          className="flex-1 block relative overflow-hidden active:scale-95 transition-transform"
          aria-label="تصفح Amugar Marketplace"
        >
          <img
            src="/aliexpress-promo.gif"
            alt="عروض الماركت بلايس"
            className="w-full h-full object-cover"
            draggable={false}
          />
        </Link>

        {/* White bottom bar with X dismiss button (like AliExpress) */}
        <div className="shrink-0 h-5 bg-white border-t border-slate-100 grid place-items-center">
          <button
            onClick={dismiss}
            className="w-4 h-4 rounded-full bg-slate-100 hover:bg-slate-200 grid place-items-center transition"
            aria-label="إخفاء"
          >
            <X size={9} className="text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
