import type { Capabilities, GenConfig, ProviderType } from '../types';
import type { Provider, ProviderRuntime } from './types';
import { createOpenAiProvider } from './openai';
import { createOllamaProvider } from './ollama';

export { ProviderError } from './types';
export type { Provider, DiscoveredModel } from './types';

const ALL_PARAMS: (keyof GenConfig)[] = [
  'temperature',
  'top_p',
  'top_k',
  'min_p',
  'frequency_penalty',
  'presence_penalty',
  'repetition_penalty',
  'max_tokens',
  'seed',
  'stop_sequences',
];

function caps(enabled: Partial<Record<keyof GenConfig, boolean>>, embeddings: boolean): Capabilities {
  const supports = {} as Record<keyof GenConfig, boolean>;
  for (const p of ALL_PARAMS) supports[p] = enabled[p] ?? false;
  return { supports, streaming: true, embeddings };
}

export const CAPABILITIES: Record<ProviderType, Capabilities> = {
  openrouter: caps(
    {
      temperature: true,
      top_p: true,
      top_k: true,
      min_p: true,
      frequency_penalty: true,
      presence_penalty: true,
      repetition_penalty: false,
      max_tokens: true,
      seed: true,
      stop_sequences: true,
    },
    false,
  ),
  ollama: caps(
    {
      temperature: true,
      top_p: true,
      top_k: true,
      min_p: true,
      frequency_penalty: true,
      presence_penalty: true,
      repetition_penalty: true,
      max_tokens: true,
      seed: true,
      stop_sequences: true,
    },
    true,
  ),
  lmstudio: caps(
    {
      temperature: true,
      top_p: true,
      top_k: true,
      min_p: true,
      frequency_penalty: true,
      presence_penalty: true,
      repetition_penalty: true,
      max_tokens: true,
      seed: true,
      stop_sequences: true,
    },
    true,
  ),
  openai_compat: caps(
    {
      temperature: true,
      top_p: true,
      top_k: false,
      min_p: false,
      frequency_penalty: true,
      presence_penalty: true,
      repetition_penalty: false,
      max_tokens: true,
      seed: true,
      stop_sequences: true,
    },
    true,
  ),
};

export const DEFAULT_BASE_URL: Record<ProviderType, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234/v1',
  openai_compat: '',
};

export function getCapabilities(type: ProviderType): Capabilities {
  return CAPABILITIES[type];
}

export function getProvider(type: ProviderType, baseUrl: string | null, apiKey: string | null): Provider {
  const base = baseUrl && baseUrl.trim() ? baseUrl.trim() : DEFAULT_BASE_URL[type];
  const rt: ProviderRuntime = { type, base_url: base, api_key: apiKey };
  const capabilities = CAPABILITIES[type];

  switch (type) {
    case 'ollama':
      return createOllamaProvider(rt, capabilities);
    case 'openrouter':
      return createOpenAiProvider(rt, {
        requireAuth: true,
        capabilities,
        refuseHint: 'OpenRouter is unreachable',
        extraHeaders: {
          'HTTP-Referer': 'http://localhost',
          'X-Title': 'GoyLLM',
        },
      });
    case 'lmstudio':
      return createOpenAiProvider(rt, {
        requireAuth: false,
        capabilities,
        refuseHint: 'LM Studio server not running?',
      });
    case 'openai_compat':
    default:
      return createOpenAiProvider(rt, {
        requireAuth: false,
        capabilities,
        refuseHint: 'OpenAI-compatible endpoint is unreachable',
      });
  }
}
