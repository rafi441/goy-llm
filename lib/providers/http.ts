import { ProviderError } from './types';

export function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

export function mapNetworkError(err: unknown, hint: string): ProviderError {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(msg)) {
    return new ProviderError(`ECONNREFUSED — ${hint}`, { code: 'ECONNREFUSED' });
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new ProviderError('aborted', { code: 'ABORTED' });
  }
  if (code === 'ENOTFOUND' || /ENOTFOUND/i.test(msg)) {
    return new ProviderError('ENOTFOUND — host not found, check base URL', { code: 'ENOTFOUND' });
  }
  if (/timed? ?out|timeout/i.test(msg)) {
    return new ProviderError('timeout after 10s', { code: 'TIMEOUT' });
  }
  return new ProviderError(msg, { code });
}

export function httpStatusMessage(status: number, body: string): string {
  if (status === 401) return '401 — API key rejected';
  if (status === 403) return '403 — access denied';
  if (status === 404) return '404 — endpoint not found, check base URL';
  if (status === 429) return '429 — rate limit exceeded';
  if (status === 400) {
    const detail = extractErrorDetail(body);
    return `400 — parameter rejected${detail ? `: ${detail}` : ''}`;
  }
  if (status >= 500) return `${status} — server upstream error`;
  const detail = extractErrorDetail(body);
  return `${status}${detail ? ` — ${detail}` : ''}`;
}

function extractErrorDetail(body: string): string {
  try {
    const j = JSON.parse(body);
    return j?.error?.message ?? j?.message ?? j?.error ?? '';
  } catch {
    return body.slice(0, 200);
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 10000,
  outerSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  const onAbort = () => controller.abort();
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener('abort', onAbort);
  }
}

export async function* parseSseStream(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trimEnd();
      buffer = buffer.slice(idx + 1);
      if (line.startsWith('data:')) {
        yield line.slice(5).trim();
      }
    }
  }
  const rest = buffer.trim();
  if (rest.startsWith('data:')) yield rest.slice(5).trim();
}

export async function* parseNdjsonStream(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) yield line;
    }
  }
  const rest = buffer.trim();
  if (rest) yield rest;
}
