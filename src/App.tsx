import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
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

// حارس حماية لوحة التحكم عبر الرابط السري
function AdminGuard() {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const hasSecret = searchParams.get('admin') === 'true'

  if (hasSecret) {
    sessionStorage.setItem('lumiere_admin_auth', 'true')
  }

  const isAuth = sessionStorage.getItem('lumiere_admin_auth') === 'true' || hasSecret

  if (!isAuth) {
    return <Navigate to="/" replace />
  }

  return <Admin />
}

export default function App(){
  useEffect(()=>{
    document.documentElement.lang='ar'
    document.documentElement.dir='rtl'

    void syncProducts()
    void syncWilayas()
    void syncSettings()
    void syncDomains()

    ensureProducts()
  },[])
  return (
    <CartProvider>
      <WishlistProvider>
        <BrowserRouter>
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
                <Route path="/admin" element={<AdminGuard/>} />
              </Routes>
            </main>
            <Footer/>
          </div>
        </BrowserRouter>
      </WishlistProvider>
    </CartProvider>
  )
}

