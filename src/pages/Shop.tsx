import { useMemo, useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { SlidersHorizontal, Search } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { getProducts } from '../services/api/products'
import { getActiveDomain } from '../services/api/domains'

export default function Shop(){
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const cat = params.get('cat') || 'all'
  const [search, setSearch] = useState(q)
  const [sort, setSort] = useState('featured')
  const [products, setProducts] = useState(()=> getProducts())
  const [domain, setDomain] = useState(()=> getActiveDomain())

  useEffect(()=> setSearch(q),[q])
  useEffect(()=>{
    const sync=()=>{
      setProducts([...getProducts()])
      setDomain(getActiveDomain())
    }
    window.addEventListener('focus', sync)
    window.addEventListener('storage', sync)
    const id=setInterval(sync, 1500)
    return()=>{ window.removeEventListener('focus', sync); window.removeEventListener('storage', sync); clearInterval(id)}
  },[])

  const domainCatKeys = domain.categories.map(c=>c.key)

  const filtered = useMemo(()=>{
    let list=[...products]
    if(cat!=='all') list = list.filter(p=>p.category===cat)
    if(search.trim()){ const s=search.toLowerCase(); list = list.filter(p=> p.name.toLowerCase().includes(s) || p.nameAr.includes(search) || p.materialAr.includes(search) || p.category.includes(s))}
    if(sort==='price-asc') list.sort((a,b)=>a.price-b.price)
    if(sort==='price-desc') list.sort((a,b)=>b.price-a.price)
    if(sort==='rating') list.sort((a,b)=>b.rating-a.rating)
    return list
  },[products, cat, search, sort])

  const countInDomain = products.filter(p=> domainCatKeys.includes(p.category)).length

  return (
    <div className="bg-[#FFFCF8] min-h-screen">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6">
        {/* Mobile: stack title + search vertically. Desktop: keep them on
            one row with justify-between. The previous flex-wrap layout caused
            the 240px search input to push the title off-screen on small phones. */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] md:text-[28px] font-extrabold text-[#1A1A1E] flex items-center gap-2 flex-wrap">
              <span>المتجر</span>
              <span className="text-xs md:text-sm font-bold bg-[#1A1A1E] text-white px-2.5 py-1 rounded-full">{domain.nameAr}</span>
            </h1>
            <p className="text-xs md:text-sm text-[#9A8A6B] mt-1">اكتشف {products.length} منتج ({countInDomain} في مجال {domain.nameAr}) • الدفع عند الاستلام • توصيل 58 ولاية</p>
            <p className="text-xs text-[#9A8A6B] mt-1 hidden md:block">{domain.descriptionAr}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* flex-1 lets the search input shrink on mobile instead of
                staying fixed at 240px and overflowing. */}
            <div className="flex items-center bg-white border border-[#EDE6D8] rounded-full px-3 py-2 flex-1 md:flex-initial md:w-[240px] min-w-0">
              <Search size={16} className="text-[#B8AA8E] shrink-0"/>
              <input value={search} onChange={e=>{setSearch(e.target.value); const n=new URLSearchParams(params); if(e.target.value) n.set('q', e.target.value); else n.delete('q'); setParams(n, {replace:true})}} placeholder="بحث..." className="flex-1 outline-none px-2 text-sm bg-transparent min-w-0" />
            </div>
            <select value={sort} onChange={e=>setSort(e.target.value)} className="bg-white border border-[#EDE6D8] rounded-full px-3 py-2 text-sm font-bold shrink-0">
              <option value="featured">المميز</option>
              <option value="price-asc">الأقل أولاً</option>
              <option value="price-desc">الأعلى أولاً</option>
              <option value="rating">الأعلى تقييماً</option>
            </select>
          </div>
        </div>

        {/* Category chips: on mobile, allow horizontal scroll so the last chip
            isn't cut off. On desktop, use flex-wrap as before. The padding-right
            (RTL) / -mx-4 trick lets the chips scroll edge-to-edge on mobile
            without the container padding cutting off the last chip. */}
        <div className="mt-4 flex md:flex-wrap gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 thumb-scroll [&>button:last-child]:me-4 md:[&>button:last-child]:me-0">
          <button type="button" onClick={()=>{const n=new URLSearchParams(params); n.delete('cat'); setParams(n)}} className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border flex items-center gap-1.5 ${cat==='all' ? 'bg-[#1A1A1E] text-white border-[#1A1A1E]' : 'bg-white text-[#1A1A1E] border-[#EDE6D8] hover:bg-[#FFFBF0]' }`}>الكل <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${cat==='all' ? 'bg-white text-[#1A1A1E]' : 'bg-[#1A1A1E] text-white'}`}>{products.length}</span></button>
          {domain.categories.map(c=> (
            <button key={c.key} type="button" onClick={()=>{const n=new URLSearchParams(params); n.set('cat',c.key); setParams(n)}} className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border ${cat===c.key ? 'bg-[#A02A5B] text-white border-[#A02A5B] shadow shadow-[#A02A5B]/20' : 'bg-white text-[#1A1A1E] border-[#EDE6D8] hover:bg-[#FFFBF0]' }`}>{c.labelAr} <span className="text-[10px] opacity-60 hidden md:inline">• {c.label}</span></button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-[#9A8A6B]"><SlidersHorizontal size={14}/> {filtered.length} منتج</div>

        {/* hint when browsing cross-domain */}
        {cat!=='all' && !domainCatKeys.includes(cat) && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800">أنت تستعرض فئة خارج المجال النشط ({domain.nameAr}). يمكنك تغيير المجال من لوحة التحكم أو تصفح كل المنتجات.</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {filtered.map(p=> <ProductCard key={p._id} p={p}/> )}
        </div>
        {filtered.length===0 && (
          <div className="text-center py-10 bg-white border border-dashed border-[#EDE6D8] rounded-2xl mt-6">
            <div className="font-bold">لا توجد نتائج</div>
            <p className="text-sm text-[#9A8A6B] mt-1">جربي بحثاً آخر أو غيّري الفئة. المجال النشط: {domain.nameAr}</p>
            <div className="flex justify-center gap-2 mt-3">
              <button type="button" onClick={()=>{ setSearch(''); const n=new URLSearchParams(params); n.delete('q'); n.delete('cat'); setParams(n)}} className="bg-[#1A1A1E] text-white px-4 py-2 rounded-full text-sm font-bold">مسح الفلاتر</button>
              <Link to="/admin" className="bg-white border border-[#EDE6D8] px-4 py-2 rounded-full text-sm font-bold">إدارة المنتجات</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
