import { useMemo, useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { SlidersHorizontal, Search, PackageOpen, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'

import ProductCard from '../components/ProductCard'
import { getProducts, syncProducts } from '../services/api/products'
import { getActiveDomain } from '../services/api/domains'

export default function Shop(){
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const cat = params.get('cat') || 'all'
  const [search, setSearch] = useState(q)
  const [sort, setSort] = useState('featured')
  
  const [products, setProducts] = useState(() => getProducts())
  const [domain, setDomain] = useState(() => getActiveDomain())
  const [loading, setLoading] = useState(() => getProducts().length === 0)
  const [visibleCount, setVisibleCount] = useState(12)
  const observerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
    setProducts([...getProducts()])
    setDomain(getActiveDomain())

    // جلب منتجات هذا المتجر فوراً من السيرفر عند فتح الرابط المباشر
    void syncProducts().then(fresh => {
      if (fresh && fresh.length > 0) {
        setProducts(fresh)
      } else {
        setProducts([...getProducts()])
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [params.get('store'), params.get('storeId')])

  // إعادة ضبط العداد إلى 12 عند تغيير الفئة أو البحث أو الترتيب
  useEffect(() => {
    setVisibleCount(12)
  }, [cat, search, sort])

  // مستشعر التمرير الذكي (Infinite Scroll Observer)
  useEffect(() => {
    if (!observerRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 12)
        }
      },
      { rootMargin: '250px' }
    )

    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [filtered.length])


  

  const domainCatKeys = domain.categories.map(c=>c.key)

  const filtered = useMemo(()=>{
    let list=[...products]
    if(cat!=='all') list = list.filter(p=>p.category===cat)
    if(search.trim()){ const s=search.toLowerCase(); list = list.filter(p=> p.name.toLowerCase().includes(s) || p.nameAr.includes(search) || p.materialAr.includes(search) || p.category.includes(s))}
    if(sort==='price-asc') list.sort((a,b)=>a.price-b.price)
    if(sort==='price-desc') list.sort((a,b)=>b.price-a.price)
    if(sort==='rating') list.sort((a,b)=>b.rating-a.rating)
    return list
  },[products, cat, search, sort])

  const countInDomain = products.filter(p=> domainCatKeys.includes(p.category)).length

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* ═══ HEADER ════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest mb-2" style={{ color: 'var(--color-primary)' }}>
              <span className="w-8 h-px" style={{ background: 'color-mix(in srgb, var(--color-primary) 30%, transparent)' }} />
              متجر {domain.nameAr}
            </div>
            <h1 className="text-[26px] md:text-[32px] font-extrabold flex items-center gap-2 flex-wrap" style={{ color: 'var(--color-text)' }}>
              <span>المتجر</span>
              <span className="text-xs md:text-sm font-bold text-white px-2.5 py-1 rounded-full" style={{ background: 'var(--color-secondary)' }}>{domain.nameAr}</span>
            </h1>
            <p className="text-xs md:text-sm mt-1.5" style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>اكتشف <span className="font-bold" style={{ color: 'var(--color-text)' }}>{products.length}</span> منتج ({countInDomain} في مجال {domain.nameAr}) • الدفع عند الاستلام • توصيل 58 ولاية</p>
            <p className="text-xs mt-1 hidden md:block" style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>{domain.descriptionAr}</p>
          </div>

          {/* Search + Sort — premium pill design */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-white border rounded-full px-4 py-2.5 flex-1 md:flex-initial md:w-[280px] min-w-0 transition-all duration-300 focus-within:shadow-[0_0_0_4px_rgba(201,169,106,0.12)]" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)' }}>
              <Search size={16} className="shrink-0" style={{ color: 'color-mix(in srgb, var(--color-text) 45%, transparent)' }}/>
              <input value={search} onChange={e=>{setSearch(e.target.value); const n=new URLSearchParams(params); if(e.target.value) n.set('q', e.target.value); else n.delete('q'); setParams(n, {replace:true})}} placeholder="ابحث عن منتج..." className="flex-1 outline-none px-2 text-sm bg-transparent min-w-0" style={{ color: 'var(--color-text)' }} />
              {search && <button type="button" onClick={()=>{ setSearch(''); const n=new URLSearchParams(params); n.delete('q'); setParams(n, {replace:true}) }} className="w-5 h-5 rounded-full grid place-items-center text-xs" style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-text)' }}>×</button>}
            </div>
            {/* Sort — custom-styled select wrapper */}
            <div className="relative shrink-0">
              <select value={sort} onChange={e=>setSort(e.target.value)} className="appearance-none bg-white border rounded-full pl-9 pr-4 py-2.5 text-sm font-bold cursor-pointer outline-none transition-all duration-300 hover:shadow-md" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)', color: 'var(--color-text)' }}>
                <option value="featured">المميز</option>
                <option value="price-asc">الأقل أولاً</option>
                <option value="price-desc">الأعلى أولاً</option>
                <option value="rating">الأعلى تقييماً</option>
              </select>
              <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-primary)' }} />
            </div>
          </div>
        </motion.div>

        {/* ═══ CATEGORY CHIPS ════════════════════════════════════════ */}
        <div
          className="mt-5 flex md:flex-wrap gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 thumb-scroll snap-x snap-mandatory overscroll-x-contain [&>button]:snap-start [&>button:last-child]:me-4 md:[&>button:last-child]:me-0"
          style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}
        >
          <button type="button" onClick={()=>{const n=new URLSearchParams(params); n.delete('cat'); setParams(n)}} className={`btn-premium shrink-0 px-5 py-2.5 rounded-full text-sm font-bold border flex items-center gap-2 transition-all duration-300 ${cat==='all' ? 'text-white border-transparent shadow-lg' : 'bg-white hover:shadow-md' }`} style={cat==='all' ? { background: 'var(--color-secondary)', borderColor: 'var(--color-secondary)' } : { color: 'var(--color-text)', borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)' }}>الكل <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${cat==='all' ? 'bg-white/20 text-white' : ''}`} style={cat!=='all' ? { background: 'var(--color-secondary)', color: 'white' } : undefined}>{products.length}</span></button>
          {domain.categories.map(c=> (
            <button key={c.key} type="button" onClick={()=>{const n=new URLSearchParams(params); n.set('cat',c.key); setParams(n)}} className={`btn-premium shrink-0 px-5 py-2.5 rounded-full text-sm font-bold border transition-all duration-300 ${cat===c.key ? 'text-white border-transparent shadow-lg' : 'bg-white hover:shadow-md' }`} style={cat===c.key ? { background: 'var(--color-accent)', borderColor: 'var(--color-accent)' } : { color: 'var(--color-text)', borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)' }}>{c.labelAr} <span className="text-[10px] opacity-60 hidden md:inline">• {c.label}</span></button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>
          <SlidersHorizontal size={14} style={{ color: 'var(--color-primary)' }}/>
          <span className="font-bold gradient-text text-sm">{filtered.length}</span>
          <span>منتج</span>
        </div>

        {/* hint when browsing cross-domain */}
        {cat!=='all' && !domainCatKeys.includes(cat) && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800">أنت تستعرض فئة خارج المجال النشط ({domain.nameAr}). يمكنك تغيير المجال من لوحة التحكم أو تصفح كل المنتجات.</div>
        )}

                {/* ═══ PRODUCT GRID ══════════════════════════════════════════ */}
        {loading && products.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 mt-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#EDE6D8] rounded-[22px] overflow-hidden p-3 space-y-3">
                <div className="aspect-square skeleton rounded-xl" />
                <div className="h-4 skeleton rounded w-3/4" />
                <div className="h-4 skeleton rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 mt-6">
              {filtered.slice(0, visibleCount).map((p, i) => (
                <ProductCard key={p._id} p={p} index={i} />
              ))}
            </div>

            {/* مستشعر التمرير اللانهائي */}
            {visibleCount < filtered.length && (
              <div ref={observerRef} className="py-8 flex justify-center items-center">
                <div className="w-8 h-8 border-3 border-[#EDE6D8] border-t-[var(--color-primary)] rounded-full animate-spin" />
              </div>
            )}
          </>
        )}


        {/* ═══ EMPTY STATE ═══════════════════════════════════════════ */}
        {filtered.length===0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center py-16 bg-white border border-dashed rounded-3xl mt-6"
            style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 22%, transparent)' }}
          >
            {/* Empty state illustration — icon in circle with decorative ring */}
            <div className="relative mx-auto w-24 h-24 mb-5">
              <div className="absolute inset-0 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, white)' }} />
              <div className="absolute inset-2 rounded-full border-2 border-dashed" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 25%, transparent)' }} />
              <div className="absolute inset-0 grid place-items-center">
                <PackageOpen size={36} style={{ color: 'var(--color-primary)' }} />
              </div>
            </div>
            <div className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>لا توجد نتائج</div>
            <p className="text-sm mt-1.5 max-w-md mx-auto" style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>جرّب بحثاً آخر أو غيّر الفئة. المجال النشط: <span className="font-bold" style={{ color: 'var(--color-text)' }}>{domain.nameAr}</span></p>
            <div className="flex justify-center gap-2 mt-6">
              <button type="button" onClick={()=>{ setSearch(''); const n=new URLSearchParams(params); n.delete('q'); n.delete('cat'); setParams(n)}} className="btn-premium text-white px-5 py-2.5 rounded-full text-sm font-bold" style={{ background: 'var(--color-secondary)' }}>مسح الفلاتر</button>
              <Link to="/admin" className="bg-white border px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 hover:shadow-md" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)', color: 'var(--color-text)' }}>إدارة المنتجات</Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
