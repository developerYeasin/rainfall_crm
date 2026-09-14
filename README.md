# Rainfall CRM

Rainfall Media-র ক্লায়েন্ট ম্যানেজমেন্ট অ্যাপ — যে গুগল শীট দিয়ে এখন ক্লায়েন্ট ম্যানেজ করা হয়, ঠিক সেই ওয়ার্কফ্লো ও ফর্মুলা নিয়ে তৈরি, তবে মাল্টি-ক্লায়েন্ট অ্যাপ হিসেবে।

- **frontend/** → `client/` — React 18 + Vite + Tailwind + TanStack Query + Recharts
- **backend/** → `server/` — Node.js + Express + MySQL (mysql2) + JWT
- **DB** — MySQL (`rainfall_crm`), মাইগ্রেশন ও সিড স্ক্রিপ্ট সহ

---

## শীট → অ্যাপ ম্যাপিং

শীটটি একটি ক্লায়েন্টের এক মাসের জন্য। অ্যাপে সেটা হয়েছে **ক্লায়েন্ট → মাস/সাইকেল → ৬টি ট্যাব**, তাই একই কাঠামো যত খুশি ক্লায়েন্ট ও মাসের জন্য চলে।

| গুগল শীট ট্যাব | অ্যাপ পেজ | ফর্মুলা যেখানে আছে |
|---|---|---|
| টার্গেট ও প্রজেকশন | `/cycles/:id` | `server/src/utils/metrics.js` → `projectWeek`, `sumProjection` |
| পারফরম্যান্স ট্র্যাকার | `/cycles/:id/performance` | `decoratePerformance`, `summarisePerformance` |
| কন্ট্রোল ইন্সপেকশন শীট | `/cycles/:id/control` | `buildVariance`, `weekStatus` |
| ডেইলি টাস্ক কমপ্লায়েন্স | `/cycles/:id/tasks` | `complianceScore` |
| কন্টেন্ট ক্যালেন্ডার | `/cycles/:id/content` | — |
| ড্যাশবোর্ড সামারি | `/cycles/:id/summary` | `dashboard.service.js` |

শীটের প্রতিটি ফর্মুলা হুবহু রাখা হয়েছে:

```
clicks      = budget / cpc
impressions = clicks / ctr
conversions = clicks * conversion_rate
revenue     = conversions * aov
roas        = revenue / budget

variance     = actual_revenue - target_revenue
variance %   = variance / target_revenue
status       = IFS(actual=0 → "ডেটা নেই", var >= 0 → "টার্গেট অনুযায়ী/এগিয়ে",
                   var >= -10% → "সামান্য পিছিয়ে", else → "টার্গেটের চেয়ে পিছিয়ে")

compliance   = (৪টি চেকের যতগুলো "হ্যাঁ") / 4
```

শীটের ডিফল্ট অ্যাসাম্পশন (৳৬০,০০০ / CTR ২% / CPC ৩.৫ / CVR ২% / AOV ৯০০) দিয়ে অ্যাপ একই ফল দেয়:
সাপ্তাহিক **৪,২৮৬ ক্লিক · ২১৪,২৮৬ ইমপ্রেশন · ৮৬ কনভার্সন · ৳৭৭,১৪২.৮৬ · ৫.১৪x**, মাসিক টার্গেট **৳৩,০৮,৫৭১**।

এর বাইরে অ্যাপে অতিরিক্ত যা আছে: মাল্টি-ক্লায়েন্ট, রোল-ভিত্তিক পারমিশন, এজেন্সি ওভারভিউ ড্যাশবোর্ড, চার্ট, অডিট লগ।

---

## সেটআপ

### ১. ব্যাকএন্ড

```bash
cd server
npm install
cp .env.example .env      # DB ক্রেডেনশিয়াল ও JWT সিক্রেট বসান
npm run db:setup          # মাইগ্রেশন + সিড (টিম ইউজার ও ডেমো ক্লায়েন্ট)
npm run dev               # http://localhost:5000
```

সার্ভার চালু হওয়ার সময় নিজেই পেন্ডিং মাইগ্রেশন চালায়।

### ২. ফ্রন্টএন্ড

```bash
cd client
npm install
cp .env.example .env      # VITE_API_URL
npm run dev               # http://localhost:5173
```

### সিড করা লগইন

| রোল | ইমেইল | পাসওয়ার্ড |
|---|---|---|
| অ্যাডমিন | admin@rainfall.com | Admin@123 |
| ম্যানেজার | manager@rainfall.com | Manager@123 |
| মিডিয়া বায়ার | buyer@rainfall.com | Buyer@123 |
| ডিজাইনার | designer@rainfall.com | Designer@123 |
| ক্লায়েন্ট পোর্টাল (ডেমো ক্লায়েন্ট) | client@rainfall.com | Client@123 |

> প্রোডাকশনে যাওয়ার আগে এই পাসওয়ার্ড ও `.env`-এর JWT সিক্রেট অবশ্যই বদলান।

---

## ব্যাকএন্ড স্ট্রাকচার

```
server/src/
├── config/          এনভায়রনমেন্ট ও কনস্ট্যান্ট (রোল, স্ট্যাটাস, প্ল্যাটফর্ম)
├── db/
│   ├── pool.js      mysql2 পুল, transaction হেল্পার, transient error retry
│   ├── migrate.js   ভার্সনড মাইগ্রেশন রানার (schema_migrations টেবিল)
│   ├── migrations/  001_init.sql
│   └── seed.js      টিম + শীটের ডেমো ডেটা
├── middlewares/     auth (JWT), authorize (RBAC), validate (zod), error, rateLimit
├── modules/         ফিচারভিত্তিক: routes → controller → service → repository
│   ├── auth/ users/ clients/ cycles/ performance/
│   └── control/ tasks/ content/ dashboard/ activity/
├── utils/           metrics (শীটের ফর্মুলা), sql, date, ApiError, activity log
├── routes.js  app.js  server.js
```

### API (সব `/api/v1` প্রিফিক্সে, `/auth/*` ছাড়া সব JWT লাগে)

| মেথড | পাথ | কাজ |
|---|---|---|
| POST | `/auth/login` · `/auth/refresh` · `/auth/logout` | লগইন / টোকেন রোটেশন |
| POST | `/auth/register` | নতুন ইউজার (অ্যাডমিন) |
| GET/POST/PATCH/DELETE | `/clients` `/clients/:id` | ক্লায়েন্ট CRUD |
| GET/POST/PATCH/DELETE | `/cycles` `/cycles/:id` | মাস/সাইকেল CRUD |
| GET | `/cycles/:id/projection` | টার্গেট ও প্রজেকশন |
| PATCH | `/cycles/:id/weeks/:weekNo` | সাপ্তাহিক বাজেট ওভাররাইড |
| GET/POST/PATCH/DELETE | `/performance` | ডেইলি পারফরম্যান্স |
| POST | `/performance/bulk` | একসাথে অনেক রো |
| GET | `/performance/breakdown` | প্ল্যাটফর্ম ও দৈনিক সিরিজ |
| GET | `/control?cycle_id=` | টার্গেট বনাম রিয়েল |
| GET/POST/PATCH/DELETE | `/tasks` | ডেইলি টাস্ক কমপ্লায়েন্স |
| GET/POST/PATCH/DELETE | `/content` | কন্টেন্ট ক্যালেন্ডার |
| GET | `/dashboard/overview` · `/dashboard/cycle` | এজেন্সি ও সাইকেল ড্যাশবোর্ড |
| GET | `/users` · `/activity` | টিম ও অডিট লগ |

রেসপন্স ফরম্যাট: `{ success, data, meta? }`, এরর: `{ success: false, message, details? }`।

### রোল পারমিশন

| রোল | পারে |
|---|---|
| admin | সব — ইউজার তৈরি/রোল বদল/নিষ্ক্রিয় |
| manager | ক্লায়েন্ট/সাইকেল/ডেটা সব CRUD, ডিলিট |
| media_buyer | ক্লায়েন্ট ও সব ডেটা এন্ট্রি ও এডিট |
| designer | কন্টেন্ট ক্যালেন্ডার লিখতে পারে |
| viewer | শুধু দেখতে পারে |

| client | শুধু নিজের ক্লায়েন্টের `/business` পোর্টাল — সেল/স্টক/খরচ দেখা ও এন্ট্রি |

---

## ক্লায়েন্ট পোর্টাল (ব্যবসার হিসাব)

টিম → ইউজার তৈরিতে রোল **ক্লায়েন্ট (পোর্টাল)** দিয়ে একটি ক্লায়েন্ট বেছে নিন। সেই লগইন শুধু `/business` দেখে;
সার্ভারে `client` রোল বাকি সব API থেকে ব্লকড, আর `/business/*` সবসময় তার নিজের `client_id`-তে লক।
টিম একই পেজ দেখে `/clients/:id/business` এ।

| ট্যাব | কী থাকে |
|---|---|
| সামারি | সেল, নিট প্রফিট, ক্যাশ ব্যালেন্স, মার্কেটিং খরচ, স্টক, প্রি-অর্ডার, বাকি, মাসিক ট্রেন্ড |
| প্রোডাক্ট ও স্টক | প্রোডাক্ট, স্টক যোগ (কেনা), কম/শেষ স্টক |
| সেল ও প্রি-অর্ডার | অর্ডার — প্রি-অর্ডার → কনফার্মড → ডেলিভারড / রিটার্ন / বাতিল |
| খরচ ও মার্কেটিং | খাতভিত্তিক খরচ + ট্র্যাকারের অ্যাড স্পেন্ড |

```
স্টক        = শুরুর স্টক + কেনা − (কনফার্মড + ডেলিভারড)     (রিটার্ন/বাতিল স্টকে থাকে)
সেল         = Σ(qty × দাম − ডিসকাউন্ট)   [কনফার্মড + ডেলিভারড]
গ্রস প্রফিট  = সেল − Σ(qty × অর্ডারের সময়ের কেনা দাম)
মার্কেটিং    = অ্যাড স্পেন্ড (performance_entries) + "marketing" খাতের খরচ
নিট প্রফিট   = গ্রস প্রফিট − অ্যাড স্পেন্ড − সব খরচ
ক্যাশ ব্যালেন্স = পাওয়া পেমেন্ট + প্রি-অর্ডার অগ্রিম − স্টক কেনা − অ্যাড স্পেন্ড − সব খরচ
```

স্টকের চেয়ে বেশি পিস কনফার্মড/ডেলিভারড করা যায় না — সেটা প্রি-অর্ডার হিসেবে নিতে হয়।
টেবিল: `products` · `stock_purchases` · `orders` · `expenses` (মাইগ্রেশন `002_client_business.sql`)।

---

## ফ্রন্টএন্ড স্ট্রাকচার

```
client/src/
├── api/           axios ইনস্ট্যান্স (auto token refresh) + endpoints
├── components/    ui/ (Button, Table, Modal, Badge, StatTile…) ও layout/
├── features/      auth clients cycles performance control tasks content dashboard users
├── lib/           format.js (৳, %, ROAS, বাংলা সংখ্যা), status.js (লেবেল ও টোন)
├── routes/        router.jsx, ProtectedRoute.jsx
└── main.jsx  index.css
```

## ডেটাবেস

`users` · `refresh_tokens` · `clients` · `cycles` · `target_weeks` · `performance_entries` ·
`task_compliance` · `content_calendar` · `activity_logs` · `schema_migrations`

সব টেবিল InnoDB / utf8mb4, ফরেন কী দিয়ে সম্পর্কযুক্ত (ক্লায়েন্ট মুছলে তার সাইকেল ও ডেটা cascade হয়)।
নতুন স্কিমা পরিবর্তনের জন্য `server/src/db/migrations/` এ পরের নম্বরের `.sql` ফাইল যোগ করুন।

## প্রোডাকশন বিল্ড

```bash
cd client && npm run build     # dist/ তৈরি হবে
cd ../server && npm start
```
