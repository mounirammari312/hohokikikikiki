import { Link } from 'react-router-dom'
import { Heart, Star, Eye, ShoppingBag } from 'lucide-react'
import type { Product } from '../services/api/types'
import { formatDZD } from '../lib/utils'
import { getSettings } from '../services/api/settings'
import { useWishlist } from '../context/WishlistContext'
import { useCart } from '../context/CartContext'
import { useState } from 'react'

const ROSE_TIER_IDS = new Set(['prod_002','prod_004','prod_007','prod_103','prod_201'])

export default function ProductCard({p}:{p:Product}){
  const discount = p.compareAtPrice ? Math.round((1 - p.price / p.compareAtPrice)*100) : 0
  const settings = getSettings()
  const isRoseNote = settings.enableRoseEdition && ROSE_TIER_IDS.has(p._id)
  const { toggle, isWished } = useWishlist()
  const { addToCart } = useCart()
  const [toast, setToast] = useState<string | null>(null)
  const wished = isWished(p._id)

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
    addToCart(p, 1)
    setToast('تمت الإضافة للسلة ✓')
    setTimeout(()=> setToast(null), 1800)
  }

  return (
    <div className="group relative bg-white rounded-[22px] border border-[#EDE6D8] overflow-hidden hover:shadow-[0_12px_40px_rgba(26,26,30,0.08)] transition-all duration-300">
      {toast && <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-[#1A1A1E] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow whitespace-nowrap pointer-events-none">{toast}</div>}
      <Link to={`/product/${p._id}`} className="block relative aspect-[4/5] overflow-hidden bg-[#FFF8EE]">
        <img src={p.images[0]} alt={p.nameAr} className="w-full h-full object-cover group-hover:scale-[1.06] transition duration-700" loading="lazy"/>
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          {p.isNew && <span className="bg-[#1A1A1E] text-white text-[10px] tracking-widest px-2.5 py-1 rounded-full">جديد</span>}
          {discount>0 && <span className={`${isRoseNote ? 'bg-[#A02A5B]' : 'bg-[#C9A96A]'} text-white text-[11px] font-bold px-2.5 py-1 rounded-full`}>-{discount}%</span>}
        </div>
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <button type="button" onClick={handleWish} className={`w-8 h-8 rounded-full shadow grid place-items-center transition ${wished ? 'bg-[#A02A5B] text-white' : 'bg-white text-[#1A1A1E] hover:bg-[#FDF2F6] hover:text-[#A02A5B]'}`} aria-label="wishlist">
            <Heart size={14} className={wished ? 'fill-white' : ''}/>
          </button>
          <Link to={`/product/${p._id}`} onClick={e=> e.stopPropagation()} className="w-8 h-8 rounded-full bg-white/90 shadow grid place-items-center hover:bg-white transition hidden md:grid"><Eye size={14}/></Link>
        </div>
        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/55 to-transparent opacity-0 group-hover:opacity-100 transition flex gap-2">
          <Link
            to={`/product/${p._id}#order`}
            onClick={e=> e.stopPropagation()}
            className="flex-1 bg-white text-[#1A1A1E] text-xs font-extrabold px-3 py-2 rounded-full text-center hover:bg-[#1A1A1E] hover:text-white transition"
          >
            اطلب الآن — COD
          </Link>
          <button type="button" onClick={handleQuickCart} className="w-9 h-9 rounded-full bg-[#1A1A1E] text-white grid place-items-center hover:bg-black shrink-0"><ShoppingBag size={14}/></button>
        </div>
        {p.variants && p.variants.length>0 && (
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur border border-[#F6C0D4] text-[#A02A5B] text-[10px] font-bold px-2 py-1 rounded-full md:group-hover:opacity-0 transition">
            {p.variants.length} متغير
          </div>
        )}
      </Link>
      <div className="p-3 md:p-4">
        {/* Rating + material badge: stack on mobile so the rating number
            isn't squeezed/truncated by the material badge. */}
        <div className="flex items-center gap-1 text-[#C9A96A] text-xs min-w-0">
          <Star size={12} fill="#C9A96A" className="shrink-0"/>
          <span className="font-bold shrink-0">{p.rating.toFixed(1)}</span>
          <span className="text-[#9A8A6B] shrink-0">({p.reviewsCount})</span>
          {p.materialAr && <span className={`ms-auto text-[10px] md:text-[11px] px-2 py-0.5 rounded-full border truncate max-w-[90px] md:max-w-[110px] ${isRoseNote ? 'bg-[#FDF2F6] text-[#A02A5B] border-[#F6C0D4]' : 'bg-[#FFF3E0] text-[#8D6E3A] border-[#F0D9A8]'}`}>{p.materialAr}</span>}
        </div>
        <Link to={`/product/${p._id}`} className="block mt-2">
          {/* Allow 2 lines on mobile so product names don't get cut off. */}
          <h3 className="font-bold text-[#1A1A1E] leading-snug text-sm line-clamp-2 hover:text-[#A02A5B] transition">{p.nameAr}</h3>
          <p className="cormorant text-[11px] md:text-[12px] tracking-widest text-[#9A8A6B] truncate mt-0.5">{p.name.toUpperCase()}</p>
        </Link>
        {/* Price row: allow wrapping so the compare-at price doesn't push
            the main price off-screen. */}
        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
          <span className="font-extrabold text-[#1A1A1E] text-sm md:text-base">{formatDZD(p.price)}</span>
          {p.compareAtPrice && <span className="text-xs line-through text-[#B0A48A]">{formatDZD(p.compareAtPrice)}</span>}
        </div>
        {p.tierPricing[0] && (
          <div className={`mt-2 text-[10px] md:text-[11px] font-bold rounded-full px-2.5 py-1 inline-flex items-center gap-1.5 border ${isRoseNote ? 'text-[#A02A5B] bg-[#FDF2F6] border-[#F6C0D4]' : 'text-[#8D6E3A] bg-[#FFFBF0] border-[#F5E6C8]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRoseNote ? 'bg-[#A02A5B]' : 'bg-[#C9A96A]'}`}></span>
            <span>وفّري حتى {p.tierPricing[p.tierPricing.length-1].discountPercent}% عند شراء {p.tierPricing[p.tierPricing.length-1].minQty} قطع</span>
          </div>
        )}
        {p.variants && p.variants.length>0 && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {Array.from(new Map(p.variants.map(v=> [(v.colorAr||v.color||'')+(v.colorHex||''), v])).values()).slice(0,5).map((v:any)=> (
              <span key={v.id} className="w-6 h-6 rounded-full border-2 border-white shadow flex items-center justify-center" style={{background:v.colorHex||'#ddd'}} title={v.colorAr||v.color}></span>
            ))}
            {p.variants.length>5 && <span className="text-[11px] text-[#9A8A6B] self-center">+{p.variants.length-5}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
