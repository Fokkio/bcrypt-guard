const FINDING_VALUES = {
  severity: new Set(['high', 'medium', 'low', 'info']),
  status: new Set(['observed', 'suspected', 'needs-verification']),
  confidence: new Set(['high', 'medium', 'low']),
};

function text(value, label, maxLength = 4096) {
  if (typeof value !== 'string' || !value || value.length > maxLength) {
    throw new Error(`Invalid report ${label}`);
  }
  return value;
}

function number(value, label) {
  if (!Number.isFinite(value)) throw new Error(`Invalid report ${label}`);
  return value;
}

function cleanFinding(item) {
  if (!item || typeof item !== 'object') throw new Error('Invalid report finding');
  for (const [field, allowed] of Object.entries(FINDING_VALUES)) {
    if (!allowed.has(item[field])) throw new Error(`Invalid report finding ${field}`);
  }
  return {
    id: text(item.id, 'finding id', 128), category: text(item.category, 'finding category', 128),
    title: text(item.title, 'finding title', 256), severity: item.severity,
    status: item.status, confidence: item.confidence,
    endpoint: text(item.endpoint, 'finding endpoint', 2048),
    evidence: text(item.evidence, 'finding evidence'), remediation: text(item.remediation, 'finding remediation'),
  };
}

function cleanScanReport(report) {
  if (report?.schemaVersion !== 1 || !Array.isArray(report.findings) || !Array.isArray(report.checksRun)) {
    throw new Error('Invalid scan report schema');
  }
  return {
    schemaVersion: 1, application: text(report.application, 'application', 128),
    assessmentType: text(report.assessmentType, 'assessment type', 128), target: text(report.target, 'target', 2048),
    startedAt: text(report.startedAt, 'start time', 64), finishedAt: text(report.finishedAt, 'finish time', 64),
    durationMs: number(report.durationMs, 'duration'),
    checksRun: report.checksRun.slice(0, 10).map((item) => text(item, 'check name', 128)),
    limitations: (report.limitations || []).slice(0, 10).map((item) => text(item, 'limitation', 512)),
    summary: {
      high: number(report.summary?.high, 'high count'), medium: number(report.summary?.medium, 'medium count'),
      low: number(report.summary?.low, 'low count'), info: number(report.summary?.info, 'information count'),
    },
    findings: report.findings.slice(0, 200).map(cleanFinding),
  };
}

function cleanBenchmarkReport(report) {
  if (report?.schemaVersion !== 1 || !Array.isArray(report.results)) throw new Error('Invalid benchmark report schema');
  return {
    schemaVersion: 1, measuredAt: text(report.measuredAt, 'measurement time', 64),
    system: {
      platform: text(report.system?.platform, 'platform', 32), arch: text(report.system?.arch, 'architecture', 32),
      cpu: text(report.system?.cpu, 'CPU', 256), logicalCores: number(report.system?.logicalCores, 'logical cores'),
    },
    config: {
      minCost: number(report.config?.minCost, 'minimum cost'), maxCost: number(report.config?.maxCost, 'maximum cost'),
      samples: number(report.config?.samples, 'samples'), targetLatencyMs: number(report.config?.targetLatencyMs, 'target latency'),
    },
    results: report.results.slice(0, 20).map((item) => ({
      cost: number(item.cost, 'cost'), samples: number(item.samples, 'samples'),
      p50Ms: number(item.p50Ms, 'p50'), p95Ms: number(item.p95Ms, 'p95'), meanMs: number(item.meanMs, 'mean'),
      minMs: number(item.minMs, 'minimum'), maxMs: number(item.maxMs, 'maximum'),
      sequentialHashesPerSecond: number(item.sequentialHashesPerSecond, 'hash rate'),
    })),
    recommendation: {
      cost: number(report.recommendation?.cost, 'recommended cost'), measuredP95Ms: number(report.recommendation?.measuredP95Ms, 'recommended p95'),
      targetLatencyMs: number(report.recommendation?.targetLatencyMs, 'recommended target'),
      belowBcryptMinimum: Boolean(report.recommendation?.belowBcryptMinimum), exceedsTarget: Boolean(report.recommendation?.exceedsTarget),
      note: text(report.recommendation?.note, 'recommendation note', 1024),
    },
    guidance: (report.guidance || []).slice(0, 10).map((item) => text(item, 'guidance', 1024)),
  };
}

function cleanReport(reportType, report) {
  if (reportType === 'scan') return cleanScanReport(report);
  if (reportType === 'bcrypt') return cleanBenchmarkReport(report);
  throw new Error('Unknown report type');
}

module.exports = { cleanReport, cleanScanReport, cleanBenchmarkReport };
