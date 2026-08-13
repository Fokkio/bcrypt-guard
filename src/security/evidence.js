const crypto = require('node:crypto');

const VOLATILE_KEYS = /^(date|time|timestamp|request.?id|trace.?id|nonce|csrf|token)$/i;
const ALLOWED_VALUES = {
  severity: new Set(['high', 'medium', 'low', 'info']),
  status: new Set(['observed', 'suspected', 'needs-verification']),
  confidence: new Set(['high', 'medium', 'low']),
};

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function scrubJson(value, structureOnly = false, key = '') {
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => scrubJson(item, structureOnly));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((name) => [
      name,
      scrubJson(value[name], structureOnly, name),
    ]));
  }
  if (structureOnly) return value === null ? 'null' : typeof value;
  return VOLATILE_KEYS.test(key) ? '[volatile]' : value;
}

function bodyProfile(response) {
  const body = response.body || '';
  let normalized = body.replace(/\s+/g, ' ').trim();
  let structure = normalized.replace(/[A-Za-z0-9_-]{12,}/g, '[value]');
  let kind = 'text';
  try {
    const parsed = JSON.parse(body);
    normalized = JSON.stringify(scrubJson(parsed));
    structure = JSON.stringify(scrubJson(parsed, true));
    kind = 'json';
  } catch {
    // Non-JSON responses use whitespace-normalized text fingerprints.
  }
  return {
    status: response.status,
    bytes: response.bodyBytes,
    truncated: response.truncated,
    kind,
    contentHash: hash(normalized),
    structureHash: hash(structure),
  };
}

function similarity(left, right) {
  if (!left || !right) return 0;
  let score = 0;
  if (left.status === right.status) score += 0.2;
  if (left.structureHash === right.structureHash) score += 0.35;
  if (left.contentHash === right.contentHash) score += 0.3;
  const largest = Math.max(left.bytes, right.bytes, 1);
  score += 0.15 * (1 - Math.min(1, Math.abs(left.bytes - right.bytes) / largest));
  return Number(score.toFixed(2));
}

function finding(input) {
  for (const [field, allowed] of Object.entries(ALLOWED_VALUES)) {
    if (!allowed.has(input[field])) throw new Error(`Invalid finding ${field}`);
  }
  return {
    id: input.id,
    category: input.category,
    title: input.title,
    severity: input.severity,
    status: input.status,
    confidence: input.confidence,
    endpoint: input.endpoint,
    evidence: input.evidence,
    remediation: input.remediation,
  };
}

module.exports = { bodyProfile, finding, similarity };
