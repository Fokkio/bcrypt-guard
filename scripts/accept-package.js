const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFixtureServer } = require('../test/fixture-server');

async function run() {
  const executable = process.argv[2] || fs.readdirSync('release')
    .filter((name) => /Portable.*\.exe$/i.test(name))
    .map((name) => path.resolve('release', name))[0];
  if (!executable || !fs.existsSync(executable)) throw new Error('Portable executable was not found');
  const fixture = createFixtureServer();
  const targetUrl = await fixture.start();
  const resultPath = path.join(os.tmpdir(), `bcrypt-guard-package-acceptance-${process.pid}.json`);
  if (fs.existsSync(resultPath)) throw new Error('Acceptance result path already exists');
  const child = spawn(executable, [], {
    env: { ...process.env, BCRYPT_GUARD_SMOKE_TEST: '1', BCRYPT_GUARD_SMOKE_URL: targetUrl, BCRYPT_GUARD_SMOKE_RESULT: resultPath },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
  child.stderr.on('data', (chunk) => { output += chunk; process.stderr.write(chunk); });
  const timeout = setTimeout(() => child.kill(), 60000);
  const code = await new Promise((resolve) => child.on('exit', resolve));
  clearTimeout(timeout);
  await fixture.stop();
  if (!fs.existsSync(resultPath)) throw new Error(`Packaged acceptance produced no result (exit ${code})`);
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  fs.unlinkSync(resultPath);
  if (code !== 0 || !result.ok || result.bcryptP95Ms <= 0 || result.scanFindings < 1) {
    throw new Error(`Packaged acceptance failed: ${JSON.stringify(result)}`);
  }
  console.log(`PACKAGE_ACCEPTANCE_OK ${path.basename(executable)} bcrypt_p95_ms=${result.bcryptP95Ms} scan_findings=${result.scanFindings}`);
}

run().catch((error) => { console.error(error.message); process.exitCode = 1; });
