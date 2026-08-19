/**
 * PWA Install Banner — Professional custom install prompt
 * ─────────────────────────────────────────────────────────────────────────
 *  Implements the "Add to Home Screen" experience like native apps:
 *
 *    1. Listens for the browser's `beforeinstallprompt` event (fired when
 *       the PWA meets installability criteria: manifest + SW + HTTPS +
 *       engagement). We PREVENT the default mini-infobar (which is small
 *       and easily missed) and instead show our own beautiful banner.
 *
 *    2. Shows a bottom-fixed banner with:
 *       - App icon + name
 *       - Catchy Arabic text ("أضف المتجر لشاشتك الرئيسية")
 *       - Green "تثبيت" button (matches the reference screenshot style)
 *       - Dismiss "X" button (closes for 7 days, not forever)
 *
 *    3. When user clicks "تثبيت", we call the saved `prompt()` method
 *       from the beforeinstallPrompt event — this triggers the browser's
 *       NATIVE install dialog (Add to Home Screen / Install app).
 *       The user then confirms in the native dialog, and the app is
 *       installed for real (icon on home screen, opens standalone).
 *
 *    4. After install, the banner never shows again (the browser stops
 *       firing beforeinstallPrompt once installed).
 *
 *    5. If user clicks "X" (dismiss), we hide the banner for 7 days
 *       via localStorage. We don't nag them every page load.
 *
 *  This is exactly the pattern used by Twitter, TikTok, and the
 *  AndroDwi site in the reference screenshot.
 */

import { useEffect, useState } from 'react'
import { X, Download, Crown } from 'lucide-react'

const DISMISS_KEY = 'amugar_pwa_install_dismissed_until'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000  // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Don't show on iOS (Safari doesn't support beforeinstallprompt —
    // iOS users get the "Share → Add to Home Screen" flow which we
    // can't trigger programmatically. We'd need a separate iOS-specific
    // banner with instructions.)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    if (isIOS) return

    // Don't show if already installed (running as standalone PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((navigator as any).standalone === true) return

    // Don't show if dismissed within the last 7 days
    try {
      const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || '0')
      if (Date.now() < dismissedUntil) return
    } catch {}

    const handler = (e: Event) => {
      // CRITICAL: prevent the default mini-infobar so we can show our own
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Small delay so the page content loads first, then the banner
      // slides in (feels more like a native app's install prompt)
      setTimeout(() => setVisible(true), 2500)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Listen for successful install — hide banner forever
    const installedHandler = () => {
      setVisible(false)
      setDeferredPrompt(null)
      try { localStorage.removeItem(DISMISS_KEY) } catch {}
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt || installing) return
    setInstalling(true)
    try {
      // Show the browser's native install dialog
      await deferredPrompt.prompt()
      // Wait for user's choice
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        // User installed — hide banner forever (appinstalled event will fire too)
        setVisible(false)
        setDeferredPrompt(null)
      }
      // If dismissed, keep the prompt available for next time the banner
      // shows (Chrome re-fires beforeinstallprompt if not installed)
      setDeferredPrompt(null)
    } catch (err) {
      console.warn('[PWA] install prompt failed:', err)
    } finally {
      setInstalling(false)
    }
  }

  const handleDismiss = () => {
    setVisible(false)
    // Dismiss for 7 days — don't nag the user every session
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS))
    } catch {}
  }

  if (!visible || !deferredPrompt) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[200] p-3 animate-slide-up"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-2xl border border-[#EDE6D8] p-3 flex items-center gap-3 relative overflow-hidden">
        {/* Decorative gradient accent on the right (RTL: starts from right) */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#C9A96A]/10 to-transparent rounded-full blur-2xl pointer-events-none" />

        {/* App icon */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1A1A1E] to-[#3D3D45] grid place-items-center shrink-0 shadow-md">
          <Crown size={20} className="text-[#C9A96A]" />
        </div>

        {/* Text content (RTL: name + tagline) */}
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-sm text-[#1A1A1E] truncate">Amugar</div>
          <div className="text-xs text-[#7A6F5A] leading-tight mt-0.5">
            <span className="font-bold">أضف المتجر لشاشتك الرئيسية</span>
            <span className="text-[#9A8A6B]"> — للوصول السريع</span>
          </div>
        </div>

        {/* Install button (green, matches reference screenshot) */}
        <button
          onClick={handleInstall}
          disabled={installing}
          className="bg-gradient-to-l from-[#10B981] to-[#059669] text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1.5 shrink-0 hover:shadow-lg hover:scale-105 transition-all disabled:opacity-60 disabled:hover:scale-100"
        >
          {installing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              جاري…
            </>
          ) : (
            <>
              <Download size={14} />
              تثبيت
            </>
          )}
        </button>

        {/* Dismiss X button */}
        <button
          onClick={handleDismiss}
          aria-label="إغلاق"
          className="w-8 h-8 rounded-full bg-[#F5EFE6] hover:bg-[#EDE6D8] grid place-items-center shrink-0 text-[#9A8A6B] hover:text-[#1A1A1E] transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
