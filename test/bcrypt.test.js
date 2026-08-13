const assert = require('node:assert/strict');
const test = require('node:test');
const { benchmarkBcrypt, percentile, validateBenchmarkConfig } = require('../src/bcrypt/benchmark');

test('percentile uses the nearest-rank method', () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(percentile([1, 2, 3, 4, 5], 0.95), 5);
});

test('benchmark limits expensive inputs', () => {
  assert.throws(() => validateBenchmarkConfig({ minCost: 7 }), /8-16/);
  assert.throws(() => validateBenchmarkConfig({ minCost: 14, maxCost: 10 }), /cannot exceed/);
});

test('native bcrypt benchmark returns p50 and p95 without a real password', async () => {
  const report = await benchmarkBcrypt({ minCost: 8, maxCost: 8, samples: 3, targetLatencyMs: 250 });
  assert.equal(report.results.length, 1);
  assert.ok(report.results[0].p50Ms > 0);
  assert.ok(report.results[0].p95Ms >= report.results[0].p50Ms);
  assert.match(report.guidance.join(' '), /Argon2id/);
});
