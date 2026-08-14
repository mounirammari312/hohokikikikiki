import { Link } from 'react-router-dom'
import { Heart, Star, Eye, ShoppingBag } from 'lucide-react'
import type { Product } from '../services/api/types'
import { formatDZD } from '../lib/utils'
import { getSettings } from '../services/api/settings'
import { useWishlist } from '../context/WishlistContext'
import { useCart } from '../context/CartContext'
import { useState } from 'react'

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
    <div className={`group relative bg-white rounded-[22px] border border-[#EDE6D8] overflow-hidden card-shadow card-shadow-hover animate-slide-up ${staggerClass}`}>
      {toast && <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-[#1A1A1E] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow whitespace-nowrap pointer-events-none">{toast}</div>}
      <Link to={`/product/${p._id}${storeQuery}`} className="block relative aspect-[4/5] img-zoom bg-[#FFF8EE]">
        <img src={p.images[0]} alt={p.nameAr} className="w-full h-full object-cover" loading="lazy"/>

        {/* Badges top-right (discount + new) — discount pulses */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10 items-end">
          {p.isNew && <span className="bg-[var(--color-secondary)] text-white text-[10px] tracking-widest px-2.5 py-1 rounded-full">جديد</span>}
          {discount>0 && <span className="badge-pulse bg-[var(--color-accent)] text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md">-{discount}%</span>}
        </div>

        {/* Quick actions top-left — fade in on hover (desktop), always visible (mobile) */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          <button type="button" onClick={handleWish} className={`w-8 h-8 rounded-full shadow grid place-items-center ${wished ? 'bg-[var(--color-accent)] text-white' : 'bg-white text-[#1A1A1E] hover:bg-[#FDF2F6] hover:text-[var(--color-accent)]'}`} aria-label="wishlist">
            <Heart size={14} className={wished ? 'fill-white' : ''}/>
          </button>
          <Link to={`/product/${p._id}${storeQuery}`} onClick={e=> e.stopPropagation()} className="w-8 h-8 rounded-full bg-white/90 shadow grid place-items-center hover:bg-white hidden md:grid md:opacity-0 md:translate-y-1 md:group-hover:opacity-100 md:group-hover:translate-y-0" aria-label="quick view"><Eye size={14}/></Link>
        </div>

        {/* Stock indicator — center-top banner when low / out */}
        {outOfStock && <span className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md z-10">نفذت الكمية</span>}
        {!outOfStock && lowStock && <span className="absolute top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md z-10">باقي {p.stock} قطع</span>}

        {/* Desktop: bottom overlay CTA — fades in on hover */}
        <div className="hidden md:flex absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/55 to-transparent opacity-0 group-hover:opacity-100 gap-2">
          <Link
            to={`/product/${p._id}${storeQuery}#order`}
            onClick={e=> e.stopPropagation()}
            className="btn-premium flex-1 bg-white text-[#1A1A1E] text-xs font-extrabold px-3 py-2 rounded-full text-center hover:bg-[var(--color-secondary)] hover:text-white"
          >
            اطلب الآن — COD
          </Link>
          <button type="button" onClick={handleQuickCart} className="btn-premium w-9 h-9 rounded-full bg-[var(--color-secondary)] text-white grid place-items-center hover:bg-black shrink-0" aria-label="add to cart"><ShoppingBag size={14}/></button>
        </div>

        {/* Variant count badge (hidden on hover for desktop so it doesn't overlap CTA) */}
        {p.variants && p.variants.length>0 && (
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur border border-[#F6C0D4] text-[#A02A5B] text-[10px] font-bold px-2 py-1 rounded-full md:group-hover:opacity-0">
            {p.variants.length} متغير
          </div>
        )}
      </Link>

      <div className="p-3 md:p-4">
        {/* Rating + material badge: stack on mobile so the rating number
            isn't squeezed/truncated by the material badge. */}
        <div className="flex items-center gap-1 text-[var(--color-primary)] text-xs min-w-0">
          <Star size={12} fill="var(--color-primary)" className="shrink-0"/>
          <span className="font-bold shrink-0 gold-text">{p.rating.toFixed(1)}</span>
          <span className="text-[#9A8A6B] shrink-0">({p.reviewsCount})</span>
          {p.materialAr && <span className="ms-auto text-[10px] md:text-[11px] px-2 py-0.5 rounded-full border truncate max-w-[90px] md:max-w-[110px] bg-[#FFF3E0] text-[#8D6E3A] border-[#F0D9A8]">{p.materialAr}</span>}
        </div>
        <Link to={`/product/${p._id}${storeQuery}`} className="block mt-2">
          {/* Allow 2 lines on mobile so product names don't get cut off. */}
          <h3 className="font-bold text-[#1A1A1E] leading-snug text-sm line-clamp-2 hover:text-[var(--color-accent)]">{p.nameAr}</h3>
          <p className="cormorant text-[11px] md:text-[12px] tracking-widest text-[#9A8A6B] truncate mt-0.5">{p.name.toUpperCase()}</p>
        </Link>
        {/* Price row: allow wrapping so the compare-at price doesn't push
            the main price off-screen. */}
        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
          <span className="font-extrabold text-[#1A1A1E] text-sm md:text-base">{formatDZD(p.price)}</span>
          {p.compareAtPrice && <span className="text-xs line-through text-[#B0A48A]">{formatDZD(p.compareAtPrice)}</span>}
        </div>
        {/* Inline stock status (only when low/out — keeps card clean otherwise) */}
        {outOfStock && <div className="mt-1.5 text-[10px] font-bold text-red-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"/> نفذت الكمية</div>}
        {!outOfStock && lowStock && <div className="mt-1.5 text-[10px] font-bold text-orange-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"/> باقي {p.stock} قطع فقط</div>}
        {p.tierPricing[0] && (
          <div className="mt-2 text-[10px] md:text-[11px] font-bold rounded-full px-2.5 py-1 inline-flex items-center gap-1.5 border text-[#8D6E3A] bg-[#FFFBF0] border-[#F5E6C8]">
            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--color-primary)]"></span>
            <span>وفّر حتى {p.tierPricing[p.tierPricing.length-1].discountPercent}% عند شراء {p.tierPricing[p.tierPricing.length-1].minQty} قطع</span>
          </div>
        )}
        {/* Color variant dots preview */}
        {p.variants && p.variants.length>0 && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {Array.from(new Map(p.variants.map(v=> [(v.colorAr||v.color||'')+(v.colorHex||''), v])).values()).slice(0,5).map((v:any)=> (
              <span key={v.id} className="w-6 h-6 rounded-full border-2 border-white shadow flex items-center justify-center" style={{background:v.colorHex||'#ddd'}} title={v.colorAr||v.color}></span>
            ))}
            {p.variants.length>5 && <span className="text-[11px] text-[#9A8A6B] self-center">+{p.variants.length-5}</span>}
          </div>
        )}

        {/* Mobile-only: always-visible compact "add to cart" button */}
        <button type="button" onClick={handleQuickCart} className={`md:hidden btn-premium mt-3 w-full text-xs font-bold py-2.5 rounded-full flex items-center justify-center gap-1.5 ${outOfStock ? 'bg-gray-200 text-gray-500' : 'bg-[var(--color-secondary)] text-white'}`} aria-label="add to cart">
          <ShoppingBag size={13}/>
          <span>{outOfStock ? 'غير متوفر' : 'أضف للسلة'}</span>
        </button>
      </div>
    </div>
  )
}
