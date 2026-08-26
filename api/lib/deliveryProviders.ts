// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time
/**
 * SERVER-SIDE mirror of `src/services/api/deliveryProviders.ts`.
 *
 *  We keep a separate copy here (instead of importing the client file)
 *  because the server must NEVER import client code — Vite-specific
 *  imports would crash the Node.js serverless function.
 *
 *  Keep the two files in sync when adding / removing providers.
 *
 *  All URLs were VERIFIED via web search against each company's official
 *  website, social media, or business directory listings.
 */

export const ALGERIAN_DELIVERY_PROVIDERS = [
  // 1 — Yalidine Express (founded 2013, "YALIDINE EL DJAZAIR SERVICES")
  // SOURCES (verified Aug 2026):
  //  - Corporate website (merchant-facing): https://www.yalidine.com/
  //  - Developer dashboard: https://yalidine.app/app/dev/index.php
  //  - API base: https://api.yalidine.app/v1/
  //  - Laravel wrapper (sebbahali/Yalidine-Dz-Laravel-Api) confirms
  //    API_ID / API_TOKEN env var names
  //  - Coverage is 55 wilayas per the official corporate site
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
  // 2 — ZR Express (confirmed via GIE Monétique + SimilarWeb)
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
  // 3 — Maystro Delivery (confirmed via LinkedIn + Facebook + Instagram)
  {
    id: 'maystro',
    name: 'Maystro Delivery',
    nameAr: 'مايسترو توصيل',
    website: 'https://maystro-delivery.com/',
    portal: 'https://maystro-delivery.com/',
    accent: '#7C3AED',
    description: 'منصة لوجستية متكاملة للتجارة الإلكترونية — 75% من الطلبات تُسلّم في أقل من 24 ساعة.',
    coverage: '69 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'may_live_...', hint: 'مفتاح API من لوحة تحكم مايسترو' },
    ],
  },
  // 4 — ECOTRACK (multi-carrier API platform powering many Algerian carriers)
  {
    id: 'ecotrack',
    name: 'ECOTRACK',
    nameAr: 'إيكوتراك',
    website: 'https://www.ecotrack.dz/',
    portal: 'https://www.ecotrack.dz/',
    accent: '#16A34A',
    description: 'منصة سحابية لإدارة التوصيل — تشغّل عدة شركات نقل جزائرية مع API موحد.',
    coverage: '69 ولاية',
    credentialFields: [
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح API من حساب ECOTRACK' },
    ],
  },
  // 5 — NOEST EXPRESS (confirmed via noest-dz.com + app.noest-dz.com)
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
  // 6 — DHD Livraison Express (confirmed via dhd-dz.com + Kompass)
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
  // 7 — RJ360 Express (confirmed via rj360express.com)
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
  // 8 — GS E-commerce (confirmed via gs-ecommerce.com, Bab Ezzaour Alger)
  {
    id: 'gsecommerce',
    name: 'GS E-commerce',
    nameAr: 'جي إس إي كوميرس',
    website: 'https://gs-ecommerce.com/',
    portal: 'https://gs-ecommerce.com/',
    accent: '#0891B2',
    description: 'خدمة ramassage وتخزين وشحن مع الدفع عند الاستلام للتجار الإلكترونيين في كل الجزائر.',
    coverage: '69 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'gs_...', hint: 'مفتاح API من حساب GS E-commerce' },
    ],
  },
  // 9 — Anderson E-commerce (confirmed via anderson-ecommerce.com + ECOTRACK subdomain)
  {
    id: 'anderson',
    name: 'Anderson E-commerce',
    nameAr: 'أندرسون إي كوميرس',
    website: 'https://anderson-ecommerce.com/',
    portal: 'https://anderson-ecommerce.com/',
    accent: '#CA8A04',
    description: 'لوجستيك للتجارة الإلكترونية — توصيل express وramassage وتغليف وrecouvrement.',
    coverage: '69 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'anderson_...', hint: 'مفتاح API من حساب Anderson' },
    ],
  },
  // 10 — Colivraison Express (confirmed via colivraison.express)
  {
    id: 'colivraison',
    name: 'Colivraison Express',
    nameAr: 'كوليفريزون إكسبرس',
    website: 'https://colivraison.express/',
    portal: 'https://www.colivraison.express/',
    accent: '#9333EA',
    description: 'شريك لوجستي للتجارة الإلكترونية — تأكيد الطلبات وتوصيل للمنزل في 69 ولاية.',
    coverage: '69 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'colivraison_...', hint: 'مفتاح API من حساب Colivraison Express' },
    ],
  },
]

export const DELIVERY_PROVIDER_BY_ID = Object.fromEntries(
  ALGERIAN_DELIVERY_PROVIDERS.map(p => [p.id, p])
)

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
    ),
  }))
}

/**
 * Migrate legacy hardcoded fields (yalidineEnabled / zrExpressEnabled /
 * yalidineApiId / ...) into the new `deliveryProviders` array shape.
 *
 * Runs once per store the first time the seed-runner sees the new
 * schema. After migration, the legacy fields are left in place for
 * backwards-compat with any older code that still reads them.
 */
export function migrateLegacyDeliveryFields(settings: any): string[] {
  if (!settings) return []
  const providers = Array.isArray(settings.deliveryProviders) ? settings.deliveryProviders : []
  const patched: any[] = providers.map(p => ({ ...p }))
  const touched: string[] = []

  // Yalidine → providers[yalidine]
  if (settings.yalidineEnabled !== undefined || settings.yalidineApiId || settings.yalidineApiToken) {
    const idx = patched.findIndex(p => p.id === 'yalidine')
    if (idx === -1) {
      patched.push({
        id: 'yalidine',
        enabled: !!settings.yalidineEnabled,
        credentials: {
          apiId: settings.yalidineApiId || '',
          apiToken: settings.yalidineApiToken || '',
        },
      })
    } else {
      patched[idx] = {
        ...patched[idx],
        enabled: patched[idx].enabled || !!settings.yalidineEnabled,
        credentials: {
          apiId: settings.yalidineApiId || patched[idx].credentials?.apiId || '',
          apiToken: settings.yalidineApiToken || patched[idx].credentials?.apiToken || '',
        },
      }
    }
    touched.push('yalidine')
  }

  // ZR Express → providers[zrexpress]
  if (settings.zrExpressEnabled !== undefined || settings.zrExpressApiKey || settings.zrExpressApiSecret) {
    const idx = patched.findIndex(p => p.id === 'zrexpress')
    if (idx === -1) {
      patched.push({
        id: 'zrexpress',
        enabled: !!settings.zrExpressEnabled,
        credentials: {
          apiKey: settings.zrExpressApiKey || '',
        },
      })
    } else {
      patched[idx] = {
        ...patched[idx],
        enabled: patched[idx].enabled || !!settings.zrExpressEnabled,
        credentials: {
          apiKey: settings.zrExpressApiKey || patched[idx].credentials?.apiKey || '',
          // Preserve apiSecret if the migration previously stored it
          apiSecret: patched[idx].credentials?.apiSecret || settings.zrExpressApiSecret || '',
        },
      }
      // If apiSecret came from legacy and is non-empty, keep it
      if (settings.zrExpressApiSecret && !patched[idx].credentials.apiSecret) {
        patched[idx].credentials.apiSecret = settings.zrExpressApiSecret
      }
    }
    touched.push('zrexpress')
  }

  // Ensure EVERY provider in the registry has an entry (newly-added
  // providers won't exist on older stores). Disabled by default with
  // empty credentials.
  for (const meta of ALGERIAN_DELIVERY_PROVIDERS) {
    if (!patched.some(p => p.id === meta.id)) {
      patched.push({
        id: meta.id,
        enabled: false,
        credentials: Object.fromEntries(meta.credentialFields.map(f => [f.id, ''])),
      })
      touched.push(meta.id)
    }
  }

  // REMOVE providers that are no longer in the registry (old IDs we
  // deleted because they were fabricated). This keeps the dashboard
  // clean — without it, old stores would keep showing cards for
  // non-existent companies like 'guesto', 'trackz', 'colisex', etc.
  const validIds = new Set(ALGERIAN_DELIVERY_PROVIDERS.map(p => p.id))
  const filtered = patched.filter(p => validIds.has(p.id))
  if (filtered.length !== patched.length) {
    touched.push('_removed_invalid')
  }

  if (touched.length) {
    settings.deliveryProviders = filtered
  }
  return touched
}
