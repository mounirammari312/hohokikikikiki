/**
 * BottomMobileNav — Fixed bottom navigation bar (mobile only).
 *
 * Like Temu/AliExpress mobile app:
 *   [الرئيسية] [الفئات] [السلة] [حسابي]
 *
 * Improves UX on mobile by giving quick access to key pages.
 */

import { Link, useLocation } from 'react-router-dom'
import { Home, Search, ShoppingCart, User } from 'lucide-react'
import { useCart } from '../../context/CartContext'

const ITEMS = [
  { to: '/marketplace', label: 'الرئيسية', icon: Home, match: ['/marketplace'] },
  { to: '/marketplace', label: 'تصفّح', icon: Search, match: ['__search__'] }, // special: opens search
  { to: '/cart', label: 'السلة', icon: ShoppingCart, match: ['/cart'] },
  { to: '/', label: 'حسابي', icon: User, match: ['/'] },
]

export function BottomMobileNav() {
  const { pathname } = useLocation()
  const { totalQty } = useCart()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E5E7EB] shadow-[0_-2px_8px_rgba(0,0,0,0.04)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid grid-cols-4">
        {ITEMS.map((item, i) => {
          const Icon = item.icon
          const isActive = item.match.some(m => m === '__search__' ? false : pathname === m)
          return (
            <Link
              key={i}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 transition active:scale-95 ${
                isActive ? 'text-[#1A1A1E]' : 'text-[#9A8A6B]'
              }`}
            >
              <div className="relative">
                <Icon size={20} className={isActive ? 'fill-current' : ''} />
                {item.label === 'السلة' && totalQty > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-[#DC2626] text-white text-[9px] font-bold rounded-full grid place-items-center px-1">
                    {totalQty > 99 ? '99+' : totalQty}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
