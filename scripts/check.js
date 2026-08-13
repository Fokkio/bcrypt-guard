const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const roots = ['electron', 'src/bcrypt', 'src/scanners', 'src/security', 'desktop', 'test', 'scripts'];
const javascript = [];
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (entry.name.endsWith('.js')) javascript.push(full);
    }
  }
}

for (const file of javascript) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!packageJson.scripts.test || !packageJson.scripts['build:win']) {
  throw new Error('Required test and Windows build scripts are missing');
}
console.log(`Syntax and project checks passed for ${javascript.length} JavaScript files.`);
