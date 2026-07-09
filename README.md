<div align="center">
  <h1>⚡ Bcrypt-Guard Adaptive Calibrator</h1>
  <p><strong>ระบบประเมินฮาร์ดแวร์เพื่อค้นหาค่า Cost ที่ดีที่สุดสำหรับอัลกอริทึม Bcrypt</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
    <img src="https://img.shields.io/badge/OWASP-Standard-brightgreen?style=for-the-badge" alt="OWASP Standard" />
  </p>
</div>

<br />

**Adaptive Calibrator** คือเครื่องมือสำหรับการวัดประสิทธิภาพ (Benchmark) การเข้ารหัสรหัสผ่านด้วย Bcrypt บนเครื่องเซิร์ฟเวอร์ของคุณ โดยระบบจะทำการทดสอบตั้งแต่ Cost 4 ถึง 14 เพื่อวัดเวลาที่ใช้ (Latency) และปริมาณการรองรับผู้ใช้งาน (Throughput) จากนั้นจะทำการคำนวณหาค่า Cost ที่เหมาะสมที่สุดตามมาตรฐานความปลอดภัยระดับสากล (OWASP)

---

## 🌟 ฟีเจอร์หลัก (Features)

- 🖥️ **System Detection:** ตรวจสอบสเปกเซิร์ฟเวอร์ (CPU, RAM, Cores) อัตโนมัติ
- ⚡ **Real-time Benchmark:** ทดสอบความเร็วในการเข้ารหัสแบบเรียลไทม์ พร้อมแถบแสดงความคืบหน้า (Progress Bar) ด้วยระบบ Server-Sent Events (SSE)
- 📊 **Visualized Results:** แสดงผลกราฟ Chart.js (Latency vs Cost, Throughput) อย่างสวยงามและเข้าใจง่าย
- 🎯 **Smart Calibration:** วิเคราะห์และแนะนำค่า Cost ที่สมดุลที่สุด พร้อมประเมินความเสี่ยงต่อการถูกโจมตีแบบ DoS
- 🌓 **Minimal UI & Theme Toggle:** ดีไซน์หน้าเว็บแบบ Clean & Minimal รองรับการสลับโหมด Light / Dark Theme อัตโนมัติ
- 🔒 **100% Offline / Air-gapped Support:** โค้ดทั้งหมดรวมถึงไลบรารีกราฟ (Chart.js) ถูกบรรจุไว้ภายในตัวคอนเทนเนอร์ สามารถรันในระบบปิดที่ไม่มีอินเทอร์เน็ตได้อย่างสมบูรณ์แบบ

---

## 🧮 ทฤษฎีการคำนวณค่า Cost ของ Bcrypt

ค่า Cost ของ Bcrypt ทำงานอยู่บนคณิตศาสตร์แบบ **ลอการิทึมฐาน 2 (Base-2 Logarithmic)** ซึ่งกำหนดจำนวนรอบการทำงานของ CPU:

> **จำนวนรอบ = 2<sup>Cost</sup>**
*   **Cost 10:** 1,024 รอบ (มาตรฐานขั้นต่ำ OWASP)
*   **Cost 11:** 2,048 รอบ
*   **Cost 12:** 4,096 รอบ

*จำนวนรอบที่เพิ่มขึ้นทวีคูณ ส่งผลให้ระยะเวลาประมวลผลเพิ่มขึ้นเป็น 2 เท่าเสมอเมื่อขยับค่า Cost ขึ้น 1 สเต็ป*
เนื่องจากความแรงของ CPU แต่ละเครื่องไม่เท่ากัน จึงไม่สามารถมีสูตรคำนวณเวลาล่วงหน้าที่แม่นยำได้ นี่คือเหตุผลที่ระบบ **Benchmark ฮาร์ดแวร์จริง** แบบโปรเจกต์นี้มีความสำคัญอย่างยิ่ง

---

## 📋 สิ่งที่ต้องมี (Prerequisites)

- [**Docker**](https://www.docker.com/products/docker-desktop/) และ **Docker Compose**
> *หมายเหตุ: โปรเจกต์นี้รันผ่าน Docker ทั้งหมด จึงไม่จำเป็นต้องติดตั้ง Node.js หรือซอฟต์แวร์อื่นๆ ลงบนเครื่องโดยตรง*

---

## 🚀 วิธีการติดตั้งและรัน (How to Build & Run)

1. **เปิด Terminal** ไปที่โฟลเดอร์ของโปรเจกต์นี้
2. **สั่ง Build และ Run Docker Container**
   ```bash
   docker compose up --build -d
   ```
3. **เข้าใช้งาน**
   เปิดเบราว์เซอร์ไปที่:
   ```
   http://localhost:4000
   ```
   *หากต้องการเปลี่ยนพอร์ต สามารถเข้าไปแก้ไขได้ในไฟล์ `.env`*

---

## 🛠️ โครงสร้างไฟล์ (Project Structure)

```text
├── Dockerfile                  # การตั้งค่า Multi-stage build สำหรับ Node.js (Alpine)
├── docker-compose.yml          # การตั้งค่าคอนเทนเนอร์และพอร์ต
├── .env                        # ตัวแปรสภาพแวดล้อม (PORT, Target Latency)
├── package.json                # Dependencies (bcrypt, express)
├── src/                        # 📁 โฟลเดอร์เก็บโค้ด Backend
│   └── server.js               # Benchmark Engine (API & SSE)
└── public/                     # 📁 โฟลเดอร์เก็บโค้ด Frontend (UI)
    ├── index.html              # หน้า Dashboard
    ├── styles.css              # Minimal clean styling (Light/Dark mode)
    ├── app.js                  # Frontend logic & Chart.js rendering
    └── chart.min.js            # ไลบรารี Chart.js สำหรับการใช้งานแบบ Offline
```

---

## 📜 การรับรองและจริยธรรม
เครื่องมือนี้จัดทำขึ้นเพื่อการประเมินสเปกเครื่องเซิร์ฟเวอร์สำหรับการเข้ารหัสรหัสผ่านให้มีความปลอดภัยตามมาตรฐานสากล ห้ามนำไปใช้เจาะระบบหรือรบกวนการทำงานของระบบเซิร์ฟเวอร์ที่ไม่ได้รับอนุญาต
