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

    // ── 1. Fetch System Info ──
    async function fetchSystemInfo() {
        try {
            const res = await fetch('/api/system-info');
            const data = await res.json();
            renderSystemInfo(data);
        } catch (err) {
            sysInfoGrid.innerHTML = `<div class="sys-item" style="color:var(--accent-red)">Failed to load system info: ${err.message}</div>`;
        }
    }

    function renderSystemInfo(info) {
        const formatGB = (bytes) => (bytes / (1024 ** 3)).toFixed(2) + ' GB';
        sysInfoGrid.innerHTML = `
            <div class="sys-item">
                <span class="sys-label">Processor (CPU)</span>
                <span class="sys-value">${info.cpu.model}</span>
                <span class="sys-sub">${info.cpu.cores} Logical Cores (${info.cpu.physicalCores} Physical)</span>
            </div>
            <div class="sys-item">
                <span class="sys-label">Memory (RAM)</span>
                <span class="sys-value">${formatGB(info.memory.total)} Total</span>
                <span class="sys-sub">Free: ${formatGB(info.memory.free)}</span>
            </div>
            <div class="sys-item">
                <span class="sys-label">OS / Platform</span>
                <span class="sys-value">${info.platform} ${info.arch}</span>
                <span class="sys-sub">Release: ${info.release}</span>
            </div>
            <div class="sys-item">
                <span class="sys-label">Engine Info</span>
                <span class="sys-value">Node.js ${info.node}</span>
                <span class="sys-sub">Native Bcrypt (C++ binding)</span>
            </div>
        `;
    }

    // ── 2. Benchmark Controls ──
    btnStart.addEventListener('click', startBenchmark);
    btnStop.addEventListener('click', stopBenchmark);

    async function startBenchmark() {
        try {
            // Reset UI
            recCard.style.display = 'none';
            chartsSection.style.display = 'none';
            progressArea.style.display = 'block';
            btnStart.style.display = 'none';
            btnStop.style.display = 'inline-flex';
            progressBarFill.style.width = '0%';
            progressPercent.textContent = '0%';
            progressStatusText.textContent = 'Connecting...';
            currentTestInfo.textContent = 'Initializing test suite...';

            const res = await fetch('/api/benchmark/run', { method: 'POST' });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Failed to start');
            
            listenToProgress();

        } catch (err) {
            alert('Error: ' + err.message);
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
            resetControls();
        } catch (err) {
            alert('Error: ' + err.message);
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
            const msg = JSON.parse(e.data);
            
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

        const cal = data.calibration;
        const targetLatency = cal.targetLatency || 250;

        // Recommendation details
        $('#rec-cost-val').textContent = cal.recommendedCost;
        $('#rec-security-badge').textContent = cal.securityLabel;
        
        // Colors based on security rating
        let badgeColor = 'var(--accent-green)';
        if (cal.securityRating === 'WEAK') badgeColor = 'var(--accent-red)';
        else if (cal.securityRating === 'GOOD') badgeColor = 'var(--accent-yellow)';
        else if (cal.securityRating === 'EXTREME') badgeColor = 'var(--accent-purple)';
        $('#rec-security-badge').style.backgroundColor = badgeColor + '33'; // Add transparency
        $('#rec-security-badge').style.color = badgeColor;
        $('#rec-cost-val').style.color = badgeColor;
        recCard.style.borderColor = badgeColor + '55';
        recCard.style.backgroundColor = badgeColor + '0A';

        $('#rec-latency-val').textContent = `${cal.latency?.toFixed(2) || '?'} ms`;
        $('#rec-iter-val').textContent = Math.pow(2, cal.recommendedCost).toLocaleString();
        $('#rec-throughput-val').textContent = `${cal.throughput?.toFixed(2) || '?'} req/sec`;
        $('#rec-dos-val').textContent = cal.dosLabel;

        // Reasoning list
        const reasoningHtml = cal.reasoning.map(r => `<div class="rec-reason-item">${r}</div>`).join('');
        $('#rec-reasoning-list').innerHTML = reasoningHtml;

        renderCharts(data.benchmarks, targetLatency);
    }

    // Chart.js Default Settings
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";

    function renderCharts(benchmarks, targetLatency) {
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
                    borderColor: '#00f0ff',
                    backgroundColor: 'rgba(0, 240, 255, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: '#0f1025',
                    pointBorderColor: '#00f0ff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: { mode: 'index', intersect: false },
                    annotation: { // Optional: You'd need chartjs-plugin-annotation to draw a target line
                        annotations: {
                            targetLine: {
                                type: 'line',
                                yMin: targetLatency,
                                yMax: targetLatency,
                                borderColor: 'rgba(239, 68, 68, 0.5)',
                                borderWidth: 2,
                                borderDash: [5, 5]
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { color: 'rgba(255,255,255,0.05)' } }
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
                    backgroundColor: 'rgba(139, 92, 246, 0.5)',
                    borderColor: '#8b5cf6',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { type: 'logarithmic', grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // Init
    fetchSystemInfo();

})();
