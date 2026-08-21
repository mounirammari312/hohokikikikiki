import { Product } from './types';

const STORAGE_KEY = 'amugar_products_db';

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'سماعات لاسلكية ANC برو بخاصية عزل الضوضاء وصوت نقي 9D',
    price: 3200,
    originalPrice: 7500,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80'],
    category: 'إلكترونيات',
    rating: 4.9,
    reviewsCount: 342,
    salesCount: 1420,
    storeName: 'TechStore DZ',
    isChoice: true,
    isFlashDeal: true,
    stockLeft: 8,
    freeShipping: true,
    description: 'سماعات بلوتوث 5.3 فائقة الجودة تدعم عزل الضوضاء النشط حتى 35dB مع بطارية تدوم 30 ساعة وشحن سريع.',
    colors: ['أسود كربوني', 'أبيض لؤلؤي'],
  },
  {
    id: 'p2',
    name: 'ساعة ذكية AMOLED مقاومة للماء مع شاشة لمس وإجراء المكالمات',
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
    colors: ['برتقالي رياضي', 'أسود ملكي'],
  },
  {
    id: 'p3',
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
    colors: ['رمادي داكن', 'أسود'],
  },
  {
    id: 'p4',
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
    sizes: ['40', '41', '42', '43', '44'],
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
  }
];

export async function getProducts(): Promise<Product[]> {
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error reading localStorage products:', e);
  }
  return DEFAULT_PRODUCTS;
}

export async function getProductById(id: string): Promise<Product | null> {
  const products = await getProducts();
  return products.find((p) => p.id === id) || null;
}

export async function saveProduct(product: Product): Promise<void> {
  const products = await getProducts();
  const index = products.findIndex((p) => p.id === product.id);
  if (index >= 0) {
    products[index] = product;
  } else {
    products.push(product);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}
