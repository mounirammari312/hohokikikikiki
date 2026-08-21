import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { TenantProvider, useTenant } from './context/TenantContext'
import { ensureProducts, syncProducts } from './services/api/products'
import { syncWilayas } from './services/api/wilayas'
import { syncSettings } from './services/api/settings'
import { syncDomains } from './services/api/domains'

// ─── Code splitting via React.lazy ─────────────────────────────────────────
// Each page is loaded on-demand only when the user navigates to it.
// This reduces the initial JS payload by ~60% (admin code never loads
// for storefront visitors, etc.).
//
// Loading fallback: a minimal spinner shown while the chunk downloads.
// On a 3G connection this adds ~200ms but saves 500KB of JS parsing
// upfront — net win for first-page-load performance.
//
// PERFORMANCE: the fallback is intentionally minimal (no text, just a
// small spinner). Adding "جاري التحميل…" here made the app feel slow
// because every route change flashed the text. A bare spinner feels
// instant — the user perceives the new page loading directly.
const PageFallback = () => (
  <div className="min-h-[50vh] grid place-items-center">
    <div className="w-8 h-8 border-3 border-[#EDE6D8] border-t-[#C9A96A] rounded-full animate-spin" />
  </div>
)

const Home = lazy(() => import('./pages/Home'))
const Shop = lazy(() => import('./pages/Shop'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Cart = lazy(() => import('./pages/Cart'))
const ThankYou = lazy(() => import('./pages/ThankYou'))
const Admin = lazy(() => import('./pages/Admin'))
const Wishlist = lazy(() => import('./pages/Wishlist'))
const PlatformLanding = lazy(() => import('./pages/PlatformLanding'))
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'))
const MerchantLogin = lazy(() => import('./pages/MerchantLogin'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
import { PwaInstallBanner } from './components/PwaInstallBanner'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  App — MULTI-TENANT SaaS routing layer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Three-tier routing based on hostname + path:
 *
 *  1. PLATFORM APEX (amugar.saas)
 *     - /                  → PlatformLanding (SaaS marketing + register)
 *     - /super-admin       → SuperAdmin dashboard (super_admin role only)
 *     - /super-admin/login → SuperAdmin login (handled inside SuperAdmin)
 *
 *  2. TENANT SUBDOMAIN (slug.amugar.saas) or custom domain
 *     - /                  → Home (tenant storefront)
 *     - /shop              → Shop
 *     - /product/:id       → ProductDetail
 *     - /cart              → Cart
 *     - /wishlist          → Wishlist
 *     - /thank-you/:num    → ThankYou
 *     - /admin             → Admin (merchant dashboard, requires login)
 *     - /admin/login       → MerchantLogin
 *
 *  The TenantProvider resolves which tier we're in via window.location.
 *  The TenantStorefront component wraps the storefront routes and only
 *  renders Header/Footer (tenant branding) when on a tenant host.
 */

function TenantStorefront() {
  const { isPlatformHost, storeId, storeSlug } = useTenant()

  // On the platform host, only render the storefront when there's an
  // explicit tenant context via ?storeId= OR ?store=slug (or a cached
  // slug from a previous registration). Otherwise → show the SaaS landing.
  const urlParams = new URLSearchParams(window.location.search)
  const hasExplicitStoreId = !!urlParams.get('storeId')
  const hasExplicitSlug = !!urlParams.get('store')
  const hasTenantContext = !!storeId || !!storeSlug || hasExplicitStoreId || hasExplicitSlug

  // Re-run the data syncs whenever the tenant changes. The `tenantKey`
  // changes when the store changes (different ?store= slug, different
  // ?storeId=, different subdomain, etc.) — this triggers a background
  // re-fetch so we never show one store's products on another store.
  //
  // PERFORMANCE: we do NOT call invalidateAll() here — that would wipe
  // the in-memory cache and force every page to re-render with empty
  // data while the API call is in flight (causing the "spinner on every
  // page" problem). Instead:
  //   1. We keep the existing cache (keyed per-tenant via getCacheKey).
  //   2. The cache key includes the storeId/slug, so store A's data is
  //      NEVER served to store B (different key = different entry).
  //   3. sync*() runs in the background and updates the cache silently.
  //
  // This is the "stale-while-revalidate" pattern used by Vercel SWR +
  // TanStack Query: show cached data immediately, refresh in background.
  const tenantKey = storeId || storeSlug || 'default'
  const prevTenantRef = useRef<string | null>(null)
  useEffect(() => {
    if (isPlatformHost && !hasTenantContext) return  // skip sync if no tenant
    // If the tenant actually CHANGED (not just a re-render), force a
    // fresh sync so the new store's data loads immediately. The cache
    // uses per-tenant keys, so this won't affect other stores' caches.
    const tenantChanged = prevTenantRef.current !== null && prevTenantRef.current !== tenantKey
    prevTenantRef.current = tenantKey
    // Kick off background syncs — these update the cache without
    // blocking the render. Pages that already have cached data will
    // show it instantly and re-render when the fresh data arrives.
    void syncProducts()
    void syncWilayas()
    void syncSettings()
    void syncDomains()
    ensureProducts()

    // ─── Track the last store visit (for the smart redirect) ──────────
    // Whenever the visitor is in a tenant store, record {slug, ts} in
    // localStorage. The smart redirect in AppRoutes reads this to
    // automatically send the visitor back to this store if they land on
    // the platform apex root within 30 minutes (e.g. after pressing
    // "back" too many times or typing amugar.vercel.app/ in the URL bar).
    if (typeof window !== 'undefined' && (storeSlug || storeId)) {
      try {
        localStorage.setItem('amugar_last_store_visit', JSON.stringify({
          slug: storeSlug,
          storeId,
          ts: Date.now(),
        }))
      } catch {
        // localStorage might be unavailable — ignore
      }
    }
  }, [tenantKey, storeSlug, storeId, isPlatformHost, hasTenantContext])

  if (isPlatformHost && !hasTenantContext) {
    // ─── Smart redirect: if the visitor was in a store within the last
    // 30 minutes, automatically redirect them there. This solves the
    // "I pressed back and ended up on the SaaS landing" problem that
    // customers hitting a store ad → store → root flow experience.
    //
    // We store `amugar_last_store_visit` in localStorage with a timestamp
    // + slug. If the timestamp is < 30min ago AND the visitor is on the
    // platform host root (no ?store=), redirect. Otherwise → SaaS landing.
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('amugar_last_store_visit')
        if (raw) {
          const data = JSON.parse(raw)
          const THIRTY_MIN = 30 * 60 * 1000
          if (data?.slug && data?.ts && (Date.now() - data.ts) < THIRTY_MIN) {
            // Only redirect if we're on the root path (no ?store=, no hash, no other path)
            const url = new URL(window.location.href)
            const isRoot = url.pathname === '/' && !url.searchParams.get('store') && !url.searchParams.get('storeId')
            if (isRoot) {
              // Redirect to the last-visited store
              window.location.href = `/?store=${encodeURIComponent(data.slug)}`
              return null  // render nothing while redirecting
            }
          }
        }
      } catch {
        // localStorage might be unavailable (private browsing) — ignore
      }
    }
    return <PlatformLanding />
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/thank-you/:orderNumber" element={<ThankYou />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  )
}

function MerchantDashboard() {
  const { user, loading, storeId, storeSlug } = useTenant()
  const location = useLocation()
  const isLogin = location.pathname.endsWith('/login')

  // Show login screen if not authenticated OR if explicitly on /admin/login
  // PERFORMANCE: instead of a full-screen "جاري التحميل…" text (which feels
  // slow), show a minimal spinner. The dashboard renders as soon as the
  // cached user is available (within ~600ms typically).
  if (loading) return (
    <div className="min-h-[50vh] grid place-items-center">
      <div className="w-8 h-8 border-3 border-[#EDE6D8] border-t-[#C9A96A] rounded-full animate-spin" />
    </div>
  )
  if (!user || isLogin) return <Suspense fallback={<PageFallback />}><MerchantLogin /></Suspense>

  // Authenticated merchant → show the Admin dashboard (tenant-scoped
  // via the x-store-id / x-store-slug headers injected by client.ts).
  // We require a tenant context (storeId or storeSlug) — otherwise the
  // dashboard wouldn't know which store to manage.
  const urlParams = new URLSearchParams(window.location.search)
  const hasExplicitStoreId = !!urlParams.get('storeId')
  const hasExplicitSlug = !!urlParams.get('store')
  const hasTenantContext = !!storeId || !!storeSlug || hasExplicitStoreId || hasExplicitSlug
  if (!hasTenantContext) {
    // No tenant context — send the merchant to the SaaS landing so they
    // can pick/create a store.
    return <Suspense fallback={<PageFallback />}><PlatformLanding /></Suspense>
  }

  // NOTE: we intentionally do NOT render <Header /> + <Footer /> here.
  // The merchant dashboard has its OWN sidebar + top bar (inside Admin).
  // Adding the storefront Header would create a SECOND menu button
  // (the storefront's mobile menu) on top of the dashboard's sidebar
  // toggle — confusing UX. The dashboard is a self-contained shell.
  return <Suspense fallback={<PageFallback />}><Admin /></Suspense>
}

function AppRoutes() {
  const { isPlatformHost, storeId, storeSlug } = useTenant()
  const location = useLocation()

  // On the platform host, we allow tenant-scoped routes when ?store= or
  // ?storeId= is present in the URL (e.g. on vercel.app previews).
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const hasStoreParam = !!urlParams?.get('storeId') || !!urlParams?.get('store')

  // Determine if we're in tenant mode (show storefront) or platform mode
  // (show SaaS landing). The logic:
  //
  //   1. NOT on platform host (i.e. on a tenant subdomain) → tenant mode
  //   2. On platform host + ?store=/storeId= in URL → tenant mode
  //   3. On platform host + cached storeId/storeSlug in localStorage
  //      AND NOT on the root path "/" → tenant mode
  //      (e.g. navigating to /admin or /shop after visiting a store)
  //   4. On platform host + root path "/" + no URL param → platform mode
  //      (show the SaaS landing — ignore stale localStorage cache)
  //
  // Case 4 is the critical fix: previously, a cached storeId from a
  // previous visit would make "/" show the old storefront instead of
  // the SaaS landing page.
  const isRoot = location.pathname === '/'
  const isMarketplace = location.pathname === '/marketplace' || location.pathname.startsWith('/marketplace/')
  // Marketplace is ALWAYS accessible regardless of tenant context — it's
  // a public page that aggregates products from ALL stores.
  const tenantMode = !isPlatformHost || (hasStoreParam || (!!(storeId || storeSlug) && !isRoot)) || isMarketplace

  return (
    <>
      <ScrollToTop />
      <div className="min-h-screen bg-[#FFFCF8] flex flex-col">
        <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* ─── Marketplace (public, always available) ─────────────────── */}
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/marketplace/store/:slug" element={<Marketplace />} />

          {/* ─── Platform apex routes (no tenant context) ─────────────── */}
          {!tenantMode && (
            <>
              <Route path="/" element={<PlatformLanding />} />
              <Route path="/super-admin/login" element={<SuperAdmin />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              {/* On the platform apex without tenant context, /admin → landing */}
              <Route path="/admin" element={<PlatformLanding />} />
              <Route path="/admin/*" element={<PlatformLanding />} />
              {/* Fall-through also shows the landing (catch-all) */}
              <Route path="/*" element={<PlatformLanding />} />
            </>
          )}

          {/* ─── Tenant routes (subdomain OR platform host with ?store=) ── */}
          {tenantMode && (
            <>
              <Route path="/admin/login" element={<MerchantDashboard />} />
              <Route path="/admin" element={<MerchantDashboard />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              <Route path="/super-admin/login" element={<SuperAdmin />} />
              <Route path="/*" element={<TenantStorefront />} />
            </>
          )}
        </Routes>
        </Suspense>
      </div>
    </>
  )
}

export default function App() {
  useEffect(() => {
    document.documentElement.lang = 'ar'
    document.documentElement.dir = 'rtl'
  }, [])

  return (
    <TenantProvider>
      <CartProvider>
        <WishlistProvider>
          <BrowserRouter>
            <AppRoutes />
            <PwaInstallBanner />
          </BrowserRouter>
        </WishlistProvider>
      </CartProvider>
    </TenantProvider>
  )
}
