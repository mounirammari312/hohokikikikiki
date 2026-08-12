/**
 * PlatformLanding — the SaaS marketing site shown on the bare platform
 * domain (lumiere.saas). Explains the product, shows pricing, and
 * offers a "Create your store in 1 minute" form.
 *
 * When a merchant registers, a new TenantStore + MerchantUser are
 * created server-side, the new store is seeded with default catalog
 * data, and the user is redirected to their subdomain
 * (slug.lumiere.saas) where the storefront + dashboard await.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import { authRegister } from '../services/api/client'
import { ArrowLeft, Check, Store, Zap, Crown, Rocket, ShoppingBag, Truck, ShieldCheck, Sparkles, Globe, Star, TrendingUp } from 'lucide-react'

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

export default function PlatformLanding() {
  const { login } = useTenant()
  const nav = useNavigate()
  const [showRegister, setShowRegister] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', phone: '',
    storeName: '', storeNameAr: '', slug: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      // Cache the token + user — TenantContext picks it up.
      // Write the token under BOTH keys (canonical `lumiere_token` +
      // legacy `lumiere_saas_token`) so all client code paths can find it.
      try {
        localStorage.setItem('lumiere_token', res.token)
        localStorage.setItem('lumiere_saas_token', res.token)
        localStorage.setItem('lumiere_saas_user', JSON.stringify(res.user))
        localStorage.setItem('lumiere_saas_active_store', res.storeId)
      } catch {}
      // Compute the slug (matches what the server used to create the store)
      const slug = form.slug || form.storeName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      // Cache the slug too so the client's API layer can attach it as
      // `x-store-slug` for environments where subdomains aren't usable.
      localStorage.setItem('lumiere_saas_active_slug', slug)

      // ─── Build the store URL dynamically based on environment ───────
      // On Vercel's free plan (vercel.app) and on localhost, wildcard
      // subdomains aren't available — so we use a query-param approach
      // (`?store=<slug>`) that works on the SAME hostname the merchant
      // is already on. On a real production domain with wildcard DNS,
      // we use the proper subdomain `<slug>.<apex>`.
      const hostname = window.location.hostname.replace(/^www\./, '')
      const isVercelFree =
        hostname.includes('vercel.app') ||
        hostname.includes('localhost') ||
        hostname === '127.0.0.1'
      const storeUrl = isVercelFree
        ? `${window.location.origin}/?store=${encodeURIComponent(slug)}`
        : `${window.location.protocol}//${slug}.${hostname}`

      // Navigate to the new store's admin (same-origin so the session
      // token in localStorage carries over — no re-login needed).
      // We add both ?store= (for tenant resolution) and ?storeId=
      // (for the explicit dashboard scope) so the dashboard is
      // immediately scoped to the right store.
      const adminUrl = isVercelFree
        ? `${window.location.origin}/admin?store=${encodeURIComponent(slug)}&storeId=${res.storeId}`
        : `${storeUrl}/admin?storeId=${res.storeId}`
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
      nav('/super-admin')
    } catch (err: any) {
      setError(err?.message || 'فشل تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFCF8]">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 bg-[#FFFCF8]/90 backdrop-blur-xl border-b border-[#EDE6D8]">
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
            <a href="#pricing" className="hover:text-[#C9A96A] transition">الأسعار</a>
            <a href="#how" className="hover:text-[#C9A96A] transition">كيف يعمل</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowLogin(true); setShowRegister(false) }} className="text-sm font-bold px-4 py-2 rounded-full hover:bg-[#F5EFE6] transition">دخول</button>
            <button onClick={() => { setShowRegister(true); setShowLogin(false) }} className="text-sm font-bold px-4 py-2 rounded-full bg-[#1A1A1E] text-white hover:bg-black transition">أنشئ متجرك</button>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-6 pt-12 md:pt-20 pb-16">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] text-xs font-bold px-3 py-1 rounded-full">
              <Sparkles size={12} /> منصة SaaS متعددة المتاجر • إطلاق 2026
            </span>
            <h1 className="text-[36px] md:text-[56px] font-extrabold leading-[1.05] text-[#1A1A1E] mt-4">
              أنشئي متجرك الإلكتروني<br />
              <span className="bg-gradient-to-l from-[#C9A96A] to-[#A02A5B] bg-clip-text text-transparent">في أقل من دقيقة</span>
            </h1>
            <p className="text-[#5A5340] text-lg leading-7 mt-4 max-w-[560px]">
              منصة جزائرية متكاملة لإنشاء متاجر الدفع عند الاستلام. احصلي على متجر بأسمك الخاص، لوحة تحكم احترافية، حاسبة شحن لـ 58 ولاية، وتتبع تلقائي لكل الطلبات — بدون كود وبدون خبرة تقنية.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <button onClick={() => setShowRegister(true)} className="bg-[#1A1A1E] text-white px-7 py-3.5 rounded-full font-bold flex items-center gap-2 hover:bg-black transition shadow-lg shadow-[#1A1A1E]/10">
                <Rocket size={18} /> ابدأي متجرك الآن
              </button>
              <a href="#pricing" className="bg-white border border-[#EDE6D8] text-[#1A1A1E] px-7 py-3.5 rounded-full font-bold flex items-center gap-2 hover:bg-[#F5EFE6] transition">
                شاهدي الأسعار
              </a>
            </div>
            <div className="flex items-center gap-6 mt-8 text-xs text-[#7A6F5A]">
              <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> 14 يوم تجربة مجانية</span>
              <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> بدون بطاقة بنكية</span>
              <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> دعم بالعربية</span>
            </div>
          </div>

          {/* Floating dashboard preview */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-[#C9A96A]/20 to-[#A02A5B]/10 rounded-[32px] blur-2xl" />
            <div className="relative bg-white rounded-[24px] border border-[#EDE6D8] shadow-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#1A1A1E] grid place-items-center text-[#C9A96A] font-bold text-sm">L</div>
                  <div>
                    <div className="font-bold text-sm text-[#1A1A1E]">لوحة تحكم LUMIÈRE</div>
                    <div className="text-[10px] text-[#9A8A6B]">{typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : 'lumiere.saas'}/?store=demo</div>
                  </div>
                </div>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full">● نشط</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl p-3">
                  <ShoppingBag size={14} className="text-[#C9A96A]" />
                  <div className="font-extrabold text-lg text-[#1A1A1E] mt-1">18</div>
                  <div className="text-[10px] text-[#9A8A6B]">منتج</div>
                </div>
                <div className="bg-[#FDF2F6] border border-[#F6C0D4] rounded-xl p-3">
                  <TrendingUp size={14} className="text-[#A02A5B]" />
                  <div className="font-extrabold text-lg text-[#A02A5B] mt-1">42</div>
                  <div className="text-[10px] text-[#7A1F44]">طلب</div>
                </div>
                <div className="bg-[#FFFBF0] border border-[#F0D9A8] rounded-xl p-3">
                  <Star size={14} className="text-[#8D6E3A]" />
                  <div className="font-extrabold text-lg text-[#8D6E3A] mt-1">4.9</div>
                  <div className="text-[10px] text-[#9A8A6B]">تقييم</div>
                </div>
              </div>
              <div className="mt-3 bg-[#1A1A1E] rounded-xl p-3 text-white">
                <div className="text-[10px] text-white/60 mb-1">آخر طلب</div>
                <div className="text-sm font-bold">LUM-1043 — سارة من الجزائر</div>
                <div className="text-[11px] text-[#C9A96A] mt-1">+6,800 د.ج • الدفع عند الاستلام ✓</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="bg-white border-y border-[#EDE6D8] py-16">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="text-[#C9A96A] text-xs font-bold tracking-widest">FEATURES</span>
            <h2 className="text-[32px] font-extrabold text-[#1A1A1E] mt-2">كل ما تحتاجينه في مكان واحد</h2>
            <p className="text-[#7A6F5A] mt-2">منصتنا تتعامل مع كل التفاصيل التقنية لتُركّزي على مبيعاتك</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: ShoppingBag, t: 'إدارة المنتجات', d: 'أضيفي منتجات بصور متعددة، متغيرات (ألوان/مقاسات)، أسعار بالجملة، وحقول مخصصة حسب فئة المنتج.', c: '#C9A96A' },
              { icon: Truck, t: 'شحن 58 ولاية', d: 'حاسبة شحن مدمجة لكل ولايات الجزائر مع أسعار قابلة للتخصيص، توصيل للمنزل أو مكتب Yalidine.', c: '#A02A5B' },
              { icon: ShieldCheck, t: 'الدفع عند الاستلام', d: 'نظام COD كامل مع كشف الطلبات المكررة تلقائياً، تأكيد هاتفي، وحماية من الإرسال المزدوج.', c: '#8D6E3A' },
              { icon: Globe, t: 'نطاق مخصص', d: 'كل متجر يحصل على نطاق فرعي slug.lumiere.saas أو نطاقك الخاص mystore.dz مع شهادة SSL مجانية.', c: '#1A1A1E' },
              { icon: Zap, t: 'تتبع Pixels', d: 'Meta Pixel + TikTok Pixel مدمجان تلقائياً مع أحداث ViewContent، AddToCart، InitiateCheckout، Purchase.', c: '#C9A96A' },
              { icon: Sparkles, t: 'متجريات متقدمة', d: 'إحصائيات حية للمبيعات، الطلبات الجديدة، المنتجات الأكثر مبيعاً، والمخزون المنخفض.', c: '#A02A5B' },
            ].map(f => (
              <div key={f.t} className="bg-[#FFFCF8] border border-[#EDE6D8] rounded-2xl p-5 hover:shadow-lg hover:border-[#F0D9A8] transition">
                <div className="w-11 h-11 rounded-xl grid place-items-center" style={{ background: f.c + '20' }}>
                  <f.icon size={20} style={{ color: f.c }} />
                </div>
                <h3 className="font-bold text-[#1A1A1E] text-lg mt-3">{f.t}</h3>
                <p className="text-sm text-[#7A6F5A] leading-6 mt-1">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how" className="py-16">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="text-[#C9A96A] text-xs font-bold tracking-widest">HOW IT WORKS</span>
            <h2 className="text-[32px] font-extrabold text-[#1A1A1E] mt-2">3 خطوات لمتجرك الخاص</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '01', t: 'سجّلي حساب', d: 'أنشئي حساب تاجر باسمك وبريدك الإلكتروني. تختارين اسم المتجر والسلاج (الرابط الفرعي).' },
              { n: '02', t: 'خصّصي متجرك', d: 'تُضاف تلقائياً 8 منتجات تجريبية، 28 ولاية، و 3 مجالات (مجوهرات/أزياء/جمال) لتعدّليها كما تشائين.' },
              { n: '03', t: 'ابدئي البيع', d: 'شاركي رابط متجرك (slug.lumiere.saas) واستقبلي الطلبات. كل طلب يأتيك في لوحة التحكم مع تأكيد هاتفي.' },
            ].map(s => (
              <div key={s.n} className="bg-white border border-[#EDE6D8] rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-2 left-4 text-[80px] font-extrabold text-[#F5EFE6] leading-none select-none">{s.n}</div>
                <div className="relative">
                  <h3 className="font-bold text-xl text-[#1A1A1E]">{s.t}</h3>
                  <p className="text-sm text-[#7A6F5A] leading-6 mt-2">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="bg-[#1A1A1E] py-16">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="text-[#C9A96A] text-xs font-bold tracking-widest">PRICING</span>
            <h2 className="text-[32px] font-extrabold text-white mt-2">خطط بسيطة، شفافة</h2>
            <p className="text-white/60 mt-2">14 يوم تجربة مجانية على كل الخطط — بدون بطاقة بنكية</p>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {plans.map(p => (
              <div key={p.id} className={`rounded-2xl p-5 border ${p.accent ? 'bg-gradient-to-b from-[#A02A5B] to-[#7A1F44] border-[#A02A5B] text-white shadow-2xl' : 'bg-white/[0.04] border-white/10 text-white'}`}>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-lg">{p.name}</div>
                  {p.accent && <Crown size={16} className="text-[#FDF2F6]" />}
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold">{p.price}</span>
                  <span className={`text-sm ${p.accent ? 'text-white/80' : 'text-white/50'}`}> {p.period}</span>
                </div>
                <div className={`text-xs mt-1 ${p.accent ? 'text-white/80' : 'text-white/60'}`}>{p.desc}</div>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.features.map(f => (
                    <li key={f} className="flex gap-2">
                      <Check size={14} className={`shrink-0 mt-0.5 ${p.accent ? 'text-white' : 'text-[#C9A96A]'}`} />
                      <span className={p.accent ? 'text-white/90' : 'text-white/80'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowRegister(true)}
                  className={`mt-5 w-full py-2.5 rounded-full font-bold text-sm transition ${p.accent ? 'bg-white text-[#A02A5B] hover:bg-[#FDF2F6]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-16">
        <div className="max-w-[800px] mx-auto px-4 text-center">
          <h2 className="text-[28px] font-extrabold text-[#1A1A1E]">جاهزة تبدئي؟</h2>
          <p className="text-[#7A6F5A] mt-2">انضمي لعشرات التجار الجزائريين الذين يبيعون عبر LUMIÈRE SaaS</p>
          <button onClick={() => setShowRegister(true)} className="mt-6 bg-[#1A1A1E] text-white px-8 py-3.5 rounded-full font-bold flex items-center gap-2 mx-auto hover:bg-black transition">
            <Rocket size={18} /> أنشئي متجرك الآن — مجاناً
          </button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-[#1A1A1E] text-white/60 py-8 text-center text-xs">
        <div>© 2026 LUMIÈRE SaaS — منصة المتاجر الجزائرية. جميع الحقوق محفوظة.</div>
        <div className="mt-1">support@lumiere.saas • الجزائر العاصمة</div>
      </footer>

      {/* ─── Register Modal ─── */}
      {showRegister && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1A1A1E]/60 backdrop-blur-sm" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-[24px] p-6 w-full max-w-md shadow-2xl border border-[#EDE6D8]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-xl text-[#1A1A1E]">أنشئي متجرك في دقيقة</h3>
              <button onClick={() => setShowRegister(false)} className="text-[#9A8A6B] hover:text-[#1A1A1E] text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleRegister} className="space-y-3">
              <input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} placeholder="الاسم الكامل *" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="البريد الإلكتروني *" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="كلمة المرور *" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="الهاتف (اختياري)" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
              <div className="border-t border-[#EDE6D8] pt-3 mt-3">
                <div className="text-xs font-bold text-[#7A6F5A] mb-2">معلومات المتجر</div>
                <input value={form.storeName} onChange={e => setForm({...form, storeName: e.target.value})} placeholder="اسم المتجر (فرنسي/إنجليزي) *" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
                <input value={form.storeNameAr} onChange={e => setForm({...form, storeNameAr: e.target.value})} placeholder="اسم المتجر (عربي)" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A] mt-2" />
                <div className="flex items-center gap-2 mt-2">
                  {(() => {
                    const hostname = typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : PLATFORM_APEX
                    const isVercelFree = hostname.includes('vercel.app') || hostname.includes('localhost') || hostname === '127.0.0.1'
                    if (isVercelFree) {
                      return (
                        <>
                          <span className="text-xs text-[#9A8A6B] truncate">{hostname}/?store=</span>
                          <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} placeholder="my-store" className="flex-1 min-w-0 border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
                        </>
                      )
                    }
                    return (
                      <>
                        <span className="text-xs text-[#9A8A6B]">https://</span>
                        <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} placeholder="my-store" className="flex-1 border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
                        <span className="text-xs text-[#9A8A6B]">.{hostname}</span>
                      </>
                    )
                  })()}
                </div>
              </div>
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-[#1A1A1E] text-white py-3 rounded-xl font-bold hover:bg-black transition disabled:opacity-50">
                {loading ? 'جاري الإنشاء...' : 'إنشاء المتجر →'}
              </button>
              <p className="text-[11px] text-[#9A8A6B] text-center">بالضغط على "إنشاء المتجر" أنتِ توافقين على شروط الخدمة وسياسة الخصوصية</p>
            </form>
          </div>
        </div>
      )}

      {/* ─── Login Modal ─── */}
      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1A1A1E]/60 backdrop-blur-sm" onClick={() => setShowLogin(false)}>
          <div className="bg-white rounded-[24px] p-6 w-full max-w-sm shadow-2xl border border-[#EDE6D8]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-xl text-[#1A1A1E]">دخول التاجر</h3>
              <button onClick={() => setShowLogin(false)} className="text-[#9A8A6B] hover:text-[#1A1A1E] text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleLogin} className="space-y-3">
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="البريد الإلكتروني" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="كلمة المرور" className="w-full border border-[#EDE6D8] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C9A96A]" />
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-[#1A1A1E] text-white py-3 rounded-xl font-bold hover:bg-black transition disabled:opacity-50">
                {loading ? 'جاري الدخول...' : 'دخول →'}
              </button>
              <div className="text-[11px] text-[#9A8A6B] text-center bg-[#FFFCF8] border border-[#EDE6D8] rounded-xl p-2">
                <b>حساب المدير العام التجريبي:</b><br />
                admin@lumiere.saas / admin12345
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
