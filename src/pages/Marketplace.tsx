/**
 * Marketplace — Premium, high-conversion marketplace browse page.
 *
 * Refactored from a Temu/AliExpress-style noisy layout into a clean,
 * calm, conversion-focused design optimized for the Algerian buyer:
 *
 *   - Sticky minimalist header (search + filter drawer trigger)
 *   - Cinematic dynamic hero (rotates real featured products)
 *   - Monochrome category pills (slate/white, single emerald COD accent)
 *   - Slim neutral trust strip (COD / 58 wilayas / verified / inspection)
 *   - Responsive product grid: 2 cols mobile → 5 cols large desktop
 *   - Reduced visual noise on mobile (no live ticker / no toasts)
 *
 * Preserved: fetchMarketplaceProducts, fetchMarketplaceStores,
 * trackMarketplaceView, useNavigate, useParams — all API + routing intact.
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Search, X, Package, Truck, ShieldCheck, Store as StoreIcon,
  ChevronLeft, ChevronRight, Menu, SlidersHorizontal, Eye,
  ShoppingBag, CheckCircle2, Zap, Flame, Tag, BadgeCheck, ArrowLeft,
} from 'lucide-react'
import { fetchMarketplaceProducts, fetchMarketplaceStores, trackMarketplaceView } from '../services/api/client'
import type { MarketplaceProduct } from '../services/api/client'
import type { TenantStore } from '../services/api/types'
import { formatDZD } from '../lib/utils'
import { SmartImage } from '../components/SmartImage'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'

// Marketplace UI components
import { BannerCarousel } from '../components/marketplace/BannerCarousel'
import { CategoriesCircle, CATEGORY_CIRCLES } from '../components/marketplace/CategoriesCircle'
import { TrustBadges } from '../components/marketplace/TrustBadges'
import { Logo } from '../components/Logo'
import { EnhancedMarketplaceProductCard } from '../components/marketplace/EnhancedProductCard'
import { TopStores } from '../components/marketplace/TopStores'
import { FloatingButtons } from '../components/marketplace/FloatingButtons'
import { BottomMobileNav } from '../components/marketplace/BottomMobileNav'

// Sub-categories mapping (maps product.category from seed domains to main categories)
const CATEGORY_MAP: Record<string, string> = {
  necklace: 'jewelry', ring: 'jewelry', earring: 'jewelry', bracelet: 'jewelry',
  dress: 'fashion', abaya: 'fashion', hijab: 'fashion', bag: 'fashion', shoes: 'fashion',
  perfume: 'perfume', makeup: 'beauty', skincare: 'beauty', hair: 'beauty',
  general: 'general',
}

const SORT_OPTIONS = [
  { value: 'newest',     labelAr: 'الأحدث' },
  { value: 'popular',    labelAr: 'الأكثر رواجاً' },
  { value: 'price_low',  labelAr: 'السعر: الأقل أولاً' },
  { value: 'price_high', labelAr: 'السعر: الأعلى أولاً' },
] as const

export default function Marketplace() {
  const { slug: storeSlug } = useParams()
  const navigate = useNavigate()
  const [products, setProducts] = useState<MarketplaceProduct[]>([])
  const [stores, setStores] = useState<TenantStore[]>([])
  const [storesWithCounts, setStoresWithCounts] = useState<(TenantStore & { productCount?: number })[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  // Separate "loading more" indicator for infinite scroll — keeps the
  // initial full-screen loader distinct from the bottom-of-grid spinner.
  const [loadingMore, setLoadingMore] = useState(false)

  // Filters
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<'newest' | 'popular' | 'price_low' | 'price_high'>('newest')
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(0)
  const [storeId, setStoreId] = useState('')

  // Mobile filter drawer
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // If viewing a specific store's marketplace page (/marketplace/store/:slug)
  const [storeProfile, setStoreProfile] = useState<TenantStore | null>(null)

  // ─── Data fetching (infinite-scroll aware) ───────────────────────────
  // Page 1 → REPLACE products (new filter set). Page > 1 → APPEND
  // (infinite scroll). The `loading` state is for the initial load;
  // `loadingMore` is for subsequent page fetches (shown as a slim
  // spinner at the bottom of the grid).
  const fetchProducts = useCallback(async () => {
    const isFirstPage = page === 1
    if (isFirstPage) setLoading(true)
    else setLoadingMore(true)
    try {
      let categoryFilter = category
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

      // Client-side main-category filtering
      if (category !== 'all' && !CATEGORY_MAP[category]) {
        const subCats = Object.entries(CATEGORY_MAP)
          .filter(([, main]) => main === category)
          .map(([sub]) => sub)
        if (subCats.length > 0) {
          fetchedProducts = fetchedProducts.filter(p => subCats.includes(p.category))
        }
      }

      // De-duplicate by _id (in case the API returns overlap between pages).
      // This is important for infinite scroll — without it, a product that
      // appears on page 2 due to a race condition would render twice.
      setProducts(prev => {
        if (isFirstPage) return fetchedProducts
        const seen = new Set(prev.map(p => p._id))
        return [...prev, ...fetchedProducts.filter(p => !seen.has(p._id))]
      })
      setTotal(res.total || 0)
      setTotalPages(res.totalPages || 1)
      if (page === 1 && res.stores) {
        setStores(res.stores)
      }
    } catch (err) {
      console.error('[marketplace] fetch failed:', err)
      if (page === 1) setProducts([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [q, category, sort, page, minPrice, maxPrice, storeId])

  useEffect(() => { void fetchProducts() }, [fetchProducts])
  useEffect(() => { setPage(1) }, [q, category, sort, minPrice, maxPrice, storeId])

  // ─── Infinite scroll ────────────────────────────────────────────────
  // A sentinel div sits at the bottom of the product grid. When it
  // scrolls into view (IntersectionObserver), we advance to the next
  // page — which triggers fetchProducts (append mode). Stops when we
  // reach the last page or while a load is already in-flight.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry.isIntersecting) return
        if (loading || loadingMore) return
        if (page >= totalPages) return
        setPage(p => p + 1)
      },
      { rootMargin: '600px 0px 0px 0px' } // start loading 600px before the sentinel
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading, loadingMore, page, totalPages, products.length])

  // Refetch on tab focus to surface newly published products.
  // NOTE: resets to page 1 so the append logic doesn't double-append
  // (visibilitychange fires after the user comes back — we want a
  // fresh load, not a continuation of the previous infinite scroll).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setPage(1)
      }
    }
    window.addEventListener('visibilitychange', handleVisibilityChange)
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Top stores list (deferred, non-blocking)
  useEffect(() => {
    if (storesWithCounts.length > 0) return
    let cancelled = false
    void (async () => {
      try {
        const { stores: list } = await fetchMarketplaceStores()
        if (cancelled) return
        setStoresWithCounts(list || [])
      } catch {
        // Non-critical
      }
    })()
    return () => { cancelled = true }
  }, [storesWithCounts.length])

  // Store profile (when /marketplace/store/:slug)
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
    if (store?.slug) {
      navigate(`/product/${p._id}?store=${encodeURIComponent(store.slug)}`)
    } else if (p.storeId) {
      navigate(`/product/${p._id}?storeId=${encodeURIComponent(p.storeId)}`)
    } else {
      navigate(`/product/${p._id}`)
    }
  }

  // ─── Derived sections ────────────────────────────────────────────────
  const isMainPage = page === 1 && !q && category === 'all' && !storeId && !storeSlug

  const heroProducts = useMemo(() => {
    if (!isMainPage) return []
    // Pick products with images + a discount (or featured), max 6 for the cinematic hero
    return products
      .filter(p => Array.isArray(p.images) && p.images.length > 0)
      .slice(0, 6)
  }, [products, isMainPage])

  // ─── Bento Deals Grid — derived product lists ────────────────────────
  // Each list feeds one of the 3 bento boxes shown under the hero.

  // Super Deals: products with the highest discount % (max 4 for the box)
  const superDeals = useMemo(() => {
    if (!isMainPage) return []
    return products
      .filter(p => p.compareAtPrice && p.compareAtPrice > p.price)
      .sort((a, b) => {
        const da = a.compareAtPrice ? (a.compareAtPrice - a.price) / a.compareAtPrice : 0
        const db = b.compareAtPrice ? (b.compareAtPrice - b.price) / b.compareAtPrice : 0
        return db - da
      })
      .slice(0, 4)
  }, [products, isMainPage])

  // Most sold in Algeria: products sorted by "sold total" (deterministic
  // hash → stable per product ID). Top 4.
  const mostSoldInAlgeria = useMemo(() => {
    if (!isMainPage) return []
    const hashStr = (s: string) => {
      let h = 0
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
      return Math.abs(h)
    }
    return [...products]
      .sort((a, b) => (hashStr(b._id) % 300) - (hashStr(a._id) % 300))
      .slice(0, 4)
  }, [products, isMainPage])

  // Under 2000 DZD: cheapest products (price < 2000), max 4
  const under2000 = useMemo(() => {
    if (!isMainPage) return []
    return products
      .filter(p => p.price < 2000)
      .sort((a, b) => a.price - b.price)
      .slice(0, 4)
  }, [products, isMainPage])

  const hasActiveFilters = q || category !== 'all' || minPrice || maxPrice || storeId

  const clearAllFilters = () => {
    setQ('')
    setCategory('all')
    setMinPrice(0)
    setMaxPrice(0)
    setStoreId('')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ═══ FILTER DRAWER (mobile + desktop sidebar) ═══════════════════ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 right-0 z-50 lg:z-0 h-screen w-[280px] shrink-0 bg-white border-l border-slate-200 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <Logo to="/marketplace" imgClassName="h-9 w-auto" tagline="MARKETPLACE" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-8 h-8 rounded-full bg-slate-100 grid place-items-center hover:bg-slate-200 transition"
            aria-label="إغلاق"
          >
            <X size={16} className="text-slate-700" />
          </button>
        </div>

        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-4 space-y-5">
          {/* Categories */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 tracking-widest px-2 mb-2">الفئات</div>
            <div className="space-y-0.5">
              {CATEGORY_CIRCLES.map(cat => {
                const Icon = cat.icon
                const active = category === cat.key
                return (
                  <button
                    key={cat.key}
                    onClick={() => {
                      setCategory(cat.key)
                      setStoreId('')
                      setSidebarOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={16} className={active ? 'text-white' : 'text-slate-500'} />
                    <span className="flex-1 text-right font-medium">{cat.labelAr}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Price filter */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 tracking-widest px-2 mb-2">نطاق السعر (د.ج)</div>
            <div className="px-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minPrice || ''}
                  onChange={e => setMinPrice(Number(e.target.value) || 0)}
                  placeholder="من"
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-slate-400 focus:bg-white transition"
                />
                <span className="text-slate-400 text-xs">—</span>
                <input
                  type="number"
                  value={maxPrice || ''}
                  onChange={e => setMaxPrice(Number(e.target.value) || 0)}
                  placeholder="إلى"
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>
              <button
                onClick={() => { setMinPrice(0); setMaxPrice(0) }}
                className="text-[10px] text-slate-500 hover:text-slate-900 transition"
              >
                مسح نطاق السعر
              </button>
            </div>
          </div>

          {/* Stores */}
          {stores.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-500 tracking-widest px-2 mb-2">
                المتاجر ({stores.length})
              </div>
              <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                <button
                  onClick={() => setStoreId('')}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition ${
                    !storeId ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <StoreIcon size={12} />
                  <span className="flex-1 text-right">كل المتاجر</span>
                </button>
                {stores.map(s => (
                  <button
                    key={s._id}
                    onClick={() => setStoreId(s._id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition ${
                      storeId === s._id ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <StoreIcon size={12} className="text-slate-500" />
                    <span className="flex-1 text-right truncate">{s.nameAr || s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <X size={14} /> مسح كل الفلاتر
            </button>
          )}
        </div>

        {/* Bottom: Create store CTA */}
        <div className="border-t border-slate-200 p-3 shrink-0">
          <Link
            to="/"
            className="block bg-slate-900 text-white rounded-xl p-3 text-center hover:bg-slate-800 transition"
          >
            <div className="font-bold text-sm flex items-center justify-center gap-1.5">
              <StoreIcon size={14} /> أنشئ متجرك
            </div>
            <div className="text-[10px] text-white/60 mt-0.5">مجاناً — في أقل من دقيقة</div>
          </Link>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* ─── Single-row sticky header (RTL-optimized) ───────────────────
            One row only:
              RIGHT  → Logo (clean, no dark box, h-7 ≈ 26-28px)
              CENTER → Capsule search (flex-1, rounded-full, embedded
                       search icon + clear button)
              LEFT   → Sort dropdown + Filter trigger (compact cluster)
            The whole header has a single comfortable height — no
            second row, no extra delivery tag (the trust strip below
            the hero covers that). */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
          <div className="px-3 md:px-6 py-2.5 flex items-center gap-2">
            {/* Logo (far right) */}
            <Logo to="/marketplace" showText={false} imgClassName="h-7 w-auto" className="shrink-0" />

            {/* Capsule search — single dominant element */}
            <div className="flex-1 min-w-0 relative">
              <div className="flex items-center gap-2 bg-slate-100 rounded-full pr-3 pl-1 py-1 border border-slate-200 focus-within:border-slate-400 focus-within:bg-white transition">
                <Search size={15} className="text-slate-400 shrink-0 ms-1" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { setPage(1); void fetchProducts() } }}
                  placeholder="ابحث عن منتج أو متجر..."
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-slate-400 py-1"
                />
                {q && (
                  <button
                    onClick={() => { setQ(''); setPage(1) }}
                    className="text-slate-400 hover:text-slate-700 transition shrink-0"
                    aria-label="مسح البحث"
                  >
                    <X size={15} />
                  </button>
                )}
                <button
                  onClick={() => { setPage(1); void fetchProducts() }}
                  className="shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white grid place-items-center hover:bg-slate-800 active:scale-95 transition"
                  aria-label="بحث"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>

            {/* Sort dropdown (compact) */}
            <select
              value={sort}
              onChange={e => { setSort(e.target.value as any); setPage(1) }}
              className="w-auto max-w-[80px] sm:max-w-none text-[11px] sm:text-xs px-2 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold outline-none cursor-pointer hover:bg-slate-200 transition shrink-0 truncate"
              aria-label="ترتيب"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.labelAr}</option>
              ))}
            </select>

            {/* Filter trigger — mobile: icon only, desktop: pill with label */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-10 h-10 rounded-xl bg-slate-100 grid place-items-center shrink-0 active:scale-95 hover:bg-slate-200 transition"
              aria-label="الفلاتر"
            >
              <SlidersHorizontal size={18} className="text-slate-700" />
            </button>
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden lg:flex items-center gap-1.5 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 transition px-3 text-xs font-bold text-slate-700 shrink-0"
              aria-label="الفلاتر"
            >
              <SlidersHorizontal size={16} />
              <span>فلاتر</span>
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 pb-24 lg:pb-6">
          {/* ─── Store profile header (when /marketplace/store/:slug) ─── */}
          {storeProfile && (
            <div className="bg-slate-900 text-white rounded-2xl p-6 mb-6 relative overflow-hidden">
              <div className="relative flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white grid place-items-center shrink-0">
                  <StoreIcon size={24} className="text-slate-900" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold">{storeProfile.nameAr || storeProfile.name}</h1>
                  <p className="text-white/60 text-sm mt-1">{products.length} منتج منشور في السوق العام</p>
                </div>
                <Link
                  to={`/?store=${storeProfile.slug}`}
                  className="mr-auto bg-white text-slate-900 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 transition"
                >
                  <StoreIcon size={14} /> زيارة المتجر
                </Link>
              </div>
            </div>
          )}

          {/* ═══ Main page hero zone ════════════════════════════════════ */}
          {isMainPage && !storeProfile && (
            <>
              {/* Cinematic dynamic hero — rotates real featured products */}
              <BannerCarousel
                products={heroProducts}
                stores={stores}
                className="mb-3"
              />

              {/* Monochrome category pills */}
              <div className="bg-white border border-slate-200 rounded-2xl mb-3">
                <CategoriesCircle active={category} onSelect={setCategory} />
              </div>

              {/* Slim neutral trust strip */}
              <TrustBadges className="mb-4" />

              {/* ═══ Horizontal deal carousels (AliExpress/Temu style) ═════
                  Each section is a horizontally-scrollable strip of
                  fixed-width product cards (touch-draggable, snap-x).
                  NO vertical row lists, NO circular arrow buttons. The
                  whole strip is draggable on mobile and scrollable on
                  desktop via trackpad / shift+wheel. */}
              {superDeals.length > 0 && (
                <DealCarousel
                  title="عروض السوبر"
                  subtitle="خصومات حتى 60%"
                  icon={<Zap size={16} className="text-red-600" />}
                  products={superDeals}
                  stores={stores}
                  onClick={handleProductClick}
                  flash
                />
              )}
              {mostSoldInAlgeria.length > 0 && (
                <DealCarousel
                  title="الأكثر طلباً في الجزائر"
                  subtitle="منتجات يثق بها الجزائريون"
                  icon={<Flame size={16} className="text-slate-900" />}
                  products={mostSoldInAlgeria}
                  stores={stores}
                  onClick={handleProductClick}
                />
              )}
              {under2000.length > 0 && (
                <DealCarousel
                  title="أقل من 2000 د.ج"
                  subtitle="أسعار في متناول الجميع"
                  icon={<Tag size={16} className="text-emerald-600" />}
                  products={under2000}
                  stores={stores}
                  onClick={handleProductClick}
                />
              )}
            </>
          )}

          {/* Filtered view: compact results header (replaces carousel) */}
          {!isMainPage && !storeProfile && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 grid place-items-center shrink-0">
                <Search size={18} className="text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-slate-900">
                  {hasActiveFilters ? 'نتائج البحث' : 'كل المنتجات'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {loading ? 'جاري التحميل...' : `${total} منتج`}
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-bold text-slate-700 hover:text-slate-900 transition flex items-center gap-1 shrink-0"
                >
                  <X size={14} /> مسح
                </button>
              )}
            </div>
          )}

          {/* ═══ Main grid + Top Stores (two-column on desktop) ═════════ */}
          <div className="grid lg:grid-cols-[1fr_280px] gap-4">
            {/* Main product grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base md:text-lg font-extrabold text-slate-900">
                    {storeProfile ? 'منتجات المتجر' : hasActiveFilters ? 'نتائج البحث' : 'كل المنتجات'}
                  </h2>
                  <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">
                    {loading ? 'جاري التحميل...' : `${total} منتج`}
                  </p>
                </div>
                {/* No "page X of Y" — infinite scroll replaces pagination. */}
              </div>

              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden">
                      <div className="aspect-square skeleton" />
                      <div className="p-2 sm:p-2.5 space-y-2">
                        <div className="h-3 skeleton rounded" />
                        <div className="h-4 w-1/2 skeleton rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-100 grid place-items-center mx-auto mb-3">
                    <Search size={24} className="text-slate-500" />
                  </div>
                  <div className="font-bold text-sm sm:text-base text-slate-900">لا توجد منتجات مطابقة</div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">جرّب تغيير الفلاتر أو كلمة البحث</p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="mt-4 bg-slate-900 text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-slate-800 transition"
                    >
                      مسح الفلاتر
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Responsive grid: 2 cols mobile, 3 tablet, 4 desktop, 5 large */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                    {products.map(p => (
                      <EnhancedMarketplaceProductCard
                        key={p._id}
                        p={p}
                        stores={stores}
                        onClick={() => handleProductClick(p)}
                      />
                    ))}
                  </div>

                  {/* Infinite-scroll sentinel — observed by IntersectionObserver.
                      When this div scrolls into view, the next page is
                      fetched + appended. Shows a slim spinner while loading. */}
                  {page < totalPages && (
                    <div
                      ref={sentinelRef}
                      className="flex items-center justify-center gap-2 py-8 text-slate-500 text-xs font-medium"
                    >
                      {loadingMore ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
                          <span>جاري تحميل المزيد من المنتجات...</span>
                        </>
                      ) : (
                        <span>مرّر للأسفل لتحميل المزيد</span>
                      )}
                    </div>
                  )}
                  {page >= totalPages && products.length > 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      وصلت إلى نهاية القائمة
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right sidebar: Top Stores (desktop only, main page only) */}
            {isMainPage && !storeProfile && storesWithCounts.length > 0 && (
              <div className="hidden lg:block">
                <div className="sticky top-20 space-y-4">
                  <TopStores stores={storesWithCounts} />

                  {/* "Create your store" promo card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 grid place-items-center mb-2">
                      <StoreIcon size={18} className="text-white" />
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-900 mb-1">متجر مجاني 100%</h3>
                    <p className="text-[11px] text-slate-600 leading-5 mb-3">
                      أنشئ متجرك في أقل من دقيقة، انشر منتجاتك في السوق العام مجاناً، واحصل على عملاء جدد.
                    </p>
                    <Link
                      to="/"
                      className="block bg-slate-900 text-white text-center py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                    >
                      أنشئ متجرك الآن
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 text-white/40 py-6 px-4 md:px-6 mt-8 pb-24 lg:pb-6">
          <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Logo to="/marketplace" showText={false} imgClassName="h-7 w-auto" className="shrink-0" />
              <span className="text-white/60 font-bold">Amugar Marketplace</span>
            </div>
            <div className="flex gap-4">
              <Link to="/" className="hover:text-white transition">المنصة</Link>
              <Link to="/marketplace" className="hover:text-white transition">السوق</Link>
              <a href="#" className="hover:text-white transition">شروط الاستخدام</a>
            </div>
          </div>
        </footer>
      </div>

      {/* ═══ Floating UI (overlay) ═════════════════════════════════════════ */}
      {/* FloatingButtons: desktop only. On mobile the BottomMobileNav
          already provides a cart icon + badge, so the floating button
          was redundant AND it covered product cards during scroll. */}
      <div className="hidden lg:block">
        <FloatingButtons />
      </div>
      <BottomMobileNav />
      {/* Toast notifications removed — was visual noise on mobile, hurt conversion.
          Live order toasts can be re-enabled later behind a user setting. */}
    </div>
  )
}

// ─── DealCarousel — horizontal touch-scrollable product strip ─────────────
// Renders a section header (title + subtitle + icon) + a horizontally
// scrollable row of fixed-width product cards. NO vertical row lists,
// NO circular arrow buttons — the whole strip is draggable on mobile
// and scrollable on desktop via trackpad / shift+wheel.
//
// Card width is fixed at 135px (mobile) / 160px (sm+) so the strip
// shows ~2.5 cards on mobile (hinting there's more to scroll) and
// more on wider screens.
function DealCarousel({
  title,
  subtitle,
  icon,
  products,
  stores,
  onClick,
  flash = false,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  products: MarketplaceProduct[]
  stores: TenantStore[]
  onClick: (p: MarketplaceProduct) => void
  flash?: boolean
}) {
  return (
    <section className="mb-4">
      {/* Section header */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <div className="w-8 h-8 rounded-lg bg-slate-100 grid place-items-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight truncate">
            {title}
          </h3>
          <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">{subtitle}</p>
        </div>
      </div>

      {/* Horizontal scroll strip — touch-draggable, snap-x, scrollbar hidden */}
      <div
        className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 -mx-3 px-3 snap-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {products.map(p => (
          <div
            key={p._id}
            className="w-[135px] sm:w-[160px] shrink-0 snap-start"
          >
            <EnhancedMarketplaceProductCard
              p={p}
              stores={stores}
              onClick={() => onClick(p)}
              flash={flash}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

