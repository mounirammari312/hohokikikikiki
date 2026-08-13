// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * Shared TypeScript types for the server-side API routes.
 *
 * These mirror the client-side types in src/services/api/types.ts.
 * We keep them separate so the server doesn't import client code
 * (which would pull Vite-specific imports into a Node.js context).
 *
 * MULTI-TENANCY: Every domain entity carries a `storeId` field that
 * ties it to a TenantStore document. The tenant is resolved per-request
 * by the dynamic-tenant middleware in api/index.ts.
 */

// ─── Multi-Tenancy primitives ───────────────────────────────────────────────

export type StorePlan = 'free_trial' | 'starter' | 'pro' | 'vip'
export type StoreStatus = 'active' | 'suspended' | 'expired'

export interface TenantStore {
  _id: string
  /** URL-friendly slug used for the subdomain: slug.platform.com */
  slug: string
  /** Optional custom domain (e.g. mystore.com) pointed at the platform */
  customDomain?: string
  /** Owner MerchantUser _id */
  ownerId: string
  name: string
  nameAr: string
  status: StoreStatus
  plan: StorePlan
  planExpiresAt?: string
  createdAt: string
  updatedAt: string
}

export type MerchantRole = 'super_admin' | 'merchant'

export interface MerchantUser {
  _id: string
  fullName: string
  /** Unique email used as login */
  email: string
  phone?: string
  /** bcrypt hash — never returned to the client */
  passwordHash: string
  role: MerchantRole
  /** Store _ids this merchant owns / can access */
  storeIds: string[]
  createdAt: string
  updatedAt: string
}

// ─── Catalog / commerce entities (each tied to a storeId) ───────────────────

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
  /** Tenant discriminator — every product belongs to exactly one store */
  storeId?: string
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
  /** Tenant discriminator — merchants can override defaults per store */
  storeId?: string
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
  /** Tenant discriminator — every order belongs to exactly one store */
  storeId?: string
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
  _id?: string
  /** Tenant discriminator — singleton per store: settings doc _id = storeId */
  storeId?: string
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

  // ─── Delivery Integrations (شركات التوصيل الجزائرية) ──────────────
  /** Yalidine — https://yalidine.app/ */
  yalidineEnabled: boolean
  yalidineApiId: string      // X-API-ID
  yalidineApiToken: string   // X-API-TOKEN
  /** ZR Express — https://zrexpress.com/ */
  zrExpressEnabled: boolean
  zrExpressApiKey: string
  zrExpressApiSecret: string

  // Theme Colors (customizable by merchant)
  primaryColor: string
  secondaryColor: string
  bgColor: string
  cardBgColor: string
  textColor: string
  accentColor: string

  // Customizable storefront texts
  editorialTitle: string
  editorialText1: string
  editorialText2: string
  review1Name: string
  review1Text: string
  review2Name: string
  review2Text: string
  review3Name: string
  review3Text: string
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
  _id?: string
  /** Tenant discriminator */
  storeId?: string
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
