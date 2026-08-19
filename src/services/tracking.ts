// Tracking abstraction layer 2026 - Meta Pixel + TikTok Pixel + E-commerce events
import { getSettings } from './api/settings'

type EventName = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'Search' | 'Contact'

interface PixelEventPayload {
  event: EventName
  value?: number
  currency?: string
  contents?: any[]
  content_ids?: string[]
  num_items?: number
}

function logPixel(provider: string, payload: PixelEventPayload) {
  console.log(`%c[PIXEL ${provider}]`, 'color:#E6007E;font-weight:bold', payload)
  // In production would call fbq('track', ...) and ttq.track(...)
  // Persist event to localStorage for audit
  const key = 'amugar_pixel_logs'
  const logs = JSON.parse(localStorage.getItem(key) || '[]')
  logs.unshift({ provider, ...payload, at: new Date().toISOString() })
  localStorage.setItem(key, JSON.stringify(logs.slice(0,100)))
}

export const Tracking = {
  pageView(path: string){
    const s = getSettings()
    logPixel(`Meta:${s.metaPixelId}`, { event: 'ViewContent' as any, contents: [{ path }] })
  },
  viewContent(productId: string, value: number){
    const s = getSettings()
    logPixel(`Meta:${s.metaPixelId}`, { event:'ViewContent', value, currency:'DZD', content_ids:[productId] })
    logPixel(`TikTok:${s.tiktokPixelId}`, { event:'ViewContent', value, currency:'DZD', content_ids:[productId] })
  },
  addToCart(productId: string, qty:number, value:number){
    const s = getSettings()
    logPixel(`Meta:${s.metaPixelId}`, { event:'AddToCart', value, currency:'DZD', content_ids:[productId], num_items: qty })
    logPixel(`TikTok:${s.tiktokPixelId}`, { event:'AddToCart', value, currency:'DZD', content_ids:[productId], num_items: qty })
  },
  initiateCheckout(value:number, num_items:number){
    const s = getSettings()
    logPixel(`Meta:${s.metaPixelId}`, { event:'InitiateCheckout', value, currency:'DZD', num_items })
    logPixel(`TikTok:${s.tiktokPixelId}`, { event:'InitiateCheckout', value, currency:'DZD', num_items })
  },
  purchase(orderNumber:string, value:number, contents:any[]){
    const s = getSettings()
    logPixel(`Meta:${s.metaPixelId}`, { event:'Purchase', value, currency:'DZD', contents, num_items: contents.length })
    logPixel(`TikTok:${s.tiktokPixelId}`, { event:'Purchase', value, currency:'DZD', contents })
    console.log(`%c[CONVERSION] Order ${orderNumber} - ${value} DZD`, 'color:green;font-weight:bold')
  }
}
