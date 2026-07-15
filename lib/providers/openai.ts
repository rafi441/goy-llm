import type { Capabilities, GenConfig, StreamChunk } from '../types';
import type { ChatArgs, DiscoveredModel, Provider, ProviderRuntime } from './types';
import { ProviderError } from './types';
import {
  fetchWithTimeout,
  httpStatusMessage,
  joinUrl,
  mapNetworkError,
  parseSseStream,
} from './http';

interface OpenAiProviderOptions {
  requireAuth: boolean;
  extraHeaders?: Record<string, string>;
  capabilities: Capabilities;
  refuseHint: string;
}

export function createOpenAiProvider(rt: ProviderRuntime, opts: OpenAiProviderOptions): Provider {
  function headers(json = true): Record<string, string> {
    const h: Record<string, string> = { ...opts.extraHeaders };
    if (json) h['Content-Type'] = 'application/json';
    if (rt.api_key) h['Authorization'] = `Bearer ${rt.api_key}`;
    return h;
  }

  function buildBody(args: ChatArgs, stream: boolean): Record<string, unknown> {
    const c = args.config;
    const cap = opts.capabilities.supports;
    const body: Record<string, unknown> = {
      model: args.model,
      messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
      stream,
    };
    const put = (key: keyof GenConfig, target: string, value: unknown) => {
      if (cap[key] && value !== undefined && value !== null) body[target] = value;
    };
    put('temperature', 'temperature', c.temperature);
    put('top_p', 'top_p', c.top_p);
    put('top_k', 'top_k', c.top_k);
    put('min_p', 'min_p', c.min_p);
    put('frequency_penalty', 'frequency_penalty', c.frequency_penalty);
    put('presence_penalty', 'presence_penalty', c.presence_penalty);
    put('repetition_penalty', 'repetition_penalty', c.repetition_penalty);
    put('max_tokens', 'max_tokens', c.max_tokens);
    put('seed', 'seed', c.seed);
    if (cap.stop_sequences && c.stop_sequences && c.stop_sequences.length) {
      body.stop = c.stop_sequences;
    }
    return body;
  }

  return {
    async listModels(): Promise<DiscoveredModel[]> {
      let res: Response;
      try {
        res = await fetchWithTimeout(joinUrl(rt.base_url, 'models'), { headers: headers(false) });
      } catch (e) {
        throw mapNetworkError(e, opts.refuseHint);
      }
      if (!res.ok) {
        throw new ProviderError(httpStatusMessage(res.status, await res.text()), { status: res.status });
      }
      const data = (await res.json()) as { data?: unknown[] };
      const list = Array.isArray(data.data) ? data.data : [];
      return list.map((raw) => {
        const m = raw as Record<string, unknown>;
        const id = String(m.id ?? m.name ?? '');
        const pricing = m.pricing as Record<string, string> | undefined;
        return {
          model_id: id,
          display_name: String((m.name as string) ?? id),
          context_length:
            typeof m.context_length === 'number'
              ? m.context_length
              : typeof (m.top_provider as { context_length?: number })?.context_length === 'number'
                ? (m.top_provider as { context_length: number }).context_length
                : null,
          metadata: {
            prompt_price: pricing?.prompt ? Number(pricing.prompt) * 1_000_000 : null,
            completion_price: pricing?.completion ? Number(pricing.completion) * 1_000_000 : null,
            description: (m.description as string) ?? null,
          },
        };
      });
    },

    async *chat(args: ChatArgs): AsyncIterable<StreamChunk> {
      let res: Response;
      try {
        res = await fetch(joinUrl(rt.base_url, 'chat/completions'), {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(buildBody(args, true)),
          signal: args.signal,
        });
      } catch (e) {
        throw mapNetworkError(e, opts.refuseHint);
      }
      if (!res.ok) {
        throw new ProviderError(httpStatusMessage(res.status, await res.text()), { status: res.status });
      }
      for await (const data of parseSseStream(res)) {
        if (data === '[DONE]') {
          yield { delta: '', done: true };
          return;
        }
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
          };
          const choice = json.choices?.[0];
          const delta = choice?.delta?.content ?? '';
          if (delta) yield { delta, done: false };
          if (choice?.finish_reason) {
            yield { delta: '', done: true };
            return;
          }
        } catch {
          /* skip keep-alive / partial */
        }
      }
      yield { delta: '', done: true };
    },

    async embed(texts: string[], model: string): Promise<number[][]> {
      let res: Response;
      try {
        res = await fetchWithTimeout(
          joinUrl(rt.base_url, 'embeddings'),
          {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ model, input: texts }),
          },
          30000,
        );
      } catch (e) {
        throw mapNetworkError(e, opts.refuseHint);
      }
      if (!res.ok) {
        throw new ProviderError(httpStatusMessage(res.status, await res.text()), { status: res.status });
      }
      const json = (await res.json()) as { data?: { embedding: number[] }[] };
      return (json.data ?? []).map((d) => d.embedding);
    },

    capabilities(): Capabilities {
      return opts.capabilities;
    },
  };
}
