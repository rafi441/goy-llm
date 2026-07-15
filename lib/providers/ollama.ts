import type { Capabilities, StreamChunk } from '../types';
import type { ChatArgs, DiscoveredModel, Provider, ProviderRuntime } from './types';
import { ProviderError } from './types';
import {
  fetchWithTimeout,
  httpStatusMessage,
  joinUrl,
  mapNetworkError,
  parseNdjsonStream,
} from './http';

const HINT = 'Ollama not running on :11434?';

export function createOllamaProvider(rt: ProviderRuntime, capabilities: Capabilities): Provider {
  function options(args: ChatArgs): Record<string, unknown> {
    const c = args.config;
    const o: Record<string, unknown> = {};
    if (c.temperature !== undefined) o.temperature = c.temperature;
    if (c.top_p !== undefined) o.top_p = c.top_p;
    if (c.top_k !== undefined) o.top_k = c.top_k;
    if (c.min_p !== undefined) o.min_p = c.min_p;
    if (c.frequency_penalty !== undefined) o.frequency_penalty = c.frequency_penalty;
    if (c.presence_penalty !== undefined) o.presence_penalty = c.presence_penalty;
    if (c.repetition_penalty !== undefined) o.repeat_penalty = c.repetition_penalty;
    if (c.max_tokens !== undefined) o.num_predict = c.max_tokens;
    if (c.seed !== undefined && c.seed !== null) o.seed = c.seed;
    if (c.stop_sequences && c.stop_sequences.length) o.stop = c.stop_sequences;
    return o;
  }

  return {
    async listModels(): Promise<DiscoveredModel[]> {
      let res: Response;
      try {
        res = await fetchWithTimeout(joinUrl(rt.base_url, 'api/tags'), {});
      } catch (e) {
        throw mapNetworkError(e, HINT);
      }
      if (!res.ok) {
        throw new ProviderError(httpStatusMessage(res.status, await res.text()), { status: res.status });
      }
      const json = (await res.json()) as {
        models?: { name: string; model?: string; details?: Record<string, unknown> }[];
      };
      return (json.models ?? []).map((m) => ({
        model_id: m.model ?? m.name,
        display_name: m.name,
        context_length: null,
        metadata: { ...(m.details ?? {}) },
      }));
    },

    async *chat(args: ChatArgs): AsyncIterable<StreamChunk> {
      let res: Response;
      try {
        res = await fetch(joinUrl(rt.base_url, 'api/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: args.model,
            messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
            stream: true,
            options: options(args),
          }),
          signal: args.signal,
        });
      } catch (e) {
        throw mapNetworkError(e, HINT);
      }
      if (!res.ok) {
        throw new ProviderError(httpStatusMessage(res.status, await res.text()), { status: res.status });
      }
      for await (const line of parseNdjsonStream(res)) {
        try {
          const json = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            error?: string;
          };
          if (json.error) throw new ProviderError(json.error);
          const delta = json.message?.content ?? '';
          if (delta) yield { delta, done: false };
          if (json.done) {
            yield { delta: '', done: true };
            return;
          }
        } catch (e) {
          if (e instanceof ProviderError) throw e;
        }
      }
      yield { delta: '', done: true };
    },

    async embed(texts: string[], model: string): Promise<number[][]> {
      let res: Response;
      try {
        res = await fetchWithTimeout(
          joinUrl(rt.base_url, 'api/embed'),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, input: texts }),
          },
          30000,
        );
      } catch (e) {
        throw mapNetworkError(e, HINT);
      }
      if (!res.ok) {
        throw new ProviderError(httpStatusMessage(res.status, await res.text()), { status: res.status });
      }
      const json = (await res.json()) as { embeddings?: number[][] };
      return json.embeddings ?? [];
    },

    capabilities(): Capabilities {
      return capabilities;
    },
  };
}
