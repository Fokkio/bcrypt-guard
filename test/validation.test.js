const assert = require('node:assert/strict');
const test = require('node:test');
const { endpointUrl, parseHeaderLines, validateMethod, validateScanConfig } = require('../src/security/validation');
const { runEnumerationScanner } = require('../src/scanners/enumeration-scanner');
const { runBola } = require('../src/scanners/access-control-scanner');

test('scan requires explicit authorization', () => {
  assert.throws(() => validateScanConfig({ targetUrl: 'https://example.test' }), /confirm/i);
});

test('only read-only methods are accepted', () => {
  assert.equal(validateMethod('get'), 'GET');
  assert.throws(() => validateMethod('POST'), /read-only/i);
});

test('header parser accepts session headers and blocks transport headers', () => {
  assert.deepEqual(parseHeaderLines('Authorization: Bearer fixture\nX-Tenant: demo'), {
    authorization: 'Bearer fixture', 'x-tenant': 'demo',
  });
  assert.throws(() => parseHeaderLines('Host: internal.test'), /not allowed/i);
});

test('scenario endpoints cannot leave the target origin', () => {
  const base = new URL('https://example.test/app');
  assert.equal(endpointUrl(base, '/api/orders/{id}', { id: 'a/b' }).pathname, '/api/orders/a%2Fb');
  assert.throws(() => endpointUrl(base, 'https://other.test/api'), /origin/i);
});

test('enumeration requires an explicit value placeholder', async () => {
  await assert.rejects(() => runEnumerationScanner({}, { enabled: true, endpoint: '/api/users/fixed' }), /\{value\}/);
});

test('BOLA requires an explicit object placeholder', async () => {
  await assert.rejects(() => runBola({}, { enabled: true, endpoint: '/api/orders/fixed' }), /\{id\}/);
});
