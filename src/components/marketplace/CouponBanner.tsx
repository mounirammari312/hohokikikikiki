/**
 * CouponBanner — Prominent coupon claim banner.
 *
 * Phase 2: now pulls ACTIVE coupons from /api/marketplace/coupons.
 * If there's an active coupon, it shows the real code + value.
 * Falls back to a hardcoded "AMUGAR500" coupon if the API is unavailable.
 *
 * Temu style: copy-to-clipboard with one tap, "claimed" feedback state.
 */

import { useEffect, useState } from 'react'
import { Gift, Copy, Check, Sparkles } from 'lucide-react'
import { fetchActiveCoupons, type Coupon } from '../../services/api/client'

const DEFAULT_COUPON_CODE = 'AMUGAR500'
const DEFAULT_COUPON_VALUE = '500'

function formatCouponValue(c: Coupon): string {
  if (c.discountType === 'percent') {
    return `${c.discountValue}%`
  }
  return String(c.discountValue)
}

export function CouponBanner({ className = '' }: { className?: string }) {
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [claimed, setClaimed] = useState(false)

  // Pull active coupons on mount
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { coupons } = await fetchActiveCoupons()
      if (cancelled) return
      if (coupons && coupons.length > 0) {
        setCoupon(coupons[0]) // show the most recent active coupon
      }
    })()
    return () => { cancelled = true }
  }, [])

  const code = coupon?.code || DEFAULT_COUPON_CODE
  const value = coupon ? formatCouponValue(coupon) : DEFAULT_COUPON_VALUE
  const isPercent = coupon?.discountType === 'percent'
  const unit = isPercent ? 'خصم' : 'د.ج'

  const claim = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // Ignore — clipboard might not be available
    }
    setClaimed(true)
    setTimeout(() => setClaimed(false), 3000)
  }

  // Pick gradient based on coupon.color
  const gradient = coupon?.color === 'gold'
    ? 'from-[#B45309] via-[#92400E] to-[#78350F]'
    : coupon?.color === 'emerald'
    ? 'from-[#0F766E] via-[#115E59] to-[#0F4F4A]'
    : 'from-[#A02A5B] via-[#7A1F44] to-[#A02A5B]' // default rose

  const blob1 = coupon?.color === 'gold' ? 'bg-amber-300/30' : 'bg-pink-300/20'
  const blob2 = coupon?.color === 'gold' ? 'bg-orange-300/20' : 'bg-rose-300/15'

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-l ${gradient} ${className}`}>
      {/* Decorative blurs */}
      <div className={`absolute -top-12 -right-12 w-48 h-48 ${blob1} rounded-full blur-3xl`} />
      <div className={`absolute -bottom-12 -left-12 w-48 h-48 ${blob2} rounded-full blur-3xl`} />

      {/* Sparkles */}
      <Sparkles size={14} className="absolute top-3 left-3 text-white/40" />
      <Sparkles size={10} className="absolute bottom-3 right-3 text-white/30" />

      <div className="relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 md:p-5">
        {/* Gift icon */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl bg-white/15 backdrop-blur border border-white/20 grid place-items-center shrink-0">
          <Gift size={20} className="sm:hidden text-white" />
          <Gift size={24} className="hidden sm:block text-white" />
        </div>

        {/* Text */}
        <div className="flex-1 text-white min-w-0">
          <div className="text-[10px] sm:text-xs md:text-sm text-white/70 font-medium mb-0.5">🎁 عرض خاص</div>
          <div className="font-extrabold text-sm sm:text-base md:text-lg leading-tight">
            خصم {value} {unit} على طلبك
          </div>
          <div className="text-[9px] sm:text-[10px] md:text-xs text-white/60 mt-0.5 truncate">
            {coupon?.descriptionAr || 'استخدم الكود عند الدفع — صالح لكل الولايات'}
            {coupon?.minOrderValue ? ` — الحد الأدنى ${coupon.minOrderValue} د.ج` : ''}
          </div>
        </div>

        {/* Coupon + claim */}
        <div className="flex flex-col items-end gap-1 sm:gap-1.5 shrink-0">
          <div className="bg-white text-[#A02A5B] px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-mono font-extrabold text-[10px] sm:text-xs md:text-sm border-2 border-dashed border-pink-300 tracking-wider">
            {code}
          </div>
          <button
            onClick={claim}
            className={`flex items-center gap-1 text-[9px] sm:text-[10px] md:text-xs font-bold px-2 sm:px-3 py-1 rounded-full transition ${
              claimed ? 'bg-emerald-500 text-white' : 'bg-white text-[#A02A5B] hover:bg-pink-50'
            }`}
          >
            {claimed ? (
              <><Check size={10} className="sm:hidden" /><Check size={11} className="hidden sm:block" /> تم النسخ</>
            ) : (
              <><Copy size={10} className="sm:hidden" /><Copy size={11} className="hidden sm:block" /> انسخ</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
