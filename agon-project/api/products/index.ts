// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * GET  /api/products        — list all products
 * POST /api/products        — create a new product
 *
 * Used by src/services/api/products.ts on the client.
 */

import { connectDB, json, handleError } from '../lib/mongo'
import { ProductModel } from '../lib/models'
import { ensureSeeded } from '../lib/seed-runner'

export const config = {
  runtime: 'nodejs',
}

export async function GET() {
  try {
    await connectDB()
    await ensureSeeded()
    const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
    return json({ products: docs })
  } catch (err) {
    return handleError(err)
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const body = await req.json()
    // Generate ids if not provided
    if (!body._id) {
      body._id = 'prod_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    }
    if (!body.createdAt) body.createdAt = new Date().toISOString()
    // Recompute total stock from variants if provided
    if (Array.isArray(body.variants) && body.variants.length) {
      const vs = body.variants.reduce((a: number, b: any) => a + (Number(b.stock) || 0), 0)
      if (vs > 0) body.stock = vs
    }
    await ProductModel.create(body)
    const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
    return json({ products: docs, created: body })
  } catch (err) {
    return handleError(err)
  }
}
