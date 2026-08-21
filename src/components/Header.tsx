import React from 'react';
import { ShoppingBag, Heart, Store, User, Sparkles, Flame, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export const Header: React.FC = () => {
  const { totalItems } = useCart();
  const { wishlist } = useWishlist();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-8 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-red-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-gray-900">AMUGAR</span>
            <span className="block text-[10px] text-orange-600 font-bold -mt-1 tracking-wider uppercase">Marketplace 2026</span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-gray-700">
          <Link to="/marketplace" className="hover:text-orange-600 transition-colors flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-red-500" /> الماركت بلايس
          </Link>
          <Link to="/shop" className="hover:text-orange-600 transition-colors flex items-center gap-1">
            <Store className="w-3.5 h-3.5 text-blue-500" /> المتجر الشامل
          </Link>
          <Link to="/admin" className="hover:text-orange-600 transition-colors flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-green-500" /> لوحة التاجر
          </Link>
          <Link to="/super-admin" className="hover:text-orange-600 transition-colors flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-purple-500" /> إدارة المنصة
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/wishlist"
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center relative transition-colors"
            aria-label="Wishlist"
          >
            <Heart className="w-5 h-5" />
            {wishlist.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {wishlist.length}
              </span>
            )}
          </Link>

          <Link
            to="/cart"
            className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">السلة</span>
            <span className="bg-white text-orange-600 px-1.5 py-0.2 rounded-full font-black text-[11px]">
              {totalItems}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
