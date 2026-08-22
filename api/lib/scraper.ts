// @ts-nocheck — serverless function; type-checked by Vercel at deploy time
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

// ─── قائمة استبعاد الشعارات والأيقونات والملفات غير المتعلقة بالمنتج ───────────
const BANNED_IMAGE_KEYWORDS = [
  'logo', 'brand', 'icon', 'favicon', 'avatar', 'badge', 'banner', 'flag', 
  'payment', 'sprite', 'loader', 'spinner', 'placeholder', 'trust', 'footer', 
  'header', 'cart', 'review', 'star', 'rating', 'button', 'widget', 'HTB18eCBQ'
]

function isLegitProductImage(src: string): boolean {
  if (!src || typeof src !== 'string') return false
  const lower = src.toLowerCase()
  
  // يجب أن يكون رابط صورة مدعوم
  if (!lower.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)) return false
  if (lower.startsWith('data:image')) return false

  // استبعاد ملفات SVG والرموز التعبيرية
  if (lower.includes('.svg') || lower.includes('.gif')) return false

  // استبعاد الكلمات المحظورة
  for (const keyword of BANNED_IMAGE_KEYWORDS) {
    if (lower.includes(keyword)) return false
  }

  // استبعاد الصور المصغرة جداً من الروابط (مثل _50x50, _80x80)
  if (lower.match(/_(\d{2,3})x(\d{2,3})\./) && !lower.match(/_([5-9]\d{2,})x/)) {
    return false
  }

  return true
}

// ─── نظام جلب متعدد لتجاوز حظر خوادم Vercel ──────────────────────────────────
async function fetchWithBypass(targetUrl: string, isAliExpress: boolean = false): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ar-DZ,ar;q=0.9,en-US;q=0.8,en;q=0.7',
    ...(isAliExpress ? {
      'Cookie': 'aep_usuc_f=site=glo&c_tp=DZD&region=DZ&b_locale=ar_MA; intl_locale=ar_MA; currency=DZD;',
    } : {})
  }

  // 1. محاولة الجلب المباشر
  try {
    const res = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const html = await res.text()
      if (html.length > 5000 && !html.includes('punish') && !html.includes('x5sec')) {
        return html
      }
    }
  } catch {}

  // 2. استخدام بروكسيات بديلة سريعة في حال الحظر
  const proxies = [
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
  ]

  for (const proxyGen of proxies) {
    try {
      const res = await fetch(proxyGen(targetUrl), { headers, signal: AbortSignal.timeout(10000) })
      if (res.ok) {
        const text = await res.text()
        if (text.length > 5000 && !text.includes('punish')) return text
      }
    } catch {}
  }

  return ''
}

// ─── المدخل الرئيسي للكاشط ───────────────────────────────────────────────────
export async function scrapeProductFromUrl(rawUrl: string): Promise<ScrapedProduct> {
  const url = rawUrl.trim()
  const parsedUrl = new URL(url)
  const domain = parsedUrl.hostname.toLowerCase()

  // 1. متاجر Shopify (عبر ملف .json مباشرة)
  if (url.includes('/products/')) {
    const shopifyData = await tryShopifyJson(url)
    if (shopifyData) return shopifyData
  }

  // 2. AliExpress
  if (domain.includes('aliexpress')) {
    return await scrapeAliExpress(url)
  }

  // 3. باقي المتاجر (YouCan, Temu, WooCommerce)
  const html = await fetchWithBypass(url)
  const $ = cheerio.load(html || '')

  if (domain.includes('temu')) {
    return scrapeTemu($, html)
  }

  return scrapeGenericOrYouCan($, html, url)
}

// ─── محرك AliExpress ────────────────────────────────────────────────────────
async function scrapeAliExpress(rawUrl: string): Promise<ScrapedProduct> {
  const itemIdMatch = rawUrl.match(/\/item\/(\d+)\.html/) || rawUrl.match(/(\d{10,20})/)
  if (!itemIdMatch) throw new Error('تعذر استخراج معرف منتج AliExpress')

  const itemId = itemIdMatch[1]
  const cleanUrl = `https://ar.aliexpress.com/item/${itemId}.html`

  const html = await fetchWithBypass(cleanUrl, true)
  const $ = cheerio.load(html || '')

  // 1. استخراج الاسم
  let title = $('meta[property="og:title"]').attr('content') || $('title').text() || ''
  if (!title && html) {
    const subjectMatch = html.match(/"subject":"([^"]+)"/) || html.match(/"title":"([^"]+)"/)
    if (subjectMatch) title = subjectMatch[1]
  }
  title = title.replace(/(\s*-\s*AliExpress.*|\s*\|\s*AliExpress.*)/gi, '').trim()

  // 2. استخراج السعر بالدينار الجزائري
  let price = 0
  if (html) {
    const pricePatterns = [
      /"formatedActivityPrice":"([^"]+)"/,
      /"discountPrice":\s*\{\s*"minAmount":\s*\{\s*"value":\s*([\d.]+)/,
      /"formattedPrice":"([^"]+)"/,
      /"minAmount":\s*\{\s*"currency":\s*"[^"]+",\s*"value":\s*([\d.]+)/,
      /"skuAmount":\s*\{\s*"currency":\s*"[^"]+",\s*"value":\s*([\d.]+)/
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
  }

  // مسار استخراج السعر من بارامترات الرابط نفسه
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

  // 3. استخراج الصور الأصلية بدقة عالية
  const images: string[] = []
  if (html) {
    const imgMatches = [...html.matchAll(/(https?:\/\/[a-zA-Z0-9.-]*(?:aliexpress-media|alicdn)\.com\/kf\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp))/gi)]
    for (const m of imgMatches) {
      const cleanImg = m[1].replace(/_\d+x\d+.*$/, '')
      if (isLegitProductImage(cleanImg) && !images.includes(cleanImg)) {
        images.push(cleanImg)
      }
    }
  }

  if (images.length === 0) {
    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr('content')
      if (src && isLegitProductImage(src) && !images.includes(src)) images.push(src)
    })
  }

  return {
    platform: 'AliExpress',
    name: title || `منتج AliExpress (${itemId})`,
    price: price,
    currency: 'DZD',
    description: `منتج مستورد من AliExpress - رقم المعرف: ${itemId}`,
    images: images.slice(0, 8)
  }
}

// ─── محرك Shopify ───────────────────────────────────────────────────────────
async function tryShopifyJson(url: string): Promise<ScrapedProduct | null> {
  try {
    const cleanUrl = url.split('?')[0].replace(/\/$/, '')
    const res = await fetch(`${cleanUrl}.json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(6000)
    })
    if (!res.ok) return null

    const json = await res.json()
    const product = json.product
    if (!product) return null

    const images = (product.images || [])
      .map((img: any) => img.src)
      .filter(isLegitProductImage)

    let desc = ''
    if (product.body_html) {
      const $ = cheerio.load(product.body_html)
      desc = $.text().trim()
    }

    return {
      platform: 'Shopify',
      name: (product.title || '').trim(),
      price: parseFloat(product.variants?.[0]?.price || '0') || 0,
      currency: 'DZD',
      description: desc,
      images: images.slice(0, 8),
      variants: product.options?.map((opt: any) => ({
        name: opt.name || '',
        options: opt.values || []
      }))
    }
  } catch {
    return null
  }
}

// ─── محرك YouCan والمتاجر العامة ─────────────────────────────────────────────
function scrapeGenericOrYouCan($: cheerio.CheerioAPI, html: string, baseUrl: string): ScrapedProduct {
  let title = $('meta[property="og:title"]').attr('content') || $('title').text() || ''
  let desc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || ''
  let price = 0
  const images: string[] = []

  // 1. فحص JSON-LD (الأولوية القصوى لمنتجات YouCan والمتاجر الموثوقة)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text() || '{}')
      const item = data['@type'] === 'Product' ? data : (data['@graph']?.find((g: any) => g['@type'] === 'Product'))
      if (item) {
        if (!title && item.name) title = item.name
        if (!desc && item.description) desc = item.description
        if (item.offers) {
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers
          price = parseFloat(offer.price || offer.lowPrice || 0) || price
        }
        if (item.image) {
          const rawImgs = Array.isArray(item.image) ? item.image : [item.image]
          rawImgs.forEach((src: any) => {
            const actualSrc = typeof src === 'string' ? src : src.url
            if (isLegitProductImage(actualSrc) && !images.includes(actualSrc)) {
              images.push(actualSrc)
            }
          })
        }
      }
    } catch {}
  })

  // 2. فحص السعر إذا لم يتوفر في JSON-LD
  if (price === 0) {
    const rawPrice = $('meta[property="product:price:amount"]').attr('content') || 
                      $('meta[property="og:price:amount"]').attr('content')
    if (rawPrice) {
      const nums = rawPrice.replace(/,/g, '').match(/[\d.]+/g)
      if (nums) price = parseFloat(nums[0]) || 0
    }
  }

  // 3. استخراج صور معارض المنتج المحددة (YouCan & Custom Galleries)
  if (images.length === 0) {
    const gallerySelectors = [
      '.product-slider img', '.preview-images img', '.main-image img', 
      '.product-gallery img', '.product__media img', '.swiper-slide img',
      'main img'
    ]
    for (const sel of gallerySelectors) {
      $(sel).each((_, el) => {
        let src = $(el).attr('data-src') || $(el).attr('data-zoom') || $(el).attr('src') || ''
        if (src) {
          if (src.startsWith('//')) src = 'https:' + src
          else if (src.startsWith('/')) src = new URL(baseUrl).origin + src

          if (isLegitProductImage(src) && !images.includes(src)) {
            images.push(src)
          }
        }
      })
      if (images.length >= 4) break
    }
  }

  // 4. استخراج OpenGraph كخيار أخير فقط إن كانت الصورة صالحة
  if (images.length === 0) {
    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr('content')
      if (src && isLegitProductImage(src) && !images.includes(src)) images.push(src)
    })
  }

  return {
    platform: 'YouCan / Generic Store',
    name: title.trim(),
    price: price,
    currency: 'DZD',
    description: desc.trim() || title.trim(),
    images: images.slice(0, 8)
  }
}

// ─── محرك Temu ──────────────────────────────────────────────────────────────
function scrapeTemu($: cheerio.CheerioAPI, html: string): ScrapedProduct {
  let title = $('meta[property="og:title"]').attr('content') || $('title').text() || ''
  let desc = $('meta[property="og:description"]').attr('content') || ''
  let price = 0
  const images: string[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text() || '{}')
      if (data['@type'] === 'Product') {
        title = data.name || title
        desc = data.description || desc
        if (data.offers?.price) price = parseFloat(data.offers.price) || 0
        if (data.image) {
          const imgs = Array.isArray(data.image) ? data.image : [data.image]
          imgs.forEach((img: string) => {
            if (isLegitProductImage(img) && !images.includes(img)) images.push(img)
          })
        }
      }
    } catch {}
  })

  return {
    platform: 'Temu',
    name: title.trim(),
    price: price,
    currency: 'DZD',
    description: desc.trim(),
    images: images.slice(0, 8)
  }
}

