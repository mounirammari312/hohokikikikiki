import React from 'react';
import { Sparkles, Star, Zap, Tag, Store, Flame, Heart } from 'lucide-react';

interface CategoriesCircleProps {
  onSelectCategory?: (id: string) => void;
}

const CATEGORIES = [
  { id: 'all', name: 'الكل', count: '10k+', icon: Sparkles, color: 'from-orange-500 to-red-500' },
  { id: 'choice', name: 'Choice', count: '2.4k+', icon: Star, color: 'from-amber-500 to-yellow-500' },
  { id: 'deals', name: 'عروض الصاعقة', count: '850+', icon: Flame, color: 'from-red-600 to-rose-600' },
  { id: 'tech', name: 'إلكترونيات', count: '3.1k+', icon: Zap, color: 'from-blue-600 to-indigo-600' },
  { id: 'fashion', name: 'أزياء', count: '4.5k+', icon: Tag, color: 'from-pink-500 to-purple-600' },
  { id: 'home', name: 'المنزل', count: '1.8k+', icon: Store, color: 'from-emerald-500 to-teal-600' },
  { id: 'beauty', name: 'عناية وجمال', count: '920+', icon: Heart, color: 'from-rose-500 to-red-500' },
];

export const CategoriesCircle: React.FC<CategoriesCircleProps> = ({ onSelectCategory }) => {
  return (
    <section className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-orange-600" /> الفئات الأكثر تصفحاً
        </h3>
        <span className="text-[11px] text-gray-400">تصفح حسب اهتمامك</span>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory?.(cat.id)}
              className="flex flex-col items-center flex-shrink-0 group cursor-pointer"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${cat.color} p-0.5 shadow-sm group-hover:scale-110 transition-transform duration-300 flex items-center justify-center text-white`}>
                <div className="w-full h-full rounded-[14px] bg-black/10 flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <span className="text-xs font-bold text-gray-800 mt-2 group-hover:text-orange-600 transition-colors">
                {cat.name}
              </span>
              <span className="text-[10px] text-gray-400 font-medium">
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default CategoriesCircle;
