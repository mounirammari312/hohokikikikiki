/**
 * AppDownloadBanner — "Download our app" banner with QR code.
 *
 * Shown at the bottom of the marketplace page (above footer).
 * Includes a fake QR code (CSS grid) and "scan to download" text.
 *
 * Also dismissible — once dismissed, hides for 30 days (localStorage).
 */

import { useState } from 'react'
import { X, Smartphone, Star } from 'lucide-react'

const DISMISS_KEY = 'amugar_app_banner_dismissed_until'

export function AppDownloadBanner({ className = '' }: { className?: string }) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const until = Number(localStorage.getItem(DISMISS_KEY) || '0')
    return until > Date.now()
  })

  if (dismissed) return null

  const dismiss = () => {
    const until = Date.now() + 30 * 24 * 3600 * 1000 // 30 days
    localStorage.setItem(DISMISS_KEY, String(until))
    setDismissed(true)
  }

  return (
    <div className={`relative bg-gradient-to-l from-[#1A1A1E] via-[#2D2D35] to-[#1A1A1E] rounded-3xl overflow-hidden ${className}`}>
      {/* Decorative blurs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-[#C9A96A]/15 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-[#A02A5B]/15 rounded-full blur-3xl" />

      <button
        onClick={dismiss}
        className="absolute top-3 left-3 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur grid place-items-center text-white z-10"
        aria-label="إغلاق"
      >
        <X size={14} />
      </button>

      <div className="relative p-5 md:p-8 flex items-center gap-5 md:gap-8">
        {/* QR Code (CSS art) */}
        <div className="hidden md:block shrink-0">
          <div className="w-24 h-24 bg-white rounded-xl p-2 shadow-lg">
            <div className="w-full h-full grid grid-cols-8 grid-rows-8 gap-[1px]">
              {/* Pseudo-QR pattern (deterministic, fake) */}
              {Array.from({ length: 64 }).map((_, i) => {
                // Corner squares (positioning markers)
                const r = Math.floor(i / 8), c = i % 8
                const isTopLeft = r < 2 && c < 2
                const isTopRight = r < 2 && c > 5
                const isBottomLeft = r > 5 && c < 2
                const corner = isTopLeft || isTopRight || isBottomLeft
                // Pseudo-random pattern
                const seed = (r * 31 + c * 17) % 3
                const filled = corner || seed === 0
                return <div key={i} className={filled ? 'bg-[#1A1A1E]' : 'bg-white'} />
              })}
            </div>
          </div>
          <div className="text-center mt-1.5 text-[9px] text-white/60 font-medium">امسح للتحميل</div>
        </div>

        {/* Text + CTA */}
        <div className="flex-1 text-white">
          <div className="inline-flex items-center gap-1 bg-white/10 backdrop-blur border border-white/20 rounded-full px-2.5 py-0.5 text-[10px] font-bold mb-2">
            <Smartphone size={11} className="text-[#C9A96A]" />
            تطبيق أموگار
          </div>
          <h3 className="text-lg md:text-2xl font-extrabold leading-tight">
            حمّل تطبيق أموگار
            <span className="block text-[#C9A96A] text-sm md:text-base mt-0.5">وتسوّق بسهولة من هاتفك</span>
          </h3>
          <div className="flex items-center gap-3 mt-3 text-[10px] md:text-xs">
            <div className="flex items-center gap-1">
              <div className="flex">
                {[1,2,3,4,5].map(i => <Star key={i} size={11} className="fill-[#FBBF24] text-[#FBBF24]" />)}
              </div>
              <span className="text-white/80 font-bold">4.9</span>
            </div>
            <span className="text-white/40">•</span>
            <span className="text-white/80">+50K تحميل</span>
            <span className="text-white/40">•</span>
            <span className="text-white/80">مجاني 100%</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2 shrink-0">
          <button className="bg-white text-[#1A1A1E] px-3 md:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-[#FFFCF8] transition">
            <Smartphone size={14} />
            <span>حمّل الآن</span>
          </button>
          <button
            onClick={dismiss}
            className="bg-white/10 backdrop-blur border border-white/20 text-white px-3 md:px-4 py-2 rounded-xl text-[10px] font-medium hover:bg-white/15 transition"
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  )
}
