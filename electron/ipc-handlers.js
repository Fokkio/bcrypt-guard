const { app, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { benchmarkBcrypt } = require('../src/bcrypt/benchmark');
const { runScan } = require('../src/scanners/scan-service');

const activeOperations = new Map();
const REPORTS = Symbol('bcryptGuardReports');

function reportsFor(sender) {
  if (!sender[REPORTS]) {
    sender[REPORTS] = new Map();
    sender.once('destroyed', () => sender[REPORTS]?.clear());
  }
  return sender[REPORTS];
}

function validSender(event, allowedOrigin) {
  const frameUrl = event.senderFrame?.url || '';
  let trusted = false;
  try {
    const url = new URL(frameUrl);
    if (allowedOrigin === 'file://') {
      trusted = url.protocol === 'file:';
    } else {
      const expected = new URL(allowedOrigin);
      trusted = url.protocol === expected.protocol && url.host === expected.host;
    }
  } catch { /* Invalid sender URL remains untrusted. */ }
  if (!trusted) throw new Error('Untrusted IPC sender');
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
    if (activeOperations.has('scan')) throw new Error('A scan is already running');
    const controller = new AbortController();
    activeOperations.set('scan', controller);
    try {
      const report = await runScan(config, {
        signal: controller.signal,
        onProgress: (progress) => event.sender.send('scan:progress', progress),
      });
      reportsFor(event.sender).set('scan', report);
      return report;
    } finally {
      activeOperations.delete('scan');
    }
  });
  ipcMain.handle('scan:cancel', (event) => {
    validSender(event, allowedOrigin);
    const controller = activeOperations.get('scan');
    controller?.abort();
    return { cancelled: Boolean(controller) };
  });
  ipcMain.handle('bcrypt:start', async (event, config) => {
    validSender(event, allowedOrigin);
    if (activeOperations.has('bcrypt')) throw new Error('A bcrypt benchmark is already running');
    const controller = new AbortController();
    activeOperations.set('bcrypt', controller);
    try {
      const report = await benchmarkBcrypt(config, {
        signal: controller.signal,
        onProgress: (progress) => event.sender.send('bcrypt:progress', progress),
      });
      reportsFor(event.sender).set('bcrypt', report);
      return report;
    } finally {
      activeOperations.delete('bcrypt');
    }
  });
  ipcMain.handle('bcrypt:cancel', (event) => {
    validSender(event, allowedOrigin);
    const controller = activeOperations.get('bcrypt');
    controller?.abort();
    return { cancelled: Boolean(controller) };
  });
  ipcMain.handle('report:export', async (event, payload) => {
    validSender(event, allowedOrigin);
    if (!['scan', 'bcrypt'].includes(payload?.reportType)) throw new Error('Unknown report type');
    const report = reportsFor(event.sender).get(payload.reportType);
    if (!report) throw new Error('No main-owned report is available for export');
    const serialized = JSON.stringify(report, null, 2);
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
