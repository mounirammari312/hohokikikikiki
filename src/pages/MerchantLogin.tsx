import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Store, Lock, ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export const MerchantLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex flex-col font-sans" dir="rtl">
      <Header />

      <main className="flex-1 max-w-md mx-auto px-4 py-16 w-full flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-md w-full space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-2">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-center text-gray-900">تسجيل دخول التاجر</h1>
          <p className="text-xs text-gray-500 text-center">أدخل بيانات متجرك لإدارة الطلبات والمنتجات</p>

          <form onSubmit={handleLogin} className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="store@example.com"
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">كلمة المرور</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all mt-4"
            >
              دخول إلى لوحة التحكم
            </button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MerchantLogin;
