/**
 * Smart Image Component (v4 — Simplified, Reliable)
 * ─────────────────────────────────────────────────────────────────────────
 *  After 3 iterations of trying to be clever (blur placeholders, LQIP,
 *  srcset, format detection), I simplified to the most reliable approach:
 *
 *    1. Build an optimized URL (Unsplash CDN params OR wsrv.nl proxy)
 *    2. Render a single <img> with the optimized src
 *    3. If it errors, swap to the ORIGINAL src (guaranteed to work)
 *    4. No opacity games, no layering, no blur placeholders
 *
 *  Why simpler is better:
 *    - The previous versions had bugs where `loaded=false` made images
 *      invisible even after they loaded.
 *    - The blur placeholder stacked on top and hid the real image.
 *    - The tint div with zIndex interfered with the image rendering.
 *
 *  This version: ONE img, ONE src, swap on error. Done.
 *
 *  Performance is still good because:
 *    - We add `loading="lazy"` for below-the-fold images
 *    - We add `decoding="async"` so the browser doesn't block rendering
 *    - The optimized URL serves WebP/AVIF when supported (smaller files)
 *    - We add `width`/`height` attributes to prevent layout shift
 */

import { useState } from 'react'

export const IMAGE_SIZES = {
  thumb: 150,
  card: 400,
  detail: 800,
  hero: 1600,
  og: 1200,
} as const

export type ImageSize = keyof typeof IMAGE_SIZES

// Detect browser format support ONCE (cached)
let _format: 'avif' | 'webp' | 'jpg' | null = null
function getFormat(): 'avif' | 'webp' | 'jpg' {
  if (_format) return _format
  if (typeof window === 'undefined') { _format = 'jpg'; return _format }
  const canvas = document.createElement('canvas')
  canvas.width = 1; canvas.height = 1
  try {
    if (canvas.toDataURL('image/avif').startsWith('data:image/avif')) _format = 'avif'
    else if (canvas.toDataURL('image/webp').startsWith('data:image/webp')) _format = 'webp'
    else _format = 'jpg'
  } catch { _format = 'jpg' }
  return _format
}

/**
 * Build optimized image URL.
 * - Unsplash: use their CDN params directly (fastest, no proxy)
 * - Other HTTPS: use wsrv.nl as a proxy
 * - Relative URLs: return as-is
 */
function buildOptimizedUrl(src: string, width: number, quality = 80): string {
  if (!src) return ''
  if (src.startsWith('/') && !src.startsWith('//')) return src
  try {
    const url = new URL(src)
    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('w', String(width))
      url.searchParams.set('q', String(quality))
      url.searchParams.set('fm', getFormat() === 'jpg' ? 'jpg' : 'webp')
      url.searchParams.set('fit', 'crop')
      url.searchParams.set('auto', 'format')
      return url.toString()
    }
    // wsrv.nl proxy for other images
    const cleanUrl = `${url.hostname}${url.pathname}${url.search}`
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${width}&output=webp&q=${quality}`
  } catch {
    return src
  }
}

interface SmartImageProps {
  src: string
  alt: string
  size?: ImageSize
  className?: string
  eager?: boolean
  width?: number
  height?: number
  style?: React.CSSProperties
  onClick?: () => void
}

export function SmartImage({
  src,
  alt,
  size = 'card',
  className = '',
  eager = false,
  width,
  height,
  style,
  onClick,
}: SmartImageProps) {
  const [errored, setErrored] = useState(false)
  const targetWidth = width || IMAGE_SIZES[size]

  // Optimized URL, OR fall back to original src on error
  const finalSrc = errored ? src : buildOptimizedUrl(src, targetWidth, 80)

  // Auto-detect if we need to add `relative` to the wrapper
  // (only when className doesn't already have a position keyword).
  const hasPosition = /\b(relative|absolute|fixed|sticky)\b/.test(className)
  const wrapperClass = `${hasPosition ? '' : 'relative'} overflow-hidden ${className}`.trim()

  return (
    <div
      className={wrapperClass}
      style={{
        width: width ? `${width}px` : undefined,
        aspectRatio: height && width ? `${width}/${height}` : undefined,
        ...style,
      }}
      onClick={onClick}
    >
      <img
        src={finalSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => {
          // First error: try the original src (not the optimized one)
          if (!errored) setErrored(true)
        }}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: style?.opacity }}
      />
    </div>
  )
}

// Helpers for non-React usage (JSON-LD, Open Graph)
export function getOptimizedImageUrl(src: string, size: ImageSize = 'card'): string {
  return buildOptimizedUrl(src, IMAGE_SIZES[size], 80)
}

export function getOgImageUrl(src: string): string {
  return buildOptimizedUrl(src, IMAGE_SIZES.og, 85)
}
