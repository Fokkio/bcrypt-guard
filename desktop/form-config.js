const value = (id) => document.getElementById(id).value.trim();
const checked = (id) => document.getElementById(id).checked;

export function scanConfig() {
  return {
    targetUrl: value('target-url'),
    authorizationConfirmed: checked('authorization-confirmed'),
    passive: checked('passive-enabled'),
    bola: {
      enabled: checked('bola-enabled'), method: value('bola-method'), endpoint: value('bola-endpoint'),
      actorAObjectId: value('bola-a-id'), actorBObjectId: value('bola-b-id'),
      actorAHeaders: value('bola-a-headers'), actorBHeaders: value('bola-b-headers'),
    },
    bfla: {
      enabled: checked('bfla-enabled'), method: value('bfla-method'), endpoint: value('bfla-endpoint'),
      lowPrivilegeHeaders: value('bfla-low-headers'), highPrivilegeHeaders: value('bfla-high-headers'),
    },
    enumeration: {
      enabled: checked('enum-enabled'), method: value('enum-method'), endpoint: value('enum-endpoint'),
      knownValue: value('enum-known'), unknownValue: value('enum-unknown'), headers: value('enum-headers'),
    },
    rateLimit: {
      enabled: checked('rate-enabled'), endpoint: value('rate-endpoint'),
      requestCount: value('rate-count'), headers: value('rate-headers'),
    },
  };
}

export function benchmarkConfig() {
  return {
    minCost: value('bcrypt-min'), maxCost: value('bcrypt-max'),
    samples: value('bcrypt-samples'), targetLatencyMs: value('bcrypt-target'),
  };
}

export function selectedScanCount(config) {
  return [config.passive, config.bola.enabled, config.bfla.enabled,
    config.enumeration.enabled, config.rateLimit.enabled].filter(Boolean).length;
}
