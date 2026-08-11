// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * POST /api/products/:id/action
 *   body: { action: 'duplicate' | 'toggleFeatured' | 'toggleNew' }
 *
 * Convenience endpoint for the admin's "duplicate", "toggle featured",
 * and "toggle new" buttons. Done as a single endpoint to avoid creating
 * three separate routes.
 */

import { connectDB, json, handleError } from '../../../lib/mongo'
import { ProductModel } from '../../../lib/models'
import { ensureSeeded } from '../lib/seed-runner'

export const config = { runtime: 'nodejs' }

function getIdFromUrl(req: Request): string {
  try {
    const url = new URL(req.url)
    const parts = url.pathname.split('/').filter(Boolean)
    // /api/products/<id>/action
    return decodeURIComponent(parts[parts.length - 2] || '')
  } catch {
    return ''
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const id = getIdFromUrl(req)
    const { action } = await req.json() as { action?: string }
    const orig = await ProductModel.findById(id).lean()
    if (!orig) return json({ error: 'NOT_FOUND' }, 404)

    if (action === 'duplicate') {
      const copy = {
        ...(orig as any),
        _id: 'prod_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        sku: (orig as any).sku + '-COPY',
        name: (orig as any).name + ' Copy',
        nameAr: (orig as any).nameAr + ' - نسخة',
        createdAt: new Date().toISOString(),
        variants: Array.isArray((orig as any).variants)
          ? (orig as any).variants.map((v: any) => ({
              ...v,
              id: 'var_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            }))
          : [],
      }
      await ProductModel.create(copy)
    } else if (action === 'toggleFeatured' || action === 'toggleNew') {
      const flag = action === 'toggleFeatured' ? 'isFeatured' : 'isNew'
      await ProductModel.findByIdAndUpdate(id, {
        $set: { [flag]: !(orig as any)[flag] }
      })
    } else {
      return json({ error: 'UNKNOWN_ACTION' }, 400)
    }

    const docs = await ProductModel.find({}, null, { sort: { createdAt: -1 } }).lean()
    return json({ products: docs })
  } catch (err) {
    return handleError(err)
  }
}
