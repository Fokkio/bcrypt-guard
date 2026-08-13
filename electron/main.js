const { app, BrowserWindow, net, protocol, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { registerIpcHandlers } = require('./ipc-handlers');

const APP_ORIGIN = 'app://local';
const APP_ID = 'com.fokkio.bcryptguard.desktop';
const SMOKE_TEST = process.env.BCRYPT_GUARD_SMOKE_TEST === '1';

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true },
}]);

function contentType(filePath) {
  return ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' })[path.extname(filePath)]
    || 'application/octet-stream';
}

async function serveLocalAsset(request) {
  const root = path.resolve(__dirname, '..', 'desktop');
  const requestedPath = decodeURIComponent(new URL(request.url).pathname);
  const relative = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
  const filePath = path.resolve(root, relative);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    return new Response('Not found', { status: 404 });
  }
  try {
    return new Response(await fs.readFile(filePath), {
      headers: { 'content-type': contentType(filePath), 'cache-control': 'no-store' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 640,
    minHeight: 580,
    show: false,
    backgroundColor: '#f4f1ea',
    title: 'Bcrypt Guard Desktop',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      devTools: !app.isPackaged,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_ORIGIN)) event.preventDefault();
  });
  window.once('ready-to-show', () => { if (!SMOKE_TEST) window.show(); });
  if (SMOKE_TEST) {
    window.webContents.once('did-finish-load', async () => {
      const result = await window.webContents.executeJavaScript(`(async () => ({ title: document.title, bridge: typeof window.bcryptGuard, info: await window.bcryptGuard.appInfo() }))()`);
      if (result.title !== 'Bcrypt Guard Desktop' || result.bridge !== 'object' || !result.info?.version) {
        console.error('SMOKE_FAILED', JSON.stringify(result));
        app.exit(1);
        return;
      }
      console.log('SMOKE_OK', JSON.stringify(result));
      app.exit(0);
    });
  }
  window.loadURL(`${APP_ORIGIN}/index.html`);
  return window;
}

app.setAppUserModelId(APP_ID);
app.enableSandbox();

app.whenReady().then(async () => {
  protocol.handle('app', serveLocalAsset);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  registerIpcHandlers({ allowedOrigin: APP_ORIGIN });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

module.exports = { contentType, serveLocalAsset };
