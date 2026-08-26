/**
 * Shop — Merchant storefront catalog page.
 *
 * Refactored to match the marketplace's clean, AliExpress-style design:
 *   - Monochrome category pills (slate/white, single dark active state)
 *   - Compact sort dropdown
 *   - Clean responsive product grid (2 mobile → 5 large desktop)
 *   - Infinite scroll (preserved from previous version)
 *
 * Theme colors: the merchant's --color-primary / --color-secondary are
 * preserved for the active category pill + count badges, but the rest
 * uses the neutral slate palette for consistency with the marketplace.
 */

import { useMemo, useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { SlidersHorizontal, Search, PackageOpen, X } from 'lucide-react'
import { motion } from 'framer-motion'

import ProductCard from '../components/ProductCard'
import { getProducts, syncProducts } from '../services/api/products'
import { getActiveDomain } from '../services/api/domains'
import { getCategoryIcon3d } from '../components/marketplace/CategoriesCircle'

export default function Shop() {
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

  // 1. Filter + sort
  const domainCatKeys = domain.categories.map(c => c.key)

  const filtered = useMemo(() => {
    let list = [...products]
    if (cat !== 'all') list = list.filter(p => p.category === cat)
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.nameAr.includes(search) ||
        (p.materialAr || '').includes(search) ||
        p.category.includes(s)
      )
    }
    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') list.sort((a, b) => b.price - a.price)
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating)
    return list
  }, [products, cat, search, sort])

  const countInDomain = products.filter(p => domainCatKeys.includes(p.category)).length

  // 2. Sync search bar with URL
  useEffect(() => setSearch(q), [q])

  // 3. Fetch store products from API
  useEffect(() => {
    setProducts([...getProducts()])
    setDomain(getActiveDomain())

    void syncProducts().then(fresh => {
      if (fresh && fresh.length > 0) {
        setProducts(fresh)
      } else {
        setProducts([...getProducts()])
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [params.get('store'), params.get('storeId')])

  // 4. Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(12)
  }, [cat, search, sort])

  // 5. Infinite scroll observer
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

  const SORT_OPTIONS = [
    { value: 'featured', labelAr: 'المميز' },
    { value: 'price-asc', labelAr: 'الأقل أولاً' },
    { value: 'price-desc', labelAr: 'الأعلى أولاً' },
    { value: 'rating', labelAr: 'الأعلى تقييماً' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1280px] mx-auto px-3 md:px-6 py-4 md:py-6">
        {/* ═══ HEADER ════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4"
        >
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
              <span>المتجر</span>
              <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full bg-slate-900">{domain.nameAr}</span>
            </h1>
            <p className="text-xs md:text-sm mt-1 text-slate-500">
              <span className="font-bold text-slate-900">{products.length}</span> منتج
              <span className="mx-1.5 text-slate-300">•</span>
              {countInDomain} في مجال {domain.nameAr}
              <span className="mx-1.5 text-slate-300">•</span>
              الدفع عند الاستلام • توصيل 58 ولاية
            </p>
          </div>

          {/* Search + Sort */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-white border border-slate-200 rounded-full px-3 py-2 flex-1 md:flex-initial md:w-[260px] min-w-0 focus-within:border-slate-400 transition">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  const n = new URLSearchParams(params)
                  if (e.target.value) n.set('q', e.target.value)
                  else n.delete('q')
                  setParams(n, { replace: true })
                }}
                placeholder="ابحث عن منتج..."
                className="flex-1 outline-none px-2 text-sm bg-transparent min-w-0"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    const n = new URLSearchParams(params)
                    n.delete('q')
                    setParams(n, { replace: true })
                  }}
                  className="text-slate-400 hover:text-slate-700 transition shrink-0"
                  aria-label="مسح"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="w-auto max-w-[90px] sm:max-w-none text-[11px] sm:text-xs px-2 py-2 rounded-full bg-white border border-slate-200 text-slate-700 font-bold outline-none cursor-pointer hover:bg-slate-50 transition shrink-0 truncate"
              aria-label="ترتيب"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.labelAr}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* ═══ CATEGORY PILLS — 3D icons, monochrome ════════════════ */}
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-3 px-3 snap-x mb-3"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            type="button"
            onClick={() => { const n = new URLSearchParams(params); n.delete('cat'); setParams(n) }}
            className={`shrink-0 snap-start inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all ${
              cat === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-[#F2F4F7] text-slate-800 hover:bg-slate-200 border-transparent'
            }`}
          >
            <img
              src={getCategoryIcon3d('all')}
              alt=""
              loading="lazy"
              className="w-4 h-4 object-contain shrink-0 pointer-events-none select-none"
              draggable={false}
            />
            <span>الكل</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              cat === 'all' ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
            }`}>
              {products.length}
            </span>
          </button>
          {domain.categories.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => { const n = new URLSearchParams(params); n.set('cat', c.key); setParams(n) }}
              className={`shrink-0 snap-start inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all ${
                cat === c.key
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-[#F2F4F7] text-slate-800 hover:bg-slate-200 border-transparent'
              }`}
            >
              <img
                src={getCategoryIcon3d(c.key)}
                alt=""
                loading="lazy"
                className="w-4 h-4 object-contain shrink-0 pointer-events-none select-none"
                draggable={false}
              />
              <span>{c.labelAr}</span>
              <span className="text-[10px] opacity-60 hidden md:inline">• {c.label}</span>
            </button>
          ))}
        </div>

        {/* Result count */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
          <SlidersHorizontal size={14} className="text-slate-400" />
          <span className="font-bold text-slate-900 text-sm">{filtered.length}</span>
          <span>منتج</span>
        </div>

        {/* Hint when browsing cross-domain */}
        {cat !== 'all' && !domainCatKeys.includes(cat) && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            أنت تستعرض فئة خارج المجال النشط ({domain.nameAr}). يمكنك تغيير المجال من لوحة التحكم أو تصفح كل المنتجات.
          </div>
        )}

        {/* ═══ PRODUCT GRID ════════════════════════════════════════ */}
        {loading && products.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="aspect-square skeleton" />
                <div className="p-2 space-y-2">
                  <div className="h-3 skeleton rounded" />
                  <div className="h-4 w-1/2 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              {filtered.slice(0, visibleCount).map((p, i) => (
                <ProductCard key={p._id} p={p} index={i} />
              ))}
            </div>

            {/* Infinite scroll loader */}
            {visibleCount < filtered.length && (
              <div ref={observerRef} className="py-8 flex justify-center items-center gap-2 text-slate-500 text-xs">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
                <span>جاري تحميل المزيد من المنتجات...</span>
              </div>
            )}
          </>
        )}

        {/* ═══ EMPTY STATE ═══════════════════════════════════════════ */}
        {!loading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center py-12 bg-white border border-slate-200 rounded-2xl"
          >
            <div className="w-14 h-14 rounded-full bg-slate-100 grid place-items-center mx-auto mb-3">
              <PackageOpen size={24} className="text-slate-500" />
            </div>
            <div className="font-bold text-base text-slate-900">لا توجد نتائج</div>
            <p className="text-sm mt-1 max-w-md mx-auto text-slate-500">
              جرّب بحثاً آخر أو غيّر الفئة. المجال النشط: <span className="font-bold text-slate-900">{domain.nameAr}</span>
            </p>
            <div className="flex justify-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  const n = new URLSearchParams(params)
                  n.delete('q')
                  n.delete('cat')
                  setParams(n)
                }}
                className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-slate-800 transition"
              >
                مسح الفلاتر
              </button>
              <Link
                to="/admin"
                className="bg-white border border-slate-200 px-5 py-2.5 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                إدارة المنتجات
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
