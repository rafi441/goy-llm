const CHARS_PER_TOKEN = 3.8;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const byChars = chars / CHARS_PER_TOKEN;
  const byWords = words * 1.33;
  return Math.max(1, Math.ceil((byChars + byWords) / 2));
}

export function estimateMessageTokens(messages: { role: string; content: string }[]): number {
  let total = 0;
  for (const m of messages) {
    total += estimateTokens(m.content) + 4;
  }
  return total + 2;
}
