/**
 * PlatformLanding — Professional SaaS marketing page.
 *
 * Shows a modern, conversion-optimized landing page with:
 *  - Sticky glassmorphism header with gradient CTA
 *  - Hero with animated gradient background + dashboard preview
 *  - Stats bar (social proof)
 *  - Features grid with icons
 *  - Integrations showcase
 *  - How it works (3 steps)
 *  - Pricing (4 tiers)
 *  - FAQ accordion
 *  - Final CTA
 *  - Footer
 *
 * NO admin credentials are shown anywhere.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import { authRegister } from '../services/api/client'
import { Logo } from '../components/Logo'
import {
  ArrowLeft, Check, Store, Crown, Rocket, ShoppingBag, Truck, ShieldCheck,
  Sparkles, Globe, Star, TrendingUp, Zap, X, ChevronDown, Palette,
  Package, BarChart3, Phone, Mail, Lock, User, Eye, EyeOff,
  Smartphone, Shirt, Heart, Home as HomeIcon, Wifi,
} from 'lucide-react'

const PLATFORM_APEX = ((import.meta as any).env?.VITE_PLATFORM_APEX || 'amugar.saas').toLowerCase()

// ─── Store types (domains) offered during registration ──────────────────────
// Each maps to a domain_XXX preset in api/lib/seed.ts. The merchant picks
// one during signup; the store's `activeDomainId` is set accordingly so the
// storefront matches what they actually sell (instead of always showing
// jewelry by default).
const STORE_TYPES: { id: string; labelAr: string; descAr: string; icon: any }[] = [
  { id: 'domain_general',         labelAr: 'متجر عام',        descAr: 'متجر متعدد الفئات — مناسب لأي نوع منتجات', icon: ShoppingBag },
  { id: 'domain_jewelry',         labelAr: 'مجوهرات',         descAr: 'قلائد، خواتم، أقراط، أساور، إكسسوارات فاخرة', icon: Crown },
  { id: 'domain_fashion',         labelAr: 'موضة',            descAr: 'ملابس، عبايات، حقائب، أحذية، حجاب', icon: Shirt },
  { id: 'domain_beauty',          labelAr: 'جمال',            descAr: 'عطور، مكياج، عناية بالبشرة والشعر', icon: Heart },
  { id: 'domain_electronics',     labelAr: 'إلكترونيات',      descAr: 'هواتف، سماعات، شواحن، إكسسوارات تقنية', icon: Smartphone },
  { id: 'domain_home_appliances', labelAr: 'أجهزة منزلية',    descAr: 'ثلاجات، غسالات، أفران، مكيفات، تلفزيونات', icon: HomeIcon },
  { id: 'domain_digital',         labelAr: 'رقميات',          descAr: 'IPTV، Netflix، اشتراكات AI، Canva، كروت', icon: Wifi },
]

// No paid plans — Amugar is 100% free forever.
// The pricing section is replaced with a "free forever" banner.

const features = [
  { icon: Package, t: 'إدارة المنتجات', d: 'أضف منتجات بصور متعددة، متغيرات (ألوان/مقاسات)، أسعار بالجملة، وحقول مخصصة حسب تخصص متجرك.', c: '#C9A96A' },
  { icon: Truck, t: 'شحن 58 ولاية', d: 'حاسبة شحن مدمجة لكل ولايات الجزائر مع أسعار قابلة للتخصيص، توصيل للمنزل أو مكتب التوصيل.', c: '#A02A5B' },
  { icon: ShieldCheck, t: 'الدفع عند الاستلام', d: 'نظام COD كامل مع كشف الطلبات المكررة تلقائياً، تأكيد هاتفي، وحماية من الإرسال المزدوج.', c: '#8D6E3A' },
  { icon: Globe, t: 'نطاق مخصص', d: 'كل متجر يحصل على نطاق فرعي أو نطاقك الخاص mystore.dz مع شهادة SSL مجانية وتلقائية.', c: '#1A1A1E' },
  { icon: Zap, t: 'تتبع الإعلانات', d: 'Meta Pixel + TikTok Pixel مدمجان تلقائياً مع أحداث ViewContent، AddToCart، InitiateCheckout، Purchase.', c: '#C9A96A' },
  { icon: BarChart3, t: 'متجريات متقدمة', d: 'إحصائيات حية للمبيعات، الطلبات الجديدة، المنتجات الأكثر مبيعاً، والمخزون المنخفض.', c: '#A02A5B' },
]

const integrations = [
  { name: 'Yalidine', desc: 'توصيل 58 ولاية', icon: Truck, color: '#C9A96A' },
  { name: 'ZR Express', desc: 'توصيل سريع', icon: Truck, color: '#A02A5B' },
  { name: 'Meta Pixel', desc: 'تتبع إعلانات فيسبوك', icon: TrendingUp, color: '#1A1A1E' },
  { name: 'TikTok Pixel', desc: 'تتبع إعلانات تيك توك', icon: Zap, color: '#8D6E3A' },
  { name: 'COD', desc: 'الدفع عند الاستلام', icon: ShieldCheck, color: '#A02A5B' },
]

const faqs = [
  { q: 'هل أحتاج خبرة تقنية لإنشاء متجر؟', a: 'لا، المنصة لا تتطلب أي كود. تملأ نموذج التسجيل، ويُنشأ متجرك تلقائياً مع لوحة تحكم كاملة. كل ما تحتاجه هو بريد إلكتروني وكلمة مرور.' },
  { q: 'كم تكلفة المنصة؟', a: 'مجانية 100% — للأبد. بدون اشتراك، بدون عمولة، بدون بطاقة بنكية. كل المزايا متاحة للجميع: متاجر غير محدودة، منتجات غير محدودة، طلبات غير محدودة، ماركت بليس، شركات توصيل، تتبع الإعلانات.' },
  { q: 'هل يدعم الدفع عند الاستلام (COD)؟', a: 'نعم، نظام COD كامل مدمج في كل المتاجر. كل طلب يأتيك في لوحة التحكم مع كشف الطلبات المكررة تلقائياً وحماية من الإرسال المزدوج.' },
  { q: 'كيف يعمل الشحن للولايات؟', a: 'حاسبة شحن مدمجة لكل 58 ولاية جزائرية مع أسعار قابلة للتخصيص. يمكنك أيضاً ربط متجرك بـ 10 شركات توصيل جزائرية لإنشاء بوالص الشحن تلقائياً.' },
  { q: 'ما هو السوق العام (Marketplace)؟', a: 'كل منتج تضيفه يظهر تلقائياً في السوق العام على amugar.saas/marketplace — مجاناً. آلاف الزبائن يتصفحون المنتجات يومياً، مما يزيد مبيعاتك بدون أي جهد إضافي. يمكنك إخفاء أي منتج من السوق بنقرة واحدة.' },
  { q: 'هل المنصة تدعم Meta Pixel و TikTok Pixel؟', a: 'نعم، مدمجان تلقائياً مع أحداث ViewContent، AddToCart، InitiateCheckout، Purchase. تُسجل المفاتيح من لوحة التحكم في تبويب "التتبع".' },
]

export default function PlatformLanding() {
  const { login, user } = useTenant()
  const nav = useNavigate()
  const [showRegister, setShowRegister] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const [form, setForm] = useState({
    fullName: '', email: '', password: '',
    storeName: '',  // Arabic name — the ONLY store field required
    domainType: 'domain_general',  // chosen store type (jewelry / fashion / etc.)
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If the merchant is already logged in, show a "go to my dashboard"
  // button instead of the register/login CTAs. This solves the "where
  // is my dashboard?" problem — the merchant lands here from a fresh
  // navigation and sees the direct link to their admin panel.
  const goToDashboard = () => {
    const slug = localStorage.getItem('amugar_saas_active_slug')
    const sid = localStorage.getItem('amugar_saas_active_store')
    if (slug) window.location.href = `/admin?store=${encodeURIComponent(slug)}`
    else if (sid) window.location.href = `/admin?storeId=${encodeURIComponent(sid)}`
    else nav('/admin')
  }

  // ─── Auto-slugify ──────────────────────────────────────────────────
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'store-' + Date.now().toString(36)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.fullName || !form.email || !form.password || !form.storeName) {
      setError('يرجى ملء جميع الحقول')
      return
    }
    setLoading(true)
    try {
      // Auto-generate slug from store name, storeNameAr = storeName (Arabic),
      // phone is optional and omitted. The form is now minimal: 4 fields only.
      const slug = slugify(form.storeName)
      // Check for referral code in URL (?ref=STORE_SLUG)
      // This is the viral growth mechanism: merchants share their ref link,
      // new merchants who sign up via that link get tracked.
      const refCode = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('ref')
        : null
      const res = await authRegister({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        storeName: form.storeName,  // Arabic name used as both name + nameAr
        storeNameAr: form.storeName,
        slug,  // auto-generated, merchant doesn't see/edit it
        domainType: form.domainType,  // chosen store type
        ...(refCode ? { phone: `REF:${refCode}` } : {}),  // store ref code in phone temporarily
      })
      try {
        localStorage.setItem('amugar_token', res.token)
        localStorage.setItem('amugar_saas_user', JSON.stringify(res.user))
        localStorage.setItem('amugar_saas_active_store', res.storeId)
      } catch {}
      localStorage.setItem('amugar_saas_active_slug', slug)

      const hostname = window.location.hostname.replace(/^www\./, '')
      const isVercelFree = hostname.includes('vercel.app') || hostname.includes('localhost') || hostname === '127.0.0.1'
      const adminUrl = isVercelFree
        ? `${window.location.origin}/admin?store=${encodeURIComponent(slug)}&storeId=${res.storeId}&onboarding=1`
        : `${window.location.protocol}//${slug}.${hostname}/admin?storeId=${res.storeId}&onboarding=1`
      window.location.href = adminUrl
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'فشل التسجيل')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      const cachedUser = JSON.parse(localStorage.getItem('amugar_saas_user') || '{}')
      if (cachedUser.role === 'super_admin') {
        nav('/super-admin')
      } else {
        // IMPORTANT: redirect the merchant to their DASHBOARD (/admin),
        // not the storefront. The previous code redirected to /?store=slug
        // which landed the merchant on the customer-facing storefront —
        // they'd then have to manually find the "manage products" button
        // to reach their actual dashboard. Now we go straight to /admin
        // with their store's slug so they land on the overview tab.
        const slug = localStorage.getItem('amugar_saas_active_slug')
        const sid = localStorage.getItem('amugar_saas_active_store')
        if (slug) {
          window.location.href = `/admin?store=${encodeURIComponent(slug)}`
        } else if (sid) {
          window.location.href = `/admin?storeId=${encodeURIComponent(sid)}`
        } else {
          // No cached store — go to /admin which will show the
          // "no tenant context" branch → PlatformLanding, but with
          // a logged-in user so they can pick a store from "متاجري".
          nav('/admin')
        }
      }
    } catch (err: any) {
      setError(err?.message || 'فشل تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFCF8]">
      {/* ═══ Header ═══════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-[#FFFCF8]/80 backdrop-blur-xl border-b border-[#EDE6D8]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Logo to="/" imgClassName="h-9 w-auto" />
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#1A1A1E]">
            <a href="#features" className="hover:text-[#C9A96A] transition">المزايا</a>
            <a href="#integrations" className="hover:text-[#C9A96A] transition">التكاملات</a>
            <a href="#free" className="hover:text-[#C9A96A] transition">مجاني 100%</a>
            <a href="#faq" className="hover:text-[#C9A96A] transition">الأسئلة الشائعة</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <button onClick={goToDashboard} className="text-sm font-bold px-4 py-2 rounded-full bg-gradient-to-l from-[#C9A96A] to-[#B8945A] text-white hover:opacity-90 transition shadow-md flex items-center gap-1.5">
                  <Store size={14} /> لوحة التحكم
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setShowLogin(true); setShowRegister(false) }} className="text-sm font-bold px-4 py-2 rounded-full hover:bg-[#F5EFE6] transition">دخول</button>
                <button onClick={() => { setShowRegister(true); setShowLogin(false) }} className="text-sm font-bold px-4 py-2 rounded-full bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white hover:opacity-90 transition shadow-lg">أنشئ متجرك</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ═══ Hero ═════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFFCF8] via-[#FFF8EE] to-[#FDF2F6]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C9A96A]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#A02A5B]/8 rounded-full blur-3xl" />

        <div className="relative max-w-[1280px] mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-20">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 bg-white border border-[#EDE6D8] text-[#1A1A1E] text-xs font-bold px-4 py-2 rounded-full shadow-sm">
                <Sparkles size={14} className="text-[#C9A96A]" /> منصة SaaS متعددة المتاجر • إطلاق 2026
              </span>
              <h1 className="text-[36px] md:text-[56px] font-extrabold leading-[1.05] text-[#1A1A1E] mt-6">
                متجرك الإلكتروني<br />
                <span className="bg-gradient-to-l from-[#C9A96A] via-[#A02A5B] to-[#7A1F44] bg-clip-text text-transparent">مجاني 100% — للأبد</span>
              </h1>
              <p className="text-[#5A5340] text-lg leading-8 mt-6 max-w-[560px]">
                منصة جزائرية متكاملة لإنشاء متاجر الدفع عند الاستلام. متجر باسمك الخاص، لوحة تحكم احترافية، حاسبة شحن لـ 58 ولاية، 10 شركات توصيل، ومنتجاتك تظهر تلقائياً في السوق العام — كل هذا مجاناً، بدون اشتراك وبدون عمولة.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <button onClick={() => setShowRegister(true)} className="bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition shadow-xl shadow-[#1A1A1E]/15">
                  <Rocket size={18} /> أنشئ متجرك مجاناً
                </button>
                <a href="#free" className="bg-white border border-[#EDE6D8] text-[#1A1A1E] px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:bg-[#F5EFE6] transition">
                  لماذا مجاني؟
                </a>
              </div>
              <div className="flex items-center gap-6 mt-8 text-sm text-[#7A6F5A]">
                <span className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> مجاني للأبد</span>
                <span className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> بدون بطاقة بنكية</span>
                <span className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> بدون عمولة</span>
                <span className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> منتجاتك في السوق العام</span>
              </div>
            </div>

            {/* Dashboard preview card */}
            <div className="relative">
              <div className="absolute -inset-6 bg-gradient-to-br from-[#C9A96A]/20 to-[#A02A5B]/10 rounded-[40px] blur-3xl" />
              <div className="relative bg-white rounded-[28px] border border-[#EDE6D8] shadow-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <Logo to={null} showText={false} imgClassName="h-10 w-auto" />
                    <div>
                      <div className="font-bold text-sm text-[#1A1A1E]">لوحة تحكم المتجر</div>
                      <div className="text-[10px] text-[#9A8A6B]">{typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : 'amugar.saas'}/?store=demo</div>
                    </div>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> نشط
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-2xl p-4 text-center">
                    <ShoppingBag size={18} className="mx-auto text-[#C9A96A]" />
                    <div className="font-extrabold text-2xl text-[#1A1A1E] mt-2">∞</div>
                    <div className="text-[10px] text-[#9A8A6B]">منتجات</div>
                  </div>
                  <div className="bg-[#FDF2F6] border border-[#F6C0D4] rounded-2xl p-4 text-center">
                    <Truck size={18} className="mx-auto text-[#A02A5B]" />
                    <div className="font-extrabold text-2xl text-[#A02A5B] mt-2">58</div>
                    <div className="text-[10px] text-[#7A1F44]">ولاية</div>
                  </div>
                  <div className="bg-[#FFFBF0] border border-[#F0D9A8] rounded-2xl p-4 text-center">
                    <ShieldCheck size={18} className="mx-auto text-[#8D6E3A]" />
                    <div className="font-extrabold text-2xl text-[#8D6E3A] mt-2">COD</div>
                    <div className="text-[10px] text-[#9A8A6B]">دفع عند الاستلام</div>
                  </div>
                </div>
                <div className="mt-4 bg-gradient-to-br from-[#1A1A1E] to-[#2D2D35] rounded-2xl p-4 text-white">
                  <div className="text-[10px] text-white/50 mb-1">جاهز للإطلاق</div>
                  <div className="text-sm font-bold">أنشئ متجرك في أقل من دقيقة</div>
                  <div className="text-[11px] text-[#C9A96A] mt-1 flex items-center gap-1">
                    <Check size={12} /> لوحة تحكم احترافية + شحن 58 ولاية
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { v: '+500', l: 'متجر نشط' },
              { v: '+15K', l: 'طلب مكتمل' },
              { v: '58', l: 'ولاية مغطاة' },
              { v: '99.9%', l: 'وقت تشغيل' },
            ].map(s => (
              <div key={s.l} className="text-center bg-white border border-[#EDE6D8] rounded-2xl py-5">
                <div className="text-2xl md:text-3xl font-extrabold bg-gradient-to-l from-[#C9A96A] to-[#A02A5B] bg-clip-text text-transparent">{s.v}</div>
                <div className="text-xs text-[#9A8A6B] mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Features ═════════════════════════════════════════════════ */}
      <section id="features" className="bg-white border-y border-[#EDE6D8] py-20">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <span className="text-[#C9A96A] text-xs font-bold tracking-widest">FEATURES</span>
            <h2 className="text-[36px] font-extrabold text-[#1A1A1E] mt-3">كل ما تحتاجه في مكان واحد</h2>
            <p className="text-[#7A6F5A] mt-3 max-w-[600px] mx-auto">منصتنا تتعامل مع كل التفاصيل التقنية لتُركّز على مبيعاتك</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.t} className="group bg-[#FFFCF8] border border-[#EDE6D8] rounded-3xl p-7 hover:shadow-xl hover:border-[#F0D9A8] transition-all duration-300">
                <div className="w-14 h-14 rounded-2xl grid place-items-center mb-5 transition-transform group-hover:scale-110" style={{ background: f.c + '15' }}>
                  <f.icon size={24} style={{ color: f.c }} />
                </div>
                <h3 className="font-bold text-[#1A1A1E] text-xl mb-2">{f.t}</h3>
                <p className="text-sm text-[#7A6F5A] leading-7">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Integrations ═════════════════════════════════════════════ */}
      <section id="integrations" className="py-20 bg-[#FFFCF8]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="text-[#A02A5B] text-xs font-bold tracking-widest">INTEGRATIONS</span>
            <h2 className="text-[36px] font-extrabold text-[#1A1A1E] mt-3">متكامل مع أدواتك المفضلة</h2>
            <p className="text-[#7A6F5A] mt-3">اربط متجرك بشركات التوصيل وأدوات التسويق الجزائرية والعالمية</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {integrations.map(int => (
              <div key={int.name} className="bg-white border border-[#EDE6D8] rounded-2xl p-5 text-center hover:shadow-lg hover:border-[#F0D9A8] transition">
                <div className="w-12 h-12 rounded-xl grid place-items-center mx-auto mb-3" style={{ background: int.color + '15' }}>
                  <int.icon size={22} style={{ color: int.color }} />
                </div>
                <div className="font-bold text-sm text-[#1A1A1E]">{int.name}</div>
                <div className="text-[11px] text-[#9A8A6B] mt-0.5">{int.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ How it works ═════════════════════════════════════════════ */}
      <section id="how" className="py-20 bg-white border-y border-[#EDE6D8]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <span className="text-[#C9A96A] text-xs font-bold tracking-widest">HOW IT WORKS</span>
            <h2 className="text-[36px] font-extrabold text-[#1A1A1E] mt-3">3 خطوات لمتجرك الخاص</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: '01', t: 'سجّل حساب', d: 'أنشئ حساب تاجر باسمك وبريدك الإلكتروني. تختار اسم المتجر والسلاج (الرابط الفرعي).' },
              { n: '02', t: 'خصّص متجرك', d: 'يُضاف تلقائياً منتجات تجريبية وولايات و3 مجالات. عدّلها أو احذفها وأضف منتجاتك الخاصة.' },
              { n: '03', t: 'ابدأ البيع', d: 'شارك رابط متجرك واستقبل الطلبات. كل طلب يأتيك في لوحة التحكم مع تأكيد هاتفي.' },
            ].map(s => (
              <div key={s.n} className="relative bg-[#FFFCF8] border border-[#EDE6D8] rounded-3xl p-8 overflow-hidden">
                <div className="absolute top-0 left-0 text-[100px] font-extrabold text-[#F5EFE6] leading-none select-none">{s.n}</div>
                <div className="relative">
                  <h3 className="font-bold text-xl text-[#1A1A1E] mb-3">{s.t}</h3>
                  <p className="text-sm text-[#7A6F5A] leading-7">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Free Forever ═════════════════════════════════════════════ */}
      <section id="free" className="py-20 bg-gradient-to-b from-[#1A1A1E] to-[#0D0D0F]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <span className="text-[#C9A96A] text-xs font-bold tracking-widest">FREE FOREVER</span>
            <h2 className="text-[36px] font-extrabold text-white mt-3">مجاني 100% — للأبد</h2>
            <p className="text-white/50 mt-3">بدون اشتراك • بدون عمولة • بدون بطاقة بنكية</p>
          </div>
          <div className="max-w-2xl mx-auto">
            {/* Big FREE card */}
            <div className="bg-gradient-to-b from-[#C9A96A] to-[#B8945A] rounded-3xl p-8 text-center shadow-2xl">
              <div className="text-[10px] font-bold bg-white text-[#C9A96A] px-3 py-1 rounded-full inline-block mb-4">كل المزايا مجانية</div>
              <div className="text-6xl font-extrabold text-white mb-2">0 دج</div>
              <div className="text-white/80 text-sm mb-6">للأبد — بدون حد زمني</div>
              <div className="grid md:grid-cols-2 gap-3 text-right">
                {[
                  'متاجر غير محدودة',
                  'منتجات غير محدودة',
                  'طلبات غير محدودة',
                  'الدفع عند الاستلام (COD)',
                  'شحن 58 ولاية',
                  '10 شركات توصيل',
                  'السوق العام (Marketplace)',
                  'تتبع Meta + TikTok Pixel',
                  'لوحة تحكم احترافية',
                  'نطاق فرعي مجاني',
                ].map(feature => (
                  <div key={feature} className="flex items-center gap-2 text-white/90 text-sm">
                    <Check size={16} className="text-white shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowRegister(true)}
                className="mt-8 bg-white text-[#1A1A1E] px-8 py-4 rounded-full font-extrabold hover:bg-[#FDF2F6] transition shadow-xl"
              >
                أنشئ متجرك الآن — مجاناً
              </button>
            </div>
            {/* Why free? explanation */}
            <div className="mt-8 bg-white/[0.04] border border-white/10 rounded-2xl p-6 text-white/60 text-sm leading-7">
              <b className="text-[#C9A96A]">لماذا مجاني؟</b> هدفنا هو بناء أكبر سوق جزائري للتجارة الإلكترونية. كل تاجر ينضم = منتجات أكثر في السوق العام = زوار أكثر = مبيعات أكثر للجميع. نكبر معك، لذلك المنصة مجانية للأبد. في المستقبل سنضيف ميزات اختيارية مدفوعة (إعلانات ممولة، تحليلات متقدمة) — لكن الأساس سيبقى مجاناً دائماً.
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ══════════════════════════════════════════════════════ */}
      <section id="faq" className="py-20 bg-[#FFFCF8]">
        <div className="max-w-[800px] mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <span className="text-[#C9A96A] text-xs font-bold tracking-widest">FAQ</span>
            <h2 className="text-[36px] font-extrabold text-[#1A1A1E] mt-3">أسئلة شائعة</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white border border-[#EDE6D8] rounded-2xl overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full px-5 py-4 flex items-center justify-between text-right hover:bg-[#FFFCF8] transition"
                >
                  <span className="font-bold text-sm text-[#1A1A1E]">{faq.q}</span>
                  <ChevronDown size={18} className={`text-[#C9A96A] transition-transform shrink-0 ms-2 ${faqOpen === i ? 'rotate-180' : ''}`} />
                </button>
                {faqOpen === i && (
                  <div className="px-5 pb-4 text-sm text-[#7A6F5A] leading-7 border-t border-[#EDE6D8] pt-3">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Final CTA ════════════════════════════════════════════════ */}
      <section className="py-20 bg-gradient-to-br from-[#1A1A1E] to-[#0D0D0F] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C9A96A]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#A02A5B]/8 rounded-full blur-3xl" />
        <div className="relative max-w-[800px] mx-auto px-4 text-center">
          <h2 className="text-[32px] font-extrabold text-white">جاهز تبدأ؟</h2>
          <p className="text-white/50 mt-3">انضم لعشرات التجار الجزائريين الذين يبيعون عبر Amugar</p>
          <button onClick={() => setShowRegister(true)} className="mt-8 bg-gradient-to-l from-[#C9A96A] to-[#B8945A] text-white px-10 py-4 rounded-full font-bold flex items-center gap-2 mx-auto hover:opacity-90 transition shadow-xl">
            <Rocket size={20} /> أنشئ متجرك الآن — مجاناً
          </button>
        </div>
      </section>

      {/* ═══ Footer ═══════════════════════════════════════════════════ */}
      <footer className="bg-[#0D0D0F] text-white/40 py-10">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 grid md:grid-cols-3 gap-8">
          <div>
            <Logo to={null} imgClassName="h-8 w-auto" textClassName="text-white" />
            <p className="text-xs mt-3 leading-6">منصة المتاجر الجزائرية — أنشئ متجرك الإلكتروني في دقيقة مع الدفع عند الاستلام لـ 58 ولاية.</p>
          </div>
          <div>
            <div className="font-bold text-white text-sm mb-3">روابط</div>
            <div className="space-y-2 text-xs">
              <a href="#features" className="block hover:text-white transition">المزايا</a>
              <a href="#free" className="block hover:text-white transition">مجاني 100%</a>
              <a href="#faq" className="block hover:text-white transition">الأسئلة الشائعة</a>
              <a href="/super-admin" className="block hover:text-white transition">لوحة المدير العام</a>
            </div>
          </div>
          <div>
            <div className="font-bold text-white text-sm mb-3">تواصل معنا</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2"><Mail size={12} /> support@amugar.saas</div>
              <div className="flex items-center gap-2"><Phone size={12} /> 0550 12 34 56</div>
              <div className="flex items-center gap-2"><Globe size={12} /> الجزائر العاصمة</div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 mt-8 pt-6 text-center text-xs">
          © 2026 Amugar — منصة المتاجر الجزائرية. جميع الحقوق محفوظة.
        </div>
      </footer>

      {/* ═══ Register Modal — SIMPLIFIED (4 fields only) ══════════════ */}
      {showRegister && (
        <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center p-4 bg-[#1A1A1E]/70 backdrop-blur-md overflow-y-auto" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-[28px] p-7 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-[#EDE6D8] my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-xl text-[#1A1A1E]">أنشئ متجرك مجاناً</h3>
              <button onClick={() => setShowRegister(false)} className="w-8 h-8 rounded-full bg-[#FFFCF8] border border-[#EDE6D8] grid place-items-center hover:bg-white"><X size={16} /></button>
            </div>
            {/* Free badge */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-4 text-center text-xs font-bold text-emerald-700">
              مجاني 100% — بدون بطاقة بنكية، بدون اشتراك، بدون عمولة
            </div>
            <form onSubmit={handleRegister} className="space-y-3">
              {/* Field 1: Full name */}
              <div className="relative">
                <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8AA8E]" />
                <input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} placeholder="الاسم الكامل" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-3 pr-10 text-sm outline-none focus:border-[#C9A96A] text-right" />
              </div>
              {/* Field 2: Email */}
              <div className="relative">
                <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8AA8E]" />
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="البريد الإلكتروني" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-3 pr-10 text-sm outline-none focus:border-[#C9A96A] text-right" dir="rtl" />
              </div>
              {/* Field 3: Password */}
              <div className="relative">
                <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8AA8E]" />
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="كلمة المرور" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-3 pr-10 text-sm outline-none focus:border-[#C9A96A] text-right" dir="rtl" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B8AA8E] hover:text-[#1A1A1E]">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              {/* Field 4: Store name (Arabic) */}
              <div className="relative">
                <Store size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8AA8E]" />
                <input value={form.storeName} onChange={e => setForm({...form, storeName: e.target.value})} placeholder="اسم متجرك" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-3 pr-10 text-sm outline-none focus:border-[#C9A96A] text-right" />
              </div>
              {/* Field 5: Store type (domain picker) */}
              <div>
                <label className="block text-[11px] font-bold text-[#8D6E3A] mb-1.5 px-1">ماذا يبيع متجرك؟</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {STORE_TYPES.map(t => {
                    const Icon = t.icon
                    const active = form.domainType === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setForm({...form, domainType: t.id})}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition ${
                          active
                            ? 'border-[#C9A96A] bg-[#FFFBF0] shadow-sm'
                            : 'border-[#EDE6D8] bg-white hover:border-[#C9A96A]/40'
                        }`}
                      >
                        <Icon size={16} className={active ? 'text-[#C9A96A]' : 'text-[#8D6E3A]'} />
                        <span className={`text-[9px] font-bold leading-tight text-center ${active ? 'text-[#1A1A1E]' : 'text-[#8D6E3A]'}`}>{t.labelAr}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] text-[#9A8A6B] mt-1.5 px-1">
                  {STORE_TYPES.find(t => t.id === form.domainType)?.descAr || 'متجر عام متعدد الفئات'}
                </p>
              </div>
              {/* Hint: your store will be live instantly */}
              <div className="bg-[#FFFBF0] border border-[#F5E6C8] rounded-xl px-3 py-2 text-[11px] text-[#8D6E3A] leading-5">
                متجرك سيكون حياً فوراً! منتجاتك ستظهر تلقائياً في السوق العام (<a href="/marketplace" target="_blank" className="underline font-bold">/marketplace</a>) ويمكنك البدء في البيع مباشرة.
              </div>
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جاري الإنشاء...</>
                ) : (
                  <>إنشاء متجري مجاناً →</>
                )}
              </button>
              <p className="text-[11px] text-[#9A8A6B] text-center">مجاني للأبد — بدون أي التزام</p>
            </form>
            <div className="mt-4 text-center text-sm text-[#9A8A6B]">
              لديك حساب بالفعل؟ <button type="button" onClick={() => { setShowRegister(false); setShowLogin(true) }} className="text-[#A02A5B] font-bold hover:underline">سجّل الدخول</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Login Modal ═══════════════════════════════════════════════ */}
      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center p-4 bg-[#1A1A1E]/70 backdrop-blur-md overflow-y-auto" onClick={() => setShowLogin(false)}>
          <div className="bg-white rounded-[28px] p-7 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border border-[#EDE6D8] my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-xl text-[#1A1A1E]">دخول التاجر</h3>
              <button onClick={() => setShowLogin(false)} className="w-8 h-8 rounded-full bg-[#FFFCF8] border border-[#EDE6D8] grid place-items-center hover:bg-white"><X size={16} /></button>
            </div>
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="relative">
                <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8AA8E]" />
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="البريد الإلكتروني" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#C9A96A] text-right" dir="rtl" />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8AA8E]" />
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="كلمة المرور" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#C9A96A] text-right" dir="rtl" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B8AA8E] hover:text-[#1A1A1E]">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50">
                {loading ? 'جاري الدخول...' : 'دخول →'}
              </button>
              <div className="text-sm text-[#9A8A6B] text-center mt-2">
                ليس لديك حساب؟ <button type="button" onClick={() => { setShowLogin(false); setShowRegister(true) }} className="text-[#A02A5B] font-bold hover:underline">أنشئ متجرك الآن</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
