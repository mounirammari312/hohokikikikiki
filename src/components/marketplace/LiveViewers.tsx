/**
 * LiveViewers — "X person is browsing now" counter.
 *
 * Phase 2: now pulls the real "viewersNow" number from
 * /api/marketplace/stats. The number on the server is derived from
 * actual recent activity (orders in the last 5 minutes) plus a stable
 * hour-of-day multiplier, so it feels alive without a real-time WS connection.
 *
 * Falls back to a stable session-random number if the API is unreachable.
 */

import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { fetchMarketplaceStats } from '../../services/api/client'

export function LiveViewers({ className = '' }: { className?: string }) {
  const STORAGE_KEY = 'amugar_live_viewers'

  const [count, setCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 247
    const stored = Number(sessionStorage.getItem(STORAGE_KEY) || '0')
    if (stored) return stored
    const initial = 180 + Math.floor(Math.random() * 220) // 180-400
    sessionStorage.setItem(STORAGE_KEY, String(initial))
    return initial
  })

  // Pull the real value from the server on mount + every 60s
  // DEFERRED: only fetch after 3s to avoid blocking the initial page load.
  // The user sees the cached/random number immediately, then it updates
  // with the real value from the server a moment later.
  useEffect(() => {
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    const pull = async () => {
      const stats = await fetchMarketplaceStats()
      if (cancelled) return
      if (stats.viewersNow && stats.viewersNow > 0) {
        setCount(stats.viewersNow)
        sessionStorage.setItem(STORAGE_KEY, String(stats.viewersNow))
      }
    }

    // Delay first fetch by 3s to let the rest of the page load
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

  // Local drift ±5% every 8 seconds (gives a "alive" feel between server pulls)
  useEffect(() => {
    const id = setInterval(() => {
      setCount(prev => {
        const delta = Math.max(2, Math.round(prev * 0.05))
        const next = Math.max(80, prev + (Math.random() > 0.5 ? delta : -delta))
        return next
      })
    }, 8000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 rounded-full px-3 py-1.5 text-xs font-bold ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <Eye size={12} />
      <span className="tabular-nums">{count.toLocaleString('ar-DZ')}</span>
      <span className="text-emerald-600 font-medium">يتصفحون الآن</span>
    </div>
  )
}
