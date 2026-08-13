const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createFixtureServer } = require('../test/fixture-server');

async function run() {
  const executable = process.argv[2] || fs.readdirSync('release')
    .filter((name) => /Portable.*\.exe$/i.test(name))
    .map((name) => path.resolve('release', name))[0];
  if (!executable || !fs.existsSync(executable)) throw new Error('Portable executable was not found');
  const fixture = createFixtureServer();
  const targetUrl = await fixture.start();
  const child = spawn(executable, [], {
    env: { ...process.env, BCRYPT_GUARD_SMOKE_TEST: '1', BCRYPT_GUARD_SMOKE_URL: targetUrl },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
  child.stderr.on('data', (chunk) => { output += chunk; process.stderr.write(chunk); });
  const timeout = setTimeout(() => child.kill(), 60000);
  const code = await new Promise((resolve) => child.on('exit', resolve));
  clearTimeout(timeout);
  await fixture.stop();
  if (code !== 0 || !output.includes('SMOKE_OK')) throw new Error('Packaged acceptance failed or timed out');
  console.log(`PACKAGE_ACCEPTANCE_OK ${path.basename(executable)}`);
}

run().catch((error) => { console.error(error.message); process.exitCode = 1; });
