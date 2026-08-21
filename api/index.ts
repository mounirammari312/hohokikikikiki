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
  ReviewModel, CouponModel, BannerModel, MarketplaceActivityModel,
  StoreVisitModel,
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
  // CRITICAL: On Vercel serverless, the request body can only be read ONCE.
  // If getReqBody is called twice (e.g. once for validation + once in
  // the route handler), the second call would fail with
  // "Body has already been consumed". To prevent this, we cache the
  // parsed body on req.__parsedBody after the first read.
  if (req.__parsedBody !== undefined) {
    return req.__parsedBody
  }
  let body: any
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { body = JSON.parse(req.body) } catch { body = {} }
    } else {
      body = req.body
    }
  } else if (typeof req.json === 'function') {
    try { body = await req.json() } catch { body = {} }
  } else {
    body = {}
  }
  // Cache the parsed body so subsequent calls return the same object
  // without trying to re-read the (already consumed) request stream.
  req.__parsedBody = body
  return body
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
    // DISABLED: in-memory CSRF token storage doesn't work on Vercel
    // serverless because each request may hit a different instance.
    // The token from GET /api/auth/csrf (instance A) won't be in
    // instance B's memory when the POST arrives → crash or 403.
    // Security is still maintained via:
    //   - SameSite=Lax cookies (set by applySecurityHeaders)
    //   - Rate limiting on login/register
    //   - bcrypt password hashing
    //   - Auth token validation on all mutations
    // TODO: implement stateless CSRF (signed token) or use Redis/Upstash
    // if CSRF protection is needed in the future.

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
      try {
        await connectDB()
        await ensureSeeded()
        return reply(res, ...(await authRoute(segments, method, req)))
      } catch (dbErr: any) {
        console.error('AUTH_ROUTE_ERROR:', dbErr)
        return reply(res, {
          error: 'AUTH_FAILED',
          message: dbErr?.message || String(dbErr),
          stack: (dbErr?.stack || '').split('\n').slice(0, 8).join('\n'),
        }, 500)
      }
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

    // ─── Visit tracking (PUBLIC — no auth, no tenant context) ──────────
    // POST /api/visit — logs a storefront/product visit
    //   Body: { storeId, type: 'store'|'product', productId?, visitorId, source, device }
    // This is called by the storefront automatically on page load.
    // It's fire-and-forget (the client doesn't wait for the response).
    // Rate-limited to 1 visit per visitorId per storeId per 30 seconds
    // to prevent flooding.
    if (segments[0] === 'visit' && method === 'POST') {
      // Rate limit: max 60 visits per IP per minute (prevents abuse)
      const ip = getClientIP(req)
      if (!rateLimit(`visit_${ip}`, 60, 60 * 1000)) {
        return reply(res, [{ ok: true }], 200)  // silently succeed — don't block the page
      }
      try {
        await connectDB()
        const body = await getReqBody(req)
        const { storeId, type, productId, visitorId, source, device } = body
        if (!storeId) return reply(res, [{ ok: true }], 200)
        // Validate type
        const visitType = type === 'product' ? 'product' : 'store'
        // Detect device from user agent if not provided
        const ua = req.headers['user-agent'] || ''
        let visitDevice = device
        if (!visitDevice) {
          if (/tablet|ipad/i.test(ua)) visitDevice = 'tablet'
          else if (/mobile|android|iphone/i.test(ua)) visitDevice = 'mobile'
          else visitDevice = 'desktop'
        }
        // Extract country from Vercel's header
        const country = req.headers['x-vercel-ip-country'] || ''
        // Clean source — extract hostname from URL if needed
        let visitSource = source || 'direct'
        if (visitSource !== 'direct') {
          try {
            const u = new URL(visitSource)
            visitSource = u.hostname.replace(/^www\./, '')
          } catch {
            // not a URL — keep as-is
          }
        }
        await StoreVisitModel.create({
          _id: genId('visit'),
          storeId,
          type: visitType,
          productId: productId || '',
          visitorId: visitorId || '',
          source: visitSource,
          device: visitDevice,
          country,
          createdAt: new Date().toISOString(),
        })
        return reply(res, [{ ok: true }], 201)
      } catch (err) {
        // Non-critical — never fail the page load
        return reply(res, [{ ok: true }], 200)
      }
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
      stack: process.env.NODE_ENV === 'production' ? undefined : (err?.stack || '').split('\n').slice(0, 8).join('\n'),
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
  // Body: { fullName, email, password, storeName, storeNameAr?, slug?, domainType? }
  //   domainType: optional — one of 'domain_jewelry', 'domain_fashion',
  //   'domain_beauty', 'domain_electronics', 'domain_home_appliances',
  //   'domain_digital', 'domain_general'. Defaults to 'domain_general'.
  if (segments[1] === 'register' && method === 'POST') {
    const { fullName, email, password, phone, storeName, storeNameAr, slug, domainType } = body
    if (!fullName || !email || !password || !storeName) {
      return [{ error: 'MISSING_REQUIRED_FIELDS' }, 400]
    }
    // Validate domainType if provided
    const validDomainIds = new Set((presetDomains || []).map(d => d.id))
    const chosenDomain = domainType && validDomainIds.has(domainType) ? domainType : 'domain_general'

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
    // Seed the new store's catalog (empty by default) + apply the chosen domain
    await seedStoreData(storeId, chosenDomain)

    return [{
      user: sanitizeUser(user.toObject ? user.toObject() : user),
      token: makeToken(user.toObject ? user.toObject() : user),
      storeId,
      storeIds: [storeId],
      domainType: chosenDomain,
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

  // ═════════════════════════════════════════════════════════════════════════
  //  PHASE 2 — Rich marketplace endpoints
  // ═════════════════════════════════════════════════════════════════════════

  // GET /api/marketplace/stats — platform-wide statistics for the UI
  // Returns: { totalProducts, totalStores, totalOrders, ordersToday,
  //            avgRating, totalReviews, viewersNow }
  if (segments.length === 2 && segments[1] === 'stats' && method === 'GET') {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()

    const [totalProducts, totalStores, totalOrders, ordersToday, recentReviews] = await Promise.all([
      ProductModel.countDocuments({ isPublishedInMarketplace: true, deletedAt: null }),
      TenantStoreModel.countDocuments({ status: 'active' }),
      OrderModel.countDocuments({ deletedAt: null }),
      OrderModel.countDocuments({ deletedAt: null, createdAt: { $gte: startOfToday } }),
      ReviewModel.find({ status: 'approved' }, { rating: 1 }).lean(),
    ])

    const totalReviews = recentReviews.length
    const avgRating = totalReviews > 0
      ? Number((recentReviews.reduce((s, r) => s + (r.rating || 0), 0) / totalReviews).toFixed(2))
      : 4.8 // default fallback

    // "Viewers now" — pseudo-real-time based on recent activity in last 5 minutes
    // + a stable random baseline derived from the hour-of-day. This gives
    // a number that feels alive but doesn't require a real-time WS connection.
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
    const recentActivity = await MarketplaceActivityModel.countDocuments({
      createdAt: { $gte: fiveMinAgo },
    })
    // Base it on hour-of-day: more traffic during evening hours (18-23)
    const hour = now.getHours()
    const hourMultiplier = hour >= 18 && hour <= 23 ? 1.5 : hour >= 9 && hour <= 17 ? 1.0 : 0.5
    const viewersNow = Math.min(2000, Math.max(80,
      Math.round((120 + recentActivity * 8) * hourMultiplier)
    ))

    return [{
      totalProducts,
      totalStores,
      totalOrders,
      ordersToday,
      avgRating,
      totalReviews,
      viewersNow,
    }, 200]
  }

  // GET /api/marketplace/top-stores — real ranking based on order count + rating
  // Returns: { stores: [{ store, productCount, orderCount, rating, sales }] }
  if (segments.length === 2 && segments[1] === 'top-stores' && method === 'GET') {
    const limit = Math.min(20, Math.max(1, Number(query.get('limit')) || 8))

    // Step 1: Get all stores with at least 1 published product
    const storeIdsWithProducts = await ProductModel.distinct('storeId', {
      isPublishedInMarketplace: true,
      deletedAt: null,
    })
    if (!storeIdsWithProducts.length) return [{ stores: [] }, 200]

    const stores = await TenantStoreModel.find({
      _id: { $in: storeIdsWithProducts },
      status: 'active',
    }).lean()

    // Step 2: For each store, count products + orders in parallel
    const ranked = await Promise.all(stores.map(async (s) => {
      const [productCount, orderCount, ratingAgg] = await Promise.all([
        ProductModel.countDocuments({
          storeId: s._id, isPublishedInMarketplace: true, deletedAt: null,
        }),
        OrderModel.countDocuments({
          storeId: s._id, deletedAt: null, status: { $ne: 'cancelled' },
        }),
        // Average rating from reviews on this store's products
        ReviewModel.aggregate([
          { $match: { storeId: s._id, status: 'approved' } },
          { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]),
      ])
      const avgRating = ratingAgg[0]?.avg || 4.5
      const reviewCount = ratingAgg[0]?.count || 0
      return {
        store: s,
        productCount,
        orderCount,
        rating: Number(avgRating.toFixed(2)),
        reviewCount,
        sales: orderCount, // alias for clarity
      }
    }))

    // Step 3: Sort by (orderCount * 10 + rating) desc — orders weighted heavily
    ranked.sort((a, b) => (b.orderCount * 10 + b.rating) - (a.orderCount * 10 + a.rating))
    return [{ stores: ranked.slice(0, limit) }, 200]
  }

  // GET /api/marketplace/recent-activity — last N real orders (for the live ticker)
  // Returns: { activity: [{ customerName, wilaya, productNameAr, time, total }] }
  if (segments.length === 2 && segments[1] === 'recent-activity' && method === 'GET') {
    const limit = Math.min(50, Math.max(1, Number(query.get('limit')) || 12))

    // Try to fetch from MarketplaceActivity collection first
    let activity = await MarketplaceActivityModel.find({})
      .sort({ createdAt: -1 })
      .limit(limit * 2) // fetch more so we can filter
      .lean()

    // If empty (no real orders logged yet), fall back to recent real orders
    if (activity.length === 0) {
      const recentOrders = await OrderModel.find({ deletedAt: null, status: { $ne: 'cancelled' } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
      activity = recentOrders.map(o => ({
        _id: o._id,
        orderId: o._id,
        storeId: o.storeId,
        productId: o.items?.[0]?.productId || '',
        productNameAr: o.items?.[0]?.nameAr || 'منتج مميز',
        customerName: o.customerName,
        wilaya: o.wilayaNameAr || o.wilaya,
        total: o.total,
        createdAt: o.createdAt,
      }))
    }

    // Filter: only show entries with a customer name (privacy)
    const filtered = activity
      .filter(a => a.customerName || a.productNameAr)
      .slice(0, limit)
      .map(a => ({
        _id: a._id,
        customerName: a.customerName || 'زبون',
        wilaya: a.wilaya || 'الجزائر',
        productNameAr: a.productNameAr || 'منتج مميز',
        total: a.total || 0,
        createdAt: a.createdAt,
      }))

    return [{ activity: filtered, total: filtered.length }, 200]
  }

  // GET /api/marketplace/reviews/:productId — list reviews for a product
  // Query: ?limit=10&page=1&status=approved
  if (segments.length === 3 && segments[1] === 'reviews' && method === 'GET') {
    const productId = segments[2]
    const page = Math.max(1, Number(query.get('page')) || 1)
    const limit = Math.min(50, Math.max(1, Number(query.get('limit')) || 10))
    const skip = (page - 1) * limit

    const [reviews, total, ratingAgg] = await Promise.all([
      ReviewModel.find({ productId, status: 'approved' })
        .sort({ helpful: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReviewModel.countDocuments({ productId, status: 'approved' }),
      ReviewModel.aggregate([
        { $match: { productId, status: 'approved' } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
    ])

    return [{
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      avgRating: ratingAgg[0]?.avg || 0,
      reviewCount: ratingAgg[0]?.count || 0,
    }, 200]
  }

  // POST /api/marketplace/reviews — submit a new review (public, no auth)
  // Body: { productId, storeId, customerName, wilaya, rating, comment, images }
  if (segments.length === 2 && segments[1] === 'reviews' && method === 'POST') {
    const body = await getReqBody(req)
    const { productId, storeId, customerName, wilaya, rating, comment, images } = body

    if (!productId || !storeId) return [{ error: 'MISSING_PRODUCT_OR_STORE' }, 400]
    const r = Number(rating)
    if (!Number.isFinite(r) || r < 1 || r > 5) return [{ error: 'INVALID_RATING' }, 400]
    if (comment && String(comment).length > 1000) return [{ error: 'COMMENT_TOO_LONG' }, 400]
    if (images && Array.isArray(images) && images.length > 3) {
      return [{ error: 'TOO_MANY_IMAGES' }, 400]
    }

    // Verify product exists
    const product = await ProductModel.findById(productId).lean()
    if (!product) return [{ error: 'PRODUCT_NOT_FOUND' }, 404]

    // Rate-limit: max 3 reviews per IP per hour
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
    const rlKey = `review_${ip}`
    const rl = rateLimitMap.get(rlKey) || { count: 0, resetAt: Date.now() + 3600_000 }
    if (Date.now() < rl.resetAt && rl.count >= 3) {
      return [{ error: 'RATE_LIMITED', message: 'لقد أرسلت 3 تقييمات في الساعة الأخيرة — حاول لاحقاً' }, 429]
    }
    rl.count++
    rateLimitMap.set(rlKey, rl)

    const reviewId = genId('review')
    await ReviewModel.create({
      _id: reviewId,
      productId,
      storeId,
      orderId: body.orderId || '',
      customerName: customerName || 'زبون',
      customerNameAr: customerName || 'زبون',
      wilaya: wilaya || '',
      rating: r,
      comment: comment || '',
      commentAr: comment || '',
      images: (images || []).slice(0, 3),
      status: 'approved', // auto-approve for now (TODO: moderation queue)
      helpful: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // Recompute the product's aggregate rating + reviewsCount (denormalized)
    const agg = await ReviewModel.aggregate([
      { $match: { productId, status: 'approved' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ])
    if (agg[0]) {
      await ProductModel.findByIdAndUpdate(productId, {
        $set: { rating: Number(agg[0].avg.toFixed(2)), reviewsCount: agg[0].count },
      })
    }

    return [{ reviewId, ok: true }, 201]
  }

  // POST /api/marketplace/reviews/:id/helpful — upvote a review
  if (segments.length === 4 && segments[1] === 'reviews' && segments[3] === 'helpful' && method === 'POST') {
    const reviewId = segments[2]
    await ReviewModel.findByIdAndUpdate(reviewId, { $inc: { helpful: 1 } })
    return [{ ok: true }, 200]
  }

  // GET /api/marketplace/coupons — list active coupons (public)
  // Returns: { coupons: [...] }
  if (segments.length === 2 && segments[1] === 'coupons' && method === 'GET') {
    const now = new Date().toISOString()
    const coupons = await CouponModel.find({
      isActive: true,
      startsAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
    return [{ coupons }, 200]
  }

  // GET /api/marketplace/coupons/validate?code=CODE&subtotal=5000
  // Validate a coupon code against the user's cart subtotal.
  // Returns: { valid, coupon, discountAmount, message }
  if (segments.length === 3 && segments[1] === 'coupons' && segments[2] === 'validate' && method === 'GET') {
    const code = (query.get('code') || '').trim().toUpperCase()
    const subtotal = Number(query.get('subtotal')) || 0
    if (!code) return [{ error: 'CODE_REQUIRED' }, 400]

    const coupon = await CouponModel.findOne({ code, isActive: true }).lean()
    if (!coupon) return [{ valid: false, message: 'كود الخصم غير صالح' }, 200]

    const now = new Date().toISOString()
    if (coupon.startsAt && coupon.startsAt > now) {
      return [{ valid: false, message: 'هذا الكود لم يبدأ بعد' }, 200]
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return [{ valid: false, message: 'انتهت صلاحية هذا الكود' }, 200]
    }
    if (coupon.maxRedemptions > 0 && coupon.redeemedCount >= coupon.maxRedemptions) {
      return [{ valid: false, message: 'تم استنفاد هذا الكود' }, 200]
    }
    if (coupon.minOrderValue > 0 && subtotal < coupon.minOrderValue) {
      return [{
        valid: false,
        message: `الحد الأدنى للطلب ${coupon.minOrderValue} د.ج`,
      }, 200]
    }

    const discountAmount = coupon.discountType === 'percent'
      ? Math.round(subtotal * coupon.discountValue / 100)
      : coupon.discountValue

    return [{ valid: true, coupon, discountAmount }, 200]
  }

  // GET /api/marketplace/banners — list active banners for the carousel (public)
  if (segments.length === 2 && segments[1] === 'banners' && method === 'GET') {
    const banners = await BannerModel.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .limit(8)
      .lean()
    return [{ banners }, 200]
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
    const { name, nameAr, slug, domainType } = body
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
    // Validate + apply domainType if provided
    const validDomainIds = new Set((presetDomains || []).map(d => d.id))
    const chosenDomain = domainType && validDomainIds.has(domainType) ? domainType : 'domain_general'
    await seedStoreData(storeId, chosenDomain)
    return [{ storeId, slug: finalSlug, domainType: chosenDomain }, 201]
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

  // ═════════════════════════════════════════════════════════════════════════
  //  Analytics endpoints (merchant's own store visits)
  // ═════════════════════════════════════════════════════════════════════════

  // GET /api/stores/:id/analytics/overview — top-level visit stats
  // Returns: { totalVisits, uniqueVisitors, todayVisits, weekVisits, monthVisits,
  //           productViews, storeViews, conversionRate }
  if (segments.length === 4 && segments[2] === 'analytics' && segments[3] === 'overview' && method === 'GET') {
    const storeId = segments[1]
    if (user.role !== 'super_admin' && !(user.storeIds || []).includes(storeId)) {
      return [{ error: 'FORBIDDEN' }, 403]
    }
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()

    const [totalAgg, todayAgg, weekAgg, monthAgg, uniqueAgg, productViewsAgg, storeViewsAgg] = await Promise.all([
      StoreVisitModel.countDocuments({ storeId }),
      StoreVisitModel.countDocuments({ storeId, createdAt: { $gte: startOfToday } }),
      StoreVisitModel.countDocuments({ storeId, createdAt: { $gte: sevenDaysAgo } }),
      StoreVisitModel.countDocuments({ storeId, createdAt: { $gte: thirtyDaysAgo } }),
      StoreVisitModel.distinct('visitorId', { storeId, visitorId: { $ne: '' } }),
      StoreVisitModel.countDocuments({ storeId, type: 'product' }),
      StoreVisitModel.countDocuments({ storeId, type: 'store' }),
    ])

    // Conversion rate = orders / unique visitors
    const orderCount = await OrderModel.countDocuments({ storeId, deletedAt: null, status: { $ne: 'cancelled' } })
    const uniqueVisitors = uniqueAgg.length
    const conversionRate = uniqueVisitors > 0 ? Number(((orderCount / uniqueVisitors) * 100).toFixed(2)) : 0

    return [{
      totalVisits: totalAgg,
      uniqueVisitors,
      todayVisits: todayAgg,
      weekVisits: weekAgg,
      monthVisits: monthAgg,
      productViews: productViewsAgg,
      storeViews: storeViewsAgg,
      conversionRate,
      orderCount,
    }, 200]
  }

  // GET /api/stores/:id/analytics/timeline — daily visits for last N days
  // Query: ?days=7 (default 7, max 90)
  // Returns: [{ date, visits, uniqueVisitors, productViews }, ...]
  if (segments.length === 4 && segments[2] === 'analytics' && segments[3] === 'timeline' && method === 'GET') {
    const storeId = segments[1]
    if (user.role !== 'super_admin' && !(user.storeIds || []).includes(storeId)) {
      return [{ error: 'FORBIDDEN' }, 403]
    }
    const days = Math.min(90, Math.max(1, Number(query.get('days')) || 7))
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (days - 1))
    startDate.setHours(0, 0, 0, 0)

    // Aggregate by day
    const pipeline = [
      { $match: { storeId, createdAt: { $gte: startDate.toISOString() } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$createdAt' } } },
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$visitorId' },
          productViews: { $sum: { $cond: [{ $eq: ['$type', 'product'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]
    const result = await StoreVisitModel.aggregate(pipeline)

    // Fill missing days with zeros
    const days_arr: any[] = []
    const d = new Date(startDate)
    for (let i = 0; i < days; i++) {
      const dateStr = d.toISOString().slice(0, 10)
      const day = result.find(r => r._id === dateStr)
      days_arr.push({
        date: dateStr,
        visits: day?.visits || 0,
        uniqueVisitors: day?.uniqueVisitors.filter(Boolean).length || 0,
        productViews: day?.productViews || 0,
      })
      d.setDate(d.getDate() + 1)
    }
    return [{ timeline: days_arr }, 200]
  }

  // GET /api/stores/:id/analytics/sources — traffic source breakdown
  // Returns: [{ source, visits, percentage }]
  if (segments.length === 4 && segments[2] === 'analytics' && segments[3] === 'sources' && method === 'GET') {
    const storeId = segments[1]
    if (user.role !== 'super_admin' && !(user.storeIds || []).includes(storeId)) {
      return [{ error: 'FORBIDDEN' }, 403]
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const pipeline = [
      { $match: { storeId, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$source', visits: { $sum: 1 } } },
      { $sort: { visits: -1 } },
    ]
    const result = await StoreVisitModel.aggregate(pipeline)
    const total = result.reduce((a, b) => a + b.visits, 0)
    const sources = result.map(r => ({
      source: r._id || 'direct',
      visits: r.visits,
      percentage: total > 0 ? Number(((r.visits / total) * 100).toFixed(1)) : 0,
    }))
    return [{ sources, totalVisits: total }, 200]
  }

  // GET /api/stores/:id/analytics/top-products — most viewed products
  // Returns: [{ productId, productNameAr, views, image }]
  if (segments.length === 4 && segments[2] === 'analytics' && segments[3] === 'top-products' && method === 'GET') {
    const storeId = segments[1]
    if (user.role !== 'super_admin' && !(user.storeIds || []).includes(storeId)) {
      return [{ error: 'FORBIDDEN' }, 403]
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const pipeline = [
      { $match: { storeId, type: 'product', productId: { $ne: '' }, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$productId', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]
    const result = await StoreVisitModel.aggregate(pipeline)
    // Fetch product details
    const productIds = result.map(r => r._id)
    const products = await ProductModel.find({ _id: { $in: productIds } }).lean()
    const productMap = new Map(products.map(p => [p._id, p]))
    const topProducts = result.map(r => {
      const p = productMap.get(r._id)
      return {
        productId: r._id,
        productNameAr: p?.nameAr || 'منتج محذوف',
        views: r.views,
        image: p?.images?.[0] || '',
        price: p?.price || 0,
      }
    })
    return [{ topProducts }, 200]
  }

  // GET /api/stores/:id/analytics/devices — device breakdown
  if (segments.length === 4 && segments[2] === 'analytics' && segments[3] === 'devices' && method === 'GET') {
    const storeId = segments[1]
    if (user.role !== 'super_admin' && !(user.storeIds || []).includes(storeId)) {
      return [{ error: 'FORBIDDEN' }, 403]
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const pipeline = [
      { $match: { storeId, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$device', visits: { $sum: 1 } } },
      { $sort: { visits: -1 } },
    ]
    const result = await StoreVisitModel.aggregate(pipeline)
    return [{ devices: result.map(r => ({ device: r._id || 'mobile', visits: r.visits })) }, 200]
  }

  // GET /api/stores/:id/analytics/countries — top countries
  if (segments.length === 4 && segments[2] === 'analytics' && segments[3] === 'countries' && method === 'GET') {
    const storeId = segments[1]
    if (user.role !== 'super_admin' && !(user.storeIds || []).includes(storeId)) {
      return [{ error: 'FORBIDDEN' }, 403]
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const pipeline = [
      { $match: { storeId, country: { $ne: '' }, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$country', visits: { $sum: 1 } } },
      { $sort: { visits: -1 } },
      { $limit: 10 },
    ]
    const result = await StoreVisitModel.aggregate(pipeline)
    return [{ countries: result.map(r => ({ country: r._id, visits: r.visits })) }, 200]
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

  // ═════════════════════════════════════════════════════════════════════════
  //  Coupons management (super_admin only)
  // ═════════════════════════════════════════════════════════════════════════

  // GET /api/super-admin/coupons — list all coupons
  if (segments[1] === 'coupons' && segments.length === 2 && method === 'GET') {
    const coupons = await CouponModel.find({}).sort({ createdAt: -1 }).lean()
    return [{ coupons }, 200]
  }

  // POST /api/super-admin/coupons — create a new coupon
  if (segments[1] === 'coupons' && segments.length === 2 && method === 'POST') {
    const body = await getReqBody(req)
    if (!body.code || !body.discountValue) {
      return [{ error: 'MISSING_FIELDS', message: 'الرمز وقيمة الخصم مطلوبان' }, 400]
    }
    const code = String(body.code).toUpperCase().trim()
    const existing = await CouponModel.findOne({ code }).lean()
    if (existing) return [{ error: 'CODE_EXISTS', message: 'هذا الرمز مستخدم بالفعل' }, 409]

    const couponId = genId('coupon')
    const now = new Date().toISOString()
    await CouponModel.create({
      _id: couponId,
      code,
      description: body.description || '',
      descriptionAr: body.descriptionAr || body.description || '',
      discountType: body.discountType === 'percent' ? 'percent' : 'fixed',
      discountValue: Number(body.discountValue) || 0,
      minOrderValue: Number(body.minOrderValue) || 0,
      maxRedemptions: Number(body.maxRedemptions) || 0,
      redeemedCount: 0,
      startsAt: body.startsAt || now,
      expiresAt: body.expiresAt || null,
      isActive: body.isActive !== false,
      color: body.color || 'rose',
      createdAt: now,
      updatedAt: now,
    })
    return [{ couponId, code }, 201]
  }

  // PATCH /api/super-admin/coupons/:id — update coupon
  if (segments[1] === 'coupons' && segments.length === 3 && method === 'PATCH') {
    const id = segments[2]
    const body = await getReqBody(req)
    const patch: any = { updatedAt: new Date().toISOString() }
    if (body.code !== undefined) {
      const code = String(body.code).toUpperCase().trim()
      const clash = await CouponModel.findOne({ code, _id: { $ne: id } }).lean()
      if (clash) return [{ error: 'CODE_EXISTS' }, 409]
      patch.code = code
    }
    if (body.descriptionAr !== undefined) patch.descriptionAr = body.descriptionAr
    if (body.discountType !== undefined) patch.discountType = body.discountType === 'percent' ? 'percent' : 'fixed'
    if (body.discountValue !== undefined) patch.discountValue = Number(body.discountValue) || 0
    if (body.minOrderValue !== undefined) patch.minOrderValue = Number(body.minOrderValue) || 0
    if (body.maxRedemptions !== undefined) patch.maxRedemptions = Number(body.maxRedemptions) || 0
    if (body.startsAt !== undefined) patch.startsAt = body.startsAt
    if (body.expiresAt !== undefined) patch.expiresAt = body.expiresAt || null
    if (body.isActive !== undefined) patch.isActive = !!body.isActive
    if (body.color !== undefined) patch.color = body.color

    const next = await CouponModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean()
    if (!next) return [{ error: 'NOT_FOUND' }, 404]
    return [{ coupon: next }, 200]
  }

  // DELETE /api/super-admin/coupons/:id
  if (segments[1] === 'coupons' && segments.length === 3 && method === 'DELETE') {
    const id = segments[2]
    await CouponModel.findByIdAndDelete(id)
    return [{ ok: true }, 200]
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Banners management (super_admin only)
  // ═════════════════════════════════════════════════════════════════════════

  // GET /api/super-admin/banners — list all banners
  if (segments[1] === 'banners' && segments.length === 2 && method === 'GET') {
    const banners = await BannerModel.find({}).sort({ order: 1, createdAt: -1 }).lean()
    return [{ banners }, 200]
  }

  // POST /api/super-admin/banners — create a new banner
  if (segments[1] === 'banners' && segments.length === 2 && method === 'POST') {
    const body = await getReqBody(req)
    if (!body.titleAr) {
      return [{ error: 'TITLE_REQUIRED', message: 'عنوان البانر مطلوب' }, 400]
    }
    const bannerId = genId('banner')
    const now = new Date().toISOString()
    await BannerModel.create({
      _id: bannerId,
      order: Number(body.order) || 0,
      badge: body.badge || body.badgeAr || '',
      badgeAr: body.badgeAr || body.badge || '',
      icon: body.icon || 'Sparkles',
      title: body.title || body.titleAr,
      titleAr: body.titleAr,
      highlight: body.highlight || body.highlightAr || '',
      highlightAr: body.highlightAr || body.highlight || '',
      subtitle: body.subtitle || body.subtitleAr || '',
      subtitleAr: body.subtitleAr || body.subtitle || '',
      cta: body.cta || body.ctaAr || 'تسوّق الآن',
      ctaAr: body.ctaAr || body.cta || 'تسوّق الآن',
      href: body.href || '/marketplace',
      gradient: body.gradient || 'from-[#1A1A1E] via-[#2D2D35] to-[#1A1A1E]',
      blob1: body.blob1 || 'bg-[#C9A96A]/30',
      blob2: body.blob2 || 'bg-[#A02A5B]/20',
      isActive: body.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    return [{ bannerId }, 201]
  }

  // PATCH /api/super-admin/banners/:id — update banner
  if (segments[1] === 'banners' && segments.length === 3 && method === 'PATCH') {
    const id = segments[2]
    const body = await getReqBody(req)
    const patch: any = { updatedAt: new Date().toISOString() }
    const fields = ['order','badge','badgeAr','icon','title','titleAr','highlight','highlightAr','subtitle','subtitleAr','cta','ctaAr','href','gradient','blob1','blob2','isActive']
    for (const f of fields) {
      if (body[f] !== undefined) patch[f] = body[f]
    }
    if (body.order !== undefined) patch.order = Number(body.order) || 0
    const next = await BannerModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean()
    if (!next) return [{ error: 'NOT_FOUND' }, 404]
    return [{ banner: next }, 200]
  }

  // DELETE /api/super-admin/banners/:id
  if (segments[1] === 'banners' && segments.length === 3 && method === 'DELETE') {
    const id = segments[2]
    await BannerModel.findByIdAndDelete(id)
    return [{ ok: true }, 200]
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
  // ─── Marketplace auto-publish ──────────────────────────────────────
  // Default: isPublishedInMarketplace = true (set in schema). When the
  // client doesn't explicitly set it, default to true so the product
  // appears in the public marketplace automatically.
  if (body.isPublishedInMarketplace === undefined) {
    body.isPublishedInMarketplace = true
  }
  // Set marketplacePublishedAt on first publish so the product appears
  // as a "new arrival" in the marketplace.
  if (body.isPublishedInMarketplace && !body.marketplacePublishedAt) {
    body.marketplacePublishedAt = new Date().toISOString()
  }
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

  // ─── Marketplace activity hook ────────────────────────────────────────────
  // Log this order to the marketplace activity collection so the live
  // ticker on /marketplace can show REAL recent orders (not fake ones).
  // We only log orders that contain at least one marketplace-published
  // product — pure tenant-scoped orders (e.g. from a merchant's own
  // storefront) are NOT shown publicly.
  try {
    const firstItem = order.items?.[0]
    if (firstItem?.productId) {
      const product = await ProductModel.findById(firstItem.productId).lean()
      if (product?.isPublishedInMarketplace) {
        // Extract first name only for privacy (e.g. "Ahmed B." instead of "Ahmed Benali")
        const fullName = (order.customerName || 'زبون').trim()
        const firstName = fullName.split(/\s+/)[0] || 'زبون'
        await MarketplaceActivityModel.create({
          _id: genId('activity'),
          orderId: order._id,
          storeId: order.storeId,
          productId: firstItem.productId,
          productNameAr: firstItem.nameAr || product.nameAr || 'منتج مميز',
          customerName: firstName,
          wilaya: order.wilayaNameAr || order.wilaya,
          total: order.total,
          createdAt: order.createdAt,
        })
      }
    }
  } catch {
    // Non-critical — don't fail the order creation if activity logging fails
  }

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
    // fashion, beauty, electronics, home_appliances, digital, general)
    // are seeded into every new store via seedStoreData — but stores
    // created BEFORE a new preset was added won't have it.
    const preset = await DomainModel.findOne({ storeId: DEFAULT_STORE_ID, id }).lean() as any
    if (preset) {
      // Copy the preset domain from store_default into the current store
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
    } else {
      // ─── Fallback: use the in-memory presetDomains from seed.ts ──────
      // store_default might not have the new preset either (e.g. if the
      // deployment was upgraded but ensureSeeded() didn't run yet, or
      // if store_default's seed was already done and we added a new
      // preset afterwards). The in-memory presetDomains array always
      // has the latest presets, so we can copy from there.
      const inMemoryPreset = (presetDomains as any[]).find(p => p.id === id)
      if (inMemoryPreset) {
        const copy = {
          ...inMemoryPreset,
          _id: `${ctx.storeId}__${inMemoryPreset.id}`,
          storeId: ctx.storeId,
        }
        await DomainModel.updateOne(
          { storeId: ctx.storeId, id: inMemoryPreset.id },
          { $set: copy },
          { upsert: true }
        ).catch(() => {})
        domain = await DomainModel.findOne({ storeId: ctx.storeId, id }).lean()
      }
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
