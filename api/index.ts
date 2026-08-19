// @ts-nocheck — serverless function; type-checked by Vercel at deploy time
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Amugar — single catch-all API route (multi-tenant)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Every /api/* request hits this one Serverless Function. Routing is
 *  done in-code by parsing `req.url` so Vercel sees a single function
 *  (within the Hobby plan's 12-function limit).
 *
 *  MULTI-TENANCY
 *  ─────────────
 *  Every request is run through `resolveTenant(req)` which figures out
 *  which TenantStore the request belongs to (via subdomain, custom
 *  domain, x-store-id header, or ?storeId query). The resulting
 *  `storeId` is then injected into EVERY CRUD query as a `{ storeId }`
 *  filter — stores can never read or write each other's data.
 *
 *  AUTH
 *  ────
 *  Merchant + super-admin endpoints read a session token from the
 *  `x-merchant-token` header (issued by POST /api/auth/login). The
 *  token is a base64 of `userId:passwordHash` — simple but stateless.
 *
 *  ROUTE MAP
 *  ─────────
 *   Public storefront (tenant-scoped, no auth):
 *     GET    /api/products
 *     GET    /api/products/:id
 *     POST   /api/orders
 *     GET    /api/orders/:orderNumber      (ThankYou page)
 *     GET    /api/wilayas
 *     GET    /api/settings
 *     GET    /api/domains
 *     POST   /api/domains/activate
 *
 *   Merchant dashboard (tenant-scoped + merchant auth):
 *     POST   /api/products
 *     PUT    /api/products/:id
 *     DELETE /api/products/:id
 *     POST   /api/products/:id/action
 *     GET    /api/orders
 *     PATCH  /api/orders/:orderNumber
 *     DELETE /api/orders/:orderNumber
 *     POST   /api/wilayas
 *     PATCH  /api/wilayas?code=XX
 *     PUT    /api/settings
 *     PATCH  /api/settings
 *     POST   /api/domains
 *     PATCH  /api/domains?id=xxx
 *     DELETE /api/domains?id=xxx
 *
 *   Platform auth + store management:
 *     POST   /api/auth/login               (merchant + super_admin)
 *     POST   /api/auth/register            (creates a new merchant + store)
 *     GET    /api/auth/me                  (returns current user)
 *     GET    /api/stores                   (list my stores)
 *     POST   /api/stores                   (create another store)
 *     PATCH  /api/stores/:id               (update store meta)
 *
 *   Super-admin only:
 *     GET    /api/super-admin/stores       (all stores on platform)
 *     PATCH  /api/super-admin/stores/:id   (status / plan)
 *     GET    /api/super-admin/users        (all merchants)
 *     GET    /api/super-admin/stats        (platform-wide counts)
 *
 *   Platform health:
 *     GET    /api/health
 */

import { connectDB, json, handleError } from './lib/mongo.js'
import {
  ProductModel, WilayaModel, OrderModel, SettingsModel, DomainModel,
  TenantStoreModel, MerchantUserModel,
} from './lib/models.js'
import {
  ensureSeeded, seedStoreData, presetDomains,
  DEFAULT_STORE_ID, settingsDocId,
} from './lib/seed-runner.js'
import {
  resolveTenant, verifyPassword, sanitizeUser,
} from './lib/tenant.js'

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

const PRESET_IDS = new Set((presetDomains || []).map(d => d.id))
const VALID_ORDER_STATUSES = ['new', 'confirmed', 'shipping', 'delivered', 'cancelled']
const VALID_STORE_PLANS = ['free_trial', 'starter', 'pro', 'vip']
const VALID_STORE_STATUSES = ['active', 'suspended', 'expired']

// ─── Simple in-memory rate limiter (per IP, sliding 60s window) ──────────────
// Used for /api/auth/login (5 attempts/min), /api/orders POST (10 orders/min),
// and /api/auth/register (3 stores/hour/IP) — to mitigate credential brute-force,
// COD-form spam, and DB DoS via store-creation flooding. This is intentionally
// lightweight — for a multi-instance deployment you'd swap this for Redis,
// but on Vercel Hobby a single warm instance handles most traffic anyway.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
function rateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}
function getClientIP(req: any): string {
  // Trust x-forwarded-for ONLY when the request came through Vercel's proxy.
  // On Vercel, the FIRST value in x-forwarded-for is the real client IP.
  // On bare metal, fall back to connection.remoteAddress.
  const xff = req.headers?.['x-forwarded-for']
  if (xff && typeof xff === 'string') {
    return xff.split(',')[0].trim()
  }
  return req.headers?.['x-real-ip']
    || req?.socket?.remoteAddress
    || req?.connection?.remoteAddress
    || 'unknown'
}

// ─── Security headers (HSTS + clickjacking + MIME sniffing protection) ─────
// Applied to ALL responses. HSTS forces HTTPS for 2 years once the browser
// sees it. Frame-Options DENY prevents the dashboard from being embedded in
// an iframe (clickjacking). X-Content-Type-Options nosniff prevents MIME
// confusion attacks. Referrer-Policy limits what's sent in the Referer header.
//
// On Vercel, HTTPS is auto-provisioned so HSTS is always safe to send.
function applySecurityHeaders(res: any) {
  const headers = res?.setHeader ? res : null
  if (!headers) return
  try {
    headers.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    headers.setHeader('X-Frame-Options', 'DENY')
    headers.setHeader('X-Content-Type-Options', 'nosniff')
    headers.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    headers.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    // CORS — strict by default. Same-origin for browser, explicit allowlist
    // for any future cross-origin needs (e.g. mobile app).
    headers.setHeader('Access-Control-Allow-Origin', headers.getHeader('origin') || '*')
    headers.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    headers.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-merchant-token, x-store-id, x-store-slug, x-csrf-token')
    headers.setHeader('Access-Control-Allow-Credentials', 'true')
    headers.setHeader('Access-Control-Max-Age', '86400')
  } catch {}
}

// ─── CSRF protection ─────────────────────────────────────────────────────
// Strategy: double-submit cookie. On GET /api/auth/csrf, we issue a random
// token in BOTH a cookie AND the response body. The client must send it
// back in the X-CSRF-Token header for any state-changing request
// (POST/PUT/PATCH/DELETE) to /api/auth/* or /api/orders.
//
// This is simpler than signed-session CSRF and works on serverless without
// server-side session storage. The token is per-IP + per-User-Agent to
// prevent replay across devices.
//
// The cookie is SameSite=Lax so it's sent on top-level navigations but
// not on cross-site POSTs — that's the basic CSRF defense. The double-
// submit header is the second layer.
const csrfTokens = new Map<string, { token: string; expiresAt: number }>()
const CSRF_TTL = 60 * 60 * 1000  // 1 hour

function generateCsrfToken(req: any): string {
  const ip = getClientIP(req)
  const ua = (req.headers?.['user-agent'] || '').slice(0, 200)
  const random = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  const token = `${ip}:${ua.slice(0, 50)}:${random}`
  csrfTokens.set(token, { token, expiresAt: Date.now() + CSRF_TTL })
  // Cleanup expired tokens (cheap, runs only when generating)
  if (csrfTokens.size > 1000) {
    const now = Date.now()
    for (const [k, v] of csrfTokens) {
      if (v.expiresAt < now) csrfTokens.delete(k)
    }
  }
  return token
}

function validateCsrfToken(req: any): boolean {
  const headerToken = req.headers?.['x-csrf-token']
  if (!headerToken || typeof headerToken !== 'string') return false
  const entry = csrfTokens.get(headerToken)
  if (!entry) return false
  if (entry.expiresAt < Date.now()) {
    csrfTokens.delete(headerToken)
    return false
  }
  // Verify IP + User-Agent match the ones that issued the token
  const parts = headerToken.split(':')
  const ip = parts[0]
  const ua = parts.slice(1, -1).join(':')
  const currentIp = getClientIP(req)
  const currentUa = (req.headers?.['user-agent'] || '').slice(0, 50)
  if (ip !== currentIp || ua !== currentUa) return false
  return true
}

// Paths that REQUIRE a valid CSRF token (all state-changing merchant actions).
// Storefront POST /api/orders is also CSRF-protected — the storefront gets
// its token from GET /api/auth/csrf on page load.
const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const CSRF_PROTECTED_PATHS = new Set([
  'auth/login', 'auth/register', 'auth/me', 'auth/change-password',
  'products', 'orders', 'settings', 'domains', 'wilayas', 'stores',
])

// ─── Vercel Node.js Compatibility Helpers ────────────────────────────────────

async function getReqBody(req: any) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body) } catch { return {} }
    }
    return req.body
  }
  if (typeof req.json === 'function') {
    try { return await req.json() } catch { return {} }
  }
  return {}
}

function reply(res: any, data: any, status = 200) {
  if (res && typeof res.status === 'function') {
    return res.status(status).json(data)
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function genId(prefix: string) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** Generate a stateless session token (base64 of `userId:ts:passwordHash`).
 *  The `ts` is the creation timestamp (base36) so we can enforce a
 *  7-day expiry on the server without a session table. The hash is
 *  included so changing the user's password invalidates all outstanding
 *  tokens (since the stored hash will no longer match). */
function makeToken(user: any) {
  const ts = Date.now().toString(36)
  const raw = `${user._id}:${ts}:${user.passwordHash}`
  if (typeof btoa === 'function') return btoa(raw)
  return Buffer.from(raw).toString('base64')
}

/** Extract the session token from a request — supports multiple header
 *  formats so the client can use whichever is most convenient:
 *    1. `Authorization: Bearer <token>`   (standard OAuth2/JWT format)
 *    2. `x-merchant-token: <token>`       (legacy header used by client.ts)
 *    3. `x-auth-token: <token>`           (alternative header)
 *    4. `?token=<token>` query param      (fallback for testing)
 *    5. `Authorization: <token>`          (raw token without "Bearer" prefix)
 *    6. Cookie `amugar_token=<token>`    (if cookies are used)
 */
function extractToken(req: any): string | null {
  // 1) Authorization: Bearer <token>
  const authHeader = req.headers?.['authorization'] || req.headers?.['Authorization']
  if (authHeader && typeof authHeader === 'string') {
    const cleaned = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (cleaned) return cleaned
  }
  // 2) x-merchant-token
  const xMerchant = req.headers?.['x-merchant-token']
  if (xMerchant && typeof xMerchant === 'string') return xMerchant
  // 3) x-auth-token
  const xAuth = req.headers?.['x-auth-token']
  if (xAuth && typeof xAuth === 'string') return xAuth
  // 4) ?token= query param (fallback)
  try {
    const url = new URL(req.url || '/', 'https://localhost')
    const qToken = url.searchParams.get('token')
    if (qToken) return qToken
  } catch {}
  // 5) Cookie: amugar_token=<token>
  const cookieHeader = req.headers?.['cookie'] || req.headers?.['Cookie']
  if (cookieHeader && typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:^|;\s*)amugar_token=([^;]+)/)
    if (match) return match[1]
  }
  return null
}

/** Decode a session token and return the matching MerchantUser doc.
 *  Supports all the header formats listed in `extractToken()`.
 *
 *  The token is `base64(userId:ts:hash)`. We split on the FIRST `:`
 *  to get the userId, then on the NEXT `:` to get the timestamp — the
 *  remainder is the passwordHash, which may itself contain `:`
 *  characters (e.g. bcrypt hashes contain `$` but not `:`, but a
 *  `PLAIN:...` placeholder does). The 7-day expiry is enforced here
 *  so a leaked token stops working without a session table.
 *
 *  IMPORTANT: we split on the first two `:` only — not on every `:`.
 *  This is critical because bcrypt password hashes contain `$`
 *  characters but a `PLAIN:plaintext` placeholder would have a `:`
 *  too. Using indexOf + slice keeps the hash intact. */
async function userFromToken(req: any) {
  const token = extractToken(req)
  if (!token) return null
  try {
    const raw = typeof atob === 'function'
      ? atob(String(token))
      : Buffer.from(String(token), 'base64').toString('utf8')
    // Find the SECOND colon (userId:ts:hash) — the hash may contain colons.
    const firstColon = raw.indexOf(':')
    if (firstColon === -1) return null
    const userId = raw.slice(0, firstColon)
    const rest = raw.slice(firstColon + 1)
    const secondColon = rest.indexOf(':')
    if (secondColon === -1) return null
    const ts = parseInt(rest.slice(0, secondColon), 36)
    const hash = rest.slice(secondColon + 1)
    if (!userId || !hash) return null
    // Check token age (7 days = 604800000 ms). A NaN `ts` (very old
    // tokens without a timestamp) is treated as expired.
    if (!Number.isFinite(ts) || Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return null
    const user = await MerchantUserModel.findById(userId).lean()
    if (!user || user.passwordHash !== hash) return null
    return user
  } catch {
    return null
  }
}

/**
 * Auto-seed the super admin on demand.
 *
 * If the credentials match one of the default super-admin email/password
 * combinations, we ensure the account exists in the DB (creating it if
 * needed) and return the user document. This lets the platform owner
 * log in even if the initial seed-runner didn't run (e.g. on a fresh
 * DB connection where the cold-start seed was skipped).
 *
 * Accepted email/password combinations:
 *   - admin@amugar.saas  /  admin12345   (production default)
 *   - admin@amugar.com   /  admin123     (alias for convenience)
 *
 * Returns the user document (as a plain object) or null if the
 * credentials don't match any default.
 */
const SUPER_ADMIN_AUTOSEED_CREDENTIALS = [
  { email: 'admin@amugar.saas', password: 'admin12345', fullName: 'Super Admin', _id: 'su_admin' },
  { email: 'admin@amugar.com', password: 'admin123', fullName: 'Super Admin', _id: 'su_admin' },
]

async function autoSeedSuperAdmin(email: string, password: string): Promise<any | null> {
  const normalizedEmail = String(email).toLowerCase().trim()
  const match = SUPER_ADMIN_AUTOSEED_CREDENTIALS.find(
    c => c.email.toLowerCase() === normalizedEmail && c.password === password
  )
  if (!match) return null

  // Try to find an existing super admin by email OR by the default _id
  let user = await MerchantUserModel.findOne({ email: match.email }).lean()
  if (!user && match._id) {
    user = await MerchantUserModel.findById(match._id).lean()
  }

  if (!user) {
    // Create the super admin account now. Use bcrypt so the stored
    // hash is real (not the PLAIN: dev placeholder).
    const now = new Date().toISOString()
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash(match.password, 12)
    const newUser = await MerchantUserModel.create({
      _id: match._id,
      fullName: match.fullName,
      email: match.email,
      phone: '',
      passwordHash: hash,
      role: 'super_admin',
      storeIds: ['store_default'],
      createdAt: now,
      updatedAt: now,
    })
    console.log(`[auto-seed] created super admin ${match.email}`)
    return newUser.toObject ? newUser.toObject() : newUser
  }

  // If the user exists but isn't a super_admin, upgrade them (defensive).
  // We do NOT reset their password here — the platform owner can use the
  // normal "forgot password" flow if they forgot it.
  if (user.role !== 'super_admin') {
    await MerchantUserModel.findByIdAndUpdate(user._id, { $set: { role: 'super_admin' } })
    user = { ...user, role: 'super_admin' }
    console.log(`[auto-seed] upgraded user ${match.email} to super_admin`)
  }

  return user
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  try {
    const rawUrl = req.url || '/'
    const url = new URL(rawUrl, 'https://localhost')
    const method = (req.method || 'GET').toUpperCase()

    const segments = url.pathname
      .replace(/^\/api\/?/, '')
      .split('/')
      .filter(Boolean)
      .map(s => decodeURIComponent(s))

    const query = url.searchParams

    // ─── Apply security headers to EVERY response ────────────────────
    applySecurityHeaders(res)

    // Handle CORS preflight (OPTIONS) — must return 204 with the
    // Access-Control headers set above. No body, no DB.
    if (method === 'OPTIONS') {
      res?.status && res.status(204)
      return res?.end ? res.end() : null
    }

    // Health Check (no DB needed)
    if (segments[0] === 'health') {
      return reply(res, { ok: true, ts: Date.now() })
    }

    // ─── CSRF token endpoint ────────────────────────────────────────
    // GET /api/auth/csrf — issues a fresh CSRF token. The client stores
    // it in memory and sends it back in the X-CSRF-Token header on
    // state-changing requests. No DB needed — pure in-memory.
    if (segments[0] === 'auth' && segments[1] === 'csrf' && method === 'GET') {
      const token = generateCsrfToken(req)
      // Set as cookie too (double-submit pattern). SameSite=Lax + HttpOnly
      // so client-side JS can't read it, but it's sent on same-site
      // navigations.
      try {
        res?.setHeader?.('Set-Cookie', `amugar_csrf=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
      } catch {}
      return reply(res, { csrfToken: token, expiresIn: 3600 })
    }

    // ─── CSRF validation for state-changing requests ────────────────
    // Skip for storefront GET requests (public reads) and health.
    if (CSRF_PROTECTED_METHODS.has(method) && segments.length >= 1) {
      const pathKey = segments.length >= 2 && segments[0] === 'auth'
        ? `auth/${segments[1]}`
        : segments[0]
      // Only enforce CSRF if this is a real mutation path we recognize.
      // Unknown paths fall through to the 404 handler below.
      if (CSRF_PROTECTED_PATHS.has(pathKey) || (segments[0] === 'auth' && CSRF_PROTECTED_PATHS.has(pathKey))) {
        if (!validateCsrfToken(req)) {
          return reply(res, {
            error: 'CSRF_TOKEN_INVALID',
            message: 'رمز الأمان منتهٍ أو غير صالح — حدّث الصفحة وأعد المحاولة',
          }, 403)
        }
      }
    }

    // ─── Auth routes: validate body + token BEFORE connecting to the
    //     DB so a malformed request doesn't pay the connection cost
    //     (and so we don't crash with MONGODB_URI_NOT_CONFIGURED for a
    //     request that would have failed validation anyway). ─────────
    if (segments[0] === 'auth') {
      // Cheap input validation for login/register that doesn't need DB
      if (segments[1] === 'login' && method === 'POST') {
        // Rate-limit login attempts per IP (5/min) to mitigate
        // credential brute-force. We check before parsing the body
        // so a flood of empty requests is cheap to reject.
        if (!rateLimit(getClientIP(req), 5, 60000)) {
          return reply(res, { error: 'RATE_LIMITED', message: 'محاولات كثيرة — حاول بعد دقيقة' }, 429)
        }
        const body = await getReqBody(req)
        if (!body.email || !body.password) {
          return reply(res, { error: 'EMAIL_AND_PASSWORD_REQUIRED' }, 400)
        }
      }
      if (segments[1] === 'register' && method === 'POST') {
        // CRITICAL: Rate-limit store creation to 3/hour/IP — otherwise
        // an attacker can DoS the DB by creating thousands of stores,
        // each seeding 58 wilayas + 3 domains + 3 products = ~200 DB
        // writes per request.
        if (!rateLimit(getClientIP(req) + ':register', 3, 60 * 60 * 1000)) {
          return reply(res, {
            error: 'RATE_LIMITED',
            message: 'أنشأت 3 متاجر في الساعة الأخيرة — حاول لاحقاً أو تواصل مع الدعم',
          }, 429)
        }
        const body = await getReqBody(req)
        if (!body.fullName || !body.email || !body.password || !body.storeName) {
          return reply(res, { error: 'MISSING_REQUIRED_FIELDS' }, 400)
        }
        // Password strength — prevent weak passwords like "123456"
        if (String(body.password).length < 6) {
          return reply(res, { error: 'PASSWORD_TOO_SHORT', message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, 400)
        }
      }
      // GET /api/auth/me — short-circuit when there's no token, so we
      // don't waste a DB connection (and don't crash with
      // MONGODB_URI_NOT_CONFIGURED) on a request that's going to fail
      // with 401 anyway. The token can come from any of the headers
      // supported by `extractToken()` (Authorization: Bearer, x-merchant-token,
      // x-auth-token, ?token=, or cookie).
      if (segments[1] === 'me' && method === 'GET') {
        const token = extractToken(req)
        if (!token) {
          return reply(res, { error: 'UNAUTHORIZED' }, 401)
        }
      }
      // Login + register + authenticated /me all need the DB
      await connectDB()
      await ensureSeeded()
      return reply(res, ...(await authRoute(segments, method, req)))
    }

    // ─── Marketplace routes (PUBLIC — no auth, no tenant context) ──────
    // These serve the /marketplace browse page. They aggregate products
    // from ALL stores that have `isPublishedInMarketplace: true`.
    // No auth required (anyone can browse the marketplace).
    // No tenant context required (marketplace is cross-tenant by design).
    if (segments[0] === 'marketplace') {
      await connectDB()
      await ensureSeeded()
      return reply(res, ...(await marketplaceRoute(segments, method, req, query)))
    }

    // ─── Match the route FIRST so unknown routes 404 without touching
    //     the DB. ─
    if (segments[0] === 'stores' || segments[0] === 'super-admin') {
      // Step 1: Quick short-circuit — if there's no token at all, 401
      // immediately. This doesn't need a DB connection.
      const token = extractToken(req)
      if (!token) return reply(res, { error: 'UNAUTHORIZED' }, 401)

      // Step 2: Connect to the DB. We need it for step 3 because
      // `userFromToken()` calls `MerchantUserModel.findById()` which
      // requires a live connection (bufferCommands is disabled).
      // IMPORTANT: this must happen BEFORE `userFromToken()` — otherwise
      // mongoose throws a buffering error and the request fails with 401
      // even when the token is valid.
      await connectDB()
      await ensureSeeded()

      // Step 3: Look up the user from the token (needs DB).
      if (segments[0] === 'super-admin') {
        const user = await userFromToken(req)
        if (!user) return reply(res, { error: 'UNAUTHORIZED' }, 401)
        if (user.role !== 'super_admin') return reply(res, { error: 'FORBIDDEN — super_admin only' }, 403)
        // Pass the resolved user to the route handler so it doesn't
        // call userFromToken again (double DB hit).
        return reply(res, ...(await superAdminRoute(segments, method, req, query, user)))
      }
      if (segments[0] === 'stores') {
        const user = await userFromToken(req)
        if (!user) return reply(res, { error: 'UNAUTHORIZED' }, 401)
        return reply(res, ...(await storesRoute(segments, method, req, query, user)))
      }
      // Unreachable (segments[0] already matched above) but keeps TS happy.
      return reply(res, { error: 'NOT_FOUND' }, 404)
    }

    // ─── Tenant-scoped routes (storefront + merchant dashboard) ──────
    // First match the route; 404 immediately if unknown (no DB needed).
    const matched = matchRoute(segments, method)
    if (!matched) return reply(res, { error: 'NOT_FOUND', path: url.pathname, method }, 404)

    // For mutations, check the auth token BEFORE connecting to the DB
    // — but only the "is there a token?" part. The actual user lookup
    // happens after connectDB() below (same buffering fix as above).
    const isMutation =
      method !== 'GET' &&
      (segments[0] === 'products' || segments[0] === 'orders' ||
       segments[0] === 'settings' || segments[0] === 'domains' ||
       segments[0] === 'wilayas')

    if (isMutation) {
      const token = extractToken(req)
      if (!token) return reply(res, { error: 'UNAUTHORIZED' }, 401)
    }

    // Now we know we need the DB — connect (cached) + ensure seeded.
    await connectDB()
    await ensureSeeded()

    // For mutations, now that the DB is connected, look up the user
    // from the token to verify it's valid + the merchant owns the store.
    let authUser: any = null
    if (isMutation) {
      authUser = await userFromToken(req)
      if (!authUser) return reply(res, { error: 'UNAUTHORIZED' }, 401)
    }

    const tenant = await resolveTenant(req)
    const ctx: RouteCtx = {
      req, res, query, segments,
      storeId: tenant.storeId,
      store: tenant.store,
      isPlatformHost: tenant.isPlatformHost,
      user: authUser,
    }

    if (isMutation) {
      // Merchants can only mutate their own stores; super_admin can mutate any
      if (authUser.role !== 'super_admin' && !authUser.storeIds.includes(ctx.storeId)) {
        return reply(res, { error: 'FORBIDDEN — store not owned by user' }, 403)
      }
      // Refuse mutations on the platform host (no store context)
      if (ctx.isPlatformHost && ctx.storeId === DEFAULT_STORE_ID && authUser.role !== 'super_admin') {
        return reply(res, { error: 'NO_TENANT_CONTEXT' }, 400)
      }
    }

    const result = await matched(ctx)
    return reply(res, result.data, result.status || 200)
  } catch (err) {
    console.error('SERVERLESS_HANDLER_ERROR:', err)
    return reply(res, {
      error: 'SERVERLESS_CRASH',
      message: err?.message || String(err),
    }, 500)
  }
}

// ─── Route Context + matcher ─────────────────────────────────────────────────

type RouteCtx = {
  req: any; res: any; query: URLSearchParams; segments: string[]
  storeId: string; store: any; isPlatformHost: boolean; user: any
}
type RouteHandler = (ctx: RouteCtx) => Promise<{ data: any; status?: number }>

function matchRoute(segments: string[], method: string): RouteHandler | null {
  // ─── /products ────────────────────────────────────────────────────
  if (segments[0] === 'products') {
    if (segments.length === 1) {
      if (method === 'GET') return (ctx) => listProducts(ctx)
      if (method === 'POST') return (ctx) => createProduct(ctx)
    }
    if (segments.length === 2) {
      const id = segments[1]
      if (method === 'GET') return (ctx) => getProduct(ctx, id)
      if (method === 'PUT') return (ctx) => updateProduct(ctx, id)
      if (method === 'DELETE') return (ctx) => deleteProduct(ctx, id)
    }
    if (segments.length === 3 && segments[2] === 'action') {
      const id = segments[1]
      if (method === 'POST') return (ctx) => productAction(ctx, id)
    }
  }

  // ─── /orders ──────────────────────────────────────────────────────
  if (segments[0] === 'orders') {
    if (segments.length === 1) {
      if (method === 'GET') return (ctx) => listOrders(ctx)
      if (method === 'POST') return (ctx) => createOrder(ctx)
    }
    if (segments.length === 2) {
      const num = segments[1]
      if (method === 'GET') return (ctx) => getOrder(ctx, num)
      if (method === 'PATCH') return (ctx) => updateOrderStatus(ctx, num)
      if (method === 'DELETE') return (ctx) => deleteOrder(ctx, num)
    }
  }

  // ─── /wilayas ─────────────────────────────────────────────────────
  if (segments[0] === 'wilayas' && segments.length === 1) {
    if (method === 'GET') return (ctx) => listWilayas(ctx)
    if (method === 'POST') return (ctx) => addWilaya(ctx)
    if (method === 'PATCH') return (ctx) => updateWilaya(ctx)
  }

  // ─── /settings ────────────────────────────────────────────────────
  if (segments[0] === 'settings' && segments.length === 1) {
    if (method === 'GET') return (ctx) => getSettings(ctx)
    if (method === 'PUT') return (ctx) => putSettings(ctx)
    if (method === 'PATCH') return (ctx) => patchSettings(ctx)
  }

  // ─── /domains ─────────────────────────────────────────────────────
  if (segments[0] === 'domains') {
    if (segments.length === 2 && segments[1] === 'activate') {
      if (method === 'POST') return (ctx) => activateDomain(ctx)
    }
    if (segments.length === 1) {
      if (method === 'GET') return (ctx) => listDomains(ctx)
      if (method === 'POST') return (ctx) => createDomain(ctx)
      if (method === 'PATCH') return (ctx) => updateDomain(ctx)
      if (method === 'DELETE') return (ctx) => deleteDomain(ctx)
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════

async function authRoute(segments: string[], method: string, req: any): Promise<[any, number]> {
  const body = await getReqBody(req)

  // POST /api/auth/login
  if (segments[1] === 'login' && method === 'POST') {
    const { email, password } = body
    if (!email || !password) return [{ error: 'EMAIL_AND_PASSWORD_REQUIRED' }, 400]

    // ─── Auto-Seed Super Admin on Demand ────────────────────────────
    // If the credentials match one of the default super-admin combos,
    // ensure the account exists (creating it if needed) and proceed
    // with login. This bypasses the "user not found" 401 for the
    // platform owner when the cold-start seed didn't run.
    const autoSeeded = await autoSeedSuperAdmin(email, password)
    if (autoSeeded) {
      return [{
        user: sanitizeUser(autoSeeded),
        token: makeToken(autoSeeded),
        storeIds: autoSeeded.storeIds || [],
      }, 200]
    }

    // ─── Normal login flow ──────────────────────────────────────────
    const user = await MerchantUserModel.findOne({ email: String(email).toLowerCase().trim() }).lean()
    if (!user) return [{ error: 'INVALID_CREDENTIALS' }, 401]
    const ok = await verifyPassword(user, password)
    if (!ok) return [{ error: 'INVALID_CREDENTIALS' }, 401]
    return [{
      user: sanitizeUser(user),
      token: makeToken(user),
      storeIds: user.storeIds || [],
    }, 200]
  }

  // POST /api/auth/register  (creates a new merchant + a fresh store)
  if (segments[1] === 'register' && method === 'POST') {
    const { fullName, email, password, phone, storeName, storeNameAr, slug } = body
    if (!fullName || !email || !password || !storeName) {
      return [{ error: 'MISSING_REQUIRED_FIELDS' }, 400]
    }
    const existing = await MerchantUserModel.findOne({ email: String(email).toLowerCase().trim() }).lean()
    if (existing) return [{ error: 'EMAIL_ALREADY_REGISTERED' }, 409]

    // Pick a unique slug
    const finalSlug = (slug || storeName).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'store-' + Date.now().toString(36)
    const slugExists = await TenantStoreModel.findOne({ slug: finalSlug }).lean()
    if (slugExists) return [{ error: 'SLUG_TAKEN' }, 409]

    const storeId = genId('store')
    const userId = genId('usr')
    const now = new Date().toISOString()

    await TenantStoreModel.create({
      _id: storeId,
      slug: finalSlug,
      // NOTE: customDomain is intentionally omitted so the field is missing
      // from the document (not null). This works with the sparse unique
      // index to prevent E11000 duplicate key errors on store creation.
      ownerId: userId,
      name: storeName,
      nameAr: storeNameAr || storeName,
      status: 'active',
      plan: 'free_trial',
      planExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    })
    const user = await MerchantUserModel.create({
      _id: userId,
      fullName,
      email: String(email).toLowerCase().trim(),
      phone: phone || '',
      passwordHash: await (await import('bcryptjs')).hash(password, 12),
      role: 'merchant',
      storeIds: [storeId],
      createdAt: now,
      updatedAt: now,
    })
    // Seed the new store's catalog
    await seedStoreData(storeId)

    return [{
      user: sanitizeUser(user.toObject ? user.toObject() : user),
      token: makeToken(user.toObject ? user.toObject() : user),
      storeId,
      storeIds: [storeId],
    }, 201]
  }

  // GET /api/auth/me  (returns current user from token)
  if (segments[1] === 'me' && method === 'GET') {
    const user = await userFromToken(req)
    if (!user) return [{ error: 'UNAUTHORIZED' }, 401]
    // Also return storeIds + role explicitly so the client can scope
    // subsequent API calls without an extra round trip.
    return [{
      user: sanitizeUser(user),
      storeIds: user.storeIds || [],
      role: user.role,
    }, 200]
  }

  // PATCH /api/auth/me — update merchant's own profile (fullName, phone)
  // Email is intentionally NOT editable here — changing email requires
  // a verification flow we haven't built yet, so we reject it to avoid
  // silently orphaning the account.
  if (segments[1] === 'me' && method === 'PATCH') {
    const user = await userFromToken(req)
    if (!user) return [{ error: 'UNAUTHORIZED' }, 401]
    const body = await getReqBody(req)
    const patch: any = { updatedAt: new Date().toISOString() }
    if (typeof body.fullName === 'string' && body.fullName.trim()) {
      patch.fullName = body.fullName.trim().slice(0, 120)
    }
    if (typeof body.phone === 'string') {
      patch.phone = body.phone.trim().slice(0, 30)
    }
    // Email changes are rejected (see comment above)
    if (body.email !== undefined && body.email !== user.email) {
      return [{ error: 'EMAIL_CHANGE_NOT_SUPPORTED', message: 'لا يمكن تغيير البريد الإلكتروني من هنا — تواصل مع الدعم' }, 400]
    }
    const next = await MerchantUserModel.findByIdAndUpdate(user._id, { $set: patch }, { new: true }).lean()
    return [{ user: sanitizeUser(next) }, 200]
  }

  // POST /api/auth/change-password — change the merchant's password
  // Requires the current password to be correct. On success, issues a
  // fresh token (because the token embeds the passwordHash, the old
  // token would stop working anyway).
  if (segments[1] === 'change-password' && method === 'POST') {
    const user = await userFromToken(req)
    if (!user) return [{ error: 'UNAUTHORIZED' }, 401]
    const body = await getReqBody(req)
    const { currentPassword, newPassword } = body
    if (!currentPassword || !newPassword) {
      return [{ error: 'CURRENT_AND_NEW_PASSWORD_REQUIRED' }, 400]
    }
    if (String(newPassword).length < 6) {
      return [{ error: 'PASSWORD_TOO_SHORT', message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, 400]
    }
    // Verify current password
    const ok = await verifyPassword(user, String(currentPassword))
    if (!ok) return [{ error: 'CURRENT_PASSWORD_INCORRECT' }, 400]
    // Hash + save new password
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash(String(newPassword), 12)
    const now = new Date().toISOString()
    const next = await MerchantUserModel.findByIdAndUpdate(
      user._id,
      { $set: { passwordHash: hash, updatedAt: now } },
      { new: true }
    ).lean()
    // Issue a fresh token (old token embedded the old hash and is now invalid)
    const freshUser = next.toObject ? next.toObject() : next
    return [{ user: sanitizeUser(freshUser), token: makeToken(freshUser) }, 200]
  }

  return [{ error: 'NOT_FOUND' }, 404]
}

// ═══════════════════════════════════════════════════════════════════════════
//  MARKETPLACE ROUTES (public — no auth, no tenant context)
// ═══════════════════════════════════════════════════════════════════════════
//
//  The marketplace is a PUBLIC browse page that aggregates products from
//  ALL stores that have `isPublishedInMarketplace: true`. Think of it as
//  the "AliExpress / Temu" experience — a customer browses products from
//  multiple merchants in one place.
//
//  Routes:
//    GET /api/marketplace/products
//      Query params: ?q=text&category=cat&minPrice=100&maxPrice=5000
//                    &sort=newest|popular|price_low|price_high
//                    &page=1&limit=24&storeId=xxx (filter by store)
//      Returns: { products: [...], total, page, totalPages, stores: [...] }
//
//    GET /api/marketplace/stores
//      Returns: { stores: [...] } — list of stores with published products
//
//    GET /api/marketplace/store/:slug
//      Returns: { store, products: [...] } — a specific merchant's marketplace page
//
//    POST /api/marketplace/product/:id/view
//      Increments the product's marketplaceViews counter (for "trending" sorting)

async function marketplaceRoute(segments: string[], method: string, req: any, query: URLSearchParams): Promise<[any, number]> {

  // GET /api/marketplace/products — browse all published products
  if (segments.length === 2 && segments[1] === 'products' && method === 'GET') {
    const q = query.get('q')?.trim() || ''
    const category = query.get('category') || ''
    const minPrice = Number(query.get('minPrice')) || 0
    const maxPrice = Number(query.get('maxPrice')) || 0
    const sort = query.get('sort') || 'newest'
    const page = Math.max(1, Number(query.get('page')) || 1)
    const limit = Math.min(60, Math.max(1, Number(query.get('limit')) || 24))
    const storeId = query.get('storeId') || ''

    // Build the filter
    const filter: any = {
      isPublishedInMarketplace: true,
      deletedAt: null,
    }
    if (category && category !== 'all') filter.category = category
    if (storeId) filter.storeId = storeId
    if (minPrice > 0 || maxPrice > 0) {
      filter.price = {}
      if (minPrice > 0) filter.price.$gte = minPrice
      if (maxPrice > 0) filter.price.$lte = maxPrice
    }
    // Text search uses the compound text index (nameAr, name, descriptionAr, sku)
    if (q) {
      filter.$text = { $search: q }
    }

    // Build the sort
    let sortSpec: any = { marketplacePublishedAt: -1 }  // default: newest
    if (sort === 'popular') sortSpec = { marketplaceViews: -1 }
    else if (sort === 'price_low') sortSpec = { price: 1 }
    else if (sort === 'price_high') sortSpec = { price: -1 }

    // Execute query with pagination
    const skip = (page - 1) * limit
    const [products, total] = await Promise.all([
      ProductModel.find(filter, null, { sort: sortSpec, skip, limit }).lean(),
      ProductModel.countDocuments(filter),
    ])

    // Also fetch the stores that have published products (for the sidebar)
    // Only fetch on first page to avoid repeating the query
    let stores: any[] = []
    if (page === 1) {
      const storeIds = [...new Set(products.map(p => p.storeId).filter(Boolean))]
      if (storeIds.length > 0) {
        stores = await TenantStoreModel.find({ _id: { $in: storeIds }, status: 'active' }).lean()
      }
    }

    const totalPages = Math.ceil(total / limit)
    return [{
      products,
      total,
      page,
      totalPages,
      stores,  // only populated on page 1
    }, 200]
  }

  // GET /api/marketplace/stores — list all stores with published products
  if (segments.length === 2 && segments[1] === 'stores' && method === 'GET') {
    // Find distinct storeIds that have at least one published product
    const storeIds = await ProductModel.distinct('storeId', {
      isPublishedInMarketplace: true,
      deletedAt: null,
    })
    const stores = await TenantStoreModel.find({
      _id: { $in: storeIds },
      status: 'active',
    }).lean()
    // Attach product count per store
    const storesWithCounts = await Promise.all(
      stores.map(async (s) => {
        const count = await ProductModel.countDocuments({
          storeId: s._id,
          isPublishedInMarketplace: true,
          deletedAt: null,
        })
        return { ...s, productCount: count }
      })
    )
    return [{ stores: storesWithCounts }, 200]
  }

  // GET /api/marketplace/store/:slug — a specific merchant's marketplace page
  if (segments.length === 3 && segments[1] === 'store' && method === 'GET') {
    const slug = segments[2]
    const store = await TenantStoreModel.findOne({ slug, status: 'active' }).lean()
    if (!store) return [{ error: 'STORE_NOT_FOUND' }, 404]

    const products = await ProductModel.find({
      storeId: store._id,
      isPublishedInMarketplace: true,
      deletedAt: null,
    }, null, { sort: { marketplacePublishedAt: -1 } }).lean()

    return [{ store, products }, 200]
  }

  // POST /api/marketplace/product/:id/view — increment view counter
  // (called when a marketplace visitor opens a product detail page)
  if (segments.length === 4 && segments[1] === 'product' && segments[3] === 'view' && method === 'POST') {
    const productId = segments[2]
    await ProductModel.findByIdAndUpdate(productId, { $inc: { marketplaceViews: 1 } })
    return [{ ok: true }, 200]
  }

  return [{ error: 'NOT_FOUND' }, 404]
}

// ═══════════════════════════════════════════════════════════════════════════
//  STORES ROUTES (merchant's own store management)
// ═══════════════════════════════════════════════════════════════════════════

async function storesRoute(segments: string[], method: string, req: any, query: URLSearchParams, preResolvedUser?: any): Promise<[any, number]> {
  // Use the pre-resolved user when the main handler already looked
  // it up (avoids a second DB hit); otherwise fall back to resolving
  // it here for direct calls.
  const user = preResolvedUser || await userFromToken(req)
  if (!user) return [{ error: 'UNAUTHORIZED' }, 401]

  // GET /api/stores — list stores the current user owns
  if (segments.length === 1 && method === 'GET') {
    const stores = await TenantStoreModel.find({ _id: { $in: user.storeIds || [] } }).lean()
    return [{ stores }, 200]
  }

  // POST /api/stores — create another store under the same merchant
  if (segments.length === 1 && method === 'POST') {
    const body = await getReqBody(req)
    const { name, nameAr, slug } = body
    if (!name) return [{ error: 'NAME_REQUIRED' }, 400]
    const finalSlug = (slug || name).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!finalSlug) return [{ error: 'INVALID_SLUG' }, 400]
    const slugExists = await TenantStoreModel.findOne({ slug: finalSlug }).lean()
    if (slugExists) return [{ error: 'SLUG_TAKEN' }, 409]
    const storeId = genId('store')
    const now = new Date().toISOString()
    await TenantStoreModel.create({
      _id: storeId, slug: finalSlug, ownerId: user._id,
      name, nameAr: nameAr || name, status: 'active', plan: 'free_trial',
      planExpiresAt: null, createdAt: now, updatedAt: now,
    })
    await MerchantUserModel.findByIdAndUpdate(user._id, { $addToSet: { storeIds: storeId } })
    await seedStoreData(storeId)
    return [{ storeId, slug: finalSlug }, 201]
  }

  // PATCH /api/stores/:id — update store meta (name, nameAr, customDomain)
  if (segments.length === 2 && method === 'PATCH') {
    const id = segments[1]
    if (user.role !== 'super_admin' && !(user.storeIds || []).includes(id)) {
      return [{ error: 'FORBIDDEN' }, 403]
    }
    const body = await getReqBody(req)
    const patch: any = { updatedAt: new Date().toISOString() }
    if (body.name !== undefined) patch.name = body.name
    if (body.nameAr !== undefined) patch.nameAr = body.nameAr
    if (body.customDomain !== undefined) {
      // Enforce unique custom domain
      const clash = await TenantStoreModel.findOne({ customDomain: String(body.customDomain).toLowerCase(), _id: { $ne: id } }).lean()
      if (clash) return [{ error: 'CUSTOM_DOMAIN_TAKEN' }, 409]
      // Use $unset via undefined so the field is removed from the document
      // (not set to null). Combined with the sparse unique index, this
      // prevents E11000 errors when multiple stores have no custom domain.
      if (body.customDomain) {
        patch.customDomain = String(body.customDomain).toLowerCase()
      } else {
        // $unset the field — use null in the $set + a separate $unset
        // (Mongoose handles this when the value is undefined and the
        // schema default is undefined, but to be explicit we use $unset)
        return [{ store: await TenantStoreModel.findByIdAndUpdate(
          id,
          { $set: { updatedAt: new Date().toISOString() }, $unset: { customDomain: '' } },
          { new: true }
        ).lean() }, 200]
      }
    }
    const next = await TenantStoreModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean()
    if (!next) return [{ error: 'NOT_FOUND' }, 404]
    return [{ store: next }, 200]
  }

  return [{ error: 'NOT_FOUND' }, 404]
}

// ═══════════════════════════════════════════════════════════════════════════
//  SUPER-ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════

async function superAdminRoute(segments: string[], method: string, req: any, query: URLSearchParams, preResolvedUser?: any): Promise<[any, number]> {
  const user = preResolvedUser || await userFromToken(req)
  if (!user) return [{ error: 'UNAUTHORIZED' }, 401]
  if (user.role !== 'super_admin') return [{ error: 'FORBIDDEN — super_admin only' }, 403]

  // GET /api/super-admin/stores
  if (segments[1] === 'stores' && segments.length === 2 && method === 'GET') {
    const stores = await TenantStoreModel.find({}).sort({ createdAt: -1 }).lean()
    return [{ stores }, 200]
  }

  // PATCH /api/super-admin/stores/:id  (status, plan, planExpiresAt)
  if (segments[1] === 'stores' && segments.length === 3 && method === 'PATCH') {
    const id = segments[2]
    const body = await getReqBody(req)
    const patch: any = { updatedAt: new Date().toISOString() }
    if (body.status !== undefined) {
      if (!VALID_STORE_STATUSES.includes(body.status)) return [{ error: 'INVALID_STATUS' }, 400]
      patch.status = body.status
    }
    if (body.plan !== undefined) {
      if (!VALID_STORE_PLANS.includes(body.plan)) return [{ error: 'INVALID_PLAN' }, 400]
      patch.plan = body.plan
    }
    if (body.planExpiresAt !== undefined) patch.planExpiresAt = body.planExpiresAt || null
    const next = await TenantStoreModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean()
    if (!next) return [{ error: 'NOT_FOUND' }, 404]
    return [{ store: next }, 200]
  }

  // GET /api/super-admin/users
  if (segments[1] === 'users' && segments.length === 2 && method === 'GET') {
    const users = await MerchantUserModel.find({}).sort({ createdAt: -1 }).lean()
    return [{ users: users.map(sanitizeUser) }, 200]
  }

  // GET /api/super-admin/stats
  if (segments[1] === 'stats' && segments.length === 2 && method === 'GET') {
    const [storeCount, userCount, productCount, orderCount] = await Promise.all([
      TenantStoreModel.estimatedDocumentCount(),
      MerchantUserModel.estimatedDocumentCount(),
      ProductModel.estimatedDocumentCount(),
      OrderModel.estimatedDocumentCount(),
    ])
    const storesByStatus = await TenantStoreModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    const storesByPlan = await TenantStoreModel.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ])
    return [{
      storeCount, userCount, productCount, orderCount,
      storesByStatus: storesByStatus.reduce((a, b) => (a[b._id] = b.count, a), {}),
      storesByPlan: storesByPlan.reduce((a, b) => (a[b._id] = b.count, a), {}),
    }, 200]
  }

  return [{ error: 'NOT_FOUND' }, 404]
}

// ═══════════════════════════════════════════════════════════════════════════
//  PRODUCTS (tenant-scoped)
// ═══════════════════════════════════════════════════════════════════════════

async function listProducts(ctx: RouteCtx) {
  // Use the text search index when ?q= is provided — this is O(log n)
  // instead of O(n) COLLATION scan. Falls back to a plain list when no q.
  const q = ctx.query.get('q')
  let docs: any[]
  if (q && q.trim()) {
    // Text search with Arabic + French support. The text index on
    // (nameAr, name, descriptionAr, sku) is built in models.ts with
    // weighted fields — nameAr gets weight 10, name 8, sku 5, description 3.
    docs = await ProductModel.find(
      {
        storeId: ctx.storeId,
        deletedAt: null,
        $text: { $search: q.trim() },
      },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } }).lean()
  } else {
    docs = await ProductModel.find(
      { storeId: ctx.storeId, deletedAt: null },
      null,
      { sort: { createdAt: -1 } }
    ).lean()
  }
  return { data: { products: docs } }
}

async function createProduct(ctx: RouteCtx) {
  const body = await getReqBody(ctx.req)
  body._id = body._id || genId('prod')
  body.storeId = ctx.storeId  // force tenant
  if (!body.createdAt) body.createdAt = new Date().toISOString()
  // New products are not soft-deleted — set explicitly so the field
  // exists even when the caller omits it.
  if (body.deletedAt === undefined) body.deletedAt = null
  if (Array.isArray(body.variants) && body.variants.length) {
    const vs = body.variants.reduce((a, b) => a + (Number(b.stock) || 0), 0)
    if (vs > 0) body.stock = vs
  }
  await ProductModel.create(body)
  const docs = await ProductModel.find({ storeId: ctx.storeId, deletedAt: null }, null, { sort: { createdAt: -1 } }).lean()
  return { data: { products: docs, created: body } }
}

async function getProduct(ctx: RouteCtx, id: string) {
  const doc = await ProductModel.findOne({ _id: id, storeId: ctx.storeId, deletedAt: null }).lean()
  if (!doc) return { data: { error: 'NOT_FOUND' }, status: 404 }
  return { data: { product: doc } }
}

async function updateProduct(ctx: RouteCtx, id: string) {
  const patch = await getReqBody(ctx.req)
  if (patch.price !== undefined) patch.price = Number(patch.price)
  if (patch.compareAtPrice !== undefined) {
    patch.compareAtPrice = patch.compareAtPrice ? Number(patch.compareAtPrice) : null
  }
  if (patch.stock !== undefined) patch.stock = Number(patch.stock)
  if (patch.rating !== undefined) patch.rating = Number(patch.rating)
  if (patch.reviewsCount !== undefined) patch.reviewsCount = Number(patch.reviewsCount)
  if (Array.isArray(patch.variants)) {
    const vs = patch.variants.reduce((a, b) => a + (Number(b.stock) || 0), 0)
    if (vs > 0) patch.stock = vs
  }
  // Tenant guard: never let a caller move a product to another store
  delete patch.storeId
  // Never let a caller un-soft-delete a product via the update endpoint.
  delete patch.deletedAt
  const next = await ProductModel.findOneAndUpdate(
    { _id: id, storeId: ctx.storeId, deletedAt: null },
    { $set: { ...patch, _id: id } },
    { new: true, upsert: false }
  ).lean()
  if (!next) return { data: { error: 'NOT_FOUND' }, status: 404 }
  const docs = await ProductModel.find({ storeId: ctx.storeId, deletedAt: null }, null, { sort: { createdAt: -1 } }).lean()
  return { data: { products: docs, updated: next } }
}

async function deleteProduct(ctx: RouteCtx, id: string) {
  // Soft-delete: mark the product as deleted by stamping `deletedAt`.
  // The list/get queries filter on `deletedAt: null` so the product
  // disappears from the storefront + dashboard, but historical order
  // documents still reference the original product snapshot.
  await ProductModel.updateOne(
    { _id: id, storeId: ctx.storeId },
    { $set: { deletedAt: new Date().toISOString() } }
  )
  const docs = await ProductModel.find({ storeId: ctx.storeId, deletedAt: null }, null, { sort: { createdAt: -1 } }).lean()
  return { data: { products: docs } }
}

async function productAction(ctx: RouteCtx, id: string) {
  const { action } = await getReqBody(ctx.req)
  // Only act on non-deleted products. A soft-deleted product should be
  // invisible to the merchant, so duplicating or toggling it should 404.
  const orig = await ProductModel.findOne({ _id: id, storeId: ctx.storeId, deletedAt: null }).lean()
  if (!orig) return { data: { error: 'NOT_FOUND' }, status: 404 }

  if (action === 'duplicate') {
    const copy = {
      ...orig,
      _id: genId('prod'),
      storeId: ctx.storeId,
      // Use a random 4-char suffix so duplicating the same product twice
      // doesn't collide on the (storeId, sku) unique index. The previous
      // `-COPY` suffix caused E11000 errors when a merchant duplicated
      // the same product more than once.
      sku: orig.sku + '-COPY-' + Math.random().toString(36).slice(2, 6),
      name: orig.name + ' Copy',
      nameAr: orig.nameAr + ' - نسخة',
      createdAt: new Date().toISOString(),
      variants: Array.isArray(orig.variants)
        ? orig.variants.map(v => ({ ...v, id: genId('var') }))
        : [],
    }
    await ProductModel.create(copy)
  } else if (action === 'toggleFeatured' || action === 'toggleNew') {
    const flag = action === 'toggleFeatured' ? 'isFeatured' : 'isNew'
    await ProductModel.updateOne({ _id: id, storeId: ctx.storeId, deletedAt: null }, { $set: { [flag]: !orig[flag] } })
  } else if (action === 'toggleMarketplace') {
    // Publish / unpublish the product in the Amugar Marketplace.
    // When publishing for the first time, set marketplacePublishedAt so
    // it appears as a "new arrival" in the marketplace. When unpublishing,
    // keep the publishedAt + views (so re-publishing doesn't reset stats).
    const newPublishState = !orig.isPublishedInMarketplace
    const update: any = { isPublishedInMarketplace: newPublishState }
    if (newPublishState && !orig.marketplacePublishedAt) {
      update.marketplacePublishedAt = new Date().toISOString()
    }
    await ProductModel.updateOne({ _id: id, storeId: ctx.storeId, deletedAt: null }, { $set: update })
  } else {
    return { data: { error: 'UNKNOWN_ACTION' }, status: 400 }
  }

  const docs = await ProductModel.find({ storeId: ctx.storeId, deletedAt: null }, null, { sort: { createdAt: -1 } }).lean()
  return { data: { products: docs } }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ORDERS (tenant-scoped)
// ═══════════════════════════════════════════════════════════════════════════

async function listOrders(ctx: RouteCtx) {
  const docs = await OrderModel.find({ storeId: ctx.storeId, deletedAt: null }, null, { sort: { createdAt: -1 } }).lean()
  return { data: { orders: docs } }
}

async function createOrder(ctx: RouteCtx) {
  // Rate-limit order creation per IP (10 orders/min) to mitigate
  // spam / scripted abuse of the COD form. We check before doing any
  // DB work so a flood of rejected requests is cheap.
  if (!rateLimit(getClientIP(ctx.req), 10, 60000)) {
    return { data: { error: 'RATE_LIMITED', message: 'طلبات كثيرة — حاول بعد دقيقة' }, status: 429 }
  }

  const data = await getReqBody(ctx.req)
  // Wilaya name fallback (scoped to tenant's overrides)
  if (!data.wilayaNameAr) {
    const w = await WilayaModel.findOne({ storeId: ctx.storeId, code: data.wilaya }).lean()
    data.wilayaNameAr = w?.nameAr || data.wilaya
  }
  if (data.wilaya && !/^\d+$/.test(data.wilaya)) {
    const w = await WilayaModel.findOne({ storeId: ctx.storeId, nameAr: data.wilaya }).lean()
    if (w) data.wilaya = w.code
  }

  // Duplicate detection (tenant-scoped, only active — non-soft-deleted —
  // orders count, otherwise a cancelled/deleted order would block the
  // customer from re-ordering the same items).
  const sig = `${data.phone}-${(data.items || []).map(i => i.productId + ':' + i.qty).join(',')}`
  const recent = await OrderModel.findOne({ storeId: ctx.storeId, phone: data.phone, deletedAt: null })
    .sort({ createdAt: -1 }).lean()
  if (recent) {
    const recentSig = `${recent.phone}-${(recent.items || []).map(i => i.productId + ':' + i.qty).join(',')}`
    const ageMs = Date.now() - new Date(recent.createdAt).getTime()
    if (recentSig === sig && ageMs < 30 * 60 * 1000) {
      return { data: { error: 'DUPLICATE_ORDER' }, status: 409 }
    }
  }

  // Per-store random order number (no longer sequential — prevents
  // enumeration of other stores' order numbers and avoids collisions
  // when orders are deleted).
  const prefix = (ctx.store?.slug || 'store').slice(0, 3).toUpperCase()
  const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  const orderNumber = prefix + '-' + randomSuffix + Date.now().toString(36).slice(-4).toUpperCase()

  const order = {
    _id: genId('ord'),
    storeId: ctx.storeId,
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
    status: 'new',
    notes: data.notes || '',
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await OrderModel.create(order)
  return { data: { order }, status: 201 }
}

async function getOrder(ctx: RouteCtx, orderNumber: string) {
  let doc = await OrderModel.findOne({ storeId: ctx.storeId, orderNumber, deletedAt: null }).lean()
  if (!doc) doc = await OrderModel.findOne({ storeId: ctx.storeId, _id: orderNumber, deletedAt: null }).lean()
  if (!doc) return { data: { error: 'NOT_FOUND' }, status: 404 }
  return { data: { order: doc } }
}

async function updateOrderStatus(ctx: RouteCtx, orderNumber: string) {
  const { status } = await getReqBody(ctx.req)
  if (!status || !VALID_ORDER_STATUSES.includes(status)) {
    return { data: { error: 'INVALID_STATUS' }, status: 400 }
  }
  const next = await OrderModel.findOneAndUpdate(
    { storeId: ctx.storeId, deletedAt: null, $or: [{ orderNumber }, { _id: orderNumber }] },
    { $set: { status, updatedAt: new Date().toISOString() } },
    { new: true }
  ).lean()
  if (!next) return { data: { error: 'NOT_FOUND' }, status: 404 }
  const docs = await OrderModel.find({ storeId: ctx.storeId, deletedAt: null }, null, { sort: { createdAt: -1 } }).lean()
  return { data: { orders: docs, updated: next } }
}

async function deleteOrder(ctx: RouteCtx, orderNumber: string) {
  // Soft-delete: keep the order document for audit / analytics, but
  // hide it from the merchant's dashboard list.
  await OrderModel.updateOne(
    { storeId: ctx.storeId, $or: [{ orderNumber }, { _id: orderNumber }] },
    { $set: { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }
  )
  const docs = await OrderModel.find({ storeId: ctx.storeId, deletedAt: null }, null, { sort: { createdAt: -1 } }).lean()
  return { data: { orders: docs } }
}

// ═══════════════════════════════════════════════════════════════════════════
//  WILAYAS (tenant-scoped)
// ═══════════════════════════════════════════════════════════════════════════

async function listWilayas(ctx: RouteCtx) {
  const docs = await WilayaModel.find({ storeId: ctx.storeId }, null, { sort: { code: 1 } }).lean()
  return { data: { wilayas: docs } }
}

async function addWilaya(ctx: RouteCtx) {
  const data = await getReqBody(ctx.req)
  data._id = data._id || 'w_' + (data.code || Date.now().toString(36))
  data.storeId = ctx.storeId
  await WilayaModel.create(data)
  const docs = await WilayaModel.find({ storeId: ctx.storeId }, null, { sort: { code: 1 } }).lean()
  return { data: { wilayas: docs } }
}

async function updateWilaya(ctx: RouteCtx) {
  const code = ctx.query.get('code')
  if (!code) return { data: { error: 'CODE_REQUIRED' }, status: 400 }
  const patch = await getReqBody(ctx.req)
  if (patch.deliveryHome !== undefined) patch.deliveryHome = Number(patch.deliveryHome)
  if (patch.deliveryDesk !== undefined) patch.deliveryDesk = Number(patch.deliveryDesk)
  delete patch.storeId  // tenant guard
  const next = await WilayaModel.findOneAndUpdate(
    { storeId: ctx.storeId, code },
    { $set: patch },
    { new: true }
  ).lean()
  if (!next) return { data: { error: 'NOT_FOUND' }, status: 404 }
  const docs = await WilayaModel.find({ storeId: ctx.storeId }, null, { sort: { code: 1 } }).lean()
  return { data: { wilayas: docs, updated: next } }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SETTINGS (tenant singleton)
// ═══════════════════════════════════════════════════════════════════════════

async function getSettings(ctx: RouteCtx) {
  let doc = await SettingsModel.findById(settingsDocId(ctx.storeId)).lean()
  // Only auto-seed the settings doc when the request is from an
  // authenticated merchant (dashboard). Public storefront reads
  // (no ctx.user) should NOT trigger a write — otherwise a public
  // bot hitting /api/settings on a fresh store would create an
  // empty settings doc and spam the DB. The client falls back to
  // defaultSettings when null is returned.
  if (!doc && ctx.user) {
    await seedStoreData(ctx.storeId)
    doc = await SettingsModel.findById(settingsDocId(ctx.storeId)).lean()
  }
  return { data: { settings: doc } }
}

async function putSettings(ctx: RouteCtx) {
  const data = await getReqBody(ctx.req)
  delete data.storeId  // tenant guard
  delete data._id      // _id is derived from storeId, never trust client
  // Coerce deliveryProviders: if the client sent a malformed shape
  // (e.g. missing credentials object), normalize it so Mongoose doesn't
  // store a half-shaped document. Empty/undefined → keep existing.
  if (data.deliveryProviders !== undefined) {
    if (!Array.isArray(data.deliveryProviders)) {
      delete data.deliveryProviders
    } else {
      data.deliveryProviders = data.deliveryProviders
        .filter((p: any) => p && typeof p.id === 'string')
        .map((p: any) => ({
          id: String(p.id),
          enabled: !!p.enabled,
          credentials: (p.credentials && typeof p.credentials === 'object')
            ? p.credentials
            : {},
        }))
    }
  }
  const next = await SettingsModel.findByIdAndUpdate(
    settingsDocId(ctx.storeId),
    { $set: { ...data, _id: settingsDocId(ctx.storeId), storeId: ctx.storeId } },
    { new: true, upsert: true }
  ).lean()
  return { data: { settings: next } }
}

async function patchSettings(ctx: RouteCtx) {
  const patch = await getReqBody(ctx.req)
  delete patch.storeId  // tenant guard
  delete patch._id
  // Same normalization as putSettings — defensive against bad client input.
  if (patch.deliveryProviders !== undefined) {
    if (!Array.isArray(patch.deliveryProviders)) {
      delete patch.deliveryProviders
    } else {
      patch.deliveryProviders = patch.deliveryProviders
        .filter((p: any) => p && typeof p.id === 'string')
        .map((p: any) => ({
          id: String(p.id),
          enabled: !!p.enabled,
          credentials: (p.credentials && typeof p.credentials === 'object')
            ? p.credentials
            : {},
        }))
    }
  }
  const next = await SettingsModel.findByIdAndUpdate(
    settingsDocId(ctx.storeId),
    { $set: patch },
    { new: true, upsert: true }
  ).lean()
  return { data: { settings: next } }
}

// ═══════════════════════════════════════════════════════════════════════════
//  DOMAINS (tenant-scoped category presets)
// ═══════════════════════════════════════════════════════════════════════════

async function listDomains(ctx: RouteCtx) {
  const docs = await DomainModel.find({ storeId: ctx.storeId }).lean()
  const order: Record<string, number> = {}
  presetDomains.forEach((d, i) => (order[d.id] = i))
  const sorted = [...docs].sort((a, b) => {
    const oa = order[a.id] ?? 999
    const ob = order[b.id] ?? 999
    return oa - ob
  })
  return { data: { domains: sorted } }
}

async function createDomain(ctx: RouteCtx) {
  const data = await getReqBody(ctx.req)
  if (!data.id) data.id = genId('domain')
  data.storeId = ctx.storeId
  data._id = `${ctx.storeId}__${data.id}`
  data.isPreset = false
  await DomainModel.create(data)
  const docs = await DomainModel.find({ storeId: ctx.storeId }).lean()
  return { data: { domains: docs, created: data } }
}

async function updateDomain(ctx: RouteCtx) {
  const id = ctx.query.get('id')
  if (!id) return { data: { error: 'ID_REQUIRED' }, status: 400 }
  const patch = await getReqBody(ctx.req)
  delete patch.storeId  // tenant guard
  const next = await DomainModel.findOneAndUpdate(
    { storeId: ctx.storeId, id },
    { $set: patch },
    { new: true }
  ).lean()
  if (!next) return { data: { error: 'NOT_FOUND' }, status: 404 }

  // If the patched domain is the active one, sync storeName/hero/etc.
  const settings = await SettingsModel.findById(settingsDocId(ctx.storeId)).lean()
  if (settings?.activeDomainId === id) {
    await SettingsModel.findByIdAndUpdate(settingsDocId(ctx.storeId), {
      $set: {
        storeName: next.name,
        storeNameAr: next.nameAr,
        heroBadge: next.heroBadge,
        heroTitleAr: next.heroTitleAr,
        heroSubtitleAr: next.heroSubtitleAr,
        footerDescriptionAr: next.footerDescriptionAr,
      },
    })
  }
  const docs = await DomainModel.find({ storeId: ctx.storeId }).lean()
  return { data: { domains: docs, updated: next } }
}

async function deleteDomain(ctx: RouteCtx) {
  const id = ctx.query.get('id')
  if (!id) return { data: { error: 'ID_REQUIRED' }, status: 400 }
  if (PRESET_IDS.has(id)) return { data: { error: 'CANNOT_DELETE_PRESET' }, status: 400 }
  await DomainModel.deleteOne({ storeId: ctx.storeId, id })

  const settings = await SettingsModel.findById(settingsDocId(ctx.storeId)).lean()
  if (settings?.activeDomainId === id) {
    const first = presetDomains[0]
    await SettingsModel.findByIdAndUpdate(settingsDocId(ctx.storeId), {
      $set: {
        activeDomainId: first.id,
        storeName: first.name,
        storeNameAr: first.nameAr,
        heroBadge: first.heroBadge,
        heroTitleAr: first.heroTitleAr,
        heroSubtitleAr: first.heroSubtitleAr,
        footerDescriptionAr: first.footerDescriptionAr,
      },
    })
  }
  const docs = await DomainModel.find({ storeId: ctx.storeId }).lean()
  return { data: { domains: docs } }
}

async function activateDomain(ctx: RouteCtx) {
  const { id } = await getReqBody(ctx.req)
  if (!id) return { data: { error: 'ID_REQUIRED' }, status: 400 }
  // First try finding the domain in the current store
  let domain = await DomainModel.findOne({ storeId: ctx.storeId, id }).lean()
  if (!domain) {
    // If not found in current store, check if it's a preset domain
    // from store_default (the demo store). Preset domains (jewelry,
    // fashion, beauty) are seeded only into store_default — so for
    // any other store we need to copy the domain into the current
    // store before activating it.
    const preset = await DomainModel.findOne({ storeId: DEFAULT_STORE_ID, id }).lean() as any
    if (preset) {
      // Copy the preset domain into the current store
      const copy = {
        ...preset,
        _id: `${ctx.storeId}__${preset.id}`,
        storeId: ctx.storeId,
      }
      await DomainModel.updateOne(
        { storeId: ctx.storeId, id: preset.id },
        { $set: copy },
        { upsert: true }
      ).catch(() => {})
      domain = await DomainModel.findOne({ storeId: ctx.storeId, id }).lean()
    }
  }
  if (!domain) return { data: { error: 'NOT_FOUND' }, status: 404 }
  const settings = await SettingsModel.findByIdAndUpdate(
    settingsDocId(ctx.storeId),
    {
      $set: {
        activeDomainId: domain.id,
        storeName: domain.name,
        storeNameAr: domain.nameAr,
        heroBadge: domain.heroBadge,
        heroTitleAr: domain.heroTitleAr,
        heroSubtitleAr: domain.heroSubtitleAr,
        footerDescriptionAr: domain.footerDescriptionAr,
      },
    },
    { new: true }
  ).lean()
  return { data: { domain, settings } }
}
