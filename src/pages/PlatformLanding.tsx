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
import {
  ArrowLeft, Check, Store, Crown, Rocket, ShoppingBag, Truck, ShieldCheck,
  Sparkles, Globe, Star, TrendingUp, Zap, X, ChevronDown, Palette,
  Package, BarChart3, Phone, Mail, Lock, User, Eye, EyeOff,
} from 'lucide-react'

const PLATFORM_APEX = ((import.meta as any).env?.VITE_PLATFORM_APEX || 'lumiere.saas').toLowerCase()

const plans = [
  {
    id: 'free_trial',
    name: 'تجريبي',
    price: '0',
    period: '14 يوم',
    desc: 'جرّب كل المزايا مجاناً',
    features: ['متجر واحد', 'منتجات غير محدودة', 'طلبات غير محدودة', 'الدفع عند الاستلام', 'حساب الشحن لـ 58 ولاية'],
    cta: 'ابدأ مجاناً',
    accent: false,
  },
  {
    id: 'starter',
    name: 'ستارتر',
    price: '2,500',
    period: 'دج/شهر',
    desc: 'للتجار الصغار',
    features: ['كل مزايا التجريبي', 'نطاق فرعي مخصص', 'لوحة تحكم كاملة', 'تتبع Meta + TikTok Pixel', 'دعم بالبريد'],
    cta: 'اشترك الآن',
    accent: false,
  },
  {
    id: 'pro',
    name: 'برو',
    price: '6,900',
    period: 'دج/شهر',
    desc: 'الأكثر شعبية',
    features: ['كل مزايا ستارتر', 'نطاق مخصص (mystore.dz)', 'متجريات متقدمة', 'أولوية الدعم', 'متغيرات لانهائية'],
    cta: 'اشترك الآن',
    accent: true,
  },
  {
    id: 'vip',
    name: 'VIP',
    price: '15,000',
    period: 'دج/شهر',
    desc: 'للتجار الكبار',
    features: ['كل مزايا برو', 'متاجر متعددة', 'API كامل', 'مدير حساب مخصص', 'تخصيص الهوية البصرية'],
    cta: 'تواصل معنا',
    accent: false,
  },
]

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
  { q: 'هل أحتاج خبرة تقنية لإنشاء متجر؟', a: 'لا، المنصة لا تتطلب أي كود. تملأ نموذج التسجيل، ويُنشأ متجرك تلقائياً مع منتجات تجريبية ولوحة تحكم كاملة. كل ما تحتاجه هو بريد إلكتروني وكلمة مرور.' },
  { q: 'كم تكلفة إنشاء متجر؟', a: 'الخطة التجريبية مجانية لمدة 14 يوماً بدون بطاقة بنكية. بعدها تختار الخطة المناسبة: ستارتر (2,500 دج/شهر)، برو (6,900 دج/شهر)، أو VIP (15,000 دج/شهر).' },
  { q: 'هل يدعم الدفع عند الاستلام (COD)؟', a: 'نعم، نظام COD كامل مدمج في كل المتاجر. كل طلب يأتيك في لوحة التحكم مع كشف الطلبات المكررة تلقائياً وحماية من الإرسال المزدوج.' },
  { q: 'كيف يعمل الشحن للولايات؟', a: 'حاسبة شحن مدمجة لكل 58 ولاية جزائرية مع أسعار قابلة للتخصيص. يمكنك أيضاً ربط متجرك بـ Yalidine و ZR Express لإنشاء بوالص الشحن تلقائياً.' },
  { q: 'هل يمكنني ربط نطاقي الخاص؟', a: 'نعم، في خطة برو وما فوق. يمكنك ربط نطاق مخصص مثل mystore.dz مع شهادة SSL مجانية. في الخطة المجانية تحصل على نطاق فرعي slug.lumiere.saas.' },
  { q: 'هل المنصة تدعم Meta Pixel و TikTok Pixel؟', a: 'نعم، مدمجان تلقائياً مع أحداث ViewContent، AddToCart، InitiateCheckout، Purchase. تُسجل المفاتيح من لوحة التحكم في تبويب "التتبع".' },
]

export default function PlatformLanding() {
  const { login, user } = useTenant()
  const nav = useNavigate()
  const [showRegister, setShowRegister] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', phone: '',
    storeName: '', storeNameAr: '', slug: '',
  })
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If the merchant is already logged in, show a "go to my dashboard"
  // button instead of the register/login CTAs. This solves the "where
  // is my dashboard?" problem — the merchant lands here from a fresh
  // navigation and sees the direct link to their admin panel.
  const goToDashboard = () => {
    const slug = localStorage.getItem('lumiere_saas_active_slug')
    const sid = localStorage.getItem('lumiere_saas_active_store')
    if (slug) window.location.href = `/admin?store=${encodeURIComponent(slug)}`
    else if (sid) window.location.href = `/admin?storeId=${encodeURIComponent(sid)}`
    else nav('/admin')
  }

  // ─── Auto-slugify ──────────────────────────────────────────────────
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.fullName || !form.email || !form.password || !form.storeName) {
      setError('يرجى ملء جميع الحقول المطلوبة')
      return
    }
    setLoading(true)
    try {
      const res = await authRegister(form)
      try {
        localStorage.setItem('lumiere_token', res.token)
        localStorage.setItem('lumiere_saas_user', JSON.stringify(res.user))
        localStorage.setItem('lumiere_saas_active_store', res.storeId)
      } catch {}
      const slug = form.slug || slugify(form.storeName)
      localStorage.setItem('lumiere_saas_active_slug', slug)

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
      const cachedUser = JSON.parse(localStorage.getItem('lumiere_saas_user') || '{}')
      if (cachedUser.role === 'super_admin') {
        nav('/super-admin')
      } else {
        // IMPORTANT: redirect the merchant to their DASHBOARD (/admin),
        // not the storefront. The previous code redirected to /?store=slug
        // which landed the merchant on the customer-facing storefront —
        // they'd then have to manually find the "manage products" button
        // to reach their actual dashboard. Now we go straight to /admin
        // with their store's slug so they land on the overview tab.
        const slug = localStorage.getItem('lumiere_saas_active_slug')
        const sid = localStorage.getItem('lumiere_saas_active_store')
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
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A1A1E] to-[#3D3D45] grid place-items-center">
              <Store size={18} className="text-[#C9A96A]" />
            </div>
            <div className="leading-none">
              <div className="font-extrabold text-[#1A1A1E] text-lg">LUMIÈRE <span className="text-[#C9A96A]">SaaS</span></div>
              <div className="text-[10px] tracking-widest text-[#9A8A6B]">منصة المتاجر الجزائرية</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#1A1A1E]">
            <a href="#features" className="hover:text-[#C9A96A] transition">المزايا</a>
            <a href="#integrations" className="hover:text-[#C9A96A] transition">التكاملات</a>
            <a href="#pricing" className="hover:text-[#C9A96A] transition">الأسعار</a>
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
                أنشئ متجرك الإلكتروني<br />
                <span className="bg-gradient-to-l from-[#C9A96A] via-[#A02A5B] to-[#7A1F44] bg-clip-text text-transparent">في أقل من دقيقة</span>
              </h1>
              <p className="text-[#5A5340] text-lg leading-8 mt-6 max-w-[560px]">
                منصة جزائرية متكاملة لإنشاء متاجر الدفع عند الاستلام. احصل على متجر باسمك الخاص، لوحة تحكم احترافية، حاسبة شحن لـ 58 ولاية، وتتبع تلقائي لكل الطلبات — بدون كود وبدون خبرة تقنية.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <button onClick={() => setShowRegister(true)} className="bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition shadow-xl shadow-[#1A1A1E]/15">
                  <Rocket size={18} /> ابدأ متجرك الآن
                </button>
                <a href="#pricing" className="bg-white border border-[#EDE6D8] text-[#1A1A1E] px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:bg-[#F5EFE6] transition">
                  شاهد الأسعار
                </a>
              </div>
              <div className="flex items-center gap-6 mt-8 text-sm text-[#7A6F5A]">
                <span className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> 14 يوم تجربة مجانية</span>
                <span className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> بدون بطاقة بنكية</span>
                <span className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> دعم بالعربية</span>
              </div>
            </div>

            {/* Dashboard preview card */}
            <div className="relative">
              <div className="absolute -inset-6 bg-gradient-to-br from-[#C9A96A]/20 to-[#A02A5B]/10 rounded-[40px] blur-3xl" />
              <div className="relative bg-white rounded-[28px] border border-[#EDE6D8] shadow-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1A1A1E] grid place-items-center text-[#C9A96A] font-bold text-sm">L</div>
                    <div>
                      <div className="font-bold text-sm text-[#1A1A1E]">لوحة تحكم المتجر</div>
                      <div className="text-[10px] text-[#9A8A6B]">{typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : 'lumiere.saas'}/?store=demo</div>
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
                    <Check size={12} /> لوحة تحكم احترافية + شحن 58 ولاية ✓
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

      {/* ═══ Pricing ══════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 bg-gradient-to-b from-[#1A1A1E] to-[#0D0D0F]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <span className="text-[#C9A96A] text-xs font-bold tracking-widest">PRICING</span>
            <h2 className="text-[36px] font-extrabold text-white mt-3">خطط بسيطة، شفافة</h2>
            <p className="text-white/50 mt-3">14 يوم تجربة مجانية على كل الخطط — بدون بطاقة بنكية</p>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {plans.map(p => (
              <div key={p.id} className={`rounded-3xl p-6 border transition-all ${p.accent ? 'bg-gradient-to-b from-[#A02A5B] to-[#7A1F44] border-[#A02A5B] text-white shadow-2xl scale-105' : 'bg-white/[0.04] border-white/10 text-white hover:bg-white/[0.08]'}`}>
                {p.accent && <div className="text-[10px] font-bold bg-white text-[#A02A5B] px-3 py-1 rounded-full inline-block mb-3">الأكثر شعبية</div>}
                <div className="font-bold text-lg">{p.name}</div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold">{p.price}</span>
                  <span className="text-sm text-white/50"> {p.period}</span>
                </div>
                <div className={`text-xs mt-1 ${p.accent ? 'text-white/70' : 'text-white/50'}`}>{p.desc}</div>
                <ul className="mt-5 space-y-3 text-sm">
                  {p.features.map(f => (
                    <li key={f} className="flex gap-2">
                      <Check size={16} className={`shrink-0 mt-0.5 ${p.accent ? 'text-white' : 'text-[#C9A96A]'}`} />
                      <span className={p.accent ? 'text-white/90' : 'text-white/80'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowRegister(true)}
                  className={`mt-6 w-full py-3 rounded-full font-bold text-sm transition ${p.accent ? 'bg-white text-[#A02A5B] hover:bg-[#FDF2F6]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
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
          <p className="text-white/50 mt-3">انضم لعشرات التجار الجزائريين الذين يبيعون عبر LUMIÈRE SaaS</p>
          <button onClick={() => setShowRegister(true)} className="mt-8 bg-gradient-to-l from-[#C9A96A] to-[#B8945A] text-white px-10 py-4 rounded-full font-bold flex items-center gap-2 mx-auto hover:opacity-90 transition shadow-xl">
            <Rocket size={20} /> أنشئ متجرك الآن — مجاناً
          </button>
        </div>
      </section>

      {/* ═══ Footer ═══════════════════════════════════════════════════ */}
      <footer className="bg-[#0D0D0F] text-white/40 py-10">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 grid md:grid-cols-3 gap-8">
          <div>
            <div className="font-extrabold text-white text-lg flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 grid place-items-center"><Store size={16} className="text-[#C9A96A]" /></div>
              LUMIÈRE SaaS
            </div>
            <p className="text-xs mt-3 leading-6">منصة المتاجر الجزائرية — أنشئ متجرك الإلكتروني في دقيقة مع الدفع عند الاستلام لـ 58 ولاية.</p>
          </div>
          <div>
            <div className="font-bold text-white text-sm mb-3">روابط</div>
            <div className="space-y-2 text-xs">
              <a href="#features" className="block hover:text-white transition">المزايا</a>
              <a href="#pricing" className="block hover:text-white transition">الأسعار</a>
              <a href="#faq" className="block hover:text-white transition">الأسئلة الشائعة</a>
              <a href="/super-admin" className="block hover:text-white transition">لوحة المدير العام</a>
            </div>
          </div>
          <div>
            <div className="font-bold text-white text-sm mb-3">تواصل معنا</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2"><Mail size={12} /> support@lumiere.saas</div>
              <div className="flex items-center gap-2"><Phone size={12} /> 0550 12 34 56</div>
              <div className="flex items-center gap-2"><Globe size={12} /> الجزائر العاصمة</div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 mt-8 pt-6 text-center text-xs">
          © 2026 LUMIÈRE SaaS — منصة المتاجر الجزائرية. جميع الحقوق محفوظة.
        </div>
      </footer>

      {/* ═══ Register Modal ════════════════════════════════════════════ */}
      {showRegister && (
        <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center p-4 bg-[#1A1A1E]/70 backdrop-blur-md overflow-y-auto" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-[28px] p-7 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-[#EDE6D8] my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-xl text-[#1A1A1E]">أنشئ متجرك في دقيقة</h3>
              <button onClick={() => setShowRegister(false)} className="w-8 h-8 rounded-full bg-[#FFFCF8] border border-[#EDE6D8] grid place-items-center hover:bg-white"><X size={16} /></button>
            </div>
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="relative">
                <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8AA8E]" />
                <input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} placeholder="الاسم الكامل *" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#C9A96A] text-right" />
              </div>
              <div className="relative">
                <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8AA8E]" />
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="البريد الإلكتروني *" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#C9A96A] text-right" dir="rtl" />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8AA8E]" />
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="كلمة المرور *" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#C9A96A] text-right" dir="rtl" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B8AA8E] hover:text-[#1A1A1E]">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="الهاتف (اختياري)" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A] text-right" dir="rtl" />
              <div className="border-t border-[#EDE6D8] pt-3 mt-3">
                <div className="text-xs font-bold text-[#7A6F5A] mb-2">معلومات المتجر</div>
                <input value={form.storeName} onChange={e => {
                  const v = e.target.value
                  setForm(prev => ({ ...prev, storeName: v, slug: slugManuallyEdited ? prev.slug : slugify(v) }))
                }} placeholder="اسم المتجر (فرنسي/إنجليزي) *" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A] text-right" />
                <input value={form.storeNameAr} onChange={e => setForm({...form, storeNameAr: e.target.value})} placeholder="اسم المتجر (عربي)" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A] text-right mt-2" />
                <div className="flex items-center gap-2 mt-2">
                  {(() => {
                    const hostname = typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : PLATFORM_APEX
                    const isVercelFree = hostname.includes('vercel.app') || hostname.includes('localhost') || hostname === '127.0.0.1'
                    if (isVercelFree) {
                      return (
                        <>
                          <span className="text-xs text-[#9A8A6B] truncate">{hostname}/?store=</span>
                          <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} onFocus={() => setSlugManuallyEdited(true)} placeholder="my-store" className="flex-1 min-w-0 border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
                        </>
                      )
                    }
                    return (
                      <>
                        <span className="text-xs text-[#9A8A6B]">https://</span>
                        <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} onFocus={() => setSlugManuallyEdited(true)} placeholder="my-store" className="flex-1 border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
                        <span className="text-xs text-[#9A8A6B]">.{hostname}</span>
                      </>
                    )
                  })()}
                </div>
              </div>
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-gradient-to-l from-[#1A1A1E] to-[#2D2D35] text-white py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50">
                {loading ? 'جاري الإنشاء...' : 'إنشاء المتجر →'}
              </button>
              <p className="text-[11px] text-[#9A8A6B] text-center">بالضغط على "إنشاء المتجر" أنت توافق على شروط الخدمة وسياسة الخصوصية</p>
            </form>
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
