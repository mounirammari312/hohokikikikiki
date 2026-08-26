import { Link, useNavigate } from 'react-router-dom'
import { Trash2, Minus, Plus, ArrowLeft, ShoppingBag, Home as HomeIcon, Building2, ShieldCheck, Phone, MapPin, User, Package, Check, Sparkles, Clock, Lock, Truck } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCart } from '../context/CartContext'
import { formatDZD, calcItemTotal, normalizeDZPhone, validateDZPhone } from '../lib/utils'
import { useState, useMemo, useRef } from 'react'
import { getWilayas } from '../services/api/wilayas'
import { createOrder } from '../services/api/orders'
import { Tracking } from '../services/tracking'

export default function Cart() {
  const { items, updateQty, removeItem, total, discount, subtotal } = useCart()
  const nav = useNavigate()
  const wilayas = getWilayas()
  const [wilayaCode, setWilayaCode] = useState('16')
  const [deliveryType, setDeliveryType] = useState<'home' | 'desk'>('home')
  const [form, setForm] = useState({ name: '', phone: '', phone2: '', commune: '', address: '', notes: '' })
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)

  const wilaya = useMemo(() => wilayas.find((w) => w.code === wilayaCode), [wilayaCode, wilayas])
  const shipping = wilaya ? (deliveryType === 'home' ? wilaya.deliveryHome : wilaya.deliveryDesk) : 0
  const grand = total + shipping

  const cleanPhone = normalizeDZPhone(form.phone)
  const isPhoneValid = validateDZPhone(cleanPhone)

  const storeParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('store') : null
  const storeQuery = storeParam ? `?store=${encodeURIComponent(storeParam)}` : ''

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-[#FAF8F5]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md mx-auto px-4 text-center"
        >
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-amber-50" />
            <div className="absolute inset-2 rounded-full border-2 border-dashed border-amber-200" />
            <div className="absolute inset-0 grid place-items-center">
              <ShoppingBag size={36} className="text-amber-700" />
            </div>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">سلة التسوق فارغة</h2>
          <p className="text-sm mt-2 leading-relaxed text-slate-500">
            استكشف تشكيلة المنتجات المميزة واستفد من الدفع عند الاستلام مع سرعة التوصيل لكافة الولايات.
          </p>
          <Link
            to={storeParam ? `/shop${storeQuery}` : '/marketplace'}
            className="inline-flex items-center gap-2 mt-6 text-white px-8 py-3.5 rounded-full font-extrabold shadow-lg transition-transform hover:scale-105 bg-slate-900 hover:bg-slate-800"
          >
            <ArrowLeft size={16} /> تصفح المنتجات الآن
          </Link>
        </motion.div>
      </div>
    )
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')

    if (!form.name.trim() || form.name.trim().length < 3) {
      setErr('يرجى كتابة الاسم الكامل (3 أحرف على الأقل)')
      return
    }

    if (!isPhoneValid) {
      setErr('يرجى إدخال رقم هاتف جزائري صحيح (مثال: 0550123456)')
      return
    }

    setSubmitting(true)

    try {
      const orderItems = items.map((i) => {
        const unit = i.product.price + (i.variant?.priceAdjustment || 0)
        const { total: t } = calcItemTotal(unit, i.qty, i.product.tierPricing)
        return {
          productId: i.product._id,
          nameAr: i.product.nameAr + (i.variantLabel ? ` — ${i.variantLabel}` : ''),
          image: i.variant?.image || i.product.images[0],
          qty: i.qty,
          unitPrice: unit,
          total: t,
          variantLabel: i.variantLabel,
          variantId: i.variantId,
        }
      })

      const order = await createOrder({
        customerName: form.name.trim(),
        phone: cleanPhone,
        phone2: form.phone2 ? normalizeDZPhone(form.phone2) : '',
        wilaya: wilaya ? wilaya.code : '16',
        wilayaNameAr: wilaya ? wilaya.nameAr : 'الجزائر',
        commune: form.commune.trim(),
        address: form.address.trim(),
        deliveryType,
        notes: form.notes.trim(),
        items: orderItems as any,
        subtotal,
        discount,
        shippingCost: shipping,
        total: grand,
      } as any)

      Tracking.purchase(order.orderNumber, grand, orderItems)

      // تفريغ السلة بعد نجاح الطلب
      items.forEach((i) => removeItem(i.product._id, i.variantId))

      nav(`/thank-you/${order.orderNumber}`)
    } catch (error: any) {
      if (error?.message === 'DUPLICATE_ORDER' || error?.body?.error === 'DUPLICATE_ORDER') {
        setErr('لديك طلب مماثل مسجل بالفعل، سيقوم فريق خدمة العملاء بالتواصل معك هاتفياً.')
      } else if (error?.body?.error === 'RATE_LIMITED' || error?.message === 'RATE_LIMITED') {
        setErr('طلبات متتالية كثيرة — يرجى الانتظار دقيقة واحدة ثم المحاولة.')
      } else {
        setErr('حدث خطأ أثناء تأكيد الطلب، يرجى إعادة المحاولة.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen pb-24 md:pb-12 bg-[#FAF8F5]">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6 md:py-8 grid lg:grid-cols-[1.5fr_1.05fr] gap-6 md:gap-8 items-start">
        
        {/* ═══ LEFT: Cart Items ══════════════════════════════════════ */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex items-center justify-between pb-3 border-b border-amber-200/60"
          >
            <div>
              <span className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5 text-amber-800">
                <Sparkles size={13} /> سلة المشتريات
              </span>
              <h1 className="text-[22px] md:text-[26px] font-extrabold mt-0.5 text-slate-900">
                {items.length} {items.length === 1 ? 'منتج في السلة' : 'منتجات في سلتك'}
              </h1>
            </div>
            <Link
              to={`/shop${storeQuery}`}
              className="hidden sm:inline-flex items-center gap-2 text-xs md:text-sm font-bold border border-slate-200 rounded-full px-4 py-2 bg-white text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <ArrowLeft size={14} /> إضافة منتج آخر
            </Link>
          </motion.div>

          {/* Product Items List */}
          <div className="space-y-3">
            {items.map(({ product, qty, variant, variantLabel, variantId }, i) => {
              const unit = product.price + (variant?.priceAdjustment || 0)
              const { disc, discountAmount, total: t } = calcItemTotal(unit, qty, product.tierPricing)
              return (
                <motion.div
                  key={product._id + '::' + (variantId || '')}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
                  className="bg-white border border-[#EDE6D8] rounded-2xl p-3.5 md:p-4 flex gap-3.5 md:gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
                >
                  <Link to={`/product/${product._id}${storeQuery}`} className="shrink-0 aspect-square w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
                    <img src={variant?.image || product.images[0]} alt={product.nameAr} className="w-full h-full object-cover" />
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <Link to={`/product/${product._id}${storeQuery}`} className="font-bold text-sm md:text-base text-slate-900 hover:text-amber-800 line-clamp-1">
                          {product.nameAr}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeItem(product._id, variantId)}
                          className="w-7 h-7 rounded-full grid place-items-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="حذف المنتج"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {variantLabel && (
                        <div className="text-xs font-bold mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900">
                          {variant?.colorHex && <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ background: variant.colorHex }} />}
                          {variantLabel}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 flex-wrap">
                      <div className="flex items-center border border-slate-200 rounded-full p-0.5 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => updateQty(product._id, qty - 1, variantId)}
                          className="w-7 h-7 rounded-full bg-white grid place-items-center shadow-xs text-slate-700 hover:bg-slate-100"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-xs md:text-sm font-bold text-slate-900">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(product._id, qty + 1, variantId)}
                          className="w-7 h-7 rounded-full bg-slate-900 text-white grid place-items-center shadow-xs hover:bg-slate-800"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="text-left">
                        <div className="text-sm md:text-base font-extrabold text-slate-900">
                          {formatDZD(t)}
                        </div>
                        {disc > 0 && (
                          <div className="text-[11px] font-bold text-emerald-700">
                            وفّرتِ {formatDZD(discountAmount)} ({disc}%)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Reassurance Trust Pills */}
          <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4 grid grid-cols-3 gap-2 text-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex flex-col items-center gap-1">
              <div className="w-9 h-9 rounded-full grid place-items-center bg-emerald-50 text-emerald-700"><Check size={16} strokeWidth={3} /></div>
              <span className="text-xs font-bold text-slate-800">الدفع بعد المعاينة</span>
              <span className="text-[10px] text-slate-500">افحص طلبك ثم ادفع</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-9 h-9 rounded-full grid place-items-center bg-blue-50 text-blue-700"><Truck size={16} /></div>
              <span className="text-xs font-bold text-slate-800">توصيل سريع</span>
              <span className="text-[10px] text-slate-500">لكافة ولايات الجزائر</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-9 h-9 rounded-full grid place-items-center bg-amber-50 text-amber-700"><ShieldCheck size={16} /></div>
              <span className="text-xs font-bold text-slate-800">ضمان الجودة</span>
              <span className="text-[10px] text-slate-500">خدمة عملاء مستمرة</span>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Checkout & Summary ═════════════════════════════ */}
        <div className="space-y-4 lg:sticky lg:top-24">
          
          {/* Order Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="bg-white border border-[#EDE6D8] rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">ملخص الحساب</h3>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                الدفع عند الاستلام
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي ({items.reduce((s, x) => s + x.qty, 0)} قطع)</span>
                <span className="font-bold text-slate-900">{formatDZD(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>خصومات الكمية</span>
                  <span>-{formatDZD(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>تكلفة الشحن ({wilaya?.nameAr})</span>
                <span className="font-bold text-slate-900">{formatDZD(shipping)}</span>
              </div>

              <div className="h-px bg-slate-100 my-2" />

              <div className="flex justify-between items-baseline pt-1">
                <span className="font-extrabold text-base text-slate-900">المبلغ الإجمالي</span>
                <span className="font-extrabold text-2xl text-amber-900">
                  {formatDZD(grand)}
                </span>
              </div>
            </div>
          </motion.div>

          {/* High-Trust Luminous Checkout Form */}
          <motion.form
            ref={formRef}
            onSubmit={handleCheckout}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="bg-white border-2 border-emerald-600/30 rounded-3xl p-5 md:p-6 shadow-[0_10px_30px_rgba(16,185,129,0.06)] relative overflow-hidden"
          >
            {/* Header with Security Badge */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 grid place-items-center shrink-0 border border-emerald-200/60">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-1.5">
                  تأكيد الطلب السريع
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    COD
                  </span>
                </h3>
                <p className="text-xs text-slate-500">أدخل معلوماتك وسنتصل بك لتأكيد الإرسال</p>
              </div>
            </div>

            <div className="grid gap-3.5 mt-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل *</label>
                <div className="relative">
                  <User size={16} className="absolute top-1/2 -translate-y-1/2 right-3.5 pointer-events-none text-slate-400" />
                  <input
                    placeholder="مثال: يوسف بن أحمد"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl px-3.5 py-3 pr-10 bg-slate-50/70 border border-slate-200 text-slate-900 text-sm outline-none transition focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 font-medium placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Phone with Auto-Check */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (للتأكيد قبل الشحن) *</label>
                <div className="relative">
                  <Phone size={16} className="absolute top-1/2 -translate-y-1/2 right-3.5 pointer-events-none text-slate-400" />
                  <input
                    placeholder="0550123456"
                    dir="ltr"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={`w-full rounded-xl px-3.5 py-3 pr-10 pl-10 bg-slate-50/70 border text-slate-900 text-sm outline-none transition text-right font-medium placeholder:text-slate-400 ${
                      form.phone.length > 0
                        ? isPhoneValid
                          ? 'border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 bg-emerald-50/30'
                          : 'border-amber-400 focus:border-amber-500'
                        : 'border-slate-200 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10'
                    }`}
                  />
                  {isPhoneValid && (
                    <span className="absolute top-1/2 -translate-y-1/2 left-3.5 w-5 h-5 rounded-full bg-emerald-600 text-white grid place-items-center shadow-xs">
                      <Check size={12} />
                    </span>
                  )}
                </div>
              </div>

              {/* Wilaya Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الولاية *</label>
                <div className="relative">
                  <MapPin size={16} className="absolute top-1/2 -translate-y-1/2 right-3.5 pointer-events-none text-slate-400" />
                  <select
                    value={wilayaCode}
                    onChange={(e) => setWilayaCode(e.target.value)}
                    className="w-full rounded-xl px-3.5 py-3 pr-10 bg-slate-50/70 border border-slate-200 text-slate-900 text-sm outline-none font-bold appearance-none cursor-pointer focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10"
                  >
                    {wilayas.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.code} - {w.nameAr} ({w.deliveryDays})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Delivery Options */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeliveryType('home')}
                  className={`rounded-2xl p-3 text-xs font-bold border-2 flex flex-col items-center gap-1.5 transition-all text-center ${
                    deliveryType === 'home'
                      ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <HomeIcon size={18} className={deliveryType === 'home' ? 'text-emerald-700' : 'text-slate-400'} />
                  <span>توصيل للمنزل</span>
                  <span className="text-xs font-extrabold text-emerald-700">
                    {wilaya ? formatDZD(wilaya.deliveryHome) : '—'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType('desk')}
                  className={`rounded-2xl p-3 text-xs font-bold border-2 flex flex-col items-center gap-1.5 transition-all text-center ${
                    deliveryType === 'desk'
                      ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Building2 size={18} className={deliveryType === 'desk' ? 'text-emerald-700' : 'text-slate-400'} />
                  <span>استلام من المكتب</span>
                  <span className="text-xs font-extrabold text-emerald-700">
                    {wilaya ? formatDZD(wilaya.deliveryDesk) : '—'}
                  </span>
                </button>
              </div>

              {/* Optional Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  placeholder="البلدية (اختياري)"
                  value={form.commune}
                  onChange={(e) => setForm({ ...form, commune: e.target.value })}
                  className="rounded-xl px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 text-slate-900 text-xs md:text-sm outline-none focus:bg-white focus:border-emerald-600 placeholder:text-slate-400"
                />
                <input
                  placeholder="العنوان أو الحي (اختياري)"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="rounded-xl px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 text-slate-900 text-xs md:text-sm outline-none focus:bg-white focus:border-emerald-600 placeholder:text-slate-400"
                />
              </div>

              <input
                placeholder="ملاحظة خاصة للتوصيل (اختياري)..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-xl px-3.5 py-2 bg-slate-50/70 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:border-emerald-600 placeholder:text-slate-400"
              />
            </div>

            {err && (
              <div className="mt-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2.5 text-xs font-bold flex items-center gap-2">
                <Package size={14} className="shrink-0" />
                <span>{err}</span>
              </div>
            )}

            {/* Reassuring Vibrant Green Submit CTA */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-4 font-extrabold text-base transition-all duration-300 shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-[0.99]"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  جاري تسجيل الطلب...
                </span>
              ) : (
                <>
                  <Check size={20} />
                  <span>تأكيد الطلب — الدفع عند الاستلام ({formatDZD(grand)})</span>
                </>
              )}
            </button>

            {/* Security Footer */}
            <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 text-emerald-700 font-bold">
                <ShieldCheck size={13} /> فحص المنتج قبل الدفع
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock size={13} /> اتصال هاتفي للتأكيد
              </span>
            </div>
          </motion.form>
        </div>
      </div>

      {/* ═══ MOBILE FIXED BOTTOM BAR ═══════════════════════════════ */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-[0_-6px_20px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold text-slate-500">المبلغ الإجمالي</div>
          <div className="text-base font-extrabold text-amber-900">
            {formatDZD(grand)}
          </div>
        </div>
        <button
          type="button"
          onClick={scrollToForm}
          className="px-7 py-3 rounded-full text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md bg-emerald-600 hover:bg-emerald-700"
        >
          <span>تأكيد الطلب</span>
          <ArrowLeft size={14} />
        </button>
      </div>
    </div>
  )
}

