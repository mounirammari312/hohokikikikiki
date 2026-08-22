// @ts-nocheck — serverless function
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

const BANNED_KEYWORDS = [
  'logo', 'icon', 'favicon', 'avatar', 'badge', 'banner', 'flag', 
  'payment', 'sprite', 'loader', 'placeholder', 'trust', 'footer', 
  'header', 'cart', 'HTB18eCBQ', '.svg', '.gif'
]

function isLegitImage(src: string): boolean {
  if (!src || typeof src !== 'string') return false
  const lower = src.toLowerCase()
  if (!lower.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)) return false
  if (lower.startsWith('data:image')) return false
  return !BANNED_KEYWORDS.some(k => lower.includes(k.toLowerCase()))
}

// دالة جلب آمنة لا ترمي خطأ Abort أبداً
async function safeFetch(url: string, options: any = {}, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    if (res.ok) return await res.text()
  } catch {
    clearTimeout(timeoutId)
  }
  return ''
}

// استخراج معرف المنتج من أي نمط روابط لـ AliExpress
function extractAliExpressId(url: string): string | null {
  const mItem = url.match(/\/item\/(\d+)\.html/)
  if (mItem) return mItem[1]

  const mParam = url.match(/[?&](?:productId|itemId|x_object_id|object_id|id)=(\d{10,20})/)
  if (mParam) return mParam[1]

  const mGeneral = url.match(/(\d{12,20})/)
  return mGeneral ? mGeneral[1] : null
}

export async function scrapeProductFromUrl(rawUrl: string): Promise<ScrapedProduct> {
  const url = rawUrl.trim()
  const parsedUrl = new URL(url)
  const domain = parsedUrl.hostname.toLowerCase()

  // 1. متاجر Shopify
  if (url.includes('/products/')) {
    const shopify = await tryShopify(url)
    if (shopify) return shopify
  }

  // 2. AliExpress
  if (domain.includes('aliexpress')) {
    return await scrapeAliExpress(url)
  }

  // 3. المتاجر العامة و YouCan
  return await scrapeGeneric(url)
}

async function scrapeAliExpress(rawUrl: string): Promise<ScrapedProduct> {
  const itemId = extractAliExpressId(rawUrl)
  if (!itemId) {
    throw new Error('تعذر العثور على معرف المنتج في الرابط، يرجى التأكد من نسخ رابط المنتج المباشر.')
  }

  // استخراج السعر بالدينار فوراً من الرابط إن وجد
  let price = 0
  const pdpMatch = rawUrl.match(/pdp_npi=([^&]+)/)
  if (pdpMatch) {
    const decoded = decodeURIComponent(pdpMatch[1])
    const dzdMatches = [...decoded.matchAll(/([\d,.]+)\s*\+?\s*DA/g)]
    if (dzdMatches.length > 0) {
      price = parseFloat(dzdMatches[dzdMatches.length - 1][1].replace(/,/g, '')) || 0
    }
  }

  const cleanUrl = `https://ar.aliexpress.com/item/${itemId}.html`
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'ar-DZ,ar;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cookie': 'aep_usuc_f=site=glo&c_tp=DZD&region=DZ&b_locale=ar_MA; currency=DZD;'
  }

  // محاولة الجلب المباشر أو عبر البروكسي
  let html = await safeFetch(cleanUrl, { headers }, 6000)
  if (!html || html.length < 5000) {
    html = await safeFetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`, {}, 7000)
  }

  const $ = cheerio.load(html || '')
  let title = $('meta[property="og:title"]').attr('content') || $('title').text() || ''
  if (!title && html) {
    const match = html.match(/"subject":"([^"]+)"/) || html.match(/"title":"([^"]+)"/)
    if (match) title = match[1]
  }
  title = title.replace(/(\s*-\s*AliExpress.*|\s*\|\s*AliExpress.*)/gi, '').trim()

  // استخراج الأسعار من كود الصفحة
  if (price === 0 && html) {
    const priceMatch = html.match(/"discountPrice":\s*\{\s*"minAmount":\s*\{\s*"value":\s*([\d.]+)/) ||
                       html.match(/"minAmount":\s*\{\s*"currency":\s*"[^"]+",\s*"value":\s*([\d.]+)/) ||
                       html.match(/"formatedActivityPrice":"([^"]+)"/)
    if (priceMatch) {
      const val = priceMatch[1].replace(/,/g, '')
      const num = val.match(/[\d.]+/g)
      if (num) price = parseFloat(num[0]) || 0
    }
  }

  // استخراج الصور الأصلية
  const images: string[] = []
  if (html) {
    const imgMatches = [...html.matchAll(/(https?:\/\/[a-zA-Z0-9.-]*(?:aliexpress-media|alicdn)\.com\/kf\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp))/gi)]
    for (const m of imgMatches) {
      const cleanImg = m[1].replace(/_\d+x\d+.*$/, '')
      if (isLegitImage(cleanImg) && !images.includes(cleanImg)) {
        images.push(cleanImg)
      }
    }
  }

  if (images.length === 0) {
    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr('content')
      if (src && isLegitImage(src) && !images.includes(src)) images.push(src)
    })
  }

  return {
    platform: 'AliExpress',
    name: title || `منتج AliExpress (${itemId})`,
    price: price,
    currency: 'DZD',
    description: `منتج مستورد من AliExpress - معرف القطعة: ${itemId}`,
    images: images.slice(0, 8)
  }
}

async function tryShopify(url: string): Promise<ScrapedProduct | null> {
  try {
    const cleanUrl = url.split('?')[0].replace(/\/$/, '')
    const jsonStr = await safeFetch(`${cleanUrl}.json`, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 5000)
    if (!jsonStr) return null

    const { product } = JSON.parse(jsonStr)
    if (!product) return null

    const images = (product.images || []).map((i: any) => i.src).filter(isLegitImage)
    return {
      platform: 'Shopify',
      name: (product.title || '').trim(),
      price: parseFloat(product.variants?.[0]?.price || '0') || 0,
      currency: 'DZD',
      description: product.body_html ? cheerio.load(product.body_html).text().trim() : '',
      images: images.slice(0, 8),
      variants: product.options?.map((opt: any) => ({ name: opt.name, options: opt.values || [] }))
    }
  } catch {
    return null
  }
}

async function scrapeGeneric(url: string): Promise<ScrapedProduct> {
  const html = await safeFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 7000)
  const $ = cheerio.load(html || '')

  let title = $('meta[property="og:title"]').attr('content') || $('title').text() || ''
  let desc = $('meta[property="og:description"]').attr('content') || ''
  let price = 0
  const images: string[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text() || '{}')
      const item = data['@type'] === 'Product' ? data : data['@graph']?.find((g: any) => g['@type'] === 'Product')
      if (item) {
        if (!title && item.name) title = item.name
        if (item.offers?.price) price = parseFloat(item.offers.price) || 0
        if (item.image) {
          const imgs = Array.isArray(item.image) ? item.image : [item.image]
          imgs.forEach((src: any) => {
            const s = typeof src === 'string' ? src : src.url
            if (isLegitImage(s) && !images.includes(s)) images.push(s)
          })
        }
      }
    } catch {}
  })

  if (images.length === 0) {
    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr('content')
      if (src && isLegitImage(src) && !images.includes(src)) images.push(src)
    })
  }

  return {
    platform: 'Custom Store',
    name: title.trim(),
    price: price,
    currency: 'DZD',
    description: desc.trim(),
    images: images.slice(0, 8)
  }
}

