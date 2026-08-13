const { boundedInteger, endpointUrl, parseHeaderLines } = require('../security/validation');
const { finding } = require('../security/evidence');

async function runRateLimitScanner(context, scenario) {
  if (!scenario.enabled) return [];
  const count = boundedInteger(scenario.requestCount, 'Request count', 3, 10, 6);
  const endpoint = endpointUrl(context.baseUrl, scenario.endpoint);
  const headers = parseHeaderLines(scenario.headers);
  const statuses = [];
  let rateHeadersObserved = false;
  for (let index = 0; index < count; index += 1) {
    const response = await context.client.request({ url: endpoint, method: 'GET', headers, signal: context.signal });
    statuses.push(response.status);
    rateHeadersObserved ||= Object.keys(response.headers).some((name) => /^(rate.?limit|retry-after)/i.test(name));
  }
  if (statuses.includes(429) || rateHeadersObserved) return [];
  return [finding({
    id: 'rate-limit-observation', category: 'Rate limiting', title: 'Rate-limit evidence was not observed in the safe sample',
    severity: 'info', status: 'needs-verification', confidence: 'low', endpoint: endpoint.pathname,
    evidence: `${count} bounded GET requests returned no 429 response or rate-limit header. This does not prove rate limiting is absent.`,
    remediation: 'Verify endpoint-specific throttling with an authorized test plan and monitor abusive request patterns.',
  })];
}

module.exports = { runRateLimitScanner };
