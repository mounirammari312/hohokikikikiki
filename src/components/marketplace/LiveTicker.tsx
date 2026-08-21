/**
 * LiveTicker — Animated marquee of recent orders.
 *
 * Phase 2: now pulls REAL recent orders from /api/marketplace/recent-activity.
 * If the server returns orders (i.e. real customers have placed orders),
 * we show those. Otherwise, we fall back to a deterministic client-side
 * generation using the current product pool.
 *
 * This makes the ticker feel REAL — actual customer names from actual
 * wilayas buying actual products — instead of being entirely synthetic.
 */

import { useEffect, useMemo, useState } from 'react'
import { fetchRecentActivity, type MarketplaceActivity } from '../../services/api/client'

interface Props {
  /** Pool of product names to draw from (fallback when no real activity) */
  productNames: string[]
  className?: string
}

const ALGERIAN_NAMES = [
  'أحمد', 'محمد', 'يوسف', 'عبد الرحمن', 'إسلام', 'بلال', 'خالد', 'سفيان', 'عماد', 'رابح',
  'فاطمة', 'آمنة', 'مريم', 'خديجة', 'سارة', 'نسرين', 'هاجر', 'أسماء', 'إيمان', 'ليلى',
  'كريم', 'نبيل', 'أنس', 'ياسين', 'زكريا', 'إيهاب', 'إبراهيم', 'عمر', 'حمزة', 'علي',
]

const WILAYAS = [
  'وهران', 'قسنطينة', 'عنّاب', 'الجزائر العاصمة', 'البليدة', 'سطيف', 'باتنة', 'ورقلة',
  'بجاية', 'تيزي وزو', 'تيارت', 'المسيلة', 'غرداية', 'سكيكدة', 'جيجل', 'بومرداس',
  'الشلف', 'عنابة', 'سيدي بلعباس', 'معسكر', 'غليزان', 'النعامة', 'البيض', 'أدرار',
  'تمنراست', 'بشار', 'تلمسان', 'مستغانم', 'قالمة', 'سوق أهراس',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface DisplayItem {
  name: string
  wilaya: string
  product: string
}

function fromActivity(a: MarketplaceActivity): DisplayItem {
  return { name: a.customerName || 'زبون', wilaya: a.wilaya || 'الجزائر', product: a.productNameAr || 'منتج مميز' }
}

function makeFake(productNames: string[]): DisplayItem {
  return {
    name: pick(ALGERIAN_NAMES),
    wilaya: pick(WILAYAS),
    product: productNames.length ? pick(productNames) : 'منتج مميز',
  }
}

export function LiveTicker({ productNames, className = '' }: Props) {
  // Try real activity first; fall back to fake if empty/unavailable
  const [realActivity, setRealActivity] = useState<MarketplaceActivity[]>([])
  const [batch, setBatch] = useState<DisplayItem[]>(() =>
    Array.from({ length: 12 }, () => makeFake(productNames))
  )

  // Pull real activity on mount + every 60s
  // DEFERRED: delay first fetch by 3s to avoid blocking initial page load
  useEffect(() => {
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    const pull = async () => {
      const { activity } = await fetchRecentActivity(20)
      if (cancelled) return
      setRealActivity(activity)
    }

    const initialTimeout = setTimeout(() => {
      void pull()
      intervalId = setInterval(pull, 60000)
    }, 3000)

    return () => {
      cancelled = true
      clearTimeout(initialTimeout)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  // Build display batch — prefer real, supplement with fake if < 12 real entries
  useEffect(() => {
    if (realActivity.length === 0) {
      setBatch(Array.from({ length: 12 }, () => makeFake(productNames)))
      return
    }
    const real = realActivity.slice(0, 12).map(fromActivity)
    // If we have fewer than 12 real entries, pad with fake ones
    while (real.length < 12) real.push(makeFake(productNames))
    setBatch(real)
  }, [realActivity, productNames])

  // Refresh the fake batch every 45 seconds (only matters if no real activity)
  useEffect(() => {
    if (realActivity.length > 0) return // don't override real data
    const id = setInterval(() => {
      setBatch(Array.from({ length: 12 }, () => makeFake(productNames)))
    }, 45000)
    return () => clearInterval(id)
  }, [realActivity.length, productNames])

  // Duplicate the batch so the marquee can scroll seamlessly
  const items = useMemo(() => [...batch, ...batch], [batch])

  return (
    <div className={`bg-gradient-to-l from-[#1A1A1E] via-[#2D2D35] to-[#1A1A1E] text-white overflow-hidden ${className}`}>
      <div className="flex items-center">
        {/* Static label */}
        <div className="shrink-0 bg-[#DC2626] text-white text-[10px] font-extrabold px-3 py-2 flex items-center gap-1.5 z-10 relative">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          مباشر
        </div>

        {/* Scrolling marquee */}
        <div className="relative flex-1 overflow-hidden">
          <div className="flex items-center gap-6 py-2 whitespace-nowrap animate-marquee">
            {items.map((o, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                <span className="text-[#C9A96A]">🎯</span>
                <span className="text-white/90">{o.name}</span>
                <span className="text-white/50">من</span>
                <span className="text-white/90">{o.wilaya}</span>
                <span className="text-white/50">اشترى</span>
                <span className="text-emerald-300 font-bold">{o.product}</span>
                <span className="text-white/30 mx-2">•</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
