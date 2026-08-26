/**
 * MarketplacePromoBadge — Floating "Verified on Amugar" badge.
 *
 * A small, dismissible pill fixed to the bottom-left corner (RTL → the
 * less-visible corner) of every merchant storefront page. It builds
 * trust with the visitor ("this store is verified on Amugar") and
 * drives traffic from individual stores → the public marketplace.
 *
 * Design rules:
 *   - Slim, elegant, non-intrusive (slate-900 bg, white text, emerald check)
 *   - Dismissible for 7 days (localStorage) so repeat visitors aren't annoyed
 *   - Only shows on tenant storefront pages (not on the marketplace itself
 *     or the platform landing — those are already Amugar properties)
 *   - Click → /marketplace
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, X } from 'lucide-react'

const DISMISS_KEY = 'amugar_promo_badge_dismissed_until'

export function MarketplacePromoBadge() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const until = Number(localStorage.getItem(DISMISS_KEY) || '0')
    return until > Date.now()
  })

  // Re-check dismissal on mount (covers SSR-safe scenarios)
  useEffect(() => {
    const until = Number(localStorage.getItem(DISMISS_KEY) || '0')
    if (until > Date.now() !== dismissed) {
      setDismissed(until > Date.now())
    }
  }, [])

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const until = Date.now() + 7 * 24 * 3600 * 1000 // 7 days
    try { localStorage.setItem(DISMISS_KEY, String(until)) } catch {}
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <Link
      to="/marketplace"
      className="fixed bottom-4 left-4 z-40 group flex items-center gap-2 bg-slate-900 text-white rounded-full pl-2 pr-3 py-1.5 shadow-lg border border-white/10 hover:bg-slate-800 transition-all active:scale-95"
      aria-label="تصفح Amugar Marketplace"
    >
      {/* Logo */}
      <img
        src="/logo.webp"
        alt=""
        className="w-5 h-5 object-contain shrink-0 pointer-events-none"
        draggable={false}
      />
      {/* Text */}
      <span className="text-[10px] font-bold whitespace-nowrap hidden sm:inline">
        موثق في Amugar
      </span>
      <BadgeCheck size={14} className="text-emerald-400 shrink-0" />
      {/* Dismiss button */}
      <button
        onClick={dismiss}
        className="w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition shrink-0"
        aria-label="إخفاء"
      >
        <X size={9} />
      </button>
    </Link>
  )
}
