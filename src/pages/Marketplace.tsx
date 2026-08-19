/**
 * Marketplace — Professional public browse page (AliExpress / Temu style)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Features:
 *    - Sticky header with logo + search bar + categories dropdown
 *    - Hero banner with gradient + CTA
 *    - Flash deals / trending section (top viewed products)
 *    - Category pills (horizontal scroll on mobile)
 *    - Filters sidebar (category, price range, store)
 *    - Sort dropdown (newest, popular, price low→high, price high→low)
 *    - Dense product grid (2 cols mobile, 4-5 cols desktop)
 *    - Product cards: image, name, price (red), discount badge, store name, rating
 *    - Pagination (24 per page)
 *    - Empty state when no products match filters
 *
 *  This page is PUBLIC — no auth required. Anyone can browse.
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Search, Star, TrendingUp, Clock, ChevronDown, X, Package, Truck, ShieldCheck, Store as StoreIcon, Eye } from 'lucide-react'
import { fetchMarketplaceProducts, fetchMarketplaceStores, fetchMarketplaceStore, trackMarketplaceView } from '../services/api/client'
import type { MarketplaceProduct } from '../services/api/client'
import type { TenantStore } from '../services/api/types'
import { formatDZD } from '../lib/utils'
import { SmartImage } from '../components/SmartImage'

// Category labels (Arabic) — matches the preset domains' categories
const CATEGORIES = [
  { key: 'all', labelAr: 'الكل' },
  { key: 'necklace', labelAr: 'قلائد' },
  { key: 'ring', labelAr: 'خواتم' },
  { key: 'earring', labelAr: 'أقراط' },
  { key: 'bracelet', labelAr: 'أساور' },
  { key: 'dress', labelAr: 'فساتين' },
  { key: 'abaya', labelAr: 'عبايات' },
  { key: 'hijab', labelAr: 'حجاب' },
  { key: 'bag', labelAr: 'حقائب' },
  { key: 'shoes', labelAr: 'أحذية' },
  { key: 'perfume', labelAr: 'عطور' },
  { key: 'makeup', labelAr: 'مكياج' },
  { key: 'skincare', labelAr: 'عناية' },
  { key: 'general', labelAr: 'أخرى' },
]

const SORT_OPTIONS = [
  { value: 'newest', labelAr: 'الأحدث' },
  { value: 'popular', labelAr: 'الأكثر رواجاً' },
  { value: 'price_low', labelAr: 'السعر: الأقل أولاً' },
  { value: 'price_high', labelAr: 'السعر: الأعلى أولاً' },
] as const

export default function Marketplace() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<MarketplaceProduct[]>([])
  const [stores, setStores] = useState<TenantStore[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<'newest' | 'popular' | 'price_low' | 'price_high'>('newest')
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(0)
  const [storeId, setStoreId] = useState('')

  // Mobile filters drawer
  const [showFilters, setShowFilters] = useState(false)

  // Fetch products from API
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchMarketplaceProducts({
        q: q || undefined,
        category: category !== 'all' ? category : undefined,
        sort,
        page,
        limit: 24,
        minPrice: minPrice > 0 ? minPrice : undefined,
        maxPrice: maxPrice > 0 ? maxPrice : undefined,
        storeId: storeId || undefined,
      })
      setProducts(res.products || [])
      setTotal(res.total || 0)
      setTotalPages(res.totalPages || 1)
      if (page === 1 && res.stores) {
        setStores(res.stores)
      }
    } catch (err) {
      console.error('[marketplace] fetch failed:', err)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [q, category, sort, page, minPrice, maxPrice, storeId])

  useEffect(() => { void fetchProducts() }, [fetchProducts])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [q, category, sort, minPrice, maxPrice, storeId])

  // Track view when a product is clicked (for "popular" sorting)
  const handleProductClick = (p: MarketplaceProduct) => {
    void trackMarketplaceView(p._id)
    // Navigate to the product's store page (with ?store=slug so the
    // storefront loads the right tenant)
    // We need to find the store's slug from the stores list
    const store = stores.find(s => s._id === p.storeId)
    if (store) {
      navigate(`/product/${p._id}?store=${encodeURIComponent(store.slug)}`)
    }
  }

  // Trending products (top 6 by views) — only on first page, no filters
  const trending = useMemo(() => {
    if (page !== 1 || q || category !== 'all' || storeId) return []
    return [...products]
      .sort((a, b) => (b.marketplaceViews || 0) - (a.marketplaceViews || 0))
      .slice(0, 6)
  }, [products, page, q, category, storeId])

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* ═══ HEADER (sticky) ═══════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3">
          {/* Top row: logo + search + create store */}
          <div className="flex items-center gap-3 md:gap-6">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A1A1E] to-[#3D3D45] grid place-items-center">
                <span className="cormorant text-[#C9A96A] text-lg font-bold">L</span>
              </div>
              <div className="hidden md:block">
                <div className="font-extrabold text-[#1A1A1E] text-sm leading-tight">LUMIÈRE</div>
                <div className="text-[10px] tracking-widest text-[#9A8A6B]">MARKETPLACE</div>
              </div>
            </Link>

            {/* Search bar */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A8A6B]" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="ابحث عن منتجات من كل المتاجر..."
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-full py-2.5 pr-10 pl-4 text-sm outline-none focus:border-[#C9A96A] focus:bg-white transition"
                />
                {q && (
                  <button onClick={() => setQ('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8A6B] hover:text-[#1A1A1E]">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Create store CTA */}
            <Link to="/" className="hidden md:flex bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white px-4 py-2 rounded-full text-xs font-bold items-center gap-1.5 hover:shadow-md transition shrink-0">
              <StoreIcon size={14} /> أنشئ متجرك
            </Link>
          </div>

          {/* Categories row (horizontal scroll) */}
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  category === cat.key
                    ? 'bg-[#1A1A1E] text-white'
                    : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                }`}
              >
                {cat.labelAr}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4">
        {/* ═══ HERO (only on first page, no filters) ═════════════════════ */}
        {page === 1 && !q && category === 'all' && !storeId && (
          <div className="relative rounded-3xl overflow-hidden mb-6 bg-gradient-to-l from-[#1A1A1E] via-[#2D2D35] to-[#1A1A1E]">
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#C9A96A]/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#A02A5B]/20 rounded-full blur-3xl" />
            <div className="relative p-6 md:p-10 text-white">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-3 py-1 text-xs font-bold mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {total} منتج من {stores.length} متجر
              </div>
              <h1 className="text-2xl md:text-4xl font-extrabold leading-tight">
                تسوّق من أفضل المتاجر الجزائرية
                <span className="block text-[#C9A96A] mt-1">في مكان واحد</span>
              </h1>
              <p className="text-white/70 text-sm md:text-base mt-3 max-w-lg leading-7">
                اكتشف آلاف المنتجات من متاجر جزائرية موثوقة. الدفع عند الاستلام، توصيل لكل الولايات، وأسعار تنافسية.
              </p>
              <div className="flex flex-wrap gap-3 mt-5">
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-xs font-bold">
                  <ShieldCheck size={14} className="text-emerald-400" /> دفع عند الاستلام
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-xs font-bold">
                  <Truck size={14} className="text-[#C9A96A]" /> توصيل 58 ولاية
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-xs font-bold">
                  <Package size={14} className="text-[#A02A5B]" /> {total} منتج
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TRENDING SECTION (only on first page, no filters) ═════════ */}
        {trending.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#A02A5B] to-[#7A1F44] grid place-items-center">
                <TrendingUp size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-extrabold text-[#1A1A1E]">الأكثر رواجاً</h2>
              <span className="text-xs text-[#9A8A6B]">— منتجات يبحث عنها الكل</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {trending.map(p => (
                <MarketplaceProductCard key={p._id} p={p} stores={stores} onClick={() => handleProductClick(p)} compact />
              ))}
            </div>
          </div>
        )}

        {/* ═══ MAIN LAYOUT: sidebar filters + product grid ═══════════════ */}
        <div className="grid lg:grid-cols-[220px_1fr] gap-6">
          {/* Filters sidebar (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-[140px] space-y-4">
              {/* Sort */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
                <div className="text-xs font-bold text-[#9A8A6B] mb-2">ترتيب حسب</div>
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value as any)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A96A]"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.labelAr}</option>
                  ))}
                </select>
              </div>

              {/* Price range */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
                <div className="text-xs font-bold text-[#9A8A6B] mb-2">نطاق السعر</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={minPrice || ''}
                    onChange={e => setMinPrice(Number(e.target.value) || 0)}
                    placeholder="من"
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-xs outline-none focus:border-[#C9A96A]"
                  />
                  <span className="text-[#9A8A6B]">—</span>
                  <input
                    type="number"
                    value={maxPrice || ''}
                    onChange={e => setMaxPrice(Number(e.target.value) || 0)}
                    placeholder="إلى"
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-xs outline-none focus:border-[#C9A96A]"
                  />
                </div>
              </div>

              {/* Stores */}
              {stores.length > 0 && (
                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
                  <div className="text-xs font-bold text-[#9A8A6B] mb-2">المتاجر</div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setStoreId('')}
                      className={`w-full text-right text-xs py-1.5 px-2 rounded-lg transition ${!storeId ? 'bg-[#1A1A1E] text-white font-bold' : 'text-[#4B5563] hover:bg-[#F3F4F6]'}`}
                    >
                      كل المتاجر
                    </button>
                    {stores.map(s => (
                      <button
                        key={s._id}
                        onClick={() => setStoreId(s._id)}
                        className={`w-full text-right text-xs py-1.5 px-2 rounded-lg transition ${storeId === s._id ? 'bg-[#1A1A1E] text-white font-bold' : 'text-[#4B5563] hover:bg-[#F3F4F6]'}`}
                      >
                        {s.nameAr || s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear filters */}
              {(q || category !== 'all' || minPrice || maxPrice || storeId) && (
                <button
                  onClick={() => { setQ(''); setCategory('all'); setMinPrice(0); setMaxPrice(0); setStoreId('') }}
                  className="w-full bg-white border border-[#E5E7EB] text-[#9A8A6B] hover:text-[#1A1A1E] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <X size={14} /> مسح الفلاتر
                </button>
              )}
            </div>
          </aside>

          {/* Product grid */}
          <div>
            {/* Mobile sort + filters bar */}
            <div className="flex items-center justify-between gap-2 mb-4 lg:hidden">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="bg-white border border-[#E5E7EB] rounded-full px-4 py-2 text-xs font-bold flex items-center gap-1.5"
              >
                <Package size={14} /> فلاتر
              </button>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as any)}
                className="bg-white border border-[#E5E7EB] rounded-full px-3 py-2 text-xs font-bold outline-none"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.labelAr}</option>
                ))}
              </select>
            </div>

            {/* Mobile filters drawer */}
            {showFilters && (
              <div className="lg:hidden bg-white border border-[#E5E7EB] rounded-2xl p-4 mb-4 space-y-3">
                <div>
                  <div className="text-xs font-bold text-[#9A8A6B] mb-1">نطاق السعر</div>
                  <div className="flex gap-2">
                    <input type="number" value={minPrice || ''} onChange={e => setMinPrice(Number(e.target.value) || 0)} placeholder="من" className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-xs" />
                    <input type="number" value={maxPrice || ''} onChange={e => setMaxPrice(Number(e.target.value) || 0)} placeholder="إلى" className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-xs" />
                  </div>
                </div>
                {stores.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-[#9A8A6B] mb-1">المتاجر</div>
                    <select value={storeId} onChange={e => setStoreId(e.target.value)} className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs">
                      <option value="">كل المتاجر</option>
                      {stores.map(s => <option key={s._id} value={s._id}>{s.nameAr || s.name}</option>)}
                    </select>
                  </div>
                )}
                <button onClick={() => setShowFilters(false)} className="w-full bg-[#1A1A1E] text-white py-2 rounded-xl text-xs font-bold">تطبيق</button>
              </div>
            )}

            {/* Results count */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[#9A8A6B]">
                {loading ? 'جاري التحميل...' : `${total} منتج`}
              </div>
              <div className="hidden lg:block text-xs text-[#9A8A6B]">
                صفحة {page} من {totalPages}
              </div>
            </div>

            {/* Product grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
                    <div className="aspect-square skeleton" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 skeleton rounded" />
                      <div className="h-4 w-1/2 skeleton rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-[#F3F4F6] grid place-items-center mx-auto mb-3">
                  <Search size={24} className="text-[#9A8A6B]" />
                </div>
                <div className="font-bold text-[#1A1A1E]">لا توجد منتجات مطابقة</div>
                <p className="text-sm text-[#9A8A6B] mt-1">جرب تغيير الفلاتر أو البحث بكلمة أخرى</p>
                {(q || category !== 'all' || minPrice || maxPrice || storeId) && (
                  <button onClick={() => { setQ(''); setCategory('all'); setMinPrice(0); setMaxPrice(0); setStoreId('') }} className="mt-4 bg-[#1A1A1E] text-white px-5 py-2 rounded-full text-xs font-bold">
                    مسح الفلاتر
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map(p => (
                  <MarketplaceProductCard key={p._id} p={p} stores={stores} onClick={() => handleProductClick(p)} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="bg-white border border-[#E5E7EB] rounded-full w-10 h-10 grid place-items-center disabled:opacity-40 hover:bg-[#F3F4F6] transition"
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const p = i + 1
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-10 h-10 rounded-full text-sm font-bold transition ${
                        page === p ? 'bg-[#1A1A1E] text-white' : 'bg-white border border-[#E5E7EB] text-[#4B5563] hover:bg-[#F3F4F6]'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="bg-white border border-[#E5E7EB] rounded-full w-10 h-10 grid place-items-center disabled:opacity-40 hover:bg-[#F3F4F6] transition"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Product Card (marketplace style — dense, colorful, AliExpress/Temu-like) ─
function MarketplaceProductCard({
  p,
  stores,
  onClick,
  compact = false,
}: {
  p: MarketplaceProduct
  stores: TenantStore[]
  onClick: () => void
  compact?: boolean
}) {
  const discount = p.compareAtPrice ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0
  const store = stores.find(s => s._id === p.storeId)
  const [imgError, setImgError] = useState(false)

  return (
    <button
      onClick={onClick}
      className="group bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden hover:shadow-lg hover:border-[#C9A96A]/40 transition-all text-right"
    >
      {/* Image */}
      <div className="relative aspect-square bg-[#F9FAFB] overflow-hidden">
        <SmartImage src={p.images[0] || ''} alt={p.nameAr} size={compact ? 'card' : 'card'} className="w-full h-full" />
        {/* Discount badge */}
        {discount > 0 && (
          <div className="absolute top-2 right-2 bg-gradient-to-l from-[#DC2626] to-[#B91C1C] text-white text-[10px] font-extrabold px-2 py-1 rounded-full shadow">
            -{discount}%
          </div>
        )}
        {/* New badge */}
        {p.isNew && (
          <div className="absolute top-2 left-2 bg-[#10B981] text-white text-[10px] font-bold px-2 py-1 rounded-full">
            جديد
          </div>
        )}
      </div>
      {/* Content */}
      <div className="p-2.5">
        {/* Store name */}
        {store && (
          <div className="text-[10px] text-[#9A8A6B] mb-1 flex items-center gap-1 truncate">
            <StoreIcon size={10} className="shrink-0" />
            <span className="truncate">{store.nameAr || store.name}</span>
          </div>
        )}
        {/* Product name */}
        <div className="text-xs font-medium text-[#1A1A1E] line-clamp-2 leading-5 min-h-[40px]">
          {p.nameAr}
        </div>
        {/* Price */}
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className="font-extrabold text-[#DC2626] text-sm">{formatDZD(p.price)}</span>
          {p.compareAtPrice && (
            <span className="text-[10px] text-[#9A8A6B] line-through">{formatDZD(p.compareAtPrice)}</span>
          )}
        </div>
        {/* Rating + views */}
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#9A8A6B]">
          {p.rating > 0 && (
            <div className="flex items-center gap-0.5">
              <Star size={10} className="fill-[#FBBF24] text-[#FBBF24]" />
              <span className="font-bold">{p.rating.toFixed(1)}</span>
            </div>
          )}
          {(p.marketplaceViews || 0) > 0 && (
            <div className="flex items-center gap-0.5">
              <Eye size={10} />
              <span>{p.marketplaceViews}</span>
            </div>
          )}
          {p.stock <= 5 && p.stock > 0 && (
            <span className="text-[#F59E0B] font-bold">باقي {p.stock}</span>
          )}
        </div>
      </div>
    </button>
  )
}
