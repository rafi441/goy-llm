export interface MacroContext {
  char: string;
  user: string;
  persona: string;
  now: Date;
  rng: () => number;
}

export function resolveMacros(text: string, ctx: MacroContext): string {
  if (!text) return '';
  return text.replace(/\{\{([^}]*)\}\}/g, (match, inner: string) => {
    const raw = inner.trim();
    const lower = raw.toLowerCase();
    if (lower === 'char') return ctx.char;
    if (lower === 'user') return ctx.user;
    if (lower === 'persona') return ctx.persona;
    if (lower === 'time') return ctx.now.toLocaleTimeString();
    if (lower === 'date') return ctx.now.toLocaleDateString();
    if (lower.startsWith('random:')) {
      const opts = raw
        .slice(raw.indexOf(':') + 1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (opts.length === 0) return '';
      const i = Math.floor(ctx.rng() * opts.length) % opts.length;
      return opts[i] ?? '';
    }
    return match;
  });
}

export function makeMacroContext(
  char: string,
  user: string,
  persona: string,
  now: Date = new Date(),
  rng: () => number = Math.random,
): MacroContext {
  return { char, user, persona, now, rng };
}
