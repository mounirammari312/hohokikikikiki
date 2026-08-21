import { useParams, Link } from 'react-router-dom'
import { CheckCircle, Truck, Phone, Gift, ArrowLeft } from 'lucide-react'
import { getOrder } from '../services/api/orders'
import { formatDZD } from '../lib/utils'
import { useEffect, useState } from 'react'
import { getSettings } from '../services/api/settings'
import type { Order } from '../services/api/types'

export default function ThankYou(){
  const {orderNumber}=useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  // Dynamic store info so the ThankYou page reflects the current
  // tenant's branding (phone, storeName, whatsapp) instead of the
  // hardcoded demo values.
  const [store, setStore] = useState(() => getSettings())

  useEffect(()=>{
    // Refresh settings from the API in case the cache wasn't populated yet.
    setStore(getSettings())
    if(!orderNumber){ setLoading(false); return }
    getOrder(orderNumber).then(o => { setOrder(o || null); setLoading(false) }).catch(()=> setLoading(false))
  }, [orderNumber])

  if(loading) return <div className="max-w-[640px] mx-auto px-4 py-16 text-center text-[#9A8A6B]">جاري تحميل الطلب…</div>
  if(!order) return <div className="max-w-[640px] mx-auto px-4 py-16 text-center">الطلب غير موجود <Link to="/" className="text-[#C9A96A] underline">الرئيسية</Link></div>
  return (
    <div className="bg-[#FFFCF8] min-h-screen py-8">
      <div className="max-w-[640px] mx-auto px-4">
        <div className="bg-white rounded-[28px] border border-[#EDE6D8] overflow-hidden">
          <div className="bg-[#1A1A1E] p-8 text-center text-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#C9A96A]/20 rounded-full blur-2xl"/>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#A02A5B]/15 rounded-full blur-2xl"/>
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-[#C9A96A] grid place-items-center mx-auto shadow-lg"><CheckCircle size={32} className="text-white"/></div>
              <h1 className="text-[26px] font-extrabold mt-4">شكراً لكِ! تم تأكيد طلبك ✨</h1>
              <p className="text-white/70 text-sm mt-2">رقم الطلب <span className="bg-white text-[#1A1A1E] px-2 py-0.5 rounded-full font-bold tracking-widest">{order.orderNumber}</span> <span className="inline-flex ms-2 w-1.5 h-1.5 rounded-full bg-[#A02A5B] shadow-[0_0_8px_rgba(160,42,91,0.7)] align-middle"></span></p>
              <p className="text-xs text-white/60 mt-1">سيتصل بك فريق التأكيد خلال 2-4 ساعات</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                {t:"تأكيد هاتفي", d:"خلال ساعات", i:Phone, rose:false},
                {t:"الشحن", d:order.wilayaNameAr, i:Truck, rose:true},
                {t:"هدية", d:"علبة مخملية", i:Gift, rose:false},
              ].map(c=>(
                <div key={c.t} className={`rounded-2xl p-3 border ${c.rose ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-[#FFFBF0] border-[#F5E6C8]'}`}>
                  <c.i size={18} className={`mx-auto ${c.rose ? 'text-[#A02A5B]' : 'text-[#C9A96A]'}`}/>
                  <div className={`font-bold text-xs mt-1 ${c.rose ? 'text-[#7A1F44]' : 'text-[#1A1A1E]'}`}>{c.t}</div><div className={`text-[11px] ${c.rose ? 'text-[#A02A5B]/70' : 'text-[#9A8A6B]'}`}>{c.d}</div>
                </div>
              ))}
            </div>

            <div className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-2xl p-4">
              <h3 className="font-bold text-sm flex items-center gap-2">تفاصيل الطلب <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B]"></span></h3>
              <div className="mt-3 space-y-2">
                {order.items.map(it=> (
                  <div key={it.productId} className="flex gap-3 items-center bg-white rounded-xl p-2 border border-[#EDE6D8]">
                    <img src={it.image} className="w-14 h-14 rounded-lg object-cover"/>
                    <div className="flex-1"><div className="text-sm font-bold">{it.nameAr}</div><div className="text-xs text-[#9A8A6B]">× {it.qty} • {formatDZD(it.unitPrice)}</div></div>
                    <div className="font-bold text-sm">{formatDZD(it.total)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-[#7A6F5A]">المجموع</span><span className="font-bold">{formatDZD(order.subtotal)}</span></div>
                {order.discount>0 && <div className="flex justify-between text-[#A02A5B] font-bold"><span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-[#A02A5B]"></span> خصم</span><span>-{formatDZD(order.discount)}</span></div>}
                <div className="flex justify-between"><span className="text-[#7A6F5A]">الشحن</span><span className="font-bold">{formatDZD(order.shippingCost)}</span></div>
                <div className="h-px bg-[#EDE6D8]"/>
                <div className="flex justify-between font-extrabold"><span>الإجمالي عند الاستلام</span><span className="text-[#C9A96A]">{formatDZD(order.total)}</span></div>
              </div>
            </div>

            <div className="bg-[#1A1A1E] rounded-2xl p-4 text-white relative overflow-hidden">
              <div className="absolute -top-6 -left-6 w-20 h-20 bg-[#A02A5B]/10 rounded-full blur-xl"/>
              <div className="font-bold text-sm flex items-center gap-2">ماذا بعد؟ <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B]"></span></div>
              <ol className="mt-2 space-y-1.5 text-xs leading-6 text-white/80 list-decimal list-inside">
                <li>مكالمة تأكيد من رقمنا {store.phone} — يرجى الرد</li>
                <li>تجهيز الطلب وتغليفه في علبة {store.storeName} المخملية</li>
                <li>الشحن عبر Yalidine/Anderson — تتبع برسالة SMS</li>
                <li>الدفع نقداً عند التسليم — بدون رسوم إضافية</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Link to="/shop" className="flex-1 bg-[#1A1A1E] text-white rounded-full py-3 text-center font-bold flex items-center justify-center gap-2 hover:bg-black transition"><ArrowLeft size={16}/> متابعة التسوق</Link>
              <a href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent('استفسار عن الطلب ' + order.orderNumber)}`} target="_blank" className="flex-1 bg-[#25D366] text-white rounded-full py-3 text-center font-bold hover:bg-[#1DA851] transition">واتساب</a>
            </div>
            <p className="text-center text-[11px] text-[#9A8A6B] flex items-center justify-center gap-1.5"><span className="w-1 h-1 rounded-full bg-[#A02A5B]"></span> هل لديك سؤال؟ اتصلي بنا {store.phone} • من 9ص إلى 8م</p>
          </div>
        </div>
      </div>
    </div>
  )
}
