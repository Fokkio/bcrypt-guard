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
  const hasHorizontalOverflow = () => window.webContents.executeJavaScript(
    'document.documentElement.scrollWidth > document.documentElement.clientWidth',
  );
  const outputDirectory = path.join(__dirname, '..', 'artifacts');
  const outputPath = path.join(outputDirectory, 'ui-assessment.png');
  const bcryptOutputPath = path.join(outputDirectory, 'ui-bcrypt.png');
  const guardrailsOutputPath = path.join(outputDirectory, 'ui-guardrails.png');
  const narrowOutputPath = path.join(outputDirectory, 'ui-assessment-narrow.png');
  const iconOutputPath = path.join(outputDirectory, 'icon-preview.png');
  await fs.mkdir(outputDirectory, { recursive: true });
  if (await hasHorizontalOverflow()) throw new Error('Desktop viewport has horizontal overflow');
  await fs.writeFile(outputPath, (await window.capturePage()).toPNG());
  for (const [view, capturePath] of [['bcrypt', bcryptOutputPath], ['guardrails', guardrailsOutputPath]]) {
    await window.webContents.executeJavaScript(`document.querySelector('[data-view="${view}"]').click()`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (await hasHorizontalOverflow()) throw new Error(`${view} viewport has horizontal overflow`);
    await fs.writeFile(capturePath, (await window.capturePage()).toPNG());
  }
  await window.webContents.executeJavaScript('document.querySelector(\'[data-view="scan"]\').click()');
  window.setSize(680, 900);
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (await hasHorizontalOverflow()) throw new Error('Narrow viewport has horizontal overflow');
  await fs.writeFile(narrowOutputPath, (await window.capturePage()).toPNG());
  const iconWindow = new BrowserWindow({ width: 512, height: 512, useContentSize: true, frame: false, show: false });
  const iconSvg = await fs.readFile(path.join(__dirname, '..', 'build', 'icon.svg'), 'utf8');
  const iconPreview = `<style>html,body{margin:0;width:512px;height:512px;overflow:hidden}svg{display:block;width:512px;height:512px}</style>${iconSvg}`;
  await iconWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(iconPreview)}`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await fs.writeFile(iconOutputPath, (await iconWindow.capturePage()).toPNG());
  iconWindow.destroy();
  console.log(`CAPTURE_OK ${outputPath} ${bcryptOutputPath} ${guardrailsOutputPath} ${narrowOutputPath} ${iconOutputPath}`);
  app.quit();
});
