import React from 'react';
import { ShoppingBag, ShieldCheck, Truck, PhoneCall, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-neutral-900 text-gray-400 text-xs border-t border-neutral-800 mt-16 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center font-black">
              A
            </div>
            <span className="text-white text-lg font-black tracking-tight">AMUGAR 2026</span>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed">
            منصة التجارة الإلكترونية وسوق المتاجر الموثوقة الأولى في الجزائر. شحن فوري لـ 58 ولاية وضمان حقيقي للدفع عند الاستلام.
          </p>
        </div>

        <div>
          <h4 className="text-white font-bold text-sm mb-3">روابط سريعة</h4>
          <ul className="space-y-2">
            <li><Link to="/marketplace" className="hover:text-white transition-colors">السوق المركزي</Link></li>
            <li><Link to="/shop" className="hover:text-white transition-colors">تصفح المنتجات</Link></li>
            <li><Link to="/cart" className="hover:text-white transition-colors">سلة المشتريات</Link></li>
            <li><Link to="/wishlist" className="hover:text-white transition-colors">قائمة الرغبات</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold text-sm mb-3">للتجار والشركاء</h4>
          <ul className="space-y-2">
            <li><Link to="/merchant/login" className="hover:text-white transition-colors">دخول التجار</Link></li>
            <li><Link to="/admin" className="hover:text-white transition-colors">لوحة تحكم المتجر</Link></li>
            <li><Link to="/super-admin" className="hover:text-white transition-colors">لوحة الإدارة المركزية</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold text-sm mb-3">خدمة الزبائن والدعم</h4>
          <p className="text-xs text-gray-400 mb-2">فريقنا متواجد لخدمتكم 7 أيام في الأسبوع:</p>
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <PhoneCall className="w-4 h-4 text-orange-500" />
            <span>0550 00 00 00 / 0660 00 00 00</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-6 border-t border-neutral-800 text-center text-gray-500 text-[11px] flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>© 2026 Amugar Platform. جميع الحقوق محفوظة للسوق الجزائري.</span>
        <span>بنيت بأحدث معايير الويب الفائقة السرعة والتجاوب.</span>
      </div>
    </footer>
  );
};

export default Footer;
