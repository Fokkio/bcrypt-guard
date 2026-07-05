// =============================================
// Bcrypt-Guard Adaptive Calibrator
// Benchmark Engine + API Server
// =============================================

const express = require('express');
const bcrypt = require('bcrypt');
const os = require('os');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT) || 4000;
const MIN_COST = parseInt(process.env.BENCHMARK_MIN_COST) || 4;
const MAX_COST = parseInt(process.env.BENCHMARK_MAX_COST) || 14;
const SAMPLES = parseInt(process.env.BENCHMARK_SAMPLES) || 5;
const TARGET_LATENCY = parseInt(process.env.TARGET_LATENCY_MS) || 250;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── State ──
let benchmarkState = {
    running: false,
    progress: 0,
    currentCost: 0,
    results: null,
    error: null,
};

// SSE clients
let sseClients = [];

// =============================================
// System Information
// =============================================

function getSystemInfo() {
    const cpus = os.cpus();
    const cpu = cpus[0] || {};
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        uptime: os.uptime(),
        cpu: {
            model: cpu.model || 'Unknown',
            speed: cpu.speed || 0,        // MHz
            cores: cpus.length,
            physicalCores: getPhysicalCores(cpus),
        },
        memory: {
            total: totalMem,
            free: freeMem,
            used: totalMem - freeMem,
            usagePercent: ((totalMem - freeMem) / totalMem * 100).toFixed(1),
        },
        node: process.version,
        bcryptNative: true,
    };
}

function getPhysicalCores(cpus) {
    // Estimate: logical / 2 for hyperthreaded CPUs, minimum 1
    const logical = cpus.length;
    return Math.max(1, Math.floor(logical / 2));
}

function formatBytes(bytes) {
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(2)} GB`;
}

// =============================================
// Benchmark Engine
// =============================================

async function runSingleBenchmark(cost) {
    const password = 'BenchmarkPassword!@#$%^&*()2026';
    const times = [];

    for (let i = 0; i < SAMPLES; i++) {
        const start = process.hrtime.bigint();
        await bcrypt.hash(password, cost);
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1_000_000;
        times.push(ms);
    }

    // Sort and take median
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const min = times[0];
    const max = times[times.length - 1];

    return {
        cost,
        iterations: Math.pow(2, cost),
        samples: SAMPLES,
        median: parseFloat(median.toFixed(2)),
        mean: parseFloat(mean.toFixed(2)),
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2)),
        throughput: parseFloat((1000 / median).toFixed(2)),  // hashes/sec
        allTimes: times.map(t => parseFloat(t.toFixed(2))),
    };
}

async function runFullBenchmark(minCost, maxCost) {
    benchmarkState.running = true;
    benchmarkState.progress = 0;
    benchmarkState.results = null;
    benchmarkState.error = null;

    const results = [];
    const totalSteps = maxCost - minCost + 1;

    sendSSE({ type: 'start', minCost, maxCost, totalSteps });

    for (let cost = minCost; cost <= maxCost; cost++) {
        if (!benchmarkState.running) {
            sendSSE({ type: 'cancelled' });
            return null;
        }

        benchmarkState.currentCost = cost;
        benchmarkState.progress = ((cost - minCost) / totalSteps) * 100;
        sendSSE({ type: 'progress', cost, progress: benchmarkState.progress, step: cost - minCost + 1, totalSteps });

        try {
            const result = await runSingleBenchmark(cost);
            results.push(result);
            sendSSE({ type: 'result', data: result });
        } catch (err) {
            console.error(`Benchmark error at cost ${cost}:`, err);
            benchmarkState.error = `Error at cost ${cost}: ${err.message}`;
            sendSSE({ type: 'error', cost, error: err.message });
        }
    }

    benchmarkState.progress = 100;
    benchmarkState.running = false;
    benchmarkState.results = results;

    // Auto-calibrate
    const calibration = calibrate(results);

    const fullResults = {
        system: getSystemInfo(),
        config: { minCost, maxCost, samples: SAMPLES, targetLatency: TARGET_LATENCY },
        benchmarks: results,
        calibration,
        timestamp: new Date().toISOString(),
    };

    benchmarkState.results = fullResults;
    sendSSE({ type: 'complete', data: fullResults });

    return fullResults;
}

// =============================================
// Calibration Algorithm
// =============================================

function calibrate(benchmarks) {
    if (!benchmarks || benchmarks.length === 0) {
        return { error: 'No benchmark data' };
    }

    // Find the highest cost where median latency ≤ target (250ms)
    let recommendedCost = MIN_COST;
    let maxSafeCost = MIN_COST;

    for (const b of benchmarks) {
        if (b.median <= TARGET_LATENCY) {
            maxSafeCost = b.cost;
        }
    }

    // OWASP minimum is cost 10
    const owaspMinimum = 10;
    recommendedCost = Math.max(maxSafeCost, owaspMinimum);

    // If even cost 10 exceeds target, still recommend 10 but warn
    const cost10Result = benchmarks.find(b => b.cost === 10);
    const cost10Latency = cost10Result ? cost10Result.median : null;
    const exceedsTarget = cost10Latency && cost10Latency > TARGET_LATENCY;

    // If recommended cost exceeds target, clamp to maxSafeCost but not below OWASP
    if (recommendedCost > maxSafeCost && maxSafeCost >= owaspMinimum) {
        recommendedCost = maxSafeCost;
    }

    // Get the result for recommended cost
    const recResult = benchmarks.find(b => b.cost === recommendedCost);
    const recLatency = recResult ? recResult.median : null;
    const recThroughput = recResult ? recResult.throughput : null;

    // Security rating
    let securityRating, securityLabel;
    if (recommendedCost < 10) {
        securityRating = 'WEAK';
        securityLabel = '⚠️ อ่อน — ต่ำกว่ามาตรฐาน OWASP';
    } else if (recommendedCost <= 11) {
        securityRating = 'GOOD';
        securityLabel = '✅ ดี — ผ่านมาตรฐาน OWASP';
    } else if (recommendedCost <= 13) {
        securityRating = 'STRONG';
        securityLabel = '🛡️ แข็งแกร่ง — เหนือมาตรฐาน';
    } else {
        securityRating = 'EXTREME';
        securityLabel = '🔒 แข็งแกร่งมาก — ระดับสูงสุด';
    }

    // DoS risk assessment
    let dosRisk, dosLabel;
    if (recThroughput >= 50) {
        dosRisk = 'LOW';
        dosLabel = '🟢 ความเสี่ยง DoS ต่ำ';
    } else if (recThroughput >= 10) {
        dosRisk = 'MEDIUM';
        dosLabel = '🟡 ความเสี่ยง DoS ปานกลาง — ควรมี rate limiting';
    } else if (recThroughput >= 3) {
        dosRisk = 'HIGH';
        dosLabel = '🟠 ความเสี่ยง DoS สูง — ต้องมี rate limiting + CAPTCHA';
    } else {
        dosRisk = 'CRITICAL';
        dosLabel = '🔴 ความเสี่ยง DoS วิกฤต — อาจทำให้ server ล่ม';
    }

    // Exponential scaling explanation
    const scalingData = benchmarks.map(b => ({
        cost: b.cost,
        iterations: b.iterations,
        latency: b.median,
        ratio: b.cost > benchmarks[0].cost ?
            (b.median / benchmarks.find(x => x.cost === b.cost - 1)?.median || 1).toFixed(2) : '—',
    }));

    return {
        recommendedCost,
        latency: recLatency,
        throughput: recThroughput,
        targetLatency: TARGET_LATENCY,
        owaspMinimum,
        maxSafeCost,
        exceedsTarget,
        securityRating,
        securityLabel,
        dosRisk,
        dosLabel,
        scalingData,
        reasoning: generateReasoning(recommendedCost, recLatency, recThroughput, maxSafeCost, exceedsTarget),
    };
}

function generateReasoning(cost, latency, throughput, maxSafe, exceeds) {
    const lines = [];

    lines.push(`🎯 Cost ที่แนะนำ: ${cost}`);
    lines.push(`⏱️ Latency: ${latency?.toFixed(2) || '?'} ms (เป้าหมาย ≤ ${TARGET_LATENCY} ms)`);
    lines.push(`🔄 Throughput: ${throughput?.toFixed(2) || '?'} hashes/sec`);
    lines.push(`🔐 Iterations: ${Math.pow(2, cost).toLocaleString()} รอบ`);

    if (exceeds) {
        lines.push(`⚠️ แม้ cost ${cost} จะเกินเป้าหมาย ${TARGET_LATENCY}ms แต่เป็นค่าต่ำสุดที่ OWASP ยอมรับ`);
    }

    if (maxSafe < 10) {
        lines.push(`💡 ฮาร์ดแวร์นี้ช้าเกินไปสำหรับ OWASP minimum (cost 10) — ควรอัปเกรด server`);
    }

    return lines;
}

// =============================================
// Server-Sent Events (SSE)
// =============================================

function sendSSE(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => {
        client.write(payload);
    });
}

// =============================================
// API Routes
// =============================================

// ── System Info ──
app.get('/api/system-info', (req, res) => {
    res.json(getSystemInfo());
});

// ── Start Benchmark ──
app.post('/api/benchmark/run', (req, res) => {
    if (benchmarkState.running) {
        return res.status(409).json({ error: 'Benchmark กำลังรันอยู่แล้ว' });
    }

    const minCost = parseInt(req.body.minCost) || MIN_COST;
    const maxCost = parseInt(req.body.maxCost) || MAX_COST;

    if (minCost < 4 || maxCost > 20 || minCost > maxCost) {
        return res.status(400).json({ error: 'Cost range ไม่ถูกต้อง (4–20)' });
    }

    res.json({ message: 'Benchmark เริ่มแล้ว', minCost, maxCost });

    // Run async
    runFullBenchmark(minCost, maxCost).catch(err => {
        console.error('Benchmark failed:', err);
        benchmarkState.running = false;
        benchmarkState.error = err.message;
        sendSSE({ type: 'error', error: err.message });
    });
});

// ── Stop Benchmark ──
app.post('/api/benchmark/stop', (req, res) => {
    if (!benchmarkState.running) {
        return res.status(400).json({ error: 'ไม่มี benchmark ที่กำลังรัน' });
    }
    benchmarkState.running = false;
    res.json({ message: 'กำลังหยุด benchmark...' });
});

// ── Benchmark Status ──
app.get('/api/benchmark/status', (req, res) => {
    res.json({
        running: benchmarkState.running,
        progress: benchmarkState.progress,
        currentCost: benchmarkState.currentCost,
        hasResults: benchmarkState.results !== null,
        error: benchmarkState.error,
    });
});

// ── Benchmark Results ──
app.get('/api/benchmark/results', (req, res) => {
    if (!benchmarkState.results) {
        return res.status(404).json({ error: 'ยังไม่มีผลลัพธ์ — กรุณารัน benchmark ก่อน' });
    }
    res.json(benchmarkState.results);
});

// ── Manual Calibrate ──
app.post('/api/calibrate', (req, res) => {
    if (!benchmarkState.results || !benchmarkState.results.benchmarks) {
        return res.status(400).json({ error: 'ต้องรัน benchmark ก่อนจึงจะ calibrate ได้' });
    }
    const targetLatency = parseInt(req.body.targetLatency) || TARGET_LATENCY;
    // Re-run calibration with custom target
    const original = TARGET_LATENCY;
    const calibration = calibrate(benchmarkState.results.benchmarks);
    res.json(calibration);
});

// ── SSE Stream ──
app.get('/api/benchmark/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    sseClients.push(res);

    req.on('close', () => {
        sseClients = sseClients.filter(c => c !== res);
    });
});

// ── Export Results as JSON Download ──
app.get('/api/benchmark/export', (req, res) => {
    if (!benchmarkState.results) {
        return res.status(404).json({ error: 'No results to export' });
    }
    res.setHeader('Content-Disposition', 'attachment; filename="bcrypt-benchmark-results.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(benchmarkState.results);
});

// =============================================
// Start Server
// =============================================

app.listen(PORT, () => {
    const info = getSystemInfo();
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   ⚡ Bcrypt-Guard Adaptive Calibrator        ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  🌐 http://localhost:${PORT}                    ║`);
    console.log(`║  🖥️  ${info.cpu.model.substring(0, 40)}`);
    console.log(`║  💾 RAM: ${formatBytes(info.memory.total)} (${info.cpu.cores} cores)`);
    console.log(`║  📊 Benchmark range: cost ${MIN_COST}–${MAX_COST}          ║`);
    console.log(`║  🎯 Target latency: ${TARGET_LATENCY}ms                  ║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
});
