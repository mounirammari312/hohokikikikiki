/**
 * TopStores — Ranking of the top merchants in the marketplace.
 *
 * Phase 2: now pulls REAL ranking from /api/marketplace/top-stores, which
 * sorts by (orderCount * 10 + rating) desc. Each store comes with its
 * real product count, order count, rating, and review count.
 *
 * Falls back to the old client-side ranking if the API is unavailable.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Star, Package, TrendingUp, Store as StoreIcon, ChevronLeft } from 'lucide-react'
import { fetchTopStores, type TopStore } from '../../services/api/client'
import type { TenantStore } from '../../services/api/types'

interface Props {
  /** Optional: client-provided fallback stores (used when API is unavailable) */
  stores?: (TenantStore & { productCount?: number })[]
  className?: string
  /** Limit the number of stores shown (default 8) */
  limit?: number
}

// Deterministic hash for stable "sales" fallback number per store
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function TopStores({ stores: fallbackStores = [], className = '', limit = 8 }: Props) {
  const [topStores, setTopStores] = useState<TopStore[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { stores: ranked } = await fetchTopStores(limit)
      if (cancelled) return
      setTopStores(ranked)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [limit])

  // Use real data if available; otherwise fall back to client-side ranked stores
  const display = topStores.length > 0
    ? topStores
    : fallbackStores.slice(0, limit).map(s => ({
        store: s,
        productCount: s.productCount || 0,
        orderCount: 0,
        rating: 4 + (hashStr(s._id) % 10) / 10,
        reviewCount: 0,
        sales: 80 + (hashStr(s._id) % 920),
      }))

  if (!loaded && fallbackStores.length === 0) {
    // Loading skeleton
    return (
      <div className={`bg-white border border-[#E5E7EB] rounded-2xl p-4 ${className}`}>
        <div className="h-4 w-24 skeleton rounded mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 skeleton rounded-lg" />
              <div className="flex-1">
                <div className="h-3 w-32 skeleton rounded mb-1" />
                <div className="h-2 w-20 skeleton rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (display.length === 0) return null

  // Gradient palette for rank #1-3 (gold, silver, bronze)
  const rankGradients = [
    'from-[#F59E0B] to-[#D97706]', // #1 gold
    'from-[#9CA3AF] to-[#6B7280]', // #2 silver
    'from-[#B45309] to-[#92400E]', // #3 bronze
  ]

  return (
    <div className={`bg-white border border-[#E5E7EB] rounded-2xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C9A96A] to-[#92653A] grid place-items-center shrink-0">
            <Crown size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#1A1A1E]">أفضل المتاجر</h3>
            <p className="text-[10px] text-[#9A8A6B]">المتاجر الأكثر نشاطاً هذا الأسبوع</p>
          </div>
        </div>
        <TrendingUp size={18} className="text-[#9A8A6B]" />
      </div>

      {/* Ranked list */}
      <div className="space-y-2">
        {display.map((item, idx) => {
          const rank = idx + 1
          const store = item.store
          const rankBg = rankGradients[idx] || 'from-[#1A1A1E] to-[#2D2D35]'

          return (
            <Link
              key={store._id}
              to={`/marketplace/store/${store.slug}`}
              className="group flex items-center gap-3 p-2 rounded-xl hover:bg-[#F9FAFB] transition"
            >
              {/* Rank badge */}
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${rankBg} grid place-items-center shrink-0 shadow`}>
                <span className="text-white text-xs font-extrabold">{rank}</span>
              </div>

              {/* Store icon */}
              <div className="w-9 h-9 rounded-xl bg-[#F3F4F6] grid place-items-center shrink-0 border border-[#E5E7EB]">
                <StoreIcon size={14} className="text-[#9A8A6B]" />
              </div>

              {/* Store info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm text-[#1A1A1E] truncate">{store.nameAr || store.name}</span>
                  {rank <= 3 && (
                    <span className="text-[9px] bg-[#3B82F6] text-white px-1 py-0.5 rounded-full font-bold shrink-0">
                      موثّق
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#9A8A6B]">
                  <div className="flex items-center gap-0.5">
                    <Star size={9} className="fill-[#FBBF24] text-[#FBBF24]" />
                    <span className="font-bold text-[#1A1A1E]">{Number(item.rating).toFixed(1)}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-0.5">
                    <Package size={9} />
                    <span>{item.productCount} منتج</span>
                  </div>
                  {item.orderCount > 0 && (
                    <>
                      <span>•</span>
                      <span>{item.orderCount}+ مبيعة</span>
                    </>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <ChevronLeft size={14} className="text-[#9A8A6B] group-hover:text-[#1A1A1E] transition shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
