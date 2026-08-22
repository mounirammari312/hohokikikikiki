// @ts-nocheck — serverless function; type-checked by Vercel at deploy time
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Amugar — Universal Product Scraper (المستورد السحري)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Multi-strategy product scraper:
 *    1. Shopify stores (via .json endpoint — direct fetch works)
 *    2. AliExpress (via allorigins.win CORS proxy + HTML parsing)
 *    3. Temu (via direct fetch + JSON-LD)
 *    4. YouCan / generic stores (via direct fetch + OpenGraph)
 *
 *  AliExpress blocks ALL datacenter IPs (Vercel). We use allorigins.win
 *  as a CORS proxy to fetch the page through a residential IP, then
 *  parse the HTML for product data.
 */

import * as cheerio from 'cheerio'

export interface ScrapedProduct {
  platform: string
  name: string
  price: number
  currency: string
  description: string
  images: string[]
  variants?: { name: string; options: string[] }[]
}

// ─── Helper: fetch through CORS proxy (bypasses AliExpress IP blocks) ────────
async function fetchViaProxy(targetUrl: string): Promise<string> {
  // Try allorigins.win first (most reliable free proxy)
  const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl)
  const res = await fetch(proxyUrl, {
    headers: { 'Accept': 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Proxy returned ${res.status}`)
  return await res.text()
}

// ─── Helper: direct fetch (works for Shopify, YouCan, generic) ──────────────
async function fetchDirect(url: string, headers?: Record<string, string>): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...headers,
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Direct fetch returned ${res.status}`)
  return await res.text()
}

// ─── Helper: check if HTML is an AliExpress block/punish page ───────────────
function isBlocked(html: string): boolean {
  return html.length < 5000 || html.includes('punish') || html.includes('x5sec') || html.includes('_____tmd_____')
}

// ─── Helper: extract text from meta tags ────────────────────────────────────
function getMeta($: cheerio.CheerioAPI, tags: string[]): string {
  for (const tag of tags) {
    const el = $(`meta[property="${tag}"]`).attr('content') ||
               $(`meta[name="${tag}"]`).attr('content')
    if (el) return el
  }
  return ''
}

// ─── Helper: extract all og:image meta tags ─────────────────────────────────
function getAllMetaImages($: cheerio.CheerioAPI): string[] {
  const imgs: string[] = []
  $('meta[property^="og:image"]').each((_, el) => {
    const c = $(el).attr('content')
    if (c) imgs.push(c)
  })
  return imgs
}

// ─── Helper: extract price from meta tags ───────────────────────────────────
function extractMetaPrice($: cheerio.CheerioAPI): number {
  const raw = getMeta($, ['product:price:amount', 'og:price:amount', 'price'])
  if (raw) {
    const nums = raw.replace(/,/g, '').match(/[\d.]+/g)
    if (nums && nums.length > 0) return parseFloat(nums[0]) || 0
  }
  return 0
}

// ─── Helper: parse JSON-LD Product schema ───────────────────────────────────
function extractJsonLdProduct($: cheerio.CheerioAPI): Partial<ScrapedProduct> | null {
  const result: Partial<ScrapedProduct> = {}
  let found = false

  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return
    try {
      const raw = $(el).html()
      if (!raw) return
      const data = JSON.parse(raw)

      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item['@type'] === 'Product' || (Array.isArray(item['@type']) && item['@type'].includes('Product'))) {
          found = true
          if (item.name) result.name = item.name
          if (item.description) result.description = item.description
          if (item.image) {
            if (Array.isArray(item.image)) result.images = item.image
            else result.images = [item.image]
          }
          if (item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers
            if (offers.price) result.price = parseFloat(offers.price) || 0
            if (offers.lowPrice) result.price = parseFloat(offers.lowPrice) || 0
          }
          break
        }
      }
    } catch {}
  })

  return found ? result : null
}

// ─── Main entry point ───────────────────────────────────────────────────────
export async function scrapeProductFromUrl(rawUrl: string): Promise<ScrapedProduct> {
  const url = rawUrl.trim()
  const parsedUrl = new URL(url)
  const domain = parsedUrl.hostname.toLowerCase()

  // 1. فحص متاجر Shopify
  const shopifyData = await tryShopifyJson(url)
  if (shopifyData) return shopifyData

  // 2. فحص AliExpress
  if (domain.includes('aliexpress')) {
    return await scrapeAliExpress(url)
  }

  // 3. فحص Temu و YouCan والمتاجر العامة
  let html = ''
  try {
    html = await fetchDirect(url, {
      'Accept-Language': 'ar-DZ,ar;q=0.9,en-US;q=0.8,en;q=0.7',
    })
  } catch {
    // If direct fails, try proxy
    html = await fetchViaProxy(url)
  }

  const $ = cheerio.load(html)

  if (domain.includes('temu')) {
    return scrapeTemu($, html)
  }

  return scrapeGenericOrYouCan($, html, url)
}

// ─── AliExpress scraper (uses CORS proxy to bypass IP block) ─────────────────
async function scrapeAliExpress(rawUrl: string): Promise<ScrapedProduct> {
  const itemIdMatch = rawUrl.match(/\/item\/(\d+)\.html/) || rawUrl.match(/(\d{10,20})/)
  if (!itemIdMatch) throw new Error('تعذر استخراج معرف المنتج')

  const itemId = itemIdMatch[1]
  const cleanUrl = `https://ar.aliexpress.com/item/${itemId}.html`

  // AliExpress blocks datacenter IPs — use CORS proxy
  let html = ''

  // Strategy 1: try direct fetch (works sometimes)
  try {
    html = await fetchDirect(cleanUrl, {
      'Accept-Language': 'ar-DZ,ar;q=0.9',
      'Cookie': 'aep_usuc_f=site=glo&c_tp=DZD&region=DZ&b_locale=ar_MA; intl_locale=ar_MA; currency=DZD;',
    })
    if (isBlocked(html)) html = '' // blocked — try proxy
  } catch {
    html = ''
  }

  // Strategy 2: use CORS proxy (allorigins.win)
  if (!html || isBlocked(html)) {
    try {
      html = await fetchViaProxy(cleanUrl)
    } catch {
      // proxy also failed — continue with empty html, extract what we can
    }
  }

  // If we got real HTML, parse it
  if (html && !isBlocked(html)) {
    const $ = cheerio.load(html)

    // 1. استخراج وتنظيف العنوان
    let title = getMeta($, ['og:title']) || $('title').text() || ''
    if (!title) {
      const subjectMatch = html.match(/"subject":"([^"]+)"/)
      if (subjectMatch) title = subjectMatch[1]
    }
    title = title.replace(/(\s*-\s*AliExpress.*|\s*\|\s*AliExpress.*)/i, '').trim()

    // 2. استخراج السعر (6 patterns)
    let price = 0
    const pricePatterns = [
      /"formatedActivityPrice":"([^"]+)"/,
      /"discountPrice":\s*\{\s*"minAmount":\s*\{\s*"value":\s*([\d.]+)/,
      /"formattedPrice":"([^"]+)"/,
      /"actSkuMultiCurrencyDisplayPrice":"([^"]+)"/,
      /"minAmount":\s*\{\s*"currency":\s*"[^"]+",\s*"value":\s*([\d.]+)/,
      /"skuAmount":\s*\{\s*"currency":\s*"[^"]+",\s*"value":\s*([\d.]+)/,
    ]
    for (const pat of pricePatterns) {
      const match = html.match(pat)
      if (match) {
        const val = match[1].replace(/,/g, '')
        const nums = val.match(/[\d.]+/g)
        if (nums && nums.length > 0) {
          const parsed = parseFloat(nums[0])
          if (parsed > 0) { price = parsed; break }
        }
      }
    }

    // PDP URL fallback for price
    if (price === 0) {
      const pdpMatch = rawUrl.match(/pdp_npi=([^&]+)/)
      if (pdpMatch) {
        const decoded = decodeURIComponent(pdpMatch[1])
        const dzdMatches = [...decoded.matchAll(/([\d,.]+)\s*\+?\s*DA/g)]
        if (dzdMatches.length > 0) {
          price = parseFloat(dzdMatches[dzdMatches.length - 1][1].replace(/,/g, '')) || 0
        }
      }
    }

    // 3. استخراج معرض الصور
    const imgMatches = [
      ...html.matchAll(
        /(https?:\/\/[a-zA-Z0-9.-]*aliexpress[a-zA-Z0-9.-]*\.com\/kf\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp))/g
      ),
    ]
    const images: string[] = []
    for (const m of imgMatches) {
      const cleanImg = m[1].replace(/_\d+x\d+.*$/, '')
      if (!cleanImg.includes('HTB18eCBQ') && !images.includes(cleanImg)) {
        images.push(cleanImg)
      }
    }

    // fallback: og:image
    if (images.length === 0) {
      const ogImages = getAllMetaImages($)
      for (const img of ogImages) {
        if (!img.includes('HTB18eCBQ') && !images.includes(img)) {
          images.push(img)
        }
      }
    }

    // Try JSON-LD
    const jsonLd = extractJsonLdProduct($)
    if (jsonLd) {
      if (!title && jsonLd.name) title = jsonLd.name
      if (price === 0 && jsonLd.price !== undefined) price = jsonLd.price
      if (images.length === 0 && jsonLd.images) images.push(...jsonLd.images)
    }

    return {
      platform: 'AliExpress',
      name: title,
      price: price,
      currency: 'DZD',
      description: title ? `منتج مستورد من AliExpress: ${title}` : `منتج مستورد من AliExpress — رقم المعرف: ${itemId}`,
      images: images.slice(0, 8),
    }
  }

  // If ALL strategies failed (AliExpress blocked everything):
  // Return partial data with a helpful message
  return {
    platform: 'AliExpress',
    name: '',
    price: 0,
    currency: 'DZD',
    description: `تعذّر استخراج بيانات هذا المنتج من AliExpress (المنصة تحظر الوصول من الخوادم). يرجى إدخال بيانات المنتج يدوياً — رقم المعرف: ${itemId}`,
    images: [],
  }
}

// ─── Shopify scraper (via .json endpoint) ───────────────────────────────────
async function tryShopifyJson(url: string): Promise<ScrapedProduct | null> {
  try {
    const cleanUrl = url.split('?')[0].replace(/\/$/, '')
    const res = await fetch(`${cleanUrl}.json`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null

    const json = await res.json()
    const product = json.product
    if (!product) return null

    const images: string[] = (product.images || []).map((img: any) => img.src)
    const price = parseFloat(product.variants?.[0]?.price || '0') || 0

    let desc = ''
    if (product.body_html) {
      const $ = cheerio.load(product.body_html)
      desc = $.text().trim()
    }

    const variants = (product.options || []).map((opt: any) => ({
      name: opt.name || '',
      options: opt.values || [],
    }))

    return {
      platform: 'Shopify',
      name: (product.title || '').trim(),
      price: price,
      currency: 'DZD',
      description: desc,
      images: images,
      variants: variants.length > 0 ? variants : undefined,
    }
  } catch {
    return null
  }
}

// ─── Temu scraper ───────────────────────────────────────────────────────────
function scrapeTemu($: cheerio.CheerioAPI, html: string): ScrapedProduct {
  let title = getMeta($, ['og:title', 'twitter:title'])
  let desc = getMeta($, ['og:description', 'description'])
  let price = extractMetaPrice($)
  let images = getAllMetaImages($)

  const jsonLd = extractJsonLdProduct($)
  if (jsonLd) {
    if (jsonLd.name) title = jsonLd.name
    if (jsonLd.description) desc = jsonLd.description
    if (jsonLd.price !== undefined) price = jsonLd.price
    if (jsonLd.images && jsonLd.images.length > 0) images = [...images, ...jsonLd.images]
  }

  const uniqueImages = [...new Set(images)]

  return {
    platform: 'Temu',
    name: title.trim(),
    price: price,
    currency: 'DZD',
    description: desc.trim(),
    images: uniqueImages.slice(0, 8),
  }
}

// ─── Generic / YouCan scraper ───────────────────────────────────────────────
function scrapeGenericOrYouCan($: cheerio.CheerioAPI, html: string, url: string): ScrapedProduct {
  let title = getMeta($, ['og:title', 'twitter:title']) || $('title').text() || ''
  let desc = getMeta($, ['og:description', 'description'])
  let price = extractMetaPrice($)
  let images = getAllMetaImages($)

  const jsonLd = extractJsonLdProduct($)
  if (jsonLd) {
    if (jsonLd.name) title = jsonLd.name
    if (jsonLd.description) desc = jsonLd.description
    if (jsonLd.price !== undefined) price = jsonLd.price
    if (jsonLd.images && jsonLd.images.length > 0) images = [...images, ...jsonLd.images]
  }

  // ─── Smart image filtering ──────────────────────────────────────────
  // The old code grabbed ANY <img> with .jpg/.png — including logos,
  // banners, icons, and UI elements. We need to be smarter:
  //   1. Prefer og:image (these are specifically set for sharing = product images)
  //   2. Prefer images inside product-related containers
  //   3. Skip logos, icons, banners, avatars, buttons, placeholders
  //   4. Require minimum image dimensions (via URL hints like _800x800)

  if (images.length === 0) {
    // Strategy 1: look for images inside product containers
    const productSelectors = [
      '.product-image img', '.product-images img', '.product-gallery img',
      '.product img', '.images img', '.gallery img', '.slider img',
      '[class*="product"] img', '[class*="image"] img',
      '.owl-item img', '.swiper-slide img', '.zoom img',
    ]
    for (const sel of productSelectors) {
      $(sel).each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy') || ''
        if (src && isProductImage(src)) {
          const fullUrl = normalizeUrl(src, url)
          if (!images.includes(fullUrl)) images.push(fullUrl)
        }
      })
      if (images.length >= 4) break
    }
  }

  // Strategy 2: look for large images (not logos/icons)
  if (images.length === 0) {
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy') || ''
      if (src && isProductImage(src)) {
        const fullUrl = normalizeUrl(src, url)
        if (!images.includes(fullUrl)) images.push(fullUrl)
      }
    })
  }

  const uniqueImages = [...new Set(images)]

  return {
    platform: 'YouCan / Custom Store',
    name: title.trim(),
    price: price,
    currency: 'DZD',
    description: desc.trim() || title.trim(),
    images: uniqueImages.slice(0, 8),
  }
}

// ─── Helper: determine if an image URL is a product image (not logo/icon) ──
function isProductImage(src: string): boolean {
  const lower = src.toLowerCase()
  // Must be an image
  if (!lower.match(/\.(jpg|jpeg|png|webp)(\?|$)/)) return false
  // Skip logos, icons, banners, avatars, buttons, placeholders
  if (lower.includes('logo')) return false
  if (lower.includes('icon')) return false
  if (lower.includes('banner')) return false
  if (lower.includes('avatar')) return false
  if (lower.includes('button')) return false
  if (lower.includes('placeholder')) return false
  if (lower.includes('sprite')) return false
  if (lower.includes('blank')) return false
  if (lower.includes('pixel.')) return false  // tracking pixels
  if (lower.includes('data:image')) return false  // base64
  // Skip very small images (URL hints like _50x50, _100x100)
  if (lower.match(/_(\d{2,3})x(\d{2,3})\./) && !lower.match(/_(\d{3,})x(\d{3,})\./)) return false
  // Skip common CDN asset paths (not product images)
  if (lower.includes('/assets/') && !lower.includes('/images/')) return false
  if (lower.includes('/static/')) return false
  return true
}

// ─── Helper: normalize image URL (relative → absolute) ─────────────────────
function normalizeUrl(src: string, baseUrl: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  if (src.startsWith('//')) return 'https:' + src
  if (src.startsWith('/')) {
    const origin = new URL(baseUrl).origin
    return origin + src
  }
  // Relative path
  const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1)
  return base + src
}
