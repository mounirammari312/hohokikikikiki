// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
import type { Product, WilayaRate, StoreSettings, StoreDomain } from './types'

const jewelryAttributes = [
  { key:'materialAr', label:'Material', labelAr:'الخامة', type:'text' as const, placeholder:'مثال: ذهب 18ق + لؤلؤ طبيعي', required:true },
  { key:'plating', label:'Plating', labelAr:'الطلاء', type:'select' as const, options:['ذهب 18ق','ذهب 14ق','فضة 925','روديوم','نحاس مطلي'] },
  { key:'stone', label:'Stone', labelAr:'الحجر', type:'select' as const, options:['لؤلؤ طبيعي','زركون AAA','زركونيا','عقيق','بدون حجر'] },
  { key:'weight', label:'Weight', labelAr:'الوزن (غ)', type:'text' as const, placeholder:'مثال: 12.5' },
  { key:'warranty', label:'Warranty', labelAr:'الضمان', type:'select' as const, options:['12 شهر','6 أشهر','بدون ضمان'] },
]
const fashionAttributes = [
  { key:'fabricAr', label:'Fabric', labelAr:'القماش', type:'select' as const, options:['قطن','حرير','مخمل','ساتان','كتان','جلد طبيعي','شبك','صوف'], required:true },
  { key:'fit', label:'Fit', labelAr:'القصة', type:'select' as const, options:['عادي','واسع','ضيق','انسيابي','أوفر سايز'] },
  { key:'length', label:'Length', labelAr:'الطول', type:'select' as const, options:['قصير','ميدي','طويل','ماكسي'] },
  { key:'care', label:'Care', labelAr:'العناية', type:'text' as const, placeholder:'مثال: غسيل يدوي بارد' },
  { key:'season', label:'Season', labelAr:'الموسم', type:'select' as const, options:['ربيع','صيف','خريف','شتاء','كل المواسم'] },
]
const beautyAttributes = [
  { key:'volume', label:'Volume', labelAr:'الحجم', type:'text' as const, placeholder:'مثال: 50مل', required:true },
  { key:'skinType', label:'Skin Type', labelAr:'نوع البشرة', type:'multiselect' as const, options:['كل الأنواع','دهنية','جافة','مختلطة','حساسة'] },
  { key:'scent', label:'Scent', labelAr:'العائلة العطرية', type:'select' as const, options:['زهري','عود','مسك','فانيليا','حمضيات','خشبي'] },
  { key:'finish', label:'Finish', labelAr:'اللمسة', type:'select' as const, options:['مطفي','لامع','ساتان','طبيعي'] },
  { key:'expiry', label:'Expiry', labelAr:'الصلاحية', type:'text' as const, placeholder:'مثال: 24 شهر بعد الفتح' },
]

export const presetDomains: StoreDomain[] = [
  {
    id: 'domain_jewelry',
    name: 'Amugar',
    nameAr: 'Amugar',
    descriptionAr: 'مجوهرات فاخرة مطلية بذهب 18ق — لؤلؤ طبيعي وزركون AAA. بريق باريسي بروح جزائرية.',
    heroBadge: 'COLLECTION 2026 • ÉDITION LIMITÉE',
    heroTitleAr: 'منتجات تُبرز أناقتك',
    heroSubtitleAr: 'تشكيلة Amugar 2026 مطلية بذهب 18ق، لؤلؤ طبيعي وزركون AAA. تصميم باريسي، تسليم جزائري سريع والدفع عند الاستلام.',
    heroImage: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1400&q=80',
    footerDescriptionAr: 'متجر جزائري بلمسة عصرية. منتجات بجودة عالية، مقاومة ومتينة. الدفع عند الاستلام في 69 ولاية.',
    categories: [
      { key: 'necklace', label: 'Necklaces', labelAr: 'قلادات' },
      { key: 'ring', label: 'Rings', labelAr: 'خواتم' },
      { key: 'earring', label: 'Earrings', labelAr: 'أقراط' },
      { key: 'bracelet', label: 'Bracelets', labelAr: 'أساور' },
    ],
    attributeSchema: jewelryAttributes,
    variantConfig: {
      hasColor: true,
      hasSize: true,
      sizeOptions: ['5','6','7','8','9','قابل للتعديل','XS','S','M','L'],
      colorPresets: [
        { name:'Gold', nameAr:'ذهبي', hex:'#D4AF37' },
        { name:'Silver', nameAr:'فضي', hex:'#C0C0C0' },
        { name:'Rose Gold', nameAr:'وردي ذهبي', hex:'#E8B4B8' },
        { name:'Black', nameAr:'أسود', hex:'#1A1A1E' },
      ]
    },
    isPreset: true
  },
  {
    id: 'domain_fashion',
    name: 'Amugar MODE',
    nameAr: 'Amugar MODE',
    descriptionAr: 'أزياء نسائية راقية — عباءات، فساتين، حجابات وحقائب بلمسة باريسية وخياطة جزائرية متقنة.',
    heroBadge: 'MODE 2026 • NOUVELLE COLLECTION',
    heroTitleAr: 'أزياء تُبرز أناقتك',
    heroSubtitleAr: 'كولكشن أزياء 2026: فساتين سهرة، عباءات مخملية، حجابات حريرية وحقائب تُكمل إطلالتك — توصيل 69 ولاية والدفع عند الاستلام.',
    heroImage: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=1400&q=80',
    footerDescriptionAr: 'دار أزياء جزائرية بلمسة باريسية. خامات فاخرة، قصّات عصرية، ومقاسات تناسب كل سيدة. الدفع عند الاستلام في 69 ولاية.',
    categories: [
      { key: 'dress', label: 'Dresses', labelAr: 'فساتين' },
      { key: 'abaya', label: 'Abayas', labelAr: 'عباءات' },
      { key: 'hijab', label: 'Hijabs', labelAr: 'حجابات' },
      { key: 'bag', label: 'Bags', labelAr: 'حقائب' },
      { key: 'shoes', label: 'Shoes', labelAr: 'أحذية' },
    ],
    attributeSchema: fashionAttributes,
    variantConfig: {
      hasColor: true,
      hasSize: true,
      sizeOptions: ['XS','S','M','L','XL','XXL','36','37','38','39','40','41','42','مقاس موحد'],
      colorPresets: [
        { name:'Black', nameAr:'أسود', hex:'#1A1A1E' },
        { name:'Beige', nameAr:'بيج', hex:'#D2B48C' },
        { name:'White', nameAr:'أبيض', hex:'#FFFFFF' },
        { name:'Burgundy', nameAr:'خمري', hex:'#7A1F44' },
        { name:'Navy', nameAr:'كحلي', hex:'#1E3A5F' },
        { name:'Olive', nameAr:'زيتوني', hex:'#6B7B5E' },
      ]
    },
    isPreset: true
  },
  {
    id: 'domain_beauty',
    name: 'Amugar BEAUTÉ',
    nameAr: 'Amugar BEAUTÉ',
    descriptionAr: 'عالم الجمال والعطور — عطور نيش، مكياج ثابت، عناية بالبشرة والشعر بجودة صالونات باريس.',
    heroBadge: 'BEAUTÉ 2026 • ÉDITION ROSE',
    heroTitleAr: 'جمال يُضيء ملامحك',
    heroSubtitleAr: 'عطور تدوم، مكياج لا يتلاشى، وعناية تمنحك إشراقة طبيعية — تشكيلة بيوتي 2026 مع توصيل سريع والدفع عند الاستلام.',
    heroImage: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1400&q=80',
    footerDescriptionAr: 'متجر الجمال الجزائري بلمسة باريسية. منتجات أصلية 100%، تركيبات آمنة، وتغليف هدية فاخر. الدفع عند الاستلام 69 ولاية.',
    categories: [
      { key: 'perfume', label: 'Perfumes', labelAr: 'عطور' },
      { key: 'makeup', label: 'Makeup', labelAr: 'مكياج' },
      { key: 'skincare', label: 'Skincare', labelAr: 'عناية بالبشرة' },
      { key: 'hair', label: 'Hair', labelAr: 'عناية بالشعر' },
    ],
    attributeSchema: beautyAttributes,
    variantConfig: {
      hasColor: true,
      hasSize: true,
      sizeOptions: ['30مل','50مل','100مل','200مل','XS','S','M','L','مقاس موحد'],
      colorPresets: [
        { name:'Nude 01', nameAr:'نيود 01', hex:'#E8C4B0' },
        { name:'Rose 02', nameAr:'وردي 02', hex:'#D4A5A5' },
        { name:'Red 03', nameAr:'أحمر 03', hex:'#A02A5B' },
        { name:'Brown 04', nameAr:'بني 04', hex:'#8B5A3C' },
      ]
    },
    isPreset: true
  },
  // ─── Electronics store (phones, accessories, headphones, etc.) ──────────
  {
    id: 'domain_electronics',
    name: 'Amugar Electronics',
    nameAr: 'Amugar Electronics',
    descriptionAr: 'متجر إلكترونيات — هواتف، لواحق، سماعات، شواحن، إكسسوارات تقنية.',
    heroBadge: 'TECH 2026 • جديد',
    heroTitleAr: 'أحدث الإلكترونيات بين يديك',
    heroSubtitleAr: 'هواتف ذكية، سماعات لاسلكية، شواحن سريعة، وإكسسوارات تقنية أصلية 100%. ضمان حقيقي وتوصيل سريع.',
    heroImage: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=1400&q=80',
    footerDescriptionAr: 'متجر إلكترونيات جزائري. منتجات أصلية بضمان، توصيل لكل الولايات، والدفع عند الاستلام.',
    categories: [
      { key: 'phone', label: 'Phones', labelAr: 'هواتف' },
      { key: 'accessory', label: 'Accessories', labelAr: 'لواحق' },
      { key: 'headphones', label: 'Headphones', labelAr: 'سماعات' },
      { key: 'charger', label: 'Chargers', labelAr: 'شواحن' },
      { key: 'case', label: 'Cases', labelAr: 'علب وحماية' },
      { key: 'cable', label: 'Cables', labelAr: 'كابلات' },
    ],
    attributeSchema: [
      { key:'brand', label:'Brand', labelAr:'الماركة', type:'text' as const, placeholder:'مثال: Apple, Samsung', required:true },
      { key:'model', label:'Model', labelAr:'الموديل', type:'text' as const, placeholder:'مثال: iPhone 15' },
      { key:'warranty', label:'Warranty', labelAr:'الضمان', type:'select' as const, options:['12 شهر','6 أشهر','3 أشهر','بدون ضمان'] },
      { key:'condition', label:'Condition', labelAr:'الحالة', type:'select' as const, options:['جديد','مجدد','مستعمل'] },
      { key:'storage', label:'Storage', labelAr:'التخزين', type:'select' as const, options:['64GB','128GB','256GB','512GB','1TB','—'] },
    ],
    variantConfig: {
      hasColor: true,
      hasSize: false,
      sizeOptions: [],
      colorPresets: [
        { name:'Black', nameAr:'أسود', hex:'#1A1A1E' },
        { name:'White', nameAr:'أبيض', hex:'#FFFFFF' },
        { name:'Silver', nameAr:'فضي', hex:'#C0C0C0' },
        { name:'Gold', nameAr:'ذهبي', hex:'#D4AF37' },
        { name:'Blue', nameAr:'أزرق', hex:'#1E40AF' },
      ],
    },
    isPreset: true
  },
  // ─── Home Appliances store (refrigerators, washers, ovens, ACs, TVs) ────
  {
    id: 'domain_home_appliances',
    name: 'Amugar Home',
    nameAr: 'Amugar Home',
    descriptionAr: 'متجر أجهزة منزلية — ثلاجات، غسالات، أفران، مكيفات، تلفزيونات.',
    heroBadge: 'HOME 2026 • توصيل مجاني',
    heroTitleAr: 'كل ما يحتاجه منزلك',
    heroSubtitleAr: 'أجهزة منزلية كبيرة وصغيرة بأسعار تنافسية، ضمان حقيقي، توصيل وتركيب في كل الولايات.',
    heroImage: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1400&q=80',
    footerDescriptionAr: 'متجر أجهزة منزلية جزائري. ضمان حقيقي، توصيل وتركيب، والدفع عند الاستلام.',
    categories: [
      { key: 'refrigerator', label: 'Refrigerators', labelAr: 'ثلاجات' },
      { key: 'washer', label: 'Washing Machines', labelAr: 'غسالات' },
      { key: 'oven', label: 'Ovens', labelAr: 'أفران' },
      { key: 'ac', label: 'Air Conditioners', labelAr: 'مكيفات' },
      { key: 'tv', label: 'TVs', labelAr: 'تلفزيونات' },
      { key: 'small_appliance', label: 'Small Appliances', labelAr: 'أجهزة صغيرة' },
    ],
    attributeSchema: [
      { key:'brand', label:'Brand', labelAr:'الماركة', type:'text' as const, placeholder:'مثال: LG, Samsung', required:true },
      { key:'model', label:'Model', labelAr:'الموديل', type:'text' as const, placeholder:'مثال: GN-B512' },
      { key:'warranty', label:'Warranty', labelAr:'الضمان', type:'select' as const, options:['24 شهر','12 شهر','6 أشهر','بدون ضمان'] },
      { key:'capacity', label:'Capacity', labelAr:'السعة', type:'text' as const, placeholder:'مثال: 12 كغ / 8 كغ' },
      { key:'energy', label:'Energy', labelAr:'الاستهلاك', type:'select' as const, options:['A+++','A++','A+','A','B'] },
    ],
    variantConfig: {
      hasColor: false,
      hasSize: false,
      sizeOptions: [],
      colorPresets: [],
    },
    isPreset: true
  },
  // ─── Digital Products store (IPTV, Netflix, AI, Canva, subscriptions) ────
  {
    id: 'domain_digital',
    name: 'Amugar Digital',
    nameAr: 'Amugar Digital',
    descriptionAr: 'متجر منتجات رقمية — IPTV، اشتراكات Netflix، اشتراكات AI، حسابات Canva، كروت شحن.',
    heroBadge: 'DIGITAL 2026 • فوري',
    heroTitleAr: 'منتجات رقمية بتفعيل فوري',
    heroSubtitleAr: 'اشتراكات IPTV، Netflix، أدوات الذكاء الاصطناعي، Canva Pro، وكل ما تحتاجه رقمياً. تفعيل خلال دقائق.',
    heroImage: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1400&q=80',
    footerDescriptionAr: 'متجر رقميات جزائري. تفعيل فوري، دعم فني، ضمان استرجاع خلال 24 ساعة.',
    categories: [
      { key: 'subscription', label: 'Subscriptions', labelAr: 'اشتراكات' },
      { key: 'account', label: 'Accounts', labelAr: 'حسابات' },
      { key: 'giftcard', label: 'Gift Cards', labelAr: 'كروت هدايا' },
      { key: 'code', label: 'Codes', labelAr: 'أكواد' },
      { key: 'iptv', label: 'IPTV', labelAr: 'IPTV' },
      { key: 'ai_tool', label: 'AI Tools', labelAr: 'أدوات AI' },
    ],
    attributeSchema: [
      { key:'duration', label:'Duration', labelAr:'المدة', type:'select' as const, options:['شهر','3 أشهر','6 أشهر','سنة','دائم'], required:true },
      { key:'delivery', label:'Delivery', labelAr:'طريقة التسليم', type:'select' as const, options:['فوري (دقائق)','خلال 24 ساعة','يدوي'] },
      { key:'warranty', label:'Warranty', labelAr:'الضمان', type:'select' as const, options:['ضمان مدى الحياة','12 شهر','6 أشهر','بدون ضمان'] },
      { key:'region', label:'Region', labelAr:'المنطقة', type:'select' as const, options:['عالمي','الجزائر','أوروبا','أمريكا','الشرق الأوسط'] },
    ],
    variantConfig: {
      hasColor: false,
      hasSize: false,
      sizeOptions: [],
      colorPresets: [],
    },
    isPreset: true
  },
  // ─── General / Generic store (DEFAULT for all new merchants) ──────────────
  // This preset is what every NEW store starts with if they don't pick
  // a specialized domain. It's intentionally neutral so the merchant
  // doesn't see jewelry/fashion/beauty content that doesn't match what
  // they actually sell.
  {
    id: 'domain_general',
    name: 'Amugar Store',
    nameAr: 'Amugar Store',
    descriptionAr: 'متجر عام — أضف منتجاتك وابدأ البيع. يمكنك تخصيص النمط من لوحة التحكم.',
    heroBadge: 'متجرك • 2026',
    heroTitleAr: 'مرحباً بك في متجرك',
    heroSubtitleAr: 'أضف منتجاتك الأولى وابدأ البيع. الدفع عند الاستلام، توصيل لكل الولايات، لوحة تحكم احترافية.',
    heroImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1400&q=80',
    footerDescriptionAr: 'متجر جزائري بمنتجات متنوعة. الدفع عند الاستلام في 69 ولاية، جودة مضمونة وخدمة سريعة.',
    categories: [
      { key: 'general', label: 'General', labelAr: 'عام' },
    ],
    attributeSchema: [],
    variantConfig: {
      hasColor: false,
      hasSize: false,
      sizeOptions: [],
      colorPresets: [],
    },
    isPreset: true
  }
]

export const seedProducts: Product[] = [
  // —— JEWELRY (8) ——
  {
    _id: "prod_001", sku: "LUM-N-001", domainId: "domain_jewelry",
    name: "Aurore Necklace", nameAr: "قلادة أورور الذهبية",
    description: "18k gold plated necklace with natural freshwater pearls, handcrafted in limited edition.",
    descriptionAr: "قلادة مطلية بذهب 18 قيراط مرصعة بلؤلؤ طبيعي، صناعة يدوية بإصدار محدود. هدية مثالية للمناسبات الراقية.",
    price: 6800, compareAtPrice: 8900,
    images: ["https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80", "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80", "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80"],
    category: "necklace", material: "18k Gold Plated + Pearl", materialAr: "ذهب 18ق + لؤلؤ طبيعي",
    rating: 4.9, reviewsCount: 312, stock: 34, isFeatured: true, isNew: true,
    attributes: { plating:'ذهب 18ق', stone:'لؤلؤ طبيعي', weight:'12.5', warranty:'12 شهر' },
    variants: [
      { id:'v1', color:'ذهبي', colorAr:'ذهبي', colorHex:'#D4AF37', size:'قابل للتعديل', stock: 20, priceAdjustment:0 },
      { id:'v2', color:'فضي', colorAr:'فضي', colorHex:'#C0C0C0', size:'قابل للتعديل', stock: 14, priceAdjustment:0 },
    ],
    tierPricing: [{minQty:2,discountPercent:10,label:"Duo Offer",labelAr:"عرض الثنائي"},{minQty:3,discountPercent:18,label:"Trio Luxe",labelAr:"عرض الثلاثي الفاخر"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_002", sku: "LUM-R-002", domainId: "domain_jewelry",
    name: "Étoile Ring", nameAr: "خاتم نجمة الليل",
    description: "Adjustable emerald cut zircon ring with pavé halo, tarnish resistant.",
    descriptionAr: "خاتم قابل للتعديل بقطع الزمرد وزركون فاخر مع هالة مرصعة، مقاوم للتصبغ ويدوم لمعانه.",
    price: 4200, compareAtPrice: 5500,
    images: ["https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=80", "https://images.unsplash.com/photo-1603561596112-0a132b757442?w=800&q=80"],
    category: "ring", material: "925 Silver + Zircon", materialAr: "فضة 925 + زركون",
    rating: 4.8, reviewsCount: 198, stock: 52, isFeatured: true, isNew: false,
    attributes: { plating:'فضة 925', stone:'زركون AAA', weight:'6.2', warranty:'12 شهر' },
    variants: [
      { id:'v1', color:'فضي', colorAr:'فضي', colorHex:'#C0C0C0', size:'6', stock: 15 },
      { id:'v2', color:'فضي', colorAr:'فضي', colorHex:'#C0C0C0', size:'7', stock: 18 },
      { id:'v3', color:'ذهبي', colorAr:'ذهبي', colorHex:'#D4AF37', size:'7', stock: 12 },
      { id:'v4', color:'ذهبي', colorAr:'ذهبي', colorHex:'#D4AF37', size:'8', stock: 7 },
    ],
    tierPricing: [{minQty:2,discountPercent:12,labelAr:"خصم الثنائي",label:"duo"},{minQty:4,discountPercent:20,labelAr:"عرض الصديقات",label:"squad"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_003", sku: "LUM-E-003", domainId: "domain_jewelry",
    name: "Lune Earrings", nameAr: "أقراط قمر لومييير",
    description: "Lightweight gold hoop earrings with dangling baroque pearls.",
    descriptionAr: "أقراط حلقية ذهبية خفيفة الوزن مع لؤلؤ باروكي متدلٍ، أناقة يومية بلمسة فرنسية.",
    price: 3900, compareAtPrice: 4900,
    images: ["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80", "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=800&q=80"],
    category: "earring", material: "Gold Plated Brass", materialAr: "نحاس مطلي ذهب",
    rating: 4.9, reviewsCount: 267, stock: 41, isFeatured: true, isNew: false,
    attributes: { plating:'ذهب 18ق', stone:'لؤلؤ طبيعي', weight:'8', warranty:'12 شهر' },
    tierPricing: [{minQty:2,discountPercent:15,labelAr:"اثنين بسعر مميز",label:"duo"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_004", sku: "LUM-B-004", domainId: "domain_jewelry",
    name: "Riviera Bracelet", nameAr: "سوار الريفييرا المرصع",
    description: "Tennis bracelet with 3A cubic zirconia, secure box clasp.",
    descriptionAr: "سوار تنس فاخر مرصع بزركونيا AAA مع قفل آمن، لمعان ألماسي بدون سعر الألماس.",
    price: 7500, compareAtPrice: 9900,
    images: ["https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80", "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=800&q=80"],
    category: "bracelet", material: "Rhodium Plated", materialAr: "مطلي روديوم",
    rating: 5.0, reviewsCount: 88, stock: 22, isFeatured: true, isNew: true,
    tierPricing: [{minQty:2,discountPercent:10,labelAr:"عرض الثنائي",label:"duo"},{minQty:3,discountPercent:22,labelAr:"بوكس الهدايا",label:"gift"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_005", sku: "LUM-N-005", domainId: "domain_jewelry",
    name: "Celeste Choker", nameAr: "طوق سيليست الملكي",
    description: "Minimalist choker with central solitaire, perfect layering piece.",
    descriptionAr: "طوق عنق ناعم بحجر سوليتير مركزي، مثالي للتنسيق مع قلادات أخرى.",
    price: 2900,
    images: ["https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=800&q=80", "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80"],
    category: "necklace", material: "14k Gold Filled", materialAr: "ذهب 14ق",
    rating: 4.7, reviewsCount: 143, stock: 60, isFeatured: false, isNew: false,
    tierPricing: [{minQty:3,discountPercent:18,labelAr:"عرض 3 قطع",label:"3pcs"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_006", sku: "LUM-R-006", domainId: "domain_jewelry",
    name: "Noir Twist Ring", nameAr: "خاتم الملتوي الأسود",
    description: "Modern intertwined band with black onyx and gold.",
    descriptionAr: "خاتم عصري ملتوٍ يجمع بين العقيق الأسود والذهب، تصميم جريء وأنيق.",
    price: 5100, compareAtPrice: 6800,
    images: ["https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=80", "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80"],
    category: "ring", material: "Black Onyx + Gold", materialAr: "عقيق + ذهب",
    rating: 4.8, reviewsCount: 97, stock: 18, isFeatured: false, isNew: true,
    tierPricing: [{minQty:2,discountPercent:10,labelAr:"خصم",label:"duo"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_007", sku: "LUM-E-007", domainId: "domain_jewelry",
    name: "Dahlia Studs", nameAr: "أقراط داليا اللؤلؤية",
    description: "Floral pearl studs with mother-of-pearl petals.",
    descriptionAr: "أقراط مسمارية بشكل زهرة من اللؤلؤ وعرق اللؤلؤ، نعومة وأنوثة.",
    price: 2600,
    images: ["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80", "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800&q=80"],
    category: "earring", material: "Pearl + MOP", materialAr: "لؤلؤ + صدف",
    rating: 4.6, reviewsCount: 201, stock: 44, isFeatured: false, isNew: false,
    tierPricing: [{minQty:2,discountPercent:12,labelAr:"اثنين",label:"2"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_008", sku: "LUM-B-008", domainId: "domain_jewelry",
    name: "Mira Mesh Bracelet", nameAr: "سوار ميرا الشبكي",
    description: "Italian mesh bracelet with magnetic clasp, adjustable.",
    descriptionAr: "سوار شبكي إيطالي بقفل مغناطيسي قابل للتعديل، خفيف ومريح للارتداء اليومي.",
    price: 3400,
    images: ["https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80", "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=800&q=80"],
    category: "bracelet", material: "Stainless Steel Gold", materialAr: "ستانلس ذهبي",
    rating: 4.7, reviewsCount: 76, stock: 30, isFeatured: true, isNew: false,
    tierPricing: [{minQty:2,discountPercent:15,labelAr:"عرض",label:"duo"}],
    createdAt: new Date().toISOString()
  },
  // —— FASHION (6) ——
  {
    _id: "prod_101", sku: "LUM-D-101", domainId: "domain_fashion",
    name: "Velours Abaya", nameAr: "عباءة فيلور ملكية",
    description: "Velvet abaya with subtle embroidery, flowing cut.",
    descriptionAr: "عباءة مخملية بتطريز ناعم وقصّة انسيابية، دفء وأناقة للسهرات الشتوية.",
    price: 8900, compareAtPrice: 11900,
    images: ["https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=800&q=80", "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80"],
    category: "abaya", material: "Velvet + Embroidery", materialAr: "مخمل + تطريز",
    rating: 4.9, reviewsCount: 124, stock: 48, isFeatured: true, isNew: true,
    attributes: { fabricAr:'مخمل', fit:'انسيابي', length:'طويل', season:'شتاء', care:'غسيل يدوي' },
    variants: [
      { id:'v101-1', color:'أسود', colorAr:'أسود', colorHex:'#1A1A1E', size:'S', stock: 6 },
      { id:'v101-2', color:'أسود', colorAr:'أسود', colorHex:'#1A1A1E', size:'M', stock: 8 },
      { id:'v101-3', color:'أسود', colorAr:'أسود', colorHex:'#1A1A1E', size:'L', stock: 6 },
      { id:'v101-4', color:'أسود', colorAr:'أسود', colorHex:'#1A1A1E', size:'XL', stock: 5 },
      { id:'v101-5', color:'خمري', colorAr:'خمري', colorHex:'#7A1F44', size:'M', stock: 7 },
      { id:'v101-6', color:'خمري', colorAr:'خمري', colorHex:'#7A1F44', size:'L', stock: 6 },
      { id:'v101-7', color:'كحلي', colorAr:'كحلي', colorHex:'#1E3A5F', size:'M', stock: 5 },
      { id:'v101-8', color:'كحلي', colorAr:'كحلي', colorHex:'#1E3A5F', size:'XL', stock: 5 },
    ],
    tierPricing: [{minQty:2,discountPercent:15,label:"Duo Mode",labelAr:"عرض الثنائي"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_102", sku: "LUM-D-102", domainId: "domain_fashion",
    name: "Soirée Dress", nameAr: "فستان سهرة ساتان",
    description: "Satin evening dress with cowl neckline, side slit.",
    descriptionAr: "فستان ساتان بقصة ياقة ملتفة وفتحة جانبية، لمعان راقٍ للمناسبات.",
    price: 12500, compareAtPrice: 16000,
    images: ["https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80", "https://images.unsplash.com/photo-1515372039744-f1fd71e2a961?w=800&q=80"],
    category: "dress", material: "Satin Silk", materialAr: "ساتان حريري",
    rating: 4.8, reviewsCount: 89, stock: 30, isFeatured: true, isNew: true,
    attributes: { fabricAr:'ساتان', fit:'ضيق', length:'ماكسي', season:'كل المواسم', care:'تنظيف جاف' },
    variants: [
      { id:'v102-1', color:'أسود', colorAr:'أسود', colorHex:'#1A1A1E', size:'S', stock:5 },
      { id:'v102-2', color:'أسود', colorAr:'أسود', colorHex:'#1A1A1E', size:'M', stock:6 },
      { id:'v102-3', color:'خمري', colorAr:'خمري', colorHex:'#7A1F44', size:'M', stock:5 },
      { id:'v102-4', color:'بيج', colorAr:'بيج', colorHex:'#D2B48C', size:'L', stock:4 },
      { id:'v102-5', color:'بيج', colorAr:'بيج', colorHex:'#D2B48C', size:'XL', stock:4 },
      { id:'v102-6', color:'كحلي', colorAr:'كحلي', colorHex:'#1E3A5F', size:'M', stock:6 },
    ],
    tierPricing: [{minQty:2,discountPercent:12,labelAr:"عرض الفستانين",label:"duo"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_103", sku: "LUM-H-103", domainId: "domain_fashion",
    name: "Soie Hijab", nameAr: "حجاب حرير لومييير",
    description: "Silk hijab with soft sheen, hand-rolled edges.",
    descriptionAr: "حجاب حريري لامع بحواف ملفوفة يدوياً، خفيف وثابت طوال اليوم.",
    price: 2600, compareAtPrice: 3500,
    images: ["https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80", "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&q=80"],
    category: "hijab", material: "Silk", materialAr: "حرير",
    rating: 4.9, reviewsCount: 210, stock: 90, isFeatured: true, isNew: false,
    attributes: { fabricAr:'حرير', fit:'عادي', season:'كل المواسم' },
    variants: [
      { id:'v103-1', color:'أسود', colorAr:'أسود', colorHex:'#1A1A1E', size:'مقاس موحد', stock:15 },
      { id:'v103-2', color:'بيج', colorAr:'بيج', colorHex:'#D2B48C', size:'مقاس موحد', stock:15 },
      { id:'v103-3', color:'خمري', colorAr:'خمري', colorHex:'#7A1F44', size:'مقاس موحد', stock:15 },
      { id:'v103-4', color:'زيتوني', colorAr:'زيتوني', colorHex:'#6B7B5E', size:'مقاس موحد', stock:15 },
      { id:'v103-5', color:'كحلي', colorAr:'كحلي', colorHex:'#1E3A5F', size:'مقاس موحد', stock:15 },
      { id:'v103-6', color:'أبيض', colorAr:'أبيض', colorHex:'#FFFFFF', size:'مقاس موحد', stock:15 },
    ],
    tierPricing: [{minQty:3,discountPercent:18,labelAr:"بوكس 3 حجابات",label:"trio"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_104", sku: "LUM-B-104", domainId: "domain_fashion",
    name: "Coco Bag", nameAr: "حقيبة كوكو الجلدية",
    description: "Quilted leather bag with chain strap, iconic shape.",
    descriptionAr: "حقيبة جلدية مبطنة بسلسلة ذهبية، تصميم أيقوني يتسع لكل أساسياتك.",
    price: 7400, compareAtPrice: 9800,
    images: ["https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80", "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80"],
    category: "bag", material: "Genuine Leather", materialAr: "جلد طبيعي",
    rating: 4.8, reviewsCount: 67, stock: 22, isFeatured: true, isNew: false,
    tierPricing: [{minQty:2,discountPercent:10,labelAr:"حقيبتان",label:"duo"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_105", sku: "LUM-S-105", domainId: "domain_fashion",
    name: "Nuage Sneakers", nameAr: "حذاء نيواج المريح",
    description: "Chunky sneakers with cloud-light sole.",
    descriptionAr: "حذاء رياضي بكعب سميك ونعل خفيف كالسحاب، راحة وأناقة يومية.",
    price: 6200, compareAtPrice: 7900,
    images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80", "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&q=80"],
    category: "shoes", material: "Mesh + Rubber", materialAr: "شبك + مطاط",
    rating: 4.7, reviewsCount: 98, stock: 42, isFeatured: false, isNew: true,
    attributes: { fabricAr:'شبك', season:'كل المواسم' },
    variants: [
      { id:'v105-1', color:'أبيض', colorAr:'أبيض', colorHex:'#FFFFFF', size:'37', stock:6 },
      { id:'v105-2', color:'أبيض', colorAr:'أبيض', colorHex:'#FFFFFF', size:'38', stock:6 },
      { id:'v105-3', color:'أبيض', colorAr:'أبيض', colorHex:'#FFFFFF', size:'40', stock:6 },
      { id:'v105-4', color:'أسود', colorAr:'أسود', colorHex:'#1A1A1E', size:'38', stock:6 },
      { id:'v105-5', color:'أسود', colorAr:'أسود', colorHex:'#1A1A1E', size:'40', stock:6 },
      { id:'v105-6', color:'بيج', colorAr:'بيج', colorHex:'#D2B48C', size:'39', stock:6 },
      { id:'v105-7', color:'بيج', colorAr:'بيج', colorHex:'#D2B48C', size:'40', stock:6 },
    ],
    tierPricing: [{minQty:2,discountPercent:12,labelAr:"زوجان",label:"duo"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_106", sku: "LUM-D-106", domainId: "domain_fashion",
    name: "Caelis Dress", nameAr: "فستان كايليس الزهري",
    description: "Floral midi dress with puff sleeves.",
    descriptionAr: "فستان ميدي مزهر بأكمام منفوخة، منعش لفصل الربيع.",
    price: 5800,
    images: ["https://images.unsplash.com/photo-1515372039744-f1fd71e2a961?w=800&q=80", "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80"],
    category: "dress", material: "Cotton Floral", materialAr: "قطن مزهر",
    rating: 4.6, reviewsCount: 54, stock: 26, isFeatured: false, isNew: false,
    attributes: { fabricAr:'قطن', fit:'واسع', length:'ميدي', season:'ربيع' },
    variants: [
      { id:'v106-1', color:'زهري', colorAr:'زهري', colorHex:'#E8B4B8', size:'S', stock:5 },
      { id:'v106-2', color:'زهري', colorAr:'زهري', colorHex:'#E8B4B8', size:'M', stock:7 },
      { id:'v106-3', color:'زهري', colorAr:'زهري', colorHex:'#E8B4B8', size:'L', stock:6 },
      { id:'v106-4', color:'زهري', colorAr:'زهري', colorHex:'#E8B4B8', size:'XL', stock:8 },
    ],
    tierPricing: [{minQty:2,discountPercent:15,labelAr:"عرض",label:"duo"}],
    createdAt: new Date().toISOString()
  },
  // —— BEAUTY (4) ——
  {
    _id: "prod_201", sku: "LUM-P-201", domainId: "domain_beauty",
    name: "Rose Nuit Parfum", nameAr: "عطر روز نوي",
    description: "Niche rose-oud perfume, long lasting 12h.",
    descriptionAr: "عطر نيش ورد وعود يدوم 12 ساعة، رشة واحدة تكفي.",
    price: 7900, compareAtPrice: 10500,
    images: ["https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80", "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80"],
    category: "perfume", material: "Eau de Parfum 50ml", materialAr: "عطر 50مل",
    rating: 4.9, reviewsCount: 203, stock: 28, isFeatured: true, isNew: true,
    attributes: { volume:'50مل', scent:'عود', skinType:'كل الأنواع', expiry:'36 شهر' },
    variants: [
      { id:'v201-1', size:'30مل', stock: 10, priceAdjustment: -1500 },
      { id:'v201-2', size:'50مل', stock: 12, priceAdjustment: 0 },
      { id:'v201-3', size:'100مل', stock: 6, priceAdjustment: 2200 },
    ],
    tierPricing: [{minQty:2,discountPercent:18,labelAr:"بوكس العطور",label:"duo"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_202", sku: "LUM-M-202", domainId: "domain_beauty",
    name: "Velvet Lip Kit", nameAr: "طقم شفاه فيلفيت",
    description: "Liquid lipstick + lip liner, transferproof.",
    descriptionAr: "أحمر شفاه سائل + قلم تحديد، ثابت ضد النقل طوال اليوم.",
    price: 3400, compareAtPrice: 4200,
    images: ["https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80", "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80"],
    category: "makeup", material: "Velvet Matte", materialAr: "مخملي مطفي",
    rating: 4.8, reviewsCount: 156, stock: 40, isFeatured: true, isNew: false,
    attributes: { finish:'مطفي', skinType:'كل الأنواع' },
    variants: [
      { id:'v202-1', color:'نيود 01', colorAr:'نيود 01', colorHex:'#E8C4B0', stock:10 },
      { id:'v202-2', color:'وردي 02', colorAr:'وردي 02', colorHex:'#D4A5A5', stock:10 },
      { id:'v202-3', color:'أحمر 03', colorAr:'أحمر 03', colorHex:'#A02A5B', stock:12 },
      { id:'v202-4', color:'بني 04', colorAr:'بني 04', colorHex:'#8B5A3C', stock:8 },
    ],
    tierPricing: [{minQty:2,discountPercent:15,labelAr:"اثنين",label:"duo"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_203", sku: "LUM-S-203", domainId: "domain_beauty",
    name: "Glow Serum", nameAr: "سيروم إشراقة لومييير",
    description: "Vitamin C + Hyaluronic serum, brightening.",
    descriptionAr: "سيروم فيتامين C وهيالورونيك، يوحّد اللون ويمنح نضارة فورية.",
    price: 4100, compareAtPrice: 5400,
    images: ["https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80", "https://images.unsplash.com/photo-1570554886111-e0fc97bd5438?w=800&q=80"],
    category: "skincare", material: "Serum 30ml", materialAr: "سيروم 30مل",
    rating: 4.9, reviewsCount: 178, stock: 35, isFeatured: false, isNew: true,
    attributes: { volume:'30مل', skinType:'كل الأنواع' },
    tierPricing: [{minQty:2,discountPercent:12,labelAr:"عرض العناية",label:"duo"}],
    createdAt: new Date().toISOString()
  },
  {
    _id: "prod_204", sku: "LUM-H-204", domainId: "domain_beauty",
    name: "Argan Hair Oil", nameAr: "زيت الأرغان المغربي",
    description: "Pure argan oil for shine and repair.",
    descriptionAr: "زيت أرغان نقي للمعان وإصلاح التقصف، قطرات تكفي.",
    price: 2900,
    images: ["https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80", "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&q=80"],
    category: "hair", material: "Argan Oil 100ml", materialAr: "زيت أرغان 100مل",
    rating: 4.7, reviewsCount: 92, stock: 50, isFeatured: false, isNew: false,
    tierPricing: [{minQty:2,discountPercent:10,labelAr:"زجاجتان",label:"duo"}],
    createdAt: new Date().toISOString()
  }
]

export const seedWilayas: WilayaRate[] = [
  { _id:"w16", code:"16", name:"Alger", nameAr:"الجزائر العاصمة", deliveryHome:600, deliveryDesk:400, isActive:true, deliveryDays:"24-48 ساعة" },
  { _id:"w31", code:"31", name:"Oran", nameAr:"وهران", deliveryHome:600, deliveryDesk:400, isActive:true, deliveryDays:"24-48 ساعة" },
  { _id:"w25", code:"25", name:"Constantine", nameAr:"قسنطينة", deliveryHome:700, deliveryDesk:450, isActive:true, deliveryDays:"48 ساعة" },
  { _id:"w06", code:"06", name:"Bejaia", nameAr:"بجاية", deliveryHome:700, deliveryDesk:450, isActive:true, deliveryDays:"48 ساعة" },
  { _id:"w09", code:"09", name:"Blida", nameAr:"البليدة", deliveryHome:600, deliveryDesk:400, isActive:true, deliveryDays:"24-48 ساعة" },
  { _id:"w15", code:"15", name:"Tizi Ouzou", nameAr:"تيزي وزو", deliveryHome:700, deliveryDesk:500, isActive:true, deliveryDays:"48 ساعة" },
  { _id:"w19", code:"19", name:"Setif", nameAr:"سطيف", deliveryHome:700, deliveryDesk:450, isActive:true, deliveryDays:"48 ساعة" },
  { _id:"w13", code:"13", name:"Tlemcen", nameAr:"تلمسان", deliveryHome:800, deliveryDesk:550, isActive:true, deliveryDays:"48-72 ساعة" },
  { _id:"w23", code:"23", name:"Annaba", nameAr:"عنابة", deliveryHome:750, deliveryDesk:500, isActive:true, deliveryDays:"48 ساعة" },
  { _id:"w22", code:"22", name:"Sidi Bel Abbes", nameAr:"سيدي بلعباس", deliveryHome:800, deliveryDesk:550, isActive:true, deliveryDays:"48-72 ساعة" },
  { _id:"w35", code:"35", name:"Boumerdes", nameAr:"بومرداس", deliveryHome:600, deliveryDesk:400, isActive:true, deliveryDays:"24-48 ساعة" },
  { _id:"w42", code:"42", name:"Tipaza", nameAr:"تيبازة", deliveryHome:600, deliveryDesk:400, isActive:true, deliveryDays:"24-48 ساعة" },
  { _id:"w04", code:"04", name:"Oum El Bouaghi", nameAr:"أم البواقي", deliveryHome:850, deliveryDesk:600, isActive:true, deliveryDays:"72 ساعة" },
  { _id:"w05", code:"05", name:"Batna", nameAr:"باتنة", deliveryHome:850, deliveryDesk:600, isActive:true, deliveryDays:"48-72 ساعة" },
  { _id:"w10", code:"10", name:"Bouira", nameAr:"البويرة", deliveryHome:700, deliveryDesk:500, isActive:true, deliveryDays:"48 ساعة" },
  { _id:"w18", code:"18", name:"Jijel", nameAr:"جيجل", deliveryHome:750, deliveryDesk:500, isActive:true, deliveryDays:"48-72 ساعة" },
  { _id:"w30", code:"30", name:"Ouargla", nameAr:"ورقلة", deliveryHome:1000, deliveryDesk:750, isActive:true, deliveryDays:"72-96 ساعة" },
  { _id:"w47", code:"47", name:"Ghardaia", nameAr:"غرداية", deliveryHome:950, deliveryDesk:700, isActive:true, deliveryDays:"72 ساعة" },
  { _id:"w45", code:"45", name:"Naama", nameAr:"النعامة", deliveryHome:1100, deliveryDesk:800, isActive:true, deliveryDays:"72-96 ساعة" },
  { _id:"w33", code:"33", name:"Illizi", nameAr:"إليزي", deliveryHome:1200, deliveryDesk:900, isActive:true, deliveryDays:"4-5 أيام" },
  { _id:"w01", code:"01", name:"Adrar", nameAr:"أدرار", deliveryHome:1200, deliveryDesk:900, isActive:true, deliveryDays:"4-5 أيام" },
  { _id:"w07", code:"07", name:"Biskra", nameAr:"بسكرة", deliveryHome:900, deliveryDesk:650, isActive:true, deliveryDays:"72 ساعة" },
  { _id:"w29", code:"29", name:"Mascara", nameAr:"معسكر", deliveryHome:750, deliveryDesk:500, isActive:true, deliveryDays:"48 ساعة" },
  { _id:"w02", code:"02", name:"Chlef", nameAr:"الشلف", deliveryHome:650, deliveryDesk:400, isActive:true, deliveryDays:"48 ساعة" },
  { _id:"w03", code:"03", name:"Laghouat", nameAr:"الأغواط", deliveryHome:900, deliveryDesk:650, isActive:true, deliveryDays:"72 ساعة" },
  { _id:"w08", code:"08", name:"Bechar", nameAr:"بشار", deliveryHome:1100, deliveryDesk:800, isActive:true, deliveryDays:"72-96 ساعة" },
  { _id:"w27", code:"27", name:"Mostaganem", nameAr:"مستغانم", deliveryHome:650, deliveryDesk:400, isActive:true, deliveryDays:"48 ساعة" },
  { _id:"w41", code:"41", name:"Souk Ahras", nameAr:"سوق أهراس", deliveryHome:850, deliveryDesk:600, isActive:true, deliveryDays:"72 ساعة" },
]

export const defaultSettings: StoreSettings = {
  metaPixelId: "123456789012345",
  tiktokPixelId: "C1234567890ABCDEF",
  storeName: "Amugar",
  storeNameAr: "Amugar",
  currency: "د.ج",
  enableCod: true,
  phone: "0550 12 34 56",
  whatsapp: "213550123456",
  email: "contact@amugar.dz",
  announcement: "توصيل سريع لـ 69 ولاية • الدفع عند الاستلام • جودة مضمونة",
  freeShippingThreshold: 15000,
  heroTitleAr: "منتجات تُبرز أناقتك",
  heroSubtitleAr: "تشكيلة 2026 بجودة عالية وأسعار منافسة. تصميم عصري، تسليم جزائري سريع والدفع عند الاستلام.",
  heroBadge: "COLLECTION 2026 • ÉDITION LIMITÉE",
  footerDescriptionAr: "متجر جزائري بلمسة عصرية. منتجات بجودة عالية، مقاومة ومتينة. الدفع عند الاستلام في 69 ولاية.",
  instagram: "@amugar.dz",
  enableRoseEdition: true,
  activeDomainId: "domain_general",

  // WhatsApp floating button (default: enabled)
  whatsappButtonEnabled: true,
  whatsappMessage: "مرحباً، أريد الاستفسار عن منتج",
  whatsappPosition: "left",

  // Delivery integrations (default: disabled, empty credentials)
  // LEGACY flat fields kept for backwards-compat with older clients
  yalidineEnabled: false,
  yalidineApiId: "",
  yalidineApiToken: "",
  zrExpressEnabled: false,
  zrExpressApiKey: "",
  zrExpressApiSecret: "",
  // CANONICAL — populated by seed-runner using `defaultDeliveryProviders()`
  // so the registry is the single source of truth.
  deliveryProviders: [],

  // Theme Colors
  primaryColor: "#C9A96A",
  secondaryColor: "#1A1A1E",
  bgColor: "#FFFCF8",
  cardBgColor: "#FFFFFF",
  textColor: "#1A1A1E",
  accentColor: "#A02A5B",

  // Customizable storefront texts
  editorialTitle: "جودة تلمس، أسعار تناسبك",
  editorialText1: "جودة عالية تدوم طويلاً مع ضمان الاسترجاع 14 يوم.",
  editorialText2: "خامات مختارة بعناية، تصميم عملي ومريح للاستعمال اليومي.",
  review1Name: "سارة - الجزائر",
  review1Text: "وصلني في 24 ساعة، الجودة ممتازة والتغليف فخم جداً!",
  review2Name: "أمينة - وهران",
  review2Text: "خدمة رائعة، اتصلوا بي للتأكيد وأعطوني نصائح للحفاظ على الجودة.",
  review3Name: "نور - قسنطينة",
  review3Text: "أخذت عرض 3 قطع ووفّرت 18%، الجودة ممتازة والسعر معقول."
}
