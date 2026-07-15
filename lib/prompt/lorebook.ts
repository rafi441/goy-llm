import type { LorebookEntry } from '../types';

export interface ActiveEntry {
  entry: LorebookEntry;
  tokens: number;
}

function matchesKey(haystack: string, key: string, caseSensitive: boolean): boolean {
  if (!key) return false;
  if (caseSensitive) return haystack.includes(key);
  return haystack.toLowerCase().includes(key.toLowerCase());
}

export function scanLorebook(
  entries: LorebookEntry[],
  history: string[],
  tokenBudget: number,
  tokenizer: (s: string) => number,
): { active: LorebookEntry[]; totalTokens: number } {
  const active: LorebookEntry[] = [];
  const enabled = entries.filter((e) => e.enabled);

  for (const entry of enabled) {
    if (entry.constant) {
      active.push(entry);
      continue;
    }
    const depth = entry.scan_depth > 0 ? entry.scan_depth : 4;
    const scanned = history.slice(-depth).join('\n');
    const primaryHit = entry.keys.some((k) => matchesKey(scanned, k, entry.case_sensitive === 1));
    if (!primaryHit) continue;
    if (entry.selective && entry.secondary_keys.length > 0) {
      const secondaryHit = entry.secondary_keys.some((k) =>
        matchesKey(scanned, k, entry.case_sensitive === 1),
      );
      if (!secondaryHit) continue;
    }
    active.push(entry);
  }

  active.sort((a, b) => a.insertion_order - b.insertion_order);

  const selected: LorebookEntry[] = [];
  let totalTokens = 0;
  for (const entry of active) {
    const t = tokenizer(entry.content);
    if (totalTokens + t > tokenBudget) break;
    selected.push(entry);
    totalTokens += t;
  }
  return { active: selected, totalTokens };
}
