const { spawn } = require('node:child_process');
const electron = require('electron');
const { createFixtureServer } = require('../test/fixture-server');

async function run() {
  const fixture = createFixtureServer();
  const targetUrl = await fixture.start();
  const child = spawn(electron, ['.'], {
    env: { ...process.env, BCRYPT_GUARD_SMOKE_TEST: '1', BCRYPT_GUARD_SMOKE_URL: targetUrl, ELECTRON_DISABLE_SECURITY_WARNINGS: '0' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
  child.stderr.on('data', (chunk) => { output += chunk; process.stderr.write(chunk); });
  const timeout = setTimeout(() => child.kill(), 30000);
  const code = await new Promise((resolve) => child.on('exit', resolve));
  clearTimeout(timeout);
  await fixture.stop();
  if (code !== 0 || !output.includes('SMOKE_OK')) throw new Error('Electron smoke test failed or timed out');
}

run().catch((error) => { console.error(error.message); process.exitCode = 1; });
