/**
 * Logo — Unified, clean Amugar logo component.
 *
 * Use this EVERYWHERE the platform logo appears. It renders the raw
 * logo image directly on the natural background — NO dark box, NO
 * gradient wrapper, NO rounded square around it. This keeps the logo
 * crisp and consistent across all pages (Marketplace, PlatformLanding,
 * MerchantLogin, Admin, Footer, etc.).
 *
 * Variants:
 *   - `to` (default "/") wraps the logo in a <Link>. Pass `to=""` or
 *     `to={null}` to render without a link (e.g. inside a footer that
 *     already has its own link).
 *   - `showText` (default true) renders the "Amugar" wordmark + tagline
 *     next to the logo image. Pass false for icon-only contexts (e.g.
 *     tight mobile headers).
 *   - `imgClassName` (default "h-8 w-auto") controls the logo image
 *     size. Use Tailwind height utilities (h-7, h-8, h-10, h-14...).
 *   - `textClassName` (optional) overrides the wordmark color when the
 *     logo sits on a dark background (e.g. footer → use "text-white").
 *
 * The text tagline is "منصة المتاجر الجزائرية" by default.
 */

import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

interface LogoProps {
  to?: string | null
  showText?: boolean
  className?: string
  imgClassName?: string
  /** Override the wordmark color (e.g. "text-white" on dark backgrounds). */
  textClassName?: string
  /** Override the tagline text (rarely needed). */
  tagline?: string
  /** Optional children rendered after the wordmark (rarely needed). */
  children?: ReactNode
}

export function Logo({
  to = '/',
  showText = true,
  className = '',
  imgClassName = 'h-8 w-auto',
  textClassName = 'text-slate-900',
  tagline = 'منصة المتاجر الجزائرية',
  children,
}: LogoProps) {
  const content = (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <img
        src="/logo.webp"
        alt="Amugar"
        className={`object-contain ${imgClassName}`}
      />
      {showText && (
        <div className="flex flex-col text-right leading-none">
          <span className={`font-extrabold text-sm tracking-tight ${textClassName}`}>
            Amugar
          </span>
          <span className={`text-[9px] font-medium mt-0.5 ${textClassName} opacity-60`}>
            {tagline}
          </span>
        </div>
      )}
      {children}
    </div>
  )

  if (!to) return content
  return (
    <Link
      to={to}
      className="inline-block transition-opacity hover:opacity-90"
    >
      {content}
    </Link>
  )
}
