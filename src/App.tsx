import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import ThankYou from './pages/ThankYou'
import Admin from './pages/Admin'
import Wishlist from './pages/Wishlist'
import PlatformLanding from './pages/PlatformLanding'
import SuperAdmin from './pages/SuperAdmin'
import MerchantLogin from './pages/MerchantLogin'
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { TenantProvider, useTenant } from './context/TenantContext'
import { ensureProducts, syncProducts } from './services/api/products'
import { syncWilayas } from './services/api/wilayas'
import { syncSettings } from './services/api/settings'
import { syncDomains } from './services/api/domains'
import { invalidateAll } from './services/api/client'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  App — MULTI-TENANT SaaS routing layer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Three-tier routing based on hostname + path:
 *
 *  1. PLATFORM APEX (lumiere.saas)
 *     - /                  → PlatformLanding (SaaS marketing + register)
 *     - /super-admin       → SuperAdmin dashboard (super_admin role only)
 *     - /super-admin/login → SuperAdmin login (handled inside SuperAdmin)
 *
 *  2. TENANT SUBDOMAIN (slug.lumiere.saas) or custom domain
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
  // ?storeId=, different subdomain, etc.) — this triggers a cache clear
  // + re-sync so we never show one store's products on another store.
  const tenantKey = storeId || storeSlug || 'default'
  useEffect(() => {
    if (isPlatformHost && !hasTenantContext) return  // skip sync if no tenant
    invalidateAll()
    void syncProducts()
    void syncWilayas()
    void syncSettings()
    void syncDomains()
    ensureProducts()
  }, [tenantKey])

  if (isPlatformHost && !hasTenantContext) {
    return <PlatformLanding />
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/thank-you/:orderNumber" element={<ThankYou />} />
        </Routes>
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
  if (loading) return <div className="min-h-[60vh] grid place-items-center text-[#9A8A6B]">جاري التحميل…</div>
  if (!user || isLogin) return <MerchantLogin />

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
    return <PlatformLanding />
  }

  // NOTE: we intentionally do NOT render <Header /> + <Footer /> here.
  // The merchant dashboard has its OWN sidebar + top bar (inside Admin).
  // Adding the storefront Header would create a SECOND menu button
  // (the storefront's mobile menu) on top of the dashboard's sidebar
  // toggle — confusing UX. The dashboard is a self-contained shell.
  return <Admin />
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
  const tenantMode = !isPlatformHost || (hasStoreParam || (!!(storeId || storeSlug) && !isRoot))

  return (
    <>
      <ScrollToTop />
      <div className="min-h-screen bg-[#FFFCF8] flex flex-col">
        <Routes>
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
          </BrowserRouter>
        </WishlistProvider>
      </CartProvider>
    </TenantProvider>
  )
}
