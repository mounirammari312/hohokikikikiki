
import { useEffect, useState } from 'react'
import { X, Download, Store, ShoppingBag, ShieldCheck } from 'lucide-react'
import { useLocation } from 'react-router-dom'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)
  const location = useLocation()

  // ─── Smart Route Filtering (Strategy Enforcement) ────────────────────────
  const path = location.pathname
  const isForbidden = path.includes('/product') || path.includes('/cart')
  const isAllowed = path.startsWith('/admin') || path.startsWith('/marketplace') || path.startsWith('/thank-you')

  // Determine context message & icon
  const getContextInfo = () => {
    if (path.startsWith('/admin')) {
      return {
        title: 'تثبيت تطبيق لوحة التحكم',
        subtitle: 'تابع طلبات الزبائن وتلقَ الإشعارات الفورية',
        icon: <Store size={18} className="text-emerald-700" />
      }
    }
    if (path.startsWith('/marketplace')) {
      return {
        title: 'تثبيت تطبيق ماركت بلايس',
        subtitle: 'استكشف آلاف المتاجر والمنتجات بضغطة زر',
        icon: <ShoppingBag size={18} className="text-amber-700" />
      }
    }
    return {
      title: 'تثبيت المتجر لشاشتك الرئيسية',
      subtitle: 'لتتبع حالة شحنتك والوصول السريع',
      icon: <ShieldCheck size={18} className="text-emerald-700" />
    }
  }

  const contextInfo = getContextInfo()

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    if (isIOS) return

    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((navigator as any).standalone === true) return

    // 1. التقاط الحدث في حال تم تخزينه مسبقاً من قبل index.html
    const checkPrompt = () => {
      if ((window as any).deferredPwaPrompt) {
        setDeferredPrompt((window as any).deferredPwaPrompt)
        setVisible(true)
      }
    }

    checkPrompt()
    window.addEventListener('pwa-prompt-ready', checkPrompt)

    // 2. التقاط الحدث المباشر في حال إطلاقه أثناء وجود المستخدم داخل الصفحة
    const handler = (e: Event) => {
      e.preventDefault()
      ;(window as any).deferredPwaPrompt = e
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => {
      setVisible(false)
      setDeferredPrompt(null)
      ;(window as any).deferredPwaPrompt = null
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('pwa-prompt-ready', checkPrompt)
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt || installing) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setVisible(false)
        setDeferredPrompt(null)
        ;(window as any).deferredPwaPrompt = null
      }
    } catch (err) {
      console.warn('[PWA] install prompt failed:', err)
    } finally {
      setInstalling(false)
    }
  }

  const handleDismiss = () => {
    // إخفاء فوري فقط دون تخزين أي حظر لمدة 7 أيام
    setVisible(false)
  }

  // Hide instantly if on product/cart or unauthorized pages, or if event not ready
  if (isForbidden || !isAllowed || !visible || !deferredPrompt) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[200] p-3 animate-slide-up"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 flex items-center gap-3.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 grid place-items-center shrink-0 shadow-xs">
          {contextInfo.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-sm text-slate-900 truncate">{contextInfo.title}</div>
          <div className="text-xs text-slate-500 leading-tight mt-0.5 truncate">
            {contextInfo.subtitle}
          </div>
        </div>

        <button
          onClick={handleInstall}
          disabled={installing}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-60 cursor-pointer"
        >
          {installing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              جاري…
            </>
          ) : (
            <>
              <Download size={14} />
              تثبيت
            </>
          )}
        </button>

        <button
          onClick={handleDismiss}
          aria-label="إغلاق"
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 grid place-items-center shrink-0 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
