// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * POST /api/domains/activate
 *   body: { id }
 *
 * Sets the active domain by id. Also patches the singleton Settings
 * doc so the storeName / heroTitleAr etc. all switch to the new domain.
 */

import { connectDB, json, handleError } from '../../lib/mongo'
import { DomainModel, SettingsModel } from '../../lib/models'
import { ensureSeeded, SETTINGS_DOC_ID } from '../lib/seed-runner'

export const config = { runtime: 'nodejs' }

export async function POST(req: Request) {
  try {
    await connectDB()
    await ensureSeeded()
    const { id } = await req.json() as { id?: string }
    if (!id) return json({ error: 'ID_REQUIRED' }, 400)
    const domain = await DomainModel.findOne({ id }).lean() as any
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
        }
      },
      { new: true }
    ).lean()
    return json({ domain, settings })
  } catch (err) {
    return handleError(err)
  }
}
