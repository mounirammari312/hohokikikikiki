// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time
/**
 * SERVER-SIDE mirror of `src/services/api/deliveryProviders.ts`.
 *
 *  We keep a separate copy here (instead of importing the client file)
 *  because the server must NEVER import client code — Vite-specific
 *  imports would crash the Node.js serverless function.
 *
 *  Keep the two files in sync when adding / removing providers.
 */

export const ALGERIAN_DELIVERY_PROVIDERS = [
  {
    id: 'yalidine', name: 'Yalidine', nameAr: 'يالدين',
    website: 'https://yalidine.app/', portal: 'https://app.yalidine.app/',
    accent: '#C9A96A',
    description: 'أكبر شركة توصيل في الجزائر — تغطية 58 ولاية مع تتبع البوالص.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiId',    label: 'API ID',    labelAr: 'API ID',    type: 'text',     placeholder: '12345',           hint: 'تجده في حسابك على Yalidine Developer Portal' },
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح سري — لا تشاركه مع أحد' },
    ],
  },
  {
    id: 'zrexpress', name: 'ZR Express', nameAr: 'زد آر إكسبرس',
    website: 'https://zrexpress.com/', portal: 'https://zrexpress.com/',
    accent: '#A02A5B',
    description: 'توصيل سريع للمناطق الحضرية مع نظام إدارة طرود متكامل.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiKey',    label: 'API Key',    labelAr: 'مفتاح API',    type: 'text',     placeholder: 'zr_live_...',      hint: 'مفتاح API العام' },
      { id: 'apiSecret', label: 'API Secret', labelAr: 'سرّ API',       type: 'password', placeholder: '••••••••••••••••',  hint: 'مفتاح API السري' },
    ],
  },
  {
    id: 'maystro', name: 'Maystro Delivery', nameAr: 'مايسترو توصيل',
    website: 'https://maystro-delivery.com/', portal: 'https://dashboard.maystro-delivery.com/',
    accent: '#7C3AED',
    description: 'توصيل احترافي مع تكامل سهل ونظام إرجاع مرن.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'may_live_...', hint: 'مفتاح API من لوحة تحكم مايسترو' },
    ],
  },
  {
    id: 'guesto', name: 'Guesto', nameAr: 'غوستو',
    website: 'https://www.guesto-dz.com/', portal: 'https://www.guesto-dz.com/login',
    accent: '#0EA5E9',
    description: 'توصيل مركزي مع نقاط استلام موزعة في كامل التراب الوطني.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey',    label: 'API Key',    labelAr: 'مفتاح API',    type: 'text',     placeholder: 'guesto_...',       hint: 'مفتاح API من حساب غوستو' },
      { id: 'apiSecret', label: 'API Secret', labelAr: 'سرّ API',       type: 'password', placeholder: '••••••••••••••••',  hint: 'السر المرتبط بمفتاح API' },
    ],
  },
  {
    id: 'trackz', name: 'TrackZ', nameAr: 'تراكز',
    website: 'https://trackz-dz.com/', portal: 'https://app.trackz-dz.com/',
    accent: '#16A34A',
    description: 'تتبع لحظي للطرود مع تكامل برمجي مباشر وواجهة عربية.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح API من حساب TrackZ' },
    ],
  },
  {
    id: 'colisex', name: 'ColisEx', nameAr: 'كوليس إكس',
    website: 'https://colisex.com/', portal: 'https://colisex.com/login',
    accent: '#EA580C',
    description: 'حلول توصيل للتجار مع نظام إدارة مخزون وخدمة العملاء.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey',    label: 'API Key',    labelAr: 'مفتاح API',    type: 'text',     placeholder: 'colisex_...',      hint: 'مفتاح API العام' },
      { id: 'apiSecret', label: 'API Secret', labelAr: 'سرّ API',       type: 'password', placeholder: '••••••••••••••••',  hint: 'مفتاح API السري' },
    ],
  },
  {
    id: 'ecosystem', name: 'Ecosystem DZ', nameAr: 'إيكوسيستيم',
    website: 'https://ecosystem-dz.com/', portal: 'https://ecosystem-dz.com/login',
    accent: '#0891B2',
    description: 'منصة جزائرية للتوصيل وإدارة الطلبات مع تكامل برمجي مفتوح.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiKey', label: 'API Key', labelAr: 'مفتاح API', type: 'text', placeholder: 'eco_...', hint: 'مفتاح API من لوحة Ecosystem' },
    ],
  },
  {
    id: 'noestdelay', name: 'NoestDelay', nameAr: 'نواست ديلاي',
    website: 'https://noestdelay.com/', portal: 'https://noestdelay.com/login',
    accent: '#DB2777',
    description: 'توصيل سريع للجزائر العاصمة والمدن الكبرى مع تعامل احترافي.',
    coverage: '32 ولاية',
    credentialFields: [
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح API من حساب NoestDelay' },
    ],
  },
  {
    id: 'aldjia', name: 'Aldjia Express', nameAr: 'الجزائرية إكسبرس',
    website: 'https://aldjia-express.com/', portal: 'https://aldjia-express.com/login',
    accent: '#CA8A04',
    description: 'توصيل بأسعار منافسة مع تغطية واسعة للولايات الداخلية.',
    coverage: '58 ولاية',
    credentialFields: [
      { id: 'apiKey',    label: 'API Key',    labelAr: 'مفتاح API',    type: 'text',     placeholder: 'aldjia_...',       hint: 'مفتاح API العام' },
      { id: 'apiSecret', label: 'API Secret', labelAr: 'سرّ API',       type: 'password', placeholder: '••••••••••••••••',  hint: 'مفتاح API السري' },
    ],
  },
  {
    id: 'hisseptik', name: 'Hisseptik Delivery', nameAr: 'حسيبتك توصيل',
    website: 'https://hisseptik.com/', portal: 'https://hisseptik.com/login',
    accent: '#9333EA',
    description: 'توصيل عصري مع نظام إشعارات SMS وتتبع مباشر للطرود.',
    coverage: '48 ولاية',
    credentialFields: [
      { id: 'apiToken', label: 'API Token', labelAr: 'API Token', type: 'password', placeholder: '••••••••••••••••', hint: 'مفتاح API من لوحة حسيبتك' },
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
          apiSecret: settings.zrExpressApiSecret || '',
        },
      })
    } else {
      patched[idx] = {
        ...patched[idx],
        enabled: patched[idx].enabled || !!settings.zrExpressEnabled,
        credentials: {
          apiKey: settings.zrExpressApiKey || patched[idx].credentials?.apiKey || '',
          apiSecret: settings.zrExpressApiSecret || patched[idx].credentials?.apiSecret || '',
        },
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

  if (touched.length) {
    settings.deliveryProviders = patched
  }
  return touched
}
