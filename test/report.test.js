const assert = require('node:assert/strict');
const test = require('node:test');
const { cleanReport } = require('../src/security/report');

test('export schema rejects unknown report types and arbitrary objects', () => {
  assert.throws(() => cleanReport('other', {}), /Unknown report type/);
  assert.throws(() => cleanReport('scan', { token: 'secret' }), /schema/);
});

test('scan export schema drops unknown fields', () => {
  const report = cleanReport('scan', {
    schemaVersion: 1, application: 'app', assessmentType: 'type', target: 'https://example.test/',
    startedAt: '2026-01-01', finishedAt: '2026-01-01', durationMs: 1, checksRun: ['baseline'],
    limitations: [], summary: { high: 0, medium: 0, low: 0, info: 0 }, findings: [],
    authorization: 'Bearer secret', body: 'secret body',
  });
  assert.equal('authorization' in report, false);
  assert.equal('body' in report, false);
});
