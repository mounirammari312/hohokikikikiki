// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * GET    /api/products/:id  — get a single product
 * PUT    /api/products/:id  — update a product
 * DELETE /api/products/:id  — delete a product
 *
 * The :id is read from the URL pathname (Vercel serverless routes
 * /api/products/[id] → the segment is available as `params.id` in
 * Vercel's Node.js runtime, but we also fall back to parsing the URL
 * so the route works in `vite dev` mode too).
 */

import { connectDB, json, handleError } from '../../lib/mongo'
import { ProductModel } from '../../lib/models'
import { ensureSeeded } from '../lib/seed-runner'

export const config = { runtime: 'nodejs' }

function getIdFromUrl(req: Request): string {
  try {
    const url = new URL(req.url)
    const parts = url.pathname.split('/').filter(Boolean)
    // /api/products/<id>
    return decodeURIComponent(parts[parts.length - 1] || '')
  } catch {
    return ''
  }
}

export async function GET(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const id = getIdFromUrl(req)
    const doc = await ProductModel.findById(id).lean()
    if (!doc) return json({ error: 'NOT_FOUND' }, 404)
    return json({ product: doc })
  } catch (err) {
    return handleError(err)
  }
}

export async function PUT(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const id = getIdFromUrl(req)
    const patch = await req.json()
    // Numeric coercion (mirrors the old client-side logic)
    if (patch.price !== undefined) patch.price = Number(patch.price)
    if (patch.compareAtPrice !== undefined) {
      patch.compareAtPrice = patch.compareAtPrice ? Number(patch.compareAtPrice) : null
    }
    if (patch.stock !== undefined) patch.stock = Number(patch.stock)
    if (patch.rating !== undefined) patch.rating = Number(patch.rating)
    if (patch.reviewsCount !== undefined) patch.reviewsCount = Number(patch.reviewsCount)
    if (Array.isArray(patch.variants)) {
      const vs = patch.variants.reduce((a: number, b: any) => a + (Number(b.stock) || 0), 0)
      if (vs > 0) patch.stock = vs
    }
    const next = await ProductModel.findByIdAndUpdate(
      id,
      { $set: { ...patch, _id: id } },
      { new: true, upsert: false }
    ).lean()
    if (!next) return json({ error: 'NOT_FOUND' }, 404)
    const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
    return json({ products: docs, updated: next })
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const id = getIdFromUrl(req)
    await ProductModel.findByIdAndDelete(id)
    const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
    return json({ products: docs })
  } catch (err) {
    return handleError(err)
  }
}
