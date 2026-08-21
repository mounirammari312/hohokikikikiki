import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle2, Package, Truck, ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export const ThankYou: React.FC = () => {
  const location = useLocation();
  const order = location.state?.order;

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex flex-col font-sans" dir="rtl">
      <Header />

      <main className="flex-1 max-w-xl mx-auto px-4 py-16 text-center w-full">
        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-md space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h1 className="text-2xl font-black text-gray-900">تم تسجيل طلبك بنجاح!</h1>
          <p className="text-xs text-gray-600 leading-relaxed">
            شكراً لثقتك بمنصة أموقار. سيتصل بك فريق خدمة العملاء قريباً لتأكيد تفاصيل الشحن.
          </p>

          {order && (
            <div className="my-6 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-right space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">رقم الطلب:</span>
                <strong className="font-mono text-gray-900">{order.id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">رقم التتبع:</span>
                <strong className="font-mono text-orange-600">{order.trackingNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الولاية:</span>
                <span className="text-gray-900 font-bold">{order.wilaya}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-900 font-bold">المبلغ للدفع عند الاستلام:</span>
                <strong className="text-sm font-black text-orange-600">{order.totalPrice.toLocaleString()} دج</strong>
              </div>
            </div>
          )}

          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm px-8 py-3.5 rounded-xl shadow-md transition-all"
          >
            متابعة التسوق <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ThankYou;
