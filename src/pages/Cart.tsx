import { Link, useNavigate } from 'react-router-dom'
import { Trash2, Minus, Plus, ArrowLeft, ShoppingBag } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { formatDZD, calcItemTotal } from '../lib/utils'
import { useState, useMemo } from 'react'
import { getWilayas } from '../services/api/wilayas'
import { createOrder } from '../services/api/orders'
import { validateDZPhone } from '../lib/utils'
import { Tracking } from '../services/tracking'

export default function Cart(){
  const { items, updateQty, removeItem, total, discount, subtotal } = useCart()
  const nav = useNavigate()
  const wilayas = getWilayas()
  const [wilayaCode, setWilayaCode] = useState('16')
  const [deliveryType, setDeliveryType] = useState<'home'|'desk'>('home')
  const [form, setForm] = useState({name:'', phone:'', commune:'', address:''})
  const [err, setErr] = useState('')
  const wilaya = useMemo(()=> wilayas.find(w=>w.code===wilayaCode),[wilayaCode])
  const shipping = wilaya ? (deliveryType==='home'? wilaya.deliveryHome: wilaya.deliveryDesk):0
  const grand = total + shipping

  // Preserve ?store= in all links so the cart stays scoped to the
  // current tenant on vercel.app / localhost.
  const storeParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('store') : null
  const storeQuery = storeParam ? `?store=${encodeURIComponent(storeParam)}` : ''

  if(items.length===0) return (
    <div className="max-w-[1280px] mx-auto px-4 py-16 text-center bg-[#FFFCF8] min-h-[60vh]">
      <div className="w-20 h-20 rounded-full bg-white border border-[#F6C0D4]/40 grid place-items-center mx-auto shadow-sm relative"><ShoppingBag size={28} className="text-[#C9A96A]"/><span className="absolute translate-x-6 -translate-y-6 w-2 h-2 rounded-full bg-[#A02A5B]"></span></div>
      <h2 className="text-xl font-bold mt-4">سلة التسوق فارغة</h2>
      <p className="text-sm text-[#9A8A6B] mt-1">اكتشف كولكشن 2026 وأضف قطعك المفضلة</p>
      <Link to={`/shop${storeQuery}`} className="inline-block mt-4 bg-[#1A1A1E] text-white px-6 py-3 rounded-full font-bold hover:bg-black transition">تسوّق الآن</Link>
    </div>
  )

  const handleCheckout = async (e:any)=>{
    e.preventDefault()
    if(!form.name.trim() || !validateDZPhone(form.phone) || !form.commune.trim() || !form.address.trim()){ setErr('يرجى ملء كل الحقول بشكل صحيح (الهاتف: 0550123456)'); return}
    try{
      const orderItems = items.map(i=>{ 
        const unit = i.product.price + (i.variant?.priceAdjustment||0)
        const {total:t}=calcItemTotal(unit,i.qty,i.product.tierPricing); 
        return {productId:i.product._id, nameAr: i.product.nameAr + (i.variantLabel? ` — ${i.variantLabel}`:''), image: i.variant?.image || i.product.images[0], qty:i.qty, unitPrice: unit, total:t, variantLabel: i.variantLabel, variantId: i.variantId}
      })
      const order = await createOrder({ customerName:form.name, phone:form.phone, wilaya: wilaya!.code, wilayaNameAr: wilaya!.nameAr, commune: form.commune, address: form.address, deliveryType, items: orderItems as any, subtotal, discount, shippingCost: shipping, total: grand } as any)
      Tracking.purchase(order.orderNumber, grand, orderItems)
      nav(`/thank-you/${order.orderNumber}`)
    }catch(err:any){
      if(err.message==='DUPLICATE_ORDER') setErr('طلب مكرر، لدينا طلبك بالفعل وسيتم الاتصال بك')
      else setErr('خطأ غير متوقع')
    }
  }

  return (
    <div className="bg-[#FFFCF8] min-h-screen">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6 grid lg:grid-cols-[1.6fr_0.9fr] gap-6">
        <div>
          <h1 className="text-[24px] font-extrabold text-[#1A1A1E]">سلة التسوق • {items.length} منتجات</h1>
          <div className="mt-4 space-y-3">
            {items.map(({product, qty, variant, variantLabel, variantId})=>{
              const unit = product.price + (variant?.priceAdjustment||0)
              const {disc, discountAmount, total:t}=calcItemTotal(unit, qty, product.tierPricing)
              const isRose = ['prod_002','prod_004'].includes(product._id) && disc>0
              return (
                <div key={product._id + '::' + (variantId||'')} className="bg-white border border-[#EDE6D8] rounded-2xl p-3 flex gap-3">
                  <img src={variant?.image || product.images[0]} className="w-20 h-20 rounded-xl object-cover"/>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${product._id}${storeQuery}`} className="font-bold text-sm text-[#1A1A1E] hover:text-[#C9A96A] line-clamp-1">{product.nameAr}</Link>
                    <div className="text-xs text-[#9A8A6B] truncate">{product.materialAr}</div>
                    {variantLabel && <div className="text-xs font-bold mt-1 flex items-center gap-1.5"><span className="bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] px-2 py-0.5 rounded-full flex items-center gap-1">{variant?.colorHex && <span className="w-3 h-3 rounded-full border border-black/10" style={{background:variant.colorHex}}></span>}{variantLabel}</span> {variant?.priceAdjustment ? <span className="text-[11px]">{variant.priceAdjustment>0? '+' : ''}{formatDZD(variant.priceAdjustment)}</span>:null}</div>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <div className="flex items-center border border-[#EDE6D8] rounded-full p-0.5">
                        <button type="button" onClick={()=>updateQty(product._id, qty-1, variantId)} className="w-7 h-7 rounded-full bg-white grid place-items-center border border-[#EDE6D8]"><Minus size={12}/></button>
                        <span className="w-8 text-center text-sm font-bold">{qty}</span>
                        <button type="button" onClick={()=>updateQty(product._id, qty+1, variantId)} className="w-7 h-7 rounded-full bg-[#1A1A1E] text-white grid place-items-center"><Plus size={12}/></button>
                      </div>
                      <span className="text-sm font-bold">{formatDZD(t)} <span className="text-xs font-normal text-[#9A8A6B]">({formatDZD(unit)} × {qty})</span></span>
                      {disc>0 && <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${isRose ? 'bg-[#FDF2F6] text-[#A02A5B] border-[#F6C0D4]' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>-{disc}% {isRose ? '• لمسة روز' : `وفّرتِ ${formatDZD(discountAmount)}`}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={()=>removeItem(product._id, variantId)} className="w-8 h-8 rounded-full bg-[#FFF1F1] text-red-600 grid place-items-center self-start hover:bg-red-500 hover:text-white transition shrink-0"><Trash2 size={14}/></button>
                </div>
              )
            })}
          </div>
          <Link to={`/shop${storeQuery}`} className="inline-flex items-center gap-2 mt-4 text-sm font-bold border border-[#EDE6D8] bg-white px-4 py-2 rounded-full hover:bg-[#1A1A1E] hover:text-white transition"><ArrowLeft size={14}/> متابعة التسوق</Link>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-[#EDE6D8] rounded-[22px] p-5">
            <h3 className="font-bold text-[#1A1A1E] flex items-center gap-2">ملخص الطلب <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B]"></span></h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#7A6F5A]">المجموع</span><span className="font-bold">{formatDZD(subtotal)}</span></div>
              {discount>0 && <div className="flex justify-between text-[#A02A5B] font-bold"><span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B]"></span> خصم الكمية</span><span>-{formatDZD(discount)}</span></div>}
              <div className="flex justify-between"><span className="text-[#7A6F5A]">الشحن ({wilaya?.nameAr})</span><span className="font-bold">{formatDZD(shipping)}</span></div>
              <div className="h-px bg-[#EDE6D8]"/>
              <div className="flex justify-between font-extrabold text-base"><span>الإجمالي</span><span className="text-[#C9A96A]">{formatDZD(grand)}</span></div>
              <p className="text-[11px] text-[#A02A5B]/60 text-center bg-[#FDF2F6] border border-[#F6C0D4]/40 rounded-full py-1">لمسة روز • خصم تلقائي مطبّق</p>
            </div>
          </div>

          <form onSubmit={handleCheckout} className="bg-[#1A1A1E] rounded-[22px] p-5 text-white relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-[#A02A5B]/15 rounded-full blur-2xl"/>
            <h3 className="font-bold flex items-center gap-2">إتمام الطلب — الدفع عند الاستلام <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96A]"></span></h3>
            <div className="grid gap-3 mt-4">
              <input placeholder="الاسم الكامل" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="rounded-xl px-3 py-2.5 bg-white text-black text-sm outline-none focus:ring-2 focus:ring-[#A02A5B]/20"/>
              <input placeholder="رقم الهاتف 0550..." dir="ltr" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="rounded-xl px-3 py-2.5 bg-white text-black text-sm outline-none text-right focus:ring-2 focus:ring-[#A02A5B]/20"/>
              <select value={wilayaCode} onChange={e=>setWilayaCode(e.target.value)} className="rounded-xl px-3 py-2.5 bg-white text-black text-sm outline-none font-bold">
                {wilayas.map(w=> <option key={w.code} value={w.code}>{w.code} - {w.nameAr}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={()=>setDeliveryType('home')} className={`rounded-xl py-2 text-xs font-bold border ${deliveryType==='home'?'bg-[#C9A96A] border-[#C9A96A] text-white':'bg-white text-black border-white'}`}>للمنزل {wilaya? formatDZD(wilaya.deliveryHome):''}</button>
                <button type="button" onClick={()=>setDeliveryType('desk')} className={`rounded-xl py-2 text-xs font-bold border ${deliveryType==='desk'?'bg-[#A02A5B] border-[#A02A5B] text-white':'bg-white text-black border-white'}`}>مكتب {wilaya? formatDZD(wilaya.deliveryDesk):''}</button>
              </div>
              <input placeholder="البلدية" value={form.commune} onChange={e=>setForm({...form,commune:e.target.value})} className="rounded-xl px-3 py-2.5 bg-white text-black text-sm outline-none"/>
              <input placeholder="العنوان" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className="rounded-xl px-3 py-2.5 bg-white text-black text-sm outline-none"/>
            </div>
            {err && <div className="mt-3 bg-red-500 text-white rounded-xl px-3 py-2 text-xs">{err}</div>}
            <button type="submit" className="w-full mt-4 bg-[#C9A96A] hover:bg-[#B8945A] text-white rounded-full py-3 font-extrabold transition">تأكيد الطلب • {formatDZD(grand)}</button>
            <p className="text-[11px] text-white/60 text-center mt-2 flex items-center justify-center gap-1.5"><span className="w-1 h-1 rounded-full bg-[#A02A5B]"></span> حماية من الطلبات المكررة • تأكيد هاتفي • متغيرات محفوظة</p>
          </form>
        </div>
      </div>
    </div>
  )
}
