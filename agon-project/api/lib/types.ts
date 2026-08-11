// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * Shared TypeScript types for the server-side API routes.
 *
 * These mirror the client-side types in src/services/api/types.ts.
 * We keep them separate so the server doesn't import client code
 * (which would pull Vite-specific imports into a Node.js context).
 */

export interface Variant {
  id: string
  sku?: string
  color?: string
  colorAr?: string
  colorHex?: string
  size?: string
  stock: number
  priceAdjustment?: number
  image?: string
}

export interface Product {
  _id: string
  sku: string
  name: string
  nameAr: string
  description: string
  descriptionAr: string
  price: number
  compareAtPrice?: number
  images: string[]
  category: string
  material: string
  materialAr: string
  rating: number
  reviewsCount: number
  stock: number
  isFeatured: boolean
  isNew: boolean
  attributes?: Record<string, unknown>
  variants?: Variant[]
  tierPricing: { minQty: number; discountPercent: number; label: string; labelAr: string }[]
  createdAt: string
  domainId?: string
}

export interface WilayaRate {
  _id: string
  code: string
  name: string
  nameAr: string
  deliveryHome: number
  deliveryDesk: number
  isActive: boolean
  deliveryDays: string
}

export interface OrderItem {
  productId: string
  nameAr: string
  image: string
  qty: number
  unitPrice: number
  total: number
  variantLabel?: string
  variantId?: string
}

export type OrderStatus = 'new' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled'

export interface Order {
  _id: string
  orderNumber: string
  customerName: string
  phone: string
  phone2?: string
  wilaya: string
  wilayaNameAr: string
  commune: string
  address: string
  deliveryType: 'home' | 'desk'
  items: OrderItem[]
  subtotal: number
  discount: number
  shippingCost: number
  total: number
  status: OrderStatus
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface StoreSettings {
  metaPixelId: string
  tiktokPixelId: string
  storeName: string
  storeNameAr: string
  currency: string
  enableCod: boolean
  phone: string
  whatsapp: string
  email: string
  announcement: string
  freeShippingThreshold: number
  heroTitleAr: string
  heroSubtitleAr: string
  heroBadge: string
  footerDescriptionAr: string
  instagram: string
  enableRoseEdition: boolean
  activeDomainId: string
}

export interface DomainCategory {
  key: string
  label: string
  labelAr: string
}

export interface AttributeDef {
  key: string
  label: string
  labelAr: string
  type: string
  options?: string[]
  placeholder?: string
  required?: boolean
}

export interface VariantConfig {
  hasColor: boolean
  hasSize: boolean
  sizeOptions: string[]
  colorPresets: { name: string; nameAr: string; hex: string }[]
}

export interface StoreDomain {
  id: string
  name: string
  nameAr: string
  descriptionAr: string
  heroBadge: string
  heroTitleAr: string
  heroSubtitleAr: string
  heroImage: string
  footerDescriptionAr: string
  categories: DomainCategory[]
  attributeSchema: AttributeDef[]
  variantConfig: VariantConfig
  isPreset?: boolean
}
