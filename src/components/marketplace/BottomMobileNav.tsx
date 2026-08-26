/**
 * BottomMobileNav — Fixed bottom navigation bar (mobile only).
 *
 * Like Temu/AliExpress mobile app:
 *   [الرئيسية] [تصفّح] [السلة] [حسابي]
 *
 * Fixes applied:
 *   - "تصفّح" now focuses the sticky search input at the top of the
 *     marketplace page (instead of being a duplicate of "الرئيسية").
 *     This is the standard AliExpress behaviour — the search icon in
 *     the bottom bar jumps focus to the top search field.
 *   - "حسابي" now routes to /admin (merchant login → dashboard), not
 *     to "/" (which shows the SaaS landing — confusing).
 *   - Active state matching is strict (pathname equality) so the
 *     "الرئيسية" tab doesn't stay highlighted when the user is on
 *     /cart or /product.
 */

import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, Search, ShoppingCart, User } from 'lucide-react'
import { useCart } from '../../context/CartContext'

export function BottomMobileNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { totalQty } = useCart()

  // Focus the marketplace search input. If we're not on the marketplace
  // page, navigate there first, then focus after the route settles.
  const focusSearch = () => {
    const focusInput = () => {
      // The marketplace header search input is the only <input> with a
      // placeholder containing "منتج". This is robust against layout
      // changes (we don't rely on a specific id or class).
      const input = document.querySelector<HTMLInputElement>(
        'header input[placeholder*="منتج"]'
      )
      if (input) {
        input.focus()
        input.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return true
      }
      return false
    }
    if (pathname.startsWith('/marketplace')) {
      // Already on marketplace → just focus.
      if (!focusInput()) {
        // The input might not be rendered yet if the page is mid-
        // transition; retry once on the next frame.
        requestAnimationFrame(() => focusInput())
      }
    } else {
      // Navigate to marketplace, then focus after the route renders.
      navigate('/marketplace')
      setTimeout(() => focusInput(), 350)
    }
  }

  // Determine which tab is "active" based on the current pathname.
  // - الرئيسية: exact /marketplace (NOT /marketplace/store/...)
  // - تصفّح: never "active" (it's an action, not a destination)
  // - السلة: /cart
  // - حسابي: /admin or /admin/*
  const isHomeActive = pathname === '/marketplace'
  const isCartActive = pathname === '/cart'
  const isAccountActive = pathname === '/admin' || pathname.startsWith('/admin/')

  const items = [
    {
      label: 'الرئيسية',
      icon: Home,
      active: isHomeActive,
      onClick: () => navigate('/marketplace'),
      to: '/marketplace',
    },
    {
      label: 'تصفّح',
      icon: Search,
      active: false,
      onClick: focusSearch,
      to: null,
    },
    {
      label: 'السلة',
      icon: ShoppingCart,
      active: isCartActive,
      onClick: () => navigate('/cart'),
      to: '/cart',
    },
    {
      label: 'حسابي',
      icon: User,
      active: isAccountActive,
      onClick: () => navigate('/admin'),
      to: '/admin',
    },
  ]

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4">
        {items.map((item, i) => {
          const Icon = item.icon
          // Use a <Link> when there's a `to`, otherwise a <button> (for
          // the "تصفّح" action which focuses search without navigating).
          const className = `flex flex-col items-center justify-center gap-0.5 py-2 transition active:scale-95 ${
            item.active ? 'text-slate-900' : 'text-slate-500'
          }`
          const inner = (
            <>
              <div className="relative">
                <Icon size={20} className={item.active ? 'fill-current' : ''} />
                {item.label === 'السلة' && totalQty > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-600 text-white text-[9px] font-bold rounded-full grid place-items-center px-1">
                    {totalQty > 99 ? '99+' : totalQty}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </>
          )
          return item.to ? (
            <Link key={i} to={item.to} onClick={item.onClick} className={className}>
              {inner}
            </Link>
          ) : (
            <button key={i} type="button" onClick={item.onClick} className={className}>
              {inner}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
