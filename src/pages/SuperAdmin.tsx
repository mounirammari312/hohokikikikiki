import React from 'react';
import { Shield, Users, Store, DollarSign, Settings } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export const SuperAdmin: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex flex-col font-sans" dir="rtl">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full space-y-6">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900">إدارة منصة أموقار المركزية (Super Admin)</h1>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-xs text-gray-400 font-bold">إجمالي المتاجر</span>
            <h3 className="text-xl font-black text-gray-900 mt-1">48 متجر</h3>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-xs text-gray-400 font-bold">المشتركون النشطون</span>
            <h3 className="text-xl font-black text-gray-900 mt-1">12,450 مستخدم</h3>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-xs text-gray-400 font-bold">حجم المعاملات</span>
            <h3 className="text-xl font-black text-orange-600 mt-1">14,280,000 دج</h3>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-xs text-gray-400 font-bold">نسبة نجاح التوصيل</span>
            <h3 className="text-xl font-black text-green-600 mt-1">94.8%</h3>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SuperAdmin;
