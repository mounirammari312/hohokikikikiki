import { Link } from 'react-router-dom'
import { ArrowLeft, Truck, ShieldCheck, Sparkles, BadgeCheck, Star, Quote, Package } from 'lucide-react'
import { motion } from 'framer-motion'
import ProductCard from '../components/ProductCard'
import { SmartImage } from '../components/SmartImage'
import { getProducts, syncProducts } from '../services/api/products'
import { getSettings, subscribeSettings, syncSettings } from '../services/api/settings'
import { getActiveDomain } from '../services/api/domains'
import { trackVisit } from '../services/api/client'
import { useEffect, useState } from 'react'
import { formatDZD } from '../lib/utils'

// ─── Smart category image: picks a product image from that category ────────
// Instead of hardcoded jewelry images, we find a real product image
// from the store's catalog that matches the category. If no product
// exists in that category, we show a neutral gradient placeholder.
function getCategoryImage(catKey: string, products: any[]): string {
  const productInCat = products.find(p => p.category === catKey && p.images?.[0])
  if (productInCat) return productInCat.images[0]
  return ''  // empty → the card will show a gradient placeholder instead
}

// Reusable fade-up wrapper for scroll-reveal animations.
// `delay` lets us stagger a row of cards.
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
})

export default function Home(){
  const [products, setProducts] = useState(()=> getProducts())
  const [store, setStore] = useState(()=> getSettings())
  const [domain, setDomain] = useState(()=> getActiveDomain())


  
    const featuredAll = products.filter(p => p.isFeatured)
  const domainCats = new Set(domain.categories.map(c => c.key))
  const featured = (() => {
    const match = featuredAll.filter(p => domainCats.has(p.category))
    if (match.length > 0) return match
    if (featuredAll.length > 0) return featuredAll
    // إذا لم يحدد التاجر منتجات مميزة، اعرض أحدث 8 منتجات حتى لا تظهر الصفحة فارغة
    return products.slice(0, 8)
  })()



  
  useEffect(()=>{
    window.scrollTo({top:0, left:0, behavior:'auto'})

    // ─── NO spinner, NO loading screen ────────────────────────────────
    // The per-tenant caches (products.ts + settings.ts) are now keyed
    // by storeId/slug. Each store has its OWN cache entry. When the
    // user visits store B after store A, getProducts() returns store B's
    // cache (or empty array if first visit) — NEVER store A's products.
    //
    // We render IMMEDIATELY from whatever is in the per-tenant cache
    // (could be from localStorage = instant, or empty = shows empty
    // state). Then we fetch fresh data from the API in the background.
    // When the API responds, the state updates and React re-renders
    // with the fresh data. NO spinner needed.

    // Background sync — updates state when fresh data arrives
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



    

    // ─── Track the storefront visit (for merchant analytics) ──────────
    const s = getSettings()
    const urlParams = new URLSearchParams(window.location.search)
    const sid = s.storeId || s._id || urlParams.get('storeId') || ''
    if (sid) trackVisit(sid, 'store')
  },[])

  // Re-render when settings change (merchant saves in /admin → same tab).
  // Cross-tab changes are handled by the storage event listener inside
  // settings.ts which calls syncSettings() and then notifies subscribers.
  useEffect(() => {
    const unsub = subscribeSettings(() => {
      setStore(getSettings())
      setDomain(getActiveDomain())
    })
    return unsub
  }, [])

  // Per-category product count for the category cards badge
  const countByCat = (key: string) => products.filter(p=>p.category===key).length

  const primary = store.primaryColor || 'var(--color-primary)'
  const secondary = store.secondaryColor || 'var(--color-secondary)'
  const textColor = store.textColor || 'var(--color-text)'

  return (
    <div className="min-h-screen" style={{background: store.bgColor || "var(--color-bg)", color: textColor}}>
      {/* ═══ HERO ═══════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-6 pt-6">
        <motion.div {...fadeUp(0)} className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4">
          <div className="relative rounded-[28px] overflow-hidden min-h-[420px] md:min-h-[520px] flex" style={{ background: secondary }}>
            {/* Use a real product image as hero background if available */}
            <SmartImage src={products[0]?.images?.[0] || domain.heroImage} alt={domain.heroTitleAr} size="hero" eager className="absolute inset-0 w-full h-full" style={{ opacity: 0.95, zIndex: 0 }} />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/15 to-transparent" style={{ zIndex: 1 }}/>
            <div className="hero-overlay-anim absolute inset-0 bg-gradient-to-tr from-[var(--color-accent)]/0 via-[var(--color-accent)]/5 to-[var(--color-primary)]/5 pointer-events-none" style={{ zIndex: 1 }}/>

            {/* Floating trust badge */}
            <div className="absolute top-5 right-5 z-20 hidden md:flex items-center gap-2 bg-white/90 backdrop-blur rounded-full px-3 py-1.5 text-xs font-bold shadow-md border border-white/40" style={{ color: textColor }}>
              <span className="text-base leading-none">🇩🇿</span>
              <span>صنع في الجزائر</span>
              <span className="w-1 h-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-text) 40%, transparent)' }}/>
              <span style={{ color: primary }}>COD ✓</span>
            </div>

            <div className="relative z-10 p-6 md:p-10 flex flex-col justify-center max-w-[560px]">
              <span className="inline-flex w-fit items-center gap-2 bg-white/15 border border-white/20 text-white backdrop-blur rounded-full px-3 py-1 text-xs tracking-widest">{domain.heroBadge} {store.enableRoseEdition && <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B] shadow-[0_0_6px_rgba(160,42,91,0.8)]"></span>}</span>
              <h1 className="cormorant text-[38px] md:text-[52px] leading-[0.95] font-bold text-white mt-4" style={{whiteSpace:'pre-line'}}>{domain.heroTitleAr}</h1>
              <p className="text-white/85 mt-4 leading-7">{domain.heroSubtitleAr}</p>
              <div className="flex flex-wrap gap-3 mt-6">
                <Link to="/shop" className="btn-premium text-white px-7 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg" style={{ background: primary }}>تسوّق الآن <ArrowLeft size={16}/></Link>
                <a href="#collection" className="btn-premium bg-white px-7 py-3 rounded-full font-bold shadow-lg" style={{ color: textColor }}>اكتشف الكولكشن</a>
              </div>
              <div className="flex items-center gap-6 mt-6 text-white/90 text-xs">
                <span className="flex items-center gap-1.5"><BadgeCheck size={14} style={{ color: primary }}/> 4.9/5 (1.2k تقييم)</span>
                <span className="flex items-center gap-1.5"><Truck size={14} style={{ color: primary }}/> توصيل 58 ولاية • مجاني فوق {formatDZD(store.freeShippingThreshold)}</span>
              </div>
            </div>
            {/* floating price card — glass-card effect on stats */}
            <div className="hidden lg:block absolute bottom-6 left-6 glass-card rounded-2xl p-3 shadow-xl w-[200px]">
              <div className="flex gap-2">
                <img src={products.find(p=> domainCats.has(p.category))?.images?.[0] || ''} className="w-12 h-12 rounded-lg object-cover bg-[#F5EFE6] shrink-0" onError={e => e.currentTarget.style.display='none'}/>
                <div className="min-w-0">
                  <div className="text-[10px]" style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>الأكثر مبيعاً</div>
                  <div className="font-bold text-xs leading-tight line-clamp-1" style={{ color: textColor }}>{products.find(p=> domainCats.has(p.category))?.nameAr || domain.nameAr}</div>
                  <div className="font-extrabold text-xs gradient-text">{products.find(p=> domainCats.has(p.category)) ? formatDZD(products.find(p=> domainCats.has(p.category))!.price) : formatDZD(6800)}</div>
                </div>
              </div>
              <Link to={products.find(p=> domainCats.has(p.category)) ? `/product/${products.find(p=> domainCats.has(p.category))!._id}` : '/shop'} className="btn-premium mt-2 block text-center text-white rounded-full py-1.5 text-[10px] font-bold" style={{ background: secondary }}>اطلب الآن - COD</Link>
            </div>
          </div>
          <div className="grid grid-rows-[1.1fr_0.9fr] gap-3">
            {/* عروض الكمية — مصغرة */}
            <div className={`rounded-2xl overflow-hidden relative p-4 flex flex-col justify-between min-h-[180px] border card-shadow ${store.enableRoseEdition ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-[#F5EFE6] border-[#EDE6D8]'}`}>
              {(() => { const img = getCategoryImage(domain.categories[0]?.key || '', products); return img ? <img src={img} className="absolute inset-0 w-full h-full object-cover opacity-[0.08]"/> : null })()}
              {store.enableRoseEdition && <div className="absolute top-0 left-0 w-24 h-24 bg-[#A02A5B]/10 rounded-full blur-2xl -translate-x-4 -translate-y-4"/>}
              <div className="relative">
                <span className={`border rounded-full px-2 py-0.5 text-[10px] font-bold inline-flex gap-1 items-center ${store.enableRoseEdition ? 'bg-white border-[#F6C0D4] text-[#A02A5B]' : 'bg-white border-[#EDE6D8] text-[#7A6F5A]'}`}><Sparkles size={10} className={store.enableRoseEdition ? 'text-[#A02A5B]' : 'text-[#C9A96A]'}/> عروض الكمية</span>
                <h3 className="text-[20px] font-extrabold leading-none mt-2" style={{ color: textColor }}>وفّر حتى <span style={{ color: store.enableRoseEdition ? '#A02A5B' : primary }}>22%</span><br/>عند شراء 3 قطع</h3>
                <p className={`text-[11px] mt-1 ${store.enableRoseEdition ? 'text-[#7A5A65]' : 'text-[#7A6F5A]'}`}>شارك الأناقة — خصم تلقائي في السلة</p>
              </div>
              <Link to="/shop" className={`btn-premium relative inline-flex w-fit px-3 py-1.5 rounded-full text-[11px] font-bold mt-2 ${store.enableRoseEdition ? 'bg-[#A02A5B] text-white hover:bg-[#7A1F44]' : 'text-white hover:opacity-90'}`} style={!store.enableRoseEdition ? { background: secondary } : undefined}>استفد من العرض</Link>
            </div>
            {/* بطاقة الدفع عند الاستلام — مصغرة */}
            <div className="rounded-2xl p-4 text-white relative overflow-hidden card-shadow" style={{ background: primary }}>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/15 rounded-full blur-2xl"/>
              <div className="absolute -left-8 -top-8 w-24 h-24 bg-black/10 rounded-full"/>
              <div className="relative">
                <div className="text-[10px] tracking-[0.2em] opacity-90">{domain.name.toUpperCase()} CARE</div>
                <h4 className="text-[16px] font-bold leading-tight mt-1">الدفع عند الاستلام<br/>58 ولاية • بدون بطاقة</h4>
                <div className="flex gap-1.5 mt-2 text-[10px]">
                  <span className="bg-white text-[#1A1A1E] px-2 py-1 rounded-full font-bold flex items-center gap-1"><ShieldCheck size={12}/> مضمون</span>
                  <span className="bg-black/15 border border-white/20 px-2 py-1 rounded-full" dir="ltr">{store.phone || 'تأكيد بالهاتف'}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══ TRUST BAR — مصغرة ═══════════════════════════════════════ */}
        <motion.div {...fadeUp(0.05)} className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          {[
            {icon:Truck, t:"توصيل سريع", d:"24-96 ساعة"},
            {icon:ShieldCheck, t:"الدفع عند الاستلام", d: store.enableCod ? "ادفع عند الوصول" : "متوقف", rose: store.enableRoseEdition},
            {icon:BadgeCheck, t:"ضمان 12 شهر", d: "استرجاع 14 يوم"},
            {icon:Sparkles, t:"تغليف هدية", d:`علبة ${store.storeName} فاخرة`},
          ].map(c=> (
            <div key={c.t} className={`rounded-xl p-2.5 flex gap-2 items-center border card-shadow ${c.rose ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-white border-[#EDE6D8]'}`}>
              <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${c.rose ? 'bg-[#FCE7F0] text-[#A02A5B] border border-[#F6C0D4]' : ''}`} style={!c.rose ? { background: 'color-mix(in srgb, var(--color-primary) 12%, white)', color: 'var(--color-primary)' } : undefined}><c.icon size={14}/></div>
              <div className="min-w-0"><div className={`font-bold text-xs ${c.rose ? 'text-[#7A1F44]' : ''}`} style={!c.rose ? { color: textColor } : undefined}>{c.t}</div><div className={`text-[10px] truncate ${c.rose ? 'text-[#A02A5B]/70' : ''}`} style={!c.rose ? { color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' } : undefined}>{c.d}</div></div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ═══ CATEGORIES ══════════════════════════════════════════════ */}
      <section id="collection" className="max-w-[1280px] mx-auto px-4 md:px-6 mt-12">
        <motion.div {...fadeUp(0)} className="flex items-end justify-between">
          <div>
            <div className="text-xs tracking-[0.3em] font-bold flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>SHOP BY CATEGORY <span className="w-8 h-px" style={{ background: 'color-mix(in srgb, var(--color-primary) 25%, transparent)' }}></span> {store.enableRoseEdition && <span className="text-[#A02A5B] text-[10px] tracking-widest border border-[#F6C0D4] bg-[#FDF2F6] px-2 py-0.5 rounded-full">ÉDITION ROSE</span>} <span className="hidden md:inline text-[11px] tracking-normal text-white px-2 py-1 rounded-full" style={{ background: 'var(--color-secondary)' }}>{domain.nameAr} • {domain.categories.length} فئات</span></div>
            <h2 className="text-[28px] font-extrabold mt-1" style={{ color: textColor }}>تسوّق حسب الفئة <span className="text-[15px]">— {domain.nameAr}</span></h2>
            <p className="text-xs mt-1 line-clamp-1" style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>{domain.descriptionAr}</p>
          </div>
          <Link to="/shop" className="hidden md:inline-flex text-sm font-bold border rounded-full px-4 py-2 bg-white hover:text-white btn-premium" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)', color: textColor }} >عرض الكل</Link>
        </motion.div>
        <motion.div {...fadeUp(0.08)} className={`grid gap-4 mt-4 ${domain.categories.length<=3 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
          {domain.categories.filter(c => countByCat(c.key) > 0).map((c, i)=> (
            <motion.div key={c.key} {...fadeUp(0.05 * i)} className="contents">
            <Link to={`/shop?cat=${c.key}`} className="group relative rounded-[22px] overflow-hidden h-[220px] card-shadow card-shadow-hover" style={{ background: 'var(--color-secondary)' }}>
              {(() => {
                const catImg = getCategoryImage(c.key, products)
                if (catImg) {
                  return (
                    <div className="img-zoom absolute inset-0">
                      <img src={catImg} className="absolute inset-0 w-full h-full object-cover opacity-80"/>
                    </div>
                  )
                }
                // No product in this category → gradient placeholder
                return (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#F5EFE6] to-[#EDE6D8] grid place-items-center">
                    <Package size={48} className="text-[#C9A96A]/30" />
                  </div>
                )
              })()}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent group-hover:from-black/80 group-hover:via-black/30 transition-all duration-500"/>
              {/* Product count badge */}
              <span className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur text-[10px] font-bold px-2 py-1 rounded-full" style={{ color: textColor }}>{countByCat(c.key)} منتج</span>
              <div className="absolute bottom-3 right-3 left-3 bg-white rounded-2xl p-3 flex items-center justify-between shadow-lg">
                <div><div className="font-bold" style={{ color: textColor }}>{c.labelAr}</div><div className="text-[10px] tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>{c.label.toUpperCase()}</div></div>
                <span className="w-8 h-8 rounded-full text-white grid place-items-center arrow-slide" style={{ background: 'var(--color-secondary)' }}><ArrowLeft size={14}/></span>
              </div>
            </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══ FEATURED PRODUCTS ════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-6 mt-12">
        <motion.div {...fadeUp(0)} className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[26px] font-extrabold" style={{ color: textColor }}>الأكثر مبيعاً <span className="gradient-text">2026</span> <span className="text-xs font-bold bg-white border px-2 py-1 rounded-full ms-2" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)' }}>{featured.length} منتجات مميزة • {domain.nameAr}</span></h2>
          <Link to="/shop" className="text-sm font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>عرض كل المنتجات ←</Link>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {featured.map((p, i)=> <ProductCard key={p._id} p={p} index={i}/> )}
        </div>
        {featured.length===0 && <motion.div {...fadeUp(0.1)} className="text-center py-8 text-sm bg-white border border-dashed rounded-2xl mt-4" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 22%, transparent)', color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>لا توجد منتجات مميزة في مجال {domain.nameAr} — اذهب للوحة التحكم لإضافة شارة "مميز"</motion.div>}
      </section>

      {/* ═══ EDITORIAL + REVIEWS ══════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-6 mt-12 grid lg:grid-cols-2 gap-6">
        <motion.div {...fadeUp(0)} className="bg-white border rounded-[28px] p-6 md:p-8 relative overflow-hidden card-shadow" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}>
          <div className="absolute top-0 left-0 w-40 h-40 bg-[#FFF3E0] rounded-full -translate-x-10 -translate-y-10"/>
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest border px-3 py-1 rounded-full" style={{ color: 'var(--color-primary)', borderColor: 'color-mix(in srgb, var(--color-primary) 22%, transparent)', background: 'color-mix(in srgb, var(--color-primary) 6%, white)' }}>EDITORIAL • لماذا {store.storeName}؟</div>
            <h3 className="text-[26px] font-extrabold leading-tight mt-3" style={{ color: textColor }}>{store.editorialTitle || 'جودة تلمس، أسعار تناسبك'}<br/><span className="text-[16px] font-normal" style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>{domain.descriptionAr}</span></h3>
            <ul className="mt-4 space-y-3 text-sm leading-6" style={{ color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>
              <li className="flex gap-2"><BadgeCheck size={18} className="mt-0.5" style={{ color: 'var(--color-primary)' }}/> {store.editorialText1 || 'جودة عالية تدوم طويلاً مع ضمان الاسترجاع.'}</li>
              <li className="flex gap-2"><BadgeCheck size={18} className="mt-0.5" style={{ color: 'var(--color-primary)' }}/> {store.editorialText2 || 'خامات مختارة بعناية، تصميم عمري.'}</li>
              <li className="flex gap-2"><BadgeCheck size={18} className="mt-0.5" style={{ color: 'var(--color-primary)' }}/> كل طلب يأتي بتغليف فاخر + ضمان جودة + استرجاع 14 يوم.</li>
            </ul>
            <div className="mt-6 flex gap-3">
              <img src={getCategoryImage(domain.categories[0]?.key || '', products) || ''} className="w-20 h-20 rounded-2xl object-cover bg-[#F5EFE6]" onError={e => e.currentTarget.style.display='none'}/>
              <img src={getCategoryImage(domain.categories[1]?.key || '', products) || ''} className="w-20 h-20 rounded-2xl object-cover bg-[#F5EFE6]" onError={e => e.currentTarget.style.display='none'}/>
              <img src={getCategoryImage(domain.categories[2]?.key || '', products) || ''} className="w-20 h-20 rounded-2xl object-cover bg-[#F5EFE6]" onError={e => e.currentTarget.style.display='none'}/>
            </div>
          </div>
        </motion.div>
        <motion.div {...fadeUp(0.08)} className="rounded-[28px] p-6 md:p-8 text-white relative overflow-hidden card-shadow" style={{ background: secondary }}>
          <Quote className="absolute top-6 left-6 text-white/10" size={80}/>
          {store.enableRoseEdition && <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#A02A5B]/20 rounded-full blur-2xl"/>}
          <div className="relative">
            <div className="text-xs tracking-[0.3em]" style={{ color: 'var(--color-primary)' }}>آراء عملائنا</div>
            <h3 className="text-[24px] font-bold mt-1">ماذا قال عملاؤنا؟</h3>
            <div className="mt-5 space-y-4">
              {[
                {n: store.review1Name || "سارة - الجزائر", t: store.review1Text || "وصلني في 24 ساعة، الجودة ممتازة والتغليف فخم جداً!", s:5, rose:false},
                {n: store.review2Name || "أمينة - وهران", t: store.review2Text || "خدمة رائعة، اتصلوا بي للتأكيد وأعطوني نصائح للحفاظ على الجودة.", s:5, rose: store.enableRoseEdition},
                {n: store.review3Name || "نور - قسنطينة", t: store.review3Text || "أخذت عرض 3 قطع ووفّرت 18%، الجودة ممتازة والسعر معقول.", s:5, rose:false},
              ].map((r, i)=>(
                <div key={r.n} className={`animate-slide-up stagger-${i+1} rounded-2xl p-4 backdrop-blur border card-shadow ${r.rose ? 'bg-[#A02A5B]/15 border-[#A02A5B]/30' : 'bg-white/[0.07] border-white/10'}`}>
                  <div className={`flex gap-1 ${r.rose ? 'text-[#F6C0D4]' : ''}`} style={!r.rose ? { color: 'var(--color-primary)' } : undefined}>{Array.from({length:r.s}).map((_,j)=><Star key={j} size={14} fill={r.rose ? '#F6C0D4' : 'var(--color-primary)'}/>)}</div>
                  <p className="text-sm leading-6 mt-2 text-white/90">“{r.t}”</p>
                  <div className={`text-xs mt-2 font-bold ${r.rose ? 'text-[#F6C0D4]' : ''}`} style={!r.rose ? { color: 'var(--color-primary)' } : undefined}>{r.n} </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══ INSTAGRAM / CTA ══════════════════════════════════════════ */}
      <motion.section {...fadeUp(0)} className="max-w-[1280px] mx-auto px-4 md:px-6 mt-12 mb-8">
        <div className="bg-white border rounded-[28px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 card-shadow relative overflow-hidden" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}>
          {/* decorative accent */}
          <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full blur-3xl opacity-30" style={{ background: 'var(--color-primary)' }}/>
          <div className="relative">
            <div className="font-extrabold text-lg" style={{ color: textColor }}>تابعنا على إنستغرام <span style={{ color: 'var(--color-primary)' }}>{store.instagram}</span> {store.enableRoseEdition && <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] px-2 py-0.5 rounded-full ms-2">♥ ÉDITION ROSE</span>}</div>
            <div className="text-xs mt-1" style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>شارك صور منتجاتك بـ #AmugarDz • {store.phone}</div>
          </div>
          <div className="relative flex gap-2 overflow-x-auto thumb-scroll scrollbar-hide">
            {products.slice(0, 4).map((p, i)=> <img key={p._id || i} src={p.images?.[0] || ''} className={`w-16 h-16 rounded-xl object-cover shrink-0 hover:scale-105 transition bg-[#F5EFE6] ${i===1 && store.enableRoseEdition ? 'ring-2 ring-[#A02A5B]/30 ring-offset-2' : ''}`} onError={e => e.currentTarget.style.display='none'}/> )}
          </div>
        </div>
      </motion.section>
    </div>
  )
}
