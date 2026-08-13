const { app, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { benchmarkBcrypt } = require('../src/bcrypt/benchmark');
const { runScan } = require('../src/scanners/scan-service');

let activeScan = null;
let activeBenchmark = null;

function validSender(event, allowedOrigin) {
  const frameUrl = event.senderFrame?.url || '';
  if (!frameUrl.startsWith(allowedOrigin)) throw new Error('Untrusted IPC sender');
}

function safeFileName(value) {
  const name = typeof value === 'string' ? value : 'bcrypt-guard-report.json';
  return name.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 100) || 'bcrypt-guard-report.json';
}

function registerIpcHandlers({ allowedOrigin }) {
  ipcMain.handle('app:info', (event) => {
    validSender(event, allowedOrigin);
    return { version: app.getVersion(), packaged: app.isPackaged };
  });
  ipcMain.handle('system:info', (event) => {
    validSender(event, allowedOrigin);
    return {
      platform: os.platform(), arch: os.arch(), release: os.release(),
      cpu: os.cpus()[0]?.model || 'Unknown', logicalCores: os.cpus().length,
      totalMemoryBytes: os.totalmem(), node: process.version, electron: process.versions.electron,
    };
  });
  ipcMain.handle('scan:start', async (event, config) => {
    validSender(event, allowedOrigin);
    if (activeScan) throw new Error('A scan is already running');
    activeScan = new AbortController();
    try {
      return await runScan(config, {
        signal: activeScan.signal,
        onProgress: (progress) => event.sender.send('scan:progress', progress),
      });
    } finally {
      activeScan = null;
    }
  });
  ipcMain.handle('scan:cancel', (event) => {
    validSender(event, allowedOrigin);
    activeScan?.abort();
    return { cancelled: Boolean(activeScan) };
  });
  ipcMain.handle('bcrypt:start', async (event, config) => {
    validSender(event, allowedOrigin);
    if (activeBenchmark) throw new Error('A bcrypt benchmark is already running');
    activeBenchmark = new AbortController();
    try {
      return await benchmarkBcrypt(config, {
        signal: activeBenchmark.signal,
        onProgress: (progress) => event.sender.send('bcrypt:progress', progress),
      });
    } finally {
      activeBenchmark = null;
    }
  });
  ipcMain.handle('bcrypt:cancel', (event) => {
    validSender(event, allowedOrigin);
    activeBenchmark?.abort();
    return { cancelled: Boolean(activeBenchmark) };
  });
  ipcMain.handle('report:export', async (event, payload) => {
    validSender(event, allowedOrigin);
    const serialized = JSON.stringify(payload?.report, null, 2);
    if (serialized.length > 1024 * 1024) throw new Error('Report exceeds the 1 MB export limit');
    const result = await dialog.showSaveDialog({
      title: 'Export redacted assessment report',
      defaultPath: path.join(app.getPath('documents'), safeFileName(payload?.suggestedName)),
      filters: [{ name: 'JSON report', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { saved: false };
    await fs.writeFile(result.filePath, serialized, { encoding: 'utf8', flag: 'w' });
    return { saved: true, fileName: path.basename(result.filePath) };
  });
}

module.exports = { registerIpcHandlers, safeFileName, validSender };
