import type { PlayMode } from '../types';
import type { SuggestContext } from './suggest';

export type DescribeContext = SuggestContext;

export const DESCRIBE_ASPECTS = [
  'Clothing',
  'Position',
  'Emotion',
  'Appearance',
  'Surroundings',
] as const;

function subject(mode: PlayMode, charName: string, userName: string): string {
  if (mode === 'as_user') return userName;
  if (mode === 'narrator') return 'the current scene';
  return charName;
}

export function buildDescribeMessages(
  aspect: string,
  mode: PlayMode,
  c: DescribeContext,
): { system: string; user: string } {
  const who = subject(mode, c.charName, c.personaName);
  const asp = aspect.trim() || 'situation';

  const system =
    `You are an out-of-character narrator giving the player a factual snapshot. ` +
    `Based ONLY on the story so far, describe ${who}'s current ${asp.toLowerCase()} ` +
    `in 1-3 concise, present-tense sentences. Ground every detail in what has already happened; ` +
    `if something is unknown, infer the most plausible state from context. ` +
    `Do NOT advance the plot, invent new events, or write dialogue — this is a snapshot, not a story beat. ` +
    `Reply with only the description.`;

  const user = [
    `Character: ${c.charName}`,
    c.charDescription && `Description: ${c.charDescription}`,
    c.charPersonality && `Personality: ${c.charPersonality}`,
    c.charScenario && `Scenario: ${c.charScenario}`,
    `Player persona: ${c.personaName}${c.personaDescription ? ` — ${c.personaDescription}` : ''}`,
    c.authorNote && `Author's note: ${c.authorNote}`,
    c.lorebook.length ? `World info:\n${c.lorebook.join('\n')}` : '',
    `\nStory so far:\n${c.transcript}`,
    `\nDescribe ${who}'s current ${asp.toLowerCase()} now.`,
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}
