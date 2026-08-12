/**
 * Client-side TypeScript types.
 *
 * Mirrors api/lib/types.ts. KEEP IN SYNC when adding fields on either side.
 *
 * MULTI-TENANCY: every domain entity carries a `storeId` field. The
 * TenantContext (src/context/TenantContext.tsx) resolves the current
 * store from `window.location.hostname` and injects `x-store-id` into
 * every outgoing API request.
 */

// ─── Multi-Tenancy primitives ───────────────────────────────────────────────

export type StorePlan = 'free_trial' | 'starter' | 'pro' | 'vip'
export type StoreStatus = 'active' | 'suspended' | 'expired'

export interface TenantStore {
  _id: string
  slug: string
  customDomain?: string
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
  email: string
  phone?: string
  /** Never sent to the client from the API — kept here only for type symmetry */
  passwordHash?: string
  role: MerchantRole
  storeIds: string[]
  createdAt: string
  updatedAt: string
}

// ─── Catalog / commerce entities ────────────────────────────────────────────

export type AttributeType = 'text' | 'textarea' | 'select' | 'multiselect' | 'color'

export interface AttributeDef {
  key: string
  label: string
  labelAr: string
  type: AttributeType
  options?: string[]
  placeholder?: string
  required?: boolean
}

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

export interface VariantConfig {
  hasColor: boolean
  hasSize: boolean
  sizeOptions: string[]
  colorPresets: { name: string; nameAr: string; hex: string }[]
}

export interface DomainCategory {
  key: string
  label: string
  labelAr: string
}

export interface StoreDomain {
  _id?: string
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

export interface Product {
  _id: string
  /** Tenant discriminator — assigned server-side on create + on seed */
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
  attributes?: Record<string, any>
  variants?: Variant[]
  tierPricing: { minQty: number; discountPercent: number; label: string; labelAr: string }[]
  createdAt: string
  domainId?: string
}

export interface WilayaRate {
  _id: string
  /** Tenant discriminator — assigned server-side on create + on seed */
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
  /** Tenant discriminator — assigned server-side on create */
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
  /** Tenant discriminator — singleton per store: _id === storeId */
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
}
