import React from 'react';
import { Home, Store, ShoppingBag, Heart, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';

export const BottomMobileNav: React.FC = () => {
  const location = useLocation();
  const { totalItems } = useCart();
  const { wishlist } = useWishlist();

  const navItems = [
    { label: 'الرئيسية', icon: Home, path: '/' },
    { label: 'الماركت', icon: Store, path: '/marketplace' },
    { label: 'السلة', icon: ShoppingBag, path: '/cart', badge: totalItems },
    { label: 'المفضلة', icon: Heart, path: '/wishlist', badge: wishlist.length },
    { label: 'حسابي', icon: User, path: '/merchant/login' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 py-1.5 px-4 flex items-center justify-around shadow-lg">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.label}
            to={item.path}
            className={`flex flex-col items-center py-1 relative ${
              isActive ? 'text-orange-600 font-bold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
};

export default BottomMobileNav;
