// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * GET   /api/wilayas              — list all wilayas
 * POST  /api/wilayas              — add a wilaya
 * PATCH /api/wilayas?code=XX      — update wilaya rates
 *   body: { deliveryHome, deliveryDesk, ... }
 *
 * We use a single route (no [code].ts) and pass the wilaya code via
 * query string for updates, since there's only ever ~58 wilayas and
 * the admin edits them inline.
 */

import { connectDB, json, handleError } from '../lib/mongo'
import { WilayaModel } from '../lib/models'
import { ensureSeeded } from '../lib/seed-runner'

export const config = { runtime: 'nodejs' }

export async function GET() {
  try {
    await connectDB()
    await ensureSeeded()
    const docs = await WilayaModel.find({}, null, { sort: { code: 1 } }).lean()
    return json({ wilayas: docs })
  } catch (err) {
    return handleError(err)
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const data = await req.json()
    if (!data._id) data._id = 'w_' + (data.code || Date.now().toString(36))
    await WilayaModel.create(data)
    const docs = await WilayaModel.find({}, null, { sort: { code: 1 } }).lean()
    return json({ wilayas: docs })
  } catch (err) {
    return handleError(err)
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    if (!code) return json({ error: 'CODE_REQUIRED' }, 400)
    const patch = await req.json()
    if (patch.deliveryHome !== undefined) patch.deliveryHome = Number(patch.deliveryHome)
    if (patch.deliveryDesk !== undefined) patch.deliveryDesk = Number(patch.deliveryDesk)
    const next = await WilayaModel.findOneAndUpdate(
      { code },
      { $set: patch },
      { new: true }
    ).lean()
    if (!next) return json({ error: 'NOT_FOUND' }, 404)
    const docs = await WilayaModel.find({}, null, { sort: { code: 1 } }).lean()
    return json({ wilayas: docs, updated: next })
  } catch (err) {
    return handleError(err)
  }
}
