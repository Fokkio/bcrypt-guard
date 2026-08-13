const { bodyProfile, finding, similarity } = require('../security/evidence');
const { endpointUrl, parseHeaderLines, validateMethod } = require('../security/validation');

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function sample(context, scenario, value) {
  const responses = [];
  const method = validateMethod(scenario.method || 'GET');
  const headers = parseHeaderLines(scenario.headers);
  const url = endpointUrl(context.baseUrl, scenario.endpoint, { value });
  for (let index = 0; index < 3; index += 1) {
    responses.push(await context.client.request({ url, method, headers, signal: context.signal }));
  }
  return responses;
}

async function runEnumerationScanner(context, scenario) {
  if (!scenario.enabled) return [];
  const known = await sample(context, scenario, scenario.knownValue);
  const unknown = await sample(context, scenario, scenario.unknownValue);
  const knownProfile = bodyProfile(known[0]);
  const unknownProfile = bodyProfile(unknown[0]);
  const responseSimilarity = similarity(knownProfile, unknownProfile);
  const knownMedian = median(known.map((item) => item.elapsedMs));
  const unknownMedian = median(unknown.map((item) => item.elapsedMs));
  const timingDelta = Math.abs(knownMedian - unknownMedian);
  const statusDiffers = knownProfile.status !== unknownProfile.status;
  const materialBodyDifference = responseSimilarity < 0.75;
  const timingDiffers = timingDelta >= 100 && Math.max(knownMedian, unknownMedian) / Math.max(1, Math.min(knownMedian, unknownMedian)) >= 2;
  if (!statusDiffers && !materialBodyDifference && !timingDiffers) return [];
  const endpoint = endpointUrl(context.baseUrl, scenario.endpoint, { value: '[value]' });
  return [finding({
    id: 'enumeration-differential', category: 'Enumeration',
    title: 'Known and unknown identifiers produce distinguishable responses',
    severity: statusDiffers || materialBodyDifference ? 'medium' : 'low', status: 'suspected',
    confidence: statusDiffers || materialBodyDifference ? 'high' : 'low', endpoint: endpoint.pathname,
    evidence: `Status ${knownProfile.status}/${unknownProfile.status}; response similarity ${responseSimilarity}; median timing ${knownMedian.toFixed(1)}ms/${unknownMedian.toFixed(1)}ms. Three bounded samples were used per value.`,
    remediation: 'Normalize status, message shape, response size, and work performed; add rate limiting and monitoring.',
  })];
}

module.exports = { median, runEnumerationScanner };
