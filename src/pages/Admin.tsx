import { useEffect, useState, useMemo } from 'react'
import { getOrders, updateOrderStatus, deleteOrder, exportOrdersCsv, syncOrders } from '../services/api/orders'
import { getWilayas, updateWilayaRate, addWilaya, syncWilayas } from '../services/api/wilayas'
import { getProducts, addProduct, updateProduct, deleteProduct, duplicateProduct, toggleProductFlag, syncProducts } from '../services/api/products'
import { getSettings, saveSettings, syncSettings } from '../services/api/settings'
import { updateStoreApi, authUpdateProfile, authChangePassword, listMyStores, toggleMarketplacePublishApi } from '../services/api/client'
import {
  fetchAnalyticsOverview, fetchAnalyticsTimeline, fetchAnalyticsSources, fetchAnalyticsTopProducts,
  fetchAnalyticsDevices, fetchAnalyticsCountries,
  type AnalyticsOverview, type AnalyticsTimelinePoint, type AnalyticsSource,
  type AnalyticsTopProduct, type AnalyticsDevice, type AnalyticsCountry,
  scrapeProduct, type ScrapedProduct,
} from '../services/api/client'
import { useTenant } from '../context/TenantContext'
import { getDomains, getActiveDomain, setActiveDomain, createCustomDomain, updateDomain, deleteDomain, duplicateDomain, syncDomains } from '../services/api/domains'
import { ALGERIAN_DELIVERY_PROVIDERS, defaultDeliveryProviders } from '../services/api/deliveryProviders'
import { SmartImage } from '../components/SmartImage'
import type { Order, OrderStatus, WilayaRate, Product, StoreDomain, DomainCategory, AttributeDef, Variant, DeliveryProviderConfig, TenantStore } from '../services/api/types'
import { formatDZD } from '../lib/utils'
import {
  Download, Trash2, Search, Package, Truck, CheckCircle, XCircle, Clock, BarChart3, Settings,
  MapPinned, Save, Plus, Pencil, Copy, Eye, Star, Crown, Sparkles, Store, Megaphone,
  Phone, Mail, Instagram, Palette, Zap, Image as ImageIcon, Tag, Layers, X,
  AlertCircle, Check, Filter, ShoppingBag, TrendingUp, Award, Gem, Shirt, Heart,
  Wand2, RefreshCw, Globe, Palette as PaletteIcon, Ruler, Droplet, Paintbrush, FileText, Link2,
  ExternalLink, LayoutDashboard, Lock, User, LogOut, Building2, CreditCard, ChevronDown, Menu, KeyRound, ShieldCheck,
  Smartphone, Home as HomeIcon, Wifi,
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
  const { storeId, user, logout, refreshUser } = useTenant()
  const [orders, setOrders] = useState<Order[]>(() => getOrders())
  const [wilayas, setWilayas] = useState<WilayaRate[]>(() => getWilayas())
  const [products, setProducts] = useState<Product[]>(() => getProducts())
  const [settings, setSettings] = useState(() => getSettings())
  const [domains, setDomains] = useState<StoreDomain[]>(() => getDomains())
  const [activeDomain, setActiveDomainState] = useState<StoreDomain>(() => getActiveDomain())
  const [tab, setTab] = useState<'overview' | 'domains' | 'custom-domain' | 'products' | 'orders' | 'wilayas' | 'store' | 'tracking' | 'delivery' | 'marketplace' | 'account-profile' | 'account-security' | 'account-stores' | 'account-billing'>('overview')
  
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [myStores, setMyStores] = useState<TenantStore[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  
  const [onboarding, setOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return new URLSearchParams(window.location.search).get('onboarding') === '1'
    } catch { return false }
  })
  
  const currentSlug = (() => {
    try {
      return localStorage.getItem('amugar_saas_active_slug') || 'demo'
    } catch { return 'demo' }
  })()
  
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  // المستورد السحري (Product Scraper)
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [showScraper, setShowScraper] = useState(false)

  // Domain modal
  const [showDomainModal, setShowDomainModal] = useState(false)
  const [editingDomain, setEditingDomain] = useState<StoreDomain | null>(null)
  const [domainForm, setDomainForm] = useState<any>({
    name: '', nameAr: '', descriptionAr: '', heroBadge: '', heroTitleAr: '', heroSubtitleAr: '', heroImage: '', footerDescriptionAr: '', categories: [{key:'general', label:'General', labelAr:'عام'}], attributeSchema: [], variantConfig: { hasColor:false, hasSize:false, sizeOptions:[], colorPresets:[] }, isPreset: false
  })

  const [storeForm, setStoreForm] = useState(() => getSettings())
  const [customDomainInput, setCustomDomainInput] = useState('')

  // Categories helper
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
    isPublishedInMarketplace: true,
    attributes: {},
    variants: [],
    tierPricing: [{ minQty: 2, discountPercent: 10, label: 'Duo', labelAr: 'عرض الثنائي' }],
    domainId: domain.id,
  } as any)

  const [prodForm, setProdForm] = useState<Omit<Product,'_id'|'createdAt'>>(()=> makeEmptyProduct(activeDomain))
  const [prodErrors, setProdErrors] = useState<Record<string,string>>({})

  // Variant bulk helpers
  const [bulkSizes, setBulkSizes] = useState<string>('')
  const [bulkColors, setBulkColors] = useState<string>('')

  // Account profile form state
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '' })
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPw, setIsSavingPw] = useState(false)

  // ─── Live Polling & Auto Sync on Mount ──────────────────────────────
  useEffect(() => {
    const syncAllData = async () => {
      try {
        await Promise.allSettled([
          typeof syncOrders === 'function' ? syncOrders() : Promise.resolve(),
          syncProducts(),
          syncWilayas(),
          syncSettings(),
          syncDomains(),
        ])
        setOrders(getOrders())
        setProducts(getProducts())
        setWilayas(getWilayas())
        setSettings(getSettings())
        setStoreForm(getSettings())
        setDomains(getDomains())
        setActiveDomainState(getActiveDomain())
      } catch {}
    }

    void syncAllData()
    const interval = setInterval(syncAllData, 30000)
    return () => clearInterval(interval)
  }, [tab])

  // Mark session as admin for clean visit tracking
  useEffect(() => {
    try { sessionStorage.setItem('amugar_is_admin', '1') } catch {}
    return () => {
      try { sessionStorage.removeItem('amugar_is_admin') } catch {}
    }
  }, [])

  useEffect(() => {
    void listMyStores().then(setMyStores).catch(() => {})
  }, [storeId])

  useEffect(() => {
    if (user) {
      setProfileForm({ fullName: user.fullName || '', phone: user.phone || '' })
    }
  }, [user])

  useEffect(()=>{ if(!showProdModal) setProdForm(makeEmptyProduct(activeDomain)) }, [activeDomain.id])

  // Recalculate main stock when variants change
  useEffect(() => {
    if (prodForm.variants && prodForm.variants.length > 0) {
      const sum = prodForm.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0)
      if (sum > 0 && prodForm.stock !== sum) {
        setProdForm(f => ({ ...f, stock: sum }))
      }
    }
  }, [prodForm.variants])

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) } }, [toast])
  const showToast = (msg: string) => setToast(msg)

  function describeSaveError(err: any): string {
    const code = err?.body?.error || err?.message || 'UNKNOWN'
    switch (code) {
      case 'UNAUTHORIZED': return 'يجب تسجيل الدخول أولاً قبل حفظ الإعدادات'
      case 'FORBIDDEN — store not owned by user': return 'لا تملك صلاحية تعديل هذا المتجر'
      case 'NO_TENANT_CONTEXT': return 'لم يتم تحديد المتجر — افتح لوحة التحكم من رابط متجرك'
      case 'MONGODB_URI_NOT_CONFIGURED': return 'قاعدة البيانات غير مُهيّأة على الخادم'
      case 'Failed to fetch':
      case 'NETWORK_ERROR': return 'تعذّر الاتصال بالخادم — تحقق من الإنترنت'
      case 'HTTP_401': return 'انتهت الجلسة — سجّل الدخول مرة أخرى'
      case 'HTTP_403': return 'لا تملك صلاحية تعديل هذا المتجر'
      case 'CURRENT_PASSWORD_INCORRECT': return 'كلمة المرور الحالية غير صحيحة'
      case 'PASSWORD_TOO_SHORT': return 'كلمة المرور الجديدة قصيرة جداً (6 أحرف على الأقل)'
      case 'CURRENT_AND_NEW_PASSWORD_REQUIRED': return 'املأ كلمة المرور الحالية والجديدة'
      case 'EMAIL_CHANGE_NOT_SUPPORTED': return 'لا يمكن تغيير البريد الإلكتروني من هنا — تواصل مع الدعم'
      default: return `فشل الحفظ: ${code}`
    }
  }

  async function handleSaveProfile() {
    if (!profileForm.fullName.trim()) {
      showToast('الاسم الكامل مطلوب')
      return
    }
    setIsSavingProfile(true)
    try {
      await authUpdateProfile({
        fullName: profileForm.fullName.trim(),
        phone: profileForm.phone.trim(),
      })
      await refreshUser()
      showToast('تم حفظ بياناتك الشخصية ✓')
    } catch (err: any) {
      showToast(describeSaveError(err))
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handleChangePassword() {
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      showToast('املأ كلمة المرور الحالية والجديدة')
      return
    }
    if (pwForm.newPassword.length < 6) {
      showToast('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل')
      return
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      showToast('كلمة المرور الجديدة وتأكيدها غير متطابقين')
      return
    }
    setIsSavingPw(true)
    try {
      const res = await authChangePassword(pwForm.currentPassword, pwForm.newPassword)
      try { localStorage.setItem('amugar_token', res.token) } catch {}
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      await refreshUser()
      showToast('تم تغيير كلمة المرور ✓ — استخدمها في المرة القادمة')
    } catch (err: any) {
      showToast(describeSaveError(err))
    } finally {
      setIsSavingPw(false)
    }
  }

  function handleSwitchStore(store: TenantStore) {
    const url = new URL(window.location.href)
    url.searchParams.set('store', store.slug)
    url.searchParams.delete('storeId')
    window.history.replaceState(null, '', url.toString())
    try {
      localStorage.setItem('amugar_saas_active_slug', store.slug)
      localStorage.removeItem('amugar_saas_active_store')
    } catch {}
    window.location.reload()
  }

  function handleLogout() {
    logout()
    try {
      localStorage.removeItem('amugar_saas_active_slug')
      localStorage.removeItem('amugar_saas_active_store')
    } catch {}
    window.location.href = '/'
  }

  function ensureDeliveryProviders(s: any): any {
    let next = Array.isArray(s.deliveryProviders) ? [...s.deliveryProviders] : []
    const validIds = new Set(ALGERIAN_DELIVERY_PROVIDERS.map(p => p.id))
    next = next.filter((p: any) => validIds.has(p.id))
    for (const meta of ALGERIAN_DELIVERY_PROVIDERS) {
      if (!next.some((p: any) => p.id === meta.id)) {
        const credentials: Record<string, string> = Object.fromEntries(
          meta.credentialFields.map(f => [f.id, ''])
        )
        let enabled = false
        if (meta.id === 'yalidine' && (s as any).yalidineApiId) {
          credentials.apiId = (s as any).yalidineApiId || ''
          credentials.apiToken = (s as any).yalidineApiToken || ''
          enabled = !!(s as any).yalidineEnabled
        } else if (meta.id === 'zrexpress' && (s as any).zrExpressApiKey) {
          credentials.apiKey = (s as any).zrExpressApiKey || ''
          enabled = !!(s as any).zrExpressEnabled
        }
        next.push({ id: meta.id, enabled, credentials })
      }
    }
    return { ...s, deliveryProviders: next }
  }

  function setProviderEnabled(id: string, enabled: boolean) {
    setSettings(prev => {
      const next = ensureDeliveryProviders(prev)
      next.deliveryProviders = next.deliveryProviders.map((p: DeliveryProviderConfig) =>
        p.id === id ? { ...p, enabled } : p
      )
      return next
    })
  }

  function setProviderCredential(id: string, key: string, value: string) {
    setSettings(prev => {
      const next = ensureDeliveryProviders(prev)
      next.deliveryProviders = next.deliveryProviders.map((p: DeliveryProviderConfig) =>
        p.id === id
          ? { ...p, credentials: { ...p.credentials, [key]: value } }
          : p
      )
      return next
    })
  }

  const refreshAll = ()=>{
    setDomains([...getDomains()])
    setActiveDomainState(getActiveDomain())
    setSettings(getSettings())
    setStoreForm(getSettings())
    setProducts([...getProducts()])
  }

  const handleActivateDomain = async (id:string)=>{
    try {
      const d = await setActiveDomain(id)
      if(d){
        refreshAll()
        showToast(`تم التحويل إلى مجال ${d.nameAr} — المتجر تحدّث فوراً ✨`)
      } else {
        showToast('لم يتم العثور على المجال')
      }
    } catch (err: any) {
      const msg = err?.body?.error || err?.message || 'UNKNOWN'
      if (msg === 'UNAUTHORIZED') {
        showToast('يجب تسجيل الدخول أولاً لتفعيل المجال')
      } else if (msg === 'NOT_FOUND') {
        showToast('المجال غير موجود في قاعدة البيانات')
      } else if (msg === 'Failed to fetch' || msg === 'NETWORK_ERROR') {
        showToast('تعذّر الاتصال بالخادم — تأكد من اتصال الإنترنت')
      } else {
        showToast(`فشل تفعيل المجال: ${msg}`)
      }
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
    for(const a of domainForm.attributeSchema){ if(!a.key.trim() || !a.labelAr.trim()){ showToast('أكمل بيانات كل حقل مخصص'); return } }
    const aKeys = domainForm.attributeSchema.map((a:any)=> a.key.trim())
    if(new Set(aKeys).size !== aKeys.length){ showToast('مفاتيح الحقول يجب أن تكون فريدة'); return }

    try {
      if(editingDomain){
        await updateDomain(editingDomain.id, {...domainForm, name: domainForm.name.trim(), nameAr: domainForm.nameAr.trim()})
        showToast('تم تحديث المجال — إعدادات المنتج تحدثت تلقائياً')
      }else{
        await createCustomDomain({...domainForm, name: domainForm.name.trim(), nameAr: domainForm.nameAr.trim()} as any)
        showToast('تم إنشاء مجال جديد — يمكنك تفعيله الآن')
      }
      setShowDomainModal(false)
      refreshAll()
    } catch (err: any) {
      const msg = err?.body?.error || err?.message || 'UNKNOWN'
      if (msg === 'NOT_FOUND') {
        showToast('تعذّر حفظ المجال — حاول مرة أخرى')
      } else if (msg === 'UNAUTHORIZED') {
        showToast('يجب تسجيل الدخول أولاً')
      } else {
        showToast(`فشل حفظ المجال: ${msg}`)
      }
    }
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
    const a = document.createElement('a'); a.href = url; a.download = `amugar-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
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

  const openAddModal = () => {
    setEditingProd(null)
    const base = makeEmptyProduct(activeDomain)
    setProdForm({ ...base, sku: `LUM-${String(products.length + 1).padStart(3, '0')}`, images: [''] })
    setProdErrors({})
    setShowProdModal(true)
  }

  const handleScrapeProduct = async () => {
    if (!scrapeUrl.trim()) { showToast('أدخل رابط المنتج'); return }
    setScraping(true)
    try {
      const scraped = await scrapeProduct(scrapeUrl.trim())
      const base = makeEmptyProduct(activeDomain)
      setProdForm({
        ...base,
        sku: `LUM-${String(products.length + 1).padStart(3, '0')}`,
        name: scraped.name || 'Product',
        nameAr: scraped.name || '',
        descriptionAr: scraped.description || '',
        description: scraped.description || '',
        price: Math.round(scraped.price) || 0,
        images: scraped.images?.length ? scraped.images : [''],
      } as any)
      setProdErrors({})
      setShowScraper(false)
      setShowProdModal(true)
      setScrapeUrl('')
      showToast(`تم استيراد المنتج من ${scraped.platform} — راجع البيانات واحفظ`)
    } catch (err: any) {
      const msg = err?.body?.error || err?.message || 'UNKNOWN'
      if (msg === 'SCRAPE_FAILED') {
        showToast('تعذّر استيراد المنتج — تأكد من الرابط أو جرّب رابطاً آخر')
      } else if (msg === 'URL_REQUIRED') {
        showToast('أدخل رابط المنتج')
      } else {
        showToast(`فشل الاستيراد: ${msg}`)
      }
    } finally {
      setScraping(false)
    }
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
    if (!prodForm.price || Number(prodForm.price) <= 0) e.price = 'السعر مطلوب ويجب أن يكون أكبر من 0'
    if (!prodForm.category) e.category = 'الفئة مطلوبة'
    if (!prodForm.images.filter(Boolean).length) e.images = 'رابط صورة واحد على الأقل مطلوب'
    currentDomainForForm.attributeSchema.forEach(attr => {
      if (attr.required && !String((prodForm.attributes as any)?.[attr.key] || '').trim()) {
        e['attr_' + attr.key] = `${attr.labelAr} مطلوب`
      }
    })
    setProdErrors(e)
    const isValid = Object.keys(e).length === 0
    if (!isValid) {
      showToast('⚠️ يرجى ملء الخانات الإجبارية المحددة باللون الأحمر')
    }
    return isValid
  }

  const handleSaveProduct = async () => {
    if (!validateProd()) return
    setIsSubmitting(true)
    try {
      const cleanImages = prodForm.images.filter(Boolean)
      const cleanDescImages = ((prodForm as any).descriptionImages || []).filter(Boolean)
      const payload: any = { ...prodForm, images: cleanImages, descriptionImages: cleanDescImages, videoUrl: (prodForm as any).videoUrl || '', price: Number(prodForm.price), compareAtPrice: prodForm.compareAtPrice ? Number(prodForm.compareAtPrice) : undefined, stock: Number(prodForm.stock), rating: Number(prodForm.rating), reviewsCount: Number(prodForm.reviewsCount), attributes: prodForm.attributes || {}, variants: prodForm.variants || [] }
      if (!payload.domainId) payload.domainId = currentDomainForForm.id
      if (payload.isPublishedInMarketplace && !payload.marketplacePublishedAt) {
        payload.marketplacePublishedAt = new Date().toISOString()
      }
      if (editingProd) {
        const updated = await updateProduct(editingProd._id, payload)
        setProducts([...updated])
        showToast('تم تحديث المنتج بنجاح ✨')
      } else {
        await addProduct(payload as any)
        void syncProducts().then(() => {
          setProducts([...getProducts()])
        })
        showToast('تم نشر المنتج في المتجر بنجاح ✨')
      }
      setShowProdModal(false)
    } catch (err: any) {
      console.error('Save product error:', err)
      if (err.message === 'IMAGES_REQUIRED') {
        setProdErrors({ images: 'أضف رابط صورة صحيح' })
      }
      showToast('❌ حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('هل أنت متأكدة من حذف هذا المنتج نهائياً؟')) return
    const updated = await deleteProduct(id); setProducts([...updated]); showToast('تم حذف المنتج')
  }

  const addVariantRow = ()=>{
    const v: Variant = { id: 'var_'+Date.now().toString(36), stock: 10, priceAdjustment: 0 }
    if(currentDomainForForm?.variantConfig?.hasColor){
      const preset = currentDomainForForm.variantConfig.colorPresets?.[0]
      if(preset){ v.color = preset.name; v.colorAr = preset.nameAr; v.colorHex = preset.hex }
    }
    if(currentDomainForForm?.variantConfig?.hasSize){
      v.size = currentDomainForForm.variantConfig.sizeOptions?.[0] || 'M'
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

  type NavItem = { id: typeof tab; label: string; icon: any; count?: number }
  const navGroups: { title: string; items: NavItem[] }[] = [
    {
      title: 'الرئيسية',
      items: [
        { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
      ],
    },
    {
      title: 'إدارة المتجر',
      items: [
        { id: 'orders', label: 'الطلبات', icon: ShoppingBag, count: orders.length },
        { id: 'products', label: 'المنتجات', icon: Package, count: products.length },
        { id: 'domains', label: 'مجالات المتجر', icon: Wand2 },
        { id: 'wilayas', label: 'أسعار الشحن', icon: MapPinned, count: wilayas.length },
        { id: 'delivery', label: 'شركات التوصيل', icon: Truck },
        { id: 'store', label: 'إعدادات المتجر', icon: Store },
        { id: 'tracking', label: 'التتبع والإعلانات', icon: BarChart3 },
      ],
    },
    {
      title: 'السوق العام (Marketplace)',
      items: [
        { id: 'marketplace', label: 'نشر المنتجات', icon: Globe, count: products.filter(p => (p as any).isPublishedInMarketplace).length },
      ],
    },
    {
      title: 'النطاق والموقع',
      items: [
        { id: 'custom-domain', label: 'النطاق المخصص', icon: Globe },
      ],
    },
    {
      title: 'حساب التاجر',
      items: [
        { id: 'account-profile', label: 'الملف الشخصي', icon: User },
        { id: 'account-security', label: 'الأمان وكلمة المرور', icon: Lock },
        { id: 'account-stores', label: 'متاجري', icon: Building2, count: myStores.length },
        { id: 'account-billing', label: 'الفوترة والباقة', icon: CreditCard },
      ],
    },
  ]

  const currentStore: TenantStore | undefined = myStores.find(s => s.slug === currentSlug)
    || (myStores[0] as TenantStore | undefined)

  return (
    <div className="bg-[#FFFCF8] min-h-screen flex">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-[#1A1A1E] text-white px-4 py-2.5 rounded-full text-sm font-bold shadow-xl flex items-center gap-2 border border-white/10">
          <Check size={16} className="text-emerald-400" /> {toast}
        </div>
      )}

      {/* ═══ SIDEBAR ═════════════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-[#1A1A1E]/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed lg:sticky top-0 right-0 z-50 lg:z-0 h-screen lg:h-screen w-[280px] shrink-0 bg-[#1A1A1E] text-white flex flex-col overflow-hidden transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-[280px] lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/logo.webp" alt="Amugar" className="w-9 h-9 rounded-xl object-cover shadow-md" />
            <div>
              <div className="font-extrabold text-sm leading-tight">Amugar</div>
              <div className="text-[10px] text-white/50">لوحة تحكم التاجر</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden w-8 h-8 rounded-full bg-white/5 grid place-items-center hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        {/* Store switcher */}
        <div className="px-3 py-3 border-b border-white/10 shrink-0">
          <div className="text-[10px] text-white/40 tracking-widest mb-1.5 px-2">المتجر النشط</div>
          {currentStore ? (
            <button
              onClick={() => setTab('account-stores')}
              className="w-full bg-white/5 hover:bg-white/10 transition rounded-xl px-3 py-2.5 flex items-center gap-3 text-right border border-white/10"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#C9A96A]/30 to-[#A02A5B]/20 grid place-items-center shrink-0">
                <Store size={14} className="text-[#C9A96A]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{currentStore.nameAr || currentStore.name}</div>
                <div className="text-[10px] text-white/40 truncate dir-ltr text-left" dir="ltr">{currentStore.slug}.amugar.saas</div>
              </div>
              <ChevronDown size={14} className="text-white/40 shrink-0" />
            </button>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white/50">جاري التحميل…</div>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4">
          {navGroups.map(group => (
            <div key={group.title}>
              <div className="text-[10px] font-bold text-white/40 tracking-widest px-2 mb-1.5">{group.title}</div>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon
                  const active = tab === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setTab(item.id); setSidebarOpen(false) }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${active ? 'bg-gradient-to-l from-[#C9A96A]/20 to-transparent text-white border border-[#C9A96A]/30' : 'text-white/70 hover:bg-white/5 hover:text-white border border-transparent'}`}
                    >
                      <Icon size={16} className={active ? 'text-[#C9A96A]' : 'text-white/50'} />
                      <span className="flex-1 text-right font-medium">{item.label}</span>
                      {item.count !== undefined && item.count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-[#C9A96A] text-[#1A1A1E]' : 'bg-white/10 text-white/70'}`}>{item.count}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User profile bar */}
        <div className="border-t border-white/10 p-3 shrink-0">
          <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9A96A] to-[#A02A5B] grid place-items-center font-bold text-white shrink-0">
              {(user?.fullName || user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{user?.fullName || 'تاجر'}</div>
              <div className="text-[10px] text-white/40 truncate" dir="ltr">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-300 grid place-items-center transition shrink-0"
              title="تسجيل الخروج"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        <header className="sticky top-0 z-30 bg-[#FFFCF8]/95 backdrop-blur border-b border-[#EDE6D8] px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 rounded-xl bg-white border border-[#EDE6D8] grid place-items-center shrink-0">
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-extrabold text-[#1A1A1E] truncate">
                {navGroups.flatMap(g => g.items).find(i => i.id === tab)?.label || 'لوحة التحكم'}
              </h1>
              <p className="text-[11px] text-[#9A8A6B] hidden md:block">
                {currentStore?.nameAr || 'المتجر'} • {products.length} منتج • {orders.length} طلب
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={`/?store=${currentSlug}`} target="_blank" className="hidden md:flex bg-white border border-[#EDE6D8] px-3 py-2 rounded-full text-xs font-bold items-center gap-1.5 hover:shadow-md transition">
              <Eye size={14} /> عرض المتجر
            </a>
            {tab !== 'overview' && (
              <button onClick={() => setTab('overview')} className="bg-[#1A1A1E] text-white px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1.5">
                <LayoutDashboard size={14} /> نظرة عامة
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <div className="max-w-[1280px] mx-auto">

          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="bg-[#1A1A1E] rounded-[20px] p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#C9A96A]/10 rounded-full blur-2xl"/>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#A02A5B]/15 rounded-full blur-2xl"/>
                <div className="relative flex gap-4 items-center">
                  <div className="w-14 h-14 rounded-2xl bg-white grid place-items-center shrink-0 overflow-hidden border border-white/10">
                    {(() => {
                      const Ico = domainIcons[activeDomain.id] || Store
                      return <Ico size={22} className="text-[#1A1A1E]"/>
                    })()}
                  </div>
                  <div>
                    <div className="text-xs tracking-[0.2em] text-[#C9A96A] flex items-center gap-2">المجال النشط <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span></div>
                    <div className="font-extrabold text-lg leading-tight">{activeDomain.nameAr} <span className="font-normal text-white/60">— {activeDomain.name}</span></div>
                    <div className="text-xs text-white/60 line-clamp-1 max-w-[520px]">{activeDomain.descriptionAr} • {activeDomain.categories.length} فئات • {stats.inActiveDomain} منتج</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {activeDomain.categories.map(c => <span key={c.key} className="bg-white/10 border border-white/15 px-2 py-1 rounded-full text-[11px] font-bold">{c.labelAr}</span>)}
                    </div>
                  </div>
                </div>
                <div className="relative flex gap-2 shrink-0">
                  <a href={`/?store=${currentSlug}`} target="_blank" className="bg-white text-[#1A1A1E] px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-[#FFFCF8]"><Eye size={14}/> معاينة</a>
                  <button onClick={() => setTab('domains')} className="bg-[#C9A96A] text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-[#B8945A]"><Globe size={14}/> إدارة</button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4 relative overflow-hidden card-shadow">
                  <div className="absolute -top-6 -left-6 w-16 h-16 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }} />
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full grid place-items-center mb-2" style={{ background: 'color-mix(in srgb, var(--color-primary) 14%, white)', color: 'var(--color-primary)' }}><ShoppingBag size={14} /></div>
                    <div className="text-xs text-[#9A8A6B]">إجمالي الطلبات</div><div className="text-2xl font-extrabold text-[#1A1A1E] mt-0.5">{stats.count}</div>
                    <div className="text-[11px] text-emerald-600 flex items-center gap-1"><TrendingUp size={10} /> مباشر</div>
                  </div>
                </div>
                <div className="text-white rounded-2xl p-4 relative overflow-hidden card-shadow" style={{ background: 'var(--color-secondary)' }}>
                  <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-xl" style={{ background: 'color-mix(in srgb, var(--color-primary) 22%, transparent)' }} />
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full grid place-items-center mb-2" style={{ background: 'color-mix(in srgb, var(--color-primary) 22%, transparent)', color: 'var(--color-primary)' }}><Award size={14} /></div>
                    <div className="text-xs text-white/60">إيرادات متوقعة</div><div className="text-lg font-extrabold mt-0.5">{formatDZD(stats.totalRevenue)}</div>
                    <div className="text-[11px] text-[#C9A96A]">بدون الملغاة</div>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 card-shadow">
                  <div className="w-8 h-8 rounded-full grid place-items-center mb-2 bg-amber-100 text-amber-700"><Clock size={14} /></div>
                  <div className="text-xs text-amber-700">طلبات جديدة</div><div className="text-2xl font-extrabold text-amber-800 mt-0.5">{stats.newCount}</div>
                  <div className="text-[11px] text-amber-700">تحتاج تأكيد</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 card-shadow">
                  <div className="w-8 h-8 rounded-full grid place-items-center mb-2 bg-emerald-100 text-emerald-700"><CheckCircle size={14} /></div>
                  <div className="text-xs text-emerald-700">تم التسليم</div><div className="text-2xl font-extrabold text-emerald-800 mt-0.5">{stats.delivered}</div>
                  <div className="text-[11px] text-emerald-700">نجاح COD</div>
                </div>
                <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4 card-shadow">
                  <div className="w-8 h-8 rounded-full grid place-items-center mb-2" style={{ background: 'color-mix(in srgb, var(--color-primary) 14%, white)', color: 'var(--color-primary)' }}><Layers size={14} /></div>
                  <div className="text-xs text-[#9A8A6B]">المنتجات</div><div className="text-2xl font-extrabold text-[#1A1A1E] mt-0.5">{stats.totalProducts}</div>
                  <div className="text-[11px] text-[#9A8A6B]">{stats.featured} مميزة</div>
                </div>
                <div className={`rounded-2xl p-4 border card-shadow ${stats.lowStock > 0 ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-white border-[#EDE6D8]'}`}>
                  <div className={`w-8 h-8 rounded-full grid place-items-center mb-2 ${stats.lowStock > 0 ? 'bg-[#FCE7F0] text-[#A02A5B]' : 'bg-gray-100 text-gray-500'}`}><AlertCircle size={14} /></div>
                  <div className={`text-xs ${stats.lowStock > 0 ? 'text-[#A02A5B]' : 'text-[#9A8A6B]'}`}>مخزون منخفض</div><div className={`text-2xl font-extrabold mt-0.5 ${stats.lowStock > 0 ? 'text-[#A02A5B]' : 'text-[#1A1A1E]'}`}>{stats.lowStock}</div>
                  <div className="text-[11px] text-[#9A8A6B]">≤ 10 قطع</div>
                </div>
              </div>

              {storeId && <AnalyticsDashboard storeId={storeId} />}

              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                <h3 className="font-extrabold flex items-center gap-2"><Zap size={18} className="text-[#C9A96A]"/> إجراءات سريعة</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <button onClick={() => setTab('products')} className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl p-4 hover:shadow-md transition text-right">
                    <Package size={20} className="text-[#C9A96A] mb-2" />
                    <div className="font-bold text-sm">إضافة منتج</div>
                    <div className="text-[11px] text-[#9A8A6B]">نشر منتج جديد</div>
                  </button>
                  <button onClick={() => setTab('orders')} className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl p-4 hover:shadow-md transition text-right">
                    <ShoppingBag size={20} className="text-[#A02A5B] mb-2" />
                    <div className="font-bold text-sm">الطلبات الجديدة</div>
                    <div className="text-[11px] text-[#9A8A6B]">{stats.newCount} بانتظار التأكيد</div>
                  </button>
                  <button onClick={() => setTab('delivery')} className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl p-4 hover:shadow-md transition text-right">
                    <Truck size={20} className="text-[#8D6E3A] mb-2" />
                    <div className="font-bold text-sm">شركات التوصيل</div>
                    <div className="text-[11px] text-[#9A8A6B]">10 شركات جزائرية</div>
                  </button>
                  <button onClick={handleExport} className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl p-4 hover:shadow-md transition text-right">
                    <Download size={20} className="text-[#1A1A1E] mb-2" />
                    <div className="font-bold text-sm">تصدير CSV</div>
                    <div className="text-[11px] text-[#9A8A6B]">تصدير الطلبات</div>
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-l from-[#A02A5B] to-[#7A1F44] text-white rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="font-extrabold flex items-center gap-2"><Sparkles size={18} /> ادعُ تجار آخرين — وسوّق لمنصتك</h3>
                    <p className="text-xs text-white/70 mt-1">شارك رابطك مع تجار تعرفهم. كل تاجر ينضم = منتجات أكثر في السوق العام = زوار أكثر = مبيعات أكثر للجميع.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5">
                    <span className="text-xs text-white/60 shrink-0">رابطك:</span>
                    <input
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${currentSlug}`}
                      className="bg-transparent text-xs text-white font-mono outline-none w-full min-w-[200px]"
                      onClick={(e) => { (e.target as HTMLInputElement).select(); try { navigator.clipboard.writeText((e.target as HTMLInputElement).value); showToast('تم نسخ رابط الإحالة ✓') } catch {} }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DOMAINS TAB */}
          {tab === 'domains' && (
          <div className="mt-4 space-y-4">
            <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold flex items-center gap-2"><Wand2 size={16} className="text-[#C9A96A]"/> مجالات المتجر — أنشئ مجالك الخاص حسب تخصصك</h3>
                <p className="text-xs text-[#9A8A6B] mt-1">كل مجال يملك فئاته وحقوله الخاصة ومتغيرات الألوان/المقاسات. أنشئ مجالاً للإلكترونيات، الملابس، المنتجات الرقمية، أو أي تخصص تريده.</p>
              </div>
              <button onClick={openDomainCreate} className="bg-[#A02A5B] hover:bg-[#7A1F44] text-white px-5 py-2.5 rounded-full text-sm font-extrabold flex items-center gap-2 shadow shadow-[#A02A5B]/20 shrink-0"><Plus size={16}/> إنشاء مجال مخصص</button>
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
                        <a href={`/?store=${currentSlug}`} target="_blank" className="bg-white border border-[#EDE6D8] rounded-full py-1.5 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-[#1A1A1E] hover:text-white"><Eye size={11}/> معاينة</a>
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
                <span className="font-extrabold">كيف تعمل المجالات؟</span>
                <span className="text-[#7A6F5A]"> كل مجال يحدد فئات المنتجات، الحقول المخصصة، والمتغيرات. يمكنك إنشاء مجال للإلكترونيات أو الملابس أو المنتجات الرقمية. عند اختيار مجال في نموذج المنتج، تظهر حقوله تلقائياً.</span>
              </div>
            </div>
          </div>
        )}

          {/* CUSTOM DOMAIN TAB */}
          {tab === 'custom-domain' && (
            <div className="mt-4 space-y-4">
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                <h3 className="font-extrabold flex items-center gap-2"><Globe size={18} className="text-[#C9A96A]"/> النطاق المخصص (Custom Domain)</h3>
                <p className="text-xs text-[#9A8A6B] mt-1 leading-5">اربط نطاقك الخاص (مثل mystore.dz) بمتجرك مع شهادة SSL مجانية تلقائياً.</p>

                <div className="mt-4 grid md:grid-cols-[1fr_auto] gap-3 items-end">
                  <div>
                    <label className="text-xs font-bold text-[#7A6F5A]">عنوان النطاق</label>
                    <input
                      value={customDomainInput}
                      onChange={e => setCustomDomainInput(e.target.value)}
                      placeholder="mystore.dz"
                      dir="ltr"
                      className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A] font-mono"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      const domain = customDomainInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
                      if (!domain) { showToast('أدخل عنوان النطاق'); return }
                      const sid = (typeof window !== 'undefined'
                        ? (localStorage.getItem('amugar_saas_active_store') || new URLSearchParams(window.location.search).get('storeId'))
                        : null) || storeId || ''
                      if (!sid) { showToast('تعذّر تحديد معرّف المتجر — سجّل الدخول مجدّداً'); return }
                      try {
                        await updateStoreApi(sid, { customDomain: domain } as any)
                        setSettings(prev => ({ ...prev, storeName: prev.storeName }))
                        showToast(`تم ربط النطاق ${domain} ✓ — قد يستغرق تفعيل DNS من 5 دقائق إلى 24 ساعة`)
                      } catch (err: any) {
                        showToast('فشل ربط النطاق: ' + (err?.message || 'خطأ'))
                      }
                    }}
                    className="bg-[#1A1A1E] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-black transition flex items-center gap-2 shrink-0"
                  >
                    <Globe size={14} /> ربط النطاق
                  </button>
                </div>

                {settings.activeDomainId && (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-emerald-700 font-bold">النطاق الفرعي الحالي: {currentSlug}.amugar.saas</span>
                    <span className="text-[#9A8A6B]">— النطاق المخصص سيحل محله بعد تفعيل DNS</span>
                  </div>
                )}
              </div>

              <div className="bg-[#1A1A1E] text-white rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#C9A96A]/10 rounded-full blur-2xl" />
                <div className="relative">
                  <h4 className="font-bold flex items-center gap-2"><Layers size={16} className="text-[#C9A96A]"/> تعليمات إعداد DNS</h4>
                  <p className="text-xs text-white/60 mt-1">بعد ربط النطاق، أضف السجلات التالية في لوحة تحكم نطاقك (Namecheap / Hostinger):</p>

                  <div className="mt-4 grid md:grid-cols-2 gap-4">
                    <div className="bg-white/[0.06] border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-[#C9A96A] text-[#1A1A1E] text-[10px] font-extrabold px-2 py-0.5 rounded-full">A Record</span>
                        <span className="text-xs text-white/70">يوجه النطاق الجذري</span>
                      </div>
                      <div className="font-mono text-xs space-y-1 text-white/80">
                        <div>Type: <span className="text-[#C9A96A]">A</span></div>
                        <div>Name: <span className="text-[#C9A96A]">@</span></div>
                        <div>Value: <span className="text-[#C9A96A]">76.76.21.21</span></div>
                      </div>
                    </div>

                    <div className="bg-white/[0.06] border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-[#A02A5B] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">CNAME</span>
                        <span className="text-xs text-white/70">يوجه النطاق الفرعي (www)</span>
                      </div>
                      <div className="font-mono text-xs space-y-1 text-white/80">
                        <div>Type: <span className="text-[#A02A5B]">CNAME</span></div>
                        <div>Name: <span className="text-[#A02A5B]">www</span></div>
                        <div>Value: <span className="text-[#A02A5B]">cname.vercel-dns.com</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* PRODUCTS TAB */}
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
                <button onClick={openAddModal} className="bg-[#A02A5B] hover:bg-[#7A1F44] text-white px-5 py-2.5 rounded-full text-sm font-extrabold flex items-center gap-2 shadow-lg shadow-[#A02A5B]/20 transition">
                  <Plus size={16} /> إضافة منتج جديد
                </button>
                <button onClick={() => setShowScraper(true)} className="bg-gradient-to-l from-[#2563EB] to-[#1E40AF] hover:from-[#1E40AF] hover:to-[#1E3A8A] text-white px-5 py-2.5 rounded-full text-sm font-extrabold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                  المستورد السحري
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map(p => {
                const inActive = activeDomain.categories.some(c=> c.key===p.category)
                const hasVariants = !!(p.variants && p.variants.length)
                return (
                <div key={p._id} className={`bg-white border rounded-[20px] overflow-hidden group hover:shadow-[0_12px_36px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all duration-300 ${inActive ? 'border-[#EDE6D8]' : 'border-[#EDE6D8] opacity-90'}`}>
                  <div className="relative h-[200px] bg-[#FFF8EE] overflow-hidden">
                    <img src={p.images[0]} alt={p.nameAr} className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500" />
                    <div className="absolute top-3 right-3 flex gap-1.5 flex-wrap">
                      {p.isFeatured && <span className="bg-[#1A1A1E] text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><Crown size={10} className="text-[#C9A96A]" /> مميز</span>}
                      {p.isNew && <span className="bg-[#A02A5B] text-white text-[10px] font-bold px-2 py-1 rounded-full">جديد</span>}
                      {hasVariants && <span className="bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><PaletteIcon size={10}/> {p.variants!.length} متغير</span>}
                    </div>
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      <span className="bg-white/90 backdrop-blur text-[#1A1A1E] text-[10px] font-bold px-2 py-1 rounded-full border border-[#EDE6D8]">{p.sku}</span>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/50 to-transparent flex justify-between items-end">
                      <span className="text-white text-xs font-bold flex items-center gap-1"><Star size={12} fill="white" /> {p.rating} ({p.reviewsCount})</span>
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-white text-[#1A1A1E]">{p.category}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-extrabold text-[#1A1A1E] leading-tight line-clamp-1">{p.nameAr}</h3>
                    <p className="cormorant text-xs tracking-widest text-[#9A8A6B] truncate">{p.name}</p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="font-extrabold text-[#1A1A1E]">{formatDZD(p.price)}</span>
                      {p.compareAtPrice && <span className="text-xs line-through text-[#B0A48A]">{formatDZD(p.compareAtPrice)}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className={`px-2 py-1 rounded-full border font-bold ${p.stock > 20 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : p.stock > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'}`}>المخزون: {p.stock}</span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 mt-3">
                      <button onClick={() => openEditModal(p)} className="bg-[#1A1A1E] text-white rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-black"><Pencil size={12} /> تعديل</button>
                      <button onClick={async () => { const c = await duplicateProduct(p._id); if (c) { setProducts([...getProducts()]); showToast('تم نسخ المنتج') } }} className="bg-white border border-[#EDE6D8] rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1"><Copy size={12} /> نسخ</button>
                      <button onClick={() => handleDeleteProduct(p._id)} className="bg-white border border-red-200 text-red-600 rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-red-50"><Trash2 size={12} /> حذف</button>
                      <a href={`/product/${p._id}?store=${currentSlug}`} target="_blank" className="bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1"><Eye size={12} /> عرض</a>
                      <button
                        onClick={async () => {
                          const link = `${window.location.origin}/product/${p._id}?store=${currentSlug}`
                          try { await navigator.clipboard.writeText(link); showToast('تم نسخ رابط المنتج ✓') } catch {}
                        }}
                        className="bg-[#FFFBF0] border border-[#F0D9A8] text-[#8D6E3A] rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <Link2 size={12} /> رابط
                      </button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
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
                      <td className="p-3"><div className="font-bold">{o.customerName}</div><div className="text-xs text-[#9A8A6B]" dir="ltr">{o.phone}</div></td>
                      <td className="p-3"><span className="font-bold">{o.wilayaNameAr} ({o.wilaya})</span><div className="text-xs">{o.commune} • {o.deliveryType === 'home' ? 'منزل' : 'مكتب'}</div></td>
                      <td className="p-3"><div className="flex flex-col gap-1">{o.items.map(it => <span key={it.productId+(it.variantId||'')} className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-full px-2 py-0.5 text-xs inline-flex w-fit">{it.nameAr} ×{it.qty}</span>)}</div></td>
                      <td className="p-3 font-extrabold text-[#1A1A1E]">{formatDZD(o.total)}</td>
                      <td className="p-3"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusMap[o.status].color}`}>{statusMap[o.status].label}</span></td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          <select 
                            value={o.status} 
                            onChange={e => handleStatusChange(o.orderNumber || o._id, e.target.value as OrderStatus)} 
                            className="border border-[#EDE6D8] rounded-full px-2 py-1 text-xs font-bold bg-white"
                          >
                            <option value="new">جديد</option>
                            <option value="confirmed">مؤكد</option>
                            <option value="shipping">قيد الشحن</option>
                            <option value="delivered">تم التسليم</option>
                            <option value="cancelled">ملغي</option>
                          </select>
                          <button 
                            onClick={async () => { 
                              if (confirm('حذف الطلب؟')) { 
                                const n = await deleteOrder(o.orderNumber || o._id); 
                                setOrders([...n]); 
                                showToast('تم حذف الطلب') 
                              } 
                            }} 
                            className="w-7 h-7 rounded-full bg-red-50 text-red-600 grid place-items-center border border-red-200"
                          >
                            <Trash2 size={12} />
                          </button>
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

        {/* WILAYAS TAB */}
        {tab === 'wilayas' && (
          <div className="mt-4 space-y-4">
            <div className="bg-white border border-[#EDE6D8] rounded-2xl overflow-hidden">
              <div className="p-4 bg-[#FFFBF0] border-b border-[#EDE6D8] flex flex-wrap justify-between items-center gap-2">
                <h3 className="font-extrabold flex items-center gap-2"><MapPinned size={16} className="text-[#C9A96A]" /> إدارة أسعار الشحن — {wilayas.length} ولاية</h3>
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
                          <td className="p-3 font-bold">{w.nameAr}</td>
                          <td className="p-3"><input type="number" value={home} onChange={e => setEditingWilaya(prev => ({ ...prev, [w.code]: { ...prev[w.code], deliveryHome: parseInt(e.target.value) || 0 } }))} className="w-24 border border-[#EDE6D8] rounded-full px-2 py-1 text-sm outline-none" /></td>
                          <td className="p-3"><input type="number" value={desk} onChange={e => setEditingWilaya(prev => ({ ...prev, [w.code]: { ...prev[w.code], deliveryDesk: parseInt(e.target.value) || 0 } }))} className="w-24 border border-[#EDE6D8] rounded-full px-2 py-1 text-sm outline-none" /></td>
                          <td className="p-3 text-xs"><input value={edit?.deliveryDays ?? w.deliveryDays} onChange={e => setEditingWilaya(prev => ({ ...prev, [w.code]: { ...prev[w.code], deliveryDays: e.target.value } }))} className="w-24 border border-[#EDE6D8] rounded-full px-2 py-1 text-xs" /></td>
                          <td className="p-3"><button onClick={() => handleWilayaSave(w.code)} disabled={!edit} className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${edit ? 'bg-[#C9A96A] text-white hover:bg-[#B8945A]' : 'bg-[#EDE6D8] text-[#9A8A6B]'}`}><Save size={12} /> حفظ</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STORE SETTINGS TAB */}
        {tab === 'store' && (
          <div className="mt-4 grid lg:grid-cols-[1.05fr_0.95fr] gap-4">
            <div className="space-y-4">
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                <h3 className="font-extrabold flex items-center gap-2"><Store size={16} className="text-[#C9A96A]" /> هوية المتجر</h3>
                <div className="grid gap-3 mt-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div><label className="text-xs font-bold text-[#7A6F5A]">اسم المتجر FR</label><input value={storeForm.storeName} onChange={e => setStoreForm({ ...storeForm, storeName: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" /></div>
                    <div><label className="text-xs font-bold text-[#7A6F5A]">اسم المتجر عربي</label><input value={storeForm.storeNameAr} onChange={e => setStoreForm({ ...storeForm, storeNameAr: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none" /></div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div><label className="text-xs font-bold flex gap-1"><Phone size={12} className="text-[#C9A96A]" /> هاتف المتجر</label><input value={storeForm.phone} onChange={e => setStoreForm({ ...storeForm, phone: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" dir="ltr" /></div>
                    <div><label className="text-xs font-bold">واتساب</label><input value={storeForm.whatsapp} onChange={e => setStoreForm({ ...storeForm, whatsapp: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" dir="ltr" /></div>
                    <div><label className="text-xs font-bold flex gap-1"><Mail size={12} /> البريد</label><input value={storeForm.email} onChange={e => setStoreForm({ ...storeForm, email: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" dir="ltr" /></div>
                  </div>
                </div>
              </div>

              {/* WhatsApp Floating Button Settings */}
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                <h3 className="font-extrabold flex items-center gap-2 mb-1">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.149-.197.297-.767.967-.94 1.165-.173.198-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.892c0 2.09.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.581 0 11.94-5.359 11.943-11.893a11.821 11.821 0 00-3.489-8.453z"/></svg>
                  زر واتساب العائم
                </h3>
                <div className="mt-4">
                  <label className="text-xs font-bold text-[#7A6F5A]">رسالة الترحيب التلقائية</label>
                  <input
                    value={(storeForm as any).whatsappMessage || ''}
                    onChange={e => setStoreForm({ ...storeForm, whatsappMessage: e.target.value })}
                    className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm"
                    placeholder="مرحباً، أريد الاستفسار عن منتج"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#1A1A1E] text-white rounded-2xl p-5 relative overflow-hidden">
                <h3 className="font-extrabold flex items-center gap-2"><Settings size={16} className="text-[#C9A96A]" /> خيارات الدفع والتسليم</h3>
                <div className="grid gap-4 mt-4">
                  <label className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-3">
                    <span className="text-sm font-bold flex items-center gap-2"><Truck size={14} className="text-[#C9A96A]" /> تفعيل الدفع عند الاستلام (COD)</span>
                    <input type="checkbox" checked={storeForm.enableCod} onChange={e => setStoreForm({ ...storeForm, enableCod: e.target.checked })} className="w-11 h-6 accent-[#C9A96A]" />
                  </label>
                </div>
                <button onClick={async () => {
                  try {
                    await saveSettings(storeForm as any)
                    setSettings({ ...storeForm } as any)
                    showToast('تم حفظ إعدادات المتجر — ستظهر فوراً في الواجهة ✓')
                  } catch (err: any) {
                    showToast(describeSaveError(err))
                  }
                }} className="w-full mt-4 bg-[#C9A96A] hover:bg-[#B8945A] text-white rounded-full py-3 font-extrabold flex items-center justify-center gap-2"><Save size={16} /> حفظ كل إعدادات المتجر</button>
              </div>
            </div>
          </div>
        )}

        {/* TRACKING TAB */}
        {tab === 'tracking' && (
          <div className="mt-4 grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
              <h3 className="font-bold flex gap-2 items-center"><Settings size={16} className="text-[#C9A96A]" /> إعدادات التتبع (Meta & TikTok)</h3>
              <div className="grid gap-3 mt-4">
                <div><label className="text-xs font-bold">Meta Pixel ID</label><input value={settings.metaPixelId} onChange={e => setSettings({ ...settings, metaPixelId: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2 text-sm outline-none" /></div>
                <div><label className="text-xs font-bold">TikTok Pixel ID</label><input value={settings.tiktokPixelId} onChange={e => setSettings({ ...settings, tiktokPixelId: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2 text-sm outline-none" /></div>
                <button onClick={async () => {
                  try {
                    await saveSettings(settings)
                    showToast('تم حفظ إعدادات التتبع ✓')
                  } catch (err: any) {
                    showToast(describeSaveError(err))
                  }
                }} className="bg-[#1A1A1E] text-white rounded-full py-2.5 font-bold hover:bg-black transition">حفظ الإعدادات</button>
              </div>
            </div>
          </div>
        )}

        {/* DELIVERY TAB */}
        {tab === 'delivery' && (() => {
          const ensured = ensureDeliveryProviders(settings)
          const providers: DeliveryProviderConfig[] = ensured.deliveryProviders || []
          const enabledCount = providers.filter(p => p.enabled).length
          return (
            <div className="mt-4 space-y-4">
              <div className="bg-gradient-to-l from-[#1A1A1E] to-[#2A2A2E] text-white rounded-2xl p-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold flex items-center gap-2"><Truck size={18} className="text-[#C9A96A]" /> شركات التوصيل الجزائرية</h3>
                  <p className="text-xs text-white/70 mt-1">تفعّل الشركات التي تتعامل معها وأدخل مفاتيح API لكل واحدة.</p>
                </div>
                <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2 text-center shrink-0">
                  <div className="text-[10px] text-white/60">المُفعّلة</div>
                  <div className="text-2xl font-extrabold text-[#C9A96A]">{enabledCount}<span className="text-sm text-white/40">/{providers.length}</span></div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                {ALGERIAN_DELIVERY_PROVIDERS.map(meta => {
                  const cfg = providers.find(p => p.id === meta.id) || { id: meta.id, enabled: false, credentials: {} }
                  const on = !!cfg.enabled
                  return (
                    <div
                      key={meta.id}
                      className={`bg-white border rounded-2xl p-5 transition ${on ? 'shadow-lg' : 'border-[#EDE6D8]'}`}
                      style={on ? { borderColor: meta.accent, boxShadow: `0 10px 30px -12px ${meta.accent}33` } : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl grid place-items-center transition" style={{ background: on ? meta.accent : '#F5EFE6' }}>
                            <Truck size={20} style={{ color: on ? '#FFFFFF' : '#9A8A6B' }} />
                          </div>
                          <div>
                            <h3 className="font-bold text-[#1A1A1E] flex items-center gap-1.5">{meta.name}</h3>
                            <p className="text-[11px] text-[#9A8A6B]">{meta.nameAr} — {meta.coverage}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProviderEnabled(meta.id, !on)}
                          className="relative w-12 h-6 rounded-full transition shrink-0"
                          style={{ background: on ? meta.accent : '#EDE6D8' }}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-0.5' : 'left-6'}`} />
                        </button>
                      </div>

                      <div className={`grid gap-3 mt-4 transition ${on ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        {meta.credentialFields.map(field => (
                          <div key={field.id}>
                            <label className="text-xs font-bold text-[#7A6F5A]">{field.labelAr}</label>
                            <input
                              type={field.type === 'password' ? 'password' : 'text'}
                              value={cfg.credentials?.[field.id] || ''}
                              onChange={e => setProviderCredential(meta.id, field.id, e.target.value)}
                              placeholder={field.placeholder || ''}
                              dir="ltr"
                              className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-3 sticky bottom-4 shadow-lg">
                <button
                  onClick={async () => {
                    try {
                      const toSave = ensureDeliveryProviders(settings)
                      await saveSettings(toSave)
                      showToast(`تم حفظ إعدادات شركات التوصيل ✓ (${enabledCount} مُفعّلة)`)
                    } catch (err: any) {
                      showToast(describeSaveError(err))
                    }
                  }}
                  className="bg-[#1A1A1E] text-white px-8 py-3 rounded-full font-bold hover:bg-black transition flex items-center gap-2 shrink-0"
                >
                  <Save size={16} /> حفظ التغييرات
                </button>
              </div>
            </div>
          )
        })()}

        {/* MARKETPLACE TAB */}
        {tab === 'marketplace' && (
          <div className="mt-4 space-y-4">
            <div className="bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white rounded-2xl p-5 relative overflow-hidden">
              <div className="relative flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-extrabold flex items-center gap-2"><Globe size={18} className="text-[#C9A96A]" /> السوق العام Amugar Marketplace</h3>
                  <p className="text-xs text-white/70 mt-1">انشر منتجاتك في السوق العام ليصل إليها آلاف المشترين.</p>
                </div>
                <div className="flex gap-3">
                  <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2 text-center">
                    <div className="text-[10px] text-white/50">منشورة</div>
                    <div className="text-2xl font-extrabold text-[#C9A96A]">{products.filter(p => (p as any).isPublishedInMarketplace).length}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#EDE6D8] rounded-2xl overflow-hidden">
              <div className="divide-y divide-[#F5EFE6]">
                {products.map(p => {
                  const published = !!(p as any).isPublishedInMarketplace
                  return (
                    <div key={p._id} className="p-4 flex items-center gap-3 hover:bg-[#FFFCF8] transition">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#F5EFE6] shrink-0">
                        <SmartImage src={p.images[0] || ''} alt={p.nameAr} size="thumb" className="w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-[#1A1A1E] truncate">{p.nameAr}</div>
                        <div className="text-xs text-[#9A8A6B] mt-1">{formatDZD(p.price)}</div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const updated = await toggleMarketplacePublishApi(p._id)
                            setProducts([...updated])
                            showToast(published ? 'تم إخفاء المنتج من السوق' : 'تم نشر المنتج في السوق العام ✓')
                          } catch (err: any) {
                            showToast(describeSaveError(err))
                          }
                        }}
                        className={`relative w-12 h-6 rounded-full transition shrink-0 ${published ? 'bg-emerald-500' : 'bg-[#EDE6D8]'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${published ? 'left-0.5' : 'left-6'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ACCOUNT PROFILE TAB */}
        {tab === 'account-profile' && (
          <div className="mt-4 grid lg:grid-cols-[1fr_320px] gap-4">
            <div className="bg-white border border-[#EDE6D8] rounded-2xl p-6">
              <h3 className="font-extrabold flex items-center gap-2"><User size={18} className="text-[#C9A96A]"/> الملف الشخصي</h3>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#7A6F5A]">الاسم الكامل *</label>
                  <input
                    value={profileForm.fullName}
                    onChange={e => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#7A6F5A]">الهاتف</label>
                  <input
                    value={profileForm.phone}
                    onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                    dir="ltr"
                    className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="bg-[#1A1A1E] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-black transition"
                >
                  <Save size={16} /> حفظ التغييرات
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACCOUNT SECURITY TAB */}
        {tab === 'account-security' && (
          <div className="mt-4 grid lg:grid-cols-[1fr_320px] gap-4">
            <div className="bg-white border border-[#EDE6D8] rounded-2xl p-6">
              <h3 className="font-extrabold flex items-center gap-2"><KeyRound size={18} className="text-[#A02A5B]"/> تغيير كلمة المرور</h3>
              <div className="mt-5 space-y-4 max-w-md">
                <div>
                  <label className="text-xs font-bold text-[#7A6F5A]">كلمة المرور الحالية *</label>
                  <input
                    type="password"
                    value={pwForm.currentPassword}
                    onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                    className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#7A6F5A]">كلمة المرور الجديدة *</label>
                  <input
                    type="password"
                    value={pwForm.newPassword}
                    onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                    className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={isSavingPw}
                  className="bg-[#A02A5B] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2"
                >
                  <Lock size={16} /> تغيير كلمة المرور
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACCOUNT STORES TAB */}
        {tab === 'account-stores' && (
          <div className="mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              {myStores.map(s => (
                <div key={s._id} className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                  <div className="font-extrabold">{s.nameAr || s.name}</div>
                  <div className="text-[11px] text-[#9A8A6B]" dir="ltr">{s.slug}.amugar.saas</div>
                  <button onClick={() => handleSwitchStore(s)} className="mt-3 bg-[#1A1A1E] text-white px-4 py-2 rounded-full text-xs font-bold">
                    تبديل لهذا المتجر
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BILLING TAB */}
        {tab === 'account-billing' && (
          <div className="mt-4 space-y-4">
            <div className="bg-gradient-to-l from-[#C9A96A] to-[#B8945A] text-white rounded-2xl p-8 text-center">
              <div className="text-5xl font-extrabold mb-2">مجاني 100%</div>
              <div className="text-white/80 text-sm">بدون اشتراك وبدون عمولات على المبيعات</div>
            </div>
          </div>
        )}

          </div>
        </main>
      </div>

      {/* ═══ SCRAPER MODAL (المستورد السحري) ═════════════════════════════ */}
      {showScraper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !scraping && setShowScraper(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-[#EDE6D8] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-l from-[#2563EB] to-[#1E40AF] text-white p-5 relative overflow-hidden">
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 grid place-items-center">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg">المستورد السحري</h3>
                    <p className="text-xs text-white/70">استيراد منتج من أي متجر إلكتروني بضغطة واحدة</p>
                  </div>
                </div>
                <button onClick={() => setShowScraper(false)} className="w-8 h-8 rounded-full bg-white/15 grid place-items-center">
                  <X size={16} className="text-white"/>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#7A6F5A] mb-1.5 block">رابط المنتج</label>
                <div className="relative">
                  <input
                    value={scrapeUrl}
                    onChange={e => setScrapeUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !scraping) handleScrapeProduct() }}
                    placeholder="https://store.youcan.shop/products/..."
                    className="w-full border border-[#EDE6D8] rounded-xl px-3 py-3 pr-10 text-sm outline-none focus:border-[#2563EB]"
                    dir="ltr"
                    disabled={scraping}
                  />
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A8A6B]"/>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold text-[#9A8A6B] mb-2">المنصات الأكثر استقراراً:</div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] bg-[#95BF47]/10 text-[#95BF47] px-2.5 py-1 rounded-full font-bold border border-[#95BF47]/20">Shopify</span>
                  <span className="text-[10px] bg-[#1A1A1E]/10 text-[#1A1A1E] px-2.5 py-1 rounded-full font-bold border border-[#1A1A1E]/20">YouCan</span>
                  <span className="text-[10px] bg-[#7F54B3]/10 text-[#7F54B3] px-2.5 py-1 rounded-full font-bold border border-[#7F54B3]/20">WooCommerce</span>
                  <span className="text-[10px] bg-[#C9A96A]/10 text-[#8D6E3A] px-2.5 py-1 rounded-full font-bold border border-[#C9A96A]/20">متاجر الويب العامة</span>
                </div>
              </div>

              <button
                onClick={handleScrapeProduct}
                disabled={scraping || !scrapeUrl.trim()}
                className="w-full bg-gradient-to-l from-[#2563EB] to-[#1E40AF] text-white py-3.5 rounded-xl font-bold hover:from-[#1E40AF] hover:to-[#1E3A8A] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {scraping ? 'جاري جلب وتجهيز البيانات...' : 'استيراد المنتج فوراً'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOMAIN MODAL */}
      {showDomainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={()=> setShowDomainModal(false)} className="absolute inset-0 bg-[#1A1A1E]/60 backdrop-blur-sm"/>
          <div className="relative bg-[#FFFCF8] w-full max-w-[860px] max-h-[92vh] overflow-hidden rounded-[24px] shadow-2xl border border-[#EDE6D8] flex flex-col">
            <div className="sticky top-0 bg-white border-b border-[#EDE6D8] px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                {editingDomain ? `تعديل مجال ${editingDomain.nameAr}` : 'إنشاء مجال مخصص جديد'}
              </h3>
              <button onClick={()=> setShowDomainModal(false)} className="w-8 h-8 rounded-full bg-[#FFFCF8] border border-[#EDE6D8] grid place-items-center"><X size={16}/></button>
            </div>
            <div className="overflow-auto p-5 space-y-4 flex-1">
              <div className="grid md:grid-cols-2 gap-3">
                <div><label className="text-xs font-bold">اسم المجال FR *</label><input value={domainForm.name} onChange={e=> setDomainForm({...domainForm, name:e.target.value})} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" dir="ltr"/></div>
                <div><label className="text-xs font-bold">اسم المجال عربي *</label><input value={domainForm.nameAr} onChange={e=> setDomainForm({...domainForm, nameAr:e.target.value})} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white"/></div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-[#EDE6D8] p-4 flex gap-2">
              <button onClick={handleSaveDomain} className="flex-1 bg-[#1A1A1E] text-white rounded-full py-3 font-extrabold flex items-center justify-center gap-2">حفظ المجال</button>
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
                {editingProd ? 'تعديل المنتج' : 'إضافة منتج جديد'}
              </h3>
              <button onClick={() => setShowProdModal(false)} className="w-8 h-8 rounded-full bg-[#FFFCF8] border border-[#EDE6D8] grid place-items-center"><X size={16} /></button>
            </div>

            <div className="overflow-auto p-5 space-y-4 flex-1">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold">الاسم العربي *</label>
                  <input value={prodForm.nameAr} onChange={e => setProdForm({ ...prodForm, nameAr: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold">الاسم FR *</label>
                  <input value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" dir="ltr" />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold">السعر (د.ج) *</label>
                  <input type="number" value={prodForm.price || ''} onChange={e => setProdForm({ ...prodForm, price: parseInt(e.target.value) || 0 })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold">المخزون الإجمالي</label>
                  <input type="number" value={prodForm.stock} onChange={e => setProdForm({ ...prodForm, stock: parseInt(e.target.value) || 0 })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold">الفئة</label>
                  <select value={prodForm.category} onChange={e => setProdForm({ ...prodForm, category: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white">
                    {currentDomainForForm.categories.map(c => <option key={c.key} value={c.key}>{c.labelAr}</option>)}
                  </select>
                </div>
              </div>

              {/* VARIANTS */}
              <div className="bg-[#FDF2F6] border border-[#F6C0D4] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold flex items-center gap-1.5"><PaletteIcon size={14} className="text-[#A02A5B]" /> متغيرات المنتج (ألوان + مقاسات)</label>
                  <button onClick={addVariantRow} className="bg-white border border-[#F6C0D4] text-[#A02A5B] px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1"><Plus size={12}/> إضافة متغير</button>
                </div>
                <div className="grid gap-2 mt-3">
                  {(prodForm.variants || []).map((v, idx) => (
                    <div key={v.id} className="grid grid-cols-12 gap-1.5 items-center bg-white border border-[#F6C0D4] rounded-xl px-2 py-2">
                      <input value={v.colorAr || v.color || ''} onChange={e => updateVariant(idx, { colorAr: e.target.value, color: e.target.value })} placeholder="اللون" className="col-span-4 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs"/>
                      <input value={v.size || ''} onChange={e => updateVariant(idx, { size: e.target.value })} placeholder="المقاس" className="col-span-4 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs"/>
                      <input type="number" value={v.stock} onChange={e => updateVariant(idx, { stock: parseInt(e.target.value)||0 })} className="col-span-3 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs text-center" placeholder="المخزون"/>
                      <button onClick={() => removeVariant(idx)} className="col-span-1 text-red-600"><Trash2 size={12}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* IMAGES */}
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4">
                <label className="text-xs font-bold flex items-center gap-1.5"><ImageIcon size={14} className="text-[#C9A96A]" /> صور المنتج</label>
                <div className="grid gap-2 mt-3">
                  {prodForm.images.map((img, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input value={img} onChange={e => setProdForm(f => { const n = [...f.images]; n[idx] = e.target.value; return { ...f, images: n } })} placeholder="رابط الصورة" className="flex-1 border border-[#EDE6D8] rounded-xl px-3 py-2 text-xs" dir="ltr" />
                      <button onClick={() => setProdForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))} className="text-red-600"><Trash2 size={12} /></button>
                    </div>
                  ))}
                  <button onClick={() => setProdForm(f => ({ ...f, images: [...f.images, ''] }))} className="bg-white border border-[#EDE6D8] px-3 py-1.5 rounded-full text-xs font-bold w-fit">+ إضافة صورة</button>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#EDE6D8] p-4 flex gap-2">
              <button onClick={handleSaveProduct} disabled={isSubmitting} className="flex-1 bg-[#1A1A1E] text-white rounded-full py-3 font-extrabold flex items-center justify-center gap-2">
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ ونشر المنتج'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING WIZARD */}
      {onboarding && (
        <OnboardingWizard
          storeForm={storeForm}
          setStoreForm={setStoreForm}
          domains={domains}
          setActiveDomain={handleActivateDomain}
          onComplete={async () => {
            try {
              await saveSettings(storeForm as any)
              setSettings({ ...storeForm } as any)
              showToast('تم إعداد متجرك بنجاح! 🎉')
            } catch (err: any) {
              showToast(describeSaveError(err))
            }
            setOnboarding(false)
            try {
              const url = new URL(window.location.href)
              url.searchParams.delete('onboarding')
              window.history.replaceState(null, '', url.toString())
            } catch {}
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Onboarding Wizard
// ═══════════════════════════════════════════════════════════════════════════

const onboardingThemePresets = [
  { name: 'ذهبي كلاسيكي', colors: { primaryColor: '#C9A96A', secondaryColor: '#1A1A1E', bgColor: '#FFFCF8', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#A02A5B' } },
  { name: 'أزرق تقني', colors: { primaryColor: '#2563EB', secondaryColor: '#0F172A', bgColor: '#F8FAFC', cardBgColor: '#FFFFFF', textColor: '#1E293B', accentColor: '#7C3AED' } },
  { name: 'أخضر طبيعي', colors: { primaryColor: '#16A34A', secondaryColor: '#14532D', bgColor: '#F0FDF4', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#CA8A04' } },
  { name: 'وردي راقي', colors: { primaryColor: '#EC4899', secondaryColor: '#831843', bgColor: '#FDF2F8', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#9333EA' } },
]

function OnboardingWizard({
  storeForm, setStoreForm, onComplete, domains, setActiveDomain,
}: {
  storeForm: any
  setStoreForm: (updater: any) => void
  onComplete: () => void | Promise<void>
  domains: StoreDomain[]
  setActiveDomain: (id: string) => Promise<void>
}) {
  const [step, setStep] = useState(0)

  return (
    <div className="fixed inset-0 z-[200] bg-[#1A1A1E]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl border border-[#EDE6D8] overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE6D8]">
          <h3 className="font-extrabold text-lg text-[#1A1A1E]">إعداد المتجر ({step + 1}/3)</h3>
          <button onClick={onComplete} className="text-xs text-[#9A8A6B] hover:text-[#1A1A1E] transition">تخطّي</button>
        </div>

        <div className="p-6">
          {step === 0 && (
            <div>
              <p className="text-sm font-bold mb-4 text-[#1A1A1E]">ما نوع متجرك؟ اختر التخصص:</p>
              <div className="grid grid-cols-2 gap-3">
                {domains.map((d: any) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setStoreForm({ ...storeForm, activeDomainId: d.id })
                      void setActiveDomain(d.id)
                    }}
                    className={`p-4 rounded-2xl border-2 text-right transition ${storeForm.activeDomainId === d.id ? 'border-[#A02A5B] bg-[#FDF2F6]' : 'border-[#EDE6D8] hover:border-[#C9A96A]'}`}
                  >
                    <div className="font-bold text-sm text-[#1A1A1E]">{d.nameAr}</div>
                    <div className="text-[11px] text-[#9A8A6B] mt-0.5">{d.categories?.length || 0} فئات</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="w-full mt-4 bg-[#1A1A1E] text-white py-3 rounded-xl font-bold hover:bg-black transition">التالي ←</button>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-sm font-bold mb-4 text-[#1A1A1E]">معلومات المتجر:</p>
              <div className="space-y-3">
                <input value={storeForm.storeName || ''} onChange={e => setStoreForm({ ...storeForm, storeName: e.target.value })} placeholder="اسم المتجر" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none" />
                <input value={storeForm.storeNameAr || ''} onChange={e => setStoreForm({ ...storeForm, storeNameAr: e.target.value })} placeholder="الاسم بالعربية" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(0)} className="px-4 py-3 border border-[#EDE6D8] rounded-xl font-bold text-sm">← السابق</button>
                <button onClick={() => setStep(2)} className="flex-1 bg-[#1A1A1E] text-white py-3 rounded-xl font-bold">التالي ←</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm font-bold mb-4 text-[#1A1A1E]">اختر ألوان متجرك:</p>
              <div className="grid grid-cols-2 gap-3">
                {onboardingThemePresets.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => setStoreForm({ ...storeForm, ...preset.colors })}
                    className={`p-3 rounded-2xl border-2 text-right transition ${(storeForm as any).primaryColor === preset.colors.primaryColor ? 'border-[#A02A5B] bg-[#FDF2F6]' : 'border-[#EDE6D8]'}`}
                  >
                    <div className="font-bold text-xs text-[#1A1A1E]">{preset.name}</div>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(1)} className="px-4 py-3 border border-[#EDE6D8] rounded-xl font-bold text-sm">← السابق</button>
                <button onClick={onComplete} className="flex-1 bg-[#A02A5B] text-white py-3 rounded-xl font-bold">حفظ وبدء البيع 🚀</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Analytics Dashboard Component
// ═══════════════════════════════════════════════════════════════════════════

function AnalyticsDashboard({ storeId }: { storeId: string }) {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [timeline, setTimeline] = useState<AnalyticsTimelinePoint[]>([])
  const [sources, setSources] = useState<AnalyticsSource[]>([])
  const [topProducts, setTopProducts] = useState<AnalyticsTopProduct[]>([])
  const [devices, setDevices] = useState<AnalyticsDevice[]>([])
  const [countries, setCountries] = useState<AnalyticsCountry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    const load = async () => {
      const [ov, tl, src, tp, dev, ctry] = await Promise.all([
        fetchAnalyticsOverview(storeId),
        fetchAnalyticsTimeline(storeId, 7),
        fetchAnalyticsSources(storeId),
        fetchAnalyticsTopProducts(storeId),
        fetchAnalyticsDevices(storeId),
        fetchAnalyticsCountries(storeId),
      ])
      if (cancelled) return
      setOverview(ov)
      setTimeline(tl.timeline || [])
      setSources(src.sources || [])
      setTopProducts(tp.topProducts || [])
      setDevices(dev.devices || [])
      setCountries(ctry.countries || [])
      setLoading(false)
    }
    void load()
    const id = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(id) }
  }, [storeId])

  if (loading || !overview) return null

  const maxVisits = Math.max(...timeline.map(t => t.visits), 1)
  const todayDate = new Date().toISOString().slice(0, 10)
  const todayTimeline = timeline.find(t => t.date === todayDate)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <AnalyticsStatCard icon={<TrendingUp size={16} />} label="إجمالي الزيارات" value={overview.totalVisits} sub="منذ إنشاء المتجر" color="emerald" />
        <AnalyticsStatCard icon={<Eye size={16} />} label="زوار فريدون" value={overview.uniqueVisitors} sub={`${overview.conversionRate}% تحويل`} color="blue" />
        <AnalyticsStatCard icon={<TrendingUp size={16} />} label="هذا الأسبوع" value={overview.weekVisits} sub="آخر 7 أيام" color="amber" />
        <AnalyticsStatCard icon={<Eye size={16} />} label="مشاهدات المنتجات" value={overview.productViews} sub={`من ${overview.storeViews} زيارة متجر`} color="rose" />
        <AnalyticsStatCard icon={<Award size={16} />} label="معدل التحويل" value={`${overview.conversionRate}%`} sub={`${overview.orderCount} طلب`} color="purple" />
      </div>

      <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
        <h3 className="font-extrabold text-sm mb-4">الزيارات اليومية (آخر 7 أيام)</h3>
        <div className="flex items-end justify-between gap-2 h-32">
          {timeline.map((point, i) => {
            const height = Math.max(4, (point.visits / maxVisits) * 100)
            const dayName = new Date(point.date).toLocaleDateString('ar-DZ', { weekday: 'short' })
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full bg-[#C9A96A] rounded-t-lg transition-all" style={{ height: `${height}%` }} />
                <div className="text-[9px] text-[#9A8A6B]">{dayName}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AnalyticsStatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number | string; sub: string
  color: 'emerald' | 'blue' | 'amber' | 'rose' | 'purple'
}) {
  const colors = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700', valueColor: 'text-emerald-800' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-100', iconColor: 'text-blue-700', valueColor: 'text-blue-800' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconColor: 'text-amber-700', valueColor: 'text-amber-800' },
    rose: { bg: 'bg-[#FDF2F6]', border: 'border-[#F6C0D4]', iconBg: 'bg-[#FCE7F0]', iconColor: 'text-[#A02A5B]', valueColor: 'text-[#A02A5B]' },
    purple: { bg: 'bg-violet-50', border: 'border-violet-200', iconBg: 'bg-violet-100', iconColor: 'text-violet-700', valueColor: 'text-violet-800' },
  }
  const c = colors[color]
  return (
    <div className={`${c.bg} ${c.border} border rounded-2xl p-3`}>
      <div className={`w-7 h-7 rounded-full ${c.iconBg} ${c.iconColor} grid place-items-center mb-1.5`}>{icon}</div>
      <div className="text-[10px] text-[#9A8A6B] font-medium">{label}</div>
      <div className={`text-xl font-extrabold ${c.valueColor} mt-0.5`}>{value}</div>
      <div className="text-[9px] text-[#9A8A6B]">{sub}</div>
    </div>
  )
}

