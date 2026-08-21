/**
 * CountdownTimer — Live countdown timer for Flash Deals section.
 *
 * Renders HH:MM:SS in three pill boxes that tick every second.
 * When it hits zero, it resets to 12 hours (so the deal always looks fresh).
 *
 * Used by the "عروض اليوم" section to create FOMO (Fear Of Missing Out),
 * exactly like Temu/AliExpress flash sales.
 */

import { useEffect, useState } from 'react'

interface Props {
  /** Initial hours (default: 12) */
  hours?: number
  className?: string
  /** Compact mode — single inline pill */
  compact?: boolean
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function CountdownTimer({ hours = 12, className = '', compact = false }: Props) {
  // Persist the deadline in localStorage so it doesn't reset on every reload.
  // If a previous deadline exists and is still in the future, use it; otherwise
  // create a new one.
  const STORAGE_KEY = 'amugar_flash_deadline'
  const [deadline, setDeadline] = useState<number>(() => {
    if (typeof window === 'undefined') return Date.now() + hours * 3600 * 1000
    const stored = Number(localStorage.getItem(STORAGE_KEY) || '0')
    if (stored && stored > Date.now()) return stored
    const next = Date.now() + hours * 3600 * 1000
    localStorage.setItem(STORAGE_KEY, String(next))
    return next
  })

  const [remaining, setRemaining] = useState(deadline - Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      const diff = deadline - Date.now()
      if (diff <= 0) {
        // Reset to a new 12-hour window
        const next = Date.now() + hours * 3600 * 1000
        localStorage.setItem(STORAGE_KEY, String(next))
        setDeadline(next)
        setRemaining(next - Date.now())
      } else {
        setRemaining(diff)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [deadline, hours])

  const totalSec = Math.max(0, Math.floor(remaining / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 font-mono font-bold ${className}`}>
        <span className="bg-[#1A1A1E] text-white rounded px-1.5 py-0.5 text-xs">{pad(h)}:{pad(m)}:{pad(s)}</span>
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Box value={pad(h)} label="ساعة" />
      <Sep />
      <Box value={pad(m)} label="دقيقة" />
      <Sep />
      <Box value={pad(s)} label="ثانية" pulse />
    </div>
  )
}

function Box({ value, label, pulse }: { value: string; label: string; pulse?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`min-w-[34px] text-center bg-gradient-to-b from-[#1A1A1E] to-[#2D2D35] text-white font-mono font-extrabold text-base md:text-lg rounded-md px-1.5 py-1 leading-none ${pulse ? 'animate-pulse' : ''}`}
      >
        {value}
      </div>
      <div className="text-[9px] text-[#9A8A6B] mt-0.5">{label}</div>
    </div>
  )
}

function Sep() {
  return <div className="text-[#DC2626] font-extrabold text-lg pb-3">:</div>
}
