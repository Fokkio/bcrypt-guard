const { contextBridge, ipcRenderer } = require('electron');

function progressListener(channel, callback) {
  if (typeof callback !== 'function') throw new TypeError('Progress callback must be a function');
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('bcryptGuard', Object.freeze({
  appInfo: () => ipcRenderer.invoke('app:info'),
  systemInfo: () => ipcRenderer.invoke('system:info'),
  startScan: (config) => ipcRenderer.invoke('scan:start', config),
  cancelScan: () => ipcRenderer.invoke('scan:cancel'),
  onScanProgress: (callback) => progressListener('scan:progress', callback),
  startBenchmark: (config) => ipcRenderer.invoke('bcrypt:start', config),
  cancelBenchmark: () => ipcRenderer.invoke('bcrypt:cancel'),
  onBenchmarkProgress: (callback) => progressListener('bcrypt:progress', callback),
  exportReport: (reportType, report, suggestedName) => ipcRenderer.invoke('report:export', { reportType, report, suggestedName }),
}));
