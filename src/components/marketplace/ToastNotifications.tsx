import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';

export const ToastNotifications: React.FC = () => {
  const [toast, setToast] = useState<{ name: string; city: string; item: string } | null>(null);

  useEffect(() => {
    const cities = ['الجزائر العاصمة', 'وهران', 'قسنطينة', 'سطيف', 'عنابة', 'تلمسان', 'باتنة', 'جيجل', 'البليدة', 'الشلف'];
    const buyers = ['أحمد ب.', 'كريم م.', 'سارة ع.', 'ياسين ك.', 'أمينة ط.', 'محمد ر.', 'هدى س.'];
    const items = ['سماعات ANC برو', 'ساعة ذكية AMOLED', 'ماكينة T9 الاحترافية', 'حقيبة ظهر USB', 'قلاية هوائية 6L'];

    const interval = setInterval(() => {
      const randomCity = cities[Math.floor(Math.random() * cities.length)];
      const randomBuyer = buyers[Math.floor(Math.random() * buyers.length)];
      const randomItem = items[Math.floor(Math.random() * items.length)];

      setToast({ name: randomBuyer, city: randomCity, item: randomItem });
      setTimeout(() => setToast(null), 4000);
    }, 9500);

    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 right-6 z-50 bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-2xl p-3.5 shadow-2xl flex items-center gap-3 max-w-sm"
        >
          <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="text-gray-900 font-bold">
              اشترى <span className="text-orange-600">{toast.name}</span> من ({toast.city}) للتو
            </p>
            <p className="text-gray-500 text-[11px] truncate max-w-[200px]">{toast.item}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ToastNotifications;
