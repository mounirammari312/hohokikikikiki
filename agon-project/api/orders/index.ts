// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * GET  /api/orders          — list all orders (admin)
 * POST /api/orders          — create a new order (public checkout)
 *
 * The POST route enforces duplicate-order detection (same phone + items
 * within 30 minutes) to prevent accidental double-submits.
 */

import { connectDB, json, handleError } from '../lib/mongo'
import { OrderModel, WilayaModel } from '../lib/models'
import { ensureSeeded } from '../lib/seed-runner'

export const config = { runtime: 'nodejs' }

export async function GET() {
  try {
    await connectDB()
    await ensureSeeded()
    const docs = await OrderModel.find({}, null, { sort: { createdAt: -1 } }).lean()
    return json({ orders: docs })
  } catch (err) {
    return handleError(err)
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const data = await req.json()

    // Look up wilaya name (mirror of client-side fallback)
    if (!data.wilayaNameAr) {
      const w = await WilayaModel.findOne({ code: data.wilaya }).lean() as any
      data.wilayaNameAr = w?.nameAr || data.wilaya
    }
    if (data.wilaya && !/^\d+$/.test(data.wilaya)) {
      // wilaya came as a name (legacy) — convert to code
      const w = await WilayaModel.findOne({ nameAr: data.wilaya }).lean() as any
      if (w) data.wilaya = w.code
    }

    // Duplicate detection
    const sig = `${data.phone}-${(data.items || [])
      .map((i: any) => i.productId + ':' + i.qty)
      .join(',')}`
    const recent = await OrderModel.findOne({ phone: data.phone }).sort({ createdAt: -1 }).lean() as any
    if (recent) {
      const recentSig = `${recent.phone}-${(recent.items || [])
        .map((i: any) => i.productId + ':' + i.qty)
        .join(',')}`
      const ageMs = Date.now() - new Date(recent.createdAt).getTime()
      if (recentSig === sig && ageMs < 30 * 60 * 1000) {
        return json({ error: 'DUPLICATE_ORDER' }, 409)
      }
    }

    // Generate order number
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
      status: 'new' as const,
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await OrderModel.create(order)
    return json({ order }, 201)
  } catch (err) {
    return handleError(err)
  }
}
