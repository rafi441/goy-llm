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

function task(mode: PlayMode, charName: string, userName: string): string {
  switch (mode) {
    case 'as_char':
      return (
        `Suggest 3-4 distinct things ${charName} could say or do next. ` +
        `Each option is ${charName}'s OWN spoken line or action, in ${charName}'s voice. ` +
        `Never write for ${userName} the player.`
      );
    case 'narrator':
      return (
        `Suggest 3-4 distinct things that could happen next in the scene, as neutral third-person narration ` +
        `(events, environment, atmosphere, other characters). ` +
        `Do NOT write dialogue or actions for ${charName} or ${userName}.`
      );
    case 'as_user':
    default:
      return (
        `Suggest 3-4 distinct things ${userName} the player could do or say next, ` +
        `written from ${userName}'s first-person point of view. ` +
        `Never speak or act for ${charName}.`
      );
  }
}

export function buildSuggestMessages(
  mode: PlayMode,
  c: SuggestContext,
): { system: string; user: string } {
  const system =
    `You propose next-beat options for an ongoing roleplay between ` +
    `${c.charName} (the character) and ${c.personaName} (the player). ` +
    task(mode, c.charName, c.personaName) +
    ` Each option at most 15 words. Return ONLY a JSON array of strings — no prose, no numbering, no keys.`;

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
