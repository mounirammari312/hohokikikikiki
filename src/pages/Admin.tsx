import { useEffect, useState, useMemo } from 'react'
import { getOrders, updateOrderStatus, deleteOrder, exportOrdersCsv } from '../services/api/orders'
import { getWilayas, updateWilayaRate, addWilaya } from '../services/api/wilayas'
import { getProducts, addProduct, updateProduct, deleteProduct, duplicateProduct, toggleProductFlag } from '../services/api/products'
import { getSettings, saveSettings } from '../services/api/settings'
import { getDomains, getActiveDomain, setActiveDomain, createCustomDomain, updateDomain, deleteDomain, duplicateDomain } from '../services/api/domains'
import type { Order, OrderStatus, WilayaRate, Product, StoreDomain, DomainCategory, AttributeDef, Variant } from '../services/api/types'
import { formatDZD } from '../lib/utils'
import {
  Download, Trash2, Search, Package, Truck, CheckCircle, XCircle, Clock, BarChart3, Settings,
  MapPinned, Save, Plus, Pencil, Copy, Eye, Star, Crown, Sparkles, Store, Megaphone,
  Phone, Mail, Instagram, Palette, Zap, Image as ImageIcon, Tag, Layers, X,
  AlertCircle, Check, Filter, ShoppingBag, TrendingUp, Award, Gem, Shirt, Heart,
  Wand2, RefreshCw, Globe, Palette as PaletteIcon, Ruler, Droplet, Paintbrush, FileText
} from 'lucide-react'

const statusMap: Record<OrderStatus, { label: string, color: string }> = {
  new: { label: 'جديد', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: 'مؤكد', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  shipping: { label: 'قيد الشحن', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  delivered: { label: 'تم التسليم', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-800 border-red-200' },
}

const domainIcons: Record<string, any> = {
  domain_jewelry: Gem,
  domain_fashion: Shirt,
  domain_beauty: Heart,
}

export default function Admin() {
  const [orders, setOrders] = useState<Order[]>(() => getOrders())
  const [wilayas, setWilayas] = useState<WilayaRate[]>(() => getWilayas())
  const [products, setProducts] = useState<Product[]>(() => getProducts())
  const [settings, setSettings] = useState(() => getSettings())
  const [domains, setDomains] = useState<StoreDomain[]>(() => getDomains())
  const [activeDomain, setActiveDomainState] = useState<StoreDomain>(() => getActiveDomain())
  const [tab, setTab] = useState<'domains' | 'products' | 'orders' | 'wilayas' | 'store' | 'tracking'>('domains')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [editingWilaya, setEditingWilaya] = useState<Record<string, Partial<WilayaRate>>>({})
  const [newWilaya, setNewWilaya] = useState<Partial<WilayaRate>>({ code: '', nameAr: '', name: '', deliveryHome: 600, deliveryDesk: 400, deliveryDays: '48 ساعة' })

  // Product admin states
  const [prodSearch, setProdSearch] = useState('')
  const [prodCat, setProdCat] = useState<string>('all')
  const [showProdModal, setShowProdModal] = useState(false)
  const [editingProd, setEditingProd] = useState<Product | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // domain modal
  const [showDomainModal, setShowDomainModal] = useState(false)
  const [editingDomain, setEditingDomain] = useState<StoreDomain | null>(null)
  const [domainForm, setDomainForm] = useState<any>({
    name: '', nameAr: '', descriptionAr: '', heroBadge: '', heroTitleAr: '', heroSubtitleAr: '', heroImage: '', footerDescriptionAr: '', categories: [{key:'general', label:'General', labelAr:'عام'}], attributeSchema: [], variantConfig: { hasColor:false, hasSize:false, sizeOptions:[], colorPresets:[] }, isPreset: false
  })

  const [storeForm, setStoreForm] = useState(() => getSettings())

  // helpers
  const allCategories = useMemo(()=>{
    const map = new Map<string, DomainCategory>()
    domains.forEach(d=> d.categories.forEach(c=> map.set(c.key, c)))
    products.forEach(p=> { if(!map.has(p.category)) map.set(p.category, {key:p.category, label: p.category, labelAr: p.category}) })
    return Array.from(map.values())
  }, [domains, products])

  const makeEmptyProduct = (domain: StoreDomain): Omit<Product,'_id'|'createdAt'> => ({
    sku: '',
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    price: 0,
    compareAtPrice: undefined,
    images: [''],
    category: domain.categories[0]?.key || 'general',
    material: '',
    materialAr: '',
    rating: 4.8,
    reviewsCount: 0,
    stock: 10,
    isFeatured: false,
    isNew: true,
    attributes: {},
    variants: [],
    tierPricing: [{ minQty: 2, discountPercent: 10, label: 'Duo', labelAr: 'عرض الثنائي' }],
    domainId: domain.id,
  } as any)

  const [prodForm, setProdForm] = useState<Omit<Product,'_id'|'createdAt'>>(()=> makeEmptyProduct(activeDomain))
  const [prodErrors, setProdErrors] = useState<Record<string,string>>({})

  // variant bulk helpers
  const [bulkSizes, setBulkSizes] = useState<string>('')
  const [bulkColors, setBulkColors] = useState<string>('')

  useEffect(() => {
    setOrders(getOrders()); setWilayas(getWilayas()); setProducts(getProducts()); setSettings(getSettings()); setStoreForm(getSettings()); setDomains(getDomains()); setActiveDomainState(getActiveDomain())
  }, [tab])

  useEffect(()=>{ if(!showProdModal) setProdForm(makeEmptyProduct(activeDomain)) }, [activeDomain.id])

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) } }, [toast])
  const showToast = (msg: string) => setToast(msg)

  const refreshAll = ()=>{
    setDomains([...getDomains()])
    setActiveDomainState(getActiveDomain())
    setSettings(getSettings())
    setStoreForm(getSettings())
    setProducts([...getProducts()])
  }

  const handleActivateDomain = async (id:string)=>{
    const d = await setActiveDomain(id)
    if(d){
      refreshAll()
      showToast(`تم التحويل إلى مجال ${d.nameAr} — المتجر تحدّث فوراً ✨`)
    }
  }

  const openDomainCreate = ()=>{
    setEditingDomain(null)
    setDomainForm({
      name: '', nameAr: '', descriptionAr: '', heroBadge: 'NEW COLLECTION 2026', heroTitleAr: 'عنوان جذاب لمجالك الجديد', heroSubtitleAr: 'وصف قصير يبرز قيمة منتجاتك مع الدفع عند الاستلام في 58 ولاية.', heroImage: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200&q=80', footerDescriptionAr: 'وصف الفوتر لمجالك الجديد.',
      categories: [{key:'cat1', label:'Category 1', labelAr:'فئة 1'}],
      attributeSchema: [
        { key:'custom1', label:'Custom Field', labelAr:'حقل مخصص', type:'text', placeholder:'مثال: قيمة', required:false },
      ],
      variantConfig: { hasColor:true, hasSize:true, sizeOptions:['S','M','L','XL'], colorPresets: [{name:'Black', nameAr:'أسود', hex:'#1A1A1E'},{name:'Beige', nameAr:'بيج', hex:'#D2B48C'}]},
      isPreset:false
    })
    setShowDomainModal(true)
  }
  const openDomainEdit = (d: StoreDomain)=>{
    setEditingDomain(d)
    setDomainForm({...d, categories: d.categories.map(c=>({...c})), attributeSchema: d.attributeSchema.map(a=>({...a, options: a.options? [...a.options]: undefined})), variantConfig: {...d.variantConfig, sizeOptions:[...d.variantConfig.sizeOptions], colorPresets: d.variantConfig.colorPresets.map(c=>({...c}))}})
    setShowDomainModal(true)
  }
  const handleSaveDomain = async ()=>{
    if(!domainForm.nameAr.trim() || !domainForm.name.trim()){ showToast('أدخل اسم المجال FR والعربي'); return }
    if(domainForm.categories.length===0){ showToast('أضف فئة واحدة على الأقل'); return }
    for(const c of domainForm.categories){ if(!c.key.trim() || !c.labelAr.trim()){ showToast('أكمل بيانات كل فئة (key + الاسم العربي)'); return } }
    const keys = domainForm.categories.map((c:any)=> c.key.trim())
    if(new Set(keys).size !== keys.length){ showToast('مفاتيح الفئات يجب أن تكون فريدة'); return }
    // validate attributeSchema keys
    for(const a of domainForm.attributeSchema){ if(!a.key.trim() || !a.labelAr.trim()){ showToast('أكمل بيانات كل حقل مخصص'); return } }
    const aKeys = domainForm.attributeSchema.map((a:any)=> a.key.trim())
    if(new Set(aKeys).size !== aKeys.length){ showToast('مفاتيح الحقول يجب أن تكون فريدة'); return }

    if(editingDomain){
      await updateDomain(editingDomain.id, {...domainForm, name: domainForm.name.trim(), nameAr: domainForm.nameAr.trim()})
      showToast('تم تحديث المجال — إعدادات المنتج تحدثت تلقائياً')
    }else{
      await createCustomDomain({...domainForm, name: domainForm.name.trim(), nameAr: domainForm.nameAr.trim()} as any)
      showToast('تم إنشاء مجال جديد — يمكنك تفعيله الآن')
    }
    setShowDomainModal(false)
    refreshAll()
  }

  const filteredOrders = useMemo(() => {
    let list = [...orders]
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter)
    if (q.trim()) { const s = q.toLowerCase(); list = list.filter(o => o.orderNumber.toLowerCase().includes(s) || o.customerName.toLowerCase().includes(s) || o.phone.includes(s) || o.wilayaNameAr.includes(q)) }
    return list
  }, [orders, q, statusFilter])

  const filteredProducts = useMemo(() => {
    let list = [...products]
    if (prodCat !== 'all') list = list.filter(p => p.category === prodCat)
    if (prodSearch.trim()) { const s = prodSearch.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(s) || p.nameAr.includes(prodSearch) || p.sku.toLowerCase().includes(s) || p.category.includes(s)) }
    return list
  }, [products, prodSearch, prodCat])

  const stats = useMemo(() => {
    const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((a, b) => a + b.total, 0)
    const newCount = orders.filter(o => o.status === 'new').length
    const delivered = orders.filter(o => o.status === 'delivered').length
    const lowStock = products.filter(p => p.stock <= 10).length
    const featured = products.filter(p => p.isFeatured).length
    const inActiveDomain = products.filter(p=> activeDomain.categories.some(c=> c.key===p.category)).length
    return { totalRevenue, newCount, delivered, count: orders.length, lowStock, featured, totalProducts: products.length, inActiveDomain }
  }, [orders, products, activeDomain])

  const currentDomainForForm = useMemo(()=>{
    const d = domains.find(x=> x.id === (prodForm as any).domainId)
    return d || activeDomain
  }, [prodForm, domains, activeDomain])

  const handleExport = () => {
    const csv = exportOrdersCsv(filteredOrders)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `lumiere-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
    showToast('تم تصدير الطلبات بنجاح')
  }

  const handleStatusChange = async (id: string, s: OrderStatus) => {
    const updated = await updateOrderStatus(id, s); setOrders([...updated]); showToast(`تم تحديث الحالة إلى ${statusMap[s].label}`)
  }

  const handleWilayaSave = async (code: string) => {
    const patch = editingWilaya[code]
    if (!patch) return
    const updated = await updateWilayaRate(code, patch); setWilayas([...updated]); setEditingWilaya(prev => { const n = { ...prev }; delete n[code]; return n }); showToast('تم حفظ سعر الشحن')
  }

  const handleAddWilaya = async () => {
    if (!newWilaya.code || !newWilaya.nameAr) { showToast('أدخلي كود واسم الولاية'); return }
    const w: WilayaRate = {
      _id: 'w' + newWilaya.code,
      code: newWilaya.code!,
      name: newWilaya.name || newWilaya.nameAr!,
      nameAr: newWilaya.nameAr!,
      deliveryHome: Number(newWilaya.deliveryHome) || 600,
      deliveryDesk: Number(newWilaya.deliveryDesk) || 400,
      isActive: true,
      deliveryDays: newWilaya.deliveryDays || '48 ساعة'
    }
    const updated = await addWilaya(w); setWilayas([...updated]); setNewWilaya({ code: '', nameAr: '', name: '', deliveryHome: 600, deliveryDesk: 400, deliveryDays: '48 ساعة' }); showToast('تمت إضافة الولاية')
  }

  // Product handlers
  const openAddModal = () => {
    setEditingProd(null)
    const base = makeEmptyProduct(activeDomain)
    setProdForm({ ...base, sku: `LUM-${String(products.length + 1).padStart(3, '0')}`, images: [''] })
    setProdErrors({})
    setShowProdModal(true)
  }
  const openEditModal = (p: Product) => {
    setEditingProd(p)
    const domainForP = domains.find(d=> d.categories.some(c=> c.key===p.category)) || activeDomain
    setProdForm({ ...p, domainId: (p as any).domainId || domainForP.id, attributes: p.attributes || {}, variants: p.variants ? p.variants.map(v=>({...v})) : [] } as any)
    if (!p.images.length) setProdForm(f => ({ ...f, images: [''] } as any))
    setProdErrors({})
    setShowProdModal(true)
  }
  const validateProd = () => {
    const e: Record<string, string> = {}
    if (!prodForm.nameAr.trim()) e.nameAr = 'الاسم العربي مطلوب'
    if (!prodForm.name.trim()) e.name = 'الاسم الفرنسي مطلوب'
    if (!prodForm.price || Number(prodForm.price) <= 0) e.price = 'السعر مطلوب'
    if (!prodForm.category) e.category = 'الفئة مطلوبة'
    if (!prodForm.images.filter(Boolean).length) e.images = 'رابط صورة واحد على الأقل مطلوب'
    // check required attributes
    currentDomainForForm.attributeSchema.forEach(attr=>{
      if(attr.required && !String((prodForm.attributes as any)?.[attr.key] || '').trim()){
        e['attr_'+attr.key] = `${attr.labelAr} مطلوب`
      }
    })
    setProdErrors(e)
    return Object.keys(e).length === 0
  }
  const handleSaveProduct = async () => {
    if (!validateProd()) return
    try {
      const cleanImages = prodForm.images.filter(Boolean)
      const payload: any = { ...prodForm, images: cleanImages, price: Number(prodForm.price), compareAtPrice: prodForm.compareAtPrice ? Number(prodForm.compareAtPrice) : undefined, stock: Number(prodForm.stock), rating: Number(prodForm.rating), reviewsCount: Number(prodForm.reviewsCount), attributes: prodForm.attributes || {}, variants: prodForm.variants || [] }
      // ensure domainId remains
      if(!payload.domainId) payload.domainId = currentDomainForForm.id
      if (editingProd) {
        const updated = await updateProduct(editingProd._id, payload); setProducts([...updated]); showToast('تم تحديث المنتج بنجاح — الإعدادات الخاصة بالمجال محفوظة')
      } else {
        await addProduct(payload as any); setProducts([...getProducts()]); showToast('تم نشر المنتج في المتجر ✨')
      }
      setShowProdModal(false)
    } catch (err: any) {
      if (err.message === 'IMAGES_REQUIRED') setProdErrors({ images: 'أضيفي رابط صورة صحيح' })
      else showToast('خطأ في حفظ المنتج')
    }
  }
  const handleDeleteProduct = async (id: string) => {
    if (!confirm('هل أنت متأكدة من حذف هذا المنتج نهائياً؟')) return
    const updated = await deleteProduct(id); setProducts([...updated]); showToast('تم حذف المنتج')
  }

  const addVariantRow = ()=>{
    const v: Variant = { id: 'var_'+Date.now().toString(36), stock: 10, priceAdjustment: 0 }
    if(currentDomainForForm.variantConfig.hasColor){
      const preset = currentDomainForForm.variantConfig.colorPresets[0]
      if(preset){ v.color = preset.name; v.colorAr = preset.nameAr; v.colorHex = preset.hex }
      else { v.color='—'; v.colorAr='—'; v.colorHex='#CCCCCC' }
    }
    if(currentDomainForForm.variantConfig.hasSize){
      v.size = currentDomainForForm.variantConfig.sizeOptions[0] || 'M'
    }
    setProdForm(f=> ({...f, variants: [...(f.variants||[]), v]}))
  }
  const updateVariant = (idx:number, patch: Partial<Variant>)=>{
    setProdForm(f=>{
      const n=[...(f.variants||[])]
      n[idx] = {...n[idx], ...patch}
      return {...f, variants:n}
    })
  }
  const removeVariant = (idx:number)=>{
    setProdForm(f=> ({...f, variants: (f.variants||[]).filter((_,i)=> i!==idx)}))
  }
  const bulkGenerate = ()=>{
    if(!bulkSizes.trim() && !bulkColors.trim()){ showToast('أدخلي مقاسات أو ألوان للجيل الجماعي'); return }
    const sizes = bulkSizes.split(',').map(s=> s.trim()).filter(Boolean)
    const colors = bulkColors.split(',').map(s=> s.trim()).filter(Boolean)
    // if domain has presets, try map color name to hex
    const presets = currentDomainForForm.variantConfig.colorPresets
    const newVariants: Variant[] = []
    if(sizes.length && colors.length){
      sizes.forEach(sz=> colors.forEach(col=>{
        const preset = presets.find(p=> p.nameAr===col || p.name===col)
        newVariants.push({
          id: 'var_'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),
          color: preset?.name || col,
          colorAr: preset?.nameAr || col,
          colorHex: preset?.hex || '#CCCCCC',
          size: sz,
          stock: 10
        })
      }))
    } else if(sizes.length){
      sizes.forEach(sz=> newVariants.push({ id:'var_'+Date.now().toString(36)+Math.random().toString(36).slice(2,4), size:sz, stock:10 }))
    } else if(colors.length){
      colors.forEach(col=>{
        const preset = presets.find(p=> p.nameAr===col || p.name===col)
        newVariants.push({ id:'var_'+Date.now().toString(36)+Math.random().toString(36).slice(2,4), color: preset?.name || col, colorAr: preset?.nameAr || col, colorHex: preset?.hex || '#CCCCCC', stock:10 })
      })
    }
    setProdForm(f=> ({...f, variants: [...(f.variants||[]), ...newVariants]}))
    setBulkSizes(''); setBulkColors('')
    showToast(`تم إنشاء ${newVariants.length} متغير`)
  }

  return (
    <div className="bg-[#FFFCF8] min-h-screen">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-[#1A1A1E] text-white px-4 py-2.5 rounded-full text-sm font-bold shadow-xl flex items-center gap-2 border border-white/10">
          <Check size={16} className="text-emerald-400" /> {toast}
        </div>
      )}

      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-extrabold text-[#1A1A1E] flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#1A1A1E] grid place-items-center text-[#C9A96A]"><Crown size={18} /></span>
              لوحة تحكم LUMIÈRE
              <span className="text-xs font-bold bg-[#A02A5B] text-white px-2.5 py-1 rounded-full tracking-widest">PRO 2026</span>
            </h1>
            <p className="text-xs text-[#9A8A6B] mt-1 flex flex-wrap items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> متصل • LocalStorage يحاكي Mongoose
              <span className="w-1 h-1 rounded-full bg-[#EDE6D8]"></span> {products.length} منتج • {orders.length} طلب • {domains.length} مجال
              <span className="hidden md:inline-flex items-center gap-1.5 bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] px-2 py-0.5 rounded-full text-[11px] font-bold">♥ ÉDITION ROSE {storeForm.enableRoseEdition ? 'مفعّلة' : 'متوقفة'}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/" target="_blank" className="bg-white border border-[#EDE6D8] px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-[#FFFCF8]"><Eye size={16} /> عرض المتجر</a>
            <button onClick={handleExport} className="bg-[#1A1A1E] text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-black"><Download size={16} /> تصدير CSV</button>
            <button onClick={() => { if (confirm('إعادة تهيئة كل البيانات؟')) { localStorage.clear(); location.reload() } }} className="bg-white border border-[#EDE6D8] px-3 py-2 rounded-full text-xs font-bold text-[#9A8A6B] hover:text-red-600">إعادة تهيئة</button>
          </div>
        </div>

        <div className="mt-4 bg-[#1A1A1E] rounded-[20px] p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#C9A96A]/10 rounded-full blur-2xl"/>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#A02A5B]/15 rounded-full blur-2xl"/>
          <div className="relative flex gap-4 items-center">
            <div className="w-14 h-14 rounded-2xl bg-white grid place-items-center shrink-0 overflow-hidden border border-white/10">
              {(()=>{
                const Ico = domainIcons[activeDomain.id] || Store
                return <Ico size={22} className="text-[#1A1A1E]"/>
              })()}
            </div>
            <div>
              <div className="text-xs tracking-[0.2em] text-[#C9A96A] flex items-center gap-2">المجال النشط الآن <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> <span className="bg-[#A02A5B] text-white text-[10px] px-2 py-0.5 rounded-full">حي في المتجر</span></div>
              <div className="font-extrabold text-lg leading-tight">{activeDomain.nameAr} <span className="font-normal text-white/60">— {activeDomain.name}</span></div>
              <div className="text-xs text-white/60 line-clamp-1 max-w-[520px]">{activeDomain.descriptionAr} • {activeDomain.categories.length} فئات • {stats.inActiveDomain} منتج في هذا المجال • <span className="text-[#F6C0D4]">{activeDomain.attributeSchema.length} حقل مخصص</span> • {activeDomain.variantConfig.hasColor ? 'ألوان' : ''}{activeDomain.variantConfig.hasColor && activeDomain.variantConfig.hasSize ? ' + ' : ''}{activeDomain.variantConfig.hasSize ? 'مقاسات' : '—'}</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {activeDomain.categories.map(c=> <span key={c.key} className="bg-white/10 border border-white/15 px-2 py-1 rounded-full text-[11px] font-bold">{c.labelAr}</span>)}
              </div>
            </div>
          </div>
          <div className="relative flex flex-col gap-2 w-full md:w-auto">
            <div className="flex gap-2">
              <a href="/" target="_blank" className="flex-1 md:flex-initial bg-white text-[#1A1A1E] px-4 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#FFFCF8]"><Eye size={14}/> معاينة المتجر</a>
              <button onClick={()=> setTab('domains')} className="flex-1 md:flex-initial bg-[#C9A96A] text-white px-4 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#B8945A]"><Wand2 size={14}/> تغيير المجال</button>
            </div>
            <span className="text-[11px] text-white/40 text-center">التبديل يحدث فوراً — إعدادات المنتج تتبدل حسب المجال</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-4">
          <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute -top-6 -left-6 w-16 h-16 bg-[#C9A96A]/10 rounded-full" />
            <div className="text-xs text-[#9A8A6B] flex items-center gap-1"><ShoppingBag size={12} className="text-[#C9A96A]" /> إجمالي الطلبات</div><div className="text-2xl font-extrabold text-[#1A1A1E] mt-1">{stats.count}</div>
            <div className="text-[11px] text-emerald-600 flex items-center gap-1"><TrendingUp size={10} /> مباشر</div>
          </div>
          <div className="bg-[#1A1A1E] text-white rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-[#C9A96A]/15 rounded-full blur-xl" />
            <div className="text-xs text-white/60">إيرادات متوقعة</div><div className="text-lg font-extrabold mt-1">{formatDZD(stats.totalRevenue)}</div>
            <div className="text-[11px] text-[#C9A96A]">بدون الملغاة</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="text-xs text-amber-700 flex items-center gap-1"><Clock size={12} /> طلبات جديدة</div><div className="text-2xl font-extrabold text-amber-800 mt-1">{stats.newCount}</div>
            <div className="text-[11px] text-amber-700">تحتاج تأكيد</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle size={12} /> تم التسليم</div><div className="text-2xl font-extrabold text-emerald-800 mt-1">{stats.delivered}</div>
            <div className="text-[11px] text-emerald-700">نجاح COD</div>
          </div>
          <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4">
            <div className="text-xs text-[#9A8A6B] flex items-center gap-1"><Layers size={12} className="text-[#C9A96A]" /> المنتجات</div><div className="text-2xl font-extrabold text-[#1A1A1E] mt-1">{stats.totalProducts}</div>
            <div className="text-[11px] text-[#9A8A6B]">{stats.featured} مميزة • {stats.inActiveDomain} في المجال</div>
          </div>
          <div className={`rounded-2xl p-4 border ${stats.lowStock > 0 ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-white border-[#EDE6D8]'}`}>
            <div className={`text-xs flex items-center gap-1 ${stats.lowStock > 0 ? 'text-[#A02A5B]' : 'text-[#9A8A6B]'}`}><AlertCircle size={12} /> مخزون منخفض</div><div className={`text-2xl font-extrabold mt-1 ${stats.lowStock > 0 ? 'text-[#A02A5B]' : 'text-[#1A1A1E]'}`}>{stats.lowStock}</div>
            <div className="text-[11px] text-[#9A8A6B]">≤ 10 قطع</div>
          </div>
        </div>

        <div className="mt-6 bg-white border border-[#EDE6D8] rounded-[20px] p-1.5 flex flex-wrap gap-1.5 w-fit max-w-full overflow-x-auto">
          {[
            { k: 'domains', l: 'المجالات', i: Globe, count: domains.length, desc: 'مجوهرات/ملابس..' },
            { k: 'products', l: 'المنتجات', i: Package, count: products.length, desc: 'إضافة وتعديل' },
            { k: 'orders', l: 'الطلبات', i: ShoppingBag, count: orders.length, desc: 'دورة الحياة' },
            { k: 'wilayas', l: 'الشحن', i: MapPinned, count: wilayas.length, desc: '58 ولاية' },
            { k: 'store', l: 'إعدادات المتجر', i: Store, count: null, desc: 'تحكم شامل' },
            { k: 'tracking', l: 'التتبع', i: BarChart3, count: null, desc: 'Pixel' },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k as any)} className={`px-3.5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 border transition ${tab === t.k ? 'bg-[#1A1A1E] text-white border-[#1A1A1E] shadow' : 'bg-[#FFFCF8] text-[#1A1A1E] border-transparent hover:bg-white hover:border-[#EDE6D8]'}`}>
              <t.i size={15} className={tab === t.k ? 'text-[#C9A96A]' : 'text-[#9A8A6B]'} />
              <span>{t.l}</span>
              {t.count !== null && <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.k ? 'bg-white text-[#1A1A1E]' : 'bg-[#1A1A1E] text-white'}`}>{t.count}</span>}
              <span className={`hidden xl:inline text-[11px] font-normal ${tab === t.k ? 'text-white/60' : 'text-[#9A8A6B]'}`}>• {t.desc}</span>
            </button>
          ))}
        </div>

        {tab==='domains' && (
          <div className="mt-4 space-y-4">
            <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold flex items-center gap-2"><Globe size={16} className="text-[#C9A96A]"/> إدارة المجالات — غيّري تخصص المتجر بنقرة</h3>
                <p className="text-xs text-[#9A8A6B] mt-1">كل مجال يملك فئاته وحقوله الخاصة ومتغيرات الألوان/المقاسات. التبديل يغيّر واجهة إضافة المنتج فوراً.</p>
              </div>
              <button onClick={openDomainCreate} className="bg-[#A02A5B] hover:bg-[#7A1F44] text-white px-5 py-2.5 rounded-full text-sm font-extrabold flex items-center gap-2 shadow shadow-[#A02A5B]/20"><Plus size={16}/> إنشاء مجال مخصص</button>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {domains.map(d=>{
                const isActive = d.id===activeDomain.id
                const Icon = domainIcons[d.id] || Store
                const relatedCount = products.filter(p=> d.categories.some(c=> c.key===p.category)).length
                return (
                  <div key={d.id} className={`relative bg-white rounded-[22px] overflow-hidden border-2 flex flex-col ${isActive ? 'border-[#A02A5B] shadow-[0_10px_30px_rgba(160,42,91,0.15)]' : 'border-[#EDE6D8] hover:border-[#C9A96A]/40'}`}>
                    {isActive && <span className="absolute top-3 left-3 z-10 bg-[#A02A5B] text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><Check size={12}/> نشط الآن</span>}
                    {d.isPreset && <span className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur border border-[#EDE6D8] text-[#7A6F5A] text-[10px] font-bold px-2 py-1 rounded-full">جاهز</span>}
                    {!d.isPreset && <span className="absolute top-3 right-3 z-10 bg-[#1A1A1E] text-white text-[10px] font-bold px-2 py-1 rounded-full">مخصص</span>}
                    <div className="h-36 relative bg-[#FFF8EE] overflow-hidden">
                      <img src={d.heroImage} alt={d.nameAr} className="w-full h-full object-cover"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"/>
                      <div className="absolute bottom-3 right-3 left-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white grid place-items-center shrink-0 shadow"><Icon size={18} className="text-[#1A1A1E]"/></div>
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold text-white leading-tight line-clamp-1">{d.nameAr}</div>
                          <div className="text-[11px] text-white/80 cormorant tracking-widest">{d.name}</div>
                        </div>
                        <span className="bg-white text-[#1A1A1E] text-xs font-bold px-2.5 py-1 rounded-full">{relatedCount} منتج</span>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-xs leading-5 text-[#7A6F5A] line-clamp-2 min-h-[40px]">{d.descriptionAr}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {d.categories.map(c=> <span key={c.key} className={`text-[11px] px-2 py-1 rounded-full border font-bold ${isActive ? 'bg-[#FDF2F6] border-[#F6C0D4] text-[#A02A5B]' : 'bg-[#FFFBF0] border-[#F0D9A8] text-[#8D6E3A]'}`}>{c.labelAr}</span>)}
                      </div>
                      <div className="mt-3 bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl p-3">
                        <div className="text-[10px] font-bold text-[#9A8A6B] tracking-widest flex items-center gap-1.5"><Layers size={10}/> الحقول: {d.attributeSchema.map(a=> a.labelAr).join(' • ') || '—'}</div>
                        <div className="text-[11px] mt-1 flex flex-wrap gap-1.5">
                          {d.variantConfig.hasColor && <span className="bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] px-2 py-0.5 rounded-full flex items-center gap-1"><PaletteIcon size={10}/> ألوان</span>}
                          {d.variantConfig.hasSize && <span className="bg-white border border-[#EDE6D8] px-2 py-0.5 rounded-full flex items-center gap-1"><Ruler size={10}/> مقاسات: {d.variantConfig.sizeOptions.join(', ')}</span>}
                          {!d.variantConfig.hasColor && !d.variantConfig.hasSize && <span className="text-[#9A8A6B]">بدون متغيرات</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {isActive ? (
                          <span className="bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1"><Check size={12}/> المجال النشط</span>
                        ) : (
                          <button onClick={()=> handleActivateDomain(d.id)} className="bg-[#1A1A1E] text-white rounded-full py-2 text-xs font-extrabold flex items-center justify-center gap-1 hover:bg-black"><RefreshCw size={12}/> تفعيل المجال</button>
                        )}
                        <button onClick={()=> openDomainEdit(d)} className="bg-white border border-[#EDE6D8] rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#FFFCF8]"><Pencil size={12}/> تعديل</button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        <button onClick={async ()=>{ const c=await duplicateDomain(d.id); if(c){ refreshAll(); showToast('تم نسخ المجال') } }} className="bg-white border border-[#EDE6D8] rounded-full py-1.5 text-[11px] font-bold flex items-center justify-center gap-1"><Copy size={11}/> نسخ</button>
                        <a href="/" target="_blank" className="bg-white border border-[#EDE6D8] rounded-full py-1.5 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-[#1A1A1E] hover:text-white"><Eye size={11}/> معاينة</a>
                        {!d.isPreset ? (
                          <button onClick={async ()=>{ if(!confirm(`حذف مجال ${d.nameAr}؟`))return; try{ await deleteDomain(d.id); refreshAll(); showToast('تم حذف المجال')}catch(e:any){ showToast('لا يمكن حذف مجال جاهز')} }} className="bg-red-50 border border-red-200 text-red-600 rounded-full py-1.5 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-red-500 hover:text-white"><Trash2 size={11}/> حذف</button>
                        ) : (
                          <span className="bg-[#F5EFE6] border border-[#EDE6D8] text-[#9A8A6B] rounded-full py-1.5 text-[11px] font-bold text-center">جاهز</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className={`rounded-2xl p-4 border flex gap-3 items-start ${settings.enableRoseEdition ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-[#FFFBF0] border-[#F5E6C8]'}`}>
              <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${settings.enableRoseEdition ? 'bg-[#A02A5B] text-white' : 'bg-[#C9A96A] text-white'}`}><Wand2 size={16}/></div>
              <div className="text-sm leading-6">
                <span className="font-extrabold">كيف تتغير إعدادات المنتج؟</span>
                <span className="text-[#7A6F5A]"> عند تحويل المجال إلى <b>ملابس</b>، ستجدين في إضافة المنتج حقول القماش/القصة/الطول + جدول متغيرات الألوان والمقاسات (XS–XXL و 36–42). وعند العودة إلى <b>مجوهرات</b>، تعود حقول الطلاء/الحجر/الوزن + مقاسات الخواتم (5–9) وألوان الذهب. كل مجال يحفظ إعداداته الخاصة — حتى المجالات المخصصة يمكنك تعريف حقولها بنفسك.</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="bg-white border border-[#EDE6D8] px-3 py-1 rounded-full text-xs font-bold">مجوهرات: خامة + طلاء + حجر + ألوان الذهب + مقاس الخاتم</span>
                  <span className="bg-[#A02A5B] text-white px-3 py-1 rounded-full text-xs font-bold">ملابس: قماش + مقاس XL/M + لون + طول</span>
                  <span className="bg-white border border-[#EDE6D8] px-3 py-1 rounded-full text-xs font-bold">بيوتي: حجم + نوع بشرة + عطر + لون مكياج</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'products' && (
          <div className="mt-4 space-y-4">
            <div className="bg-white border border-[#EDE6D8] rounded-2xl p-3 flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="flex items-center gap-2 bg-[#FFFCF8] border border-[#EDE6D8] rounded-full px-3 py-2 flex-1">
                <Search size={14} className="text-[#9A8A6B]" />
                <input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="بحث بالاسم، SKU، الفئة..." className="flex-1 outline-none text-sm bg-transparent placeholder:text-[#B8AA8E]" />
                {prodSearch && <button onClick={() => setProdSearch('')} className="w-6 h-6 rounded-full bg-[#EDE6D8] grid place-items-center"><X size={12} /></button>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-[#FFFCF8] border border-[#EDE6D8] rounded-full px-2 py-1">
                  <Filter size={12} className="text-[#9A8A6B]" />
                  <select value={prodCat} onChange={e => setProdCat(e.target.value)} className="bg-transparent text-sm font-bold outline-none">
                    <option value="all">كل الفئات</option>
                    {allCategories.map(c=> <option key={c.key} value={c.key}>{c.labelAr} ({c.label})</option>)}
                  </select>
                </div>
                <span className="text-xs text-[#9A8A6B] hidden md:inline">{filteredProducts.length} منتج</span>
                <span className="hidden md:inline text-[11px] bg-[#1A1A1E] text-white px-2 py-1 rounded-full">{activeDomain.nameAr}</span>
                <button onClick={openAddModal} className="bg-[#A02A5B] hover:bg-[#7A1F44] text-white px-5 py-2.5 rounded-full text-sm font-extrabold flex items-center gap-2 shadow-lg shadow-[#A02A5B]/20 transition">
                  <Plus size={16} /> إضافة منتج جديد
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#FDF2F6] border border-[#F6C0D4] rounded-2xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#A02A5B] text-white grid place-items-center"><Crown size={16} /></div>
                <div><div className="text-xs text-[#A02A5B]">مميزة</div><div className="font-extrabold text-[#7A1F44]">{products.filter(p => p.isFeatured).length}</div></div>
                <span className="ms-auto text-[11px] bg-white border border-[#F6C0D4] text-[#A02A5B] px-2 py-1 rounded-full hidden md:inline">تظهر في الرئيسية</span>
              </div>
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#FFF5E6] text-[#C9A96A] grid place-items-center"><Sparkles size={16} /></div>
                <div><div className="text-xs text-[#9A8A6B]">جديدة</div><div className="font-extrabold">{products.filter(p => p.isNew).length}</div></div>
                <span className="ms-auto text-[11px] bg-[#FFFBF0] border border-[#F0D9A8] text-[#8D6E3A] px-2 py-1 rounded-full hidden md:inline">شارة "جديد"</span>
              </div>
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 grid place-items-center"><AlertCircle size={16} /></div>
                <div><div className="text-xs text-[#9A8A6B]">تحتاج تعبئة</div><div className="font-extrabold">{stats.lowStock}</div></div>
                <span className="ms-auto text-[11px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-1 rounded-full hidden md:inline">مخزون ≤10</span>
              </div>
            </div>

            <div className="bg-[#FFFBF0] border border-[#F5E6C8] rounded-xl px-3 py-2 text-xs text-[#8D6E3A] flex flex-wrap items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B]"></span> المجال النشط: <b>{activeDomain.nameAr}</b> — حقول المنتج الحالية: <span className="bg-white border border-[#F0D9A8] px-2 py-0.5 rounded-full font-bold">{activeDomain.attributeSchema.map(a=> a.labelAr).join(' • ')}</span> — متغيرات: <span className="bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] px-2 py-0.5 rounded-full">{activeDomain.variantConfig.hasColor ? 'ألوان' : ''}{activeDomain.variantConfig.hasColor && activeDomain.variantConfig.hasSize ? ' + ' : ''}{activeDomain.variantConfig.hasSize ? `مقاسات (${activeDomain.variantConfig.sizeOptions.join(', ')})` : '—'}</span>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map(p => {
                const inActive = activeDomain.categories.some(c=> c.key===p.category)
                const hasVariants = !!(p.variants && p.variants.length)
                return (
                <div key={p._id} className={`bg-white border rounded-[20px] overflow-hidden group hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)] transition ${inActive ? 'border-[#EDE6D8]' : 'border-[#EDE6D8] opacity-90'}`}>
                  <div className="relative h-[200px] bg-[#FFF8EE] overflow-hidden">
                    <img src={p.images[0]} alt={p.nameAr} className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500" />
                    <div className="absolute top-3 right-3 flex gap-1.5 flex-wrap">
                      {p.isFeatured && <span className="bg-[#1A1A1E] text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><Crown size={10} className="text-[#C9A96A]" /> مميز</span>}
                      {p.isNew && <span className="bg-[#A02A5B] text-white text-[10px] font-bold px-2 py-1 rounded-full">جديد</span>}
                      {hasVariants && <span className="bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><PaletteIcon size={10}/> {p.variants!.length} متغير</span>}
                      {!inActive && <span className="bg-white/90 text-[#7A6F5A] text-[10px] font-bold px-2 py-1 rounded-full border">خارج المجال</span>}
                    </div>
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      <span className="bg-white/90 backdrop-blur text-[#1A1A1E] text-[10px] font-bold px-2 py-1 rounded-full border border-[#EDE6D8]">{p.sku}</span>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/50 to-transparent flex justify-between items-end">
                      <span className="text-white text-xs font-bold flex items-center gap-1"><Star size={12} fill="white" /> {p.rating} ({p.reviewsCount})</span>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${inActive ? 'bg-white text-[#1A1A1E]' : 'bg-white/80 text-[#7A6F5A] border border-white'}`}>{p.category}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold text-[#1A1A1E] leading-tight line-clamp-1">{p.nameAr}</h3>
                        <p className="cormorant text-xs tracking-widest text-[#9A8A6B] truncate">{p.name}</p>
                        <p className="text-[11px] text-[#9A8A6B] truncate mt-0.5">{p.materialAr} • {p.material}</p>
                        {p.attributes && Object.keys(p.attributes).length>0 && <p className="text-[11px] text-[#A02A5B]/80 truncate">{Object.entries(p.attributes).slice(0,2).map(([k,v])=> `${k}: ${Array.isArray(v)? v.join(',') : v}`).join(' • ')}</p>}
                      </div>
                      <span className={`shrink-0 w-8 h-8 rounded-full border grid place-items-center ${p.isFeatured ? 'bg-[#FDF2F6] border-[#F6C0D4] text-[#A02A5B]' : 'bg-[#FFFBF0] border-[#F0D9A8] text-[#C9A96A]'}`}><Award size={14} /></span>
                    </div>
                    {hasVariants && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.variants!.slice(0,6).map(v=> (
                          <span key={v.id} className="text-[11px] border border-[#EDE6D8] bg-white px-2 py-0.5 rounded-full flex items-center gap-1">
                            {v.colorHex && <span className="w-3 h-3 rounded-full border border-black/10" style={{background:v.colorHex}}></span>}
                            {[v.colorAr || v.color, v.size].filter(Boolean).join(' • ')} <span className="text-[#9A8A6B]">({v.stock})</span>
                          </span>
                        ))}
                        {p.variants!.length>6 && <span className="text-[11px] text-[#9A8A6B]">+{p.variants!.length-6}</span>}
                      </div>
                    )}
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="font-extrabold text-[#1A1A1E]">{formatDZD(p.price)}</span>
                      {p.compareAtPrice && <span className="text-xs line-through text-[#B0A48A]">{formatDZD(p.compareAtPrice)}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className={`px-2 py-1 rounded-full border font-bold ${p.stock > 20 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : p.stock > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'}`}>المخزون: {p.stock}</span>
                      {p.tierPricing.length > 0 && <span className="bg-[#FFFBF0] border border-[#F5E6C8] text-[#8D6E3A] px-2 py-1 rounded-full font-bold">خصم حتى {p.tierPricing[p.tierPricing.length - 1].discountPercent}%</span>}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 mt-3">
                      <button onClick={() => openEditModal(p)} className="bg-[#1A1A1E] text-white rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-black"><Pencil size={12} /> تعديل</button>
                      <button onClick={async () => { const c = await duplicateProduct(p._id); if (c) { setProducts([...getProducts()]); showToast('تم نسخ المنتج') } }} className="bg-white border border-[#EDE6D8] rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#FFFCF8]"><Copy size={12} /> نسخ</button>
                      <button onClick={() => handleDeleteProduct(p._id)} className="bg-white border border-red-200 text-red-600 rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-red-50"><Trash2 size={12} /> حذف</button>
                      <a href={`/product/${p._id}`} target="_blank" className="bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#A02A5B] hover:text-white transition"><Eye size={12} /> عرض</a>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={async () => { const u = await toggleProductFlag(p._id, 'isFeatured'); setProducts([...u]); showToast(p.isFeatured ? 'أزيلت من المميزة' : 'أضيفت للمميزة ⭐') }} className={`flex-1 rounded-full py-1.5 text-[11px] font-bold border flex items-center justify-center gap-1 ${p.isFeatured ? 'bg-[#1A1A1E] text-white border-[#1A1A1E]' : 'bg-white text-[#1A1A1E] border-[#EDE6D8] hover:bg-[#FFFCF8]'}`}><Crown size={11} /> {p.isFeatured ? 'مميز ✓' : 'تمييز'}</button>
                      <button onClick={async () => { const u = await toggleProductFlag(p._id, 'isNew'); setProducts([...u]); showToast(p.isNew ? 'أزيلت شارة جديد' : 'أضيفت شارة جديد') }} className={`flex-1 rounded-full py-1.5 text-[11px] font-bold border ${p.isNew ? 'bg-[#A02A5B] text-white border-[#A02A5B]' : 'bg-white text-[#1A1A1E] border-[#EDE6D8]'}`}><Sparkles size={11} className="inline -mt-0.5" /> {p.isNew ? 'جديد ✓' : 'جديد'}</button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
            {filteredProducts.length === 0 && (
              <div className="bg-white border-2 border-dashed border-[#EDE6D8] rounded-2xl p-10 text-center">
                <div className="w-14 h-14 rounded-full bg-[#FDF2F6] border border-[#F6C0D4] grid place-items-center mx-auto text-[#A02A5B]"><Search size={20} /></div>
                <div className="font-bold mt-3">لا توجد منتجات مطابقة</div>
                <p className="text-sm text-[#9A8A6B]">جربي بحثاً آخر أو أضيفي منتجاً جديداً — المجال: {activeDomain.nameAr}</p>
                <button onClick={openAddModal} className="mt-4 bg-[#A02A5B] text-white px-5 py-2 rounded-full text-sm font-bold">+ إضافة منتج</button>
              </div>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2 items-center bg-white border border-[#EDE6D8] rounded-2xl p-3">
              <div className="flex items-center gap-2 bg-[#FFFCF8] border border-[#EDE6D8] rounded-full px-3 py-1.5 flex-1 min-w-[200px]">
                <Search size={14} className="text-[#9A8A6B]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث برقم الطلب، الاسم، الهاتف، الولاية..." className="flex-1 outline-none text-sm bg-transparent" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-full px-3 py-2 text-sm font-bold">
                <option value="all">كل الحالات</option>
                <option value="new">جديد</option>
                <option value="confirmed">مؤكد</option>
                <option value="shipping">قيد الشحن</option>
                <option value="delivered">تم التسليم</option>
                <option value="cancelled">ملغي</option>
              </select>
              <span className="text-xs text-[#9A8A6B] bg-[#FFFCF8] border border-[#EDE6D8] px-3 py-2 rounded-full">{filteredOrders.length} طلب</span>
            </div>

            <div className="mt-3 overflow-x-auto bg-white border border-[#EDE6D8] rounded-2xl">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="bg-[#FFFBF0] text-xs text-[#7A6F5A]">
                  <tr><th className="p-3 text-right">الطلب</th><th className="p-3 text-right">الزبونة</th><th className="p-3 text-right">الولاية/البلدية</th><th className="p-3 text-right">المنتجات</th><th className="p-3 text-right">الإجمالي</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">إجراءات</th></tr>
                </thead>
                <tbody className="divide-y divide-[#EDE6D8]">
                  {filteredOrders.map(o => (
                    <tr key={o._id} className="hover:bg-[#FFFCF8]">
                      <td className="p-3"><div className="font-bold text-[#1A1A1E]">{o.orderNumber}</div><div className="text-xs text-[#9A8A6B]">{new Date(o.createdAt).toLocaleString('ar-DZ')}</div></td>
                      <td className="p-3"><div className="font-bold">{o.customerName}</div><div className="text-xs text-[#9A8A6B]" dir="ltr">{o.phone}</div><div className="text-[11px] text-[#9A8A6B]">{o.address}</div></td>
                      <td className="p-3"><span className="font-bold">{o.wilayaNameAr} ({o.wilaya})</span><div className="text-xs">{o.commune} • {o.deliveryType === 'home' ? 'منزل' : 'مكتب'} • {formatDZD(o.shippingCost)}</div></td>
                      <td className="p-3"><div className="flex flex-col gap-1">{o.items.map(it => <span key={it.productId+(it.variantId||'')} className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-full px-2 py-0.5 text-xs inline-flex w-fit">{it.nameAr} {it.variantLabel ? `• ${it.variantLabel}`:''} ×{it.qty}</span>)}</div></td>
                      <td className="p-3 font-extrabold text-[#1A1A1E]">{formatDZD(o.total)}<div className="text-xs font-normal text-[#9A8A6B]">خصم {formatDZD(o.discount)}</div></td>
                      <td className="p-3"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusMap[o.status].color}`}>{statusMap[o.status].label}</span></td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          <select value={o.status} onChange={e => handleStatusChange(o._id, e.target.value as OrderStatus)} className="border border-[#EDE6D8] rounded-full px-2 py-1 text-xs font-bold bg-white">
                            <option value="new">جديد</option><option value="confirmed">مؤكد</option><option value="shipping">قيد الشحن</option><option value="delivered">تم التسليم</option><option value="cancelled">ملغي</option>
                          </select>
                          <button onClick={async () => { if (confirm('حذف الطلب؟')) { const n = await deleteOrder(o._id); setOrders([...n]); showToast('تم حذف الطلب') } }} className="w-7 h-7 rounded-full bg-red-50 text-red-600 grid place-items-center border border-red-200 hover:bg-red-500 hover:text-white transition"><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-[#9A8A6B]">لا توجد طلبات بهذه المعايير</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'wilayas' && (
          <div className="mt-4 space-y-4">
            <div className="bg-white border border-[#EDE6D8] rounded-2xl overflow-hidden">
              <div className="p-4 bg-[#FFFBF0] border-b border-[#EDE6D8] flex flex-wrap justify-between items-center gap-2">
                <h3 className="font-extrabold flex items-center gap-2"><MapPinned size={16} className="text-[#C9A96A]" /> إدارة أسعار الشحن — {wilayas.length} ولاية</h3>
                <span className="text-xs bg-white border border-[#EDE6D8] px-3 py-1 rounded-full">COD: منزل / مكتب</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead className="bg-[#1A1A1E] text-white text-xs"><tr><th className="p-3 text-right">الكود</th><th className="p-3 text-right">الولاية</th><th className="p-3 text-right">للمنزل (د.ج)</th><th className="p-3 text-right">للمكتب (د.ج)</th><th className="p-3 text-right">المدة</th><th className="p-3 text-right">حفظ</th></tr></thead>
                  <tbody className="divide-y divide-[#EDE6D8]">
                    {wilayas.map(w => {
                      const edit = editingWilaya[w.code]
                      const home = edit?.deliveryHome ?? w.deliveryHome
                      const desk = edit?.deliveryDesk ?? w.deliveryDesk
                      return (
                        <tr key={w.code} className="hover:bg-[#FFFCF8]">
                          <td className="p-3 font-bold">{w.code}</td>
                          <td className="p-3 font-bold">{w.nameAr} <span className="text-xs text-[#9A8A6B]">({w.name})</span></td>
                          <td className="p-3"><input type="number" value={home} onChange={e => setEditingWilaya(prev => ({ ...prev, [w.code]: { ...prev[w.code], deliveryHome: parseInt(e.target.value) || 0 } }))} className="w-24 border border-[#EDE6D8] rounded-full px-2 py-1 text-sm focus:border-[#C9A96A] outline-none" /></td>
                          <td className="p-3"><input type="number" value={desk} onChange={e => setEditingWilaya(prev => ({ ...prev, [w.code]: { ...prev[w.code], deliveryDesk: parseInt(e.target.value) || 0 } }))} className="w-24 border border-[#EDE6D8] rounded-full px-2 py-1 text-sm focus:border-[#A02A5B] outline-none" /></td>
                          <td className="p-3 text-xs"><input value={edit?.deliveryDays ?? w.deliveryDays} onChange={e => setEditingWilaya(prev => ({ ...prev, [w.code]: { ...prev[w.code], deliveryDays: e.target.value } }))} className="w-24 border border-[#EDE6D8] rounded-full px-2 py-1 text-xs" /></td>
                          <td className="p-3"><button onClick={() => handleWilayaSave(w.code)} disabled={!edit} className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${edit ? 'bg-[#C9A96A] text-white hover:bg-[#B8945A]' : 'bg-[#EDE6D8] text-[#9A8A6B]'}`}><Save size={12} /> حفظ</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#FDF2F6] border border-[#F6C0D4] rounded-2xl p-4">
              <h4 className="font-bold text-[#7A1F44] flex items-center gap-2"><Plus size={16} className="text-[#A02A5B]" /> إضافة ولاية جديدة (58 ولاية)</h4>
              <div className="grid md:grid-cols-6 gap-2 mt-3">
                <input placeholder="الكود 58" value={newWilaya.code || ''} onChange={e => setNewWilaya({ ...newWilaya, code: e.target.value })} className="border border-[#F6C0D4] rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-[#A02A5B]" />
                <input placeholder="الاسم عربي" value={newWilaya.nameAr || ''} onChange={e => setNewWilaya({ ...newWilaya, nameAr: e.target.value })} className="border border-[#F6C0D4] rounded-xl px-3 py-2 text-sm bg-white outline-none" />
                <input placeholder="Name FR" value={newWilaya.name || ''} onChange={e => setNewWilaya({ ...newWilaya, name: e.target.value })} className="border border-[#EDE6D8] rounded-xl px-3 py-2 text-sm bg-white outline-none" />
                <input type="number" placeholder="منزل" value={newWilaya.deliveryHome || 600} onChange={e => setNewWilaya({ ...newWilaya, deliveryHome: parseInt(e.target.value) })} className="border border-[#EDE6D8] rounded-xl px-3 py-2 text-sm bg-white" />
                <input type="number" placeholder="مكتب" value={newWilaya.deliveryDesk || 400} onChange={e => setNewWilaya({ ...newWilaya, deliveryDesk: parseInt(e.target.value) })} className="border border-[#EDE6D8] rounded-xl px-3 py-2 text-sm bg-white" />
                <button onClick={handleAddWilaya} className="bg-[#A02A5B] text-white rounded-xl px-3 py-2 text-sm font-bold hover:bg-[#7A1F44]">إضافة</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'store' && (
          <div className="mt-4 grid lg:grid-cols-[1.05fr_0.95fr] gap-4">
            <div className="space-y-4">
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                <h3 className="font-extrabold flex items-center gap-2"><Store size={16} className="text-[#C9A96A]" /> هوية المتجر</h3>
                <p className="text-xs text-[#9A8A6B]">يمكنك أيضاً تغيير المجال من تبويب المجالات — التغيير هناك يبدّل الاسم والهيرو والفئات تلقائياً.</p>
                <div className="grid gap-3 mt-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div><label className="text-xs font-bold text-[#7A6F5A]">اسم المتجر FR</label><input value={storeForm.storeName} onChange={e => setStoreForm({ ...storeForm, storeName: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" /></div>
                    <div><label className="text-xs font-bold text-[#7A6F5A]">اسم المتجر عربي</label><input value={storeForm.storeNameAr} onChange={e => setStoreForm({ ...storeForm, storeNameAr: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none" /></div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div><label className="text-xs font-bold flex gap-1"><Phone size={12} className="text-[#C9A96A]" /> هاتف المتجر</label><input value={storeForm.phone} onChange={e => setStoreForm({ ...storeForm, phone: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" dir="ltr" /></div>
                    <div><label className="text-xs font-bold">واتساب (بدون +)</label><input value={storeForm.whatsapp} onChange={e => setStoreForm({ ...storeForm, whatsapp: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" dir="ltr" placeholder="213550123456" /></div>
                    <div><label className="text-xs font-bold flex gap-1"><Mail size={12} /> البريد</label><input value={storeForm.email} onChange={e => setStoreForm({ ...storeForm, email: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" dir="ltr" /></div>
                  </div>
                  <div><label className="text-xs font-bold flex gap-1"><Instagram size={12} className="text-[#A02A5B]" /> إنستغرام</label><input value={storeForm.instagram} onChange={e => setStoreForm({ ...storeForm, instagram: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" placeholder="@lumiere.dz" /></div>
                  <div><label className="text-xs font-bold">وصف الفوتر</label><textarea value={storeForm.footerDescriptionAr} onChange={e => setStoreForm({ ...storeForm, footerDescriptionAr: e.target.value })} rows={2} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none" /></div>
                </div>
              </div>

              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                <h3 className="font-extrabold flex items-center gap-2"><Megaphone size={16} className="text-[#A02A5B]" /> الشريط الإعلاني والبطل</h3>
                <div className="grid gap-3 mt-4">
                  <div><label className="text-xs font-bold">نص الشريط العلوي</label><input value={storeForm.announcement} onChange={e => setStoreForm({ ...storeForm, announcement: e.target.value })} className="mt-1 w-full border border-[#F6C0D4] bg-[#FDF2F6] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A02A5B]" /></div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div><label className="text-xs font-bold">حد التوصيل المجاني (د.ج)</label><input type="number" value={storeForm.freeShippingThreshold} onChange={e => setStoreForm({ ...storeForm, freeShippingThreshold: parseInt(e.target.value) || 0 })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" /></div>
                    <div><label className="text-xs font-bold">شارة الهيرو</label><input value={storeForm.heroBadge} onChange={e => setStoreForm({ ...storeForm, heroBadge: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" /></div>
                  </div>
                  <div><label className="text-xs font-bold">عنوان الهيرو عربي</label><input value={storeForm.heroTitleAr} onChange={e => setStoreForm({ ...storeForm, heroTitleAr: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm font-bold" /></div>
                  <div><label className="text-xs font-bold">وصف الهيرو</label><textarea value={storeForm.heroSubtitleAr} onChange={e => setStoreForm({ ...storeForm, heroSubtitleAr: e.target.value })} rows={2} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" /></div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#1A1A1E] text-white rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#C9A96A]/15 rounded-full blur-2xl" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#A02A5B]/15 rounded-full blur-2xl" />
                <div className="relative">
                  <h3 className="font-extrabold flex items-center gap-2"><Settings size={16} className="text-[#C9A96A]" /> إعدادات التجارة 2026</h3>
                  <div className="grid gap-4 mt-4">
                    <label className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-3">
                      <span className="text-sm font-bold flex items-center gap-2"><Truck size={14} className="text-[#C9A96A]" /> تفعيل الدفع عند الاستلام (COD)</span>
                      <input type="checkbox" checked={storeForm.enableCod} onChange={e => setStoreForm({ ...storeForm, enableCod: e.target.checked })} className="w-11 h-6 accent-[#C9A96A]" />
                    </label>
                    <label className="flex items-center justify-between bg-[#A02A5B]/15 border border-[#A02A5B]/30 rounded-xl px-3 py-3">
                      <span className="text-sm font-bold flex items-center gap-2"><Palette size={14} className="text-[#F6C0D4]" /> تفعيل لمسة ÉDITION ROSE <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B]"></span></span>
                      <input type="checkbox" checked={storeForm.enableRoseEdition} onChange={e => setStoreForm({ ...storeForm, enableRoseEdition: e.target.checked })} className="w-11 h-6 accent-[#A02A5B]" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-white/60">العملة</label><input value={storeForm.currency} onChange={e => setStoreForm({ ...storeForm, currency: e.target.value })} className="mt-1 w-full rounded-xl px-3 py-2.5 bg-white text-black text-sm font-bold" /></div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <div className="text-xs text-white/60">الطلبات اليوم</div><div className="font-extrabold text-lg">{orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString()).length}</div>
                      </div>
                    </div>
                  </div>
                  <button onClick={async () => { await saveSettings(storeForm as any); setSettings({ ...storeForm } as any); showToast('تم حفظ إعدادات المتجر — ستظهر فوراً في الواجهة') }} className="w-full mt-4 bg-[#C9A96A] hover:bg-[#B8945A] text-white rounded-full py-3 font-extrabold flex items-center justify-center gap-2"><Save size={16} /> حفظ كل إعدادات المتجر</button>
                </div>
              </div>

              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                <h4 className="font-bold flex items-center gap-2"><Eye size={14} className="text-[#C9A96A]" /> معاينة حية</h4>
                <div className="mt-3 space-y-2">
                  <div className="bg-[#1A1A1E] text-[#C9A96A] text-xs py-2 px-3 rounded-full text-center">{storeForm.announcement}</div>
                  <div className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-2xl p-4">
                    <div className="text-[10px] tracking-widest bg-white border border-[#EDE6D8] inline-flex px-2 py-1 rounded-full">{storeForm.heroBadge}</div>
                    <div className="font-extrabold text-lg mt-2">{storeForm.heroTitleAr}</div>
                    <div className="text-xs text-[#7A6F5A] mt-1 leading-5">{storeForm.heroSubtitleAr}</div>
                    <div className="mt-3 flex gap-2 text-xs"><span className="bg-[#1A1A1E] text-white px-3 py-1.5 rounded-full">تسوّقي الآن</span><span className="border border-[#EDE6D8] px-3 py-1.5 rounded-full">الكولكشن</span></div>
                  </div>
                  <div className="bg-[#1A1A1E] text-[#B8AA8E] text-xs p-3 rounded-xl leading-5">{storeForm.footerDescriptionAr}</div>
                </div>
              </div>

              <div className="bg-[#FFFBF0] border border-[#F5E6C8] rounded-2xl p-4">
                <h4 className="font-bold text-[#8D6E3A] flex items-center gap-2"><Zap size={14} /> إجراءات سريعة</h4>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button onClick={() => { const prods = getProducts(); const csv = [['SKU','الاسم','السعر','المخزون','الفئة'].join(','), ...prods.map(p => [`"${p.sku}"`, `"${p.nameAr}"`, p.price, p.stock, p.category].join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'products.csv'; a.click() }} className="bg-white border border-[#EDE6D8] rounded-full py-2 text-xs font-bold hover:bg-[#1A1A1E] hover:text-white transition">تصدير المنتجات CSV</button>
                  <button onClick={() => { if (products.filter(p => p.isFeatured).length === 0) { showToast('لا توجد منتجات مميزة') } else showToast(`${products.filter(p => p.isFeatured).length} منتجات مميزة تظهر في الرئيسية — مجال: ${activeDomain.nameAr}`) }} className="bg-white border border-[#EDE6D8] rounded-full py-2 text-xs font-bold">معاينة المميزة</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'tracking' && (
          <div className="mt-4 grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
              <h3 className="font-bold flex gap-2 items-center"><Settings size={16} className="text-[#C9A96A]" /> إعدادات التتبع (Meta & TikTok)</h3>
              <p className="text-xs text-[#9A8A6B] mt-1">الأكواد مرتبطة بملف البيئة وتحاكي طبقة التتبع الشاملة 2026</p>
              <div className="grid gap-3 mt-4">
                <div><label className="text-xs font-bold">Meta Pixel ID</label><input value={settings.metaPixelId} onChange={e => setSettings({ ...settings, metaPixelId: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C9A96A]" /></div>
                <div><label className="text-xs font-bold">TikTok Pixel ID</label><input value={settings.tiktokPixelId} onChange={e => setSettings({ ...settings, tiktokPixelId: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#A02A5B]" /></div>
                <button onClick={async () => { await saveSettings(settings); showToast('تم حفظ إعدادات التتبع') }} className="bg-[#1A1A1E] text-white rounded-full py-2.5 font-bold hover:bg-black transition">حفظ الإعدادات</button>
              </div>
              <div className="mt-4 bg-[#FFFBF0] border border-[#F5E6C8] rounded-xl p-3 text-xs leading-5">
                <div className="font-bold text-[#8D6E3A]">أحداث التجارة الإلكترونية المفعّلة:</div>
                <ul className="list-disc list-inside text-[#7A6F5A]">
                  <li>ViewContent — عند عرض المنتج</li>
                  <li>AddToCart — عند الإضافة للسلة</li>
                  <li>InitiateCheckout — عند بدء الطلب</li>
                  <li>Purchase — عند تأكيد الطلب (مع value بعملة DZD)</li>
                </ul>
              </div>
            </div>
            <div className="bg-[#1A1A1E] rounded-2xl p-5 text-white relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#C9A96A]/10 rounded-full blur-2xl" />
              <h3 className="font-bold">سجل الأحداث (Live Pixel Logs)</h3>
              <p className="text-xs text-white/60">آخر 100 حدث محفوظة في localStorage — lumiere_pixel_logs</p>
              <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3 max-h-[320px] overflow-auto text-xs font-mono space-y-1">
                {(() => { try { const logs = JSON.parse(localStorage.getItem('lumiere_pixel_logs') || '[]'); if (logs.length === 0) return <span className="text-white/40">لا توجد أحداث بعد — تصفحي المنتجات لإنشاء أحداث</span>; return logs.slice(0, 20).map((l: any, i: number) => <div key={i} className="border-b border-white/10 pb-1"><span className="text-[#C9A96A]">[{new Date(l.at).toLocaleTimeString()}]</span> {l.provider} • {l.event} {l.value ? `• ${l.value} DZD` : ''}</div>) } catch { return '—' } })()}
              </div>
              <button onClick={() => { localStorage.removeItem('lumiere_pixel_logs'); showToast('تم مسح السجل') }} className="mt-3 w-full bg-white/10 border border-white/20 rounded-full py-2 text-xs font-bold hover:bg-white hover:text-[#1A1A1E] transition">مسح السجل</button>
            </div>
          </div>
        )}
      </div>

      {/* DOMAIN MODAL */}
      {showDomainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={()=> setShowDomainModal(false)} className="absolute inset-0 bg-[#1A1A1E]/60 backdrop-blur-sm"/>
          <div className="relative bg-[#FFFCF8] w-full max-w-[860px] max-h-[92vh] overflow-hidden rounded-[24px] shadow-2xl border border-[#EDE6D8] flex flex-col">
            <div className="sticky top-0 bg-white border-b border-[#EDE6D8] px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                <span className={`w-9 h-9 rounded-xl grid place-items-center text-white ${editingDomain ? 'bg-[#1A1A1E]' : 'bg-[#A02A5B]'}`}>{editingDomain ? <Pencil size={16}/> : <Plus size={16}/>}</span>
                {editingDomain ? `تعديل مجال ${editingDomain.nameAr}` : 'إنشاء مجال مخصص جديد'}
              </h3>
              <button onClick={()=> setShowDomainModal(false)} className="w-8 h-8 rounded-full bg-[#FFFCF8] border border-[#EDE6D8] grid place-items-center hover:bg-white"><X size={16}/></button>
            </div>
            <div className="overflow-auto p-5 space-y-4 flex-1">
              <div className="grid md:grid-cols-2 gap-3">
                <div><label className="text-xs font-bold">اسم المجال FR *</label><input value={domainForm.name} onChange={e=> setDomainForm({...domainForm, name:e.target.value})} placeholder="LUMIÈRE MODE" className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white outline-none" dir="ltr"/></div>
                <div><label className="text-xs font-bold">اسم المجال عربي *</label><input value={domainForm.nameAr} onChange={e=> setDomainForm({...domainForm, nameAr:e.target.value})} placeholder="لوميير موضة" className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white"/></div>
              </div>
              <div><label className="text-xs font-bold">وصف المجال (يظهر في الرئيسية)</label><textarea value={domainForm.descriptionAr} onChange={e=> setDomainForm({...domainForm, descriptionAr:e.target.value})} rows={2} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white"/></div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><label className="text-xs font-bold">شارة الهيرو</label><input value={domainForm.heroBadge} onChange={e=> setDomainForm({...domainForm, heroBadge:e.target.value})} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="MODE 2026 • NEW"/></div>
                <div><label className="text-xs font-bold">رابط صورة الهيرو</label><input value={domainForm.heroImage} onChange={e=> setDomainForm({...domainForm, heroImage:e.target.value})} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white text-xs" placeholder="https://..." dir="ltr"/></div>
              </div>
              <div><label className="text-xs font-bold">عنوان الهيرو عربي</label><input value={domainForm.heroTitleAr} onChange={e=> setDomainForm({...domainForm, heroTitleAr:e.target.value})} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white font-bold"/></div>
              <div><label className="text-xs font-bold">وصف الهيرو</label><textarea value={domainForm.heroSubtitleAr} onChange={e=> setDomainForm({...domainForm, heroSubtitleAr:e.target.value})} rows={2} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white"/></div>
              <div><label className="text-xs font-bold">وصف الفوتر</label><textarea value={domainForm.footerDescriptionAr} onChange={e=> setDomainForm({...domainForm, footerDescriptionAr:e.target.value})} rows={2} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white"/></div>
              {domainForm.heroImage && <img src={domainForm.heroImage} alt="preview" className="w-full h-36 object-cover rounded-2xl border border-[#EDE6D8]" onError={e=> (e.currentTarget.style.display='none')}/>}

              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold flex items-center gap-1.5"><Layers size={14} className="text-[#C9A96A]"/> فئات المجال * — تحدد أقسام المتجر والرئيسية</label>
                  <button onClick={()=> setDomainForm({...domainForm, categories: [...domainForm.categories, {key:`cat${Date.now().toString(36)}`, label:'New', labelAr:'فئة جديدة'}]})} className="bg-[#1A1A1E] text-white px-3 py-1 rounded-full text-xs font-bold">+ فئة</button>
                </div>
                <div className="grid gap-2 mt-3">
                  {domainForm.categories.map((c:any, idx:number)=> (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl px-2 py-2">
                      <input value={c.key} onChange={e=> setDomainForm((f:any)=>{ const n=[...f.categories]; n[idx]={...n[idx], key:e.target.value.trim().toLowerCase().replace(/\s+/g,'_')}; return {...f, categories:n}})} placeholder="key" className="col-span-3 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs font-mono bg-white" dir="ltr"/>
                      <input value={c.label} onChange={e=> setDomainForm((f:any)=>{ const n=[...f.categories]; n[idx]={...n[idx], label:e.target.value}; return {...f, categories:n}})} placeholder="FR label" className="col-span-3 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs bg-white" dir="ltr"/>
                      <input value={c.labelAr} onChange={e=> setDomainForm((f:any)=>{ const n=[...f.categories]; n[idx]={...n[idx], labelAr:e.target.value}; return {...f, categories:n}})} placeholder="الاسم عربي" className="col-span-4 border border-[#F6C0D4] bg-[#FDF2F6] rounded-full px-2 py-1.5 text-xs font-bold"/>
                      <button onClick={()=> setDomainForm((f:any)=> ({...f, categories: f.categories.filter((_:any,i:number)=> i!==idx)}))} disabled={domainForm.categories.length===1} className="col-span-2 w-7 h-7 rounded-full bg-red-50 text-red-600 border border-red-200 grid place-items-center disabled:opacity-30 justify-self-end"><Trash2 size={12}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* NEW: Attribute Schema Editor */}
              <div className="bg-[#FFFBF0] border border-[#F5E6C8] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold flex items-center gap-1.5"><FileText size={14} className="text-[#8D6E3A]"/> حقول المنتج الخاصة بهذا المجال — ستظهر في نموذج إضافة المنتج</label>
                  <button onClick={()=> setDomainForm({...domainForm, attributeSchema: [...domainForm.attributeSchema, {key:`field${domainForm.attributeSchema.length+1}`, label:'Field', labelAr:'حقل جديد', type:'text', placeholder:'مثال: قيمة'}]})} className="bg-white border border-[#F0D9A8] text-[#8D6E3A] px-3 py-1 rounded-full text-xs font-bold">+ حقل</button>
                </div>
                <p className="text-[11px] text-[#9A8A6B] mt-1">مثال مجوهرات: الطلاء/الحجر/الوزن — ملابس: القماش/القصة/الطول — بيوتي: الحجم/نوع البشرة. كل حقل يظهر تلقائياً عند اختيار المجال.</p>
                <div className="grid gap-2 mt-3">
                  {domainForm.attributeSchema.map((a:any, idx:number)=> (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-white border border-[#F0D9A8] rounded-xl px-2 py-2">
                      <input value={a.key} onChange={e=> setDomainForm((f:any)=>{ const n=[...f.attributeSchema]; n[idx]={...n[idx], key:e.target.value.trim()}; return {...f, attributeSchema:n}})} placeholder="key" className="col-span-2 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs font-mono" dir="ltr"/>
                      <input value={a.labelAr} onChange={e=> setDomainForm((f:any)=>{ const n=[...f.attributeSchema]; n[idx]={...n[idx], labelAr:e.target.value}; return {...f, attributeSchema:n}})} placeholder="الاسم عربي" className="col-span-3 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs"/>
                      <select value={a.type} onChange={e=> setDomainForm((f:any)=>{ const n=[...f.attributeSchema]; n[idx]={...n[idx], type:e.target.value}; return {...f, attributeSchema:n}})} className="col-span-2 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs bg-white">
                        <option value="text">نص</option><option value="textarea">فقرة</option><option value="select">قائمة اختيار</option><option value="multiselect">متعدد</option>
                      </select>
                      <input value={(a.options||[]).join(', ')} onChange={e=> setDomainForm((f:any)=>{ const n=[...f.attributeSchema]; n[idx]={...n[idx], options: e.target.value.split(',').map((s:string)=> s.trim()).filter(Boolean)}; return {...f, attributeSchema:n}})} placeholder="خيارات (فاصلة)" className="col-span-3 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs" dir="ltr"/>
                      <button onClick={()=> setDomainForm((f:any)=> ({...f, attributeSchema: f.attributeSchema.filter((_:any,i:number)=> i!==idx)}))} className="col-span-2 w-7 h-7 rounded-full bg-red-50 text-red-600 border border-red-200 grid place-items-center justify-self-end"><X size={12}/></button>
                      <label className="col-span-12 flex items-center gap-1.5 text-[11px]"><input type="checkbox" checked={!!a.required} onChange={e=> setDomainForm((f:any)=>{ const n=[...f.attributeSchema]; n[idx]={...n[idx], required: e.target.checked}; return {...f, attributeSchema:n}})} /> مطلوب</label>
                    </div>
                  ))}
                  {domainForm.attributeSchema.length===0 && <p className="text-xs text-[#9A8A6B] text-center py-2">لا توجد حقول مخصصة — أضف حقلاً مثل: القماش، المقاس...</p>}
                </div>
              </div>

              {/* NEW: Variant Config Editor */}
              <div className="bg-[#FDF2F6] border border-[#F6C0D4] rounded-2xl p-4">
                <label className="text-xs font-bold flex items-center gap-1.5"><PaletteIcon size={14} className="text-[#A02A5B]"/> إعدادات المتغيرات (ألوان + مقاسات) — تتحكم في جدول المتغيرات داخل المنتج</label>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  <label className="flex items-center gap-2 bg-white border border-[#F6C0D4] rounded-xl px-3 py-2 text-sm"><input type="checkbox" checked={domainForm.variantConfig.hasColor} onChange={e=> setDomainForm({...domainForm, variantConfig:{...domainForm.variantConfig, hasColor: e.target.checked}})} /> تفعيل الألوان</label>
                  <label className="flex items-center gap-2 bg-white border border-[#F6C0D4] rounded-xl px-3 py-2 text-sm"><input type="checkbox" checked={domainForm.variantConfig.hasSize} onChange={e=> setDomainForm({...domainForm, variantConfig:{...domainForm.variantConfig, hasSize: e.target.checked}})} /> تفعيل المقاسات</label>
                </div>
                {domainForm.variantConfig.hasSize && (
                  <div className="mt-3"><label className="text-xs font-bold flex items-center gap-1"><Ruler size={12}/> خيارات المقاسات (افصلي بفاصلة)</label><input value={domainForm.variantConfig.sizeOptions.join(', ')} onChange={e=> setDomainForm({...domainForm, variantConfig:{...domainForm.variantConfig, sizeOptions: e.target.value.split(',').map(s=> s.trim()).filter(Boolean)}})} placeholder="XS, S, M, L, XL, XXL أو 36, 37, 38" className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2 text-sm bg-white" /></div>
                )}
                {domainForm.variantConfig.hasColor && (
                  <div className="mt-3">
                    <label className="text-xs font-bold flex items-center gap-1"><Droplet size={12} className="text-[#A02A5B]"/> ألوان جاهزة لهذا المجال</label>
                    <div className="grid gap-1.5 mt-2">
                      {domainForm.variantConfig.colorPresets.map((c:any, idx:number)=> (
                        <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-white border border-[#F6C0D4] rounded-xl px-2 py-2">
                          <input type="color" value={c.hex} onChange={e=> { const n=[...domainForm.variantConfig.colorPresets]; n[idx]={...n[idx], hex:e.target.value} as any; setDomainForm({...domainForm, variantConfig:{...domainForm.variantConfig, colorPresets:n}})}} className="col-span-2 h-8 rounded-full border-0 p-0"/>
                          <input value={c.name} onChange={e=> { const n=[...domainForm.variantConfig.colorPresets]; n[idx]={...n[idx], name:e.target.value} as any; setDomainForm({...domainForm, variantConfig:{...domainForm.variantConfig, colorPresets:n}})}} placeholder="FR" className="col-span-3 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs" dir="ltr"/>
                          <input value={c.nameAr} onChange={e=> { const n=[...domainForm.variantConfig.colorPresets]; n[idx]={...n[idx], nameAr:e.target.value} as any; setDomainForm({...domainForm, variantConfig:{...domainForm.variantConfig, colorPresets:n}})}} placeholder="عربي" className="col-span-5 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs"/>
                          <button onClick={()=> { setDomainForm({...domainForm, variantConfig:{...domainForm.variantConfig, colorPresets: domainForm.variantConfig.colorPresets.filter((_:any,i:number)=> i!==idx)}})}} className="col-span-2 w-7 h-7 rounded-full bg-red-50 text-red-600 border border-red-200 grid place-items-center justify-self-end"><Trash2 size={12}/></button>
                        </div>
                      ))}
                      <button onClick={()=> setDomainForm({...domainForm, variantConfig:{...domainForm.variantConfig, colorPresets:[...domainForm.variantConfig.colorPresets, {name:'New', nameAr:'جديد', hex:'#CCCCCC'}]}})} className="bg-white border border-[#F6C0D4] text-[#A02A5B] px-3 py-1.5 rounded-full text-xs font-bold w-fit">+ لون</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-[#EDE6D8] p-4 flex gap-2">
              <button onClick={handleSaveDomain} className={`flex-1 text-white rounded-full py-3 font-extrabold flex items-center justify-center gap-2 ${editingDomain ? 'bg-[#1A1A1E] hover:bg-black' : 'bg-[#A02A5B] hover:bg-[#7A1F44] shadow-[#A02A5B]/20 shadow-lg'}`}><Save size={16}/> {editingDomain ? 'حفظ التعديلات' : 'إنشاء المجال'}</button>
              <button onClick={()=> setShowDomainModal(false)} className="px-6 border border-[#EDE6D8] rounded-full py-3 font-bold bg-white">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT MODAL */}
      {showProdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowProdModal(false)} className="absolute inset-0 bg-[#1A1A1E]/60 backdrop-blur-sm" />
          <div className="relative bg-[#FFFCF8] w-full max-w-[860px] max-h-[92vh] overflow-hidden rounded-[24px] shadow-2xl border border-[#EDE6D8] flex flex-col">
            <div className="sticky top-0 bg-white border-b border-[#EDE6D8] px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                <span className={`w-9 h-9 rounded-xl grid place-items-center text-white ${editingProd ? 'bg-[#1A1A1E]' : 'bg-[#A02A5B]'}`}>{editingProd ? <Pencil size={16} /> : <Plus size={16} />}</span>
                {editingProd ? 'تعديل المنتج' : 'إضافة منتج جديد — نشر فوري'}
                <span className="hidden md:inline text-xs bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] px-2 py-1 rounded-full">{currentDomainForForm.nameAr}</span>
              </h3>
              <button onClick={() => setShowProdModal(false)} className="w-8 h-8 rounded-full bg-[#FFFCF8] border border-[#EDE6D8] grid place-items-center hover:bg-white"><X size={16} /></button>
            </div>

            <div className="overflow-auto p-5 space-y-4 flex-1">
              <div className="flex flex-wrap gap-2">
                <label className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${prodForm.isNew ? 'bg-[#A02A5B] text-white border-[#A02A5B]' : 'bg-white text-[#9A8A6B] border-[#EDE6D8]'}`}>
                  <input type="checkbox" checked={prodForm.isNew} onChange={e => setProdForm({ ...prodForm, isNew: e.target.checked })} className="hidden" /> <Sparkles size={12} /> جديد
                </label>
                <label className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${prodForm.isFeatured ? 'bg-[#1A1A1E] text-white border-[#1A1A1E]' : 'bg-white text-[#9A8A6B] border-[#EDE6D8]'}`}>
                  <input type="checkbox" checked={prodForm.isFeatured} onChange={e => setProdForm({ ...prodForm, isFeatured: e.target.checked })} className="hidden" /> <Crown size={12} className={prodForm.isFeatured ? 'text-[#C9A96A]' : ''} /> مميز (الرئيسية)
                </label>
                <span className="ms-auto text-xs bg-white border border-[#EDE6D8] px-3 py-1.5 rounded-full">{editingProd ? editingProd._id : 'سيتم إنشاء ID تلقائياً'}</span>
              </div>

              {/* DOMAIN + CATEGORY */}
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4">
                <div className="grid md:grid-cols-2 gap-3">
                  <div><label className="text-xs font-bold flex items-center gap-1"><Globe size={12} className="text-[#A02A5B]"/> المجال *</label>
                    <select value={(prodForm as any).domainId || activeDomain.id} onChange={e=>{
                      const d = domains.find(x=> x.id===e.target.value) || activeDomain
                      setProdForm(f=> ({...f, domainId: d.id, category: d.categories[0]?.key || (f.category), attributes: {}} as any))
                    }} className="mt-1 w-full border border-[#F6C0D4] bg-[#FDF2F6] rounded-xl px-3 py-2.5 text-sm font-bold">
                      {domains.map(d=> <option key={d.id} value={d.id}>{d.nameAr} — {d.name}</option>)}
                    </select>
                    <p className="text-[11px] text-[#A02A5B]/70 mt-1">اختيار المجال يبدّل الحقول والمتغيرات تلقائياً</p>
                  </div>
                  <div><label className="text-xs font-bold">الفئة * ({currentDomainForForm.categories.length} فئة)</label>
                    <select value={prodForm.category} onChange={e => setProdForm({ ...prodForm, category: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white font-bold">
                      {currentDomainForForm.categories.map(c=> <option key={c.key} value={c.key}>{c.labelAr} — {c.label} ({c.key})</option>)}
                      {/* also show other categories if editing product with outside category */}
                      {!currentDomainForForm.categories.some(c=> c.key===prodForm.category) && <option value={prodForm.category}>{prodForm.category} (خارج المجال)</option>}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div><label className="text-xs font-bold">الاسم العربي *</label><input value={prodForm.nameAr} onChange={e => setProdForm({ ...prodForm, nameAr: e.target.value })} placeholder={currentDomainForForm.id==='domain_fashion' ? "مثال: عباءة فيلور ملكية" : "مثال: قلادة لؤلؤ فاخرة"} className={`mt-1 w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none ${prodErrors.nameAr ? 'border-red-300 bg-red-50' : 'border-[#EDE6D8] focus:border-[#C9A96A]'}`} />{prodErrors.nameAr && <p className="text-xs text-red-600 mt-1">{prodErrors.nameAr}</p>}</div>
                <div><label className="text-xs font-bold">الاسم FR *</label><input value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} placeholder={currentDomainForForm.id==='domain_fashion' ? "Velours Abaya" : "Aurore Necklace"} className={`mt-1 w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none ${prodErrors.name ? 'border-red-300' : 'border-[#EDE6D8]'}`} dir="ltr" />{prodErrors.name && <p className="text-xs text-red-600 mt-1">{prodErrors.name}</p>}</div>
              </div>

              <div><label className="text-xs font-bold">الوصف عربي</label><textarea value={prodForm.descriptionAr} onChange={e => setProdForm({ ...prodForm, descriptionAr: e.target.value })} rows={2} placeholder="وصف جذاب يزيد الثقة..." className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-[#C9A96A]" /></div>
              <div><label className="text-xs font-bold">Description FR</label><textarea value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} rows={2} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" dir="ltr" /></div>

              <div className="grid md:grid-cols-4 gap-3">
                <div><label className="text-xs font-bold flex gap-1"><Tag size={12} className="text-[#C9A96A]" /> السعر (د.ج) *</label><input type="number" value={prodForm.price || ''} onChange={e => setProdForm({ ...prodForm, price: parseInt(e.target.value) || 0 })} className={`mt-1 w-full border rounded-xl px-3 py-2.5 text-sm bg-white ${prodErrors.price ? 'border-red-300 bg-red-50' : 'border-[#EDE6D8]'}`} />{prodErrors.price && <p className="text-xs text-red-600 mt-1">{prodErrors.price}</p>}</div>
                <div><label className="text-xs font-bold">السعر قبل الخصم</label><input type="number" value={prodForm.compareAtPrice || ''} onChange={e => setProdForm({ ...prodForm, compareAtPrice: e.target.value ? parseInt(e.target.value) : undefined })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="اختياري" /></div>
                <div><label className="text-xs font-bold">المخزون الأساسي</label><input type="number" value={prodForm.stock} onChange={e => setProdForm({ ...prodForm, stock: parseInt(e.target.value) || 0 })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" /><p className="text-[11px] text-[#9A8A6B] mt-1">يُحتسب تلقائياً من المتغيرات إن وُجدت</p></div>
                <div><label className="text-xs font-bold">التقييم</label><div className="flex gap-2 mt-1"><input type="number" step="0.1" min={1} max={5} value={prodForm.rating} onChange={e => setProdForm({ ...prodForm, rating: parseFloat(e.target.value) || 4.8 })} className="flex-1 border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" /><input type="number" value={prodForm.reviewsCount} onChange={e => setProdForm({ ...prodForm, reviewsCount: parseInt(e.target.value) || 0 })} placeholder="عدد التقييمات" className="flex-1 border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" /></div></div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div><label className="text-xs font-bold">SKU</label><input value={prodForm.sku} onChange={e => setProdForm({ ...prodForm, sku: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white font-mono" placeholder="LUM-X-001" /></div>
                <div className="bg-[#FDF2F6] border border-[#F6C0D4] rounded-xl p-2.5">
                  <div className="text-xs font-bold text-[#A02A5B] flex items-center gap-1"><Sparkles size={12}/> مجال المنتج: {currentDomainForForm.nameAr}</div>
                  <div className="text-[11px] text-[#7A1F44] mt-1">الفئة: <b>{currentDomainForForm.categories.find(c=> c.key===prodForm.category)?.labelAr || prodForm.category}</b> • {currentDomainForForm.attributeSchema.length} حقل مخصص • {currentDomainForForm.variantConfig.hasSize ? `مقاسات ${currentDomainForForm.variantConfig.sizeOptions.length}` : 'بدون مقاسات'} {currentDomainForForm.variantConfig.hasColor ? `+ ${currentDomainForForm.variantConfig.colorPresets.length} ألوان` : ''}</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div><label className="text-xs font-bold">الخامة FR</label><input value={prodForm.material} onChange={e => setProdForm({ ...prodForm, material: e.target.value })} placeholder={currentDomainForForm.id==='domain_fashion' ? "Velvet" : "18k Gold Plated"} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" dir="ltr" /></div>
                <div><label className="text-xs font-bold">الخامة عربي</label><input value={prodForm.materialAr} onChange={e => setProdForm({ ...prodForm, materialAr: e.target.value })} placeholder={currentDomainForForm.id==='domain_fashion' ? "مخمل" : "ذهب 18ق + لؤلؤ"} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" /></div>
              </div>

              {/* DOMAIN-SPECIFIC ATTRIBUTES */}
              {currentDomainForForm.attributeSchema.length>0 && (
                <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4">
                  <label className="text-xs font-bold flex items-center gap-1.5"><FileText size={14} className="text-[#C9A96A]"/> خصائص خاصة بمجال {currentDomainForForm.nameAr} — تتغير تلقائياً مع المجال</label>
                  <p className="text-[11px] text-[#9A8A6B] mt-1">هذه الحقول تعتمد على المجال المختار أعلاه. غيّر المجال لترى حقول ملابس/مجوهرات/بيوتي المختلفة.</p>
                  <div className="grid md:grid-cols-2 gap-3 mt-3">
                    {currentDomainForForm.attributeSchema.map(attr=>{
                      const val = (prodForm.attributes as any)?.[attr.key] || ''
                      const errKey = 'attr_'+attr.key
                      return (
                        <div key={attr.key}>
                          <label className="text-xs font-bold flex items-center gap-1">{attr.labelAr} {attr.required && <span className="text-red-500">*</span>} <span className="text-[10px] text-[#9A8A6B] font-normal">({attr.key})</span></label>
                          {attr.type==='text' && <input value={val} onChange={e=> setProdForm(f=> ({...f, attributes:{...(f.attributes||{}), [attr.key]: e.target.value}}))} placeholder={attr.placeholder||''} className={`mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-[#FFFCF8] ${prodErrors[errKey] ? 'border-red-300 bg-red-50' : 'border-[#EDE6D8]'}`} />}
                          {attr.type==='textarea' && <textarea value={val} onChange={e=> setProdForm(f=> ({...f, attributes:{...(f.attributes||{}), [attr.key]: e.target.value}}))} rows={2} placeholder={attr.placeholder||''} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2 text-sm bg-[#FFFCF8]"/>}
                          {attr.type==='select' && (
                            <select value={val} onChange={e=> setProdForm(f=> ({...f, attributes:{...(f.attributes||{}), [attr.key]: e.target.value}}))} className={`mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-[#FFFCF8] ${prodErrors[errKey] ? 'border-red-300' : 'border-[#EDE6D8]'}`}>
                              <option value="">— اختاري —</option>
                              {(attr.options||[]).map((o:string)=> <option key={o} value={o}>{o}</option>)}
                            </select>
                          )}
                          {attr.type==='multiselect' && (
                            <div className="mt-1 border border-[#EDE6D8] rounded-xl p-2 bg-[#FFFCF8] grid grid-cols-2 gap-1">
                              {(attr.options||[]).map((o:string)=>{
                                const selected = Array.isArray(val) ? val.includes(o) : false
                                return (
                                  <label key={o} className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 cursor-pointer ${selected ? 'bg-[#1A1A1E] text-white border-[#1A1A1E]' : 'bg-white border-[#EDE6D8]'}`}>
                                    <input type="checkbox" className="hidden" checked={selected} onChange={e=>{
                                      const cur = Array.isArray((prodForm.attributes as any)?.[attr.key]) ? [...(prodForm.attributes as any)[attr.key]] : []
                                      if(e.target.checked) cur.push(o); else { const idx=cur.indexOf(o); if(idx>=0) cur.splice(idx,1)}
                                      setProdForm(f=> ({...f, attributes:{...(f.attributes||{}), [attr.key]: cur}}))
                                    }}/>
                                    {selected ? <Check size={10}/> : <Plus size={10}/>} {o}
                                  </label>
                                )
                              })}
                            </div>
                          )}
                          {prodErrors[errKey] && <p className="text-xs text-red-600 mt-1">{prodErrors[errKey]}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4">
                <label className="text-xs font-bold flex items-center gap-1.5"><ImageIcon size={14} className="text-[#C9A96A]" /> صور المنتج — روابط خارجية (CDN) *</label>
                <p className="text-[11px] text-[#9A8A6B] mt-1">استخدمي روابط Unsplash أو أي CDN. الصورة الأولى هي الرئيسية.</p>
                <div className="grid gap-2 mt-3">
                  {prodForm.images.map((img, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <img src={img || 'https://via.placeholder.com/80x80?text=?'} alt="" className="w-12 h-12 rounded-xl object-cover border border-[#EDE6D8] bg-[#FFFCF8] shrink-0" onError={e => (e.currentTarget.src = 'https://via.placeholder.com/80x80?text=?')} />
                      <input value={img} onChange={e => setProdForm(f => { const n = [...f.images]; n[idx] = e.target.value; return { ...f, images: n } })} placeholder={`رابط الصورة ${idx + 1} — https://...`} className="flex-1 border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-[#FFFCF8] outline-none focus:bg-white focus:border-[#C9A96A] text-xs" dir="ltr" />
                      <span className="text-[11px] bg-[#1A1A1E] text-white px-2 py-1 rounded-full hidden md:inline">{idx === 0 ? 'رئيسية' : `#${idx + 1}`}</span>
                      <button onClick={() => setProdForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))} disabled={prodForm.images.length === 1} className="w-8 h-8 rounded-full bg-red-50 text-red-600 border border-red-200 grid place-items-center disabled:opacity-30"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                {prodErrors.images && <p className="text-xs text-red-600 mt-2">{prodErrors.images}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setProdForm(f => ({ ...f, images: [...f.images, ''] }))} className="bg-white border border-[#EDE6D8] px-3 py-1.5 rounded-full text-xs font-bold hover:bg-[#FFFCF8]">+ إضافة صورة</button>
                  <button onClick={() => setProdForm(f => ({ ...f, images: [currentDomainForForm.heroImage] }))} className="text-xs text-[#A02A5B] underline">تعبئة بصورة المجال</button>
                </div>
              </div>

              {/* VARIANTS — DOMAIN-AWARE */}
              <div className={`${currentDomainForForm.variantConfig.hasColor || currentDomainForForm.variantConfig.hasSize ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-white border-[#EDE6D8]'} border rounded-2xl p-4`}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold flex items-center gap-1.5"><PaletteIcon size={14} className={currentDomainForForm.variantConfig.hasColor || currentDomainForForm.variantConfig.hasSize ? 'text-[#A02A5B]' : 'text-[#9A8A6B]'} /> متغيرات المنتج — {currentDomainForForm.variantConfig.hasColor ? 'ألوان' : ''}{currentDomainForForm.variantConfig.hasColor && currentDomainForForm.variantConfig.hasSize ? ' + ' : ''}{currentDomainForForm.variantConfig.hasSize ? 'مقاسات' : ''} {currentDomainForForm.variantConfig.hasSize ? `(${currentDomainForForm.variantConfig.sizeOptions.join(' • ')})` : ''}</label>
                  <span className="text-[11px] bg-white border border-[#EDE6D8] px-2 py-1 rounded-full">{(prodForm.variants||[]).length} متغير {prodForm.variants?.length ? `• المخزون الإجمالي ${prodForm.variants.reduce((a,b)=> a+(Number(b.stock)||0),0)}` : ''}</span>
                </div>
                {!currentDomainForForm.variantConfig.hasColor && !currentDomainForForm.variantConfig.hasSize ? (
                  <p className="text-xs text-[#9A8A6B] mt-2 text-center py-3 bg-white rounded-xl border border-dashed">هذا المجال بدون متغيرات افتراضياً — يمكنك إضافة متغيرات يدوياً أو فعّليها من إعدادات المجال.</p>
                ) : (
                  <>
                    <div className="grid md:grid-cols-[1fr_1fr_auto] gap-2 mt-3 bg-white border border-[#F6C0D4] rounded-xl p-3">
                      <div><label className="text-[11px] font-bold flex items-center gap-1"><Ruler size={11}/> مقاسات للجيل الجماعي (فاصلة)</label><input value={bulkSizes} onChange={e=> setBulkSizes(e.target.value)} placeholder={currentDomainForForm.variantConfig.sizeOptions.join(', ')} className="mt-1 w-full border border-[#EDE6D8] rounded-full px-3 py-1.5 text-xs" /></div>
                      <div><label className="text-[11px] font-bold flex items-center gap-1"><Droplet size={11} className="text-[#A02A5B]"/> ألوان للجيل الجماعي (فاصلة)</label><input value={bulkColors} onChange={e=> setBulkColors(e.target.value)} placeholder={currentDomainForForm.variantConfig.colorPresets.map(c=> c.nameAr).join(', ')} className="mt-1 w-full border border-[#EDE6D8] rounded-full px-3 py-1.5 text-xs" /></div>
                      <button onClick={bulkGenerate} className="self-end bg-[#A02A5B] text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-[#7A1F44] h-fit">توليد جماعي</button>
                    </div>
                    <div className="grid gap-2 mt-3">
                      {(prodForm.variants||[]).map((v, idx)=> (
                        <div key={v.id} className="grid grid-cols-12 gap-1.5 items-center bg-white border border-[#F6C0D4] rounded-xl px-2 py-2">
                          {currentDomainForForm.variantConfig.hasColor ? (
                            <>
                              <input type="color" value={v.colorHex || '#CCCCCC'} onChange={e=> updateVariant(idx, { colorHex: e.target.value })} className="col-span-1 h-8 rounded-full p-0 border-0"/>
                              <input value={v.colorAr || v.color || ''} onChange={e=> updateVariant(idx, { colorAr: e.target.value, color: e.target.value })} placeholder="اللون" className="col-span-3 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs"/>
                            </>
                          ) : <span className="col-span-4 text-[11px] text-[#9A8A6B]">بدون لون</span>}
                          {currentDomainForForm.variantConfig.hasSize ? (
                            <select value={v.size || ''} onChange={e=> updateVariant(idx, { size: e.target.value })} className="col-span-3 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs bg-white">
                              <option value="">— مقاس —</option>
                              {currentDomainForForm.variantConfig.sizeOptions.map(s=> <option key={s} value={s}>{s}</option>)}
                              <option value="custom">مخصص...</option>
                            </select>
                          ) : <span className="col-span-3 text-[11px] text-[#9A8A6B]">بدون مقاس</span>}
                          <input type="number" value={v.stock} onChange={e=> updateVariant(idx, { stock: parseInt(e.target.value)||0 })} className="col-span-2 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs text-center" placeholder="المخزون"/>
                          <input type="number" value={v.priceAdjustment||0} onChange={e=> updateVariant(idx, { priceAdjustment: parseInt(e.target.value)||0 })} className="col-span-2 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs text-center" placeholder="+سعر"/>
                          <button onClick={()=> removeVariant(idx)} className="col-span-1 w-7 h-7 rounded-full bg-red-50 text-red-600 border border-red-200 grid place-items-center justify-self-end"><X size={12}/></button>
                          {v.size==='custom' && <input placeholder="مقاس مخصص" onBlur={e=> updateVariant(idx, { size: e.target.value })} className="col-span-12 border border-dashed border-[#F6C0D4] rounded-full px-3 py-1.5 text-xs mt-1" />}
                        </div>
                      ))}
                      {(prodForm.variants||[]).length===0 && <p className="text-xs text-[#9A8A6B] text-center py-2">لا توجد متغيرات — أضف متغيراً أو استخدم التوليد الجماعي. مثال ملابس: أدخل المقاسات <b>S, M, L, XL</b> والألوان <b>أسود, بيج</b></p>}
                      <button onClick={addVariantRow} className="bg-white border border-[#F6C0D4] text-[#A02A5B] px-3 py-1.5 rounded-full text-xs font-bold w-fit flex items-center gap-1"><Plus size={12}/> إضافة متغير</button>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-[#FFFBF0] border border-[#F5E6C8] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold flex items-center gap-1.5"><Zap size={12} className="text-[#C9A96A]" /> عروض الكمية (خصم تلقائي)</label>
                  <button onClick={() => setProdForm(f => ({ ...f, tierPricing: [...f.tierPricing, { minQty: (f.tierPricing[f.tierPricing.length - 1]?.minQty || 1) + 1, discountPercent: 10, label: 'Offer', labelAr: 'عرض' }] }))} className="bg-white border border-[#F0D9A8] text-[#8D6E3A] px-3 py-1 rounded-full text-xs font-bold">+ عرض</button>
                </div>
                <div className="grid gap-2 mt-3">
                  {prodForm.tierPricing.map((t, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-white border border-[#F0D9A8] rounded-xl px-2 py-2">
                      <span className="col-span-12 md:col-span-12 text-[11px] font-bold text-[#8D6E3A] md:hidden">عرض #{idx + 1}</span>
                      <input type="number" value={t.minQty} onChange={e => setProdForm(f => { const n = [...f.tierPricing]; n[idx] = { ...n[idx], minQty: parseInt(e.target.value) || 1 }; return { ...f, tierPricing: n } })} className="col-span-3 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs text-center" placeholder="الكمية" />
                      <input type="number" value={t.discountPercent} onChange={e => setProdForm(f => { const n = [...f.tierPricing]; n[idx] = { ...n[idx], discountPercent: parseInt(e.target.value) || 0 }; return { ...f, tierPricing: n } })} className="col-span-3 border border-[#F6C0D4] bg-[#FDF2F6] rounded-full px-2 py-1.5 text-xs text-center font-bold text-[#A02A5B]" placeholder="%" />
                      <input value={t.labelAr} onChange={e => setProdForm(f => { const n = [...f.tierPricing]; n[idx] = { ...n[idx], labelAr: e.target.value }; return { ...f, tierPricing: n } })} className="col-span-4 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs" placeholder="التسمية عربي" />
                      <button onClick={() => setProdForm(f => ({ ...f, tierPricing: f.tierPricing.filter((_, i) => i !== idx) }))} className="col-span-2 md:col-span-2 w-7 h-7 rounded-full bg-red-50 text-red-600 border border-red-200 grid place-items-center justify-self-end"><X size={12} /></button>
                    </div>
                  ))}
                  {prodForm.tierPricing.length === 0 && <p className="text-xs text-[#9A8A6B] text-center py-2">لا توجد عروض — أضيفي عرضاً لزيادة المبيعات</p>}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#EDE6D8] p-4 flex gap-2">
              <button onClick={handleSaveProduct} className={`flex-1 text-white rounded-full py-3 font-extrabold flex items-center justify-center gap-2 shadow-lg ${editingProd ? 'bg-[#1A1A1E] hover:bg-black' : 'bg-[#A02A5B] hover:bg-[#7A1F44] shadow-[#A02A5B]/20'}`}>
                {editingProd ? <><Save size={16} /> حفظ التعديلات</> : <><Plus size={16} /> نشر المنتج في المتجر</>}
              </button>
              <button onClick={() => setShowProdModal(false)} className="px-6 border border-[#EDE6D8] rounded-full py-3 font-bold bg-white hover:bg-[#FFFCF8]">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
