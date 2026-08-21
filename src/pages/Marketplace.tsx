import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, 
  Zap, 
  ShieldCheck, 
  Truck, 
  Tag, 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  ShoppingBag, 
  Heart, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  Gift, 
  CheckCircle2, 
  SlidersHorizontal,
  Store,
  ArrowRight,
  Eye,
  BadgePercent
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

// Types
interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  category: string;
  rating: number;
  reviewsCount: number;
  salesCount: number;
  storeName: string;
  isChoice?: boolean;
  isFlashDeal?: boolean;
  stockLeft?: number;
  freeShipping?: boolean;
}

interface StoreItem {
  id: string;
  name: string;
  logo: string;
  rating: number;
  sales: string;
  badge: string;
  verified: boolean;
}

// Sample Data tailored for Algerian Marketplace
const sampleFlashDeals: Product[] = [
  {
    id: 'f1',
    name: 'سماعات لاسلكية ANC برو بخاصية عزل الضوضاء وصوت نقي 9D',
    price: 3200,
    originalPrice: 7500,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
    category: 'إلكترونيات',
    rating: 4.9,
    reviewsCount: 342,
    salesCount: 1420,
    storeName: 'TechStore DZ',
    isChoice: true,
    isFlashDeal: true,
    stockLeft: 8,
    freeShipping: true,
  },
  {
    id: 'f2',
    name: 'ساعة ذكية مقاومة للماء مع شاشة AMOLED وقياس نبضات القلب',
    price: 4900,
    originalPrice: 9800,
    image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&auto=format&fit=crop&q=80',
    category: 'إلكترونيات',
    rating: 4.8,
    reviewsCount: 198,
    salesCount: 890,
    storeName: 'Algeria Smart',
    isChoice: true,
    isFlashDeal: true,
    stockLeft: 14,
    freeShipping: true,
  },
  {
    id: 'f3',
    name: 'حقيبة ظهر رجالية عصرية مقاومة للماء مع منفذ شحن USB',
    price: 2600,
    originalPrice: 5200,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',
    category: 'أزياء',
    rating: 4.7,
    reviewsCount: 112,
    salesCount: 650,
    storeName: 'Fashion Hub',
    isChoice: false,
    isFlashDeal: true,
    stockLeft: 22,
    freeShipping: false,
  },
  {
    id: 'f4',
    name: 'مصباح مكتبي LED ذكي مع شاحن لاسلكي سريع 15W',
    price: 3400,
    originalPrice: 6800,
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80',
    category: 'المنزل',
    rating: 4.9,
    reviewsCount: 87,
    salesCount: 430,
    storeName: 'HomeStyle DZ',
    isChoice: true,
    isFlashDeal: true,
    stockLeft: 6,
    freeShipping: true,
  },
];

const sampleProducts: Product[] = [
  ...sampleFlashDeals,
  {
    id: 'p5',
    name: 'ماكينة حلاقة وتشذيب احترافية بتصميم معدني عتيق T9',
    price: 1950,
    originalPrice: 3900,
    image: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=600&auto=format&fit=crop&q=80',
    category: 'عناية وجمال',
    rating: 4.8,
    reviewsCount: 520,
    salesCount: 2300,
    storeName: 'Barber Pro DZ',
    isChoice: true,
    freeShipping: true,
  },
  {
    id: 'p6',
    name: 'طقم أواني طهي جرانيت غير لاصق 10 قطع إيطالي التصميم',
    price: 14500,
    originalPrice: 22000,
    image: 'https://images.unsplash.com/photo-1584990347449-39bbf8703c15?w=600&auto=format&fit=crop&q=80',
    category: 'المنزل والمطبخ',
    rating: 4.9,
    reviewsCount: 144,
    salesCount: 510,
    storeName: 'Cuisine VIP',
    isChoice: true,
    freeShipping: true,
  },
  {
    id: 'p7',
    name: 'حذاء رياضي مريح للجري والأنشطة اليومية خفيف الوزن',
    price: 3800,
    originalPrice: 6500,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    category: 'أزياء',
    rating: 4.6,
    reviewsCount: 275,
    salesCount: 1100,
    storeName: 'Sport Express',
    isChoice: false,
    freeShipping: false,
  },
  {
    id: 'p8',
    name: 'كاميرا مراقبة خارجية ذكية 360° برؤية ليلية ملونة وواي فاي',
    price: 5800,
    originalPrice: 9500,
    image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600&auto=format&fit=crop&q=80',
    category: 'إلكترونيات',
    rating: 4.9,
    reviewsCount: 160,
    salesCount: 780,
    storeName: 'Security Plus',
    isChoice: true,
    freeShipping: true,
  },
];

const sampleTopStores: StoreItem[] = [
  {
    id: 's1',
    name: 'TechStore DZ',
    logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    rating: 4.9,
    sales: '15k+ مبيعة',
    badge: 'متجر رسمي مميز',
    verified: true,
  },
  {
    id: 's2',
    name: 'Algeria Smart',
    logo: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=150&auto=format&fit=crop&q=80',
    rating: 4.8,
    sales: '8.4k+ مبيعة',
    badge: 'المرتبة الأولى بالإلكترونيات',
    verified: true,
  },
  {
    id: 's3',
    name: 'Fashion Hub DZ',
    logo: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=150&auto=format&fit=crop&q=80',
    rating: 4.9,
    sales: '12k+ مبيعة',
    badge: 'علامة أزياء معتمدة',
    verified: true,
  },
  {
    id: 's4',
    name: 'HomeStyle VIP',
    logo: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=150&auto=format&fit=crop&q=80',
    rating: 4.8,
    sales: '6.2k+ مبيعة',
    badge: 'أفضل منتجات المنزل',
    verified: true,
  },
];

const heroSlides = [
  {
    id: 1,
    title: 'تخفيضات كبرى لموسم 2026',
    subtitle: 'خصومات تصل حتى 70% على أحدث الإلكترونيات والأزياء مع دفع عند الاستلام',
    tag: '⚡ عروض الصاعقة المحدودة',
    badgeText: 'تخفيض 70%',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&auto=format&fit=crop&q=80',
    link: '#flash-deals',
    bgGradient: 'from-red-600 via-orange-600 to-amber-600',
  },
  {
    id: 2,
    title: 'منتجات Amugar Choice الحصرية',
    subtitle: 'شحن فوري ومجاني لـ 58 ولاية وضمان استرجاع حقيقي خلال 7 أيام',
    tag: '⭐ الاختيار المعتمد',
    badgeText: 'توصيل مجاني',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&auto=format&fit=crop&q=80',
    link: '#feed',
    bgGradient: 'from-blue-700 via-indigo-700 to-purple-800',
  },
];

const categories = [
  { id: 'all', name: '🔥 الكل', icon: Sparkles },
  { id: 'choice', name: '⭐ Amugar Choice', icon: Star },
  { id: 'tech', name: '📱 إلكترونيات', icon: Zap },
  { id: 'fashion', name: '👗 أزياء وموضة', icon: Tag },
  { id: 'home', name: '🏠 المنزل والمطبخ', icon: Store },
  { id: 'beauty', name: '💄 عناية وجمال', icon: Sparkles },
  { id: 'deals', name: '⚡ عروض الصاعقة', icon: Flame },
];

export const Marketplace: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<'recommended' | 'bestseller' | 'priceAsc' | 'rating'>('recommended');
  const [liveViewers, setLiveViewers] = useState(1482);
  const [liveToast, setLiveToast] = useState<{ name: string; city: string; item: string } | null>(null);

  // Time Countdown for Flash Deals (HH:MM:SS)
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 28, seconds: 45 });

  const { addToCart } = useCart();
  const { addToWishlist, wishlist } = useWishlist();

  // Slide Auto-play
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Flash Deals Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 6, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Social Proof Toasts & Viewers Jitter
  useEffect(() => {
    const cities = ['الجزائر العاصمة', 'وهران', 'قسنطينة', 'سطيف', 'عنابة', 'تلمسان', 'باتنة', 'جيجل', 'البليدة'];
    const buyers = ['أحمد ب.', 'كريم م.', 'سارة ع.', 'ياسين ك.', 'أمينة ط.', 'محمد ر.'];
    const items = ['سماعات ANC برو', 'ساعة ذكية AMOLED', 'ماكينة T9 الاحترافية', 'حقيبة ظهر USB'];

    const toastInterval = setInterval(() => {
      const randomCity = cities[Math.floor(Math.random() * cities.length)];
      const randomBuyer = buyers[Math.floor(Math.random() * buyers.length)];
      const randomItem = items[Math.floor(Math.random() * items.length)];

      setLiveToast({ name: randomBuyer, city: randomCity, item: randomItem });
      setLiveViewers((prev) => prev + Math.floor(Math.random() * 7) - 3);

      setTimeout(() => setLiveToast(null), 4000);
    }, 9000);

    return () => clearInterval(toastInterval);
  }, []);

  const filteredProducts = sampleProducts.filter((product) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'choice') return product.isChoice;
    if (activeCategory === 'deals') return product.isFlashDeal;
    if (activeCategory === 'tech') return product.category.includes('إلكترونيات');
    if (activeCategory === 'fashion') return product.category.includes('أزياء');
    if (activeCategory === 'home') return product.category.includes('المنزل');
    if (activeCategory === 'beauty') return product.category.includes('عناية');
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (activeTab === 'bestseller') return b.salesCount - a.salesCount;
    if (activeTab === 'priceAsc') return a.price - b.price;
    if (activeTab === 'rating') return b.rating - a.rating;
    return 0; // 'recommended'
  });

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 pb-20 font-sans antialiased selection:bg-orange-500 selection:text-white" dir="rtl">
      
      {/* 1. Top Ticker / Trust Bar */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white text-xs py-2 px-4 border-b border-neutral-700">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-red-600/90 text-white px-2 py-0.5 rounded-full font-bold text-[10px] animate-pulse">
              <Flame className="w-3 h-3" /> مباشر
            </span>
            <span className="text-gray-300 hidden sm:inline">
              عروض وتخفيضات حصرية لـ 58 ولاية • الدفع عند الاستلام 100% مضمون
            </span>
          </div>

          <div className="flex items-center gap-4 text-gray-300">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              <span><strong className="text-white">{liveViewers.toLocaleString()}</strong> متسوق يتصفحون الآن</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-green-400" />
              <span>توصيل سريع لباب المنزل أو المكتب</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 space-y-6">

        {/* 2. Hero Bento Grid (AliExpress / Temu 2026 Style) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Main Hero Slider (8 Cols) */}
          <div className="lg:col-span-8 relative rounded-2xl overflow-hidden shadow-sm bg-neutral-900 min-h-[320px] sm:min-h-[380px] flex items-center">
            {heroSlides.map((slide, index) => (
              <motion.div
                key={slide.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: index === activeSlide ? 1 : 0 }}
                transition={{ duration: 0.6 }}
                className={`absolute inset-0 bg-cover bg-center ${index === activeSlide ? 'z-10' : 'z-0 pointer-events-none'}`}
                style={{ backgroundImage: `url(${slide.image})` }}
              >
                {/* Gradient Overlay for Readability */}
                <div className={`absolute inset-0 bg-gradient-to-l ${slide.bgGradient} opacity-85 mix-blend-multiply`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="relative z-20 h-full flex flex-col justify-center px-6 sm:px-10 max-w-xl text-white py-8">
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-amber-200 mb-3 w-fit border border-white/20">
                    <Sparkles className="w-3.5 h-3.5" />
                    {slide.tag}
                  </div>

                  <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-2">
                    {slide.title}
                  </h1>

                  <p className="text-sm sm:text-base text-gray-100/90 mb-6 line-clamp-2">
                    {slide.subtitle}
                  </p>

                  <div className="flex items-center gap-3">
                    <a
                      href={slide.link}
                      className="bg-white text-gray-900 hover:bg-amber-400 hover:text-gray-950 font-bold text-sm px-6 py-3 rounded-xl shadow-lg transition-all duration-200 flex items-center gap-2 group"
                    >
                      تسوق الآن
                      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    </a>

                    <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-white">
                      {slide.badgeText}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Slide Navigation Controls */}
            <div className="absolute bottom-4 left-6 z-20 flex items-center gap-2">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === activeSlide ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Side Bento Cards (4 Cols) */}
          <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            
            {/* Card 1: New User Welcome Zone */}
            <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 rounded-2xl p-5 text-white relative overflow-hidden shadow-sm flex flex-col justify-between">
              <div className="absolute -left-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-black/30 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5 text-yellow-300" /> هدية الترحيب
                  </span>
                  <span className="text-xs font-bold text-yellow-200">للأعضاء الجدد</span>
                </div>
                <h3 className="text-xl font-extrabold leading-snug">قسيمة بقيمة 500 دج</h3>
                <p className="text-xs text-amber-100 mt-1">تطبق تلقائياً على أول طلب مع توصيل مجاني</p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
                <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-dashed border-white/50 text-xs font-mono font-bold tracking-wider">
                  AMUGAR2026
                </div>
                <button 
                  onClick={() => alert('تم نسخ القسيمة بنجاح!')}
                  className="bg-white text-orange-600 hover:bg-yellow-100 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                  نسخ القسيمة
                </button>
              </div>
            </div>

            {/* Card 2: Super Deal / Lightning Pick */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm flex items-center gap-4 relative overflow-hidden">
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 relative">
                <img 
                  src="https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300&auto=format&fit=crop&q=80" 
                  alt="Super Deal" 
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  -58%
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-[11px] font-bold text-red-600 mb-1">
                  <Zap className="w-3.5 h-3.5 fill-red-600" />
                  <span>عرض الصاعقة اليومي</span>
                </div>
                <h4 className="text-xs font-bold text-gray-900 truncate">سماعات لاسلكية ANC برو</h4>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-base font-extrabold text-red-600">3,200 دج</span>
                  <span className="text-xs text-gray-400 line-through">7,500 دج</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-red-600 to-orange-500 h-full w-[82%]" />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">المتبقي: 8 قطع فقط</p>
              </div>
            </div>

          </div>
        </section>

        {/* 3. Sticky Quick Category Navigation Bar */}
        <section className="sticky top-0 z-30 bg-white/95 backdrop-blur-md py-2.5 px-3 rounded-2xl shadow-sm border border-gray-200/70">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                    isActive 
                      ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-md shadow-orange-500/20' 
                      : 'bg-gray-100/80 hover:bg-gray-200/70 text-gray-700'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-orange-500'}`} />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. Lightning Flash Deals Bar (Temu / AliExpress Lightning Deals) */}
        <section id="flash-deals" className="bg-gradient-to-r from-red-600 via-orange-600 to-red-700 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-yellow-300">
                <Flame className="w-5 h-5 fill-yellow-300 animate-bounce" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
                  عروض الصاعقة FLASH DEALS
                </h2>
                <p className="text-xs text-orange-100">أسعار حصرية تنتهي قريباً مع شحن فوري</p>
              </div>
            </div>

            {/* Countdown Clock */}
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/20 self-start sm:self-auto">
              <Clock className="w-4 h-4 text-yellow-300" />
              <span className="text-xs font-medium text-gray-200">ينتهي العرض خلال:</span>
              <div className="flex items-center gap-1 font-mono font-bold text-sm">
                <span className="bg-white text-gray-900 px-1.5 py-0.5 rounded">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span>:</span>
                <span className="bg-white text-gray-900 px-1.5 py-0.5 rounded">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span>:</span>
                <span className="bg-white text-gray-900 px-1.5 py-0.5 rounded">{String(timeLeft.seconds).padStart(2, '0')}</span>
              </div>
            </div>
          </div>

          {/* Flash Deals Horizontal Carousel / Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {sampleFlashDeals.map((deal) => {
              const discountPercent = Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100);
              return (
                <div 
                  key={deal.id}
                  className="bg-white rounded-xl p-3 text-gray-900 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between"
                >
                  <div className="relative rounded-lg overflow-hidden bg-gray-50 aspect-square mb-2.5">
                    <img 
                      src={deal.image} 
                      alt={deal.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2 right-2 bg-red-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-md shadow">
                      -{discountPercent}%
                    </span>
                    {deal.isChoice && (
                      <span className="absolute bottom-2 right-2 bg-amber-500 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                        Choice
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-800 line-clamp-2 leading-relaxed mb-1">
                      {deal.name}
                    </h3>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-black text-red-600">{deal.price.toLocaleString()} دج</span>
                      <span className="text-[11px] text-gray-400 line-through">{deal.originalPrice.toLocaleString()} دج</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-red-600 to-orange-500 h-full w-[76%]" />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1">
                      <span>تم بيع {deal.salesCount}+</span>
                      <span className="text-red-600 font-bold">باقي {deal.stockLeft} قطع</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => addToCart({
                      id: deal.id,
                      name: deal.name,
                      price: deal.price,
                      image: deal.image,
                      quantity: 1
                    })}
                    className="w-full mt-3 bg-gray-900 hover:bg-orange-600 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    شراء سريع
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. Top Stores / Amugar Verified Merchants */}
        <section className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-orange-600" />
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900">متاجر مميزة وموثوقة (Amugar Verified)</h2>
            </div>
            <Link to="/stores" className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1">
              عرض كل المتاجر <ChevronLeft className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sampleTopStores.map((st) => (
              <div 
                key={st.id}
                className="p-3 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-white hover:border-orange-200 hover:shadow-sm transition-all duration-200 text-center flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-full overflow-hidden mb-2 border-2 border-orange-500/30 p-0.5 bg-white">
                  <img src={st.logo} alt={st.name} className="w-full h-full object-cover rounded-full" />
                </div>
                <div className="flex items-center gap-1">
                  <h4 className="text-xs font-bold text-gray-900">{st.name}</h4>
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
                </div>
                <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full mt-1">
                  {st.badge}
                </span>
                <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-2">
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

        {/* 6. Feed Section: Recommended For You */}
        <section id="feed" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900">موصى به لك (Recommended Feed)</h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
              <button
                onClick={() => setActiveTab('recommended')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'recommended' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                الموصى بها
              </button>
              <button
                onClick={() => setActiveTab('bestseller')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'bestseller' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                الأكثر طلباً
              </button>
              <button
                onClick={() => setActiveTab('rating')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'rating' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                الأعلى تقييماً
              </button>
              <button
                onClick={() => setActiveTab('priceAsc')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'priceAsc' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                الأقل سعراً
              </button>
            </div>
          </div>

          {/* Product Grid (2 Cols Mobile / 4-5 Cols Desktop) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {sortedProducts.map((prod) => {
              const discount = Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100);
              const isFav = wishlist?.some((w) => w.id === prod.id);

              return (
                <div 
                  key={prod.id}
                  className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="relative aspect-square bg-gray-50 overflow-hidden">
                    <img 
                      src={prod.image} 
                      alt={prod.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Discount & Choice Badges */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      <span className="bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded-md shadow">
                        -{discount}%
                      </span>
                      {prod.isChoice && (
                        <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded shadow">
                          Choice
                        </span>
                      )}
                    </div>

                    {/* Wishlist Button */}
                    <button
                      onClick={() => addToWishlist({
                        id: prod.id,
                        name: prod.name,
                        price: prod.price,
                        image: prod.image,
                      })}
                      className={`absolute top-2 left-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transition-colors shadow ${
                        isFav ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                      }`}
                      aria-label="Add to Wishlist"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500' : ''}`} />
                    </button>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-gray-500 font-medium mb-1 flex items-center justify-between">
                        <span>{prod.storeName}</span>
                        {prod.freeShipping && (
                          <span className="text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">
                            توصيل مجاني
                          </span>
                        )}
                      </div>

                      <Link to={`/product/${prod.id}`}>
                        <h3 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-2 leading-snug hover:text-orange-600 transition-colors">
                          {prod.name}
                        </h3>
                      </Link>
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-100">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base sm:text-lg font-black text-gray-900">
                          {prod.price.toLocaleString()} <span className="text-xs font-bold text-orange-600">دج</span>
                        </span>
                        <span className="text-xs text-gray-400 line-through">
                          {prod.originalPrice.toLocaleString()} دج
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                        <div className="flex items-center text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-500 ml-0.5" />
                          <span>{prod.rating}</span>
                          <span className="text-gray-400 font-normal mr-0.5">({prod.reviewsCount})</span>
                        </div>
                        <span>تم بيع {prod.salesCount}+</span>
                      </div>

                      {/* Quick Add to Cart Button */}
                      <button
                        onClick={() => addToCart({
                          id: prod.id,
                          name: prod.name,
                          price: prod.price,
                          image: prod.image,
                          quantity: 1,
                        })}
                        className="w-full mt-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        إضافة إلى السلة
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 7. Guarantees & Trust Badges */}
        <section className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-2">
                <Truck className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">شحن لـ 58 ولاية</h4>
              <p className="text-xs text-gray-500 mt-0.5">توصيل سريع حتى باب منزلك أو أقرب مكتب</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-2">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">الدفع عند الاستلام</h4>
              <p className="text-xs text-gray-500 mt-0.5">افحص طلبك وتأكد من الجودة قبل الدفع</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <BadgePercent className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">ضمان أفضل سعر</h4>
              <p className="text-xs text-gray-500 mt-0.5">أسعار مباشرة من التاجر دون وسطاء</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">ضمان استرجاع 7 أيام</h4>
              <p className="text-xs text-gray-500 mt-0.5">استبدال أو استرجاع مضمون في حالة وجود عيب</p>
            </div>
          </div>
        </section>

      </main>

      {/* 8. Live Real-time Social Proof Toast */}
      <AnimatePresence>
        {liveToast && (
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
                اشترى <span className="text-orange-600">{liveToast.name}</span> من ({liveToast.city}) للتو
              </p>
              <p className="text-gray-500 text-[11px] truncate">{liveToast.item}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Marketplace;

