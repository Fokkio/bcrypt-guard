const { finding } = require('../security/evidence');

function headerFinding(id, title, header, endpoint, remediation) {
  return finding({
    id,
    category: 'HTTP security controls',
    title,
    severity: 'medium',
    status: 'observed',
    confidence: 'high',
    endpoint,
    evidence: `${header} was not present on the assessed response.`,
    remediation,
  });
}

function inspectSecurityHeaders(response, target) {
  const findings = [];
  const headers = response.headers;
  if (target.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(target.hostname)) {
    findings.push(finding({
      id: 'transport-http', category: 'Transport', title: 'Target uses unencrypted HTTP',
      severity: 'high', status: 'observed', confidence: 'high', endpoint: target.origin,
      evidence: 'The assessed URL uses the http scheme.',
      remediation: 'Redirect HTTP to HTTPS and serve the application only over TLS.',
    }));
  }
  if (target.protocol === 'https:' && !headers['strict-transport-security']) {
    findings.push(headerFinding('header-hsts', 'HSTS header is missing', 'Strict-Transport-Security', target.origin,
      'Add HSTS after confirming all subdomains are ready for HTTPS.'));
  }
  if (!headers['content-security-policy']) {
    findings.push(headerFinding('header-csp', 'Content Security Policy is missing', 'Content-Security-Policy', target.origin,
      'Deploy a restrictive CSP and remove unsafe inline script dependencies.'));
  }
  const csp = headers['content-security-policy'] || '';
  if (!headers['x-frame-options'] && !/frame-ancestors/i.test(csp)) {
    findings.push(headerFinding('header-framing', 'Framing protection is missing', 'X-Frame-Options or CSP frame-ancestors', target.origin,
      'Use CSP frame-ancestors, with X-Frame-Options for legacy compatibility.'));
  }
  if ((headers['x-content-type-options'] || '').toLowerCase() !== 'nosniff') {
    findings.push(headerFinding('header-nosniff', 'MIME sniffing protection is missing', 'X-Content-Type-Options: nosniff', target.origin,
      'Return X-Content-Type-Options: nosniff on application responses.'));
  }
  if (!headers['referrer-policy']) {
    findings.push(headerFinding('header-referrer', 'Referrer Policy is missing', 'Referrer-Policy', target.origin,
      'Set a privacy-preserving Referrer-Policy such as strict-origin-when-cross-origin.'));
  }
  return findings;
}

function inspectCookies(response, endpoint) {
  const findings = [];
  for (const [index, cookie] of (response.headers['set-cookie'] || []).entries()) {
    const name = cookie.split('=', 1)[0] || `cookie-${index + 1}`;
    const missing = [];
    if (!/;\s*httponly(?:;|$)/i.test(cookie)) missing.push('HttpOnly');
    if (!/;\s*secure(?:;|$)/i.test(cookie)) missing.push('Secure');
    if (!/;\s*samesite=(lax|strict|none)(?:;|$)/i.test(cookie)) missing.push('SameSite');
    if (missing.length) {
      findings.push(finding({
        id: `cookie-flags-${index}`, category: 'Session cookie', title: `Cookie ${name} is missing security attributes`,
        severity: 'medium', status: 'observed', confidence: 'high', endpoint,
        evidence: `Missing attributes: ${missing.join(', ')}. Cookie values were not retained.`,
        remediation: 'Set Secure, HttpOnly, and an appropriate SameSite policy on session cookies.',
      }));
    }
  }
  return findings;
}

async function inspectCors(client, target, signal) {
  const origin = 'https://bcrypt-guard.invalid';
  const response = await client.request({ url: target, method: 'GET', headers: { origin }, signal });
  const allowOrigin = response.headers['access-control-allow-origin'];
  const credentials = (response.headers['access-control-allow-credentials'] || '').toLowerCase() === 'true';
  if (allowOrigin === origin && credentials) {
    return [finding({
      id: 'cors-reflection-credentials', category: 'CORS', title: 'Arbitrary origin accepted with credentials',
      severity: 'high', status: 'observed', confidence: 'high', endpoint: target.origin,
      evidence: `The server reflected ${origin} and returned Access-Control-Allow-Credentials: true.`,
      remediation: 'Use an explicit trusted-origin allowlist and never reflect arbitrary Origin values.',
    })];
  }
  return [];
}

async function inspectMethods(client, target, signal) {
  const response = await client.request({ url: target, method: 'OPTIONS', signal });
  const allowed = response.headers.allow || response.headers['access-control-allow-methods'] || '';
  if (!/(^|,|\s)TRACE($|,|\s)/i.test(allowed)) return [];
  return [finding({
    id: 'method-trace', category: 'HTTP methods', title: 'Server advertises the TRACE method',
    severity: 'low', status: 'observed', confidence: 'medium', endpoint: target.origin,
    evidence: `Advertised methods: ${allowed}`,
    remediation: 'Disable TRACE unless a documented operational requirement exists.',
  })];
}

async function runPassiveScanner(context) {
  const { client, baseUrl, signal } = context;
  const response = await client.request({ url: baseUrl, method: 'GET', signal });
  const findings = [
    ...inspectSecurityHeaders(response, baseUrl),
    ...inspectCookies(response, baseUrl.origin),
  ];
  if (response.headers.server || response.headers['x-powered-by']) {
    findings.push(finding({
      id: 'header-disclosure', category: 'Information disclosure', title: 'Technology-identifying headers are exposed',
      severity: 'low', status: 'observed', confidence: 'high', endpoint: baseUrl.origin,
      evidence: 'Server or X-Powered-By headers were present; their values are omitted from the report.',
      remediation: 'Remove unnecessary technology and version disclosure headers.',
    }));
  }
  try { findings.push(...await inspectCors(client, baseUrl, signal)); } catch { /* Baseline remains useful. */ }
  try { findings.push(...await inspectMethods(client, baseUrl, signal)); } catch { /* OPTIONS may be unsupported. */ }
  return findings;
}

module.exports = { inspectSecurityHeaders, runPassiveScanner };
