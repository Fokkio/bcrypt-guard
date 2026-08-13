import { benchmarkConfig, scanConfig, selectedScanCount } from './form-config.js';
import { renderBenchmark, renderScanReport } from './report-view.js';

const api = window.bcryptGuard;
let lastScan = null;
let lastBenchmark = null;

function byId(id) { return document.getElementById(id); }

function setStatus(id, message, error = false) {
  const status = byId(id);
  status.textContent = message;
  status.classList.toggle('is-error', error);
}

function setBusy(prefix, busy) {
  byId(`${prefix}-start`).disabled = busy;
  byId(`${prefix}-cancel`).hidden = !busy;
}

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function setupNavigation() {
  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => {
      const selected = button.dataset.view;
      document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('is-active', item === button));
      document.querySelectorAll('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== selected; });
      const heading = document.querySelector(`[data-panel="${selected}"] .page-header > h1, [data-panel="${selected}"] .page-header > h2`);
      heading?.setAttribute('tabindex', '-1');
      heading?.focus();
      document.title = `${heading?.textContent || 'Bcrypt Guard'} · Bcrypt Guard Desktop`;
    });
  }
}

async function setupAppInfo() {
  try {
    const [appInfo, system] = await Promise.all([api.appInfo(), api.systemInfo()]);
    byId('app-version').textContent = `Version ${appInfo.version}`;
    byId('build-mode').textContent = appInfo.packaged ? 'Packaged release' : 'Development build';
    const memoryGb = (system.totalMemoryBytes / 1024 ** 3).toFixed(1);
    byId('system-strip').textContent = `${system.cpu} · ${system.logicalCores} logical cores · ${memoryGb} GB RAM · ${system.platform} ${system.arch} · Electron ${system.electron}`;
  } catch (error) {
    byId('system-strip').textContent = `System details unavailable: ${safeMessage(error)}`;
  }
}

function setupScan() {
  api.onScanProgress((progress) => setStatus('scan-status', `${progress.phase}: ${progress.current} of ${progress.total}`));
  byId('scan-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const config = scanConfig();
    if (!selectedScanCount(config)) return setStatus('scan-status', 'Select at least one evidence check.', true);
    setBusy('scan', true);
    byId('scan-export').hidden = true;
    setStatus('scan-status', 'Starting bounded assessment…');
    try {
      lastScan = await api.startScan(config);
      renderScanReport(byId('scan-results'), lastScan);
      byId('scan-export').hidden = false;
      setStatus('scan-status', `Assessment complete: ${lastScan.findings.length} finding(s) require review.`);
    } catch (error) {
      setStatus('scan-status', safeMessage(error), true);
    } finally {
      setBusy('scan', false);
    }
  });
  byId('scan-cancel').addEventListener('click', () => api.cancelScan());
  byId('scan-export').addEventListener('click', async () => {
    const result = await api.exportReport('scan', lastScan, 'bcrypt-guard-assessment.json');
    setStatus('scan-status', result.saved ? `Saved ${result.fileName}` : 'Export cancelled.');
  });
}

function setupBenchmark() {
  api.onBenchmarkProgress((progress) => setStatus('bcrypt-status', `Measuring cost ${progress.cost}: ${progress.current} of ${progress.total}`));
  byId('bcrypt-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy('bcrypt', true);
    byId('bcrypt-export').hidden = true;
    setStatus('bcrypt-status', 'Warming up native bcrypt…');
    try {
      lastBenchmark = await api.startBenchmark(benchmarkConfig());
      renderBenchmark(byId('bcrypt-results'), lastBenchmark);
      byId('bcrypt-export').hidden = false;
      setStatus('bcrypt-status', `Benchmark complete. Recommended measured cost: ${lastBenchmark.recommendation.cost}.`);
    } catch (error) {
      setStatus('bcrypt-status', safeMessage(error), true);
    } finally {
      setBusy('bcrypt', false);
    }
  });
  byId('bcrypt-cancel').addEventListener('click', () => api.cancelBenchmark());
  byId('bcrypt-export').addEventListener('click', async () => {
    const result = await api.exportReport('bcrypt', lastBenchmark, 'bcrypt-guard-benchmark.json');
    setStatus('bcrypt-status', result.saved ? `Saved ${result.fileName}` : 'Export cancelled.');
  });
}

setupNavigation();
setupScan();
setupBenchmark();
setupAppInfo();
