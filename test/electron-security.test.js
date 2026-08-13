const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const main = fs.readFileSync('electron/main.js', 'utf8');
const preload = fs.readFileSync('electron/preload.js', 'utf8');
const html = fs.readFileSync('desktop/index.html', 'utf8');

test('renderer uses Electron isolation and sandbox settings', () => {
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny'/);
});

test('preload does not expose raw ipc primitives', () => {
  assert.doesNotMatch(preload, /send:\s*ipcRenderer\.send/);
  assert.doesNotMatch(preload, /invoke:\s*ipcRenderer\.invoke/);
  assert.match(preload, /contextBridge\.exposeInMainWorld/);
});

test('renderer can export only main-owned report types', () => {
  const handlers = fs.readFileSync('electron/ipc-handlers.js', 'utf8');
  assert.match(handlers, /reports\[payload\?\.reportType\]/);
  assert.doesNotMatch(handlers, /JSON\.stringify\(payload\?\.report/);
});

test('desktop page has restrictive CSP and an accessible skip link', () => {
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-live="polite"/);
});
