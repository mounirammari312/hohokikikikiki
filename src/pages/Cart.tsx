import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Truck, ShieldCheck } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCart } from '../context/CartContext';
import { ALGERIA_WILAYAS } from '../services/api/wilayas';
import { createOrder } from '../services/api/orders';

export const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { cart, updateQuantity, removeFromCart, clearCart, totalPrice } = useCart();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedWilayaId, setSelectedWilayaId] = useState(16); // Algiers
  const [commune, setCommune] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryType, setDeliveryType] = useState<'home' | 'desk'>('home');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedWilaya = ALGERIA_WILAYAS.find((w) => w.id === selectedWilayaId) || ALGERIA_WILAYAS[15];
  const shippingPrice = deliveryType === 'home' ? selectedWilaya.homePrice : selectedWilaya.deskPrice;
  const finalTotal = totalPrice + shippingPrice;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      alert('يرجى إدخال الاسم ورقم الهاتف.');
      return;
    }
    if (cart.length === 0) {
      alert('سلة التسوق فارغة.');
      return;
    }

    try {
      setIsSubmitting(true);
      const newOrder = await createOrder({
        customerName,
        customerPhone,
        wilaya: selectedWilaya.ar_name,
        commune,
        address,
        items: cart.map((item) => ({
          id: `${item.id}-${Date.now()}`,
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          color: item.color,
          size: item.size,
        })),
        totalPrice: finalTotal,
        shippingPrice,
        deliveryType,
      });

      clearCart();
      navigate('/thank-you', { state: { order: newOrder } });
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تسجيل الطلب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex flex-col font-sans" dir="rtl">
        <Header />
        <main className="flex-1 max-w-xl mx-auto px-4 py-20 text-center flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900">سلة التسوق فارغة</h2>
          <p className="text-gray-500 text-sm mt-2 mb-6">لم تقم بإضافة أي منتجات للسلة بعد.</p>
          <Link
            to="/marketplace"
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-md transition-all"
          >
            تصفح عروض الماركت بلايس
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex flex-col font-sans" dir="rtl">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full space-y-6">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900">سلة التسوق وتأكيد الطلب</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cart Items (7 Cols) */}
          <div className="lg:col-span-7 space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate">{item.name}</h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm font-black text-orange-600">{item.price.toLocaleString()} دج</span>
                    {item.color && <span className="text-[11px] text-gray-400">({item.color})</span>}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1 bg-gray-50 text-xs">-</button>
                      <span className="px-3 text-xs font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1 bg-gray-50 text-xs">+</button>
                    </div>

                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Checkout Form (5 Cols) */}
          <div className="lg:col-span-5">
            <form onSubmit={handleCheckout} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-base font-black text-gray-900 pb-2 border-b border-gray-100">معلومات التوصيل (الدفع عند الاستلام)</h2>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: محمد بن علي"
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="مثال: 0550123456"
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">الولاية (58 ولاية)</label>
                  <select
                    value={selectedWilayaId}
                    onChange={(e) => setSelectedWilayaId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    {ALGERIA_WILAYAS.map((w) => (
                      <option key={w.id} value={w.id}>{w.id} - {w.ar_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">البلدية</label>
                  <input
                    type="text"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    placeholder="مثال: باب الزوار"
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">نوع التوصيل</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('home')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center ${
                      deliveryType === 'home' ? 'border-orange-600 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    <span>لباب المنزل</span>
                    <span className="text-[10px] text-gray-500">{selectedWilaya.homePrice} دج</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('desk')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center ${
                      deliveryType === 'desk' ? 'border-orange-600 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    <span>المكتب (Stop Desk)</span>
                    <span className="text-[10px] text-gray-500">{selectedWilaya.deskPrice} دج</span>
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="pt-4 border-t border-gray-100 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>مجموع المنتجات:</span>
                  <span>{totalPrice.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>تكلفة الشحن:</span>
                  <span>{shippingPrice.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-100">
                  <span>المجموع الإجمالي:</span>
                  <span className="text-orange-600">{finalTotal.toLocaleString()} دج</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg transition-all"
              >
                {isSubmitting ? 'جارٍ تأكيد الطلب...' : 'تأكيد الطلب الآن (الدفع عند الاستلام)'}
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Cart;
