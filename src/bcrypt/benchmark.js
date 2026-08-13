const bcrypt = require('bcrypt');
const os = require('node:os');
const { performance } = require('node:perf_hooks');
const { boundedInteger } = require('../security/validation');

function percentile(sorted, value) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1);
  return sorted[index];
}

function validateBenchmarkConfig(input = {}) {
  const minCost = boundedInteger(input.minCost, 'Minimum cost', 8, 16, 10);
  const maxCost = boundedInteger(input.maxCost, 'Maximum cost', 8, 16, 13);
  if (minCost > maxCost) throw new Error('Minimum cost cannot exceed maximum cost');
  return {
    minCost,
    maxCost,
    samples: boundedInteger(input.samples, 'Samples', 3, 10, 5),
    targetLatencyMs: boundedInteger(input.targetLatencyMs, 'Target latency', 50, 1000, 250),
  };
}

async function measureCost(cost, samples, signal) {
  const syntheticPassword = 'BcryptGuardSyntheticBenchmark-2026!';
  await bcrypt.hash(syntheticPassword, cost);
  const times = [];
  for (let index = 0; index < samples; index += 1) {
    if (signal?.aborted) throw new Error('Benchmark cancelled');
    const started = performance.now();
    await bcrypt.hash(syntheticPassword, cost);
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((sum, value) => sum + value, 0) / times.length;
  return {
    cost,
    samples,
    p50Ms: Number(percentile(times, 0.5).toFixed(2)),
    p95Ms: Number(percentile(times, 0.95).toFixed(2)),
    meanMs: Number(mean.toFixed(2)),
    minMs: Number(times[0].toFixed(2)),
    maxMs: Number(times[times.length - 1].toFixed(2)),
    sequentialHashesPerSecond: Number((1000 / percentile(times, 0.5)).toFixed(2)),
  };
}

function recommendation(results, targetLatencyMs) {
  const withinTarget = results.filter((result) => result.p95Ms <= targetLatencyMs);
  const selected = withinTarget.at(-1) || results[0];
  return {
    cost: selected.cost,
    measuredP95Ms: selected.p95Ms,
    targetLatencyMs,
    belowBcryptMinimum: selected.cost < 10,
    exceedsTarget: selected.p95Ms > targetLatencyMs,
    note: selected.cost < 10
      ? 'Measured hardware did not meet the target at bcrypt cost 10. Do not present the lower cost as OWASP-compliant.'
      : 'Use production load testing before adopting this cost; sequential desktop timing is not server capacity.',
  };
}

async function benchmarkBcrypt(rawConfig, options = {}) {
  const config = validateBenchmarkConfig(rawConfig);
  const results = [];
  for (let cost = config.minCost; cost <= config.maxCost; cost += 1) {
    options.onProgress?.({ cost, current: cost - config.minCost + 1, total: config.maxCost - config.minCost + 1 });
    results.push(await measureCost(cost, config.samples, options.signal));
  }
  return {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    system: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model || 'Unknown', logicalCores: os.cpus().length },
    config,
    results,
    recommendation: recommendation(results, config.targetLatencyMs),
    guidance: [
      'OWASP currently prefers Argon2id for new systems and treats bcrypt as a legacy-compatible option.',
      'For bcrypt, use cost 10 or higher and enforce the implementation’s 72-byte password input limit.',
      'The benchmark uses a synthetic value and never accepts a real user password.',
      'Upgrade work factors through rehash-after-successful-login; never rehash before authentication.',
    ],
  };
}

module.exports = { benchmarkBcrypt, measureCost, percentile, recommendation, validateBenchmarkConfig };
