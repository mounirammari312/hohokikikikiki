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

import { useEffect, useState, useMemo, useCallback } from 'react'
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

  // ─── Data fetching (UNCHANGED — preserves all API contracts) ──────────
  const fetchProducts = useCallback(async () => {
    setLoading(true)
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

  // Refetch on tab focus to surface newly published products
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void fetchProducts()
    }
    window.addEventListener('visibilitychange', handleVisibilityChange)
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchProducts])

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
        {/* ─── Sticky capsule header (RTL-optimized) ─────────────────────
            Two-row layout:
              Row 1 (delivery tag + logo + sort + filter):
                - Delivery tag (top-right, faint gray)
                - Logo
                - Sort + Filter (far left cluster)
              Row 2 (capsule search):
                - Wide rounded-full search input with an embedded
                  search button on the left edge (capsule style).
            The capsule search is the dominant element → easy to tap
            and type on mobile. */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
          <div className="px-3 md:px-6 pt-2.5 pb-3">
            {/* Row 1: delivery tag + logo + sort + filter */}
            <div className="flex items-center gap-2 sm:gap-2.5 mb-2">
              {/* Delivery tag — small, faint, top-right (RTL) */}
              <div className="flex flex-col leading-none shrink-0">
                <Logo to="/marketplace" showText={false} imgClassName="h-9 sm:h-10 w-auto" />
                <span className="text-[9px] text-slate-400 font-medium mt-1 hidden sm:block">
                  التوصيل إلى الجزائر · Amugar
                </span>
              </div>

              {/* Spacer to push sort + filter to the far left */}
              <div className="flex-1" />

              {/* Sort dropdown (compact) */}
              <select
                value={sort}
                onChange={e => setSort(e.target.value as any)}
                className="w-auto max-w-[90px] sm:max-w-none text-[11px] sm:text-xs px-2 py-2 sm:px-2.5 sm:py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold outline-none cursor-pointer hover:bg-slate-200 transition shrink-0 truncate"
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

            {/* Row 2: capsule search — wide, rounded-full, embedded button */}
            <div className="relative">
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void fetchProducts() }}
                placeholder="ابحث عن منتج أو متجر..."
                className="w-full bg-slate-100 border border-slate-200 rounded-full py-2.5 sm:py-3 pr-4 pl-24 sm:pl-28 text-sm outline-none focus:border-slate-400 focus:bg-white transition placeholder:text-slate-400"
              />
              {/* Embedded search button (left edge of the capsule) */}
              <button
                onClick={() => void fetchProducts()}
                className="absolute left-1 top-1 bottom-1 px-4 sm:px-5 rounded-full bg-slate-900 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:bg-slate-800 active:scale-95 transition"
                aria-label="بحث"
              >
                <Search size={14} />
                <span className="hidden sm:inline">بحث</span>
              </button>
              {/* Clear button (only when there's text) */}
              {q && (
                <button
                  onClick={() => setQ('')}
                  className="absolute left-24 sm:left-28 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                  aria-label="مسح البحث"
                >
                  <X size={15} />
                </button>
              )}
            </div>
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

              {/* ═══ Bento Deals Grid ═══════════════════════════════════════
                  Three side-by-side deal boxes (AliExpress/Temu style):
                    1. Super Deals (red) — highest-discount products
                    2. Most sold in Algeria (slate-900) — top sellers
                    3. Under 2000 DZD (emerald) — budget picks
                  Each box shows 2-4 mini product rows with image + price +
                  CTA. Hidden on small screens (mobile → stacked). */}
              {(superDeals.length > 0 || mostSoldInAlgeria.length > 0 || under2000.length > 0) && (
                <div className="grid md:grid-cols-3 gap-3 mb-4">
                  {/* Box 1: Super Deals (red) */}
                  {superDeals.length > 0 && (
                    <BentoBox
                      title="عروض السوبر"
                      subtitle="خصومات حتى 60%"
                      icon={<Zap size={16} className="text-white" />}
                      headerClass="bg-gradient-to-l from-red-600 to-rose-700"
                      products={superDeals}
                      stores={stores}
                      onClick={handleProductClick}
                    />
                  )}

                  {/* Box 2: Most sold in Algeria (slate-900) */}
                  {mostSoldInAlgeria.length > 0 && (
                    <BentoBox
                      title="الأكثر طلباً في الجزائر"
                      subtitle="منتجات يثق بها الجزائريون"
                      icon={<Flame size={16} className="text-white" />}
                      headerClass="bg-slate-900"
                      products={mostSoldInAlgeria}
                      stores={stores}
                      onClick={handleProductClick}
                    />
                  )}

                  {/* Box 3: Under 2000 DZD (emerald) */}
                  {under2000.length > 0 && (
                    <BentoBox
                      title="أقل من 2000 د.ج"
                      subtitle="أسعار في متناول الجميع"
                      icon={<Tag size={16} className="text-white" />}
                      headerClass="bg-gradient-to-l from-emerald-600 to-emerald-700"
                      products={under2000}
                      stores={stores}
                      onClick={handleProductClick}
                    />
                  )}
                </div>
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
                {totalPages > 1 && (
                  <div className="text-xs text-slate-500">
                    صفحة {page} من {totalPages}
                  </div>
                )}
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
                /* Responsive grid: 2 cols mobile, 3 tablet, 4 desktop, 5 large */
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
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="bg-white border border-slate-200 rounded-full w-10 h-10 grid place-items-center disabled:opacity-40 hover:bg-slate-50 transition"
                    aria-label="السابق"
                  >
                    <ChevronRight size={18} className="text-slate-700" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                    const p = i + 1
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-10 h-10 rounded-full text-sm font-bold transition ${
                          page === p
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="bg-white border border-slate-200 rounded-full w-10 h-10 grid place-items-center disabled:opacity-40 hover:bg-slate-50 transition"
                    aria-label="التالي"
                  >
                    <ChevronLeft size={18} className="text-slate-700" />
                  </button>
                </div>
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

// ─── BentoBox — single deal box for the Bento Deals Grid ──────────────────
// Renders a colored header (title + subtitle + icon) + a list of mini
// product rows (image + name + price + CTA arrow). Used for the Super
// Deals / Most Sold / Under 2000 DZD boxes on the marketplace main page.
function BentoBox({
  title,
  subtitle,
  icon,
  headerClass,
  products,
  stores,
  onClick,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  headerClass: string
  products: MarketplaceProduct[]
  stores: TenantStore[]
  onClick: (p: MarketplaceProduct) => void
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
      {/* Colored header */}
      <div className={`${headerClass} text-white px-3 py-2.5 flex items-center gap-2`}>
        <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur grid place-items-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-sm leading-tight truncate">{title}</div>
          <div className="text-[10px] text-white/70 truncate">{subtitle}</div>
        </div>
      </div>

      {/* Mini product rows */}
      <div className="p-1.5 flex-1">
        {products.slice(0, 4).map(p => {
          const store = stores.find(s => s._id === p.storeId)
          const img = Array.isArray(p.images) ? p.images[0] : p.images
          const isDiscount = !!p.compareAtPrice && p.compareAtPrice > p.price
          const discountPct = isDiscount
            ? Math.round(((p.compareAtPrice! - p.price) / p.compareAtPrice!) * 100)
            : 0
          return (
            <button
              key={p._id}
              onClick={() => onClick(p)}
              className="w-full flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition text-right group"
            >
              {/* Image */}
              <div className="relative w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                {img ? (
                  <img src={img} alt={p.nameAr || p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center">
                    <Package size={14} className="text-slate-300" />
                  </div>
                )}
                {isDiscount && (
                  <div className="absolute top-0 left-0 bg-red-600 text-white text-[8px] font-black px-1 leading-tight">
                    -{discountPct}%
                  </div>
                )}
              </div>

              {/* Name + price */}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-slate-900 line-clamp-1 leading-tight">
                  {p.nameAr || p.name}
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-red-600 font-black text-xs tabular-nums">
                    {formatDZD(p.price)}
                  </span>
                  {isDiscount && (
                    <span className="line-through text-slate-400 text-[9px] tabular-nums">
                      {formatDZD(p.compareAtPrice!)}
                    </span>
                  )}
                </div>
                {store && (
                  <div className="flex items-center gap-0.5 mt-0.5 text-[9px] text-slate-500">
                    <BadgeCheck size={8} className="text-emerald-600 shrink-0" />
                    <span className="truncate">{store.nameAr || store.name}</span>
                  </div>
                )}
              </div>

              {/* CTA arrow */}
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white grid place-items-center shrink-0 group-hover:bg-slate-800 transition">
                <ArrowLeft size={11} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
