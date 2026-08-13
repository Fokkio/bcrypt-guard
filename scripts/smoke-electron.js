const { spawn } = require('node:child_process');
const electron = require('electron');

const child = spawn(electron, ['.'], {
  env: { ...process.env, BCRYPT_GUARD_SMOKE_TEST: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
child.stderr.on('data', (chunk) => { output += chunk; process.stderr.write(chunk); });
const timeout = setTimeout(() => {
  child.kill();
  console.error('Electron smoke test timed out');
  process.exitCode = 1;
}, 30000);

child.on('exit', (code) => {
  clearTimeout(timeout);
  if (code !== 0 || !output.includes('SMOKE_OK')) process.exitCode = code || 1;
});
