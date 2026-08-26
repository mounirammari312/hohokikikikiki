import { Link, useLocation } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import { ArrowLeft, Truck, ShieldCheck, BadgeCheck, Sparkles, Star, Package } from 'lucide-react'
import { motion } from 'framer-motion'
import ProductCard from '../components/ProductCard'
import { SmartImage } from '../components/SmartImage'
import { getProducts, syncProducts } from '../services/api/products'
import { getSettings, subscribeSettings, syncSettings } from '../services/api/settings'
import { getActiveDomain } from '../services/api/domains'
import { trackVisit } from '../services/api/client'
import { useEffect, useState } from 'react'
import { formatDZD } from '../lib/utils'
import { getCategoryIcon3d } from '../components/marketplace/CategoriesCircle'

// ─── Smart category image: picks a product image from that category ────────
function getCategoryImage(catKey: string, products: any[]): string {
  const productInCat = products.find(p => p.category === catKey && p.images?.[0])
  if (productInCat) return productInCat.images[0]
  return ''
}

// Reusable fade-up wrapper for scroll-reveal animations.
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
})

export default function Home() {
  const { storeSlug, storeId } = useTenant()
  const location = useLocation()
  const urlParams = new URLSearchParams(location.search)
  const activeSlug = storeSlug || urlParams.get('store')
  const activeId = storeId || urlParams.get('storeId')
  const storeQuery = activeSlug ? `?store=${encodeURIComponent(activeSlug)}` : (activeId ? `?storeId=${encodeURIComponent(activeId)}` : '')

  const [products, setProducts] = useState(() => getProducts())
  const [store, setStore] = useState(() => getSettings())
  const [domain, setDomain] = useState(() => getActiveDomain())

  const featuredAll = products.filter(p => p.isFeatured)
  const domainCats = new Set(domain.categories.map(c => c.key))
  const featured = (() => {
    const match = featuredAll.filter(p => domainCats.has(p.category))
    if (match.length > 0) return match
    if (featuredAll.length > 0) return featuredAll
    return products.slice(0, 8)
  })()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

    void syncSettings().then(s => {
      if (s) {
        setStore(s)
        setDomain(getActiveDomain())
      }
    }).catch(() => {})

    void syncProducts().then(fresh => {
      if (fresh && fresh.length > 0) {
        setProducts(fresh)
      } else {
        setProducts([...getProducts()])
      }
    }).catch(() => {})

    const s = getSettings()
    const urlParams = new URLSearchParams(window.location.search)
    const sid = s.storeId || s._id || urlParams.get('storeId') || ''
    if (sid) trackVisit(sid, 'store')
  }, [])

  useEffect(() => {
    const unsub = subscribeSettings(() => {
      setStore(getSettings())
      setDomain(getActiveDomain())
    })
    return unsub
  }, [])

  const countByCat = (key: string) => products.filter(p => p.category === key).length
  const primary = store.primaryColor || 'var(--color-primary)'
  const secondary = store.secondaryColor || 'var(--color-secondary)'
  const textColor = store.textColor || 'var(--color-text)'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══ HERO ═══════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-3 md:px-6 pt-4 md:pt-6">
        <motion.div {...fadeUp(0)} className="relative rounded-2xl overflow-hidden min-h-[280px] md:min-h-[400px] flex">
          {/* Hero background — real product image or domain hero image */}
          <SmartImage
            src={products[0]?.images?.[0] || domain.heroImage}
            alt={domain.heroTitleAr}
            size="hero"
            eager
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Soft cinematic gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-l from-slate-950/85 via-slate-950/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />

          {/* Floating trust badge (desktop) */}
          <div className="absolute top-4 right-4 z-20 hidden md:flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-3 py-1.5 text-xs font-bold text-white">
            <span className="text-[10px] font-extrabold leading-none tracking-tight">DZ</span>
            <span>صنع في الجزائر</span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span className="text-emerald-400">COD</span>
          </div>

          <div className="relative z-10 p-5 md:p-10 flex flex-col justify-center max-w-[560px]">
            <span className="inline-flex w-fit items-center gap-2 bg-white/10 backdrop-blur border border-white/20 text-white rounded-full px-3 py-1 text-xs tracking-widest">
              {domain.heroBadge}
            </span>
            <h1 className="text-2xl md:text-4xl font-extrabold leading-tight text-white mt-3" style={{ whiteSpace: 'pre-line' }}>
              {domain.heroTitleAr}
            </h1>
            <p className="text-white/80 mt-3 leading-6 text-sm md:text-base line-clamp-2">{domain.heroSubtitleAr}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Link
                to={`/shop${storeQuery}`}
                className="bg-white text-slate-900 px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-sm hover:bg-slate-100 transition"
              >
                تسوّق الآن <ArrowLeft size={14} />
              </Link>
              <a
                href="#collection"
                className="bg-white/10 backdrop-blur border border-white/20 text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-white/20 transition"
              >
                اكتشف الكولكشن
              </a>
            </div>
            <div className="flex items-center gap-4 mt-4 text-white/80 text-xs">
              <span className="flex items-center gap-1.5">
                <BadgeCheck size={14} className="text-emerald-400" /> 4.9/5 (1.2k تقييم)
              </span>
              <span className="flex items-center gap-1.5">
                <Truck size={14} className="text-emerald-400" /> توصيل 58 ولاية • مجاني فوق {formatDZD(store.freeShippingThreshold)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ═══ TRUST BAR — slim, neutral ═══════════════════════════ */}
        <motion.div {...fadeUp(0.05)} className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          {[
            { icon: Truck, t: 'توصيل سريع', d: '24-96 ساعة', accent: false },
            { icon: ShieldCheck, t: 'الدفع عند الاستلام', d: store.enableCod ? 'ادفع عند الوصول' : 'متوقف', accent: true },
            { icon: BadgeCheck, t: 'ضمان 12 شهر', d: 'استرجاع 14 يوم', accent: false },
            { icon: Sparkles, t: 'تغليف هدية', d: `علبة ${store.storeName} فاخرة`, accent: false },
          ].map(c => (
            <div
              key={c.t}
              className="bg-white border border-slate-200/80 rounded-xl px-3 py-2.5 flex items-center gap-2.5 hover:border-slate-300 transition"
            >
              <div
                className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${
                  c.accent ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-700'
                }`}
              >
                <c.icon size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate leading-tight">{c.t}</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">{c.d}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ═══ CATEGORIES ══════════════════════════════════════════════ */}
      <section id="collection" className="max-w-[1280px] mx-auto px-3 md:px-6 mt-8 md:mt-10">
        <motion.div {...fadeUp(0)} className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">تسوّق حسب الفئة</h2>
            <p className="text-xs text-slate-500 mt-0.5">{domain.nameAr} • {domain.categories.length} فئات</p>
          </div>
          <Link
            to={`/shop${storeQuery}`}
            className="hidden md:inline-flex text-sm font-bold text-slate-700 hover:text-slate-900 border border-slate-200 rounded-full px-4 py-2 bg-white hover:bg-slate-50 transition"
          >
            عرض الكل
          </Link>
        </motion.div>

        <motion.div
          {...fadeUp(0.08)}
          className={`grid gap-3 ${domain.categories.length <= 3 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}
        >
          {domain.categories.filter(c => countByCat(c.key) > 0).map((c, i) => (
            <motion.div key={c.key} {...fadeUp(0.05 * i)} className="contents">
              <Link
                to={`/shop?cat=${c.key}${storeQuery ? `&${storeQuery.slice(1)}` : ''}`}
                className="group relative rounded-xl overflow-hidden h-[180px] bg-slate-900"
              >
                {(() => {
                  const catImg = getCategoryImage(c.key, products)
                  if (catImg) {
                    return (
                      <div className="absolute inset-0">
                        <img src={catImg} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" alt={c.labelAr} />
                      </div>
                    )
                  }
                  return (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 grid place-items-center">
                      <Package size={48} className="text-slate-300" />
                    </div>
                  )
                })()}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                {/* 3D category icon (top-left) */}
                <img
                  src={getCategoryIcon3d(c.key)}
                  alt=""
                  loading="lazy"
                  className="absolute top-2 left-2 z-10 w-8 h-8 object-contain drop-shadow-md pointer-events-none select-none"
                  draggable={false}
                />
                {/* Product count badge (top-right) */}
                <span className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur text-slate-900 text-[10px] font-bold px-2 py-1 rounded-full">
                  {countByCat(c.key)} منتج
                </span>
                <div className="absolute bottom-2 right-2 left-2 bg-white rounded-xl p-2.5 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="font-bold text-sm text-slate-900">{c.labelAr}</div>
                    <div className="text-[10px] tracking-widest text-slate-500">{c.label.toUpperCase()}</div>
                  </div>
                  <span className="w-7 h-7 rounded-full bg-slate-900 text-white grid place-items-center group-hover:bg-slate-800 transition">
                    <ArrowLeft size={13} />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══ FEATURED PRODUCTS ══════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-3 md:px-6 mt-8 md:mt-10">
        <motion.div {...fadeUp(0)} className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
            الأكثر مبيعاً
            <span className="text-xs font-bold bg-white border border-slate-200 px-2 py-1 rounded-full ms-2 text-slate-700">
              {featured.length} منتجات مميزة
            </span>
          </h2>
          <Link to={`/shop${storeQuery}`} className="text-sm font-bold text-slate-700 hover:text-slate-900 transition">
            عرض كل المنتجات ←
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          {featured.map((p, i) => <ProductCard key={p._id} p={p} index={i} />)}
        </div>

        {featured.length === 0 && (
          <motion.div
            {...fadeUp(0.1)}
            className="text-center py-8 text-sm bg-white border border-dashed border-slate-300 rounded-2xl text-slate-500"
          >
            لا توجد منتجات مميزة في مجال {domain.nameAr} — اذهب للوحة التحكم لإضافة شارة "مميز"
          </motion.div>
        )}
      </section>

      {/* ═══ EDITORIAL + REVIEWS ════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-3 md:px-6 mt-8 md:mt-10 grid lg:grid-cols-2 gap-4">
        <motion.div
          {...fadeUp(0)}
          className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 relative overflow-hidden"
        >
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest border border-slate-200 px-3 py-1 rounded-full text-slate-700">
              EDITORIAL • لماذا {store.storeName}؟
            </div>
            <h3 className="text-xl font-extrabold leading-tight mt-3 text-slate-900">
              {store.editorialTitle || 'جودة تلمس، أسعار تناسبك'}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-600">
              <li className="flex gap-2"><BadgeCheck size={18} className="mt-0.5 text-emerald-600 shrink-0" /> {store.editorialText1 || 'جودة عالية تدوم طويلاً مع ضمان الاسترجاع.'}</li>
              <li className="flex gap-2"><BadgeCheck size={18} className="mt-0.5 text-emerald-600 shrink-0" /> {store.editorialText2 || 'خامات مختارة بعناية، تصميم عمري.'}</li>
              <li className="flex gap-2"><BadgeCheck size={18} className="mt-0.5 text-emerald-600 shrink-0" /> كل طلب يأتي بتغليف فاخر + ضمان جودة + استرجاع 14 يوم.</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <img src={getCategoryImage(domain.categories[0]?.key || '', products) || ''} className="w-16 h-16 rounded-xl object-cover bg-slate-100" onError={e => e.currentTarget.style.display = 'none'} alt="" />
              <img src={getCategoryImage(domain.categories[1]?.key || '', products) || ''} className="w-16 h-16 rounded-xl object-cover bg-slate-100" onError={e => e.currentTarget.style.display = 'none'} alt="" />
              <img src={getCategoryImage(domain.categories[2]?.key || '', products) || ''} className="w-16 h-16 rounded-xl object-cover bg-slate-100" onError={e => e.currentTarget.style.display = 'none'} alt="" />
            </div>
          </div>
        </motion.div>

        <motion.div
          {...fadeUp(0.08)}
          className="bg-slate-900 rounded-2xl p-5 md:p-6 text-white relative overflow-hidden"
        >
          <div className="relative">
            <div className="text-xs tracking-[0.3em] text-emerald-400">آراء عملائنا</div>
            <h3 className="text-xl font-bold mt-1">ماذا قال عملاؤنا؟</h3>
            <div className="mt-4 space-y-3">
              {[
                { n: store.review1Name || 'سارة - الجزائر', t: store.review1Text || 'وصلني في 24 ساعة، الجودة ممتازة والتغليف فخم جداً!', s: 5 },
                { n: store.review2Name || 'أمينة - وهران', t: store.review2Text || 'خدمة رائعة، اتصلوا بي للتأكيد وأعطوني نصائح للحفاظ على الجودة.', s: 5 },
                { n: store.review3Name || 'نور - قسنطينة', t: store.review3Text || 'أخذت عرض 3 قطع ووفّرت 18%، الجودة ممتازة والسعر معقول.', s: 5 },
              ].map((r, i) => (
                <div key={r.n} className="bg-white/[0.07] border border-white/10 rounded-xl p-3">
                  <div className="flex gap-1 text-amber-400">
                    {Array.from({ length: r.s }).map((_, j) => <Star key={j} size={13} fill="currentColor" />)}
                  </div>
                  <p className="text-sm leading-5 mt-2 text-white/90">"{r.t}"</p>
                  <div className="text-xs mt-2 font-bold text-emerald-400">{r.n}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══ INSTAGRAM / CTA ════════════════════════════════════════ */}
      <motion.section {...fadeUp(0)} className="max-w-[1280px] mx-auto px-3 md:px-6 mt-8 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
          <div className="relative">
            <div className="font-extrabold text-base text-slate-900">
              تابعنا على إنستغرام <span className="text-emerald-600">{store.instagram}</span>
            </div>
            <div className="text-xs mt-1 text-slate-500">شارك صور منتجاتك بـ #AmugarDz • {store.phone}</div>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {products.slice(0, 4).map((p, i) => (
              <img
                key={p._id || i}
                src={p.images?.[0] || ''}
                className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-100"
                onError={e => e.currentTarget.style.display = 'none'}
                alt=""
              />
            ))}
          </div>
        </div>
      </motion.section>
    </div>
  )
}
