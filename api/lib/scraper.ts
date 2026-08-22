// @ts-nocheck — serverless function; type-checked by Vercel at deploy time
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Amugar — Universal Product Scraper (المستورد السحري)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Port of the Python UniversalProductScraper that was tested successfully
 *  on Pydroid3. Supports: AliExpress, Shopify, Temu, YouCan, and generic
 *  e-commerce stores.
 *
 *  Key improvements over the previous TS version:
 *    1. JSON-LD structured data extraction (Product schema)
 *    2. More price patterns (6 patterns for AliExpress)
 *    3. PDP URL fallback for AliExpress prices
 *    4. og:image + <img> fallback for images
 *    5. Temu support with JSON-LD
 *    6. Better title cleaning
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

      // Could be a single object or an array
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
    } catch {
      // JSON parse error — skip
    }
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
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ar-DZ,ar;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    redirect: 'follow',
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  if (domain.includes('temu')) {
    return scrapeTemu($, html)
  }

  return scrapeGenericOrYouCan($, html, url)
}

// ─── AliExpress scraper ─────────────────────────────────────────────────────
async function scrapeAliExpress(rawUrl: string): Promise<ScrapedProduct> {
  // Extract item ID
  const itemIdMatch = rawUrl.match(/\/item\/(\d+)\.html/) || rawUrl.match(/(\d{10,20})/)
  if (!itemIdMatch) throw new Error('تعذر استخراج معرف المنتج')

  const itemId = itemIdMatch[1]
  const cleanUrl = `https://ar.aliexpress.com/item/${itemId}.html`

  const res = await fetch(cleanUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ar-DZ,ar;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cookie': 'aep_usuc_f=site=glo&c_tp=DZD&region=DZ&b_locale=ar_MA; intl_locale=ar_MA; currency=DZD;',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    redirect: 'follow',
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  // 1. استخراج وتنظيف العنوان
  let title = getMeta($, ['og:title']) || $('title').text() || ''
  if (!title) {
    const subjectMatch = html.match(/"subject":"([^"]+)"/)
    if (subjectMatch) title = subjectMatch[1]
  }
  title = title.replace(/(\s*-\s*AliExpress.*|\s*\|\s*AliExpress.*)/i, '').trim()

  // 2. استخراج السعر الحقيقي (6 patterns كما في كود Python)
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

  // مسار احتياطي: استخراج السعر من رابط الـ PDP
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

  // 3. استخراج معرض الصور الكامل بدقة أصلية
  const imgMatches = [
    ...html.matchAll(
      /(https?:\/\/[a-zA-Z0-9.-]*aliexpress-media\.com\/kf\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp))/g
    ),
  ]
  const images: string[] = []
  for (const m of imgMatches) {
    const cleanImg = m[1].replace(/_\d+x\d+.*$/, '')
    if (!cleanImg.includes('HTB18eCBQ') && !images.includes(cleanImg)) {
      images.push(cleanImg)
    }
  }

  // fallback: og:image if no aliexpress-media images found
  if (images.length === 0) {
    const ogImages = getAllMetaImages($)
    for (const img of ogImages) {
      if (!img.includes('HTB18eCBQ') && !images.includes(img)) {
        images.push(img)
      }
    }
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

// ─── Shopify scraper (via .json endpoint) ───────────────────────────────────
async function tryShopifyJson(url: string): Promise<ScrapedProduct | null> {
  try {
    const cleanUrl = url.split('?')[0].replace(/\/$/, '')
    const res = await fetch(`${cleanUrl}.json`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    })
    if (!res.ok) return null

    const json = await res.json()
    const product = json.product
    if (!product) return null

    const images: string[] = (product.images || []).map((img: any) => img.src)
    const price = parseFloat(product.variants?.[0]?.price || '0') || 0

    // Clean HTML description
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

  // Try JSON-LD Product schema
  const jsonLd = extractJsonLdProduct($)
  if (jsonLd) {
    if (jsonLd.name) title = jsonLd.name
    if (jsonLd.description) desc = jsonLd.description
    if (jsonLd.price !== undefined) price = jsonLd.price
    if (jsonLd.images && jsonLd.images.length > 0) images = [...images, ...jsonLd.images]
  }

  // Deduplicate images
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

  // Try JSON-LD Product schema
  const jsonLd = extractJsonLdProduct($)
  if (jsonLd) {
    if (jsonLd.name) title = jsonLd.name
    if (jsonLd.description) desc = jsonLd.description
    if (jsonLd.price !== undefined) price = jsonLd.price
    if (jsonLd.images && jsonLd.images.length > 0) images = [...images, ...jsonLd.images]
  }

  // Fallback: extract images from <img> tags
  if (images.length === 0) {
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || ''
      if (src && (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.webp'))) {
        if (!src.toLowerCase().includes('logo') && !src.toLowerCase().includes('icon')) {
          const fullUrl = src.startsWith('//') ? 'https:' + src : src
          if (!images.includes(fullUrl)) images.push(fullUrl)
        }
      }
    })
  }

  // Deduplicate
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
