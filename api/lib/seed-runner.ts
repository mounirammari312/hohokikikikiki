// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * Seeds the MongoDB database with default data on first run.
 *
 * Strategy:
 *  - For each collection, check if it's empty.
 *  - If empty, insert the seed data.
 *  - If not empty, do nothing (preserve user edits).
 *
 * Special case for `domains` and `settings`:
 *  - Preset domains are force-refreshed on every seed run so that any
 *    schema additions (new attributes, new size options) get synced to
 *    the DB without overwriting the user's custom domains or settings.
 *
 * This is called by the API routes on first access (lazy seeding).
 */

import { ProductModel, WilayaModel, SettingsModel, DomainModel } from './models.js'
import { seedProducts, seedWilayas, presetDomains, defaultSettings } from './seed.js'
import type { StoreSettings } from './types.js'

// Re-export so API routes can import everything from a single module
export { seedProducts, seedWilayas, presetDomains, defaultSettings }

const SETTINGS_DOC_ID = 'singleton'

let seedPromise: Promise<void> | null = null

export async function ensureSeeded(): Promise<void> {
  // De-dupe concurrent calls within the same warm serverless instance
  if (seedPromise) return seedPromise
  seedPromise = doSeed().catch((err) => {
    // Reset so a future call can retry
    seedPromise = null
    throw err
  })
  return seedPromise
}

async function doSeed(): Promise<void> {
  // ─── Products ──────────────────────────────────────────────────────
  // يدخل المنتجات الافتراضية فقط إذا كانت القاعدة فارغة تماماً أول مرة
  const productCount = await ProductModel.estimatedDocumentCount()
  if (productCount === 0) {
    await ProductModel.insertMany(seedProducts as any, { ordered: false }).catch(() => {})
    console.log(`[seed] inserted ${seedProducts.length} products`)
  }

  // ─── Wilayas ───────────────────────────────────────────────────────
  const wilayaCount = await WilayaModel.estimatedDocumentCount()
  if (wilayaCount === 0) {
    await WilayaModel.insertMany(seedWilayas as any, { ordered: false }).catch(() => {})
    console.log(`[seed] inserted ${seedWilayas.length} wilayas`)
  }

  // ─── Domains ───────────────────────────────────────────────────────
  for (const preset of presetDomains) {
    await DomainModel.updateOne(
      { id: preset.id },
      { $set: preset as any },
      { upsert: true }
    ).catch(() => {})
  }
  console.log(`[seed] synced ${presetDomains.length} preset domains`)

  // ─── Settings ──────────────────────────────────────────────────────
  const settings = await SettingsModel.findById(SETTINGS_DOC_ID).lean()
  if (!settings) {
    await SettingsModel.create({ _id: SETTINGS_DOC_ID, ...defaultSettings })
    console.log('[seed] inserted default settings')
  } else {
    // Merge any new default fields that didn't exist in the DB yet
    const update: Partial<StoreSettings> = {}
    for (const [k, v] of Object.entries(defaultSettings)) {
      if ((settings as any)[k] === undefined) (update as any)[k] = v
    }
    if (Object.keys(update).length) {
      await SettingsModel.updateOne({ _id: SETTINGS_DOC_ID }, { $set: update })
      console.log(`[seed] synced ${Object.keys(update).length} new settings fields`)
    }
  }
}

export { SETTINGS_DOC_ID }

