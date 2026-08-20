/**
 * TrustBadges — Row of trust indicators below the hero.
 *
 * Shows 4-5 key trust signals:
 *   1. COD (Cash on Delivery)
 *   2. 58 wilayas delivery
 *   3. Verified stores
 *   4. Secure checkout
 *   5. Easy returns (optional)
 *
 * Temu/AliExpress have a similar strip on their homepage.
 */

import { ShieldCheck, Truck, Store, Lock, RefreshCw } from 'lucide-react'

const BADGES = [
  { icon: ShieldCheck, label: 'دفع عند الاستلام', sub: 'ادفع بعد الاستلام', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { icon: Truck, label: 'توصيل لكل الولايات', sub: '58 ولاية', color: 'text-blue-600', bg: 'bg-blue-50' },
  { icon: Store, label: 'متاجر موثّقة', sub: '100% معتمدة', color: 'text-[#A02A5B]', bg: 'bg-pink-50' },
  { icon: Lock, label: 'دفع آمن', sub: 'تشفير SSL', color: 'text-[#C9A96A]', bg: 'bg-amber-50' },
  { icon: RefreshCw, label: 'استرجاع سهل', sub: 'خلال 7 أيام', color: 'text-[#7C3AED]', bg: 'bg-violet-50' },
]

export function TrustBadges({ className = '' }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-5 gap-2 ${className}`}>
      {BADGES.map((b, i) => {
        const Icon = b.icon
        return (
          <div
            key={i}
            className="bg-white border border-[#E5E7EB] rounded-xl p-3 flex items-center gap-2 hover:shadow-sm transition"
          >
            <div className={`w-9 h-9 rounded-lg ${b.bg} grid place-items-center shrink-0`}>
              <Icon size={16} className={b.color} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-[#1A1A1E] truncate">{b.label}</div>
              <div className="text-[9px] text-[#9A8A6B] truncate">{b.sub}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
