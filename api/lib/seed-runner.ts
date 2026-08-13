// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * Seeds the MongoDB database with default data on first run.
 *
 * MULTI-TENANCY: seeding now happens per-store. When a new TenantStore
 * is created (via /api/stores POST), `seedStore(storeId)` is called to
 * populate that store with default products, wilayas, domains, and
 * settings. The platform-level seed (`ensureSeeded`) only creates the
 * default demo store + super admin account.
 */

import bcrypt from 'bcryptjs'
import {
  ProductModel, WilayaModel, SettingsModel, DomainModel,
  TenantStoreModel, MerchantUserModel,
} from './models.js'
import { seedProducts, seedWilayas, presetDomains, defaultSettings } from './seed.js'
import type { StoreSettings } from './types.js'

// Re-export so API routes can import everything from a single module
export { seedProducts, seedWilayas, presetDomains, defaultSettings }

/** Default tenant id used by the demo store + super admin. */
export const DEFAULT_STORE_ID = 'store_default'
export const DEFAULT_STORE_SLUG = 'demo'
export const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@lumiere.saas'
export const DEFAULT_SUPER_ADMIN_PASSWORD = 'admin12345'

/** Settings doc _id === storeId (singleton per store). */
export function settingsDocId(storeId: string) {
  return storeId
}

let platformSeedPromise: Promise<void> | null = null

/**
 * Platform-level seed — creates the default demo store + super admin
 * account on first run. Called once per cold start.
 */
export async function ensureSeeded(): Promise<void> {
  if (platformSeedPromise) return platformSeedPromise
  platformSeedPromise = doPlatformSeed().catch((err) => {
    platformSeedPromise = null
    throw err
  })
  return platformSeedPromise
}

async function doPlatformSeed(): Promise<void> {
  // ─── Drop the legacy non-sparse customDomain index ────────────────
  // Older deployments created a unique index on `customDomain` WITHOUT
  // the `sparse: true` option. That index treats multiple `null` values
  // as duplicates, so creating a second store without a custom domain
  // fails with E11000. Dropping it lets Mongoose rebuild it with the
  // sparse option from the updated schema. The .catch(() => {}) makes
  // this a no-op if the index doesn't exist (e.g. fresh install).
  try {
    await (TenantStoreModel as any).collection.dropIndex('customDomain_1')
    console.log('[seed] dropped legacy customDomain_1 index (will be rebuilt as sparse)')
  } catch (_err) {
    // Index doesn't exist or collection not yet created — safe to ignore.
  }

  // ─── Drop the legacy non-unique (storeId, sku) index ──────────────
  // Older deployments had a non-unique `storeId_1_sku_1` index (or none
  // at all). The new schema declares it as `unique: true`, but MongoDB
  // won't rebuild an existing index automatically — so we drop it here
  // and let Mongoose recreate it with the unique flag on the next write.
  try {
    await (ProductModel as any).collection.dropIndex('storeId_1_sku_1')
    console.log('[seed] dropped legacy storeId_1_sku_1 index (will be rebuilt as unique)')
  } catch (_err) {
    // Index doesn't exist (fresh install) — safe to ignore.
  }

  // ─── Default demo TenantStore ──────────────────────────────────────
  const existingStore = await TenantStoreModel.findById(DEFAULT_STORE_ID).lean()
  if (!existingStore) {
    await TenantStoreModel.create({
      _id: DEFAULT_STORE_ID,
      slug: DEFAULT_STORE_SLUG,
      // NOTE: customDomain intentionally omitted — see models.ts comment.
      // Setting it to null would trigger E11000 on the unique index when
      // other stores without custom domains are created.
      ownerId: 'su_admin',
      name: 'LUMIÈRE Demo',
      nameAr: 'لوميير تجريبي',
      status: 'active',
      plan: 'vip',
      planExpiresAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    console.log(`[seed] created default TenantStore ${DEFAULT_STORE_ID} (slug=${DEFAULT_STORE_SLUG})`)
    // Seed the demo store's catalog
    await seedStoreData(DEFAULT_STORE_ID)
  }

  // ─── Super admin account ───────────────────────────────────────────
  const existingAdmin = await MerchantUserModel.findOne({ email: DEFAULT_SUPER_ADMIN_EMAIL }).lean()
  if (!existingAdmin) {
    // Use a real bcrypt hash so the stored credentials are secure
    // (the PLAIN: dev placeholder is no longer acceptable).
    const hash = await bcrypt.hash(DEFAULT_SUPER_ADMIN_PASSWORD, 10)
    await MerchantUserModel.create({
      _id: 'su_admin',
      fullName: 'Super Admin',
      email: DEFAULT_SUPER_ADMIN_EMAIL,
      phone: '0550 12 34 56',
      passwordHash: hash,
      role: 'super_admin',
      storeIds: [DEFAULT_STORE_ID],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    console.log(`[seed] created super admin ${DEFAULT_SUPER_ADMIN_EMAIL}`)
  }
}

/**
 * Populate a fresh store with default catalog (products, wilayas,
 * domains, settings). Called when a new TenantStore is created.
 * Idempotent — safe to call on a store that already has data.
 *
 * IMPORTANT: New stores get a small GENERIC starter pack (3 sample
 * products with neutral copy + Unsplash images) instead of the
 * 18-product jewelry catalog. The merchant is expected to delete these
 * and add their own products. The full jewelry catalog (`seedProducts`)
 * is still used for the demo store (`store_default`) — but only when
 * the demo store is first created (which already happened in any
 * existing deployment, so this is a no-op for production).
 */
export async function seedStoreData(storeId: string): Promise<void> {
  // ─── Generic starter pack ──────────────────────────────────────────
  // 3 neutral sample products. The merchant will replace these with
  // their real catalog. Using a fixed `_id` namespace (`prod_starter_*`)
  // and `STARTER-*` SKUs keeps them easy to identify + delete.
  const genericStarterProducts = [
    {
      _id: 'prod_starter_1', sku: 'STARTER-001',
      name: 'Sample Product 1', nameAr: 'منتج تجريبي 1',
      description: 'Edit this product or delete it and add your own.',
      descriptionAr: 'عدّل هذا المنتج أو احذفه وأضف منتجاتك الخاصة.',
      price: 1000, compareAtPrice: 1500,
      images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'],
      category: 'general', material: 'Sample', materialAr: 'تجريبي',
      rating: 4.8, reviewsCount: 0, stock: 50, isFeatured: true, isNew: true,
      tierPricing: [{minQty:2,discountPercent:10,label:"Duo",labelAr:"عرض الثنائي"}],
      createdAt: new Date().toISOString()
    },
    {
      _id: 'prod_starter_2', sku: 'STARTER-002',
      name: 'Sample Product 2', nameAr: 'منتج تجريبي 2',
      description: 'Another sample — replace with your own products.',
      descriptionAr: 'منتج تجريبي آخر — استبدله بمنتجاتك.',
      price: 2500,
      images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80'],
      category: 'general', material: 'Sample', materialAr: 'تجريبي',
      rating: 4.9, reviewsCount: 0, stock: 30, isFeatured: false, isNew: true,
      tierPricing: [],
      createdAt: new Date().toISOString()
    },
    {
      _id: 'prod_starter_3', sku: 'STARTER-003',
      name: 'Sample Product 3', nameAr: 'منتج تجريبي 3',
      description: 'Third sample product for your new store.',
      descriptionAr: 'ثالث منتج تجريبي لمتجرك الجديد.',
      price: 5000, compareAtPrice: 6500,
      images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80'],
      category: 'general', material: 'Sample', materialAr: 'تجريبي',
      rating: 4.7, reviewsCount: 0, stock: 20, isFeatured: true, isNew: false,
      tierPricing: [{minQty:3,discountPercent:15,label:"Trio",labelAr:"عرض الثلاثي"}],
      createdAt: new Date().toISOString()
    },
  ]

  // ─── Products ──────────────────────────────────────────────────────
  const productCount = await ProductModel.countDocuments({ storeId })
  if (productCount === 0) {
    const stamped = genericStarterProducts.map(p => ({ ...p, storeId }))
    await ProductModel.insertMany(stamped, { ordered: false }).catch(() => {})
    console.log(`[seed] inserted ${genericStarterProducts.length} generic starter products for store ${storeId}`)
  }

  // ─── Wilayas ───────────────────────────────────────────────────────
  const wilayaCount = await WilayaModel.countDocuments({ storeId })
  if (wilayaCount === 0) {
    const stamped = seedWilayas.map(w => ({ ...w, storeId }))
    await WilayaModel.insertMany(stamped, { ordered: false }).catch(() => {})
    console.log(`[seed] inserted ${seedWilayas.length} wilayas for store ${storeId}`)
  }

  // ─── Domains ───────────────────────────────────────────────────────
  for (const preset of presetDomains) {
    await DomainModel.updateOne(
      { storeId, id: preset.id },
      { $set: { ...preset, storeId, _id: `${storeId}__${preset.id}` } },
      { upsert: true }
    ).catch(() => {})
  }
  console.log(`[seed] synced ${presetDomains.length} preset domains for store ${storeId}`)

  // ─── Settings ──────────────────────────────────────────────────────
  const settings = await SettingsModel.findById(settingsDocId(storeId)).lean()
  if (!settings) {
    await SettingsModel.create({
      _id: settingsDocId(storeId),
      storeId,
      ...defaultSettings,
    })
    console.log(`[seed] inserted default settings for store ${storeId}`)
  } else {
    // Merge any new default fields that didn't exist in the DB yet
    const update: Partial<StoreSettings> = {}
    for (const [k, v] of Object.entries(defaultSettings)) {
      if ((settings as any)[k] === undefined) (update as any)[k] = v
    }
    if (Object.keys(update).length) {
      await SettingsModel.updateOne({ _id: settingsDocId(storeId) }, { $set: update })
      console.log(`[seed] synced ${Object.keys(update).length} new settings fields for store ${storeId}`)
    }
  }
}
