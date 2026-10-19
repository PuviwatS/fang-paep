# ฟังแป๊บ — เกมทายเพลงไทย (v1)

เกมแนว Songless สำหรับเพลงไทย ฟังท่อนสั้น 0.5 วินาที ทายผิดหรือกดข้ามจะได้ฟังยาวขึ้น
(0.5 → 1 → 2 → 4 → 8 → 16 วินาที) รวม 6 ครั้ง

**v1 มีอะไรบ้าง**

- เพลงประจำวัน 5 หมวด + โหมดสุ่มเล่นไม่จำกัด
- ตรวจคำตอบที่เซิร์ฟเวอร์ (คำตอบไม่ถูกส่งไปที่เบราว์เซอร์จนกว่าจะจบรอบ)
- สมัคร / เข้าสู่ระบบ / ลืมรหัสผ่าน ด้วย Supabase Auth (อีเมล + รหัสผ่าน)
- สถิติเก็บบนเซิร์ฟเวอร์ ย้ายความคืบหน้าที่เล่นแบบ guest เข้าบัญชีให้อัตโนมัติ
- อันดับรายวัน (เฉพาะคนที่ล็อกอินและเล่นสด)
- สมาชิกพลัส: ไม่มีโฆษณา เล่นเกมย้อนหลัง ป้ายพลัสบนอันดับ — **ชำระเงินแบบทดสอบ (mock) ยังไม่ตัดเงินจริง**
- พื้นที่โฆษณาเว้นไว้ (placeholder) ยังไม่ต่อ AdSense

## เริ่มต้น

ต้องใช้ Node.js 18.18 ขึ้นไป (แนะนำ 20 ตาม `.nvmrc`)

```bash
npm install
npm run dev        # http://localhost:3000
```

ไฟล์ `.env` มี URL และ publishable key ของ Supabase อยู่แล้ว (เป็นค่าสาธารณะ ปลอดภัยที่จะ commit)
ถ้าจะใช้โปรเจกต์ Supabase ของตัวเอง ให้คัดลอก `.env.example` เป็น `.env.local` แล้วแก้ค่า

## คำสั่งที่ใช้บ่อย

| คำสั่ง              | ทำอะไร                     |
| ------------------- | -------------------------- |
| `npm run dev`       | รันเซิร์ฟเวอร์สำหรับพัฒนา  |
| `npm run build`     | build สำหรับ production    |
| `npm run lint`      | ตรวจโค้ดด้วย ESLint        |
| `npm run typecheck` | ตรวจ type ด้วย TypeScript  |
| `npm test`          | รัน unit test (Vitest)     |
| `npm run format`    | จัดรูปแบบโค้ดด้วย Prettier |

ก่อน push ควรผ่าน `npm run lint && npm run typecheck && npm test`

## สถาปัตยกรรม

```
เบราว์เซอร์ (Next.js React)
   │  fetch /api/*                      supabase.auth.* (login, signup)
   ▼                                          │
Next.js Route Handlers (Vercel)               │
   │  supabase.rpc(...) ด้วย session ของผู้เล่น  │
   ▼                                          ▼
Supabase Postgres ──── ฟังก์ชัน SECURITY DEFINER (ตรวจคำตอบ, สถิติ, สมาชิก)
                  └── ตารางทุกตัวเปิด RLS, ตารางคำตอบอ่านตรงไม่ได้เลย
```

- **ไม่ใช้ service role key ในเว็บ** ทุกอย่างวิ่งผ่านฟังก์ชันในฐานข้อมูลด้วยสิทธิ์ของผู้เล่นเอง
- ฟังก์ชันช่วยอยู่ใน schema `private` ซึ่ง API เรียกตรงไม่ได้
- เลขเกมนับตามเวลาไทย เกม #1 = 1 ต.ค. 2026

## โครงสร้างโปรเจกต์

```
src/
├── app/
│   ├── layout.tsx              # Providers + header + footer + คอลัมน์กลางจอ
│   ├── page.tsx                # หน้าเกม
│   ├── login/ forgot/          # สมัคร / เข้าสู่ระบบ / ลืมรหัสผ่าน
│   ├── account/                # โปรไฟล์ สมาชิก สถิติ และ account/password
│   ├── pricing/ checkout/      # แพ็กเกจพลัส และหน้าชำระเงินทดสอบ (mock)
│   ├── leaderboard/ archive/   # อันดับรายวัน และเกมย้อนหลัง (พลัส)
│   ├── auth/callback/          # รับลิงก์จากอีเมลยืนยัน / รีเซ็ตรหัส
│   └── api/                    # Route Handlers: songs, puzzle, guess, stats, leaderboard,
│                               #   import-local, account, plans, subscription/{checkout,cancel,resume}
├── components/
│   ├── game/                   # หน้าเกม ไฟล์ละหนึ่ง component + CSS Module
│   ├── layout/SiteHeader.tsx   # โลโก้ เมนู ปุ่มบัญชี
│   ├── auth/RequireLogin.tsx   # หน้าไหนต้องล็อกอิน ห่อด้วยตัวนี้
│   ├── providers/              # AuthProvider (user, account, isPlus), SongCatalogProvider
│   ├── monetization/           # AdSlot (placeholder) และ PlusCard
│   └── ui/                     # Page.module.css (สไตล์ร่วมของหน้าทั่วไป), SiteFooter
├── hooks/
│   ├── useDailyRound.ts        # เพลงประจำวัน: ทายผ่าน /api/guess
│   ├── usePracticeRound.ts     # โหมดสุ่ม: ตรวจในเครื่อง
│   ├── usePreview.ts, useAudioClip.ts, useFirstVisit.ts
├── lib/
│   ├── supabase/               # client ฝั่งเบราว์เซอร์ / เซิร์ฟเวอร์ / middleware + types
│   ├── api/                    # types ของ API, zod schemas, error mapping, fetch client
│   ├── daily.ts, scoring.ts, search.ts, storage.ts, format.ts, ...
│   └── *.test.ts
├── middleware.ts               # ต่ออายุ session ทุก request
└── data/                       # songs.json / artists.json (สำรองถ้าโหลดจาก DB ไม่ได้ และใช้ทำ seed)
supabase/
├── migrations/                 # schema, functions, drop_preview_loader
└── seed/                       # 01_catalog.sql, 02_daily_puzzles.sql (สร้างจาก scripts/generate-seed.ts)
scripts/
├── generate-seed.ts            # songs.json → SQL seed + ตารางเพลงประจำวันล่วงหน้า
├── refresh-previews.ts         # อัปเดต URL เสียงจาก iTunes ลง song_previews (ต้องใช้ secret key)
└── fetch_itunes.py             # ดึงรายชื่อเพลงของศิลปินเป็น CSV เพื่อคัดเพิ่ม
```

## ฐานข้อมูล (Supabase)

| ตาราง                       | เก็บอะไร                                   | ใครอ่านได้       |
| --------------------------- | ------------------------------------------ | ---------------- |
| `artists`, `songs`          | คลังเพลง                                   | ทุกคน            |
| `song_previews`             | URL เสียง iTunes                           | ฟังก์ชันเท่านั้น |
| `daily_puzzles`             | เพลงคำตอบของแต่ละวัน/หมวด                  | ฟังก์ชันเท่านั้น |
| `profiles`                  | ชื่อที่แสดง (สร้างอัตโนมัติตอนสมัคร)       | เจ้าของ          |
| `game_results`              | ผลแต่ละรอบ (`live` / `archive` / `import`) | เจ้าของ          |
| `player_stats`              | สถิติสรุปต่อหมวด                           | เจ้าของ          |
| `plans`                     | แพ็กเกจพลัส                                | ทุกคน            |
| `subscriptions`, `payments` | สถานะสมาชิกและประวัติชำระเงิน              | เจ้าของ          |

ฟังก์ชันที่เว็บเรียก: `get_puzzle`, `submit_guess`, `get_leaderboard`, `get_my_stats`, `import_local_games`,
`get_my_account`, `update_display_name`, `mock_checkout`, `cancel_subscription`, `resume_subscription`

### ตั้งค่า Supabase Auth (ต้องทำครั้งเดียว)

Dashboard → Authentication → URL Configuration

- **Site URL**: โดเมนจริงบน Vercel เช่น `https://fang-paep.vercel.app`
- **Redirect URLs**: `https://fang-paep.vercel.app/**` และ `http://localhost:3000/**`

อีเมลที่ Supabase ส่งให้ฟรีจำกัดจำนวนต่อชั่วโมงต่ำมาก ก่อนเปิดจริงให้ต่อ SMTP เอง (เช่น Resend) ที่ Authentication → SMTP

### เพิ่มเพลง

1. รัน `python scripts/fetch_itunes.py "ชื่อศิลปิน"` แล้วคัดเพลงลง `src/data/songs.json`
2. รัน `npx -y tsx@4.19.2 --tsconfig tsconfig.json scripts/generate-seed.ts 730` เพื่อสร้าง SQL ใหม่
3. รัน `supabase/seed/*.sql` ใน SQL Editor
4. รัน `scripts/refresh-previews.ts` (ใส่ `SUPABASE_SECRET_KEY` ใน `.env.local` ก่อน) เพื่อโหลด URL เสียง

## ระบบสมาชิก — ตอนนี้เป็นโหมดทดสอบ

`/checkout` ไม่มีฟอร์มบัตร กดปุ่มแล้วเซิร์ฟเวอร์เปิดพลัสให้ทันทีผ่านฟังก์ชัน `mock_checkout`
ซึ่งทำงานได้เฉพาะตอน `private.settings.payments_mode = 'mock'` เท่านั้น

ก่อนเก็บเงินจริง:

1. เลือกผู้ให้บริการ (Stripe หรือ Opn Payments / 2C2P ที่รองรับ PromptPay)
2. เปลี่ยน `/api/subscription/checkout` ให้สร้าง checkout session ของผู้ให้บริการ
3. เพิ่ม webhook route ที่ตรวจลายเซ็นแล้วบันทึกลง `subscriptions` และ `payments` ด้วย secret key ฝั่งเซิร์ฟเวอร์
4. ตั้ง `payments_mode` เป็น `'live'` เพื่อปิด mock
5. ราคาในตาราง `plans` (49 บาท/เดือน, 399 บาท/ปี) เป็นค่าตัวอย่าง แก้ได้ในตาราง

## โฆษณา

`components/monetization/AdSlot.tsx` เป็นกล่องเว้นที่ไว้ (ซ่อนอัตโนมัติสำหรับสมาชิกพลัส)
ตอนต่อ AdSense ให้ใส่สคริปต์ใน `layout.tsx` และเปลี่ยนเนื้อหาใน AdSlot เป็น `<ins class="adsbygoogle">`

## เรื่องเสียงและลิขสิทธิ์

เว็บเล่น URL ตัวอย่างเสียง 30 วินาทีของ Apple โดยตรง ไม่ได้ดาวน์โหลดหรือเก็บไฟล์เพลงเอง
และมีลิงก์ไปฟังเต็มเพลงบน Apple Music ในหน้าเฉลย
ก่อนใส่โฆษณาหรือเก็บค่าสมาชิกจริง ต้องตรวจเงื่อนไขการใช้งานของ Apple ขอสิทธิ์จากค่ายเพลง/หน่วยงานจัดเก็บลิขสิทธิ์
และควรปรึกษาทนายด้านทรัพย์สินทางปัญญา

## Deploy

ต่อ repo กับ Vercel แล้วกด Deploy ไม่ต้องตั้ง Environment Variables เพราะค่าสาธารณะอยู่ใน `.env` แล้ว
(Hobby plan ของ Vercel ใช้ได้เฉพาะงานที่ไม่ใช่เชิงพาณิชย์ เมื่อเริ่มหารายได้ให้อัปเป็น Pro)
