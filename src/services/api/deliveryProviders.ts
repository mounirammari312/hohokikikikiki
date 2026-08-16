/**
 * Algerian Delivery Companies Registry
 * ─────────────────────────────────────────────────────────────────────────
 *  Central, framework-agnostic catalog of every Algerian last-mile
 *  delivery company this SaaS platform can integrate with.
 *
 *  Adding a new provider is a one-line change here — the Admin dashboard
 *  card, the Settings schema defaults, and the seed-runner migration all
 *  read from this registry automatically.
 *
 *  Each provider declares:
 *    - id         — stable identifier stored in the DB (never localized)
 *    - name       — brand name (Latin)
 *    - nameAr     — brand name as shown in the Arabic dashboard
 *    - website    — merchant-facing portal where they can grab API keys
 *    - portal     — direct link to the developer / API key page (if known)
 *    - accent     — brand color (hex) used for the dashboard card border + toggle
 *    - description— short Arabic blurb shown under the card title
 *    - credentialFields — array describing each input the merchant must fill in
 *        (id, label, labelAr, type, placeholder, hint)
 *
 *  IMPORTANT: keep this list in sync with the server-side mirror at
 *  `api/lib/deliveryProviders.ts` (which is intentionally a copy —
 *  client and server must not import each other).
 */

export type CredentialFieldType = 'text' | 'password' | 'number' | 'url'

export interface DeliveryCredentialField {
  /** Stable key stored in DB — e.g. `apiId`, `apiToken`, `apiKey` */
  id: string
  label: string
  labelAr: string
  type: CredentialFieldType
  placeholder?: string
  /** Short Arabic hint shown under the input */
  hint?: string
}

export interface DeliveryProviderMeta {
  id: string
  name: string
  nameAr: string
  website: string
  portal?: string
  /** Brand color — drives the card border, toggle, and icon background */
  accent: string
  /** Short Arabic description shown under the card title */
  description: string
  /** Approximate coverage (used in the card subtitle) */
  coverage: string
  credentialFields: DeliveryCredentialField[]
}

export const ALGERIAN_DELIVERY_PROVIDERS: DeliveryProviderMeta[] = [
  // 1 ── Yalidine ────────────────────────────────────────────────────────
  {
    id: 'yalidine',
    name: 'Yalidine',
    nameAr: 'يالدين',
    website: 'https://yalidine.app/',
    portal: 'https://app.yalidine.app/',
    accent: '#C9A96A',
    description: 'أكبر شركة توصيل في الجزائر — تغطية 58 ولاية مع تتبع البوالص.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiId',    label: 'API ID',    labelAr: 'API ID',    type: 'text',     placeholder: '12345',           hint: 'تجده في حسابك على Yalidine Developer Portal' },
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح سري — لا تشاركه مع أحد' },
    ],
  },
  // 2 ── ZR Express ─────────────────────────────────────────────────────
  {
    id: 'zrexpress',
    name: 'ZR Express',
    nameAr: 'زد آر إكسبرس',
    website: 'https://zrexpress.com/',
    portal: 'https://zrexpress.com/',
    accent: '#A02A5B',
    description: 'توصيل سريع للمناطق الحضرية مع نظام إدارة طرود متكامل.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiKey',    label: 'API Key',    labelAr: 'مفتاح API',    type: 'text',     placeholder: 'zr_live_...',      hint: 'مفتاح API العام' },
      { id: 'apiSecret', label: 'API Secret', labelAr: 'سرّ API',       type: 'password', placeholder: '••••••••••••••••',  hint: 'مفتاح API السري' },
    ],
  },
  // 3 ── Maystro Delivery ───────────────────────────────────────────────
  {
    id: 'maystro',
    name: 'Maystro Delivery',
    nameAr: 'مايسترو توصيل',
    website: 'https://maystro-delivery.com/',
    portal: 'https://dashboard.maystro-delivery.com/',
    accent: '#7C3AED',
    description: 'توصيل احترافي مع تكامل سهل ونظام إرجاع مرن.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'may_live_...', hint: 'مفتاح API من لوحة تحكم مايسترو' },
    ],
  },
  // 4 ── Guesto ─────────────────────────────────────────────────────────
  {
    id: 'guesto',
    name: 'Guesto',
    nameAr: 'غوستو',
    website: 'https://www.guesto-dz.com/',
    portal: 'https://www.guesto-dz.com/login',
    accent: '#0EA5E9',
    description: 'توصيل مركزي مع نقاط استلام موزعة في كامل التراب الوطني.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey',    label: 'API Key',    labelAr: 'مفتاح API',    type: 'text',     placeholder: 'guesto_...',       hint: 'مفتاح API من حساب غوستو' },
      { id: 'apiSecret', label: 'API Secret', labelAr: 'سرّ API',       type: 'password', placeholder: '••••••••••••••••',  hint: 'السر المرتبط بمفتاح API' },
    ],
  },
  // 5 ── TrackZ ─────────────────────────────────────────────────────────
  {
    id: 'trackz',
    name: 'TrackZ',
    nameAr: 'تراكز',
    website: 'https://trackz-dz.com/',
    portal: 'https://app.trackz-dz.com/',
    accent: '#16A34A',
    description: 'تتبع لحظي للطرود مع تكامل برمجي مباشر وواجهة عربية.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح API من حساب TrackZ' },
    ],
  },
  // 6 ── ColisEx ────────────────────────────────────────────────────────
  {
    id: 'colisex',
    name: 'ColisEx',
    nameAr: 'كوليس إكس',
    website: 'https://colisex.com/',
    portal: 'https://colisex.com/login',
    accent: '#EA580C',
    description: 'حلول توصيل للتجار مع نظام إدارة مخزون وخدمة العملاء.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey',    label: 'API Key',    labelAr: 'مفتاح API',    type: 'text',     placeholder: 'colisex_...',      hint: 'مفتاح API العام' },
      { id: 'apiSecret', label: 'API Secret', labelAr: 'سرّ API',       type: 'password', placeholder: '••••••••••••••••',  hint: 'مفتاح API السري' },
    ],
  },
  // 7 ── Ecosystem DZ ───────────────────────────────────────────────────
  {
    id: 'ecosystem',
    name: 'Ecosystem DZ',
    nameAr: 'إيكوسيستيم',
    website: 'https://ecosystem-dz.com/',
    portal: 'https://ecosystem-dz.com/login',
    accent: '#0891B2',
    description: 'منصة جزائرية للتوصيل وإدارة الطلبات مع تكامل برمجي مفتوح.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'eco_...', hint: 'مفتاح API من لوحة Ecosystem' },
    ],
  },
  // 8 ── NoestDelay ─────────────────────────────────────────────────────
  {
    id: 'noestdelay',
    name: 'NoestDelay',
    nameAr: 'نواست ديلاي',
    website: 'https://noestdelay.com/',
    portal: 'https://noestdelay.com/login',
    accent: '#DB2777',
    description: 'توصيل سريع للجزائر العاصمة والمدن الكبرى مع تعامل احترافي.',
    coverage: '32 ولاية',
    credentialFields: [
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح API من حساب NoestDelay' },
    ],
  },
  // 9 ── Aldjia Express ─────────────────────────────────────────────────
  {
    id: 'aldjia',
    name: 'Aldjia Express',
    nameAr: 'الجزائرية إكسبرس',
    website: 'https://aldjia-express.com/',
    portal: 'https://aldjia-express.com/login',
    accent: '#CA8A04',
    description: 'توصيل بأسعار منافسة مع تغطية واسعة للولايات الداخلية.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey',    label: 'API Key',    labelAr: 'مفتاح API',    type: 'text',     placeholder: 'aldjia_...',       hint: 'مفتاح API العام' },
      { id: 'apiSecret', label: 'API Secret', labelAr: 'سرّ API',       type: 'password', placeholder: '••••••••••••••••',  hint: 'مفتاح API السري' },
    ],
  },
  // 10 ── Hisseptik Delivery ───────────────────────────────────────────
  {
    id: 'hisseptik',
    name: 'Hisseptik Delivery',
    nameAr: 'حسيبتك توصيل',
    website: 'https://hisseptik.com/',
    portal: 'https://hisseptik.com/login',
    accent: '#9333EA',
    description: 'توصيل عصري مع نظام إشعارات SMS وتتبع مباشر للطرود.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح API من لوحة حسيبتك' },
    ],
  },
]

/** Quick lookup by id. */
export const DELIVERY_PROVIDER_BY_ID: Record<string, DeliveryProviderMeta> =
  Object.fromEntries(ALGERIAN_DELIVERY_PROVIDERS.map(p => [p.id, p]))

/**
 * Default provider configuration for a fresh store — every provider is
 * present but disabled with empty credentials. The merchant toggles
 * them on and fills in their API keys from the dashboard.
 */
export function defaultDeliveryProviders() {
  return ALGERIAN_DELIVERY_PROVIDERS.map(p => ({
    id: p.id,
    enabled: false,
    credentials: Object.fromEntries(
      p.credentialFields.map(f => [f.id, ''])
    ) as Record<string, string>,
  }))
}
