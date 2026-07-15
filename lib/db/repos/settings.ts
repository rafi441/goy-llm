import 'server-only';
import { getDb } from '../index';
import { PROMPT_ORDER_KEYS, type GenConfig, type PromptOrderKey } from '../../types';

export function getSetting(key: string): string | undefined {
  const r = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return r?.value;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run(key, value);
}

export function getPromptOrder(): PromptOrderKey[] {
  const raw = getSetting('prompt_order');
  if (!raw) return [...PROMPT_ORDER_KEYS];
  try {
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((k): k is PromptOrderKey =>
      (PROMPT_ORDER_KEYS as readonly string[]).includes(k),
    );
    for (const k of PROMPT_ORDER_KEYS) if (!valid.includes(k)) valid.push(k);
    return valid;
  } catch {
    return [...PROMPT_ORDER_KEYS];
  }
}

export function setPromptOrder(order: PromptOrderKey[]): void {
  setSetting('prompt_order', JSON.stringify(order));
}

export interface BehaviorSettings {
  system_prompt: string;
  default_gen_config: GenConfig;
  utility_connection_id: string | null;
  utility_model_id: string | null;
  embedding_connection_id: string | null;
  embedding_model_id: string | null;
  rag_top_k: number;
  rag_threshold: number;
  narrator_name: string;
}

const DEFAULT_BEHAVIOR: BehaviorSettings = {
  system_prompt:
    "You are an immersive roleplay engine. Stay in character. Write vivid, in-character prose. Never break character or mention that you are an AI.",
  default_gen_config: { temperature: 0.9, top_p: 1, max_tokens: 512 },
  utility_connection_id: null,
  utility_model_id: null,
  embedding_connection_id: null,
  embedding_model_id: null,
  rag_top_k: 4,
  rag_threshold: 0.3,
  narrator_name: 'Narrator',
};

export function getBehavior(): BehaviorSettings {
  const raw = getSetting('behavior');
  if (!raw) return { ...DEFAULT_BEHAVIOR };
  try {
    return { ...DEFAULT_BEHAVIOR, ...(JSON.parse(raw) as Partial<BehaviorSettings>) };
  } catch {
    return { ...DEFAULT_BEHAVIOR };
  }
}

export function setBehavior(patch: Partial<BehaviorSettings>): BehaviorSettings {
  const merged = { ...getBehavior(), ...patch };
  setSetting('behavior', JSON.stringify(merged));
  return merged;
}
