const assert = require('node:assert/strict');
const test = require('node:test');
const { bodyProfile, similarity } = require('../src/security/evidence');
const { finding } = require('../src/security/evidence');

function response(body, status = 200) {
  return { body: JSON.stringify(body), bodyBytes: Buffer.byteLength(JSON.stringify(body)), status, truncated: false };
}

test('JSON evidence ignores volatile request identifiers', () => {
  const left = bodyProfile(response({ id: 7, requestId: 'abc', value: 'same' }));
  const right = bodyProfile(response({ id: 7, requestId: 'xyz', value: 'same' }));
  assert.equal(left.contentHash, right.contentHash);
  assert.equal(similarity(left, right), 1);
});

test('different status and shape reduce similarity', () => {
  const allowed = bodyProfile(response({ order: { id: 7 } }, 200));
  const denied = bodyProfile(response({ error: 'denied' }, 403));
  assert.ok(similarity(allowed, denied) < 0.5);
});

test('finding rejects unrestricted domain strings', () => {
  assert.throws(() => finding({ severity: 'critical', status: 'confirmed', confidence: 'certain' }), /Invalid finding/);
});
