import { Link } from 'react-router-dom'
import { ArrowLeft, Truck, ShieldCheck, Sparkles, BadgeCheck, Star, Quote } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { getProducts } from '../services/api/products'
import { getSettings } from '../services/api/settings'
import { getActiveDomain } from '../services/api/domains'
import { useEffect, useState } from 'react'
import { formatDZD } from '../lib/utils'

const categoryImages: Record<string,string> = {
  necklace: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=600&q=80',
  ring: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80',
  earring: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&q=80',
  bracelet: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&q=80',
  dress: 'https://images.unsplash.com/photo-1515372039744-f1fd71e2a961?w=600&q=80',
  abaya: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=600&q=80',
  hijab: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80',
  bag: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80',
  shoes: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
  perfume: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80',
  makeup: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80',
  skincare: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80',
  hair: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80',
}

export default function Home(){
  const [products, setProducts] = useState(()=> getProducts())
  const [store, setStore] = useState(()=> getSettings())
  const [domain, setDomain] = useState(()=> getActiveDomain())
  const featuredAll = products.filter(p=>p.isFeatured)
  const domainCats = new Set(domain.categories.map(c=>c.key))
  const featured = (()=> {
    const match = featuredAll.filter(p=> domainCats.has(p.category))
    return match.length ? match : featuredAll
  })()
  useEffect(()=>{
    // Instant scroll to top on mount (Home is the landing page). Use 'auto'
    // so it doesn't animate if the user came from a long page on a different
    // route — ScrollToTop now handles general route restoration, but keep
    // this as a defensive measure.
    window.scrollTo({top:0, left:0, behavior:'auto'})
    const sync=()=>{
      setProducts([...getProducts()])
      setStore(getSettings())
      setDomain(getActiveDomain())
    }
    window.addEventListener('focus', sync)
    window.addEventListener('storage', sync)
    const id=setInterval(sync, 1500)
    return()=>{ window.removeEventListener('focus', sync); window.removeEventListener('storage', sync); clearInterval(id)}
  },[])
  return (
    <div className="bg-[#FFFCF8]">
      {/* HERO */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-6 pt-6">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4">
          <div className="relative rounded-[28px] overflow-hidden min-h-[520px] bg-[#1A1A1E] flex">
            <img src={domain.heroImage} className="absolute inset-0 w-full h-full object-cover opacity-90"/>
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent"/>
            <div className="relative z-10 p-6 md:p-10 flex flex-col justify-center max-w-[560px]">
              <span className="inline-flex w-fit items-center gap-2 bg-white/15 border border-white/20 text-white backdrop-blur rounded-full px-3 py-1 text-xs tracking-widest">{domain.heroBadge} {store.enableRoseEdition && <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B] shadow-[0_0_6px_rgba(160,42,91,0.8)]"></span>}</span>
              <h1 className="cormorant text-[38px] md:text-[52px] leading-[0.95] font-bold text-white mt-4" style={{whiteSpace:'pre-line'}}>{domain.heroTitleAr}</h1>
              <p className="text-white/85 mt-4 leading-7">{domain.heroSubtitleAr}</p>
              <div className="flex flex-wrap gap-3 mt-6">
                <Link to="/shop" className="bg-[#C9A96A] text-white px-7 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-[#B8945A] transition">تسوّقي الآن <ArrowLeft size={16}/></Link>
                <a href="#collection" className="bg-white text-[#1A1A1E] px-7 py-3 rounded-full font-bold hover:bg-[#FFFCF8] transition">اكتشفي الكولكشن</a>
              </div>
              <div className="flex items-center gap-6 mt-6 text-white/90 text-xs">
                <span className="flex items-center gap-1.5"><BadgeCheck size={14} className="text-[#C9A96A]"/> 4.9/5 (1.2k تقييم)</span>
                <span className="flex items-center gap-1.5"><Truck size={14} className="text-[#C9A96A]"/> توصيل 58 ولاية • مجاني فوق {formatDZD(store.freeShippingThreshold)}</span>
              </div>
            </div>
            {/* floating price card */}
            <div className="hidden lg:block absolute bottom-6 left-6 bg-white rounded-2xl p-3 shadow-xl w-[220px] border border-[#F6C0D4]/40">
              <div className="flex gap-3">
                <img src={products.find(p=> domainCats.has(p.category))?.images[0] || "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=200&q=80"} className="w-16 h-16 rounded-xl object-cover"/>
                <div>
                  <div className="text-xs text-[#9A8A6B]">الأكثر مبيعاً</div>
                  <div className="font-bold text-sm leading-tight line-clamp-1">{products.find(p=> domainCats.has(p.category))?.nameAr || domain.nameAr}</div>
                  <div className="text-[#C9A96A] font-extrabold text-sm">{products.find(p=> domainCats.has(p.category)) ? formatDZD(products.find(p=> domainCats.has(p.category))!.price) : formatDZD(6800)}</div>
                </div>
              </div>
              <Link to={products.find(p=> domainCats.has(p.category)) ? `/product/${products.find(p=> domainCats.has(p.category))!._id}` : '/shop'} className="mt-3 block text-center bg-[#1A1A1E] text-white rounded-full py-2 text-xs font-bold hover:bg-black transition">اطلبي الآن - COD</Link>
            </div>
          </div>
          <div className="grid grid-rows-[1.1fr_0.9fr] gap-4">
            {/* عروض الكمية — هذه البطاقة وحدها باللمسة الوردية الغامقة */}
            <div className={`rounded-[28px] overflow-hidden relative p-6 flex flex-col justify-between min-h-[260px] border ${store.enableRoseEdition ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-[#F5EFE6] border-[#EDE6D8]'}`}>
              <img src={categoryImages[domain.categories[0]?.key] || 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80'} className="absolute inset-0 w-full h-full object-cover opacity-[0.08]"/>
              {store.enableRoseEdition && <div className="absolute top-0 left-0 w-32 h-32 bg-[#A02A5B]/10 rounded-full blur-2xl -translate-x-6 -translate-y-6"/>}
              <div className="relative">
                <span className={`border rounded-full px-3 py-1 text-xs font-bold inline-flex gap-1.5 items-center ${store.enableRoseEdition ? 'bg-white border-[#F6C0D4] text-[#A02A5B]' : 'bg-white border-[#EDE6D8] text-[#7A6F5A]'}`}><Sparkles size={12} className={store.enableRoseEdition ? 'text-[#A02A5B]' : 'text-[#C9A96A]'}/> عروض الكمية {store.enableRoseEdition && <span className="w-1.5 h-1.5 rounded-full bg-[#A02A5B] animate-pulse"></span>}</span>
                <h3 className="text-[28px] font-extrabold leading-none mt-3 text-[#1A1A1E]">وفّري حتى <span className={store.enableRoseEdition ? 'text-[#A02A5B]' : 'text-[#C9A96A]'}>22%</span><br/>عند شراء 3 قطع</h3>
                <p className={`text-sm mt-2 ${store.enableRoseEdition ? 'text-[#7A5A65]' : 'text-[#7A6F5A]'}`}>شاركي الأناقة مع صديقاتك — خصم تلقائي في السلة</p>
              </div>
              <Link to="/shop" className={`relative inline-flex w-fit px-5 py-2.5 rounded-full text-sm font-bold mt-4 transition ${store.enableRoseEdition ? 'bg-[#A02A5B] text-white hover:bg-[#7A1F44]' : 'bg-[#1A1A1E] text-white hover:bg-black'}`}>استفيدي من العرض</Link>
            </div>
            {/* بطاقة الدفع عند الاستلام — تبقى ذهبية كما هي */}
            <div className="rounded-[28px] bg-[#C9A96A] p-6 text-white relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/15 rounded-full blur-2xl"/>
              <div className="absolute -left-10 -top-10 w-32 h-32 bg-black/10 rounded-full"/>
              <div className="relative">
                <div className="text-xs tracking-[0.2em] opacity-90">{domain.name.toUpperCase()} CARE</div>
                <h4 className="text-[22px] font-bold leading-tight mt-2">الدفع عند الاستلام<br/>58 ولاية • بدون بطاقة</h4>
                <div className="flex gap-2 mt-4 text-xs">
                  <span className="bg-white text-[#1A1A1E] px-3 py-1.5 rounded-full font-bold flex items-center gap-1"><ShieldCheck size={14}/> مضمون</span>
                  <span className="bg-black/15 border border-white/20 px-3 py-1.5 rounded-full">تأكيد بالهاتف • {store.phone}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* trust bar — بطاقة واحدة فقط بالوردي الغامق */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[
            {icon:Truck, t:"توصيل سريع", d:"24-96 ساعة لكل الولايات", rose:false},
            {icon:ShieldCheck, t:"الدفع عند الاستلام", d: store.enableCod ? "ادفعي عند وصول الطلب" : "الدفع عند الاستلام متوقف", rose: store.enableRoseEdition},
            {icon:BadgeCheck, t:"ضمان 12 شهر", d: domain.id==='domain_jewelry' ? "لمعان يدوم + استرجاع 14 يوم" : "جودة مضمونة + استرجاع 14 يوم", rose:false},
            {icon:Sparkles, t:"تغليف هدية مجاني", d:`علبة ${store.storeName} فاخرة`, rose:false},
          ].map(c=> (
            <div key={c.t} className={`rounded-2xl p-4 flex gap-3 items-center border ${c.rose ? 'bg-[#FDF2F6] border-[#F6C0D4]' : 'bg-white border-[#EDE6D8]'}`}>
              <div className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${c.rose ? 'bg-[#FCE7F0] text-[#A02A5B] border border-[#F6C0D4]' : 'bg-[#FFF5E6] text-[#C9A96A]'}`}><c.icon size={18}/></div>
              <div><div className={`font-bold text-sm ${c.rose ? 'text-[#7A1F44]' : 'text-[#1A1A1E]'}`}>{c.t}</div><div className={`text-xs ${c.rose ? 'text-[#A02A5B]/70' : 'text-[#9A8A6B]'}`}>{c.d}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* categories — ديناميكية حسب المجال */}
      <section id="collection" className="max-w-[1280px] mx-auto px-4 md:px-6 mt-10">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs tracking-[0.3em] text-[#C9A96A] font-bold flex items-center gap-2">SHOP BY CATEGORY <span className="w-8 h-px bg-[#EDE6D8]"></span> {store.enableRoseEdition && <span className="text-[#A02A5B] text-[10px] tracking-widest border border-[#F6C0D4] bg-[#FDF2F6] px-2 py-0.5 rounded-full">ÉDITION ROSE</span>} <span className="hidden md:inline text-[11px] tracking-normal bg-[#1A1A1E] text-white px-2 py-1 rounded-full">{domain.nameAr} • {domain.categories.length} فئات</span></div>
            <h2 className="text-[28px] font-extrabold text-[#1A1A1E]">تسوّقي حسب الفئة <span className="text-[#C9A96A] text-[15px]">— {domain.nameAr}</span></h2>
            <p className="text-xs text-[#9A8A6B] mt-1 line-clamp-1">{domain.descriptionAr}</p>
          </div>
          <Link to="/shop" className="hidden md:inline-flex text-sm font-bold border border-[#EDE6D8] rounded-full px-4 py-2 bg-white hover:bg-[#1A1A1E] hover:text-white transition">عرض الكل</Link>
        </div>
        <div className={`grid gap-4 mt-4 ${domain.categories.length<=3 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
          {domain.categories.map(c=> (
            <Link key={c.key} to={`/shop?cat=${c.key}`} className="group relative rounded-[22px] overflow-hidden h-[220px] bg-[#1A1A1E]">
              <img src={categoryImages[c.key] || `https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&q=80`} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-700"/>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"/>
              <div className="absolute bottom-3 right-3 left-3 bg-white rounded-2xl p-3 flex items-center justify-between">
                <div><div className="font-bold text-[#1A1A1E]">{c.labelAr}</div><div className="text-[10px] tracking-widest text-[#9A8A6B]">{c.label.toUpperCase()}</div></div>
                <span className="w-8 h-8 rounded-full bg-[#1A1A1E] text-white grid place-items-center"><ArrowLeft size={14}/></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* featured — مربوطة بالمجال النشط */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-6 mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[26px] font-extrabold text-[#1A1A1E]">الأكثر مبيعاً <span className="text-[#C9A96A]">2026</span> <span className="text-xs font-bold bg-white border border-[#EDE6D8] px-2 py-1 rounded-full ms-2">{featured.length} منتجات مميزة • {domain.nameAr}</span></h2>
          <Link to="/shop" className="text-sm font-bold text-[#C9A96A] hover:underline">عرض كل المنتجات ←</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {featured.map(p=> <ProductCard key={p._id} p={p}/> )}
        </div>
        {featured.length===0 && <div className="text-center py-8 text-sm text-[#9A8A6B] bg-white border border-dashed border-[#EDE6D8] rounded-2xl mt-4">لا توجد منتجات مميزة في مجال {domain.nameAr} — اذهبي للوحة التحكم لإضافة شارة “مميز”</div>}
      </section>

      {/* editorial + reviews */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-6 mt-10 grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#EDE6D8] rounded-[28px] p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-40 h-40 bg-[#FFF3E0] rounded-full -translate-x-10 -translate-y-10"/>
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-[#C9A96A] border border-[#F0D9A8] bg-[#FFFBF0] px-3 py-1 rounded-full">EDITORIAL • لماذا {store.storeName}؟</div>
            <h3 className="text-[26px] font-extrabold leading-tight mt-3 text-[#1A1A1E]">{domain.id==='domain_jewelry' ? 'ذهب يلمع، سعر يلمع أكثر.' : domain.id==='domain_fashion' ? 'أناقة تُحكى، جودة تُلمس.' : 'جمال طبيعي، ثقة تدوم.'}<br/><span className="text-[#9A8A6B] text-[16px] font-normal">{domain.descriptionAr}</span></h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#5A5340]">
              <li className="flex gap-2"><BadgeCheck size={18} className="text-[#C9A96A] mt-0.5"/> {domain.id==='domain_jewelry' ? 'طلاء ذهب 18ق بتقنية PVD لا يتغير لونه مع الماء والعطور.' : domain.id==='domain_fashion' ? 'خامات فاخرة وقصّات مدروسة تناسب كل مقاس.' : 'تركيبات آمنة ومجربة، نتائج تظهر من أول استعمال.'}</li>
              <li className="flex gap-2"><BadgeCheck size={18} className="text-[#C9A96A] mt-0.5"/> {domain.id==='domain_jewelry' ? 'لؤلؤ طبيعي وزركون 3A مقطوع يدوياً، خفيف ومريح للاستعمال اليومي.' : 'تصميم باريسي وخياطة جزائرية متقنة.'}</li>
              <li className="flex gap-2"><BadgeCheck size={18} className="text-[#C9A96A] mt-0.5"/> كل طلب يأتي في علبة {store.storeName} المخملية + كيس قماش + شهادة ضمان.</li>
            </ul>
            <div className="mt-6 flex gap-3">
              <img src={categoryImages[domain.categories[0]?.key] || 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=200&q=80'} className="w-20 h-20 rounded-2xl object-cover"/>
              <img src={categoryImages[domain.categories[1]?.key] || 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=200&q=80'} className="w-20 h-20 rounded-2xl object-cover"/>
              <img src={categoryImages[domain.categories[2]?.key] || 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=200&q=80'} className="w-20 h-20 rounded-2xl object-cover"/>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1E] rounded-[28px] p-6 md:p-8 text-white relative overflow-hidden">
          <Quote className="absolute top-6 left-6 text-white/10" size={80}/>
          {store.enableRoseEdition && <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#A02A5B]/20 rounded-full blur-2xl"/>}
          <div className="relative">
            <div className="text-xs tracking-[0.3em] text-[#C9A96A]">CLIENTES HEUREUSES • {domain.nameAr}</div>
            <h3 className="text-[24px] font-bold mt-1">ماذا قالت زبوناتنا؟</h3>
            <div className="mt-5 space-y-4">
              {[
                {n:"سارة - الجزائر", t: domain.id==='domain_jewelry' ? "وصلني في 24 ساعة للعاصمة، العلبة فخمة جداً والقلادة تلمع كأنها ذهب حقيقي!" : domain.id==='domain_fashion' ? "العباءة قماشها فاخر والقصة أنيقة جداً، مقاسي مضبوط 100%!" : "العطر ثباته مذهل وسيروم الإشراقة أعطاني نضارة من أول أسبوع!", s:5, rose:false},
                {n:"أمينة - وهران", t:`خدمة رائعة، اتصلوا بي لتأكيد الطلب وأعطوني نصائح للحفاظ على الجودة. شكراً ${store.storeName}`, s:5, rose: store.enableRoseEdition},
                {n:"نور - قسنطينة", t:"أخذت عرض 3 قطع ووفّرت 18%، الجودة ممتازة والسعر معقول مقارنة بالسوق.", s:5, rose:false},
              ].map(r=>(
                <div key={r.n} className={`rounded-2xl p-4 backdrop-blur border ${r.rose ? 'bg-[#A02A5B]/15 border-[#A02A5B]/30' : 'bg-white/[0.07] border-white/10'}`}>
                  <div className={`flex gap-1 ${r.rose ? 'text-[#F6C0D4]' : 'text-[#C9A96A]'}`}>{Array.from({length:r.s}).map((_,i)=><Star key={i} size={14} fill={r.rose ? '#F6C0D4' : '#C9A96A'}/>)}</div>
                  <p className="text-sm leading-6 mt-2 text-white/90">“{r.t}”</p>
                  <div className={`text-xs mt-2 font-bold ${r.rose ? 'text-[#F6C0D4]' : 'text-[#C9A96A]'}`}>{r.n} {r.rose && <span className="ms-2 bg-[#A02A5B] text-white text-[10px] px-2 py-0.5 rounded-full">مميزة</span>}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* instagram */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-6 mt-10">
        <div className="bg-white border border-[#EDE6D8] rounded-[28px] p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-extrabold text-[#1A1A1E]">تابعينا على إنستغرام <span className="text-[#C9A96A]">{store.instagram}</span> {store.enableRoseEdition && <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#FDF2F6] border border-[#F6C0D4] text-[#A02A5B] px-2 py-0.5 rounded-full ms-2">♥ ÉDITION ROSE</span>}</div>
            <div className="text-xs text-[#9A8A6B]">شاركي صورك بـ #LumiereDz وادخلي سحب مجاني كل شهر • {store.phone} • مجال: {domain.nameAr}</div>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {[1,2,3,4].map(i=> <img key={i} src={`https://images.unsplash.com/photo-${['1515562141207-7a88fb7ce338','1599643477877-530eb83abc8e','1535632066927-ab7c9ab60908','1611591437281-460bfbe1220a'][i-1]}?w=200&q=80`} className={`w-16 h-16 rounded-xl object-cover shrink-0 ${i===2 && store.enableRoseEdition ? 'ring-2 ring-[#A02A5B]/30 ring-offset-2' : ''}`}/> )}
          </div>
        </div>
      </section>
    </div>
  )
}
