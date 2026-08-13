function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function metric(label, count) {
  const item = element('span');
  item.append(element('strong', '', String(count)), element('span', '', label.trim()));
  return item;
}

function detail(label, value) {
  const row = element('p', 'finding-detail');
  row.append(element('strong', '', label), element('span', '', value));
  return row;
}

export function renderScanReport(container, report) {
  container.replaceChildren();
  const summary = element('div', 'summary-strip');
  summary.append(
    metric('high', report.summary.high), metric('medium', report.summary.medium),
    metric('low', report.summary.low), metric('information', report.summary.info),
    metric('checks', report.checksRun.length),
  );
  container.append(summary);
  if (!report.findings.length) {
    container.append(element('div', 'empty-result', 'No finding was produced by the selected checks. This is not proof that the target is vulnerability-free.'));
    return;
  }
  for (const item of report.findings) {
    const article = element('article', `finding ${item.severity}`);
    const header = element('div', 'finding-head');
    const titleGroup = element('div');
    titleGroup.append(element('h3', '', item.title), element('span', 'finding-meta', `${item.category} · ${item.status} · confidence ${item.confidence}`));
    header.append(titleGroup, element('span', `badge ${item.severity}`, item.severity));
    article.append(header, detail('Endpoint', item.endpoint),
      detail('Evidence', item.evidence), detail('Remediation', item.remediation));
    container.append(article);
  }
}

export function renderBenchmark(container, report) {
  container.replaceChildren();
  const recommendation = report.recommendation;
  const summary = element('div', 'summary-strip');
  summary.append(metric('recommended cost', recommendation.cost),
    metric('ms measured p95', recommendation.measuredP95Ms),
    metric('ms target', recommendation.targetLatencyMs));
  container.append(summary);
  if (recommendation.belowBcryptMinimum || recommendation.exceedsTarget) {
    container.append(element('div', 'callout', recommendation.note));
  }
  const wrap = element('div', 'table-wrap');
  const table = element('table');
  const thead = element('thead');
  const headRow = element('tr');
  for (const name of ['Cost', 'Samples', 'p50 ms', 'p95 ms', 'Mean ms', 'Min ms', 'Max ms', 'Hashes/s*']) {
    headRow.append(element('th', '', name));
  }
  thead.append(headRow);
  const tbody = element('tbody');
  for (const row of report.results) {
    const tr = element('tr');
    for (const item of [row.cost, row.samples, row.p50Ms, row.p95Ms, row.meanMs, row.minMs, row.maxMs, row.sequentialHashesPerSecond]) {
      tr.append(element('td', '', String(item)));
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);
  wrap.append(table);
  container.append(wrap, element('p', 'status-line', '* Sequential estimate, not concurrent server capacity.'));
}
