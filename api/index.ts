// @ts-nocheck
import { connectDB } from './lib/mongo.js'
import {
  ProductModel, WilayaModel, OrderModel, SettingsModel, DomainModel,
} from './lib/models.js'
import { ensureSeeded, SETTINGS_DOC_ID, presetDomains } from './lib/seed-runner.js'

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

const PRESET_IDS = new Set((presetDomains || []).map(d => d.id))
const VALID_ORDER_STATUSES = ['new', 'confirmed', 'shipping', 'delivered', 'cancelled']

// ─── Vercel Node.js Compatibility Helpers ─────────────────────────────────────

async function getReqBody(req: any) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body) } catch (e) { return {} }
    }
    return req.body
  }
  if (typeof req.json === 'function') {
    try { return await req.json() } catch (e) { return {} }
  }
  return {}
}

function reply(res: any, data: any, status = 200) {
  if (res && typeof res.status === 'function') {
    return res.status(status).json(data)
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  try {
    const rawUrl = req.url || '/'
    const url = new URL(rawUrl, 'https://localhost')
    const method = (req.method || 'GET').toUpperCase()

    const segments = url.pathname
      .replace(/^\/api\/?/, '')
      .split('/')
      .filter(Boolean)
      .map(s => decodeURIComponent(s))

    const query = url.searchParams

    // Health Check
    if (segments[0] === 'health') {
      return reply(res, { ok: true, ts: Date.now() })
    }

    const matched = matchRoute(segments, method)
    if (!matched) {
      return reply(res, { error: 'NOT_FOUND', path: url.pathname, method }, 404)
    }

    await connectDB()
    await ensureSeeded()

    const result = await matched({ req, res, query, segments })
    return reply(res, result.data, result.status || 200)
  } catch (err: any) {
    console.error('SERVERLESS_HANDLER_ERROR:', err)
    return reply(
      res,
      {
        error: 'SERVERLESS_CRASH',
        message: err?.message || String(err),
        stack: err?.stack || null,
      },
      500
    )
  }
}

type RouteCtx = { req: any; res: any; query: URLSearchParams; segments: string[] }
type RouteHandler = (ctx: RouteCtx) => Promise<{ data: any; status?: number }>

function matchRoute(segments: string[], method: string): RouteHandler | null {
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

  if (segments[0] === 'wilayas' && segments.length === 1) {
    if (method === 'GET') return () => listWilayas()
    if (method === 'POST') return ({ req }) => addWilaya(req)
    if (method === 'PATCH') return ({ req, query }) => updateWilaya(query, req)
  }

  if (segments[0] === 'settings' && segments.length === 1) {
    if (method === 'GET') return () => getSettings()
    if (method === 'PUT') return ({ req }) => putSettings(req)
    if (method === 'PATCH') return ({ req }) => patchSettings(req)
  }

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

// ─── ENDPOINTS ────────────────────────────────────────────────────────────────

async function listProducts() {
  const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return { data: { products: docs } }
}

async function createProduct(req: any) {
  const body = await getReqBody(req)
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
  return { data: { products: docs, created: body } }
}

async function getProduct(id: string) {
  const doc = await ProductModel.findById(id).lean()
  if (!doc) return { data: { error: 'NOT_FOUND' }, status: 404 }
  return { data: { product: doc } }
}

async function updateProduct(id: string, req: any) {
  const patch = await getReqBody(req)
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
  if (!next) return { data: { error: 'NOT_FOUND' }, status: 404 }
  const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return { data: { products: docs, updated: next } }
}

async function deleteProduct(id: string) {
  await ProductModel.findByIdAndDelete(id)
  const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return { data: { products: docs } }
}

async function productAction(id: string, req: any) {
  const { action } = await getReqBody(req)
  const orig = await ProductModel.findById(id).lean()
  if (!orig) return { data: { error: 'NOT_FOUND' }, status: 404 }

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
    return { data: { error: 'UNKNOWN_ACTION' }, status: 400 }
  }

  const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return { data: { products: docs } }
}

async function listOrders() {
  const docs = await OrderModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return { data: { orders: docs } }
}

async function createOrder(req: any) {
  const data = await getReqBody(req)

  if (!data.wilayaNameAr) {
    const w = await WilayaModel.findOne({ code: data.wilaya }).lean()
    data.wilayaNameAr = w?.nameAr || data.wilaya
  }
  if (data.wilaya && !/^\d+$/.test(data.wilaya)) {
    const w = await WilayaModel.findOne({ nameAr: data.wilaya }).lean()
    if (w) data.wilaya = w.code
  }

  const sig = `${data.phone}-${(data.items || [])
    .map(i => i.productId + ':' + i.qty).join(',')}`
  const recent = await OrderModel.findOne({ phone: data.phone })
    .sort({ createdAt: -1 }).lean()
  if (recent) {
    const recentSig = `${recent.phone}-${(recent.items || [])
      .map(i => i.productId + ':' + i.qty).join(',')}`
    const ageMs = Date.now() - new Date(recent.createdAt).getTime()
    if (recentSig === sig && ageMs < 30 * 60 * 1000) {
      return { data: { error: 'DUPLICATE_ORDER' }, status: 409 }
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
  return { data: { order }, status: 201 }
}

async function getOrder(orderNumber: string) {
  let doc = await OrderModel.findOne({ orderNumber }).lean()
  if (!doc) doc = await OrderModel.findById(orderNumber).lean()
  if (!doc) return { data: { error: 'NOT_FOUND' }, status: 404 }
  return { data: { order: doc } }
}



async function updateOrderStatus(orderNumber: string, req: any) {
  const { status } = await getReqBody(req)
  if (!status || !VALID_ORDER_STATUSES.includes(status)) {
    return { data: { error: 'INVALID_STATUS' }, status: 400 }
  }
  // التعديل: البحث برقم الطلب أو الـ _id لمنع الفشل
  const next = await OrderModel.findOneAndUpdate(
    { $or: [{ orderNumber }, { _id: orderNumber }] },
    { $set: { status, updatedAt: new Date().toISOString() } },
    { new: true }
  ).lean()
  
  if (!next) return { data: { error: 'NOT_FOUND' }, status: 404 }
  const docs = await OrderModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return { data: { orders: docs, updated: next } }
}

async function deleteOrder(orderNumber: string) {
  // التعديل: البحث برقم الطلب أو الـ _id
  await OrderModel.findOneAndDelete({ $or: [{ orderNumber }, { _id: orderNumber }] })
  const docs = await OrderModel.find({}, null, { sort: { createdAt: -1 } }).lean()
  return { data: { orders: docs } }
}




async function listWilayas() {
  const docs = await WilayaModel.find({}, null, { sort: { code: 1 } }).lean()
  return { data: { wilayas: docs } }
}

async function addWilaya(req: any) {
  const data = await getReqBody(req)
  if (!data._id) data._id = 'w_' + (data.code || Date.now().toString(36))
  await WilayaModel.create(data)
  const docs = await WilayaModel.find({}, null, { sort: { code: 1 } }).lean()
  return { data: { wilayas: docs } }
}

async function updateWilaya(query: URLSearchParams, req: any) {
  const code = query.get('code')
  if (!code) return { data: { error: 'CODE_REQUIRED' }, status: 400 }
  const patch = await getReqBody(req)
  if (patch.deliveryHome !== undefined) patch.deliveryHome = Number(patch.deliveryHome)
  if (patch.deliveryDesk !== undefined) patch.deliveryDesk = Number(patch.deliveryDesk)
  const next = await WilayaModel.findOneAndUpdate(
    { code }, { $set: patch }, { new: true }
  ).lean()
  if (!next) return { data: { error: 'NOT_FOUND' }, status: 404 }
  const docs = await WilayaModel.find({}, null, { sort: { code: 1 } }).lean()
  return { data: { wilayas: docs, updated: next } }
}

async function getSettings() {
  let doc = await SettingsModel.findById(SETTINGS_DOC_ID).lean()
  if (!doc) {
    await ensureSeeded()
    doc = await SettingsModel.findById(SETTINGS_DOC_ID).lean()
  }
  return { data: { settings: doc } }
}

async function putSettings(req: any) {
  const data = await getReqBody(req)
  const next = await SettingsModel.findByIdAndUpdate(
    SETTINGS_DOC_ID,
    { $set: { ...data, _id: SETTINGS_DOC_ID } },
    { new: true, upsert: true }
  ).lean()
  return { data: { settings: next } }
}

async function patchSettings(req: any) {
  const patch = await getReqBody(req)
  const next = await SettingsModel.findByIdAndUpdate(
    SETTINGS_DOC_ID, { $set: patch }, { new: true, upsert: true }
  ).lean()
  return { data: { settings: next } }
}

async function listDomains() {
  const docs = await DomainModel.find({}).lean()
  const order: Record<string, number> = {}
  presetDomains.forEach((d, i) => (order[d.id] = i))
  const sorted = [...docs].sort((a, b) => {
    const oa = order[a.id] ?? 999
    const ob = order[b.id] ?? 999
    return oa - ob
  })
  return { data: { domains: sorted } }
}

async function createDomain(req: any) {
  const data = await getReqBody(req)
  if (!data.id) {
    data.id = 'domain_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  }
  data.isPreset = false
  await DomainModel.create(data)
  const docs = await DomainModel.find({}).lean()
  return { data: { domains: docs, created: data } }
}

async function updateDomain(query: URLSearchParams, req: any) {
  const id = query.get('id')
  if (!id) return { data: { error: 'ID_REQUIRED' }, status: 400 }
  const patch = await getReqBody(req)
  const next = await DomainModel.findOneAndUpdate(
    { id }, { $set: patch }, { new: true }
  ).lean()
  if (!next) return { data: { error: 'NOT_FOUND' }, status: 404 }

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
  return { data: { domains: docs, updated: next } }
}

async function deleteDomain(query: URLSearchParams) {
  const id = query.get('id')
  if (!id) return { data: { error: 'ID_REQUIRED' }, status: 400 }
  if (PRESET_IDS.has(id)) return { data: { error: 'CANNOT_DELETE_PRESET' }, status: 400 }
  await DomainModel.findOneAndDelete({ id })

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
  return { data: { domains: docs } }
}

async function activateDomain(req: any) {
  const { id } = await getReqBody(req)
  if (!id) return { data: { error: 'ID_REQUIRED' }, status: 400 }
  const domain = await DomainModel.findOne({ id }).lean()
  if (!domain) return { data: { error: 'NOT_FOUND' }, status: 404 }
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
  return { data: { domain, settings } }
}

