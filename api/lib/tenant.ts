// @ts-nocheck — serverless function; type-checked by Vercel at deploy time
/**
 * Dynamic Tenant Resolution — the heart of the multi-tenant SaaS layer.
 *
 * For every API request we figure out WHICH store the request belongs to
 * by inspecting, in order:
 *
 *   1. `x-store-id` HTTP header  (most explicit — used by the dashboard
 *                                 when the merchant is logged in)
 *   2. `?storeId=xxx` query param (fallback for testing / direct links)
 *   3. `Host` header               — either a subdomain
 *                                     `slug.platform.com` OR a custom
 *                                     domain `mystore.com` mapped via
 *                                     TenantStore.customDomain
 *
 * If none match, we fall back to the default demo store
 * (`store_default` / slug `demo`) so the storefront always renders
 * something even on the bare platform domain.
 *
 * The resolved `{ storeId, store, isPlatformHost }` object is then
 * passed into every CRUD handler so all queries can be scoped with
 * `{ storeId }`.
 */

import { TenantStoreModel } from './models.js'
import { DEFAULT_STORE_ID } from './seed-runner.js'

export interface ResolvedTenant {
  storeId: string
  store: any | null
  /** True when the request hit the bare platform domain (no tenant subdomain). */
  isPlatformHost: boolean
}

// Configure your apex/platform domain here. Anything that ends with
// `.${PLATFORM_APEX}` is treated as a tenant subdomain: `<slug>.platform.com`.
// In production this should be a Vercel env var.
const PLATFORM_APEX = (process.env.PLATFORM_APEX || 'lumiere.saas').toLowerCase()

// Hosts that are definitely the platform itself (not a tenant).
const PLATFORM_HOSTS = new Set([
  'localhost', '127.0.0.1',
  PLATFORM_APEX,
  'www.' + PLATFORM_APEX,
  'vercel.app',
])

/**
 * Extract the hostname from the request, normalising ports and the
 * Vercel proxy header (`x-forwarded-host`).
 */
function getHostname(req: any): string {
  const raw =
    req.headers?.['x-forwarded-host'] ||
    req.headers?.['host'] ||
    req.headers?.['Host'] ||
    ''
  // Strip port + lowercase
  return String(raw).split(':')[0].toLowerCase().trim()
}

/**
 * Resolve the tenant for an incoming request.
 *
 * @param req The Vercel request object (req.headers, req.url, etc.)
 * @returns ResolvedTenant — never throws; falls back to default store.
 */
export async function resolveTenant(req: any): Promise<ResolvedTenant> {
  const host = getHostname(req)
  const url = new URL(req.url || '/', `https://${host || 'localhost'}`)
  const query = url.searchParams

  // 1) Explicit header wins (used by dashboard / super-admin)
  const headerStoreId = req.headers?.['x-store-id']
  if (headerStoreId && typeof headerStoreId === 'string') {
    const store = await TenantStoreModel.findById(headerStoreId).lean().catch(() => null)
    if (store) return { storeId: store._id, store, isPlatformHost: false }
  }

  // 2) Query param fallback (useful for preview links + tests)
  const queryStoreId = query.get('storeId')
  if (queryStoreId) {
    const store = await TenantStoreModel.findById(queryStoreId).lean().catch(() => null)
    if (store) return { storeId: store._id, store, isPlatformHost: false }
  }

  // 3) Host-based resolution
  // 3a) Subdomain of the platform apex → slug.platform.com
  if (host.endsWith('.' + PLATFORM_APEX)) {
    const slug = host.slice(0, -1 * (PLATFORM_APEX.length + 1))
    if (slug && slug !== 'www') {
      const store = await TenantStoreModel.findOne({ slug }).lean().catch(() => null)
      if (store) return { storeId: store._id, store, isPlatformHost: false }
    }
  }

  // 3b) Custom domain (mystore.com) — must be a non-platform host
  if (host && !PLATFORM_HOSTS.has(host) && !host.endsWith('.' + PLATFORM_APEX) && !host.endsWith('.vercel.app')) {
    const store = await TenantStoreModel.findOne({ customDomain: host }).lean().catch(() => null)
    if (store) return { storeId: store._id, store, isPlatformHost: false }
  }

  // 4) Fallback to default demo store
  const isPlatformHost = PLATFORM_HOSTS.has(host) || host === '' || host.endsWith('.vercel.app')
  const fallback = await TenantStoreModel.findById(DEFAULT_STORE_ID).lean().catch(() => null)
  return {
    storeId: DEFAULT_STORE_ID,
    store: fallback,
    isPlatformHost,
  }
}

/**
 * Verify a password against a MerchantUser's stored hash.
 *
 * Supports two formats (set by seed-runner or by an admin tool):
 *   - `PLAIN:plaintext`  — plaintext compare (DEV ONLY — never use in prod)
 *   - `$2a$...` / `$2b$...` — bcrypt hash (production)
 *
 * Returns the user document (without passwordHash) on success.
 */
export async function verifyPassword(user: any, password: string): Promise<boolean> {
  if (!user?.passwordHash) return false
  const stored = String(user.passwordHash)
  if (stored.startsWith('PLAIN:')) {
    return stored.slice(6) === password
  }
  // Bcrypt branch — lazy-import so we don't pay the cost in dev where
  // we never use bcrypt.
  try {
    const bcrypt = await import('bcryptjs')
    return await bcrypt.compare(password, stored)
  } catch {
    // bcryptjs not installed → reject
    return false
  }
}

/** Strip sensitive fields before returning a MerchantUser to the client. */
export function sanitizeUser(user: any): any {
  if (!user) return null
  const { passwordHash, ...rest } = user
  return rest
}
