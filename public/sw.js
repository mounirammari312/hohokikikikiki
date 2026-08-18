// LUMIÈRE SaaS Service Worker
// ─────────────────────────────────────────────────────────────────────────
// Caching strategy:
//   - App shell (HTML, CSS, JS bundles) → StaleWhileRevalidate (instant from cache,
//     fetches update in background)
//   - API GET requests (products, settings, etc.) → NetworkFirst with cache fallback
//     (always tries network first, falls back to cache when offline)
//   - Images → CacheFirst with expiration (saves bandwidth, instant repeat loads)
//   - POST/PUT/DELETE → Always network (no caching of mutations)
//
// This makes the storefront:
//   1. Open instantly on repeat visits (even on slow 3G)
//   2. Work partially offline (browse cached products, view cart)
//   3. Installable as a PWA on mobile home screen

const CACHE_VERSION = 'lumiere-v1'
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`
const API_CACHE = `${CACHE_VERSION}-api`
const IMAGE_CACHE = `${CACHE_VERSION}-images`

const APP_SHELL_PATTERNS = [
  /\/assets\/.*\.(?:js|css|woff2?)$/,
  /\/favicon\.svg$/,
  /\/manifest\.json$/,
  /\/index\.html$/,
]

const API_PATTERNS = [
  /\/api\/products/,
  /\/api\/settings/,
  /\/api\/wilayas/,
  /\/api\/domains/,
]

const IMAGE_PATTERNS = [
  /\.(?:png|jpe?g|gif|webp|avif|svg)$/i,
  /images\.unsplash\.com/,
]

// ─── Install: pre-cache the app shell ────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.add('/'))
  )
  self.skipWaiting()  // Activate immediately on next navigation
})

// ─── Activate: clear old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()  // Take control of all open tabs
})

// ─── Fetch: route to the right caching strategy ──────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Skip non-GET requests (mutations go straight to network)
  if (req.method !== 'GET') return

  // Skip cross-origin requests we don't control (e.g. analytics, fonts)
  // EXCEPT images — we cache those too.
  const isSameOrigin = url.origin === self.location.origin
  const isImage = IMAGE_PATTERNS.some((p) => p.test(req.url))
  if (!isSameOrigin && !isImage) return

  // ─── Strategy 1: App shell → StaleWhileRevalidate ──────────────────────
  if (APP_SHELL_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      caches.open(APP_SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(req)
        const fetchPromise = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone())
          return res
        }).catch(() => cached)
        return cached || fetchPromise
      })
    )
    return
  }

  // ─── Strategy 2: API GET → NetworkFirst with cache fallback ───────────
  if (API_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const networkRes = await fetch(req)
          if (networkRes.ok) cache.put(req, networkRes.clone())
          return networkRes
        } catch (err) {
          // Offline — return cached response if available
          const cached = await cache.match(req)
          if (cached) return cached
          throw err
        }
      })
    )
    return
  }

  // ─── Strategy 3: Images → CacheFirst with expiration (7 days) ──────────
  if (isImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(req)
        if (cached) {
          // Check age — refresh if > 7 days old
          const cachedTime = cached.headers.get('sw-fetched-at')
          if (cachedTime && Date.now() - Number(cachedTime) < 7 * 24 * 60 * 60 * 1000) {
            return cached
          }
        }
        try {
          const networkRes = await fetch(req)
          if (networkRes.ok) {
            // Add custom header so we can track age
            const cloned = networkRes.clone()
            const body = await cloned.blob()
            const headers = new Headers(cloned.headers)
            headers.set('sw-fetched-at', String(Date.now()))
            const newRes = new Response(body, { status: cloned.status, headers })
            cache.put(req, newRes)
          }
          return networkRes
        } catch (err) {
          if (cached) return cached
          throw err
        }
      })
    )
    return
  }

  // ─── Strategy 4: HTML navigations → NetworkFirst (always fresh) ───────
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/').then((r) => r || caches.match('/index.html')))
    )
  }
})

// ─── Message handler: allow pages to trigger cache cleanup ───────────────
self.addEventListener('message', (event) => {
  if (event.data === 'lumiere:clear-cache') {
    Promise.all([
      caches.delete(APP_SHELL_CACHE),
      caches.delete(API_CACHE),
      caches.delete(IMAGE_CACHE),
    ]).then(() => {
      event.source?.postMessage({ type: 'lumiere:cache-cleared' })
    })
  }
})
