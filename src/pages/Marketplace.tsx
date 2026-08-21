/**
 * Marketplace — Temu/AliExpress-style rich marketplace.
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Features:
 *    - LEFT SIDEBAR (persistent on desktop, drawer on mobile):
 *      • Logo + "أنشئ متجرك" CTA
 *      • Main categories with icons
 *      • Price range filter
 *      • Store filter (browse by merchant)
 *      • Clear filters button
 *
 *    - TOP BAR:
 *      • Search (full width)
 *      • Sort dropdown
 *      • Live viewers counter ("X browsing now")
 *
 *    - LIVE TICKER (animated marquee of recent orders)
 *    - BANNER CAROUSEL (auto-rotating 5 promotional banners)
 *    - CIRCULAR CATEGORIES (horizontal scrolling icons)
 *    - TRUST BADGES (COD, 58 wilayas, verified, secure, returns)
 *    - COUPON BANNER (500 DZD discount, copy-to-clipboard)
 *
 *    - FLASH DEALS section (with live countdown timer)
 *    - TRENDING section (most viewed)
 *    - NEW ARRIVALS section (recently published)
 *    - TOP STORES ranking (sidebar, desktop only)
 *
 *    - ALL PRODUCTS grid (paginated)
 *
 *    - PRODUCT CARDS (Enhanced AliExpress/Temu style):
 *      • Image with discount ribbon
 *      • New badge, Flash badge
 *      • Wishlist heart button
 *      • Quick add-to-cart (hover reveal)
 *      • Store name + verified badge
 *      • Star rating + reviews count
 *      • Price in red + original price strikethrough
 *      • "Sold X today" badge
 *      • "COD" + "Free delivery" badges
 *      • Pulsing low stock indicator
 *
 *    - FLOATING BUTTONS (back to top + cart, desktop)
 *    - BOTTOM MOBILE NAV (Home / Browse / Cart / Account)
 *    - TOAST NOTIFICATIONS (recent orders, every 25-40s)
 *    - APP DOWNLOAD BANNER (with QR code)
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
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'

// Marketplace UI components
import { CountdownTimer } from '../components/marketplace/CountdownTimer'
import { LiveTicker } from '../components/marketplace/LiveTicker'
import { LiveViewers } from '../components/marketplace/LiveViewers'
import { BannerCarousel } from '../components/marketplace/BannerCarousel'
import { CategoriesCircle } from '../components/marketplace/CategoriesCircle'
import { CouponBanner } from '../components/marketplace/CouponBanner'
import { EnhancedMarketplaceProductCard } from '../components/marketplace/EnhancedProductCard'
import { TopStores } from '../components/marketplace/TopStores'
import { TrustBadges } from '../components/marketplace/TrustBadges'
import { FloatingButtons } from '../components/marketplace/FloatingButtons'
import { BottomMobileNav } from '../components/marketplace/BottomMobileNav'
import { ToastNotifications } from '../components/marketplace/ToastNotifications'
import { AppDownloadBanner } from '../components/marketplace/AppDownloadBanner'

// ─── Main marketplace categories (sidebar) ──────────────────────────────────
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

  // Mobile sidebar drawer
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // If viewing a specific store's marketplace page (/marketplace/store/:slug)
  const [storeProfile, setStoreProfile] = useState<TenantStore | null>(null)

  // Fetch products
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

  // Fetch top stores list — deferred to background, non-blocking
  // (uses the stores already returned by fetchMarketplaceProducts as fallback)
  useEffect(() => {
    // Only fetch top-stores if we don't already have stores from the main query
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

  // Pool of product names for the live ticker & toast notifications
  const productNamesPool = useMemo(() => {
    return products.slice(0, 30).map(p => p.nameAr).filter(Boolean)
  }, [products])

  const hasActiveFilters = q || category !== 'all' || minPrice || maxPrice || storeId

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* ═══ SIDEBAR ═════════════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-[#1A1A1E]/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed lg:sticky top-0 right-0 z-50 lg:z-0 h-screen w-[280px] shrink-0 bg-white border-l border-[#E5E7EB] flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A1A1E] to-[#3D3D45] grid place-items-center">
              <img src="/logo.webp" alt="Amugar" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <div className="font-extrabold text-sm leading-tight text-[#1A1A1E]">Amugar</div>
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
        {/* Top bar — Mobile-first design */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] shadow-sm">
          {/* Row 1: Logo + Search + Cart (mobile) */}
          <div className="px-3 md:px-6 pt-2.5 pb-2 flex items-center gap-2">
            {/* Mobile menu button */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 rounded-xl bg-[#F3F4F6] grid place-items-center shrink-0 active:scale-95 transition" aria-label="القائمة">
              <Menu size={18} />
            </button>

            {/* Mobile: Logo (compact) */}
            <Link to="/marketplace" className="lg:hidden flex items-center gap-1.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1A1A1E] to-[#3D3D45] grid place-items-center">
                <img src="/logo.webp" alt="Amugar" className="w-6 h-6 object-contain" />
              </div>
            </Link>

            {/* Search */}
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A8A6B]" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="ابحث عن منتج..."
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-full py-2 pr-9 pl-4 text-xs md:text-sm outline-none focus:border-[#C9A96A] focus:bg-white transition"
                />
                {q && (
                  <button onClick={() => setQ('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8A6B] hover:text-[#1A1A1E]">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Sort (mobile: icon only, desktop: full) */}
            <select
              value={sort}
              onChange={e => setSort(e.target.value as any)}
              className="bg-white border border-[#E5E7EB] rounded-full px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-bold outline-none cursor-pointer hover:bg-[#F3F4F6] transition shrink-0"
              aria-label="ترتيب"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.labelAr}</option>
              ))}
            </select>
          </div>

          {/* Row 2: Live viewers + quick stats (mobile only, scrollable) */}
          <div className="lg:hidden px-3 pb-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <LiveViewers />
            <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 text-[10px] font-bold shrink-0">
              <Package size={10} />
              <span className="tabular-nums">{total}</span>
              <span>منتج</span>
            </div>
            <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 text-[10px] font-bold shrink-0">
              <StoreIcon size={10} />
              <span className="tabular-nums">{stores.length}</span>
              <span>متجر</span>
            </div>
          </div>

          {/* Desktop: Live viewers in top-right */}
          <div className="hidden lg:flex px-6 pb-3 items-center justify-end">
            <LiveViewers />
          </div>
        </header>

        {/* Live ticker (only on main page) */}
        {isMainPage && !storeProfile && (
          <LiveTicker productNames={productNamesPool} />
        )}

        {/* Content area */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 pb-24 lg:pb-6">
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

          {/* ═══ Main page hero zone ═════════════════════════════════════════ */}
          {isMainPage && !storeProfile && (
            <>
              {/* Banner Carousel — mobile: shorter, desktop: taller */}
              <BannerCarousel className="mb-3" />

              {/* Circular categories — always visible, scrollable on mobile */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl mb-3">
                <CategoriesCircle active={category} onSelect={setCategory} />
              </div>

              {/* Trust badges — horizontal scroll on mobile, grid on desktop */}
              <TrustBadges className="mb-3" />

              {/* Coupon banner */}
              <CouponBanner className="mb-4" />
            </>
          )}

          {/* Hero stats banner (only when filters active — replaces the carousel) */}
          {!isMainPage && !storeProfile && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] grid place-items-center shrink-0">
                <Search size={18} className="text-[#9A8A6B]" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm text-[#1A1A1E]">
                  {hasActiveFilters ? 'نتائج البحث' : 'كل المنتجات'}
                </div>
                <div className="text-xs text-[#9A8A6B]">
                  {loading ? 'جاري التحميل...' : `${total} منتج`}
                </div>
              </div>
              <LiveViewers className="hidden sm:inline-flex" />
            </div>
          )}

          {/* ═══ Flash Deals section ════════════════════════════════════════ */}
          {flashDeals.length > 0 && (
            <div className="mb-4 bg-gradient-to-l from-[#DC2626]/5 via-[#F59E0B]/5 to-[#DC2626]/5 border border-[#DC2626]/20 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#DC2626] to-[#B91C1C] grid place-items-center shrink-0 shadow-md">
                    <Zap size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-extrabold text-[#1A1A1E]">عروض اليوم</h2>
                    <p className="text-[10px] md:text-[11px] text-[#9A8A6B]">خصومات حصرية لفترة محدودة</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] md:text-[11px] text-[#9A8A6B] font-medium hidden sm:inline">ينتهي خلال</span>
                  <CountdownTimer hours={8} />
                </div>
              </div>
              {/* Mobile: horizontal scroll carousel; Desktop: 6-col grid */}
              <div className="flex lg:grid lg:grid-cols-6 gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1 lg:mx-0 lg:px-0 lg:overflow-visible">
                {flashDeals.map(p => (
                  <div key={p._id} className="w-[140px] sm:w-[170px] lg:w-auto shrink-0 lg:shrink">
                    <EnhancedMarketplaceProductCard
                      p={p}
                      stores={stores}
                      onClick={() => handleProductClick(p)}
                      flash
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Trending section ═══════════════════════════════════════════ */}
          {trending.length > 0 && (
            <Section title="الأكثر رواجاً" subtitle="منتجات يبحث عنها الجميع" icon={Flame} iconBg="from-[#A02A5B] to-[#7A1F44]">
              <div className="flex lg:grid lg:grid-cols-6 gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1 lg:mx-0 lg:px-0 lg:overflow-visible">
                {trending.map(p => (
                  <div key={p._id} className="w-[140px] sm:w-[170px] lg:w-auto shrink-0 lg:shrink">
                    <EnhancedMarketplaceProductCard
                      p={p}
                      stores={stores}
                      onClick={() => handleProductClick(p)}
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ═══ New arrivals section ════════════════════════════════════════ */}
          {newArrivals.length > 0 && (
            <Section title="وصل حديثاً" subtitle="أحدث المنتجات في السوق" icon={Sparkles} iconBg="from-[#C9A96A] to-[#B8945A]">
              <div className="flex lg:grid lg:grid-cols-6 gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1 lg:mx-0 lg:px-0 lg:overflow-visible">
                {newArrivals.map(p => (
                  <div key={p._id} className="w-[140px] sm:w-[170px] lg:w-auto shrink-0 lg:shrink">
                    <EnhancedMarketplaceProductCard
                      p={p}
                      stores={stores}
                      onClick={() => handleProductClick(p)}
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ═══ Top Stores (mobile: horizontal carousel, desktop: sidebar) ═══ */}
          {isMainPage && !storeProfile && storesWithCounts.length > 0 && (
            <div className="lg:hidden mb-4">
              <TopStores stores={storesWithCounts} layout="carousel" limit={8} />
            </div>
          )}

          {/* ═══ Main grid + Top Stores (two-column on desktop) ═══════════════ */}
          <div className="mt-2 lg:mt-6 grid lg:grid-cols-[1fr_280px] gap-4">
            {/* Main product grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base md:text-lg font-extrabold text-[#1A1A1E]">
                    {storeProfile ? 'منتجات المتجر' : hasActiveFilters ? 'نتائج البحث' : 'كل المنتجات'}
                  </h2>
                  <p className="text-[10px] md:text-xs text-[#9A8A6B] mt-0.5">
                    {loading ? 'جاري التحميل...' : `${total} منتج`}
                  </p>
                </div>
                {totalPages > 1 && (
                  <div className="text-xs text-[#9A8A6B]">
                    صفحة {page} من {totalPages}
                  </div>
                )}
              </div>

              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl sm:rounded-2xl overflow-hidden">
                      <div className="aspect-square skeleton" />
                      <div className="p-2 sm:p-2.5 space-y-2">
                        <div className="h-3 skeleton rounded" />
                        <div className="h-4 w-1/2 skeleton rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 sm:p-12 text-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#F3F4F6] grid place-items-center mx-auto mb-3">
                    <Search size={20} className="sm:hidden text-[#9A8A6B]" />
                    <Search size={24} className="hidden sm:block text-[#9A8A6B]" />
                  </div>
                  <div className="font-bold text-sm sm:text-base text-[#1A1A1E]">لا توجد منتجات مطابقة</div>
                  <p className="text-xs sm:text-sm text-[#9A8A6B] mt-1">جرّب تغيير الفلاتر أو كلمة البحث</p>
                  {hasActiveFilters && (
                    <button onClick={() => { setQ(''); setCategory('all'); setMinPrice(0); setMaxPrice(0); setStoreId('') }} className="mt-4 bg-[#1A1A1E] text-white px-4 sm:px-5 py-2 rounded-full text-xs font-bold">
                      مسح الفلاتر
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
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

            {/* Right sidebar: Top Stores (desktop only, main page only) */}
            {isMainPage && !storeProfile && storesWithCounts.length > 0 && (
              <div className="hidden lg:block">
                <div className="sticky top-20 space-y-4">
                  <TopStores stores={storesWithCounts} />

                  {/* "Create your store" promo card */}
                  <div className="bg-gradient-to-br from-[#C9A96A]/10 to-[#A02A5B]/10 border border-[#C9A96A]/30 rounded-2xl p-4">
                    <div className="w-10 h-10 rounded-xl bg-white grid place-items-center mb-2 shadow-sm">
                      <StoreIcon size={18} className="text-[#C9A96A]" />
                    </div>
                    <h3 className="font-extrabold text-sm text-[#1A1A1E] mb-1">متجر مجاني 100%</h3>
                    <p className="text-[11px] text-[#4B5563] leading-5 mb-3">
                      أنشئ متجرك في أقل من دقيقة، انشر منتجاتك في السوق العام مجاناً، واحصل على عملاء جدد.
                    </p>
                    <Link to="/" className="block bg-[#1A1A1E] text-white text-center py-2 rounded-xl text-xs font-bold hover:bg-[#2D2D35] transition">
                      أنشئ متجرك الآن
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* App download banner */}
          {isMainPage && !storeProfile && (
            <AppDownloadBanner className="mt-8" />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-[#1A1A1E] text-white/40 py-6 px-4 md:px-6 mt-8 pb-24 lg:pb-6">
          <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/10 grid place-items-center">
                <img src="/logo.webp" alt="Amugar" className="w-5 h-5 object-contain" />
              </div>
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
      <FloatingButtons />
      <BottomMobileNav />
      <ToastNotifications productNames={productNamesPool} />
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
