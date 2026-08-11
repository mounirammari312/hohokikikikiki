export function formatDZD(n:number){
  return new Intl.NumberFormat('ar-DZ').format(n) + ' د.ج'
}
export function formatDZDCompact(n:number){
  return n.toLocaleString('fr-DZ') + ' د.ج'
}
export function getTierDiscount(qty:number, tiers:{minQty:number,discountPercent:number}[]){
  const sorted = [...tiers].sort((a,b)=>b.minQty-a.minQty)
  for(const t of sorted) if(qty>=t.minQty) return t.discountPercent
  return 0
}
export function calcItemTotal(price:number, qty:number, tiers:{minQty:number,discountPercent:number}[]){
  const disc = getTierDiscount(qty, tiers)
  const sub = price*qty
  return { disc, discountAmount: Math.round(sub*disc/100), total: Math.round(sub*(1-disc/100)) }
}
export function validateDZPhone(phone:string){
  const cleaned = phone.replace(/\s|-/g,'')
  // Algerian mobile: 0(5|6|7)xxxxxxxx 10 digits
  return /^0[567]\d{8}$/.test(cleaned)
}
