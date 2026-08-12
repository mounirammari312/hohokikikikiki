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
  // ─── Default demo TenantStore ──────────────────────────────────────
  const existingStore = await TenantStoreModel.findById(DEFAULT_STORE_ID).lean()
  if (!existingStore) {
    await TenantStoreModel.create({
      _id: DEFAULT_STORE_ID,
      slug: DEFAULT_STORE_SLUG,
      customDomain: null,
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
    // NOTE: plain-text hash placeholder; the platform should swap this
    // out for a real bcrypt hash before production. The auth handler
    // accepts either a bcrypt-style hash OR a plaintext password marked
    // with the `PLAIN:` prefix so the demo works out-of-the-box.
    await MerchantUserModel.create({
      _id: 'su_admin',
      fullName: 'Super Admin',
      email: DEFAULT_SUPER_ADMIN_EMAIL,
      phone: '0550 12 34 56',
      passwordHash: 'PLAIN:' + DEFAULT_SUPER_ADMIN_PASSWORD,
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
 */
export async function seedStoreData(storeId: string): Promise<void> {
  // ─── Products ──────────────────────────────────────────────────────
  const productCount = await ProductModel.countDocuments({ storeId })
  if (productCount === 0) {
    const stamped = seedProducts.map(p => ({ ...p, storeId }))
    await ProductModel.insertMany(stamped, { ordered: false }).catch(() => {})
    console.log(`[seed] inserted ${seedProducts.length} products for store ${storeId}`)
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
