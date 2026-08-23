/**
 * Smart Image Component (v5 — High Performance & Progressive WebP)
 * ─────────────────────────────────────────────────────────────────────────
 *  1. Auto-converts any external image (AliExpress, CDN, etc.) to lightweight WebP.
 *  2. Progressive rendering (Interlaced) for fast perception on 3G/4G.
 *  3. Zero CLS layout stability with graceful fallback on network errors.
 *  4. High-priority LCP fetching for hero/first cards.
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

// Normalize image URLs (handles //ae01.alicdn.com and raw HTTP)
function normalizeUrl(src: string): string {
  if (!src) return ''
  if (src.startsWith('//')) return `https:${src}`
  return src
}

/**
 * Build optimized image URL:
 * - Unsplash: direct CDN parameters
 * - External HTTPS / AliExpress: wsrv.nl proxy (WebP, Progressive, Auto-Compress)
 * - Local / Relative: returned as-is
 */
function buildOptimizedUrl(src: string, width: number, quality = 80): string {
  const normalized = normalizeUrl(src)
  if (!normalized) return ''
  if (normalized.startsWith('/') && !normalized.startsWith('//')) return normalized
  if (normalized.startsWith('data:')) return normalized

  try {
    const url = new URL(normalized)
    
    // Unsplash Direct CDN
    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('w', String(width))
      url.searchParams.set('q', String(quality))
      url.searchParams.set('fm', 'webp')
      url.searchParams.set('fit', 'crop')
      url.searchParams.set('auto', 'format')
      return url.toString()
    }

    // High-speed CDN proxy for external images (AliExpress, Shopify, external hosts)
    const cleanUrl = `${url.hostname}${url.pathname}${url.search}`
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${width}&output=webp&q=${quality}&il=1&we=1`
  } catch {
    return normalized
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

  const normalized = normalizeUrl(src)
  const finalSrc = errored ? normalized : buildOptimizedUrl(normalized, targetWidth, 80)

  const hasPosition = /\b(relative|absolute|fixed|sticky)\b/.test(className)
  const wrapperClass = `${hasPosition ? '' : 'relative'} overflow-hidden bg-[#F5EFE6] ${className}`.trim()

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
        // @ts-ignore
        fetchpriority={eager ? 'high' : 'auto'}
        onError={() => {
          if (!errored) setErrored(true)
        }}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
        style={{ opacity: style?.opacity }}
      />
    </div>
  )
}

export function getOptimizedImageUrl(src: string, size: ImageSize = 'card'): string {
  return buildOptimizedUrl(normalizeUrl(src), IMAGE_SIZES[size], 80)
}

export function getOgImageUrl(src: string): string {
  return buildOptimizedUrl(normalizeUrl(src), IMAGE_SIZES.og, 85)
}

