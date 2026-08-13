const { SafeHttpClient } = require('../security/http-client');
const { validateScanConfig } = require('../security/validation');
const { runAccessControlScanner } = require('./access-control-scanner');
const { runEnumerationScanner } = require('./enumeration-scanner');
const { runPassiveScanner } = require('./passive-scanner');
const { runRateLimitScanner } = require('./rate-limit-scanner');

function summary(findings) {
  return findings.reduce((counts, item) => {
    counts[item.severity] = (counts[item.severity] || 0) + 1;
    return counts;
  }, { high: 0, medium: 0, low: 0, info: 0 });
}

function sanitizedTarget(url) {
  const safe = new URL(url);
  safe.search = '';
  safe.hash = '';
  return safe.toString();
}

async function runScan(rawConfig, options = {}) {
  const config = validateScanConfig(rawConfig);
  const client = options.client || new SafeHttpClient();
  const context = { client, baseUrl: config.baseUrl, signal: options.signal };
  const findings = [];
  const phases = [
    ['Baseline controls', config.passive, () => runPassiveScanner(context)],
    ['BOLA / BFLA', config.bola.enabled || config.bfla.enabled,
      () => runAccessControlScanner(context, config)],
    ['Enumeration', config.enumeration.enabled,
      () => runEnumerationScanner(context, config.enumeration)],
    ['Rate limiting', config.rateLimit.enabled,
      () => runRateLimitScanner(context, config.rateLimit)],
  ];
  const active = phases.filter(([, enabled]) => enabled);
  const startedAt = new Date();

  for (const [index, [name, , execute]] of active.entries()) {
    options.onProgress?.({ phase: name, current: index + 1, total: active.length });
    findings.push(...await execute());
  }

  const finishedAt = new Date();
  return {
    schemaVersion: 1,
    application: 'Bcrypt Guard Desktop 2.0.0',
    assessmentType: 'Authorized read-only heuristic assessment',
    target: sanitizedTarget(config.baseUrl),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt - startedAt,
    checksRun: active.map(([name]) => name),
    limitations: [
      'Results apply only to the supplied URLs and sessions.',
      'No state-changing request, crawling, brute force, or browser payload execution was performed.',
      'A missing finding does not establish that the target is vulnerability-free.',
    ],
    summary: summary(findings),
    findings,
  };
}

module.exports = { runScan, sanitizedTarget, summary };
