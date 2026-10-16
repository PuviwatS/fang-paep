# ฟังแป๊บ — เกมทายเพลงไทย (MVP)

เกมแนว Songless สำหรับเพลงไทย ฟังท่อนสั้น 0.5 วินาที ทายผิดหรือกดข้ามจะได้ฟังยาวขึ้น
(0.5 → 1 → 2 → 4 → 8 → 16 วินาที) รวม 6 ครั้ง

## เริ่มต้น

ต้องใช้ Node.js 18.18 ขึ้นไป (แนะนำ 20 ตาม `.nvmrc`)

```bash
npm install
npm run dev        # http://localhost:3000
```

ต้องต่ออินเทอร์เน็ต เพราะเสียงตัวอย่างโหลดจาก iTunes ตอนเล่น

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

## โครงสร้างโปรเจกต์

```
src/
├── app/                    # Next.js App Router: layout, หน้าแรก, global CSS
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css         # design tokens (สี ฟอนต์ ขอบมน) + ค่าเริ่มต้นของ element
├── components/
│   ├── game/               # ทุกอย่างบนหน้าเกม ไฟล์ละหนึ่ง component + CSS Module ของตัวเอง
│   │   ├── Game.tsx        # ตัวประกอบหน้าจอ: ต่อ state, เสียง และ component ย่อยเข้าด้วยกัน
│   │   ├── GameHeader.tsx  # โลโก้ เลขเกม ปุ่มวิธีเล่น
│   │   ├── CategoryTabs.tsx
│   │   ├── ModeToggle.tsx  # เพลงประจำวัน / สุ่มเล่น
│   │   ├── GuessList.tsx   # 6 แถวคำตอบ พร้อมสีผลทาย
│   │   ├── Player.tsx      # แถบเวลาและปุ่มเล่น
│   │   ├── GuessInput.tsx  # ช่องค้นหาเพลง + ปุ่มข้าม
│   │   ├── ResultCard.tsx  # เฉลย แชร์ผล สถิติ
│   │   └── HelpDialog.tsx
│   ├── monetization/       # ตำแหน่งโฆษณาและการ์ดสมาชิก (ตัวอย่าง ยังไม่ต่อระบบจริง)
│   └── ui/                 # ชิ้นส่วนทั่วไป เช่น footer
├── hooks/                  # React hooks ที่แยก logic ออกจาก UI
│   ├── useGame.ts          # state ของรอบเกม: คำตอบ การทาย การบันทึก สถิติ
│   ├── usePreview.ts       # ดึง URL เสียงจาก iTunes
│   ├── useAudioClip.ts     # เล่นเสียง N วินาทีแรกแล้วหยุดเอง
│   └── useFirstVisit.ts    # เปิดวิธีเล่นครั้งแรกที่เข้าเว็บ
├── lib/                    # TypeScript ล้วน ไม่ผูกกับ React ทดสอบได้ง่าย
│   ├── types.ts            # type หลักของโปรเจกต์
│   ├── constants.ts        # ค่าคงที่ เช่น ความยาวท่อน หมวดเพลง วันเริ่มเกม
│   ├── songs.ts            # โหลดคลังเพลงและชื่อศิลปินภาษาไทย
│   ├── search.ts           # ค้นหาเพลงจากชื่อเพลงหรือศิลปิน
│   ├── daily.ts            # คำนวณเลขวันตามเวลาไทย และเลือกเพลงประจำวัน
│   ├── scoring.ts          # ตรวจคำตอบ ความยาวที่ปลดล็อก ข้อความแชร์
│   ├── itunes.ts           # เรียก iTunes Lookup API
│   ├── storage.ts          # อ่าน/เขียน localStorage แบบไม่ throw
│   ├── format.ts           # จัดรูปแบบเวลาและเปอร์เซ็นต์
│   └── *.test.ts           # unit test อยู่ข้างไฟล์ที่ทดสอบ
└── data/
    ├── songs.json          # คลังเพลง: [iTunes trackId, ชื่อเพลง, ศิลปิน, หมวด, ปี]
    └── artists.json        # ชื่อศิลปินภาษาไทยสำหรับช่องค้นหา
scripts/
└── fetch_itunes.py         # ดึงรายชื่อเพลงของศิลปินจาก iTunes เป็น CSV เพื่อคัดเพิ่ม
```

### หลักการแบ่งไฟล์

- **`lib/`** เป็น logic ล้วน ไม่ import React จึงเขียน unit test ได้ตรงๆ
- **`hooks/`** เป็นตัวเชื่อม logic กับ React state และ side effect (เสียง, network, localStorage)
- **`components/`** แสดงผลอย่างเดียว รับข้อมูลผ่าน props แต่ละไฟล์มี `.module.css` ของตัวเอง
- สี ฟอนต์ และขนาดขอบมนกำหนดเป็น CSS variable ไว้ที่ `globals.css` ที่เดียว

## เพิ่มเพลง

1. รัน `python scripts/fetch_itunes.py "ชื่อศิลปิน"` เพื่อดึงรายการเพลงเป็น CSV
2. คัดเพลงที่คนรู้จัก แล้วเพิ่มลง `src/data/songs.json` ในรูปแบบ `[trackId, "ชื่อเพลง", "ศิลปิน", "หมวด", "ปี"]`
   หมวดใช้ได้: `pop`, `rock`, `luk`, `hiphop`
3. ถ้าเป็นศิลปินใหม่ เพิ่มชื่อภาษาไทยใน `src/data/artists.json`
4. รัน `npm test` เพื่อเช็คว่าไม่มีอะไรพัง

## เรื่องเสียงและลิขสิทธิ์

เว็บเก็บแค่ `trackId` แล้วเรียก `https://itunes.apple.com/lookup?id=...&country=th` ตอนเล่น
เพื่อเอา URL ตัวอย่างเสียง 30 วินาทีของ Apple มาเล่นโดยตรง ไม่ได้ดาวน์โหลดหรือเก็บไฟล์เพลงไว้เอง
และมีลิงก์ "ฟังเต็มเพลงบน Apple Music" ในหน้าเฉลย

เดโมนี้ใช้ทดสอบว่าคนอยากเล่นไหมเท่านั้น ก่อนใส่โฆษณาหรือเก็บค่าสมาชิกจริง ต้องตรวจเงื่อนไขการใช้งานของ Apple
และขอสิทธิ์จากค่ายเพลงหรือหน่วยงานจัดเก็บลิขสิทธิ์ และควรปรึกษาทนายด้านทรัพย์สินทางปัญญา

## Deploy

ต่อ repo นี้กับ Vercel แล้วกด Deploy ได้เลย ไม่ต้องตั้งค่าเพิ่ม (Hobby plan ใช้ได้เฉพาะงานที่ไม่ใช่เชิงพาณิชย์)

## ขั้นต่อไป

1. ย้าย `songs.json` ไปเป็นตาราง `songs` ใน Supabase (Postgres) และทำหน้าแอดมินเพิ่มหรือแก้เพลง
2. ล็อกอินด้วย Supabase Auth และเก็บสถิติบนเซิร์ฟเวอร์แทน localStorage
3. ตรวจคำตอบผ่าน API route ฝั่งเซิร์ฟเวอร์ เพื่อไม่ให้โกงได้ก่อนทำ leaderboard
4. ใส่ Umami หรือ GA4 วัดจำนวนผู้เล่นรายวันและอัตรากลับมาเล่นซ้ำ
5. เมื่อได้สิทธิ์เสียงแล้ว ค่อยเก็บคลิปบน Cloudflare R2 และเลือกจุดเริ่มท่อนเองได้
6. ต่อ AdSense และระบบสมาชิก (Stripe หรือ Opn Payments ที่รองรับ PromptPay)
