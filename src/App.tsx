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
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { ensureProducts, syncProducts } from './services/api/products'
import { syncWilayas } from './services/api/wilayas'
import { syncSettings } from './services/api/settings'
import { syncDomains } from './services/api/domains'

// 🔑 كلمة السر الخاصة بلوحة التحكم (غيرها من هنا في أي وقت)
const ADMIN_PASSWORD = '1234'

// حارس حماية لوحة التحكم مع شاشة كلمة السر
function AdminGuard() {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const hasSecret = searchParams.get('admin') === 'true'

  const [passInput, setPassInput] = useState('')
  const [isAuth, setIsAuth] = useState(() => {
    return sessionStorage.getItem('lumiere_admin_auth') === 'true'
  })
  const [error, setError] = useState(false)

  // التفعيل التلقائي عند استخدام الرابط السري
  useEffect(() => {
    if (hasSecret) {
      sessionStorage.setItem('lumiere_admin_auth', 'true')
      setIsAuth(true)
    }
  }, [hasSecret])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (passInput === ADMIN_PASSWORD) {
      sessionStorage.setItem('lumiere_admin_auth', 'true')
      setIsAuth(true)
      setError(false)
    } else {
      setError(true)
    }
  }

  // إذا لم يكن مسجلاً للدخول، تظهر شاشة كلمة السر
  if (!isAuth) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="bg-white p-6 md:p-8 rounded-2xl border border-[#EDE6D8] shadow-lg max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 bg-[#1A1A1E] text-[#C9A96A] rounded-xl flex items-center justify-center mx-auto text-xl font-bold">
            🔒
          </div>
          <h2 className="text-xl font-bold text-[#1A1A1E]">دخول المسؤول</h2>
          <p className="text-xs text-[#7A6F5A]">أدخل كلمة السر للوصول إلى لوحة التحكم</p>
          
          <input
            type="password"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            placeholder="كلمة السر..."
            className="w-full border border-[#EDE6D8] rounded-xl px-4 py-2.5 text-center outline-none focus:border-[#C9A96A] transition text-sm"
          />
          
          {error && <p className="text-xs text-red-500 font-semibold">كلمة السر غير صحيحة!</p>}

          <button
            type="submit"
            className="w-full bg-[#1A1A1E] text-white py-2.5 rounded-xl font-semibold hover:bg-black transition text-sm"
          >
            دخول
          </button>
        </form>
      </div>
    )
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

