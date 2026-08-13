const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const BLOCKED_HEADERS = new Set([
  'connection', 'content-length', 'host', 'proxy-authorization',
  'transfer-encoding', 'upgrade',
]);

function requireText(value, label, maxLength = 2048) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  if (value.length > maxLength) throw new Error(`${label} is too long`);
  return value.trim();
}

function validateTargetUrl(value) {
  const raw = requireText(value, 'Target URL');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Target URL is not a valid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS targets are supported');
  }
  if (url.username || url.password) {
    throw new Error('Credentials must not be embedded in the target URL');
  }
  url.hash = '';
  return url;
}

function validateMethod(value = 'GET') {
  const method = String(value).toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error('Only read-only GET, HEAD, and OPTIONS requests are allowed');
  }
  return method;
}

function parseHeaderLines(value = '') {
  if (!value) return {};
  if (typeof value !== 'string' || value.length > 8192) {
    throw new Error('Session headers must be plain text under 8 KB');
  }

  const headers = {};
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf(':');
    if (separator < 1) throw new Error('Each session header must use Name: value');
    const name = line.slice(0, separator).trim().toLowerCase();
    const headerValue = line.slice(separator + 1).trim();
    if (!/^[a-z0-9!#$%&'*+.^_`|~-]+$/.test(name) || !headerValue) {
      throw new Error('A session header name or value is invalid');
    }
    if (BLOCKED_HEADERS.has(name) || name.startsWith('sec-')) {
      throw new Error(`Header ${name} is not allowed`);
    }
    if (/\r|\n/.test(headerValue)) throw new Error('Header values cannot contain new lines');
    headers[name] = headerValue;
  }
  return headers;
}

function endpointUrl(baseUrl, endpoint, replacements = {}) {
  const path = requireText(endpoint, 'Endpoint', 4096);
  let expanded = path;
  for (const [key, value] of Object.entries(replacements)) {
    expanded = expanded.replaceAll(`{${key}}`, encodeURIComponent(requireText(value, key, 512)));
  }
  if (/\{[^}]+\}/.test(expanded)) throw new Error('Endpoint has an unresolved placeholder');
  const url = new URL(expanded, baseUrl);
  if (url.origin !== baseUrl.origin) throw new Error('Scenario endpoints must remain on the target origin');
  return url;
}

function boundedInteger(value, label, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return fallback;
  if (number < min || number > max) throw new Error(`${label} must be ${min}-${max}`);
  return number;
}

function validateScanConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('Scan configuration is required');
  if (input.authorizationConfirmed !== true) {
    throw new Error('You must confirm that you are authorized to assess this target');
  }
  const baseUrl = validateTargetUrl(input.targetUrl);
  return {
    baseUrl,
    passive: input.passive !== false,
    bola: input.bola || {},
    bfla: input.bfla || {},
    enumeration: input.enumeration || {},
    rateLimit: input.rateLimit || {},
  };
}

module.exports = {
  boundedInteger,
  endpointUrl,
  parseHeaderLines,
  validateMethod,
  validateScanConfig,
  validateTargetUrl,
};
