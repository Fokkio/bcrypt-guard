# Bcrypt-Guard Adaptive Calibrator

ระบบเว็บแอปสำหรับวัดประสิทธิภาพการเข้ารหัสรหัสผ่านด้วยอัลกอริทึม bcrypt บนฮาร์ดแวร์จริง แล้วคำนวณค่า Cost หรือ Work Factor ที่เหมาะสมกับเครื่องนั้น ๆ โดยคำนึงถึงทั้งความปลอดภัย ความเร็วในการตอบสนอง และความเสี่ยงด้านภาระโหลดของระบบ

โปรเจกต์นี้ออกแบบมาเพื่อช่วยตอบคำถามสำคัญในการตั้งค่า bcrypt ว่า “ควรใช้ cost เท่าไรจึงจะปลอดภัยพอ แต่ยังไม่ทำให้ระบบ login ช้าเกินไป” เพราะประสิทธิภาพของ CPU แต่ละเครื่องไม่เท่ากัน การใช้ค่าคงที่เดียวกันทุกเครื่องอาจทำให้บางระบบช้าเกินไป หรือบางระบบตั้งค่าต่ำเกินความสามารถของฮาร์ดแวร์

---

## สารบัญ

- [ภาพรวมของระบบ](#ภาพรวมของระบบ)
- [ปัญหาที่โปรเจกต์นี้แก้ไข](#ปัญหาที่โปรเจกต์นี้แก้ไข)
- [ฟีเจอร์หลัก](#ฟีเจอร์หลัก)
- [หลักการทำงานของ bcrypt cost](#หลักการทำงานของ-bcrypt-cost)
- [ขั้นตอนการทำงานของระบบ](#ขั้นตอนการทำงานของระบบ)
- [สถาปัตยกรรมระบบ](#สถาปัตยกรรมระบบ)
- [โครงสร้างไฟล์](#โครงสร้างไฟล์)
- [เทคโนโลยีที่ใช้](#เทคโนโลยีที่ใช้)
- [การติดตั้งและรันโปรเจกต์](#การติดตั้งและรันโปรเจกต์)
- [การตั้งค่าผ่าน Environment Variables](#การตั้งค่าผ่าน-environment-variables)
- [API Endpoints](#api-endpoints)
- [รายละเอียด Algorithm การแนะนำ Cost](#รายละเอียด-algorithm-การแนะนำ-cost)
- [การประเมินความเสี่ยง DoS](#การประเมินความเสี่ยง-dos)
- [Offline และ Air-gapped Support](#offline-และ-air-gapped-support)
- [Docker และ Security Hardening](#docker-และ-security-hardening)
- [ข้อจำกัดของระบบ](#ข้อจำกัดของระบบ)
- [Troubleshooting](#troubleshooting)
- [แนวทางพัฒนาต่อ](#แนวทางพัฒนาต่อ)

---

## ภาพรวมของระบบ

Bcrypt-Guard Adaptive Calibrator เป็นเครื่องมือ benchmark และ calibration สำหรับ bcrypt โดยระบบจะรันการ hash password จริงด้วยค่า cost หลายระดับ เช่น cost 4 ถึง cost 14 แล้ววัดเวลาที่ใช้ในการประมวลผลแต่ละระดับ จากนั้นจึงคำนวณค่า cost ที่เหมาะสมที่สุดตาม target latency ที่ผู้ใช้กำหนด

ค่าเริ่มต้นของระบบตั้งไว้ดังนี้:

- ช่วง cost ที่ทดสอบ: `4` ถึง `14`
- จำนวน sample ต่อ cost: `5` ครั้ง
- target latency: `250 ms`
- ค่า OWASP minimum ที่ระบบบังคับใช้: `cost 10`
- port เริ่มต้น: `4000`

ผลลัพธ์ที่ระบบแสดงประกอบด้วย:

- ค่า cost ที่แนะนำ
- latency ต่อการ hash 1 ครั้ง
- throughput โดยประมาณในหน่วย hashes/sec หรือ logins/sec
- จำนวนรอบการทำงานของ bcrypt ตามสูตร `2^cost`
- ระดับความแข็งแรงด้านความปลอดภัย
- ความเสี่ยงเมื่อถูกโจมตีแบบ DoS
- กราฟเปรียบเทียบ latency และ throughput ตามค่า cost
- ข้อมูล hardware ของเครื่องที่ใช้รัน benchmark

---

## ปัญหาที่โปรเจกต์นี้แก้ไข

การตั้งค่า bcrypt cost เป็นเรื่องที่ต้องสมดุลระหว่างความปลอดภัยกับประสิทธิภาพ

ถ้าตั้ง cost ต่ำเกินไป:

- ผู้โจมตีสามารถ brute force password hash ได้ง่ายขึ้น
- ระบบไม่ใช้ศักยภาพของฮาร์ดแวร์ให้เต็มที่
- ไม่สอดคล้องกับแนวทางความปลอดภัยสมัยใหม่

ถ้าตั้ง cost สูงเกินไป:

- การ login อาจช้าจนกระทบ UX
- server รับ request login พร้อมกันได้น้อยลง
- มีความเสี่ยงถูกโจมตีแบบ Denial of Service ได้ง่ายขึ้น เพราะแต่ละ request ใช้ CPU สูง

ดังนั้นโปรเจกต์นี้จึงใช้แนวคิด adaptive calibration คือให้ระบบวัดจากเครื่องจริง แล้วแนะนำค่า cost ที่เหมาะกับเครื่องนั้นโดยตรง

---

## ฟีเจอร์หลัก

### 1. ตรวจสอบข้อมูลเครื่องอัตโนมัติ

ระบบอ่านข้อมูลจาก Node.js `os` module เพื่อแสดงข้อมูลเครื่องที่รัน server เช่น:

- hostname
- operating system
- CPU model
- จำนวน logical cores
- จำนวน physical cores โดยประมาณ
- RAM ทั้งหมดและ RAM ที่ใช้งานอยู่
- Node.js version

### 2. Real-time CPU และ RAM Monitoring

ระบบมี endpoint แบบ Server-Sent Events สำหรับ stream ข้อมูลเครื่องแบบต่อเนื่อง โดย frontend จะอัปเดต gauge ของ CPU และ RAM บนหน้าเว็บ

CPU usage คำนวณจากค่า CPU times ของระบบจริง ไม่ใช่ค่าจำลอง ส่วน RAM usage คำนวณจาก total memory และ free memory ของเครื่อง

### 3. Benchmark bcrypt ตามช่วง cost ที่กำหนด

ผู้ใช้สามารถกำหนด:

- cost ต่ำสุด
- cost สูงสุด
- target latency

เมื่อเริ่ม benchmark ระบบจะ hash password จริงด้วย bcrypt หลายครั้งในแต่ละ cost แล้วคำนวณค่าสถิติ

### 4. Progress แบบ Real-time ด้วย SSE

ระหว่าง benchmark ระบบส่ง progress กลับไปยัง frontend ผ่าน Server-Sent Events ทำให้หน้าเว็บแสดงสถานะได้ทันที เช่น:

- benchmark เริ่มแล้ว
- กำลังทดสอบ cost ใด
- สำเร็จไปกี่เปอร์เซ็นต์
- latency และ throughput ของ cost ล่าสุด
- benchmark เสร็จสมบูรณ์
- benchmark ถูกยกเลิกหรือเกิด error

### 5. Calibration และ Recommendation

หลัง benchmark เสร็จ ระบบจะคำนวณค่า cost ที่แนะนำโดยพิจารณาจาก:

- cost สูงสุดที่ median latency ไม่เกิน target latency
- ค่า minimum security floor ที่ cost 10
- ผล benchmark จริงของ cost ที่แนะนำ
- throughput โดยประมาณ
- ความเสี่ยง DoS

### 6. Visualization ด้วย Chart.js

หน้าเว็บแสดงกราฟ 2 ส่วน:

- Latency vs Cost Factor
- Throughput vs Cost Factor

กราฟ latency มีเส้น target latency เพื่อให้เห็นชัดว่าค่า cost ใดเริ่มเกินเป้าหมายที่ตั้งไว้

### 7. Export ผลลัพธ์เป็น JSON

หลัง benchmark เสร็จ ผู้ใช้สามารถ export ผลลัพธ์เป็นไฟล์ JSON ได้ผ่าน endpoint `/api/benchmark/export` หรือปุ่ม Export JSON บนหน้าเว็บ

### 8. รองรับ Light/Dark Theme

Frontend รองรับการเปลี่ยน theme และบันทึก preference ไว้ใน `localStorage`

### 9. รองรับการใช้งานแบบ Offline Runtime

ตัว runtime ของเว็บไม่โหลด library จาก CDN โดย Chart.js ถูกเก็บไว้ใน `public/chart.min.js` และ CSS ใช้ system fonts แทน Google Fonts

---

## หลักการทำงานของ bcrypt cost

bcrypt ใช้ค่า cost เพื่อกำหนดจำนวนรอบการประมวลผล โดยจำนวนรอบเพิ่มแบบ exponential ตามสูตร:

```text
iterations = 2^cost
```

ตัวอย่าง:

```text
cost 10 = 2^10 = 1,024 รอบ
cost 11 = 2^11 = 2,048 รอบ
cost 12 = 2^12 = 4,096 รอบ
```

เมื่อเพิ่ม cost ขึ้น 1 ระดับ โดยหลักการแล้วภาระงานจะเพิ่มขึ้นประมาณ 2 เท่า ทำให้เวลาที่ใช้ hash password เพิ่มขึ้นตามไปด้วย

อย่างไรก็ตาม latency จริงขึ้นอยู่กับ hardware และโหลดของเครื่อง ณ เวลาที่รัน benchmark จึงไม่ควรเดาค่า cost จากสูตรเพียงอย่างเดียว แต่ควรวัดจากเครื่องจริง

---

## ขั้นตอนการทำงานของระบบ

เมื่อผู้ใช้กดเริ่ม Benchmark ระบบทำงานตามลำดับนี้:

1. Frontend ส่ง request ไปที่ `POST /api/benchmark/run`
2. Backend ตรวจสอบว่าไม่มี benchmark อื่นกำลังรันอยู่
3. Backend validate ค่า input เช่น cost range และ target latency
4. Backend เริ่ม benchmark แบบ asynchronous
5. Frontend เปิด SSE connection ไปที่ `/api/benchmark/stream`
6. Backend ส่ง progress แต่ละขั้นกลับไปยัง frontend
7. Backend hash password ด้วย bcrypt ตาม cost ที่กำหนด
8. Backend วัดเวลาของแต่ละ sample ด้วย `process.hrtime.bigint()`
9. Backend คำนวณ median, mean, min, max และ throughput
10. เมื่อครบทุก cost ระบบเรียก calibration algorithm
11. Backend ส่งผลลัพธ์ทั้งหมดกลับไปยัง frontend ผ่าน SSE
12. Frontend แสดง recommendation, warning, reasoning และกราฟ
13. ผู้ใช้สามารถ export ผลลัพธ์เป็น JSON ได้

---

## สถาปัตยกรรมระบบ

```text
Browser / Frontend
        |
        | HTTP + Server-Sent Events
        v
Express.js Backend
        |
        | bcrypt.hash()
        v
Native bcrypt workload on CPU
        |
        v
Benchmark statistics + Calibration result
```

ระบบแบ่งออกเป็น 3 ส่วนหลัก:

### Frontend

อยู่ในโฟลเดอร์ `public/` ทำหน้าที่แสดง dashboard, form, progress, recommendation และ charts

### Backend

อยู่ในไฟล์ `src/server.js` ทำหน้าที่เป็น API server, benchmark engine, system monitor และ calibration engine

### Container Runtime

ควบคุมด้วย `Dockerfile` และ `docker-compose.yml` เพื่อให้รันได้ง่ายและสภาพแวดล้อมสม่ำเสมอ

---

## โครงสร้างไฟล์

```text
.
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── README.md
├── .env
├── .dockerignore
├── .gitignore
├── src/
│   └── server.js
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── chart.min.js
```

รายละเอียดไฟล์สำคัญ:

| ไฟล์ | หน้าที่ |
|---|---|
| `src/server.js` | Express server, API endpoints, benchmark engine, calibration logic, SSE streams |
| `public/index.html` | โครงสร้างหน้า dashboard |
| `public/styles.css` | styling, theme, layout, responsive UI |
| `public/app.js` | frontend logic, fetch API, SSE listener, chart rendering |
| `public/chart.min.js` | Chart.js แบบ local สำหรับ offline runtime |
| `Dockerfile` | build image สำหรับ Node.js app |
| `docker-compose.yml` | กำหนด service, port, environment และ restart policy |
| `.env` | ค่า config เริ่มต้นของระบบ |

---

## เทคโนโลยีที่ใช้

### Backend

- Node.js 20
- Express.js
- bcrypt
- dotenv
- helmet
- express-rate-limit
- Server-Sent Events

### Frontend

- HTML
- CSS
- Vanilla JavaScript
- Chart.js local bundle

### Deployment

- Docker
- Docker Compose หรือ docker-compose
- Alpine Linux base image

---

## การติดตั้งและรันโปรเจกต์

### วิธีที่แนะนำ: รันผ่าน Docker

ตรวจสอบว่าติดตั้ง Docker และ Docker Compose แล้ว จากนั้นรันคำสั่ง:

```bash
docker-compose up --build -d
```

หรือถ้าเครื่องรองรับ Docker Compose v2:

```bash
docker compose up --build -d
```

หลัง container ทำงานแล้ว เปิด browser ไปที่:

```text
http://localhost:4000
```

ดู log ของ container:

```bash
docker-compose logs -f calibrator
```

หยุดระบบ:

```bash
docker-compose down
```

### รันแบบ Local Node.js

ถ้าต้องการรันโดยไม่ใช้ Docker ให้ติดตั้ง dependencies ก่อน:

```bash
npm install
```

จากนั้นรัน server:

```bash
npm start
```

สำหรับโหมด development:

```bash
npm run dev
```

เปิดเว็บที่:

```text
http://localhost:4000
```

---

## การตั้งค่าผ่าน Environment Variables

ค่าหลักอยู่ในไฟล์ `.env`

```env
PORT=4000
BENCHMARK_MIN_COST=4
BENCHMARK_MAX_COST=14
BENCHMARK_SAMPLES=5
TARGET_LATENCY_MS=250
```

รายละเอียด:

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---:|---|
| `PORT` | `4000` | port ที่ web server ใช้งาน |
| `BENCHMARK_MIN_COST` | `4` | cost ต่ำสุดที่ใช้ benchmark |
| `BENCHMARK_MAX_COST` | `14` | cost สูงสุดที่ใช้ benchmark |
| `BENCHMARK_SAMPLES` | `5` | จำนวนครั้งที่ hash ต่อ cost |
| `TARGET_LATENCY_MS` | `250` | latency เป้าหมายต่อ hash 1 ครั้ง |

หมายเหตุ:

- ระบบ validate cost range ให้ไม่ต่ำกว่า `4` และไม่เกิน `20`
- ช่วง benchmark ต้องครอบคลุม `cost 10` เพราะระบบใช้เป็น OWASP minimum floor
- target latency ที่ frontend และ backend รองรับคือ `50–2000 ms`

---

## API Endpoints

### `GET /api/system-info`

คืนข้อมูล hardware และ runtime ของระบบ

ตัวอย่าง response:

```json
{
  "hostname": "server-name",
  "platform": "win32",
  "arch": "x64",
  "release": "10.0.22631",
  "uptime": 12345,
  "cpu": {
    "model": "Intel(R) Core(TM)",
    "speed": 2688,
    "cores": 16,
    "physicalCores": 8,
    "usagePercent": 12.5
  },
  "memory": {
    "total": 16800000000,
    "free": 8000000000,
    "used": 8800000000,
    "usagePercent": "52.4"
  },
  "node": "v20.x.x",
  "bcryptNative": true
}
```

### `GET /api/system/stream`

SSE stream สำหรับข้อมูลระบบแบบ real-time โดยส่งข้อมูลรูปแบบเดียวกับ `/api/system-info` ทุก 1 วินาทีเมื่อมี client เชื่อมต่อ

### `POST /api/benchmark/run`

เริ่ม benchmark ใหม่

ตัวอย่าง request body:

```json
{
  "minCost": 4,
  "maxCost": 14,
  "targetLatency": 250
}
```

เงื่อนไข validation:

- `minCost` ต้องไม่ต่ำกว่า `4`
- `maxCost` ต้องไม่เกิน `20`
- `minCost` ต้องไม่มากกว่า `maxCost`
- ช่วง cost ต้องครอบคลุม `10`
- `targetLatency` ต้องอยู่ระหว่าง `50–2000 ms`

### `POST /api/benchmark/stop`

หยุด benchmark ที่กำลังทำงานอยู่

### `GET /api/benchmark/status`

คืนสถานะ benchmark ปัจจุบัน เช่น running, progress, currentCost และ error

### `GET /api/benchmark/results`

คืนผลลัพธ์ benchmark ล่าสุด หากยังไม่เคยรัน benchmark จะคืน `404`

### `GET /api/benchmark/stream`

SSE stream สำหรับ progress ของ benchmark

ชนิด event ที่ระบบส่งได้ เช่น:

- `connected`
- `start`
- `progress`
- `result`
- `complete`
- `error`
- `cancelled`

### `POST /api/calibrate`

คำนวณ calibration ใหม่จากผล benchmark เดิม โดยเปลี่ยน target latency ได้โดยไม่ต้องรัน benchmark ซ้ำ

ตัวอย่าง request body:

```json
{
  "targetLatency": 300
}
```

### `GET /api/benchmark/export`

ดาวน์โหลดผล benchmark ล่าสุดเป็น JSON file ชื่อ `bcrypt-benchmark-results.json`

---

## รายละเอียด Algorithm การแนะนำ Cost

ระบบใช้ข้อมูล benchmark จริงในการคำนวณ โดยมี logic หลักดังนี้:

1. วนดูผล benchmark จาก cost ต่ำไปสูง
2. หา cost สูงสุดที่ `median latency <= target latency`
3. ตั้งค่า OWASP minimum เป็น `10`
4. เลือกค่าแนะนำเป็น `max(maxSafeCost, 10)`
5. ตรวจสอบว่าค่า recommended cost อยู่ในช่วงที่ benchmark จริง
6. ถ้า recommended cost เกิน target latency ระบบยังแนะนำ cost นั้นหากเป็นขั้นต่ำด้านความปลอดภัย แต่จะแสดง warning

ตัวอย่าง:

```text
target latency = 250 ms

cost 8  = 45 ms
cost 9  = 90 ms
cost 10 = 180 ms
cost 11 = 360 ms

maxSafeCost = 10
recommendedCost = max(10, 10) = 10
```

อีกกรณีหนึ่ง:

```text
target latency = 100 ms

cost 8  = 45 ms
cost 9  = 90 ms
cost 10 = 180 ms

maxSafeCost = 9
recommendedCost = max(9, 10) = 10
```

ในกรณีนี้ระบบจะแนะนำ `cost 10` เพราะเป็นค่า minimum ด้านความปลอดภัย แต่จะแสดง warning ว่า latency เกิน target ที่กำหนด

---

## การประเมินความเสี่ยง DoS

ระบบประเมินความเสี่ยง DoS จาก throughput ของ recommended cost

```text
throughput = 1000 / medianLatencyMs
```

เกณฑ์ที่ใช้:

| Throughput | ระดับความเสี่ยง | ความหมาย |
|---:|---|---|
| `>= 50` hashes/sec | LOW | ความเสี่ยงต่ำ |
| `>= 10` hashes/sec | MEDIUM | ควรมี rate limiting |
| `>= 3` hashes/sec | HIGH | ควรมี rate limiting และ CAPTCHA |
| `< 3` hashes/sec | CRITICAL | เสี่ยงทำให้ server รับโหลด login ไม่ไหว |

การประเมินนี้เป็น heuristic สำหรับช่วยตัดสินใจ ไม่ใช่การรับประกันความปลอดภัยทั้งหมดของระบบจริง

---

## Offline และ Air-gapped Support

ระบบ runtime ถูกออกแบบให้ใช้งานได้โดยไม่ต้องโหลด frontend library จาก internet

สิ่งที่ทำไว้:

- Chart.js อยู่ในไฟล์ `public/chart.min.js`
- HTML ไม่โหลด Google Fonts
- CSS ใช้ system fonts
- CSP จำกัด resource เป็น `'self'`
- Docker image copy source และ static assets เข้า container ทั้งหมด

หมายเหตุ: เอกสาร README อาจถูกเปิดในระบบที่มีการ render markdown จาก platform ภายนอก แต่ตัว web application runtime ไม่พึ่ง CDN

---

## Docker และ Security Hardening

Dockerfile ใช้แนวทาง multi-stage build:

1. build stage ใช้ `node:20-alpine`
2. ติดตั้ง build dependencies สำหรับ native bcrypt เช่น `python3`, `make`, `g++`
3. ติดตั้ง dependency ด้วย `npm ci --omit=dev`
4. production stage copy เฉพาะ `node_modules`, `package.json`, `src/` และ `public/`
5. รัน process ด้วย user `node` แทน root
6. มี `HEALTHCHECK` ไปที่ `/api/system-info`

ในฝั่ง Express ใช้:

- `helmet` สำหรับ security headers
- Content Security Policy ที่จำกัด source เป็น local
- `express-rate-limit` สำหรับจำกัดการเรียก benchmark ไม่ให้ถี่เกินไป
- validation input ก่อนเริ่ม benchmark
- timeout อัตโนมัติ 5 นาทีเพื่อปลดล็อก state ถ้า benchmark ค้าง

---

## ข้อจำกัดของระบบ

1. ผล benchmark ขึ้นกับโหลดเครื่อง ณ เวลาที่รัน

ถ้าเครื่องกำลังทำงานหนักอยู่ ผล latency อาจสูงกว่าปกติ ควรรันหลายรอบหรือรันในช่วงที่เครื่องมีโหลดใกล้เคียง production

2. CPU usage เป็นการ sample ระหว่างช่วงเวลาสั้น ๆ

ค่าที่แสดงเป็นค่าประมาณจาก CPU times ของระบบ อาจไม่ตรงกับ Task Manager หรือ monitoring tool แบบเต็มรูปแบบทุกประการ

3. Throughput เป็นค่าประมาณจาก single hash latency

ระบบไม่ได้จำลอง concurrent login จริง แต่คำนวณ throughput จาก median latency ของ bcrypt hash

4. ค่า OWASP minimum ถูกตั้งเป็น cost 10

ระบบใช้ cost 10 เป็น security floor เพื่อให้ recommendation ไม่ต่ำเกินไป แม้บาง hardware จะทำให้ latency เกิน target

5. ผลลัพธ์ไม่ใช่ security audit ทั้งระบบ

ระบบนี้ช่วยเลือกค่า bcrypt cost เท่านั้น ไม่ได้ตรวจสอบ password policy, session security, database security หรือ authentication flow ทั้งหมด

---

## Troubleshooting

### เปิดเว็บไม่ได้ที่ `http://localhost:4000`

ตรวจสอบว่า container ทำงานอยู่:

```bash
docker-compose ps
```

ดู log:

```bash
docker-compose logs -f calibrator
```

ถ้า port 4000 ถูกใช้อยู่ ให้แก้ค่า `PORT` ใน `.env`

### `docker compose` ใช้ไม่ได้

บางเครื่องมี Docker Compose แบบ legacy command ให้ใช้:

```bash
docker-compose up --build -d
```

แทน:

```bash
docker compose up --build -d
```

### build bcrypt ไม่ผ่าน

bcrypt เป็น native dependency จึงต้องมี build tools ใน build stage ซึ่ง Dockerfile ติดตั้งไว้แล้ว:

```dockerfile
RUN apk add --no-cache python3 make g++
```

ถ้ารัน local โดยไม่ใช้ Docker และติดตั้ง bcrypt ไม่ผ่าน ให้ใช้ Docker เป็นวิธีหลัก

### benchmark ใช้เวลานาน

ค่า cost สูงจะทำให้เวลา hash เพิ่มขึ้นแบบ exponential ถ้าเครื่องช้า ให้ลด `BENCHMARK_MAX_COST` แต่ต้องให้ช่วง cost ครอบคลุม `10`

### ระบบแจ้งว่า cost range ต้องครอบคลุม cost 10

เพราะ calibration algorithm ใช้ `cost 10` เป็น OWASP minimum floor ดังนั้นช่วงทดสอบต้องมี cost 10 อยู่ด้วย เช่น:

```text
4–14  ใช้ได้
8–12  ใช้ได้
10–14 ใช้ได้
4–9   ใช้ไม่ได้
11–14 ใช้ไม่ได้
```

---

## แนวทางพัฒนาต่อ

ฟีเจอร์ที่สามารถต่อยอดได้:

- เพิ่ม benchmark แบบ concurrent requests เพื่อจำลอง login traffic จริง
- เพิ่ม export เป็น CSV หรือ PDF report
- เพิ่ม historical results เพื่อเปรียบเทียบหลายเครื่อง
- เพิ่มระบบ profile สำหรับ environment เช่น development, staging, production
- เพิ่ม authentication สำหรับ dashboard ถ้านำไป deploy จริง
- เพิ่ม Prometheus metrics endpoint
- เพิ่ม unit test สำหรับ calibration algorithm
- เพิ่ม e2e test สำหรับ frontend workflow
- เพิ่มตัวเลือก password length และ bcrypt salt behavior สำหรับงานวิจัยเชิงลึก

---

## สรุป

Bcrypt-Guard Adaptive Calibrator เป็นเครื่องมือช่วยเลือกค่า bcrypt cost จากข้อมูล benchmark จริงของ hardware ที่ใช้งาน โดยเน้นความสมดุลระหว่างความปลอดภัยและประสิทธิภาพ

ระบบนี้เหมาะสำหรับใช้เป็นเครื่องมือประกอบการตัดสินใจในการตั้งค่า password hashing ของ backend application โดยเฉพาะในกรณีที่ต้อง deploy บนเครื่องหรือ container environment ที่มีประสิทธิภาพแตกต่างกัน
