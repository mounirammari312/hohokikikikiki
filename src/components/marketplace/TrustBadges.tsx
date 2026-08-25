/**
 * TrustBadges — Slim, neutral trust strip.
 *
 * Refactored from a colorful badge row into a calm, monochrome strip
 * that emphasizes the core Algerian-market guarantees without visual
 * noise. Each badge uses a unified slate-700 icon on white card with
 * a thin slate border. The COD badge keeps a quiet emerald accent to
 * reinforce the most important trust signal for Algerian buyers.
 *
 * Badges shown:
 *   1. COD (Cash on Delivery) — emerald accent
 *   2. Delivery to 58 wilayas
 *   3. Verified Algerian stores
 *   4. Inspection on delivery
 */

import { ShieldCheck, Truck, Store, Eye } from 'lucide-react'

const BADGES = [
  {
    icon: ShieldCheck,
    label: 'الدفع عند الاستلام',
    sub: 'ادفع بعد المعاينة',
    accent: true, // emerald accent — the key trust signal
  },
  {
    icon: Truck,
    label: 'توصيل لكل الولايات',
    sub: '58 ولاية',
    accent: false,
  },
  {
    icon: Store,
    label: 'متاجر جزائرية موثوقة',
    sub: '100% معتمدة',
    accent: false,
  },
  {
    icon: Eye,
    label: 'معاينة قبل الدفع',
    sub: 'رؤية المنتج أولاً',
    accent: false,
  },
]

export function TrustBadges({ className = '' }: { className?: string }) {
  return (
    <div className={`${className} overflow-x-auto scrollbar-hide lg:overflow-visible`}>
      <div className="flex lg:grid lg:grid-cols-4 gap-2 min-w-max lg:min-w-0">
        {BADGES.map((b, i) => {
          const Icon = b.icon
          return (
            <div
              key={i}
              className="bg-white border border-slate-200/80 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 flex items-center gap-2.5 hover:border-slate-300 transition shrink-0 w-[160px] sm:w-auto lg:w-auto"
            >
              <div
                className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${
                  b.accent
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-slate-900 truncate leading-tight">
                  {b.label}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 truncate mt-0.5">
                  {b.sub}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
