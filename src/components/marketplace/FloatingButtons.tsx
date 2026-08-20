/**
 * FloatingButtons — Floating action buttons (bottom-right, desktop only).
 *
 *   1. Back to top button (appears after scrolling 400px)
 *   2. Cart button (always visible, shows item count badge)
 *
 * Temu has these on every page.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, ShoppingCart } from 'lucide-react'
import { useCart } from '../../context/CartContext'

export function FloatingButtons() {
  const [show, setShow] = useState(false)
  const { totalQty } = useCart()

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 z-30 flex flex-col gap-2">
      {/* Back to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`w-11 h-11 rounded-full bg-white border border-[#E5E7EB] shadow-lg grid place-items-center text-[#1A1A1E] hover:bg-[#1A1A1E] hover:text-white transition-all ${
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="العودة للأعلى"
      >
        <ArrowUp size={18} />
      </button>

      {/* Cart */}
      <Link
        to="/cart"
        className="relative w-11 h-11 rounded-full bg-gradient-to-br from-[#1A1A1E] to-[#2D2D35] shadow-lg grid place-items-center text-white hover:scale-110 transition-transform"
        aria-label="السلة"
      >
        <ShoppingCart size={18} />
        {totalQty > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#DC2626] text-white text-[10px] font-extrabold rounded-full grid place-items-center px-1">
            {totalQty > 99 ? '99+' : totalQty}
          </span>
        )}
      </Link>
    </div>
  )
}
