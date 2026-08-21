import React, { useState, useEffect } from 'react';
import { Package, ShoppingCart, DollarSign, Store, Plus, CheckCircle2 } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getOrders } from '../services/api/orders';
import { getProducts, saveProduct } from '../services/api/products';
import { Order, Product } from '../services/api/types';

export const Admin: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');

  useEffect(() => {
    getOrders().then(setOrders);
    getProducts().then(setProducts);
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductPrice) return;

    const newProd: Product = {
      id: `p-${Date.now()}`,
      name: newProductName,
      price: Number(newProductPrice),
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
      category: 'عام',
      rating: 5.0,
      reviewsCount: 1,
      salesCount: 0,
      storeName: 'متجري',
    };

    await saveProduct(newProd);
    setProducts(await getProducts());
    setNewProductName('');
    setNewProductPrice('');
    alert('تم إضافة المنتج بنجاح!');
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex flex-col font-sans" dir="rtl">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full space-y-6">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900">لوحة تحكم التاجر (Merchant Admin)</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-gray-400 font-bold">إجمالي الطلبات</span>
              <h3 className="text-xl font-black text-gray-900">{orders.length}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-gray-400 font-bold">المنتجات المعروضة</span>
              <h3 className="text-xl font-black text-gray-900">{products.length}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-gray-400 font-bold">إجمالي المبيعات</span>
              <h3 className="text-xl font-black text-gray-900">
                {orders.reduce((acc, o) => acc + o.totalPrice, 0).toLocaleString()} دج
              </h3>
            </div>
          </div>
        </div>

        {/* Add Product Form */}
        <form onSubmit={handleAddProduct} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-sm font-black text-gray-900">إضافة منتج جديد لمتجرك</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="اسم المنتج"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="number"
              placeholder="السعر بالدينار الجزائري (دج)"
              value={newProductPrice}
              onChange={(e) => setNewProductPrice(e.target.value)}
              className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-colors">
            حفظ المنتج
          </button>
        </form>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-4">
          <h2 className="text-sm font-black text-gray-900 mb-3">أحدث الطلبات المسجلة</h2>
          {orders.length === 0 ? (
            <p className="text-xs text-gray-400">لا توجد طلبات مسجلة بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="p-2.5">رقم الطلب</th>
                    <th className="p-2.5">الزبون</th>
                    <th className="p-2.5">الهاتف</th>
                    <th className="p-2.5">الولاية</th>
                    <th className="p-2.5">المبلغ</th>
                    <th className="p-2.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="p-2.5 font-bold font-mono">{o.id}</td>
                      <td className="p-2.5">{o.customerName}</td>
                      <td className="p-2.5 font-mono">{o.customerPhone}</td>
                      <td className="p-2.5">{o.wilaya}</td>
                      <td className="p-2.5 font-bold text-orange-600">{o.totalPrice.toLocaleString()} دج</td>
                      <td className="p-2.5">
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          قيد التأكيد
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Admin;
