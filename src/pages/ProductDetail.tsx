import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, Truck, ShieldCheck, ShoppingBag, Heart, ArrowRight, Check, Sparkles } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getProductById } from '../services/api/products';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Product } from '../services/api/types';

export const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');

  const { addToCart } = useCart();
  const { addToWishlist, wishlist } = useWishlist();

  useEffect(() => {
    if (id) {
      getProductById(id).then((p) => {
        if (p) {
          setProduct(p);
          setSelectedImage(p.image);
          if (p.colors && p.colors.length > 0) setSelectedColor(p.colors[0]);
          if (p.sizes && p.sizes.length > 0) setSelectedSize(p.sizes[0]);
        }
      });
    }
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F4F5F7]">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-500">
          <p>جارٍ تحميل تفاصيل المنتج...</p>
        </div>
        <Footer />
      </div>
    );
  }

  const isFav = wishlist.some((w) => w.id === product.id);

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex flex-col font-sans" dir="rtl">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full space-y-6">
        <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-orange-600">
          <ArrowRight className="w-4 h-4" /> العودة إلى الماركت بلايس
        </Link>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Gallery */}
          <div className="space-y-4">
            <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 relative">
              <img src={selectedImage} alt={product.name} className="w-full h-full object-cover" />
              {product.isChoice && (
                <span className="absolute top-3 right-3 bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-1 rounded shadow">
                  Amugar Choice
                </span>
              )}
            </div>

            {product.images && product.images.length > 1 && (
              <div className="flex items-center gap-3">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImage === img ? 'border-orange-600 scale-105' : 'border-gray-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg">
                  {product.storeName || 'متجر أموقار الرسمي'}
                </span>
                <span className="text-xs text-gray-400 font-medium">الرمز: {product.id}</span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-gray-900 mt-3 leading-snug">
                {product.name}
              </h1>

              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center text-amber-500 font-bold text-sm">
                  <Star className="w-4 h-4 fill-amber-500 ml-1" />
                  <span>{product.rating || 4.9}</span>
                  <span className="text-gray-400 font-normal mr-1">({product.reviewsCount || 85} تقييم)</span>
                </div>
                <span className="text-gray-300">•</span>
                <span className="text-xs text-gray-500">تم بيع {product.salesCount || 400}+ قطعة</span>
              </div>

              {/* Price */}
              <div className="mt-5 p-4 rounded-2xl bg-orange-50/60 border border-orange-100 flex items-baseline gap-3">
                <span className="text-3xl font-black text-gray-900">
                  {product.price.toLocaleString()} <span className="text-sm font-bold text-orange-600">دج</span>
                </span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-sm text-gray-400 line-through">
                    {product.originalPrice.toLocaleString()} دج
                  </span>
                )}
                {product.freeShipping && (
                  <span className="bg-green-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md mr-auto">
                    توصيل مجاني
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="mt-5 text-xs sm:text-sm text-gray-600 leading-relaxed">
                <p>{product.description || 'منتج أصلي عالي الجودة متوفر مع ضمان وفحص عند الاستلام وشحن سريع لجميع الولايات الـ 58.'}</p>
              </div>

              {/* Colors */}
              {product.colors && product.colors.length > 0 && (
                <div className="mt-5">
                  <label className="text-xs font-bold text-gray-700 block mb-2">اللون:</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {product.colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setSelectedColor(c)}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${
                          selectedColor === c ? 'border-orange-600 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-700'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sizes */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mt-4">
                  <label className="text-xs font-bold text-gray-700 block mb-2">المقاس:</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {product.sizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedSize(s)}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${
                          selectedSize === s ? 'border-orange-600 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-700'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2.5 bg-gray-50 hover:bg-gray-100 font-bold">-</button>
                  <span className="px-4 text-sm font-bold text-gray-900">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-2.5 bg-gray-50 hover:bg-gray-100 font-bold">+</button>
                </div>

                <button
                  onClick={() => addToCart({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image,
                    quantity: quantity,
                    color: selectedColor,
                    size: selectedSize,
                  })}
                  className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all"
                >
                  <ShoppingBag className="w-4 h-4" />
                  أضف إلى السلة ({(product.price * quantity).toLocaleString()} دج)
                </button>

                <button
                  onClick={() => addToWishlist({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image,
                  })}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    isFav ? 'bg-red-50 border-red-200 text-red-500' : 'border-gray-200 text-gray-500 hover:text-red-500'
                  }`}
                  aria-label="Wishlist"
                >
                  <Heart className={`w-5 h-5 ${isFav ? 'fill-red-500' : ''}`} />
                </button>
              </div>

              {/* Guarantees */}
              <div className="grid grid-cols-2 gap-3 pt-3 text-[11px] text-gray-600 font-medium">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50">
                  <Truck className="w-4 h-4 text-orange-600" />
                  <span>توصيل سريع لـ 58 ولاية</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  <span>دفع نقداً عند الاستلام</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
