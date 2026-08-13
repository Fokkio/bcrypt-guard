const http = require('node:http');

function json(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
}

function createFixtureServer() {
  const requestCounts = new Map();
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://fixture.local');
    requestCounts.set(url.pathname, (requestCounts.get(url.pathname) || 0) + 1);
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { allow: 'GET, HEAD, OPTIONS, TRACE' });
      return response.end();
    }
    if (url.pathname === '/') {
      const origin = request.headers.origin;
      return json(response, 200, { name: 'fixture' }, {
        'x-powered-by': 'fixture-stack',
        'set-cookie': 'session=fixture-value; Path=/',
        ...(origin ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } : {}),
      });
    }
    if (url.pathname.startsWith('/api/orders/')) {
      const id = url.pathname.split('/').at(-1);
      const records = {
        'a-order': { id: 'a-order', owner: 'actor-a', amount: 100 },
        'b-order': { id: 'b-order', owner: 'actor-b', amount: 200 },
      };
      return records[id] ? json(response, 200, records[id]) : json(response, 404, { error: 'not found' });
    }
    if (url.pathname === '/api/admin/report') {
      return json(response, 200, { report: 'quarterly', visibility: 'administrator' });
    }
    if (url.pathname === '/api/users/existing') {
      return json(response, 200, { exists: true, email: 'fixture@example.test' });
    }
    if (url.pathname.startsWith('/api/users/')) {
      return json(response, 404, { error: 'account not found' });
    }
    if (url.pathname === '/api/status') return json(response, 200, { ok: true });
    return json(response, 404, { error: 'not found' });
  });

  return {
    requestCounts,
    async start() {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      return `http://127.0.0.1:${address.port}`;
    },
    async stop() { await new Promise((resolve) => server.close(resolve)); },
  };
}

module.exports = { createFixtureServer };
