// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * GET    /api/domains              — list all domains (presets + custom)
 * POST   /api/domains              — create a custom domain
 * PATCH  /api/domains?id=xxx       — update a domain (also patches settings
 *                                    if the active domain is the one updated)
 * DELETE /api/domains?id=xxx       — delete a custom domain
 *                                    (preset domains cannot be deleted)
 * POST   /api/domains/activate     — set the active domain by id
 *   body: { id }
 *
 * Mirrors the client-side domains.ts logic — the activate + update
 * hooks also patch the singleton Settings document so the header/footer
 * display the right storeName / heroTitleAr.
 */

import { connectDB, json, handleError } from '../lib/mongo'
import { DomainModel, SettingsModel } from '../lib/models'
import { ensureSeeded, SETTINGS_DOC_ID } from '../lib/seed-runner'
import { presetDomains } from '../lib/seed-runner'

export const config = { runtime: 'nodejs' }

const PRESET_IDS = new Set(presetDomains.map(d => d.id))

export async function GET() {
  try {
    await connectDB()
    await ensureSeeded()
    const docs = await DomainModel.find({}).lean()
    // Sort presets first by their preset order, then custom after
    const order: Record<string, number> = {}
    presetDomains.forEach((d, i) => (order[d.id] = i))
    const sorted = [...(docs as any[])].sort((a, b) => {
      const oa = order[a.id] ?? 999
      const ob = order[b.id] ?? 999
      return oa - ob
    })
    return json({ domains: sorted })
  } catch (err) {
    return handleError(err)
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const data = await req.json()
    if (!data.id) {
      data.id = 'domain_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    }
    data.isPreset = false
    await DomainModel.create(data)
    const docs = await DomainModel.find({}).lean()
    return json({ domains: docs, created: data })
  } catch (err) {
    return handleError(err)
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return json({ error: 'ID_REQUIRED' }, 400)
    const patch = await req.json()
    const next = await DomainModel.findOneAndUpdate(
      { id },
      { $set: patch },
      { new: true }
    ).lean()
    if (!next) return json({ error: 'NOT_FOUND' }, 404)

    // If the patched domain is the active one, sync the storeName /
    // heroTitle etc. into the singleton settings doc.
    const settings = await SettingsModel.findById(SETTINGS_DOC_ID).lean() as any
    if (settings?.activeDomainId === id) {
      await SettingsModel.findByIdAndUpdate(SETTINGS_DOC_ID, {
        $set: {
          storeName: (next as any).name,
          storeNameAr: (next as any).nameAr,
          heroBadge: (next as any).heroBadge,
          heroTitleAr: (next as any).heroTitleAr,
          heroSubtitleAr: (next as any).heroSubtitleAr,
          footerDescriptionAr: (next as any).footerDescriptionAr,
        }
      })
    }
    const docs = await DomainModel.find({}).lean()
    return json({ domains: docs, updated: next })
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return json({ error: 'ID_REQUIRED' }, 400)
    if (PRESET_IDS.has(id)) {
      return json({ error: 'CANNOT_DELETE_PRESET' }, 400)
    }
    await DomainModel.findOneAndDelete({ id })
    // If we just deleted the active domain, switch to the first preset
    const settings = await SettingsModel.findById(SETTINGS_DOC_ID).lean() as any
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
        }
      })
    }
    const docs = await DomainModel.find({}).lean()
    return json({ domains: docs })
  } catch (err) {
    return handleError(err)
  }
}
