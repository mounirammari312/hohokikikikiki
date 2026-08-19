/**
 * Marketplace — Professional multi-category marketplace
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Features:
 *    - LEFT SIDEBAR (persistent on desktop, drawer on mobile):
 *      • Logo + "أنشئ متجرك" CTA
 *      • Main categories with icons (electronics, fashion, beauty, etc.)
 *      • Price range filter
 *      • Store filter (browse by merchant)
 *      • Clear filters button
 *
 *    - TOP BAR:
 *      • Search (full width)
 *      • Sort dropdown
 *      • Results count
 *
 *    - HERO BANNER (first page only):
 *      • Gradient + live stats
 *
 *    - FLASH DEALS section (discounted products)
 *    - TRENDING section (most viewed)
 *    - NEW ARRIVALS section (recently published)
 *    - ALL PRODUCTS grid (paginated)
 *
 *    - PRODUCT CARDS (AliExpress/Temu style):
 *      • Image with discount badge
 *      • Store name + verified badge
 *      • Product name (2 lines)
 *      • Price in red + original price strikethrough
 *      • Rating stars + sold count
 *      • "COD" badge (cash on delivery)
 *      • Stock indicator
 *
 *  This page is PUBLIC — no auth required. Anyone can browse.
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Search, Star, TrendingUp, X, Package, Truck, ShieldCheck, Store as StoreIcon,
  Eye, ChevronLeft, ChevronRight, Menu, Flame, Sparkles, Tag, Home as HomeIcon,
  Smartphone, Shirt, Heart, Droplet, Watch, Book, Gamepad2, Dumbbell, Baby,
  Wrench, Palette, Gift, Zap, Crown, ShoppingBag, CheckCircle2
} from 'lucide-react'
import { fetchMarketplaceProducts, fetchMarketplaceStores, trackMarketplaceView } from '../services/api/client'
import type { MarketplaceProduct } from '../services/api/client'
import type { TenantStore } from '../services/api/types'
import { formatDZD } from '../lib/utils'
import { SmartImage } from '../components/SmartImage'

// ─── Main marketplace categories (broad, multi-niche) ──────────────────────
// These are TOP-LEVEL categories that cover ALL possible merchant niches.
// Each has an icon (lucide-react) + Arabic label.
const MAIN_CATEGORIES = [
  { key: 'all',           labelAr: 'كل الفئات',    icon: ShoppingBag },
  { key: 'electronics',   labelAr: 'إلكترونيات',    icon: Smartphone },
  { key: 'fashion',       labelAr: 'موضة وملابس',   icon: Shirt },
  { key: 'beauty',        labelAr: 'جمال وعناية',   icon: Heart },
  { key: 'jewelry',       labelAr: 'مجوهرات',        icon: Crown },
  { key: 'watches',       labelAr: 'ساعات',          icon: Watch },
  { key: 'home',          labelAr: 'منزل ومطبخ',     icon: HomeIcon },
  { key: 'perfume',       labelAr: 'عطور',           icon: Droplet },
  { key: 'books',         labelAr: 'كتب وقرطاسية',   icon: Book },
  { key: 'toys',          labelAr: 'ألعاب',          icon: Gamepad2 },
  { key: 'sports',        labelAr: 'رياضة ولياقة',   icon: Dumbbell },
  { key: 'baby',          labelAr: 'أطفال ورضع',     icon: Baby },
  { key: 'tools',         labelAr: 'أدوات وDIY',     icon: Wrench },
  { key: 'art',           labelAr: 'فن وحرف يدوية',  icon: Palette },
  { key: 'gifts',         labelAr: 'هدايا',           icon: Gift },
  { key: 'general',       labelAr: 'أخرى',           icon: Package },
]

// Sub-categories mapping (maps product.category from seed domains to main categories)
const CATEGORY_MAP: Record<string, string> = {
  necklace: 'jewelry', ring: 'jewelry', earring: 'jewelry', bracelet: 'jewelry',
  dress: 'fashion', abaya: 'fashion', hijab: 'fashion', bag: 'fashion', shoes: 'fashion',
  perfume: 'perfume', makeup: 'beauty', skincare: 'beauty', hair: 'beauty',
  general: 'general',
}

const SORT_OPTIONS = [
  { value: 'newest', labelAr: 'الأحدث' },
  { value: 'popular', labelAr: 'الأكثر رواجاً' },
  { value: 'price_low', labelAr: 'السعر: الأقل أولاً' },
  { value: 'price_high', labelAr: 'السعر: الأعلى أولاً' },
] as const

export default function Marketplace() {
  const { slug: storeSlug } = useParams()
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

  // Mobile sidebar drawer
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // If viewing a specific store's marketplace page (/marketplace/store/:slug)
  const [storeProfile, setStoreProfile] = useState<TenantStore | null>(null)

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      // Map main category to product categories for filtering
      // e.g. if user selects "jewelry", we need to filter by necklace OR ring OR earring OR bracelet
      let categoryFilter = category
      if (category !== 'all' && CATEGORY_MAP[category]) {
        // It's a sub-category, use as-is
      } else if (category !== 'all') {
        // It's a main category — find all sub-categories that map to it
        const subCats = Object.entries(CATEGORY_MAP).filter(([, main]) => main === category).map(([sub]) => sub)
        if (subCats.length > 0) {
          // The API accepts a single category — we'll filter client-side for now
          // TODO: server should accept comma-separated categories
        }
      }

      const res = await fetchMarketplaceProducts({
        q: q || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        sort,
        page,
        limit: 24,
        minPrice: minPrice > 0 ? minPrice : undefined,
        maxPrice: maxPrice > 0 ? maxPrice : undefined,
        storeId: storeId || undefined,
      })
      let fetchedProducts = res.products || []

      // Client-side main-category filtering (when a main category is selected,
      // filter by all sub-categories that belong to it)
      if (category !== 'all' && !CATEGORY_MAP[category]) {
        const subCats = Object.entries(CATEGORY_MAP).filter(([, main]) => main === category).map(([sub]) => sub)
        if (subCats.length > 0) {
          fetchedProducts = fetchedProducts.filter(p => subCats.includes(p.category))
        }
      }

      setProducts(fetchedProducts)
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
  useEffect(() => { setPage(1) }, [q, category, sort, minPrice, maxPrice, storeId])

  // If storeSlug is provided, fetch that store's profile
  useEffect(() => {
    if (storeSlug) {
      void (async () => {
        try {
          const { fetchMarketplaceStore } = await import('../services/api/client')
          const { store, products } = await fetchMarketplaceStore(storeSlug)
          setStoreProfile(store)
          setProducts(products)
          setTotal(products.length)
          setTotalPages(1)
        } catch {
          setStoreProfile(null)
        } finally {
          setLoading(false)
        }
      })()
    } else {
      setStoreProfile(null)
    }
  }, [storeSlug])

  const handleProductClick = (p: MarketplaceProduct) => {
    void trackMarketplaceView(p._id)
    const store = stores.find(s => s._id === p.storeId) || storeProfile
    if (store) {
      navigate(`/product/${p._id}?store=${encodeURIComponent(store.slug)}`)
    }
  }

  // Sections for the main page (first page, no filters)
  const isMainPage = page === 1 && !q && category === 'all' && !storeId && !storeSlug

  const flashDeals = useMemo(() => {
    if (!isMainPage) return []
    return products.filter(p => p.compareAtPrice && p.compareAtPrice > p.price).slice(0, 6)
  }, [products, isMainPage])

  const trending = useMemo(() => {
    if (!isMainPage) return []
    return [...products].sort((a, b) => (b.marketplaceViews || 0) - (a.marketplaceViews || 0)).slice(0, 6)
  }, [products, isMainPage])

  const newArrivals = useMemo(() => {
    if (!isMainPage) return []
    return [...products].sort((a, b) => {
      const aTime = (a as any).marketplacePublishedAt || ''
      const bTime = (b as any).marketplacePublishedAt || ''
      return bTime.localeCompare(aTime)
    }).slice(0, 6)
  }, [products, isMainPage])

  const hasActiveFilters = q || category !== 'all' || minPrice || maxPrice || storeId

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* ═══ SIDEBAR ═════════════════════════════════════════════════════ */}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-[#1A1A1E]/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed lg:sticky top-0 right-0 z-50 lg:z-0 h-screen w-[280px] shrink-0 bg-white border-l border-[#E5E7EB] flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A1A1E] to-[#3D3D45] grid place-items-center">
              <span className="cormorant text-[#C9A96A] text-lg font-bold">L</span>
            </div>
            <div>
              <div className="font-extrabold text-sm leading-tight text-[#1A1A1E]">LUMIÈRE</div>
              <div className="text-[10px] tracking-widest text-[#9A8A6B]">MARKETPLACE</div>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden w-8 h-8 rounded-full bg-[#F3F4F6] grid place-items-center">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-4 space-y-5">
          {/* Navigation */}
          <div>
            <div className="text-[10px] font-bold text-[#9A8A6B] tracking-widest px-2 mb-1.5">التصفح</div>
            <Link to="/marketplace" className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${!storeSlug && category === 'all' ? 'bg-[#1A1A1E] text-white' : 'text-[#4B5563] hover:bg-[#F3F4F6]'}`}>
              <HomeIcon size={16} />
              <span className="flex-1 text-right font-medium">الرئيسية</span>
            </Link>
          </div>

          {/* Categories */}
          <div>
            <div className="text-[10px] font-bold text-[#9A8A6B] tracking-widest px-2 mb-1.5">الفئات</div>
            <div className="space-y-0.5">
              {MAIN_CATEGORIES.map(cat => {
                const Icon = cat.icon
                const active = category === cat.key
                return (
                  <button
                    key={cat.key}
                    onClick={() => { setCategory(cat.key); setStoreId(''); setSidebarOpen(false) }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${active ? 'bg-[#1A1A1E] text-white' : 'text-[#4B5563] hover:bg-[#F3F4F6]'}`}
                  >
                    <Icon size={16} className={active ? 'text-[#C9A96A]' : 'text-[#9A8A6B]'} />
                    <span className="flex-1 text-right font-medium">{cat.labelAr}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Price filter */}
          <div>
            <div className="text-[10px] font-bold text-[#9A8A6B] tracking-widest px-2 mb-1.5">نطاق السعر</div>
            <div className="px-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minPrice || ''}
                  onChange={e => setMinPrice(Number(e.target.value) || 0)}
                  placeholder="من"
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A96A]"
                />
                <span className="text-[#9A8A6B] text-xs">—</span>
                <input
                  type="number"
                  value={maxPrice || ''}
                  onChange={e => setMaxPrice(Number(e.target.value) || 0)}
                  placeholder="إلى"
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#C9A96A]"
                />
              </div>
              <button onClick={() => { setMinPrice(0); setMaxPrice(0) }} className="text-[10px] text-[#9A8A6B] hover:text-[#1A1A1E]">مسح السعر</button>
            </div>
          </div>

          {/* Stores */}
          {stores.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[#9A8A6B] tracking-widest px-2 mb-1.5">المتاجر ({stores.length})</div>
              <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                <button
                  onClick={() => setStoreId('')}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition ${!storeId ? 'bg-[#F3F4F6] font-bold text-[#1A1A1E]' : 'text-[#4B5563] hover:bg-[#F3F4F6]'}`}
                >
                  <StoreIcon size={12} />
                  <span className="flex-1 text-right">كل المتاجر</span>
                </button>
                {stores.map(s => (
                  <button
                    key={s._id}
                    onClick={() => setStoreId(s._id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition ${storeId === s._id ? 'bg-[#F3F4F6] font-bold text-[#1A1A1E]' : 'text-[#4B5563] hover:bg-[#F3F4F6]'}`}
                  >
                    <StoreIcon size={12} className="text-[#9A8A6B]" />
                    <span className="flex-1 text-right truncate">{s.nameAr || s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={() => { setQ(''); setCategory('all'); setMinPrice(0); setMaxPrice(0); setStoreId('') }}
              className="w-full bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <X size={14} /> مسح كل الفلاتر
            </button>
          )}
        </div>

        {/* Bottom: Create store CTA */}
        <div className="border-t border-[#E5E7EB] p-3 shrink-0">
          <Link to="/" className="block bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white rounded-xl p-3 text-center hover:shadow-lg transition">
            <div className="font-bold text-sm flex items-center justify-center gap-1.5">
              <StoreIcon size={14} /> أنشئ متجرك
            </div>
            <div className="text-[10px] text-white/60 mt-0.5">مجاناً — في أقل من دقيقة</div>
          </Link>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] shadow-sm">
          <div className="px-4 md:px-6 py-3 flex items-center gap-3">
            {/* Mobile menu button */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 rounded-xl bg-[#F3F4F6] grid place-items-center shrink-0">
              <Menu size={18} />
            </button>

            {/* Search */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A8A6B]" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="ابحث في آلاف المنتجات..."
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-full py-2.5 pr-10 pl-4 text-sm outline-none focus:border-[#C9A96A] focus:bg-white transition"
                />
                {q && (
                  <button onClick={() => setQ('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8A6B] hover:text-[#1A1A1E]">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Sort */}
            <select
              value={sort}
              onChange={e => setSort(e.target.value as any)}
              className="bg-white border border-[#E5E7EB] rounded-full px-3 py-2 text-xs font-bold outline-none cursor-pointer hover:bg-[#F3F4F6] transition"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.labelAr}</option>
              ))}
            </select>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 p-4 md:p-6">
          {/* Store profile header (when viewing /marketplace/store/:slug) */}
          {storeProfile && (
            <div className="bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white rounded-2xl p-6 mb-6 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#C9A96A]/15 rounded-full blur-3xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white grid place-items-center shrink-0">
                  <StoreIcon size={24} className="text-[#1A1A1E]" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold">{storeProfile.nameAr || storeProfile.name}</h1>
                  <p className="text-white/60 text-sm mt-1">{products.length} منتج منشور في السوق العام</p>
                </div>
                <Link to={`/?store=${storeProfile.slug}`} className="mr-auto bg-white text-[#1A1A1E] px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-[#FFFCF8] transition">
                  <StoreIcon size={14} /> زيارة المتجر
                </Link>
              </div>
            </div>
          )}

          {/* Hero banner (main page only) */}
          {isMainPage && !storeProfile && (
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

          {/* Flash Deals section */}
          {flashDeals.length > 0 && (
            <Section title="عروض اليوم" subtitle="خصومات حصرية لفترة محدودة" icon={Zap} iconBg="from-[#DC2626] to-[#B91C1C]">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {flashDeals.map(p => <MarketplaceProductCard key={p._id} p={p} stores={stores} onClick={() => handleProductClick(p)} />)}
              </div>
            </Section>
          )}

          {/* Trending section */}
          {trending.length > 0 && (
            <Section title="الأكثر رواجاً" subtitle="منتجات يبحث عنها الجميع" icon={Flame} iconBg="from-[#A02A5B] to-[#7A1F44]">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {trending.map(p => <MarketplaceProductCard key={p._id} p={p} stores={stores} onClick={() => handleProductClick(p)} />)}
              </div>
            </Section>
          )}

          {/* New arrivals section */}
          {newArrivals.length > 0 && (
            <Section title="وصل حديثاً" subtitle="أحدث المنتجات في السوق" icon={Sparkles} iconBg="from-[#C9A96A] to-[#B8945A]">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {newArrivals.map(p => <MarketplaceProductCard key={p._id} p={p} stores={stores} onClick={() => handleProductClick(p)} />)}
              </div>
            </Section>
          )}

          {/* All products / filtered results */}
          <div className="mt-6">
            {/* Section header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#1A1A1E]">
                  {storeProfile ? 'منتجات المتجر' : hasActiveFilters ? 'نتائج البحث' : 'كل المنتجات'}
                </h2>
                <p className="text-xs text-[#9A8A6B] mt-0.5">
                  {loading ? 'جاري التحميل...' : `${total} منتج`}
                </p>
              </div>
              {totalPages > 1 && (
                <div className="text-xs text-[#9A8A6B]">
                  صفحة {page} من {totalPages}
                </div>
              )}
            </div>

            {/* Product grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
                    <div className="aspect-square skeleton" />
                    <div className="p-2.5 space-y-2">
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
                <p className="text-sm text-[#9A8A6B] mt-1">جرّب تغيير الفلاتر أو كلمة البحث</p>
                {hasActiveFilters && (
                  <button onClick={() => { setQ(''); setCategory('all'); setMinPrice(0); setMaxPrice(0); setStoreId('') }} className="mt-4 bg-[#1A1A1E] text-white px-5 py-2 rounded-full text-xs font-bold">
                    مسح الفلاتر
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
                  <ChevronRight size={18} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const p = i + 1
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-10 h-10 rounded-full text-sm font-bold transition ${page === p ? 'bg-[#1A1A1E] text-white' : 'bg-white border border-[#E5E7EB] text-[#4B5563] hover:bg-[#F3F4F6]'}`}
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
                  <ChevronLeft size={18} />
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-[#1A1A1E] text-white/40 py-6 px-4 md:px-6 mt-8">
          <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/10 grid place-items-center">
                <span className="cormorant text-[#C9A96A] text-sm font-bold">L</span>
              </div>
              <span className="text-white/60 font-bold">LUMIÈRE Marketplace</span>
            </div>
            <div className="flex gap-4">
              <Link to="/" className="hover:text-white transition">المنصة</Link>
              <Link to="/marketplace" className="hover:text-white transition">السوق</Link>
              <a href="#" className="hover:text-white transition">شروط الاستخدام</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ─── Section wrapper (title + icon + content) ───────────────────────────────
function Section({ title, subtitle, icon: Icon, iconBg, children }: {
  title: string
  subtitle: string
  icon: any
  iconBg: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${iconBg} grid place-items-center shrink-0`}>
          <Icon size={16} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-[#1A1A1E]">{title}</h2>
          <p className="text-[11px] text-[#9A8A6B]">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Product Card (AliExpress/Temu style) ────────────────────────────────────
function MarketplaceProductCard({ p, stores, onClick }: {
  p: MarketplaceProduct
  stores: TenantStore[]
  onClick: () => void
}) {
  const discount = p.compareAtPrice ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0
  const store = stores.find(s => s._id === p.storeId)
  const views = (p as any).marketplaceViews || 0

  return (
    <button
      onClick={onClick}
      className="group bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden hover:shadow-lg hover:border-[#C9A96A]/40 transition-all text-right w-full"
    >
      {/* Image */}
      <div className="relative aspect-square bg-[#F9FAFB] overflow-hidden">
        <SmartImage src={p.images[0] || ''} alt={p.nameAr} size="card" className="w-full h-full" />
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
        {/* Rating + views + COD badge */}
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#9A8A6B]">
          {p.rating > 0 && (
            <div className="flex items-center gap-0.5">
              <Star size={10} className="fill-[#FBBF24] text-[#FBBF24]" />
              <span className="font-bold">{p.rating.toFixed(1)}</span>
            </div>
          )}
          {views > 0 && (
            <div className="flex items-center gap-0.5">
              <Eye size={10} />
              <span>{views}</span>
            </div>
          )}
          <div className="flex items-center gap-0.5 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
            <ShieldCheck size={9} /> COD
          </div>
        </div>
        {/* Low stock indicator */}
        {p.stock <= 5 && p.stock > 0 && (
          <div className="text-[10px] text-[#F59E0B] font-bold mt-1">⚡ باقي {p.stock} قطع</div>
        )}
      </div>
    </button>
  )
}
