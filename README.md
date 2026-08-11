# LUMIÈRE — متجر مجوهرات فاخرة (React + Vite + MongoDB Atlas)

متجر إلكتروني جزائري عربي (RTL) مع الدفع عند الاستلام في 58 ولاية، لوحة تحكم
كاملة، وحفظ البيانات في **MongoDB Atlas** عبر **Vercel Serverless Functions**.

## 🏗️ البنية التقنية

- **الواجهة الأمامية**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **الواجهة الخلفية**: Vercel Serverless Functions (Node.js runtime)
- **قاعدة البيانات**: MongoDB Atlas عبر Mongoose
- **التخزين المؤقت**: ذاكرة + LocalStorage (احتياطي عند انقطاع الاتصال)

### تدفق البيانات

```
[Browser/React UI]
        │
        │ fetch('/api/products', …)
        ▼
[Vercel Serverless Function]  ← api/products/index.ts, api/orders/index.ts, …
        │
        │ mongoose.connect(MONGODB_URI)
        ▼
[MongoDB Atlas Cluster]
```

العميل (`src/services/api/client.ts`) يتصل بالمسارات `/api/*` ويحتفظ بنسخة
مؤقتة في الذاكرة + LocalStorage. عند فشل الاتصال (مثلاً في `vite dev` بدون
خادم)، يقع على البيانات الأولية (seed data) أو البيانات المخزنة مؤقتاً.

## 🚀 النشر على Vercel

### 1. رفع المشروع

```bash
# استيراد المشروع من GitHub أو رفعه مباشرة
vercel --prod
```

أو اربط المستودع بـ Vercel عبر لوحة التحكم.

### 2. إعداد متغير البيئة `MONGODB_URI`

في Vercel → Project → Settings → Environment Variables:

| Name          | Value                                                              | Environments        |
|---------------|-------------------------------------------------------------------|---------------------|
| `MONGODB_URI` | `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/lumiere`  | Production, Preview |

احصل عليه من MongoDB Atlas:
1. أنشئ حساب على [mongodb.com/atlas](https://www.mongodb.com/atlas) (مجاني).
2. أنشئ Cluster جديد (M0 Free Tier كافٍ).
3. Database Access → أنشئ مستخدم + كلمة مرور.
4. Network Access → اسمح بكل IPs (`0.0.0.0/0`) للنشر على Vercel.
5. Connect → "Drivers" → انسخ `mongodb+srv://...` connection string.
6. استبدل `<password>` بكلمة مرور المستخدم.

### 3. إعادة النشر

بعد إضافة `MONGODB_URI`، يجب إعادة النشر ليأخذ المتغير الجديد effect:

```bash
vercel --prod
```

أو من لوحة Vercel → Deployments → Redeploy.

## 🌱 التهيئة الأولية للقاعدة (Auto-Seed)

عند أول طلب إلى أي مسار `/api/*`، يقوم الخادم تلقائياً بـ:
- إدخال 8 منتجات مجوهرات افتراضية (إذا كانت المجموعة فارغة)
- إدخال 28 ولاية جزائرية مع أسعار شحن افتراضية
- إدخال 3 مجالات (مجوهرات، أزياء، جمال) — تُحدّث دائماً بأحدث مخطط
- إدخال إعدادات المتجر الافتراضية

لا حاجة لأي أمر `seed` يدوي.

## 📁 بنية المجلدات

```
agon-project/
├── api/                          ← Vercel Serverless Function واحد
│   ├── index.ts                  ← Catch-all router لكل مسارات /api/*
│   │                                (يدعم 21 endpoint من ملف واحد — حلّ مشكلة
│   │                                 حدّ الـ 12 Function على خطة Hobby)
│   └── lib/
│       ├── mongo.ts               ← اتصال MongoDB + helpers
│       ├── models.ts              ← Mongoose schemas
│       ├── seed-runner.ts         ← منطق التهيئة التلقائية
│       ├── seed.ts                ← بيانات أولية (نسخة الخادم)
│       └── types.ts               ← أنواع TypeScript للخادم
├── src/
│   ├── services/api/
│   │   ├── client.ts             ← طبقة fetch (المخزن المؤقت + fallback)
│   │   ├── products.ts           ← خدمة المنتجات (async + sync shims)
│   │   ├── orders.ts             ← خدمة الطلبات
│   │   ├── wilayas.ts            ← خدمة أسعار الشحن
│   │   ├── settings.ts           ← خدمة الإعدادات
│   │   ├── domains.ts            ← خدمة المجالات
│   │   ├── seed.ts               ← بيانات أولية (للعميل)
│   │   ├── db.ts                 ← legacy LocalStorage helpers (compat)
│   │   └── types.ts              ← أنواع TypeScript للعميل
│   ├── pages/                    ← Home, Shop, ProductDetail, Cart, Admin, …
│   ├── components/               ← Header, Footer, ProductCard, ScrollToTop
│   └── context/                  ← CartContext, WishlistContext
└── vercel.json                   ← تكوين Vercel (Vite + api/index.ts)
```

### لماذا ملف واحد (Catch-All Route)؟

خطة Vercel Hobby المجانية تسمح بحد أقصى **12 Serverless Function لكل
Deployment**. النسخة السابقة كانت تحتوي على 9 ملفات منفصلة
(`/api/products/index.ts`, `/api/products/[id].ts`, `/api/orders/index.ts`, …)
مما تجاوز الحد عند إضافة functions داخلية خاصة بـ Vite/Next.

الحل: دمج كل المسارات في ملف واحد `api/index.ts` يتعامل مع التوجيه
(routing) داخلياً عن طريق تحليل `req.url.pathname` وتوزيعه على دوال
معالجة منفصلة. هذا يحافظ على نفس مسارات URL للعميل (`/api/products`,
`/api/orders/LUM-1001`, …) بينما Vercel يرى function واحد فقط.

## 🧪 التطوير المحلي

```bash
npm install
npm run dev        # Vite على :5173 (بدء تشغيل الـ API يتطلب Vercel CLI)
```

للتطوير المحلي مع دعم مسارات الـ API:

```bash
npm install -g vercel
vercel dev         # يشغل Vite + Vercel Functions على نفس المنفذ
```

أو يمكنك تشغيل Vite فقط — ستقع البيانات على الـ seed data المخزنة في
`src/services/api/seed.ts`، ولن يتم حفظ أي تغييرات بشكل دائم.

## 🔌 مسارات الـ API

| الطريقة | المسار                            | الوصف                            |
|---------|-----------------------------------|----------------------------------|
| GET     | `/api/products`                   | كل المنتجات                      |
| POST    | `/api/products`                   | إضافة منتج جديد                  |
| GET     | `/api/products/:id`               | منتج واحد                        |
| PUT     | `/api/products/:id`               | تحديث منتج                       |
| DELETE  | `/api/products/:id`               | حذف منتج                         |
| POST    | `/api/products/:id/action`        | `duplicate` / `toggleFeatured` / `toggleNew` |
| GET     | `/api/orders`                     | كل الطلبات (admin)               |
| POST    | `/api/orders`                     | إنشاء طلب جديد (مع كشف التكرار)  |
| GET     | `/api/orders/:orderNumber`        | طلب واحد                         |
| PATCH   | `/api/orders/:orderNumber`        | تحديث الحالة                     |
| DELETE  | `/api/orders/:orderNumber`        | حذف طلب                          |
| GET     | `/api/wilayas`                    | كل الولايات                      |
| POST    | `/api/wilayas`                    | إضافة ولاية                      |
| PATCH   | `/api/wilayas?code=16`            | تحديث أسعار شحن ولاية            |
| GET     | `/api/settings`                   | إعدادات المتجر                   |
| PUT     | `/api/settings`                   | استبدال الإعدادات                |
| PATCH   | `/api/settings`                   | تحديث جزئي للإعدادات             |
| GET     | `/api/domains`                    | كل المجالات                      |
| POST    | `/api/domains`                    | إنشاء مجال مخصص                  |
| PATCH   | `/api/domains?id=xxx`             | تحديث مجال                       |
| DELETE  | `/api/domains?id=xxx`             | حذف مجال (لا يمكن حذف الجاهزة)   |
| POST    | `/api/domains/activate`           | تفعيل مجال `{ id }`              |

## 🔒 الأمان

- `MONGODB_URI` لا يُكشف أبداً للعميل — يستخدم فقط في serverless functions.
- اتصالات MongoDB تُخزّن مؤقتاً على `globalThis` لتجنب فتح اتصال جديد لكل طلب.
- كشف الطلبات المكررة (نفس الهاتف + نفس المنتجات خلال 30 دقيقة) يمنع الإرسال
  المزدوج عن طريق الخطأ.

## 📝 الترخيص

MIT — للاستخدام التجاري والتعليمي.
