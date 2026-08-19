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
import { defaultDeliveryProviders, migrateLegacyDeliveryFields } from './deliveryProviders.js'
import type { StoreSettings } from './types.js'

// Re-export so API routes can import everything from a single module
export { seedProducts, seedWilayas, presetDomains, defaultSettings }

/** Default tenant id used by the demo store + super admin. */
export const DEFAULT_STORE_ID = 'store_default'
export const DEFAULT_STORE_SLUG = 'demo'
export const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@amugar.saas'
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
      name: 'Amugar Demo',
      nameAr: 'أموغار تجريبي',
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
    const hash = await bcrypt.hash(DEFAULT_SUPER_ADMIN_PASSWORD, 12)
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
  // ─── Empty store (no demo products) ──────────────────────────────────
  // Previously we seeded 3 sample products ("منتج تجريبي 1/2/3") with
  // Unsplash photos. This caused major merchant confusion: they'd open
  // their store and find someone else's products + images, then spend
  // time deleting them. NOT professional.
  //
  // Now: the store starts EMPTY. The dashboard shows a friendly
  // "أضف منتجك الأول" empty state (handled in the Admin UI). The
  // merchant adds their OWN products from the start — no cleanup needed.
  //
  // Wilayas (58 shipping rates) + domains (jewelry/fashion/beauty
  // presets) + settings ARE still seeded because those are infrastructure
  // the merchant needs immediately, not content they need to replace.

  // ─── Products — EMPTY (no demo products) ────────────────────────────
  // The merchant's store starts with 0 products. The Admin dashboard
  // shows an empty state with a "أضف منتجك الأول" CTA.
  const productCount = await ProductModel.countDocuments({ storeId })
  if (productCount === 0) {
    console.log(`[seed] store ${storeId} starts empty (no demo products) — merchant will add their own`)
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
    // Fresh store — populate defaultSettings + the full providers list
    // (one entry per provider in the registry, all disabled by default).
    await SettingsModel.create({
      _id: settingsDocId(storeId),
      storeId,
      ...defaultSettings,
      deliveryProviders: defaultDeliveryProviders(),
    })
    console.log(`[seed] inserted default settings for store ${storeId}`)
  } else {
    // Merge any new default fields that didn't exist in the DB yet
    const update: Partial<StoreSettings> = {}
    for (const [k, v] of Object.entries(defaultSettings)) {
      if ((settings as any)[k] === undefined) (update as any)[k] = v
    }

    // ─── Migrate legacy yalidine/zrexpress fields → deliveryProviders[] ──
    // Also ensures every provider in the registry has an entry (so
    // newly-added providers show up automatically on existing stores).
    const asDoc: any = { ...settings, ...(update as any) }
    const touched = migrateLegacyDeliveryFields(asDoc)
    if (touched.length || !Array.isArray((settings as any).deliveryProviders)) {
      (update as any).deliveryProviders = asDoc.deliveryProviders
    }

    if (Object.keys(update).length) {
      await SettingsModel.updateOne({ _id: settingsDocId(storeId) }, { $set: update })
      console.log(`[seed] synced ${Object.keys(update).length} settings fields for store ${storeId} (delivery providers: ${touched.length ? touched.join(',') : 'none'})`)
    }
  }
}
