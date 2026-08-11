// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * GET  /api/settings    — return store settings (singleton document)
 * PUT  /api/settings    — replace store settings (admin save)
 * PATCH /api/settings   — merge-patch settings (admin partial update)
 *
 * Settings is a singleton document with _id = 'singleton'.
 */

import { connectDB, json, handleError } from '../lib/mongo'
import { SettingsModel } from '../lib/models'
import { ensureSeeded, SETTINGS_DOC_ID } from '../lib/seed-runner'

export const config = { runtime: 'nodejs' }

export async function GET() {
  try {
    await connectDB()
    await ensureSeeded()
    let doc = await SettingsModel.findById(SETTINGS_DOC_ID).lean()
    if (!doc) {
      // Defensive: ensureSeeded should have created it, but if not…
      await ensureSeeded()
      doc = await SettingsModel.findById(SETTINGS_DOC_ID).lean()
    }
    return json({ settings: doc })
  } catch (err) {
    return handleError(err)
  }
}

export async function PUT(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const data = await req.json()
    const next = await SettingsModel.findByIdAndUpdate(
      SETTINGS_DOC_ID,
      { $set: { ...data, _id: SETTINGS_DOC_ID } },
      { new: true, upsert: true }
    ).lean()
    return json({ settings: next })
  } catch (err) {
    return handleError(err)
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const patch = await req.json()
    const next = await SettingsModel.findByIdAndUpdate(
      SETTINGS_DOC_ID,
      { $set: patch },
      { new: true, upsert: true }
    ).lean()
    return json({ settings: next })
  } catch (err) {
    return handleError(err)
  }
}
