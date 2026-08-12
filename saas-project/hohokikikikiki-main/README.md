# LUMIÈRE SaaS — منصة المتاجر الجزائرية متعددة المتاجر (Multi-Tenant)

تحويل المتجر الفردي إلى **منصة SaaS متعددة المتاجر جاهزة للإنتاج**. كل تاجر
يحصل على متجره الخاص بنطاق فرعي `slug.lumiere.saas` (أو نطاق مخصص)، مع عزل
كامل للبيانات عبر حقل `storeId` في كل مستند.

## 🏗️ البنية التقنية

- **الواجهة الأمامية**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **الواجهة الخلفية**: Vercel Serverless Function واحد (catch-all) — Node.js runtime
- **قاعدة البيانات**: MongoDB Atlas عبر Mongoose 9
- **المصادقة**: جلسات بدون حالة (stateless) باستخدام bcryptjs + base64 tokens
- **العزل**: نمط المميز الفردي (Single-DB Discriminator) مع `storeId` مفهرس في كل مخطط

## 🎯 المواصفات المعمارية المنفذة

### 1. عزل البيانات (Multi-Tenancy Strategy)

كل المخططات (Product, Order, StoreSettings, StoreDomain, WilayaRate) تحمل
حقل `storeId: String` مفهرس. كل استعلامات MongoDB تُسمى صراحة بـ `{ storeId }`
على مستوى الخادم.

**المخططات الجديدة:**
- `TenantStore` — `_id, slug (فريد), customDomain (فريد اختياري), ownerId, name, nameAr, status (active|suspended|expired), plan (free_trial|starter|pro|vip), planExpiresAt, createdAt`
- `MerchantUser` — `_id, fullName, email (فريد), phone, passwordHash (bcrypt), role (super_admin|merchant), storeIds[], createdAt`

### 2. برمجية استخراج المتجر الديناميكية (Dynamic Tenant Resolution)

**على الخادم** (`api/lib/tenant.ts`):
1. `x-store-id` HTTP header (الأكثر صراحة — يستخدمه لوحة التحكم)
2. `?storeId=xxx` معامل الاستعلام (للاختبار والروابط المباشرة)
3. `Host` header — نطاق فرعي `slug.platform.com` أو نطاق مخصص
4. التراجع إلى المتجر الافتراضي `store_default` (slug `demo`)

**على الواجهة** (`src/context/TenantContext.tsx`):
- استخراج `storeId` من `window.location.hostname`
- إرفاق `x-store-id` + `x-merchant-token` مع كل طلب API
- إدارة جلسة التاجر (login, logout, refreshUser)

### 3. هيكلة التوجيه ثلاثية المستويات

| المستوى | النطاق | المسار | الوصف |
|---------|--------|--------|-------|
| المنصة | `lumiere.saas` | `/` | صفحة هبوط SaaS + نموذج التسجيل |
| المنصة | `lumiere.saas` | `/super-admin` | لوحة المدير العام (super_admin فقط) |
| المتجر | `slug.lumiere.saas` | `/` | واجهة المتجر (Home, Shop, Product, Cart) |
| المتجر | `slug.lumiere.saas` | `/admin` | لوحة تحكم التاجر (مصادقة بريد + كلمة سر) |

### 4. التهيئة التلقائية (Auto-Seed)

عند أول طلب، يُنشئ `seed-runner.ts` تلقائياً:
- متجر افتراضي `store_default` (slug `demo`)
- حساب مدير عام `admin@lumiere.saas` / `admin12345`
- بيانات افتراضية للمتجر: 8 منتجات، 28 ولاية، 3 مجالات، إعدادات

عند إنشاء متجر جديد (POST `/api/auth/register` أو `/api/stores`)، يُستدعى
`seedStoreData(storeId)` لتعبئة المتجر بالبيانات الافتراضية.

## 📁 بنية المجلدات

```
hohokikikikiki-main/
├── api/                              ← Vercel Serverless Function واحد
│   ├── index.ts                      ← Catch-all router + tenant middleware
│   └── lib/
│       ├── mongo.ts                  ← اتصال MongoDB + helpers
│       ├── models.ts                 ← 7 Mongoose schemas (مع storeId + indexes)
│       ├── tenant.ts                 ← استخراج المتجر الديناميكي + التحقق من كلمة المرور
│       ├── seed-runner.ts            ← تهيئة المتجر الافتراضي + super admin
│       ├── seed.ts                   ← بيانات أولية (8 منتجات + 28 ولاية + 3 مجالات)
│       └── types.ts                  ← أنواع TypeScript للخادم (متزامنة مع العميل)
├── src/
│   ├── App.tsx                       ← توجيه ثلاثي المستويات
│   ├── context/
│   │   ├── TenantContext.tsx         ← استخراج المتجر + المصادقة
│   │   ├── CartContext.tsx           ← سلة التسوق (لكل متجر)
│   │   └── WishlistContext.tsx       ← قائمة الرغبات
│   ├── pages/
│   │   ├── PlatformLanding.tsx       ← صفحة هبوط SaaS + نموذج التسجيل
│   │   ├── SuperAdmin.tsx            ← لوحة المدير العام
│   │   ├── MerchantLogin.tsx         ← شاشة دخول التاجر
│   │   ├── Home.tsx                  ← واجهة المتجر (نفس الكود السابق)
│   │   ├── Shop.tsx, ProductDetail.tsx, Cart.tsx, ThankYou.tsx, Wishlist.tsx
│   │   └── Admin.tsx                 ← لوحة تحكم التاجر (نفس الكود السابق)
│   ├── components/                   ← Header, Footer, ProductCard, ScrollToTop
│   └── services/api/
│       ├── client.ts                 ← طبقة fetch + حقن headers التاجر
│       ├── types.ts                  ← أنواع TypeScript للعميل (متزامنة مع الخادم)
│       ├── products.ts, orders.ts, settings.ts, domains.ts, wilayas.ts
│       ├── seed.ts                   ← بيانات أولية للعميل
│       └── db.ts                     ← legacy LocalStorage helpers
├── vercel.json                       ← rewrite لـ /api/* → api/index.ts
└── package.json                      ← + bcryptjs للإنتاج
```

## 🚀 النشر على Vercel

### 1. متغيرات البيئة المطلوبة

في Vercel → Project → Settings → Environment Variables:

| Name | Value | Description |
|------|-------|-------------|
| `MONGODB_URI` | `mongodb+srv://...` | رابط MongoDB Atlas |
| `PLATFORM_APEX` | `lumiere.saas` | النطاق الأساسي للمنصة |
| `VITE_PLATFORM_APEX` | `lumiere.saas` | نفس القيمة للعميل |

### 2. النشر

```bash
vercel --prod
```

### 3. إعداد النطاقات الفرعية

في Vercel → Project → Settings → Domains، أضف:
- `lumiere.saas` (المنصة الرئيسية)
- `*.lumiere.saas` (wildcard لكل متاجر التجار)

Vercel سيُصدر شهادات SSL تلقائياً لكل نطاق فرعي.

## 🔑 الحساب الافتراضي

عند أول نشر، يُنشأ حساب المدير العام تلقائياً:
- **البريد**: `admin@lumiere.saas`
- **كلمة المرور**: `admin12345`
- **الدور**: `super_admin`

⚠️ **غيّر كلمة المرور فوراً بعد أول تسجيل دخول** عبر إنشاء حساب جديد
أو تحديث `DEFAULT_SUPER_ADMIN_PASSWORD` في `api/lib/seed-runner.ts`.

## 🔌 مسارات الـ API

| الطريقة | المسار | الوصف | المصادقة |
|---------|--------|-------|----------|
| GET | `/api/health` | فحص الصحة | لا |
| POST | `/api/auth/login` | تسجيل دخول التاجر | لا |
| POST | `/api/auth/register` | إنشاء تاجر + متجر جديد | لا |
| GET | `/api/auth/me` | المستخدم الحالي | نعم |
| GET | `/api/stores` | متاجر التاجر الحالي | تاجر |
| POST | `/api/stores` | إنشاء متجر جديد للتاجر | تاجر |
| PATCH | `/api/stores/:id` | تحديث بيانات المتجر | تاجر (مالك) |
| GET | `/api/super-admin/stores` | كل المتاجر | super_admin |
| PATCH | `/api/super-admin/stores/:id` | تحديث حالة/خطة المتجر | super_admin |
| GET | `/api/super-admin/users` | كل التجار | super_admin |
| GET | `/api/super-admin/stats` | إحصائيات المنصة | super_admin |
| GET/POST | `/api/products` | قائمة/إنشاء منتج | متجر + تاجر لـ POST |
| GET/PUT/DELETE | `/api/products/:id` | منتج واحد | متجر + تاجر لـ PUT/DELETE |
| POST | `/api/products/:id/action` | duplicate/toggleFeatured/toggleNew | تاجر |
| GET/POST | `/api/orders` | الطلبات | متجر + تاجر لـ POST (admin) |
| GET/PATCH/DELETE | `/api/orders/:orderNumber` | طلب واحد | متجر + تاجر لـ PATCH/DELETE |
| GET/POST/PATCH | `/api/wilayas` | الولايات | متجر + تاجر لـ POST/PATCH |
| GET/PUT/PATCH | `/api/settings` | إعدادات المتجر | متجر + تاجر لـ PUT/PATCH |
| GET/POST/PATCH/DELETE | `/api/domains` | المجالات | متجر + تاجر لـ الكتابة |
| POST | `/api/domains/activate` | تفعيل مجال | تاجر |

## 🔒 الأمان

- `storeId` يُحقن من الخادم (لا يثق أبداً بالعميل) — حتى لو حاول تاجر
  تمرير `storeId` مختلف، الـ middleware يتجاهله ويستخدم storeId المستخرج
  من الـ Host header أو الـ token.
- كلمات المرور تُخزن كـ bcrypt hash (أو `PLAIN:` prefix للبيئة التجريبية).
- كل استعلامات MongoDB تُسمى بـ `{ storeId: ctx.storeId }` صراحة.
- جلسات بدون حالة (stateless) — التوكن = `base64(userId:passwordHash)`.
- التحقق من الملكية: التاجر يمكنه فقط تعديل المتاجر التي يملكها (`user.storeIds.includes(storeId)`).

## 📝 الترخيص

MIT — للاستخدام التجاري والتعليمي.
