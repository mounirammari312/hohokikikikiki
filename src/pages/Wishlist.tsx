import { Link } from 'react-router-dom'
import { Heart, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react'
import { useWishlist } from '../context/WishlistContext'
import { useCart } from '../context/CartContext'
import { formatDZD } from '../lib/utils'

export default function Wishlist(){
  const { items, remove, clear, count } = useWishlist()
  const { addToCart } = useCart()

  // Preserve ?store= in all links so the wishlist stays scoped to the
  // current tenant on vercel.app / localhost (where multiple stores
  // share the same origin).
  const storeParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('store') : null
  const storeQuery = storeParam ? `?store=${encodeURIComponent(storeParam)}` : ''

  if(items.length===0) return (
    <div className="max-w-[720px] mx-auto px-4 py-16 text-center bg-[#FFFCF8] min-h-[60vh]">
      <div className="w-20 h-20 rounded-full bg-white border border-[#F6C0D4] grid place-items-center mx-auto"><Heart size={28} className="text-[#A02A5B]"/></div>
      <h2 className="text-xl font-extrabold mt-4">قائمة الرغبات فارغة</h2>
      <p className="text-sm text-[#9A8A6B] mt-1">اضغطي على القلب في أي منتج لحفظه هنا</p>
      <Link to={`/shop${storeQuery}`} className="inline-flex items-center gap-2 mt-6 bg-[#1A1A1E] text-white px-6 py-3 rounded-full font-bold">تسوّق الآن <ArrowLeft size={14}/></Link>
    </div>
  )
  return (
    <div className="bg-[#FFFCF8] min-h-screen">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[24px] font-extrabold flex items-center gap-2"><Heart size={20} className="text-[#A02A5B] fill-[#A02A5B]"/> قائمة الرغبات <span className="bg-[#A02A5B] text-white text-xs px-2 py-1 rounded-full">{count}</span></h1>
          <div className="flex gap-2">
            <Link to={`/shop${storeQuery}`} className="bg-white border border-[#EDE6D8] px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1"><ArrowLeft size={14}/> المتجر</Link>
            <button onClick={clear} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1"><Trash2 size={14}/> مسح الكل</button>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {items.map(p=> (
            <div key={p._id} className="bg-white border border-[#EDE6D8] rounded-[20px] p-3 flex gap-3">
              <Link to={`/product/${p._id}${storeQuery}`} className="w-28 h-28 rounded-xl overflow-hidden bg-[#FFF8EE] shrink-0"><img src={p.images[0]} alt={p.nameAr} className="w-full h-full object-cover"/></Link>
              <div className="flex-1 min-w-0">
                <Link to={`/product/${p._id}${storeQuery}`} className="font-bold text-sm line-clamp-1 hover:text-[#A02A5B]">{p.nameAr}</Link>
                <div className="text-xs text-[#9A8A6B]">{p.materialAr}</div>
                <div className="font-extrabold mt-1">{formatDZD(p.price)}</div>
                <div className="flex gap-1.5 mt-2">
                  <button onClick={()=> addToCart(p,1)} className="flex-1 bg-[#1A1A1E] text-white rounded-full py-1.5 text-xs font-bold flex items-center justify-center gap-1"><ShoppingBag size={12}/> للسلة</button>
                  <Link to={`/product/${p._id}${storeQuery}#order`} className="flex-1 bg-[#A02A5B] text-white rounded-full py-1.5 text-xs font-bold text-center">اطلب الآن</Link>
                </div>
              </div>
              <button onClick={()=> remove(p._id)} className="w-8 h-8 rounded-full bg-red-50 border border-red-200 text-red-600 grid place-items-center self-start shrink-0"><Trash2 size={12}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
