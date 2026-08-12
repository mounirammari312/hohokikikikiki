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
  const { isPlatformHost } = useTenant()
  // On the platform host with no tenant context, redirect to the SaaS landing.
  // The storefront routes below are only mounted on tenant subdomains OR
  // when ?storeId= is set (lets super-admin preview a specific store).
  const urlParams = new URLSearchParams(window.location.search)
  const hasExplicitStoreId = !!urlParams.get('storeId')

  if (isPlatformHost && !hasExplicitStoreId) {
    return <PlatformLanding />
  }

  // Kick off the data syncs for the current tenant on mount
  useEffect(() => {
    void syncProducts()
    void syncWilayas()
    void syncSettings()
    void syncDomains()
    ensureProducts()
  }, [])

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
  const { user, loading } = useTenant()
  const location = useLocation()
  const isLogin = location.pathname.endsWith('/login')

  // Show login screen if not authenticated OR if explicitly on /admin/login
  if (loading) return <div className="min-h-[60vh] grid place-items-center text-[#9A8A6B]">جاري التحميل…</div>
  if (!user || isLogin) return <MerchantLogin />

  // Authenticated merchant → show the existing Admin page (tenant-scoped
  // via the x-store-id header injected by client.ts).
  return (
    <>
      <Header />
      <main className="flex-1">
        <Admin />
      </main>
      <Footer />
    </>
  )
}

function AppRoutes() {
  const { isPlatformHost } = useTenant()

  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="min-h-screen bg-[#FFFCF8] flex flex-col">
        <Routes>
          {/* ─── Platform apex routes ─────────────────────────────────── */}
          {isPlatformHost && (
            <>
              <Route path="/" element={<PlatformLanding />} />
              <Route path="/super-admin/login" element={<SuperAdmin />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              {/* On the platform apex, /admin → redirect to landing
                  (merchant dashboard is only accessible on tenant subdomains). */}
              <Route path="/admin" element={<PlatformLanding />} />
              <Route path="/admin/*" element={<PlatformLanding />} />
              {/* Fall through to tenant storefront if ?storeId= is set
                  (lets a super-admin preview a specific store). */}
              <Route path="/*" element={<TenantStorefront />} />
            </>
          )}

          {/* ─── Tenant subdomain routes ──────────────────────────────── */}
          {!isPlatformHost && (
            <>
              <Route path="/admin/login" element={<MerchantDashboard />} />
              <Route path="/admin" element={<MerchantDashboard />} />
              <Route path="/*" element={<TenantStorefront />} />
            </>
          )}
        </Routes>
      </div>
    </BrowserRouter>
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
          <AppRoutes />
        </WishlistProvider>
      </CartProvider>
    </TenantProvider>
  )
}
