/**
 * CategoriesCircle — AliExpress-style 3D category pills.
 *
 * Each pill renders a transparent 3D micro-render (16×16) that visually
 * represents the category — the same approach AliExpress/Temu use on
 * their mobile web. The 3D assets are sourced from emoji.aranja.com
 * (a free CDN that serves high-quality transparent PNG 3D emoji renders
 * at any size via the ?size= query param).
 *
 * Design:
 *   - Horizontal touch-scrollable strip (scrollbar hidden)
 *   - Pill: rounded-full, soft gray bg, dark slate-900 active state
 *   - 3D icon: w-4 h-4 object-contain, lazy-loaded
 *
 * Clicking a pill triggers onSelect(key) → the parent re-filters the
 * product list without a page reload.
 */

import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface CategoryItem {
  key: string
  labelAr: string
  /** Transparent 3D micro-render URL (PNG, 16-20px display size). */
  icon3d: string
}

// ─── 3D icon source ──────────────────────────────────────────────────────
// emoji.aranja.com hosts every emoji as a transparent PNG, organized by
// vendor set: /emojis/{set}/{code}.png
//
// Available sets: apple (flat), google (semi-3D), facebook (3D with depth),
// twitter (flat outline). We use "facebook" because it's the most 3D-rendered
// set — the icons have real shading + highlights, so they pop at the tiny
// 16×20px display size used inside the pills.
//
// The {code} is the emoji's Unicode codepoint in lowercase hex without the
// U+ prefix (e.g. 📱 = U+1F4F1 → "1f4f1").
const ICON_3D = (code: string) =>
  `https://emoji.aranja.com/emojis/facebook/${code}.png`

// ─── Category → 3D icon mapping ──────────────────────────────────────────
// Maps a category key (from presetDomains or merchant's custom domain) to
// a transparent 3D micro-render. Used by both the marketplace CategoriesCircle
// and the merchant storefront (Shop.tsx, Home.tsx) so every category pill
// across the platform has a consistent 3D icon.
//
// IMPORTANT RULES:
//   1. NO document/file icons (📂 📄 📋) — they read as a file-browser UI.
//   2. NO duplicate icons — every category must have a DISTINCT icon so
//      the user can identify the category from the icon alone.
const CATEGORY_ICON_MAP: Record<string, string> = {
  // ─── Main marketplace categories ──────────────────────────────────────
  all:         ICON_3D('1f6d2'), // shopping cart 🛒 — e-commerce feel
  electronics: ICON_3D('1f4f1'), // mobile phone 📱
  fashion:     ICON_3D('1f455'), // shirt 👕
  beauty:      ICON_3D('1f484'), // lipstick 💄
  jewelry:     ICON_3D('1f48d'), // ring 💍
  watches:     ICON_3D('231a'),  // watch ⌚
  home:        ICON_3D('1f373'), // cooking / frying pan 🍳
  perfume:     ICON_3D('1f33f'), // herb / fragrance 🌿
  sports:      ICON_3D('26bd'),  // soccer ball ⚽
  baby:        ICON_3D('1f476'), // baby 👶
  toys:        ICON_3D('1f9f8'), // teddy bear 🧸 — clearly "toys", NOT a gift
  books:       ICON_3D('1f4da'), // books 📚
  tools:       ICON_3D('1f527'), // wrench 🔧
  art:         ICON_3D('1f3a8'), // palette 🎨
  wholesale:   ICON_3D('1f4e6'), // package box 📦
  // ─── "general" + fallback — target icon (professional, reads as
  //     "everything / all-purpose" without being a file or gift icon). ──
  general:     ICON_3D('1f3af'), // direct hit on target 🎯
  // ─── Sub-categories (from presetDomains — jewelry/fashion/beauty/etc.) ─
  necklace:  ICON_3D('1f48e'), // gem stone 💎
  ring:      ICON_3D('1f48d'), // ring 💍
  earring:   ICON_3D('1f48e'), // gem stone 💎
  bracelet:  ICON_3D('1f48e'), // gem stone 💎
  dress:     ICON_3D('1f457'), // dress 👗
  abaya:     ICON_3D('1f455'), // shirt (clothing) 👕
  hijab:     ICON_3D('1f9e5'), // coat (clothing) 🧥
  bag:       ICON_3D('1f45c'), // handbag 👜
  shoes:     ICON_3D('1f45f'), // running shoe 👟
  makeup:    ICON_3D('1f484'), // lipstick 💄
  skincare:  ICON_3D('1f9f4'), // lotion bottle 🧴
  hair:      ICON_3D('1f487'), // haircut / hair 💇
  // ─── Electronics sub-categories ────────────────────────────────────────
  phone:       ICON_3D('1f4f1'), // mobile phone 📱
  accessory:   ICON_3D('1f50c'), // electric plug 🔌
  headphones:  ICON_3D('1f3a7'), // headphone 🎧
  charger:     ICON_3D('1f50b'), // battery 🔋
  case:        ICON_3D('1f4f1'), // mobile phone (with case) 📱
  cable:       ICON_3D('1f50c'), // electric plug 🔌
  // ─── Home appliances ───────────────────────────────────────────────────
  refrigerator:    ICON_3D('1f9c8'), // butter (cold) — closest
  washer:          ICON_3D('1f9fb'), // roll of paper (laundry)
  oven:            ICON_3D('1f373'), // cooking 🍳
  ac:              ICON_3D('2744'),  // snowflake ❄️
  tv:              ICON_3D('1f4fa'), // television 📺
  small_appliance: ICON_3D('1f373'), // cooking 🍳
  // ─── Digital products ──────────────────────────────────────────────────
  subscription: ICON_3D('1f4fa'), // television 📺
  account:      ICON_3D('1f511'), // key 🔑
  giftcard:     ICON_3D('1f4b3'), // credit card 💳 — clearly a "gift card"
  code:         ICON_3D('1f4bb'), // laptop 💻
}

/** Resolve a 3D icon URL for ANY category key (main or sub-category).
 *  Falls back to the sparkle icon (neutral, not a folder or gift). */
export function getCategoryIcon3d(key: string): string {
  const k = (key || '').toLowerCase().trim()
  return CATEGORY_ICON_MAP[k] || CATEGORY_ICON_MAP['general']
}

export const CATEGORY_CIRCLES: CategoryItem[] = [
  { key: 'all',         labelAr: 'كل الفئات',        icon3d: getCategoryIcon3d('all') },
  { key: 'electronics', labelAr: 'إلكترونيات',       icon3d: getCategoryIcon3d('electronics') },
  { key: 'fashion',     labelAr: 'موضة وأزياء',     icon3d: getCategoryIcon3d('fashion') },
  { key: 'beauty',      labelAr: 'الصحة والجمال',    icon3d: getCategoryIcon3d('beauty') },
  { key: 'jewelry',     labelAr: 'مجوهرات',          icon3d: getCategoryIcon3d('jewelry') },
  { key: 'watches',     labelAr: 'ساعات وإكسسوارات', icon3d: getCategoryIcon3d('watches') },
  { key: 'home',        labelAr: 'المنزل والمطبخ',   icon3d: getCategoryIcon3d('home') },
  { key: 'perfume',     labelAr: 'عطور',             icon3d: getCategoryIcon3d('perfume') },
  { key: 'sports',      labelAr: 'رياضة',            icon3d: getCategoryIcon3d('sports') },
  { key: 'baby',        labelAr: 'أطفال',            icon3d: getCategoryIcon3d('baby') },
  { key: 'toys',        labelAr: 'ألعاب',            icon3d: getCategoryIcon3d('toys') },
  { key: 'books',       labelAr: 'كتب وقرطاسية',     icon3d: getCategoryIcon3d('books') },
  { key: 'tools',       labelAr: 'أدوات',            icon3d: getCategoryIcon3d('tools') },
  { key: 'art',         labelAr: 'فن وحرف',          icon3d: getCategoryIcon3d('art') },
  { key: 'wholesale',   labelAr: 'عروض بالجملة',     icon3d: getCategoryIcon3d('wholesale') },
  { key: 'general',     labelAr: 'أخرى',             icon3d: getCategoryIcon3d('general') },
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
          to scroll. Mobile only — on desktop the arrow buttons signal this. */}
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

      {/* Scrollable row of 3D-icon pills */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-2 md:px-12 py-2 select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {CATEGORY_CIRCLES.map(cat => {
          const isActive = active === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => onSelect(cat.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 flex items-center gap-1.5 transition-all duration-200 active:scale-95 border ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm border-slate-900'
                  : 'bg-[#F2F4F7] text-slate-800 hover:bg-slate-200 font-bold text-xs border-transparent'
              }`}
            >
              <img
                src={cat.icon3d}
                alt=""
                loading="lazy"
                className="w-4 h-4 object-contain shrink-0 pointer-events-none select-none"
                draggable={false}
                onError={(e) => {
                  // If the 3D icon fails to load (network/CDN issue),
                  // hide the broken-img icon so the pill still looks clean.
                  (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                }}
              />
              <span className={`text-xs font-bold whitespace-nowrap ${isActive ? 'text-white' : 'text-slate-800'}`}>
                {cat.labelAr}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
