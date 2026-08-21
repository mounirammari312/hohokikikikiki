import React from 'react';
import { Star, ShoppingBag, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { Product } from '../../services/api/types';

interface EnhancedProductCardProps {
  product: Product;
}

export const EnhancedProductCard: React.FC<EnhancedProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const { addToWishlist, wishlist } = useWishlist();

  const discount = product.originalPrice && product.originalPrice > product.price 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) 
    : 0;

  const isFav = wishlist?.some((w) => w.id === product.id);

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
      {/* Image Container */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
          {discount > 0 && (
            <span className="bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded-md shadow">
              -{discount}%
            </span>
          )}
          {product.isChoice && (
            <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded shadow">
              Choice
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button
          onClick={() => addToWishlist({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
          })}
          className={`absolute top-2 left-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transition-colors shadow z-10 ${
            isFav ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
          }`}
          aria-label="Wishlist"
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500' : ''}`} />
        </button>
      </div>

      {/* Info Content */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <div className="text-[10px] text-gray-500 font-medium mb-1 flex items-center justify-between">
            <span>{product.storeName || 'متجر أموقار'}</span>
            {product.freeShipping && (
              <span className="text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">
                توصيل مجاني
              </span>
            )}
          </div>

          <Link to={`/product/${product.id}`}>
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-2 leading-snug hover:text-orange-600 transition-colors">
              {product.name}
            </h3>
          </Link>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-black text-gray-900">
              {product.price.toLocaleString()} <span className="text-xs font-bold text-orange-600">دج</span>
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-xs text-gray-400 line-through">
                {product.originalPrice.toLocaleString()} دج
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
            <div className="flex items-center text-amber-500 font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-500 ml-0.5" />
              <span>{product.rating || 4.8}</span>
              <span className="text-gray-400 font-normal mr-0.5">({product.reviewsCount || 45})</span>
            </div>
            <span>تم بيع {product.salesCount || 230}+</span>
          </div>

          <button
            onClick={() => addToCart({
              id: product.id,
              name: product.name,
              price: product.price,
              image: product.image,
              quantity: 1,
            })}
            className="w-full mt-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            إضافة إلى السلة
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedProductCard;
