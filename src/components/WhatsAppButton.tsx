/**
 * WhatsAppButton — Floating WhatsApp chat button for storefronts.
 *
 * Features:
 *   - Animated green bubble with WhatsApp icon
 *   - Pulse ring animation to attract attention
 *   - Expandable tooltip with greeting message
 *   - Pre-filled message from merchant settings
 *   - Respects merchant's position preference (left/right)
 *   - Respects merchant's enable/disable preference
 *   - Hidden on /admin (dashboard pages)
 *   - Mobile-optimized (smaller on mobile, safe-area aware)
 *
 * The button links to https://wa.me/<number>?text=<message>
 * where <number> is the merchant's whatsapp number (no +, no spaces)
 * and <message> is the pre-filled greeting text.
 */

import { useEffect, useState } from 'react'
import { getSettings } from '../services/api/settings'

export function WhatsAppButton() {
  const [show, setShow] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Read settings synchronously (from cache)
    const s = getSettings() as any

    // Don't show if disabled by merchant
    if (s.whatsappButtonEnabled === false) return

    // Don't show if no whatsapp number configured
    if (!s.whatsapp || s.whatsapp.length < 5) return

    // Don't show on admin/marketplace pages
    const path = window.location.pathname
    if (path.startsWith('/admin') || path.startsWith('/marketplace') || path.startsWith('/super-admin')) return

    setShow(true)

    // Auto-expand tooltip after 3 seconds, then collapse after 5 more
    const expandTimer = setTimeout(() => setExpanded(true), 3000)
    const collapseTimer = setTimeout(() => setExpanded(false), 8000)
    return () => {
      clearTimeout(expandTimer)
      clearTimeout(collapseTimer)
    }
  }, [])

  if (!show) return null

  const s = getSettings() as any
  const phone = (s.whatsapp || '').replace(/[^0-9]/g, '')
  const message = encodeURIComponent(s.whatsappMessage || 'مرحباً، أريد الاستفسار عن منتج')
  const position = s.whatsappPosition || 'left'
  const href = `https://wa.me/${phone}?text=${message}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed bottom-20 lg:bottom-6 z-40 flex items-center gap-2 transition-all duration-300 ${
        position === 'left' ? 'left-4' : 'right-4'
      }`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      aria-label="تواصل معنا عبر واتساب"
    >
      {/* Tooltip bubble */}
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] p-3 transition-all duration-300 origin-bottom-left ${
          expanded ? 'opacity-100 scale-100 max-w-[200px]' : 'opacity-0 scale-0 max-w-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#25D366] grid place-items-center shrink-0">
            {/* WhatsApp SVG icon */}
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.149-.197.297-.767.967-.94 1.165-.173.198-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.892c0 2.09.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.581 0 11.94-5.359 11.943-11.893a11.821 11.821 0 00-3.489-8.453z"/>
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[#1A1A1E]">تواصل معنا</div>
            <div className="text-[10px] text-[#9A8A6B] truncate">واتساب — رد سريع</div>
          </div>
        </div>
      </div>

      {/* Main button */}
      <div className="relative">
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30"></span>
        {/* Button */}
        <div className="relative w-14 h-14 lg:w-12 lg:h-12 rounded-full bg-[#25D366] grid place-items-center shadow-2xl hover:bg-[#1DA851] transition-colors active:scale-95">
          {/* WhatsApp SVG icon */}
          <svg viewBox="0 0 24 24" className="w-8 h-8 lg:w-7 lg:h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.149-.197.297-.767.967-.94 1.165-.173.198-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.892c0 2.09.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.581 0 11.94-5.359 11.943-11.893a11.821 11.821 0 00-3.489-8.453z"/>
          </svg>
        </div>
      </div>
    </a>
  )
}
