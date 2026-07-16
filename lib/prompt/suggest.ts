import type { PlayMode } from '../types';

export interface SuggestContext {
  charName: string;
  charDescription: string;
  charPersonality: string;
  charScenario: string;
  personaName: string;
  personaDescription: string;
  authorNote: string;
  lorebook: string[];
  transcript: string;
}

const SYSTEM: Record<PlayMode, string> = {
  as_user:
    "You suggest what the player could do or say next in a roleplay. " +
    'Write 3-4 options from the player\'s point of view ("you"), each at most 15 words.',
  as_char:
    'You suggest lines or actions the character could take next in a roleplay. ' +
    "Write 3-4 options in the character's voice (things they might say or do), each at most 15 words.",
  narrator:
    'You suggest what could happen next in the scene as neutral narration. ' +
    'Write 3-4 short scene beats, each at most 15 words.',
};

export function buildSuggestMessages(
  mode: PlayMode,
  c: SuggestContext,
): { system: string; user: string } {
  const system = SYSTEM[mode] + ' Return ONLY a JSON array of strings. No prose, no explanation.';
  const user = [
    `Character: ${c.charName}`,
    c.charDescription && `Description: ${c.charDescription}`,
    c.charPersonality && `Personality: ${c.charPersonality}`,
    c.charScenario && `Scenario: ${c.charScenario}`,
    `Player persona: ${c.personaName}${c.personaDescription ? ` — ${c.personaDescription}` : ''}`,
    c.authorNote && `Author's note (steer): ${c.authorNote}`,
    c.lorebook.length ? `World info:\n${c.lorebook.join('\n')}` : '',
    `\nConversation so far:\n${c.transcript}`,
    '\nReturn the JSON array now.',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}
