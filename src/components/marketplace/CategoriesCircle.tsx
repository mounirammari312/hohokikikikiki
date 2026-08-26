/**
 * CategoriesCircle — Minimalist monochrome category selector.
 *
 * Refactored from a colorful circular-icon row into a clean, capsule-
 * shaped pill grid that matches the neutral Slate + white palette of
 * the new marketplace.
 *
 * Design rules:
 *   - No colorful gradients. Background is white, border is slate-200.
 *   - Icons use a unified dark gray (slate-700) for consistency.
 *   - Active state: bg-slate-900 + text-white + border-slate-900 + shadow-sm.
 *   - Hover: border darkens to slate-400 (subtle).
 *
 * Clicking a category triggers the parent's onSelect callback.
 */

import { useRef } from 'react'
import {
  Smartphone, Shirt, Heart, Crown, Watch, Home as HomeIcon, Droplet,
  Book, Gamepad2, Dumbbell, Baby, Wrench, Palette, Gift, Package, ShoppingBag,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

export interface CategoryItem {
  key: string
  labelAr: string
  icon: any
}

export const CATEGORY_CIRCLES: CategoryItem[] = [
  { key: 'all',         labelAr: 'الكل',          icon: ShoppingBag },
  { key: 'electronics', labelAr: 'إلكترونيات',    icon: Smartphone },
  { key: 'fashion',     labelAr: 'موضة',          icon: Shirt },
  { key: 'beauty',      labelAr: 'جمال',          icon: Heart },
  { key: 'jewelry',     labelAr: 'مجوهرات',       icon: Crown },
  { key: 'watches',     labelAr: 'ساعات',         icon: Watch },
  { key: 'home',        labelAr: 'منزل',          icon: HomeIcon },
  { key: 'perfume',     labelAr: 'عطور',          icon: Droplet },
  { key: 'books',       labelAr: 'كتب',           icon: Book },
  { key: 'toys',        labelAr: 'ألعاب',         icon: Gamepad2 },
  { key: 'sports',      labelAr: 'رياضة',         icon: Dumbbell },
  { key: 'baby',        labelAr: 'أطفال',         icon: Baby },
  { key: 'tools',       labelAr: 'أدوات',         icon: Wrench },
  { key: 'art',         labelAr: 'فن',            icon: Palette },
  { key: 'gifts',       labelAr: 'هدايا',         icon: Gift },
  { key: 'general',     labelAr: 'أخرى',          icon: Package },
]

interface Props {
  active: string
  onSelect: (key: string) => void
  className?: string
}

export function CategoriesCircle({ active, onSelect, className = '' }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: dir === 'left' ? 240 : -240, behavior: 'smooth' })
  }

  return (
    <div className={`relative ${className}`}>
      {/* Fade masks — subtle gradient hints that there are more pills
          to scroll. Left edge fades from white → transparent (RTL:
          content scrolls in from the left), right edge mirrors it.
          Mobile only — on desktop the arrow buttons already signal this. */}
      <div className="md:hidden absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      <div className="md:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

      {/* Right arrow (desktop) */}
      <button
        onClick={() => scroll('right')}
        className="hidden md:grid absolute right-0 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white shadow-sm border border-slate-200 place-items-center hover:bg-slate-50 hover:border-slate-300 transition"
        aria-label="السابق"
      >
        <ChevronRight size={16} className="text-slate-700" />
      </button>
      {/* Left arrow (desktop) */}
      <button
        onClick={() => scroll('left')}
        className="hidden md:grid absolute left-0 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white shadow-sm border border-slate-200 place-items-center hover:bg-slate-50 hover:border-slate-300 transition"
        aria-label="التالي"
      >
        <ChevronLeft size={16} className="text-slate-700" />
      </button>

      {/* Scrollable row of capsule pills */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto scrollbar-hide px-2 md:px-12 py-3"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {CATEGORY_CIRCLES.map(cat => {
          const Icon = cat.icon
          const isActive = active === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => onSelect(cat.key)}
              className={`group shrink-0 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 sm:px-4 sm:py-2.5 transition-all duration-200 ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200/80 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <Icon
                size={15}
                className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-700 group-hover:text-slate-900'}`}
              />
              <span className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${isActive ? 'text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>
                {cat.labelAr}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
