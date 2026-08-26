
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import { WhatsAppButton } from './components/WhatsAppButton'
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { TenantProvider, useTenant } from './context/TenantContext'
import { ensureProducts, syncProducts } from './services/api/products'
import { syncWilayas } from './services/api/wilayas'
import { syncSettings } from './services/api/settings'
import { syncDomains } from './services/api/domains'
import { invalidateAll } from './services/api/client'

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
  <div className="min-h-[40vh] grid place-items-center">
    <div className="w-7 h-7 border-2 border-[#EDE6D8] border-t-[#C9A96A] rounded-full animate-spin" />
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




  function TenantStorefront() {
  const { isPlatformHost, storeId, storeSlug } = useTenant()

  const urlParams = new URLSearchParams(window.location.search)
  const hasExplicitStoreId = !!urlParams.get('storeId')
  const hasExplicitSlug = !!urlParams.get('store')
  const hasTenantContext = !!storeId || !!storeSlug || hasExplicitStoreId || hasExplicitSlug

  const tenantKey = storeId || storeSlug || 'default'
  const prevTenantRef = useRef<string | null>(null)

  useEffect(() => {
    if (isPlatformHost && !hasTenantContext) return

    const tenantChanged = prevTenantRef.current !== null && prevTenantRef.current !== tenantKey
    if (tenantChanged) {
      invalidateAll()
    }
    prevTenantRef.current = tenantKey

    void syncProducts()
    void syncSettings()
    void syncDomains()
  }, [tenantKey, storeSlug, storeId, isPlatformHost, hasTenantContext])

  if (isPlatformHost && !hasTenantContext) {
    return <PlatformLanding />
  }

  return (
    <div key={tenantKey} className="min-h-screen flex flex-col">
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
      <WhatsAppButton />
    </div>
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

          {/* ─── Public commerce routes (always available, even on the
              platform apex without a tenant context). These use the
              default cart/wishlist storage keys so browsing the public
              marketplace + adding to cart + checking out always works.
              WITHOUT these routes, clicking the bottom nav's cart icon
              from /marketplace on the platform host would fall through
              to PlatformLanding (broken UX). */}
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/thank-you/:orderNumber" element={<ThankYou />} />

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

    // ─── ضبط Manifest الـ PWA ديناميكياً لمتجر التاجر النشط ───
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const storeSlug = urlParams.get('store') || urlParams.get('storeId')
      const manifestLink = document.querySelector('link[rel="manifest"]')

      if (storeSlug && manifestLink) {
        const dynamicManifest = {
          name: `متجر ${storeSlug} — Amugar`,
          short_name: storeSlug,
          description: `تسوق مباشرة من متجر ${storeSlug}`,
          lang: 'ar',
          dir: 'rtl',
          start_url: `/?store=${encodeURIComponent(storeSlug)}&source=pwa`,
          scope: '/',
          display: 'standalone',
          background_color: '#FFFCF8',
          theme_color: '#1A1A1E',
          icons: [
            { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/logo.webp', sizes: 'any', type: 'image/webp' }
          ]
        }

        const stringManifest = JSON.stringify(dynamicManifest)
        const blob = new Blob([stringManifest], { type: 'application/json' })
        const manifestURL = URL.createObjectURL(blob)
        manifestLink.setAttribute('href', manifestURL)
      }
    } catch {}
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
