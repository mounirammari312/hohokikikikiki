/**
 * BannerCarousel — Auto-rotating promotional banner carousel.
 *
 * Phase 2: now pulls banners from /api/marketplace/banners (managed by
 * super_admin via /api/super-admin/banners). If the API returns banners,
 * we render those. Otherwise, we fall back to 5 hardcoded defaults.
 *
 * Features:
 *   - Auto-rotation every 5 seconds
 *   - Dots indicator
 *   - Prev/next arrows (desktop)
 *   - Pause on hover
 *   - Swipe support on mobile
 */

import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Truck, Gift, Sparkles, ShieldCheck, Crown,
  Package, Star, Zap, Heart, Smartphone, Watch,
} from 'lucide-react'
import { fetchBanners, type MarketplaceBanner } from '../../services/api/client'

// Map of icon names → Lucide components (only a curated subset is allowed
// for security reasons — we don't want to allow arbitrary component names
// from the database)
const ICON_MAP: Record<string, any> = {
  Truck, Gift, Sparkles, ShieldCheck, Crown, Package, Star, Zap, Heart, Smartphone, Watch,
}

// Default fallback banners (used if the API returns nothing or fails)
const DEFAULT_BANNERS = [
  {
    _id: 'default_free_delivery',
    order: 1,
    badge: 'توصيل مجاني',
    badgeAr: 'توصيل مجاني',
    icon: 'Truck',
    title: 'توصيل مجاني لكل الولايات',
    titleAr: 'توصيل مجاني لكل الولايات',
    highlight: '58 ولاية',
    highlightAr: '58 ولاية',
    subtitle: 'عند الطلب بأكثر من 5000 دج — توصيل سريع وآمن إلى باب منزلك',
    subtitleAr: 'عند الطلب بأكثر من 5000 دج — توصيل سريع وآمن إلى باب منزلك',
    cta: 'تسوّق الآن',
    ctaAr: 'تسوّق الآن',
    href: '/marketplace',
    gradient: 'from-[#0F766E] via-[#115E59] to-[#0F4F4A]',
    blob1: 'bg-emerald-400/30',
    blob2: 'bg-teal-300/20',
    isActive: true,
  },
  {
    _id: 'default_cod',
    order: 2,
    badge: 'دفع عند الاستلام',
    badgeAr: 'دفع عند الاستلام',
    icon: 'ShieldCheck',
    title: 'ادفع عند الاستلام',
    titleAr: 'ادفع عند الاستلام',
    highlight: 'بكل ثقة',
    highlightAr: 'بكل ثقة',
    subtitle: 'لا تدفع شيء قبل أن يصلك المنتج وتراه بعينيك — الثقة أولاً',
    subtitleAr: 'لا تدفع شيء قبل أن يصلك المنتج وتراه بعينيك — الثقة أولاً',
    cta: 'تصفّح المنتجات',
    ctaAr: 'تصفّح المنتجات',
    href: '/marketplace',
    gradient: 'from-[#1A1A1E] via-[#2D2D35] to-[#1A1A1E]',
    blob1: 'bg-[#C9A96A]/30',
    blob2: 'bg-[#A02A5B]/20',
    isActive: true,
  },
  {
    _id: 'default_new_user',
    order: 3,
    badge: 'هدية جديدة',
    badgeAr: 'هدية جديدة',
    icon: 'Gift',
    title: 'هدية المستخدم الجديد',
    titleAr: 'هدية المستخدم الجديد',
    highlight: '500 دج خصم',
    highlightAr: '500 دج خصم',
    subtitle: 'سجّل متجرك مجاناً واحصل على كوبون خصم 500 دج على أول طلب',
    subtitleAr: 'سجّل متجرك مجاناً واحصل على كوبون خصم 500 دج على أول طلب',
    cta: 'احصل على هديتك',
    ctaAr: 'احصل على هديتك',
    href: '/',
    gradient: 'from-[#A02A5B] via-[#7A1F44] to-[#5E1834]',
    blob1: 'bg-pink-300/30',
    blob2: 'bg-rose-300/20',
    isActive: true,
  },
  {
    _id: 'default_flash',
    order: 4,
    badge: 'عروض اليوم',
    badgeAr: 'عروض اليوم',
    icon: 'Sparkles',
    title: 'خصومات تصل إلى 70%',
    titleAr: 'خصومات تصل إلى 70%',
    highlight: 'لفترة محدودة',
    highlightAr: 'لفترة محدودة',
    subtitle: 'عروض حصرية تنتهي خلال ساعات — لا تفوّت الفرصة',
    subtitleAr: 'عروض حصرية تنتهي خلال ساعات — لا تفوّت الفرصة',
    cta: 'شاهد العروض',
    ctaAr: 'شاهد العروض',
    href: '/marketplace',
    gradient: 'from-[#B45309] via-[#92400E] to-[#78350F]',
    blob1: 'bg-amber-300/30',
    blob2: 'bg-orange-300/20',
    isActive: true,
  },
  {
    _id: 'default_verified_stores',
    order: 5,
    badge: 'متاجر موثّقة',
    badgeAr: 'متاجر موثّقة',
    icon: 'Crown',
    title: 'تسوّق من متاجر موثّقة',
    titleAr: 'تسوّق من متاجر موثّقة',
    highlight: '100% ضمان',
    highlightAr: '100% ضمان',
    subtitle: 'كل المتاجر في أموگار موثّقة ومعتمدة — جودة مضمونة',
    subtitleAr: 'كل المتاجر في أموگار موثّقة ومعتمدة — جودة مضمونة',
    cta: 'تصفّح المتاجر',
    ctaAr: 'تصفّح المتاجر',
    href: '/marketplace',
    gradient: 'from-[#1E3A8A] via-[#1E40AF] to-[#1E3A8A]',
    blob1: 'bg-blue-400/30',
    blob2: 'bg-indigo-300/20',
    isActive: true,
  },
]

type Banner = MarketplaceBanner | typeof DEFAULT_BANNERS[0]

export function BannerCarousel({ className = '' }: { className?: string }) {
  const [banners, setBanners] = useState<Banner[]>(DEFAULT_BANNERS as Banner[])
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)

  // Pull banners from the API on mount
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { banners: remote } = await fetchBanners()
      if (cancelled) return
      if (remote && remote.length > 0) {
        setBanners(remote as Banner[])
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setIdx(i => (i + 1) % banners.length)
    }, 5000)
    return () => clearInterval(id)
  }, [paused, banners.length])

  const go = (i: number) => setIdx(((i % banners.length) + banners.length) % banners.length)

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) go(idx + (dx > 0 ? -1 : 1))
    touchStartX.current = null
  }

  return (
    <div
      className={`relative rounded-3xl overflow-hidden ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides */}
      <div className="relative h-[160px] sm:h-[200px] md:h-[280px]">
        {banners.map((b, i) => {
          const Icon = ICON_MAP[b.icon] || Sparkles
          const active = i === idx
          return (
            <div
              key={b._id}
              className={`absolute inset-0 transition-opacity duration-700 ${active ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-l ${b.gradient}`} />
              <div className={`absolute -top-20 -right-20 w-60 h-60 md:w-72 md:h-72 ${b.blob1} rounded-full blur-3xl`} />
              <div className={`absolute -bottom-20 -left-20 w-60 h-60 md:w-72 md:h-72 ${b.blob2} rounded-full blur-3xl`} />
              <Link to={b.href} className="relative h-full flex flex-col justify-center p-4 sm:p-6 md:p-10 text-white">
                <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur border border-white/20 rounded-full px-2.5 py-0.5 md:px-3 md:py-1 text-[9px] md:text-xs font-bold mb-2 md:mb-3 w-fit">
                  <Icon size={10} className="md:hidden" />
                  <Icon size={12} className="hidden md:block" />
                  <span className="truncate max-w-[100px] md:max-w-none">{b.badgeAr || b.badge}</span>
                </div>
                <h2 className="text-base sm:text-xl md:text-3xl font-extrabold leading-tight">
                  {b.titleAr || b.title}
                  <span className="block text-white mt-0.5 md:mt-1 text-sm sm:text-base md:text-2xl">{b.highlightAr || b.highlight}</span>
                </h2>
                <p className="text-white/80 text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-2 max-w-xs md:max-w-md leading-5 md:leading-6 line-clamp-2">{b.subtitleAr || b.subtitle}</p>
                <div className="mt-2 md:mt-4">
                  <span className="inline-flex items-center gap-1 bg-white text-[#1A1A1E] px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs font-bold hover:scale-105 transition-transform">
                    {b.ctaAr || b.cta}
                    <ChevronLeft size={12} className="md:hidden" />
                    <ChevronLeft size={14} className="hidden md:block" />
                  </span>
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      {/* Arrows (desktop only) */}
      <button
        onClick={() => go(idx - 1)}
        className="hidden md:grid absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 text-white place-items-center transition"
        aria-label="السابق"
      >
        <ChevronRight size={18} />
      </button>
      <button
        onClick={() => go(idx + 1)}
        className="hidden md:grid absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 text-white place-items-center transition"
        aria-label="التالي"
      >
        <ChevronLeft size={18} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
        {banners.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
            aria-label={`شريحة ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
