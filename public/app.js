// =============================================
// Bcrypt-Guard Calibrator — Frontend Logic
// =============================================

(function() {
    'use strict';

    const $ = (s) => document.querySelector(s);
    
    // UI Elements
    const sysInfoGrid = $('#system-info-grid');
    const btnStart = $('#btn-start-benchmark');
    const btnStop = $('#btn-stop-benchmark');
    const btnExport = $('#btn-export-results');
    const progressArea = $('#progress-area');
    const progressStatusText = $('#progress-status-text');
    const progressPercent = $('#progress-percent');
    const progressBarFill = $('#progress-bar-fill');
    const currentTestInfo = $('#current-test-info');
    
    const recCard = $('#recommendation-card');
    const chartsSection = $('#charts-section');

    let latencyChartInstance = null;
    let throughputChartInstance = null;
    let eventSource = null;
    let sysEventSource = null;
    let benchmarkResultsCache = null;
    let targetLatencyCache = 250;

    // ── Theme Management ──
    const themeToggleBtn = $('#theme-toggle');
    const root = document.documentElement;

    function setTheme(theme) {
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (benchmarkResultsCache) {
            renderCharts(benchmarkResultsCache, targetLatencyCache);
        }
    }

    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(initialTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = root.getAttribute('data-theme');
            setTheme(currentTheme === 'light' ? 'dark' : 'light');
        });
    }

    // ── Toast Notification System ──
    function showToast(message, type = 'info') {
        const container = $('#toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // ── 1. Fetch System Info & Stream ──
    function connectSystemStream() {
        if (sysEventSource) sysEventSource.close();
        sysEventSource = new EventSource('/api/system/stream');
        
        sysEventSource.onmessage = (e) => {
            let info;
            try {
                info = JSON.parse(e.data);
            } catch (err) {
                console.error('System stream JSON parse error', err);
                return;
            }
            
            // Update static info
            $('#sys-cpu-model').textContent = info.cpu.model;
            $('#sys-cpu-cores').textContent = `${info.cpu.cores} Logical Cores`;
            $('#sys-os-info').textContent = `${info.platform} ${info.arch}`;
            $('#sys-node-info').textContent = `Node.js ${info.node}`;

            // Update RAM real-time
            const ramPercent = info.memory.usagePercent;
            $('#sys-ram-gauge').style.width = `${ramPercent}%`;
            $('#sys-ram-text').textContent = `${ramPercent}% Used`;

            const cpuVal = Number(info.cpu.usagePercent || 0);
            $('#sys-cpu-gauge').style.width = `${cpuVal}%`;
            $('#sys-cpu-percent').textContent = `${cpuVal.toFixed(1)}%`;
        };

        sysEventSource.onerror = () => {
            console.error('System stream error');
            sysEventSource.close();
        };
    }

    // ── 2. Benchmark Controls ──
    btnStart.addEventListener('click', startBenchmark);
    btnStop.addEventListener('click', stopBenchmark);
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            window.location.href = '/api/benchmark/export';
        });
    }

    $('#input-target-latency').addEventListener('change', async (e) => {
        if (!benchmarkResultsCache) return; // Only recalibrate if we already ran a benchmark
        
        const targetLatency = parseInt(e.target.value) || 250;
        try {
            const res = await fetch('/api/calibrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetLatency })
            });
            if (res.ok) {
                const cal = await res.json();
                showResults({
                    calibration: cal,
                    benchmarks: benchmarkResultsCache
                });
            }
        } catch(err) {
            console.error('Recalibration failed', err);
        }
    });

    async function startBenchmark() {
        try {
            // Reset UI
            recCard.style.display = 'none';
            chartsSection.style.display = 'none';
            if (btnExport) btnExport.style.display = 'none';
            progressArea.style.display = 'block';
            btnStart.style.display = 'none';
            btnStop.style.display = 'inline-flex';
            progressBarFill.style.width = '0%';
            progressPercent.textContent = '0%';
            progressStatusText.textContent = 'Connecting...';
            currentTestInfo.textContent = 'Initializing test suite...';

            const minCost = parseInt($('#input-min-cost').value) || 4;
            const maxCost = parseInt($('#input-max-cost').value) || 14;
            const targetLatency = parseInt($('#input-target-latency').value) || 250;

            if (minCost > maxCost || minCost < 4 || maxCost > 20) {
                showToast('Cost range ไม่ถูกต้อง (ควรอยู่ระหว่าง 4 ถึง 20)', 'error');
                resetControls();
                return;
            }

            const res = await fetch('/api/benchmark/run', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ minCost, maxCost, targetLatency })
            });
            const data = await res.json();
            
            if (!res.ok) {
                showToast(data.error || 'Failed to start', 'error');
                resetControls();
                return;
            }
            
            showToast('Benchmark started', 'success');
            listenToProgress();

        } catch (err) {
            showToast('Error: ' + err.message, 'error');
            resetControls();
        }
    }

    async function stopBenchmark() {
        try {
            await fetch('/api/benchmark/stop', { method: 'POST' });
            if (eventSource) {
                eventSource.close();
            }
            progressStatusText.textContent = 'Stopped by user.';
            showToast('Benchmark stopped by user', 'info');
            resetControls();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    }

    function resetControls() {
        btnStart.style.display = 'inline-flex';
        btnStop.style.display = 'none';
    }

    // ── 3. SSE Progress Listener ──
    function listenToProgress() {
        if (eventSource) eventSource.close();
        eventSource = new EventSource('/api/benchmark/stream');

        eventSource.onmessage = (e) => {
            let msg;
            try {
                msg = JSON.parse(e.data);
            } catch (err) {
                console.error('Progress stream JSON parse error', err);
                return;
            }
            
            if (msg.type === 'start') {
                progressStatusText.textContent = `Running benchmark (Cost ${msg.minCost} to ${msg.maxCost})`;
            }
            else if (msg.type === 'progress') {
                progressBarFill.style.width = `${msg.progress}%`;
                progressPercent.textContent = `${Math.round(msg.progress)}%`;
                currentTestInfo.textContent = `Testing Cost Factor ${msg.cost} (Step ${msg.step} of ${msg.totalSteps})...`;
            }
            else if (msg.type === 'result') {
                currentTestInfo.textContent = `Cost ${msg.data.cost}: Median Latency ${msg.data.median}ms, Throughput ${msg.data.throughput} req/s`;
            }
            else if (msg.type === 'complete') {
                progressStatusText.textContent = 'Benchmark Complete!';
                currentTestInfo.textContent = 'Generating report...';
                progressBarFill.style.width = '100%';
                progressPercent.textContent = '100%';
                eventSource.close();
                resetControls();
                showResults(msg.data);
            }
            else if (msg.type === 'error' || msg.type === 'cancelled') {
                progressStatusText.textContent = msg.type === 'error' ? `Error: ${msg.error}` : 'Cancelled';
                eventSource.close();
                resetControls();
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE Error', err);
            eventSource.close();
            resetControls();
        };
    }

    // ── 4. Display Results & Charts ──
    function showResults(data) {
        recCard.style.display = 'block';
        chartsSection.style.display = 'grid';
        if (btnExport) btnExport.style.display = 'inline-flex';

        const cal = data.calibration;
        const targetLatency = parseInt($('#input-target-latency').value) || 250;

        // Safety / performance warning
        const warningBox = $('#target-warning-box');
        const warnings = [];
        if (cal.belowOwaspMinimum) {
            warnings.push(`Recommended Cost ${cal.recommendedCost} is the highest viable value for this hardware and target latency, but it is below the OWASP minimum (Cost 10). Upgrade the server specs so production can safely use Cost 10 or higher.`);
        }
        if (cal.exceedsTarget) {
            warnings.push(`Actual latency is ${cal.latency?.toFixed(2)} ms, which exceeds the configured target of ${targetLatency} ms.`);
        }
        if (warnings.length > 0) {
            $('#target-warning-text').textContent = warnings.join(' ');
            warningBox.style.display = 'flex';
        } else {
            warningBox.style.display = 'none';
        }

        // Recommendation details
        $('#rec-cost-val').textContent = cal.recommendedCost;
        $('#rec-security-badge').textContent = cal.securityLabel;
        
        // Colors based on security rating
        let badgeBg = 'var(--success-bg)';
        let badgeColor = 'var(--success-color)';
        if (cal.securityRating === 'WEAK') {
            badgeBg = 'rgba(239, 68, 68, 0.1)';
            badgeColor = 'var(--accent-danger)';
        }
        else if (cal.securityRating === 'GOOD') {
            badgeBg = 'rgba(251, 191, 36, 0.1)';
            badgeColor = '#d97706'; // Darker amber for contrast
        }
        else if (cal.securityRating === 'EXTREME') {
            badgeBg = 'rgba(139, 92, 246, 0.1)';
            badgeColor = '#8b5cf6';
        }
        
        $('#rec-security-badge').style.backgroundColor = badgeBg;
        $('#rec-security-badge').style.color = badgeColor;
        $('#rec-cost-val').style.color = badgeColor;
        recCard.style.borderLeftColor = badgeColor;

        $('#rec-latency-val').textContent = `${cal.latency?.toFixed(2) || '?'} ms`;
        $('#rec-iter-val').textContent = Math.pow(2, cal.recommendedCost).toLocaleString();
        $('#rec-throughput-val').textContent = `${cal.throughput?.toFixed(2) || '?'} req/sec`;
        $('#rec-dos-val').textContent = cal.dosLabel;

        // Save to cache for theme toggle re-renders
        benchmarkResultsCache = data.benchmarks;
        targetLatencyCache = targetLatency;

        // Reasoning list
        const reasoningHtml = cal.reasoning.map(r => `<div class="rec-reason-item">${r}</div>`).join('');
        $('#rec-reasoning-list').innerHTML = reasoningHtml;

        renderCharts(data.benchmarks, targetLatency);
    }

    function renderCharts(benchmarks, targetLatency) {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded');
            return;
        }
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        const primaryLine = isDark ? '#3b82f6' : '#2563eb';
        const primaryFill = isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(37, 99, 235, 0.1)';
        const secondaryBar = isDark ? '#8b5cf6' : '#6366f1';
        const secondaryFill = isDark ? 'rgba(139, 92, 246, 0.5)' : 'rgba(99, 102, 241, 0.5)';

        Chart.defaults.color = textColor;
        Chart.defaults.font.family = "Inter, Segoe UI, Tahoma, sans-serif";

        const labels = benchmarks.map(b => `Cost ${b.cost}`);
        const latencies = benchmarks.map(b => b.median);
        const throughputs = benchmarks.map(b => b.throughput);

        // --- Latency Chart ---
        const ctxLatency = document.getElementById('latencyChart').getContext('2d');
        if (latencyChartInstance) latencyChartInstance.destroy();

        latencyChartInstance = new Chart(ctxLatency, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Median Latency (ms)',
                    data: latencies,
                    borderColor: primaryLine,
                    backgroundColor: primaryFill,
                    borderWidth: 2,
                    pointBackgroundColor: isDark ? '#1e293b' : '#ffffff',
                    pointBorderColor: primaryLine,
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3
                }, {
                    label: `Target (${targetLatency}ms)`,
                    data: labels.map(() => targetLatency),
                    borderColor: 'rgba(239, 68, 68, 0.75)',
                    backgroundColor: 'rgba(239, 68, 68, 0)',
                    borderWidth: 2,
                    borderDash: [6, 6],
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: gridColor } },
                    x: { grid: { color: gridColor } }
                }
            }
        });

        // --- Throughput Chart ---
        const ctxThroughput = document.getElementById('throughputChart').getContext('2d');
        if (throughputChartInstance) throughputChartInstance.destroy();

        throughputChartInstance = new Chart(ctxThroughput, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Throughput (Logins/sec)',
                    data: throughputs,
                    backgroundColor: secondaryFill,
                    borderColor: secondaryBar,
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { type: 'logarithmic', grid: { color: gridColor } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // Init
    connectSystemStream();

})();
