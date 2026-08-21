import React from 'react';
import { Store, Star, CheckCircle2, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const STORES = [
  {
    id: 's1',
    name: 'TechStore DZ',
    logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    rating: 4.9,
    sales: '15k+ مبيعة',
    badge: 'متجر رسمي معتمد',
    wilaya: 'الجزائر العاصمة',
  },
  {
    id: 's2',
    name: 'Algeria Smart',
    logo: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=150&auto=format&fit=crop&q=80',
    rating: 4.8,
    sales: '8.4k+ مبيعة',
    badge: 'الأول في الإلكترونيات',
    wilaya: 'وهران',
  },
  {
    id: 's3',
    name: 'Fashion Hub DZ',
    logo: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=150&auto=format&fit=crop&q=80',
    rating: 4.9,
    sales: '12k+ مبيعة',
    badge: 'علامة أزياء رائدة',
    wilaya: 'سطيف',
  },
  {
    id: 's4',
    name: 'HomeStyle VIP',
    logo: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=150&auto=format&fit=crop&q=80',
    rating: 4.8,
    sales: '6.2k+ مبيعة',
    badge: 'أفضل تجهيزات المنزل',
    wilaya: 'قسنطينة',
  },
];

export const TopStores: React.FC = () => {
  return (
    <section className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-orange-600" />
          <h2 className="text-base sm:text-lg font-extrabold text-gray-900">المتاجر الموثوقة (Top Verified Stores)</h2>
        </div>
        <span className="text-xs text-gray-500">متاجر مرخصة ومضمونة</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STORES.map((st) => (
          <div 
            key={st.id}
            className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/70 hover:bg-white hover:border-orange-200 hover:shadow-sm transition-all duration-200 text-center flex flex-col items-center justify-between"
          >
            <div className="w-14 h-14 rounded-full overflow-hidden mb-2 border-2 border-orange-500/30 p-0.5 bg-white shadow-sm">
              <img src={st.logo} alt={st.name} className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="flex items-center gap-1">
              <h4 className="text-xs font-bold text-gray-900">{st.name}</h4>
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
            </div>
            <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full mt-1">
              {st.badge}
            </span>
            <p className="text-[10px] text-gray-400 mt-1">{st.wilaya}</p>
            <div className="flex items-center gap-2 text-[11px] text-gray-600 mt-2">
              <span className="flex items-center text-amber-500 font-bold">
                <Star className="w-3 h-3 fill-amber-500 ml-0.5" /> {st.rating}
              </span>
              <span>•</span>
              <span>{st.sales}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TopStores;
