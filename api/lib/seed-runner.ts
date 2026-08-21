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
  CouponModel, BannerModel,
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
  // Use findOneAndUpdate + upsert (atomic) to avoid E11000 duplicate key
  // on serverless when multiple instances run ensureSeeded() simultaneously.
  await TenantStoreModel.findOneAndUpdate(
    { _id: DEFAULT_STORE_ID },
    {
      $setOnInsert: {
        slug: DEFAULT_STORE_SLUG,
        ownerId: 'su_admin',
        name: 'Amugar Demo',
        nameAr: 'أموغار تجريبي',
        status: 'active',
        plan: 'vip',
        planExpiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },
    { upsert: true, new: true }
  ).lean()

  // Always seed the demo store's catalog (idempotent — only inserts if empty)
  await seedStoreData(DEFAULT_STORE_ID)

  // ─── Migrate legacy stores: switch from specialized domains → "domain_general" ──
  // Old deployments had `activeDomainId: "domain_jewelry"` (or fashion/beauty)
  // as the default for every new merchant. This caused confusion — a merchant
  // selling electronics would see jewelry-themed storefront. This migration
  // updates existing stores that STILL have a specialized domain default
  // (and never explicitly switched + have no products of that domain)
  // to the new "domain_general" default.
  try {
    const specializedDomains = ['domain_jewelry', 'domain_fashion', 'domain_beauty']
    const legacyStores = await SettingsModel.find({
      activeDomainId: { $in: specializedDomains },
    }).lean()
    if (legacyStores.length > 0) {
      let migrated = 0
      for (const s of legacyStores) {
        // Check if the store has ANY products matching the domain's categories
        // If yes → they're a real specialized store, skip migration
        const domainPreset = (presetDomains as any[]).find(p => p.id === s.activeDomainId)
        const domainCategoryKeys = (domainPreset?.categories || []).map((c: any) => c.key)
        const hasMatchingProducts = domainCategoryKeys.length > 0
          ? await ProductModel.countDocuments({
              storeId: s.storeId,
              category: { $in: domainCategoryKeys },
              deletedAt: null,
            })
          : 0
        if (hasMatchingProducts === 0) {
          await SettingsModel.updateOne(
            { _id: s._id },
            { $set: { activeDomainId: 'domain_general', updatedAt: new Date().toISOString() } }
          )
          migrated++
        }
      }
      if (migrated > 0) {
        console.log(`[seed] migrated ${migrated} store(s) from specialized → domain_general`)
      }
    }
  } catch (err) {
    // Non-critical — don't fail the seed
    console.warn('[seed] domain migration skipped:', err)
  }

  // ─── Super admin account ───────────────────────────────────────────
  // CRITICAL: Check by BOTH email AND _id to avoid E11000 duplicate key
  // error on serverless. On Vercel, multiple instances can run
  // ensureSeeded() simultaneously — both check "existingAdmin" = null,
  // both try to create su_admin, the second one crashes with E11000.
  // Fix: use findOneAndUpdate with upsert (atomic) instead of find+create.
  const hash = await bcrypt.hash(DEFAULT_SUPER_ADMIN_PASSWORD, 12)
  await MerchantUserModel.findOneAndUpdate(
    { $or: [{ email: DEFAULT_SUPER_ADMIN_EMAIL }, { _id: 'su_admin' }] },
    {
      $setOnInsert: {
        _id: 'su_admin',
        fullName: 'Super Admin',
        email: DEFAULT_SUPER_ADMIN_EMAIL,
        phone: '0550 12 34 56',
        passwordHash: hash,
        role: 'super_admin',
        storeIds: [DEFAULT_STORE_ID],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },
    { upsert: true, new: true }
  ).lean()

  // ─── Default marketplace coupons ───────────────────────────────────
  // Only seed if collection is empty — admin can add/edit/delete later.
  const couponCount = await CouponModel.estimatedDocumentCount()
  if (couponCount === 0) {
    await CouponModel.insertMany([
      {
        _id: 'coupon_welcome_500',
        code: 'AMUGAR500',
        description: 'Welcome coupon — 500 DZD off first order',
        descriptionAr: 'كوبون ترحيبي — خصم 500 د.ج على أول طلب',
        discountType: 'fixed',
        discountValue: 500,
        minOrderValue: 2000,
        maxRedemptions: 0,
        redeemedCount: 0,
        startsAt: new Date().toISOString(),
        expiresAt: null,
        isActive: true,
        color: 'rose',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'coupon_10_percent',
        code: 'WELCOME10',
        description: '10% off your first order',
        descriptionAr: 'خصم 10% على أول طلب',
        discountType: 'percent',
        discountValue: 10,
        minOrderValue: 3000,
        maxRedemptions: 0,
        redeemedCount: 0,
        startsAt: new Date().toISOString(),
        expiresAt: null,
        isActive: true,
        color: 'gold',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    console.log('[seed] inserted 2 default coupons')
  }

  // ─── Default marketplace banners ───────────────────────────────────
  // Only seed if collection is empty — admin can add/edit/delete later.
  const bannerCount = await BannerModel.estimatedDocumentCount()
  if (bannerCount === 0) {
    await BannerModel.insertMany([
      {
        _id: 'banner_free_delivery',
        order: 1,
        badge: 'توصيل مجاني',
        badgeAr: 'توصيل مجاني',
        icon: 'Truck',
        title: 'توصيل مجاني لكل الولايات',
        titleAr: 'توصيل مجاني لكل الولايات',
        highlight: '58 ولاية',
        highlightAr: '58 ولاية',
        subtitle: 'عند الطلب بأكثر من 5000 دج — توصيل سريع وآمن إلى باب منزلك',
        subtitleAr: 'عند الطلب بأكثر من 5000 دج — توصيل سريع وآمن إلى باب منزلك',
        cta: 'تسوّق الآن',
        ctaAr: 'تسوّق الآن',
        href: '/marketplace',
        gradient: 'from-[#0F766E] via-[#115E59] to-[#0F4F4A]',
        blob1: 'bg-emerald-400/30',
        blob2: 'bg-teal-300/20',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'banner_cod',
        order: 2,
        badge: 'دفع عند الاستلام',
        badgeAr: 'دفع عند الاستلام',
        icon: 'ShieldCheck',
        title: 'ادفع عند الاستلام',
        titleAr: 'ادفع عند الاستلام',
        highlight: 'بكل ثقة',
        highlightAr: 'بكل ثقة',
        subtitle: 'لا تدفع شيء قبل أن يصلك المنتج وتراه بعينيك — الثقة أولاً',
        subtitleAr: 'لا تدفع شيء قبل أن يصلك المنتج وتراه بعينيك — الثقة أولاً',
        cta: 'تصفّح المنتجات',
        ctaAr: 'تصفّح المنتجات',
        href: '/marketplace',
        gradient: 'from-[#1A1A1E] via-[#2D2D35] to-[#1A1A1E]',
        blob1: 'bg-[#C9A96A]/30',
        blob2: 'bg-[#A02A5B]/20',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'banner_new_user',
        order: 3,
        badge: 'هدية جديدة',
        badgeAr: 'هدية جديدة',
        icon: 'Gift',
        title: 'هدية المستخدم الجديد',
        titleAr: 'هدية المستخدم الجديد',
        highlight: '500 دج خصم',
        highlightAr: '500 دج خصم',
        subtitle: 'سجّل متجرك مجاناً واحصل على كوبون خصم 500 دج على أول طلب',
        subtitleAr: 'سجّل متجرك مجاناً واحصل على كوبون خصم 500 دج على أول طلب',
        cta: 'احصل على هديتك',
        ctaAr: 'احصل على هديتك',
        href: '/',
        gradient: 'from-[#A02A5B] via-[#7A1F44] to-[#5E1834]',
        blob1: 'bg-pink-300/30',
        blob2: 'bg-rose-300/20',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'banner_flash',
        order: 4,
        badge: 'عروض اليوم',
        badgeAr: 'عروض اليوم',
        icon: 'Sparkles',
        title: 'خصومات تصل إلى 70%',
        titleAr: 'خصومات تصل إلى 70%',
        highlight: 'لفترة محدودة',
        highlightAr: 'لفترة محدودة',
        subtitle: 'عروض حصرية تنتهي خلال ساعات — لا تفوّت الفرصة',
        subtitleAr: 'عروض حصرية تنتهي خلال ساعات — لا تفوّت الفرصة',
        cta: 'شاهد العروض',
        ctaAr: 'شاهد العروض',
        href: '/marketplace',
        gradient: 'from-[#B45309] via-[#92400E] to-[#78350F]',
        blob1: 'bg-amber-300/30',
        blob2: 'bg-orange-300/20',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'banner_verified_stores',
        order: 5,
        badge: 'متاجر موثّقة',
        badgeAr: 'متاجر موثّقة',
        icon: 'Crown',
        title: 'تسوّق من متاجر موثّقة',
        titleAr: 'تسوّق من متاجر موثّقة',
        highlight: '100% ضمان',
        highlightAr: '100% ضمان',
        subtitle: 'كل المتاجر في أموگار موثّقة ومعتمدة — جودة مضمونة',
        subtitleAr: 'كل المتاجر في أموگار موثّقة ومعتمدة — جودة مضمونة',
        cta: 'تصفّح المتاجر',
        ctaAr: 'تصفّح المتاجر',
        href: '/marketplace',
        gradient: 'from-[#1E3A8A] via-[#1E40AF] to-[#1E3A8A]',
        blob1: 'bg-blue-400/30',
        blob2: 'bg-indigo-300/20',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    console.log('[seed] inserted 5 default banners')
  }
}

/**
 * Populate a fresh store with default catalog (products, wilayas,
 * domains, settings). Called when a new TenantStore is created.
 * Idempotent — safe to call on a store that already has data.
 *
 * IMPORTANT: New stores get an EMPTY catalog. The merchant picks a
 * domain type (jewelry / fashion / beauty / electronics / home_appliances
 * / digital / general) during registration — that domain's preset is
 * applied as `activeDomainId`. NO sample products are added — the
 * merchant adds their OWN products from the start.
 *
 * The full jewelry catalog (`seedProducts`) is only used for the demo
 * store (`store_default`) — but only when the demo store is first
 * created (which already happened in any existing deployment, so this
 * is a no-op for production).
 */
export async function seedStoreData(storeId: string, domainId?: string): Promise<void> {
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
    // If a domainId was provided (chosen during registration), use it
    // instead of the default "domain_general". This is how the merchant
    // picks their store type (jewelry / fashion / electronics / etc.).
    //
    // CRITICAL: we also copy the domain's hero/store/footer texts into
    // the settings. Otherwise the store would show the defaultSettings'
    // jewelry-themed texts ("منتجات تُبرز أناقتك", "COLLECTION 2026")
    // even though the activeDomainId is e.g. "domain_electronics".
    const chosenDomainId = domainId && presetDomains.find(p => p.id === domainId)
      ? domainId
      : 'domain_general'
    const chosenPreset = (presetDomains as any[]).find(p => p.id === chosenDomainId) || (presetDomains as any[]).find(p => p.id === 'domain_general')
    await SettingsModel.create({
      _id: settingsDocId(storeId),
      storeId,
      ...defaultSettings,
      activeDomainId: chosenDomainId,
      // Override the default settings' texts with the chosen domain's texts
      // (heroBadge, heroTitleAr, heroSubtitleAr, footerDescriptionAr).
      // We do NOT override storeName / storeNameAr — those come from the
      // merchant's registration form (e.g. "متجر محمد للإلكترونيات").
      heroBadge: chosenPreset?.heroBadge || defaultSettings.heroBadge,
      heroTitleAr: chosenPreset?.heroTitleAr || defaultSettings.heroTitleAr,
      heroSubtitleAr: chosenPreset?.heroSubtitleAr || defaultSettings.heroSubtitleAr,
      footerDescriptionAr: chosenPreset?.footerDescriptionAr || defaultSettings.footerDescriptionAr,
      deliveryProviders: defaultDeliveryProviders(),
    })
    console.log(`[seed] inserted default settings for store ${storeId} (domain: ${chosenDomainId}, texts from: ${chosenPreset?.nameAr || 'default'})`)
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
