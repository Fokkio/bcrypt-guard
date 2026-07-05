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
- ⚡ **Real-time Benchmark:** ทดสอบความเร็วในการเข้ารหัสแบบเรียลไทม์ พร้อมแถบแสดงความคืบหน้า (Progress Bar)
- 📊 **Visualized Results:** แสดงผลกราฟ Chart.js (Latency vs Cost, Throughput)
- 🎯 **Smart Calibration:** วิเคราะห์และแนะนำค่า Cost ที่สมดุลที่สุด พร้อมประเมินความเสี่ยงต่อการถูกโจมตีแบบ DoS

---

## 📋 สิ่งที่ต้องมี (Prerequisites)

- [**Docker**](https://www.docker.com/products/docker-desktop/) และ **Docker Compose**
> *หมายเหตุ: โปรเจคนี้รันผ่าน Docker ทั้งหมด จึงไม่จำเป็นต้องติดตั้ง Node.js หรือซอฟต์แวร์อื่นๆ ลงบนเครื่องโดยตรง*

---

## 🚀 วิธีการติดตั้งและรัน (How to Build & Run)

1. **โคลนโปรเจค / เปิด Terminal** 
   ให้เข้าไปที่โฟลเดอร์ของโปรเจคนี้

2. **สั่ง Build และ Run Docker Container**
   ```bash
   docker compose up --build -d
   ```

3. **การเข้าใช้งาน**
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
├── server.js                   # Benchmark Engine (API & Server-Sent Events)
└── public/                     
    ├── index.html              # หน้า Dashboard
    ├── styles.css              # Dark theme styling
    └── app.js                  # Frontend logic & Chart.js rendering
```

---

## 📜 การรับรองและจริยธรรม
เครื่องมือนี้จัดทำขึ้นเพื่อการประเมินสเปกเครื่องเซิร์ฟเวอร์สำหรับการเข้ารหัสรหัสผ่านให้มีความปลอดภัยตามมาตรฐานสากล ห้ามนำไปใช้เจาะระบบหรือรบกวนการทำงานของระบบเซิร์ฟเวอร์ที่ไม่ได้รับอนุญาต
