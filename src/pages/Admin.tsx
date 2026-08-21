import { useEffect, useState, useMemo } from 'react'
import { getOrders, updateOrderStatus, deleteOrder, exportOrdersCsv } from '../services/api/orders'
import { getWilayas, updateWilayaRate, addWilaya } from '../services/api/wilayas'
import { getProducts, addProduct, updateProduct, deleteProduct, duplicateProduct, toggleProductFlag } from '../services/api/products'
import { getSettings, saveSettings } from '../services/api/settings'
import { updateStoreApi, authUpdateProfile, authChangePassword, listMyStores, toggleMarketplacePublishApi } from '../services/api/client'
import {
  fetchAnalyticsOverview, fetchAnalyticsTimeline, fetchAnalyticsSources, fetchAnalyticsTopProducts,
  fetchAnalyticsDevices, fetchAnalyticsCountries,
  type AnalyticsOverview, type AnalyticsTimelinePoint, type AnalyticsSource,
  type AnalyticsTopProduct, type AnalyticsDevice, type AnalyticsCountry,
} from '../services/api/client'
import { useTenant } from '../context/TenantContext'
import { getDomains, getActiveDomain, setActiveDomain, createCustomDomain, updateDomain, deleteDomain, duplicateDomain } from '../services/api/domains'
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
  // ─── Sidebar (mobile) + my stores list ──────────────────────────────
  // Sidebar slides in on mobile (drawer). On desktop it's always visible.
  // `myStores` is the list of TenantStores the merchant owns — fetched
  // from /api/stores so the sidebar store-switcher shows real data.
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [myStores, setMyStores] = useState<TenantStore[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  // ─── Onboarding wizard ─────────────────────────────────────────────
  // When a merchant registers, PlatformLanding redirects to /admin?onboarding=1.
  // We detect that here and show a 3-step wizard (niche → store info → theme)
  // so the merchant can configure the essentials before diving into the
  // full dashboard. The wizard calls `saveSettings` + `setActiveDomain`
  // as the merchant makes choices, then clears the URL flag.
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
  // إضافة حالة التحميل لمنع الفشل الصامت
  const [isSubmitting, setIsSubmitting] = useState(false)

  // domain modal
  const [showDomainModal, setShowDomainModal] = useState(false)
  const [editingDomain, setEditingDomain] = useState<StoreDomain | null>(null)
  const [domainForm, setDomainForm] = useState<any>({
    name: '', nameAr: '', descriptionAr: '', heroBadge: '', heroTitleAr: '', heroSubtitleAr: '', heroImage: '', footerDescriptionAr: '', categories: [{key:'general', label:'General', labelAr:'عام'}], attributeSchema: [], variantConfig: { hasColor:false, hasSize:false, sizeOptions:[], colorPresets:[] }, isPreset: false
  })

  const [storeForm, setStoreForm] = useState(() => getSettings())
  const [customDomainInput, setCustomDomainInput] = useState('')

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
    isPublishedInMarketplace: true,  // auto-publish to marketplace by default
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

  // ─── Account profile form state ─────────────────────────────────────
  // Used by the "account-profile" + "account-security" tabs.
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '' })
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPw, setIsSavingPw] = useState(false)

  useEffect(() => {
    setOrders(getOrders()); setWilayas(getWilayas()); setProducts(getProducts()); setSettings(getSettings()); setStoreForm(getSettings()); setDomains(getDomains()); setActiveDomainState(getActiveDomain())
  }, [tab])

  // ─── Mark this session as "admin" so visit tracking is skipped ──────
  // The storefront's trackVisit() checks this flag and skips logging
  // when the merchant is previewing their own store. This keeps the
  // analytics clean — only real customer visits are counted.
  useEffect(() => {
    try { sessionStorage.setItem('amugar_is_admin', '1') } catch {}
    return () => {
      try { sessionStorage.removeItem('amugar_is_admin') } catch {}
    }
  }, [])

  // Fetch the merchant's stores list (for sidebar store-switcher + the
  // "متاجري" tab). Runs once on mount + whenever storeId changes (e.g.
  // after creating a new store).
  useEffect(() => {
    void listMyStores().then(setMyStores).catch(() => {})
  }, [storeId])

  // Sync profileForm from the logged-in user whenever user changes.
  useEffect(() => {
    if (user) {
      setProfileForm({ fullName: user.fullName || '', phone: user.phone || '' })
    }
  }, [user])

  useEffect(()=>{ if(!showProdModal) setProdForm(makeEmptyProduct(activeDomain)) }, [activeDomain.id])

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) } }, [toast])
  const showToast = (msg: string) => setToast(msg)

  // ─── Settings save error helper ─────────────────────────────────────
  // Translates API error codes into Arabic messages so the merchant
  // knows WHY the save failed instead of staring at a generic "error".
  // The previous code silently swallowed errors on the store + tracking
  // tabs (no try/catch), which made merchants think "settings aren't
  // being saved" — they were, but they were also failing silently.
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

  // ─── Merchant account handlers ─────────────────────────────────────
  // These talk to /api/auth/me (PATCH) + /api/auth/change-password (POST).
  // They use the user/refreshUser/logout from TenantContext so the
  // session stays in sync after a profile update or password change.

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
      // Update the stored token (the old one is now invalid because the
      // password hash changed).
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

  /** Switch to a different store owned by the merchant. */
  function handleSwitchStore(store: TenantStore) {
    const url = new URL(window.location.href)
    url.searchParams.set('store', store.slug)
    url.searchParams.delete('storeId')
    window.history.replaceState(null, '', url.toString())
    try {
      localStorage.setItem('amugar_saas_active_slug', store.slug)
      localStorage.removeItem('amugar_saas_active_store')
    } catch {}
    // Reload so the whole app re-syncs data for the new tenant
    window.location.reload()
  }

  function handleLogout() {
    logout()
    // Clear cached active store + navigate to landing
    try {
      localStorage.removeItem('amugar_saas_active_slug')
      localStorage.removeItem('amugar_saas_active_store')
    } catch {}
    window.location.href = '/'
  }

  /**
   * Ensure the settings object has a full `deliveryProviders` array
   * matching the current registry. Old stores (created before the
   * array schema was introduced) may have only the legacy flat
   * yalidine/zrexpress fields — we backfill the array here so the
   * dashboard renders every provider card.
   */
  function ensureDeliveryProviders(s: any): any {
    let next = Array.isArray(s.deliveryProviders) ? [...s.deliveryProviders] : []
    // REMOVE providers that are no longer in the registry (old fabricated
    // IDs we deleted: 'guesto', 'trackz', 'colisex', 'ecosystem',
    // 'noestdelay', 'aldjia', 'hisseptik'). This keeps the dashboard
    // clean for stores that had the old (wrong) registry seeded.
    const validIds = new Set(ALGERIAN_DELIVERY_PROVIDERS.map(p => p.id))
    next = next.filter((p: any) => validIds.has(p.id))
    // Ensure every registered provider has an entry
    for (const meta of ALGERIAN_DELIVERY_PROVIDERS) {
      if (!next.some((p: any) => p.id === meta.id)) {
        // Migrate legacy fields on first sight
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

  /** Update a single provider's enabled flag. */
  function setProviderEnabled(id: string, enabled: boolean) {
    setSettings(prev => {
      const next = ensureDeliveryProviders(prev)
      next.deliveryProviders = next.deliveryProviders.map((p: DeliveryProviderConfig) =>
        p.id === id ? { ...p, enabled } : p
      )
      return next
    })
  }

  /** Update a single credential field on a single provider. */
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
    // validate attributeSchema keys
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
    if (!prodForm.price || Number(prodForm.price) <= 0) e.price = 'السعر مطلوب ويجب أن يكون أكبر من 0'
    if (!prodForm.category) e.category = 'الفئة مطلوبة'
    if (!prodForm.images.filter(Boolean).length) e.images = 'رابط صورة واحد على الأقل مطلوب'
    // فحص الحقول المخصصة للمجال
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
      const payload: any = { ...prodForm, images: cleanImages, price: Number(prodForm.price), compareAtPrice: prodForm.compareAtPrice ? Number(prodForm.compareAtPrice) : undefined, stock: Number(prodForm.stock), rating: Number(prodForm.rating), reviewsCount: Number(prodForm.reviewsCount), attributes: prodForm.attributes || {}, variants: prodForm.variants || [] }
      if (!payload.domainId) payload.domainId = currentDomainForForm.id
      // Ensure isPublishedInMarketplace is explicitly set (not undefined)
      // so the server stores it correctly. When creating a new product
      // with the "نشر في السوق العام" checkbox checked, also set
      // marketplacePublishedAt so it appears as a "new arrival".
      if (payload.isPublishedInMarketplace && !payload.marketplacePublishedAt) {
        payload.marketplacePublishedAt = new Date().toISOString()
      }
      if (editingProd) {
        const updated = await updateProduct(editingProd._id, payload)
        setProducts([...updated])
        showToast('تم تحديث المنتج بنجاح ✨')
      } else {
        await addProduct(payload as any)
        setProducts([...getProducts()])
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
    // Always try to pre-fill color + size from the domain's preset config,
    // but don't skip them if the domain doesn't have presets — the merchant
    // can still add variants manually for ANY product regardless of category.
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

  // ─── Sidebar nav config ─────────────────────────────────────────────
  // Categorized like Shopify / WooCommerce. Each item has an id (matches
  // the `tab` state), a label, an icon, and a group key for the section
  // heading. Counts are filled in dynamically where applicable.
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

  // The store currently being managed (from myStores; falls back to the
  // slug from URL — used by the sidebar store-switcher header).
  const currentStore: TenantStore | undefined = myStores.find(s => s.slug === currentSlug)
    || (myStores[0] as TenantStore | undefined)

  return (
    <div className="bg-[#FFFCF8] min-h-screen flex">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-[#1A1A1E] text-white px-4 py-2.5 rounded-full text-sm font-bold shadow-xl flex items-center gap-2 border border-white/10">
          <Check size={16} className="text-emerald-400" /> {toast}
        </div>
      )}

      {/* ═══ SIDEBAR (desktop persistent + mobile drawer) ════════════════ */}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-[#1A1A1E]/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed lg:sticky top-0 right-0 z-50 lg:z-0 h-screen lg:h-screen w-[280px] shrink-0 bg-[#1A1A1E] text-white flex flex-col overflow-hidden transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand + close (mobile) */}
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

        {/* Store switcher (top of sidebar) */}
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

        {/* Nav groups (scrollable).
            CRITICAL: `min-h-0` is required for the flex item to shrink
            below its content size, which is what makes `overflow-y-auto`
            actually show a scrollbar. Without `min-h-0`, flex items get
            `min-height: auto` by default and expand to fit all their
            content — the scrollbar never appears and the nav becomes
            unscrollable. This is a well-known flexbox gotcha. */}
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

        {/* User mini-card + logout (bottom of sidebar) */}
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
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
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

        {/* Tab content */}
        <main className="flex-1 p-4 md:p-6">
          <div className="max-w-[1280px] mx-auto">

          {/* ═══ OVERVIEW TAB ════════════════════════════════════════════ */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Hero card — active domain summary */}
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

              {/* Stats grid */}
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

              {/* ═══ Analytics — Visit Insights ═════════════════════════════ */}
              {storeId && <AnalyticsDashboard storeId={storeId} />}

              {/* Quick actions */}
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

              {/* Referral + Welcome banner */}
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

          {/* ═══ DOMAINS TAB ═════════════════════════════════════════════ */}
          {tab === 'domains' && (
          <div className="mt-4 space-y-4">
            {/* ─── Domains Management (full cards + create custom) ─────── */}
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

            {/* ─── How domain settings affect products ────────────────── */}
            <div className={`rounded-2xl p-4 border flex gap-3 items-start ${settings.enableRoseEdition ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-[#FFFBF0] border-[#F5E6C8]'}`}>
              <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${settings.enableRoseEdition ? 'bg-[#A02A5B] text-white' : 'bg-[#C9A96A] text-white'}`}><Wand2 size={16}/></div>
              <div className="text-sm leading-6">
                <span className="font-extrabold">كيف تعمل المجالات؟</span>
                <span className="text-[#7A6F5A]"> كل مجال يحدد فئات المنتجات، الحقول المخصصة (مثل القماش/الطلاء/الحجم)، ومتغيرات الألوان والمقاسات. يمكنك إنشاء مجال للإلكترونيات (مع حقول: الماركة، الضمان، المواصفات)، أو للمنتجات الرقمية (مع حقول: نوع الملف، الرخصة)، أو أي تخصص آخر. عند اختيار مجال في نموذج المنتج، تظهر حقوله تلقائياً.</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="bg-white border border-[#EDE6D8] px-3 py-1 rounded-full text-xs font-bold">مجوهرات: خامة + طلاء + حجر</span>
                  <span className="bg-[#A02A5B] text-white px-3 py-1 rounded-full text-xs font-bold">إلكترونيات: ماركة + ضمان + مواصفات</span>
                  <span className="bg-white border border-[#EDE6D8] px-3 py-1 rounded-full text-xs font-bold">ملابس: قماش + مقاس + لون + طول</span>
                  <span className="bg-white border border-[#EDE6D8] px-3 py-1 rounded-full text-xs font-bold">رقمي: نوع الملف + الرخصة</span>
                </div>
              </div>
            </div>
          </div>
        )}

          {/* ═══ CUSTOM DOMAIN TAB (مفصول عن مجالات المتجر) ════════════════
              هذا التبويب مخصص فقط لربط النطاق المخصص (mystore.dz) —
              لا علاقة له بمجالات المتجر (jewelry/fashion/beauty). */}
          {tab === 'custom-domain' && (
            <div className="mt-4 space-y-4">
              {/* ─── Custom Domain Section ─────────────────────────────── */}
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                <h3 className="font-extrabold flex items-center gap-2"><Globe size={18} className="text-[#C9A96A]"/> النطاق المخصص (Custom Domain)</h3>
                <p className="text-xs text-[#9A8A6B] mt-1 leading-5">اربط نطاقك الخاص (مثل mystore.dz) بمتجرك. سيحصل المتجر على عنوان مستقل مع شهادة SSL مجانية تلقائياً.</p>

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
                      // Try to get storeId from localStorage or URL. The
                      // TenantContext sets storeId to null when the user
                      // is browsing via ?store=<slug>, so the local `storeId`
                      // prop is often null here — fall back to the cached
                      // active store id (set on login) or the ?storeId= URL
                      // param before giving up.
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

              {/* ─── DNS Instructions ──────────────────────────────────── */}
              <div className="bg-[#1A1A1E] text-white rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#C9A96A]/10 rounded-full blur-2xl" />
                <div className="relative">
                  <h4 className="font-bold flex items-center gap-2"><Layers size={16} className="text-[#C9A96A]"/> تعليمات إعداد DNS</h4>
                  <p className="text-xs text-white/60 mt-1">بعد ربط النطاق، أضف السجلات التالية في لوحة تحكم نطاقك (Namecheap / GoDaddy / Hostinger):</p>

                  <div className="mt-4 grid md:grid-cols-2 gap-4">
                    {/* A Record */}
                    <div className="bg-white/[0.06] border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-[#C9A96A] text-[#1A1A1E] text-[10px] font-extrabold px-2 py-0.5 rounded-full">A Record</span>
                        <span className="text-xs text-white/70">يوجه النطاق الجذري (mystore.dz)</span>
                      </div>
                      <div className="font-mono text-xs space-y-1 text-white/80">
                        <div>Type: <span className="text-[#C9A96A]">A</span></div>
                        <div>Name: <span className="text-[#C9A96A]">@</span></div>
                        <div>Value: <span className="text-[#C9A96A]">76.76.21.21</span></div>
                      </div>
                      <p className="text-[10px] text-white/40 mt-2">عنوان IP الخاص بـ Vercel</p>
                    </div>

                    {/* CNAME Record */}
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
                      <p className="text-[10px] text-white/40 mt-2">سجل CNAME لـ Vercel</p>
                    </div>
                  </div>

                  <div className="mt-4 bg-white/[0.04] border border-white/10 rounded-xl p-3 text-xs text-white/60 leading-5">
                    <b className="text-[#C9A96A]">خطوات:</b>
                    <ol className="list-decimal list-inside mt-1 space-y-0.5">
                      <li>سجّل الدخول إلى لوحة تحكم نطاقك</li>
                      <li>ابحث عن قسم DNS / Zone Management</li>
                      <li>أضف سجلي A و CNAME كما هو موضح أعلاه</li>
                      <li>انتظر من 5 دقائق إلى 24 ساعة حتى ينتشر الـ DNS</li>
                      <li>سيتم تفعيل شهادة SSL تلقائياً بمجرد عمل النطاق</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* ─── Clarification box: distinguishes this from store domains ── */}
              <div className="bg-[#FFFBF0] border border-[#F5E6C8] rounded-2xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C9A96A] text-white grid place-items-center shrink-0">
                  <Globe size={16} />
                </div>
                <div className="text-xs leading-6 text-[#7A6F5A]">
                  <span className="font-bold text-[#8D6E3A]">الفرق بين "النطاق المخصص" و "مجالات المتجر":</span>
                  <ul className="mt-1.5 space-y-1 list-disc list-inside">
                    <li><b>النطاق المخصص</b> (هذه الصفحة): عنوان موقعك على الإنترنت مثل <span className="font-mono" dir="ltr">mystore.dz</span> — ما يكتبه الزبون في المتصفح.</li>
                    <li><b>مجالات المتجر</b> (تبويب منفصل): تخصص متجرك (مجوهرات، ملابس، إلكترونيات) — يحدد الفئات والحقول والمتغيرات.</li>
                  </ul>
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
                <div key={p._id} className={`bg-white border rounded-[20px] overflow-hidden group hover:shadow-[0_12px_36px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all duration-300 ${inActive ? 'border-[#EDE6D8]' : 'border-[#EDE6D8] opacity-90'}`}>
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

                    <div className="grid grid-cols-5 gap-1.5 mt-3">
                      <button onClick={() => openEditModal(p)} className="bg-[#1A1A1E] text-white rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-black"><Pencil size={12} /> تعديل</button>
                      <button onClick={async () => { const c = await duplicateProduct(p._id); if (c) { setProducts([...getProducts()]); showToast('تم نسخ المنتج') } }} className="bg-white border border-[#EDE6D8] rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#FFFCF8]"><Copy size={12} /> نسخ</button>
                      <button onClick={() => handleDeleteProduct(p._id)} className="bg-white border border-red-200 text-red-600 rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-red-50"><Trash2 size={12} /> حذف</button>
                      <a href={`/product/${p._id}?store=${currentSlug}`} target="_blank" className="bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#A02A5B] hover:text-white transition"><Eye size={12} /> عرض</a>
                      <button
                        onClick={async () => {
                          const link = `${window.location.origin}/product/${p._id}?store=${currentSlug}`
                          try { await navigator.clipboard.writeText(link); showToast('تم نسخ رابط المنتج ✓') } catch { showToast(link) }
                        }}
                        className="bg-[#FFFBF0] border border-[#F0D9A8] text-[#8D6E3A] rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#FFF3E0] transition"
                        title="نسخ رابط المنتج للمشاركة"
                      >
                        <Link2 size={12} /> رابط
                      </button>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={async () => { const u = await toggleProductFlag(p._id, 'isFeatured'); setProducts([...u]); showToast(p.isFeatured ? 'أزيلت من المميزة' : 'أضيفت للمميزة ⭐') }} className={`flex-1 rounded-full py-1.5 text-[11px] font-bold border flex items-center justify-center gap-1 ${p.isFeatured ? 'bg-[#1A1A1E] text-white border-[#1A1A1E]' : 'bg-white text-[#1A1A1E] border-[#EDE6D8] hover:bg-[#FFFCF8]'}`}><Crown size={11} /> {p.isFeatured ? 'مميز ✓' : 'تمييز'}</button>
                      <button onClick={async () => { const u = await toggleProductFlag(p._id, 'isNew'); setProducts([...u]); showToast(p.isNew ? 'أزيلت شارة جديد' : 'أضيفت شارة جديد') }} className={`flex-1 rounded-full py-1.5 text-[11px] font-bold border ${p.isNew ? 'bg-[#A02A5B] text-white border-[#A02A5B]' : 'bg-white text-[#1A1A1E] border-[#EDE6D8]'}`}><Sparkles size={11} className="inline -mt-0.5" /> {p.isNew ? 'جديد ✓' : 'جديد'}</button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
            {filteredProducts.length === 0 && products.length === 0 && (
              <div className="bg-gradient-to-br from-[#FFFBF0] to-[#FDF2F6] border-2 border-dashed border-[#C9A96A]/30 rounded-2xl p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#C9A96A] to-[#A02A5B] grid place-items-center mx-auto text-white shadow-lg">
                  <Plus size={28} />
                </div>
                <div className="font-extrabold text-xl mt-4 text-[#1A1A1E]">أهلاً بك في متجرك الجديد! 🎉</div>
                <p className="text-sm text-[#7A6F5A] mt-2 max-w-md mx-auto leading-6">
                  متجرك جاهز لكنه فارغ. ابدأ بإضافة منتجك الأول ليظهر في واجهة متجرك.
                  لا تقلق — كل ما تضيفه هنا سيكون منتجاتك أنت، بدون أي بيانات تجريبية.
                </p>
                <button onClick={openAddModal} className="mt-5 bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white px-7 py-3 rounded-full font-bold text-sm flex items-center gap-2 mx-auto hover:shadow-xl transition">
                  <Plus size={16} /> أضف منتجك الأول
                </button>
              </div>
            )}
            {filteredProducts.length === 0 && products.length > 0 && (
              <div className="bg-white border-2 border-dashed border-[#EDE6D8] rounded-2xl p-10 text-center">
                <div className="w-14 h-14 rounded-full bg-[#FDF2F6] border border-[#F6C0D4] grid place-items-center mx-auto text-[#A02A5B]"><Search size={20} /></div>
                <div className="font-bold mt-3">لا توجد منتجات مطابقة</div>
                <p className="text-sm text-[#9A8A6B]">جرب بحثاً آخر أو أضف منتجاً جديداً — المجال: {activeDomain.nameAr}</p>
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
                            className="w-7 h-7 rounded-full bg-red-50 text-red-600 grid place-items-center border border-red-200 hover:bg-red-500 hover:text-white transition"
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
                  <div><label className="text-xs font-bold flex gap-1"><Instagram size={12} className="text-[#A02A5B]" /> إنستغرام</label><input value={storeForm.instagram} onChange={e => setStoreForm({ ...storeForm, instagram: e.target.value })} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" placeholder="@amugar.dz" /></div>
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

              {/* ─── Theme Colors Editor (preset-only, no technical color pickers) ─── */}
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                <h3 className="font-extrabold flex items-center gap-2"><PaletteIcon size={16} className="text-[#A02A5B]" /> ثيم المتجر (اختر حزمة ألوان)</h3>
                <p className="text-xs text-[#9A8A6B] mt-1">اختر حزمة ألوان جاهزة لتتناسب مع علامتك التجارية. الألوان مختارة بعناية من قبل مصممين محترفين.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                  {[
                    { name: 'ذهبي كلاسيكي', desc: 'فاخر وأنيق', colors: { primaryColor: '#C9A96A', secondaryColor: '#1A1A1E', bgColor: '#FFFCF8', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#A02A5B' } },
                    { name: 'أزرق تقني', desc: 'عصري وثقة', colors: { primaryColor: '#2563EB', secondaryColor: '#0F172A', bgColor: '#F8FAFC', cardBgColor: '#FFFFFF', textColor: '#1E293B', accentColor: '#7C3AED' } },
                    { name: 'أخضر طبيعي', desc: 'حيوي وصحي', colors: { primaryColor: '#16A34A', secondaryColor: '#14532D', bgColor: '#F0FDF4', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#CA8A04' } },
                    { name: 'وردي راقي', desc: 'ناعم ومميز', colors: { primaryColor: '#EC4899', secondaryColor: '#831843', bgColor: '#FDF2F8', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#9333EA' } },
                    { name: 'برتقالي حيوي', desc: 'نشيط وجذاب', colors: { primaryColor: '#EA580C', secondaryColor: '#1C1917', bgColor: '#FFFBEB', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#DC2626' } },
                    { name: 'أسود مينيمال', desc: 'بسيط وحديث', colors: { primaryColor: '#525252', secondaryColor: '#171717', bgColor: '#FAFAFA', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#3B82F6' } },
                  ].map(preset => {
                    const isActive = (storeForm as any).primaryColor === preset.colors.primaryColor
                    return (
                      <button
                        key={preset.name}
                        onClick={() => setStoreForm({ ...storeForm, ...preset.colors } as any)}
                        className={`text-right rounded-2xl p-4 border-2 transition ${isActive ? 'border-[#A02A5B] shadow-lg' : 'border-[#EDE6D8] hover:border-[#C9A96A]'}`}
                      >
                        <div className="flex gap-1 mb-2">
                          <span className="w-8 h-8 rounded-lg" style={{background: preset.colors.primaryColor}}></span>
                          <span className="w-8 h-8 rounded-lg" style={{background: preset.colors.secondaryColor}}></span>
                          <span className="w-8 h-8 rounded-lg" style={{background: preset.colors.accentColor}}></span>
                          <span className="w-8 h-8 rounded-lg border border-[#EDE6D8]" style={{background: preset.colors.bgColor}}></span>
                        </div>
                        <div className="font-bold text-sm text-[#1A1A1E]">{preset.name}</div>
                        <div className="text-[11px] text-[#9A8A6B]">{preset.desc}</div>
                        {isActive && <div className="text-[10px] text-[#A02A5B] font-bold mt-1 flex items-center gap-1"><Check size={10}/> مُختار</div>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ─── Customizable Storefront Texts ──────────────────── */}
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                <h3 className="font-extrabold flex items-center gap-2"><FileText size={16} className="text-[#C9A96A]" /> نصوص الواجهة القابلة للتخصيص</h3>
                <p className="text-xs text-[#9A8A6B] mt-1">هذه النصوص تظهر في الصفحة الرئيسية لمتجرك — عدّلها لتناسب تخصصك (إلكترونيات، ملابس، رقمي...)</p>
                <div className="grid gap-3 mt-4">
                  <div><label className="text-xs font-bold">عنوان القسم التحريري</label><input value={storeForm.editorialTitle || ''} onChange={e => setStoreForm({ ...storeForm, editorialTitle: e.target.value } as any)} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" placeholder="جودة تلمس، أسعار تناسبك" /></div>
                  <div><label className="text-xs font-bold">ميزة 1</label><input value={storeForm.editorialText1 || ''} onChange={e => setStoreForm({ ...storeForm, editorialText1: e.target.value } as any)} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" placeholder="جودة عالية مع ضمان الاسترجاع" /></div>
                  <div><label className="text-xs font-bold">ميزة 2</label><input value={storeForm.editorialText2 || ''} onChange={e => setStoreForm({ ...storeForm, editorialText2: e.target.value } as any)} className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm" placeholder="خامات مختارة بعناية" /></div>
                  <div className="border-t border-[#EDE6D8] pt-3 mt-1">
                    <div className="text-xs font-bold text-[#7A6F5A] mb-2">آراء العملاء (تظهر في الرئيسية)</div>
                    <div className="grid gap-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <input value={storeForm.review1Name || ''} onChange={e => setStoreForm({ ...storeForm, review1Name: e.target.value } as any)} placeholder="الاسم" className="col-span-4 border border-[#EDE6D8] rounded-lg px-2 py-1.5 text-xs" />
                        <input value={storeForm.review1Text || ''} onChange={e => setStoreForm({ ...storeForm, review1Text: e.target.value } as any)} placeholder="نص الرأي" className="col-span-8 border border-[#EDE6D8] rounded-lg px-2 py-1.5 text-xs" />
                      </div>
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <input value={storeForm.review2Name || ''} onChange={e => setStoreForm({ ...storeForm, review2Name: e.target.value } as any)} placeholder="الاسم" className="col-span-4 border border-[#EDE6D8] rounded-lg px-2 py-1.5 text-xs" />
                        <input value={storeForm.review2Text || ''} onChange={e => setStoreForm({ ...storeForm, review2Text: e.target.value } as any)} placeholder="نص الرأي" className="col-span-8 border border-[#EDE6D8] rounded-lg px-2 py-1.5 text-xs" />
                      </div>
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <input value={storeForm.review3Name || ''} onChange={e => setStoreForm({ ...storeForm, review3Name: e.target.value } as any)} placeholder="الاسم" className="col-span-4 border border-[#EDE6D8] rounded-lg px-2 py-1.5 text-xs" />
                        <input value={storeForm.review3Text || ''} onChange={e => setStoreForm({ ...storeForm, review3Text: e.target.value } as any)} placeholder="نص الرأي" className="col-span-8 border border-[#EDE6D8] rounded-lg px-2 py-1.5 text-xs" />
                      </div>
                    </div>
                  </div>
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

              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
                <h4 className="font-bold flex items-center gap-2"><Eye size={14} className="text-[#C9A96A]" /> معاينة حية</h4>
                <div className="mt-3 space-y-2">
                  <div className="bg-[#1A1A1E] text-[#C9A96A] text-xs py-2 px-3 rounded-full text-center">{storeForm.announcement}</div>
                  <div className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-2xl p-4">
                    <div className="text-[10px] tracking-widest bg-white border border-[#EDE6D8] inline-flex px-2 py-1 rounded-full">{storeForm.heroBadge}</div>
                    <div className="font-extrabold text-lg mt-2">{storeForm.heroTitleAr}</div>
                    <div className="text-xs text-[#7A6F5A] mt-1 leading-5">{storeForm.heroSubtitleAr}</div>
                    <div className="mt-3 flex gap-2 text-xs"><span className="bg-[#1A1A1E] text-white px-3 py-1.5 rounded-full">تسوّق الآن</span><span className="border border-[#EDE6D8] px-3 py-1.5 rounded-full">الكولكشن</span></div>
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
                <button onClick={async () => {
                  try {
                    await saveSettings(settings)
                    showToast('تم حفظ إعدادات التتبع ✓')
                  } catch (err: any) {
                    showToast(describeSaveError(err))
                  }
                }} className="bg-[#1A1A1E] text-white rounded-full py-2.5 font-bold hover:bg-black transition">حفظ الإعدادات</button>
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
              <p className="text-xs text-white/60">آخر 100 حدث محفوظة في localStorage — amugar_pixel_logs</p>
              <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3 max-h-[320px] overflow-auto text-xs font-mono space-y-1">
                {(() => { try { const logs = JSON.parse(localStorage.getItem('amugar_pixel_logs') || '[]'); if (logs.length === 0) return <span className="text-white/40">لا توجد أحداث بعد — تصفحي المنتجات لإنشاء أحداث</span>; return logs.slice(0, 20).map((l: any, i: number) => <div key={i} className="border-b border-white/10 pb-1"><span className="text-[#C9A96A]">[{new Date(l.at).toLocaleTimeString()}]</span> {l.provider} • {l.event} {l.value ? `• ${l.value} DZD` : ''}</div>) } catch { return '—' } })()}
              </div>
              <button onClick={() => { localStorage.removeItem('amugar_pixel_logs'); showToast('تم مسح السجل') }} className="mt-3 w-full bg-white/10 border border-white/20 rounded-full py-2 text-xs font-bold hover:bg-white hover:text-[#1A1A1E] transition">مسح السجل</button>
            </div>
          </div>
        )}

        {/* ─── DELIVERY INTEGRATIONS TAB ───────────────────────────────────
            Renders one card per Algerian delivery company from the
            ALGERIAN_DELIVERY_PROVIDERS registry. Adding a new provider
            is a one-line change in src/services/api/deliveryProviders.ts
            — the card UI, schema, seed, and migration all pick it up
            automatically.

            Each card has:
              - Brand-colored toggle (on/off)
              - Dynamic credential inputs driven by `credentialFields`
              - Link to the provider's developer portal
              - Status indicator (enabled/disabled)

            The bottom save bar calls `saveSettings()` with the full
            settings object — the server stores `deliveryProviders` as
            a flexible Mixed array. */}
        {tab === 'delivery' && (() => {
          const ensured = ensureDeliveryProviders(settings)
          const providers: DeliveryProviderConfig[] = ensured.deliveryProviders || []
          const enabledCount = providers.filter(p => p.enabled).length
          return (
            <div className="mt-4 space-y-4">
              {/* Summary header */}
              <div className="bg-gradient-to-l from-[#1A1A1E] to-[#2A2A2E] text-white rounded-2xl p-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold flex items-center gap-2"><Truck size={18} className="text-[#C9A96A]" /> شركات التوصيل الجزائرية</h3>
                  <p className="text-xs text-white/70 mt-1">تفعّل الشركات التي تتعامل معها وأدخل مفاتيح API لكل واحدة. البوالص ستُنشأ تلقائياً عند تأكيد الطلب.</p>
                </div>
                <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2 text-center shrink-0">
                  <div className="text-[10px] text-white/60">المُفعّلة</div>
                  <div className="text-2xl font-extrabold text-[#C9A96A]">{enabledCount}<span className="text-sm text-white/40">/{providers.length}</span></div>
                </div>
              </div>

              {/* Cards grid */}
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
                      {/* Header: icon + name + toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-xl grid place-items-center transition"
                            style={{ background: on ? meta.accent : '#F5EFE6' }}
                          >
                            <Truck size={20} style={{ color: on ? '#FFFFFF' : '#9A8A6B' }} />
                          </div>
                          <div>
                            <h3 className="font-bold text-[#1A1A1E] flex items-center gap-1.5">
                              {meta.name}
                              <a href={meta.portal || meta.website} target="_blank" rel="noreferrer" className="text-[#9A8A6B] hover:text-[#1A1A1E] transition" title="فتح موقع الشركة">
                                <ExternalLink size={12} />
                              </a>
                            </h3>
                            <p className="text-[11px] text-[#9A8A6B]">{meta.nameAr} — {meta.coverage}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProviderEnabled(meta.id, !on)}
                          className="relative w-12 h-6 rounded-full transition shrink-0"
                          style={{ background: on ? meta.accent : '#EDE6D8' }}
                          aria-label={`تفعيل ${meta.nameAr}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-0.5' : 'left-6'}`} />
                        </button>
                      </div>

                      {/* Credential inputs (driven by registry) */}
                      <div className={`grid gap-3 mt-4 transition ${on ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        {meta.credentialFields.map(field => (
                          <div key={field.id}>
                            <label className="text-xs font-bold text-[#7A6F5A] flex items-center gap-1">
                              <span
                                className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                                style={{ background: '#1A1A1E', color: meta.accent }}
                              >{field.label}</span>
                              {field.labelAr}
                            </label>
                            <input
                              type={field.type === 'password' ? 'password' : 'text'}
                              value={cfg.credentials?.[field.id] || ''}
                              onChange={e => setProviderCredential(meta.id, field.id, e.target.value)}
                              placeholder={field.placeholder || ''}
                              dir="ltr"
                              className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none font-mono"
                              style={{ outlineColor: meta.accent }}
                            />
                            {field.hint && (
                              <p className="text-[10px] text-[#9A8A6B] mt-1">{field.hint}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Description blurb + status indicator */}
                      <div
                        className="mt-3 rounded-xl p-3 text-[11px] leading-5"
                        style={{
                          background: `${meta.accent}0D`,
                          borderColor: `${meta.accent}33`,
                          border: '1px solid',
                          color: '#1A1A1E',
                        }}
                      >
                        {meta.description}
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-[11px]">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: on ? '#10B981' : '#EDE6D8' }}
                        />
                        <span className={on ? 'text-emerald-700 font-bold' : 'text-[#9A8A6B]'}>
                          {on ? 'مُفعّل — البوالص ستُنشأ تلقائياً' : 'معطّل'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Save bar */}
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-3 sticky bottom-4 shadow-lg">
                <div>
                  <h4 className="font-bold text-[#1A1A1E]">حفظ إعدادات شركات التوصيل</h4>
                  <p className="text-xs text-[#9A8A6B] mt-1">سيتم حفظ المفاتيح بشكل آمن في قاعدة البيانات. يمكنك تفعيل/تعطيل أي شركة في أي وقت.</p>
                </div>
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

          {/* ═══ MARKETPLACE TAB (نشر المنتجات في السوق العام) ═══════════════
              This is the merchant's marketplace publishing dashboard.
              They can toggle which of their products appear in the public
              Amugar Marketplace (browseable at /marketplace).

              Features:
              - Bulk publish/unpublish toggle
              - Per-product toggle switch
              - Stats: total products, published count, total views
              - Link to view the marketplace page
              - Link to view the merchant's own marketplace store page */}
          {tab === 'marketplace' && (
            <div className="mt-4 space-y-4">
              {/* Header with stats */}
              <div className="bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#C9A96A]/15 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#A02A5B]/15 rounded-full blur-3xl" />
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="font-extrabold flex items-center gap-2"><Globe size={18} className="text-[#C9A96A]" /> السوق العام Amugar Marketplace</h3>
                    <p className="text-xs text-white/70 mt-1">انشر منتجاتك في السوق العام ليصل إليها آلاف الزبائن. كل منتج منشور يظهر في <a href="/marketplace" target="_blank" className="text-[#C9A96A] underline font-bold">/marketplace</a></p>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2 text-center">
                      <div className="text-[10px] text-white/50">منشورة</div>
                      <div className="text-2xl font-extrabold text-[#C9A96A]">{products.filter(p => (p as any).isPublishedInMarketplace).length}</div>
                    </div>
                    <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2 text-center">
                      <div className="text-[10px] text-white/50">إجمالي المنتجات</div>
                      <div className="text-2xl font-extrabold">{products.length}</div>
                    </div>
                    <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2 text-center">
                      <div className="text-[10px] text-white/50">مشاهدات</div>
                      <div className="text-2xl font-extrabold text-[#A02A5B]">{products.reduce((sum, p) => sum + ((p as any).marketplaceViews || 0), 0)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="bg-[#FFFBF0] border border-[#F5E6C8] rounded-2xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C9A96A] text-white grid place-items-center shrink-0">
                  <Globe size={16} />
                </div>
                <div className="text-xs leading-6 text-[#7A6F5A]">
                  <span className="font-bold text-[#8D6E3A]">كيف يعمل السوق العام؟</span>
                  <ul className="mt-1.5 space-y-1 list-disc list-inside">
                    <li>فعّل زر "نشر" بجانب أي منتج ليظهر في صفحة <a href="/marketplace" target="_blank" className="text-[#A02A5B] underline font-bold">/marketplace</a></li>
                    <li>الزبائن يتصفحون منتجاتك ويشترون مباشرة — الطلب يصلك في لوحة التحكم</li>
                    <li>بدون عمولة في البداية — مجاني تماماً لجذب التجار</li>
                    <li>يمكنك إلغاء النشر في أي وقت — المنتج يختفي فوراً من السوق</li>
                  </ul>
                </div>
              </div>

              {/* Products list with publish toggles */}
              {products.length === 0 ? (
                <div className="bg-gradient-to-br from-[#FFFBF0] to-[#FDF2F6] border-2 border-dashed border-[#C9A96A]/30 rounded-2xl p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#C9A96A] to-[#A02A5B] grid place-items-center mx-auto text-white shadow-lg">
                    <Package size={28} />
                  </div>
                  <div className="font-extrabold text-xl mt-4 text-[#1A1A1E]">لا توجد منتجات بعد</div>
                  <p className="text-sm text-[#7A6F5A] mt-2 max-w-md mx-auto leading-6">
                    أضف منتجات أولاً من تبويب "المنتجات"، ثم عُد هنا لنشرها في السوق العام.
                  </p>
                  <button onClick={() => setTab('products')} className="mt-5 bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white px-7 py-3 rounded-full font-bold text-sm flex items-center gap-2 mx-auto hover:shadow-xl transition">
                    <Plus size={16} /> إضافة منتجات
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-[#EDE6D8] rounded-2xl overflow-hidden">
                  {/* Bulk actions header */}
                  <div className="bg-[#FFFCF8] border-b border-[#EDE6D8] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-bold text-[#1A1A1E]">منتجاتك ({products.length})</div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          // Publish ALL products
                          for (const p of products) {
                            if (!(p as any).isPublishedInMarketplace) {
                              try {
                                const updated = await toggleMarketplacePublishApi(p._id)
                                setProducts([...updated])
                              } catch (err: any) {
                                showToast(describeSaveError(err))
                                return
                              }
                            }
                          }
                          showToast('تم نشر كل المنتجات في السوق العام ✓')
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Check size={14} /> نشر الكل
                      </button>
                      <button
                        onClick={async () => {
                          // Unpublish ALL products
                          for (const p of products) {
                            if ((p as any).isPublishedInMarketplace) {
                              try {
                                const updated = await toggleMarketplacePublishApi(p._id)
                                setProducts([...updated])
                              } catch (err: any) {
                                showToast(describeSaveError(err))
                                return
                              }
                            }
                          }
                          showToast('تم إخفاء كل المنتجات من السوق العام')
                        }}
                        className="bg-white border border-[#EDE6D8] text-[#9A8A6B] hover:bg-[#FFFCF8] px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <X size={14} /> إخفاء الكل
                      </button>
                    </div>
                  </div>

                  {/* Product rows with toggle switches */}
                  <div className="divide-y divide-[#F5EFE6]">
                    {products.map(p => {
                      const published = !!(p as any).isPublishedInMarketplace
                      const views = (p as any).marketplaceViews || 0
                      const discount = p.compareAtPrice ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0
                      return (
                        <div key={p._id} className="p-4 flex items-center gap-3 hover:bg-[#FFFCF8] transition">
                          {/* Product image */}
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#F5EFE6] shrink-0">
                            <SmartImage src={p.images[0] || ''} alt={p.nameAr} size="thumb" className="w-full h-full" />
                          </div>
                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-[#1A1A1E] truncate">{p.nameAr}</div>
                            <div className="flex items-center gap-2 text-xs text-[#9A8A6B] mt-1">
                              <span className="font-mono">{p.sku}</span>
                              <span>•</span>
                              <span className="font-bold text-[#1A1A1E]">{formatDZD(p.price)}</span>
                              {discount > 0 && <span className="bg-[#FDF2F6] text-[#A02A5B] px-1.5 py-0.5 rounded-full font-bold">-{discount}%</span>}
                              {published && views > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-[#8D6E3A]">{views} مشاهدة</span>
                                </>
                              )}
                            </div>
                          </div>
                          {/* Published status badge */}
                          {published ? (
                            <span className="bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> منشور
                            </span>
                          ) : (
                            <span className="bg-[#F5EFE6] text-[#9A8A6B] text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0">غير منشور</span>
                          )}
                          {/* Toggle switch */}
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
                            aria-label={published ? 'إخفاء من السوق' : 'نشر في السوق'}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${published ? 'left-0.5' : 'left-6'}`} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Link to marketplace */}
              <a href="/marketplace" target="_blank" className="block bg-gradient-to-l from-[#A02A5B] to-[#7A1F44] text-white rounded-2xl p-5 hover:shadow-xl transition">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold flex items-center gap-2"><Globe size={18} /> مشاهدة السوق العام</div>
                    <p className="text-xs text-white/70 mt-1">تصفّح كيف تظهر منتجاتك للزبائن في صفحة Marketplace</p>
                  </div>
                  <Eye size={24} className="shrink-0" />
                </div>
              </a>
            </div>
          )}

          {/* ═══ ACCOUNT PROFILE TAB ════════════════════════════════════ */}
          {tab === 'account-profile' && (
            <div className="mt-4 grid lg:grid-cols-[1fr_320px] gap-4">
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-6">
                <h3 className="font-extrabold flex items-center gap-2"><User size={18} className="text-[#C9A96A]"/> الملف الشخصي</h3>
                <p className="text-xs text-[#9A8A6B] mt-1">هذه المعلومات تخصّك أنت (التاجر)، وليست ظاهرة في متجرك.</p>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#7A6F5A]">الاسم الكامل *</label>
                    <input
                      value={profileForm.fullName}
                      onChange={e => setProfileForm({ ...profileForm, fullName: e.target.value })}
                      placeholder="محمد أمين"
                      className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#7A6F5A] flex items-center gap-1.5">
                      <Mail size={12} /> البريد الإلكتروني (للتسجيل دخول)
                    </label>
                    <input
                      value={user?.email || ''}
                      disabled
                      className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-[#FFFCF8] text-[#9A8A6B] cursor-not-allowed"
                      dir="ltr"
                    />
                    <p className="text-[10px] text-[#9A8A6B] mt-1">لا يمكن تغيير البريد الإلكتروني — تواصل مع الدعم إذا احتجت ذلك.</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#7A6F5A] flex items-center gap-1.5">
                      <Phone size={12} /> الهاتف
                    </label>
                    <input
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="0550 12 34 56"
                      dir="ltr"
                      className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]"
                    />
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="bg-[#1A1A1E] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-black transition disabled:opacity-50"
                  >
                    {isSavingProfile ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSavingProfile ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </button>
                </div>
              </div>

              <div className="bg-[#1A1A1E] text-white rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#C9A96A]/10 rounded-full blur-2xl" />
                <div className="relative">
                  <h4 className="font-bold flex items-center gap-2"><Crown size={16} className="text-[#C9A96A]"/> معلومات الحساب</h4>
                  <div className="mt-4 space-y-3 text-xs">
                    <div className="flex justify-between"><span className="text-white/50">الاسم:</span><span className="font-bold">{user?.fullName || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">البريد:</span><span className="font-bold truncate max-w-[180px]" dir="ltr">{user?.email || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">الدور:</span><span className="font-bold">{user?.role === 'super_admin' ? 'مدير عام' : 'تاجر'}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">عدد المتاجر:</span><span className="font-bold">{myStores.length}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">أُنشئ في:</span><span className="font-bold">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-DZ') : '—'}</span></div>
                  </div>
                  <div className="mt-5 bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="text-[10px] text-white/50 mb-1">الإجراءات السريعة</div>
                    <button onClick={() => setTab('account-security')} className="w-full text-right text-sm py-2 hover:text-[#C9A96A] flex items-center gap-2">
                      <Lock size={14} /> تغيير كلمة المرور
                    </button>
                    <button onClick={() => setTab('account-stores')} className="w-full text-right text-sm py-2 hover:text-[#C9A96A] flex items-center gap-2">
                      <Building2 size={14} /> إدارة متاجري
                    </button>
                    <button onClick={() => setTab('account-billing')} className="w-full text-right text-sm py-2 hover:text-[#C9A96A] flex items-center gap-2">
                      <CreditCard size={14} /> الفوترة والباقة
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ ACCOUNT SECURITY TAB ════════════════════════════════════ */}
          {tab === 'account-security' && (
            <div className="mt-4 grid lg:grid-cols-[1fr_320px] gap-4">
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-6">
                <h3 className="font-extrabold flex items-center gap-2"><KeyRound size={18} className="text-[#A02A5B]"/> تغيير كلمة المرور</h3>
                <p className="text-xs text-[#9A8A6B] mt-1">بعد التغيير سيتم تسجيل خروجك من باقي الأجهزة تلقائياً.</p>

                <div className="mt-5 space-y-4 max-w-md">
                  <div>
                    <label className="text-xs font-bold text-[#7A6F5A]">كلمة المرور الحالية *</label>
                    <input
                      type="password"
                      value={pwForm.currentPassword}
                      onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                      placeholder="••••••••"
                      dir="ltr"
                      className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A02A5B]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#7A6F5A]">كلمة المرور الجديدة *</label>
                    <input
                      type="password"
                      value={pwForm.newPassword}
                      onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      placeholder="6 أحرف على الأقل"
                      dir="ltr"
                      className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A02A5B]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#7A6F5A]">تأكيد كلمة المرور *</label>
                    <input
                      type="password"
                      value={pwForm.confirmPassword}
                      onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                      placeholder="أعد كتابة كلمة المرور"
                      dir="ltr"
                      className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A02A5B]"
                    />
                  </div>
                  <button
                    onClick={handleChangePassword}
                    disabled={isSavingPw}
                    className="bg-[#A02A5B] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-[#7A1F44] transition disabled:opacity-50"
                  >
                    {isSavingPw ? <RefreshCw size={16} className="animate-spin" /> : <Lock size={16} />}
                    {isSavingPw ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                  </button>
                </div>
              </div>

              <div className="bg-[#FFFBF0] border border-[#F5E6C8] rounded-2xl p-5">
                <h4 className="font-bold text-[#8D6E3A] flex items-center gap-2"><ShieldCheck size={16}/> نصائح الأمان</h4>
                <ul className="mt-3 space-y-2 text-xs text-[#7A6F5A] leading-6">
                  <li>• استخدم 8 أحرف على الأقل (مزيج من حروف + أرقام + رموز).</li>
                  <li>• لا تُعِد استخدام كلمة مرور من موقع آخر.</li>
                  <li>• غيّر كلمة المرور كل 3 أشهر كحد أدنى.</li>
                  <li>• لا تشاركها مع أحد — حتى فريق الدعم.</li>
                  <li>• بعد التغيير، سجّل الدخول من جديد على باقي أجهزتك.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ═══ MY STORES TAB ════════════════════════════════════════════ */}
          {tab === 'account-stores' && (
            <div className="mt-4 space-y-4">
              <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold flex items-center gap-2"><Building2 size={18} className="text-[#C9A96A]"/> متاجري</h3>
                  <p className="text-xs text-[#9A8A6B] mt-1">كل متجر تملكه يظهر هنا. اضغط على متجر للتبديل إليه.</p>
                </div>
                <a href="/?onboarding=1" className="bg-[#A02A5B] text-white px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-[#7A1F44] transition shrink-0">
                  <Plus size={14}/> متجر جديد
                </a>
              </div>

              {myStores.length === 0 ? (
                <div className="bg-[#FFFBF0] border border-[#F5E6C8] rounded-2xl p-8 text-center">
                  <Store size={32} className="text-[#C9A96A] mx-auto mb-3" />
                  <div className="font-bold text-[#8D6E3A]">لا تملك أي متجر بعد</div>
                  <p className="text-xs text-[#9A8A6B] mt-1">أنشئ متجرك الأول لتبدأ البيع.</p>
                  <a href="/?onboarding=1" className="inline-flex mt-4 bg-[#1A1A1E] text-white px-5 py-2.5 rounded-full text-xs font-bold items-center gap-2">
                    <Plus size={14}/> إنشاء متجر
                  </a>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {myStores.map(s => {
                    const isActive = s.slug === currentSlug
                    return (
                      <div
                        key={s._id}
                        className={`bg-white border rounded-2xl p-5 transition ${isActive ? 'border-[#C9A96A] shadow-lg shadow-[#C9A96A]/10' : 'border-[#EDE6D8]'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-12 h-12 rounded-xl grid place-items-center shrink-0 ${isActive ? 'bg-gradient-to-br from-[#C9A96A] to-[#A02A5B]' : 'bg-[#F5EFE6]'}`}>
                              <Store size={18} className={isActive ? 'text-white' : 'text-[#9A8A6B]'} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-extrabold truncate">{s.nameAr || s.name}</div>
                              <div className="text-[11px] text-[#9A8A6B] truncate" dir="ltr">{s.slug}.amugar.saas</div>
                            </div>
                          </div>
                          {isActive && (
                            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full shrink-0">نشط</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-3 text-[11px]">
                          <span className={`px-2 py-1 rounded-full font-bold ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {s.status === 'active' ? 'فعّال' : s.status === 'suspended' ? 'موقوف' : 'منتهي'}
                          </span>
                          <span className="bg-[#F5EFE6] text-[#8D6E3A] px-2 py-1 rounded-full font-bold">{s.plan === 'free_trial' ? 'تجريبي' : s.plan}</span>
                          {s.planExpiresAt && (
                            <span className="text-[#9A8A6B]">حتى {new Date(s.planExpiresAt).toLocaleDateString('ar-DZ')}</span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-4">
                          <a
                            href={`/?store=${s.slug}`}
                            target="_blank"
                            className="flex-1 bg-white border border-[#EDE6D8] text-[#1A1A1E] px-3 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 hover:shadow-md transition"
                          >
                            <Eye size={12}/> عرض
                          </a>
                          <button
                            onClick={() => handleSwitchStore(s)}
                            disabled={isActive}
                            className="flex-1 bg-[#1A1A1E] text-white px-3 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <RefreshCw size={12}/> {isActive ? 'المتجر الحالي' : 'تبديل'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ BILLING TAB ══════════════════════════════════════════════ */}
          {tab === 'account-billing' && (
            <div className="mt-4 space-y-4">
              {/* Free forever banner */}
              <div className="bg-gradient-to-l from-[#C9A96A] to-[#B8945A] text-white rounded-2xl p-8 relative overflow-hidden text-center">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="text-[10px] font-bold bg-white text-[#C9A96A] px-3 py-1 rounded-full inline-block mb-4">كل المزايا مجانية</div>
                  <div className="text-5xl font-extrabold mb-2">مجاني 100%</div>
                  <div className="text-white/80 text-sm mb-6">للأبد — بدون اشتراك، بدون عمولة، بدون بطاقة بنكية</div>
                  <div className="grid md:grid-cols-2 gap-3 text-right max-w-md mx-auto">
                    {[
                      'متاجر غير محدودة',
                      'منتجات غير محدودة',
                      'طلبات غير محدودة',
                      'الدفع عند الاستلام (COD)',
                      'شحن 58 ولاية',
                      '10 شركات توصيل',
                      'السوق العام (Marketplace)',
                      'تتبع Meta + TikTok Pixel',
                    ].map(feature => (
                      <div key={feature} className="flex items-center gap-2 text-white/90 text-sm">
                        <Check size={16} className="text-white shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Why free? explanation */}
              <div className="bg-[#FFFBF0] border border-[#F5E6C8] rounded-2xl p-5">
                <h4 className="font-bold text-[#8D6E3A] flex items-center gap-2"><Sparkles size={16} /> لماذا مجاني؟</h4>
                <p className="text-xs text-[#7A6F5A] mt-2 leading-6">
                  هدفنا هو بناء أكبر سوق جزائري للتجارة الإلكترونية. كل تاجر ينضم = منتجات أكثر في السوق العام = زوار أكثر = مبيعات أكثر للجميع. نكبر معك، لذلك المنصة مجانية للأبد. في المستقبل سنضيف ميزات اختيارية مدفوعة (إعلانات ممولة، تحليلات متقدمة) — لكن الأساس سيبقى مجاناً دائماً.
                </p>
              </div>

              {/* Quick stats */}
              <div className="grid md:grid-cols-3 gap-3">
                <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5 text-center">
                  <div className="text-3xl font-extrabold text-[#C9A96A]">{products.length}</div>
                  <div className="text-xs text-[#9A8A6B] mt-1">منتجاتك في المتجر</div>
                </div>
                <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5 text-center">
                  <div className="text-3xl font-extrabold text-[#A02A5B]">{products.filter(p => (p as any).isPublishedInMarketplace).length}</div>
                  <div className="text-xs text-[#9A8A6B] mt-1">منشورة في السوق العام</div>
                </div>
                <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5 text-center">
                  <div className="text-3xl font-extrabold text-[#8D6E3A]">{products.reduce((sum, p) => sum + ((p as any).marketplaceViews || 0), 0)}</div>
                  <div className="text-xs text-[#9A8A6B] mt-1">مشاهدات في السوق العام</div>
                </div>
              </div>
            </div>
          )}

          </div>
        </main>
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
                <div><label className="text-xs font-bold">اسم المجال FR *</label><input value={domainForm.name} onChange={e=> setDomainForm({...domainForm, name:e.target.value})} placeholder="Amugar MODE" className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white outline-none" dir="ltr"/></div>
                <div><label className="text-xs font-bold">اسم المجال عربي *</label><input value={domainForm.nameAr} onChange={e=> setDomainForm({...domainForm, nameAr:e.target.value})} placeholder="أموغار موضة" className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white"/></div>
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
                <p className="text-[11px] text-[#9A8A6B] mt-1">مثال: الطلاء/الحجر/الوزن — أو القماش/القصة/الطول — أو الحجم/نوع البشرة. كل حقل يظهر تلقائياً عند اختيار المجال.</p>
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

            {/* شريط الأخطاء الملاحظ */}
            {Object.keys(prodErrors).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs text-red-700 font-bold">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>توجد خطأ أو خانات إجبارية مفقودة ({Object.keys(prodErrors).length}): يرجى مراجعة الخانات المميزة باللون الأحمر.</span>
              </div>
            )}

            <div className="overflow-auto p-5 space-y-4 flex-1">
              <div className="flex flex-wrap gap-2">
                <label className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${prodForm.isNew ? 'bg-[#A02A5B] text-white border-[#A02A5B]' : 'bg-white text-[#9A8A6B] border-[#EDE6D8]'}`}>
                  <input type="checkbox" checked={prodForm.isNew} onChange={e => setProdForm({ ...prodForm, isNew: e.target.checked })} className="hidden" /> <Sparkles size={12} /> جديد
                </label>
                <label className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${prodForm.isFeatured ? 'bg-[#1A1A1E] text-white border-[#1A1A1E]' : 'bg-white text-[#9A8A6B] border-[#EDE6D8]'}`}>
                  <input type="checkbox" checked={prodForm.isFeatured} onChange={e => setProdForm({ ...prodForm, isFeatured: e.target.checked })} className="hidden" /> <Crown size={12} className={prodForm.isFeatured ? 'text-[#C9A96A]' : ''} /> مميز (الرئيسية)
                </label>
                <label className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${(prodForm as any).isPublishedInMarketplace ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-[#9A8A6B] border-[#EDE6D8]'}`}>
                  <input type="checkbox" checked={(prodForm as any).isPublishedInMarketplace || false} onChange={e => setProdForm({ ...prodForm, isPublishedInMarketplace: e.target.checked } as any)} className="hidden" /> <Globe size={12} /> نشر في السوق العام
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
                <div><label className="text-xs font-bold">الاسم العربي *</label><input value={prodForm.nameAr} onChange={e => setProdForm({ ...prodForm, nameAr: e.target.value })} placeholder="مثال: منتج فاخر" className={`mt-1 w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none ${prodErrors.nameAr ? 'border-red-300 bg-red-50' : 'border-[#EDE6D8] focus:border-[#C9A96A]'}`} />{prodErrors.nameAr && <p className="text-xs text-red-600 mt-1">{prodErrors.nameAr}</p>}</div>
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
                <div><label className="text-xs font-bold">الخامة عربي</label><input value={prodForm.materialAr} onChange={e => setProdForm({ ...prodForm, materialAr: e.target.value })} placeholder="مثال: خامة فاخرة" className="mt-1 w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm bg-white" /></div>
              </div>

              {/* DOMAIN-SPECIFIC ATTRIBUTES */}
              {currentDomainForForm.attributeSchema.length>0 && (
                <div className="bg-white border border-[#EDE6D8] rounded-2xl p-4">
                  <label className="text-xs font-bold flex items-center gap-1.5"><FileText size={14} className="text-[#C9A96A]"/> خصائص خاصة بمجال {currentDomainForForm.nameAr} — تتغير تلقائياً مع المجال</label>
                  <p className="text-[11px] text-[#9A8A6B] mt-1">هذه الحقول تعتمد على المجال المختار أعلاه. غيّر المجال لترى الحقول المختلفة حسب التخصص.</p>
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
                              <option value="">— اختر —</option>
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

              {/* VARIANTS — Always available for ANY product regardless of domain */}
              <div className="bg-[#FDF2F6] border border-[#F6C0D4] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold flex items-center gap-1.5"><PaletteIcon size={14} className="text-[#A02A5B]" /> متغيرات المنتج (ألوان + مقاسات)</label>
                  <span className="text-[11px] bg-white border border-[#EDE6D8] px-2 py-1 rounded-full">{(prodForm.variants||[]).length} متغير {prodForm.variants?.length ? `• المخزون الإجمالي ${prodForm.variants.reduce((a,b)=> a+(Number(b.stock)||0),0)}` : ''}</span>
                </div>
                <div className="grid md:grid-cols-[1fr_1fr_auto] gap-2 mt-3 bg-white border border-[#F6C0D4] rounded-xl p-3">
                  <div><label className="text-[11px] font-bold flex items-center gap-1"><Ruler size={11}/> مقاسات للجيل الجماعي (فاصلة)</label><input value={bulkSizes} onChange={e=> setBulkSizes(e.target.value)} placeholder="S, M, L, XL" className="mt-1 w-full border border-[#EDE6D8] rounded-full px-3 py-1.5 text-xs" /></div>
                  <div><label className="text-[11px] font-bold flex items-center gap-1"><Droplet size={11} className="text-[#A02A5B]"/> ألوان للجيل الجماعي (فاصلة)</label><input value={bulkColors} onChange={e=> setBulkColors(e.target.value)} placeholder="أسود, بيج, أحمر" className="mt-1 w-full border border-[#EDE6D8] rounded-full px-3 py-1.5 text-xs" /></div>
                  <button onClick={bulkGenerate} className="self-end bg-[#A02A5B] text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-[#7A1F44] h-fit">توليد جماعي</button>
                </div>
                <div className="grid gap-2 mt-3">
                  {(prodForm.variants||[]).map((v, idx)=> (
                    <div key={v.id} className="grid grid-cols-12 gap-1.5 items-center bg-white border border-[#F6C0D4] rounded-xl px-2 py-2">
                      <input type="color" value={v.colorHex || '#CCCCCC'} onChange={e=> updateVariant(idx, { colorHex: e.target.value })} className="col-span-1 h-8 rounded-full p-0 border-0"/>
                      <input value={v.colorAr || v.color || ''} onChange={e=> updateVariant(idx, { colorAr: e.target.value, color: e.target.value })} placeholder="اللون" className="col-span-3 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs"/>
                      <select value={v.size || ''} onChange={e=> updateVariant(idx, { size: e.target.value })} className="col-span-3 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs bg-white">
                        <option value="">— مقاس —</option>
                        {(currentDomainForForm?.variantConfig?.sizeOptions || ['S','M','L','XL','One Size']).map((s: string)=> <option key={s} value={s}>{s}</option>)}
                        <option value="custom">مخصص...</option>
                      </select>
                      <input type="number" value={v.stock} onChange={e=> updateVariant(idx, { stock: parseInt(e.target.value)||0 })} className="col-span-2 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs text-center" placeholder="المخزون"/>
                      <input type="number" value={v.priceAdjustment||0} onChange={e=> updateVariant(idx, { priceAdjustment: parseInt(e.target.value)||0 })} className="col-span-2 border border-[#EDE6D8] rounded-full px-2 py-1.5 text-xs text-center" placeholder="+سعر"/>
                      <button onClick={()=> removeVariant(idx)} className="col-span-1 w-7 h-7 rounded-full bg-red-50 text-red-600 border border-red-200 grid place-items-center justify-self-end"><X size={12}/></button>
                      {v.size==='custom' && <input placeholder="مقاس مخصص" onBlur={e=> updateVariant(idx, { size: e.target.value })} className="col-span-12 border border-dashed border-[#F6C0D4] rounded-full px-3 py-1.5 text-xs mt-1" />}
                    </div>
                  ))}
                  {(prodForm.variants||[]).length===0 && <p className="text-xs text-[#9A8A6B] text-center py-2">لا توجد متغيرات — أضف متغيراً أو استخدم التوليد الجماعي. مثال: أدخل المقاسات <b>S, M, L, XL</b> والألوان <b>أسود, بيج</b></p>}
                  <button onClick={addVariantRow} className="bg-white border border-[#F6C0D4] text-[#A02A5B] px-3 py-1.5 rounded-full text-xs font-bold w-fit flex items-center gap-1"><Plus size={12}/> إضافة متغير</button>
                </div>
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
                  {prodForm.tierPricing.length === 0 && <p className="text-xs text-[#9A8A6B] text-center py-2">لا توجد عروض — أضف عرضاً لزيادة المبيعات</p>}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#EDE6D8] p-4 flex gap-2">
              <button
                onClick={handleSaveProduct}
                disabled={isSubmitting}
                className={`flex-1 text-white rounded-full py-3 font-extrabold flex items-center justify-center gap-2 shadow-lg transition ${
                  isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : editingProd
                      ? 'bg-[#1A1A1E] hover:bg-black'
                      : 'bg-[#A02A5B] hover:bg-[#7A1F44] shadow-[#A02A5B]/20'
                }`}
              >
                {isSubmitting ? (
                  <><RefreshCw size={16} className="animate-spin" /> جاري حفظ البيانات...</>
                ) : editingProd ? (
                  <><Save size={16} /> حفظ التعديلات</>
                ) : (
                  <><Plus size={16} /> نشر المنتج في المتجر</>
                )}
              </button>
              <button onClick={() => setShowProdModal(false)} disabled={isSubmitting} className="px-6 border border-[#EDE6D8] rounded-full py-3 font-bold bg-white hover:bg-[#FFFCF8]">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Onboarding wizard overlay ──────────────────────────────────
          Shown after registration (URL has ?onboarding=1). The wizard
          walks the merchant through picking a niche (preset domain),
          filling in store info, and choosing a theme — then saves the
          settings and dismisses itself. Skipping also dismisses. */}
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
              // Show the specific failure reason so the merchant knows
              // whether to log in again, check their network, etc.
              // Even if the save fails, dismiss the wizard so they
              // aren't trapped — they can re-save from the Store tab.
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
//  Onboarding Wizard — 3-step setup shown after registration
// ═══════════════════════════════════════════════════════════════════════════

const onboardingThemePresets = [
  { name: 'ذهبي كلاسيكي', colors: { primaryColor: '#C9A96A', secondaryColor: '#1A1A1E', bgColor: '#FFFCF8', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#A02A5B' } },
  { name: 'أزرق تقني', colors: { primaryColor: '#2563EB', secondaryColor: '#0F172A', bgColor: '#F8FAFC', cardBgColor: '#FFFFFF', textColor: '#1E293B', accentColor: '#7C3AED' } },
  { name: 'أخضر طبيعي', colors: { primaryColor: '#16A34A', secondaryColor: '#14532D', bgColor: '#F0FDF4', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#CA8A04' } },
  { name: 'وردي راقي', colors: { primaryColor: '#EC4899', secondaryColor: '#831843', bgColor: '#FDF2F8', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#9333EA' } },
  { name: 'برتقالي حيوي', colors: { primaryColor: '#EA580C', secondaryColor: '#1C1917', bgColor: '#FFFBEB', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#DC2626' } },
  { name: 'أسود مينيمال', colors: { primaryColor: '#525252', secondaryColor: '#171717', bgColor: '#FAFAFA', cardBgColor: '#FFFFFF', textColor: '#1A1A1E', accentColor: '#3B82F6' } },
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

  // Step 0: Pick niche (activates the matching preset domain)
  // Step 1: Store name + phone + announcement
  // Step 2: Pick theme (6 preset palettes)
  // "تخطّي" / "حفظ وبدء البيع" calls onComplete which saves settings +
  // clears the URL flag.
  return (
    <div className="fixed inset-0 z-[200] bg-[#1A1A1E]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl border border-[#EDE6D8] overflow-hidden my-8">
        {/* Progress bar + skip */}
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
                      // Optimistically update the form so the button
                      // highlights immediately; setActiveDomain also
                      // persists the choice server-side (which syncs
                      // storeName/hero/etc. as a side effect).
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
                <input value={storeForm.storeName || ''} onChange={e => setStoreForm({ ...storeForm, storeName: e.target.value })} placeholder="اسم المتجر" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
                <input value={storeForm.storeNameAr || ''} onChange={e => setStoreForm({ ...storeForm, storeNameAr: e.target.value })} placeholder="الاسم بالعربية" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
                <input value={storeForm.phone || ''} onChange={e => setStoreForm({ ...storeForm, phone: e.target.value })} placeholder="رقم الهاتف" dir="ltr" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
                <input value={storeForm.announcement || ''} onChange={e => setStoreForm({ ...storeForm, announcement: e.target.value })} placeholder="نص الشريط الإعلاني" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(0)} className="px-4 py-3 border border-[#EDE6D8] rounded-xl font-bold text-sm hover:bg-[#FFFCF8] transition">← السابق</button>
                <button onClick={() => setStep(2)} className="flex-1 bg-[#1A1A1E] text-white py-3 rounded-xl font-bold hover:bg-black transition">التالي ←</button>
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
                    className={`p-3 rounded-2xl border-2 text-right transition ${(storeForm as any).primaryColor === preset.colors.primaryColor ? 'border-[#A02A5B] bg-[#FDF2F6]' : 'border-[#EDE6D8] hover:border-[#C9A96A]'}`}
                  >
                    <div className="flex gap-1 mb-2">
                      <span className="w-6 h-6 rounded" style={{ background: preset.colors.primaryColor }}></span>
                      <span className="w-6 h-6 rounded" style={{ background: preset.colors.secondaryColor }}></span>
                      <span className="w-6 h-6 rounded" style={{ background: preset.colors.accentColor }}></span>
                    </div>
                    <div className="font-bold text-xs text-[#1A1A1E]">{preset.name}</div>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(1)} className="px-4 py-3 border border-[#EDE6D8] rounded-xl font-bold text-sm hover:bg-[#FFFCF8] transition">← السابق</button>
                <button onClick={onComplete} className="flex-1 bg-[#A02A5B] text-white py-3 rounded-xl font-bold hover:bg-[#7A1F44] transition">حفظ وبدء البيع 🚀</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Analytics Dashboard — Visit Insights
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

  if (loading) {
    return (
      <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
        <div className="h-5 w-32 skeleton rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!overview) return null

  const maxVisits = Math.max(...timeline.map(t => t.visits), 1)
  const todayDate = new Date().toISOString().slice(0, 10)
  const todayTimeline = timeline.find(t => t.date === todayDate)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#C9A96A]/15 rounded-full blur-2xl"/>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#A02A5B]/15 rounded-full blur-2xl"/>
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C9A96A] to-[#B8945A] grid place-items-center shrink-0">
              <BarChart3 size={20} className="text-white"/>
            </div>
            <div>
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                تحليلات الزيارات
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                  مباشر
                </span>
              </h3>
              <p className="text-xs text-white/60 mt-0.5">تابع من أين يأتي زوارك وما هي أكثر منتجاتك مشاهدةً</p>
            </div>
          </div>
          <div className="text-left">
            <div className="text-[10px] text-white/60">زيارات اليوم</div>
            <div className="text-3xl font-extrabold text-[#C9A96A]">{todayTimeline?.visits || overview.todayVisits || 0}</div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <AnalyticsStatCard icon={<TrendingUp size={16} />} label="إجمالي الزيارات" value={overview.totalVisits} sub="منذ إنشاء المتجر" color="emerald" />
        <AnalyticsStatCard icon={<Eye size={16} />} label="زوار فريدون" value={overview.uniqueVisitors} sub={`${overview.conversionRate}% تحويل`} color="blue" />
        <AnalyticsStatCard icon={<TrendingUp size={16} />} label="هذا الأسبوع" value={overview.weekVisits} sub="آخر 7 أيام" color="amber" />
        <AnalyticsStatCard icon={<Eye size={16} />} label="مشاهدات المنتجات" value={overview.productViews} sub={`من ${overview.storeViews} زيارة متجر`} color="rose" />
        <AnalyticsStatCard icon={<Award size={16} />} label="معدل التحويل" value={`${overview.conversionRate}%`} sub={`${overview.orderCount} طلب`} color="purple" />
      </div>

      {/* Visits timeline (bar chart) */}
      <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold flex items-center gap-2 text-sm">
            <BarChart3 size={16} className="text-[#C9A96A]"/>
            الزيارات اليومية
            <span className="text-[10px] text-[#9A8A6B] font-normal">آخر 7 أيام</span>
          </h3>
        </div>
        {timeline.length === 0 ? (
          <div className="text-center text-xs text-[#9A8A6B] py-8">لا توجد زيارات بعد — شارك رابط متجرك لتبدأ في رؤية البيانات هنا</div>
        ) : (
          <div className="flex items-end justify-between gap-2 h-32">
            {timeline.map((point, i) => {
              const height = Math.max(4, (point.visits / maxVisits) * 100)
              const dayName = new Date(point.date).toLocaleDateString('ar-DZ', { weekday: 'short' })
              const isToday = point.date === todayDate
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  <div className="absolute -top-12 bg-[#1A1A1E] text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                    <div className="font-bold">{point.visits} زيارة</div>
                    <div className="text-white/60">{point.uniqueVisitors} زائر فريد</div>
                  </div>
                  <div className={`w-full rounded-t-lg transition-all hover:opacity-80 ${isToday ? 'bg-gradient-to-t from-[#C9A96A] to-[#D4AF37]' : 'bg-gradient-to-t from-[#C9A96A]/40 to-[#C9A96A]/60'}`} style={{ height: `${height}%` }} />
                  <div className="text-[9px] text-[#9A8A6B] font-medium">{dayName}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Two columns: Traffic Sources + Top Products */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
          <h3 className="font-extrabold flex items-center gap-2 text-sm mb-4">
            <Globe size={16} className="text-[#C9A96A]"/>
            مصادر الزيارات
            <span className="text-[10px] text-[#9A8A6B] font-normal">آخر 30 يوم</span>
          </h3>
          {sources.length === 0 ? (
            <div className="text-center text-xs text-[#9A8A6B] py-6">لا توجد بيانات بعد</div>
          ) : (
            <div className="space-y-2.5">
              {sources.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-20 text-xs font-bold text-[#1A1A1E] truncate flex items-center gap-1">
                    <SourceIcon source={s.source} />
                    <span className="truncate">{getSourceLabel(s.source)}</span>
                  </div>
                  <div className="flex-1 h-6 bg-[#F3F0E8] rounded-full overflow-hidden relative">
                    <div className="h-full bg-gradient-to-l from-[#C9A96A] to-[#D4AF37] rounded-full transition-all" style={{ width: `${Math.max(s.percentage, 2)}%` }} />
                  </div>
                  <div className="w-16 text-left">
                    <div className="text-xs font-extrabold text-[#1A1A1E]">{s.visits}</div>
                    <div className="text-[9px] text-[#9A8A6B]">{s.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
          <h3 className="font-extrabold flex items-center gap-2 text-sm mb-4">
            <Star size={16} className="text-[#C9A96A]"/>
            أكثر المنتجات مشاهدةً
            <span className="text-[10px] text-[#9A8A6B] font-normal">آخر 30 يوم</span>
          </h3>
          {topProducts.length === 0 ? (
            <div className="text-center text-xs text-[#9A8A6B] py-6">لا توجد مشاهدات بعد</div>
          ) : (
            <div className="space-y-2">
              {topProducts.slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#FFFCF8] transition">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C9A96A] to-[#B8945A] text-white text-xs font-extrabold grid place-items-center shrink-0">{i + 1}</div>
                  <div className="w-10 h-10 rounded-lg bg-[#F3F0E8] overflow-hidden shrink-0 border border-[#EDE6D8]">
                    {p.image ? <img src={p.image} alt={p.productNameAr} className="w-full h-full object-cover" /> : <Package size={14} className="text-[#9A8A6B] m-auto mt-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[#1A1A1E] truncate">{p.productNameAr}</div>
                    <div className="text-[10px] text-[#9A8A6B]">{p.price ? formatDZD(p.price) : '—'}</div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-sm font-extrabold text-[#C9A96A]">{p.views}</div>
                    <div className="text-[9px] text-[#9A8A6B]">مشاهدة</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Device + Country breakdown */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
          <h3 className="font-extrabold flex items-center gap-2 text-sm mb-4">
            <Smartphone size={16} className="text-[#C9A96A]"/>
            الأجهزة
          </h3>
          {devices.length === 0 ? (
            <div className="text-center text-xs text-[#9A8A6B] py-4">لا توجد بيانات</div>
          ) : (
            <div className="flex items-center justify-around gap-2">
              {devices.map((d, i) => {
                const total = devices.reduce((a, b) => a + b.visits, 0)
                const pct = total > 0 ? Math.round((d.visits / total) * 100) : 0
                const Icon = d.device === 'mobile' ? Smartphone : d.device === 'tablet' ? Package : Globe
                return (
                  <div key={i} className="text-center">
                    <div className="w-12 h-12 rounded-full bg-[#FFFCF8] border border-[#EDE6D8] grid place-items-center mx-auto mb-1.5">
                      <Icon size={18} className="text-[#8D6E3A]"/>
                    </div>
                    <div className="text-xs font-bold text-[#1A1A1E]">{d.device === 'mobile' ? 'هاتف' : d.device === 'tablet' ? 'لوحي' : 'حاسوب'}</div>
                    <div className="text-[10px] text-[#9A8A6B]">{pct}%</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#EDE6D8] rounded-2xl p-5">
          <h3 className="font-extrabold flex items-center gap-2 text-sm mb-4">
            <Globe size={16} className="text-[#C9A96A]"/>
            الدول
          </h3>
          {countries.length === 0 ? (
            <div className="text-center text-xs text-[#9A8A6B] py-4">لا توجد بيانات بعد</div>
          ) : (
            <div className="space-y-1.5">
              {countries.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-4 rounded bg-[#F3F0E8] grid place-items-center text-[8px] font-bold text-[#8D6E3A]">{c.country.slice(0, 2).toUpperCase()}</span>
                    <span className="font-bold text-[#1A1A1E]">{c.country}</span>
                  </div>
                  <span className="text-[#9A8A6B]">{c.visits} زيارة</span>
                </div>
              ))}
            </div>
          )}
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

function SourceIcon({ source }: { source: string }) {
  const s = source.toLowerCase()
  if (s.includes('facebook') || s.includes('fb')) return <span className="text-[10px]">📘</span>
  if (s.includes('instagram')) return <span className="text-[10px]">📸</span>
  if (s.includes('tiktok')) return <span className="text-[10px]">🎵</span>
  if (s.includes('youtube')) return <span className="text-[10px]">▶️</span>
  if (s.includes('whatsapp') || s.includes('wa.me')) return <span className="text-[10px]">💬</span>
  if (s.includes('telegram') || s.includes('t.me')) return <span className="text-[10px]">✈️</span>
  if (s.includes('google')) return <span className="text-[10px]">🔍</span>
  if (s.includes('pinterest')) return <span className="text-[10px]">📌</span>
  if (s.includes('twitter') || s.includes('x.com')) return <span className="text-[10px]">🐦</span>
  if (s === 'direct') return <span className="text-[10px]">🔗</span>
  return <Globe size={10} className="text-[#9A8A6B]" />
}

function getSourceLabel(source: string): string {
  const s = source.toLowerCase()
  if (s.includes('facebook') || s.includes('fb')) return 'فيسبوك'
  if (s.includes('instagram')) return 'إنستغرام'
  if (s.includes('tiktok')) return 'تيك توك'
  if (s.includes('youtube')) return 'يوتيوب'
  if (s.includes('whatsapp') || s.includes('wa.me')) return 'واتساب'
  if (s.includes('telegram') || s.includes('t.me')) return 'تيليغرام'
  if (s.includes('google')) return 'جوجل'
  if (s.includes('pinterest')) return 'بنترست'
  if (s.includes('twitter') || s.includes('x.com')) return 'تويتر'
  if (s === 'direct') return 'مباشر'
  return source.length > 12 ? source.slice(0, 10) + '…' : source
}
