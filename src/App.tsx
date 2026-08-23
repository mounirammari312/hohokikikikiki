import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import { WhatsAppButton } from './components/WhatsAppButton'
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { TenantProvider, useTenant } from './context/TenantContext'
import { syncProducts } from './services/api/products'
import { syncSettings } from './services/api/settings'
import { syncDomains } from './services/api/domains'
import { invalidateAll } from './services/api/client'
import { PwaInstallBanner } from './components/PwaInstallBanner'

// ─── Code Splitting & Lazy Loading ──────────────────────────────────────────
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

// ─── Tenant Storefront Wrapper ──────────────────────────────────────────────
function TenantStorefront() {
  const { isPlatformHost, storeId, storeSlug } = useTenant()

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const hasExplicitStore = !!storeId || !!storeSlug || !!urlParams?.get('storeId') || !!urlParams?.get('store')

  const tenantKey = storeId || storeSlug || 'default'
  const prevTenantRef = useRef<string | null>(null)

  useEffect(() => {
    if (isPlatformHost && !hasExplicitStore) return

    const tenantChanged = prevTenantRef.current !== null && prevTenantRef.current !== tenantKey
    if (tenantChanged) {
      invalidateAll()
    }
    prevTenantRef.current = tenantKey

    void syncProducts()
    void syncSettings()
    void syncDomains()
  }, [tenantKey, storeSlug, storeId, isPlatformHost, hasExplicitStore])

  // إذا كان المستخدم على النطاق العام وبدون سياق متجر صريح، يعرض صفحة المنصة
  if (isPlatformHost && !hasExplicitStore) {
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
            <Route path="/*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  )
}

// ─── Merchant Dashboard Wrapper ─────────────────────────────────────────────
function MerchantDashboard() {
  const { user, loading } = useTenant()
  const location = useLocation()
  const isLogin = location.pathname.endsWith('/login')

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <div className="w-8 h-8 border-3 border-[#EDE6D8] border-t-[#C9A96A] rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || isLogin) {
    return (
      <Suspense fallback={<PageFallback />}>
        <MerchantLogin />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Admin />
    </Suspense>
  )
}

// ─── Main Routing Tree ──────────────────────────────────────────────────────
function AppRoutes() {
  const { isPlatformHost, storeId, storeSlug } = useTenant()
  const location = useLocation()

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const hasStoreParam = !!urlParams?.get('storeId') || !!urlParams?.get('store')
  const isStorePath = location.pathname.startsWith('/store/')

  // وضع المتجر ينشط فقط عند وجود رابط صريح أو نطاق فرعي مخصص
  const isTenantMode = !isPlatformHost || hasStoreParam || isStorePath || (!!(storeId || storeSlug) && location.pathname !== '/')

  return (
    <>
      <ScrollToTop />
      <div className="min-h-screen bg-[#FFFCF8] flex flex-col">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* 1. السوق العام (Marketplace) */}
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/*" element={<Marketplace />} />

            {/* 2. الإدارة العليا (Super Admin) */}
            <Route path="/super-admin" element={<SuperAdmin />} />
            <Route path="/super-admin/*" element={<SuperAdmin />} />

            {/* 3. لوحة تحكم التاجر (Merchant Admin) */}
            <Route path="/admin" element={<MerchantDashboard />} />
            <Route path="/admin/*" element={<MerchantDashboard />} />

            {/* 4. مسار المتاجر المباشر بالاسم (/store/:slug) */}
            <Route path="/store/:slug/*" element={<TenantStorefront />} />

            {/* 5. التوجيه الأساسي للرابط الرئيسي وباقي المسارات */}
            {isTenantMode ? (
              <Route path="/*" element={<TenantStorefront />} />
            ) : (
              <>
                <Route path="/" element={<PlatformLanding />} />
                <Route path="/*" element={<PlatformLanding />} />
              </>
            )}
          </Routes>
        </Suspense>
      </div>
    </>
  )
}

// ─── Root App Component ─────────────────────────────────────────────────────
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

