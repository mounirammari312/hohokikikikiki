/**
 * ToastNotifications — Periodic toast notifications.
 *
 * Every 25-40 seconds, shows a small toast at the bottom of the screen
 * announcing a "recent order" — e.g. "🎯 أحمد من وهران اشترى ساعة".
 *
 * This is a powerful psychological trick used by Temu/AliExpress to make
 * the page feel alive and create FOMO. Visitors see other people buying.
 *
 * Dismissible — auto-hides after 5 seconds.
 */

import { useEffect, useState, useMemo } from 'react'
import { X, ShoppingBag, MapPin } from 'lucide-react'

interface Order {
  name: string
  wilaya: string
  product: string
  time: string
}

const NAMES = [
  'أحمد', 'فاطمة', 'محمد', 'مريم', 'يوسف', 'آمنة', 'عبد الرحمن', 'خديجة',
  'سفيان', 'نسرين', 'بلال', 'هاجر', 'كريم', 'سارة', 'إسلام', 'أسماء',
  'رابح', 'إيمان', 'عماد', 'ليلى', 'نبيل', 'إيهاب', 'ياسين', 'مريم',
]

const WILAYAS = [
  'وهران', 'قسنطينة', 'عنّاب', 'الجزائر', 'البليدة', 'سطيف', 'باتنة', 'ورقلة',
  'بجاية', 'تيزي وزو', 'تيارت', 'المسيلة', 'غرداية', 'سكيكدة', 'جيجل', 'بومرداس',
]

const TIME_AGO = ['قبل دقيقتين', 'قبل 5 دقائق', 'قبل 3 دقائق', 'قبل دقيقة', 'قبل 4 دقائق', 'قبل 7 دقائق']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function ToastNotifications({ productNames }: { productNames: string[] }) {
  const [toast, setToast] = useState<Order | null>(null)
  const [visible, setVisible] = useState(false)

  // Generate a fresh order using current product pool
  const makeOrder = useMemo(() => {
    return (): Order => ({
      name: pick(NAMES),
      wilaya: pick(WILAYAS),
      product: productNames.length ? pick(productNames) : 'منتج مميز',
      time: pick(TIME_AGO),
    })
  }, [productNames])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    let intervalId: ReturnType<typeof setInterval>

    const showOne = () => {
      setToast(makeOrder())
      setVisible(true)
      timeoutId = setTimeout(() => setVisible(false), 5000)
    }

    // First toast after 8 seconds (let the user explore first)
    const firstDelay = 8000
    const initial = setTimeout(showOne, firstDelay)

    // Then every 25-40 seconds
    const scheduleNext = () => {
      const delay = 25000 + Math.random() * 15000
      intervalId = setTimeout(() => {
        showOne()
        scheduleNext()
      }, delay)
    }
    scheduleNext()

    return () => {
      clearTimeout(initial)
      clearTimeout(timeoutId)
      clearTimeout(intervalId)
    }
  }, [makeOrder])

  if (!toast) return null

  return (
    <div
      className={`fixed bottom-20 md:bottom-6 right-4 z-40 max-w-[300px] transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-2xl p-3 flex items-start gap-2.5 relative">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#10B981] to-[#047857] grid place-items-center shrink-0">
          <ShoppingBag size={16} className="text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-[#1A1A1E] truncate">
            {toast.name} اشترى
          </div>
          <div className="text-[10px] text-[#4B5563] truncate font-medium">
            {toast.product}
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-[9px] text-[#9A8A6B]">
            <MapPin size={8} />
            <span>{toast.wilaya}</span>
            <span>•</span>
            <span>{toast.time}</span>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={() => setVisible(false)}
          className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] grid place-items-center shrink-0"
          aria-label="إغلاق"
        >
          <X size={11} className="text-[#9A8A6B]" />
        </button>

        {/* Progress bar */}
        <div className="absolute bottom-0 right-0 left-0 h-0.5 bg-[#F3F4F6] rounded-b-2xl overflow-hidden">
          <div
            className="h-full bg-[#10B981] origin-right"
            style={{ animation: 'shrinkBar 5s linear forwards' }}
          />
        </div>
      </div>
    </div>
  )
}
