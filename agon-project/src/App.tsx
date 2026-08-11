import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
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
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { ensureProducts, syncProducts } from './services/api/products'
import { syncWilayas } from './services/api/wilayas'
import { syncSettings } from './services/api/settings'
import { syncDomains } from './services/api/domains'

export default function App(){
  useEffect(()=>{
    // Set document language + direction first (used by everything else)
    document.documentElement.lang='ar'
    document.documentElement.dir='rtl'

    // Kick off the API syncs in parallel — the UI renders from the
    // in-memory cache (which is pre-populated with seed data) and
    // will refresh automatically once the API responds.
    void syncProducts()
    void syncWilayas()
    void syncSettings()
    void syncDomains()

    // Keep the legacy ensure* function for backwards-compat (no-op now)
    ensureProducts()
  },[])
  return (
    <CartProvider>
      <WishlistProvider>
        <BrowserRouter>
          {/* ScrollToTop MUST be inside BrowserRouter so it can use useLocation.
              Previously it was defined but never mounted — meaning route changes
              preserved the previous scroll position (e.g. clicking a category
              from the bottom of the home page opened /shop at the bottom). */}
          <ScrollToTop/>
          <div className="min-h-screen bg-[#FFFCF8] flex flex-col">
            <Header/>
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home/>} />
                <Route path="/shop" element={<Shop/>} />
                <Route path="/product/:id" element={<ProductDetail/>} />
                <Route path="/cart" element={<Cart/>} />
                <Route path="/wishlist" element={<Wishlist/>} />
                <Route path="/thank-you/:orderNumber" element={<ThankYou/>} />
                <Route path="/admin" element={<Admin/>} />
              </Routes>
            </main>
            <Footer/>
          </div>
        </BrowserRouter>
      </WishlistProvider>
    </CartProvider>
  )
}
