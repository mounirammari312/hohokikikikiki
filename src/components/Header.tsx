import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShoppingBag, Search, Menu, X, Heart } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { getSettings, syncSettings, subscribeSettings } from '../services/api/settings'
import { useTenant } from '../context/TenantContext'

export default function Header(){
  const { totalQty } = useCart()
  const { count: wishCount } = useWishlist()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [store, setStore] = useState(()=> getSettings())
  const [scrolled, setScrolled] = useState(false)
  
  const nav = useNavigate()
  const location = useLocation()
  const { storeId, storeSlug } = useTenant()
  const urlParams = new URLSearchParams(location.search)
  const activeSlug = storeSlug || urlParams.get('store')
  const activeId = storeId || urlParams.get('storeId')
  const storeQuery = activeSlug ? `?store=${encodeURIComponent(activeSlug)}` : (activeId ? `?storeId=${encodeURIComponent(activeId)}` : '')

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) {
      const params = new URLSearchParams()
      params.set('q', q.trim())
      if (activeSlug) params.set('store', activeSlug)
      else if (activeId) params.set('storeId', activeId)
      nav(`/shop?${params.toString()}`)
      setOpen(false)
    }
  }

  useEffect(() => {
    // One-time sync on mount + when storeId/storeSlug changes.
    // No setInterval — the cache is updated reactively by the service layer.
    void syncSettings().then(() => setStore(getSettings()))
  }, [storeId, storeSlug])

  // Subscribe to settings changes — when the merchant saves settings in
  // /admin (same tab) or another tab writes to localStorage, re-read
  // the cache and re-render. This is the fix for "storefront doesn't
  // update after saving in dashboard".
  useEffect(() => {
    const unsub = subscribeSettings(() => setStore(getSettings()))
    return unsub
  }, [])

  // Scroll listener — toggle header shadow once the user scrolls past 10px.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`sticky top-0 z-50 bg-[#FFFCF8]/90 glass border-b border-[#EDE6D8] transition-shadow ${scrolled ? 'shadow-md' : ''}`}>
      {/* Announcement bar with subtle gradient overlay */}
      <div className="text-[12px] py-2 text-center tracking-widest manrope flex items-center justify-center gap-2 px-3 relative overflow-hidden" style={{background: store.secondaryColor || '#1A1A1E', color: store.primaryColor || '#C9A96A'}}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent pointer-events-none"/>
        <span className="hidden md:inline-flex items-center gap-2 text-center leading-tight relative">{store.announcement} {store.enableRoseEdition && <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B] shadow-[0_0_8px_rgba(160,42,91,0.6)] shrink-0"></span>}</span>
        <span className="md:hidden leading-snug tracking-normal text-[11px] line-clamp-2 relative">{store.announcement}</span>
        <span className="hidden lg:flex items-center gap-2 shrink-0 ms-2 ps-2 border-s border-white/10 text-white/60 text-[11px] relative">خدمة العملاء: {store.phone} <span className="w-1 h-1 rounded-full bg-white/30"></span> {store.enableRoseEdition ? 'لمسة وردية • ÉDITION ROSE' : store.storeName}</span>
      </div>
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-[68px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <button type="button" onClick={()=>setOpen(!open)} className="md:hidden p-2" aria-label="menu">{open ? <X size={22}/> : <Menu size={22}/>}</button>
          <Link to={`/${storeQuery}`} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#1A1A1E] flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform">
              <span className="cormorant text-[#C9A96A] text-xl font-bold tracking-widest relative z-10">{store.storeName.charAt(0) || 'L'}</span>
              {store.enableRoseEdition && <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#A02A5B]/30 blur-[4px]"></span>}
            </div>
            <div className="leading-none">
              <div className="cormorant text-[22px] font-bold tracking-[0.22em] text-[#1A1A1E] group-hover:text-[var(--color-primary)]">{store.storeName}</div>
              <div className="text-[10px] tracking-[0.35em] text-[#9A8A6B] -mt-1 flex items-center gap-1.5">ALGÉRIE • PARIS {store.enableRoseEdition && <span className="w-1 h-1 rounded-full bg-[#A02A5B]"></span>}</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[14px] font-semibold text-[#1A1A1E]">
            <Link to={`/${storeQuery}`} className="hover:text-[#C9A96A]">الرئيسية</Link>
            <Link to={`/shop${storeQuery}`} className="hover:text-[#C9A96A]">المتجر</Link>
           <a href={`/${storeQuery}#collection`} onClick={e=>{ e.preventDefault(); setOpen(false); if(window.location.pathname==='/'){ document.getElementById('collection')?.scrollIntoView({behavior:'smooth'}) }else{ nav(`/${storeQuery}#collection`) }}} className="hover:text-[#C9A96A]">الكولكشن</a>

          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* Search bar — focus glow + expand animation on desktop */}
          <form onSubmit={onSearch} className="hidden md:flex items-center bg-white border border-[#EDE6D8] rounded-full px-3 py-1.5 w-[260px] focus-within:w-[300px] focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/15 focus-within:shadow-[0_0_0_4px_rgba(201,169,106,0.1)]">
            <Search size={16} className="text-[#9A8A6B]"/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث في المتجر..." className="flex-1 outline-none text-sm px-2 bg-transparent placeholder:text-[#B8AA8E]" />
          </form>
          <Link to={`/wishlist${storeQuery}`} className="relative hidden md:flex w-9 h-9 rounded-full border border-[#EDE6D8] items-center justify-center hover:bg-[#FDF2F6] hover:border-[#F6C0D4] group" aria-label="wishlist">
            <Heart size={16} className={`transition ${wishCount>0 ? 'fill-[#A02A5B] text-[#A02A5B]' : 'text-[#1A1A1E] group-hover:text-[#A02A5B]'}`}/>
            {wishCount>0 && <span className="badge-pulse absolute -top-1 -right-1 bg-[#A02A5B] text-white text-[10px] font-bold w-4 h-4 rounded-full grid place-items-center">{wishCount}</span>}
          </Link>
          <Link to={`/cart${storeQuery}`} className="relative w-10 h-10 rounded-full bg-[var(--color-secondary)] flex items-center justify-center hover:bg-black">
            <ShoppingBag size={18} className="text-white"/>
            {totalQty>0 && <span className="badge-pulse absolute -top-1 -right-1 bg-[var(--color-primary)] text-white text-[11px] font-bold w-5 h-5 rounded-full grid place-items-center border-2 border-white">{totalQty}</span>}
          </Link>
          <div className="hidden md:flex items-center gap-2 text-xs text-[#7A6F5A] border-s border-[#EDE6D8] ms-2 ps-3">
            <span className="w-6 h-6 rounded-full bg-[#EDE6D8] grid place-items-center text-[10px] font-extrabold text-[#1A1A1E]">DZ</span>
            <span className="font-bold text-[#1A1A1E]">AR</span>
          </div>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-[#EDE6D8] bg-white px-4 py-4 space-y-3 animate-slide-in-right">
          <form onSubmit={onSearch} className="flex items-center border border-[#EDE6D8] rounded-full px-3 py-2 focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/15">
            <Search size={16} className="text-[#9A8A6B]"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث..." className="flex-1 outline-none px-2 text-sm" />
          </form>
          <Link onClick={()=>setOpen(false)} to={`/${storeQuery}`} className="block py-2 font-semibold">الرئيسية</Link>
          <Link onClick={()=>setOpen(false)} to={`/shop${storeQuery}`} className="block py-2 font-semibold">المتجر</Link>
          <Link onClick={()=>setOpen(false)} to={`/wishlist${storeQuery}`} className="block py-2 font-semibold flex items-center gap-2"><Heart size={16}/> الرغبات {wishCount>0 && `(${wishCount})`}</Link>
          <Link onClick={()=>setOpen(false)} to={`/cart${storeQuery}`} className="block py-2 font-semibold">السلة ({totalQty})</Link>
          <div className="text-xs text-[#9A8A6B] border-t border-[#EDE6D8] pt-3">{store.phone} • {store.email}</div>
        </div>
      )}
    </header>
  )
}
