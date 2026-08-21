import { Link } from 'react-router-dom'
import { Heart, Star, Eye, ShoppingBag } from 'lucide-react'
import type { Product } from '../services/api/types'
import { formatDZD } from '../lib/utils'
import { getSettings } from '../services/api/settings'
import { useWishlist } from '../context/WishlistContext'
import { useCart } from '../context/CartContext'
import { useState } from 'react'
import { SmartImage } from './SmartImage'

interface Props {
  p: Product
  /** Optional index for staggered entrance animation (0–3 cycle). */
  index?: number
}

export default function ProductCard({ p, index = 0 }: Props){
  const discount = p.compareAtPrice ? Math.round((1 - p.price / p.compareAtPrice)*100) : 0
  const settings = getSettings()
  const { toggle, isWished } = useWishlist()
  const { addToCart } = useCart()
  const [toast, setToast] = useState<string | null>(null)
  const wished = isWished(p._id)

  // Preserve the ?store= param across navigations so links stay scoped
  // to the current tenant (important on vercel.app / localhost where
  // multiple stores share the same origin).
  const storeParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('store') : null
  const storeQuery = storeParam ? `?store=${encodeURIComponent(storeParam)}` : ''

  // Stagger animation class — cycles through stagger-1..stagger-4
  const staggerClass = `stagger-${(index % 4) + 1}`

  // Stock state for inline indicator
  const outOfStock = p.stock <= 0
  const lowStock = p.stock > 0 && p.stock <= 5

  const handleWish = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const added = toggle(p)
    setToast(added ? 'تمت الإضافة للرغبات ♥' : 'تمت الإزالة من الرغبات')
    setTimeout(()=> setToast(null), 1800)
  }
  const handleQuickCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (outOfStock) {
      setToast('المنتج غير متوفر حالياً')
      setTimeout(()=> setToast(null), 1800)
      return
    }
    addToCart(p, 1)
    setToast('تمت الإضافة للسلة ✓')
    setTimeout(()=> setToast(null), 1800)
  }

  return (
    <div
      className={`group relative rounded-[22px] border overflow-hidden card-shadow card-shadow-hover animate-slide-up ${staggerClass}`}
      style={{ background: 'var(--color-card)', borderColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}
    >
      {toast && <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow whitespace-nowrap pointer-events-none" style={{ background: 'var(--color-text)' }}>{toast}</div>}
      <Link to={`/product/${p._id}${storeQuery}`} className="block relative aspect-[4/5] img-zoom overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-primary) 6%, var(--color-bg))' }}>
        {/* SmartImage: lazy-loaded, WebP/AVIF adaptive, blurred placeholder */}
        <SmartImage
          src={p.images[0]}
          alt={p.nameAr}
          size="card"
          className="w-full h-full"
        />

        {/* ─── Badges TOP-LEFT (new + discount) ─────────────────────────── */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10 items-start">
          {p.isNew && (
            <span className="text-white text-[10px] tracking-widest font-bold px-2.5 py-1 rounded-full shadow-md" style={{ background: 'var(--color-secondary)' }}>جديد</span>
          )}
          {discount>0 && (
            <span className="badge-pulse text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow-md" style={{ background: 'var(--color-accent)' }}>-{discount}%</span>
          )}
        </div>

        {/* ─── Wishlist heart TOP-RIGHT (circular, glassmorphism) ──────── */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10 items-end">
          <button
            type="button"
            onClick={handleWish}
            aria-label="wishlist"
            className={`w-9 h-9 rounded-full grid place-items-center backdrop-blur-md border border-white/40 shadow-md transition-all duration-300 hover:scale-110 ${wished ? 'text-white' : 'text-[var(--color-text)] hover:text-[var(--color-accent)]'}`}
            style={wished ? { background: 'var(--color-accent)' } : { background: 'rgba(255,255,255,0.78)' }}
          >
            <Heart size={15} className={wished ? 'fill-white' : ''} />
          </button>
          {/* Quick view eye — glassmorphism, appears on hover (desktop) */}
          <Link
            to={`/product/${p._id}${storeQuery}`}
            onClick={e=> e.stopPropagation()}
            aria-label="quick view"
            className="w-9 h-9 rounded-full grid place-items-center backdrop-blur-md bg-white/70 border border-white/40 text-[var(--color-text)] shadow-md hover:bg-white hover:text-[var(--color-accent)] transition-all duration-300 hover:scale-110 hidden md:grid md:opacity-0 md:translate-y-1 md:group-hover:opacity-100 md:group-hover:translate-y-0"
          >
            <Eye size={15} />
          </Link>
        </div>

        {/* Stock indicator — center-top banner when low / out */}
        {outOfStock && <span className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md z-10">نفذت الكمية</span>}
        {!outOfStock && lowStock && <span className="absolute top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md z-10">باقي {p.stock} قطع</span>}

        {/* ─── Desktop: bottom overlay CTA — slides up on hover ─────────── */}
        <div className="hidden md:flex absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/55 to-transparent opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 gap-2 transition-all duration-300">
          <Link
            to={`/product/${p._id}${storeQuery}#order`}
            onClick={e=> e.stopPropagation()}
            className="btn-premium flex-1 bg-white text-[var(--color-text)] text-xs font-extrabold px-3 py-2.5 rounded-full text-center hover:bg-[var(--color-secondary)] hover:text-white"
          >
            اطلب الآن — COD
          </Link>
          <button type="button" onClick={handleQuickCart} className="btn-premium w-9 h-9 rounded-full text-white grid place-items-center shrink-0" style={{ background: 'var(--color-secondary)' }} aria-label="add to cart"><ShoppingBag size={14}/></button>
        </div>

        {/* Variant count badge (hidden on hover for desktop so it doesn't overlap CTA) */}
        {p.variants && p.variants.length>0 && (
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur border border-white/40 text-[10px] font-bold px-2 py-1 rounded-full md:group-hover:opacity-0 transition-opacity" style={{ color: 'var(--color-accent)' }}>
            {p.variants.length} متغير
          </div>
        )}
      </Link>

      <div className="p-3 md:p-4">
        {/* Rating + material badge */}
        <div className="flex items-center gap-1 text-xs min-w-0" style={{ color: 'var(--color-primary)' }}>
          <Star size={12} fill="var(--color-primary)" className="shrink-0"/>
          <span className="font-bold shrink-0 gold-text">{p.rating.toFixed(1)}</span>
          <span className="shrink-0" style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>({p.reviewsCount})</span>
          {p.materialAr && <span className="ms-auto text-[10px] md:text-[11px] px-2 py-0.5 rounded-full border truncate max-w-[90px] md:max-w-[110px]" style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, white)', color: 'color-mix(in srgb, var(--color-primary) 55%, var(--color-text))', borderColor: 'color-mix(in srgb, var(--color-primary) 22%, transparent)' }}>{p.materialAr}</span>}
        </div>
        <Link to={`/product/${p._id}${storeQuery}`} className="block mt-2">
          <h3 className="font-bold leading-snug text-sm line-clamp-2 hover:text-[var(--color-accent)] transition-colors" style={{ color: 'var(--color-text)' }}>{p.nameAr}</h3>
          <p className="cormorant text-[11px] md:text-[12px] tracking-widest truncate mt-0.5" style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>{p.name.toUpperCase()}</p>
        </Link>
        {/* Price row */}
        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
          <span className="font-extrabold text-base md:text-lg" style={{ color: 'var(--color-text)' }}>{formatDZD(p.price)}</span>
          {p.compareAtPrice && <span className="text-xs line-through" style={{ color: 'color-mix(in srgb, var(--color-text) 40%, transparent)' }}>{formatDZD(p.compareAtPrice)}</span>}
          {discount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: 'var(--color-accent)' }}>وفّر {discount}%</span>
          )}
        </div>
        {/* Inline stock status */}
        {outOfStock && <div className="mt-1.5 text-[10px] font-bold text-red-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"/> نفذت الكمية</div>}
        {!outOfStock && lowStock && <div className="mt-1.5 text-[10px] font-bold text-orange-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"/> باقي {p.stock} قطع فقط</div>}
        {p.tierPricing[0] && (
          <div className="mt-2 text-[10px] md:text-[11px] font-bold rounded-full px-2.5 py-1 inline-flex items-center gap-1.5 border" style={{ background: 'color-mix(in srgb, var(--color-primary) 6%, white)', borderColor: 'color-mix(in srgb, var(--color-primary) 22%, transparent)', color: 'color-mix(in srgb, var(--color-primary) 55%, var(--color-text))' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-primary)' }}></span>
            <span>وفّر حتى {p.tierPricing[p.tierPricing.length-1].discountPercent}% عند شراء {p.tierPricing[p.tierPricing.length-1].minQty} قطع</span>
          </div>
        )}
        {/* Color variant dots preview */}
        {p.variants && p.variants.length>0 && (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {Array.from(new Map(p.variants.map(v=> [(v.colorAr||v.color||'')+(v.colorHex||''), v])).values()).slice(0,5).map((v:any)=> (
              <span key={v.id} className="w-5 h-5 rounded-full border-2 border-white shadow-sm ring-1 ring-black/5 flex items-center justify-center transition-transform hover:scale-110" style={{background:v.colorHex||'#ddd'}} title={v.colorAr||v.color}></span>
            ))}
            {p.variants.length>5 && <span className="text-[11px] self-center" style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>+{p.variants.length-5}</span>}
          </div>
        )}

        {/* Mobile-only: always-visible compact "add to cart" button */}
        <button type="button" onClick={handleQuickCart} className={`md:hidden btn-premium mt-3 w-full text-xs font-bold py-2.5 rounded-full flex items-center justify-center gap-1.5 ${outOfStock ? 'bg-gray-200 text-gray-500' : 'text-white'}`} style={!outOfStock ? { background: 'var(--color-secondary)' } : undefined} aria-label="add to cart">
          <ShoppingBag size={13}/>
          <span>{outOfStock ? 'غير متوفر' : 'أضف للسلة'}</span>
        </button>
      </div>
    </div>
  )
}
