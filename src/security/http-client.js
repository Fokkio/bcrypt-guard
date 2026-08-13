const { performance } = require('node:perf_hooks');
const { validateMethod, validateTargetUrl } = require('./validation');

const DEFAULT_MAX_BYTES = 256 * 1024;

async function readLimitedBody(response, maxBytes) {
  if (!response.body) return { body: '', truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxBytes - total;
    if (value.byteLength > remaining) {
      chunks.push(value.slice(0, Math.max(0, remaining)));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return { body: bytes.toString('utf8'), truncated };
}

function responseHeaders(response) {
  const headers = Object.fromEntries(response.headers.entries());
  headers['set-cookie'] = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : [];
  return headers;
}

class SafeHttpClient {
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || 8000;
    this.maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
    this.maxRedirects = options.maxRedirects ?? 2;
  }

  async request(input) {
    const original = validateTargetUrl(String(input.url));
    const method = validateMethod(input.method);
    const controller = new AbortController();
    const cancel = () => controller.abort(input.signal?.reason || new Error('Scan cancelled'));
    input.signal?.addEventListener('abort', cancel, { once: true });
    if (input.signal?.aborted) cancel();
    const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), this.timeoutMs);

    try {
      return await this.followSameOrigin(original, method, input.headers || {}, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Request cancelled or timed out');
      throw new Error(`Network request failed: ${error.message}`);
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener('abort', cancel);
    }
  }

  async followSameOrigin(original, method, headers, signal) {
    let current = original;
    for (let redirect = 0; redirect <= this.maxRedirects; redirect += 1) {
      const started = performance.now();
      const response = await fetch(current, {
        method,
        headers: { 'user-agent': 'Bcrypt-Guard-Desktop/2.0 authorized-assessment', ...headers },
        redirect: 'manual',
        signal,
      });
      const elapsedMs = performance.now() - started;
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        if (redirect === this.maxRedirects) throw new Error('Redirect limit exceeded');
        const next = new URL(response.headers.get('location'), current);
        if (next.origin !== original.origin) throw new Error('Cross-origin redirect was blocked');
        current = next;
        continue;
      }
      const content = method === 'HEAD'
        ? { body: '', truncated: false }
        : await readLimitedBody(response, this.maxBytes);
      return {
        url: current.toString(),
        status: response.status,
        elapsedMs: Number(elapsedMs.toFixed(2)),
        headers: responseHeaders(response),
        body: content.body,
        bodyBytes: Buffer.byteLength(content.body),
        truncated: content.truncated,
      };
    }
    throw new Error('Redirect limit exceeded');
  }
}

module.exports = { SafeHttpClient, readLimitedBody };
