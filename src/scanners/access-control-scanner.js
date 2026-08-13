const { bodyProfile, finding, similarity } = require('../security/evidence');
const { endpointUrl, parseHeaderLines, validateMethod } = require('../security/validation');

function isAllowed(response) {
  return response.status >= 200 && response.status < 300;
}

async function runBola(context, scenario) {
  if (!scenario.enabled) return [];
  const method = validateMethod(scenario.method || 'GET');
  const actorAHeaders = parseHeaderLines(scenario.actorAHeaders);
  const actorBHeaders = parseHeaderLines(scenario.actorBHeaders);
  const ownA = endpointUrl(context.baseUrl, scenario.endpoint, { id: scenario.actorAObjectId });
  const ownB = endpointUrl(context.baseUrl, scenario.endpoint, { id: scenario.actorBObjectId });
  const [aOwn, bOwn, aOther] = await Promise.all([
    context.client.request({ url: ownA, method, headers: actorAHeaders, signal: context.signal }),
    context.client.request({ url: ownB, method, headers: actorBHeaders, signal: context.signal }),
    context.client.request({ url: ownB, method, headers: actorAHeaders, signal: context.signal }),
  ]);
  const crossSimilarity = similarity(bodyProfile(bOwn), bodyProfile(aOther));
  if (isAllowed(aOwn) && isAllowed(bOwn) && isAllowed(aOther)) {
    return [finding({
      id: 'bola-cross-object', category: 'BOLA / IDOR',
      title: 'Actor A may be able to read Actor B’s object', severity: crossSimilarity >= 0.8 ? 'high' : 'medium',
      status: 'suspected', confidence: crossSimilarity >= 0.8 ? 'high' : 'medium', endpoint: ownB.pathname,
      evidence: `Both owner baselines and the cross-object request returned 2xx. Response similarity to Actor B baseline: ${crossSimilarity}.`,
      remediation: 'Enforce object-level authorization on every request using server-side ownership, tenant, and delegation policy.',
    })];
  }
  return [];
}

async function runBfla(context, scenario) {
  if (!scenario.enabled) return [];
  const method = validateMethod(scenario.method || 'GET');
  const endpoint = endpointUrl(context.baseUrl, scenario.endpoint);
  const highHeaders = parseHeaderLines(scenario.highPrivilegeHeaders);
  const lowHeaders = parseHeaderLines(scenario.lowPrivilegeHeaders);
  const [high, low] = await Promise.all([
    context.client.request({ url: endpoint, method, headers: highHeaders, signal: context.signal }),
    context.client.request({ url: endpoint, method, headers: lowHeaders, signal: context.signal }),
  ]);
  const responseSimilarity = similarity(bodyProfile(high), bodyProfile(low));
  if (isAllowed(high) && isAllowed(low)) {
    return [finding({
      id: 'bfla-role-boundary', category: 'BFLA', title: 'Low-privilege actor may access a privileged function',
      severity: responseSimilarity >= 0.8 ? 'high' : 'medium', status: 'suspected',
      confidence: responseSimilarity >= 0.8 ? 'high' : 'medium', endpoint: endpoint.pathname,
      evidence: `High- and low-privilege requests both returned 2xx. Response similarity: ${responseSimilarity}.`,
      remediation: 'Apply deny-by-default function authorization and explicit role grants on every privileged endpoint.',
    })];
  }
  return [];
}

async function runAccessControlScanner(context, config) {
  return [
    ...await runBola(context, config.bola),
    ...await runBfla(context, config.bfla),
  ];
}

module.exports = { runAccessControlScanner, runBfla, runBola };
