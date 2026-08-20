/**
 * CategoriesCircle — Horizontal scrolling circular category icons.
 *
 * Temu/AliExpress style: a row of circular icon buttons that scroll
 * horizontally. Each icon has a colored gradient background.
 *
 * Clicking a category triggers the parent's onCategory callback.
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
  gradient: string
}

export const CATEGORY_CIRCLES: CategoryItem[] = [
  { key: 'all',         labelAr: 'الكل',          icon: ShoppingBag, gradient: 'from-[#1A1A1E] to-[#3D3D45]' },
  { key: 'electronics', labelAr: 'إلكترونيات',    icon: Smartphone,  gradient: 'from-[#3B82F6] to-[#1E40AF]' },
  { key: 'fashion',     labelAr: 'موضة',          icon: Shirt,       gradient: 'from-[#EC4899] to-[#BE185D]' },
  { key: 'beauty',      labelAr: 'جمال',          icon: Heart,       gradient: 'from-[#F43F5E] to-[#9F1239]' },
  { key: 'jewelry',     labelAr: 'مجوهرات',       icon: Crown,       gradient: 'from-[#C9A96A] to-[#92653A]' },
  { key: 'watches',     labelAr: 'ساعات',         icon: Watch,       gradient: 'from-[#0EA5E9] to-[#0369A1]' },
  { key: 'home',        labelAr: 'منزل',          icon: HomeIcon,    gradient: 'from-[#10B981] to-[#047857]' },
  { key: 'perfume',     labelAr: 'عطور',          icon: Droplet,     gradient: 'from-[#8B5CF6] to-[#5B21B6]' },
  { key: 'books',       labelAr: 'كتب',          icon: Book,         gradient: 'from-[#F59E0B] to-[#B45309]' },
  { key: 'toys',        labelAr: 'ألعاب',         icon: Gamepad2,    gradient: 'from-[#06B6D4] to-[#0E7490]' },
  { key: 'sports',      labelAr: 'رياضة',         icon: Dumbbell,    gradient: 'from-[#EF4444] to-[#B91C1C]' },
  { key: 'baby',        labelAr: 'أطفال',         icon: Baby,        gradient: 'from-[#F472B6] to-[#BE185D]' },
  { key: 'tools',       labelAr: 'أدوات',         icon: Wrench,      gradient: 'from-[#64748B] to-[#334155]' },
  { key: 'art',         labelAr: 'فن',            icon: Palette,     gradient: 'from-[#A855F7] to-[#7E22CE]' },
  { key: 'gifts',       labelAr: 'هدايا',         icon: Gift,        gradient: 'from-[#14B8A6] to-[#0F766E]' },
  { key: 'general',     labelAr: 'أخرى',          icon: Package,     gradient: 'from-[#9CA3AF] to-[#4B5563]' },
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
    scrollRef.current.scrollBy({ left: dir === 'left' ? 200 : -200, behavior: 'smooth' })
  }

  return (
    <div className={`relative ${className}`}>
      {/* Right arrow (desktop) */}
      <button
        onClick={() => scroll('right')}
        className="hidden md:grid absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-[#E5E7EB] place-items-center hover:bg-[#F3F4F6] transition"
        aria-label="السابق"
      >
        <ChevronRight size={16} />
      </button>
      {/* Left arrow (desktop) */}
      <button
        onClick={() => scroll('left')}
        className="hidden md:grid absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-[#E5E7EB] place-items-center hover:bg-[#F3F4F6] transition"
        aria-label="التالي"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        className="flex items-center gap-3 overflow-x-auto scrollbar-hide px-2 md:px-10 py-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {CATEGORY_CIRCLES.map(cat => {
          const Icon = cat.icon
          const isActive = active === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => onSelect(cat.key)}
              className="flex flex-col items-center gap-1.5 shrink-0 group"
            >
              <div
                className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${cat.gradient} grid place-items-center transition-all group-hover:scale-110 group-hover:shadow-lg ${isActive ? 'ring-2 ring-offset-2 ring-[#C9A96A] scale-105' : ''}`}
              >
                <Icon size={22} className={isActive ? 'text-white' : 'text-white/90'} />
              </div>
              <span className={`text-[10px] md:text-xs font-medium ${isActive ? 'text-[#1A1A1E] font-bold' : 'text-[#4B5563]'}`}>
                {cat.labelAr}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
