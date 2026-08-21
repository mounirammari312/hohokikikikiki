import React, { useState, useEffect } from 'react';
import { Flame, Eye, Truck, ShieldCheck } from 'lucide-react';

export const LiveTicker: React.FC = () => {
  const [liveViewers, setLiveViewers] = useState(1450);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveViewers((prev) => prev + Math.floor(Math.random() * 7) - 3);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-neutral-950 text-white text-xs py-1.5 px-3 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded-full font-black text-[10px] animate-pulse">
            <Flame className="w-3 h-3" /> مباشر 2026
          </span>
          <span className="text-gray-300 font-medium text-[11px] truncate">
            عروض الصاعقة لـ 58 ولاية • الدفع عند الاستلام مع فحص الطرد قبل الدفع
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-gray-300 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-orange-400" />
            <span><strong className="text-white">{liveViewers}</strong> متسوق يتصفحون الآن</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-green-400" />
            <span>شحن سريع لباب منزلك</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTicker;
