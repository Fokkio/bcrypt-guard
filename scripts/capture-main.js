const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { registerIpcHandlers } = require('../electron/ipc-handlers');

app.enableSandbox();
app.whenReady().then(async () => {
  registerIpcHandlers({ allowedOrigin: 'file://' });
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await window.loadFile(path.join(__dirname, '..', 'desktop', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 500));
  const outputDirectory = path.join(__dirname, '..', 'artifacts');
  const outputPath = path.join(outputDirectory, 'ui-assessment.png');
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(outputPath, (await window.capturePage()).toPNG());
  console.log(`CAPTURE_OK ${outputPath}`);
  app.quit();
});
