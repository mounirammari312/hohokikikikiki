// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * GET    /api/orders/:orderNumber  — fetch a single order (ThankYou page)
 * PATCH  /api/orders/:orderNumber  — update order status (admin)
 *   body: { status: 'new'|'confirmed'|'shipping'|'delivered'|'cancelled' }
 * DELETE /api/orders/:orderNumber  — delete an order (admin)
 */

import { connectDB, json, handleError } from '../../lib/mongo'
import { OrderModel } from '../../lib/models'
import { ensureSeeded } from '../lib/seed-runner'

export const config = { runtime: 'nodejs' }

function getIdFromUrl(req: Request): string {
  try {
    const url = new URL(req.url)
    const parts = url.pathname.split('/').filter(Boolean)
    return decodeURIComponent(parts[parts.length - 1] || '')
  } catch {
    return ''
  }
}

export async function GET(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const orderNumber = getIdFromUrl(req)
    // Try matching by orderNumber first, then by _id as a fallback
    let doc = await OrderModel.findOne({ orderNumber }).lean()
    if (!doc) doc = await OrderModel.findById(orderNumber).lean()
    if (!doc) return json({ error: 'NOT_FOUND' }, 404)
    return json({ order: doc })
  } catch (err) {
    return handleError(err)
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const orderNumber = getIdFromUrl(req)
    const { status } = await req.json() as { status?: string }
    const valid = ['new', 'confirmed', 'shipping', 'delivered', 'cancelled']
    if (!status || !valid.includes(status)) {
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
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const orderNumber = getIdFromUrl(req)
    await OrderModel.findOneAndDelete({ orderNumber })
    const docs = await OrderModel.find({}, null, { sort: { createdAt: -1 } }).lean()
    return json({ orders: docs })
  } catch (err) {
    return handleError(err)
  }
}
