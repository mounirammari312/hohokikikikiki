// @ts-nocheck — serverless function; type-checked by Vercel at deploy time
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Amugar — Product Scraper (المستورد السحري)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Scrapes product data from external URLs (AliExpress, Shopify, YouCan,
 *  Temu, and generic e-commerce stores) so merchants can import products
 *  into their Amugar store with one click.
 *
 *  Usage:
 *    const product = await scrapeProductFromUrl(url)
 *    → { platform, name, price, currency, description, images, variants? }
 *
 *  Supported platforms:
 *    1. Shopify stores (via .json endpoint)
 *    2. AliExpress (via HTML scraping + regex extraction)
 *    3. Generic stores / YouCan (via OpenGraph meta tags)
 *
 *  Privacy: the scraper runs server-side only. The merchant's IP is not
 *  exposed to the target site (the request goes through Vercel's servers).
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

  // 3. فحص YouCan و Temu والمتاجر العامة
  return await scrapeGenericStore(url)
}

// ─── محرك استخراج AliExpress ────────────────────────────────────────────────
async function scrapeAliExpress(rawUrl: string): Promise<ScrapedProduct> {
  const itemIdMatch = rawUrl.match(/\/item\/(\d+)\.html/) || rawUrl.match(/(\d{10,20})/)
  if (!itemIdMatch) throw new Error('تعذر استخراج معرف المنتج')

  const itemId = itemIdMatch[1]
  const cleanUrl = `https://ar.aliexpress.com/item/${itemId}.html`

  const res = await fetch(cleanUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'ar-DZ,ar;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cookie': 'aep_usuc_f=site=glo&c_tp=DZD&region=DZ&b_locale=ar_MA; currency=DZD;',
    },
  })

  const html = await res.text()
  const $ = cheerio.load(html)

  // استخراج الاسم
  let title = $('meta[property="og:title"]').attr('content') || $('title').text() || ''
  title = title.replace(/(\s*-\s*AliExpress.*|\s*\|\s*AliExpress.*)/i, '').trim()

  // استخراج السعر بالدينار الجزائري
  let price = 0
  const priceMatches =
    html.match(/"formatedActivityPrice":"([^"]+)"/) ||
    html.match(/"discountPrice":\s*\{\s*"minAmount":\s*\{\s*"value":\s*([\d.]+)/) ||
    html.match(/"minAmount":\s*\{\s*"currency":\s*"[^"]+",\s*"value":\s*([\d.]+)/)

  if (priceMatches) {
    const rawVal = priceMatches[1].replace(/,/g, '')
    const numMatch = rawVal.match(/[\d.]+/)
    if (numMatch) price = parseFloat(numMatch[0])
  }

  // إذا لم يظهر السعر، قراءته من وسوم PDP في الرابط
  if (price === 0) {
    const pdpMatch = rawUrl.match(/pdp_npi=([^&]+)/)
    if (pdpMatch) {
      const decoded = decodeURIComponent(pdpMatch[1])
      const dzdMatches = [...decoded.matchAll(/([\d,.]+)\s*\+?\s*DA/g)]
      if (dzdMatches.length > 0) {
        price = parseFloat(dzdMatches[dzdMatches.length - 1][1].replace(/,/g, ''))
      }
    }
  }

  // استخراج الصور عالية الدقة
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

  // fallback: og:image
  if (images.length === 0) {
    const ogImg = $('meta[property="og:image"]').attr('content')
    if (ogImg) images.push(ogImg)
  }

  return {
    platform: 'AliExpress',
    name: title,
    price: price,
    currency: 'DZD',
    description: `منتج مستورد من AliExpress — رقم المعرف: ${itemId}`,
    images: images.slice(0, 8),
  }
}

// ─── محرك Shopify ────────────────────────────────────────────────────────────
async function tryShopifyJson(url: string): Promise<ScrapedProduct | null> {
  try {
    const cleanUrl = url.split('?')[0].replace(/\/$/, '')
    const res = await fetch(`${cleanUrl}.json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    })
    if (!res.ok) return null

    const { product } = await res.json()
    if (!product) return null

    return {
      platform: 'Shopify',
      name: product.title || '',
      price: parseFloat(product.variants?.[0]?.price || '0'),
      currency: 'DZD',
      description: product.body_html
        ? product.body_html.replace(/<[^>]*>?/gm, '').trim()
        : '',
      images: product.images?.map((img: any) => img.src) || [],
      variants: product.options?.map((opt: any) => ({
        name: opt.name,
        options: opt.values || [],
      })),
    }
  } catch {
    return null
  }
}

// ─── محرك المتاجر العامة و YouCan ───────────────────────────────────────────
async function scrapeGenericStore(url: string): Promise<ScrapedProduct> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  const title =
    $('meta[property="og:title"]').attr('content') || $('title').text() || ''
  const desc =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    ''

  let price = 0
  const priceMeta =
    $('meta[property="product:price:amount"]').attr('content') ||
    $('meta[property="og:price:amount"]').attr('content')
  if (priceMeta) price = parseFloat(priceMeta.replace(/,/g, '')) || 0

  // محاولة استخراج السعر من نص الصفحة إذا لم يوجد في meta
  if (price === 0) {
    const priceText = $('[class*="price"], [data-price], .price, .product-price')
      .first()
      .text()
      .trim()
    const numMatch = priceText.match(/[\d\s,.]+/)
    if (numMatch) {
      price = parseFloat(numMatch[0].replace(/[\s,]/g, '')) || 0
    }
  }

  const images: string[] = []
  $('meta[property="og:image"]').each((_, el) => {
    const src = $(el).attr('content')
    if (src && !images.includes(src)) images.push(src)
  })

  // محاولة استخراج صور إضافية من وسوم img
  if (images.length < 3) {
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || ''
      if (
        src &&
        (src.includes('http') || src.startsWith('//')) &&
        !src.includes('logo') &&
        !src.includes('icon') &&
        !images.includes(src)
      ) {
        images.push(src.startsWith('//') ? 'https:' + src : src)
      }
      if (images.length >= 8) return false
    })
  }

  return {
    platform: 'Custom / YouCan',
    name: title.trim(),
    price: price,
    currency: 'DZD',
    description: desc.trim(),
    images: images.slice(0, 8),
  }
}
