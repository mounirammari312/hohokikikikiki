import { Link, useNavigate } from 'react-router-dom'
import { Trash2, Minus, Plus, ArrowLeft, ShoppingBag, Home as HomeIcon, Truck, Building2, ShieldCheck, Phone, MapPin, User, Package } from 'lucide-react'
import { motion } from 'framer-motion'
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
    <div className="min-h-[70vh] flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md mx-auto px-4 text-center"
      >
        {/* Illustrated empty state — shopping bag in a decorative ring */}
        <div className="relative mx-auto w-28 h-28 mb-6">
          <div className="absolute inset-0 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, white)' }} />
          <div className="absolute inset-3 rounded-full border-2 border-dashed" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 25%, transparent)' }} />
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative">
              <ShoppingBag size={36} style={{ color: 'var(--color-primary)' }} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
            </div>
          </div>
        </div>
        <h2 className="text-2xl font-extrabold" style={{ color: 'var(--color-text)' }}>سلة التسوق فارغة</h2>
        <p className="text-sm mt-2" style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>اكتشف كولكشن 2026 وأضف قطعك المفضلة</p>
        <Link to={`/shop${storeQuery}`} className="btn-premium inline-flex items-center gap-2 mt-6 text-white px-7 py-3 rounded-full font-bold shadow-lg" style={{ background: 'var(--color-secondary)' }}>
          <ArrowLeft size={16}/> تسوّق الآن
        </Link>
      </motion.div>
    </div>
  )

  const handleCheckout = async (e:any)=>{
    e.preventDefault()
    if(!form.name.trim() || !validateDZPhone(form.phone) || !form.commune.trim() || !form.address.trim()){ setErr('يرجى ملء كل الحقول بشكل صحيح (الهاتف: 0550123456)'); return}
    try{
      // ─── Client-side duplicate order detection ───────────────────────
      // Before hitting the API, check localStorage for a recent order
      // with the SAME items+quantities from THIS store. The server has
      // its own duplicate check (30-min window) that returns 409 — but
      // surfacing the warning HERE lets the customer confirm or cancel
      // without waiting for a network round-trip. The signature uses
      // `productId:qty` for each cart line; variants are intentionally
      // excluded so re-ordering the same product in a different color
      // still triggers the warning.
      const lastOrderKey = `lumiere_last_order__${new URLSearchParams(window.location.search).get('store') || 'default'}`
      let lastOrder: { sig?: string; ts?: number } | null = null
      try { lastOrder = JSON.parse(localStorage.getItem(lastOrderKey) || 'null') } catch { lastOrder = null }
      const currentSig = items.map(i => i.product._id + ':' + i.qty).join(',')
      if (lastOrder && lastOrder.sig === currentSig && lastOrder.ts && Date.now() - lastOrder.ts < 30 * 60 * 1000) {
        if (!confirm('لديك طلب مشابه منذ أقل من 30 دقيقة. هل تريد تأكيده مرة أخرى؟')) return
      }

      const orderItems = items.map(i=>{
        const unit = i.product.price + (i.variant?.priceAdjustment||0)
        const {total:t}=calcItemTotal(unit,i.qty,i.product.tierPricing);
        return {productId:i.product._id, nameAr: i.product.nameAr + (i.variantLabel? ` — ${i.variantLabel}`:''), image: i.variant?.image || i.product.images[0], qty:i.qty, unitPrice: unit, total:t, variantLabel: i.variantLabel, variantId: i.variantId}
      })
      const order = await createOrder({ customerName:form.name, phone:form.phone, wilaya: wilaya!.code, wilayaNameAr: wilaya!.nameAr, commune: form.commune, address: form.address, deliveryType, items: orderItems as any, subtotal, discount, shippingCost: shipping, total: grand } as any)
      // Persist the order signature so the next checkout attempt from
      // the same cart warns the customer (matches the server-side window).
      try { localStorage.setItem(lastOrderKey, JSON.stringify({ sig: currentSig, ts: Date.now() })) } catch {}
      Tracking.purchase(order.orderNumber, grand, orderItems)
      nav(`/thank-you/${order.orderNumber}`)
    }catch(err:any){
      if(err.message==='DUPLICATE_ORDER') setErr('طلب مكرر، لدينا طلبك بالفعل وسيتم الاتصال بك')
      else if(err?.body?.error === 'RATE_LIMITED' || err?.message === 'RATE_LIMITED') setErr('لقد أرسلتِ عدة طلبات متتالية — يرجى المحاولة بعد دقيقة')
      else setErr('خطأ غير متوقع')
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6 md:py-8 grid lg:grid-cols-[1.6fr_0.9fr] gap-6">
        {/* ═══ LEFT: cart items ══════════════════════════════════════ */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold tracking-widest mb-1" style={{ color: 'var(--color-primary)' }}>سلة التسوق</div>
              <h1 className="text-[24px] md:text-[28px] font-extrabold" style={{ color: 'var(--color-text)' }}>{items.length} منتجات في سلتك</h1>
            </div>
            <Link to={`/shop${storeQuery}`} className="hidden md:inline-flex items-center gap-2 text-sm font-bold border rounded-full px-4 py-2 bg-white transition-all duration-300 hover:shadow-md" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)', color: 'var(--color-text)' }}>
              <ArrowLeft size={14}/> متابعة التسوق
            </Link>
          </motion.div>

          <div className="mt-5 space-y-3">
            {items.map(({product, qty, variant, variantLabel, variantId}, i)=>{
              const unit = product.price + (variant?.priceAdjustment||0)
              const {disc, discountAmount, total:t}=calcItemTotal(unit, qty, product.tierPricing)
              const isRose = ['prod_002','prod_004'].includes(product._id) && disc>0
              return (
                <motion.div
                  key={product._id + '::' + (variantId||'')}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="bg-white border rounded-2xl p-3 md:p-4 flex gap-3 md:gap-4 card-shadow card-shadow-hover"
                  style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}
                >
                  <Link to={`/product/${product._id}${storeQuery}`} className="shrink-0">
                    <img src={variant?.image || product.images[0]} className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover"/>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${product._id}${storeQuery}`} className="font-bold text-sm hover:underline line-clamp-1" style={{ color: 'var(--color-text)' }}>{product.nameAr}</Link>
                    <div className="text-xs truncate" style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>{product.materialAr}</div>
                    {variantLabel && <div className="text-xs font-bold mt-1 flex items-center gap-1.5"><span className="px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, white)', border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)', color: 'var(--color-accent)' }}>{variant?.colorHex && <span className="w-3 h-3 rounded-full border border-black/10" style={{background:variant.colorHex}}></span>}{variantLabel}</span> {variant?.priceAdjustment ? <span className="text-[11px]" style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>{variant.priceAdjustment>0? '+' : ''}{formatDZD(variant.priceAdjustment)}</span>:null}</div>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {/* Quantity selector */}
                      <div className="flex items-center border rounded-full p-0.5" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)' }}>
                        <button type="button" onClick={()=>updateQty(product._id, qty-1, variantId)} className="w-7 h-7 rounded-full bg-white grid place-items-center border transition-colors hover:bg-gray-50" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)' }}><Minus size={12}/></button>
                        <span className="w-8 text-center text-sm font-bold" style={{ color: 'var(--color-text)' }}>{qty}</span>
                        <button type="button" onClick={()=>updateQty(product._id, qty+1, variantId)} className="w-7 h-7 rounded-full text-white grid place-items-center transition-transform hover:scale-105" style={{ background: 'var(--color-secondary)' }}><Plus size={12}/></button>
                      </div>
                      <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{formatDZD(t)} <span className="text-xs font-normal" style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>({formatDZD(unit)} × {qty})</span></span>
                      {disc>0 && <span className="text-xs px-2 py-0.5 rounded-full border font-bold" style={isRose ? { background: 'color-mix(in srgb, var(--color-accent) 8%, white)', color: 'var(--color-accent)', borderColor: 'color-mix(in srgb, var(--color-accent) 25%, transparent)' } : { color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' }}>-{disc}% {isRose ? '• لمسة روز' : `وفّرتِ ${formatDZD(discountAmount)}`}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={()=>removeItem(product._id, variantId)} className="w-9 h-9 rounded-full grid place-items-center self-start transition-all duration-300 hover:scale-105 shrink-0" style={{ background: '#FEF2F2', color: '#DC2626' }} aria-label="remove"><Trash2 size={15}/></button>
                </motion.div>
              )
            })}
          </div>
          <Link to={`/shop${storeQuery}`} className="md:hidden inline-flex items-center gap-2 mt-4 text-sm font-bold border rounded-full px-4 py-2 bg-white" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)', color: 'var(--color-text)' }}><ArrowLeft size={14}/> متابعة التسوق</Link>
        </div>

        {/* ═══ RIGHT: order summary + checkout (sticky on desktop) ════ */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {/* Order summary */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="bg-white border rounded-[22px] p-5 card-shadow"
            style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}
          >
            <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              ملخص الطلب <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-accent)' }}></span>
            </h3>
            <div className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between"><span style={{ color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}>المجموع الفرعي</span><span className="font-bold" style={{ color: 'var(--color-text)' }}>{formatDZD(subtotal)}</span></div>
              {discount>0 && <div className="flex justify-between font-bold" style={{ color: 'var(--color-accent)' }}><span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-accent)' }}></span> خصم الكمية</span><span>-{formatDZD(discount)}</span></div>}
              <div className="flex justify-between"><span style={{ color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}>الشحن ({wilaya?.nameAr})</span><span className="font-bold" style={{ color: 'var(--color-text)' }}>{formatDZD(shipping)}</span></div>
              <div className="h-px" style={{ background: 'color-mix(in srgb, var(--color-primary) 18%, transparent)' }} />
              <div className="flex justify-between font-extrabold text-base pt-1"><span style={{ color: 'var(--color-text)' }}>الإجمالي</span><span style={{ color: 'var(--color-primary)' }}>{formatDZD(grand)}</span></div>
              <p className="text-[11px] text-center rounded-full py-1.5 flex items-center justify-center gap-1.5" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, white)', border: '1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)', color: 'var(--color-accent)' }}><ShieldCheck size={11}/> الدفع عند الاستلام • تأكيد هاتفي</p>
            </div>
          </motion.div>

          {/* Checkout form */}
          <motion.form
            onSubmit={handleCheckout}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.18 }}
            className="rounded-[22px] p-5 text-white relative overflow-hidden card-shadow"
            style={{ background: 'var(--color-secondary)' }}
          >
            <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-2xl" style={{ background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)' }}/>
            <h3 className="font-bold flex items-center gap-2">إتمام الطلب — الدفع عند الاستلام <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-primary)' }}></span></h3>

            <div className="grid gap-3 mt-4 relative">
              {/* Name field with icon */}
              <div className="relative">
                <User size={14} className="absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" style={{ color: 'var(--color-primary)' }}/>
                <input placeholder="الاسم الكامل" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full rounded-xl px-3 py-2.5 pr-9 bg-white text-black text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition"/>
              </div>
              {/* Phone field with icon */}
              <div className="relative">
                <Phone size={14} className="absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" style={{ color: 'var(--color-primary)' }}/>
                <input placeholder="رقم الهاتف 0550..." dir="ltr" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full rounded-xl px-3 py-2.5 pr-9 bg-white text-black text-sm outline-none text-right focus:ring-2 focus:ring-[var(--color-primary)]/30 transition"/>
              </div>
              {/* Wilaya select */}
              <div className="relative">
                <MapPin size={14} className="absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" style={{ color: 'var(--color-primary)' }}/>
                <select value={wilayaCode} onChange={e=>setWilayaCode(e.target.value)} className="w-full rounded-xl px-3 py-2.5 pr-9 bg-white text-black text-sm outline-none font-bold appearance-none cursor-pointer focus:ring-2 focus:ring-[var(--color-primary)]/30 transition">
                  {wilayas.map(w=> <option key={w.code} value={w.code}>{w.code} - {w.nameAr}</option>)}
                </select>
              </div>

              {/* Delivery type — two nice cards with icons */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={()=>setDeliveryType('home')} className={`rounded-xl py-2.5 px-2 text-xs font-bold border flex flex-col items-center gap-1 transition-all duration-300 ${deliveryType==='home' ? 'text-white border-transparent shadow-md' : 'bg-white text-black border-white hover:opacity-90'}`} style={deliveryType==='home' ? { background: 'var(--color-primary)' } : undefined}>
                  <HomeIcon size={16} />
                  <span>للمنزل</span>
                  <span className="text-[10px] font-normal opacity-90">{wilaya? formatDZD(wilaya.deliveryHome):'—'}</span>
                </button>
                <button type="button" onClick={()=>setDeliveryType('desk')} className={`rounded-xl py-2.5 px-2 text-xs font-bold border flex flex-col items-center gap-1 transition-all duration-300 ${deliveryType==='desk' ? 'text-white border-transparent shadow-md' : 'bg-white text-black border-white hover:opacity-90'}`} style={deliveryType==='desk' ? { background: 'var(--color-accent)' } : undefined}>
                  <Building2 size={16} />
                  <span>مكتب</span>
                  <span className="text-[10px] font-normal opacity-90">{wilaya? formatDZD(wilaya.deliveryDesk):'—'}</span>
                </button>
              </div>

              <input placeholder="البلدية" value={form.commune} onChange={e=>setForm({...form,commune:e.target.value})} className="rounded-xl px-3 py-2.5 bg-white text-black text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition"/>
              <input placeholder="العنوان الكامل" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className="rounded-xl px-3 py-2.5 bg-white text-black text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition"/>
            </div>

            {err && <div className="mt-3 bg-red-500 text-white rounded-xl px-3 py-2 text-xs flex items-center gap-1.5"><Package size={12}/> {err}</div>}

            <button type="submit" className="btn-premium w-full mt-4 text-white rounded-full py-3.5 font-extrabold transition-all duration-300 hover:shadow-xl flex items-center justify-center gap-2" style={{ background: 'var(--color-primary)' }}>
              <ShoppingBag size={16}/>
              تأكيد الطلب • {formatDZD(grand)}
            </button>
            <p className="text-[11px] text-white/60 text-center mt-2 flex items-center justify-center gap-1.5"><span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-accent)' }}></span> حماية من الطلبات المكررة • تأكيد هاتفي • متغيرات محفوظة</p>
          </motion.form>
        </div>
      </div>
    </div>
  )
}
