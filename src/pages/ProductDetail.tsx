import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Star, ShieldCheck, Truck, Gift, Minus, Plus, Check, Phone, MapPin, AlertTriangle, Heart, Share2, Droplet, Ruler, Layers, ChevronLeft, ChevronRight, Expand, X, Copy, CheckCheck, ShoppingBag, Lock, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { getProductById, syncProducts, subscribeProducts } from '../services/api/products'
import { getWilayas } from '../services/api/wilayas'
import { getDomainById, getDomains } from '../services/api/domains'
import { createOrder } from '../services/api/orders'
import { trackVisit } from '../services/api/client'
import { calcItemTotal, formatDZD, validateDZPhone, normalizeDZPhone } from '../lib/utils'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { Tracking } from '../services/tracking'
import type { Product, Variant } from '../services/api/types'

// ─── Helper: convert video URLs to embed URLs ──────────────────────────────
function getEmbedUrl(url: string): string {
  if (!url) return ''
  const lower = url.toLowerCase()
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
  const tiktokMatch = url.match(/tiktok\.com\/.*\/video\/(\d+)/)
  if (tiktokMatch) return `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  const igMatch = url.match(/instagram\.com\/(?:reel|reels|p)\/([a-zA-Z0-9_-]+)/)
  if (igMatch) return `https://www.instagram.com/p/${igMatch[1]}/embed`
  if (lower.includes('/embed/')) return url
  return url
}

function isVerticalVideo(url: string): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  if (lower.includes('/shorts/')) return true
  if (lower.includes('tiktok.com')) return true
  if (lower.includes('instagram.com/reel') || lower.includes('instagram.com/reels')) return true
  return false
}

export default function ProductDetail(){
  const {id} = useParams()
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToCart } = useCart()
  const { toggle: toggleWish, isWished: checkWished } = useWishlist()

  const [product, setProduct] = useState<Product | undefined>(() => getProductById(id || ''))
  const [loading, setLoading] = useState(!product)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    let cancelled = false

    // 1. فحص الكاش الفوري
    const found = getProductById(id)
    if (found) {
      setProduct(found)
      setLoading(false)
    } else {
      setLoading(true)
    }

    // 2. قاطع أمان زمني يمنع تعليق شاشة التحميل لأكثر من ثانيتين
    const timer = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 2000)

    // 3. مزامنة البيانات مع إيقاف التحميل حتماً في finally
    void syncProducts()
      .then(() => {
        if (cancelled) return
        const fresh = getProductById(id)
        if (fresh) setProduct(fresh)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          clearTimeout(timer)
        }
      })

    const unsub = subscribeProducts(() => {
      if (cancelled) return
      const fresh = getProductById(id)
      if (fresh) {
        setProduct(fresh)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      clearTimeout(timer)
      unsub()
    }
  }, [id])


  
  
  



    

    
    




  
  const trackedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!product?._id || trackedRef.current === product._id) return
    trackedRef.current = product._id
    const urlParams = new URLSearchParams(window.location.search)
    const sid = product.storeId || urlParams.get('storeId') || ''
    if (sid) {
      trackVisit(sid, 'product', product._id)
      Tracking.viewContent(product._id, product.price || 0)
    }
  }, [product?._id, product?.storeId, product?.price])

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
  const [lightboxImg, setLightboxImg] = useState<string>('')
  const [showShare, setShowShare] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)

  const thumbsRef = useRef<HTMLDivElement>(null)
  const orderRef = useRef<HTMLFormElement>(null)

  const [selColor, setSelColor] = useState<string|undefined>(undefined)
  const [selSize, setSelSize] = useState<string|undefined>(undefined)

  const domain = useMemo(()=>{
    if(!product) return null
    if((product as any).domainId) return getDomainById((product as any).domainId) || getDomains().find(d=> d.categories.some(c=> c.key===product.category)) || getDomains()[0]
    return getDomains().find(d=> d.categories.some(c=> c.key===product.category)) || getDomains()[0]
  }, [product])

  useEffect(()=>{
    const v = searchParams.get('variant')
    if(v && product?.variants?.length){
      const found = product.variants.find(x=> x.id===v)
      if(found){
        if(found.colorAr||found.color) setSelColor(found.colorAr||found.color||undefined)
        if(found.size) setSelSize(found.size)
      }
    }
  }, [product?._id])

  // SEO & Structured Data
  useEffect(() => {
    if (!product) return
    document.title = `${product.nameAr} — ${formatDZD(product.price)} | ${product.name}`
    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.setAttribute('name', 'description')
      document.head.appendChild(metaDesc)
    }
    metaDesc.setAttribute('content', (product.descriptionAr || '').slice(0, 155))
    
    const scriptId = 'product-jsonld'
    document.getElementById(scriptId)?.remove()
    const script = document.createElement('script')
    script.id = scriptId
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'Product',
      'name': product.nameAr,
      'image': product.images,
      'description': product.descriptionAr,
      'sku': product.sku,
      'brand': { '@type': 'Brand', 'name': 'Amugar' },
      'offers': {
        '@type': 'Offer',
        'url': window.location.href,
        'priceCurrency': 'DZD',
        'price': product.price,
        'availability': product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        'itemCondition': 'https://schema.org/NewCondition',
      },
      ...(product.rating ? {
        'aggregateRating': {
          '@type': 'AggregateRating',
          'ratingValue': product.rating,
          'reviewCount': product.reviewsCount || 1,
        }
      } : {}),
    })
    document.head.appendChild(script)
    return () => { document.getElementById(scriptId)?.remove() }
  }, [product?._id])

  useEffect(()=>{
    if(window.location.hash==='#order' && product){
      const t = setTimeout(()=> {
        setShowOrderModal(true)
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
    return undefined
  }, [hasVariants, selColor, selSize, product])

  useEffect(()=>{
    if(!hasVariants || !selectedVariant) return
    const current = searchParams.get('variant')
    if(current !== selectedVariant.id){
      const next = new URLSearchParams(searchParams)
      next.set('variant', selectedVariant.id)
      setSearchParams(next, { replace: true })
    }
  }, [selectedVariant?.id])

  const needColor = hasVariants && colors.length>0
  const needSize = hasVariants && sizes.length>0
  const variantMissing = (needColor && !selColor) || (needSize && !selSize)

  useEffect(()=>{
    if(hasVariants){
      if(colors.length===1 && !selColor) setSelColor(colors[0].colorAr||colors[0].color)
      if(sizes.length===1 && !selSize) setSelSize(sizes[0])
    }
  }, [product?._id])

  const unitPrice = useMemo(()=> (product?.price || 0) + (selectedVariant?.priceAdjustment||0), [product, selectedVariant])
  const effectiveStock = selectedVariant ? selectedVariant.stock : (product?.stock||0)
  const canAdd = effectiveStock>0 && !variantMissing

  const images = useMemo(()=>{
    if(!product) return []
    const base = product.images
    if(selectedVariant?.image){
      return [selectedVariant.image, ...base.filter(b=> b!==selectedVariant.image)]
    }
    return base
  }, [product, selectedVariant])

  useEffect(()=>{
    if(product){
      Tracking.viewContent(product._id, unitPrice)
      window.scrollTo({top:0, left:0, behavior:'auto'})
    }
  },[product?._id])

  useEffect(()=>{ setSelectedImg(0); setDirection(0) }, [selectedVariant?.id, product?._id])

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

  const cleanPhone = normalizeDZPhone(form.phone)
  const isPhoneValid = validateDZPhone(cleanPhone)

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
    const storeSlug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('store') : null
    let queryParams = ''
    if (selectedVariant && storeSlug) queryParams = `?variant=${selectedVariant.id}&store=${encodeURIComponent(storeSlug)}`
    else if (selectedVariant) queryParams = `?variant=${selectedVariant.id}`
    else if (storeSlug) queryParams = `?store=${encodeURIComponent(storeSlug)}`
    const url = `${base}/product/${product._id}${queryParams}#order`
    setShareUrl(url)
    try{
      if(navigator.share && window.innerWidth < 768){
        await navigator.share({ title: product.nameAr, text: product.descriptionAr.slice(0,90), url })
        try{ await navigator.clipboard.writeText(url)}catch{}
        showToast('تمت المشاركة ✓')
        return
      }
    }catch{}
    setShowShare(true)
    try{ await navigator.clipboard.writeText(url); setCopied(true); setTimeout(()=> setCopied(false), 2000)}catch{}
  }

  useEffect(()=>{
    const lock = showLightbox || showShare || showOrderModal
    if(lock){
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return ()=> { document.body.style.overflow = prev }
    }
  }, [showLightbox, showShare, showOrderModal])

  const copyShare = async ()=>{
    try{ await navigator.clipboard.writeText(shareUrl); setCopied(true); showToast('تم نسخ رابط الطلب المباشر ✓'); setTimeout(()=> setCopied(false),2000)}catch{ showToast('انسخي الرابط يدوياً')}
  }

  const openOrderModal = (e?:React.MouseEvent)=>{
    if(e){ e.preventDefault(); e.stopPropagation() }
    if(variantMissing){
      showToast('اختر اللون والمقاس أولاً')
      const el = document.getElementById('variant-selector')
      el?.scrollIntoView({behavior:'smooth', block:'center'})
      return
    }
    setShowOrderModal(true)
  }

  const closeOrderModal = ()=>{
    setShowOrderModal(false)
  }

  if (loading && !product) return (
    <div className="bg-[#FAF8F5] min-h-screen py-6 px-4 md:px-6">
      <div className="max-w-[1280px] mx-auto grid lg:grid-cols-[1.15fr_0.85fr] gap-6 animate-pulse">
        <div className="space-y-3">
          <div className="aspect-[4/5] bg-[#EDE6D8]/60 rounded-2xl w-full" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-16 h-16 bg-[#EDE6D8]/60 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-[24px] border border-[#EDE6D8] p-6 space-y-4">
            <div className="h-4 bg-[#EDE6D8] rounded w-1/4" />
            <div className="h-8 bg-[#EDE6D8] rounded w-3/4" />
            <div className="h-6 bg-[#EDE6D8] rounded w-1/3" />
            <div className="h-20 bg-[#EDE6D8]/40 rounded-xl" />
          </div>
          <div className="bg-white rounded-[24px] border border-[#EDE6D8] p-6 space-y-3">
            <div className="h-6 bg-slate-100 rounded w-1/2 mx-auto" />
            <div className="h-12 bg-emerald-600/30 rounded-2xl w-full" />
          </div>
        </div>
      </div>
    </div>
  )

  if(!product) return <div className="max-w-[1280px] mx-auto px-4 py-12 text-center">المنتج غير موجود. <Link to="/shop" className="text-amber-800 underline">العودة للمتجر</Link></div>

  const validate = ()=>{
    const e: Record<string,string> = {}
    if(!form.name.trim() || form.name.trim().length<3) e.name='الاسم مطلوب (3 أحرف على الأقل)'
    if(!validateDZPhone(cleanPhone)) e.phone='رقم هاتف غير صحيح. مثال: 0550123456'
    if(!form.wilaya) e.wilaya='اختر الولاية'
    if(variantMissing) e.variant='اختر اللون والمقاس'
    if(effectiveStock<=0) e.stock='المنتج غير متوفر بهذا المتغير'
    if(qty>effectiveStock) e.qty=`الكمية المطلوبة أكبر من المخزون (${effectiveStock})`
    setErrors(e)
    if(e.variant || e.stock || e.qty){
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
        customerName: form.name.trim(),
        phone: cleanPhone,
        phone2: form.phone2 ? normalizeDZPhone(form.phone2) : '',
        wilaya: wilaya!.code,
        wilayaNameAr: wilaya!.nameAr,
        commune: form.commune.trim(),
        address: form.address.trim(),
        deliveryType,
        items: [{ productId: product._id, nameAr: product.nameAr + (variantLabel ? ` — ${variantLabel}`:''), image: selectedVariant?.image || product.images[0], qty, unitPrice, total: productTotal, variantLabel, variantId: selectedVariant?.id }],
        subtotal: unitPrice*qty,
        discount: discountAmount,
        shippingCost: shipping,
        total: grandTotal,
      } as any)
      Tracking.purchase(order.orderNumber, grandTotal, [{id: product._id, qty, variantLabel}])
      setShowOrderModal(false)
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
    const el = thumbsRef.current?.children[idx] as HTMLElement | undefined
    el?.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'})
  }

  return (
    <div className="bg-[#FAF8F5] min-h-screen pb-24 md:pb-12">
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-xl border border-white/10 pointer-events-none">{toast}</div>}

      {/* Share Modal */}
      {showShare && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div onClick={()=> setShowShare(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"/>
          <div className="relative bg-white rounded-[24px] p-6 w-full max-w-[520px] shadow-2xl border border-[#EDE6D8]">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg flex items-center gap-2 text-slate-900"><Share2 size={18} className="text-amber-800"/> مشاركة رابط الطلب المباشر</h3>
              <button type="button" onClick={()=> setShowShare(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 grid place-items-center"><X size={16}/></button>
            </div>
            <p className="text-sm text-slate-600 mt-2 leading-6">هذا الرابط يفتح صفحة المنتج مباشرة للطلب السريع مع المتغير المختار <span className="bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-xs font-bold">{variantLabel || 'بدون متغير'}</span>.</p>
            <div className="mt-4 flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl p-2">
              <input value={shareUrl} readOnly className="flex-1 bg-transparent text-xs outline-none px-2 text-slate-800" dir="ltr"/>
              <button type="button" onClick={copyShare} className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>{copied ? <CheckCheck size={14}/> : <Copy size={14}/>} {copied ? 'تم النسخ' : 'نسخ'}</button>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={async()=>{ try{ await navigator.clipboard.writeText(shareUrl); showToast('تم النسخ')}catch{} }} className="flex-1 bg-white border border-slate-200 rounded-full py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50">نسخ الرابط</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`شاهد هذا المنتج من ${product.nameAr} ${variantLabel? `(${variantLabel})`:''}: ${shareUrl}`)}`} target="_blank" rel="noreferrer" className="flex-1 bg-[#25D366] text-white rounded-full py-2.5 text-sm font-bold text-center hover:opacity-95">مشاركة واتساب</a>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {showLightbox && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[70] bg-slate-900/90 backdrop-blur flex items-center justify-center p-4" onClick={()=> setShowLightbox(false)}>
            <button type="button" onClick={()=> setShowLightbox(false)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white text-black grid place-items-center"><X size={18}/></button>
            <img src={lightboxImg || images[selectedImg]} alt={product.nameAr} className="max-w-[92vw] max-h-[86vh] object-contain rounded-2xl shadow-2xl" onClick={e=> e.stopPropagation()}/>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              <button type="button" onClick={(e)=>{e.stopPropagation(); paginate(-1)}} className="w-10 h-10 rounded-full bg-white text-black grid place-items-center"><ChevronLeft size={18}/></button>
              <button type="button" onClick={(e)=>{e.stopPropagation(); paginate(1)}} className="w-10 h-10 rounded-full bg-white text-black grid place-items-center"><ChevronRight size={18}/></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-4">
        <div className="text-xs text-slate-500 flex gap-1.5 items-center flex-wrap">
          <Link to="/" className="hover:text-slate-900">الرئيسية</Link> <span>/</span> <Link to="/shop" className="hover:text-slate-900">المتجر</Link> <span>/</span> <span className="text-slate-900 font-bold">{product.nameAr}</span>
          {domain && <span className="hidden md:inline ms-2 bg-slate-900 text-white text-[10px] px-2.5 py-0.5 rounded-full">{domain.nameAr}</span>}
          {variantLabel && <span className="hidden md:inline ms-1 bg-amber-50 border border-amber-200 text-amber-900 text-[10px] px-2.5 py-0.5 rounded-full">{variantLabel}</span>}
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6 mt-4">
          {/* Gallery */}
          <div className="min-w-0">
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-white border border-[#EDE6D8] group select-none shadow-[0_2px_12px_rgba(0,0,0,0.03)]" onMouseEnter={()=>setSliderHovered(true)} onMouseLeave={()=>setSliderHovered(false)}>
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
                  // @ts-ignore
                  fetchpriority="high"
                />
              </AnimatePresence>

              <button type="button" onClick={()=> paginate(-1)} className="absolute top-1/2 -translate-y-1/2 right-2 w-8 h-8 rounded-full bg-black/30 backdrop-blur text-white grid place-items-center hover:bg-black/50 transition md:opacity-0 md:group-hover:opacity-100 z-10">
                <ChevronRight size={14}/>
              </button>
              <button type="button" onClick={()=> paginate(1)} className="absolute top-1/2 -translate-y-1/2 left-2 w-8 h-8 rounded-full bg-black/30 backdrop-blur text-white grid place-items-center hover:bg-black/50 transition md:opacity-0 md:group-hover:opacity-100 z-10">
                <ChevronLeft size={14}/>
              </button>

              <button type="button" onClick={()=> setShowLightbox(true)} className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/30 backdrop-blur text-white grid place-items-center hover:bg-black/50 transition md:opacity-0 md:group-hover:opacity-100 z-10" aria-label="تكبير">
                <Expand size={12}/>
              </button>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/30 backdrop-blur text-white px-2.5 py-1 rounded-full pointer-events-none">
                {images.map((_, i)=> <span key={i} className={`h-1.5 rounded-full transition-all ${i===selectedImg ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`}></span>)}
              </div>
            </div>

            {/* Thumbnails */}
            <div className="relative mt-2">
              <div ref={thumbsRef} className="flex gap-2 overflow-x-auto thumb-scroll scroll-smooth snap-x snap-mandatory pb-1">
                {images.map((img,i)=> (
                  <button
                    key={i+img}
                    type="button"
                    onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); goTo(i)}}
                    className={`shrink-0 w-[64px] h-[64px] md:w-20 md:h-20 rounded-xl overflow-hidden border-2 snap-start relative transition-all duration-300 ${selectedImg===i ? 'border-amber-600 shadow-md ring-2 ring-amber-600/20' : 'border-transparent hover:border-[#EDE6D8]'}`}
                  >
                    <img src={img} alt={`صورة ${i+1}`} className="w-full h-full object-cover" draggable={false} loading="lazy"/>
                  </button>
                ))}
              </div>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                {t:"توصيل 24-72 ساعة", sub:"لكافة الولايات", i:Truck, c:"text-blue-700 bg-blue-50/70 border-blue-200/60"},
                {t:"الدفع عند الاستلام", sub:"افحص ثم ادفع", i:ShieldCheck, c:"text-emerald-700 bg-emerald-50/70 border-emerald-200/60"},
                {t:"ضمان الاستبدال", sub:"خدمة متواصلة", i:Gift, c:"text-amber-800 bg-amber-50/70 border-amber-200/60"},
              ].map(b=> (
                <div key={b.t} className={`rounded-xl p-2.5 text-center border flex flex-col items-center gap-1 ${b.c}`}>
                  <b.i size={16}/>
                  <div className="text-[11px] font-extrabold leading-tight">{b.t}</div>
                  <div className="text-[9px] opacity-75">{b.sub}</div>
                </div>
              ))}
            </div>

            {product.attributes && Object.keys(product.attributes).length>0 && (
              <div className="mt-3 bg-white border border-[#EDE6D8] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                <h4 className="font-bold text-sm flex items-center gap-1.5 text-slate-900"><Layers size={14} className="text-amber-700"/> مواصفات {domain?.nameAr}</h4>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {Object.entries(product.attributes).map(([k,v])=> (
                    <div key={k} className="bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2">
                      <div className="text-[10px] text-slate-500">{domain?.attributeSchema.find(a=> a.key===k)?.labelAr || k}</div>
                      <div className="text-xs font-bold text-slate-900 truncate mt-0.5">{Array.isArray(v) ? v.join('، ') : String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info & Luminous CTA */}
          <div className="space-y-4 min-w-0">
            <div className="bg-white rounded-[24px] border border-[#EDE6D8] p-5 md:p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-2.5 py-1 rounded-full font-bold bg-amber-50 text-amber-900 border border-amber-200">{product.category.toUpperCase()}</span>
                <span className="flex items-center gap-1 text-amber-700 font-bold"><Star size={12} fill="#b45309"/>{product.rating} ({product.reviewsCount} تقييم)</span>
                <span className={`ms-auto text-[11px] px-2.5 py-1 rounded-full font-bold ${effectiveStock>10?'bg-emerald-50 text-emerald-700': effectiveStock>0 ? 'bg-amber-50 text-amber-700':'bg-rose-50 text-rose-600 border border-rose-200'}`}>{effectiveStock>0? `متوفر: ${effectiveStock} قطعة`:'نفد المخزون'}</span>
              </div>
              <h1 className="text-[24px] md:text-[26px] font-extrabold text-slate-900 leading-tight mt-3">{product.nameAr}</h1>
              <p className="tracking-wide text-xs text-slate-500 mt-1">{product.name.toUpperCase()} • {product.material} — SKU: {product.sku}</p>
              <p className="text-sm leading-6 text-slate-700 mt-3">{product.descriptionAr}</p>

              {/* Video embed */}
              {product.videoUrl && (() => {
                const embedUrl = getEmbedUrl(product.videoUrl)
                const isVertical = isVerticalVideo(product.videoUrl)
                return (
                  <div className="mt-4">
                    <div className="text-xs font-bold flex items-center gap-1.5 mb-2 text-slate-800">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-amber-700" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z"/></svg>
                      فيديو توضيحي للمنتج
                    </div>
                    <div className={`relative rounded-xl overflow-hidden bg-black mx-auto ${isVertical ? 'w-full max-w-[320px] aspect-[9/16]' : 'w-full aspect-video'}`}>
                      <iframe src={embedUrl} className="w-full h-full" allowFullScreen loading="lazy" frameBorder="0" />
                    </div>
                  </div>
                )
              })()}

              {/* Extra Images */}
              {product.descriptionImages && product.descriptionImages.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs font-bold flex items-center gap-1.5 mb-2 text-slate-800">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-amber-700" xmlns="http://www.w3.org/2000/svg"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                    صور تفصيلية
                  </div>
                  <div className="space-y-2">
                    {product.descriptionImages.map((img, i) => (
                      <div key={i} className="rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-95 transition" onClick={() => { setLightboxImg(img); setShowLightbox(true) }}>
                        <img src={img} alt={`صورة ${i+1}`} className="w-full object-contain" loading="lazy" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Price row */}
              <div className="flex items-baseline gap-3 mt-4 flex-wrap">
                <span className="text-[26px] font-extrabold text-amber-900">{formatDZD(unitPrice)}</span>
                {product.compareAtPrice && <span className="line-through text-slate-400 text-sm">{formatDZD(product.compareAtPrice)}</span>}
                {disc>0 && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-full">وفّرتِ {formatDZD(discountAmount)}</span>}
              </div>

              {/* Variants */}
              {hasVariants && (
                <div id="variant-selector" className="mt-4 space-y-3 scroll-mt-24 pt-3 border-t border-slate-100">
                  {needColor && (
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Droplet size={12} className="text-amber-700"/> اللون {selColor && <span className="text-amber-800">— {selColor}</span>} {needColor && !selColor && <span className="text-rose-500">*</span>}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {colors.map(v=>{
                          const active = (v.colorAr||v.color)===selColor
                          const disabled = availableColorsForSize.length? !availableColorsForSize.some(a=> (a.colorAr||a.color)===(v.colorAr||v.color)) : false
                          return (
                            <button key={v.id} type="button" onClick={()=> setSelColor(v.colorAr||v.color)} disabled={disabled} className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs md:text-sm font-bold transition-all ${active ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'} ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
                              <span className="w-4 h-4 rounded-full border border-black/10" style={{background: v.colorHex||'#ccc'}}></span>
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
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Ruler size={12} className="text-amber-700"/> المقاس {selSize && <span className="text-amber-800">— {selSize}</span>} {needSize && !selSize && <span className="text-rose-500">*</span>}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(availableSizesForColor.length? availableSizesForColor : sizes).map(s=>{
                          const active = s===selSize
                          return (
                            <button key={s} type="button" onClick={()=> setSelSize(s)} className={`min-w-[50px] px-3.5 py-2 rounded-full border text-xs md:text-sm font-bold transition-all ${active ? 'bg-amber-700 text-white border-amber-700 shadow-md' : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'}`}>
                              {s}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {selectedVariant && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3 text-xs">
                      {selectedVariant.colorHex && <span className="w-5 h-5 rounded-full border" style={{background:selectedVariant.colorHex}}></span>}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{variantLabel}</div>
                        <div className="text-slate-500 truncate">المخزون: {selectedVariant.stock} • SKU: {selectedVariant.sku || product.sku}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tier pricing banner */}
              {product.tierPricing && product.tierPricing.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 overflow-hidden bg-amber-50/50">
                  <div className="px-3.5 py-2 text-xs font-bold text-amber-900 border-b border-amber-200 flex justify-between">
                    <span>عروض التوفير للكميات</span>
                    <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[10px]">خصم تلقائي</span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-amber-200 text-center bg-white">
                    <div className="py-2.5">
                      <div className="text-[11px] text-slate-500">1 قطعة</div>
                      <div className="font-bold text-xs text-slate-900">{formatDZD(unitPrice)}</div>
                    </div>
                    {product.tierPricing.map(t=> (
                      <div key={t.minQty} className={`py-2.5 ${qty>=t.minQty? 'bg-amber-50' : ''}`}>
                        <div className="text-[11px] text-slate-500">{t.minQty} قطع</div>
                        <div className="font-bold text-xs text-emerald-700">-{t.discountPercent}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity selector */}
              <div className="flex items-center gap-3 mt-4">
                <div className="flex items-center border border-slate-200 rounded-full p-0.5 bg-slate-50">
                  <button type="button" onClick={()=>setQty(q=>Math.max(1,q-1))} className="w-8 h-8 rounded-full bg-white border border-slate-200 grid place-items-center text-slate-700 hover:bg-slate-100"><Minus size={14}/></button>
                  <span className="w-10 text-center font-bold text-sm text-slate-900">{qty}</span>
                  <button type="button" onClick={()=>setQty(q=> Math.min(effectiveStock||99, q+1))} className="w-8 h-8 rounded-full bg-slate-900 text-white grid place-items-center disabled:opacity-30"><Plus size={14}/></button>
                </div>
                <div className="text-xs text-slate-600">المجموع: <b className="text-slate-900 text-sm">{formatDZD(productTotal)}</b></div>
              </div>
            </div>

            {/* ─── Luminous Reassuring CTA Box ─── */}
            <div className="bg-white border-2 border-emerald-600/30 rounded-[24px] p-5 md:p-6 shadow-[0_8px_24px_rgba(16,185,129,0.06)] relative overflow-hidden">
              <div className="text-center">
                <div className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center justify-center gap-1">
                  <ShieldCheck size={14}/> الدفع عند الاستلام • فحص المنتج قبل الدفع
                </div>
                <div className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1">{formatDZD(grandTotal)}</div>
                <div className="text-xs text-slate-500 mb-4">شحن ({wilaya?.nameAr}): {wilaya ? formatDZD(shipping) : '—'} • تأكيد هاتفي سريع</div>

                <button
                  type="button"
                  onClick={openOrderModal}
                  disabled={!canAdd}
                  className="w-full py-4 rounded-2xl font-extrabold text-base text-white transition-all duration-300 shadow-lg shadow-emerald-600/25 bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShoppingBag size={20} />
                  <span>اطلب الآن — الدفع عند الاستلام</span>
                </button>

                <div className="flex items-center justify-center gap-3 mt-3 text-[11px] text-slate-500">
                  <span className="flex gap-1 items-center"><Clock size={12}/> توصيل سريع 24-72 ساعة</span>
                  <span>•</span>
                  <span>ضمان الاستبدال</span>
                </div>
              </div>
            </div>

            {/* Secondary Actions */}
            <div className="bg-white rounded-[24px] border border-[#EDE6D8] p-3 md:p-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleAddToCart} disabled={!canAdd} className={`flex-1 min-w-0 rounded-full py-2.5 px-3 text-xs font-bold border transition flex items-center justify-center gap-1.5 ${canAdd ? 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'}`}>
                  <ShoppingBag size={14}/>
                  <span className="truncate">{canAdd ? 'أضف للسلة' : 'اختر المتغير أولاً'}</span>
                </button>
                <button type="button" onClick={handleWish} className={`shrink-0 rounded-full py-2.5 px-3 text-xs font-bold border flex items-center justify-center gap-1.5 transition ${wished ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
                  <Heart size={14} className={wished ? 'fill-rose-600' : ''}/>
                  <span className="hidden sm:inline">{wished ? 'محفوظ' : 'حفظ'}</span>
                </button>
                <button type="button" onClick={handleShare} className="shrink-0 rounded-full py-2.5 px-3 text-xs font-bold border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1.5 transition">
                  <Share2 size={14}/>
                  <span className="hidden sm:inline">مشاركة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 p-3 flex gap-3 items-center shadow-[0_-6px_20px_rgba(0,0,0,0.06)]">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-slate-500 truncate">الإجمالي عند الاستلام</div>
          <div className="font-extrabold text-base text-amber-900">{formatDZD(grandTotal)}</div>
        </div>
        <button type="button" onClick={openOrderModal} className="flex-1 text-white rounded-full py-3 text-center font-extrabold text-xs shadow-md bg-emerald-600 hover:bg-emerald-700">
          اطلب الآن — COD
        </button>
      </div>

      {/* ═══ HIGH-TRUST LUMINOUS ORDER MODAL (POPUP) ═══ */}
      <AnimatePresence>
        {showOrderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
            onClick={closeOrderModal}
          >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl w-full max-w-[490px] max-h-[92vh] overflow-y-auto shadow-2xl text-slate-900 border border-slate-100"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center border border-emerald-200/60">
                    <Lock size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                      تأكيد الطلب — الدفع عند الاستلام
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{product.nameAr} {variantLabel && `• ${variantLabel}`}</p>
                  </div>
                </div>
                <button type="button" onClick={closeOrderModal} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 grid place-items-center text-slate-600 transition"><X size={16} /></button>
              </div>

              {/* Modal Body */}
              <form ref={orderRef} id="order" onSubmit={handleDirectOrder} className="p-5 space-y-3.5">
                {duplicateWarn && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3.5 py-2.5 text-xs font-bold flex gap-2 items-center">
                    <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                    <span>طلبك مسجل بالفعل! سيقوم فريق خدمة العملاء بالاتصال بك.</span>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل *</label>
                  <input
                    value={form.name}
                    onChange={e=>setForm({...form,name:e.target.value})}
                    placeholder="مثال: يوسف بن أحمد"
                    className="w-full rounded-xl px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 text-slate-900 text-sm outline-none transition focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 font-medium placeholder:text-slate-400"
                  />
                  {errors.name && <p className="text-rose-600 text-xs mt-1 font-bold">{errors.name}</p>}
                </div>

                {/* Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1"><Phone size={12}/> رقم الهاتف *</span>
                    </label>
                    <div className="relative">
                      <input
                        value={form.phone}
                        onChange={e=>setForm({...form,phone:e.target.value})}
                        placeholder="0550123456"
                        dir="ltr"
                        className={`w-full rounded-xl px-3.5 py-2.5 bg-slate-50/70 border text-slate-900 text-sm outline-none transition text-right font-medium placeholder:text-slate-400 ${
                          form.phone.length > 0
                            ? isPhoneValid
                              ? 'border-emerald-600 bg-emerald-50/20 focus:ring-4 focus:ring-emerald-500/10'
                              : 'border-amber-400'
                            : 'border-slate-200 focus:bg-white focus:border-emerald-600'
                        }`}
                      />
                      {isPhoneValid && (
                        <span className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 rounded-full bg-emerald-600 text-white grid place-items-center">
                          <Check size={10} />
                        </span>
                      )}
                    </div>
                    {errors.phone && <p className="text-rose-600 text-xs mt-1 font-bold">{errors.phone}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">رقم ثانوي (اختياري)</label>
                    <input
                      value={form.phone2}
                      onChange={e=>setForm({...form,phone2:e.target.value})}
                      placeholder="0660..."
                      dir="ltr"
                      className="w-full rounded-xl px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 text-slate-900 text-sm outline-none text-right font-medium placeholder:text-slate-400 focus:bg-white focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Wilaya */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <MapPin size={12}/> الولاية *
                    </label>
                    <select
                      value={form.wilaya}
                      onChange={e=>setForm({...form,wilaya:e.target.value})}
                      className="w-full rounded-xl px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 text-slate-900 text-sm outline-none font-bold appearance-none cursor-pointer focus:bg-white focus:border-emerald-600"
                    >
                      {wilayas.map(w=> <option key={w.code} value={w.code}>{w.code} - {w.nameAr} ({w.deliveryDays})</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">البلدية (اختياري)</label>
                    <input
                      value={form.commune}
                      onChange={e=>setForm({...form,commune:e.target.value})}
                      placeholder="سيتم التأكيد هاتفياً"
                      className="w-full rounded-xl px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 text-slate-900 text-sm outline-none placeholder:text-slate-400 focus:bg-white focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">العنوان أو الحي (اختياري)</label>
                  <input
                    value={form.address}
                    onChange={e=>setForm({...form,address:e.target.value})}
                    placeholder="سيتم التأكيد هاتفياً"
                    className="w-full rounded-xl px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 text-slate-900 text-sm outline-none placeholder:text-slate-400 focus:bg-white focus:border-emerald-600"
                  />
                </div>

                {/* Delivery Options */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={()=>setDeliveryType('home')}
                    className={`rounded-2xl p-3 text-xs font-bold border-2 flex flex-col items-center gap-1 transition-all ${
                      deliveryType==='home'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex gap-1 items-center"><Truck size={14}/> توصيل للمنزل</span>
                    <span className="text-xs font-extrabold text-emerald-700">{wilaya? formatDZD(wilaya.deliveryHome):'—'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={()=>setDeliveryType('desk')}
                    className={`rounded-2xl p-3 text-xs font-bold border-2 flex flex-col items-center gap-1 transition-all ${
                      deliveryType==='desk'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex gap-1 items-center"><MapPin size={14}/> استلام من المكتب</span>
                    <span className="text-xs font-extrabold text-emerald-700">{wilaya? formatDZD(wilaya.deliveryDesk):'—'}</span>
                  </button>
                </div>

                {/* Order Summary in Modal */}
                <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200 text-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">المنتج ({qty} قطع) {variantLabel && `• ${variantLabel}`}</span>
                    <span className="font-bold text-slate-900">{formatDZD(unitPrice*qty)}</span>
                  </div>
                  {discountAmount>0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>خصم الكمية ({disc}%)</span>
                      <span>-{formatDZD(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">الشحن ({wilaya?.nameAr})</span>
                    <span className="font-bold text-slate-900">{formatDZD(shipping)}</span>
                  </div>
                  <div className="h-px bg-slate-200 my-1"/>
                  <div className="flex justify-between font-extrabold text-sm pt-0.5">
                    <span className="text-slate-900">الإجمالي عند الاستلام</span>
                    <span className="text-amber-900 text-base">{formatDZD(grandTotal)}</span>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submitting || !canAdd}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3.5 font-extrabold text-base flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/25 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جاري تأكيد الطلب...
                    </span>
                  ) : (
                    <>
                      <Check size={18}/>
                      <span>تأكيد الطلب — {formatDZD(grandTotal)}</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500 pt-1">
                  <span className="flex gap-1 items-center text-emerald-700 font-bold">
                    <ShieldCheck size={13}/> فحص المنتج قبل الدفع
                  </span>
                  <span>•</span>
                  <span>اتصال هاتفي لتأكيد الإرسال</span>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

