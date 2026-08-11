// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * Mongoose schemas/models for the LUMIÈRE store.
 *
 * Schemas are deliberately permissive (Mixed types for attributes,
 * flexible tierPricing/variants) so the admin can edit any field
 * without server-side migrations. The `_id` field is forced to String
 * type so we can use readable ids like `prod_001` instead of ObjectId.
 *
 * IMPORTANT: Each model is registered with `mongoose.models.X || mongoose.model(...)`
 * to avoid the "Cannot overwrite model once compiled" error in serverless
 * environments where the same module may be evaluated multiple times.
 */

import mongoose from 'mongoose'

const STRING_ID = { type: String, required: true } as const

// ─── Product ────────────────────────────────────────────────────────────────
const ProductSchema = new mongoose.Schema({
  _id: STRING_ID,
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
  attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
  variants: { type: [mongoose.Schema.Types.Mixed], default: [] },
  tierPricing: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdAt: { type: String, default: () => new Date().toISOString() },
  domainId: { type: String, default: null },
}, { _id: false, versionKey: false, strict: false })

// ─── Wilaya ─────────────────────────────────────────────────────────────────
const WilayaSchema = new mongoose.Schema({
  _id: STRING_ID,
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  nameAr: { type: String, required: true },
  deliveryHome: { type: Number, default: 600 },
  deliveryDesk: { type: Number, default: 400 },
  isActive: { type: Boolean, default: true },
  deliveryDays: { type: String, default: '48 ساعة' },
}, { _id: false, versionKey: false, strict: false })

// ─── Order ──────────────────────────────────────────────────────────────────
const OrderSchema = new mongoose.Schema({
  _id: STRING_ID,
  orderNumber: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  phone2: { type: String, default: '' },
  wilaya: { type: String, required: true },
  wilayaNameAr: { type: String, default: '' },
  commune: { type: String, required: true },
  address: { type: String, required: true },
  deliveryType: { type: String, enum: ['home', 'desk'], default: 'home' },
  items: { type: [mongoose.Schema.Types.Mixed], default: [] },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['new', 'confirmed', 'shipping', 'delivered', 'cancelled'],
    default: 'new'
  },
  notes: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
}, { _id: false, versionKey: false, strict: false })

// Index for the duplicate-order signature check
OrderSchema.index({ phone: 1, createdAt: -1 })

// ─── Settings (singleton document) ──────────────────────────────────────────
const SettingsSchema = new mongoose.Schema({
  _id: STRING_ID,
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
}, { _id: false, versionKey: false, strict: false })

// ─── Domain ─────────────────────────────────────────────────────────────────
const DomainSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  nameAr: { type: String, required: true },
  descriptionAr: { type: String, default: '' },
  heroBadge: { type: String, default: '' },
  heroTitleAr: { type: String, default: '' },
  heroSubtitleAr: { type: String, default: '' },
  heroImage: { type: String, default: '' },
  footerDescriptionAr: { type: String, default: '' },
  categories: { type: [mongoose.Schema.Types.Mixed], default: [] },
  attributeSchema: { type: [mongoose.Schema.Types.Mixed], default: [] },
  variantConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  isPreset: { type: Boolean, default: false },
}, { _id: false, versionKey: false, strict: false })

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
