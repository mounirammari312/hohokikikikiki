// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * Mongoose schemas/models — MULTI-TENANT version.
 *
 * Every domain schema (Product, Order, Settings, Domain, Wilaya) carries
 * a `storeId: String` field, indexed for fast filtering. All server-side
 * queries scope by `{ storeId }` so stores can never read or write each
 * other's data.
 *
 * The two new schemas (TenantStore, MerchantUser) hold the platform-level
 * metadata that the dynamic-tenant middleware uses to resolve which
 * store a request belongs to.
 *
 * IMPORTANT: Each model is registered with `mongoose.models.X || mongoose.model(...)`
 * to avoid the "Cannot overwrite model once compiled" error in serverless
 * environments where the same module may be evaluated multiple times.
 */

import mongoose from 'mongoose'

const STRING_ID = { type: String, required: true } as const
const { Mixed } = mongoose.Schema.Types

// ─── TenantStore (one document per merchant store) ──────────────────────────
const TenantStoreSchema = new mongoose.Schema({
  _id: STRING_ID,
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  // IMPORTANT: `default: undefined` (not `null`) so that when a store is
  // created without a custom domain, the field is missing from the document
  // entirely. Combined with `sparse: true`, this means MongoDB skips
  // indexing those documents — preventing the E11000 duplicate key error
  // that occurs when multiple stores all have `customDomain: null`.
  customDomain: { type: String, default: undefined, unique: true, sparse: true, lowercase: true, trim: true, index: true },
  ownerId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  nameAr: { type: String, default: '' },
  status: { type: String, enum: ['active', 'suspended', 'expired'], default: 'active', index: true },
  plan: { type: String, enum: ['free_trial', 'starter', 'pro', 'vip'], default: 'free_trial' },
  planExpiresAt: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
}, { _id: false, versionKey: false, strict: false })

// ─── MerchantUser (auth + ownership) ────────────────────────────────────────
const MerchantUserSchema = new mongoose.Schema({
  _id: STRING_ID,
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['super_admin', 'merchant'], default: 'merchant', index: true },
  storeIds: { type: [String], default: [] },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
}, { _id: false, versionKey: false, strict: false })

// ─── Product (scoped to a store) ────────────────────────────────────────────
const ProductSchema = new mongoose.Schema({
  _id: STRING_ID,
  storeId: { type: String, required: true, index: true },
  sku: { type: String, default: '' },
  name: { type: String, required: true },
  nameAr: { type: String, required: true },
  description: { type: String, default: '' },
  descriptionAr: { type: String, default: '' },
  price: { type: Number, default: 0 },
  compareAtPrice: { type: Number, default: null },
  images: { type: [String], default: [] },
  category: { type: String, default: 'general' },
  material: { type: String, default: '' },
  materialAr: { type: String, default: '' },
  rating: { type: Number, default: 4.8 },
  reviewsCount: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  isFeatured: { type: Boolean, default: false },
  isNew: { type: Boolean, default: false },
  attributes: { type: Mixed, default: {} },
  variants: { type: [Mixed], default: [] },
  tierPricing: { type: [Mixed], default: [] },
  createdAt: { type: String, default: () => new Date().toISOString() },
  domainId: { type: String, default: null },
}, { _id: false, versionKey: false, strict: false })
ProductSchema.index({ storeId: 1, createdAt: -1 })
ProductSchema.index({ storeId: 1, category: 1 })

// ─── Wilaya (per-store override of the 58 Algerian wilayas) ─────────────────
const WilayaSchema = new mongoose.Schema({
  _id: STRING_ID,
  storeId: { type: String, required: true, index: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  nameAr: { type: String, required: true },
  deliveryHome: { type: Number, default: 600 },
  deliveryDesk: { type: Number, default: 400 },
  isActive: { type: Boolean, default: true },
  deliveryDays: { type: String, default: '48 ساعة' },
}, { _id: false, versionKey: false, strict: false })
WilayaSchema.index({ storeId: 1, code: 1 }, { unique: true })

// ─── Order (scoped to a store) ──────────────────────────────────────────────
const OrderSchema = new mongoose.Schema({
  _id: STRING_ID,
  storeId: { type: String, required: true, index: true },
  orderNumber: { type: String, required: true },
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  phone2: { type: String, default: '' },
  wilaya: { type: String, required: true },
  wilayaNameAr: { type: String, default: '' },
  commune: { type: String, required: true },
  address: { type: String, required: true },
  deliveryType: { type: String, enum: ['home', 'desk'], default: 'home' },
  items: { type: [Mixed], default: [] },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['new', 'confirmed', 'shipping', 'delivered', 'cancelled'],
    default: 'new',
  },
  notes: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
}, { _id: false, versionKey: false, strict: false })
OrderSchema.index({ storeId: 1, createdAt: -1 })
OrderSchema.index({ storeId: 1, orderNumber: 1 }, { unique: true })
OrderSchema.index({ storeId: 1, phone: 1, createdAt: -1 })

// ─── Settings (singleton per store: _id === storeId) ────────────────────────
const SettingsSchema = new mongoose.Schema({
  _id: STRING_ID,
  storeId: { type: String, required: true, unique: true, index: true },
  metaPixelId: { type: String, default: '' },
  tiktokPixelId: { type: String, default: '' },
  storeName: { type: String, default: 'LUMIÈRE' },
  storeNameAr: { type: String, default: 'لوميير' },
  currency: { type: String, default: 'د.ج' },
  enableCod: { type: Boolean, default: true },
  phone: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
  email: { type: String, default: '' },
  announcement: { type: String, default: '' },
  freeShippingThreshold: { type: Number, default: 15000 },
  heroTitleAr: { type: String, default: '' },
  heroSubtitleAr: { type: String, default: '' },
  heroBadge: { type: String, default: '' },
  footerDescriptionAr: { type: String, default: '' },
  instagram: { type: String, default: '' },
  enableRoseEdition: { type: Boolean, default: false },
  activeDomainId: { type: String, default: 'domain_jewelry' },

  // ─── Delivery Integrations (شركات التوصيل الجزائرية) ──────────────
  // Yalidine — https://yalidine.app/  (developer portal for API keys)
  yalidineEnabled: { type: Boolean, default: false },
  yalidineApiId: { type: String, default: '' },     // X-API-ID
  yalidineApiToken: { type: String, default: '' },  // X-API-TOKEN
  // ZR Express — https://zrexpress.com/
  zrExpressEnabled: { type: Boolean, default: false },
  zrExpressApiKey: { type: String, default: '' },
  zrExpressApiSecret: { type: String, default: '' },

  // ─── Theme Colors (customizable by merchant) ───────────────────────
  primaryColor: { type: String, default: '#C9A96A' },     // gold accent
  secondaryColor: { type: String, default: '#1A1A1E' },   // dark base
  bgColor: { type: String, default: '#FFFCF8' },           // page background
  cardBgColor: { type: String, default: '#FFFFFF' },       // card background
  textColor: { type: String, default: '#1A1A1E' },         // main text
  accentColor: { type: String, default: '#A02A5B' },       // rose accent (CTA, badges)

  // ─── Customizable storefront texts (editable from dashboard) ──────
  // These replace the old domain-specific hardcoded texts in Home.tsx.
  // The merchant can set them to match ANY niche — electronics, digital
  // products, clothing, etc.
  editorialTitle: { type: String, default: 'جودة تلمس، أسعار تناسبك' },
  editorialText1: { type: String, default: 'جودة عالية تدوم طويلاً مع ضمان الاسترجاع 14 يوم.' },
  editorialText2: { type: String, default: 'خامات مختارة بعناية، تصميم عملي ومريح للاستعمال اليومي.' },
  review1Name: { type: String, default: 'سارة - الجزائر' },
  review1Text: { type: String, default: 'وصلني في 24 ساعة، الجودة ممتازة والتغليف فخم جداً!' },
  review2Name: { type: String, default: 'أمينة - وهران' },
  review2Text: { type: String, default: 'خدمة رائعة، اتصلوا بي للتأكيد وأعطوني نصائح للحفاظ على الجودة.' },
  review3Name: { type: String, default: 'نور - قسنطينة' },
  review3Text: { type: String, default: 'أخذت عرض 3 قطع ووفّرت 18%، الجودة ممتازة والسعر معقول.' },
}, { _id: false, versionKey: false, strict: false })

// ─── Domain (store-scoped category presets) ─────────────────────────────────
const DomainSchema = new mongoose.Schema({
  _id: STRING_ID,
  storeId: { type: String, required: true, index: true },
  id: { type: String, required: true },
  name: { type: String, required: true },
  nameAr: { type: String, required: true },
  descriptionAr: { type: String, default: '' },
  heroBadge: { type: String, default: '' },
  heroTitleAr: { type: String, default: '' },
  heroSubtitleAr: { type: String, default: '' },
  heroImage: { type: String, default: '' },
  footerDescriptionAr: { type: String, default: '' },
  categories: { type: [Mixed], default: [] },
  attributeSchema: { type: [Mixed], default: [] },
  variantConfig: { type: Mixed, default: {} },
  isPreset: { type: Boolean, default: false },
}, { _id: false, versionKey: false, strict: false })
DomainSchema.index({ storeId: 1, id: 1 }, { unique: true })

export const TenantStoreModel =
  mongoose.models.TenantStore || mongoose.model('TenantStore', TenantStoreSchema)
export const MerchantUserModel =
  mongoose.models.MerchantUser || mongoose.model('MerchantUser', MerchantUserSchema)
export const ProductModel =
  mongoose.models.Product || mongoose.model('Product', ProductSchema)
export const WilayaModel =
  mongoose.models.Wilaya || mongoose.model('Wilaya', WilayaSchema)
export const OrderModel =
  mongoose.models.Order || mongoose.model('Order', OrderSchema)
export const SettingsModel =
  mongoose.models.Settings || mongoose.model('Settings', SettingsSchema)
export const DomainModel =
  mongoose.models.Domain || mongoose.model('Domain', DomainSchema)
