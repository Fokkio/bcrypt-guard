const assert = require('node:assert/strict');
const test = require('node:test');
const { runScan } = require('../src/scanners/scan-service');
const { runRateLimitScanner } = require('../src/scanners/rate-limit-scanner');
const { SafeHttpClient } = require('../src/security/http-client');
const { createFixtureServer } = require('./fixture-server');

test('bounded fixture scan finds the intended authorization and policy signals', async (t) => {
  const fixture = createFixtureServer();
  const baseUrl = await fixture.start();
  t.after(() => fixture.stop());
  const report = await runScan({
    targetUrl: baseUrl,
    authorizationConfirmed: true,
    passive: true,
    bola: {
      enabled: true, method: 'GET', endpoint: '/api/orders/{id}',
      actorAObjectId: 'a-order', actorBObjectId: 'b-order',
      actorAHeaders: 'Authorization: Bearer actor-a-secret',
      actorBHeaders: 'Authorization: Bearer actor-b-secret',
    },
    bfla: {
      enabled: true, method: 'GET', endpoint: '/api/admin/report',
      lowPrivilegeHeaders: 'Authorization: Bearer low-secret',
      highPrivilegeHeaders: 'Authorization: Bearer admin-secret',
    },
    enumeration: {
      enabled: true, method: 'GET', endpoint: '/api/users/{value}',
      knownValue: 'existing', unknownValue: 'missing', headers: '',
    },
    rateLimit: { enabled: true, endpoint: '/api/status', requestCount: 4, headers: '' },
  });
  const categories = new Set(report.findings.map((item) => item.category));
  assert.ok(categories.has('BOLA / IDOR'));
  assert.ok(categories.has('BFLA'));
  assert.ok(categories.has('Enumeration'));
  assert.ok(categories.has('CORS'));
  assert.ok(categories.has('Rate limiting'));
  assert.ok(report.findings.every((item) => !['BOLA / IDOR', 'BFLA', 'Enumeration'].includes(item.category) || item.status !== 'confirmed'));
  const exported = JSON.stringify(report);
  for (const secret of ['actor-a-secret', 'actor-b-secret', 'low-secret', 'admin-secret', 'fixture-value']) {
    assert.equal(exported.includes(secret), false);
  }
  assert.equal(fixture.requestCounts.get('/api/status'), 4);
});

test('rate-limit observation reports evidence when throttling is present', async (t) => {
  const fixture = createFixtureServer();
  const baseUrl = await fixture.start();
  t.after(() => fixture.stop());
  const findings = await runRateLimitScanner({
    baseUrl: new URL(baseUrl), client: new SafeHttpClient(), signal: undefined,
  }, { enabled: true, endpoint: '/api/limited', requestCount: 4, headers: '' });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].status, 'observed');
  assert.match(findings[0].evidence, /429/);
});
