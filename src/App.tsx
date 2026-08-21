import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TenantProvider } from './context/TenantContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

import Marketplace from './pages/Marketplace';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import ThankYou from './pages/ThankYou';
import Admin from './pages/Admin';
import MerchantLogin from './pages/MerchantLogin';
import SuperAdmin from './pages/SuperAdmin';

export const App: React.FC = () => {
  return (
    <TenantProvider>
      <CartProvider>
        <WishlistProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Marketplace />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/thank-you" element={<ThankYou />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/merchant/login" element={<MerchantLogin />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
            </Routes>
          </BrowserRouter>
        </WishlistProvider>
      </CartProvider>
    </TenantProvider>
  );
};

export default App;
