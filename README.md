# 🏥 ICU Trauma Dashboard — PWA
## วิธี Deploy บน GitHub Pages (ทีละขั้นตอน)

---

## 📁 โครงสร้างไฟล์ที่ต้องมี

```
icu-trauma/
├── index.html          ← หน้าหลัก (แก้ API URL ด้านล่าง)
├── manifest.json       ← ข้อมูล PWA
├── sw.js               ← Service Worker (offline)
├── generate-icons.html ← ใช้สร้าง icon ครั้งเดียว
└── icons/
    ├── icon-192.png    ← icon สำหรับ Android/PWA
    └── icon-512.png    ← icon สำหรับ Splash Screen
```

---

## ⚠️ ขั้นตอนที่ 1 — แก้ API URL ใน index.html

เปิด `index.html` หา บรรทัดนี้:
```javascript
var API = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID_HERE/exec';
```
เปลี่ยน `YOUR_SCRIPT_ID_HERE` เป็น Script ID จาก Google Apps Script ของคุณ

**วิธีหา Script ID:**
1. เปิด Google Apps Script
2. กด Deploy → Manage Deployments
3. Copy URL ที่ขึ้นต้นด้วย `https://script.google.com/macros/s/...`
4. เอาเฉพาะส่วน ID ที่อยู่ระหว่าง `/s/` และ `/exec`

---

## 🎨 ขั้นตอนที่ 2 — สร้าง Icons

1. เปิดไฟล์ `generate-icons.html` ใน browser
2. กด "Download icon-192.png" และ "Download icon-512.png"
3. สร้างโฟลเดอร์ชื่อ `icons` แล้วย้ายไฟล์ทั้งสองเข้าไป

---

## 🚀 ขั้นตอนที่ 3 — Upload ขึ้น GitHub Pages

### วิธีที่ 1: GitHub Desktop (ง่ายที่สุด)
1. ดาวน์โหลด [GitHub Desktop](https://desktop.github.com)
2. Login ด้วย GitHub account (สร้างฟรีได้ที่ github.com)
3. กด "Create New Repository"
   - Name: `icu-trauma`
   - ✅ Initialize with README
4. กด "Show in Finder/Explorer" แล้ว copy ไฟล์ทั้งหมดเข้าไปในโฟลเดอร์
5. กลับมา GitHub Desktop → กด Commit → Push

### วิธีที่ 2: Upload ผ่านเว็บ github.com
1. ไปที่ github.com → New Repository → ชื่อ `icu-trauma` → Public
2. กด "uploading an existing file"
3. ลากไฟล์ทั้งหมดขึ้น (รวม icons folder)
4. กด Commit changes

---

## ⚙️ ขั้นตอนที่ 4 — เปิด GitHub Pages

1. ไปที่ Repository → Settings
2. เลือก "Pages" ในเมนูซ้าย
3. Source: **Deploy from a branch**
4. Branch: **main** / Folder: **/ (root)**
5. กด Save
6. รอ 1-2 นาที → URL จะขึ้นเป็น:
   `https://[username].github.io/icu-trauma/`

---

## 📲 วิธีติดตั้งบนโทรศัพท์

### iPhone/iPad (Safari เท่านั้น)
1. เปิด URL ใน Safari
2. กดปุ่ม Share (กล่องมีลูกศรขึ้น) ⬆️
3. เลือก "Add to Home Screen"
4. ตั้งชื่อ "ICU Trauma" → Add

### Android (Chrome)
1. เปิด URL ใน Chrome
2. จะมี popup "ติดตั้งแอพ" ขึ้นมาเอง หรือ
3. กดจุด 3 จุด → "Add to Home screen"

---

## 🔄 วิธี Update โค้ด

1. แก้ไขไฟล์ที่ต้องการ
2. Upload ขึ้น GitHub อีกครั้ง (ทับของเดิม)
3. GitHub Pages จะ update อัตโนมัติภายใน 1-2 นาที
4. แอพบนโทรศัพท์จะ update เองตอนเปิดครั้งถัดไป

**หมายเหตุ:** ถ้าอัป sw.js ให้เปลี่ยนเลข version ใน sw.js ด้วย:
```javascript
const CACHE_NAME = 'icu-trauma-v2'; // เปลี่ยนจาก v1 → v2
```

---

## ✅ Checklist ก่อน Deploy

- [ ] แก้ API URL ใน index.html แล้ว
- [ ] มีไฟล์ icons/icon-192.png
- [ ] มีไฟล์ icons/icon-512.png
- [ ] ทดสอบบน browser ปกติก่อน
- [ ] Deploy ขึ้น GitHub Pages
- [ ] ทดสอบ URL บนมือถือ
- [ ] ติดตั้งบนโทรศัพท์ทีมแล้ว

---

## 🆘 ปัญหาที่พบบ่อย

**ข้อมูลไม่โหลด (CORS error)**
→ ไปที่ Apps Script → Deploy → Edit Deployment
→ Who has access: **Anyone**

**Service Worker ไม่ทำงาน**
→ ต้องใช้ HTTPS เท่านั้น (GitHub Pages มี HTTPS ให้อยู่แล้ว)

**icon ไม่ขึ้น**
→ ตรวจสอบว่ามีโฟลเดอร์ `icons/` และไฟล์ครบ

---

## 📞 Contact
ICU Trauma — โรงพยาบาลยะลา
โทร: 8504-8505
