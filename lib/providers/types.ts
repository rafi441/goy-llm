import type { Capabilities, GenConfig, ProviderMessage, ProviderType, StreamChunk } from '../types';

export interface DiscoveredModel {
  model_id: string;
  display_name: string;
  context_length: number | null;
  metadata: Record<string, unknown>;
}

export interface ProviderRuntime {
  type: ProviderType;
  base_url: string;
  api_key: string | null;
}

export interface ChatArgs {
  model: string;
  messages: ProviderMessage[];
  config: GenConfig;
  signal?: AbortSignal;
}

export interface Provider {
  listModels(): Promise<DiscoveredModel[]>;
  chat(args: ChatArgs): AsyncIterable<StreamChunk>;
  embed(texts: string[], model: string): Promise<number[][]>;
  capabilities(): Capabilities;
}

export class ProviderError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, opts?: { status?: number; code?: string }) {
    super(message);
    this.name = 'ProviderError';
    this.status = opts?.status;
    this.code = opts?.code;
  }
}
