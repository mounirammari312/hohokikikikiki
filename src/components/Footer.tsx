import { Instagram, Phone, MapPin, Truck, ShieldCheck, Award, Store as StoreIcon, ArrowLeft, BadgeCheck } from 'lucide-react'
import { getSettings, syncSettings, subscribeSettings } from '../services/api/settings'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import { Logo } from './Logo'
export default function Footer(){
  const [store, setStore] = useState(()=> getSettings())
  const { storeId, storeSlug } = useTenant()
  const storeParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('store') : null
  const storeQuery = storeParam ? `?store=${encodeURIComponent(storeParam)}` : ''
  useEffect(() => {
    void syncSettings().then(() => setStore(getSettings()))
  }, [storeId, storeSlug])
  // Re-render when settings change (e.g. merchant saves in /admin).
  useEffect(() => {
    const unsub = subscribeSettings(() => setStore(getSettings()))
    return unsub
  }, [])
  return (
    <footer className="gradient-top-border text-[#E8E0CC] mt-16" style={{background: store.secondaryColor || "#1A1A1E"}}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-10">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="cormorant text-2xl tracking-[0.2em] gradient-text font-bold flex items-center gap-2">{store.storeName} {store.enableRoseEdition && <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B] shadow-[0_0_8px_rgba(160,42,91,0.6)]"></span>}</div>
            <p className="text-sm leading-6 mt-3 text-[#B8AA8E]">{store.footerDescriptionAr}</p>
            <div className="flex gap-2 mt-4">
              <a href={store.instagram.startsWith('@') ? `https://instagram.com/${store.instagram.slice(1)}` : '#'} target="_blank" className="social-bounce w-8 h-8 rounded-full bg-white/10 grid place-items-center hover:bg-[#A02A5B] hover:text-white"><Instagram size={16}/></a>
              <a href={`tel:${store.phone.replace(/\s/g,'')}`} className="social-bounce w-8 h-8 rounded-full bg-white/10 grid place-items-center hover:bg-[#C9A96A]"><Phone size={16}/></a>
            </div>
            <div className="text-xs text-white/40 mt-3">{store.phone} • {store.email}</div>
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">روابط سريعة</h4>
            <ul className="space-y-2 text-sm text-[#B8AA8E]">
              <li><Link to={`/shop${storeQuery}`} className="hover:text-[#C9A96A]">المتجر</Link></li>
              <li><a href={`/${storeQuery}#collection`} className="hover:text-[#C9A96A]">سياسة الاسترجاع 14 يوم</a></li>
              <li><a href="#" className="hover:text-[#C9A96A]">تتبع الطلب</a></li>
              <li><Link to={`/admin${storeQuery}`} className="hover:text-[#C9A96A]">لوحة التحكم</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">الدفع والشحن 2026</h4>
            <ul className="space-y-2 text-sm text-[#B8AA8E]">
              <li className="flex gap-2"><Truck size={16} className="text-[#C9A96A]"/> توصيل 24-96 ساعة حسب الولاية {store.freeShippingThreshold>0 && `• مجاني فوق ${store.freeShippingThreshold.toLocaleString()} د.ج`}</li>
              <li className="flex gap-2"><ShieldCheck size={16} className={store.enableCod ? 'text-[#C9A96A]' : 'text-white/30'}/> {store.enableCod ? 'الدفع عند الاستلام فقط (COD)' : 'الدفع عند الاستلام — متوقف حالياً'}</li>
              <li className="flex gap-2"><Award size={16} className="text-[#C9A96A]"/> ضمان جودة + استرجاع 14 يوم</li>
              <li className="flex gap-2"><MapPin size={16} className="text-[#C9A96A]"/> {store.phone} • 69 ولاية</li>
            </ul>
          </div>
          <div className="bg-white/[0.05] rounded-2xl p-4 border border-white/10 relative overflow-hidden">
            {store.enableRoseEdition && <div className="absolute -top-8 -left-8 w-20 h-20 bg-[#A02A5B]/10 rounded-full blur-xl pointer-events-none"></div>}
            <h4 className="font-bold text-white flex items-center gap-2">اشترك واحصل على 10% خصم {store.enableRoseEdition && <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B]"></span>}</h4>
            <p className="text-xs text-[#B8AA8E] mt-1">لأول طلب + كود خصم حصري للكولكشن الجديد</p>
            <form onSubmit={e=>{e.preventDefault(); alert('تم التسجيل! كود الخصم: LUMIERE10')}} className="mt-3 flex gap-2">
              <input placeholder="بريدك الإلكتروني" className="flex-1 rounded-full px-3 py-2 text-sm bg-white text-black outline-none focus:ring-2 focus:ring-[#A02A5B]/20"/>
              <button className="btn-premium bg-[#C9A96A] text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-[#B8945A]">اشتراك</button>
            </form>
            {store.enableRoseEdition && <p className="text-[11px] text-white/30 mt-2 text-center">لمسة روز راقية — ÉDITION ROSE</p>}
          </div>
        </div>
        {/* ─── Marketplace reciprocal promo strip ─────────────────────────
            This is the "price" the merchant pays for using the platform
            for free: a slim, elegant strip that promotes the Amugar
            Marketplace to every storefront visitor. Drives traffic from
            individual stores → the public marketplace. */}
        <div className="mt-6 bg-white/[0.06] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Logo to={null} showText={false} imgClassName="h-8 w-auto" className="shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-sm text-white flex items-center gap-1.5">
                موثق في Amugar Marketplace
                <BadgeCheck size={14} className="text-emerald-400" />
              </div>
              <p className="text-[11px] text-[#B8AA8E] mt-0.5 leading-snug">
                هذا المتجر جزء من منصة Amugar — تصفح آلاف المنتجات من متاجر جزائرية موثقة
              </p>
            </div>
          </div>
          <Link
            to="/marketplace"
            className="shrink-0 inline-flex items-center gap-1.5 bg-white text-slate-900 px-4 py-2 rounded-full text-xs font-bold hover:bg-slate-100 transition"
          >
            <StoreIcon size={14} />
            تصفح كل المتاجر
            <ArrowLeft size={13} />
          </Link>
        </div>

        <div className="border-t border-white/10 mt-6 pt-6 flex flex-col md:flex-row justify-between gap-3 text-xs text-[#8A7F6A]">
          <span>© 2026 {store.storeName} Algérie — {store.storeNameAr}. جميع الحقوق محفوظة. الأسعار بـ {store.currency}</span>
          <span className="flex items-center gap-2">Meta Pixel & TikTok Pixel مفعّلان • تتبع التجارة الإلكترونية 2026 {store.enableRoseEdition && <span className="w-1 h-1 rounded-full bg-[#A02A5B]"></span>}</span>
        </div>
      </div>
    </footer>
  )
}
