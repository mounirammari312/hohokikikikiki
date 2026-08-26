export function formatDZD(n: number) {
  // Use 'en-US' locale → produces comma-separated thousands (1,250)
  // instead of 'ar-DZ' which uses dots (1.250) that look like decimals.
  return new Intl.NumberFormat('en-US').format(Math.round(n)) + ' د.ج'
}

export function formatDZDCompact(n: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(n)) + ' د.ج'
}

export function getTierDiscount(qty: number, tiers: { minQty: number; discountPercent: number }[]) {
  if (!Array.isArray(tiers) || tiers.length === 0) return 0
  const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty)
  for (const t of sorted) {
    if (qty >= t.minQty) return t.discountPercent
  }
  return 0
}

export function calcItemTotal(price: number, qty: number, tiers: { minQty: number; discountPercent: number }[] = []) {
  const disc = getTierDiscount(qty, tiers)
  const sub = price * qty
  return {
    disc,
    discountAmount: Math.round((sub * disc) / 100),
    total: Math.round(sub * (1 - disc / 100)),
  }
}

/**
 * تحويل الأرقام المشرقية (٠١٢٣٤٥٦٧٨٩) وإزالة المسافات والرموز
 * وضبط الصيغ الدولية (+213 / 00213 / 213) إلى الصيغة المحلية القياسية (05/06/07)
 */
export function normalizeDZPhone(phone: string): string {
  if (!phone) return ''
  
  // تحويل الأرقام المشرقية إلى لاتينية
  const easternDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  let cleaned = phone.replace(/[٠-٩]/g, (d) => String(easternDigits.indexOf(d)))
  
  // إزالة كل ما هو ليس رقماً
  cleaned = cleaned.replace(/\D/g, '')

  // معالجة البادئات الدولية
  if (cleaned.startsWith('00213')) cleaned = cleaned.slice(5)
  else if (cleaned.startsWith('213')) cleaned = cleaned.slice(3)
  
  // إضافة الصفر الناقص إذا بدأ الرقم بـ 5 أو 6 أو 7
  if (/^[567]\d{8}$/.test(cleaned)) {
    cleaned = '0' + cleaned
  }
  
  return cleaned
}

export function validateDZPhone(phone: string): boolean {
  const normalized = normalizeDZPhone(phone)
  // التحقق من الهاتف المحمول الجزائري (10 أرقام تبدأ بـ 05 أو 06 أو 07)
  return /^0[567]\d{8}$/.test(normalized)
}

