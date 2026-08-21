import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';

export const Wishlist: React.FC = () => {
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex flex-col font-sans" dir="rtl">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full space-y-6">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900">قائمة الرغبات والمفضلة</h1>

        {wishlist.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-200">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">قائمتك فارغة حالياً</h3>
            <p className="text-xs text-gray-500 mt-1 mb-6">احفظ المنتجات التي تعجبك بالضغط على أيقونة القلب للرجوع إليها لاحقاً.</p>
            <Link to="/marketplace" className="bg-orange-600 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md">
              تصفح المنتجات
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {wishlist.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm flex flex-col justify-between">
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 mb-2">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xs font-bold text-gray-900 truncate mb-1">{item.name}</h3>
                <span className="text-sm font-black text-orange-600 mb-3">{item.price.toLocaleString()} دج</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      addToCart({ ...item, quantity: 1 });
                      removeFromWishlist(item.id);
                    }}
                    className="flex-1 bg-orange-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> نقل للسلة
                  </button>
                  <button onClick={() => removeFromWishlist(item.id)} className="p-2 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Wishlist;
