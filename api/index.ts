// @ts-nocheck — serverless function; type-checked by Vercel at deploy time, not by the client tsc build
/**
 * SINGLE CATCH-ALL API ROUTE for the LUMIÈRE store.
 *
 * Why a single file?
 * ─────────────────
 * Vercel's Hobby plan limits each Deployment to **12 Serverless
 * Functions**. We previously had 9 separate route files
 * (`api/products/index.ts`, `api/products/[id].ts`, `api/orders/index.ts`,
 * `api/orders/[orderNumber].ts`, `api/products/[id]/action.ts`,
 * `api/wilayas.ts`, `api/settings.ts`, `api/domains.ts`,
 * `api/domains/activate/index.ts`) which — combined with Next/Vite's
 * own internal functions — pushed the count over the limit and broke
 * the deploy.
 *
 * Consolidating everything into one `api/index.ts` means Vercel sees
 * a single Serverless Function no matter how many logical endpoints
 * we expose. Routing is done in-code by parsing `req.url` (pathname +
 * query string), which is fast and dependency-free (no Express/Hono
 * needed).
 *
 * URL routing table (all under `/api/...`):
 * ─────────────────────────────────────────
 *   GET    /api/products                — list all products
 *   POST   /api/products                — create product
 *   GET    /api/products/:id            — get one product
 *   PUT    /api/products/:id            — update product
 *   DELETE /api/products/:id            — delete product
 *   POST   /api/products/:id/action     — { action: duplicate|toggleFeatured|toggleNew }
 *
 *   GET    /api/orders                  — list all orders (admin)
 *   POST   /api/orders                  — create order (checkout, with dedup)
 *   GET    /api/orders/:orderNumber     — fetch one order (ThankYou page)
 *   PATCH  /api/orders/:orderNumber     — update status
 *   DELETE /api/orders/:orderNumber     — delete order
 *
 *   GET    /api/wilayas                  — list wilayas
 *   POST   /api/wilayas                  — add wilaya
 *   PATCH  /api/wilayas?code=XX          — update wilaya rates
 *
 *   GET    /api/settings                 — get store settings (singleton)
 *   PUT    /api/settings                 — replace settings
 *   PATCH  /api/settings                 — merge-patch settings
 *
 *   GET    /api/domains                  — list domains
 *   POST   /api/domains                  — create custom domain
 *   PATCH  /api/domains?id=xxx           — update domain
 *   DELETE /api/domains?id=xxx           — delete custom domain
 *   POST   /api/domains/activate         — set active domain { id }
 *
 *   GET    /api/health                   — health check (no DB call)
 */

import { connectDB, json, handleError } from './lib/mongo'
import {
  ProductModel, WilayaModel, OrderModel, SettingsModel, DomainModel,
} from './lib/models'
import { ensureSeeded, SETTINGS_DOC_ID } from './lib/seed-runner'
import { presetDomains } from './lib/seed-runner'

export const config = {
  runtime: 'nodejs',
  // Vercel packs this single function with a generous max duration so
  // cold starts + DB seeding on first hit don't time out.
  maxDuration: 30,
}

const PRESET_IDS = new Set(presetDomains.map(d => d.id))
const VALID_ORDER_STATUSES = ['new', 'confirmed', 'shipping', 'delivered', 'cancelled']

// ─── Tiny router ────────────────────────────────────────────────────────────
//
// Vercel's Node.js runtime calls `default(req, res)` for every request
// matching `api/index.ts` (which catches everything under /api/*).
// We parse `req.url`, dispatch to a handler, and that's it.

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url, 'https://localhost')
  const method = (req.method || 'GET').toUpperCase()
  // pathname looks like: /api/products/prod_001/action
  // Strip leading "/api" + leading slash, then split.
  const segments = url.pathname
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean)
    // decode each segment (handles %20 etc.)
    .map(s => decodeURIComponent(s))

  const query = url.searchParams

  try {
    // ─── /health (no DB needed — pure liveness probe) ────────────────
    if (segments[0] === 'health') {
      return json({ ok: true, ts: Date.now() })
    }

    // ─── Match the route FIRST, then connect to the DB only if needed ─
    // This way, requests to /api/unknown-path return 404 immediately
    // without paying the cost of a DB connection (or failing with
    // MONGODB_URI_NOT_CONFIGURED for routes that don't exist).
    const matched = matchRoute(segments, method)
    if (!matched) {
      return json(
        { error: 'NOT_FOUND', path: url.pathname, method },
        404
      )
    }

    // Now we know we need the DB — connect (cached) + ensure seeded.
    await connectDB()
    await ensureSeeded()

    // Dispatch to the matched handler.
    return await matched({ req, query, segments })
  } catch (err) {
    return handleError(err)
  }
}

// ─── Route matcher ──────────────────────────────────────────────────────────
// Returns a handler function (or null if no route matches).
// The handler receives { req, query, segments } and returns a Response.

type RouteCtx = { req: Request; query: URLSearchParams; segments: string[] }
type RouteHandler = (ctx: RouteCtx) => Promise<Response>

function matchRoute(segments: string[], method: string): RouteHandler | null {
  // ─── /products ────────────────────────────────────────────────────
  if (segments[0] === 'products') {
    if (segments.length === 1) {
      if (method === 'GET') return () => listProducts()
      if (method === 'POST') return ({ req }) => createProduct(req)
    }
    if (segments.length === 2) {
      const id = segments[1]
      if (method === 'GET') return () => getProduct(id)
      if (method === 'PUT') return ({ req }) => updateProduct(id, req)
      if (method === 'DELETE') return () => deleteProduct(id)
    }
    if (segments.length === 3 && segments[2] === 'action') {
      const id = segments[1]
      if (method === 'POST') return ({ req }) => productAction(id, req)
    }
  }

  // ─── /orders ──────────────────────────────────────────────────────
  if (segments[0] === 'orders') {
    if (segments.length === 1) {
      if (method === 'GET') return () => listOrders()
      if (method === 'POST') return ({ req }) => createOrder(req)
    }
    if (segments.length === 2) {
      const num = segments[1]
      if (method === 'GET') return () => getOrder(num)
      if (method === 'PATCH') return ({ req }) => updateOrderStatus(num, req)
      if (method === 'DELETE') return () => deleteOrder(num)
    }
  }

  // ─── /wilayas ─────────────────────────────────────────────────────
  if (segments[0] === 'wilayas' && segments.length === 1) {
    if (method === 'GET') return () => listWilayas()
    if (method === 'POST') return ({ req }) => addWilaya(req)
    if (method === 'PATCH') return ({ req, query }) => updateWilaya(query, req)
  }

  // ─── /settings ────────────────────────────────────────────────────
  if (segments[0] === 'settings' && segments.length === 1) {
    if (method === 'GET') return () => getSettings()
    if (method === 'PUT') return ({ req }) => putSettings(req)
    if (method === 'PATCH') return ({ req }) => patchSettings(req)
  }

  // ─── /domains ─────────────────────────────────────────────────────
  if (segments[0] === 'domains') {
    if (segments.length === 2 && segments[1] === 'activate') {
      if (method === 'POST') return ({ req }) => activateDomain(req)
    }
    if (segments.length === 1) {
      if (method === 'GET') return () => listDomains()
      if (method === 'POST') return ({ req }) => createDomain(req)
      if (method === 'PATCH') return ({ req, query }) => updateDomain(query, req)
      if (method === 'DELETE') return ({ query }) => deleteDomain(query)
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════════════
//  PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════

async function listProducts() {
  const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return json({ products: docs })
}

async function createProduct(req: Request) {
  const body = await req.json()
  if (!body._id) {
    body._id = 'prod_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  }
  if (!body.createdAt) body.createdAt = new Date().toISOString()
  if (Array.isArray(body.variants) && body.variants.length) {
    const vs = body.variants.reduce((a, b) => a + (Number(b.stock) || 0), 0)
    if (vs > 0) body.stock = vs
  }
  await ProductModel.create(body)
  const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return json({ products: docs, created: body })
}

async function getProduct(id: string) {
  const doc = await ProductModel.findById(id).lean()
  if (!doc) return json({ error: 'NOT_FOUND' }, 404)
  return json({ product: doc })
}

async function updateProduct(id: string, req: Request) {
  const patch = await req.json()
  if (patch.price !== undefined) patch.price = Number(patch.price)
  if (patch.compareAtPrice !== undefined) {
    patch.compareAtPrice = patch.compareAtPrice ? Number(patch.compareAtPrice) : null
  }
  if (patch.stock !== undefined) patch.stock = Number(patch.stock)
  if (patch.rating !== undefined) patch.rating = Number(patch.rating)
  if (patch.reviewsCount !== undefined) patch.reviewsCount = Number(patch.reviewsCount)
  if (Array.isArray(patch.variants)) {
    const vs = patch.variants.reduce((a, b) => a + (Number(b.stock) || 0), 0)
    if (vs > 0) patch.stock = vs
  }
  const next = await ProductModel.findByIdAndUpdate(
    id, { $set: { ...patch, _id: id } }, { new: true, upsert: false }
  ).lean()
  if (!next) return json({ error: 'NOT_FOUND' }, 404)
  const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return json({ products: docs, updated: next })
}

async function deleteProduct(id: string) {
  await ProductModel.findByIdAndDelete(id)
  const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return json({ products: docs })
}

async function productAction(id: string, req: Request) {
  const { action } = await req.json()
  const orig = await ProductModel.findById(id).lean()
  if (!orig) return json({ error: 'NOT_FOUND' }, 404)

  if (action === 'duplicate') {
    const copy = {
      ...orig,
      _id: 'prod_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      sku: orig.sku + '-COPY',
      name: orig.name + ' Copy',
      nameAr: orig.nameAr + ' - نسخة',
      createdAt: new Date().toISOString(),
      variants: Array.isArray(orig.variants)
        ? orig.variants.map(v => ({
            ...v,
            id: 'var_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          }))
        : [],
    }
    await ProductModel.create(copy)
  } else if (action === 'toggleFeatured' || action === 'toggleNew') {
    const flag = action === 'toggleFeatured' ? 'isFeatured' : 'isNew'
    await ProductModel.findByIdAndUpdate(id, { $set: { [flag]: !orig[flag] } })
  } else {
    return json({ error: 'UNKNOWN_ACTION' }, 400)
  }

  const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return json({ products: docs })
}

// ═══════════════════════════════════════════════════════════════════════════
//  ORDERS
// ═══════════════════════════════════════════════════════════════════════════

async function listOrders() {
  const docs = await OrderModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return json({ orders: docs })
}

async function createOrder(req: Request) {
  const data = await req.json()

  // Wilaya name fallback + code normalization
  if (!data.wilayaNameAr) {
    const w = await WilayaModel.findOne({ code: data.wilaya }).lean()
    data.wilayaNameAr = w?.nameAr || data.wilaya
  }
  if (data.wilaya && !/^\d+$/.test(data.wilaya)) {
    const w = await WilayaModel.findOne({ nameAr: data.wilaya }).lean()
    if (w) data.wilaya = w.code
  }

  // Duplicate detection (same phone + items within 30 min)
  const sig = `${data.phone}-${(data.items || [])
    .map(i => i.productId + ':' + i.qty).join(',')}`
  const recent = await OrderModel.findOne({ phone: data.phone })
    .sort({ createdAt: -1 }).lean()
  if (recent) {
    const recentSig = `${recent.phone}-${(recent.items || [])
      .map(i => i.productId + ':' + i.qty).join(',')}`
    const ageMs = Date.now() - new Date(recent.createdAt).getTime()
    if (recentSig === sig && ageMs < 30 * 60 * 1000) {
      return json({ error: 'DUPLICATE_ORDER' }, 409)
    }
  }

  const count = await OrderModel.estimatedDocumentCount()
  const orderNumber = 'LUM-' + (1000 + count + 1).toString()
  const order = {
    _id: 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    orderNumber,
    customerName: data.customerName,
    phone: data.phone,
    phone2: data.phone2 || '',
    wilaya: data.wilaya,
    wilayaNameAr: data.wilayaNameAr,
    commune: data.commune,
    address: data.address,
    deliveryType: data.deliveryType || 'home',
    items: data.items || [],
    subtotal: Number(data.subtotal) || 0,
    discount: Number(data.discount) || 0,
    shippingCost: Number(data.shippingCost) || 0,
    total: Number(data.total) || 0,
    status: 'new',
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await OrderModel.create(order)
  return json({ order }, 201)
}

async function getOrder(orderNumber: string) {
  let doc = await OrderModel.findOne({ orderNumber }).lean()
  if (!doc) doc = await OrderModel.findById(orderNumber).lean()
  if (!doc) return json({ error: 'NOT_FOUND' }, 404)
  return json({ order: doc })
}

async function updateOrderStatus(orderNumber: string, req: Request) {
  const { status } = await req.json()
  if (!status || !VALID_ORDER_STATUSES.includes(status)) {
    return json({ error: 'INVALID_STATUS' }, 400)
  }
  const next = await OrderModel.findOneAndUpdate(
    { orderNumber },
    { $set: { status, updatedAt: new Date().toISOString() } },
    { new: true }
  ).lean()
  if (!next) return json({ error: 'NOT_FOUND' }, 404)
  const docs = await OrderModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return json({ orders: docs, updated: next })
}

async function deleteOrder(orderNumber: string) {
  await OrderModel.findOneAndDelete({ orderNumber })
  const docs = await OrderModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return json({ orders: docs })
}

// ═══════════════════════════════════════════════════════════════════════════
//  WILAYAS
// ═══════════════════════════════════════════════════════════════════════════

async function listWilayas() {
  const docs = await WilayaModel.find({}, null, { sort: { code: 1 } }).lean()
  return json({ wilayas: docs })
}

async function addWilaya(req: Request) {
  const data = await req.json()
  if (!data._id) data._id = 'w_' + (data.code || Date.now().toString(36))
  await WilayaModel.create(data)
  const docs = await WilayaModel.find({}, null, { sort: { code: 1 } }).lean()
  return json({ wilayas: docs })
}

async function updateWilaya(query: URLSearchParams, req: Request) {
  const code = query.get('code')
  if (!code) return json({ error: 'CODE_REQUIRED' }, 400)
  const patch = await req.json()
  if (patch.deliveryHome !== undefined) patch.deliveryHome = Number(patch.deliveryHome)
  if (patch.deliveryDesk !== undefined) patch.deliveryDesk = Number(patch.deliveryDesk)
  const next = await WilayaModel.findOneAndUpdate(
    { code }, { $set: patch }, { new: true }
  ).lean()
  if (!next) return json({ error: 'NOT_FOUND' }, 404)
  const docs = await WilayaModel.find({}, null, { sort: { code: 1 } }).lean()
  return json({ wilayas: docs, updated: next })
}

// ═══════════════════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

async function getSettings() {
  let doc = await SettingsModel.findById(SETTINGS_DOC_ID).lean()
  if (!doc) {
    await ensureSeeded()
    doc = await SettingsModel.findById(SETTINGS_DOC_ID).lean()
  }
  return json({ settings: doc })
}

async function putSettings(req: Request) {
  const data = await req.json()
  const next = await SettingsModel.findByIdAndUpdate(
    SETTINGS_DOC_ID,
    { $set: { ...data, _id: SETTINGS_DOC_ID } },
    { new: true, upsert: true }
  ).lean()
  return json({ settings: next })
}

async function patchSettings(req: Request) {
  const patch = await req.json()
  const next = await SettingsModel.findByIdAndUpdate(
    SETTINGS_DOC_ID, { $set: patch }, { new: true, upsert: true }
  ).lean()
  return json({ settings: next })
}

// ═══════════════════════════════════════════════════════════════════════════
//  DOMAINS
// ═══════════════════════════════════════════════════════════════════════════

async function listDomains() {
  const docs = await DomainModel.find({}).lean()
  const order: Record<string, number> = {}
  presetDomains.forEach((d, i) => (order[d.id] = i))
  const sorted = [...docs].sort((a, b) => {
    const oa = order[a.id] ?? 999
    const ob = order[b.id] ?? 999
    return oa - ob
  })
  return json({ domains: sorted })
}

async function createDomain(req: Request) {
  const data = await req.json()
  if (!data.id) {
    data.id = 'domain_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  }
  data.isPreset = false
  await DomainModel.create(data)
  const docs = await DomainModel.find({}).lean()
  return json({ domains: docs, created: data })
}

async function updateDomain(query: URLSearchParams, req: Request) {
  const id = query.get('id')
  if (!id) return json({ error: 'ID_REQUIRED' }, 400)
  const patch = await req.json()
  const next = await DomainModel.findOneAndUpdate(
    { id }, { $set: patch }, { new: true }
  ).lean()
  if (!next) return json({ error: 'NOT_FOUND' }, 404)

  // If the patched domain is the active one, sync storeName/hero/etc.
  // into the singleton settings doc.
  const settings = await SettingsModel.findById(SETTINGS_DOC_ID).lean()
  if (settings?.activeDomainId === id) {
    await SettingsModel.findByIdAndUpdate(SETTINGS_DOC_ID, {
      $set: {
        storeName: next.name,
        storeNameAr: next.nameAr,
        heroBadge: next.heroBadge,
        heroTitleAr: next.heroTitleAr,
        heroSubtitleAr: next.heroSubtitleAr,
        footerDescriptionAr: next.footerDescriptionAr,
      },
    })
  }
  const docs = await DomainModel.find({}).lean()
  return json({ domains: docs, updated: next })
}

async function deleteDomain(query: URLSearchParams) {
  const id = query.get('id')
  if (!id) return json({ error: 'ID_REQUIRED' }, 400)
  if (PRESET_IDS.has(id)) return json({ error: 'CANNOT_DELETE_PRESET' }, 400)
  await DomainModel.findOneAndDelete({ id })

  // If we deleted the active domain, switch to the first preset
  const settings = await SettingsModel.findById(SETTINGS_DOC_ID).lean()
  if (settings?.activeDomainId === id) {
    const first = presetDomains[0]
    await SettingsModel.findByIdAndUpdate(SETTINGS_DOC_ID, {
      $set: {
        activeDomainId: first.id,
        storeName: first.name,
        storeNameAr: first.nameAr,
        heroBadge: first.heroBadge,
        heroTitleAr: first.heroTitleAr,
        heroSubtitleAr: first.heroSubtitleAr,
        footerDescriptionAr: first.footerDescriptionAr,
      },
    })
  }
  const docs = await DomainModel.find({}).lean()
  return json({ domains: docs })
}

async function activateDomain(req: Request) {
  const { id } = await req.json()
  if (!id) return json({ error: 'ID_REQUIRED' }, 400)
  const domain = await DomainModel.findOne({ id }).lean()
  if (!domain) return json({ error: 'NOT_FOUND' }, 404)
  const settings = await SettingsModel.findByIdAndUpdate(
    SETTINGS_DOC_ID,
    {
      $set: {
        activeDomainId: domain.id,
        storeName: domain.name,
        storeNameAr: domain.nameAr,
        heroBadge: domain.heroBadge,
        heroTitleAr: domain.heroTitleAr,
        heroSubtitleAr: domain.heroSubtitleAr,
        footerDescriptionAr: domain.footerDescriptionAr,
      },
    },
    { new: true }
  ).lean()
  return json({ domain, settings })
}
