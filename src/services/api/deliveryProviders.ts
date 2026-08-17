/**
 * Algerian Delivery Companies Registry
 * ─────────────────────────────────────────────────────────────────────────
 *  Central, framework-agnostic catalog of every Algerian last-mile
 *  delivery company this SaaS platform can integrate with.
 *
 *  All URLs were VERIFIED via web search against each company's official
 *  website, social media, or business directory listings (Kompass,
 *  GIE Monétique, LinkedIn, Facebook, SimilarWeb).
 *
 *  Adding a new provider is a one-line change here — the Admin dashboard
 *  card, the Settings schema defaults, and the seed-runner migration all
 *  read from this registry automatically.
 *
 *  Each provider declares:
 *    - id         — stable identifier stored in the DB (never localized)
 *    - name       — brand name (Latin)
 *    - nameAr     — brand name as shown in the Arabic dashboard
 *    - website    — merchant-facing official website
 *    - portal     — direct link to the dashboard / API key page (if known)
 *    - accent     — brand color (hex) used for the dashboard card border + toggle
 *    - description— short Arabic blurb shown under the card title
 *    - coverage   — approximate coverage (used in the card subtitle)
 *    - credentialFields — array describing each input the merchant must fill in
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
  // 1 ── Yalidine Express ───────────────────────────────────────────────
  // The largest Algerian delivery company.
  // Founded 2013 as "YALIDINE EL DJAZAIR SERVICES".
  //
  // SOURCES (verified Aug 2026):
  //  - Corporate website (merchant-facing): https://www.yalidine.com/
  //  - Developer dashboard (where API ID + Token are issued):
  //    https://yalidine.app/app/dev/index.php
  //  - API endpoint base: https://api.yalidine.app/v1/
  //  - Laravel API wrapper (sebbahali/Yalidine-Dz-Laravel-Api) confirms
  //    the API_ID / API_TOKEN env var names
  //  - Coverage is 55 wilayas per the official corporate site (not 58)
  {
    id: 'yalidine',
    name: 'Yalidine Express',
    nameAr: 'يالدين إكسبرس',
    website: 'https://www.yalidine.com/',
    portal: 'https://yalidine.app/app/dev/index.php',
    accent: '#C9A96A',
    description: 'أكبر شركة توصيل في الجزائر — موجودة منذ 2013 (YALIDINE EL DJAZAIR SERVICES)، تغطي 55 ولاية مع تتبع البوالص وواجهة برمجية كاملة.',
    coverage: '55 ولاية',
    credentialFields: [
      { id: 'apiId',    label: 'API ID',    labelAr: 'API ID',    type: 'text',     placeholder: '12345',           hint: 'تجده في لوحة المطورين: yalidine.app/app/dev/index.php' },
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح سري — لا تشاركه مع أحد' },
    ],
  },
  // 2 ── ZR Express ─────────────────────────────────────────────────────
  // Algerian e-commerce delivery company, active in major cities.
  // Website confirmed via GIE Monétique listing + SimilarWeb traffic data.
  {
    id: 'zrexpress',
    name: 'ZR Express',
    nameAr: 'زد آر إكسبرس',
    website: 'https://zrexpress.com/',
    portal: 'https://zrexpress.com/',
    accent: '#A02A5B',
    description: 'شركة توصيل موجهة للتجار الإلكترونيين — سرعة في المدن الكبرى مع نظام تتبع.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'zr_live_...', hint: 'مفتاح API من لوحة تحكم ZR Express' },
    ],
  },
  // 3 ── Maystro Delivery ───────────────────────────────────────────────
  // Algerian e-commerce logistics platform. Confirmed via official site,
  // LinkedIn, Facebook, Instagram, and App Store listing.
  {
    id: 'maystro',
    name: 'Maystro Delivery',
    nameAr: 'مايسترو توصيل',
    website: 'https://maystro-delivery.com/',
    portal: 'https://maystro-delivery.com/',
    accent: '#7C3AED',
    description: 'منصة لوجستية متكاملة للتجارة الإلكترونية — 75% من الطلبات تُسلّم في أقل من 24 ساعة.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'may_live_...', hint: 'مفتاح API من لوحة تحكم مايسترو' },
    ],
  },
  // 4 ── ECOTRACK ───────────────────────────────────────────────────────
  // Cloud delivery management platform powering many Algerian carriers
  // (Anderson, DHD Express, Noest Express, etc.). Confirmed via LinkedIn,
  // Facebook, App Store, and dzbuild.com.
  {
    id: 'ecotrack',
    name: 'ECOTRACK',
    nameAr: 'إيكوتراك',
    website: 'https://www.ecotrack.dz/',
    portal: 'https://www.ecotrack.dz/',
    accent: '#16A34A',
    description: 'منصة سحابية لإدارة التوصيل — تشغّل عدة شركات نقل جزائرية مع API موحد.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح API من حساب ECOTRACK' },
    ],
  },
  // 5 ── NOEST EXPRESS ──────────────────────────────────────────────────
  // Algerian express delivery company. Confirmed via official site
  // (noest-dz.com + www.noest.dz) + dashboard at app.noest-dz.com.
  {
    id: 'noest',
    name: 'NOEST EXPRESS',
    nameAr: 'نوست إكسبرس',
    website: 'https://noest-dz.com/',
    portal: 'https://app.noest-dz.com/',
    accent: '#0EA5E9',
    description: 'شركة جزائرية للتوصيل السريع — مكاتب متعددة عبر التراب الوطني مع تتبع مباشر.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح API من لوحة NOEST CORPORATE' },
    ],
  },
  // 6 ── DHD Livraison Express ──────────────────────────────────────────
  // Algerian delivery company. Confirmed via official site dhd-dz.com,
  // Facebook, Instagram, and Kompass business directory.
  {
    id: 'dhd',
    name: 'DHD Livraison Express',
    nameAr: 'دي إتش دي توصيل',
    website: 'https://dhd-dz.com/',
    portal: 'https://dhd-dz.com/',
    accent: '#EA580C',
    description: 'شركة توصيل جزائرية — خدمة ramassage وتغليف وتخزين مع الدفع عند الاستلام.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'dhd_live_...', hint: 'مفتاح API من حساب DHD' },
    ],
  },
  // 7 ── RJ360 Express ──────────────────────────────────────────────────
  // Algerian delivery + branding + logistics platform. Confirmed via
  // official site rj360express.com.
  {
    id: 'rj360',
    name: 'RJ360 Express',
    nameAr: 'أر جيه 360 إكسبرس',
    website: 'https://www.rj360express.com/',
    portal: 'https://www.rj360express.com/',
    accent: '#DB2777',
    description: 'أول منصة جزائرية تجمع التوصيل السريع والبرانداغ واللوجستيك لتنمية الأعمال.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'rj360_...', hint: 'مفتاح API من لوحة RJ360' },
    ],
  },
  // 8 ── GS E-commerce ──────────────────────────────────────────────────
  // Algerian e-commerce delivery + COD service. Confirmed via official
  // site gs-ecommerce.com (Bab Ezzaour, Alger).
  {
    id: 'gsecommerce',
    name: 'GS E-commerce',
    nameAr: 'جي إس إي كوميرس',
    website: 'https://gs-ecommerce.com/',
    portal: 'https://gs-ecommerce.com/',
    accent: '#0891B2',
    description: 'خدمة ramassage وتخزين وشحن مع الدفع عند الاستلام للتجار الإلكترونيين في كل الجزائر.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'gs_...', hint: 'مفتاح API من حساب GS E-commerce' },
    ],
  },
  // 9 ── Anderson E-commerce ────────────────────────────────────────────
  // Algerian e-commerce logistics company (Oued Smar, Alger).
  // Confirmed via anderson-ecommerce.com + andersonlogistique.com +
  // ECOTRACK subdomain anderson-ecommerce.ecotrack.dz.
  {
    id: 'anderson',
    name: 'Anderson E-commerce',
    nameAr: 'أندرسون إي كوميرس',
    website: 'https://anderson-ecommerce.com/',
    portal: 'https://anderson-ecommerce.com/',
    accent: '#CA8A04',
    description: 'لوجستيك للتجارة الإلكترونية — توصيل express وramassage وتغليف وrecouvrement.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'anderson_...', hint: 'مفتاح API من حساب Anderson' },
    ],
  },
  // 10 ── Colivraison Express ───────────────────────────────────────────
  // Algerian e-commerce fulfillment + COD shipping company (Birkhadem).
  // Confirmed via colivraison.express + www.colivraison.express.
  {
    id: 'colivraison',
    name: 'Colivraison Express',
    nameAr: 'كوليفريزون إكسبرس',
    website: 'https://colivraison.express/',
    portal: 'https://www.colivraison.express/',
    accent: '#9333EA',
    description: 'شريك لوجستي للتجارة الإلكترونية — تأكيد الطلبات وتوصيل للمنزل في 58 ولاية.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'colivraison_...', hint: 'مفتاح API من حساب Colivraison Express' },
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
