import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Star, ShieldCheck, Truck, Gift, Minus, Plus, Check, Phone, MapPin, AlertTriangle, Heart, Share2, Droplet, Ruler, Layers, ChevronLeft, ChevronRight, Expand, X, Copy, CheckCheck, ShoppingBag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getProductById } from '../services/api/products'
import { getWilayas } from '../services/api/wilayas'
import { getDomainById, getDomains } from '../services/api/domains'
import { createOrder } from '../services/api/orders'
import { calcItemTotal, formatDZD, validateDZPhone } from '../lib/utils'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { Tracking } from '../services/tracking'
import type { Variant } from '../services/api/types'

export default function ProductDetail(){
  const {id} = useParams()
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToCart } = useCart()
  const { toggle: toggleWish, isWished: checkWished } = useWishlist()
  // Memoize product lookup so the reference stays stable across renders.
  // Without this, every keystroke in the order form re-renders the component,
  // getProductById returns a NEW object reference (because it parses localStorage
  // and migrates products each call), which then triggers the scroll-to-top
  // useEffect below — causing the page to jump to the top while typing.
  const product = useMemo(()=> getProductById(id||''), [id])
  const wilayas = useMemo(()=> getWilayas(), [])
  const [qty, setQty] = useState(1)
  const [selectedImg, setSelectedImg] = useState(0)
  const [direction, setDirection] = useState(0)
  const [deliveryType, setDeliveryType] = useState<'home'|'desk'>('home')
  const [form, setForm] = useState({ name:'', phone:'', phone2:'', wilaya:'16', commune:'', address:'' })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [duplicateWarn, setDuplicateWarn] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showLightbox, setShowLightbox] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const thumbsRef = useRef<HTMLDivElement>(null)
  const orderRef = useRef<HTMLFormElement>(null)

  // variant selection
  const [selColor, setSelColor] = useState<string|undefined>(undefined)
  const [selSize, setSelSize] = useState<string|undefined>(undefined)

  const domain = useMemo(()=>{
    if(!product) return null
    if((product as any).domainId) return getDomainById((product as any).domainId) || getDomains().find(d=> d.categories.some(c=> c.key===product.category)) || getDomains()[0]
    return getDomains().find(d=> d.categories.some(c=> c.key===product.category)) || getDomains()[0]
  }, [product])

  // handle initial variant from query param
  useEffect(()=>{
    const v = searchParams.get('variant')
    if(v && product?.variants?.length){
      const found = product.variants.find(x=> x.id===v)
      if(found){
        if(found.colorAr||found.color) setSelColor(found.colorAr||found.color||undefined)
        if(found.size) setSelSize(found.size)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?._id])

  // handle hash #order scroll — only when the product id actually changes
  useEffect(()=>{
    if(window.location.hash==='#order' && product){
      // Use a longer delay to ensure images/layout settle before scrolling.
      const t = setTimeout(()=> {
        orderRef.current?.scrollIntoView({behavior:'smooth', block:'start'})
      }, 320)
      return ()=> clearTimeout(t)
    }
  }, [product?._id])

  const hasVariants = !!(product?.variants && product.variants.length)
  const colors = useMemo(()=>{
    if(!hasVariants) return []
    const map=new Map<string, Variant>()
    product!.variants!.forEach(v=>{
      const k = (v.colorAr||v.color||'') + '|' + (v.colorHex||'')
      if(!map.has(k) && (v.color||v.colorAr)) map.set(k, v)
    })
    return Array.from(map.values())
  }, [product, hasVariants])
  const sizes = useMemo(()=>{
    if(!hasVariants) return []
    const s=new Set<string>()
    product!.variants!.forEach(v=>{ if(v.size) s.add(v.size)})
    return Array.from(s)
  }, [product, hasVariants])

  const availableSizesForColor = useMemo(()=>{
    if(!selColor) return sizes
    const filtered = product?.variants?.filter(v=> (v.colorAr||v.color)===selColor) || []
    return Array.from(new Set(filtered.map(v=> v.size).filter(Boolean) as string[]))
  }, [selColor, product, sizes])

  const availableColorsForSize = useMemo(()=>{
    if(!selSize) return colors
    const filtered = product?.variants?.filter(v=> v.size===selSize) || []
    const map=new Map<string,Variant>()
    filtered.forEach(v=>{ const k=(v.colorAr||v.color||'')+'|'+(v.colorHex||''); if(v.color||v.colorAr) map.set(k,v)})
    return Array.from(map.values())
  }, [selSize, colors, product])

  const selectedVariant: Variant | undefined = useMemo(()=>{
    if(!hasVariants) return undefined
    let cand = product!.variants!
    if(selColor) cand = cand.filter(v=> (v.colorAr||v.color)===selColor)
    if(selSize) cand = cand.filter(v=> v.size===selSize)
    if(cand.length===1) return cand[0]
    if(cand.length>1){
      const avail = cand.find(v=> (v.stock||0)>0)
      return avail || cand[0]
    }
    if(selColor || selSize) return undefined
    return undefined
  }, [hasVariants, selColor, selSize, product])

  // keep url in sync with variant (without triggering navigation scroll)
  useEffect(()=>{
    if(!hasVariants || !selectedVariant) return
    const current = searchParams.get('variant')
    if(current !== selectedVariant.id){
      const next = new URLSearchParams(searchParams)
      next.set('variant', selectedVariant.id)
      setSearchParams(next, { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant?.id])

  const needColor = hasVariants && colors.length>0
  const needSize = hasVariants && sizes.length>0
  const variantMissing = (needColor && !selColor) || (needSize && !selSize)

  useEffect(()=>{
    if(hasVariants){
      if(colors.length===1 && !selColor) setSelColor(colors[0].colorAr||colors[0].color)
      if(sizes.length===1 && !selSize) setSelSize(sizes[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?._id])

  const unitPrice = useMemo(()=> (product?.price || 0) + (selectedVariant?.priceAdjustment||0), [product, selectedVariant])
  const effectiveStock = selectedVariant ? selectedVariant.stock : (product?.stock||0)
  const canAdd = effectiveStock>0 && !variantMissing

  const images = useMemo(()=>{
    if(!product) return []
    const base = product.images
    if(selectedVariant?.image){
      // put variant image first if exists
      return [selectedVariant.image, ...base.filter(b=> b!==selectedVariant.image)]
    }
    return base
  }, [product, selectedVariant])

  // Scroll to top ONLY when navigating to a different product (id change).
  // Previously depended on [product, unitPrice] where `product` was a fresh
  // reference on every render — meaning every keystroke in the form triggered
  // a scroll to top. Now using product?._id (a stable string) so this only
  // fires on actual navigation. Using behavior:'auto' for instant snap.
  useEffect(()=>{
    if(product){
      Tracking.viewContent(product._id, unitPrice)
      window.scrollTo({top:0, left:0, behavior:'auto'})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[product?._id])

  // reset selectedImg when variant changes (to show variant image)
  useEffect(()=>{ setSelectedImg(0); setDirection(0) }, [selectedVariant?.id, product?._id])

  // Auto-advance slider every 4.5 seconds.
  // Paused when: lightbox open, share modal open, user hovering, or only 1 image.
  const [sliderHovered, setSliderHovered] = useState(false)
  useEffect(()=>{
    if(showLightbox || showShare || sliderHovered || images.length<=1) return
    const t = setInterval(()=> {
      setDirection(1)
      setSelectedImg(prev => (prev + 1) % images.length)
    }, 4500)
    return ()=> clearInterval(t)
  }, [showLightbox, showShare, sliderHovered, images.length])

  const wilaya = useMemo(()=> wilayas.find(w=>w.code===form.wilaya),[form.wilaya, wilayas])
  const { disc, discountAmount, total: productTotal } = useMemo(()=> calcItemTotal(unitPrice, qty, product?.tierPricing||[]),[unitPrice, qty, product])
  const shipping = wilaya ? (deliveryType==='home'? wilaya.deliveryHome : wilaya.deliveryDesk) : 0
  const grandTotal = productTotal + shipping
  const isRoseProduct = product ? ['prod_002','prod_004','prod_007','prod_103','prod_201'].includes(product._id) : false
  const wished = product ? checkWished(product._id) : false

  const variantLabel = useMemo(()=>{
    if(!selectedVariant) return undefined
    const parts=[]
    if(selectedVariant.colorAr||selectedVariant.color) parts.push(selectedVariant.colorAr||selectedVariant.color||'')
    if(selectedVariant.size) parts.push(selectedVariant.size)
    return parts.join(' • ')
  }, [selectedVariant])

  const showToast = (msg:string)=>{
    setToast(msg)
    setTimeout(()=> setToast(null), 2200)
  }

  const handleWish = (e?:React.MouseEvent)=>{
    if(e){ e.preventDefault(); e.stopPropagation() }
    if(!product) return
    const added = toggleWish(product as any)
    showToast(added ? 'تمت الإضافة للرغبات ♥' : 'تمت الإزالة من الرغبات')
  }

  const handleShare = async (e?:React.MouseEvent)=>{
    if(e){ e.preventDefault(); e.stopPropagation() }
    if(!product) return
    const base = window.location.origin
    // Preserve the ?store= param so the shared link stays scoped to the
    // current tenant (important on vercel.app / localhost). If a variant
    // is selected, include both `?variant=` and `&store=`.
    const storeSlug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('store') : null
    let queryParams = ''
    if (selectedVariant && storeSlug) queryParams = `?variant=${selectedVariant.id}&store=${encodeURIComponent(storeSlug)}`
    else if (selectedVariant) queryParams = `?variant=${selectedVariant.id}`
    else if (storeSlug) queryParams = `?store=${encodeURIComponent(storeSlug)}`
    const url = `${base}/product/${product._id}${queryParams}#order`
    setShareUrl(url)
    try{
      if(navigator.share && window.innerWidth < 768){
        // try native share without modal
        await navigator.share({ title: product.nameAr, text: product.descriptionAr.slice(0,90), url })
        try{ await navigator.clipboard.writeText(url)}catch{}
        showToast('تمت المشاركة ✓')
        return
      }
    }catch{}
    setShowShare(true)
    try{ await navigator.clipboard.writeText(url); setCopied(true); setTimeout(()=> setCopied(false), 2000)}catch{}
  }

  // Lock body scroll when a modal/lightbox is open so the background doesn't
  // jump around on mobile when the soft keyboard appears or when the user
  // accidentally drags the backdrop.
  useEffect(()=>{
    const lock = showLightbox || showShare
    if(lock){
      const prev = document.body.style.overflow
      const prevPad = document.body.style.paddingRight
      const scrollbarW = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      if(scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`
      return ()=> {
        document.body.style.overflow = prev
        document.body.style.paddingRight = prevPad
      }
    }
  }, [showLightbox, showShare])

  // Hide the mobile sticky bottom CTA bar when the user is focused inside
  // the order form — this prevents the keyboard from overlapping the bar and
  // stops the browser from trying to scroll the input above the fixed bar.
  const [formFocused, setFormFocused] = useState(false)
  const onFormFocus = ()=> setFormFocused(true)
  const onFormBlur = ()=> setFormFocused(false)

  const copyShare = async ()=>{
    try{ await navigator.clipboard.writeText(shareUrl); setCopied(true); showToast('تم نسخ رابط الطلب المباشر ✓'); setTimeout(()=> setCopied(false),2000)}catch{ showToast('انسخي الرابط يدوياً')}
  }

  const scrollToOrder = (e?:React.MouseEvent)=>{
    if(e){ e.preventDefault(); e.stopPropagation() }
    orderRef.current?.scrollIntoView({behavior:'smooth', block:'start'})
    // update hash without jumping
    history.replaceState(null,'', `#order`)
  }

  if(!product) return <div className="max-w-[1280px] mx-auto px-4 py-12 text-center">المنتج غير موجود. <Link to="/shop" className="text-[#C9A96A] underline">العودة للمتجر</Link></div>

  const validate = ()=>{
    const e: Record<string,string> = {}
    if(!form.name.trim() || form.name.trim().length<3) e.name='الاسم مطلوب (3 أحرف على الأقل)'
    if(!validateDZPhone(form.phone)) e.phone='رقم هاتف غير صحيح. مثال: 0550123456'
    if(!form.wilaya) e.wilaya='اختر الولاية'
    if(!form.commune.trim()) e.commune='البلدية مطلوبة'
    if(!form.address.trim()) e.address='العنوان مطلوب'
    if(variantMissing) e.variant='اختر اللون والمقاس'
    if(effectiveStock<=0) e.stock='المنتج غير متوفر بهذا المتغير'
    if(qty>effectiveStock) e.qty=`الكمية المطلوبة أكبر من المخزون (${effectiveStock})`
    setErrors(e)
    if(e.variant || e.stock || e.qty){
      // scroll to variant selector
      const el = document.getElementById('variant-selector')
      el?.scrollIntoView({behavior:'smooth', block:'center'})
    }
    return Object.keys(e).length===0
  }

  const handleAddToCart = (e?:React.MouseEvent)=>{
    if(e){ e.preventDefault(); e.stopPropagation() }
    if(!validate()){ if(errors.variant) showToast('اختر اللون والمقاس أولاً') ; return }
    addToCart(product, qty, selectedVariant?.id)
    showToast(`تمت الإضافة للسلة ${variantLabel ? `• ${variantLabel}`:''} ✓`)
  }

  const handleDirectOrder = async (e:any)=>{
    e.preventDefault()
    if(!validate()) return
    setSubmitting(true)
    try{
      Tracking.initiateCheckout(grandTotal, qty)
      const order = await createOrder({
        customerName: form.name,
        phone: form.phone,
        phone2: form.phone2,
        wilaya: wilaya!.code,
        wilayaNameAr: wilaya!.nameAr,
        commune: form.commune,
        address: form.address,
        deliveryType,
        items: [{ productId: product._id, nameAr: product.nameAr + (variantLabel ? ` — ${variantLabel}`:''), image: selectedVariant?.image || product.images[0], qty, unitPrice, total: productTotal, variantLabel, variantId: selectedVariant?.id }],
        subtotal: unitPrice*qty,
        discount: discountAmount,
        shippingCost: shipping,
        total: grandTotal,
      } as any)
      Tracking.purchase(order.orderNumber, grandTotal, [{id: product._id, qty, variantLabel}])
      nav(`/thank-you/${order.orderNumber}`)
    }catch(err:any){
      if(err.message==='DUPLICATE_ORDER'){ setDuplicateWarn(true); setTimeout(()=>setDuplicateWarn(false),4000)}
      else showToast('حدث خطأ، حاول مرة أخرى')
    }finally{ setSubmitting(false)}
  }

  const paginate = (dir:number)=>{
    setDirection(dir)
    setSelectedImg((prev)=> (prev + dir + images.length) % images.length)
  }
  const goTo = (idx:number)=>{
    setDirection(idx > selectedImg ? 1 : -1)
    setSelectedImg(idx)
    // keep thumb in view
    const el = thumbsRef.current?.children[idx] as HTMLElement | undefined
    el?.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'})
  }

  return (
    <div className="bg-[#FFFCF8] min-h-screen pb-24 md:pb-0">
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] bg-[#1A1A1E] text-white px-4 py-2 rounded-full text-sm font-bold shadow-xl border border-white/10 pointer-events-none">{toast}</div>}

      {/* share modal */}
      {showShare && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div onClick={()=> setShowShare(false)} className="absolute inset-0 bg-[#1A1A1E]/60 backdrop-blur-sm"/>
          <div className="relative bg-white rounded-[24px] p-6 w-full max-w-[520px] shadow-2xl border border-[#EDE6D8]">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg flex items-center gap-2"><Share2 size={18} className="text-[#A02A5B]"/> مشاركة رابط الطلب المباشر</h3>
              <button type="button" onClick={()=> setShowShare(false)} className="w-8 h-8 rounded-full bg-[#FFFCF8] border border-[#EDE6D8] grid place-items-center"><X size={16}/></button>
            </div>
            <p className="text-sm text-[#7A6F5A] mt-2 leading-6">هذا الرابط يفتح صفحة المنتج مباشرة على نموذج إدخال المعلومات مع المتغير المختار <span className="bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] px-2 py-0.5 rounded-full text-xs font-bold">{variantLabel || 'بدون متغير'}</span> للشراء.</p>
            <div className="mt-4 flex gap-2 items-center bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl p-2">
              <input value={shareUrl} readOnly className="flex-1 bg-transparent text-xs outline-none px-2" dir="ltr"/>
              <button type="button" onClick={copyShare} className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 ${copied ? 'bg-emerald-600 text-white' : 'bg-[#1A1A1E] text-white hover:bg-black'}`}>{copied ? <CheckCheck size={14}/> : <Copy size={14}/>} {copied ? 'تم النسخ' : 'نسخ'}</button>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={async()=>{ try{ await navigator.clipboard.writeText(shareUrl); showToast('تم النسخ')}catch{} }} className="flex-1 bg-white border border-[#EDE6D8] rounded-full py-2 text-sm font-bold">نسخ الرابط</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`شاهدي هذا المنتج من ${product.nameAr} ${variantLabel? `(${variantLabel})`:''}: ${shareUrl}`)}`} target="_blank" rel="noreferrer" className="flex-1 bg-[#25D366] text-white rounded-full py-2 text-sm font-bold text-center">مشاركة واتساب</a>
            </div>
            <p className="text-[11px] text-[#9A8A6B] text-center mt-3">يمكنك إرسال الرابط للزبونة وسيفتح لها صفحة الطلب مباشرة — COD 2026</p>
          </div>
        </div>
      )}

      {/* lightbox */}
      <AnimatePresence>
        {showLightbox && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[70] bg-[#1A1A1E]/90 backdrop-blur flex items-center justify-center p-4" onClick={()=> setShowLightbox(false)}>
            <button type="button" onClick={()=> setShowLightbox(false)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white text-black grid place-items-center"><X size={18}/></button>
            <img src={images[selectedImg]} alt={product.nameAr} className="max-w-[92vw] max-h-[86vh] object-contain rounded-2xl shadow-2xl" onClick={e=> e.stopPropagation()}/>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              <button type="button" onClick={(e)=>{e.stopPropagation(); paginate(-1)}} className="w-10 h-10 rounded-full bg-white text-black grid place-items-center"><ChevronLeft size={18}/></button>
              <button type="button" onClick={(e)=>{e.stopPropagation(); paginate(1)}} className="w-10 h-10 rounded-full bg-white text-black grid place-items-center"><ChevronRight size={18}/></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-4">
        <div className="text-xs text-[#9A8A6B] flex gap-1 items-center flex-wrap">
          <Link to="/" className="hover:text-[#1A1A1E]">الرئيسية</Link> <span>/</span> <Link to="/shop" className="hover:text-[#1A1A1E]">المتجر</Link> <span>/</span> <span className="text-[#1A1A1E] font-bold">{product.nameAr}</span>
          {domain && <span className="hidden md:inline ms-2 bg-[#1A1A1E] text-white text-[10px] px-2 py-0.5 rounded-full">{domain.nameAr}</span>}
          {variantLabel && <span className="hidden md:inline ms-1 bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] text-[10px] px-2 py-0.5 rounded-full">{variantLabel}</span>}
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6 mt-4">
          {/* gallery — full-width, no white frame wrapper */}
          <div className="min-w-0">
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#FFF8EE] group select-none" onMouseEnter={()=>setSliderHovered(true)} onMouseLeave={()=>setSliderHovered(false)}>
                {/* main slider */}
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  <motion.img
                    key={selectedImg + images[selectedImg]}
                    src={images[selectedImg]}
                    alt={product.nameAr}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 40, scale: 0.98 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -direction * 40, scale: 0.98 }}
                    transition={{ duration: 0.42, ease: [0.25, 0.1, 0.25, 1] }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.18}
                    onDragEnd={(_, info) => {
                      const offset = info.offset.x
                      if(offset < -80) paginate(1)
                      else if(offset > 80) paginate(-1)
                    }}
                    onClick={()=> setShowLightbox(true)}
                    className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
                    draggable={false}
                  />
                </AnimatePresence>

                {/* nav arrows — semi-transparent, always visible on mobile, hover on desktop */}
                <button type="button" onClick={()=> paginate(-1)} className="absolute top-1/2 -translate-y-1/2 right-2 w-8 h-8 rounded-full bg-black/30 backdrop-blur text-white grid place-items-center hover:bg-black/50 transition md:opacity-0 md:group-hover:opacity-100 z-10">
                  <ChevronRight size={14}/>
                </button>
                <button type="button" onClick={()=> paginate(1)} className="absolute top-1/2 -translate-y-1/2 left-2 w-8 h-8 rounded-full bg-black/30 backdrop-blur text-white grid place-items-center hover:bg-black/50 transition md:opacity-0 md:group-hover:opacity-100 z-10">
                  <ChevronLeft size={14}/>
                </button>

                {/* small transparent zoom button — top-left, always visible but subtle */}
                <button type="button" onClick={()=> setShowLightbox(true)} className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/30 backdrop-blur text-white grid place-items-center hover:bg-black/50 transition md:opacity-0 md:group-hover:opacity-100 z-10" aria-label="تكبير">
                  <Expand size={12}/>
                </button>

                {/* auto-advance progress dots — bottom center, minimal */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/30 backdrop-blur text-white px-2.5 py-1 rounded-full pointer-events-none">
                  {images.map((_, i)=> <span key={i} className={`h-1.5 rounded-full transition-all ${i===selectedImg ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`}></span>)}
                </div>
              </div>

              {/* thumbnails */}
              <div className="relative mt-2">
                <div ref={thumbsRef} className="flex gap-2 overflow-x-auto thumb-scroll scroll-smooth snap-x snap-mandatory pb-1" style={{scrollbarWidth:'thin'}}>
                  {images.map((img,i)=> (
                    <button
                      key={i+img}
                      type="button"
                      onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); goTo(i)}}
                      className={`shrink-0 w-[64px] h-[64px] md:w-20 md:h-20 rounded-xl overflow-hidden border-2 snap-start relative transition ${selectedImg===i ? (isRoseProduct ? 'border-[#A02A5B] shadow-[0_4px_12px_rgba(160,42,91,0.2)]' : 'border-[#C9A96A] shadow') : 'border-transparent hover:border-[#EDE6D8]'}`}
                    >
                      <img src={img} alt={`صورة ${i+1}`} className="w-full h-full object-cover" draggable={false} loading="lazy"/>
                      {selectedImg===i && <span className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-xl pointer-events-none"></span>}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={()=> thumbsRef.current?.scrollBy({left: -120, behavior:'smooth'})} className="hidden md:grid absolute top-1/2 -translate-y-1/2 -right-2 w-7 h-7 rounded-full bg-white border border-[#EDE6D8] place-items-center shadow"><ChevronRight size={14}/></button>
                <button type="button" onClick={()=> thumbsRef.current?.scrollBy({left: 120, behavior:'smooth'})} className="hidden md:grid absolute top-1/2 -translate-y-1/2 -left-2 w-7 h-7 rounded-full bg-white border border-[#EDE6D8] place-items-center shadow"><ChevronLeft size={14}/></button>
              </div>

            {/* compact trust badges — much smaller */}
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {[
                {t:"توصيل 24-72ساعة", i:Truck, rose:false},
                {t:"الدفع عند الاستلام", i:ShieldCheck, rose:true},
                {t:"تغليف هدية", i:Gift, rose:false},
              ].map(b=> (
                <div key={b.t} className={`rounded-xl p-2 text-center border flex flex-col items-center gap-0.5 ${b.rose ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-white border-[#EDE6D8]'}`}>
                  <b.i size={14} className={`${b.rose ? 'text-[#A02A5B]' : 'text-[#C9A96A]'}`}/>
                  <div className={`text-[10px] font-bold leading-tight ${b.rose ? 'text-[#7A1F44]' : 'text-[#1A1A1E]'}`}>{b.t}</div>
                </div>
              ))}
            </div>
            {product.attributes && Object.keys(product.attributes).length>0 && (
              <div className="mt-3 bg-white border border-[#EDE6D8] rounded-2xl p-4">
                <h4 className="font-bold text-sm flex items-center gap-1.5"><Layers size={14} className="text-[#C9A96A]"/> تفاصيل {domain?.nameAr}</h4>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {Object.entries(product.attributes).map(([k,v])=> (
                    <div key={k} className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl px-3 py-2">
                      <div className="text-[11px] text-[#9A8A6B]">{domain?.attributeSchema.find(a=> a.key===k)?.labelAr || k}</div>
                      <div className="text-sm font-bold truncate">{Array.isArray(v) ? v.join('، ') : String(v)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-[#9A8A6B]">SKU: {product.sku} • التقييم {product.rating} ({product.reviewsCount}) • {product.materialAr}</div>
              </div>
            )}
          </div>

          {/* info + form */}
          <div className="space-y-4 min-w-0">
            <div className="bg-white rounded-[24px] border border-[#EDE6D8] p-5 md:p-6">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className={`px-2.5 py-1 rounded-full font-bold border ${isRoseProduct ? 'bg-[#FDF2F6] text-[#A02A5B] border-[#F6C0D4]' : 'bg-[#FFFBF0] text-[#8D6E3A] border-[#F0D9A8]'}`}>{product.category.toUpperCase()}</span>
                <span className="flex items-center gap-1 text-[#C9A96A] font-bold"><Star size={12} fill="#C9A96A"/>{product.rating} ({product.reviewsCount} تقييم)</span>
                <span className={`ms-auto text-[11px] px-2 py-1 rounded-full font-bold ${effectiveStock>10?'bg-emerald-50 text-emerald-700': effectiveStock>0 ? 'bg-amber-50 text-amber-700':'bg-red-50 text-red-600 border border-red-200'}`}>{effectiveStock>0? `متوفر: ${effectiveStock} قطعة`:'نفد المخزون'}</span>
              </div>
              <h1 className="text-[26px] font-extrabold text-[#1A1A1E] leading-tight mt-3">{product.nameAr}</h1>
              <p className="cormorant tracking-widest text-xs text-[#9A8A6B]">{product.name.toUpperCase()} • {product.material} — SKU: {product.sku} {domain && `• ${domain.nameAr}`}</p>
              <p className="text-sm leading-6 text-[#5A5340] mt-3">{product.descriptionAr}</p>

              <div className="flex items-baseline gap-3 mt-4 flex-wrap">
                <span className="text-[26px] font-extrabold text-[#1A1A1E]">{formatDZD(unitPrice)}</span>
                {product.compareAtPrice && <span className="line-through text-[#B0A48A] text-sm">{formatDZD(product.compareAtPrice)}</span>}
                {selectedVariant?.priceAdjustment ? <span className="text-xs bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] px-2 py-1 rounded-full">{selectedVariant.priceAdjustment>0? '+' : ''}{formatDZD(selectedVariant.priceAdjustment)}</span> : null}
                {disc>0 && <span className={`${isRoseProduct ? 'bg-[#A02A5B]' : 'bg-[#C9A96A]'} text-white text-xs font-bold px-2 py-1 rounded-full`}>وفّرتِ {formatDZD(discountAmount)}</span>}
              </div>

              {/* VARIANT SELECTOR */}
              {hasVariants && (
                <div id="variant-selector" className="mt-4 space-y-3 scroll-mt-24">
                  {needColor && (
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5"><Droplet size={12} className="text-[#A02A5B]"/> اللون {selColor && <span className="text-[#A02A5B]">— {selColor}</span>} {needColor && !selColor && <span className="text-red-500">*</span>}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {colors.map(v=>{
                          const active = (v.colorAr||v.color)===selColor
                          const disabled = availableColorsForSize.length? !availableColorsForSize.some(a=> (a.colorAr||a.color)===(v.colorAr||v.color)) : false
                          return (
                            <button key={v.id} type="button" onClick={()=> setSelColor(v.colorAr||v.color)} disabled={disabled} className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-bold ${active ? 'bg-[#1A1A1E] text-white border-[#1A1A1E]' : 'bg-white border-[#EDE6D8] hover:border-[#F6C0D4]'} ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
                              <span className="w-5 h-5 rounded-full border border-black/10" style={{background: v.colorHex||'#ccc'}}></span>
                              {v.colorAr||v.color}
                              {active && <Check size={12}/>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {needSize && (
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5"><Ruler size={12} className="text-[#1A1A1E]"/> المقاس {selSize && <span className="text-[#1A1A1E]">— {selSize}</span>} {needSize && !selSize && <span className="text-red-500">*</span>} <span className="ms-auto text-[11px] text-[#9A8A6B] hidden md:inline">{domain?.variantConfig.sizeOptions.join(' • ')}</span></div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(availableSizesForColor.length? availableSizesForColor : sizes).map(s=>{
                          const active = s===selSize
                          return (
                            <button key={s} type="button" onClick={()=> setSelSize(s)} className={`min-w-[56px] px-4 py-2 rounded-full border text-sm font-bold ${active ? 'bg-[#A02A5B] text-white border-[#A02A5B]' : 'bg-white border-[#EDE6D8] hover:border-[#C9A96A]'}`}>
                              {s}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {variantMissing && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">اختر {needColor ? 'اللون' : ''}{needColor && needSize ? ' و ' : ''}{needSize ? 'المقاس' : ''} لإضافة المنتج. المقاسات المتاحة تختلف حسب اللون.</p>}
                  {selectedVariant && (
                    <div className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl p-3 flex items-center gap-3">
                      {selectedVariant.colorHex && <span className="w-6 h-6 rounded-full border" style={{background:selectedVariant.colorHex}}></span>}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{variantLabel}</div>
                        <div className="text-xs text-[#9A8A6B] truncate">المخزون: {selectedVariant.stock} • SKU: {selectedVariant.sku || product.sku + '-' + selectedVariant.id.slice(-4)} {selectedVariant.priceAdjustment ? `• ${selectedVariant.priceAdjustment>0? '+' : ''}${formatDZD(selectedVariant.priceAdjustment)}` : ''}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold border shrink-0 ${selectedVariant.stock>10?'bg-emerald-50 border-emerald-200 text-emerald-700': selectedVariant.stock>0?'bg-amber-50 border-amber-200 text-amber-700':'bg-red-50 border-red-200 text-red-700'}`}>{selectedVariant.stock>0?'متوفر':'نفد'}</span>
                    </div>
                  )}
                  {errors.variant && <p className="text-xs text-red-600">{errors.variant}</p>}
                  {errors.stock && <p className="text-xs text-red-600">{errors.stock}</p>}
                </div>
              )}

              <div className={`mt-4 rounded-2xl border overflow-hidden ${isRoseProduct ? 'border-[#F6C0D4]' : 'border-[#F5E6C8]'}`}>
                <div className={`px-4 py-2 text-xs font-bold flex justify-between border-b ${isRoseProduct ? 'bg-[#FDF2F6] text-[#A02A5B] border-[#F6C0D4]' : 'bg-[#FFFBF0] text-[#8D6E3A] border-[#F5E6C8]'}`}><span className="flex items-center gap-1.5">عروض الكمية — وفّري أكثر {isRoseProduct && <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B]"></span>}</span><span className={`${isRoseProduct ? 'bg-white border-[#F6C0D4] text-[#A02A5B]' : 'bg-white border-[#F0D9A8] text-[#8D6E3A]'} border px-2 py-0.5 rounded-full`}>خصم تلقائي</span></div>
                <div className={`grid grid-cols-3 divide-x text-center bg-white ${isRoseProduct ? 'divide-[#F6C0D4]' : 'divide-[#F5E6C8]'}`}>
                  <div className="py-3">
                    <div className="text-xs text-[#9A8A6B]">1 قطعة</div><div className="font-bold text-sm">{formatDZD(unitPrice)}</div><div className="text-[11px] text-[#9A8A6B]">بدون خصم</div>
                  </div>
                  {product.tierPricing.map(t=> (
                    <div key={t.minQty} className={`py-3 ${qty>=t.minQty? (isRoseProduct ? 'bg-[#FDF2F6]' : 'bg-[#FFF7E6]') :''}`}>
                      <div className="text-xs text-[#9A8A6B]">{t.minQty} قطع</div><div className={`font-bold text-sm ${isRoseProduct ? 'text-[#A02A5B]' : 'text-[#8D6E3A]'}`}>-{t.discountPercent}%</div><div className="text-[11px] font-bold">{t.labelAr}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* qty selector — stays in info card, controls price calc */}
              <div className="flex items-center gap-3 mt-4">
                <div className="flex items-center border border-[#EDE6D8] rounded-full p-1 bg-[#FFFCF8]">
                  <button type="button" onClick={()=>setQty(q=>Math.max(1,q-1))} className="w-8 h-8 rounded-full bg-white border border-[#EDE6D8] grid place-items-center"><Minus size={14}/></button>
                  <span className="w-10 text-center font-bold text-sm">{qty}</span>
                  <button type="button" onClick={()=>setQty(q=> Math.min(effectiveStock||99, q+1))} className="w-8 h-8 rounded-full bg-[#1A1A1E] text-white grid place-items-center disabled:opacity-30" disabled={qty>=effectiveStock}><Plus size={14}/></button>
                </div>
                <div className="text-xs text-[#9A8A6B] leading-5">المجموع: <b className="text-[#1A1A1E] text-sm">{formatDZD(productTotal)}</b> {disc>0 && <span className={isRoseProduct ? 'text-[#A02A5B]' : 'text-emerald-600'}>(خصم {disc}%)</span>}</div>
              </div>
              {errors.qty && <p className="text-xs text-red-600 mt-1">{errors.qty}</p>}
            </div>

            <form ref={orderRef} id="order" onSubmit={handleDirectOrder} className="bg-[#1A1A1E] rounded-[24px] p-5 md:p-6 text-white relative overflow-hidden scroll-mt-24" onFocus={onFormFocus} onBlur={onFormBlur}>
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#C9A96A]/20 rounded-full blur-2xl"/>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-[#A02A5B]/15 rounded-full blur-2xl"/>
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-extrabold text-lg flex items-center gap-2"><span className="w-7 h-7 rounded-full bg-[#C9A96A] grid place-items-center text-white text-xs">⚡</span> طلب مباشر - الدفع عند الاستلام</h3>
                  <span className="text-[10px] tracking-widest bg-white/10 border border-white/15 px-2 py-1 rounded-full hidden md:inline">COD 2026 • آمن 100%</span>
                </div>
                <p className="text-xs text-white/70 mt-1">املأ النموذج وسيتصل بك فريق التأكيد خلال ساعات. الشحن يحسب تلقائياً حسب الولاية.</p>

                {duplicateWarn && <div className="mt-3 bg-amber-400 text-[#1A1A1E] rounded-xl px-3 py-2 text-xs font-bold flex gap-2 items-center"><AlertTriangle size={14}/> طلب مكرر! لديك طلب مشابه خلال آخر 30 دقيقة. سنتصل بك قريباً.</div>}

                <div className="grid gap-3 mt-4">
                  <div>
                    <label className="text-xs font-bold text-white/80">الاسم الكامل *</label>
                    <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="مثال: مريم بن علي" className="mt-1 w-full rounded-xl px-3 py-2.5 bg-white text-[#1A1A1E] text-sm outline-none placeholder:text-[#B8AA8E]"/>
                    {errors.name && <p className="text-amber-300 text-xs mt-1">{errors.name}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-white/80 flex gap-1 items-center"><Phone size={12}/> رقم الهاتف *</label>
                      <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="0550 12 34 56" dir="ltr" className="mt-1 w-full rounded-xl px-3 py-2.5 bg-white text-[#1A1A1E] text-sm outline-none text-right"/>
                      {errors.phone && <p className="text-amber-300 text-xs mt-1">{errors.phone}</p>}
                      <p className="text-[11px] text-white/50 mt-1">صيغة جزائرية: 0 + 5/6/7 + 8 أرقام</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-white/60">رقم ثانوي (اختياري)</label>
                      <input value={form.phone2} onChange={e=>setForm({...form,phone2:e.target.value})} placeholder="0660..." dir="ltr" className="mt-1 w-full rounded-xl px-3 py-2.5 bg-white/90 text-[#1A1A1E] text-sm outline-none text-right"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-white/80 flex gap-1"><MapPin size={12}/> الولاية *</label>
                      <select value={form.wilaya} onChange={e=>setForm({...form,wilaya:e.target.value})} className="mt-1 w-full rounded-xl px-3 py-2.5 bg-white text-[#1A1A1E] text-sm outline-none font-bold">
                        {wilayas.map(w=> <option key={w.code} value={w.code}>{w.code} - {w.nameAr} ({w.deliveryDays})</option>)}
                      </select>
                      {errors.wilaya && <p className="text-amber-300 text-xs mt-1">{errors.wilaya}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-white/80">البلدية *</label>
                      <input value={form.commune} onChange={e=>setForm({...form,commune:e.target.value})} placeholder="مثال: باب الزوار" className="mt-1 w-full rounded-xl px-3 py-2.5 bg-white text-[#1A1A1E] text-sm outline-none"/>
                      {errors.commune && <p className="text-amber-300 text-xs mt-1">{errors.commune}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-white/80">العنوان بالتفصيل *</label>
                    <input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="الحي، الشارع، رقم المنزل..." className="mt-1 w-full rounded-xl px-3 py-2.5 bg-white text-[#1A1A1E] text-sm outline-none"/>
                    {errors.address && <p className="text-amber-300 text-xs mt-1">{errors.address}</p>}
                  </div>
                  {hasVariants && (
                    <div className="bg-white/10 border border-white/15 rounded-xl p-3">
                      <div className="text-xs font-bold text-white/90">المتغير المختار</div>
                      {variantLabel ? <div className="text-sm font-bold text-white mt-1 flex items-center gap-2 flex-wrap">{selectedVariant?.colorHex && <span className="w-4 h-4 rounded-full border border-white/30" style={{background:selectedVariant.colorHex}}></span>} {variantLabel} • {formatDZD(unitPrice)} {effectiveStock<=5 && effectiveStock>0 && <span className="bg-amber-400 text-black text-[11px] px-2 py-0.5 rounded-full">متبقي {effectiveStock}</span>}{effectiveStock<=0 && <span className="bg-red-500 text-white text-[11px] px-2 py-0.5 rounded-full">نفد</span>}</div> : <div className="text-xs text-amber-300 mt-1">لم تختاري المتغير بعد — اختره أعلاه</div>}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={()=>setDeliveryType('home')} className={`rounded-xl py-3 text-sm font-bold border flex flex-col items-center gap-1 ${deliveryType==='home'? (isRoseProduct ? 'bg-[#A02A5B] border-[#A02A5B] text-white' : 'bg-[#C9A96A] border-[#C9A96A] text-white'):'bg-white text-[#1A1A1E] border-white'}`}><span className="flex gap-1 items-center"><Truck size={14}/> للمنزل</span><span className="text-xs opacity-80">{wilaya? formatDZD(wilaya.deliveryHome):''}</span></button>
                    <button type="button" onClick={()=>setDeliveryType('desk')} className={`rounded-xl py-3 text-sm font-bold border flex flex-col items-center gap-1 ${deliveryType==='desk'? (isRoseProduct ? 'bg-[#A02A5B] border-[#A02A5B] text-white' : 'bg-[#C9A96A] border-[#C9A96A] text-white'):'bg-white text-[#1A1A1E] border-white'}`}><span className="flex gap-1 items-center"><MapPin size={14}/> مكتب Yalidine</span><span className="text-xs opacity-80">{wilaya? formatDZD(wilaya.deliveryDesk):''}</span></button>
                  </div>
                </div>

                <div className={`mt-4 rounded-2xl p-4 text-[#1A1A1E] border ${isRoseProduct ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-white border-white'}`}>
                  <div className="flex justify-between text-sm"><span className="text-[#7A6F5A]">المنتج × {qty} {variantLabel && `• ${variantLabel}`}</span><span className="font-bold">{formatDZD(unitPrice*qty)}</span></div>
                  {discountAmount>0 && <div className={`flex justify-between text-sm ${isRoseProduct ? 'text-[#A02A5B]' : 'text-emerald-600'}`}><span>خصم الكمية ({disc}%)</span><span>-{formatDZD(discountAmount)}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-[#7A6F5A]">الشحن ({wilaya?.nameAr})</span><span className="font-bold">{formatDZD(shipping)}</span></div>
                  <div className={`h-px my-2 ${isRoseProduct ? 'bg-[#F6C0D4]' : 'bg-[#EDE6D8]'}`}/>
                  <div className="flex justify-between font-extrabold text-base"><span>الإجمالي عند الاستلام</span><span className={isRoseProduct ? 'text-[#A02A5B]' : 'text-[#C9A96A]'}>{formatDZD(grandTotal)}</span></div>
                  <div className="text-[11px] text-[#9A8A6B] mt-1 text-center">الدفع نقداً عند التسليم • لا تحتاجي لبطاقة</div>
                </div>

                <button type="submit" disabled={submitting || !canAdd} className={`mt-4 w-full disabled:opacity-60 text-white rounded-full py-3.5 font-extrabold text-[15px] flex items-center justify-center gap-2 transition ${isRoseProduct ? 'bg-[#A02A5B] hover:bg-[#7A1F44]' : 'bg-[#C9A96A] hover:bg-[#B8945A]'}`}>
                  {submitting? 'جاري الإرسال...': <><Check size={18}/> تأكيد الطلب - الدفع عند الاستلام {variantLabel && `• ${variantLabel}`}</>}
                </button>
                {!canAdd && variantMissing && <p className="text-center text-amber-300 text-xs mt-2">اختر المتغير قبل تأكيد الطلب</p>}
                <div className="flex items-center justify-center gap-3 mt-3 text-[11px] text-white/60">
                  <span className="flex gap-1 items-center"><ShieldCheck size={12}/> حماية الطلبات المكررة مفعّلة</span>
                  <span>•</span>
                  <span>تأكيد هاتفي خلال 2-4 ساعات</span>
                </div>
              </div>
            </form>

            {/* compact action bar — below the payment form, smaller buttons */}
            <div className="bg-white rounded-[24px] border border-[#EDE6D8] p-3 md:p-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleAddToCart} disabled={!canAdd} className={`flex-1 min-w-0 rounded-full py-2.5 px-3 text-xs font-bold border-2 transition flex items-center justify-center gap-1.5 ${canAdd ? 'bg-white border-[#1A1A1E] text-[#1A1A1E] hover:bg-[#1A1A1E] hover:text-white' : 'bg-[#F5EFE6] border-[#EDE6D8] text-[#9A8A6B] cursor-not-allowed'}`}>
                  <ShoppingBag size={14}/>
                  <span className="truncate">{canAdd ? 'أضف للسلة' : variantMissing ? 'اختر المتغير' : 'غير متوفر'}</span>
                </button>
                <button type="button" onClick={handleWish} className={`shrink-0 rounded-full py-2.5 px-3 text-xs font-bold border flex items-center justify-center gap-1.5 transition ${wished ? 'bg-[#A02A5B] text-white border-[#A02A5B]' : 'bg-white border-[#EDE6D8] hover:bg-[#FDF2F6] hover:border-[#F6C0D4] hover:text-[#A02A5B]'}`} aria-label="حفظ">
                  <Heart size={14} className={wished ? 'fill-white' : ''}/>
                  <span className="hidden sm:inline">{wished ? 'محفوظ' : 'حفظ'}</span>
                </button>
                <button type="button" onClick={handleShare} className="shrink-0 rounded-full py-2.5 px-3 text-xs font-bold border bg-white border-[#EDE6D8] hover:bg-[#1A1A1E] hover:text-white flex items-center justify-center gap-1.5 transition" aria-label="مشاركة">
                  <Share2 size={14}/>
                  <span className="hidden sm:inline">مشاركة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#EDE6D8] p-3 flex gap-3 items-center shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ${formFocused ? 'translate-y-full pointer-events-none' : 'translate-y-0'}`}>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[#9A8A6B] truncate">الإجمالي {variantLabel && `• ${variantLabel}`}</div><div className={`font-extrabold ${isRoseProduct ? 'text-[#A02A5B]' : 'text-[#1A1A1E]'}`}>{formatDZD(grandTotal)}</div>
        </div>
        <button type="button" onClick={scrollToOrder} className={`flex-1 text-white rounded-full py-3 text-center font-bold shrink-0 ${isRoseProduct ? 'bg-[#A02A5B]' : 'bg-[#1A1A1E]'}`}>اطلب الآن</button>
      </div>
    </div>
  )
}
